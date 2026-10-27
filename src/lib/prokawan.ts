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

interface AturanJalur {
  /** Pola pencocokan label trigger dari zonasi-engine. */
  match: RegExp;
  jalur: JalurProKawan;
  /** Frekuensi kontrol minimal, dalam bulan. null = tidak wajib kontrol rutin. */
  bulan: number | null;
}

/**
 * Urutan penting: yang paling spesifik di atas. Parameter yang tidak cocok
 * dengan aturan mana pun memakai jalur kontrol dokter 3 bulan (default aman,
 * karena mayoritas parameter Kuning memang mensyaratkannya).
 */
const ATURAN_JALUR: AturanJalur[] = [
  // Jalur konseling EAP — terduga gangguan mental tanpa tanda bahaya.
  { match: /Terduga Gangguan Mental|Mental Disorder|SRQ-20/i, jalur: 'konseling-eap', bulan: 3 },
  // Jalur evaluasi alat bantu — gangguan penglihatan/pendengaran ringan.
  { match: /Visual Impairment|Pendengaran Ringan|Hearing.*Ringan|tuli ringan/i, jalur: 'evaluasi-alat-bantu', bulan: null },
  // Jalur pemantauan paramedis — tanpa kewajiban kontrol dokter berkala.
  { match: /Overweight|Obesity|Obesitas|Hiperurisemia|Uric/i, jalur: 'pemantauan-paramedis', bulan: null },
  // Prediabetes: kontrol 6 bulan (lebih longgar dari umumnya).
  { match: /Prediabetes/i, jalur: 'kontrol-dokter', bulan: 6 },
  // Semua parameter Zona Merah: kontrol dokter spesialis 1 bulan.
  { match: /\(Merah\)/, jalur: 'kontrol-dokter', bulan: 1 },
];

const DEFAULT_ATURAN: AturanJalur = { match: /.^/, jalur: 'kontrol-dokter', bulan: 3 };

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

  let terpilih: { aturan: AturanJalur; trigger: string } | null = null;

  for (const trigger of triggers) {
    const aturan = ATURAN_JALUR.find((a) => a.match.test(trigger)) ?? DEFAULT_ATURAN;
    if (!terpilih) {
      terpilih = { aturan, trigger };
      continue;
    }
    const a = aturan.bulan;
    const b = terpilih.aturan.bulan;
    // null = tidak wajib kontrol → dianggap paling longgar.
    const lebihKetat = a !== null && (b === null || a < b);
    if (lebihKetat) terpilih = { aturan, trigger };
  }

  return {
    jalur: terpilih!.aturan.jalur,
    bulan: terpilih!.aturan.bulan,
    pemicu: triggers.filter((t) => (ATURAN_JALUR.find((a) => a.match.test(t)) ?? DEFAULT_ATURAN).jalur === terpilih!.aturan.jalur),
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
 * Status kepatuhan. Batas "akan datang" 14 hari dipilih agar Paramedic Site
 * punya waktu mengingatkan sebelum jatuh tempo — ini kebijakan operasional,
 * bukan angka dari dokumen.
 */
export function statusKepatuhan(jatuhTempo: string | null, sekarang: Date = new Date()): StatusKepatuhan {
  const hari = selisihHari(jatuhTempo, sekarang);
  if (hari === null) return 'sesuai-jadwal';
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
