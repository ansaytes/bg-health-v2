import { NextRequest, NextResponse } from 'next/server';

import { getCaller } from '@/lib/questionnaire-store';
import { muatPesertaProKawan } from '@/lib/prokawan-peserta';
import { ringkasAgregatProKawan } from '@/lib/prokawan';

export const dynamic = 'force-dynamic';

/**
 * GET /api/prokawan/dashboard — payload AGREGAT, TANPA IDENTITAS.
 *
 * DASAR DOKUMEN
 *  • INK/016 poin 4.6.4 — "QSHE Medic menyampaikan rekapitulasi pelaksanaan
 *    ProKawan secara AGREGAT, TANPA IDENTITAS KARYAWAN, kepada QSHE Manager
 *    secara berkala sebagai bagian dari pelaporan zonasi."
 *  • STD/006 poin 7.2.1 — rekapitulasi jumlah karyawan per zona, bentuk agregat.
 *  • INK/016 poin 4.7.3 huruf e — atasan hanya menerima status kelayakan kerja
 *    dan pembatasan kerja, tanpa skor maupun diagnosis.
 *  • UU 27/2022 — data kesehatan adalah data pribadi yang spesifik.
 *
 * YANG DIKIRIM KE BROWSER
 *   Hanya angka: jumlah per zona, jalur, status kepatuhan, site, frekuensi,
 *   parameter pemicu, kelayakan kerja, plus beberapa persentase ringkas.
 *
 * YANG TIDAK PERNAH DIKIRIM
 *   nama · NIK · nikHash · nomor WhatsApp · departemen · pengendalian per orang
 *   · diagnosis · skor kuesioner.
 *
 * Filtrasi dilakukan di SERVER. Browser tidak pernah menerima baris per-orang,
 * jadi membuka DevTools pun tidak membocorkan identitas.
 */
const ROLES_AGREGAT = ['superuser', 'administrator', 'manager', 'pic'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  }
  if (!ROLES_AGREGAT.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const site = caller.role === 'pic' ? caller.site ?? null : null;

  try {
    const peserta = await muatPesertaProKawan({ site });
    // ringkasAgregatProKawan hanya mengeluarkan hitungan — tidak ada
    // nama/NIK/telepon yang lolos dari fungsi ini.
    const ringkasan = ringkasAgregatProKawan(peserta);

    return NextResponse.json({
      success: true,
      ringkasan,
      // Metadata periode, bukan data pribadi.
      dihitungPada: new Date().toISOString(),
      totalPeserta: peserta.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat ringkasan ProKawan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
