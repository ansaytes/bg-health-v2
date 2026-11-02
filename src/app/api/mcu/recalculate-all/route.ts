import { NextRequest, NextResponse } from 'next/server';
import { decryptMCURecord, encryptMCURecord } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { getServerCaller, requireServerRole, SYSTEM_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

const client = () => integrationAdminClient();

export async function POST(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  try {
    let allRecords: any[] = [];
    let from = 0;
    const pageSize = 1000;
    
    // Fetch all records
    while (true) {
      const { data, error } = await client().from('mcu_records').select('*').range(from, from + pageSize - 1);
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
    let failedCount = 0;

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
        
        const { error: updateError } = await client()
          .from('mcu_records')
          .update(encryptedData)
          .eq('id', record.id);
          
        if (updateError) throw updateError;
        updatedCount++;
      } catch (err) {
        failedCount++;
        console.error('Failed to recalculate MCU record:', err instanceof Error ? err.name : 'unknown error');
      }
    }

    return NextResponse.json({ success: failedCount === 0, updatedCount, totalFound: allRecords.length, failedCount });
  } catch (err) {
    console.error('Error recalculating MCU:', err instanceof Error ? err.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal menjalankan rekalkulasi MCU.' }, { status: 500 });
  }
}
