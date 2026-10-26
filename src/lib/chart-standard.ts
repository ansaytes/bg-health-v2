'use client';
// Standar tampilan grafik seluruh aplikasi.
//
// Aturan yang dikunci di sini supaya semua halaman konsisten:
//  1. ANIMASI
//     - donut : berputar SEARAH JARUM JAM (dimulai dari atas, bergerak ke kanan)
//     - bar   : tumbuh dari garis dasar
//     Semua grafik memakai `STANDAR_ANIMASI`.
//  2. JARAK BAR
//     Setiap batang dipisah celah seragam (BAR_GAP px) seperti diagram
//     "Distribusi Department" di dashboard Kunjungan Berobat.
//  3. WARNA
//     Palet lembut, gradasi berdekatan tidak kontras tajam.

import type { ChartOptions } from 'chart.js';

/** Animasi baku. Donut selalu berputar searah jarum jam. */
export const STANDAR_ANIMASI = {
  duration: 900,
  easing: 'easeOutQuart' as const,
  /** 0 = mulai dari pukul 12, bergerak ke kanan → searah jarum jam. */
  rotation: 0,
} as const;

/** Animasi baku khusus donut: berputar, tanpa scale. */
export const STANDAR_ANIMASI_DONUT = {
  ...STANDAR_ANIMASI,
  duration: 1000,
  animateRotate: true,
  animateScale: false,
} as const;

/**
 * Animasi baku khusus bar: tumbuh DARI GARIS DASAR (nilai 0 → nilai akhir).
 * `animateRotate`/`animateScale` tidak berlaku untuk bar dan harus dimatikan
 * agar Chart.js tidak memakai animasi default. `delay` bertahap per batang
 * (index) membuat batang muncul berurutan dari atas ke bawah.
 */
export const STANDAR_ANIMASI_BAR = {
  duration: 800,
  easing: 'easeOutQuart' as const,
  animateRotate: false,
  animateScale: false,
  delay: (ctx: { type: string; mode: string; dataIndex: number }) => {
    if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
    return ctx.dataIndex * 55;
  },
} as const;

/** Jarak seragam antarbatang, dalam piksel. */
export const BAR_GAP = 10;

/**
 * Opsi batang yang dipakai SEMUA diagram batang aplikasi.
 *
 * Chart.js tidak punya "jarak antarbatang" dalam piksel; jarak diatur lewat
 * categoryPercentage/barPercentage relatif terhadap lebar slot kategori.
 * Nilai di bawah = pola diagram "Distribusi Department" (Kunjungan Berobat)
 * yang sudah rapi — slot 72% tinggi area, batang mengisi 86% slot sehingga
 * tersisa celah seragam (BAR_GAP) di antara batang, berapa pun jumlah bar.
 * `maxBarThickness` membatasi batang agar tidak melebar pada diagram pendek.
 */
export const BAR_LAYOUT = {
  categoryPercentage: 0.72,
  barPercentage: 0.86,
  maxBarThickness: 18,
} as const;

/** Opsi elemen batang: sudut lembut + hover tanpa border tambahan. */
export const BAR_ELEMENT = {
  borderRadius: 4,
  borderSkipped: false as const,
};

/**
 * Palet batang aplikasi: SATU warna per batang, cerah dan mudah dibedakan.
 * Warna sengaja penuh warna (bukan satu keluarga hangat) supaya tiap batang
 * langsung terlihat berbeda pada latar terang maupun gelap, namun tetap
 * dengan opacity seragam agar tidak terasa ramai seperti pelangi murni.
 */
export const PALET_BAR = [
  'rgba(52, 152, 219, 0.85)',   // biru cerah
  'rgba(46, 204, 113, 0.85)',   // hijau cerah
  'rgba(241, 196, 15, 0.88)',   // kuning cerah
  'rgba(230, 126, 34, 0.85)',   // oranye
  'rgba(155, 89, 182, 0.85)',   // ungu
  'rgba(26, 188, 156, 0.85)',   // teal
  'rgba(231, 76, 60, 0.85)',    // merah
  'rgba(149, 165, 166, 0.85)',  // abu-abu
];

/** Warna bar ke-i (satu warna per batang, nada berdekatan). */
export function warnaBar(index: number): string {
  return PALET_BAR[index % PALET_BAR.length];
}

