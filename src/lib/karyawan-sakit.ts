// ============================================================
// Fase pemantauan karyawan sakit — BG/QSHE/SOP/027 Rev.002
// ============================================================
//
// Tabel fase diambil dari SOP/027 poin 6.5 (Ringkasan Jadwal Pemantauan):
//
//   Hari 1–14       Fase Awal        Asesmen ≤2×24 jam, verifikasi SKS,
//                                    buka FORM/101, info QSHE Manager
//   Minggu 3–4      Fase Lanjutan    Kontak lanjutan, konfirmasi diagnosis,
//                                    minta perpanjangan SKS
//   Bulan 2–3       Fase Aktif       Kontak tiap 14 hari, laporan bulanan
//   Bulan 4–8       Fase Intensif    Kontak tiap bulan, kunjungan ≥1×/3 bln,
//                                    Resume Medis tiap 2 bln
//   Bulan 9–11      Fase Persiapan   Kunjungan ≥1×, FORM/101 harus lengkap
//   Bulan 12+       Fase Rekomendasi Terbitkan FORM/123
//
// CATATAN PENTING
// Batas fase dihitung dari TANGGAL MULAI SAKIT (poin 6.6.1), BUKAN dari
// tanggal penerbitan surat rekomendasi. Itu sebabnya `hitungFase` menerima
// tanggal mulai sakit secara eksplisit.
//
// Frekuensi kontak adalah KEWAJIBAN MINIMUM. Sistem menghitung jadwal
// berikutnya dari frekuensi tersebut, tetapi QSHE Medic boleh memajukan
// (mis. kondisi memburuk) — karena itu jadwal tersimpan bisa ditimpa manual.

export type FaseSakit =
  | 'AWAL'
  | 'LANJUTAN'
  | 'AKTIF'
  | 'INTENSIF'
  | 'PERSIAPAN'
  | 'REKOMENDASI';

export interface DefinisiFase {
  fase: FaseSakit;
  label: string;
  /** Rentang hari (1-based, inklusif) sejak tanggal mulai sakit. */
  hariMulai: number;
  hariSelesai: number;
  /** Interval kontak minimum, dalam hari. null = tidak ada kewajiban berkala. */
  intervalKontakHari: number | null;
  /** Kunjungan langsung minimum (dalam bulan), bila diwajibkan. */
  kunjunganLangsungPerBulan?: number;
  kewajiban: string[];
}

export const FASE: DefinisiFase[] = [
  {
    fase: 'AWAL',
    label: 'Fase Awal',
    hariMulai: 1,
    hariSelesai: 14,
    intervalKontakHari: null, // asesmen awal cukup sekali, ≤2×24 jam
    kewajiban: [
      'Asesmen awal melalui telepon/telemedicine maksimal 2×24 jam (untuk sakit ≥3 hari)',
      'Verifikasi keaslian SKS',
      'Buka Formulir Pemantauan (FORM/101)',
      'Informasikan kondisi awal kepada QSHE Manager',
    ],
  },
  {
    fase: 'LANJUTAN',
    label: 'Fase Lanjutan',
    hariMulai: 15,
    hariSelesai: 28,
    intervalKontakHari: 14,
    kewajiban: [
      'Kontak lanjutan',
      'Konfirmasi diagnosis dan perkembangan',
      'Minta perpanjangan SKS bila masa berlaku habis',
      'Laporan ke QSHE Manager',
    ],
  },
  {
    fase: 'AKTIF',
    label: 'Fase Aktif',
    hariMulai: 29,
    hariSelesai: 92,
    intervalKontakHari: 14,
    kewajiban: [
      'Kontak minimum setiap 14 hari',
      'Isi FORM/101 bulanan',
      'Koordinasi spesialis bila diperlukan',
      'Verifikasi kepesertaan BPJS aktif',
      'Laporan bulanan ke QSHE Manager',
    ],
  },
  {
    fase: 'INTENSIF',
    label: 'Fase Intensif',
    hariMulai: 93,
    hariSelesai: 244,
    intervalKontakHari: 30,
    kunjunganLangsungPerBulan: 1 / 3,
    kewajiban: [
      'Kontak setiap bulan',
      'Kunjungan langsung minimal 1× setiap 3 bulan',
      'Medical Assessment formal bersama dokter spesialis',
      'Susun Resume Medis setiap 2 bulan',
      'Dokumentasikan seluruh hasil pemeriksaan penunjang',
    ],
  },
  {
    fase: 'PERSIAPAN',
    label: 'Fase Persiapan Rekomendasi',
    hariMulai: 245,
    hariSelesai: 334,
    intervalKontakHari: 30,
    kunjunganLangsungPerBulan: 1,
    kewajiban: [
      'Kunjungan langsung minimal 1×',
      'Evaluasi komprehensif prognosis',
      'Kumpulkan seluruh dokumen pendukung',
      'Pastikan FORM/101 seluruh periode lengkap tanpa jeda',
      'Susun Resume Medis final',
    ],
  },
  {
    fase: 'REKOMENDASI',
    label: 'Penerbitan Rekomendasi',
    hariMulai: 335,
    hariSelesai: Number.POSITIVE_INFINITY,
    intervalKontakHari: 30,
    kunjunganLangsungPerBulan: 1,
    kewajiban: [
      'Terbitkan Surat Rekomendasi (FORM/123) sesuai kondisi terkini',
      'Ajukan persetujuan QSHE Manager dan General Manager',
    ],
  },
];

