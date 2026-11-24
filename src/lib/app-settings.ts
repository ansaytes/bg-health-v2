// Pengaturan aplikasi (app_settings)
//
// Satu sumber kebenaran untuk nilai yang bisa diubah tanpa deploy ulang:
// identitas perusahaan, batas waktu PAK, faskes rekanan, dan konfigurasi.
//
// Nilai DEFAULT di bawah dipakai bila database belum berisi key tersebut,
// sehingga aplikasi tetap berjalan sebelum admin mengisi Setting.
//
// ROLE: baca = superuser/administrator/pic/manager; ubah = superuser.

export interface PakDeadlines {
  /** Batas triase dokter dalam hari kerja sejak laporan diterima. */
  triaseHariKerja: number;
  /** Laporan medis ke QSHE Manager/PJO maks N x 24 jam. */
  laporanMedisJam: number;
  /** Laporan Tahap I ke BPJS TK maks N x 24 jam sejak diagnosis. */
  tahapSatuJam: number;
  /** Kesimpulan BPJS Ketenagakerjaan maks N hari kalender. */
  kesimpulanBpjsHari: number;
  /** Jawab permintaan informasi BPJS/pengawas maks N hari kerja. */
  jawabInfoHariKerja: number;
}

export interface PerusahaanSetting {
  nama: string;
  /** Prefiks ID dokumen internal, mis. "BG" pada PAK-BG0926-001. */
  prefiksId: string;
  alamat: string;
  /** Zona waktu untuk timestamp PAK/laporan. */
  zonaWaktu: 'WIB' | 'WITA' | 'WIT';
}

export interface FaskesSetting {
  /** Daftar fasilitas kesehatan rekanan (ProKawan + PAK). */
  rekanan: { nama: string; jenis: 'PKS' | 'BPJS' | 'Keduanya'; site: string[] }[];
  /** Kantor cabang BPJS Ketenagakerjaan untuk pelaporan Tahap I. */
  bpjsCabang: string;
  /** Dinas Provinsi / pengawas ketenagakerjaan pelaporan Tahap I, per site. */
  dinasPerSite: { site: string; instansi: string }[];
}

export interface NabLux {
  ruang_kerja: number;    // default 300
  ruang_gambar: number;   // default 750
  resepsionis: number;    // default 300
  ruang_arsip: number;    // default 150
  ruang_rapat: number;    // default 300
  ruang_makan: number;    // default 250
  koridor_lobi: number;   // default 100
}

export interface NabUdara {
  suhuMin: number;        // default 23
  suhuMax: number;        // default 26
  kelembabanMin: number;  // default 40
  kelembabanMax: number;  // default 60
  oksigenMin: number;     // default 19.5
  oksigenMax: number;     // default 23.5
  pm10Max: number;        // default 0.15
  asbesMax: number;       // default 0.1
}

export interface NabKebisingan {
  jam8: number;           // default 85 (dB)
  jam4: number;           // default 88
  jam2: number;           // default 91
  jam1: number;           // default 94
}

export interface NabSetting {
  lux: NabLux;
  udara: NabUdara;
  kebisingan: NabKebisingan;
}

export interface BrandingSetting {
  /** Nama aplikasi di antarmuka (default: 'BG-Health v2'). */
  namaAplikasi: string;
  /** URL/path logo perusahaan di sidebar atas (default: '/LogoBDM.png'). */
  logoPerusahaanUrl: string;
  /** URL/path banner bus di sidebar (default: '/Bus2023.png'). */
  logoBusUrl: string;
  /** URL/path logo Best K3 di kanan header (default: '/BestK3.png'). */
  logoBestK3Url: string;
  /** URL/path logo slogan di bawah sidebar (default: '/TuwuhLanNgrembaka_float.png'). */
  logoTuwuhUrl: string;
}

export interface AppSettings {
  perusahaan: PerusahaanSetting;
  branding: BrandingSetting;
  pak: PakDeadlines;
  faskes: FaskesSetting;
  nab: NabSetting;
}

