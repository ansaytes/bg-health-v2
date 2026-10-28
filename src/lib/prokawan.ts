// ============================================================
// ProKawan — Program Kesehatan Karyawan
// ============================================================
//
// Dasar: BG/QSHE/INK/016 Rev.000, dengan kriteria zona dari
// BG/QSHE/STD/006 Rev.002.
//
// ATURAN UTAMA (jangan diubah tanpa membaca dokumennya):
//
// 1. KEPESERTAAN bersifat SEMATA-MATA berdasarkan Zona Risiko PTM:
//    Zona Kuning dan/atau Zona Merah ⇒ peserta ProKawan, tanpa memandang
//    parameter penyebabnya (INK 016 poin 4.1.1).
//    Framingham Risk Score (FRS) TIDAK menambah maupun mengurangi kepesertaan
//    (INK 016 poin 4.1.2). Karyawan Zona Hijau dengan risiko kardiovaskular
//    sedang/tinggi masuk "Program Preventif Terarah", BUKAN ProKawan.
//
// 2. JALUR PENGENDALIAN ditentukan per parameter dari kolom "Pengendalian"
//    STD/006, bukan dari zona. Bila ada >1 parameter, berlaku jalur dan
//    frekuensi yang PALING KETAT (INK 016 poin 4.2.5).
//
// 3. FREKUENSI: ProKawan tidak boleh menetapkan frekuensi yang lebih longgar
//    dari STD/006. Frekuensi lebih ketat boleh atas rekomendasi dokter.
//
// 4. KERAHASIAAN (INK 016 poin 4.7): atasan dan personel HCGS di luar tim EAP
//    hanya menerima status kelayakan kerja dan pembatasan kerja — tanpa skor
//    maupun diagnosis. Karena itu dashboard ini TIDAK menampilkan diagnosis.

import { aturanDariLabel } from '@/lib/ptm-pengendalian';

export type JalurProKawan =
  | 'kontrol-dokter'
  | 'pemantauan-paramedis'
  | 'evaluasi-alat-bantu'
  | 'konseling-eap';

export const JALUR_LABEL: Record<JalurProKawan, string> = {
  'kontrol-dokter': 'Kontrol Dokter',
  'pemantauan-paramedis': 'Pemantauan Paramedis',
  'evaluasi-alat-bantu': 'Evaluasi Alat Bantu',
  'konseling-eap': 'Konseling EAP',
};

export const JALUR_DESKRIPSI: Record<JalurProKawan, string> = {
  'kontrol-dokter': 'Kontrol di Fasilitas Kesehatan Rekanan (Zona Merah: dokter spesialis).',
  'pemantauan-paramedis': 'Pemantauan & edukasi gaya hidup oleh Paramedic Site / QSHE Medic. Kontrol dokter hanya bila memburuk.',
  'evaluasi-alat-bantu': 'Evaluasi/penyesuaian kacamata atau APD pelindung telinga di Fasilitas Kesehatan Rekanan.',
  'konseling-eap': 'Konseling psikolog EAP atas persetujuan karyawan, setelah penilaian awal QSHE Medic ≤2 minggu.',
};

/** Status kepatuhan yang dilacak Paramedic Site (INK 016 poin 3.2.3). */
export type StatusKepatuhan = 'sesuai-jadwal' | 'akan-datang' | 'terlambat' | 'belum-kontrol' | 'selesai';

export const STATUS_LABEL: Record<StatusKepatuhan, string> = {
  'sesuai-jadwal': 'Sesuai Jadwal',
  'akan-datang': 'Akan Datang',
  terlambat: 'Terlambat',
  'belum-kontrol': 'Belum Kontrol',
  selesai: 'Selesai / Stabil',
};

export const STATUS_WARNA: Record<StatusKepatuhan, string> = {
  'sesuai-jadwal': '#00B894',
  'akan-datang': '#3498DB',
  terlambat: '#FF7A00',
  'belum-kontrol': '#FF2D2D',
  selesai: '#778899',
};

// ────────────────────────────────────────────────────────────
// Jalur & frekuensi per parameter (STD/006 Rev.002 Bab 7)
// ────────────────────────────────────────────────────────────



/**
 * Jalur ProKawan ditentukan dari BARIS pengendalian Bab 7 (ptm-pengendalian.ts),
 * bukan dari zona. Tabel di bawah hanya memetakan baris tersebut ke jenis jalur
 * ProKawan; frekuensi bulannya TIDAK ditulis ulang di sini agar tidak ada dua
 * sumber angka yang bisa menyimpang.
 *
 * Urutan penting: paling spesifik di atas.
 */
