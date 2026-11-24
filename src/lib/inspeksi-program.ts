// Program Inspeksi — rencana, realisasi & temuan (PICA)
//
// MASALAH YANG DISELESAIKAN
// Modul inspeksi sebelumnya (Sarana Klinik, Higiene & Sanitasi) hanya
// mencatat HASIL pemeriksaan. Tidak ada yang mencatat KAPAN seharusnya
// diperiksa, sehingga:
//   • persentase penyelesaian (realisasi ÷ target) tidak bisa dihitung,
//   • ketepatan waktu (on-time vs late) tidak bisa dihitung,
//   • "inspeksi terlewat" tidak bisa dideteksi,
//   • beban kerja per petugas tidak bisa diukur.
//
// Modul ini menambahkan lapisan RENCANA di atas hasil inspeksi yang sudah ada:
//
//   inspeksi_jadwal  → satu baris = satu kewajiban inspeksi pada satu periode
//   pica             → satu baris = satu temuan yang harus ditutup
//
// Keduanya sengaja TIDAK menyimpan ulang hasil pemeriksaan. `jenis` menunjuk
// modul pemeriksaan yang sudah ada, sehingga angka di dashboard selalu berasal
// dari satu sumber data.

/** Modul pemeriksaan yang dijadwalkan. `p3k` dan `ambulans` ditambahkan di sini. */
export type JenisInspeksi =
  | 'sarana_klinik'
  | 'sanitasi'
  | 'p3k'
  | 'ambulans'
  | 'ergonomi'
  | 'kalibrasi';

export type StatusJadwal =
  | 'rencana'
  | 'menunggu_persetujuan'
  | 'selesai'
  | 'terlewat'
  | 'dibatalkan'
  | 'ditolak';

/** Tingkat temuan. Menentukan warna dan prioritas PICA. */
export type TingkatTemuan = 'kritis' | 'mayor' | 'minor';

export type StatusPica = 'open' | 'in_progress' | 'closed' | 'dismissed';

export const JENIS_META: Record<JenisInspeksi, { label: string; area: string }> = {
  sarana_klinik: { label: 'Sarana & Prasarana Klinik', area: 'Klinik' },
  sanitasi: { label: 'Higiene & Sanitasi', area: 'Kantin / Mess / Air' },
  p3k: { label: 'Kotak P3K', area: 'P3K' },
  ambulans: { label: 'Ambulans & Tanggap Darurat', area: 'Ambulans' },
  ergonomi: { label: 'Sarana Ergonomi', area: 'Ergonomi' },
  kalibrasi: { label: 'Kalibrasi Alat', area: 'Kalibrasi' },
};

export const JENIS_INSPEKSI_LIST = Object.keys(JENIS_META) as JenisInspeksi[];

/**
 * Frekuensi bawaan per jenis — dipakai untuk MENGHASILKAN rencana periode.
 * Bisa ditimpa per objek (mis. satu item P3K dijadwalkan bulanan, yang lain
 * triwulanan) dengan mengisi `frekuensi_hari` pada baris jadwal.
 */
export const FREKUENSI_HARI_BAWAAN: Record<JenisInspeksi, number> = {
  sarana_klinik: 30,
  sanitasi: 30,
  p3k: 30,
  ambulans: 30,
  ergonomi: 90,
  kalibrasi: 365,
};

/** Label frekuensi yang enak dibaca. */
export function labelFrekuensi(hari: number): string {
  if (hari >= 360) return `${Math.round(hari / 365)} tahun`;
  if (hari >= 28) return `${Math.round(hari / 30)} bulan`;
  if (hari % 7 === 0) return `${hari / 7} minggu`;
  return `${hari} hari`;
}

/** Berapa kali per bulan sebuah frekuensi menghasilkan jadwal. */
export function jumlahPerBulan(hari: number): number {
  if (hari >= 360) return 0; // tahunan ditangani terpisah
  if (hari <= 0) return 1;
  return Math.max(1, Math.round(30 / hari));
}

/**
 * Frekuensi efektif sebuah jenis inspeksi.
 * `override` dipakai bila operator mengisi frekuensi sendiri saat membuat rencana.
 */
