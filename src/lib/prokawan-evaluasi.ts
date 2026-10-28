// ============================================================
// Evaluasi ulang zona dari HASIL KONTROL + riwayat baseline
// ============================================================
//
// MENGAPA MODUL INI ADA
// ----------------------------------------------------------------
// Sebelumnya `kunjungan_kontrol` hanya menyimpan tanggal + link evidence.
// Akibatnya "kontrol" berhenti jadi cap tanggal: tidak ada nilai parameter,
// sehingga zona tidak bisa dihitung ulang dan keberhasilan program tidak bisa
// dibuktikan. Padahal dokumen menuntut sebaliknya:
//
//   • INK/016 poin 4.4.5 — "Hasil pemeriksaan dari Fasilitas Kesehatan Rekanan
//     disampaikan kepada QSHE Medic sebagai BAHAN EVALUASI dan pembaruan Zona
//     Risiko PTM."
//   • INK/016 poin 4.6.1 — QSHE Medic "mengevaluasi hasil pemeriksaan ProKawan
//     sesuai frekuensi pada poin 4.3 dan memperbarui Zona Risiko PTM."
//   • INK/016 poin 4.6.2 — peserta yang pada evaluasi ulang tetap Kuning/Merah
//     melanjutkan ProKawan; 4.6.3 — yang menjadi Hijau dihentikan kepesertaannya.
//   • STD/006 poin 6.3.1–6.3.4 — aturan status stabil & masa transisi 3 bulan.
//
// Jadi modul ini:
//   1. Menyimpan NILAI PARAMETER tiap kunjungan kontrol.
//   2. Menghitung ulang zona memakai ENGINE YANG SAMA dengan MCU
//      (`assessZonasi`), diberi nilai kontrol sebagai input — bukan rumus baru.
//   3. Menyimpan riwayat (baseline → kontrol 1 → kontrol 2 …) sehingga tren
//      tiap parameter bisa dipakai sebagai bukti program berhasil atau tidak.
//
// PENTING — KERAHASIAAN
// Hasil per parameter adalah data medis. Riwayat hanya boleh keluar lewat
// endpoint berotorisasi QSHE Medic; dashboard publik/manajemen tetap agregat.
// ============================================================

/** Parameter yang diukur ulang saat kontrol, dikelompokkan per blok form. */
export interface DefinisiParameterKontrol {
  key: string;
  label: string;
  unit: string;
  kelompok: 'vital' | 'lab' | 'fungsi';
  /** true = boleh desimal (HbA1c, kreatinin). */
  desimal?: boolean;
}

export const PARAMETER_KONTROL: DefinisiParameterKontrol[] = [
  // Vital & antropometri
  { key: 'tdS', label: 'Tekanan darah sistole', unit: 'mmHg', kelompok: 'vital' },
  { key: 'tdD', label: 'Tekanan darah diastole', unit: 'mmHg', kelompok: 'vital' },
  { key: 'bb', label: 'Berat badan', unit: 'kg', kelompok: 'vital', desimal: true },
  { key: 'tb', label: 'Tinggi badan', unit: 'cm', kelompok: 'vital', desimal: true },
  { key: 'lp', label: 'Lingkar perut', unit: 'cm', kelompok: 'vital', desimal: true },

  // Laboratorium
  { key: 'gdp', label: 'Glukosa darah puasa', unit: 'mg/dL', kelompok: 'lab' },
  { key: 'gd2pp', label: 'GD 2 jam post-prandial', unit: 'mg/dL', kelompok: 'lab' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', kelompok: 'lab', desimal: true },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', kelompok: 'lab' },
  { key: 'tg', label: 'Trigliserida', unit: 'mg/dL', kelompok: 'lab' },
  { key: 'au', label: 'Asam urat', unit: 'mg/dL', kelompok: 'lab', desimal: true },
  { key: 'hb', label: 'Hemoglobin', unit: 'g/dL', kelompok: 'lab', desimal: true },
  { key: 'kreatinin', label: 'Kreatinin', unit: 'mg/dL', kelompok: 'lab', desimal: true },
  { key: 'egfr', label: 'eGFR', unit: 'mL/menit/1,73m²', kelompok: 'lab' },
  { key: 'sgot', label: 'SGOT', unit: 'U/L', kelompok: 'lab' },
  { key: 'sgpt', label: 'SGPT', unit: 'U/L', kelompok: 'lab' },

  // Fungsi & skrining
  { key: 'fev1Pct', label: 'FEV1 % prediksi', unit: '%', kelompok: 'fungsi' },
  { key: 'fev1FvcAct', label: 'Rasio FEV1/FVC', unit: 'desimal', kelompok: 'fungsi', desimal: true },
  { key: 'fvcPct', label: 'FVC % prediksi', unit: '%', kelompok: 'fungsi' },
  { key: 'visusJauh', label: 'Visus jauh', unit: 'mis. 6/9', kelompok: 'fungsi' },
  { key: 'pta', label: 'PTA pendengaran', unit: 'dB', kelompok: 'fungsi' },
  { key: 'essScore', label: 'Skor ESS', unit: '0–24', kelompok: 'fungsi' },
  { key: 'srq20Score', label: 'Skor SRQ-20', unit: '0–20', kelompok: 'fungsi' },
];

