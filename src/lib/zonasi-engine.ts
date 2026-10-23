// ============================================================
// Zonasi Assessment Engine — BG/QSHE/STD/006 Rev001
// ============================================================
//
// Menentukan zona risiko kesehatan kerja: Hijau, Kuning, atau Merah,
// memakai ambang batas pada Standar Parameter PTM Rev001 Bab 8.
//
// Prinsip dokumen:
//   • Jika ada lebih dari satu kondisi, zona mengikuti risiko tertinggi.
//   • Penentuan akhir mempertimbangkan jenis pekerjaan.
//   • Zonasi BUKAN diagnosis medis, melainkan klasifikasi risiko kerja.
//
// Dua perlakuan berbeda atas data kosong, sesuai instruksi QSHE:
//
//   1. Parameteranamnesis dan kuesioner (riwayat epilepsi, jantung,
//      stroke, asma, sleep apnea, LBP, ESS, SRQ-20, DASS-21)
//      dikosongkan = TIDAK ADA = normal. Data ini tidak boleh
//      menggagalkan penilaian zona.
//
//   2. Parameter objektif (tekanan darah, IMT, gula darah, eGFR, LDL,
//      TG, asam urat, Hb, spirometri, visus, pendengaran, fungsi hati,
//      foto toraks) dikosongkan = zona "Belum Lengkap", karena Hijau
//      tidak bisa dibuktikan tanpa angka tersebut. Daftar parameter yang
//      kurang dikembalikan pada field parameterBelumDinilai supaya bisa
//      dilengkapi lewat form Review MCU.
//
// Semua angka ambang batas dan istilah berasal dari
// clinical-classification.ts. Modul ini tidak mendefinisikan ulang
// angka klinis apa pun.
// ============================================================

import {
  classifyBmi,
  classifyBloodPressure,
  classifyChestXr,
  classifyEgfr,
  classifyGlucose,
  classifyHemoglobin,
  classifyHearing,
  classifyLdl,
  classifyLiver,
  classifyLung,
  classifyTriglyceride,
  classifyUricAcid,
  classifyVision,
  detectGender,
  hasActiveLiverDisease,
  hasArtritisUrat,
  hasAsthma,
  hasChronicLbp,
  hasControlledEpilepsy,
  hasDmKomplikasi,
  hasFunctionalObesityLimitation,
  hasInactiveLiverCarrier,
  hasLbpWithNeurologicalDeficit,
  hasResidualCardiacSymptom,
  hasResidualStroke,
  hasSleepApnea,
  hasUncontrolledEpilepsy,
  isEpilepsyCompliantAndSeizureFree,
  isEpilepsyNonCompliantOrRecentSeizure,
  isEssTreatedAndControlled,
  isEssUncontrolledOrUntreated,
  isMentalConfirmedStable,
  isMentalConfirmedUnstable,
  isReactive,
  parseVisualAcuity,
  toNumber,
  type Classification,
} from '@/lib/clinical-classification';
import { dassBandLabel, dassCategory, isDassActionable, SRQ20_THRESHOLD, type DassDomain } from '@/lib/questionnaire-scores';

export interface ZonasiResult {
  zona: 'Hijau' | 'Kuning' | 'Merah' | 'Belum Lengkap';
  triggers: string[];
  pengendalian: string;
  /** Parameter objektif zonasi yang belum terisi. */
  parameterBelumDinilai: string[];
  /** Temuan di luar rentang tabel SOP yang perlu ditinjau. */
  catatanSOP: string[];
  /** Frekuensi evaluasi ulang sesuai poin 6.2.2 dokumen. */
  frekuensiEvaluasi: string;
}

export interface MCUDraft {
  [key: string]: string | number | undefined;
}

// ═══════════════════════════════════════════
// PARAMETER WAJIB
// ═══════════════════════════════════════════

/** Definisi parameter objektif yang tidak boleh kosong untuk bisa menilai zona. */
interface RequiredParameter {
  key: string;
  label: string;
  satisfied: (d: MCUDraft) => boolean;
}

function genderKnown(d: MCUDraft): boolean {
  return detectGender(d.jenisKelamin) !== 'unknown';
}