export function frekuensiUntukJenis(jenis: JenisInspeksi, override?: unknown): number {
  const n = Number(override);
  if (Number.isFinite(n) && n > 0 && n <= 730) return Math.round(n);
  return FREKUENSI_HARI_BAWAAN[jenis] ?? 30;
}

/**
 * Tanggal-tanggal rencana dalam satu periode menurut frekuensinya.
 *
 * Frekuensi BUKAN hanya label — ia menentukan berapa kewajiban inspeksi yang
 * harus dipenuhi bulan itu, dan itulah penyebut pada completion rate:
 *
 *   30 hari (bulanan)  → 1 jadwal, tanggal terakhir bulan
 *   14 hari (2 minggu) → 2 jadwal, pertengahan & akhir
 *    7 hari (mingguan) → 4 jadwal, tiap 7 hari
 *   90 hari (3 bulan)  → 1 jadwal, hanya pada bulan ke-1, 4, 7, 10
 *  365 hari (tahunan)  → 1 jadwal, hanya pada bulan Januari
 *
 * Mengembalikan array kosong bila objek ini tidak jatuh tempo pada periode
 * tersebut — jangan membuat jadwal yang sebenarnya belum waktunya.
 */
export function tanggalRencanaPeriode(periode: string, frekuensiHari: number): string[] {
  const awal = awalPeriode(periode);
  const akhir = akhirPeriode(periode);
  const hari = frekuensiHari > 0 ? frekuensiHari : 30;

  // Tahunan & triwulanan: hanya pada bulan tertentu, agar tidak menumpuk
  // tiga jadwal di bulan yang sama.
  if (hari >= 360) return awal.getMonth() === 0 ? [tanggalISO(akhir)] : [];
  if (hari >= 85 && hari <= 95) return awal.getMonth() % 3 === 0 ? [tanggalISO(akhir)] : [];

  // Bulanan ke atas: satu jadwal di akhir periode.
  if (hari >= 28) return [tanggalISO(akhir)];

  // Mingguan / dua-mingguan: sebar merata, jadwal terakhir di akhir periode.
  const jumlah = Math.max(1, Math.round(akhir.getDate() / hari));
  const tanggal: string[] = [];
  for (let i = jumlah - 1; i >= 0; i -= 1) {
    const d = new Date(akhir.getFullYear(), akhir.getMonth(), akhir.getDate() - i * hari);
    // Jangan sampai jatuh di bulan sebelumnya (mis. 31 - 7×2 = 17, aman).
    if (d.getMonth() !== akhir.getMonth()) continue;
    tanggal.push(tanggalISO(d));
  }
  return tanggal;
}

/* ── Tanggal ─────────────────────────────────────────────────────────────── */

