import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { muatPesertaProKawan } from '@/lib/prokawan-peserta';
import { decrypt, isEncryptedValue } from '@/lib/encryption';
import {
  AMBANG,
  JENIS_META,
  perluMunculMcu,
  perluMunculProKawan,
  prioritasDariSisaHari,
  selisihHari,
  urutkanNotifikasi,
  type JenisNotifikasi,
  type Notifikasi,
  type RingkasanNotifikasi,
} from '@/lib/notifikasi-medic';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifikasi — notifikasi tindak lanjut untuk QSHE Medic.
 *
 * ON-DEMAND, BUKAN CRON. Dihitung saat dipanggil (mis. saat bell dibuka),
 * sehingga selalu akurat dan tidak bergantung pada proses latar belakang.
 *
 * CAKUPAN
 *  1. Kontrol ProKawan   — H-3, lalu H+1 / H+7, lalu tiap 30 hari bila terlambat
 *  2. MCU expired        — semua yang sudah lewat masa berlaku (kritis)
 *  3. MCU akan expired   — H-60 dan H-30
 *  4. Surat kelayakan    — H-14 sebelum FORM/123 habis masa berlaku
 *  5. PAK                — H-1 sebelum batas waktu dokumen
 *  6. Karyawan sakit     — jadwal pemantauan fase terlewat
 *
 * KERAHASIAAN: notifikasi hanya memuat NAMA + JENIS TINDAKAN.
 * Tidak ada diagnosis, nilai lab, atau skor kuesioner (INK/016 4.7.3e, UU 27/2022).
 *
 * Akses: QSHE Medic (superuser/administrator). PIC dibatasi site-nya.
 */
const ROLES = ['superuser', 'administrator', 'pic'];

/** Cache singkat: bell bisa diklik berkali-kali; hitung ulang tiap klik membebani DB. */
const CACHE_MS = 5 * 60 * 1000;
let cache: { key: string; data: RingkasanNotifikasi; at: number } | null = null;

/**
 * `nama` pada mcu_records tersimpan TERENKRIPSI — tanpa dekripsi, notifikasi
 * menampilkan hex panjang yang tidak berguna bagi QSHE Medic.
 */
function namaTerbaca(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  if (!isEncryptedValue(text)) return text;
  return decrypt(text) ?? text;
}

/**
 * Ambang "tanggal janggal" — TIDAK menyembunyikan apa pun.
 *
 * Semua tanggal expired ditampilkan apa adanya, berapa pun lamanya. Alasannya:
 * selisih ekstrem biasanya berarti SALAH INPUT TANGGAL, dan menyembunyikannya
 * justru membuat kesalahan itu tidak pernah diperbaiki.
 *
 * Yang dilakukan: notifikasi yang lewat lebih dari 365 hari diberi label
 * "cek tanggal" + prioritas kritis, agar QSHE Medic tahu ini bukan sekadar
 * keterlambatan biasa melainkan kandidat kesalahan data.
 */
const AMBANG_TANGGAL_JANGGAL = 365;