const ATURAN_JALUR: { match: RegExp; jalur: JalurProKawan }[] = [
  // Konseling EAP — terduga gangguan mental (Bab 7: penilaian QSHE Medic ≤2
  // minggu + EAP; bukan kontrol dokter spesialis berkala).
  { match: /Terduga Gangguan Mental|Mental Disorder|SRQ-20|mental emosional/i, jalur: 'konseling-eap' },
  // Evaluasi alat bantu — gangguan penglihatan/pendengaran ringan.
  { match: /Visual Impairment|Pendengaran Ringan|Hearing.*Ringan|tuli ringan/i, jalur: 'evaluasi-alat-bantu' },
  // Pemantauan paramedis — Bab 7: "Tidak diwajibkan kontrol dokter berkala".
  { match: /Overweight|Obesity|Obesitas|Hiperurisemia|Uric|IMT/i, jalur: 'pemantauan-paramedis' },
  // Selebihnya figure kontrol dokter (spesialis untuk Zona Merah).
  { match: /./, jalur: 'kontrol-dokter' },
];

export interface RencanaPengendalian {
  jalur: JalurProKawan;
  /** Bulan sampai kontrol berikutnya; null bila tidak diwajibkan. */
  bulan: number | null;
  /** Trigger yang menentukan jalur ini (yang paling ketat). */
  pemicu: string[];
}

/**
 * Menentukan jalur & frekuensi dari daftar trigger zonasi.
 *
 * Prinsip "risiko tertinggi" (STD/006 poin 6.1.2 & 6.2.2): bila beberapa
 * parameter menghasilkan frekuensi berbeda, yang dipakai adalah yang PALING
 * KETAT (angka bulan terkecil).
 */
export function rencanaDariTriggers(triggers: string[], zona?: 'Kuning' | 'Merah'): RencanaPengendalian {
  if (!triggers.length) {
    // Parameter pemicu tidak tercatat (record MCU lama / impor tanpa kolom
    // trigger_zona). Frekuensi TIDAK dikarang dari nol: dipakai frekuensi
    // dasar zona menurut STD/006 — Merah 1 bulan, Kuning 3 bulan — sehingga
    // jadwal kontrol tetap bisa dihitung dan dipantau.
    return { jalur: 'kontrol-dokter', bulan: zona === 'Merah' ? 1 : zona === 'Kuning' ? 3 : null, pemicu: [] };
  }

  let terpilih: { aturan: (typeof ATURAN_JALUR)[number]; bulan: number | null; trigger: string } | null = null;

  for (const trigger of triggers) {
    const aturan = ATURAN_JALUR.find((a) => a.match.test(trigger)) ?? ATURAN_JALUR[ATURAN_JALUR.length - 1];
    // Frekuensi diambil dari BARIS Bab 7 untuk parameter ini — satu sumber angka.
    const bulan = aturanDariLabel(trigger)?.bulan ?? null;
    if (!terpilih) {
      terpilih = { aturan, bulan, trigger };
      continue;
    }
    // null = tidak wajib kontrol → dianggap paling longgar.
    const lebihKetat = bulan !== null && (terpilih.bulan === null || bulan < terpilih.bulan);
    if (lebihKetat) terpilih = { aturan, bulan, trigger };
  }

  return {
    jalur: terpilih!.aturan.jalur,
    bulan: terpilih!.bulan,
    pemicu: triggers.filter((t) =>
      (ATURAN_JALUR.find((a) => a.match.test(t)) ?? ATURAN_JALUR[ATURAN_JALUR.length - 1]).jalur
      === terpilih!.aturan.jalur),
  };
}

// ────────────────────────────────────────────────────────────
// Kepatuhan & jadwal
// ────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function tambahBulan(tanggal: string | null, bulan: number | null): string | null {
  const d = parseDate(tanggal);
  if (!d || bulan === null) return null;
  const next = new Date(d);
  next.setMonth(next.getMonth() + bulan);
  return next.toISOString().slice(0, 10);
}

export function selisihHari(target: string | null, sekarang: Date = new Date()): number | null {
  const d = parseDate(target);
  if (!d) return null;
  const today = new Date(sekarang);
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / DAY_MS);
}

