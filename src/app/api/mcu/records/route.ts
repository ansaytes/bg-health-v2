import { NextRequest, NextResponse } from 'next/server';
import { decryptEmployee, decryptMCURecord, hashField, isEncryptedValue } from '@/lib/encryption';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import { safeHash } from '@/lib/query-safety';

const client = () => integrationAdminClient();

export async function GET(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;
  if (caller!.role === 'pic' && !caller!.site) {
    return NextResponse.json({ error: 'Site PIC belum ditetapkan' }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const nik = params.get('nik')?.trim() || '';
  const nationalId = params.get('national_id')?.trim() || '';
  if (caller!.role === 'pic' && (nik || nationalId)) {
    const digest = safeHash(hashField(nik || nationalId));
    if (!digest) return NextResponse.json({ record: null });
    const { data: employee } = await client()
      .from('employees')
      .select('site_name')
      .or(`nik_hash.eq.${digest},national_id_hash.eq.${digest}`)
      .maybeSingle();
    if (!employee?.site_name
      || String(employee.site_name).trim().toLowerCase() !== caller!.site!.trim().toLowerCase()) {
      return NextResponse.json({ record: null });
    }
  }
  if (!nik && !nationalId) {
    const requestedPage = Number.parseInt(params.get('page') || '1', 10);
    // Mode batch (?batch=1&offset=0&limit=500): dipakai tabel Record MCU untuk memuat SEMUA data
    // secara bertahap supaya filter kolom bekerja pada seluruh data, bukan hanya 100 baris.
    const batchMode = params.get('batch') === '1';
    const requestedLimit = Number.parseInt(params.get('limit') || '500', 10);
    const requestedOffset = Number.parseInt(params.get('offset') || '0', 10);
    const pageSize = batchMode
      ? (Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : 500)
      : 100;
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const from = batchMode
      ? (Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0)
      : (page - 1) * pageSize;
    const search = batchMode ? '' : (params.get('search')?.trim() || '');
    // id sebagai pengurut kedua: tgl_mcu tidak unik, tanpa ini baris bisa terlewat/ganda antar halaman.
    let listQuery = client().from('mcu_records').select('*', { count: 'exact' })
      .order('tgl_mcu', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (caller!.role === 'pic') listQuery = listQuery.eq('site', caller!.site);
    if (search) {
      const hash = safeHash(hashField(search));
      if (hash) {
        listQuery = listQuery.or(`nik_karyawan_hash.eq.${hash},national_id_hash.eq.${hash}`);
      } else {
        // Hash tidak terbentuk berarti input tidak bisa dipetakan ke karyawan
        // mana pun. Kembalikan kosong, jangan menjalankan filter tanpa nilai.
        return NextResponse.json({ records: [], count: 0, page, pageSize });
      }
    }
    const { data: records, count, error: listError } = await listQuery;
    if (listError) {
      console.error('[MCU records] Failed to fetch records:', listError.code);
      return NextResponse.json({ error: 'Gagal memuat data MCU' }, { status: 500 });
    }

    // NIK Karyawan perlu dicari dari tabel employees bila:
    //  1) kolom NIK Karyawan sebenarnya berisi NIK KTP (hash sama), atau
    //  2) hasil dekripsi masih berupa ciphertext (gagal terbaca).
    const needsEmployeeNik = (record: Record<string, any>) => {
      if (!record.national_id_hash) return false;
      if (record.national_id_hash === record.nik_karyawan_hash) return true;
      return isEncryptedValue(decryptMCURecord(record).nik_karyawan);
    };
    const nationalIdHashes = [...new Set((records || [])
      .filter(needsEmployeeNik)
      .map(record => String(record.national_id_hash)))];
    const employeeNikByNationalId = new Map<string, string>();
    // Dipecah per 100 hash agar URL query tidak terlalu panjang.
    for (let index = 0; index < nationalIdHashes.length; index += 100) {
      const { data: employees, error: employeeError } = await client()
        .from('employees')
        .select('nik,national_id_hash')
        .in('national_id_hash', nationalIdHashes.slice(index, index + 100));
      if (employeeError) {
        console.error('[MCU records] Failed to resolve employee data:', employeeError.code);
        return NextResponse.json({ error: 'Gagal memuat data MCU' }, { status: 500 });
      }

      for (const employee of employees || []) {
        const nationalIdHash = employee.national_id_hash;
        const decrypted = decryptEmployee(employee);
        if (nationalIdHash && decrypted.nik) {
          employeeNikByNationalId.set(nationalIdHash, String(decrypted.nik));
        }
      }
    }

    return NextResponse.json({
      records: (records || []).map(record => {
        const decrypted = decryptMCURecord(record);
        delete decrypted.national_id;
        if (needsEmployeeNik(record)) {
          decrypted.nik_karyawan = employeeNikByNationalId.get(record.national_id_hash) || '';
        }
        // Jangan pernah mengirim ciphertext mentah ke tampilan
        for (const field of ['nik_karyawan', 'nama', 'link_mcu']) {
          if (isEncryptedValue(decrypted[field])) decrypted[field] = '';
        }
        return {
          ...decrypted,
          nik_karyawan_hash: record.nik_karyawan_hash,
        };
      }),
      page,
      pageSize,
      offset: from,
      hasMore: from + (records?.length || 0) < (count || 0),
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  }

  let query = client().from('mcu_records').select('*').order('tgl_mcu', { ascending: false }).limit(1);
  if (nik) query = query.eq('nik_karyawan_hash', hashField(nik));
  else query = query.eq('national_id_hash', hashField(nationalId));

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[MCU records] Failed to fetch latest record:', error.code);
    return NextResponse.json({ error: 'Gagal memuat data MCU' }, { status: 500 });
  }
  if (!data) {
    // Fallback: NIK Karyawan di employees sebenarnya bisa berupa NIK KTP.
    if (nik) {
      const { data: byNationalId } = await client().from('mcu_records').select('*')
        .eq('national_id_hash', hashField(nik))
        .order('tgl_mcu', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byNationalId) {
        const record = decryptMCURecord(byNationalId);
        const snakeToCamelMap: Record<string, string> = {};
        for (const field of MCU_FIELDS) {
          const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
          snakeToCamelMap[snakeKey] = field.id;
        }
        const formData: Record<string, string> = {};
        for (const [key, value] of Object.entries(record)) {
          if (['created_at', 'updated_at'].includes(key) || value == null) continue;
          if (key === 'id') {
            formData.id = String(value);
            continue;
          }
          const camelKey = snakeToCamelMap[key] || key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
          formData[camelKey] = String(value);
        }
        return NextResponse.json({ record: formData, updatedAt: byNationalId.updated_at || byNationalId.created_at });
      }
    }
    return NextResponse.json({ record: null });
  }

  const record = decryptMCURecord(data);
  const snakeToCamelMap: Record<string, string> = {};
  for (const field of MCU_FIELDS) {
    const snakeKey = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
    snakeToCamelMap[snakeKey] = field.id;
  }

  const formData: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (['created_at', 'updated_at'].includes(key) || value == null) continue;
    if (key === 'id') {
      formData.id = String(value);
      continue;
    }
    const camelKey = snakeToCamelMap[key] || key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    formData[camelKey] = String(value);
  }
  return NextResponse.json({ record: formData, updatedAt: data.updated_at || data.created_at });
}
