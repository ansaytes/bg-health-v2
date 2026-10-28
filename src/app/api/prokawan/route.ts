import { NextRequest, NextResponse } from 'next/server';

import { getCaller } from '@/lib/questionnaire-store';
import { muatPesertaProKawan } from '@/lib/prokawan-peserta';

export const dynamic = 'force-dynamic';

/**
 * GET /api/prokawan — payload DENGAN IDENTITAS.
 *
 * KHUSUS QSHE MEDIC. Dipakai halaman Administrator > ProKawan untuk:
 *   • melihat detail peserta (nama, NIK, site, departemen)
 *   • mengirim pengingat WhatsApp per karyawan
 *   • mencatat jadwal/aktual kontrol + evidence dokter
 *
 * KARENA MEMUAT IDENTITAS, endpoint ini TIDAK BOLEH dipakai dashboard.
 * Dashboard memakai /api/prokawan/dashboard yang hanya mengirim angka agregat
 * (INK/016 poin 4.6.4: rekapitulasi kepada manajemen TANPA identitas karyawan).
 *
 * Pembatasan tambahan:
 *   • role `manager` DIKELUARKAN — atasan hanya menerima status kelayakan kerja
 *     dan pembatasan kerja, tanpa skor/diagnosis (INK/016 poin 4.7.3 huruf e).
 *   • role `pic` hanya menerima peserta di site-nya sendiri.
 */
const ROLES_BERIDENTITAS = ['superuser', 'administrator', 'pic'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  }
  if (!ROLES_BERIDENTITAS.includes(String(caller.role))) {
    return NextResponse.json({
      error: 'Akses ditolak. Daftar peserta ProKawan hanya untuk QSHE Medic '
        + '(superuser/administrator/pic). Dashboard gunakan /api/prokawan/dashboard.',
    }, { status: 403 });
  }

  // Site PIC ditentukan dari profil (getCaller sudah menautkan lewat employee_nik_hash).
  const site = caller.role === 'pic' ? caller.site ?? null : null;

  try {
    const data = await muatPesertaProKawan({ site });
    return NextResponse.json({
      success: true,
      data,
      total: data.length,
      // Metadata untuk UI: memberi tahu bila daftar terbatas pada satu site.
      siteTerbatas: site,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memuat peserta ProKawan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
