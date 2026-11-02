import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, STAFF_ROLES, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

/**
 * GET /api/health-indicators/aggregate
 *
 * Auto-aggregates counts from kunjungan_berobat + sick_employees tables
 * for a given (tahun, bulan, jobsite) combination. Returns the same shape
 * as the aggregate-count fields in health_indicators, so the admin form
 * can pre-fill them via "Auto-Aggregate dari Halaman Lain" button.
 *
 * Query params:
 *   ?tahun=2026         (required)
 *   ?bulan=1            (required, 1-12)
 *   ?jobsite=Aceh       (optional; "All Site" or omitted = aggregate across all sites)
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       kunjungan_klinik: 12,
 *       tk_sakit: 5,
 *       absensi_sakit: 21,    // sum of hari_a + hari_b + hari_c
 *       spell: 5,             // sum of jumlah_spell
 *       penyakit_akibat_kerja: 1,  // count where is_pak=true
 *       kejadian_penyakit_tk: 0   // not derivable from sick_employees; always 0 here
 *     },
 *     sources: {
 *       kunjungan_berobat_rows: 12,
 *       sick_employees_rows: 5,
 *       period_used: { tahun: 2026, bulan: 1, jobsite: 'Aceh' }
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');
    let jobsite = searchParams.get('jobsite') || 'All Site';
    if (caller!.role === 'pic') {
      if (!caller!.site) return NextResponse.json({ success: false, error: 'Site PIC belum ditetapkan' }, { status: 403 });
      if (jobsite !== 'All Site' && jobsite.toLowerCase() !== caller!.site.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'PIC hanya dapat mengagregasi site sendiri' }, { status: 403 });
      }
      jobsite = caller!.site;
    }

    if (!tahun || !bulan) {
      return NextResponse.json(
        { success: false, error: 'tahun dan bulan wajib diisi' },
        { status: 400 }
      );
    }

    const tahunNum = Number(tahun);
    const bulanNum = Number(bulan);
    if (!Number.isInteger(tahunNum) || tahunNum < 2000 || tahunNum > 2100
      || !Number.isInteger(bulanNum) || bulanNum < 1 || bulanNum > 12) {
      return NextResponse.json({ success: false, error: 'tahun atau bulan tidak valid' }, { status: 400 });
    }
    const client = integrationAdminClient();

    // ── 1. Aggregate from kunjungan_berobat ────────────────────
    // NOTE: Kunjungan Berobat form is only filled for Head Office.
    // For other sites, the kunjungan_klinik field must be input manually
    // (the form auto-aggregate will leave it at 0).
    let kunjungan_klinik = 0;
    if (jobsite === 'Head Office' || jobsite === 'All Site') {
      let kunjQuery = client
        .from('kunjungan_berobat')
        .select('id, jobsite, tanggal', { count: 'exact', head: false });

      const startDate = `${tahunNum}-${String(bulanNum).padStart(2, '0')}-01`;
      const endDate = `${tahunNum}-${String(bulanNum).padStart(2, '0')}-31`;
      kunjQuery = kunjQuery.gte('tanggal', startDate).lte('tanggal', endDate);

      if (jobsite === 'Head Office') {
        kunjQuery = kunjQuery.eq('jobsite', 'Head Office');
      }
      // For 'All Site': don't filter by jobsite — count all kunjungan_berobat rows
      // (typically only Head Office rows will exist, so result is the same in practice)

      const { data: kunjRows, error: kunjErr } = await kunjQuery;
      if (kunjErr) {
        return NextResponse.json(
          { success: false, error: 'Gagal mengambil data kunjungan berobat.' },
          { status: 500 }
        );
      }
      kunjungan_klinik = kunjRows?.length || 0;
    }

    // ── 2. Aggregate from sick_employees ────────────────────────
    let sickQuery = client
      .from('sick_employees')
      .select('id, nik, jobsite, hari_a, hari_b, hari_c, jumlah_spell, is_pak')
      .eq('tahun', tahunNum)
      .eq('bulan', bulanNum);

    if (jobsite !== 'All Site') {
      sickQuery = sickQuery.eq('jobsite', jobsite);
    }

    const { data: sickRows, error: sickErr } = await sickQuery;
    if (sickErr) {
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil data karyawan sakit.' },
        { status: 500 }
      );
    }

    const sickList = sickRows || [];
    // tk_sakit = distinct employees (by NIK; fallback to id if NIK is null)
    const distinctNiks = new Set<string>();
    sickList.forEach(s => distinctNiks.add(s.nik || `id:${s.id}`));
    const tk_sakit = distinctNiks.size;

    // absensi_sakit = sum of (hari_a + hari_b + hari_c)
    const absensi_sakit = sickList.reduce(
      (sum, s) => sum + (s.hari_a || 0) + (s.hari_b || 0) + (s.hari_c || 0),
      0
    );

    // spell = sum of jumlah_spell
    const spell = sickList.reduce((sum, s) => sum + (s.jumlah_spell || 0), 0);

    // penyakit_akibat_kerja = count of rows where is_pak=true
    const penyakit_akibat_kerja = sickList.filter(s => s.is_pak === true).length;

    // kejadian_penyakit_tk = NOT derivable from sick_employees (separate concept);
    // admin must input manually
    const kejadian_penyakit_tk = 0;

    return NextResponse.json({
      success: true,
      data: {
        kunjungan_klinik,
        tk_sakit,
        absensi_sakit,
        spell,
        penyakit_akibat_kerja,
        kejadian_penyakit_tk,
      },
      sources: {
        kunjungan_berobat_rows: kunjungan_klinik,
        sick_employees_rows: sickList.length,
        period_used: { tahun: tahunNum, bulan: bulanNum, jobsite },
      },
    });
  } catch (err) {
    console.error('[Health indicators aggregate] Request failed:', err instanceof Error ? err.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal mengagregasi data.' }, { status: 500 });
  }
}