/**
 * Status kepatuhan.
 *
 * Batas "akan datang" 14 hari dipilih agar Paramedic Site punya waktu
 * mengingatkan sebelum jatuh tempo — kebijakan operasional, bukan angka dari
 * dokumen.
 *
 * PENTING: tanpa jatuh tempo BUKAN berarti patuh. Sebelumnya fungsi ini
 * mengembalikan 'sesuai-jadwal' ketika tanggal kosong, sehingga 337 peserta
 * tanpa tanggal MCU terhitung PATUH dan tingkat kepatuhan terlihat 100%
 * padahal mereka belum pernah dijadwalkan. Sekarang statusnya 'belum-kontrol'
 * supaya masalahnya terlihat dan bisa ditindaklanjuti.
 */
export function statusKepatuhan(jatuhTempo: string | null, sekarang: Date = new Date()): StatusKepatuhan {
  const hari = selisihHari(jatuhTempo, sekarang);
  if (hari === null) return 'belum-kontrol';
  if (hari < 0) return 'terlambat';
  if (hari <= 14) return 'akan-datang';
  return 'sesuai-jadwal';
}

// ────────────────────────────────────────────────────────────
// Ringkasan agregat
// ────────────────────────────────────────────────────────────

export interface PesertaProKawan {
  nama: string;
  nik: string;
  /** SHA-256 NIK — dipakai untuk mengaitkan data kunjungan kontrol & WA. */
  nikHash?: string | null;
  site: string;
  area: string | null;
  department: string | null;
  /** Nomor WhatsApp peserta bila tersedia di tabel employees. */
  noWa?: string | null;
  zona: 'Kuning' | 'Merah';
  triggers: string[];
  /** Teks pengendalian per parameter dari kolom engine STD/006 (bukan general). */
  pengendalian: string | null;
  jalur: JalurProKawan;
  bulan: number | null;
  jatuhTempo: string | null;
  /** Selisih hari menuju jatuh tempo; negatif = sudah lewat. */
  sisaHari?: number | null;
  status: StatusKepatuhan;
  /** Hanya status, TANPA diagnosis (INK 016 poin 4.7.3 huruf e). */
  kelayakanKerja: string | null;
}

/**
 * Detail pemantauan kunjungan kontrol satu peserta — diisi Paramedic Site /
 * QSHE Medic saat peserta kembali dari kontrol (bukti dokter / hasil lab).
 */
export interface KunjunganKontrol {
  id: string;
  nik: string;
  /** Tanggal kontrol yang dijadwalkan (jatuhTempo). */
  jadwalTanggal: string | null;
  /** Tanggal aktual peserta benar-benar diperiksa. */
  aktualTanggal: string | null;
  /** Link/link dokumen evidence: surat kontrol, hasil lab, resume dokter. */
  evidenceUrl: string | null;
  /** Catatan singkat dokter pemeriksa / paramedic. */
  catatan: string | null;
  /** Kesimpulan kunjungan: Membaik / Stabil / Memburuk / Belum diketahui. */
  hasil: 'MEMBAIK' | 'STABIL' | 'MEMBURUK' | 'BELUM' | null;
}

export function ringkasProKawan(peserta: PesertaProKawan[]) {
  const total = peserta.length;
  const byZona = { Kuning: 0, Merah: 0 };
  const byJalur: Record<JalurProKawan, number> = {
    'kontrol-dokter': 0, 'pemantauan-paramedis': 0, 'evaluasi-alat-bantu': 0, 'konseling-eap': 0,
  };
  const byStatus: Record<StatusKepatuhan, number> = {
    'sesuai-jadwal': 0, 'akan-datang': 0, terlambat: 0, 'belum-kontrol': 0, selesai: 0,
  };
  const bySite = new Map<string, number>();

  for (const p of peserta) {
    byZona[p.zona] += 1;
    byJalur[p.jalur] += 1;
    byStatus[p.status] += 1;
    const site = p.site || 'Tidak tercatat';
    bySite.set(site, (bySite.get(site) || 0) + 1);
  }

  const patuh = byStatus['sesuai-jadwal'] + byStatus['akan-datang'] + byStatus.selesai;
  const tingkatKepatuhan = total ? (patuh / total) * 100 : 0;

  return {
    total,
    byZona,
    byJalur,
    byStatus,
    bySite: [...bySite.entries()].sort((a, b) => b[1] - a[1]),
    tingkatKepatuhan,
    /** Peserta yang lewat jatuh tempo — daftar tindak lanjut Paramedic Site. */
    perluTindakLanjut: peserta.filter((p) => p.status === 'terlambat'),
  };
}

