// ============================================================
// Pencahayaan & Kualitas Udara Dalam Ruangan — K3 Lingkungan Kerja
// ============================================================
//
// ACUAN PERATURAN YANG BERLAKU
// ----------------------------------------------------------------
// 1. **Permenaker No. 5 Tahun 2018** tentang Keselamatan dan Kesehatan Kerja
//    Lingkungan Kerja — Pasal 40–42 (Kualitas Udara Dalam Ruang Kerja/KUDR):
//      • suhu kering            23–26 °C
//      • kelembapan             40–60 %
//      • perbedaan suhu antar ruang  maksimal 5 °C
//      • kadar oksigen          19,5–23,5 % volume udara
//      • ruang udara (cubic space)  minimal 10 m³ per orang
//      • tinggi ruangan         minimal 3 m (di atas 4 m tidak dihitung)
//      • pembersihan ventilasi buatan  minimal setiap 3 bulan
//      • debu respirabel & asbes  mengacu Lampiran NAB Permenaker
//
// 2. **Permenkes No. 48 Tahun 2016** tentang Standar K3 Perkantoran —
//    Tabel 4 (tingkat pencahayaan minimal per peruntukan ruang) dan
//    Tabel 1 (parameter kualitas udara dalam ruangan).
//      • debu respirabel PM10   maksimal 0,15 mg/m³ (rata-rata 8 jam)
//      • asbes bebas            maksimal 0,1 serat/ml udara
//      • pencahayaan darurat    minimal 5 % dari intensitas normal
//
// KEDUA PERATURAN INI ADALAH ACUAN YANG DIPAKAI PT BDM (STD/005 Rev.001),
// sehingga angka di modul ini SAMA dengan dokumen internal — bukan tafsiran baru.
//
// MENGAPA PENGUKURAN DIPISAH DARI CHECKLIST SANITASI
// ----------------------------------------------------------------
// Pencahayaan dan kualitas udara tidak dapat dinilai dari satu angka per site:
//   • Pencahayaan bergantung peruntukan ruang (arsip 150 lux vs gambar 750 lux)
//     dan harus diukur pada BIDANG KERJA (0,85 m untuk meja kerja).
//   • PM10 diukur sebagai RATA-RATA 8 JAM, bukan sekali tembak.
//   • Debu, asbes, dan gas memerlukan alat berbeda.
// Karena itu datanya per RUANG dan per TITIK, bukan per site.
// ============================================================

export type PeruntukanRuang =
  | 'ruang_kerja' | 'ruang_gambar' | 'resepsionis' | 'ruang_arsip'
  | 'ruang_rapat' | 'ruang_makan' | 'koridor_lobi' | 'lainnya';

/** Ambang pencahayaan minimal — Permenkes 48/2016 Tabel 4. */
export const NAB_LUX: Record<PeruntukanRuang, { min: number | null; label: string; sumber: string }> = {
  ruang_kerja: { min: 300, label: 'Ruang kerja', sumber: 'Permenkes 48/2016 Tabel 4' },
  ruang_gambar: { min: 750, label: 'Ruang gambar', sumber: 'Permenkes 48/2016 Tabel 4' },
  resepsionis: { min: 300, label: 'Resepsionis', sumber: 'Permenkes 48/2016 Tabel 4' },
  ruang_arsip: { min: 150, label: 'Ruang arsip', sumber: 'Permenkes 48/2016 Tabel 4' },
  ruang_rapat: { min: 300, label: 'Ruang rapat', sumber: 'Permenkes 48/2016 Tabel 4' },
  ruang_makan: { min: 250, label: 'Ruang makan', sumber: 'Permenkes 48/2016 Tabel 4' },
  koridor_lobi: { min: 100, label: 'Koridor / lobi', sumber: 'Permenkes 48/2016 Tabel 4' },
  // Tidak ada angka dalam dokumen — TIDAK dikarang, dinilai secara klinis.
  lainnya: { min: null, label: 'Lainnya', sumber: 'Tidak diatur — tetapkan manual' },
};

