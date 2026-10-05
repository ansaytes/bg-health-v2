import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const MKEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const tahun = url.get('tahun') || '2026';

  const { data, error } = await supabase
    .from('health_indicators')
    .select('jobsite, asr, bulan')
    .eq('tahun', Number(tahun))
    .neq('jobsite', 'All Site');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const map = new Map<string, Record<string, number | string>>();

  for (const r of (data || [])) {
    const site = String(r.jobsite);
    if (!map.has(site)) {
      const entry: Record<string, number | string> = { name: site };
      MKEYS.forEach(m => { entry[m] = 0; });
      map.set(site, entry);
    }
    const entry = map.get(site)!;
    const mKey = MKEYS[(r.bulan as number) - 1];
    if (mKey) entry[mKey] = Number(r.asr) || 0;
  }

  const result = Array.from(map.values());
  return NextResponse.json({ success: true, data: result });
}
