// ============================================================
// Pengendalian per parameter — BG/QSHE/STD/006 Rev.002 Bab 7
// ============================================================
//
// MENGAPA MODUL INI ADA
//
// Sebelumnya `zonasi-engine.ts` menulis SATU teks pengendalian untuk seluruh
// zona ("general per zonasi"): semua Zona Kuning mendapat teks "kontrol dokter
// 3 bulan …", semua Zona Merah mendapat "kontrol dokter spesialis 1 bulan …".
//
// Dokumen STD/006 Rev.002 TIDAK begitu. Kolom "Pengendalian" pada tabel Bab 7
// ditulis PER BARIS/PARAMETER, dan bunyinya berbeda-beda — bahkan di dalam zona
// yang sama:
//
//   • Prediabetes            → kontrol 6 bulan (bukan 3 bulan)
//   • IMT 23–24,9 / ≥25 / ≥30 tanpa komorbid
//                            → TIDAK diwajibkan kontrol dokter berkala;
//                              pemantauan Paramedic Site; evaluasi 3 bulan
//   • Hiperurisemia ringan   → idem (tanpa kontrol dokter berkala)
//   • Gangguan penglihatan/pendengaran ringan
//                            → Tidak diwajibkan kontrol dokter spesialis
//                              berkala; cukup evaluasi/penyesuaian alat bantu
//   • Terduga DM baru        → kontrol konfirmasi ≤1 BULAN
//   • Terduga gangguan mental→ penilaian awal QSHE Medic ≤2 MINGGU + EAP
//
// Karena itu teks pengendalian diambil dari tabel di modul ini, di-key per
// kode parameter yang dihasilkan klasifikasi klinis. Engine tidak lagi
// mengarang teks sendiri.
//
// PRINSIP RISIKO TERTINGGI (Bab 6.2.2 / 6.1.2)
// Bila seorang karyawan punya lebih dari satu parameter, frekuensi yang berlaku
// adalah yang PALING KETAT (bulan terkecil). Teks pengendalian SEMUA parameter
// tetap dicantumkan, karena tiap parameter punya tindakan yang berbeda
// (mis. obesitas → pemantauan paramedis, hipertensi → kontrol dokter).
// ============================================================

/** Kode parameter mengikuti kode yang dipakai clinical-classification.ts. */
export type KodeParameter =
  | 'hipertensi-grade-1'
  | 'hipertensi-grade-2'
  | 'hipertensi-grade-3'
  | 'prediabetes'
  | 'terduga-dm'
  | 'dm-terkontrol'
  | 'dm-tidak-terkontrol'
  | 'dm-tanpa-hba1c'
  | 'dm-komplikasi'
  | 'ldl-sedang'
  | 'ldl-tinggi'
  | 'tg-sedang'
  | 'tg-tinggi'
  | 'ckd-g2-g3a'
  | 'ckd-g3b'
  | 'imt-overweight'
  | 'imt-obesitas'
  | 'imt-obesitas-komorbid'
  | 'imt-obesitas-fungsional'
  | 'asam-urat-ringan'
  | 'asam-urat-tinggi'
  | 'paru-ringan-sedang'
  | 'paru-berat'
  | 'anemia-ringan'
  | 'anemia-berat'
  | 'epilepsi-terkontrol-sebagian'
  | 'epilepsi-tidak-terkontrol'
  | 'penglihatan-ringan'
  | 'penglihatan-berat'
  | 'pendengaran-ringan'
  | 'pendengaran-sedang-berat'
  | 'hati-ringan'
  | 'hati-berat'
  | 'pneumokoniosis-dini'
  | 'pneumokoniosis-lanjut'
  | 'tidur-ringan-sedang'
  | 'tidur-berat'
  | 'mental-terduga'
  | 'mental-terkontrol'
  | 'mental-berat'
  | 'jantung-stroke-residual'
  | 'lbp-ringan'
  | 'lbp-berat';

export type ZonaParameter = 'Hijau' | 'Kuning' | 'Merah';

export interface AturanPengendalian {
  /** Nama baris pada tabel Bab 7, apa adanya. */
  baris: string;
  zona: ZonaParameter;
  /** Butir-butir kolom Pengendalian, dibaca urut dari dokumen. */
  butir: string[];
  /**
   * Bulan sampai evaluasi ulang / kontrol berikutnya.
   * null = dokumen TIDAK mewajibkan kontrol berkala (pemantauan paramedis saja).
   */
  bulan: number | null;
  /**
   * true bila frekuensi ini hanya "sampai stabil" / sekali konfirmasi,
   * sehingga tidak boleh dipakai sebagai jadwal berulang ProKawan.
   */
  sekali?: boolean;
}

