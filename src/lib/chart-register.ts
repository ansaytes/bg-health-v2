'use client';

/**
 * Registrasi Chart.js MINIMAL untuk seluruh aplikasi.
 *
 * Hanya mendaftarkan controller/scale/plugin yang BENAR-BENAR dipakai:
 *   - bar      → diagram batang (19 penggunaan)
 *   - doughnut → donut/pie (7 penggunaan)
 *   - line     → tren garis (3 penggunaan)
 *
 * TIDAK didaftarkan: radar, bubble, scatter, polarArea, time scale,
 * logarithmic scale, dsb. Menghemat ~60–80 KB per chunk yang memakai
 * Chart.js dibanding registerables penuh.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  DoughnutController,
  LineController,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  DoughnutController,
  LineController,
  Legend,
  Tooltip,
  Filler,
  ChartDataLabels,
);

export { ChartJS };