const REQUIRED_PARAMETERS: RequiredParameter[] = [
  { key: 'usia', label: 'Usia', satisfied: (d) => toNumber(d.usia) !== null },
  { key: 'jenisKelamin', label: 'Jenis Kelamin', satisfied: genderKnown },
  { key: 'tdS', label: 'Tekanan Darah Sistole', satisfied: (d) => toNumber(d.tdS) !== null },
  { key: 'tdD', label: 'Tekanan Darah Diastole', satisfied: (d) => toNumber(d.tdD) !== null },
  {
    key: 'bmi',
    label: 'IMT (perlu BB dan TB bila IMT kosong)',
    satisfied: (d) => toNumber(d.bmi) !== null || (toNumber(d.bb) !== null && toNumber(d.tb) !== null),
  },
  {
    key: 'gdp',
    label: 'GDP atau HbA1c',
    satisfied: (d) => toNumber(d.gdp) !== null || toNumber(d.hba1c) !== null,
  },
  {
    key: 'egfr',
    label: 'eGFR (atau kreatinin serum untuk dihitung CKD-EPI 2021)',
    satisfied: (d) => toNumber(d.egfr) !== null || calcEgfrCkdEpi2021(d.kreatinin, d.usia, d.jenisKelamin) !== null,
  },
  { key: 'ldl', label: 'LDL', satisfied: (d) => toNumber(d.ldl) !== null },
  { key: 'tg', label: 'Trigliserida (TG)', satisfied: (d) => toNumber(d.tg) !== null },
  { key: 'au', label: 'Asam Urat (AU)', satisfied: (d) => toNumber(d.au) !== null },
  { key: 'hb', label: 'Hemoglobin (Hb)', satisfied: (d) => toNumber(d.hb) !== null },
  {
    key: 'sp',
    label: 'Spirometri (FEV1 % atau interpretasi)',
    satisfied: (d) => toNumber(d.fev1Pct) !== null || String(d.spiInterp ?? '').trim() !== '',
  },
  { key: 'visus', label: 'Visus Jauh', satisfied: (d) => String(d.visusJauh ?? '').trim() !== '' },
  {
    key: 'pta',
    label: 'Audiometri (PTA atau interpretasi)',
    satisfied: (d) => toNumber(d.pta) !== null || String(d.audInterp ?? '').trim() !== '',
  },
  { key: 'sgot', label: 'SGOT', satisfied: (d) => toNumber(d.sgot) !== null },
  { key: 'sgpt', label: 'SGPT', satisfied: (d) => toNumber(d.sgpt) !== null },
  { key: 'hbsag', label: 'HBsAg', satisfied: (d) => String(d.hbsag ?? '').trim() !== '' },
  { key: 'chestXR', label: 'Chest X-Ray', satisfied: (d) => String(d.chestXR ?? '').trim() !== '' },
];

/**
 * Daftar parameter objektif zonasi yang belum terisi.
 * Item ini muncul di antarmuka form agar bisa dilengkapi tanpa perlu
 * menghitung ulang dari nol.
 */
export function getMissingZonasiInputs(d: MCUDraft): string[] {
  return REQUIRED_PARAMETERS
    .filter((parameter) => !parameter.satisfied(d))
    .map((parameter) => parameter.label);
}

// ═══════════════════════════════════════════
// ZONASI
// ═══════════════════════════════════════════

interface Finding {
  label: string;
  severity: 'merah' | 'kuning';
  detail?: string;
}

export function assessZonasi(d: MCUDraft, gender?: string): ZonasiResult {
  const missing = getMissingZonasiInputs(d);
  if (missing.length > 0) {
    return {
      zona: 'Belum Lengkap',
      triggers: [],
      pengendalian: 'Lengkapi parameter zonasi yang tercantum di bawah ini untuk menjalankan penilaian.',
      parameterBelumDinilai: missing,
      catatanSOP: [],
      frekuensiEvaluasi: '-',
    };
  }

  const genderKey = gender ?? d.jenisKelamin;
  const ctx: AssessCtx = {
    d, genderKey, catatanSOP: [], merah: [], kuning: [],
    collect: () => {},
  };
  ctx.collect = makeCollect(ctx);

  assessObjectiveZonasi(ctx);
  assessAnamnesisZonasi(ctx);
  assessQuestionnaireZonasi(ctx);

  return buildZonasiOutcome(ctx.merah, ctx.kuning, ctx.catatanSOP);
}

