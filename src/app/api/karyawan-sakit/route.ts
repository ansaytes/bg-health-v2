import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { encrypt, hashField } from '@/lib/encryption';
import { hitungFase, jadwalBerikutnya, periksaSyaratUnfit } from '@/lib/karyawan-sakit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Monitoring Karyawan Sakit — BG/QSHE/SOP/027 Rev.002.
 *
 * PENTING: modul ini TERPISAH dari kelayakan kerja pada MCU.
 *  • `mcu_records.kes_vendor` = kesimpulan vendor MCU (tetap sah, tidak diubah).
 *  • `sakit_rekomendasi` (FORM/123) = penilaian ulang QSHE Medic berdasarkan
 *    kondisi aktual & sumber lain (SKS, surat pernyataan mandiri, asesmen).
 * Keduanya berdampingan dan tidak saling menimpa.
 *
 * Akses: superuser, administrator, pic (site sendiri), manager (baca agregat).
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic', 'manager'];
const ROLES_TULIS = ['superuser', 'administrator', 'pic'];

const HARI_MS = 86_400_000;

function toDate(v: unknown): string | null {
  const s = String(v ?? '').slice(0, 10);
  return s && !Number.isNaN(new Date(`${s}T00:00:00`).getTime()) ? s : null;
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const params = req.nextUrl.searchParams;
  const nik = params.get('nik')?.trim();
  const status = params.get('status')?.trim();
  const picSite = caller.role === 'pic' ? caller.site ?? null : null;
  const site = picSite || params.get('site')?.trim() || null;

  let query = client
    .from('sakit_episode')
    .select('*')
    .order('tanggal_mulai_sakit', { ascending: false })
    .limit(1000);
  if (nik) query = query.eq('nik_hash', hashField(nik));
  if (status && status !== 'semua') query = query.eq('status', status);
  if (site) query = query.eq('site', site);

  const { data: episodes, error } = await query;
  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({
        success: true, data: [], tabelSiap: false,
        catatan: 'Tabel belum dibuat. Jalankan migration 20261028_karyawan_sakit.sql.',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (episodes ?? []) as Record<string, unknown>[];
  const ids = rows.map((r) => String(r.id));

  // Pemantauan & rekomendasi diambil sekaligus untuk episode yang tampil.
  const [pemantauanRes, rekomendasiRes] = await Promise.all([
    ids.length
      ? client.from('sakit_pemantauan').select('*').in('episode_id', ids).order('tanggal', { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
    ids.length
      ? client.from('sakit_rekomendasi').select('*').in('episode_id', ids).order('tanggal_penilaian', { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const pemantauanByEpisode = new Map<string, Record<string, unknown>[]>();
  for (const p of (pemantauanRes.data ?? []) as Record<string, unknown>[]) {
    const key = String(p.episode_id);
    const list = pemantauanByEpisode.get(key) ?? [];
    list.push(p);
    pemantauanByEpisode.set(key, list);
  }
  const rekomendasiByEpisode = new Map<string, Record<string, unknown>[]>();
  for (const r of (rekomendasiRes.data ?? []) as Record<string, unknown>[]) {
    const key = String(r.episode_id);
    const list = rekomendasiByEpisode.get(key) ?? [];
    list.push(r);
    rekomendasiByEpisode.set(key, list);
  }

  const sekarang = new Date();
  const data = rows.map((r) => {
    const id = String(r.id);
    const pemantauan = pemantauanByEpisode.get(id) ?? [];
    const rekomendasi = rekomendasiByEpisode.get(id) ?? [];
    const mulai = String(r.tanggal_mulai_sakit ?? '').slice(0, 10);
    const { hari, definisi } = mulai ? hitungFase(mulai, sekarang) : { hari: 0, definisi: null };

    const terakhir = pemantauan.length
      ? String(pemantauan[0].tanggal ?? '').slice(0, 10)
      : null;
    const jadwal = r.status === 'AKTIF' && mulai
      ? jadwalBerikutnya(mulai, terakhir, sekarang)
      : null;

    // Hari menuju jadwal; negatif = terlambat.
    let sisaHari: number | null = null;
    if (jadwal?.tanggal) {
      const target = new Date(`${jadwal.tanggal}T00:00:00`).getTime();
      const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate()).getTime();
      sisaHari = Math.round((target - hariIni) / HARI_MS);
    }

    // Kelengkapan rekam pemantauan: jarak antar-kontak tidak melebihi
    // interval fase (SOP/027 poin 6.5 huruf f: "tanpa jeda").
    const tanggalKontak = pemantauan
      .map((p) => String(p.tanggal ?? '').slice(0, 10))
      .filter(Boolean)
      .sort() as string[];
    let jedaTerpanjang = 0;
    for (let i = 1; i < tanggalKontak.length; i += 1) {
      const jarak = (new Date(`${tanggalKontak[i]}T00:00:00`).getTime()
        - new Date(`${tanggalKontak[i - 1]}T00:00:00`).getTime()) / HARI_MS;
      if (jarak > jedaTerpanjang) jedaTerpanjang = Math.round(jarak);
    }

    return {
      id,
      nik: r.nik_enc ? String(r.nik_enc) : null,
      nama: r.nama_enc ? String(r.nama_enc) : null,
      site: r.site ?? null,
      department: r.department ?? null,
      jabatan: r.jabatan ?? null,
      noWa: r.no_wa ?? null,
      tanggalMulaiSakit: mulai,
      tanggalSksPertama: r.tanggal_sks_pertama ?? null,
      diagnosisAwal: r.diagnosis_awal ?? null,
      dokterFaskes: r.dokter_faskes ?? null,
      sumberLaporan: r.sumber_laporan ?? null,
      jenisSakit: r.jenis_sakit ?? null,
      status: r.status ?? 'AKTIF',
      tanggalKembaliKerja: r.tanggal_kembali_kerja ?? null,
      catatan: r.catatan ?? null,

      // Fase pemantauan (dihitung, bukan disimpan)
      hariKe: hari,
      fase: definisi?.fase ?? null,
      faseLabel: definisi?.label ?? null,
      kewajiban: definisi?.kewajiban ?? [],

      jumlahPemantauan: pemantauan.length,
      kontakTerakhir: terakhir,
      jedaTerpanjang,
      jadwalBerikutnya: jadwal?.tanggal ?? null,
      jadwalAlasan: jadwal?.alasan ?? null,
      sisaHari,
      terlambat: sisaHari !== null && sisaHari < 0,

      rekomendasiTerakhir: rekomendasi[0] ?? null,
      jumlahRekomendasi: rekomendasi.length,
      syaratUnfit: periksaSyaratUnfit({
        jumlahRekomendasi: rekomendasi.length,
        tanggalRekomendasi: rekomendasi.map((x) => String(x.tanggal_penilaian ?? '')),
        statusRekomendasi: rekomendasi.map((x) => String(x.status_kelayakan ?? '')),
        jumlahPemantauan: pemantauan.length,
        faseTerkini: (definisi?.fase ?? 'AWAL') as never,
      }),
    };
  });

  const ringkasan = {
    total: data.length,
    aktif: data.filter((d) => d.status === 'AKTIF').length,
    terlambat: data.filter((d) => d.terlambat).length,
    berkepanjangan: data.filter((d) => d.hariKe > 92 && d.status === 'AKTIF').length,
    perFase: data.reduce<Record<string, number>>((acc, d) => {
      if (d.status !== 'AKTIF' || !d.fase) return acc;
      acc[d.faseLabel ?? d.fase] = (acc[d.faseLabel ?? d.fase] ?? 0) + 1;
      return acc;
    }, {}),
    perJenis: data.reduce<Record<string, number>>((acc, d) => {
      const k = String(d.jenisSakit ?? 'TIDAK_DICATAT');
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  };

  return NextResponse.json({
    success: true,
    data,
    ringkasan,
    total: data.length,
    tabelSiap: true,
    siteTerbatas: site,
  });
}

/** POST — buat episode baru atau memperbarui episode yang ada. */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Hanya QSHE Medic / PIC yang dapat mencatat karyawan sakit' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nik = String(body.nik ?? '').trim();
  const mulai = toDate(body.tanggalMulaiSakit);

  if (!nik) return NextResponse.json({ error: 'NIK karyawan wajib diisi' }, { status: 400 });
  if (!mulai) return NextResponse.json({ error: 'Tanggal mulai sakit wajib diisi (SOP/027 poin 6.6.1)' }, { status: 400 });

  const site = String(body.site ?? '').trim() || null;
  if (caller.role === 'pic' && caller.site && site
    && caller.site.toLowerCase() !== site.toLowerCase()) {
    return NextResponse.json({ error: 'PIC hanya dapat mencatat karyawan site sendiri' }, { status: 403 });
  }

  const nikHash = hashField(nik);
  if (!nikHash) return NextResponse.json({ error: 'NIK tidak valid' }, { status: 400 });

  const payload = {
    nik_hash: nikHash,
    nik_enc: encrypt(nik),
    nama_enc: body.nama ? encrypt(String(body.nama)) : null,
    site,
    department: body.department || null,
    jabatan: body.jabatan || null,
    no_wa: body.noWa || null,
    tanggal_mulai_sakit: mulai,
    tanggal_sks_pertama: toDate(body.tanggalSksPertama),
    diagnosis_awal: body.diagnosisAwal || null,
    dokter_faskes: body.dokterFaskes || null,
    sumber_laporan: body.sumberLaporan || null,
    jenis_sakit: body.jenisSakit || null,
    status: body.status || 'AKTIF',
    tanggal_selesai_sakit: toDate(body.tanggalSelesaiSakit),
    tanggal_kembali_kerja: toDate(body.tanggalKembaliKerja),
    catatan: body.catatan || null,
    updated_at: new Date().toISOString(),
  };

  const client = adminClient();
  let error;
  if (body.id) {
    ({ error } = await client.from('sakit_episode').update(payload).eq('id', String(body.id)));
  } else {
    ({ error } = await client.from('sakit_episode').insert({ ...payload, dibuat_oleh: caller.userId }));
  }

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({
        error: 'Tabel belum dibuat. Jalankan migration 20261028_karyawan_sakit.sql.',
      }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/** DELETE ?id=<uuid> — hapus satu episode beserta turunannya (cascade). */
export async function DELETE(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

  const { error } = await adminClient().from('sakit_episode').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
