// ============================================================
// Minggu kerja (Work Week) — Senin sampai Sabtu
// ============================================================
//
// ATURAN OPERASIONAL PT BAGONG DEKAKA MAKMUR
//   • Hari kerja dimulai SENIN.
//   • Laporan dibuat hari SABTU.
//   • MINGGU libur (Head Office) — tidak ada kunjungan.
//
// KONSEKUENSI PADA PENOMORAN
// Karena minggu dimulai Senin dan berakhir Sabtu (6 hari), nomor minggu
// TIDAK sama dengan ISO-8601 (yang memakai Senin–Minggu 7 hari). Perbedaan
// paling kentara di pergantian tahun: minggu yang memuat 1 Januari.
//
// Yang dipakai di sini — dan alasannya:
//
//   Week 1 = minggu kerja pertama yang MEMUAT 1 Januari.
//            Minggu itu selalu Senin–Sabtu yang memuat tanggal 1 Januari,
//            sehingga "minggu pertama Januari adalah Week 1" benar apa adanya
//            dan tidak ada hari yang terlewat di antara tahun.
//
//   Minggu yang seluruhnya berada di Desember tahun sebelumnya = Week terakhir
//   tahun itu. Minggu yang seluruhnya di Januari tahun berjalan = Week 1 dst.
//
// Contoh 2026 (1 Januari = Kamis):
//   Week 1 = Sen 29 Des 2025 – Sab 3 Jan 2026   (memuat 1 Januari)
//   Week 2 = Sen 5 Jan – Sab 10 Jan
//   Week 3 = Sen 12 Jan – Sab 17 Jan
//
// Akibatnya Week 1 tahun 2026 "dimulai" di bulan Desember 2025. Itu memang
// konsekuensi minggu kerja yang memuat pergantian tahun; laporan menampilkan
// rentang tanggalnya secara eksplisit agar tidak menimbulkan salah paham.

const MS_PER_DAY = 86_400_000;

/** Tanggal lokal tanpa jam — menghindari pergeseran zona waktu. */
export function tanggalLokal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Senin pada minggu kerja yang memuat `d`. */
export function awalMinggu(d: Date): Date {
  const t = tanggalLokal(d);
  const hari = t.getDay(); // 0=Minggu … 6=Sabtu
  // Minggu (0) dianggap bagian akhir minggu kerja sebelumnya, bukan awal.
  const mundur = hari === 0 ? 6 : hari - 1;
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - mundur);
}

/** Sabtu pada minggu kerja yang memuat `d`. */
export function akhirMinggu(d: Date): Date {
  const senin = awalMinggu(d);
  return new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 5);
}

/**
 * Tahun kerja yang memiliki minggu tersebut = tahun dari hari Sabtu-nya.
 *
 * Dipakai agar minggu 29 Des 2025 – 3 Jan 2026 masuk tahun 2026 (karena
 * Sabtu-nya di Januari), konsisten dengan "Week 1 memuat 1 Januari".
 */
export function tahunKerja(d: Date): number {
  return akhirMinggu(d).getFullYear();
}

/** Senin pada minggu kerja pertama tahun `tahun`. */
export function mingguPertamaTahun(tahun: number): Date {
  const pertama = new Date(tahun, 0, 1);
  let senin = awalMinggu(pertama);
  // Bila minggu tersebut berakhir di tahun sebelumnya, maju satu minggu:
  // minggu pertama tahun ini adalah yang SABTU-nya jatuh di tahun ini.
  if (akhirMinggu(senin).getFullYear() < tahun) {
    senin = new Date(senin.getFullYear(), senin.getMonth(), senin.getDate() + 7);
  }
  return senin;
}

/** Nomor minggu kerja (1-based) dalam tahun kerjanya. */
export function nomorMinggu(d: Date): number {
  const senin = awalMinggu(d);
  const awal = mingguPertamaTahun(akhirMinggu(d).getFullYear());
  const selisih = Math.round((senin.getTime() - awal.getTime()) / (7 * MS_PER_DAY));
  return selisih + 1;
}

