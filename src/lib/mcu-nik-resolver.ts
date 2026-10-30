// ============================================================
// Resolver NIK → record mcu_records
// ============================================================
//
// MASALAH DATA YANG DITEMUKAN (bukan dibuat oleh perubahan ini):
//
//   `mcu_records.nik_karyawan_hash` TIDAK PERNAH sama dengan
//   `hashField(nik_asli)`. Hash yang tersimpan dihitung dari
//   CIPHERTEXT `nik_karyawan`, bukan dari NIK yang sudah didekripsi.
//
// Bukti dari data (5 record diperiksa):
//   raw  = dcc2f81bf7…        (ciphertext lapis 1)
//   l1   = cb988175a3…        (dekripsi → ciphertext lapis 2)
//   l2   = 7373060410130001   (dekripsi → NIK asli)
//   hash(l1) == hash di DB    ✓
//   hash(l2) != hash di DB    ✗
//
// Akibatnya semua pencarian `.eq('nik_karyawan_hash', hashField(nik))`
// — termasuk di Review MCU dan /api/mcu/records — tidak menemukan apa pun
// padahal recordnya ada.
//
// STRATEGI RESOLVER
//   1. Coba hashField(nik) — jalur normal, bekerja untuk record baru.
//   2. Coba national_id_hash — sebagian record menyimpan NIK KTP di sana.
//   3. Bila gagal, cari lewat tabel `employees` (nik_hash di sana konsisten
//      dengan NIK asli), ambil NIK KTP-nya, lalu cari lewat national_id_hash.
//   4. Bila masih gagal, pindai terbatas + dekripsi (fallback terakhir).
//
// Tidak ada data yang diubah. Resolver hanya MEMBACA.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { decrypt, hashField, isEncryptedValue } from '@/lib/encryption';

/** Dekripsi berlapis hingga teks biasa (maksimal 4 putaran). */
export function dekripsiBerlapis(value: unknown): string {
  let text = String(value ?? '').trim();
  if (!text) return '';
  for (let i = 0; i < 4; i += 1) {
    const hex = /^[0-9a-fA-F]+$/.test(text) && text.length >= 58 && text.length % 2 === 0;
    if (!hex && !isEncryptedValue(text)) break;
    const hasil = decrypt(text);
    if (hasil == null || hasil === text) break;
    text = hasil.trim();
  }
  return text;
}

export interface HasilResolusi {
  /** Baris mcu_records ditemukan (null bila tidak ada). */
  record: Record<string, unknown> | null;
  /** Cara record ditemukan — untuk diagnosis bila gagal. */
  strategi: 'hash-nik' | 'national-id-hash' | 'via-employees' | 'pindai' | 'tidak-ditemukan';
  /** NIK asli hasil dekripsi (bila ditemukan). */
  nikTerbaca: string | null;
  /** Keterangan tambahan bila gagal. */
  catatan?: string;
}

/**
 * Mencari record MCU terbaru untuk satu NIK.
 *
 * @param select kolom yang diambil; gunakan `selectFieldsForTable()`.
 */
export async function cariMcuByNik(
  client: SupabaseClient,
  nik: string,
  select: string,
): Promise<HasilResolusi> {
  const bersih = String(nik ?? '').trim();
  if (!bersih) return { record: null, strategi: 'tidak-ditemukan', nikTerbaca: null };

  const cari = async (kolom: 'nik_karyawan_hash' | 'national_id_hash', nilai: string) => {
    const { data } = await client
      .from('mcu_records')
      .select(select)
      .eq(kolom, nilai)
      .order('tgl_mcu', { ascending: false, nullsFirst: false })
      .limit(1);
    return (data?.[0] as unknown as Record<string, unknown> | undefined) ?? null;
  };

  // ── 1. Jalur normal ───────────────────────────────────────────────
  const h = hashField(bersih);
  if (h) {
    const r = await cari('nik_karyawan_hash', h);
    if (r) return { record: r, strategi: 'hash-nik', nikTerbaca: bersih };
  }

  // ── 2. national_id_hash ───────────────────────────────────────────
  if (h) {
    const r = await cari('national_id_hash', h);
    if (r) return { record: r, strategi: 'national-id-hash', nikTerbaca: bersih };
  }

  // ── 3. Lewat employees → NIK KTP ──────────────────────────────────
  if (h) {
    const { data: emp } = await client
      .from('employees')
      .select('national_id,national_id_hash,nik_hash')
      .eq('nik_hash', h)
      .maybeSingle();

    if (emp?.national_id) {
      const nikKtp = dekripsiBerlapis(emp.national_id);
      const hKtp = nikKtp ? hashField(nikKtp) : null;
      if (hKtp) {
        const r = await cari('national_id_hash', hKtp);
        if (r) return { record: r, strategi: 'via-employees', nikTerbaca: bersih };
      }
    }
  }

  // ── 4. Pindai terbatas + dekripsi ─────────────────────────────────
  // Hanya untuk NIK yang benar-benar ada di data lama. Dibatasi 2.000 baris
  // terbaru agar tidak membebani database.
  // Pemindaian memakai `select('*')` karena daftar kolom dinamis tidak dapat
  // diketik Supabase. Dibatasi 2.000 baris terbaru agar tetap ringan.
  const { data: kandidat } = await client
    .from('mcu_records')
    .select('*')
    .order('tgl_mcu', { ascending: false, nullsFirst: false })
    .limit(2000);

  for (const row of (kandidat ?? []) as Record<string, unknown>[]) {
    const nikCandidates = [
      dekripsiBerlapis(row.nik_karyawan),
      dekripsiBerlapis(row.national_id),
    ];
    if (!nikCandidates.includes(bersih)) continue;
    // Buang kolom bantu sebelum dikembalikan.
    const { nik_karyawan: _a, national_id: _b, ...bersih2 } = row;
    void _a; void _b;
    return {
      record: bersih2 as Record<string, unknown>,
      strategi: 'pindai',
      nikTerbaca: bersih,
      catatan: 'Ditemukan lewat pemindaian. Hash NIK pada record ini tidak konsisten.',
    };
  }

  return {
    record: null,
    strategi: 'tidak-ditemukan',
    nikTerbaca: null,
    catatan: 'Record MCU tidak ditemukan untuk NIK ini.',
  };
}
