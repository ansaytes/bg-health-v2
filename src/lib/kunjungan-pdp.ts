// ============================================================
// Pelindungan Data Pribadi (UU No. 27 Tahun 2022 / UU PDP)
// Modul Pelayanan Kuratif & Rekam Medis Kunjungan
// ============================================================
//
// Pasal 4 ayat (2) huruf d UU PDP:
//   "Data dan informasi kesehatan merupakan Data Pribadi yang bersifat Spesifik"
//
// Prinsip Need-to-Know:
//   - Tenaga medis berwenang (Dokter/Paramedis/Admin Klinik): Akses penuh diagnosa & resep.
//   - Pengguna non-medis (Manager/Supervisor Operasional): Hanya boleh melihat
//     status kelayakan kerja (Fit/Unfit) dan izin istirahat, BUKAN rincian diagnosa
//     sensitif (mis. penyakit menular seksual, gangguan kejiwaan, hemoroid, dll).

import { hashField } from '@/lib/encryption';

/**
 * Daftar kata kunci diagnosa sensitif yang wajib diproteksi dari akses non-medis.
 */
const KATA_KUNCI_SENSITIF = [
  'hiv', 'aids', 'sifilis', 'gonore', 'gonorrhoea', 'tbc', 'tuberculosis',
  'depresi', 'anxiety', 'gangguan jiwa', 'skizofrenia', 'psikosis',
  'hemoroid', 'kondiloma', 'herpes genital', 'klamidia',
];

/**
 * Memeriksa apakah suatu teks diagnosa memuat penyakit yang bersifat sensitif/stigma.
 */
export function isDiagnosaSensitif(diagnosaText: string | null | undefined): boolean {
  if (!diagnosaText) return false;
  const lower = diagnosaText.toLowerCase();
  return KATA_KUNCI_SENSITIF.some((k) => lower.includes(k));
}

/**
 * Menyensor atau memvalidasi tampilan diagnosa berdasarkan peran pembaca.
 * Jika pembaca non-medis (misal manager umum / pihak ketiga), diagnosa sensitif
 * disamarkan menjadi kategori umum untuk menjaga kerahasiaan medis pasien.
 */
export function proteksiDiagnosaUntukRole(
  diagnosaRaw: string | null | undefined,
  role: string | null | undefined
): string {
  if (!diagnosaRaw) return '—';
  
  // Peran medis internal memiliki akses klinis penuh
  const roleMedis = ['superuser', 'administrator', 'pic'];
  if (role && roleMedis.includes(role.toLowerCase())) {
    return diagnosaRaw;
  }

  // Untuk pembaca non-medis, samarkan bila memuat diagnosa spesifik sensitif
  if (isDiagnosaSensitif(diagnosaRaw)) {
    return '[Diagnosa Terproteksi Medis — Kerahasiaan UU PDP]';
  }

  return diagnosaRaw;
}

/**
 * Menghasilkan NIK hash satu arah (HMAC-SHA256) untuk pencarian dan audit
 * tanpa mengekspos NIK asli di log atau query tidak aman.
 */
export function getKunjunganNikHash(nik: string | null | undefined): string | null {
  if (!nik || !nik.trim()) return null;
  return hashField(nik.trim());
}

/**
 * Melakukan penyamaran nama (masking) untuk laporan publik / agregat luar.
 * Contoh: "Budi Santoso" → "B*** S******"
 */
export function maskNamaPasien(nama: string | null | undefined): string {
  if (!nama) return '—';
  const parts = nama.trim().split(/\s+/);
  return parts
    .map((p) => {
      if (p.length <= 2) return p;
      return p[0] + '*'.repeat(p.length - 1);
    })
    .join(' ');
}
