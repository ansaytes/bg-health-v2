import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { decrypt, hashField } from '@/lib/encryption';
import { evaluateFromKontrol } from '@/lib/prokawan-evaluasi-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/prokawan/evaluasi — hitung ulang zona dari HASIL KONTROL.
 *
 * DASAR DOKUMEN
 *   INK/016 poin 4.4.5 — hasil pemeriksaan Faskes Rekanan menjadi bahan
 *   evaluasi dan pembaruan Zona Risiko PTM.
 *   INK/016 poin 4.6.1 — QSHE Medic memperbarui zona sesuai frekuensi poin 4.3.
 *
 * Body:
 *   {
 *     id?: string,            // id kunjungan_kontrol (bila memperbarui baris lama)
 *     nik: string,
 *     nama?, site?, department?, jabatan?, no_wa?,
 *     jadwal_tanggal?: string,
 *     aktual_tanggal: string, // tanggal periksa — wajib agar baseline tercatat
 *     nilai: { tdS?: 148, gdp?: 112, hba1c?: 7.4, ldl?: 150, ... },
 *     evidence_url?, catatan?,
 *     terapkanZona?: boolean  // true = tulis zonasi/trigger/pengendalian baru
 *                             //        ke record MCU terakhir (memperbarui
 *                             //        zona peserta). Default false (hanya simpan)
 *   }
 *
 * Alur:
 *   1. Ambil baseline = nilai MCU terakhir peserta (atau kontrol sebelumnya).
 *   2. Jalankan ENGINE YANG SAMA dengan MCU (`assessZonasi`) atas nilai kontrol.
 *   3. Simpan ke kunjungan_kontrol: nilai, baseline, zona sebelum/sesudah,
 *      arah, dan keluaran evaluasi (JSON) — sehingga riwayat permanen.
 *   4. Bila terapkanZona, tulis zona baru ke mcu_records agar peserta,
 *      jadwal, dan dashboard ikut memperbarui (INI yang membuat evaluasi
 *      "menghitung otomatis", bukan sekadar mencatat).
 *
 * Akses: QSHE Medic (superuser/administrator) — memuat identitas.
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  if (!['superuser', 'administrator'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Evaluasi zona hanya untuk QSHE Medic (superuser/administrator)' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nik = String(body.nik ?? '').trim();
  if (!nik) return NextResponse.json({ error: 'NIK peserta wajib diisi' }, { status: 400 });

  const aktual = String(body.aktual_tanggal ?? '').slice(0, 10);
  if (!aktual) {
    return NextResponse.json({
      error: 'Tanggal aktual periksa wajib diisi — baseline dan tren dihitung dari tanggal ini',
    }, { status: 400 });
  }

  const nilai = body.nilai && typeof body.nilai === 'object' ? body.nilai : {};
  if (!Object.keys(nilai).length) {
    return NextResponse.json({
      error: 'Isi minimal satu nilai parameter hasil kontrol agar zona dapat dihitung ulang',
    }, { status: 400 });
  }

  const client = adminClient();
  const nikHash = hashField(nik);
  if (!nikHash) return NextResponse.json({ error: 'NIK tidak valid' }, { status: 400 });

  try {
    const hasil = await evaluateFromKontrol({
      client,
      nikHash,
      nik,
      aktualTanggal: aktual,
      nilai,
      kunjunganId: body.id ? String(body.id) : null,
    });

    const terapkan = body.terapkanZona === true;
    let zonaDiterapkan = false;
    let historiId: string | null = null;

    if (terapkan && hasil.evaluasi.zonaBaru !== 'Belum Lengkap') {
      // ── 1. BACA nilai lama DULU ────────────────────────────────────────
      // Tanpa ini, setelah UPDATE nilai lama hilang tanpa jejak.
      const { data: lama } = await client
        .from('mcu_records')
        .select('zonasi,trigger_zona')
        .eq('id', hasil.mcuRecordId)
        .maybeSingle();

      const triggerBaru = hasil.evaluasi.triggers.join(' | ');

      // ── 2. Tulis zona baru ke record MCU terakhir ──────────────────────
      const { error: updateError } = await client
        .from('mcu_records')
        .update({
          zonasi: hasil.evaluasi.zonaBaru,
          trigger_zona: triggerBaru,
          pengendalian: hasil.evaluasi.pengendalian,
          frekuensi_evaluasi: hasil.evaluasi.frekuensiEvaluasi,
          catatan_sop: hasil.evaluasi.catatanSOP.join(' | '),
        })
        .eq('id', hasil.mcuRecordId);
      if (updateError) throw new Error(`Gagal memperbarui zona: ${updateError.message}`);
      zonaDiterapkan = true;

      // ── 3. CATAT HISTORI (append-only) ─────────────────────────────────
      // Tabel zona_histori menyimpan nilai sebelum & sesudah beserta nilai
      // parameter yang mendasari, sehingga perubahan zona dapat diaudit dan
      // dibuktikan berasal dari kontrol — bukan ditimpa tanpa bekas.
      const { data: histori, error: historiError } = await client
        .from('zona_histori')
        .insert({
          nik_hash: nikHash,
          mcu_record_id: hasil.mcuRecordId,
          kunjungan_kontrol_id: hasil.kunjunganId,
          sumber: 'kontrol',
          zona_lama: lama?.zonasi ?? null,
          zona_baru: hasil.evaluasi.zonaBaru,
          trigger_lama: lama?.trigger_zona ?? null,
          trigger_baru: triggerBaru,
          tanggal_acuan: aktual,
          nilai,
          evaluasi: hasil.evaluasi,
          catatan: body.catatan ?? null,
          diubah_oleh: caller.userId,
        })
        .select('id')
        .single();

      if (historiError) {
        // Zona SUDAH berubah tetapi histori gagal → jangan diamkan. Kembalikan
        // peringatan eksplisit agar QSHE Medic tahu audit trail-nya bolong.
        return NextResponse.json({
          success: true,
          kunjunganId: hasil.kunjunganId,
          evaluasi: hasil.evaluasi,
          baseline: hasil.baselineRingkas,
          zonaDiterapkan: true,
          historiTercatat: false,
          peringatan: `Zona sudah diperbarui, TETAPI histori gagal dicatat: ${historiError.message}. `
            + 'Jalankan migration 20261028_prokawan_nilai_kontrol.sql.',
          pesan: `Zona diperbarui menjadi ${hasil.evaluasi.zonaBaru} (histori GAGAL dicatat)`,
        }, { status: 207 });
      }
      historiId = histori?.id ?? null;
    }

    return NextResponse.json({
      success: true,
      kunjunganId: hasil.kunjunganId,
      evaluasi: hasil.evaluasi,
      baseline: hasil.baselineRingkas,
      zonaDiterapkan,
      historiTercatat: zonaDiterapkan ? Boolean(historiId) : null,
      historiId,
      pesan: zonaDiterapkan
        ? `Zona diperbarui menjadi ${hasil.evaluasi.zonaBaru}`
        : 'Hasil kontrol tersimpan. Zona BELUM diperbarui di mcu_records.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengevaluasi hasil kontrol';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/prokawan/evaluasi?nik=<NIK> — RIWAYAT baseline & tren.
 *
 * Menampilkan seluruh kunjungan kontrol peserta beserta nilai, baseline,
 * zona sebelum/sesudah, dan arah — inilah bukti program berhasil atau tidak
 * (membaik / tetap / memburuk per parameter dari waktu ke waktu).
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const nik = req.nextUrl.searchParams.get('nik')?.trim();
  if (!nik) return NextResponse.json({ error: 'nik wajib diisi' }, { status: 400 });

  const nikHash = hashField(nik);
  const client = adminClient();
  const { data, error } = await client
    .from('followups_prokawan')
    .select('id,jadwal_tanggal,aktual_tanggal,evidence_url,catatan,hasil,arah,zona_sebelum,zona_sesudah,nilai,baseline,evaluasi,dievaluasi_pada')
    .eq('nik_hash', nikHash)
    .order('jadwal_tanggal', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deskripsi peserta untuk judul halaman riwayat.
  const { data: emp } = await client
    .from('employees')
    .select('nama,site_name,department')
    .eq('nik_hash', nikHash)
    .maybeSingle();

  // Riwayat perubahan zona (append-only). Menunjukkan SETIAP peralihan zona
  // beserta sumbernya — kontrol, MCU, atau manual — sehingga penurunan zona
  // saat mcu_records ditimpa tetap terlacak.
  const { data: historiZona, error: historiError } = await client
    .from('zona_histori')
    .select('id,created_at,sumber,zona_lama,zona_baru,tanggal_acuan,catatan,diubah_oleh,evaluasi')
    .eq('nik_hash', nikHash)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    success: true,
    peserta: {
      nik,
      nama: emp?.nama ? (decrypt(emp.nama) ?? emp.nama) : null,
      site: emp?.site_name ?? null,
      department: emp?.department ?? null,
    },
    riwayat: data ?? [],
    total: data?.length ?? 0,
    historiZona: historiZona ?? [],
    historiZonaTersedia: !historiError,
    ...(historiError ? {
      catatanHistori: 'Tabel zona_histori belum ada — jalankan migration 20261028_prokawan_nilai_kontrol.sql',
    } : {}),
  });
}
