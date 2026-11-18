import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  JENIS_META,
  hitungCakupan,
  periodeBulan,
  ringkasPica,
  ringkasProgram,
  selisihHari,
  tanggalISO,
  type BarisJadwal,
  type BarisPica,
} from '@/lib/inspeksi-program';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspeksi/dashboard — infografik program inspeksi.
 *
 * LIMIT (lima kelompok metrik):
 *  1. Eksekusi      — completion rate, on-time vs late, inspeksi terlewat
 *  2. Cakupan aset  — % aset terdaftar yang tersampling, blindspot 30–90 hari
 *  3. Kelaikan      — ambulans (ready/standby/breakdown), P3K, sanitasi,
 *                     ergonomi, kalibrasi (countdown H-60)
 *  4. PICA          — MTTR, overdue, per departemen, top 5 berulang
 *  5. Produktivitas — beban per petugas, reporting lead time
 *
 * Query: ?site=<site>&periode=YYYY-MM
 * Akses: superuser, administrator, manager, pic (site sendiri).
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

/** Batas peringatan sanitasi (skor 0–100). */
const AMBANG_SANITASI = 80;
/** Kalibrasi: kuning H-60, merah bila sudah lewat. */
const KALIBRASI_PERINGATAN_HARI = 60;
/** Blindspot: dianggap jarang terpapar bila > 30 hari. */
const BLINDSPOT_AMBANG_HARI = 30;

interface HasilKueri<T> { data: T[] | null; error: unknown }

