// ============================================================
// MCU Follow-Up Engine & Dataset Efektif (STD-006 Rev.002)
// ============================================================
//
// Modul ini mengelola data tindak lanjut (Follow-Up) medis dan
// membangun "Dataset Efektif" secara in-memory untuk evaluasi zonasi
// live tanpa mengubah data historis dasar pada mcu_records.
// ============================================================

import { assessZonasi, type ZonasiResult, type MCUDraft } from '@/lib/zonasi-engine';

export interface MCUFollowUp {
  id?: string;
  mcu_record_id: string;
  nik_karyawan: string;
  kunjungan_ke: number;
  tgl_fu?: string | null;
  lokasi_fu?: string | null;
  dokter_pemeriksa?: string | null;
  /**
   * Nilai parameter terukur ulang, disimpan sebagai key-value pair.
   * Contoh: { "tdS": 130, "tdD": 85, "gdp": 110, "au": 6.8 }
   * Key merujuk pada field.id pada MCUFieldDef.
   */
  hasil_parameters?: Record<string, any>;
  catatan?: string | null;
  kesimpulan?: string | null;
  link_dokumen?: string | null;
  rekomendasi_berikutnya?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatasetEfektifResult {
  /** Record hasil overlay parameter FU di atas data baseline MCU */
  effectiveRecord: MCUDraft;
  /** Evaluasi zonasi live terhadap dataset efektif */
  effectiveZonasi: ZonasiResult;
  /** Evaluasi zonasi awal (baseline) */
  baselineZonasi: ZonasiResult;
  /** Riwayat kunjungan follow up yang terpasang */
  followups: MCUFollowUp[];
  /** Kunjungan FU terakhir yang tercatat */
  latestFollowup?: MCUFollowUp;
  /** Apakah status zonasi mengalami perbaikan (misal Merah -> Kuning/Hijau) */
  perbaikanZonasi: boolean;
  /** Status kepatuhan pemantauan medis formal */
  statusKepatuhan: 'Patuh Terjadwal' | 'Perlu Penjadwalan Ulang' | 'Belum Follow-Up';
}

/**
 * Membangun dataset efektif secara in-memory dengan menerapkan hasil
 * follow-up secara kronologis di atas record MCU baseline.
 *
 * @param baselineRecord Data MCU asli dari mcu_records
 * @param followups Daftar kunjungan FU dari mcu_followups
 */
export function buildDatasetEfektif(
  baselineRecord: MCUDraft,
  followups: MCUFollowUp[] = []
): DatasetEfektifResult {
  // Salin baseline
  const effective: MCUDraft = { ...baselineRecord };

  // Urutkan follow-up berdasarkan nomor kunjungan kronologis
  const sorted = [...followups].sort((a, b) => (a.kunjungan_ke || 0) - (b.kunjungan_ke || 0));

  // Terapkan overlay dari hasil_parameters setiap kunjungan
  for (const fu of sorted) {
    if (fu.hasil_parameters && typeof fu.hasil_parameters === 'object') {
      for (const [key, val] of Object.entries(fu.hasil_parameters)) {
        if (val !== undefined && val !== null && val !== '') {
          effective[key] = val;
        }
      }
    }
  }

  const latestFollowup = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;

  // Hitung zonasi baseline vs efektif
  const baselineZonasi = assessZonasi(baselineRecord);
  const effectiveZonasi = assessZonasi(effective);

  // Evaluasi perbaikan zona
  const rank = (z: string) => (z === 'Merah' ? 3 : z === 'Kuning' ? 2 : z === 'Hijau' ? 1 : 0);
  const perbaikanZonasi = rank(effectiveZonasi.zona) < rank(baselineZonasi.zona);

  // Evaluasi kepatuhan formal
  let statusKepatuhan: 'Patuh Terjadwal' | 'Perlu Penjadwalan Ulang' | 'Belum Follow-Up' = 'Belum Follow-Up';
  if (sorted.length > 0) {
    const lastDate = latestFollowup?.tgl_fu;
    if (lastDate) {
      statusKepatuhan = 'Patuh Terjadwal';
    } else {
      statusKepatuhan = 'Perlu Penjadwalan Ulang';
    }
  }

  return {
    effectiveRecord: effective,
    effectiveZonasi,
    baselineZonasi,
    followups: sorted,
    latestFollowup,
    perbaikanZonasi,
    statusKepatuhan,
  };
}