/** Versi koma: satu warna berbeda untuk setiap batang dalam satu diagram. */
export function banyakWarnaBar(count: number): string[] {
  return Array.from({ length: count }, (_, index) => warnaBar(index));
}

/** Gaya sumbu batang horizontal. */
export function opsiBarHorizontal(H: string, V: string): Record<string, unknown> {
  return {
    x: { beginAtZero: true, grace: '12%', grid: { color: V }, border: { display: false }, ticks: { precision: 0 } },
    y: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, padding: 6, maxRotation: 0 } },
  };
}

/** Palet lembut untuk batang berkategori. */
export const PALET_SOFT = [
  'rgba(52, 152, 219, 0.78)',   // biru
  'rgba(0, 184, 148, 0.74)',    // hijau tosca
  'rgba(243, 156, 18, 0.76)',   // amber
  'rgba(155, 89, 182, 0.72)',   // ungu
  'rgba(26, 188, 156, 0.72)',   // teal
  'rgba(230, 126, 34, 0.74)',   // oranye tua
  'rgba(41, 128, 185, 0.72)',   // biru tua
  'rgba(142, 68, 173, 0.70)',   // violet
  'rgba(22, 160, 133, 0.70)',   // hijau tua
  'rgba(192, 57, 43, 0.70)',    // merah bata
];

export const PALET_SOFT_BORDER = PALET_SOFT.map((c) => c.replace(/[\d.]+\)$/, '1)'));

/** Warna tegas untuk status (dipakai badge / bar status). */
export const WARNA_STATUS = {
  merah: 'rgba(231, 76, 60, 0.90)',
  merahCerah: 'rgba(255, 62, 48, 0.92)',
  kuningCerah: 'rgba(255, 196, 0, 0.92)',
  oranyeGelap: 'rgba(214, 108, 0, 0.90)',
  hijau: 'rgba(0, 184, 148, 0.85)',
} as const;

/**
 * Opsi dasar sumbu untuk bar horizontal/vertikal.
 * `autoSkip: false` wajib agar SEMUA label sumbu tampil (penyebab banyak
 * batang tanpa nama sebelumnya).
 */
export function skalaBar(opts: {
  horizontal: boolean;
  textColor: string;
  gridColor: string;
  fontFamily?: string;
  max?: number;
  suggestedMax?: number;
  labelOf?: (index: number) => string;
  /** Judul sumbu nilai, mis. "Hari sakit" / "Jumlah kunjungan". */
  valueTitle?: string;
  /** Judul sumbu kategori, mis. "Nama karyawan" / "Departemen". */
  categoryTitle?: string;
}): ChartOptions<'bar'>['scales'] {
  const font = opts.fontFamily ?? "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const categoryAxis = {
    grid: { display: false },
    ticks: {
      color: opts.textColor,
      font: { size: 9.5, family: font },
      autoSkip: false,
      callback: ((value: string | number) => {
        const label = opts.labelOf ? opts.labelOf(Number(value)) : String(value);
        return label.length > 22 ? `${label.slice(0, 20)}…` : label;
      }) as never,
    },
    // Keterangan sumbu wajib ada: tanpa ini banyak diagram tampil sebagai
    // deretan angka tanpa konteks.
    title: opts.categoryTitle
      ? { display: true, text: opts.categoryTitle, color: opts.textColor, font: { size: 9, family: font, weight: 'bold' as const } }
      : undefined,
  };
  const valueAxis = {
    beginAtZero: true,
    max: opts.max,
    suggestedMax: opts.suggestedMax,
    grid: { color: opts.gridColor },
    ticks: { color: opts.textColor, font: { size: 9, family: font }, precision: 0 as const },
    title: opts.valueTitle
      ? { display: true, text: opts.valueTitle, color: opts.textColor, font: { size: 9, family: font, weight: 'bold' as const } }
      : undefined,
  };
  return (opts.horizontal
    ? { x: valueAxis, y: categoryAxis }
    : { x: categoryAxis, y: valueAxis }) as ChartOptions<'bar'>['scales'];
}

/** Diagram donut berputar searah jarum jam. */
export const OPSI_DONUT = {
  cutout: '62%',
  radius: '82%',
  rotation: 0,
  circumference: 360,
} as const;