/** Menjalankan select yang boleh gagal (tabel belum dibuat) tanpa menghentikan dashboard. */
async function ambil<T = Record<string, unknown>>(
  client: ReturnType<typeof adminClient>,
  tabel: string,
  kolom = '*',
  atur?: (q: any) => any,
): Promise<HasilKueri<T>> {
  try {
    let q: any = client.from(tabel).select(kolom);
    if (atur) q = atur(q);
    const { data, error } = await q;
    if (error) return { data: null, error };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const params = req.nextUrl.searchParams;
  const periode = params.get('periode')?.trim() || periodeBulan();
  const fokusSite = caller.role === 'pic' ? (caller.site ?? '') : (params.get('site')?.trim() || '');
  const sekarang = new Date();

  const saring = <T extends Record<string, unknown>>(rows: T[] | null) =>
    (rows ?? []).filter((r) => !fokusSite || String(r.site ?? '').toLowerCase() === fokusSite.toLowerCase());

  /* ── Ambil seluruh sumber data secara paralel ─────────────────────────── */
  const [
    jadwalRes, picaRes,
    p3kRes, ambulansRes, ambulansUnitRes, ergonomiRes,
    sanitasiRes, saranaRes,
  ] = await Promise.all([
    ambil(client, 'inspeksi_jadwal', '*', q => q.order('tanggal_rencana')),
    ambil(client, 'pica', '*'),
    ambil(client, 'p3k_site', '*,p3k_katalog(nama,kategori)'),
    ambil(client, 'ambulans_site', '*,ambulans_katalog(nama,kategori)'),
    ambil(client, 'ambulans_unit', '*'),
    ambil(client, 'ergonomi_sarana_site', '*,ergonomi_sarana_katalog(nama,kategori)'),
    ambil(client, 'sanitasi_inspeksi', 'id,site,tanggal,inspektur,ringkasan,catatan,created_at'),
    ambil(client, 'sarana_site', '*,sarana_katalog(nama,perlu_kalibrasi)'),
  ]);

  const jadwal = saring(jadwalRes.data as (BarisJadwal & Record<string, unknown>)[]);
  const pica = saring(picaRes.data as (BarisPica & Record<string, unknown>)[]);
  const p3k = saring(p3kRes.data);
  const ambulans = saring(ambulansRes.data);
  const ambulansUnit = saring(ambulansUnitRes.data as Record<string, unknown>[]);
  const ergonomi = saring(ergonomiRes.data);
  const sanitasi = saring(sanitasiRes.data as Record<string, unknown>[]);
  const sarana = saring(saranaRes.data as Record<string, unknown>[]);

  const tabelSiap = {
    jadwal: jadwalRes.error === null,
    pica: picaRes.error === null,
    p3k: p3kRes.error === null,
    ambulans: ambulansRes.error === null,
    ergonomi: ergonomiRes.error === null,
  };

  /* ── 1. EKSEKUSI ───────────────────────────────────────────────────────── */
  const jadwalPeriode = jadwal.filter(b => String(b.periode ?? '') === periode);
  const eksekusi = ringkasProgram(jadwalPeriode as BarisJadwal[], sekarang);

  // Tren 6 periode terakhir untuk grafik completion rate.
  const trenPeriode: { periode: string; target: number; selesai: number; persen: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 1);
    const p = periodeBulan(d);
    const rows = jadwal.filter(b => String(b.periode ?? '') === p);
    const r = ringkasProgram(rows as BarisJadwal[], sekarang);
    trenPeriode.push({ periode: p, target: r.target, selesai: r.selesai, persen: r.persenSelesai });
  }

  // Inspeksi terlewat per jenis (H+1 dst) — dihitung dari SEMUA periode,
  // bukan hanya periode berjalan: jadwal bulan lalu yang belum dikerjakan
  // tetap terlewat sampai diselesaikan.
  const terlewatSemua = jadwal.filter(b => {
    const selesai = Boolean(b.tanggal_selesai) || String(b.status ?? '') === 'selesai';
    if (selesai || String(b.status ?? '') === 'dibatalkan') return false;
    const sisa = selisihHari(b.tanggal_rencana, sekarang);
    return sisa !== null && sisa < 0;
  });
  const terlewatPerJenis = Object.keys(JENIS_META).map(jenis => {
    const rows = terlewatSemua.filter(b => b.jenis === jenis);
    return { jenis, label: JENIS_META[jenis as keyof typeof JENIS_META].label, jumlah: rows.length };
  }).filter(x => x.jumlah > 0);

  const daftarTerlewat = terlewatSemua
    .map(b => ({
      id: b.id,
      jenis: b.jenis,
      label: JENIS_META[b.jenis as keyof typeof JENIS_META]?.label ?? b.jenis,
      site: b.site,
      objek: b.objek_nama,
      tanggal_rencana: b.tanggal_rencana,
      hariTerlambat: Math.abs(selisihHari(b.tanggal_rencana, sekarang) ?? 0),
      petugas: b.petugas,
    }))
    .sort((a, b) => b.hariTerlambat - a.hariTerlambat)
    .slice(0, 50);

  /* ── 2. CAKUPAN ASET & BLINDSPOT ───────────────────────────────────────── */
  // Aset terdaftar = objek yang punya jadwal pada periode ini.
  const objekPeriode = new Set(jadwalPeriode.map(b => `${b.jenis}|${b.objek_id ?? ''}`));
  const objekTersampling = new Set(
    jadwalPeriode
      .filter(b => Boolean(b.tanggal_selesai) || String(b.status ?? '') === 'selesai')
      .map(b => `${b.jenis}|${b.objek_id ?? ''}`),
  );
  const cakupan = hitungCakupan(objekPeriode.size, objekTersampling.size);

  // Blindspot: per jenis+site, berapa hari sejak inspeksi terakhir selesai.
  const kunciSiteJenis = new Map<string, { jumlah: number; terakhir: string | null }>();
  for (const b of jadwalPeriode) {
    const k = `${b.jenis}|${b.site ?? ''}`;
    const isi = kunciSiteJenis.get(k) ?? { jumlah: 0, terakhir: null };
    isi.jumlah += 1;
    if (b.tanggal_selesai) {
      const t = String(b.tanggal_selesai).slice(0, 10);
      if (!isi.terakhir || t > isi.terakhir) isi.terakhir = t;
    }
    kunciSiteJenis.set(k, isi);
  }
  const blindspot = [...kunciSiteJenis.entries()]
    .map(([k, v]) => {
      const [jenis, site] = k.split('|');
      const lewat = selisihHari(v.terakhir, sekarang);
      return {
        site: site || '—',
        jenis,
        label: JENIS_META[jenis as keyof typeof JENIS_META]?.label ?? jenis,
        hariTerakhir: v.terakhir ? Math.abs(lewat ?? 0) : null,
        terakhir: v.terakhir,
        jumlahObjek: v.jumlah,
      };
    })
    .filter(b => b.hariTerakhir === null || b.hariTerakhir >= BLINDSPOT_AMBANG_HARI)
    .sort((a, b) => {
      if (a.hariTerakhir === null && b.hariTerakhir !== null) return -1;
      if (b.hariTerakhir === null && a.hariTerakhir !== null) return 1;
      return (b.hariTerakhir ?? 0) - (a.hariTerakhir ?? 0);
    })
    .slice(0, 15);

  /* ── 3. KELAIKAN FISIK ─────────────────────────────────────────────────── */
  const hitungStatus = (rows: Record<string, unknown>[], status: string) =>
    rows.filter(r => String(r.status ?? '') === status).length;

  const p3kRingkas = {
    total: p3k.length,
    ada: hitungStatus(p3k, 'ada'),
    rusak: hitungStatus(p3k, 'rusak'),
    tidakAda: hitungStatus(p3k, 'tidak_ada'),
  };
  const p3kPersenSiap = p3kRingkas.total
    ? Math.round((p3kRingkas.ada / p3kRingkas.total) * 1000) / 10
    : 0;

  // Item P3K yang paling banyak kedaluwarsa / hilang, per departemen (site).
  const p3kKedaluwarsa = p3k
    .filter(r => {
      const tgl = r.tanggal_expired ? String(r.tanggal_expired).slice(0, 10) : '';
      if (!tgl) return false;
      const sisa = selisihHari(tgl, sekarang);
      return sisa !== null && sisa <= 30;
    })
    .map(r => ({
      nama: String((r as any).p3k_katalog?.nama ?? '—'),
      site: String(r.site ?? '—'),
      tanggal: String(r.tanggal_expired).slice(0, 10),
      sisaHari: selisihHari(String(r.tanggal_expired), sekarang),
    }))
    .sort((a, b) => (a.sisaHari ?? 0) - (b.sisaHari ?? 0))
    .slice(0, 15);
  const p3kHilang = p3k
    .filter(r => String(r.status ?? '') === 'tidak_ada')
    .map(r => ({
      nama: String((r as any).p3k_katalog?.nama ?? '—'),
      site: String(r.site ?? '—'),
      lokasi: String((r as Record<string, unknown>).lokasi ?? '—'),
    }))
    .slice(0, 15);

  // Ambulans: status kesiapan per unit.
  const unitStatus = ambulansUnit.map(u => String(u.status_kesiapan ?? 'standby').toLowerCase());
  const ambulansRingkas = {
    totalUnit: ambulansUnit.length,
    ready: unitStatus.filter(s => s === 'ready').length,
    standby: unitStatus.filter(s => s === 'standby').length,
    breakdown: unitStatus.filter(s => s === 'breakdown').length,
    itemTotal: ambulans.length,
    itemAda: hitungStatus(ambulans, 'ada'),
    itemRusak: hitungStatus(ambulans, 'rusak'),
  };

  // Sanitasi: skor 0–100 per site = persenSesuai dari ringkasan inspeksi.
  // Modul sanitasi menyimpan hasil checklist pada kolom JSON `ringkasan`,
  // sehingga skor dibaca dari sana — bukan dari kolom yang tidak ada.
  const sanitasiSkor = sanitasi
    .map(r => {
      const ringkasan = (r.ringkasan ?? {}) as Record<string, unknown>;
      const skor = Number(ringkasan.persenSesuai ?? NaN);
      return {
        site: String(r.site ?? '—'),
        tanggal: String(r.tanggal ?? r.created_at ?? '').slice(0, 10),
        skor: Number.isFinite(skor) ? Math.round(skor * 10) / 10 : null,
      };
    })
    .filter(s => s.skor !== null)
    .sort((a, b) => (b.tanggal > a.tanggal ? 1 : -1));
  // Ambil skor terbaru per site.
  const sanitasiTerbaru = new Map<string, { site: string; tanggal: string; skor: number }>();
  for (const s of sanitasiSkor) {
    if (!sanitasiTerbaru.has(s.site)) sanitasiTerbaru.set(s.site, s as { site: string; tanggal: string; skor: number });
  }
  const sanitasiRingkas = {
    jumlahArea: sanitasiTerbaru.size,
    diBawahStandar: [...sanitasiTerbaru.values()].filter(s => (s.skor ?? 0) < AMBANG_SANITASI).length,
    rataRata: sanitasiTerbaru.size
      ? Math.round(
        ([...sanitasiTerbaru.values()].reduce((a, s) => a + (s.skor ?? 0), 0) / sanitasiTerbaru.size) * 10,
      ) / 10
      : null,
    area: [...sanitasiTerbaru.values()].sort((a, b) => (a.skor ?? 0) - (b.skor ?? 0)),
  };

  // Ergonomi: layak vs rusak.
  const ergoTotal = ergonomi.reduce((a, r) => a + Number(r.jumlah ?? 0), 0);
  const ergoLayak = ergonomi.reduce((a, r) => a + Number(r.layak ?? 0), 0);
  const ergoRusak = ergonomi.reduce((a, r) => a + Number(r.rusak ?? 0), 0);
  const ergonomiRingkas = {
    total: ergoTotal,
    layak: ergoLayak,
    rusak: ergoRusak,
    persenLayak: ergoTotal ? Math.round((ergoLayak / ergoTotal) * 1000) / 10 : 0,
    perItem: ergonomi.map(r => ({
      nama: String((r as any).ergonomi_sarana_katalog?.nama ?? '—'),
      rusak: Number(r.rusak ?? 0),
      layak: Number(r.layak ?? 0),
    })).filter(x => x.rusak > 0 || x.layak > 0).slice(0, 10),
  };

  // Kalibrasi: countdown H-60 (kuning) & overdue (merah) untuk alat yang perlu
  // kalibrasi. `perlu_kalibrasi` ada di KATALOG, bukan di baris per site,
  // sehingga katalog di-join agar keputusannya benar.
  const kalibrasi: { nama: string; site: string; tanggal: string | null; sisaHari: number | null; status: 'patuh' | 'kuning' | 'merah' | 'belum' }[] = [];
  for (const r of sarana) {
    const katalog = ((r as Record<string, unknown>).sarana_katalog ?? {}) as Record<string, unknown>;
    const perlu = Boolean((r as Record<string, unknown>).perlu_kalibrasi ?? katalog.perlu_kalibrasi);
    if (!perlu) continue;
    const namaAlat = String(katalog.nama ?? (r as Record<string, unknown>).katalog_id ?? '—');
    const tgl = (r as Record<string, unknown>).tanggal_kalibrasi
      ? String((r as Record<string, unknown>).tanggal_kalibrasi).slice(0, 10)
      : null;
    if (!tgl) {
      kalibrasi.push({ nama: namaAlat, site: String(r.site ?? '—'), tanggal: null, sisaHari: null, status: 'belum' });
      continue;
    }
    // Masa berlaku 12 bulan; sisa hari sampai jatuh tempo.
    const jatuhTempo = new Date(`${tgl}T00:00:00`);
    jatuhTempo.setFullYear(jatuhTempo.getFullYear() + 1);
    const sisa = selisihHari(tanggalISO(jatuhTempo), sekarang);
    kalibrasi.push({
      nama: namaAlat,
      site: String(r.site ?? '—'),
      tanggal: tanggalISO(jatuhTempo),
      sisaHari: sisa,
      status: sisa === null ? 'belum' : sisa < 0 ? 'merah' : sisa <= KALIBRASI_PERINGATAN_HARI ? 'kuning' : 'patuh',
    });
  }
  const kalibrasiRingkas = {
    total: kalibrasi.length,
    patuh: kalibrasi.filter(k => k.status === 'patuh').length,
    kuning: kalibrasi.filter(k => k.status === 'kuning').length,
    merah: kalibrasi.filter(k => k.status === 'merah').length,
    belum: kalibrasi.filter(k => k.status === 'belum').length,
    peringatanHari: KALIBRASI_PERINGATAN_HARI,
    jatuhTempo: kalibrasi
      .filter(k => k.status === 'kuning' || k.status === 'merah')
      .sort((a, b) => (a.sisaHari ?? 9999) - (b.sisaHari ?? 9999))
      .slice(0, 20),
  };

  // Sarana & Prasarana Klinik: status ketersediaan fasilitas klinik
  const klinikTotal = sarana.filter(s => String(s.status ?? '') !== 'tidak_diperlukan').length;
  const klinikAda = sarana.filter(s => String(s.status ?? '') === 'ada').length;
  const klinikRusak = sarana.filter(s => String(s.status ?? '') === 'rusak').length;
  const klinikTidakAda = sarana.filter(s => String(s.status ?? '') === 'tidak_ada').length;
  const klinikRingkas = {
    total: klinikTotal,
    ada: klinikAda,
    rusak: klinikRusak,
    tidakAda: klinikTidakAda,
    persen: klinikTotal ? Math.round((klinikAda / klinikTotal) * 1000) / 10 : 0,
  };

  /* ── 4. PICA ───────────────────────────────────────────────────────────── */
  const picaRingkas = ringkasPica(pica as BarisPica[], sekarang);

  /* ── 5. PRODUKTIVITAS PETUGAS ──────────────────────────────────────────── */
  // `petugas` berisi user id; nama diambil dari user_profiles agar grafik
  // menampilkan orang, bukan UUID. Bila lookup gagal, id dipakai apa adanya.
  const idPetugas = [...new Set(jadwalPeriode.map(b => String(b.petugas ?? '').trim()).filter(Boolean))];
  const namaById = new Map<string, string>();
  if (idPetugas.length) {
    const { data: profil } = await client
      .from('user_profiles')
      .select('user_id,username,full_name')
      .in('user_id', idPetugas);
    for (const pr of profil ?? []) {
      const nama = String(pr.full_name ?? '').trim() || String(pr.username ?? '').trim();
      if (nama) namaById.set(String(pr.user_id), nama);
    }
  }

  const perPetugas = new Map<string, { selesai: number; tepat: number; terlambat: number; terlewat: number }>();
  const namaPetugas = (b: BarisJadwal) => {
    const id = (b.petugas ?? '').trim();
    if (!id) return 'Belum tercatat';
    return namaById.get(id) ?? id;
  };
  for (const b of jadwalPeriode) {
    const nama = namaPetugas(b);
    const isi = perPetugas.get(nama) ?? { selesai: 0, tepat: 0, terlambat: 0, terlewat: 0 };
    if (b.tanggal_selesai) {
      isi.selesai += 1;
      if (String(b.tanggal_selesai).slice(0, 10) <= String(b.tanggal_rencana ?? '').slice(0, 10)) isi.tepat += 1;
      else isi.terlambat += 1;
    } else {
      const sisa = selisihHari(b.tanggal_rencana, sekarang);
      if (sisa !== null && sisa < 0) isi.terlewat += 1;
    }
    perPetugas.set(nama, isi);
  }
  const produktivitas = [...perPetugas.entries()]
    .map(([petugas, v]) => ({ petugas, ...v }))
    .sort((a, b) => b.selesai - a.selesai);

  // Reporting lead time = waktu_verifikasi − waktu_lapor (hari), hanya yang terisi.
  const leadTime = jadwalPeriode
    .map(b => {
      const lapor = b.waktu_lapor ? new Date(String(b.waktu_lapor)).getTime() : NaN;
      const verif = b.waktu_verifikasi ? new Date(String(b.waktu_verifikasi)).getTime() : NaN;
      if (!Number.isFinite(lapor) || !Number.isFinite(verif) || verif < lapor) return null;
      return (verif - lapor) / 86_400_000;
    })
    .filter((d): d is number => d !== null);
  const leadTimeRingkas = {
    jumlah: leadTime.length,
    rataHari: leadTime.length
      ? Math.round((leadTime.reduce((a, b) => a + b, 0) / leadTime.length) * 10) / 10
      : null,
  };

  /* ── Keluaran ──────────────────────────────────────────────────────────── */
  return NextResponse.json({
    success: true,
    periode,
    site: fokusSite || null,
    tabelSiap,
    catatan: !tabelSiap.jadwal || !tabelSiap.pica
      ? 'Sebagian tabel belum dibuat. Jalankan database/inspeksi_program.sql di SQL Editor Supabase.'
      : null,
    eksekusi: {
      ...eksekusi,
      // Daftar terlewat untuk tabel rincian (bukan objek BarisJadwal utuh).
      daftarTerlewat,
      terlewatPerJenis,
      tren: trenPeriode,
    },
    cakupan: { ...cakupan, blindspot, ambangHari: BLINDSPOT_AMBANG_HARI },
    kelaikan: {
      ambulans: ambulansRingkas,
      p3k: { ...p3kRingkas, persenSiap: p3kPersenSiap, kedaluwarsa: p3kKedaluwarsa, hilang: p3kHilang },
      klinik: klinikRingkas,
      sanitasi: { ...sanitasiRingkas, ambang: AMBANG_SANITASI },
      ergonomi: ergonomiRingkas,
      kalibrasi: kalibrasiRingkas,
    },
    pica: picaRingkas,
    produktivitas: { perPetugas: produktivitas, leadTime: leadTimeRingkas },
  });
}