/** Bulan yang harus dimiliki seorang peserta: zona Merah 1 bln, Kuning 3/6 bln. */
export function frekuensiLabel(bulan: number | null): string {
  if (bulan === null) return 'Tanpa kontrol berkala';
  return `Setiap ${bulan} bulan`;
}

// ────────────────────────────────────────────────────────────
// Pelaporan agregat ProKawan
// ────────────────────────────────────────────────────────────
//
// DASAR DOKUMEN
//  • INK/016 poin 4.6.4: "QSHE Medic menyampaikan rekapitulasi pelaksanaan
//    ProKawan secara AGREGAT, TANPA IDENTITAS KARYAWAN, kepada QSHE Manager
//    secara berkala sebagai bagian dari pelaporan zonasi sesuai BG/QSHE/STD/006."
//  • INK/016 poin 4.7.3 huruf (e): "atasan dan personel Departemen HCGS di luar
//    tim EAP hanya menerima status kelayakan kerja dan pembatasan kerja, tanpa
//    skor maupun diagnosis."
//  • STD/006 poin 7.2.1: rekapitulasi jumlah karyawan per zona dilaporkan
//    berkala kepada manajemen, dalam bentuk agregat.
//  • UU 27/2022 tentang Pelindungan Data Pribadi: data kesehatan bersifat
//    spesifik; identitas + status kesehatan tidak boleh dipublikasikan di
//    dashboard.
//
// Karena itu dashboard ProKawan TIDAK menampilkan nama, NIK, nomor WhatsApp,
// atau diagnosa. Yang ditampilkan hanya agregat. Daftar per-orang beserta
// tombol pengingat WA tetap berada di Administrator > ProKawan (akses QSHE).

export interface RingkasanAgregatProKawan {
  total: number;
  byZona: Record<'Kuning' | 'Merah', number>;
  /** Sebaran per jalur pengendalian (INK/016 poin 4.2). */
  byJalur: Record<JalurProKawan, number>;
  /** Sebaran status kepatuhan. */
  byStatus: Record<StatusKepatuhan, number>;
  /** Jumlah peserta per site, terurut menurun. */
  bySite: [string, number][];
  /** Jumlah peserta per frekuensi kontrol (bulan); `null` = tanpa kontrol berkala. */
  byFrekuensi: [string, number][];
  /** Jumlah peserta per parameter pemicu (dari trigger_zona). */
  byParameter: [string, number][];
  /** Jumlah peserta per status kelayakan kerja (Fit / Fit With Note / Currently Unfit). */
  byKelayakan: [string, number][];
  /** Persentase peserta yang patuh (sesuai jadwal + akan datang + selesai). */
  tingkatKepatuhan: number;
  /** Persentase peserta yang terlambat dari total. */
  tingkatTerlambat: number;
  /** Peserta yang lewat jatuh tempo — HANYA jumlah, tanpa identitas. */
  jumlahPerluTindakLanjut: number;
  /** Peserta yang belum memiliki jadwal kontrol (data MCU belum lengkap). */
  jumlahBelumTerjadwal: number;
  /**
   * Sebaran umur jatuh tempo (hari): lewat >30, lewat 1–30, jatuh tempo
   * 0–30 hari, dan >30 hari. Dipakai kartu "Status Jadwal Kontrol".
   */
  byUmurJadwal: {
    lewatBerat: number;
    lewatRingan: number;
    segera: number;
    jauh: number;
    tanpaJadwal: number;
  };
  /** Sebaran per jalur pengendalian, sudah dalam persen (1 desimal). */
  persenJalur: Record<JalurProKawan, number>;
  /** Peserta Zona Merah yang sudah lewat jatuh tempo — prioritas pemeriksaan. */
  merahTerlambat: number;
}

/**
 * Meringkas peserta menjadi angka-angka siap lapor.
 *
 * Semua keluaran berupa hitungan agregat. Tidak ada nama, NIK, nomor telepon,
 * maupun diagnosis yang keluar dari fungsi ini — sesuai INK/016 poin 4.6.4.
 */
