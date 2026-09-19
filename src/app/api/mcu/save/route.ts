import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { formData } = body;

    if (!formData || !formData.nikKaryawan) {
      return NextResponse.json({ success: false, error: 'NIK Karyawan is required' }, { status: 400 });
    }

    // Convert formData camelCase keys to snake_case for Supabase
    const dbData: Record<string, any> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== '' && value !== undefined && value !== null) {
        const snakeKey = key.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
        dbData[snakeKey] = value;
      }
    }

    // Upsert logic: if there is already a record for this NIK and Date, update it, otherwise insert
    // Since we don't have a composite unique key by default, we'll just check if one exists for the same tgl_mcu
    const { data: existing, error: searchError } = await supabase
      .from('mcu_records')
      .select('id')
      .eq('nik_karyawan', dbData.nik_karyawan)
      .eq('tgl_mcu', dbData.tgl_mcu)
      .single();

    if (existing && existing.id) {
      // Update
      const { error } = await supabase
        .from('mcu_records')
        .update(dbData)
        .eq('id', existing.id);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'updated' });
    } else {
      // Insert
      const { error } = await supabase
        .from('mcu_records')
        .insert(dbData);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'inserted' });
    }

  } catch (err: any) {
    console.error('Error saving MCU to Supabase:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
