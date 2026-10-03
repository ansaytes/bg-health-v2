// ============================================================
// Pemetaan nilai EKG dan treadmill ke daftar dropdown kanonis.
//
// Satu-satunya sumber kebenaran. Dipakai oleh tiga pemakai:
//
//   1. split-sql-and-csv.mjs      -> CSV import, supaya file yang
//                                    diimpor sudah berisi nilai baku
//   2. normalize-ecg-treadmill.mjs -> migrasi record yang sudah ada
//   3. test-ecg-tmt-classification.mjs -> penguncian
//
// Alasan modul ini terpisah: kalau pemetaan hanya ada di script
// migrasi, CSV import berikutnya akan mengembalikan nilai mentah dan
// masalahnya muncul lagi.
//
// Daftar ini berasal dari 40 nilai EKG dan 6 nilai treadmill yang
// benar-benar ada di mcu_records, bukan contoh karangan.
// ============================================================

/**
 * Nilai lama -> nilai dropdown kanonis.
 *
 * Normal: `Normal Resting ECG` jadi `Normal Sinus Rhythm`.
 *
 * "Normal Variant": nilai bertanda "(Normal Variant)" dipetakan ke
 * `Normal Variant of Resting ECG`, bukan ke `Sinus Bradycardia` yang
 * lebih dekat. OPERATOR sudah menulis bahwa denyutnya dalam rentang
 * varian normal, jadi memetakannya ke bradikardia akan menaikkan
 * temuan yang tidak perlu ditindak.
 *
 * Gabungan beberapa temuan ("Sinus Arhytmia + LVH") dipetakan ke
 * temuan utamanya. Dropdown hanya menyimpan satu nilai, jadi temuan
 * kedua tidak bisa ikut tersimpan.
 *
 * YANG SENGAJA TIDAK DIPETAKAN: tidak ada lagi setelah opsi
 * `Peaked T Waves` ditambahkan. Nilai yang tidak dikenali di luar
 * daftar ini dikembalikan apa adanya, lalu dilaporkan script migrasi
 * supaya operator bisa memetakannya lewat opsi "Lainnya (isi manual)".
 */
export const PETA_ECG = new Map(Object.entries({
  // Normal
  'Normal Resting ECG': 'Normal Sinus Rhythm',
  'normal Resting ECG': 'Normal Sinus Rhythm',
  'Normal Variations of Resting ECG': 'Normal Variant of Resting ECG',
  'Normal Variations of Resting ECG (Sinus Bradikardi )': 'Normal Variant of Resting ECG',
  'Normal Variations of Resting ECG (Synus Bradichardia)': 'Normal Variant of Resting ECG',
  'Sinus Bradycardia (Normal Variant)': 'Normal Variant of Resting ECG',
  'Sinus Bradicardy (Normal Variant)': 'Normal Variant of Resting ECG',
  'Synus Bradicardia (Normal Variant)': 'Normal Variant of Resting ECG',
  'RAD Normal Variant': 'Normal Variant of Resting ECG',

  // Sinus
  'Sinus Bradycardia': 'Sinus Bradycardia',
  'Sinus Bradicardia': 'Sinus Bradycardia',
  'Synus Bradicardia': 'Sinus Bradycardia',
  'Sinus Bradikardia': 'Sinus Bradycardia',
  'Sinus Arhytmia': 'Sinus Arrhythmia',
  'Sinus Arhytmia + LVH': 'Sinus Arrhythmia',
  'Sinus Bradikardia with Arhytmia': 'Sinus Bradycardia',
  'Sinus Tachicardi 108 bpm': 'Sinus Tachycardia',
  'Sinus Tachicardi 107 bpm': 'Sinus Tachycardia',
  'Sinus Tachycardia (HR 115 bpm)': 'Sinus Tachycardia',
  'Sinus Takikardi (110x/mnt)': 'Sinus Tachycardia',

  // Bundle branch block dan sumbu
  'IRBBB': 'Incomplete Right Bundle Branch Block',
  'Incomplete RBBB': 'Incomplete Right Bundle Branch Block',
  'RBBB': 'Right Bundle Branch Block',
  'Synus Rythm w/ RBBB w/o RVH': 'Right Bundle Branch Block',
  'RBBB Incomplate + Right Axis Deviation': 'Right Axis Deviation',
  'RAD': 'Right Axis Deviation',
  'Deviasi Sumbu Kanan': 'Right Axis Deviation',
  'LAD': 'Left Axis Deviation',
  'Susp. LAD': 'Left Axis Deviation',

  // Hipertrofi dan ritme atrium
  'LVH': 'Left Ventricular Hypertrophy',
  'Low Atrial Rythm': 'Low Atrial Rhythm',

  // Abnormal kritis
  'PVC': 'Premature Ventricular Contraction',
  'ST Abnormal': 'ST Segment Abnormal',
  'AMI Anteroseptal': 'Acute Myocardial Infarction',
  'Sinus dengan OMI Inferior': 'Acute Myocardial Infarction',
  'Atrial Fibrillation with moderate and RVH': 'Atrial Fibrillation',
  'AV Block': 'Atrioventricular Block',
  'Sinus rhythm, first degree atrioventricular block': 'First-Degree Atrioventricular Block',
  'Susp. LBBB': 'Left Bundle Branch Block',
  // Puncak T menjunjai. Dulu tidak dipetakan karena tidak ada opsi
  // dropdown yang tepat; sekarang opsinya sudah ada.
  'Sinus Rythm dg Peaked T Waves': 'Peaked T Waves',
}));

export const PETA_TMT = new Map(Object.entries({
  'Inconclusive (HR<85% Target)': 'Non-Diagnostic Test (Target Heart Rate Not Achieved)',
  'Inconclusive (HR < 85% Target HR)': 'Non-Diagnostic Test (Target Heart Rate Not Achieved)',
  'PVC Occasional LV Apex': 'Ventricular Ectopy during Exercise',
}));

/**
 * Menyeragamkan satu nilai. Nilai yang sudah berupa pilihan dropdown
 * apa adanya dikembalikan tanpa perubahan, dan nilai yang tidak
 * dikenali juga dikembalikan apa adanya supaya bisa dilaporkan dan
 * diisi manual oleh operator.
 */
export function kanonik(kolom, nilai) {
  const v = nilai == null ? '' : String(nilai).trim();
  if (!v) return v;
  return (kolom === 'tm_hasil' ? PETA_TMT : PETA_ECG).get(v) ?? v;
}