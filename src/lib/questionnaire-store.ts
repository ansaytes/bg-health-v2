// ============================================================
// Pembantu bersama untuk endpoint kuesioner (ESS & kesehatan mental)
// ============================================================
//
// Kedua kuesioner butuh hal yang sama:
//
//   1. Pencarian karyawan dengan autofill identitas (nama / national ID /
//      NIK Karyawan), lalu isi field identitas otomatis.
//   2. Penyimpanan jawaban dengan aturan "satu baris per karyawan per
//      tanggal": pengukuran ulang pada tanggal yang sama harus MENIMPA
//      baris lama, bukan menambah baris baru.
//   3. Penyalinan skor ke mcu_records sebagai snapshot, sehingga engine
//      zonasi tetap bisa membacanya tanpa query database.
//   4. Hitung ulang zonasi pada MCU terbaru karyawan tersebut, karena
//      parameter zonasi ikut berubah begitu kuesioner diisi.
//
// Semua modul ini dipakai bersama oleh /api/ess dan /api/mental-health.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { decryptEmployee, decryptMCURecord, encryptMCURecord, hashField } from '@/lib/encryption';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { applyMCUCalculations } from '@/lib/mcu-calculations';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function adminClient() {
  return createClient(url, serviceKey || anonKey);
}

export interface CallerProfile {
  role: string;
}

const ALLOWED_ROLES = ['pic', 'superuser', 'administrator'];

/** Mengambil peran pemanggil, atau null bila tidak terautentikasi. */
export async function getCaller(req: NextRequest): Promise<CallerProfile | null> {
  const client = adminClient();
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
    || req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
    return { role: process.env.NEXT_PUBLIC_PREVIEW_ROLE };
  }
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return profile ? { role: profile.role } : null;
}

export function canWriteQuestionnaires(caller: CallerProfile | null): boolean {
  return !!caller && ALLOWED_ROLES.includes(caller.role);
}

/**
 * Gerbang akses endpoint kuesioner.
 *
 * Kuesioner Gangguan Tidur dan Kesehatan Mental dibuka sebagai pengisian
 * mandiri: karyawan boleh mengisinya tanpa masuk ke aplikasi, cukup dengan
 * identitasnya (nama, NIK Karyawan, atau NIK KTP) ditemukan. Hasil skrining
 * ini memang harus diisi oleh orang yang mengalaminya, sehingga mewajibkan
 * login hanya membuat kuesioner dilewati.
 *
 * Dua lapis pelamar ada di sini:
 *   1. Petugas yang sudah masuk (PIC/administrator/superuser) tetap boleh,
 *      supaya bisa mengoreksi hasil atau melihat riwayat.
 *   2. Pengunjung tanpa sesi tetap boleh, tetapi dibatasi jumlah permintaan per
 *      alamat IP. Tanpa batas ini, endpoint terbuka bisa dipakai menebak NIK
 *      KTP orang satu per satu dan menimpa baris pada tanggal yang sama.
 *
 * SECURITY NOTE. This does open up writing mental health data without
 * authentication, as requested. The consequence: anyone who knows an employee's
 * NIK KTP can write a questionnaire result in that person's name. The rate
 * limit below holds off bulk abuse, but does NOT hold off targeted abuse. If
 * this questionnaire ever feeds an employment action, this gate must go back
 * to mandatory login with a single-use token.
 */
const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientAddress(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'lokal';
}

