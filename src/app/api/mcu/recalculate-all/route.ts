import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptMCURecord, encryptMCURecord } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { MCU_FIELDS } from '@/lib/mcu-fields';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const client = createClient(url, serviceKey);

const PREVIEW_ROLE = process.env.NEXT_PUBLIC_PREVIEW_ROLE as string | undefined;

async function getSessionRole(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }
  if (!accessToken) return null;
  if (accessToken === 'preview-access-token' && PREVIEW_ROLE) {
    return { role: PREVIEW_ROLE };
  }
  const { data: { user }, error } = await client.auth.getUser(accessToken);
  if (error || !user) return null;
  const { data: profile } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return { role: (profile?.role as string) || 'viewer' };
}

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured; bulk recalculation is disabled.' }, { status: 500 });
  }

  const authInfo = await getSessionRole(req);
  if (!authInfo || (authInfo.role !== 'superuser' && authInfo.role !== 'administrator')) {
    return NextResponse.json({ success: false, error: 'Akses ditolak. Hanya superuser/administrator yang dapat menjalankan rekalkulasi.' }, { status: 403 });
  }

  try {
    let allRecords: any[] = [];
    let from = 0;
    const pageSize = 1000;
    
    // Fetch all records
    while (true) {
      const { data, error } = await client.from('mcu_records').select('*').range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRecords = allRecords.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const snakeToCamelMap: Record<string, string> = {};
    for (const field of MCU_FIELDS) {
      const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
      snakeToCamelMap[snakeKey] = field.id;
    }

    let updatedCount = 0;
    const errors: any[] = [];

    // Process sequentially to avoid DB timeout or memory issues
    for (const record of allRecords) {
      try {
        const decrypted = decryptMCURecord(record);
        
        const formData: Record<string, any> = {};
        for (const [key, value] of Object.entries(decrypted)) {
          if (['created_at', 'updated_at'].includes(key) || value == null) continue;
          if (key === 'id') {
            formData.id = String(value);
            continue;
          }
          const camelKey = snakeToCamelMap[key] || key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
          formData[camelKey] = String(value);
        }

        const calculatedFormData = applyMCUCalculations(formData);

        const dbData: Record<string, any> = {};
        for (const field of MCU_FIELDS) {
          const value = calculatedFormData[field.id];
          if (value !== '' && value !== undefined && value !== null) {
            const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
            dbData[snakeKey] = value;
          }
        }
        
        // Preserve essential hashes from the original record
        dbData.nik_karyawan_hash = record.nik_karyawan_hash;
        if (record.national_id_hash) dbData.national_id_hash = record.national_id_hash;
        if (record.nik_karyawan) dbData.nik_karyawan = record.nik_karyawan;
        
        const encryptedData = encryptMCURecord(dbData);
        
        const { error: updateError } = await client
          .from('mcu_records')
          .update(encryptedData)
          .eq('id', record.id);
          
        if (updateError) throw updateError;
        updatedCount++;
      } catch (err: any) {
        errors.push({ id: record.id, error: err.message });
      }
    }

    return NextResponse.json({ success: true, updatedCount, totalFound: allRecords.length, errors });
  } catch (err: any) {
    console.error('Error recalculating MCU:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
