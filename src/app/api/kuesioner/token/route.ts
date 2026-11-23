import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';
import { createQuestionnaireToken, QUESTIONNAIRE_TOKEN_MAX_MINUTES } from '@/lib/questionnaire-token';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

/**
 * Normalisasi format tanggal atau PIN untuk perbandingan:
 * Menerima format: YYYY-MM-DD, DD/MM/YYYY, DDMMYYYY, YYYYMMDD
 */
function cleanDigits(val: string): string {
  return val.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Konfigurasi server database belum siap.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
  }

  const nikInput = String(body.nik ?? '').trim();
  const pinInput = String(body.pin ?? '').trim();

  if (!nikInput) {
    return NextResponse.json({ error: 'NIK Karyawan atau NIK KTP wajib diisi.' }, { status: 400 });
  }
  if (!pinInput) {
    return NextResponse.json({ error: 'PIN / Tanggal Lahir / NIK KTP verifikasi wajib diisi.' }, { status: 400 });
  }

  const digest = hashField(nikInput);
  if (!digest) {
    return NextResponse.json({ error: 'Format NIK tidak valid.' }, { status: 400 });
  }

  const columns = 'nik, national_id, nama, gender, age, job_position, site_name, department, employee_status, employment_status, birth_date, nik_hash, national_id_hash';

  // 1. Cari karyawan aktif berdasarkan NIK Karyawan atau NIK KTP
  const [byNik, byNat] = await Promise.all([
    supabaseAdmin.from('employees').select(columns).eq('nik_hash', digest).ilike('employment_status', 'Aktif').limit(1),
    supabaseAdmin.from('employees').select(columns).eq('national_id_hash', digest).ilike('employment_status', 'Aktif').limit(1),
  ]);

  const match = (byNik.data && byNik.data[0]) || (byNat.data && byNat.data[0]);
  if (!match) {
    return NextResponse.json(
      { error: 'Karyawan aktif dengan NIK tersebut tidak ditemukan. Pastikan Anda memasukkan NIK terdaftar atau hubungi HR.' },
      { status: 404 }
    );
  }

  const decrypted = decryptEmployee(match);
  const employeeNik = String(decrypted.nik ?? match.nik ?? '');
  const employeeNatId = String(decrypted.national_id ?? match.national_id ?? '');
  const employeeBirthDate = String(match.birth_date ?? decrypted.birth_date ?? '');

  // 2. Verifikasi Tanggal Lahir (Format: DDMMYYYY)
  const cleanPin = cleanDigits(pinInput);
  let isPinValid = false;

  // Parsing tanggal lahir dari database (YYYY-MM-DD, DD-MM-YYYY, atau ISO timestamp)
  let birthDateParsed: { d: string; m: string; y: string } | null = null;
  if (employeeBirthDate) {
    const isoMatch = employeeBirthDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      birthDateParsed = {
        y: isoMatch[1],
        m: isoMatch[2].padStart(2, '0'),
        d: isoMatch[3].padStart(2, '0'),
      };
    } else {
      const dmyMatch = employeeBirthDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmyMatch) {
        birthDateParsed = {
          d: dmyMatch[1].padStart(2, '0'),
          m: dmyMatch[2].padStart(2, '0'),
          y: dmyMatch[3],
        };
      }
    }
  }

  if (birthDateParsed && cleanPin) {
    const expectedDdmmyyyy = `${birthDateParsed.d}${birthDateParsed.m}${birthDateParsed.y}`;
    const expectedYyyymmdd = `${birthDateParsed.y}${birthDateParsed.m}${birthDateParsed.d}`;
    if (cleanPin === expectedDdmmyyyy || cleanPin === expectedYyyymmdd) {
      isPinValid = true;
    }
  }

  // Fallback: perbandingan digit bersih langsung jika parsing regex belum cocok
  if (!isPinValid && cleanPin) {
    const cleanBirth = cleanDigits(employeeBirthDate).slice(0, 8);
    if (cleanBirth.length === 8 && cleanPin.length === 8) {
      const birthDMY = cleanBirth.slice(6, 8) + cleanBirth.slice(4, 6) + cleanBirth.slice(0, 4);
      if (cleanPin === cleanBirth || cleanPin === birthDMY) {
        isPinValid = true;
      }
    }
    // Fallback NIK KTP jika tersedia
    const cleanNatId = cleanDigits(employeeNatId);
    if (cleanNatId && cleanPin === cleanNatId) {
      isPinValid = true;
    }
  }

  if (!isPinValid) {
    return NextResponse.json(
      { error: 'Verifikasi identitas gagal. Tanggal lahir yang dimasukkan (format ddmmyyyy) tidak sesuai dengan data karyawan.' },
      { status: 401 }
    );
  }

  // 3. Ambil data MCU terakhir untuk konteks tampilan identitas
  const { data: lastMcu } = await supabaseAdmin
    .from('mcu_records')
    .select('tgl_mcu')
    .eq('nik_karyawan_hash', match.nik_hash || digest)
    .order('tgl_mcu', { ascending: false })
    .limit(1)
    .maybeSingle();

  const claims = {
    nik: employeeNik || nikInput,
    nationalId: employeeNatId,
    nikHash: match.nik_hash || digest,
    nationalIdHash: match.national_id_hash || null,
    nama: String(decrypted.nama ?? match.nama ?? ''),
    jabatan: String(decrypted.job_position ?? match.job_position ?? ''),
    site: String(decrypted.site_name ?? match.site_name ?? ''),
    usia: String(decrypted.age ?? match.age ?? '—'),
    jenisKelamin: String(decrypted.gender ?? match.gender ?? '—'),
    tglMCU: String(lastMcu?.tgl_mcu ?? ''),
  };

  // 4. Terbitkan One-Time Token maksimal 30 menit
  const token = createQuestionnaireToken(claims, QUESTIONNAIRE_TOKEN_MAX_MINUTES);
  const expiresAt = Date.now() + QUESTIONNAIRE_TOKEN_MAX_MINUTES * 60 * 1000;

  return NextResponse.json({
    success: true,
    token,
    expiresAt,
    maxMinutes: QUESTIONNAIRE_TOKEN_MAX_MINUTES,
    identity: claims,
  });
}