export function denyUnlessSelfService(req: NextRequest, caller: CallerProfile | null): NextResponse | null {
  // Petugas yang sudah masuk tidak dibatasi — jumlah pemakaiannya normal dan
  // tercatat di log aplikasi.
  if (caller && ALLOWED_ROLES.includes(caller.role)) return null;

  const key = clientAddress(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.max) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(RATE_LIMIT.windowMs / 1000)} detik.` },
      { status: 429 },
    );
  }
  return null;
}

/** Dipakai endpoint lain yang tetap mewajibkan login. */
export function denyUnlessWriter(caller: CallerProfile | null): NextResponse | null {
  if (!caller) {
    return NextResponse.json({ error: 'Sesi tidak ditemukan. Silakan masuk kembali.' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  return null;
}

/**
 * Menerjemahkan galat PostgREST menjadi kalimat yang bisa ditindaklanjuti.
 *
 * Kasus yang paling sering muncul di lingkungan ini adalah tabel kuesioner
 * belum ada karena migrasi belum dijalankan. Tanpa terjemahan ini, yang tampil
 * hanya "Could not find the table 'public.mcu_ess' in the schema cache", yang
 * tidak memberi petunjuk apa yang harus dilakukan.
 */
export function pesanGalat(error: unknown, konteks: string): string {
  const mentah = error instanceof Error ? error.message : String(error);
  if (/Could not find the table|schema cache|PGRST205|42P01/i.test(mentah)) {
    const tabel = (/table '([^']+)'/i.exec(mentah) ?? [])[1] ?? 'tabel kuesioner';
    return `${konteks} gagal karena tabel ${tabel} belum ada di database. `
      + 'Jalankan supabase/migrations/2026-10-02_std006_ptm_ess_mental_health.sql '
      + 'lewat Supabase SQL Editor lebih dulu.';
  }
  return mentah;
}

export interface EmployeeIdentity {
  nikKaryawan: string;
  nationalId: string;
  nikKaryawanHash: string;
  nationalIdHash: string | null;
  nama: string;
  jabatan: string;
  site: string;
  usia: string;
  jenisKelamin: string;
  tglMCU: string;
  mcuRecordId: string | null;
}

/**
 * Mencari karyawan di tabel employees, lalu mengisi identitas.
 *
 * Sumber utama adalah tabel `employees`, bukan `mcu_records`. Kuesioner diisi
 * lebih sering daripada MCU, dan karyawan baru belum tentu punya record MCU —
 * kalau lookup bergantung pada mcu_records, orang yang justru paling perlu
 *assessment (karyawan baru) tidak akan ditemukan.
 *
 * Pencarian menerima NIK Karyawan, NIK KTP, atau sebagian nama. Pencarian
 * nama memakai ILIKE karena kolom employees.nama disimpan sebagai teks biasa.
 */
export async function findEmployeeIdentity(query: string): Promise<EmployeeIdentity | null> {
  const client = adminClient();
  const trimmed = query.trim();
  if (!trimmed) return null;

  const digest = hashField(trimmed);
  const filters = [`nik_hash.eq."${digest}"`, `national_id_hash.eq."${digest}"`, `nama.ilike."%${trimmed.replace(/["%\\]/g, '')}%"`];

  const { data: matches, error } = await client
    .from('employees')
    .select('nik, national_id, nama, gender, age, job_position, site_name, department, employee_status, employment_status, nik_hash, national_id_hash')
    .or(filters.join(','))
    .limit(5);
  if (error) throw new Error(error.message);

  const match = (matches ?? [])[0];
  if (!match) return null;

  const decrypted = decryptEmployee(match);
  const nikKaryawan = String(decrypted.nik ?? '');
  const nationalId = String(decrypted.national_id ?? '');

  // Tanggal MCU terakhir dipakai hanya untuk memberi konteks pada assessor.
  // Tidak wajib ada: karyawan tanpa MCU tetap bisa diisi kuesionernya.
  const { data: lastMcu } = await client
    .from('mcu_records')
    .select('tgl_mcu')
    .eq('nik_karyawan_hash', hashField(nikKaryawan))
    .order('tgl_mcu', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    nikKaryawan,
    nationalId,
    nikKaryawanHash: hashField(nikKaryawan) || '',
    nationalIdHash: hashField(nationalId) || null,
    nama: String(decrypted.nama ?? ''),
    jabatan: String(decrypted.job_position ?? ''),
    site: String(decrypted.site_name ?? ''),
    usia: String(decrypted.age ?? ''),
    jenisKelamin: String(decrypted.gender ?? ''),
    tglMCU: String(lastMcu?.tgl_mcu ?? ''),
    mcuRecordId: null,
  };
}