/**
 * Jumlah minggu kerja dalam satu tahun kerja.
 *
 * Dihitung sampai minggu yang SABTU-nya masih di tahun tersebut. Minggu yang
 * mulai di Desember tapi berakhir di Januari tahun berikutnya SUDAH menjadi
 * Week 1 tahun berikutnya, bukan minggu terakhir tahun ini — konsisten dengan
 * `mingguPertamaTahun`.
 */
export function jumlahMingguTahun(tahun: number): number {
  const awal = mingguPertamaTahun(tahun);
  let n = 0;
  for (let i = 0; i < 60; i += 1) {
    const senin = new Date(awal.getFullYear(), awal.getMonth(), awal.getDate() + i * 7);
    if (akhirMinggu(senin).getFullYear() !== tahun) break;
    n += 1;
  }
  return n;
}

/**
 * Tahun kerja yang memuat hari kerja tertentu, termasuk 28–31 Desember yang
 * sudah masuk Week 1 tahun berikutnya. Dipakai untuk menentukan tahun default
 * daftar minggu saat "hari ini" berada di ekor Desember.
 */
export function tahunUntukDaftar(sekarang: Date): number[] {
  const t = tahunKerja(sekarang);
  // Sertakan tahun berikutnya bila minggu berjalan adalah Week 1-nya.
  const mingguIni = nomorMinggu(sekarang);
  return mingguIni === 1 && sekarang.getMonth() === 11 ? [t, t + 1] : [t];
}

export interface RentangMinggu {
  tahun: number;
  minggu: number;
  /** Senin (inklusif). */
  mulai: Date;
  /** Sabtu (inklusif). */
  selesai: Date;
  label: string;
  /** true bila minggu ini sedang berjalan (belum sampai Sabtu). */
  berjalan: boolean;
}

function fmtTanggal(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Rentang tanggal untuk tahun + nomor minggu tertentu. */
export function rentangMinggu(tahun: number, minggu: number, sekarang: Date = new Date()): RentangMinggu {
  const awal = mingguPertamaTahun(tahun);
  const mulai = new Date(awal.getFullYear(), awal.getMonth(), awal.getDate() + (minggu - 1) * 7);
  const selesai = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + 5);
  const hariIni = tanggalLokal(sekarang);
  return {
    tahun,
    minggu,
    mulai,
    selesai,
    label: `Week ${minggu} (${fmtTanggal(mulai)} – ${fmtTanggal(selesai)})`,
    // Pekan berjalan: hari ini masih di dalam rentang Senin–Sabtu.
    berjalan: hariIni >= mulai && hariIni <= selesai,
  };
}

/** Rentang minggu kerja yang memuat tanggal tertentu. */
export function rentangMingguDari(d: Date, sekarang: Date = new Date()): RentangMinggu {
  return rentangMinggu(tahunKerja(d), nomorMinggu(d), sekarang);
}

/** Daftar semua minggu dalam satu tahun kerja (untuk dropdown). */
export function daftarMinggu(tahun: number, sekarang: Date = new Date()): RentangMinggu[] {
  const total = jumlahMingguTahun(tahun);
  return Array.from({ length: total }, (_, i) => rentangMinggu(tahun, i + 1, sekarang));
}

/** Format tanggal lokal sebagai YYYY-MM-DD (untuk query database). */
export function isoTanggal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${t}`;
}

/**
 * Memeriksa apakah sebuah tanggal (YYYY-MM-DD) berada dalam rentang minggu.
 * Perbandingan memakai string ISO sehingga bebas zona waktu.
 */
export function dalamMinggu(tanggal: string | null | undefined, r: RentangMinggu): boolean {
  if (!tanggal) return false;
  const t = String(tanggal).slice(0, 10);
  return t >= isoTanggal(r.mulai) && t <= isoTanggal(r.selesai);
}
