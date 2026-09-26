import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { MCU_FIELDS } from '@/lib/mcu-fields';
import { encryptMCURecord } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { formData } = body;
    const calculatedFormData = applyMCUCalculations(formData || {});

    const nikKaryawan = calculatedFormData?.nikKaryawan || calculatedFormData?.nationalId;
    if (!formData || !nikKaryawan) {
      return NextResponse.json({ success: false, error: 'NIK Karyawan is required' }, { status: 400 });
    }

    // Convert formData camelCase keys to snake_case for Supabase, strictly using MCU_FIELDS
    const dbData: Record<string, any> = {};
    for (const field of MCU_FIELDS) {
      const value = calculatedFormData[field.id];
      if (value !== '' && value !== undefined && value !== null) {
        const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
        dbData[snakeKey] = value;
      }
    }
    // Allow NIK KTP to be used as the fallback key when NIK Karyawan is unavailable.
    dbData.nik_karyawan = dbData.nik_karyawan || nikKaryawan;
    const encryptedData = encryptMCURecord(dbData);
    const recordId = calculatedFormData?.id || formData?.id;

    // Upsert logic: if an ID is provided, strictly update that record
    if (recordId) {
      const { error } = await supabase
        .from('mcu_records')
        .update(encryptedData)
        .eq('id', recordId);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'updated' });
    }

    // Otherwise, check if one exists for the same tgl_mcu
    const { data: existing, error: searchError } = await supabase
      .from('mcu_records')
      .select('id')
      .eq('nik_karyawan_hash', encryptedData.nik_karyawan_hash)
      .eq('tgl_mcu', encryptedData.tgl_mcu)
      .single();

    if (existing && existing.id) {
      // Update
      const { error } = await supabase
        .from('mcu_records')
        .update(encryptedData)
        .eq('id', existing.id);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'updated' });
    } else {
      // Insert
      const { error } = await supabase
        .from('mcu_records')
        .insert(encryptedData);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'inserted' });
    }

  } catch (err: any) {
    console.error('Error saving MCU to Supabase:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
