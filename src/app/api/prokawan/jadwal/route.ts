import { NextRequest, NextResponse } from 'next/server';

import { getCaller } from '@/lib/questionnaire-store';
import { muatPesertaProKawan } from '@/lib/prokawan-peserta';
import { jalankanPenjadwalan, type ModePenjadwalan } from '@/lib/prokawan-jadwal';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/prokawan/jadwal — USULAN jadwal kontrol (tidak menulis apa pun).
 *
 * Menghitung tanggal kontrol tiap peserta dari:
 *     tanggal pemeriksaan terakhir + frekuensi kolom Pengendalian Bab 7
 * sesuai INK/016 poin 4.1.4 (QSHE Medic menetapkan & memberitahukan jadwal
 * kontrol pertama). Endpoint ini hanya MENGUSULKAN; penulisan ke
 * `kunjungan_kontrol` terjadi lewat POST setelah di konfirmasi.
 *
 * Akses: QSHE Medic (superuser/administrator). PIC & manager tidak — mereka
 * bukan penetap jadwal dan tidak boleh menerima daftar identitas.
 */
const ROLES_BERIDENTITAS = ['superuser', 'administrator'];

function sahkan(caller: Awaited<ReturnType<typeof getCaller>>) {
  if (!caller) return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  if (!ROLES_BERIDENTITAS.includes(String(caller.role))) {
    return NextResponse.json({
      error: 'Penjadwalan kontrol hanya untuk QSHE Medic (superuser/administrator).',
    }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  const tolak = sahkan(caller);
  if (tolak) return tolak;

  try {
    const peserta = await muatPesertaProKawan();
    const hasil = await jalankanPenjadwalan('usulan', peserta);

    // Ringkasan sumber tanggal — supaya QSHE Medic tahu berapa yang bisa
    // dijadwalkan otomatis dan berapa yang perlu input manual.
    const sumber = {
      dariFrekuensi: hasil.diusulkan,
      pemantauanParamedis: hasil.daftar.filter((u) => /Pemantauan oleh Paramedic/i.test(u.alasanTanpaJadwal ?? '')).length,
      evaluasiAlatBantu: hasil.daftar.filter((u) => /alat bantu/i.test(u.alasanTanpaJadwal ?? '')).length,
      tanpaTanggalAcuan: hasil.daftar.filter((u) => /belum tersedia/i.test(u.alasanTanpaJadwal ?? '')).length,
      tanpaFrekuensi: hasil.daftar.filter((u) => /tidak menetapkan frekuensi/i.test(u.alasanTanpaJadwal ?? '')).length,
    };

    return NextResponse.json({
      success: true,
      mode: 'usulan' as ModePenjadwalan,
      ...hasil,
      sumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghitung usulan jadwal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/prokawan/jadwal?mode=konfirmasi — TULIS jadwal ke kunjungan_kontrol.
 *
 * Hanya menulis baris yang belum ada (berdasarkan nik_hash + tanggal), sehingga
 * aman dijalankan berulang. Tidak menyentuh jadwal yang sudah diubah manual
 * QSHE Medic.
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  const tolak = sahkan(caller);
  if (tolak) return tolak;

  const mode = (req.nextUrl.searchParams.get('mode') || 'usulan') as ModePenjadwalan;
  if (!['usulan', 'konfirmasi'].includes(mode)) {
    return NextResponse.json({ error: 'mode harus "usulan" atau "konfirmasi"' }, { status: 400 });
  }

  try {
    const peserta = await muatPesertaProKawan();
    const hasil = await jalankanPenjadwalan(mode, peserta);
    return NextResponse.json({ success: true, mode, ...hasil });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menulis jadwal kontrol';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
