import { NextRequest, NextResponse } from 'next/server';
import { createInventoryClient, getInventoryCallerRole } from '@/lib/inventory-auth';

export async function GET(request: NextRequest) {
  try {
    const role = await getInventoryCallerRole(request);
    if (!role || !['administrator', 'superuser', 'pic'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    const supabase = createInventoryClient();
    const { data, error } = await supabase.from('v_inventory_summary').select('*').order('name', { ascending: true });
    if (error) return NextResponse.json({ success: false, error: 'Gagal mengambil data inventory.' }, { status: 500 });
    
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
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal mengambil data inventory.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const role = await getInventoryCallerRole(request);
    if (!role || !['administrator', 'superuser'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Hanya administrator dan superuser yang dapat menambah item' }, { status: 403 });
    }
    const supabase = createInventoryClient();

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
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menyimpan data inventory.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const role = await getInventoryCallerRole(request);
    if (!role || !['administrator', 'superuser'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Hanya administrator dan superuser yang dapat mengubah item' }, { status: 403 });
    }
    const supabase = createInventoryClient();

    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = body.category;
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    const avgMonthlyUsage = Number(body.avg_monthly_usage);

    if (!id || !name || !unit || !['Obat', 'Bahan Medis', 'Lainnya'].includes(category)
      || !Number.isInteger(avgMonthlyUsage) || avgMonthlyUsage < 0) {
      return NextResponse.json({ success: false, error: 'Data item tidak valid' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .update({ name, category, unit, avg_monthly_usage: avgMonthlyUsage })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal mengubah data inventory.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const role = await getInventoryCallerRole(request);
    if (role !== 'superuser') {
      return NextResponse.json({ success: false, error: 'Hanya superuser yang dapat menghapus item' }, { status: 403 });
    }
    const supabase = createInventoryClient();

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID item wajib diisi' }, { status: 400 });

    const { data, error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: 'Item tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menghapus data inventory.' }, { status: 500 });
  }
}