export const DEFAULT_SETTINGS: AppSettings = {
  perusahaan: {
    nama: 'PT. Bagong Dekaka Makmur',
    prefiksId: 'BG',
    alamat: '',
    zonaWaktu: 'WITA',
  },
  branding: {
    namaAplikasi: 'BG-Health v2',
    logoPerusahaanUrl: '/LogoBDM.png',
    logoBusUrl: '/Bus2023.png',
    logoBestK3Url: '/BestK3.png',
    logoTuwuhUrl: '/TuwuhLanNgrembaka_float.png',
  },
  pak: {
    // INK/017: triase maks 1 hari kerja; laporan medis 1x24 jam;
    // Tahap I 2x24 jam 30 hari; jawab info 14 hari kerja.
    triaseHariKerja: 1,
    laporanMedisJam: 24,
    tahapSatuJam: 48,
    kesimpulanBpjsHari: 30,
    jawabInfoHariKerja: 14,
  },
  faskes: {
    rekanan: [],
    bpjsCabang: '',
    dinasPerSite: [],
  },
  nab: {
    // Permenkes No. 48 Tahun 2016 tentang Standar Keselamatan dan Kesehatan Kerja Perkantoran
    lux: {
      ruang_kerja: 300,
      ruang_gambar: 750,
      resepsionis: 300,
      ruang_arsip: 150,
      ruang_rapat: 300,
      ruang_makan: 250,
      koridor_lobi: 100,
    },
    udara: {
      suhuMin: 23,
      suhuMax: 26,
      kelembabanMin: 40,
      kelembabanMax: 60,
      oksigenMin: 19.5,
      oksigenMax: 23.5,
      pm10Max: 0.15,
      asbesMax: 0.1,
    },
    kebisingan: {
      jam8: 85,
      jam4: 88,
      jam2: 91,
      jam1: 94,
    },
  },
};

/** Gabungan default + nilai tersimpan (tersimpan menang per key). */
export function mergeSettings(stored: Partial<AppSettings> | null | undefined): AppSettings {
  if (!stored) return { ...DEFAULT_SETTINGS };
  return {
    perusahaan: { ...DEFAULT_SETTINGS.perusahaan, ...(stored.perusahaan ?? {}) },
    branding: { ...DEFAULT_SETTINGS.branding, ...(stored.branding ?? {}) },
    pak: { ...DEFAULT_SETTINGS.pak, ...(stored.pak ?? {}) },
    faskes: { ...DEFAULT_SETTINGS.faskes, ...(stored.faskes ?? {}) },
    nab: {
      lux: { ...DEFAULT_SETTINGS.nab.lux, ...(stored.nab?.lux ?? {}) },
      udara: { ...DEFAULT_SETTINGS.nab.udara, ...(stored.nab?.udara ?? {}) },
      kebisingan: { ...DEFAULT_SETTINGS.nab.kebisingan, ...(stored.nab?.kebisingan ?? {}) },
    },
  };
}

// ID Register PAK — PAK-BGMMYY-NNN
//
// Format sesuai keputusan: PAK + prefiks perusahaan + MMYY + nomor urut.
// MMYY diambil dari tanggal-jam diterima di Register —
// momen pertama yang tercatat dan tidak berubah (triase/diagnosis bisa
// mundur-maju, penerimaan tidak). Nomor urut direset per bulan.

export function prefiksIdRegister(prefiksPerusahaan: string, tanggalDiterima: Date): string {
  const mm = String(tanggalDiterima.getMonth() + 1).padStart(2, '0');
  const yy = String(tanggalDiterima.getFullYear()).slice(-2);
  return `PAK-${prefiksPerusahaan}${mm}${yy}`;
}

/** Batas triase dokter = tanggal diterima + N hari kerja (Senin-Jumat). */
export function batasTriase(tanggalDiterima: Date, hariKerja: number): Date {
  const d = new Date(tanggalDiterima);
  let left = hariKerja;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/** Tanggal + N x 24 jam (dipakai laporan medis 1x24 dan Tahap I 2x24). */
export function batasJam(tanggalMulai: Date, jam: number): Date {
  return new Date(tanggalMulai.getTime() + jam * 60 * 60 * 1000);
}

/** Selisih jam hingga deadline; negatif = lewat batas. */
export function sisaJam(deadline: Date, sekarang: Date = new Date()): number {
  return Math.round((deadline.getTime() - sekarang.getTime()) / (60 * 60 * 1000));
}
