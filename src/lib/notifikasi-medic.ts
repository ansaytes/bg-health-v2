// ============================================================
// Notifikasi in-app untuk QSHE Medic
// ============================================================
//
// CARA KERJA: ON-DEMAND, BUKAN CRON
// Notifikasi dihitung SAAT halaman dibuka, bukan oleh proses terjadwal.
// Konsekuensi yang disengaja:
//   • Tidak ada notifikasi "hilang" bila tidak ada yang membuka aplikasi —
//     begitu dibuka, semua yang jatuh tempo tetap terlihat (termasuk yang
//     sudah telat berhari-hari).
//   • Tidak ada infrastruktur tambahan, tidak ada biaya, tidak bisa gagal
//     karena job tidak jalan.
//   • Kekurangan: tidak ada dorongan keluar aplikasi (email/WA). Itu memang
//     bukan tujuan — notifikasi ini untuk QSHE Medic yang bekerja di aplikasi.
//
// PRINSIP
//  • Kerahasiaan: notifikasi hanya menampilkan NAMA & JENIS TINDAKAN.
//    Diagnosis, nilai laboratorium, dan skor kuesioner TIDAK masuk notifikasi
//    (INK/016 poin 4.7.3 huruf e, UU 27/2022).
//  • Bukan spam: satu jenis tindakan per orang, bukan satu baris per parameter.
//  • Dapat ditindaklanjuti: setiap notifikasi membawa tautan langsung ke
//    halaman yang tepat.
//
// AMBANG PERINGATAN
//  • Kontrol ProKawan  : H-3 (INK/012 poin 4.3.1 untuk FRS sedang/tinggi),
//                        lalu H+1 dan H+7 setelah terlambat.
//  • MCU akan expired  : H-60 dan H-30.
//  • Surat kelayakan   : H-14 sebelum masa berlaku habis.
//  • PAK batas waktu   : H-1 (deadline dokumen: 1 hari kerja / 2×24 jam).
//  • Karyawan sakit    : saat jadwal fase terlewat.

export type JenisNotifikasi =
  | 'kontrol-prokawan'
  | 'mcu-expired'
  | 'mcu-akan-expired'
  | 'surat-kelayakan'
  | 'pak-batas-waktu'
  | 'karyawan-sakit';

export type PrioritasNotifikasi = 'kritis' | 'penting' | 'informasi';

export interface Notifikasi {
  /** Kunci unik stabil — dipakai untuk menandai "sudah dibaca". */
  id: string;
  jenis: JenisNotifikasi;
  prioritas: PrioritasNotifikasi;
  judul: string;
  /** Ringkas, TANPA data medis. */
  keterangan: string;
  /** Nama peserta/karyawan — boleh, karena ini tindakan administratif. */
  subjek: string | null;
  /** Tanggal acuan (jatuh tempo / batas waktu). */
  tanggal: string | null;
  /** Selisih hari: negatif = sudah lewat. */
  sisaHari: number | null;
  /** Tautan tindak lanjut di aplikasi. */
  tautan: string;
  /** Label tombol tindakan. */
  aksi: string;
}

export interface RingkasanNotifikasi {
  total: number;
  kritis: number;
  penting: number;
  informasi: number;
  daftar: Notifikasi[];
  dihitungPada: string;
}

export const AMBANG = {
  /** H-3 sebelum jadwal kontrol ProKawan. */
  prokawanSebelum: 3,
  /** H+1 dan H+7 setelah terlambat. */
  prokawanSesudah: [1, 7] as readonly number[],
  /** MCU akan expired: H-60 dan H-30. */
  mcuSebelum: [60, 30] as readonly number[],
  /** Surat kelayakan kerja: H-14. */
  suratKelayakanSebelum: 14,
  /** PAK: H-1 dari batas waktu dokumen. */
  pakSebelum: 1,
} as const;