/** Ambang kualitas udara — Permenaker 5/2018 Pasal 40–42 & Permenkes 48/2016. */
export const NAB_UDARA = {
  suhu: { min: 23, max: 26, satuan: '°C', sumber: 'Permenaker 5/2018 Pasal 40' },
  kelembapan: { min: 40, max: 60, satuan: '%', sumber: 'Permenaker 5/2018 Pasal 40' },
  oksigen: { min: 19.5, max: 23.5, satuan: '%', sumber: 'Permenaker 5/2018 Pasal 41' },
  pm10: { min: null, max: 0.15, satuan: 'mg/m³', sumber: 'Permenkes 48/2016 Tabel 1' },
  asbes: { min: null, max: 0.1, satuan: 'serat/ml', sumber: 'Permenkes 48/2016 Tabel 1' },
} as const;

/** Ambang lain yang tidak berupa angka tunggal. */
export const NAB_LAIN = {
  ruangUdaraPerOrang: { min: 10, satuan: 'm³/orang', sumber: 'Permenaker 5/2018 Pasal 42' },
  tinggiRuangan: { min: 3, satuan: 'm', sumber: 'Permenaker 5/2018 Pasal 42' },
  bedaSuhuAntarRuang: { max: 5, satuan: '°C', sumber: 'Permenaker 5/2018 Pasal 40' },
  pembersihanVentilasiBulan: { max: 3, satuan: 'bulan', sumber: 'Permenaker 5/2018 Pasal 42' },
  pencahayaanDaruratPersen: { min: 5, satuan: '% dari normal', sumber: 'Permenkes 48/2016 Tabel 4' },
  /** Tinggi bidang kerja lazim untuk pengukuran lux di meja. */
  tinggiBidangKerjaCm: 85,
} as const;

export type StatusUkur = 'memenuhi' | 'tidak-memenuhi' | 'tidak-dinilai';

export interface HasilTitik {
  lux: number | null;
  suhu: number | null;
  kelembapan: number | null;
  oksigen: number | null;
  pm10: number | null;
  asbes: number | null;
}

export interface PenilaianRuang {
  peruntukan: PeruntukanRuang;
  /** Ambang lux untuk peruntukan ini; null bila dokumen tidak mengatur. */
  nabLux: number | null;
  luxMin: number | null;
  luxRata: number | null;
  luxMaks: number | null;
  statusLux: StatusUkur;
  statusUdara: {
    parameter: string;
    label: string;
    nilai: number | null;
    min: number | null;
    max: number | null;
    satuan: string;
    status: StatusUkur;
    sumber: string;
  }[];
  /** Ruang udara per orang dari luas × tinggi ÷ jumlah pekerja. */
  ruangUdaraPerOrang: number | null;
  statusRuangUdara: StatusUkur;
  statusTinggiRuangan: StatusUkur;
  /** Jumlah parameter tidak memenuhi — untuk ringkasan dashboard. */
  jumlahTidakMemenuhi: number;
}

