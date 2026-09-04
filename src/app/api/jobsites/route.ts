import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { JOBSITES } from '@/lib/lagging-data';

/**
 * GET /api/jobsites
 * Query params: ?tahun=2026   (filter to sites that have data for the year)
 *               ?static=true   (return hardcoded list, skip Supabase)
 *
 * Response: { success: true, data: string[] }  ("All Site" always first)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const onlyStatic = searchParams.get('static') === 'true';

    // Fallback: Supabase not configured → return hardcoded list
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (onlyStatic || !supabaseUrl) {
      return NextResponse.json({ success: true, data: JOBSITES });
    }

    let q = supabase
      .from('health_indicators')
      .select('jobsite')
      .neq('jobsite', 'All Site');
    if (tahun) q = q.eq('tahun', parseInt(tahun));
    q = q.order('jobsite', { ascending: true });

    const { data, error } = await q;
    if (error) {
      // Fall back to static list on error
      return NextResponse.json({ success: true, data: JOBSITES });
    }
    const unique = ['All Site', ...new Set((data || []).map((r: { jobsite: string }) => r.jobsite))];
    return NextResponse.json({ success: true, data: unique.length > 1 ? unique : JOBSITES });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil daftar jobsite';
    return NextResponse.json({ success: false, error: msg, data: JOBSITES }, { status: 500 });
  }
}
