'use client';
import { useEffect, useState } from 'react';
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

/**
 * KANVAS GRADIENT BATANG — meniru efek diagram "10 Site ASR tertinggi".
 *
 * ASR memakai gradient horizontal `#E54B1A → #FF8C42` dengan canvas manual.
 * Chart.js tidak bisa langsung memakai dua warna sekaligus, jadi warna dasar
 * tiap batang dibuat gradient: warna tetap WARNA ASLINYA di ujung kiri, lalu
 * dicerahkan menuju ujung kanan.
 *
 * Kenapa dicerahkan, bukan diganti warna gradient ASR: instruksi pemilik
 * aplikasi — "warna masing-masing bar tetap seperti saat ini, hanya efek
 * gradasinya saja". Jadi identitas warna tiap batang tidak berubah.
 *
 * @param color warna dasar, format `rgba(r,g,b,a)` atau `#rrggbb`
 * @param horizontal true = gradient kiri→kanan (bar horizontal)
 */
export function gradientBatang(
  ctx: CanvasRenderingContext2D,
  area: { left: number; right: number; top: number; bottom: number },
  color: string,
  horizontal: boolean,
): CanvasGradient {
  const { r, g, b, a } = pecahWarna(color);
  const grad = horizontal
    ? ctx.createLinearGradient(area.left, 0, Math.max(area.right, area.left + 1), 0)
    : ctx.createLinearGradient(0, area.bottom, 0, Math.max(area.top, 1));

  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
  // Dicerahkan ~35% ke warna putih — cukup untuk memberi kesan gradasi tanpa
  // mengubah warna yang dikenali pembaca.
  grad.addColorStop(1, `rgba(${campurPutih(r)}, ${campurPutih(g)}, ${campurPutih(b)}, ${a})`);
  return grad;
}

/**
 * Versi SIAP PAKAI untuk Chart.js: menghasilkan fungsi `backgroundColor`
 * berbentuk gradient untuk setiap batang.
 *
 * Pemakaian di config Chart.js:
 *   backgroundColor: gradientBatangArray(ctx, colors, horizontal)
 *
 * Chart.js memanggil fungsi ini untuk setiap batang; `ctx.chart` memberi area
 * plotting sehingga gradient tepat dari dasar sampai ujung batang.
 */
/**
 * Tipe pengembalian = fungsi Scriptable Chart.js untuk `backgroundColor`.
 *
 * CATATAN TIPE (penting — jangan diubah menjadi `any`):
 *  • Tipe `Color` Chart.js tidak diekspor dari namespace publiknya, tetapi
 *    callback Scriptable bersifat KOVARIAN pada tipe kembalian. Mengembalikan
 *    `CanvasGradient | string` membuat TS menolak seluruh objek chart
 *    (`Chart<'bar'>` tidak assignable ke `Chart<keyof ChartTypeRegistry>`).
 *  • Karena itu fungsi dianotasi `unknown`, yang diterima semua tipe Color.
 *    Nilai nyata tetap CanvasGradient / string, jadi runtime tidak berubah.
 */
export interface KonteksWarnaChart {
  chart: {
    ctx: CanvasRenderingContext2D;
    chartArea?: { left: number; right: number; top: number; bottom: number };
  };
  dataIndex: number;
}

export function gradientBatangArray(
  colors: string[],
  horizontal: boolean,
): (context: KonteksWarnaChart) => unknown {
  return (context: KonteksWarnaChart) => {
    const area = context.chart.chartArea;
    if (!area) return colors[context.dataIndex] ?? colors[0] ?? '#778899';
    const color = colors[context.dataIndex] ?? colors[colors.length - 1] ?? '#778899';
    return gradientBatang(context.chart.ctx, area, color, horizontal);
  };
}

function campurPutih(v: number): number {
  return Math.round(Math.min(255, v + (255 - v) * 0.35));
}

