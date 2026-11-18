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
  const [katalogRes, kondisiRes, unitRes] = await Promise.all([
    client.from(konfig.katalog).select('*').order('urutan'),
    client.from(konfig.kondisi).select('*').eq('site', site),
    jenisKey === 'ambulans'
      ? client.from('ambulans_unit').select('*').eq('site', site)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (katalogRes.error) {
    if (belumAda(String(katalogRes.error.message ?? ''))) {
      return NextResponse.json({ success: true, tabelSiap: false, catatan: PESAN_TABEL, katalog: [], kondisi: [] });
    }
    return NextResponse.json({ error: 'Gagal membaca katalog.' }, { status: 500 });
  }
  if (kondisiRes.error) return NextResponse.json({ error: 'Gagal membaca kondisi.' }, { status: 500 });

  const katalog = (katalogRes.data ?? []) as Record<string, unknown>[];
  const rawKondisi = (kondisiRes.data ?? []) as Record<string, unknown>[];
  const kondisi = rawKondisi.map((k) => {
    if (jenisKey === 'ergonomi') {
      const rusak = Number(k.rusak ?? 0);
      const layak = Number(k.layak ?? 0);
      const jml = Number(k.jumlah ?? 0);
      let status = String(k.status ?? '');
      if (!status || status === 'tidak_ada') {
        if (rusak > 0) status = 'rusak';
        else if (layak > 0 || jml > 0) status = 'ada';
        else status = 'tidak_ada';
      }
      return {
        ...k,
        status,
        kondisi: k.kondisi ?? (rusak > 0 ? `${rusak} rusak` : layak > 0 ? 'Baik' : null),
      };
    }
    if (jenisKey === 'p3k') {
      return {
        ...k,
        kondisi: k.kondisi ?? k.kondisi_kotak ?? null,
      };
    }
    return k;
  });

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
    unitList: unitRes.data ?? [],
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
        dasar.kondisi_kotak = it.kondisi ?? it.kondisi_kotak ?? null;
        dasar.ada_buku_catatan = it.ada_buku_catatan ?? null;
      }
      if (jenisKey === 'ambulans') {
        dasar.kondisi = it.kondisi ?? null;
      }
      if (jenisKey === 'ergonomi') {
        const jml = angka(it.jumlah) ?? 1;
        const st = String(it.status ?? 'tidak_ada');
        dasar.jumlah = jml;
        if (st === 'rusak') {
          dasar.rusak = angka(it.rusak) ?? 1;
          dasar.layak = Math.max(0, jml - Number(dasar.rusak));
        } else if (st === 'ada') {
          dasar.layak = jml;
          dasar.rusak = 0;
        } else {
          dasar.layak = 0;
          dasar.rusak = 0;
        }
      }
      return dasar;
    });

    const barisValid = baris.filter(b => Number.isFinite(b.katalog_id));

    const onConflict = konfig.pengelompok
      ? `site,${konfig.pengelompok},katalog_id`
      : 'site,katalog_id';

    const { error } = await client.from(konfig.kondisi).upsert(barisValid, { onConflict });
    if (error) throw error;

    // ── Otomatis Sinkronisasi Realisasi ke inspeksi_jadwal ────────────────
    const tglInspeksi = baris[0]?.tanggal_inspeksi ? String(baris[0].tanggal_inspeksi).slice(0, 10) : hariIni;
    const periode = tglInspeksi.slice(0, 7);
    const katalogIds = barisValid.map(b => String(b.katalog_id));

    try {
      // 1. Update baris jadwal rencana objek katalog terkait
      await client
        .from('inspeksi_jadwal')
        .update({
          status: 'selesai',
          tanggal_selesai: tglInspeksi,
          petugas: caller.userId ?? null,
          waktu_lapor: sekarang,
          updated_at: sekarang,
        })
        .eq('site', site)
        .eq('jenis', jenisKey)
        .eq('periode', periode)
        .in('objek_id', katalogIds)
        .neq('status', 'selesai');

      // 2. Update jadwal level site/area yang masih berstatus rencana
      await client
        .from('inspeksi_jadwal')
        .update({
          status: 'selesai',
          tanggal_selesai: tglInspeksi,
          petugas: caller.userId ?? null,
          waktu_lapor: sekarang,
          updated_at: sekarang,
        })
        .eq('site', site)
        .eq('jenis', jenisKey)
        .eq('periode', periode)
        .eq('status', 'rencana');
    } catch (jErr) {
      console.warn(`[inspeksi/checklist:${jenisKey}] Gagal auto-update jadwal:`, jErr);
    }

    return NextResponse.json({ success: true, tersimpan: barisValid.length });
  } catch (err) {
    const pesan = err instanceof Error ? err.message : 'Gagal menyimpan checklist';
    if (belumAda(pesan)) return NextResponse.json({ error: PESAN_TABEL }, { status: 500 });
    console.error(`[inspeksi/checklist:${jenisKey}]`, err);
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}

/** PUT /api/inspeksi/checklist — tambah item baru ke katalog checklist */
export async function PUT(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nama = String(body?.nama ?? '').trim();
  const jenisKey = String(body?.jenis ?? '').trim();
  const konfig = JENIS[jenisKey];
  if (!konfig) return NextResponse.json({ error: 'Jenis tidak dikenal' }, { status: 400 });
  if (!nama) return NextResponse.json({ error: 'Nama item wajib diisi' }, { status: 400 });

  const client = adminClient();
  const payload: Record<string, unknown> = {
    nama,
    kategori: String(body?.kategori ?? '').trim() || (jenisKey === 'p3k' ? 'isi' : jenisKey === 'ambulans' ? 'medis' : 'operator'),
    wajib: body?.wajib !== undefined ? Boolean(body.wajib) : true,
  };
  if (jenisKey === 'p3k') {
    payload.satuan = String(body?.satuan ?? '').trim() || 'buah';
    payload.jumlah_standar = Number(body?.jumlah_standar) || 1;
  }

  const { data, error } = await client.from(konfig.katalog).insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}
