import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const tahun = url.get('tahun') || '2026';

  const { data, error } = await supabase
    .from('health_indicators')
    .select('jobsite')
    .eq('tahun', Number(tahun))
    .order('jobsite');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const sites = [...new Set((data || []).map((r: { jobsite: string }) => r.jobsite))];
  const allIdx = sites.indexOf('All Site');
  if (allIdx > 0) {
    sites.splice(allIdx, 1);
    sites.unshift('All Site');
  }

  return NextResponse.json({ success: true, data: sites });
}
