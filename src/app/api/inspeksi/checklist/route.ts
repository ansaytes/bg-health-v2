import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/inspeksi/checklist — checklist kelaikan fasilitas & aset.
 *
 * Satu endpoint untuk tiga checklist yang bentuknya sama:
 *   ?jenis=p3k        Kotak P3K (Permenaker 15/2008)
 *   ?jenis=ambulans   Ambulans & tanggap darurat medis
 *   ?jenis=ergonomi   Sarana ergonomi operasional
 *
 * GET  daftar katalog + kondisi per site (mode per grup: lokasi/unit)
 * POST { aksi: 'simpan', jenis, site, gu, item: [...] }
 * POST { aksi: 'unit', ... }       (khusus ambulans) status kesiapan unit
 *
 * Kenapa satu endpoint: ketiga checklist hanya berbeda nama tabel dan kolom
 * pengelompok (lokasi / unit / tidak ada). Menduplikasi route untuk masing-
 * masing berarti tiga tempat untuk memperbaiki bug yang sama.
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic', 'manager'];
const ROLES_TULIS = ['superuser', 'administrator', 'pic'];

interface KonfigurasiJenis {
  katalog: string;
  kondisi: string;
  /** Kolom pengelompok pada tabel kondisi, mis. `lokasi` atau `unit`. */
  pengelompok: string | null;
  label: string;
}

const JENIS: Record<string, KonfigurasiJenis> = {
  p3k: { katalog: 'p3k_katalog', kondisi: 'p3k_site', pengelompok: 'lokasi', label: 'Kotak P3K' },
  ambulans: { katalog: 'ambulans_katalog', kondisi: 'ambulans_site', pengelompok: 'unit', label: 'Ambulans' },
  ergonomi: { katalog: 'ergonomi_sarana_katalog', kondisi: 'ergonomi_sarana_site', pengelompok: null, label: 'Sarana Ergonomi' },
};

const PESAN_TABEL =
  'Tabel checklist belum dibuat. Jalankan database/inspeksi_program.sql di SQL Editor Supabase.';

const belumAda = (pesan: string) => /42P01|PGRST205|does not exist|schema cache/i.test(pesan);

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const jenisKey = params.get('jenis')?.trim() || 'p3k';
  const konfig = JENIS[jenisKey];
  if (!konfig) return NextResponse.json({ error: 'Jenis checklist tidak dikenal' }, { status: 400 });

  const site = caller.role === 'pic'
    ? (caller.site ?? '')
    : (params.get('site')?.trim() || '');
  if (!site) return NextResponse.json({ error: 'Parameter site wajib diisi' }, { status: 400 });

  const client = adminClient();
  const [katalogRes, kondisiRes] = await Promise.all([
    client.from(konfig.katalog).select('*').order('urutan'),
    client.from(konfig.kondisi).select('*').eq('site', site),
  ]);

  if (katalogRes.error) {
    if (belumAda(String(katalogRes.error.message ?? ''))) {
      return NextResponse.json({ success: true, tabelSiap: false, catatan: PESAN_TABEL, katalog: [], kondisi: [] });
    }
    return NextResponse.json({ error: 'Gagal membaca katalog.' }, { status: 500 });
  }
  if (kondisiRes.error) return NextResponse.json({ error: 'Gagal membaca kondisi.' }, { status: 500 });

  const katalog = (katalogRes.data ?? []) as Record<string, unknown>[];
  const kondisi = (kondisiRes.data ?? []) as Record<string, unknown>[];

  // Grup = lokasi/unit yang sudah punya data; bila belum ada, satu grup default.
  const kolomKelompok: string | null = konfig.pengelompok;
  const grup: string[] = kolomKelompok
    ? [...new Set(kondisi.map(k => String(k[kolomKelompok] ?? '').trim()).filter(Boolean))].sort()
    : [];

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    jenis: jenisKey,
    label: konfig.label,
    pengelompok: konfig.pengelompok,
    site,
    katalog,
    kondisi,
    grup,
    daftarSite: [...new Set(kondisi.map(k => String(k.site ?? '')))].sort(),
    ringkas: ringkas(kondisi),
  });
}