interface AssessCtx {
  d: MCUDraft;
  genderKey: string | number | undefined;
  catatanSOP: string[];
  merah: Finding[];
  kuning: Finding[];
  collect: (finding: Classification | null, label?: string) => void;
}

/**
 * Menempatkan hasil klasifikasi ke zona sesuai severity-nya.
 * severity 'tidak-dinilai' berarti nilai berada di luar rentang tabel
 * SOP, sehingga dilaporkan sebagai catatan, bukan dipaksa masuk zona.
 */
function makeCollect(ctx: AssessCtx) {
  return (finding: Classification | null, label?: string) => {
    if (!finding) return;
    const name = label ?? finding.label;
    if (finding.severity === 'tidak-dinilai') {
      ctx.catatanSOP.push(`${finding.label}: ${finding.detail ?? ''}`.trim());
      return;
    }
    if (finding.severity === 'merah') {
      ctx.merah.push({ label: `${name} (Merah)`, severity: 'merah', detail: finding.detail });
      return;
    }
    if (finding.severity === 'kuning') {
      ctx.kuning.push({ label: `${name} (Kuning)`, severity: 'kuning', detail: finding.detail });
    }
  };
}

/** Parameter 1-12: pengukuran objektif (TD, glukosa, lipid, fungsi organ). */
function assessObjectiveZonasi(ctx: AssessCtx) {
  const { d, collect } = ctx;

  // -- 1. Tekanan darah: Hijau <140/90 - Kuning Grade I - Merah Grade >=2
  collect(classifyBloodPressure(toNumber(d.tdS), toNumber(d.tdD)));

  // -- 2. Glukosa darah
  collect(classifyGlucose(toNumber(d.gdp), toNumber(d.gd2pp), toNumber(d.hba1c)));

  // -- 3. Dislipidemia
  collect(classifyLdl(toNumber(d.ldl)));
  collect(classifyTriglyceride(toNumber(d.tg)));

  // -- 4. Fungsi ginjal
  const egfr = toNumber(d.egfr) ?? calcEgfrCkdEpi2021(d.kreatinin, d.usia, d.jenisKelamin);
  collect(classifyEgfr(egfr));

  // -- 5. Asam urat (STD-006 Rev.002: bila ada riwayat artritis urat, AU >=7 langsung Merah)
  const auVal = toNumber(d.au);
  const auClass = classifyUricAcid(auVal, detectGender(ctx.genderKey));
  if (auClass) {
    if (hasArtritisUrat(d.artritisUrat) && auVal !== null && auVal >= 7) {
      ctx.merah.push({
        label: 'Hyperuricemia with Recurrent Gouty Arthritis History (Merah)',
        severity: 'merah',
        detail: `${auClass.detail}, dengan riwayat artritis gout berulang`,
      });
    } else {
      collect(auClass);
    }
  } else if (hasArtritisUrat(d.artritisUrat)) {
    ctx.kuning.push({
      label: 'History of Recurrent Gouty Arthritis (Kuning)',
      severity: 'kuning',
      detail: String(d.artritisUrat),
    });
  }

  // -- 6. Indeks massa tubuh & Keterbatasan Fungsional
  const bmi = toNumber(d.bmi);
  const weight = classifyBmi(bmi);
  if (hasFunctionalObesityLimitation(d.obesitasFungsional)) {
    ctx.merah.push({
      label: 'Severe Obesity with Functional / Mobility Limitation (Merah)',
      severity: 'merah',
      detail: `${weight?.detail ?? 'IMT tinggi'}, ${d.obesitasFungsional}`,
    });
  } else if (weight && weight.severity === 'merah') {
    collect(weight);
  } else if (weight && weight.severity === 'kuning') {
    if (bmi !== null && bmi >= 30) {
      // IMT >=30: kuning hanya bila TIDAK ada komorbid signifikan.
      const comorbid = hasComorbidity(d, ctx.genderKey);
      if (comorbid) {
        ctx.merah.push({
          label: 'Obesity with Significant Comorbidity (Merah)',
          severity: 'merah',
          detail: `${weight.detail}, disertai ${comorbid}`,
        });
      } else {
        ctx.kuning.push({ label: `${weight.label} tanpa komorbid metabolik (Kuning)`, severity: 'kuning', detail: weight.detail });
      }
    } else {
      collect(weight);
    }
  }

  // -- 7. Hemoglobin
  collect(classifyHemoglobin(toNumber(d.hb), detectGender(ctx.genderKey)));

  // -- 8. Fungsi paru
  collect(classifyLung(toNumber(d.fev1Pct), toNumber(d.fev1FvcAct), toNumber(d.fvcPct), String(d.spiInterp ?? '')));

  // -- 9. Penglihatan
  collect(classifyVision(d.visusJauh));

  // -- 10. Pendengaran
  collect(classifyHearing(toNumber(d.pta), String(d.audInterp ?? '')));

  // -- 11. Fungsi hati & Diagnosis Klinis Hati (STD-006 Rev.002)
  collect(classifyLiver(toNumber(d.sgot), toNumber(d.sgpt), isReactive(d.hbsag)));
  if (hasActiveLiverDisease(d.diagnosisHati)) {
    ctx.merah.push({
      label: 'Active Liver Disease / Cirrhosis / Chronic Impairment (Merah)',
      severity: 'merah',
      detail: String(d.diagnosisHati),
    });
  } else if (hasInactiveLiverCarrier(d.diagnosisHati)) {
    ctx.kuning.push({
      label: 'Inactive / Healthy Hepatitis Carrier (Kuning)',
      severity: 'kuning',
      detail: String(d.diagnosisHati),
    });
  }

  // -- 12. Pneumokoniosis
  collect(classifyChestXr(d.chestXR));
}