/** YYYY-MM-DD dari Date (waktu lokal, bukan UTC — supaya tidak bergeser hari). */
export function tanggalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function awalHari(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Selisih hari: negatif = sudah lewat. */
export function selisihHari(target: string | null | undefined, sekarang: Date = new Date()): number | null {
  if (!target) return null;
  const d = new Date(`${String(target).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - awalHari(sekarang).getTime()) / 86_400_000);
}

/** Periode YYYY-MM untuk bulan yang memuat tanggal tersebut. */
export function periodeBulan(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(`${d.slice(0, 10)}T00:00:00`) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Tanggal pertama periode YYYY-MM. */
export function awalPeriode(periode: string): Date {
  const [tahun, bulan] = String(periode).split('-').map(Number);
  return new Date(tahun || new Date().getFullYear(), (bulan || 1) - 1, 1);
}

/** Tanggal terakhir periode YYYY-MM. */
export function akhirPeriode(periode: string): Date {
  const awal = awalPeriode(periode);
  return new Date(awal.getFullYear(), awal.getMonth() + 1, 0);
}

/** Label periode yang enak dibaca, mis. "November 2026". */
export function labelPeriode(periode: string): string {
  const awal = awalPeriode(periode);
  return awal.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/* ── Status jadwal ───────────────────────────────────────────────────────── */

/**
 * Status efektif satu baris jadwal.
 *
 * `terlewat` TIDAK disimpan di database — dihitung dari tanggal. Alasannya:
 * status tersimpan akan basi setiap hari, dan harus ada proses latar belakang
 * yang memperbaruinya. Dengan dihitung, daftar "inspeksi terlewat" selalu
 * akurat tanpa cron.
 */
export function statusEfektif(
  baris: { status?: string | null; tanggal_rencana?: string | null; tanggal_selesai?: string | null },
  sekarang: Date = new Date(),
): StatusJadwal {
  const status = String(baris.status ?? '').toLowerCase();
  if (status === 'dibatalkan') return 'dibatalkan';
  if (status === 'ditolak') return 'ditolak';
  if (status === 'menunggu_persetujuan') return 'menunggu_persetujuan';
  if (status === 'selesai' || Boolean(baris.tanggal_selesai)) return 'selesai';
  const sisa = selisihHari(baris.tanggal_rencana, sekarang);
  // H+0 masih boleh diselesaikan hari itu; terlewat mulai H+1.
  if (sisa !== null && sisa < 0) return 'terlewat';
  return 'rencana';
}

/** Tepat waktu = diselesaikan pada/tanggal sebelumnya, tidak melewati due date. */
export function tepatWaktu(
  baris: { tanggal_rencana?: string | null; tanggal_selesai?: string | null },
): boolean {
  if (!baris.tanggal_selesai || !baris.tanggal_rencana) return false;
  const rencana = String(baris.tanggal_rencana).slice(0, 10);
  const selesai = String(baris.tanggal_selesai).slice(0, 10);
  return selesai <= rencana;
}

/* ── Ringkasan pelaksanaan ───────────────────────────────────────────────── */

export interface BarisJadwal {
  id?: string | number;
  jenis: string;
  site: string | null;
  objek_id: string | null;
  objek_nama: string | null;
  periode: string | null;
  tanggal_rencana: string | null;
  tanggal_selesai: string | null;
  status: string | null;
  petugas: string | null;
  /** Waktu laporan dibuat (untuk reporting lead time). */
  waktu_lapor?: string | null;
  waktu_verifikasi?: string | null;
  diverifikasi_oleh?: string | null;
  catatan?: string | null;
  catatan_verifikasi?: string | null;
}

export interface RingkasanProgram {
  /** Target rencana pada periode/filter yang dipakai. */
  target: number;
  selesai: number;
  terlewat: number;
  belum: number;
  /** Persentase penyelesaian = selesai ÷ target. */
  persenSelesai: number;
  /** Hijau ≥95, Kuning 85–94, Merah <85. */
  warnaSelesai: 'hijau' | 'kuning' | 'merah';
  tepatWaktu: number;
  terlambat: number;
  persenTepatWaktu: number;
  /** Inspeksi yang melewati due date lebih dari 0 hari (H+1 dst). */
  daftarTerlewat: BarisJadwal[];
}

/**
 * Ringkasan pelaksanaan untuk sekumpulan baris jadwal.
 *
 * `dibatalkan` dikecualikan dari target: membatalkan jadwal tidak boleh
 * menurunkan persentase penyelesaian tim.
 */
export function ringkasProgram(baris: BarisJadwal[], sekarang: Date = new Date()): RingkasanProgram {
  const dihitung = baris.filter(b => statusEfektif(b, sekarang) !== 'dibatalkan');
  const target = dihitung.length;

  let selesai = 0;
  let terlewat = 0;
  let belum = 0;
  let tepat = 0;
  let terlambat = 0;
  const daftarTerlewat: BarisJadwal[] = [];

  for (const b of dihitung) {
    const status = statusEfektif(b, sekarang);
    if (status === 'selesai') {
      selesai += 1;
      if (tepatWaktu(b)) tepat += 1;
      else terlambat += 1;
    } else if (status === 'terlewat') {
      terlewat += 1;
      daftarTerlewat.push(b);
    } else {
      belum += 1;
    }
  }

  const persen = (bagian: number, total: number) =>
    total === 0 ? 0 : Math.round((bagian / total) * 1000) / 10;

  const persenSelesai = persen(selesai, target);
  return {
    target,
    selesai,
    terlewat,
    belum,
    persenSelesai,
    warnaSelesai: warnaPersen(persenSelesai),
    tepatWaktu: tepat,
    terlambat,
    persenTepatWaktu: persen(tepat, selesai),
    // Paling lama terlambat lebih dulu — itu yang paling perlu ditindaklanjuti.
    daftarTerlewat: daftarTerlewat.sort(
      (a, b) => (selisihHari(a.tanggal_rencana, sekarang) ?? 0) - (selisihHari(b.tanggal_rencana, sekarang) ?? 0),
    ),
  };
}

/** Ambang warna kinerja: Hijau ≥95%, Kuning 85–94%, Merah <85%. */
export function warnaPersen(persen: number): 'hijau' | 'kuning' | 'merah' {
  if (persen >= 95) return 'hijau';
  if (persen >= 85) return 'kuning';
  return 'merah';
}

export const WARNA_KINERJA: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: '#00B894',
  kuning: '#F1C40F',
  merah: '#FF2D2D',
};

/* ── PICA ────────────────────────────────────────────────────────────────── */

export interface BarisPica {
  id?: string | number;
  kode: string | null;
  sumber: string | null;
  jenis_inspeksi: string | null;
  site: string | null;
  objek_nama: string | null;
  deskripsi: string | null;
  tingkat: string | null;
  departemen: string | null;
  tanggal_dibuat: string | null;
  due_date: string | null;
  tanggal_closed: string | null;
  status: string | null;
  /** Kunci pengulangan, mis. `3k:kotak_p3k:head office`. */
  kunci_berulang: string | null;
}

/** PICA dianggap lewat tenggat bila belum closed dan due_date sudah lewat. */
export function picaOverdue(p: BarisPica, sekarang: Date = new Date()): boolean {
  const status = String(p.status ?? 'open').toLowerCase();
  if (status === 'closed' || status === 'dismissed') return false;
  const sisa = selisihHari(p.due_date, sekarang);
  return sisa !== null && sisa < 0;
}

/** Umur PICA dalam hari: created → closed (atau sampai hari ini bila masih aktif). */
export function durasiHari(
  p: BarisPica,
  sekarang: Date = new Date(),
): number | null {
  if (!p.tanggal_dibuat) return null;
  const mulai = new Date(`${String(p.tanggal_dibuat).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(mulai.getTime())) return null;
  const akhir = p.tanggal_closed
    ? new Date(`${String(p.tanggal_closed).slice(0, 10)}T00:00:00`)
    : awalHari(sekarang);
  return Math.max(0, Math.round((akhir.getTime() - mulai.getTime()) / 86_400_000));
}

export interface RingkasanPica {
  total: number;
  aktif: number;
  closed: number;
  overdue: number;
  /** MTTR = rata-rata durasi hari untuk PICA yang sudah closed. */
  mttr: number | null;
  perDepartemen: { departemen: string; aktif: number; overdue: number; closed: number }[];
  /** Top 5 objek yang temuan PICA-nya paling sering berulang. */
  terulang: { objek: string; jumlah: number; picaIds: string[] }[];
  overdueList: BarisPica[];
}

/**
 * Ringkasan PICA.
 *
 * MTTR hanya dihitung dari PICA yang benar-benar CLOSED. Memasukkan yang
 * masih aktif akan membuat angkanya naik setiap hari tanpa ada perbaikan.
 */
export function ringkasPica(daftar: BarisPica[], sekarang: Date = new Date()): RingkasanPica {
  const berjalan = daftar.filter(p => String(p.status ?? 'open').toLowerCase() !== 'dismissed');
  const closed = berjalan.filter(p => String(p.status ?? '').toLowerCase() === 'closed');
  const aktif = berjalan.filter(p => String(p.status ?? 'open').toLowerCase() !== 'closed');
  const overdueList = aktif.filter(p => picaOverdue(p, sekarang));

  const durasi = closed
    .map(p => durasiHari(p, sekarang))
    .filter((d): d is number => d !== null);
  const mttr = durasi.length
    ? Math.round((durasi.reduce((a, b) => a + b, 0) / durasi.length) * 10) / 10
    : null;

  // Distribusi per departemen penanggung jawab.
  const perDep = new Map<string, { aktif: number; overdue: number; closed: number }>();
  for (const p of berjalan) {
    const dep = (p.departemen ?? '').trim() || 'Belum ditentukan';
    const d = perDep.get(dep) ?? { aktif: 0, overdue: 0, closed: 0 };
    if (String(p.status ?? '').toLowerCase() === 'closed') d.closed += 1;
    else {
      d.aktif += 1;
      if (picaOverdue(p, sekarang)) d.overdue += 1;
    }
    perDep.set(dep, d);
  }
  const perDepartemen = [...perDep.entries()]
    .map(([departemen, v]) => ({ departemen, ...v }))
    .sort((a, b) => b.aktif - a.aktif || b.overdue - a.overdue);

  // Temuan berulang: dihitung dari `kunci_berulang` (objek + jenis temuan).
  // Tanpa kunci ini, "5 PICA di kotak P3K yang sama" tidak bisa dibedakan dari
  // 5 PICA di 5 kotak berbeda.
  const perKunci = new Map<string, { objek: string; picaIds: string[] }>();
  for (const p of daftar) {
    const kunci = (p.kunci_berulang ?? '').trim();
    if (!kunci) continue;
    const objek = (p.objek_nama ?? '').trim() || kunci;
    const isi = perKunci.get(kunci) ?? { objek, picaIds: [] };
    isi.picaIds.push(String(p.id ?? ''));
    perKunci.set(kunci, isi);
  }
  const terulang = [...perKunci.values()]
    .filter(v => v.picaIds.length > 1)
    .map(v => ({ objek: v.objek, jumlah: v.picaIds.length, picaIds: v.picaIds }))
    .sort((a, b) => b.jumlah - a.jumlah)
    .slice(0, 5);

  return {
    total: berjalan.length,
    aktif: aktif.length,
    closed: closed.length,
    overdue: overdueList.length,
    mttr,
    perDepartemen,
    terulang,
    overdueList: overdueList.sort(
      (a, b) => (selisihHari(a.due_date, sekarang) ?? 0) - (selisihHari(b.due_date, sekarang) ?? 0),
    ),
  };
}

/** Tenggat bawaan PICA menurut tingkat temuan (hari). */
export const TENGGAT_PICA_HARI: Record<TingkatTemuan, number> = {
  kritis: 3,
  mayor: 14,
  minor: 30,
};

export function tenggatDariTingkat(tingkat: string | null | undefined, mulai: Date = new Date()): string {
  const t = (String(tingkat ?? 'minor').toLowerCase() as TingkatTemuan);
  const hari = TENGGAT_PICA_HARI[t] ?? TENGGAT_PICA_HARI.minor;
  const d = awalHari(mulai);
  d.setDate(d.getDate() + hari);
  return tanggalISO(d);
}

/* ── PICA otomatis dari temuan inspeksi (FORM-039) ───────────────────────── */

/**
 * Departemen penanggung jawab bawaan per jenis inspeksi.
 *
 * Mengikuti pembagian kerja yang lazim di form PICA: perbaikan kendaraan ke
 * Plant/Maintenance, fasilitas umum ke GA, dan isi P3K/alkes ke Logistik.
 * Nilai ini hanya SARAN awal — tetap dapat diubah saat verifikasi.
 */
export const DEPARTEMEN_BAWAAN: Record<string, string> = {
  ambulans: 'Plant/Maintenance',
  sanitasi: 'General Affairs',
  ergonomi: 'Plant/Maintenance',
  p3k: 'Logistik',
  sarana_klinik: 'General Affairs',
  kalibrasi: 'Plant/Maintenance',
};

/** Baris temuan yang bisa diubah menjadi PICA. */
export interface TemuanMasuk {
  jenis: string;
  site: string | null;
  objek_id: string | null;
  objek_nama: string | null;
  lokasi?: string | null;
  /** ada | rusak | tidak_ada | tidak_diperlukan */
  status: string;
  catatan?: string | null;
}

/**
 * Apakah satu baris kondisi layak dijadikan PICA?
 *
 * Hanya `rusak` dan `tidak_ada` yang menjadi temuan. `ada` berarti normal dan
 * `tidak_diperlukan` berarti memang tidak dibutuhkan — dua-duanya bukan
 * ketidaksesuaian, sehingga tidak boleh memenuhi daftar PICA.
 */
export function layakJadiPica(t: TemuanMasuk): boolean {
  const s = String(t.status ?? '').toLowerCase();
  return s === 'rusak' || s === 'tidak_ada';
}

/** Tingkat temuan: barang wajib yang tidak ada = kritis, rusak = mayor. */
export function tingkatDariStatus(status: string): TingkatTemuan {
  return String(status).toLowerCase() === 'tidak_ada' ? 'kritis' : 'mayor';
}

/** Deskripsi PICA (kolom PENYIMPANGAN / DEVIASI pada FORM-039). */
export function deskripsiTemuan(t: TemuanMasuk): string {
  const s = String(t.status ?? '').toLowerCase();
  const apa = s === 'tidak_ada' ? 'tidak tersedia' : 'dalam kondisi rusak';
  const di = t.lokasi ? ` di ${t.lokasi}` : '';
  const catatan = String(t.catatan ?? '').trim();
  return `${t.objek_nama ?? 'Item'} ${apa}${di}${catatan ? ` — ${catatan}` : ''}`;
}

/**
 * Kunci kestabilan PICA otomatis.
 *
 * Format: jenis:objek:lokasi — sengaja TANPA nomor PICA agar pengulangan
 * pada objek yang sama terdeteksi (Top 5 PICA Recurrence).
 */
export function kunciPicaOtomatis(t: TemuanMasuk): string {
  const lokasi = String(t.lokasi ?? '').trim().toLowerCase();
  const objek = String(t.objek_id ?? t.objek_nama ?? '').trim().toLowerCase();
  return lokasi ? `${t.jenis}:${objek}@${lokasi}` : `${t.jenis}:${objek}`;
}

/* ── Cakupan aset & blindspot ────────────────────────────────────────────── */

export interface CakupanAset {
  terdaftar: number;
  tersampling: number;
  persen: number;
}

/**
 * Cakupan = aset terdaftar yang punya minimal satu inspeksi SELESAI pada
 * periode berjalan, dibagi seluruh aset terdaftar.
 */
export function hitungCakupan(terdaftar: number, tersampling: number): CakupanAset {
  const persen = terdaftar === 0 ? 0 : Math.round((tersampling / terdaftar) * 1000) / 10;
  return { terdaftar, tersampling, persen };
}

export interface Blindspot {
  site: string;
  jenis: string;
  hariTerakhir: number | null;
  terakhir: string | null;
  jumlahObjek: number;
}

/**
 * Blindspot = objek yang paling lama tidak diinspeksi (30–90 hari ke atas).
 *
 * `hariTerakhir` null berarti BELUM PERNAH diinspeksi — itu prioritas tertinggi,
 * bukan "tidak ada data", sehingga diurutkan paling atas.
 */
export function daftarBlindspot(
  baris: Pick<BarisJadwal, 'jenis' | 'site' | 'tanggal_selesai'>[],
  tanggalDaftar: Map<string, number>,
  sekarang: Date = new Date(),
  ambangHari = 30,
): Blindspot[] {
  const terakhir = new Map<string, { tanggal: string | null; jumlah: number }>();
  for (const [kunci, jumlah] of tanggalDaftar) {
    terakhir.set(kunci, { tanggal: null, jumlah });
  }
  for (const b of baris) {
    if (!b.tanggal_selesai) continue;
    const kunci = `${b.jenis}|${b.site ?? ''}`;
    const isi = terakhir.get(kunci);
    if (!isi) continue;
    const tgl = String(b.tanggal_selesai).slice(0, 10);
    if (!isi.tanggal || tgl > isi.tanggal) isi.tanggal = tgl;
  }

  return [...terakhir.entries()]
    .map(([kunci, v]) => {
      const [jenis, site] = kunci.split('|');
      const lewat = selisihHari(v.tanggal, sekarang);
      return {
        site: site || '—',
        jenis,
        // lewat = hari sejak inspeksi terakhir (positif = makin lama).
        hariTerakhir: v.tanggal ? (lewat === null ? null : Math.abs(lewat)) : null,
        terakhir: v.tanggal,
        jumlahObjek: v.jumlah,
      };
    })
    .filter(b => b.hariTerakhir === null || b.hariTerakhir >= ambangHari)
    .sort((a, b) => {
      // Belum pernah diinspeksi selalu di atas.
      if (a.hariTerakhir === null && b.hariTerakhir !== null) return -1;
      if (b.hariTerakhir === null && a.hariTerakhir !== null) return 1;
      return (b.hariTerakhir ?? 0) - (a.hariTerakhir ?? 0);
    });
}
