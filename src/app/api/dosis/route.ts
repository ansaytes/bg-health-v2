import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// INITIAL_DOSIS is used ONLY as a fallback when the dosis_obat table is empty
// or unreachable. Do NOT add entries here that have been intentionally deleted
// from the database — deletions in Supabase must be reflected here too.
const INITIAL_DOSIS = [
  '3DD1',
  '2DD1',
  '1DD1',
  '4DD1',
  '2TAB/BAB',
  'K/P',
  'Q4H',
  '4QH',
  '1x1 Sesudah Makan',
  '3x1 Sesudah Makan',
];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('dosis_obat')
      .select('kode')
      .order('kode', { ascending: true });

    if (error) {
      return NextResponse.json({ success: true, data: INITIAL_DOSIS });
    }

    const dbCodes = (data || []).map((d: { kode: string }) => d.kode).filter(Boolean);
    // Use DB values as the source of truth. INITIAL_DOSIS is only a fallback
    // when the table is genuinely empty — this ensures deletions in Supabase
    // are reflected immediately without needing a code deployment.
    const result = dbCodes.length > 0 ? dbCodes : INITIAL_DOSIS;

    return NextResponse.json({ success: true, data: result });
  } catch (_err) {
    return NextResponse.json({ success: true, data: INITIAL_DOSIS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const kode = (body.kode || '').trim();
    const keterangan = (body.keterangan || '').trim() || null;

    if (!kode) {
      return NextResponse.json({ success: false, error: 'Kode / aturan pakai wajib diisi' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('dosis_obat')
      .insert({ kode, keterangan })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Dosis sudah ada di master', data: { kode } });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Dosis berhasil ditambahkan ke master', data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan dosis';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