/** Parameter 13-15: anamnesis -- kosong dianggap normal. */
function assessAnamnesisZonasi(ctx: AssessCtx) {
  const { d } = ctx;

  // -- 13. Epilepsi & Kepatuhan Terapi
  if (hasUncontrolledEpilepsy(d.riwayatEpilepsi) || isEpilepsyNonCompliantOrRecentSeizure(d.epilepsiKepatuhan)) {
    ctx.merah.push({
      label: 'Epilepsy, Uncontrolled / Non-compliant (Merah)',
      severity: 'merah',
      detail: [d.riwayatEpilepsi, d.epilepsiKepatuhan].filter(Boolean).join(' | '),
    });
  } else if (hasControlledEpilepsy(d.riwayatEpilepsi) || isEpilepsyCompliantAndSeizureFree(d.epilepsiKepatuhan)) {
    ctx.kuning.push({
      label: 'Epilepsy, Controlled (Kuning)',
      severity: 'kuning',
      detail: [d.riwayatEpilepsi, d.epilepsiKepatuhan].filter(Boolean).join(' | '),
    });
  }

  // -- 14. Riwayat jantung / stroke
  if (hasResidualCardiacSymptom(d.riwayatJantung)) {
    ctx.merah.push({ label: 'Cardiovascular Disease with Residual Symptoms (Merah)', severity: 'merah' });
  }
  if (hasResidualStroke(d.riwayatStroke)) {
    ctx.merah.push({ label: 'Stroke with Residual Symptoms (Merah)', severity: 'merah' });
  }

  // -- 15. LBP
  if (hasLbpWithNeurologicalDeficit(d.lbp)) {
    ctx.merah.push({ label: 'Chronic Low Back Pain with Neurological Deficit (Merah)', severity: 'merah', detail: String(d.lbp) });
  } else if (hasChronicLbp(d.lbp)) {
    ctx.kuning.push({ label: 'Chronic Low Back Pain (Kuning)', severity: 'kuning', detail: String(d.lbp) });
  }

  // -- 16. Komplikasi Diabetes Melitus (STD-006 Rev.002)
  if (hasDmKomplikasi(d.dmKomplikasi)) {
    ctx.merah.push({
      label: 'Diabetes Melitus with Complications (Neuropathy/Retinopathy/Nephropathy) (Merah)',
      severity: 'merah',
      detail: String(d.dmKomplikasi),
    });
  }
}