/** Selisih hari (kalender) antara dua tanggal, dihitung dari tanggal lokal. */
export function selisihHari(mulai: string, sekarang: Date = new Date()): number {
  const d = new Date(`${mulai.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  return Math.floor((hariIni.getTime() - d.getTime()) / 86_400_000) + 1;
}

/** Fase yang berlaku pada hari ke-`hari` sejak mulai sakit. */
export function faseUntukHari(hari: number): DefinisiFase {
  return FASE.find((f) => hari >= f.hariMulai && hari <= f.hariSelesai) ?? FASE[FASE.length - 1];
}

export function hitungFase(tanggalMulaiSakit: string, sekarang: Date = new Date()): {
  hari: number;
  definisi: DefinisiFase;
  /** Hari menuju jadwal kontak berikutnya; negatif = terlambat. */
  sisaHariKontak: number | null;
} {
  const hari = selisihHari(tanggalMulaiSakit, sekarang);
  const definisi = faseUntukHari(hari);
  return { hari, definisi, sisaHariKontak: null };
}

/**
 * Jadwal pemantauan berikutnya menurut fase.
 *
 * Untuk Fase Awal (belum ada kewajiban berkala), jadwal jatuh pada hari ke-15
 * — awal Fase Lanjutan. Itu titik ketika kontak berikutnya memang diwajibkan.
 *
 * @param tanggalTerakhirKontak tanggal kontak terakhir (atau mulai sakit)
 */
export function jadwalBerikutnya(
  tanggalMulaiSakit: string,
  tanggalTerakhirKontak: string | null,
  sekarang: Date = new Date(),
): { tanggal: string; alasan: string } | null {
  const hari = selisihHari(tanggalMulaiSakit, sekarang);
  const fase = faseUntukHari(hari);

  if (fase.intervalKontakHari === null) {
    // Fase Awal: jadwal = hari ke-15 (awal Fase Lanjutan).
    const mulai = new Date(`${tanggalMulaiSakit.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(mulai.getTime())) return null;
    const target = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + 14);
    return {
      tanggal: target.toISOString().slice(0, 10),
      alasan: `Awal Fase Lanjutan (hari ke-15) — ${fase.kewajiban[0]}`,
    };
  }

  const dasar = tanggalTerakhirKontak
    ? new Date(`${tanggalTerakhirKontak.slice(0, 10)}T00:00:00`)
    : new Date(`${tanggalMulaiSakit.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dasar.getTime())) return null;

  const target = new Date(dasar.getFullYear(), dasar.getMonth(), dasar.getDate() + fase.intervalKontakHari);
  return {
    tanggal: target.toISOString().slice(0, 10),
    alasan: `${fase.label}: kontak minimum setiap ${fase.intervalKontakHari} hari`,
  };
}

/**
 * Memeriksa kelayakan penerbitan status UNFIT menurut SOP/027 poin 6.5.5.
 *
 * Syarat dokumen (a–f):
 *   (a) durasi signifikan dengan pemantauan terdokumentasi
 *   (b) diagnosis dari dokter spesialis yang kompeten
 *   (c) prognosis menunjukkan kondisi tidak dapat pulih
 *   (d) tatalaksana adekuat telah diberikan tanpa perbaikan bermakna
 *   (e) minimal 2 hasil pemeriksaan formal berjarak minimal 30 hari, konsisten
 *   (f) seluruh rekam pemantauan (FORM/101) lengkap tanpa jeda
 *
 * Yang bisa DIPERIKSA OTOMATIS hanya (e) dan sebagian (f) — sisanya penilaian
 * klinis. Fungsi ini mengembalikan daftar syarat yang belum terpenuhi agar
 * QSHE Medic tidak menerbitkan Unfit secara prematur.
 */
export function periksaSyaratUnfit(input: {
  jumlahRekomendasi: number;
  tanggalRekomendasi: string[];
  statusRekomendasi: string[];
  jumlahPemantauan: number;
  faseTerkini: FaseSakit;
}): { boleh: boolean; belumTerpenuhi: string[] } {
  const belum: string[] = [];

  // (e) minimal 2 pemeriksaan formal berjarak ≥30 hari
  const tanggal = input.tanggalRekomendasi
    .map((t) => new Date(`${t.slice(0, 10)}T00:00:00`))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (tanggal.length < 2) {
    belum.push('Minimal 2 hasil pemeriksaan formal (baru ada ' + tanggal.length + ')');
  } else {
    const jarak = (tanggal[tanggal.length - 1].getTime() - tanggal[0].getTime()) / 86_400_000;
    if (jarak < 30) {
      belum.push(`Jarak antar-pemeriksaan formal minimal 30 hari (baru ${Math.round(jarak)} hari)`);
    }
  }

  // Konsistensi hasil: tidak boleh ada perubahan status yang bertentangan.
  const unik = new Set(input.statusRekomendasi.filter((s) => s !== 'CURRENTLY_UNFIT'));
  if (unik.size > 1) {
    belum.push(`Hasil pemeriksaan belum konsisten (${[...unik].join(', ')})`);
  }

  // (f) rekam pemantauan lengkap
  if (input.jumlahPemantauan < 2) {
    belum.push('Rekam pemantauan (FORM/101) belum memadai — minimal 2 catatan kontak');
  }

  // (a) durasi signifikan
  if (input.faseTerkini === 'AWAL' || input.faseTerkini === 'LANJUTAN') {
    belum.push('Durasi sakit belum mencapai fase yang memadai untuk penetapan Unfit permanen');
  }

  return { boleh: belum.length === 0, belumTerpenuhi: belum };
}

/** Label status kelayakan FORM/123. */
export const STATUS_KELAYAKAN_LABEL: Record<string, string> = {
  FIT: 'Fit',
  FIT_WITH_NOTE: 'Fit with Note',
  CURRENTLY_UNFIT: 'Currently Unfit',
  UNFIT: 'Unfit',
};

export const STATUS_KELAYAKAN_WARNA: Record<string, string> = {
  FIT: '#00B894',
  FIT_WITH_NOTE: '#3498DB',
  CURRENTLY_UNFIT: '#FF7A00',
  UNFIT: '#FF2D2D',
};

export const JENIS_SAKIT_LABEL: Record<string, string> = {
  AKUT: 'Akut',
  KHUSUS: 'Perlu tindakan medis khusus',
  BERKEPANJANGAN: 'Sakit berkepanjangan',
  KRONIS: 'Kronis (>3 bulan)',
};

export const MEDIA_LABEL: Record<string, string> = {
  TELEPON: 'Telepon',
  WHATSAPP: 'WhatsApp',
  TELEMEDICINE: 'Telemedicine',
  KUNJUNGAN_LANGSUNG: 'Kunjungan langsung',
  LAINNYA: 'Lainnya',
};
