import { NextRequest, NextResponse } from 'next/server';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { encryptMCURecord } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { refreshQuestionnaireSnapshot } from '@/lib/questionnaire-store';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import { tulisMcuRecordTahanSkema } from '@/lib/mcu-record-write';

const supabase = () => integrationAdminClient();

/**
 * Segarkan salinan skor kuesioner pada MCU yang baru disimpan, lalu hitung
 * ulang kolom turunannya.
 *
 * Menyimpan MCU baru bisa mengubah apa yang "terkunci" di dalamnya: MCU pada
 * Desember harus memakai hasil kuesioner November, bukan hasil yang lebih
 * lama. Karena itu snapshot dihitung ulang di sini, berdasarkan tanggal MCU
 * itu sendiri — bukan tanggal hari ini.
 *
 * Kegagalan di sini tidak menggagalkan penyimpanan MCU. MCU tetap tersimpan
 * tanpa skor kuesioner, dan Assessment bisa mengisinya ulang.
 */
async function syncQuestionnaireForMCU(recordId: string): Promise<void> {
  try {
    const { data: row } = await supabase()
      .from('mcu_records')
      .select('nik_karyawan_hash, tgl_mcu')
      .eq('id', recordId)
      .maybeSingle();
    if (!row?.nik_karyawan_hash) return;

    await refreshQuestionnaireSnapshot(row.nik_karyawan_hash as string, row.tgl_mcu as string);
  } catch (err) {
    console.error('Gagal menyegarkan salinan kuesioner pada MCU:', err);
  }
}

/**
 * Update satu record dengan membuang kolom yang tidak ada di skema database,
 * lalu melaporkan kolom mana saja yang dilewati. Lihat mcu-record-write.ts.
 *
 * Tanpa ini, satu field MCU yang kolomnya belum ditambahkan di database
 * (mis. `anti_hav`) menggagalkan SELURUH penyimpanan — termasuk field lain
 * yang kolomnya sudah ada.
 */
async function updateMcuRecord(recordId: string, data: Record<string, any>) {
  return tulisMcuRecordTahanSkema(data, payload =>
    supabase().from('mcu_records').update(payload).eq('id', recordId));
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    const body = await req.json();
    const { formData } = body;
    const calculatedFormData = applyMCUCalculations(formData || {});

    const nikKaryawan = calculatedFormData?.nikKaryawan || calculatedFormData?.nationalId;
    if (!formData || !nikKaryawan) {
      return NextResponse.json({ success: false, error: 'NIK Karyawan is required' }, { status: 400 });
    }
    if (caller!.role === 'pic'
      && (!caller!.site || String(calculatedFormData.site || '').trim().toLowerCase() !== caller!.site.trim().toLowerCase())) {
      return NextResponse.json({ success: false, error: 'PIC hanya dapat menyimpan data MCU di site sendiri' }, { status: 403 });
    }

    // Convert formData camelCase keys to snake_case for Supabase, strictly using MCU_FIELDS
    const dbData: Record<string, any> = {};
    for (const field of MCU_FIELDS) {
      const value = calculatedFormData[field.id];
      const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
      if (field.type === 'select') {
        // Parameter yang tidak ditemukan pada berkas MCU disimpan NULL, bukan
        // string kosong atau "Tidak Diperiksa".
        dbData[snakeKey] = value == null || String(value).trim() === '' || /^n\/a$/i.test(String(value).trim())
          ? null
          : value;
      } else if (value !== '' && value !== undefined && value !== null) {
        dbData[snakeKey] = value;
      }
    }
    // Allow NIK KTP to be used as the fallback key when NIK Karyawan is unavailable.
    dbData.nik_karyawan = dbData.nik_karyawan || nikKaryawan;
    const encryptedData = encryptMCURecord(dbData);

    const recordId = calculatedFormData?.id || formData?.id;

    // Upsert logic: if an ID is provided, strictly update that record
    if (recordId) {
      if (caller!.role === 'pic') {
        const { data: existingRecord, error: existingError } = await supabase()
          .from('mcu_records')
          .select('site')
          .eq('id', recordId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existingRecord || String(existingRecord.site || '').trim().toLowerCase() !== caller!.site!.trim().toLowerCase()) {
          return NextResponse.json({ success: false, error: 'Rekaman MCU tidak ditemukan pada site Anda' }, { status: 404 });
        }
      }
      const { dilewati } = await updateMcuRecord(recordId, encryptedData);
      await syncQuestionnaireForMCU(recordId);
      return NextResponse.json({ success: true, action: 'updated', dilewati: dilewati.length ? dilewati : undefined });
    }

    // Otherwise, check if one exists for the same tgl_mcu
    const { data: existing } = await supabase()
      .from('mcu_records')
      .select('id')
      .eq('nik_karyawan_hash', encryptedData.nik_karyawan_hash)
      .eq('tgl_mcu', encryptedData.tgl_mcu)
      .single();

    let savedId: string;
    if (existing && existing.id) {
      // Update
      const { dilewati } = await updateMcuRecord(existing.id, encryptedData);
      savedId = existing.id;
      await syncQuestionnaireForMCU(savedId);
      return NextResponse.json({ success: true, action: 'updated', dilewati: dilewati.length ? dilewati : undefined });
    } else {
      // Insert — sama seperti update, satu kolom yang belum ada di database
      // tidak boleh menggagalkan penyimpanan record baru.
      let insertedId = '';
      const { dilewati } = await tulisMcuRecordTahanSkema(encryptedData, async payload => {
        const { data, error } = await supabase()
          .from('mcu_records')
          .insert(payload)
          .select('id')
          .single();
        if (!error && data?.id) insertedId = String(data.id);
        return { error };
      });

      savedId = insertedId;
      await syncQuestionnaireForMCU(savedId);
      return NextResponse.json({ success: true, action: 'inserted', dilewati: dilewati.length ? dilewati : undefined });
    }

  } catch (err: any) {
    console.error('Error saving MCU to Supabase:', err);
    // Pesan asli diteruskan supaya penyebabnya bisa ditelusuri dari layar,
    // bukan hanya "Gagal menyimpan data MCU" yang tidak memberi petunjuk.
    const detail = typeof err?.message === 'string' ? err.message : '';
    const kode = typeof err?.code === 'string' ? err.code : '';
    const pesan = detail
      ? `Gagal menyimpan data MCU: ${detail}${kode ? ` (${kode})` : ''}`
      : 'Gagal menyimpan data MCU';
    return NextResponse.json({ success: false, error: pesan }, { status: 500 });
  }
}