// ────────────────────────────────────────────────────────────
// Teks berulang (dipersis dari dokumen) agar tidak salah salin
// ────────────────────────────────────────────────────────────

const KONTROL_3_BULAN = [
  'Wajib kontrol dokter minimal setiap 3 (tiga) bulan',
  'Wajib menyerahkan bukti kontrol ke HO',
  'Tidak direkomendasikan bekerja di area risiko tinggi bila kondisi belum stabil',
  'Evaluasi ulang status zona setiap 3 bulan',
  'Program perbaikan gaya hidup (berat badan, diet, olahraga)',
];

const PEMANTAUAN_PARAMEDIS = [
  'Tidak diwajibkan kontrol dokter berkala; pemantauan dilakukan oleh Paramedic Site/QSHE Medic',
  'Program perbaikan gaya hidup (berat badan, diet, aktivitas fisik) sesuai rekomendasi',
  'Evaluasi ulang status zona setiap 3 bulan melalui MCU/pemeriksaan berkala',
  'Kontrol dokter dilaksanakan apabila terdapat perburukan atau komplikasi baru',
];

const EVALUASI_ALAT_BANTU = [
  'Tidak diwajibkan kontrol dokter spesialis berkala; cukup evaluasi/penyesuaian alat bantu (kacamata atau APD pelindung telinga) di Fasilitas Kesehatan Rekanan sesuai kebutuhan',
  'Wajib menggunakan alat bantu/APD yang direkomendasikan secara konsisten selama bekerja',
  'Evaluasi ulang status zona setiap 3 bulan melalui MCU/pemeriksaan berkala oleh Paramedic Site/QSHE Medic',
];

const MERAH_1_BULAN = [
  'Wajib kontrol dokter spesialis setiap 1 bulan sampai stabil',
  'Wajib menyerahkan surat kontrol/clearance',
  'Evaluasi ulang status setiap 1 bulan',
  'Dapat direkomendasikan penempatan sementara (Currently Unfit)',
];

const HIJAU_UMUM: AturanPengendalian = {
  baris: 'Semua parameter dalam batas normal',
  zona: 'Hijau',
  butir: [
    'MCU rutin sesuai jadwal perusahaan (1 tahun sekali atau sesuai kebijakan)',
    'Edukasi gaya hidup sehat',
  ],
  bulan: 12,
};

// ────────────────────────────────────────────────────────────
// TABEL PENGENDALIAN PER PARAMETER — Bab 7
// ────────────────────────────────────────────────────────────