/** Parameter 17-18: kuesioner -- kosong dianggap normal. */
function assessQuestionnaireZonasi(ctx: AssessCtx) {
  const { d } = ctx;

  // -- 17. Kualitas tidur (ESS & Status Terapi): Hijau <11 - Kuning 11-15 - Merah >15
  const ess = toNumber(d.essScore);
  if (ess !== null) {
    if (ess > 15) {
      if (isEssTreatedAndControlled(d.statusTerapiEss)) {
        ctx.kuning.push({
          label: `Excessive Daytime Sleepiness Under Treatment & Controlled (ESS ${ess}) (Kuning)`,
          severity: 'kuning',
          detail: 'Dalam terapi dan terkontrol, monitoring berkala',
        });
      } else {
        ctx.merah.push({
          label: `Excessive Daytime Sleepiness (Severe, Untreated/Uncontrolled, ESS ${ess}) (Merah)`,
          severity: 'merah',
          detail: d.statusTerapiEss ? String(d.statusTerapiEss) : 'Belum ada terapi / tidak patuh',
        });
      }
    } else if (ess >= 11) {
      ctx.kuning.push({ label: `Excessive Daytime Sleepiness (Mild to Moderate, ESS ${ess}) (Kuning)`, severity: 'kuning' });
    }
  }

  // -- 18. Kesehatan mental (STD/006 Rev.002 poin 6.1.8 & ProKawan)
  const srq = toNumber(d.srq20Score);
  // Tanda Bahaya Kesehatan Jiwa: butir 17 SRQ-20 = "Ya". Berapa pun skor
  // totalnya, karyawan masuk Zona Merah DAN tidak boleh ditugaskan pada
  // pekerjaan berisiko tinggi (termasuk mengemudi) sampai dinilai dokter.
  if (d.srq17Bahaya === 'Ya' || String(d.srq17Bahaya) === 'true' || d.srq17Bahaya === 'ya') {
    ctx.merah.push({
      label: 'Tanda Bahaya Kesehatan Jiwa — SRQ-20 butir 17 = Ya (Merah)',
      severity: 'merah',
      detail: 'Penilaian dokter HARI YANG SAMA; sampai dinilai dokter karyawan tidak ditugaskan pada pekerjaan berisiko tinggi termasuk mengemudi',
    });
  }

  // Status Konfirmasi Gangguan Jiwa (STD-006 Rev.002)
  if (isMentalConfirmedUnstable(d.mentalKonfirmasi)) {
    ctx.merah.push({
      label: 'Gangguan Jiwa Terkonfirmasi Belum Stabil (Merah)',
      severity: 'merah',
      detail: 'Rujukan dokter spesialis jiwa (Sp.KJ) & pendampingan intensif ProKawan',
    });
  } else if (isMentalConfirmedStable(d.mentalKonfirmasi)) {
    ctx.kuning.push({
      label: 'Gangguan Jiwa Terkonfirmasi Stabil / Terkontrol (Kuning)',
      severity: 'kuning',
      detail: 'Monitoring kepatuhan pengobatan via ProKawan',
    });
  }

  if (srq !== null && srq >= SRQ20_THRESHOLD) {
    ctx.kuning.push({ label: `Terduga Gangguan Mental Emosional (SRQ-20 ${srq}) (Kuning)`, severity: 'kuning' });
  }
  // Ambang "berat" DASS-21 berbeda per subskala (depresi 22, ansietas 20,
  // stres 26), jadi penentuannya memakai kategori, bukan angka tetap.
  const dassDomains: [DassDomain, number | null][] = [
    ['depresi', toNumber(d.dassDepresi)],
    ['ansietas', toNumber(d.dassCemas)],
    ['stres', toNumber(d.dassStres)],
  ];
  const DASS_LABEL: Record<DassDomain, string> = {
    depresi: 'Depresi', ansietas: 'Ansietas', stres: 'Stres',
  };
  for (const [domain, value] of dassDomains) {
    if (value === null || !isDassActionable(domain, value)) continue;
    const verySevere = dassCategory(domain, value) === 'sangat-berat';
    const severity = verySevere ? 'merah' : 'kuning';
    (verySevere ? ctx.merah : ctx.kuning).push({
      label: `DASS-21 ${DASS_LABEL[domain]} ${value} — ${dassBandLabel(domain, value)} (${verySevere ? 'Merah' : 'Kuning'})`,
      severity,
    });
  }
  // SDS-30 TIDAK dipakai untuk menetapkan zona MCU. Instrumen ini mengukur
  // FAKTOR PSIKOLOGI KERJA (Permenaker 5/2018), bukan gejala klinis, dan
  // hasilnya dipakai terpisah untuk pemetaan risiko psikologis lingkungan kerja.
  // Kategori dinilai per indikator (5–9 rendah / 10–24 sedang / 25–35 tinggi)
  // dan tersedia di halaman Input Kesehatan Mental serta dashboard.
}