export const LABEL_PARAMETER = Object.fromEntries(
  PARAMETER_KONTROL.map((p) => [p.key, p]),
) as Record<string, DefinisiParameterKontrol>;

/**
 * Nilai kontrol yang dapat diisi QSHE Medic.
 * Semua opsional: pengukuran hanya dilakukan untuk parameter yang relevan.
 */
export type NilaiKontrol = Partial<Record<string, string | number | null>>;

export interface HasilEvaluasiZona {
  zonaSebelumnya: 'Kuning' | 'Merah' | null;
  zonaBaru: 'Hijau' | 'Kuning' | 'Merah' | 'Belum Lengkap';
  berubah: boolean;
  /** "Membaik" bila peringkat zona turun, dsb. */
  arah: 'membaik' | 'memburuk' | 'tetap' | 'tidak-dapat-dinilai';
  triggers: string[];
  catatanSOP: string[];
  frekuensiEvaluasi: string;
  pengendalian: string;
  /** Parameter yang nilainya masuk/keluar zona. */
  parameterBerubah: {
    key: string;
    label: string;
    sebelum: string | null;
    sekarang: string | null;
    /** 'baru' = belum ada nilai pembanding (pengukuran pertama). */
    tren: 'membaik' | 'memburuk' | 'tetap' | 'baru';
  }[];
  /** Nilai yang belum terisi pada kontrol ini. */
  parameterKosong: string[];
}

const PERINGKAT: Record<string, number> = { Hijau: 0, 'Belum Lengkap': 1, Kuning: 2, Merah: 3 };

