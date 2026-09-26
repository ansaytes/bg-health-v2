import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, jumlah_masuk, tanggal_masuk, tanggal_expired } = body;
    
    if (!item_id || !jumlah_masuk || !tanggal_masuk || !tanggal_expired) {
      return NextResponse.json({ success: false, error: 'Data batch tidak lengkap' }, { status: 400 });
    }

    const row = {
      item_id,
      sisa_stok: parseInt(jumlah_masuk),
      tanggal_masuk,
      tanggal_expired
    };

    const { data, error } = await supabase.from('inventory_batches').insert(row).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan batch';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('item_id');
    
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'item_id dibutuhkan' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('item_id', itemId)
      .gt('sisa_stok', 0)
      .order('tanggal_expired', { ascending: true });
      
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data batch';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
