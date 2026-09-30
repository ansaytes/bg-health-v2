import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
  '2x1 Sesudah Makan',
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
    const combined = Array.from(new Set([...INITIAL_DOSIS, ...dbCodes]));

    return NextResponse.json({ success: true, data: combined });
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