/**
 * Menyegarkan salinan skor kuesioner pada record-record MCU.
 *
 * ATURAN TANGGAL — inilah yang mencegah riwayat hilang.
 *
 * Salinan pada mcu_records BUKAN data kuesioner terbaru. Yang disalin adalah
 * hasil kuesioner terakhir yang SUDAH ADA pada tanggal MCU itu pemeriksaan.
 * Jadi:
 *
 *   • Kuesioner 15 Mar · MCU 20 Jun  → snapshot MCU = skor Mar.
 *   • Lalu kuesioner 20 Nov diisi       → snapshot MCU Jun TETAP skor Mar.
 *   • MCU baru 05 Des                  → snapshot MCU Des = skor Nov.
 *
 * Karena itu tidak ada data lama yang tertimpa: setiap MCU mengunci pada
 * kondisi kuesioner saat pemeriksaannya, persis seperti mengunci hasil lab
 * yang dicetak pada hari itu. Riwayat penuh tetap ada di mcu_ess dan
 * mcu_mental_health, satu baris per tanggal.
 *
 * Setiap MCU yang disentuh juga dihitung ulang zonasinya, karena skor
 * kuesioner ikut menentukan zona.
 */
export async function refreshQuestionnaireSnapshot(
  nikKaryawanHash: string,
  sinceDate?: string,
): Promise<{ updated: number; zonasi: string | null }> {
  const client = adminClient();

  // Hanya MCU yang diperiksa pada atau setelah tanggal kuesioner baru yang
  // bisa terpengaruh. MCU yang lebih lama mengunci nilai lamanya.
  let query = client
    .from('mcu_records')
    .select('id, tgl_mcu')
    .eq('nik_karyawan_hash', nikKaryawanHash);
  if (sinceDate) query = query.gte('tgl_mcu', sinceDate);

  const { data: records, error } = await query;
  if (error) throw new Error(error.message);
  if (!records || records.length === 0) return { updated: 0, zonasi: null };

  const { data: essRows } = await client
    .from('mcu_ess')
    .select('tgl_ess, skor_ess, jumlah_terisi, kategori')
    .eq('nik_karyawan_hash', nikKaryawanHash);
  const { data: mhRows } = await client
    .from('mcu_mental_health')
    .select('tgl_pemeriksaan, skor_srq20, dass_depresi, dass_ansietas, dass_stres, indeks_sds')
    .eq('nik_karyawan_hash', nikKaryawanHash);

  let updated = 0;
  let latestZonasi: string | null = null;
  let latestTgl = '';

  for (const record of records) {
    const mcuDate = String(record.tgl_mcu ?? '');
    const ess = latestOnOrBefore(essRows ?? [], 'tgl_ess', mcuDate);
    const mh = latestOnOrBefore(mhRows ?? [], 'tgl_pemeriksaan', mcuDate);

    const snapshotDate = later(ess?.tgl_ess ?? null, mh?.tgl_pemeriksaan ?? null);
    const patch = {
      ess_score: ess ? Number(ess.skor_ess) : null,
      srq20_score: mh?.skor_srq20 ?? null,
      dass_depresi: mh?.dass_depresi ?? null,
      dass_cemas: mh?.dass_ansietas ?? null,
      dass_stres: mh?.dass_stres ?? null,
      sds_score: mh?.indeks_sds ?? null,
      kuesioner_tgl: snapshotDate,
    };

    const { error: updateError } = await client
      .from('mcu_records')
      .update(patch)
      .eq('id', record.id);
    if (updateError) throw new Error(updateError.message);

    const zonasi = await recomputeMCU(record.id as string);
    updated += 1;
    if (!latestTgl || mcuDate > latestTgl) {
      latestTgl = mcuDate;
      latestZonasi = zonasi;
    }
  }

  return { updated, zonasi: latestZonasi };
}