/** Ringkasan status untuk satu jenis checklist. */
function ringkas(kondisi: Record<string, unknown>[]) {
  const hitung = (s: string) => kondisi.filter(k => String(k.status ?? '') === s).length;
  const total = kondisi.length;
  const ada = hitung('ada');
  return {
    total,
    ada,
    rusak: hitung('rusak'),
    tidakAda: hitung('tidak_ada'),
    tidakDiperlukan: hitung('tidak_diperlukan'),
    persenSiap: total ? Math.round((ada / total) * 1000) / 10 : 0,
  };
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const aksi = String(body?.aksi ?? 'simpan').trim();
  const jenisKey = String(body?.jenis ?? 'p3k').trim();
  const konfig = JENIS[jenisKey];
  if (!konfig) return NextResponse.json({ error: 'Jenis checklist tidak dikenal' }, { status: 400 });

  const client = adminClient();
  const site = caller.role === 'pic'
    ? (caller.site ?? '')
    : String(body?.site ?? '').trim();
  if (!site) return NextResponse.json({ error: 'Site wajib diisi' }, { status: 400 });

  try {
    // ── Status kesiapan unit ambulans (Ready / Standby / Breakdown) ─────────
    if (jenisKey === 'ambulans' && aksi === 'unit') {
      const unit = String(body?.unit ?? '').trim();
      if (!unit) return NextResponse.json({ error: 'Unit wajib diisi' }, { status: 400 });
      const { error } = await client.from('ambulans_unit').upsert({
        site,
        unit,
        status_kesiapan: String(body?.status_kesiapan ?? 'standby').trim() || 'standby',
        bbm_persen: body?.bbm_persen == null || body.bbm_persen === '' ? null : Number(body.bbm_persen),
        catatan: String(body?.catatan ?? '').trim() || null,
        diperbarui_oleh: caller.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'site,unit' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (aksi !== 'simpan') return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });

    const grup = konfig.pengelompok ? String(body?.grup ?? '').trim() : '';
    if (konfig.pengelompok && !grup) {
      return NextResponse.json(
        { error: konfig.pengelompok === 'unit' ? 'Unit ambulans wajib diisi' : 'Lokasi wajib diisi' },
        { status: 400 },
      );
    }

    const items = Array.isArray(body?.item) ? body.item as Record<string, unknown>[] : [];
    if (items.length === 0) return NextResponse.json({ error: 'Tidak ada item untuk disimpan' }, { status: 400 });

    const sekarang = new Date().toISOString();
    const hariIni = sekarang.slice(0, 10);

    /** Angka atau null — string kosong diperlakukan sebagai kosong, bukan 0. */
    const angka = (v: unknown): number | null =>
      v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);

    const baris = items.map((it): Record<string, unknown> => {
      const dasar: Record<string, unknown> = {
        site,
        katalog_id: Number(it.katalog_id),
        status: String(it.status ?? 'tidak_ada'),
        catatan: String(it.catatan ?? '').trim() || null,
        tanggal_inspeksi: String(it.tanggal_inspeksi ?? '').slice(0, 10) || hariIni,
        updated_at: sekarang,
      };
      if (konfig.pengelompok) dasar[konfig.pengelompok] = grup;

      if (jenisKey === 'p3k') {
        dasar.jumlah = angka(it.jumlah);
        dasar.tanggal_expired = it.tanggal_expired
          ? String(it.tanggal_expired).slice(0, 10)
          : null;
        dasar.kondisi_kotak = it.kondisi_kotak ?? null;
        dasar.ada_buku_catatan = it.ada_buku_catatan ?? null;
      }
      if (jenisKey === 'ambulans') {
        dasar.kondisi = it.kondisi ?? null;
      }
      if (jenisKey === 'ergonomi') {
        dasar.jumlah = angka(it.jumlah);
        dasar.layak = angka(it.layak);
        dasar.rusak = angka(it.rusak);
      }
      return dasar;
    });

    const barisValid = baris.filter(b => Number.isFinite(b.katalog_id));

    const onConflict = konfig.pengelompok
      ? `site,${konfig.pengelompok},katalog_id`
      : 'site,katalog_id';

    const { error } = await client.from(konfig.kondisi).upsert(barisValid, { onConflict });
    if (error) throw error;

    return NextResponse.json({ success: true, tersimpan: barisValid.length });
  } catch (err) {
    const pesan = err instanceof Error ? err.message : 'Gagal menyimpan checklist';
    if (belumAda(pesan)) return NextResponse.json({ error: PESAN_TABEL }, { status: 500 });
    console.error(`[inspeksi/checklist:${jenisKey}]`, err);
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