function angka(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function nilaikan(n: number | null, min: number | null, max: number | null): StatusUkur {
  if (n === null) return 'tidak-dinilai';
  if (min !== null && n < min) return 'tidak-memenuhi';
  if (max !== null && n > max) return 'tidak-memenuhi';
  return 'memenuhi';
}

/**
 * Menilai satu ruang dari hasil titik ukurnya.
 *
 * ATURAN PENTING — RATA-RATA vs MINIMUM untuk pencahayaan:
 * Dokumen menetapkan "tingkat pencahayaan minimal", yang berlaku di SELURUH
 * area kerja. Karena itu penilaian memakai **nilai TERENDAH** antar titik,
 * bukan rata-rata: satu pojok yang gelap tetap pelanggaran meski rata-rata
 * ruangan mencukupi.
 */
export function nilaiRuang(input: {
  peruntukan: PeruntukanRuang;
  luasM2: number | null;
  jumlahPekerja: number | null;
  tinggiRuanganM: number | null;
  titik: HasilTitik[];
}): PenilaianRuang {
  const nab = NAB_LUX[input.peruntukan];

  const luxList = input.titik.map((t) => t.lux).filter((v): v is number => v !== null);
  const luxMin = luxList.length ? Math.min(...luxList) : null;
  const luxMaks = luxList.length ? Math.max(...luxList) : null;
  const luxRata = luxList.length
    ? Number((luxList.reduce((a, b) => a + b, 0) / luxList.length).toFixed(1))
    : null;

  // Penilaian pencahayaan memakai nilai TERENDAH antar titik.
  const statusLux = nab.min === null
    ? 'tidak-dinilai'
    : nilaikan(luxMin, nab.min, null);

  // Kualitas udara: setiap parameter punya NAB sendiri.
  const statusUdara = [
    { parameter: 'suhu', label: 'Suhu', kunci: 'suhu' as const, nab: NAB_UDARA.suhu },
    { parameter: 'kelembapan', label: 'Kelembapan', kunci: 'kelembapan' as const, nab: NAB_UDARA.kelembapan },
    { parameter: 'oksigen', label: 'Kadar oksigen', kunci: 'oksigen' as const, nab: NAB_UDARA.oksigen },
    { parameter: 'pm10', label: 'Debu PM10', kunci: 'pm10' as const, nab: NAB_UDARA.pm10 },
    { parameter: 'asbes', label: 'Asbes bebas', kunci: 'asbes' as const, nab: NAB_UDARA.asbes },
  ].map((p) => {
    const nilaiArr = input.titik.map((t) => t[p.kunci]).filter((v): v is number => v !== null);
    // Untuk parameter berbahaya (PM10, asbes) dipakai nilai TERTINGGI;
    // untuk suhu/kelembapan/oksigen dipakai nilai terjauh dari rentang.
    let nilai: number | null = null;
    if (nilaiArr.length) {
      nilai = p.nab.max !== null && p.nab.min === null
        ? Math.max(...nilaiArr)
        : nilaiArr.reduce((acc, v) => {
          const jauh = (x: number) => Math.max(
            p.nab.min !== null ? p.nab.min - x : -Infinity,
            p.nab.max !== null ? x - p.nab.max : -Infinity,
          );
          return jauh(v) > jauh(acc) ? v : acc;
        });
    }
    return {
      parameter: p.parameter,
      label: p.label,
      nilai,
      min: p.nab.min,
      max: p.nab.max,
      satuan: p.nab.satuan,
      status: nilaikan(nilai, p.nab.min, p.nab.max),
      sumber: p.nab.sumber,
    };
  });

  // Ruang udara per orang = luas × tinggi ÷ jumlah pekerja.
  const ruangUdaraPerOrang =
    input.luasM2 && input.tinggiRuanganM && input.jumlahPekerja
      ? Number(((input.luasM2 * input.tinggiRuanganM) / input.jumlahPekerja).toFixed(1))
      : null;
  const statusRuangUdara = nilaikan(ruangUdaraPerOrang, NAB_LAIN.ruangUdaraPerOrang.min, null);
  const statusTinggiRuangan = nilaikan(input.tinggiRuanganM, NAB_LAIN.tinggiRuangan.min, null);

  const jumlahTidakMemenuhi =
    (statusLux === 'tidak-memenuhi' ? 1 : 0) +
    statusUdara.filter((u) => u.status === 'tidak-memenuhi').length +
    (statusRuangUdara === 'tidak-memenuhi' ? 1 : 0) +
    (statusTinggiRuangan === 'tidak-memenuhi' ? 1 : 0);

  return {
    peruntukan: input.peruntukan,
    nabLux: nab.min,
    luxMin, luxRata, luxMaks,
    statusLux,
    statusUdara,
    ruangUdaraPerOrang,
    statusRuangUdara,
    statusTinggiRuangan,
    jumlahTidakMemenuhi,
  };
}

/** Luas minimum bidang kerja yang perlu diukur = menerima luas ruang. */
export const CATATAN_METODE = {
  lux: 'Diukur pada bidang kerja (lazim 0,85 m untuk meja), minimal 1 titik per 4 m² atau sesuai prosedur alat; penilaian memakai nilai TERENDAH.',
  suhu: 'Suhu kering diukur pada ketinggian kerja, jauh dari sumber panas/dingin langsung.',
  pm10: 'Debu respirabel diukur rata-rata 8 jam kerja.',
  asbes: 'Hanya pada ruang berisiko (bangunan lama, area perawatan material berserat).',
  oksigen: 'Diukur pada area kerja dengan ventilasi terbatas atau ruang tertutup.',
} as const;

export { angka };
