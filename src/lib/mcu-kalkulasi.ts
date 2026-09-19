export interface MCUCalcData {
  tdS?: number;
  tdD?: number;
  gdp?: number;
  gd2pp?: number;
  hba1c?: number;
  ldl?: number;
  tg?: number;
  chol?: number;
  hdl?: number;
  egfr?: number;
  bmi?: number;
  au?: number;
  hb?: number;
  sgot?: number;
  sgpt?: number;
  merokok?: string;
  diabetes?: string; // 'Ya' / 'Tidak'
  
  // Text fields for parsing string triggers
  catatan?: string; 
  chestXR?: string;
  spiInterp?: string;
  audInterp?: string;
  visusJauh?: string;
  hbsag?: string;
  tesKebugaran?: string; // Usually contains ESS / DASS / SRQ
}

export interface ZonasiResult {
  kategori: 'Merah' | 'Kuning' | 'Hijau';
  triggers: string[];
  pengendalian: string;
}

/**
 * Kalkulasi Zonasi berdasarkan SOP: BG/QSHE/STD/006
 */
export function calculateZonasi(data: MCUCalcData, gender: string, umur?: number): ZonasiResult {
  const triggers: string[] = [];
  let kategori: 'Merah' | 'Kuning' | 'Hijau' = 'Hijau';

  const isMale = gender?.toLowerCase().includes('laki');
  const isFemale = gender?.toLowerCase().includes('perem');
  
  const textCatatan = (data.catatan || '').toLowerCase();
  const textFitness = (data.tesKebugaran || '').toLowerCase();
  const textSpiro = (data.spiInterp || '').toLowerCase();
  const textAudio = (data.audInterp || '').toLowerCase();
  const textVisus = (data.visusJauh || '').toLowerCase();
  const textCXR = (data.chestXR || '').toLowerCase();

  // Helper function to upgrade to Merah
  const addMerah = (msg: string) => {
    triggers.push(msg);
    kategori = 'Merah';
  };

  // Helper function to upgrade to Kuning (only if not already Merah)
  const addKuning = (msg: string) => {
    triggers.push(msg);
    if (kategori === 'Hijau') kategori = 'Kuning';
  };

  // 1. Tekanan Darah
  if (data.tdS >= 160 || data.tdD >= 100) addMerah("Hipertensi Grade ≥2 (Merah)");
  else if ((data.tdS >= 140 && data.tdS <= 159) || (data.tdD >= 90 && data.tdD <= 99)) addKuning("Hipertensi Grade 1 (Kuning)");

  // 2. Gula Darah & DM
  if (data.hba1c >= 8 || data.gdp >= 200) addMerah("DM Tidak Terkontrol (Merah)");
  else if ((data.gdp >= 100 && data.gdp <= 125) || (data.hba1c >= 7 && data.hba1c < 7.5)) addKuning("Prediabetes (Kuning)");
  
  // Komplikasi DM
  if (textCatatan.includes('neuropati') || textCatatan.includes('retinopati') || textCatatan.includes('nefropati')) {
    addMerah("DM dengan Komplikasi (Merah)");
  }

  // 3. Ginjal (eGFR)
  if (data.egfr < 45) addMerah("CKD ≥G3b / eGFR <45 (Merah)");
  else if (data.egfr >= 45 && data.egfr <= 59) addKuning("CKD G2–G3a / eGFR 45-59 (Kuning)");

  // 4. Profil Lipid (LDL & TG)
  if (data.ldl >= 190) addMerah("LDL Sangat Tinggi / Tidak Terkontrol (Merah)");
  else if (data.ldl >= 100 && data.ldl <= 189) addKuning("Dislipidemia Sedang (Kuning)");

  if (data.tg >= 500) addMerah("Trigliserida Sangat Tinggi (Merah)");
  else if (data.tg >= 200 && data.tg <= 499) addKuning("Trigliserida Risiko Sedang (Kuning)");

  // 5. BMI / Obesitas
  const isObeseComorbid = (data.bmi >= 30) && (
    (data.tdS >= 140 || data.tdD >= 90) || (data.hba1c >= 7) || (data.gdp >= 100) || 
    textCatatan.includes('osa') || textCatatan.includes('ohs') || textCatatan.includes('asma') || textCatatan.includes('dispnea')
  );

  if (data.bmi >= 35 && textCatatan.includes('gangguan aktivitas')) addMerah("Obesitas Keterbatasan Fungsional / BMI ≥35 (Merah)");
  else if (data.bmi >= 35) addMerah("Obesitas Morbid (Merah)"); // General safety catch for >= 35
  else if (isObeseComorbid) addMerah("Obesitas dengan Komorbid (Merah)");
  else if (data.bmi >= 30 && data.bmi < 35) addKuning("Obesitas Tanpa Komorbid (Kuning)");
  else if (data.bmi >= 25 && data.bmi < 30) addKuning("Obesitas Ringan-Sedang (Kuning)");
  else if (data.bmi >= 23 && data.bmi <= 24.9) addKuning("Overweight (Kuning)");

  // 6. Riwayat Jantung / Stroke
  if (textCatatan.includes('riwayat jantung') || textCatatan.includes('riwayat stroke') || textCatatan.includes('defisit fungsional')) {
    addMerah("Riwayat Jantung/Stroke dengan Gejala Residual (Merah)");
  }

  // 7. Asam Urat
  if (data.au > 9 && textCatatan.includes('artritis')) addMerah("Asam Urat >9 dengan Artritis / Tidak Terkontrol (Merah)");
  else if (data.au > 9) addMerah("Asam Urat Sangat Tinggi >9 (Merah)");
  else if (data.au >= 7 && data.au <= 9) addKuning("Hiperurisemia Ringan (Kuning)");

  // 8. Spirometri (Fungsi Paru)
  if (textSpiro.includes('berat') || textSpiro.includes('severe') || textSpiro.includes('<50%') || textSpiro.includes('gagal napas')) {
    addMerah("Gangguan Paru Berat (Merah)");
  } else if (textSpiro.includes('mild') || textSpiro.includes('moderate') || textSpiro.includes('ringan') || textSpiro.includes('sedang')) {
    addKuning("Gangguan Paru Ringan-Sedang (Kuning)");
  }

  // 9. Hematologi (Anemia)
  if (data.hb && data.hb < 10) {
    addMerah("Anemia Sedang-Berat (Merah)");
  } else if (data.hb) {
    if (isMale && data.hb >= 11 && data.hb <= 13.4) addKuning("Anemia Ringan (Kuning)");
    if (isFemale && data.hb >= 10 && data.hb <= 11.9) addKuning("Anemia Ringan (Kuning)");
  }

  // 10. Neurologi (Epilepsi)
  if (textCatatan.includes('epilepsi tidak terkontrol') || textCatatan.includes('kejang')) addMerah("Epilepsi Tidak Terkontrol (Merah)");
  else if (textCatatan.includes('epilepsi terkontrol')) addKuning("Epilepsi Terkontrol (Kuning)");

  // 11. Mata (Penglihatan / Visus Jauh)
  if (textVisus !== 'dbn' && textVisus !== 'normal' && textVisus !== 'n/a' && textVisus !== '') {
    if (!textVisus.includes('terkoreksi') && (textVisus.includes('1/60') || textVisus.includes('2/60') || textVisus.includes('3/60') || textVisus.includes('1/300') || textVisus.includes('20/200') || textVisus.includes('20/400') || textVisus.includes(' lp') || textVisus.includes('nlp'))) {
      addMerah("Gangguan Penglihatan Berat (Merah)");
    } else if (!textVisus.includes('terkoreksi') && (textVisus.includes('6/9') || textVisus.includes('6/12') || textVisus.includes('6/18') || textVisus.includes('20/30') || textVisus.includes('20/60') || textVisus.includes('20/100'))) {
      addKuning("Gangguan Penglihatan Ringan-Sedang (Kuning)");
    }
  }

  // 12. THT (Pendengaran)
  if (textAudio !== 'dbn' && textAudio !== 'normal' && textAudio !== 'n/a' && textAudio !== '') {
    if (textAudio.includes('moderate') || textAudio.includes('severe') || textAudio.includes('bilateral') || textAudio.includes('berat')) {
      addMerah("Gangguan Pendengaran Sedang-Berat / NIHL (Merah)");
    } else if (textAudio.includes('mild') || textAudio.includes('threshold shift') || textAudio.includes('ringan')) {
      addKuning("Gangguan Pendengaran Ringan (Kuning)");
    }
  }

  // 13. Fungsi Hati (SGOT/SGPT & HBsAg)
  // Assuming normal upper limit is roughly 40 for SGOT/SGPT. 3x is 120.
  if ((data.sgot && data.sgot > 120) || (data.sgpt && data.sgpt > 123) || textCatatan.includes('hepatitis aktif') || textCatatan.includes('sirosis')) {
    addMerah("Kerusakan Hati Berat / Hepatitis Aktif (Merah)");
  } else if ((data.sgot && data.sgot >= 40 && data.sgot <= 120) || (data.sgpt && data.sgpt >= 41 && data.sgpt <= 123)) {
    addKuning("Fungsi Hati Meningkat (Kuning)");
  }
  if ((data.hbsag || '').toLowerCase().includes('reaktif') || (data.hbsag || '').toLowerCase() === 'positif') {
    if (kategori !== 'Merah') addKuning("HBsAg Reaktif / Carrier Hepatitis (Kuning)");
  }

  // 14. Radiologi (Pneumokoniosis)
  if (textCXR.includes('ilo 2') || textCXR.includes('ilo 3') || textCXR.includes('pmf')) {
    addMerah("Pneumokoniosis Lanjut / ILO ≥2/1 (Merah)");
  } else if (textCXR.includes('ilo 1/0') || textCXR.includes('ilo 1/1')) {
    addKuning("Pneumokoniosis Dini (Kuning)");
  }

  // 15. Tes Kebugaran & Psikologis (ESS, DASS, SRQ)
  // Parse scores if possible using regex
  const essMatch = textFitness.match(/ess\s*[:-]?\s*(\d+)/i) || textCatatan.match(/ess\s*[:-]?\s*(\d+)/i);
  if (essMatch) {
    const essScore = parseInt(essMatch[1], 10);
    if (essScore > 15) addMerah("Gangguan Tidur Berat / ESS >15 (Merah)");
    else if (essScore >= 11 && essScore <= 15) addKuning("Kantuk Berlebihan Ringan-Sedang / ESS 11-15 (Kuning)");
  }
  
  const srqMatch = textFitness.match(/srq\s*[:-]?\s*(\d+)/i) || textCatatan.match(/srq\s*[:-]?\s*(\d+)/i);
  if (srqMatch) {
    const srqScore = parseInt(srqMatch[1], 10);
    if (srqScore >= 10) addMerah("Gangguan Mental Emosional (SRQ ≥10) (Merah)");
    else if (srqScore >= 6 && srqScore <= 9) addKuning("Gangguan Mental Emosional Terkontrol (SRQ 6-9) (Kuning)");
  }

  if (textFitness.includes('dass') || textCatatan.includes('dass')) {
    if (textFitness.includes('sangat berat') || textFitness.includes('psikosis') || textCatatan.includes('sangat berat')) {
      addMerah("DASS Berat/Sangat Berat (Merah)");
    } else if (textFitness.includes('ringan') || textFitness.includes('sedang')) {
      addKuning("DASS Ringan-Sedang (Kuning)");
    }
  }

  // 16. Nyeri Punggung Bawah (LBP)
  if (textCatatan.includes('lbp defisit') || textCatatan.includes('lbp dengan defisit neurologis') || textCatatan.includes('nyeri punggung berat')) {
    addMerah("LBP Kronik dengan Defisit Neurologis / Berat (Merah)");
  } else if (textCatatan.includes('lbp kronik') || textCatatan.includes('nyeri punggung sedang')) {
    addKuning("LBP Kronik Tanpa Defisit Neurologis (Kuning)");
  }

  // ─── Tentukan Teks Pengendalian (Berdasarkan SOP) ───
  let pengendalian = "";
  if (kategori === 'Merah') {
    pengendalian = 
      "• Tidak diperkenankan bekerja di area risiko tinggi (ketinggian, alat berat, confined space, shift malam intensif) sampai dinyatakan stabil.\n" +
      "• Wajib kontrol dokter spesialis setiap 1 bulan sampai stabil.\n" +
      "• Wajib menyerahkan surat kontrol/clearance.\n" +
      "• Evaluasi ulang status setiap 1 bulan.\n" +
      "• Dapat direkomendasikan penempatan sementara (Currently Unfit).";
  } else if (kategori === 'Kuning') {
    pengendalian = 
      "• Layak kerja dengan monitoring (Fit With Note).\n" +
      "• Wajib kontrol dokter minimal setiap 3 bulan.\n" +
      "• Wajib menyerahkan bukti kontrol ke HO.\n" +
      "• Tidak direkomendasikan bekerja di area risiko tinggi bila kondisi belum stabil.\n" +
      "• Evaluasi ulang status zona setiap 3 bulan.\n" +
      "• Program perbaikan gaya hidup (berat badan, diet, olahraga).";
  } else {
    pengendalian = 
      "• Layak kerja tanpa pembatasan khusus.\n" +
      "• MCU rutin sesuai jadwal perusahaan (1 tahun sekali atau sesuai kebijakan).\n" +
      "• Edukasi gaya hidup sehat.";
  }

  return {
    kategori,
    triggers,
    pengendalian,
  };
}

