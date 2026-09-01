import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobsite = searchParams.get('jobsite');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let q = supabase.from('sick_employees').select('*').order('tanggal_mulai_a', { ascending: false });
    if (jobsite && jobsite !== 'All Site') q = q.eq('jobsite', jobsite);
    if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      const prevM = m - 1 || 12;
      const prevY = m > 1 ? y : y - 1;
      const startDate = `${prevY}-${String(prevM).padStart(2, '0')}-21`;
      const endDate = `${y}-${String(m).padStart(2, '0')}-20`;
      q = q.gte('tanggal_mulai_a', startDate).lte('tanggal_mulai_a', endDate);
    }
    const { data, error } = await q.limit(500);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