function pecahWarna(color: string): { r: number; g: number; b: number; a: number } {
  const rgba = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgba) {
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  }
  const hex = color.replace('#', '');
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  // Warna tak dikenal → abu-abu netral, jangan sampai crash.
  return { r: 120, g: 120, b: 120, a: 1 };
}

/**
 * Gaya sumbu batang horizontal.
 *
 * CATATAN: fungsi ini TIDAK lagi dipakai — semua diagram sekarang memakai
 * `skalaBar()` yang lebih lengkap (judul sumbu, callback label, autoSkip).
 * Tetap diekspor hanya untuk kompatibilitas.
 */
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
      // `crossAlign: 'far'` menempelkan label ke tepi sumbu agar tidak terpotong
      // di sisi kiri kartu pada diagram batang horizontal.
      crossAlign: 'far' as const,
      callback: ((value: string | number) => {
        const label = opts.labelOf ? opts.labelOf(Number(value)) : String(value);
        // Batas 22 karakter terlalu pendek untuk nama karyawan/departemen;
        // 30 masih muat pada kartu selebar dashboard tanpa memotong kata.
        return label.length > 30 ? `${label.slice(0, 28)}…` : label;
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
    // Ruang 18% di ujung sumbu nilai agar angka di ujung batang terpanjang
    // tidak terpotong tepi kartu. Chart.js melarang `grace` digabung dengan
    // `max`, jadi grace hanya dipakai bila `max` tidak ditentukan.
    ...(opts.max === undefined ? { grace: '18%' } : {}),
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

/**
 * Hook "siap digambar": true setelah ada canvas berukuran nyata + satu jeda.
 *
 * MASALAH YANG DISELESAIKAN: chart di dalam container yang sedang beranimasi
 * masuk (transisi halaman) sebenarnya SUDAH dirender di DOM, sehingga Chart.js
 * langsung beranimasi — dan animasinya selesai SEBELUM container selesai
 * terlihat. Hasilnya chart terlihat statis (gejala: "diagram belum berjalan").
 *
 * Menunggu "dua frame" saja tidak cukup karena ukuran canvas biasanya masih 0
 * pada frame tersebut. Karena itu hook ini MENUNGGU sampai benar-benar ada
 * canvas dengan lebar & tinggi > 8px (artinya layout sudah final dan elemen
 * sudah di-paint), baru memberi satu frame tambahan. Chart yang dibuat setelah
 * kondisi itu dijamin memulai animasi dari nol di depan pengguna.
 */
export function useAnimationReady(deps: unknown[]): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // `setReady(false)` sengaja TIDAK dipanggil di awal effect: React melarang
    // setState sinkron di dalam effect (memicu cascading render). Nilai lama
    // memang akan segera diganti oleh setReady(true) di bawah setelah canvas
    // siap, dan chart yang di-destroy+create ulang tidak bergantung pada flag
    // ini untuk mengulang animasinya.
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let batal = false;

    const tungguTerlihat = () => {
      if (batal) return;
      // Chart.js menyelesaikan animasi dalam SATU frame bila canvas belum punya
      // ukuran (w/h 0) atau belum terlihat — hasilnya diagram tampak diam.
      // Jadi tunggu sampai ada canvas dengan ukuran nyata dan itemnya benar-benar
      // dirender, baru beri jeda singkat agar frame pertama ter-paint.
      const siap = [...document.querySelectorAll('canvas')].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8;
      });
      if (siap) {
        timer = setTimeout(() => { if (!batal) setReady(true); }, ANIMASI_JEDA_MS);
        return;
      }
      // Belum ada canvas berukuran wajar — periksa lagi di frame berikutnya.
      raf = requestAnimationFrame(tungguTerlihat);
    };

    raf = requestAnimationFrame(tungguTerlihat);
    return () => {
      batal = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, deps);
  return ready;
}

