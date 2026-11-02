import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, READ_ROLES, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

const INITIAL_DIAGNOSA = [
  'Commond Cold', 'Faringitis', 'Vertigo', 'Strain', 'Chepalgia',
  'Unspesified Disorder', 'Gastritis', 'Unspesified Allergy', 'Hipertermia',
  'Odontalgia', 'Hipertensi', 'Myalgia', 'Diarhea', 'Gerd', 'Contusion',
  'Hiperuricemia', 'Disminorhea', 'Unspesified Infection', 'Pulpitis',
  'Vomiting', 'Vulnus Laceratum', 'Hiperlipidemia', 'Hordeulum', 'Stomatitis',
  'Artritis', 'Diabetes Mellitus', 'Dermatitis', 'Tinea', 'Konjungtivitis',
  'Toothache', 'Trauma Okuli', 'Vulnus Contussum', 'Hipotension', 'Migrain',
  'Hipoxia', 'Combustio', 'Keratitis', 'Gingivitis', 'Herpes Zoster',
  'Leukositosis', 'Osteoarthitis', 'Pra-Hipertensi', 'Tachicardia'
];

export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, READ_ROLES);
  if (denied) return denied;
  try {
    const supabase = integrationAdminClient();
    const { data, error } = await supabase
      .from('diagnosa')
      .select('nama')
      .order('nama', { ascending: true });

    if (error) {
      console.error('[Diagnosa] Failed to read diagnosis list:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal mengambil daftar diagnosa.' }, { status: 500 });
    }

    const dbNames = (data || []).map((d: { nama: string }) => d.nama).filter(Boolean);
    const combined = Array.from(new Set([...INITIAL_DIAGNOSA, ...dbNames])).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ success: true, data: combined });
  } catch {
    return NextResponse.json({ success: false, error: 'Layanan diagnosa belum tersedia.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !('nama' in body) || typeof body.nama !== 'string') {
      return NextResponse.json({ success: false, error: 'Nama diagnosa wajib diisi.' }, { status: 400 });
    }
    const nama = body.nama.trim().slice(0, 120);

    if (!nama) {
      return NextResponse.json({ success: false, error: 'Nama diagnosa wajib diisi' }, { status: 400 });
    }

    const { data, error } = await integrationAdminClient()
      .from('diagnosa')
      .insert({ nama })
      .select()
      .single();

    if (error) {
      // If conflict / already exists, treat as success
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Diagnosa sudah ada di master', data: { nama } });
      }
      console.error('[Diagnosa] Failed to save diagnosis:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal menyimpan diagnosa.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Diagnosa berhasil ditambahkan ke master', data });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menyimpan diagnosa.' }, { status: 500 });
  }
}
