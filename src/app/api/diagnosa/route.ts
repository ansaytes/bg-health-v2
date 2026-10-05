import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

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

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('diagnosa')
      .select('nama')
      .order('nama', { ascending: true });

    if (error) {
      // If table doesn't exist yet, return initial list gracefully
      return NextResponse.json({ success: true, data: INITIAL_DIAGNOSA });
    }

    const dbNames = (data || []).map((d: { nama: string }) => d.nama).filter(Boolean);
    const combined = Array.from(new Set([...INITIAL_DIAGNOSA, ...dbNames])).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ success: true, data: combined });
  } catch (_err) {
    return NextResponse.json({ success: true, data: INITIAL_DIAGNOSA });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nama = (body.nama || '').trim();

    if (!nama) {
      return NextResponse.json({ success: false, error: 'Nama diagnosa wajib diisi' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('diagnosa')
      .insert({ nama })
      .select()
      .single();

    if (error) {
      // If conflict / already exists, treat as success
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Diagnosa sudah ada di master', data: { nama } });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Diagnosa berhasil ditambahkan ke master', data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan diagnosa';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