/** Membangun ZonasiResult akhir dari temuan yang terkumpul. */
function buildZonasiOutcome(merah: Finding[], kuning: Finding[], catatanSOP: string[]): ZonasiResult {
  if (merah.length > 0) {
    return {
      zona: 'Merah',
      triggers: merah.map((f) => (f.detail ? `${f.label} — ${f.detail}` : f.label)),
      pengendalian: [
        '• Wajib kontrol dokter spesialis setiap 1 bulan sampai stabil',
        '• Wajib menyerahkan surat kontrol atau clearance',
        '• Evaluasi ulang status setiap 1 bulan',
        '• Dapat direkomendasikan penempatan sementara (Currently Unfit)',
        '• Tidak diperkenankan bekerja di area risiko tinggi (ketinggian, alat berat, confined space, shift malam intensif) sampai dinyatakan stabil',
      ].join('\n'),
      parameterBelumDinilai: [],
      catatanSOP,
      frekuensiEvaluasi: 'Setiap 1 bulan',
    };
  }

  if (kuning.length > 0) {
    // Poin 6.2.2: bila hanya Prediabetes atau Obesitas ringan/sedang, kontrol 6 bulan.
    // Parameter lain selalu 3 bulan, dan bila ada lebih dari satu, yang terpendek berlaku.
    const onlyLongInterval = kuning.every((f) => /Prediabetes/i.test(f.label) || /Obesity/i.test(f.label) || /Overweight/i.test(f.label));
    const interval = onlyLongInterval ? '6 bulan' : '3 bulan';
    return {
      zona: 'Kuning',
      triggers: kuning.map((f) => (f.detail ? `${f.label} — ${f.detail}` : f.label)),
      pengendalian: [
        `• Wajib kontrol dokter minimal setiap ${interval}`,
        '• Wajib menyerahkan bukti kontrol ke HO',
        '• Tidak direkomendasikan bekerja di area risiko tinggi bila kondisi belum stabil',
        `• Evaluasi ulang status zona setiap ${interval}`,
        '• Program perbaikan gaya hidup (berat badan, diet, olahraga)',
        '• Layak kerja dengan monitoring (Fit With Note)',
      ].join('\n'),
      parameterBelumDinilai: [],
      catatanSOP,
      frekuensiEvaluasi: `Setiap ${interval}`,
    };
  }

  return {
    zona: 'Hijau',
    triggers: [],
    pengendalian: [
      '• MCU rutin sesuai jadwal perusahaan (1 tahun sekali atau sesuai kebijakan)',
      '• Edukasi gaya hidup sehat',
      '• Layak kerja tanpa pembatasan khusus',
    ].join('\n'),
    parameterBelumDinilai: [],
    catatanSOP,
    frekuensiEvaluasi: 'Minimal 1 kali dalam 12 bulan',
  };
}

/** Komorbid signifikan untuk IMT ≥30: hipertensi, DM, atau gangguan napas. */
function hasComorbidity(d: MCUDraft, gender: string | number | undefined): string | null {
  const reasons: string[] = [];
  const tdS = toNumber(d.tdS);
  const tdD = toNumber(d.tdD);
  if ((tdS !== null && tdS >= 140) || (tdD !== null && tdD >= 90)) reasons.push('hipertensi');

  const glucose = classifyGlucose(toNumber(d.gdp), toNumber(d.gd2pp), toNumber(d.hba1c));
  if (glucose && (glucose.severity === 'merah' || (glucose.severity === 'kuning' && !/prediabetes/i.test(glucose.label)))) {
    reasons.push('diabetes');
  }

  if (hasAsthma(d.riwayatAsma)) reasons.push('asma');
  if (hasSleepApnea(d.riwayatSleepApnea)) reasons.push('sleep apnea');

  // Gangguan napas juga bisa terbaca dari interpretasi spirometri.
  const spi = String(d.spiInterp ?? '').toLowerCase();
  if (/\bosa\b|\bohs\b|asma|asthma|dispnea|dispnoea/.test(spi)) reasons.push('gangguan napas');

  void gender;
  return reasons.length > 0 ? reasons.join(', ') : null;
}

