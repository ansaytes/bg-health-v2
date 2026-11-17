import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  JENIS_META,
  picaOverdue,
  tenggatDariTingkat,
  tanggalISO,
} from '@/lib/inspeksi-program';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/pica — temuan ketidaksesuaian hasil inspeksi.
 *
 * GET  ?site=&status=      daftar PICA + ringkasan (MTTR, overdue, per departemen)
 * POST { aksi: 'tambah' }  catat temuan baru (due date otomatis dari tingkat)
 * POST { aksi: 'update' }  ubah status / tindakan / akar masalah
 * POST { aksi: 'tutup' }   tutup PICA (status closed + tanggal_closed)
 * POST { aksi: 'dismiss' } tandai bukan temuan nyata
 *
 * Akses: superuser, administrator, manager, pic (site sendiri).
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

const TABEL_SIAP_PESAN =
  'Tabel PICA belum dibuat. Jalankan database/inspeksi_program.sql di SQL Editor Supabase.';

const beluMAda = (pesan: string) => /42P01|PGRST205|does not exist|schema cache/i.test(pesan);

function sitePIC(caller: { role?: string | null; site?: string | null }) {
  return caller.role === 'pic' ? (caller.site ?? null) : null;
}

/** Kunci pengulangan: jenis objek + nama objek, tanpa nomor/unit. */
export function kunciBerulang(jenis: string | null, objek: string | null): string | null {
  const j = String(jenis ?? '').trim().toLowerCase();
  const o = String(objek ?? '').trim().toLowerCase();
  if (!j && !o) return null;
  return `${j}:${o}`;
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const params = req.nextUrl.searchParams;
  const statusFilter = params.get('status')?.trim() || '';
  const fokusSite = sitePIC(caller) || params.get('site')?.trim() || '';

  let query = client.from('pica').select('*').order('tanggal_dibuat', { ascending: false }).limit(5000);
  if (fokusSite) query = query.eq('site', fokusSite);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) {
    if (beluMAda(`${error.code ?? ''} ${error.message ?? ''}`)) {
      return NextResponse.json({ success: true, tabelSiap: false, catatan: TABEL_SIAP_PESAN, daftar: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const daftar = (data ?? []).map(p => ({ ...p, overdue: picaOverdue(p) }));

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    jenis: JENIS_META,
    daftar,
    daftarSite: [...new Set(daftar.map(p => String(p.site ?? '')).filter(Boolean))].sort(),
    daftarDepartemen: [
      ...new Set(daftar.map(p => String(p.departemen ?? '').trim()).filter(Boolean)),
    ].sort(),
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const body = await req.json().catch(() => ({}));
  const aksi = String(body?.aksi ?? '').trim();
  const picSite = sitePIC(caller);

  try {
    if (aksi === 'tambah') {
      const deskripsi = String(body?.deskripsi ?? '').trim();
      if (!deskripsi) {
        return NextResponse.json({ error: 'Deskripsi temuan wajib diisi' }, { status: 400 });
      }
      const site = picSite || String(body?.site ?? '').trim() || null;
      const jenisInspeksi = String(body?.jenis_inspeksi ?? '').trim() || null;
      const objekNama = String(body?.objek_nama ?? '').trim() || null;
      const tingkat = String(body?.tingkat ?? 'minor').trim();
      const dibuat = String(body?.tanggal_dibuat ?? '').slice(0, 10) || tanggalISO(new Date());

      // Kolom teks FORM-039 dibaca apa adanya; string kosong → null.
      const teks = (kunci: string) => String(body?.[kunci] ?? '').trim() || null;

      const { error } = await client.from('pica').insert({
        kode: teks('kode'),
        sumber: String(body?.sumber ?? 'inspeksi').trim(),
        jenis_inspeksi: jenisInspeksi,
        jenis_pica: teks('jenis_pica'),
        site,
        lokasi: teks('lokasi'),
        objek_id: teks('objek_id'),
        objek_nama: objekNama,
        deskripsi,
        tingkat,
        departemen: teks('departemen'),
        pic_nama: teks('pic_nama'),
        pic_tindak_lanjut: teks('pic_tindak_lanjut'),
        inisiator: teks('inisiator') ?? caller.userId ?? null,
        tanggal_dibuat: dibuat,
        // Tenggat mengikuti tingkat temuan bila tidak diisi manual.
        due_date: String(body?.due_date ?? '').slice(0, 10) || tenggatDariTingkat(tingkat, new Date(`${dibuat}T00:00:00`)),
        status: 'open',
        akar_masalah: teks('akar_masalah'),
        tindakan: teks('tindakan'),
        tindakan_pencegahan: teks('tindakan_pencegahan'),
        foto_url: teks('foto_url'),
        dokumentasi_url: teks('dokumentasi_url'),
        kunci_berulang: kunciBerulang(jenisInspeksi, objekNama),
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const kolom of [
      'status', 'departemen', 'pic_nama', 'pic_tindak_lanjut', 'akar_masalah',
      'tindakan', 'tindakan_pencegahan', 'tingkat', 'verifikasi_oleh',
      'foto_url', 'dokumentasi_url', 'lokasi', 'jenis_pica',
    ]) {
      if (body?.[kolom] != null) patch[kolom] = String(body[kolom]).trim() || null;
    }
    if (body?.due_date != null) patch.due_date = String(body.due_date).slice(0, 10) || null;

    if (aksi === 'tutup') {
      patch.status = 'closed';
      patch.tanggal_closed = String(body?.tanggal_closed ?? '').slice(0, 10) || tanggalISO(new Date());
    }
    if (aksi === 'dismiss') patch.status = 'dismissed';

    let q = client.from('pica').update(patch).eq('id', id);
    if (picSite) q = q.eq('site', picSite);
    const { error } = await q;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const pesan = err instanceof Error ? err.message : 'Gagal memproses PICA';
    if (beluMAda(pesan)) return NextResponse.json({ error: TABEL_SIAP_PESAN }, { status: 500 });
    console.error('[pica]', err);
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
