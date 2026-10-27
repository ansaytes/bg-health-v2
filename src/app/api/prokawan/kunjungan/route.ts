import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { hashField } from '@/lib/encryption';

/**
 * GET /api/prokawan/kunjungan
 *
 * Daftar kunjungan kontrol ProKawan (tabel `kunjungan_kontrol`,
 * migration 20261025). Dipakai halaman Administrator > ProKawan untuk menilai
 * kepatuhan peserta: jadwal vs tanggal aktual periksa, evidence dokter, dan
 * hasil kontrol.
 *
 * Query: ?nik=<NIK> untuk satu peserta; tanpa parameter = semua (dibatasi).
 */
const ROLES = ['superuser', 'administrator', 'pic', 'manager'];

function pesanTabelHilang(message: string): boolean {
  // Supabase mengembalikan "Could not find the table 'public.x' in the schema cache".
  return /does not exist|Could not find the table|schema cache|PGRST204|PGRST205|42703|42P01/i.test(message);
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  if (!ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const nik = req.nextUrl.searchParams.get('nik')?.trim();

  let query = client.from('kunjungan_kontrol').select('*')
    .order('jadwal_tanggal', { ascending: false })
    .limit(2000);
  if (nik) query = query.eq('nik_hash', hashField(nik));

  const { data, error } = await query;
  if (error) {
    // Tabel belum dibuat → kembalikan daftar kosong agar UI tetap terbuka.
    if (pesanTabelHilang(error.message)) {
      return NextResponse.json({ success: true, data: [], tabelSiap: false });
    }
    console.error('ProKawan kunjungan:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [], tabelSiap: true });
}

/**
 * POST /api/prokawan/kunjungan
 *
 * Menambah / memperbarui jadwal kontrol peserta ProKawan.
 * Body: { id?, nik, nama?, site?, department?, jabatan?, zona_risiko?,
 *         jadwal_tanggal, aktual_tanggal?, evidence_url?, catatan?, hasil?, no_wa? }
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  if (!['superuser', 'administrator'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Hanya administrator/superuser yang dapat mengubah jadwal kontrol' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nik = String(body.nik ?? '').trim();
  if (!nik) return NextResponse.json({ error: 'NIK peserta wajib diisi' }, { status: 400 });

  const client = adminClient();
  const patch: Record<string, unknown> = {
    nik_hash: hashField(nik),
    site: body.site ?? null,
    department: body.department ?? null,
    jabatan: body.jabatan ?? null,
    zona_risiko: body.zona_risiko ?? null,
    aktual_tanggal: body.aktual_tanggal || null,
    evidence_url: body.evidence_url || null,
    catatan: body.catatan ?? null,
    hasil: body.hasil || null,
    no_wa: body.no_wa || null,
    updated_at: new Date().toISOString(),
  };
  if (body.jadwal_tanggal) patch.jadwal_tanggal = body.jadwal_tanggal;
  if (body.wa_sent_at) patch.wa_sent_at = body.wa_sent_at;

  const run = async (withEnc: boolean) => {
    const payload = withEnc
      ? { ...patch, nik_enc: nik, nama_enc: body.nama ?? null }
      : patch;
    return body.id
      ? client.from('kunjungan_kontrol').update(payload).eq('id', body.id)
      : client.from('kunjungan_kontrol').insert({ ...payload, jadwal_tanggal: body.jadwal_tanggal, created_by: caller.userId });
  };

  let { error } = await run(true);
  // Kolom nik_enc / nama_enc mungkin belum ada pada tabel versi lama.
  if (error && /nik_enc|nama_enc/i.test(error.message)) ({ error } = await run(false));

  if (error) {
    if (pesanTabelHilang(error.message)) {
      return NextResponse.json({
        error: 'Tabel kunjungan_kontrol belum dibuat. Jalankan migration 20261025_prokawan_kunjungan.sql.',
      }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/** DELETE ?id=<uuid> — hapus satu jadwal kontrol. */
export async function DELETE(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

  const { error } = await adminClient().from('kunjungan_kontrol').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