function angka(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Menilai apakah satu parameter membaik atau memburuk, memakai arah yang benar
 * per parameter (bukan asumsi "angka naik = buruk"):
 *
 *   • TD, GDP, HbA1c, LDL, TG, AU, kreatinin, SGOT/SGPT, PTA, ESS, SRQ
 *     → turun = membaik
 *   • Hb, eGFR, FEV1, FVC, visus
 *     → naik = membaik
 *   • IMT: membaik bila mendekati 22 (BMI sehat), kecuali sudah ≤23 → tetap.
 */
export function arahParameter(key: string, sebelum: number | null, sekarang: number | null): 'membaik' | 'memburuk' | 'tetap' {
  if (sebelum === null || sekarang === null || sebelum === sekarang) return 'tetap';

  const naikLebihBaik = ['hb', 'egfr', 'fev1Pct', 'fvcPct', 'fev1FvcAct'].includes(key);
  const selisih = sekarang - sebelum;

  // Ambang "bermakna": perubahan < 2% dianggap fluktuasi pengukuran, bukan tren.
  const ambang = Math.max(Math.abs(sebelum) * 0.02, 0.01);
  if (Math.abs(selisih) < ambang) return 'tetap';

  if (naikLebihBaik) return selisih > 0 ? 'membaik' : 'memburuk';
  return selisih < 0 ? 'membaik' : 'memburuk';
}

/**
 * Menghitung zona baru dari nilai kontrol.
 *
 * @param nilaiKontrol  hasil pengukuran kontrol (parameter yang diukur)
 * @param baseline      nilai dari MCU terakhir / kontrol sebelumnya
 * @param zonaSebelumnya zona peserta sebelum kontrol ini
 * @param profil        usia, jenis kelamin, dan kualifikasi klinis dari MCU
 *                      (dipakai engine untuk parameter yang tidak diukur ulang)
 */
export async function evaluasiZonaDariKontrol(opsi: {
  nilaiKontrol: NilaiKontrol;
  baseline: NilaiKontrol;
  zonaSebelumnya: 'Kuning' | 'Merah' | null;
  profil: {
    usia?: string | number;
    jenisKelamin?: string;
    /** Konfirmasi klinis yang tidak ikut diukur ulang saat kontrol. */
    dmKomplikasi?: string;
    mentalKonfirmasi?: string;
    artritisUrat?: string;
    diagnosisHati?: string;
    obesitasFungsional?: string;
    riwayatJantung?: string;
    riwayatStroke?: string;
    lbp?: string;
    riwayatEpilepsi?: string;
    epilepsiKepatuhan?: string;
    statusTerapiEss?: string;
    srq17Bahaya?: string;
    hbsag?: string;
    chestXR?: string;
  };
}): Promise<HasilEvaluasiZona> {
  const { assessZonasi } = await import('@/lib/zonasi-engine');

  // Nilai kontrol MENIMPA baseline untuk parameter yang diukur; parameter yang
  // tidak diukur memakai nilai baseline supaya zona tidak berubah hanya karena
  // datanya kosong (prinsip yang sama dengan "kosong ≠ normal" pada engine).
  const gabungan: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(opsi.baseline)) {
    if (v !== null && v !== undefined && v !== '') gabungan[k] = v as string | number;
  }

  const terukur: string[] = [];
  for (const p of PARAMETER_KONTROL) {
    const v = opsi.nilaiKontrol[p.key];
    if (v === null || v === undefined || String(v).trim() === '') continue;
    gabungan[p.key] = typeof v === 'number' ? v : String(v);
    terukur.push(p.key);
  }

  // IMT dihitung dari BB/TB terbaru bila keduanya tersedia.
  const bb = angka(gabungan.bb);
  const tb = angka(gabungan.tb);
  if (bb !== null && tb !== null && tb > 0) {
    gabungan.bmi = Number((bb / ((tb / 100) ** 2)).toFixed(1));
  }

  // Kualifikasi klinis dari MCU tetap dipakai.
  Object.assign(gabungan, {
    usia: opsi.profil.usia,
    jenisKelamin: opsi.profil.jenisKelamin,
    dmKomplikasi: opsi.profil.dmKomplikasi,
    mentalKonfirmasi: opsi.profil.mentalKonfirmasi,
    artritisUrat: opsi.profil.artritisUrat,
    diagnosisHati: opsi.profil.diagnosisHati,
    obesitasFungsional: opsi.profil.obesitasFungsional,
    riwayatJantung: opsi.profil.riwayatJantung,
    riwayatStroke: opsi.profil.riwayatStroke,
    lbp: opsi.profil.lbp,
    riwayatEpilepsi: opsi.profil.riwayatEpilepsi,
    epilepsiKepatuhan: opsi.profil.epilepsiKepatuhan,
    statusTerapiEss: opsi.profil.statusTerapiEss,
    srq17Bahaya: opsi.profil.srq17Bahaya,
    hbsag: opsi.profil.hbsag,
    chestXR: opsi.profil.chestXR,
  });

  const hasil = assessZonasi(gabungan, opsi.profil.jenisKelamin);

  const peringkatLama = opsi.zonaSebelumnya ? PERINGKAT[opsi.zonaSebelumnya] ?? 0 : null;
  const peringkatBaru = PERINGKAT[hasil.zona] ?? 0;
  let arah: HasilEvaluasiZona['arah'] = 'tidak-dapat-dinilai';
  if (peringkatLama !== null) {
    if (peringkatBaru < peringkatLama) arah = 'membaik';
    else if (peringkatBaru > peringkatLama) arah = 'memburuk';
    else arah = 'tetap';
  }

  // Perbandingan per parameter untuk riwayat.
  //
  // HANYA parameter yang BENAR-BENAR DIUKUR pada kontrol ini yang masuk daftar.
  // Versi sebelumnya ikut menampilkan parameter yang tidak diukur sebagai
  // "sebelum → null [tetap]", sehingga riwayat penuh baris kosong dan terbaca
  // seolah nilainya hilang. Parameter yang tidak diukur bukan perubahan. 
  const parameterBerubah: HasilEvaluasiZona['parameterBerubah'] = [];
  for (const p of PARAMETER_KONTROL) {
    if (!terukur.includes(p.key)) continue;
    const sebelum = angka(opsi.baseline[p.key]);
    const sekarang = angka(opsi.nilaiKontrol[p.key]);
    parameterBerubah.push({
      key: p.key,
      label: p.label,
      sebelum: sebelum === null ? null : String(sebelum),
      sekarang: sekarang === null ? null : String(sekarang),
      // Tanpa nilai pembanding, perubahannya tidak bisa disebut "tetap" —
      // itu pengukuran PERTAMA, dan riwayat harus mengatakannya apa adanya.
      tren: sebelum === null ? 'baru' : arahParameter(p.key, sebelum, sekarang),
    });
  }

  return {
    zonaSebelumnya: opsi.zonaSebelumnya,
    zonaBaru: hasil.zona,
    berubah: opsi.zonaSebelumnya ? hasil.zona !== opsi.zonaSebelumnya : true,
    arah,
    triggers: hasil.triggers,
    catatanSOP: hasil.catatanSOP,
    frekuensiEvaluasi: hasil.frekuensiEvaluasi,
    pengendalian: hasil.pengendalian,
    parameterBerubah,
    parameterKosong: PARAMETER_KONTROL
      .filter((p) => !terukur.includes(p.key))
      .map((p) => p.label),
  };
}
