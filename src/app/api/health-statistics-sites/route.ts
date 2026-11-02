import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getServerCaller, READ_ROLES, STAFF_ROLES, requireServerRole } from '@/lib/server-auth';

/* ═══════════════════════════════════
   GET — Ambil data ASR per site
   ?tahun=2026&bulan=4
   ═══════════════════════════════════ */
export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, READ_ROLES);
    if (denied) return denied;
    if (caller!.role === 'pic' && !caller!.site) return NextResponse.json({ error: 'Site PIC belum ditetapkan' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');

    let q = supabase
      .from('health_statistics_sites')
      .select('*')
      .order('asr', { ascending: false });
    if (tahun) q = q.eq('tahun', parseInt(tahun));
    if (bulan) q = q.eq('bulan', parseInt(bulan));
    if (caller!.role === 'pic') q = q.eq('jobsite', caller!.site);

    const { data, error } = await q;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   POST — Bulk upsert data per site
   Body: { sites: [{ tahun, bulan, jobsite, man_power, asr }] }
   ═══════════════════════════════════ */
export async function POST(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, ['superuser', 'administrator']);
    if (denied) return denied;
    const body = await request.json();
    const { sites } = body;

    if (!Array.isArray(sites) || sites.length === 0) {
      return NextResponse.json({ success: false, error: 'sites array wajib diisi' }, { status: 400 });
    }

    const rows = sites.map((s: Record<string, unknown>) => ({
      tahun: parseInt(String(s.tahun)),
      bulan: parseInt(String(s.bulan)),
      jobsite: String(s.jobsite),
      man_power: parseInt(String(s.man_power ?? 0)),
      asr: parseFloat(String(s.asr ?? 0)),
    }));

    const { data, error } = await supabase
      .from('health_statistics_sites')
      .upsert(rows, { onConflict: 'tahun,bulan,jobsite' });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data, count: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   DELETE — Hapus semua site data untuk bulan tertentu
   ?tahun=2026&bulan=4
   ═══════════════════════════════════ */
export async function DELETE(request: NextRequest) {
  try {
    const denied = requireServerRole(await getServerCaller(request), ['superuser', 'administrator']);
    if (denied) return denied;
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');

    if (!tahun || !bulan) {
      return NextResponse.json({ success: false, error: 'tahun dan bulan wajib diisi' }, { status: 400 });
    }

    const { error } = await supabase
      .from('health_statistics_sites')
      .delete()
      .eq('tahun', parseInt(tahun))
      .eq('bulan', parseInt(bulan));

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}