function latestOnOrBefore<T extends Record<string, unknown>>(
  rows: T[],
  dateKey: string,
  before: string,
): (T & Record<string, unknown>) | null {
  const eligible = rows.filter((row) => {
    const value = String(row[dateKey] ?? '');
    return value !== '' && (before === '' || value <= before);
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => (String(a[dateKey]) < String(b[dateKey]) ? 1 : -1));
  return eligible[0];
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Menghitung ulang seluruh kolom kalkulasi pada satu record MCU.
 * Dipakai setelah snapshot kuesioner berubah.
 */
export async function recomputeMCU(recordId: string): Promise<string | null> {
  const client = adminClient();
  const { data, error } = await client.from('mcu_records').select('*').eq('id', recordId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const snakeToCamel = new Map<string, string>();
  for (const field of MCU_FIELDS) {
    snakeToCamel.set(field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(), field.id);
  }

  const decrypted = decryptMCURecord(data);
  const formData: Record<string, any> = { id: decrypted.id };
  for (const [key, value] of Object.entries(decrypted)) {
    const camel = snakeToCamel.get(key) ?? key;
    if (value !== null && value !== undefined && camel !== 'id') formData[camel] = value;
  }

  const calculated = applyMCUCalculations(formData) as Record<string, any>;

  const patch: Record<string, any> = {};
  for (const field of MCU_FIELDS) {
    if (!field.autoCalc) continue;
    const value = calculated[field.id];
    // Penting: applyMCUCalculations hanya mengisi kolom yang memang punya
    // isian. Kolom yang tidak tersentuh harus dibiarkan apa adanya, bukan
    // ditulis null, supaya diagnosa yang sudah ada tidak terhapus hanya
    // karena kuesioner diperbarui.
    if (value === undefined) continue;
    const snake = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
    patch[snake] = value === null || value === '' ? null : value;
  }

  const { error: updateError } = await client
    .from('mcu_records')
    .update(patch)
    .eq('id', recordId);
  if (updateError) throw new Error(updateError.message);

  return calculated.zonasi ?? null;
}

/**
 * Menyimpan satu hasil kuesioner dengan aturan satu baris per karyawan per
 * tanggal. Bila baris untuk tanggal yang sama sudah ada, isinya diperbarui
 * (menimpa), bukan ditambahkan.
 */
export async function upsertQuestionnaire<T>(
  table: string,
  nikKaryawanHash: string,
  date: string,
  row: Record<string, unknown>,
): Promise<{ id: string; action: 'inserted' | 'updated' }> {
  const client = adminClient();
  const payload = { ...row, nik_karyawan_hash: nikKaryawanHash };

  const { data: existing, error: lookupError } = await client
    .from(table)
    .select('id')
    .eq('nik_karyawan_hash', nikKaryawanHash)
    .eq(table === 'mcu_ess' ? 'tgl_ess' : 'tgl_pemeriksaan', date)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (existing?.id) {
    const { error } = await client.from(table).update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, action: 'updated' };
  }

  const { data, error } = await client.from(table).insert(payload).select('id').single();
  if (error) throw new Error(error.message);
  return { id: data.id, action: 'inserted' };
}

/** Menyiapkan kolom nama terenkripsi untuk tabel kuesioner. */
export function questionnaireIdentityColumns(identity: {
  nama: string;
  nationalIdHash: string | null;
  jabatan: string;
  site: string;
}): Record<string, unknown> {
  const namaPlain = identity.nama || null;
  const encrypted = encryptMCURecord({ nama: namaPlain });
  return {
    national_id_hash: identity.nationalIdHash,
    nama: encrypted.nama ?? namaPlain,
    nama_terenkripsi: namaPlain ? encrypted.nama !== namaPlain : false,
    jabatan: identity.jabatan || null,
    site: identity.site || null,
  };
}

/** Membaca nilai numerik dari input form dengan batas yang aman. */
export function readNumber(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}