export function ringkasAgregatProKawan(peserta: PesertaProKawan[]): RingkasanAgregatProKawan {
  const total = peserta.length;
  const byZona: Record<'Kuning' | 'Merah', number> = { Kuning: 0, Merah: 0 };
  const byJalur: Record<JalurProKawan, number> = {
    'kontrol-dokter': 0, 'pemantauan-paramedis': 0, 'evaluasi-alat-bantu': 0, 'konseling-eap': 0,
  };
  const byStatus: Record<StatusKepatuhan, number> = {
    'sesuai-jadwal': 0, 'akan-datang': 0, terlambat: 0, 'belum-kontrol': 0, selesai: 0,
  };
  const site = new Map<string, number>();
  const frekuensi = new Map<string, number>();
  const parameter = new Map<string, number>();
  const kelayakan = new Map<string, number>();
  let belumTerjadwal = 0;

  for (const p of peserta) {
    byZona[p.zona] += 1;
    byJalur[p.jalur] += 1;
    byStatus[p.status] += 1;

    const namaSite = p.site || 'Tidak tercatat';
    site.set(namaSite, (site.get(namaSite) || 0) + 1);

    const labelFrekuensi = p.bulan === null ? 'Tanpa kontrol berkala' : `${p.bulan} bulan`;
    frekuensi.set(labelFrekuensi, (frekuensi.get(labelFrekuensi) || 0) + 1);

    // Trigger berisi label panjang ("Hypertension Grade I (Kuning) — 145/92 mmHg").
    // Untuk pelaporan cukup nama parameternya.
    const terlihat = new Set<string>();
    for (const t of p.triggers) {
      const bersih = t.split(' — ')[0].replace(/\s*\((Kuning|Merah)\)\s*$/i, '').trim();
      if (!bersih || terlihat.has(bersih)) continue;
      terlihat.add(bersih);
      parameter.set(bersih, (parameter.get(bersih) || 0) + 1);
    }

    const statusKerja = (p.kelayakanKerja || 'Tidak tercatat').trim();
    kelayakan.set(statusKerja, (kelayakan.get(statusKerja) || 0) + 1);

    if (!p.jatuhTempo) belumTerjadwal += 1;
  }

  const urut = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const patuh = byStatus['sesuai-jadwal'] + byStatus['akan-datang'] + byStatus.selesai;

  // Sebaran umur jatuh tempo. `sisaHari` dihitung di prokawan-peserta.ts;
  // bila tidak tersedia, turunkan dari status kepatuhan.
  const byUmurJadwal = { lewatBerat: 0, lewatRingan: 0, segera: 0, jauh: 0, tanpaJadwal: 0 };
  let merahTerlambat = 0;
  for (const p of peserta) {
    const lewat = p.status === 'terlambat';
    if (lewat && p.zona === 'Merah') merahTerlambat += 1;
    if (!p.jatuhTempo) { byUmurJadwal.tanpaJadwal += 1; continue; }
    if (lewat) {
      // Pisahkan keterlambatan berat (>30 hari) — itu eskalasi untuk
      // QSHE Manager, bukan sekadar pengingat Paramedic Site.
      const lewatHari = p.sisaHari != null ? Math.abs(p.sisaHari) : 0;
      if (lewatHari > 30) byUmurJadwal.lewatBerat += 1;
      else byUmurJadwal.lewatRingan += 1;
      continue;
    }
    if (p.status === 'akan-datang') { byUmurJadwal.segera += 1; continue; }
    byUmurJadwal.jauh += 1;
  }

  return {
    total,
    byZona,
    byJalur,
    byStatus,
    bySite: urut(site),
    byFrekuensi: urut(frekuensi),
    byParameter: urut(parameter),
    byKelayakan: urut(kelayakan),
    tingkatKepatuhan: total ? (patuh / total) * 100 : 0,
    tingkatTerlambat: total ? (byStatus.terlambat / total) * 100 : 0,
    jumlahPerluTindakLanjut: byStatus.terlambat,
    jumlahBelumTerjadwal: belumTerjadwal,
    byUmurJadwal,
    persenJalur: {
      'kontrol-dokter': total ? (byJalur['kontrol-dokter'] / total) * 100 : 0,
      'pemantauan-paramedis': total ? (byJalur['pemantauan-paramedis'] / total) * 100 : 0,
      'evaluasi-alat-bantu': total ? (byJalur['evaluasi-alat-bantu'] / total) * 100 : 0,
      'konseling-eap': total ? (byJalur['konseling-eap'] / total) * 100 : 0,
    },
    merahTerlambat,
  };
}
