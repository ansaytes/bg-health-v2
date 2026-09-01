import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const bulan = url.get('bulan');
  const site = url.get('site');

  if (!bulan) {
    return NextResponse.json({ success: false, error: 'bulan is required' }, { status: 400 });
  }

  const mNum = Number(bulan);
  if (mNum < 1 || mNum > 12) {
    return NextResponse.json({ success: false, error: 'bulan must be 1-12' }, { status: 400 });
  }

  let query = supabase
    .from('sick_employees')
    .select('nama, jobsite, jabatan, tanggal_mulai_a, tanggal_selesai_a, jumlah_hari_a, tanggal_mulai_b, tanggal_selesai_b, jumlah_hari_b, tanggal_mulai_c, tanggal_selesai_c, jumlah_hari_c, jumlah_spell');

  if (site && site !== 'All Site') {
    query = query.eq('jobsite', site);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const filtered = (data || []).filter((row: Record<string, unknown>) => {
    const startA = row.tanggal_mulai_a as string | null;
    const startB = row.tanggal_mulai_b as string | null;
    const startC = row.tanggal_mulai_c as string | null;

    const matchDate = (d: string | null) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() + 1 === mNum;
    };

    return matchDate(startA) || matchDate(startB) || matchDate(startC);
  });

  return NextResponse.json({ success: true, data: filtered });
}