export const JENIS_META: Record<JenisNotifikasi, { label: string; ikon: string; tautanDefault: string }> = {
  'kontrol-prokawan': { label: 'Kontrol ProKawan', ikon: 'heart', tautanDefault: '/?page=administrator&menu=prokawan-admin' },
  'mcu-expired': { label: 'MCU Expired', ikon: 'alert', tautanDefault: '/?page=administrator&menu=review-mcu' },
  'mcu-akan-expired': { label: 'MCU Akan Expired', ikon: 'clock', tautanDefault: '/?page=administrator&menu=review-mcu' },
  'surat-kelayakan': { label: 'Surat Kelayakan Kerja', ikon: 'file', tautanDefault: '/?page=administrator&menu=karyawan-sakit' },
  'pak-batas-waktu': { label: 'Batas Waktu PAK', ikon: 'shield', tautanDefault: '/?page=administrator&menu=pak-register' },
  'karyawan-sakit': { label: 'Jadwal Pemantauan Sakit', ikon: 'bed', tautanDefault: '/?page=administrator&menu=karyawan-sakit' },
};

export const PRIORITAS_WARNA: Record<PrioritasNotifikasi, string> = {
  kritis: '#FF2D2D',
  penting: '#FF7A00',
  informasi: '#3498DB',
};

/** Menghitung selisih hari dari hari ini (negatif = lewat). */
export function selisihHari(target: string | null | undefined, sekarang: Date = new Date()): number | null {
  if (!target) return null;
  const d = new Date(`${String(target).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  return Math.round((d.getTime() - hariIni.getTime()) / 86_400_000);
}

/**
 * Menentukan prioritas notifikasi ProKawan berdasarkan sisa hari.
 * Dipakai juga untuk MCU: keduanya punya pola "akan datang → jatuh tempo → terlambat".
 */
export function prioritasDariSisaHari(sisaHari: number | null): PrioritasNotifikasi {
  if (sisaHari === null) return 'informasi';
  if (sisaHari < 0) return 'kritis';
  if (sisaHari <= 3) return 'penting';
  return 'informasi';
}

/**
 * Apakah notifikasi kontrol ProKawan perlu MUNCUL pada sisa hari ini?
 *
 * Muncul pada:
 *   • H-3 sampai H-0 (akan/sedang jatuh tempo)
 *   • H+1 dan H+7 (setelah terlambat) — bukan setiap hari, agar tidak spam.
 *   • Setelah H+7, muncul lagi setiap 30 hari sebagai eskalasi.
 *
 * Notifikasi yang tidak muncul hari ini BUKAN berarti hilang: ia akan muncul
 * lagi pada titik-titik berikutnya. Ini menjaga daftar tetap dapat ditindaklanjuti
 * tanpa membanjiri QSHE Medic setiap hari.
 */
export function perluMunculProKawan(sisaHari: number): boolean {
  if (sisaHari >= 0 && sisaHari <= AMBANG.prokawanSebelum) return true;
  if (sisaHari < 0) {
    const lewat = Math.abs(sisaHari);
    if (AMBANG.prokawanSesudah.includes(lewat)) return true;
    if (lewat > 7 && lewat % 30 === 0) return true;
    return false;
  }
  return false;
}

/** Apakah notifikasi MCU akan-expired perlu muncul (H-60 & H-30 saja). */
export function perluMunculMcu(sisaHari: number): boolean {
  return AMBANG.mcuSebelum.includes(sisaHari);
}

/** Urutan tampil: kritis dulu, lalu yang paling mendesak. */
export function urutkanNotifikasi(a: Notifikasi, b: Notifikasi): number {
  const bobot: Record<PrioritasNotifikasi, number> = { kritis: 0, penting: 1, informasi: 2 };
  if (bobot[a.prioritas] !== bobot[b.prioritas]) return bobot[a.prioritas] - bobot[b.prioritas];
  const sa = a.sisaHari ?? 9999;
  const sb = b.sisaHari ?? 9999;
  return sa - sb;
}
