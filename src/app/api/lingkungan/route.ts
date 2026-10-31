import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  NAB_LUX,
  NAB_UDARA,
  NAB_LAIN,
  CATATAN_METODE,
  nilaiRuang,
  type PeruntukanRuang,
} from '@/lib/lingkungan-kerja';

export const dynamic = 'force-dynamic';

/**
 * /api/lingkungan — Pencahayaan & Kualitas Udara Dalam Ruangan
 *
 * ACUAN: Permenaker 5/2018 Pasal 40–42 dan Permenkes 48/2016 Tabel 1 & 4
 * (sama dengan BG/QSHE/STD/005 Rev.001 yang dipakai perusahaan).
 *
 * GET  ?site=<site>          → daftar ruang + pengukuran terakhir
 * GET  ?template=1           → ambang & catatan metode untuk form
 * POST                       → simpan satu sesi pengukuran satu ruang
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic', 'manager'];
const ROLES_TULIS = ['superuser', 'administrator', 'pic'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  // Ambang & metode — dipakai form agar label acuan tidak ditulis ulang di UI.
  if (req.nextUrl.searchParams.get('template') === '1') {
    return NextResponse.json({
      success: true,
      nabLux: NAB_LUX,
      nabUdara: NAB_UDARA,
      nabLain: NAB_LAIN,
      metode: CATATAN_METODE,
    });
  }

  const client = adminClient();
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;
  const site = picSite || req.nextUrl.searchParams.get('site')?.trim() || '';

  const ruangQuery = client.from('lingkungan_ruang').select('*').order('nama_ruang');
  const { data: ruang, error } = site
    ? await ruangQuery.eq('site', site)
    : await ruangQuery;

  if (error) {
    // Supabase mengembalikan "Could not find the table 'public.x' in the schema
    // cache" (PGRST205) — pola ini HARUS ikut dikenali, kalau tidak halaman
    // menampilkan 500 alih-alih pesan "jalankan migration".
    if (/does not exist|Could not find the table|schema cache|PGRST204|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({
        success: true, tabelSiap: false, data: [],
        catatan: 'Tabel belum dibuat. Jalankan migration 20261031_inspeksi_lingkungan.sql.',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (ruang ?? []).map((r) => String(r.id));
  const { data: ukur } = ids.length
    ? await client.from('lingkungan_ukur').select('*').in('ruang_id', ids).order('tanggal', { ascending: false })
    : { data: [] as unknown[] };

  const { data: titik } = ids.length
    ? await client.from('lingkungan_titik').select('*').in('ukur_id', ((ukur ?? []) as Record<string, unknown>[]).map((u) => String(u.id)))
    : { data: [] as unknown[] };

  const titikByUkur = new Map<string, Record<string, unknown>[]>();
  for (const t of (titik ?? []) as Record<string, unknown>[]) {
    const key = String(t.ukur_id);
    const list = titikByUkur.get(key) ?? [];
    list.push(t);
    titikByUkur.set(key, list);
  }

  const ukurTerakhir = new Map<string, Record<string, unknown>>();
  for (const u of (ukur ?? []) as Record<string, unknown>[]) {
    const key = String(u.ruang_id);
    if (!ukurTerakhir.has(key)) ukurTerakhir.set(key, u);
  }

  const data = ((ruang ?? []) as Record<string, unknown>[]).map((r) => {
    const u = ukurTerakhir.get(String(r.id)) ?? null;
    const t = u ? titikByUkur.get(String(u.id)) ?? [] : [];
    const penilaian = u
      ? nilaiRuang({
        peruntukan: String(r.peruntukan) as PeruntukanRuang,
        luasM2: r.luas_m2 === null ? null : Number(r.luas_m2),
        jumlahPekerja: r.jumlah_pekerja === null ? null : Number(r.jumlah_pekerja),
        tinggiRuanganM: r.tinggi_ruangan_m === null ? null : Number(r.tinggi_ruangan_m),
        titik: t.map((x) => ({
          lux: x.lux === null ? null : Number(x.lux),
          suhu: x.suhu_c === null ? null : Number(x.suhu_c),
          kelembapan: x.kelembapan_pct === null ? null : Number(x.kelembapan_pct),
          oksigen: x.oksigen_pct === null ? null : Number(x.oksigen_pct),
          pm10: x.pm10_mg_m3 === null ? null : Number(x.pm10_mg_m3),
          asbes: x.asbes_serat_ml === null ? null : Number(x.asbes_serat_ml),
        })),
      })
      : null;

    return {
      id: r.id,
      namaRuang: r.nama_ruang,
      peruntukan: r.peruntukan,
      luasM2: r.luas_m2,
      jumlahPekerja: r.jumlah_pekerja,
      tinggiRuanganM: r.tinggi_ruangan_m,
      ventilasiBuatan: r.ventilasi_buatan,
      tanggalBersihVentilasi: r.tanggal_bersih_ventilasi,
      pengukuranTerakhir: u ? { ...u, titik: t } : null,
      penilaian,
    };
  });

  const denganPenilaian = data.filter((d) => d.penilaian);
  const ringkasan = {
    jumlahRuang: data.length,
    sudahDiukur: denganPenilaian.length,
    tidakMemenuhi: denganPenilaian.filter((d) => (d.penilaian?.jumlahTidakMemenuhi ?? 0) > 0).length,
    luxTidakMemenuhi: denganPenilaian.filter((d) => d.penilaian?.statusLux === 'tidak-memenuhi').length,
  };

  return NextResponse.json({ success: true, tabelSiap: true, site: site || null, data, ringkasan });
}

/** POST — simpan satu sesi pengukuran (ruang baru atau pembaruan). */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const site = String(body.site ?? '').trim();
  const namaRuang = String(body.namaRuang ?? '').trim();
  const peruntukan = String(body.peruntukan ?? 'ruang_kerja') as PeruntukanRuang;
  const tanggal = String(body.tanggal ?? '').slice(0, 10);

  if (!site || !namaRuang) return NextResponse.json({ error: 'Site dan nama ruang wajib diisi' }, { status: 400 });
  if (!tanggal) return NextResponse.json({ error: 'Tanggal pengukuran wajib diisi' }, { status: 400 });
  if (!NAB_LUX[peruntukan]) return NextResponse.json({ error: 'Peruntukan ruang tidak dikenal' }, { status: 400 });

  const client = adminClient();

  // Upsert ruang berdasarkan (site, nama_ruang).
  const { data: ruang, error: ruangError } = await client
    .from('lingkungan_ruang')
    .upsert({
      site,
      nama_ruang: namaRuang,
      peruntukan,
      luas_m2: body.luasM2 ?? null,
      jumlah_pekerja: body.jumlahPekerja ?? null,
      tinggi_ruangan_m: body.tinggiRuanganM ?? null,
      ventilasi_buatan: body.ventilasiBuatan === true,
      tanggal_bersih_ventilasi: body.tanggalBersihVentilasi || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'site,nama_ruang' })
    .select('id')
    .single();

  if (ruangError) return NextResponse.json({ error: ruangError.message }, { status: 500 });
  const ruangId = String(ruang.id);

  const titik: Record<string, unknown>[] = Array.isArray(body.titik) ? body.titik : [];
  const luxList = titik.map((t) => Number(t.lux)).filter((n) => Number.isFinite(n) && n > 0);

  const { data: ukur, error: ukurError } = await client
    .from('lingkungan_ukur')
    .upsert({
      ruang_id: ruangId,
      tanggal,
      pengukur: body.pengukur || null,
      alat_luxmeter: body.alatLuxmeter || null,
      alat_kualitas_udara: body.alatKualitasUdara || null,
      waktu_mulai: body.waktuMulai || null,
      waktu_selesai: body.waktuSelesai || null,
      lux_min: luxList.length ? Math.min(...luxList) : null,
      lux_rata: luxList.length ? Number((luxList.reduce((a, b) => a + b, 0) / luxList.length).toFixed(1)) : null,
      lux_maks: luxList.length ? Math.max(...luxList) : null,
      catatan: body.catatan || null,
      created_by: caller.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ruang_id,tanggal' })
    .select('id')
    .single();

  if (ukurError) return NextResponse.json({ error: ukurError.message }, { status: 500 });
  const ukurId = String(ukur.id);

  // Ganti seluruh titik pada sesi ini.
  await client.from('lingkungan_titik').delete().eq('ukur_id', ukurId);
  if (titik.length) {
    const { error: titikError } = await client.from('lingkungan_titik').insert(
      titik.map((t, i) => ({
        ukur_id: ukurId,
        kode_titik: String(t.kodeTitik || `T${i + 1}`),
        posisi: t.posisi || null,
        lux: t.lux === '' || t.lux == null ? null : Number(t.lux),
        tinggi_bidang_kerja_cm: t.tinggiBidangKerjaCm ?? NAB_LAIN.tinggiBidangKerjaCm,
        suhu_c: t.suhu === '' || t.suhu == null ? null : Number(t.suhu),
        kelembapan_pct: t.kelembapan === '' || t.kelembapan == null ? null : Number(t.kelembapan),
        oksigen_pct: t.oksigen === '' || t.oksigen == null ? null : Number(t.oksigen),
        pm10_mg_m3: t.pm10 === '' || t.pm10 == null ? null : Number(t.pm10),
        asbes_serat_ml: t.asbes === '' || t.asbes == null ? null : Number(t.asbes),
      })),
    );
    if (titikError) return NextResponse.json({ error: titikError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ruangId, ukurId });
}
