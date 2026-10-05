import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';
import { createRegistrationLookupToken } from '@/lib/registration-lookup-token';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;
const LOOKUP_WINDOW_MS = 60_000;
const LOOKUP_LIMIT = 10;
const lookupAttempts = new Map<string, { count: number; resetAt: number }>();

type SearchBy = 'national_id' | 'nik' | 'nama';
type RegistrationEmployeeRow = {
  nik: string | null;
  national_id: string | null;
  nama: string;
  job_position: string | null;
  site_name: string | null;
};

function getRateLimitKey(request: NextRequest): string {
  return request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function checkRateLimit(request: NextRequest): boolean {
  const now = Date.now();
  for (const [key, bucket] of lookupAttempts) {
    if (bucket.resetAt <= now) lookupAttempts.delete(key);
  }

  const key = getRateLimitKey(request);
  const current = lookupAttempts.get(key);
  if (!current || current.resetAt <= now) {
    lookupAttempts.set(key, { count: 1, resetAt: now + LOOKUP_WINDOW_MS });
    return true;
  }
  if (current.count >= LOOKUP_LIMIT) return false;
  current.count += 1;
  return true;
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(request)) {
    return response({ success: false, error: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, 429);
  }
  if (!supabaseAdmin) {
    return response({ success: false, error: 'Layanan lookup pendaftaran belum dikonfigurasi.' }, 503);
  }
  if (!/^[\da-f]{64}$/i.test(process.env.ENCRYPTION_KEY || '')) {
    return response({ success: false, error: 'Layanan lookup pendaftaran belum dikonfigurasi.' }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ success: false, error: 'Permintaan lookup tidak valid.' }, 400);
  }
  if (typeof body !== 'object' || body === null) {
    return response({ success: false, error: 'Permintaan lookup tidak valid.' }, 400);
  }

  const payload = body as Record<string, unknown>;
  const query = typeof payload.query === 'string' ? payload.query.trim() : '';
  const searchBy = payload.searchBy;
  if (!query || (searchBy !== 'national_id' && searchBy !== 'nik' && searchBy !== 'nama')) {
    return response({ success: false, error: 'Masukkan NIK KTP, NIK Karyawan, atau nama karyawan.' }, 400);
  }

  const client = supabaseAdmin;
  try {
    let employeeQuery = client
      .from('employees')
      .select('nik, national_id, nama, job_position, site_name')
      .ilike('employment_status', 'Aktif');

    if (searchBy === 'national_id') {
      if (!/^\d{16}$/.test(query)) {
        return response({ success: false, error: 'NIK KTP harus terdiri dari 16 digit.' }, 400);
      }
      const nationalIdHash = hashField(query);
      if (!nationalIdHash) throw new Error('National ID lookup hash could not be generated.');
      employeeQuery = employeeQuery.eq('national_id_hash', nationalIdHash);
    } else if (searchBy === 'nik') {
      if (!/^\d{4,15}$/.test(query)) {
        return response({ success: false, error: 'NIK Karyawan harus berisi 4 sampai 15 digit.' }, 400);
      }
      const nikHash = hashField(query);
      if (!nikHash) throw new Error('Employee NIK lookup hash could not be generated.');
      employeeQuery = employeeQuery.eq('nik_hash', nikHash);
    } else {
      const nameQuery = query.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim();
      if (nameQuery.length < 3) {
        return response({ success: false, error: 'Pencarian nama minimal 3 karakter.' }, 400);
      }
      employeeQuery = employeeQuery.ilike('nama', `%${nameQuery}%`).order('nama').limit(20);
    }

    const { data, error } = await employeeQuery.limit(searchBy === 'nama' ? 20 : 1);
    if (error) {
      console.error('Registration employee lookup failed:', error);
      return response({ success: false, error: 'Gagal mencari data karyawan.' }, 500);
    }

    const employees = (data || []).map(row => {
      const decrypted = decryptEmployee(row);
      const employee: RegistrationEmployeeRow = {
        nik: typeof decrypted.nik === 'string' ? decrypted.nik : null,
        national_id: typeof decrypted.national_id === 'string' ? decrypted.national_id : null,
        nama: String(decrypted.nama || ''),
        job_position: typeof decrypted.job_position === 'string' ? decrypted.job_position : null,
        site_name: typeof decrypted.site_name === 'string' ? decrypted.site_name : null,
      };
      return employee;
    }).filter((employee): employee is RegistrationEmployeeRow & { nik: string; national_id: string } =>
      !!employee.nik && /^\d{16}$/.test(employee.national_id || '') && !!employee.nama,
    ).map(employee => ({
      nama: employee.nama,
      job_position: employee.job_position || '',
      site_name: employee.site_name || '',
      lookupToken: createRegistrationLookupToken({
        nik: employee.nik,
        nationalId: employee.national_id,
        nama: employee.nama,
        jabatan: employee.job_position || '',
        jobsite: employee.site_name || '',
      }),
    }));

    return employees.length
      ? response({ success: true, data: employees })
      : response({ success: false, error: 'Karyawan tidak ditemukan.' }, 404);
  } catch (error) {
    console.error('Registration employee lookup request failed:', error);
    return response({ success: false, error: 'Gagal memproses pencarian karyawan.' }, 500);
  }
}
