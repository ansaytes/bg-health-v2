import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { JOBSITES } from '@/lib/lagging-data';

/**
 * GET /api/jobsites
 * Query params: ?tahun=2026   (filter to sites that have data for the year)
 *
 * Returns distinct jobsites that have rows in health_indicators for the given
 * tahun (or all sites if no tahun filter). "All Site" is always prepended.
 *
 * Response: { success: true, data: string[] }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');

    let q = supabase
      .from('health_indicators')
      .select('jobsite')
      .neq('jobsite', 'All Site');
    if (tahun) q = q.eq('tahun', parseInt(tahun));
    q = q.order('jobsite', { ascending: true });

    const { data, error } = await q;
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    const unique = ['All Site', ...new Set((data || []).map((r: { jobsite: string }) => r.jobsite))];
    return NextResponse.json({
      success: true,
      data: unique.length > 1 ? unique : JOBSITES,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil daftar jobsite';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
