import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase.from('v_inventory_summary').select('*').order('name', { ascending: true });
    if (error) throw error;
    
    // Convert property names to camelCase or frontend expected format
    const formattedData = data?.map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      unit: d.unit,
      avg_monthly_usage: d.avg_monthly_usage,
      stock: d.total_stock,
      tanggal_masuk: d.closest_tanggal_masuk,
      tanggal_expired: d.closest_expired_date
    })) || [];
    
    return NextResponse.json({ success: true, data: formattedData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data inventory';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, unit, avg_monthly_usage } = body;
    
    if (!name || !category || !unit) {
      return NextResponse.json({ success: false, error: 'Nama, Kategori, dan Satuan wajib diisi' }, { status: 400 });
    }

    const row = {
      name,
      category,
      unit,
      avg_monthly_usage: parseInt(avg_monthly_usage) || 0,
      stock: 0 // Default to 0, actual stock is in batches
    };

    const { data, error } = await supabase.from('inventory_items').insert(row).select().single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data inventory';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
