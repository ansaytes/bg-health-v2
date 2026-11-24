// Otomatisasi Dispensasi Resep Obat & Pengurangan Stok Inventory
// Menerapkan prinsip FEFO (First Expired, First Out):
//  1. Mencari item di inventory_items berdasarkan nama obat.
//  2. Mengurangi sisa_stok pada inventory_batches yang memiliki
//     tanggal_expired paling awal (terdekat dengan kedaluwarsa).
//  3. Mencatat mutasi keluar pada inventory_transactions.
//  4. Mengupdate ringkasan stock pada master inventory_items.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ItemResep {
  nama: string;
  aturan?: string;
  jumlah: string | number;
  satuan?: string;
}

export interface HasilDispensasi {
  berhasil: boolean;
  totalItem: number;
  itemDipotong: Array<{
    itemId: string;
    nama: string;
    jumlahDiminta: number;
    jumlahDipotong: number;
    stokCukup: boolean;
    batchDetails: Array<{ batchId: string; potong: number }>;
  }>;
  catatan: string[];
}

/**
 * Parsing aman payload jenis_obat yang bisa berupa JSON string atau Array.
 */
export function parseJenisObat(raw: unknown): ItemResep[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((r): r is ItemResep => typeof r === 'object' && r !== null && 'nama' in r);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((r): r is ItemResep => typeof r === 'object' && r !== null && 'nama' in r);
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Melakukan pemotongan stok otomatis secara FEFO saat kunjungan berobat disimpan.
 */
export async function potongStokResepKunjungan(
  client: SupabaseClient,
  kunjunganId: string,
  namaPasien: string,
  jenisObatRaw: unknown
): Promise<HasilDispensasi> {
  const items = parseJenisObat(jenisObatRaw);
  const hasil: HasilDispensasi = {
    berhasil: true,
    totalItem: items.length,
    itemDipotong: [],
    catatan: [],
  };

  if (!items.length) {
    return hasil;
  }

  for (const it of items) {
    const namaObat = (it.nama || '').trim();
    const qtyDiminta = parseInt(String(it.jumlah || '0'), 10);
    if (!namaObat || qtyDiminta <= 0) continue;

    try {
      // 1. Cari item master di inventory_items
      const { data: invItem, error: itemError } = await client
        .from('inventory_items')
        .select('id, name, stock')
        .ilike('name', namaObat)
        .maybeSingle();

      if (itemError || !invItem) {
        hasil.catatan.push(`Obat "${namaObat}" tidak ditemukan di master inventory.`);
        continue;
      }

      // 2. Ambil batch aktif dengan sisa_stok > 0, urut FEFO (tanggal_expired ASC)
      const { data: batches, error: batchError } = await client
        .from('inventory_batches')
        .select('id, sisa_stok, tanggal_expired')
        .eq('item_id', invItem.id)
        .gt('sisa_stok', 0)
        .order('tanggal_expired', { ascending: true });

      if (batchError) {
        console.error('[Inventory Dispense] Failed to read batches:', batchError.code);
      }

      let sisaKebutuhan = qtyDiminta;
      let totalDipotong = 0;
      const batchDetails: Array<{ batchId: string; potong: number }> = [];

      // 3. Potong dari batch terdekat expired
      for (const batch of batches || []) {
        if (sisaKebutuhan <= 0) break;
        const stokBatch = Number(batch.sisa_stok) || 0;
        if (stokBatch <= 0) continue;

        const potong = Math.min(stokBatch, sisaKebutuhan);
        const sisaBaru = stokBatch - potong;

        const { error: updBatchErr } = await client
          .from('inventory_batches')
          .update({ sisa_stok: sisaBaru })
          .eq('id', batch.id);

        if (!updBatchErr) {
          sisaKebutuhan -= potong;
          totalDipotong += potong;
          batchDetails.push({ batchId: batch.id, potong });
        }
      }

      // 4. Update ringkasan stok pada inventory_items
      const stokLama = Number(invItem.stock) || 0;
      const stokBaru = Math.max(0, stokLama - totalDipotong);
      await client
        .from('inventory_items')
        .update({ stock: stokBaru })
        .eq('id', invItem.id);

      // 5. Catat mutasi pada inventory_transactions bila ada pemotongan
      if (totalDipotong > 0) {
        await client.from('inventory_transactions').insert({
          item_id: invItem.id,
          transaction_type: 'OUT',
          quantity: totalDipotong,
          reference_id: kunjunganId,
          notes: `Dispensasi resep pasien: ${namaPasien} (${totalDipotong} ${it.satuan || 'unit'})`,
        });
      }

      const stokCukup = sisaKebutuhan === 0;
      hasil.itemDipotong.push({
        itemId: invItem.id,
        nama: invItem.name,
        jumlahDiminta: qtyDiminta,
        jumlahDipotong: totalDipotong,
        stokCukup,
        batchDetails,
      });

      if (!stokCukup) {
        hasil.catatan.push(
          `Stok "${invItem.name}" kurang: diminta ${qtyDiminta}, terpotong ${totalDipotong}.`
        );
      }
    } catch (err) {
      console.error(`[Inventory Dispense] Error dispensing ${namaObat}:`, err);
      hasil.catatan.push(`Gagal memotong stok untuk "${namaObat}".`);
    }
  }

  return hasil;
}

/**
 * Mengembalikan stok resep bila kunjungan berobat dihapus (void / cancel visit).
 */
export async function kembalikanStokKunjungan(
  client: SupabaseClient,
  kunjunganId: string
): Promise<{ dikembalikan: number }> {
  try {
    // Cari mutasi OUT yang pernah dicatat untuk kunjungan ini
    const { data: txs, error: txError } = await client
      .from('inventory_transactions')
      .select('id, item_id, quantity')
      .eq('reference_id', kunjunganId)
      .eq('transaction_type', 'OUT');

    if (txError || !txs || !txs.length) {
      return { dikembalikan: 0 };
    }

    let dikembalikan = 0;
    for (const tx of txs) {
      const qty = Number(tx.quantity) || 0;
      if (qty <= 0) continue;

      // Ambil batch terbaru atau batch pertama untuk memasukkan kembali stok
      const { data: latestBatch } = await client
        .from('inventory_batches')
        .select('id, sisa_stok')
        .eq('item_id', tx.item_id)
        .order('tanggal_expired', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestBatch) {
        await client
          .from('inventory_batches')
          .update({ sisa_stok: (Number(latestBatch.sisa_stok) || 0) + qty })
          .eq('id', latestBatch.id);
      }

      // Update master inventory_items
      const { data: item } = await client
        .from('inventory_items')
        .select('stock')
        .eq('id', tx.item_id)
        .maybeSingle();

      if (item) {
        await client
          .from('inventory_items')
          .update({ stock: (Number(item.stock) || 0) + qty })
          .eq('id', tx.item_id);
      }

      // Catat mutasi pembatalan
      await client.from('inventory_transactions').insert({
        item_id: tx.item_id,
        transaction_type: 'IN',
        quantity: qty,
        reference_id: kunjunganId,
        notes: `Pengembalian stok dari pembatalan kunjungan ID: ${kunjunganId}`,
      });

      dikembalikan += qty;
    }

    return { dikembalikan };
  } catch (err) {
    console.error('[Inventory Dispense] Error reverting stock:', err);
    return { dikembalikan: 0 };
  }
}