export const PENGENDALIAN_PER_PARAMETER: Record<KodeParameter, AturanPengendalian> = {
  // ── Zona Merah ────────────────────────────────────────────
  'hipertensi-grade-2': { baris: 'Hipertensi Grade ≥2', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'hipertensi-grade-3': { baris: 'Hipertensi Grade ≥2', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'dm-tidak-terkontrol': { baris: 'DM tidak terkontrol', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'dm-komplikasi': { baris: 'DM dengan komplikasi', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'ckd-g3b': { baris: 'CKD ≥G3b', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'ldl-tinggi': { baris: 'LDL ≥190 mg/dL', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'tg-tinggi': { baris: 'Trigliserida ≥500 mg/dL', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'imt-obesitas-komorbid': { baris: 'IMT ≥30 dengan komorbid signifikan', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'imt-obesitas-fungsional': { baris: 'IMT ≥35 dengan keterbatasan fungsional', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'jantung-stroke-residual': { baris: 'Riwayat jantung/stroke dengan gejala residual', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'asam-urat-tinggi': { baris: 'Asam urat >9 mg/dL dengan artritis berulang', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'paru-berat': { baris: 'Gangguan paru berat', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'anemia-berat': { baris: 'Anemia sedang–berat', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'epilepsi-tidak-terkontrol': { baris: 'Epilepsi tidak terkontrol', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'penglihatan-berat': { baris: 'Gangguan penglihatan berat', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'pendengaran-sedang-berat': { baris: 'Gangguan pendengaran sedang–berat', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'hati-berat': { baris: 'Kerusakan hati berat / hepatitis aktif', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'pneumokoniosis-lanjut': { baris: 'Pneumokoniosis lanjut', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'tidur-berat': { baris: 'ESS >15 tanpa terapi', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },
  'mental-berat': {
    baris: 'Gangguan mental berat — Currently Unfit sampai stabil',
    zona: 'Merah',
    butir: [
      'Wajib kontrol dokter spesialis jiwa setiap 1 bulan sampai stabil',
      'Wajib menyerahkan surat kontrol/clearance',
      'Evaluasi ulang status setiap 1 bulan',
      'Dapat direkomendasikan penempatan sementara (Currently Unfit)',
      'Tanda bahaya kesehatan jiwa ditindaklanjuti dokter pada hari yang sama; sampai dinilai dokter tidak ditugaskan pada pekerjaan berisiko tinggi termasuk mengemudi (Bab 6.1.8)',
    ],
    bulan: 1,
  },
  'lbp-berat': { baris: 'LBP kronik dengan defisit neurologis', zona: 'Merah', butir: MERAH_1_BULAN, bulan: 1 },

  // ── Zona Kuning ───────────────────────────────────────────
  'hipertensi-grade-1': { baris: 'Hipertensi Grade 1', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },

  'prediabetes': {
    baris: 'Prediabetes',
    zona: 'Kuning',
    butir: [
      'Kontrol dokter minimal setiap 6 (enam) bulan, atau lebih cepat sesuai rekomendasi dokter',
      'Wajib menyerahkan bukti kontrol ke HO',
      'Evaluasi ulang status zona mengikuti frekuensi kontrol dokter, yaitu setiap 6 (enam) bulan; apabila karyawan juga memiliki parameter Zona Kuning/Merah lain yang mensyaratkan kontrol setiap 3 (tiga) bulan, maka evaluasi ulang mengikuti frekuensi yang lebih ketat (3 bulan) sesuai prinsip pada poin 6.2.2',
      'Program perbaikan gaya hidup (berat badan, diet, olahraga) sebagai intervensi utama',
    ],
    bulan: 6,
  },

  'terduga-dm': {
    baris: 'Terduga DM baru (belum terkonfirmasi)',
    zona: 'Kuning',
    butir: [
      'Wajib kontrol dokter untuk konfirmasi diagnosis paling lambat 1 (satu) bulan sejak hasil pemeriksaan diketahui',
      'Wajib menyerahkan bukti kontrol ke HO',
      'Zona ditetapkan ulang berdasarkan hasil konfirmasi diagnosis (normal, prediabetes, DM terkontrol, atau DM tidak terkontrol)',
      'Program perbaikan gaya hidup (berat badan, diet, olahraga)',
    ],
    bulan: 1,
    sekali: true,
  },

  'dm-terkontrol': { baris: 'DM terkontrol', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'dm-tanpa-hba1c': {
    baris: 'DM terkontrol',
    zona: 'Kuning',
    butir: [
      ...KONTROL_3_BULAN,
      'HbA1c belum tersedia pada MCU; zona ditetapkan minimal Kuning sampai HbA1c dari kontrol ProKawan tersedia (Bab 6.1.6)',
    ],
    bulan: 3,
  },

  'ldl-sedang': { baris: 'LDL 100–189 mg/dL (dislipidemia sedang)', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'tg-sedang': { baris: 'Trigliserida 200–499 mg/dL', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'ckd-g2-g3a': { baris: 'CKD G2–G3a', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },

  'imt-overweight': { baris: 'IMT 23–24,9 (overweight)', zona: 'Kuning', butir: PEMANTAUAN_PARAMEDIS, bulan: 3 },
  'imt-obesitas': { baris: 'IMT ≥25 tanpa komplikasi berat', zona: 'Kuning', butir: PEMANTAUAN_PARAMEDIS, bulan: 3 },

  'asam-urat-ringan': { baris: 'Asam urat 7–9 mg/dL tanpa artritis akut', zona: 'Kuning', butir: PEMANTAUAN_PARAMEDIS, bulan: 3 },

  'paru-ringan-sedang': { baris: 'Gangguan paru ringan–sedang', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'anemia-ringan': { baris: 'Anemia ringan', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'epilepsi-terkontrol-sebagian': { baris: 'Epilepsi terkontrol sebagian', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },

  'penglihatan-ringan': { baris: 'Gangguan penglihatan ringan', zona: 'Kuning', butir: EVALUASI_ALAT_BANTU, bulan: 3 },
  'pendengaran-ringan': { baris: 'Gangguan pendengaran ringan', zona: 'Kuning', butir: EVALUASI_ALAT_BANTU, bulan: 3 },

  'hati-ringan': { baris: 'Gangguan fungsi hati ringan / carrier hepatitis terkontrol', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'pneumokoniosis-dini': { baris: 'Pneumokoniosis dini', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'tidur-ringan-sedang': { baris: 'ESS 11–15 (kantuk ringan–sedang)', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },

  'mental-terduga': {
    baris: 'Terduga gangguan mental emosional',
    zona: 'Kuning',
    butir: [
      'Penilaian awal oleh QSHE Medic paling lambat 2 (dua) minggu sejak hasil skrining diketahui',
      'Tindak lanjut melalui konseling EAP (Employee Assistance Program) dan/atau pemeriksaan dokter sesuai BG/QSHE/INK/016',
      'Kelayakan kerja sementara ditetapkan oleh QSHE Medic',
      'Zona ditetapkan ulang berdasarkan hasil tindak lanjut',
    ],
    bulan: 3,
  },

  'mental-terkontrol': { baris: 'Gangguan mental terkontrol (batasi pekerjaan isolasi tinggi)', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
  'lbp-ringan': { baris: 'LBP kronik tanpa defisit neurologis (batasi angkat berat)', zona: 'Kuning', butir: KONTROL_3_BULAN, bulan: 3 },
};

// ────────────────────────────────────────────────────────────
// Pemetaan hasil klasifikasi → kode parameter
// ────────────────────────────────────────────────────────────

/**
 * Menentukan kode parameter dari label klasifikasi klinis.
 *
 * Label berasal dari `clinical-classification.ts` dan sengaja TIDAK diubah
 * (dipakai juga untuk diagnosa_medis). Pencocokan di sini memakai kata kunci
 * yang stabil pada label tersebut.
 */
export function kodeParameterDariLabel(label: string, detail?: string): KodeParameter | null {
  const t = `${label} ${detail ?? ''}`.toLowerCase();

  // Tekanan darah
  if (/hypertension grade (iii|3)/.test(t)) return 'hipertensi-grade-3';
  if (/hypertension grade (ii|2)/.test(t)) return 'hipertensi-grade-2';
  if (/hypertension grade (i|1)/.test(t)) return 'hipertensi-grade-1';

  // Glukosa
  if (/dm tidak terkontrol/.test(t)) return 'dm-tidak-terkontrol';
  if (/diabetes.*komplikasi|neuropathy|retinopathy|nephropathy/.test(t)) return 'dm-komplikasi';
  if (/hba1c belum tersedia/.test(t)) return 'dm-tanpa-hba1c';
  if (/terduga dm/.test(t)) return 'terduga-dm';
  if (/prediabetes/.test(t)) return 'prediabetes';
  if (/dm terkontrol/.test(t)) return 'dm-terkontrol';

  // Lipid
  if (/ldl/.test(t)) return /ldl\s*(≥|>=|>)\s*190|very high ldl/.test(t) ? 'ldl-tinggi' : 'ldl-sedang';
  if (/triglycerid/.test(t)) return /severe hypertriglyceridemia|\b(≥|>=)\s*500/.test(t) ? 'tg-tinggi' : 'tg-sedang';

  // Ginjal — table hanya punya dua baris (G2–G3a dan ≥G3b)
  if (/kidney function|ckd/.test(t)) {
    return /g3b|g4|g5/.test(t) ? 'ckd-g3b' : 'ckd-g2-g3a';
  }

  // IMT
  if (/bmi|imt/.test(t)) {
    if (/fungsional|functional|mobility/.test(t)) return 'imt-obesitas-fungsional';
    if (/komorbid|comorbid/.test(t)) return 'imt-obesitas-komorbid';
    if (/overweight/.test(t)) return 'imt-overweight';
    if (/morbid obesity|obesity|obesitas/.test(t)) return 'imt-obesitas';
    return null;
  }

  // Asam urat
  if (/uric|asam urat/.test(t)) return /merah|>9|berulang/.test(t) ? 'asam-urat-tinggi' : 'asam-urat-ringan';

  // Paru & pneumokoniosis
  if (/pneumoconiosis|pmf/.test(t)) return /advanced|pmf|lanjut/.test(t) ? 'pneumokoniosis-lanjut' : 'pneumokoniosis-dini';
  if (/lung|paru/.test(t)) return /severe|berat/.test(t) ? 'paru-berat' : 'paru-ringan-sedang';

  // Anemia
  if (/anemia|hemoglobin/.test(t)) return /severe|moderate|berat/.test(t) ? 'anemia-berat' : 'anemia-ringan';

  // Epilepsi
  if (/epilepsy|epilepsi|seizure/.test(t)) {
    return /uncontrolled|tidak terkontrol|non-compliant/.test(t) ? 'epilepsi-tidak-terkontrol' : 'epilepsi-terkontrol-sebagian';
  }

  // Penglihatan & pendengaran
  if (/visual|visus|penglihatan/.test(t)) return /severe|berat/.test(t) ? 'penglihatan-berat' : 'penglihatan-ringan';
  if (/hearing|pendengaran|noise-induced/.test(t)) {
    return /severe|moderate|sedang|berat/.test(t) ? 'pendengaran-sedang-berat' : 'pendengaran-ringan';
  }

  // Hati
  if (/liver|hati|hbsag|hepatitis/.test(t)) return /severe|active|aktif|sirosis|cirrhosis/.test(t) ? 'hati-berat' : 'hati-ringan';

  // Tidur
  if (/daytime sleepiness|\bess\b/.test(t)) return /severe|berat/.test(t) ? 'tidur-berat' : 'tidur-ringan-sedang';

  // Mental
  if (/mental|dass|srq|psikosis|psychotic|gangguan jiwa/.test(t)) {
    if (/berat|tidak stabil|currently unfit|tanda bahaya/.test(t)) return 'mental-berat';
    if (/terkontrol|stabil/.test(t)) return 'mental-terkontrol';
    return 'mental-terduga';
  }

  // Kardiovaskular residual
  if (/cardiac|cardiovascular|stroke|jantung/.test(t)) return 'jantung-stroke-residual';

  // LBP
  if (/low back pain|lbp|punggung/.test(t)) {
    return /neurological|deficit|berat/.test(t) ? 'lbp-berat' : 'lbp-ringan';
  }

  return null;
}

export function aturanDariLabel(label: string, detail?: string): AturanPengendalian | null {
  const kode = kodeParameterDariLabel(label, detail);
  return kode ? PENGENDALIAN_PER_PARAMETER[kode] : null;
}

/**
 * Menyusun teks pengendalian gabungan dari seluruh parameter yang ditemukan.
 *
 * Bila ada lebih dari satu parameter, teks SEMUA parameter tetap dicantumkan
 * (tiap parameter punya tindakan berbeda), dengan frekuensi karyawan mengikuti
 * yang PALING KETAT (Bab 6.2.2). Urutan blok: Merah lebih dulu, lalu Kuning.
 */
export function susunPengendalian(
  findings: { label: string; detail?: string }[],
): { pengendalian: string; bulan: number | null; tanpaKontrolBerkala: boolean } {
  const blok: { judul: string; butir: string[] }[] = [];
  const bulanList: number[] = [];
  let adaKontrol = false;
  let tanpaKontrolBerkala = false;
  const sudah = new Set<KodeParameter>();

  const urutan = findings
    .map((f) => ({ f, aturan: aturanDariLabel(f.label, f.detail), kode: kodeParameterDariLabel(f.label, f.detail) }))
    .filter((x): x is { f: { label: string; detail?: string }; aturan: AturanPengendalian; kode: KodeParameter } => !!x.aturan && !!x.kode)
    .sort((a, b) => (a.aturan.zona === b.aturan.zona ? 0 : a.aturan.zona === 'Merah' ? -1 : 1));

  for (const { aturan, kode, f } of urutan) {
    if (sudah.has(kode)) continue;
    sudah.add(kode);

    const nilai = f.detail ? `${aturan.baris} (${f.detail})` : aturan.baris;
    blok.push({ judul: nilai, butir: aturan.butir });

    if (aturan.bulan === null) {
      tanpaKontrolBerkala = true;
    } else {
      // Termasuk `once` (mis. konfirmasi terduga DM ≤1 bulan): bukan jadwal
      // berulang, tetapi tetap lebih ketat dari "tanpa kontrol" sehingga
      // ikut menentukan frekuensi mengikuti prinsip risiko tertinggi.
      adaKontrol = true;
      bulanList.push(aturan.bulan);
    }
  }

  if (!blok.length) return { pengendalian: '', bulan: null, tanpaKontrolBerkala: false };

  const bulan = adaKontrol && bulanList.length ? Math.min(...bulanList) : null;

  const teks = blok
    .map((b) => [`${b.judul}:`, ...b.butir.map((butir) => `• ${butir}`)].join('\n'))
    .join('\n\n');

  return { pengendalian: teks, bulan, tanpaKontrolBerkala };
}

/**
 * Teks pengendalian zona Hijau. Satu-satunya yang memang seragam, karena
 * Bab 7 hanya menulis satu butir pengendalian untuk seluruh Zona Hijau.
 * Formatnya disamakan dengan `susunPengendalian` (judul + butir `• `) agar
 * kolom `pengendalian` selalu punya bentuk yang sama di semua zona.
 */
export function pengendalianHijau(): string {
  return [
    'Semua parameter dalam batas normal:',
    ...HIJAU_UMUM.butir.map((b) => `• ${b}`),
  ].join('\n');
}
