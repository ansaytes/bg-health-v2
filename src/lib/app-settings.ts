// ============================================================
// Pengaturan aplikasi (app_settings)
// ============================================================
//
// Satu sumber kebenaran untuk nilai yang bisa diubah tanpa deploy ulang:
// nomor dokumen, identitas perusahaan, batas waktu PAK, faskes rekanan,
// dsb. Disimpan di tabel `app_settings` (key -> value JSON).
//
// Nilai DEFAULT di bawah dipakai bila database belum berisi key tersebut,
// sehingga aplikasi tetap berjalan sebelum admin mengisi Setting.
//
// ROLE: baca = superuser/administrator/pic/manager (laporan butuh nomor
// dokumen); ubah = superuser saja (satu sumber kebenaran, bukan area kerja).

export interface PakDeadlines {
  /** Triase dokter maks N hari kerja sejak diterima (PAK-01). */
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

export interface DokumenSetting {
  /** Nomor resmi Form PAK-01/02/03 — draft belum bernomor. */
  formPak: string;
  /** Nomor resmi FORM/123 — penilaian kelaikan kerja. */
  form123: string;
  /** Nomor resmi HRA (FORM/069). */
  formHra: string;
  /** Nomor resmi FORM/116-118 (RULA/ROSA/WERA). */
  formRula: string;
  formRosa: string;
  formWera: string;
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

export interface AppSettings {
  perusahaan: PerusahaanSetting;
  dokumen: DokumenSetting;
  pak: PakDeadlines;
  faskes: FaskesSetting;
}

export const DEFAULT_SETTINGS: AppSettings = {
  perusahaan: {
    nama: 'PT. Bagong Dekaka Makmur',
    prefiksId: 'BG',
    alamat: '',
    zonaWaktu: 'WITA',
  },
  dokumen: {
    // Draft Form PAK belum bernumber — diisi lewat Setting saat resmi.
    formPak: 'BG/QSHE/FORM/___ (Form PAK — draft)',
    form123: 'BG/QSHE/FORM/123',
    formHra: 'BG/QSHE/FORM/069',
    formRula: 'BG/QSHE/FORM/116',
    formRosa: 'BG/QSHE/FORM/117',
    formWera: 'BG/QSHE/FORM/118',
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
};

/** Gabungan default + nilai tersimpan (tersimpan menang per key). */
export function mergeSettings(stored: Partial<AppSettings> | null | undefined): AppSettings {
  if (!stored) return { ...DEFAULT_SETTINGS };
  return {
    perusahaan: { ...DEFAULT_SETTINGS.perusahaan, ...(stored.perusahaan ?? {}) },
    dokumen: { ...DEFAULT_SETTINGS.dokumen, ...(stored.dokumen ?? {}) },
    pak: { ...DEFAULT_SETTINGS.pak, ...(stored.pak ?? {}) },
    faskes: { ...DEFAULT_SETTINGS.faskes, ...(stored.faskes ?? {}) },
  };
}

// ============================================================
// ID Register PAK — PAK-BGMMYY-NNN
// ============================================================
//
// Format sesuai keputusan: PAK + prefiks perusahaan + MMYY + nomor urut.
// MMYY diambil dari tanggal-jam DITERIMA di Register (PAK-01 bagian A) —
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