// ═══════════════════════════════════════════
// FUNGSI PERHITUNGAN DASAR
// ═══════════════════════════════════════════

/**
 * eGFR dengan CKD-EPI 2021 (Inker et al., 2021), rumus yang dipakai
 * PNPK CKD Kemenkes RI. Hanya berlaku untuk usia 18 tahun ke atas.
 */
export function calcEgfrCkdEpi2021(
  creatinine: string | number | undefined,
  age: string | number | undefined,
  gender: string | number | undefined,
): number | null {
  const scr = toNumber(creatinine);
  const years = toNumber(age);
  if (scr === null || scr <= 0 || years === null || years < 18 || years > 120) return null;

  const detected = detectGender(gender);
  if (detected === 'unknown') return null;

  const isFemale = detected === 'female';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const ratio = scr / kappa;
  const egfr = 142
    * Math.pow(Math.min(ratio, 1), alpha)
    * Math.pow(Math.max(ratio, 1), -1.2)
    * Math.pow(0.9938, years)
    * (isFemale ? 1.012 : 1);

  return Number.isFinite(egfr) ? Number(egfr.toFixed(1)) : null;
}

export function calcBMI(bb: number | null, tb: number | null): number | null {
  if (!bb || !tb) return null;
  const h = tb / 100;
  if (h <= 0) return null;
  return parseFloat((bb / (h * h)).toFixed(1));
}

export function calcMCHC(hb: number | null, hct: number | null): number | null {
  if (!hb || !hct || hct <= 0) return null;
  return parseFloat(((hb / hct) * 100).toFixed(1));
}

export function calcPct(act: number | null, pred: number | null): number | null {
  if (act === null || !pred || pred <= 0) return null;
  return parseFloat(((act / pred) * 100).toFixed(1));
}

/**
 * Pure Tone Average: rata-rata ambang dengar pada 500, 1000, 2000, dan
 * 4000 Hz. Nilai yang dipakai untuk klasifikasi NIHL pada SOP. Bila
 * hanya satu frekuensi yang terisi, rata-rata dihitung dari frekuensi
 * yang tersedia (minimal satu nilai).
 */
export function calcPTA(frequencies: (number | null)[]): number | null {
  const available = frequencies.filter((value): value is number => value !== null && Number.isFinite(value));
  if (available.length === 0) return null;
  const average = available.reduce((sum, value) => sum + value, 0) / available.length;
  return Number(average.toFixed(1));
}

export function calcDiabetes(gdp: number | null, gdpSeSATA: number | null, hba1c: number | null): string {
  if ((gdp !== null && gdp >= 126) || (gdpSeSATA !== null && gdpSeSATA >= 200) || (hba1c !== null && hba1c >= 6.5)) {
    return 'Ya';
  }
  return 'Tidak';
}

export function calcPerluFU(kesVendor: string | undefined, hasAbnormal: boolean): string {
  if (!kesVendor || kesVendor === 'Fit To Work') return 'Tidak';
  return hasAbnormal ? 'Ya' : 'Tidak';
}

// ═══════════════════════════════════════════
// FRAMINGHAM RISK SCORE
// ═══════════════════════════════════════════