function formatTanggal(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const role = String(caller.role);
  const site = role === 'pic' ? caller.site ?? null : null;
  const cacheKey = `${role}|${site ?? '-'}`;
  const force = req.nextUrl.searchParams.get('refresh') === 'true';

  if (!force && cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json({ success: true, ...cache.data, dariCache: true });
  }

  const sekarang = new Date();
  const client = adminClient();
  const daftar: Notifikasi[] = [];

  /* ── 1. Kontrol ProKawan ───────────────────────────────────────────── */
  try {
    const peserta = await muatPesertaProKawan({ site });
    for (const p of peserta) {
      if (!p.jatuhTempo || p.sisaHari === null) continue;
      if (!perluMunculProKawan(p.sisaHari)) continue;

      const lewat = p.sisaHari < 0;
      daftar.push({
        id: `prokawan:${p.nikHash ?? p.nik}:${p.jatuhTempo}`,
        jenis: 'kontrol-prokawan',
        prioritas: prioritasDariSisaHari(p.sisaHari),
        judul: lewat
          ? `Kontrol ProKawan terlambat ${Math.abs(p.sisaHari)} hari`
          : p.sisaHari === 0
            ? 'Kontrol ProKawan hari ini'
            : `Kontrol ProKawan ${p.sisaHari} hari lagi`,
        // Hanya status administratif — tanpa parameter klinis.
        keterangan: `Jadwal ${formatTanggal(p.jatuhTempo)} · Zona ${p.zona} · ${p.site || 'site tidak tercatat'}`,
        subjek: p.nama,
        tanggal: p.jatuhTempo,
        sisaHari: p.sisaHari,
        tautan: JENIS_META['kontrol-prokawan'].tautanDefault,
        aksi: 'Hubungi peserta',
      });
    }
  } catch {
    // Data ProKawan gagal dimuat tidak boleh menggagalkan notifikasi lain.
  }

  /* ── 2 & 3. MCU expired / akan expired ─────────────────────────────── */
  try {
    const { data: mcu } = await client
      .from('mcu_records')
      .select('nik_karyawan,nama,site,tgl_expired,zonasi')
      .not('tgl_expired', 'is', null)
      .order('tgl_expired', { ascending: true })
      .limit(3000);

    // Satu baris per karyawan (expired terbaru).
    const terlihat = new Set<string>();
    for (const r of (mcu ?? []) as Record<string, unknown>[]) {
      const nik = String(r.nik_karyawan ?? '').trim();
      if (!nik || terlihat.has(nik)) continue;
      terlihat.add(nik);

      if (site && String(r.site ?? '').toLowerCase() !== site.toLowerCase()) continue;

      const sisa = selisihHari(String(r.tgl_expired ?? ''));
      if (sisa === null) continue;

      const expired = sisa < 0;
      // Expired: tampil terus (kritis). Akan expired: hanya H-60 & H-30.
      if (!expired && !perluMunculMcu(sisa)) continue;

      // Selisih ekstrem = kandidat salah input tanggal, bukan disembunyikan.
      const janggal = sisa < -AMBANG_TANGGAL_JANGGAL;

      daftar.push({
        id: `mcu:${nik}:${String(r.tgl_expired).slice(0, 10)}`,
        jenis: expired ? 'mcu-expired' : 'mcu-akan-expired',
        prioritas: expired ? 'kritis' : 'penting',
        judul: expired
          ? `MCU expired ${Math.abs(sisa)} hari lalu${janggal ? ' — cek tanggal' : ''}`
          : `MCU akan expired ${sisa} hari lagi`,
        keterangan: janggal
          ? `Masa berlaku sampai ${formatTanggal(String(r.tgl_expired))} — selisih tidak wajar, periksa kemungkinan salah input tanggal`
          : `Masa berlaku sampai ${formatTanggal(String(r.tgl_expired))}`,
        subjek: namaTerbaca(r.nama),
        tanggal: String(r.tgl_expired).slice(0, 10),
        sisaHari: sisa,
        tautan: JENIS_META[expired ? 'mcu-expired' : 'mcu-akan-expired'].tautanDefault,
        aksi: janggal ? 'Periksa tanggal MCU' : 'Jadwalkan MCU',
      });
    }
  } catch {
    // Abaikan — tabel/kolom mungkin belum ada.
  }

  /* ── 4. Surat kelayakan (FORM/123) akan habis ──────────────────────── */
  try {
    const { data: surat } = await client
      .from('sakit_rekomendasi')
      .select('id,episode_id,status_kelayakan,berlaku_sampai')
      .not('berlaku_sampai', 'is', null);

    const episodeIds = [...new Set((surat ?? []).map((s) => String(s.episode_id)))];
    const namaByEpisode = new Map<string, { nama: string; site: string | null }>();
    if (episodeIds.length) {
      const { data: eps } = await client
        .from('sakit_episode')
        .select('id,nama_enc,site')
        .in('id', episodeIds);
      for (const e of eps ?? []) {
        namaByEpisode.set(String(e.id), { nama: namaTerbaca(e.nama_enc), site: String(e.site ?? '') });
      }
    }

    for (const s of (surat ?? []) as Record<string, unknown>[]) {
      const sisa = selisihHari(String(s.berlaku_sampai ?? ''));
      if (sisa === null || sisa > AMBANG.suratKelayakanSebelum || sisa < 0) continue;

      const ep = namaByEpisode.get(String(s.episode_id));
      if (site && ep && String(ep.site ?? '').toLowerCase() !== site.toLowerCase()) continue;

      daftar.push({
        id: `surat:${String(s.id)}`,
        jenis: 'surat-kelayakan',
        prioritas: sisa <= 7 ? 'penting' : 'informasi',
        judul: `Surat kelayakan kerja habis dalam ${sisa} hari`,
        keterangan: `Status ${String(s.status_kelayakan ?? '—')} · berlaku sampai ${formatTanggal(String(s.berlaku_sampai))}`,
        subjek: ep?.nama ?? null,
        tanggal: String(s.berlaku_sampai).slice(0, 10),
        sisaHari: sisa,
        tautan: JENIS_META['surat-kelayakan'].tautanDefault,
        aksi: 'Penilaian ulang',
      });
    }
  } catch {
    // Tabel belum dibuat → lewati.
  }

  /* ── 5. PAK mendekati / melewati batas waktu ───────────────────────── */
  try {
    const { data: pak } = await client
      .from('pak_cases')
      .select('id,id_register,nama_enc,status,triase_batas,laporan_medis_batas,tahap1_batas,triase_tgl,laporan_medis_tgl,tahap1_selesai_tgl')
      .not('status', 'in', '("DITUTUP","BUKAN_PAK")');

    for (const p of (pak ?? []) as Record<string, unknown>[]) {
      const tahap: { nama: string; batas: string | null; selesai: boolean }[] = [
        { nama: 'Triase', batas: String(p.triase_batas ?? '').slice(0, 10) || null, selesai: Boolean(p.triase_tgl) },
        { nama: 'Laporan medis', batas: String(p.laporan_medis_batas ?? '').slice(0, 10) || null, selesai: Boolean(p.laporan_medis_tgl) },
        { nama: 'Laporan Tahap I', batas: String(p.tahap1_batas ?? '').slice(0, 10) || null, selesai: Boolean(p.tahap1_selesai_tgl) },
      ];

      for (const t of tahap) {
        if (t.selesai || !t.batas) continue;
        const sisa = selisihHari(t.batas);
        if (sisa === null) continue;
        // Muncul H-1 sampai terlambat — batas PAK sangat ketat (2×24 jam).
        if (sisa > AMBANG.pakSebelum) continue;

        daftar.push({
          id: `pak:${String(p.id)}:${t.nama}`,
          jenis: 'pak-batas-waktu',
          prioritas: sisa < 0 ? 'kritis' : 'penting',
          judul: sisa < 0
            ? `${t.nama} PAK terlambat ${Math.abs(sisa)} hari`
            : `${t.nama} PAK jatuh tempo ${sisa === 0 ? 'hari ini' : `${sisa} hari lagi`}`,
          keterangan: `Register ${String(p.id_register ?? '—')} · batas ${formatTanggal(t.batas)}`,
          subjek: namaTerbaca(p.nama_enc),
          tanggal: t.batas,
          sisaHari: sisa,
          tautan: JENIS_META['pak-batas-waktu'].tautanDefault,
          aksi: 'Buka Register PAK',
        });
      }
    }
  } catch {
    // Abaikan bila tabel belum ada.
  }

  /* ── 6. Jadwal pemantauan karyawan sakit terlewat ──────────────────── */
  try {
    const { data: episode } = await client
      .from('sakit_episode')
      .select('id,nama_enc,site,tanggal_mulai_sakit,status')
      .eq('status', 'AKTIF');

    const ids = (episode ?? []).map((e) => String(e.id));
    const kontakTerakhir = new Map<string, string>();
    if (ids.length) {
      const { data: pm } = await client
        .from('sakit_pemantauan')
        .select('episode_id,tanggal')
        .in('episode_id', ids)
        .order('tanggal', { ascending: false });
      for (const p of pm ?? []) {
        const key = String(p.episode_id);
        if (!kontakTerakhir.has(key)) kontakTerakhir.set(key, String(p.tanggal ?? ''));
      }
    }

    // Fase & jadwal dihitung modul karyawan-sakit.
    const { jadwalBerikutnya } = await import('@/lib/karyawan-sakit');

    for (const e of (episode ?? []) as Record<string, unknown>[]) {
      const id = String(e.id);
      if (site && String(e.site ?? '').toLowerCase() !== site.toLowerCase()) continue;

      const mulai = String(e.tanggal_mulai_sakit ?? '').slice(0, 10);
      if (!mulai) continue;

      const jadwal = jadwalBerikutnya(mulai, kontakTerakhir.get(id) ?? null, sekarang);
      if (!jadwal?.tanggal) continue;

      const sisa = selisihHari(jadwal.tanggal, sekarang);
      // Muncul mulai H-3 dan terus selama terlambat.
      if (sisa === null || sisa > 3) continue;

      daftar.push({
        id: `sakit:${id}:${jadwal.tanggal}`,
        jenis: 'karyawan-sakit',
        prioritas: sisa < 0 ? 'kritis' : 'penting',
        judul: sisa < 0
          ? `Jadwal pemantauan sakit terlambat ${Math.abs(sisa)} hari`
          : `Jadwal pemantauan sakit ${sisa === 0 ? 'hari ini' : `${sisa} hari lagi`}`,
        keterangan: jadwal.alasan,
        subjek: namaTerbaca(e.nama_enc),
        tanggal: jadwal.tanggal,
        sisaHari: sisa,
        tautan: JENIS_META['karyawan-sakit'].tautanDefault,
        aksi: 'Catat kontak',
      });
    }
  } catch {
    // Modul karyawan sakit belum dimigrasi → lewati.
  }

  // ── FILTER SESUAI ROLE ─────────────────────────────────────────────────
  // Notifikasi hanya boleh muncul bila pengguna memang dapat membuka halaman
  // tujuannya. Tanpa ini, PIC melihat notifikasi yang membawa ke halaman
  // admin yang kemudian menolak aksesnya — membingungkan dan membocorkan
  // informasi bahwa data itu ada.
  const bolehAkses: Record<JenisNotifikasi, boolean> = {
    'kontrol-prokawan': ['superuser', 'administrator', 'pic'].includes(role),
    'mcu-expired': ['superuser', 'administrator', 'pic'].includes(role),
    'mcu-akan-expired': ['superuser', 'administrator', 'pic'].includes(role),
    'surat-kelayakan': ['superuser', 'administrator'].includes(role),
    'pak-batas-waktu': ['superuser', 'administrator'].includes(role),
    'karyawan-sakit': ['superuser', 'administrator', 'pic'].includes(role),
  };

  const tersaring = daftar.filter((n) => bolehAkses[n.jenis]);
  tersaring.sort(urutkanNotifikasi);

  const ringkasan: RingkasanNotifikasi = {
    total: tersaring.length,
    kritis: tersaring.filter((n) => n.prioritas === 'kritis').length,
    penting: tersaring.filter((n) => n.prioritas === 'penting').length,
    informasi: tersaring.filter((n) => n.prioritas === 'informasi').length,
    daftar: tersaring.slice(0, 200),
    dihitungPada: new Date().toISOString(),
  };

  cache = { key: cacheKey, data: ringkasan, at: Date.now() };
  return NextResponse.json({ success: true, ...ringkasan, dariCache: false });
}