/**
 * Kalkulasi Framingham Risk Score (FRS) 10-Tahun Probabilitas Penyakit Jantung Koroner (CVD)
 * Diadopsi dari rumus DUMMYFUNCTION sheet Excel (pembobotan klasifikasi gender)
 */
export function calculateFraminghamScore(data: MCUCalcData, gender: string, umur: number) {
  if (!umur || !gender || !data.chol || !data.hdl || !data.tdS || !data.merokok) {
    return { scoreValue: 0, scoreText: "Cek Parameter", probabilitas: "Cek Parameter" };
  }

  const isMale = gender.toLowerCase().includes('laki');
  const isFemale = gender.toLowerCase().includes('perem');
  let points = 0;

  if (isMale) {
    // Age points
    if (umur <= 34) points += -9;
    else if (umur <= 39) points += -4;
    else if (umur <= 44) points += 0;
    else if (umur <= 49) points += 3;
    else if (umur <= 54) points += 6;
    else if (umur <= 59) points += 8;
    else if (umur <= 64) points += 10;
    else if (umur <= 69) points += 11;
    else if (umur <= 74) points += 12;
    else points += 13;

    // Chol points
    if (umur <= 39) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 4; else if (data.chol < 240) points += 7; else if (data.chol < 280) points += 9; else points += 11;
    } else if (umur <= 49) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 3; else if (data.chol < 240) points += 5; else if (data.chol < 280) points += 6; else points += 8;
    } else if (umur <= 59) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 2; else if (data.chol < 240) points += 3; else if (data.chol < 280) points += 4; else points += 5;
    } else if (umur <= 69) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 1; else if (data.chol < 240) points += 1; else if (data.chol < 280) points += 2; else points += 3;
    } else {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 0; else if (data.chol < 240) points += 0; else if (data.chol < 280) points += 1; else points += 1;
    }

    // HDL
    if (data.hdl >= 60) points += -1;
    else if (data.hdl >= 50) points += 0;
    else if (data.hdl >= 40) points += 1;
    else points += 2;

    // Blood pressure
    if (data.tdS < 120) points += 0;
    else if (data.tdS < 130) points += 0;
    else if (data.tdS < 140) points += 1;
    else if (data.tdS < 160) points += 1;
    else points += 2;

    // Smoking
    const merokok = data.merokok.toLowerCase() === 'ya';
    if (merokok) {
      if (umur <= 39) points += 8; else if (umur <= 49) points += 5; else if (umur <= 59) points += 3; else if (umur <= 69) points += 1; else points += 1;
    }

    // Diabetes
    if (data.diabetes?.toLowerCase() === 'ya') points += 3;

  } else if (isFemale) {
    // Age points
    if (umur <= 34) points += -7;
    else if (umur <= 39) points += -3;
    else if (umur <= 44) points += 0;
    else if (umur <= 49) points += 3;
    else if (umur <= 54) points += 6;
    else if (umur <= 59) points += 8;
    else if (umur <= 64) points += 10;
    else if (umur <= 69) points += 12;
    else if (umur <= 74) points += 14;
    else points += 16;

    // Chol
    if (umur <= 39) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 4; else if (data.chol < 240) points += 8; else if (data.chol < 280) points += 11; else points += 13;
    } else if (umur <= 49) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 3; else if (data.chol < 240) points += 6; else if (data.chol < 280) points += 8; else points += 10;
    } else if (umur <= 59) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 2; else if (data.chol < 240) points += 4; else if (data.chol < 280) points += 5; else points += 7;
    } else if (umur <= 69) {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 1; else if (data.chol < 240) points += 2; else if (data.chol < 280) points += 3; else points += 4;
    } else {
      if (data.chol < 160) points += 0; else if (data.chol < 200) points += 1; else if (data.chol < 240) points += 1; else if (data.chol < 280) points += 2; else points += 2;
    }

    // HDL
    if (data.hdl >= 60) points += -1;
    else if (data.hdl >= 50) points += 0;
    else if (data.hdl >= 40) points += 1;
    else points += 2;

    // BP
    if (data.tdS < 120) points += 0;
    else if (data.tdS < 130) points += 1;
    else if (data.tdS < 140) points += 2;
    else if (data.tdS < 160) points += 3;
    else points += 4;

    // Smoking
    const merokok = data.merokok.toLowerCase() === 'ya';
    if (merokok) {
      if (umur <= 39) points += 9; else if (umur <= 49) points += 7; else if (umur <= 59) points += 4; else if (umur <= 69) points += 2; else points += 1;
    }

    // Diabetes
    if (data.diabetes?.toLowerCase() === 'ya') points += 5;
  }

  // Convert points to percentage risk
  let riskPct = 0;
  if (isMale) {
    if (points < 0) riskPct = 0.9;
    else if (points >= 17) riskPct = 30;
    else {
      const riskMap: Record<number, number> = { 0: 1, 1: 1.5, 2: 1.5, 3: 2, 4: 2.5, 5: 2, 6: 2.5, 7: 3, 8: 4, 9: 5, 10: 6, 11: 8, 12: 10, 13: 12, 14: 16, 15: 20, 16: 25 };
      riskPct = riskMap[points] || 1;
    }
  } else {
    if (points < 9) riskPct = 0.9;
    else if (points >= 25) riskPct = 30;
    else {
      const riskMap: Record<number, number> = { 9: 1, 10: 1.5, 11: 1.5, 12: 1.5, 13: 2, 14: 2.5, 15: 3, 16: 4, 17: 5, 18: 6, 19: 8, 20: 11, 21: 14, 22: 17, 23: 22, 24: 27 };
      riskPct = riskMap[points] || 1;
    }
  }

  const scoreText = riskPct === 0.9 ? '<1%' : riskPct === 30 ? '≥30%' : `${riskPct}%`;
  
  let probabilitas = "Low Risk";
  if (riskPct >= 20) probabilitas = "High Risk";
  else if (riskPct >= 10) probabilitas = "Intermediate Risk";

  return {
    scoreValue: points,
    scoreText,
    probabilitas
  };
}