export function calcFramingham(d: MCUDraft): { score: number; prob: string; kat: string } {
  const age = toNumber(d.usia);
  const chol = toNumber(d.chol);
  const hdl = toNumber(d.hdl);
  const sbp = toNumber(d.tdS);
  const smoking = d.merokok === 'Ya';
  const dm = d.diabetes === 'Ya';
  const isMale = detectGender(d.jenisKelamin) === 'male';

  if (!age || !chol || hdl === null || !sbp || !d.jenisKelamin) {
    return { score: 0, prob: 'Cek Parameter', kat: 'Cek Parameter' };
  }

  // Declarative point tables. Each entry is [ageUpperBound, points]; the
  // first row whose bound is >= age wins. Cholesterol tables are per age
  // band: [ageUpperBound, [points for <160, <200, <240, <280, >=280]].
  const AGE_POINTS: Record<'male' | 'female', [number, number][]> = {
    male: [[34, -9], [39, -4], [44, 0], [49, 3], [54, 6], [59, 8], [64, 10], [69, 11], [74, 12], [Infinity, 13]],
    female: [[34, -7], [39, -3], [44, 0], [49, 3], [54, 6], [59, 8], [64, 10], [69, 12], [74, 14], [Infinity, 16]],
  };
  const CHOL_POINTS: Record<'male' | 'female', [number, number[]][]> = {
    male: [
      [39, [0, 4, 7, 9, 11]],
      [49, [0, 3, 5, 6, 8]],
      [59, [0, 2, 3, 4, 5]],
      [69, [0, 1, 1, 2, 3]],
      [Infinity, [0, 0, 0, 1, 1]],
    ],
    female: [
      [39, [0, 4, 8, 11, 13]],
      [49, [0, 3, 6, 8, 10]],
      [59, [0, 2, 4, 5, 7]],
      [69, [0, 1, 2, 3, 4]],
      [Infinity, [0, 1, 1, 2, 2]],
    ],
  };
  const SMOKING_POINTS: Record<'male' | 'female', [number, number][]> = {
    male: [[39, 8], [49, 5], [59, 3], [69, 1], [Infinity, 1]],
    female: [[39, 9], [49, 7], [59, 4], [69, 2], [Infinity, 1]],
  };
  const DM_POINTS: Record<'male' | 'female', number> = { male: 3, female: 5 };
  const SBP_POINTS: Record<'male' | 'female', number[]> = {
    // [<120, <130, <140, <160, >=160]
    male: [0, 0, 1, 1, 2],
    female: [0, 1, 2, 3, 4],
  };
  const PROB_TABLE: Record<'male' | 'female', [number, string][]> = {
    male: [[0, '1'], [5, '2'], [7, '3'], [8, '4'], [9, '5'], [10, '6'], [11, '8'], [12, '10'], [13, '12'], [14, '16'], [15, '20'], [16, '25']],
    female: [[9, '1'], [13, '2'], [15, '3'], [16, '4'], [17, '5'], [18, '6'], [19, '8'], [20, '11'], [21, '14'], [22, '17'], [23, '22'], [24, '27']],
  };
  const PROB_CAPS: Record<'male' | 'female', { below: number; minScore: number }> = {
    male: { below: 0, minScore: 17 },
    female: { below: 9, minScore: 25 },
  };

  const genderKey: 'male' | 'female' = isMale ? 'male' : 'female';

  const lookup = <T>(table: [number, T][], value: number): T => {
    for (const [bound, points] of table) {
      if (value <= bound) return points;
    }
    return table[table.length - 1][1];
  };

  let score = lookup(AGE_POINTS[genderKey], age);

  const cholBand = lookup(CHOL_POINTS[genderKey], age);
  if (chol < 160) score += cholBand[0];
  else if (chol < 200) score += cholBand[1];
  else if (chol < 240) score += cholBand[2];
  else if (chol < 280) score += cholBand[3];
  else score += cholBand[4];

  if (hdl >= 60) score -= 1;
  else if (hdl >= 50) score += 0;
  else if (hdl >= 40) score += 1;
  else score += 2;

  const sbpIdx = sbp < 120 ? 0 : sbp < 130 ? 1 : sbp < 140 ? 2 : sbp < 160 ? 3 : 4;
  score += SBP_POINTS[genderKey][sbpIdx];

  if (smoking) score += lookup(SMOKING_POINTS[genderKey], age);
  if (dm) score += DM_POINTS[genderKey];

  const caps = PROB_CAPS[genderKey];
  let probNum: number;
  if (score < caps.below) probNum = 0;
  else if (score >= caps.minScore) probNum = 30;
  else {
    probNum = 1;
    for (const [min, pct] of PROB_TABLE[genderKey]) {
      if (score >= min) probNum = parseFloat(pct);
    }
  }

  const prob = probNum === 0 ? '<1%' : probNum >= 30 ? '≥30%' : `${probNum}%`;
  let kat = '';
  if (probNum >= 20) kat = 'High Risk';
  else if (probNum >= 10) kat = 'Intermediate Risk';
  else kat = 'Low Risk';

  return { score, prob, kat };
}
