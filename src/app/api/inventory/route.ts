import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase.from('inventory_items').select('*').order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data inventory';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
