import { NextRequest, NextResponse } from 'next/server';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { encryptMCURecord } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { refreshQuestionnaireSnapshot } from '@/lib/questionnaire-store';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

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
 * tanpa skor kuesioner, danAssessments bisa mengisinya ulang.
 */
/**
 * Daftar kolom yang BENAR-BENAR ada pada tabel mcu_records.
 *
 * Diambil dari satu baris contoh (limit 1) lalu dibaca dari kunci objeknya.
 * Hasilnya di-cache per proses karena skema tabel tidak berubah saat runtime.
 * Bila tabel kosong atau query gagal, fungsi mengembalikan null — pemanggil
 * lalu mengirim seluruh kolom seperti sebelumnya, sehingga perilakunya tidak
 * berubah saat daftar kolom tidak bisa dipastikan.
 */
let cacheKolom: Set<string> | null = null;

async function bacaKolomMcuRecords(): Promise<Set<string> | null> {
  if (cacheKolom) return cacheKolom;
  try {
    const { data, error } = await supabase()
      .from('mcu_records')
      .select('*')
      .limit(1);
    if (error) {
      console.error('[MCU save] Gagal membaca daftar kolom:', error.code);
      return null;
    }
    if (!data || data.length === 0) return null;
    cacheKolom = new Set(Object.keys(data[0]));
    return cacheKolom;
  } catch (err) {
    console.error('[MCU save] Gagal membaca daftar kolom:', err);
    return null;
  }
}

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

    // Buang kolom yang belum ada di tabel.
    //
    // Tanpa ini, satu field baru di MCU_FIELDS yang kolomnya belum dibuat
    // membuat SELURUH penyimpanan gagal dengan PGRST204 ("Could not find the
    // 'x' column"), sehingga operator tidak bisa menyimpan apa pun — persis
    // kegagalan yang terjadi pada kolom srq17_bahaya. Kolom yang belum ada
    // dilewati dan dicatat, bukan menggagalkan seluruh simpan.
    const kolomTersedia = await bacaKolomMcuRecords();
    const kolomDilewati: string[] = [];
    if (kolomTersedia) {
      for (const key of Object.keys(encryptedData)) {
        if (!kolomTersedia.has(key)) {
          kolomDilewati.push(key);
          delete encryptedData[key];
        }
      }
      if (kolomDilewati.length > 0) {
        console.warn('[MCU save] Kolom belum ada di mcu_records, dilewati:', kolomDilewati.join(', '));
      }
    }
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
      const { error } = await supabase()
        .from('mcu_records')
        .update(encryptedData)
        .eq('id', recordId);

      if (error) throw error;
      await syncQuestionnaireForMCU(recordId);
      return NextResponse.json({ success: true, action: 'updated' });
    }

    // Otherwise, check if one exists for the same tgl_mcu
    const { data: existing, error: searchError } = await supabase()
      .from('mcu_records')
      .select('id')
      .eq('nik_karyawan_hash', encryptedData.nik_karyawan_hash)
      .eq('tgl_mcu', encryptedData.tgl_mcu)
      .single();

    let savedId: string;
    if (existing && existing.id) {
      // Update
      const { error } = await supabase()
        .from('mcu_records')
        .update(encryptedData)
        .eq('id', existing.id);

      if (error) throw error;
      savedId = existing.id;
      await syncQuestionnaireForMCU(savedId);
      return NextResponse.json({ success: true, action: 'updated' });
    } else {
      // Insert
      const { data, error } = await supabase()
        .from('mcu_records')
        .insert(encryptedData)
        .select('id')
        .single();

      if (error) throw error;
      savedId = data.id;
      await syncQuestionnaireForMCU(savedId);
      return NextResponse.json({ success: true, action: 'inserted' });
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
