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
  };
  const valueAxis = {
    beginAtZero: true,
    max: opts.max,
    suggestedMax: opts.suggestedMax,
    grid: { color: opts.gridColor },
    ticks: { color: opts.textColor, font: { size: 9, family: font }, precision: 0 as const },
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
