import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bulan = searchParams.get('bulan');
    const site = searchParams.get('site');

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    // Query absensi_sakit table (which replaced the dropped sick_employees table)
    let query = `${SUPABASE_URL}/rest/v1/absensi_sakit?select=nama,jobsite,jabatan,tgl_mulai_a,tgl_selesai_a,hari_a,spell,bulan&order=nama.asc`;
    if (bulan) query += `&bulan=eq.${bulan}`;
    if (site && site !== 'All Site') query += `&jobsite=eq.${encodeURIComponent(site)}`;

    const res = await fetch(query, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      if (err.includes('does not exist') || err.includes('42P01')) {
        return NextResponse.json({ success: true, data: [] });
      }
      return NextResponse.json({ success: false, error: err }, { status: res.status });
    }

    const raw = await res.json();
    // Map to the SickEmployee interface expected by DashboardView
    const data = raw.map((r: any) => ({
      nama: r.nama || '-',
      jobsite: r.jobsite || '-',
      jabatan: r.jabatan || '-',
      tanggal_mulai_a: r.tgl_mulai_a || '-',
      tanggal_selesai_a: r.tgl_selesai_a || '-',
      jumlah_hari_a: r.hari_a || 0,
      jumlah_spell: r.spell || 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
