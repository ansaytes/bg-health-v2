import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, READ_ROLES, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

// INITIAL_DOSIS is used ONLY as a fallback when the dosis_obat table is empty
// or unreachable. Do NOT add entries here that have been intentionally deleted
// from the database — deletions in Supabase must be reflected here too.
const INITIAL_DOSIS = [
  '3DD1',
  '2DD1',
  '1DD1',
  '4DD1',
  '2TAB/BAB',
  'K/P',
  'Q4H',
  '4QH',
  '1x1 Sesudah Makan',
  '3x1 Sesudah Makan',
];

export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, READ_ROLES);
  if (denied) return denied;
  try {
    const supabase = integrationAdminClient();
    const { data, error } = await supabase
      .from('dosis_obat')
      .select('kode')
      .order('kode', { ascending: true });

    if (error) {
      console.error('[Dosis] Failed to read dosage list:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal mengambil daftar dosis.' }, { status: 500 });
    }

    const dbCodes = (data || []).map((d: { kode: string }) => d.kode).filter(Boolean);
    // Use DB values as the source of truth. INITIAL_DOSIS is only a fallback
    // when the table is genuinely empty — this ensures deletions in Supabase
    // are reflected immediately without needing a code deployment.
    const result = dbCodes.length > 0 ? dbCodes : INITIAL_DOSIS;

    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: 'Layanan dosis belum tersedia.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !('kode' in body) || typeof body.kode !== 'string') {
      return NextResponse.json({ success: false, error: 'Kode / aturan pakai wajib diisi.' }, { status: 400 });
    }
    const kode = body.kode.trim().slice(0, 120);
    const keterangan = 'keterangan' in body && typeof body.keterangan === 'string' ? body.keterangan.trim().slice(0, 300) || null : null;

    if (!kode) {
      return NextResponse.json({ success: false, error: 'Kode / aturan pakai wajib diisi' }, { status: 400 });
    }

    const { data, error } = await integrationAdminClient()
      .from('dosis_obat')
      .insert({ kode, keterangan })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Dosis sudah ada di master', data: { kode } });
      }
      console.error('[Dosis] Failed to save dosage:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal menyimpan dosis.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Dosis berhasil ditambahkan ke master', data });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menyimpan dosis.' }, { status: 500 });
  }
}
