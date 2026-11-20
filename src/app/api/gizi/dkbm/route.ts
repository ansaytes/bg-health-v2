import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, READ_ROLES, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import { DEFAULT_DKBM_SEED, type ItemDKBM } from '@/lib/gizi-kerja';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/gizi/dkbm — Ambil daftar master komposisi bahan makanan dari database.
 * POST /api/gizi/dkbm — Tambah menu / bahan katering baru ke database.
 */

export async function GET(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, READ_ROLES);
  if (denied) return denied;

  const client = integrationAdminClient();

  try {
    const { data, error } = await client
      .from('dkbm_katalog')
      .select('*')
      .eq('aktif', true)
      .order('kategori', { ascending: true })
      .order('nama', { ascending: true });

    if (error) {
      // Jika tabel belum dibuat di Supabase, fallback aman ke data seed bawaan
      return NextResponse.json({
        success: true,
        tabelSiap: false,
        catatan: 'Tabel dkbm_katalog belum dimigrasi di Supabase. Menggunakan data acuan Kemenkes bawaan.',
        data: DEFAULT_DKBM_SEED,
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        tabelSiap: true,
        data: DEFAULT_DKBM_SEED,
      });
    }

    // Transform kolom snake_case database ke camelCase ItemDKBM
    const list: ItemDKBM[] = data.map((d: Record<string, unknown>) => ({
      id: String(d.id),
      nama: String(d.nama),
      kategori: d.kategori as ItemDKBM['kategori'],
      kaloriPer100g: Number(d.kalori_per_100g) || 0,
      proteinPer100g: Number(d.protein_per_100g) || 0,
      lemakPer100g: Number(d.lemak_per_100g) || 0,
      karbohidratPer100g: Number(d.karbohidrat_per_100g) || 0,
      porsiUmum: String(d.porsi_umum || ''),
    }));

    return NextResponse.json({ success: true, tabelSiap: true, data: list });
  } catch (err) {
    return NextResponse.json({
      success: true,
      tabelSiap: false,
      data: DEFAULT_DKBM_SEED,
      catatan: err instanceof Error ? err.message : 'Fallback ke data acuan lokal',
    });
  }
}

export async function POST(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
  }

  const nama = String(body.nama || '').trim();
  const kategori = String(body.kategori || '').trim();
  const kalori = Number(body.kaloriPer100g || body.kalori_per_100g);
  const protein = Number(body.proteinPer100g || body.protein_per_100g) || 0;
  const lemak = Number(body.lemakPer100g || body.lemak_per_100g) || 0;
  const karbo = Number(body.karbohidratPer100g || body.karbohidrat_per_100g) || 0;
  const porsi = String(body.porsiUmum || body.porsi_umum || '').trim();

  if (!nama || !kategori || isNaN(kalori) || kalori <= 0) {
    return NextResponse.json({ error: 'Nama, kategori, dan kalori per 100g wajib diisi.' }, { status: 400 });
  }

  const id = String(body.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `dkbm-${Date.now()}`;

  const client = integrationAdminClient();

  const { data, error } = await client
    .from('dkbm_katalog')
    .insert({
      id,
      nama,
      kategori,
      kalori_per_100g: kalori,
      protein_per_100g: protein,
      lemak_per_100g: lemak,
      karbohidrat_per_100g: karbo,
      porsi_umum: porsi || null,
      aktif: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: `Gagal menyimpan menu DKBM: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, pesan: `Menu "${nama}" berhasil ditambahkan ke database DKBM.`, data });
}