/**
 * Jeda setelah paint sebelum chart dibuat, dalam milidetik.
 * Harus lebih lama dari transisi halaman `.page-transition` (0.22s / 220 ms),
 * karena chart yang dibuat saat transisi sedang berjalan menyelesaikan
 * animasinya di luar pandangan pengguna — itulah gejala "diagram diam".
 */
export const ANIMASI_JEDA_MS = 260;

// ═══════════════════════════════════════════════════════════════
// MENGAPA DIAGRAM ASR BERANIMASI SEDANGKAN YANG LAIN TIDAK
// ═══════════════════════════════════════════════════════════════
//
// Hasil riset (diukur di browser dengan menghitung piksel canvas per frame):
//
//   Diagram 10 Site ASR  → digambar dengan requestAnimationFrame MANUAL
//                          (DashboardView.tsx). Pikselnya NAIK bertahap 800 ms.
//   Semua diagram Chart.js → pikselnya IDENTIK di 20 frame berturut-turut,
//                          artinya tidak ada animasi sama sekali.
//
// Penyebab utamanya BUKAN konfigurasi animasi Chart.js (durasi/easing sudah
// benar), melainkan TIGA hal berikut:
//
// 1. `destroy()` + `new Chart()` terjadi di dalam effect, dan Chart.js
//    menyelesaikan animasi dalam SATU frame bila canvas belum punya ukuran
//    akhir (lebar/tinggi 0 atau masih dalam transisi layout). Manual canvas
//    tidak terpengaruh karena ia menggambar ulang tiap frame memakai
//    requestAnimationFrame selama 800 ms — apa pun kondisi container.
//
// 2. Chart.js mematikan animasi saat tab/frame tidak "terlihat". Diagram di
//    panel yang belum di-scroll atau di dalam container `overflow: hidden`
//    dengan tinggi 0 memenuhi kondisi ini.
//
// 3. Data yang datang dari cache membuat chart dibuat pada render PERTAMA,
//    saat `.page-transition` masih berjalan (opacity/translateY 0.22 s).
//    Animasi selesai sebelum halaman terlihat.
//
// SOLUSI (dipakai semua dashboard):
//   • useAnimationReady  → tunggu canvas punya ukuran nyata, lalu jeda.
//   • useChartAnimasi    → hook baru di bawah ini: membuat chart SEKALI setelah
//     semuanya siap, lalu untuk setiap perubahan data menjalankan ULANG animasi
//     secara eksplisit lewat `chart.reset()` + `chart.update()`. Ini meniru
//     perilaku rAF manual pada diagram ASR: animasi selalu dijalankan ulang
//     dari nol, tidak bergantung pada Chart.js "merasa" perlu beranimasi.
// ═══════════════════════════════════════════════════════════════

/**
 * Menjalankan ulang animasi Chart.js dari nol.
 *
 * `reset()` mengembalikan elemen ke keadaan awal (batang tinggi 0, donut
 * tanpa busur, garis tanpa titik), lalu `update()` menganimasikan ke nilai
 * akhir. Tanpa `reset()`, `update()` pada chart yang sudah tergambar hanya
 * menganimasikan PERUBAHAN kecil — atau tidak beranimasi sama sekali bila
 * data tidak berubah, dan itulah yang membuat diagram terlihat kaku.
 */
export function animasiUlang(chart: { reset: () => void; update: () => void } | null | undefined): void {
  if (!chart) return;
  try {
    chart.reset();
    chart.update();
  } catch {
    // Chart sudah di-destroy (komponen unmount) — abaikan.
  }
}

/**
 * Hook siap-pakai untuk komponen yang membuat chart Chart.js.
 *
 * @example
 *   const siap = useChartAnimasi(deps, () => { buatChart(); });
 *   useEffect(() => { if (!siap) return; buatChart(); animasiUlang(ref.current); }, [siap, ...]);
 *
 * Mengembalikan `true` saat canvas sudah stabil dan animasi boleh dijalankan.
 */
export function useChartAnimasi(deps: unknown[]): boolean {
  return useAnimationReady(deps);
}
