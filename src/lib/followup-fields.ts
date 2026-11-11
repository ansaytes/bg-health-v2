// ============================================================
// Penentu field tindak lanjut — DUA acuan
// ============================================================
//
// Nilai rujukan yang berlaku di aplikasi hanya dua. Engine (clinical-classification,
// zonasi-engine) bukan sumber rujukan sendiri: ia hanya menghitung berdasarkan
// kedua acuan ini.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ 1. TRIGGER ZONA (BG/QSHE/STD/006 Bab 7)                             │
// │    Parameter yang menentukan Zona Risiko PTM. WAJIB dikendalikan    │
// │    lewat ProKawan. Contoh: Hypertension Grade I (145/92).           │
// ├─────────────────────────────────────────────────────────────────────┤
// │ 2. TEMUAN ABNORMAL (rujukan nasional Indonesia)                     │
// │    Nilai di luar rentang rujukan klinis/laboratorium Indonesia      │
// │    (MCU_FIELDS normalRange), plus parameter yang melewati ambang    │
// │    STD/006 tetapi bukan trigger zona. Menangkap LEBIH LUAS dari     │
// │    STD/006. Contoh: TD 120/80 = pre-hipertensi → abnormal, tetapi   │
// │    bukan peserta ProKawan.                                          │
// └─────────────────────────────────────────────────────────────────────┘
//
// Keduanya menjadi dasar `perlu_fu` otomatis (hitungTemuanAbnormal) dan
// penutupan follow up otomatis (hitungSisaTindakLanjut).
// ============================================================

import {
  classifyBloodPressure, classifyBmi, classifyChestXr, classifyEgfr, classifyGlucose,
  classifyHemoglobin, classifyHearing, classifyLdl, classifyLiver, classifyLung,
  classifyTriglyceride, classifyUricAcid, classifyVision, detectGender, toNumber,
  type Classification,
} from '@/lib/clinical-classification';
import { MCU_FIELDS, type MCUFieldDef } from '@/lib/mcu-fields';
import { diLuarRentang, labelRentang, fmtAngka, angkaDari } from '@/lib/mcu-normal-range';
import { parseVisusPerMata } from '@/lib/visus-parser';

export type SumberField = 'trigger' | 'abnormal';

export interface FieldTindakLanjut {
  id: string;
  label: string;
  section: string;
  sectionLabel: string;
  /** Satuan untuk pencetakan, mis. "mmHg". */
  unit: string;
  /** Nilai pada MCU (baseline). */
  nilaiMcu: string | number | null;
  /** Khusus tdS: nilai diastole pasangannya, untuk placeholder input. */
  nilaiMcuDiastol?: string | number | null;
  /** Nilai hasil tindak lanjut terakhir, bila sudah ada. */
  nilaiFollowUp: string | number | null;
  /** Teks rentang normal, mis. "90–119" gaya Indonesia. */
  rentang: string;
  /** Sumber temuan — menentukan kelompok tampilan. */
  sumber: SumberField;
  /** Penjelasan singkat mengapa field ini muncul. */
  alasan: string;
  /** Label klasifikasi klinis (ambang STD/006), bila ada. */
  klasifikasi?: string;
  /** true bila tipe input berupa teks (visus, interpretasi). */
  teks: boolean;
}

export interface KelompokField {
  sumber: SumberField;
  judul: string;
  keterangan: string;
  fields: FieldTindakLanjut[];
}

const SECTION_LABEL: Record<string, string> = {
  vital: 'Tanda Vital & Antropometri',
  hematology: 'Hematologi',
  chemistry: 'Kimia Darah',
  urinalysis: 'Urine Lengkap',
  serology: 'Serologi / Imunologi',
  drug: 'Tes NAPZA (Urine)',
  toxicology: 'Logam Berat / Toksikologi',
  habits: 'Riwayat Kebiasaan',
  imaging: 'Radiologi & USG',
  cardiac: 'Jantung (EKG & Treadmill)',
  other: 'Pemeriksaan Penunjang Lain',
  anamnesis: 'Riwayat & Skrining',
  spirometry: 'Spirometri',
  audiometry: 'Audiometri',
  neuro: 'Neurologi',
  physical: 'Fisik',
  vision: 'Mata',
  fitness: 'Kebugaran',
  assessment: 'Penilaian',
  calculated: 'Kalkulasi',
};



/**
 * Field yang BUKAN parameter klinis yang perlu diukur ulang.
 *
 * Termasuk identitas (nama, NIK) — nilai itu tersimpan terenkripsi sehingga
 * selalu terlihat "bukan kata normal" dan dulu ikut muncul sebagai temuan
 * abnormal. Juga termasuk faktor risiko yang hanya dibaca sekali (merokok,
 * golongan darah) dan hasil bacaan yang tidak diukur ulang sebagai angka
 * (EKG, visus dekat, tipe konstitusi).
 */
const BUKAN_PARAMETER = new Set([
  // Identitas & administratif
  'nama', 'nikKaryawan', 'nationalId', 'usia', 'jenisKelamin', 'jabatan',
  'site', 'client', 'tglMCU', 'tglExpired', 'golDarah', 'tipeKonstitusi',
  // Turunan engine
  'framScore', 'framProb', 'framKat', 'zonasi', 'triggerZona', 'pengendalian',
  'frekuensiEvaluasi', 'catatanSOP', 'diagnosaMedis', 'kesVendor', 'itemFU',
  'perluFU', 'rekFU', 'linkMCU', 'catatan', 'ringkasanKuesioner', 'diabetes',
  // Faktor risiko / kebiasaan — dicatat sekali, bukan diukur ulang
  'merokok', 'alkohol', 'olahraga', 'jumlahRokok', 'lamaMerokok',
  'jenisOlahraga', 'kebiasaanLain',
  // Metode penilaian spirometri — pilihan cara hitung, bukan hasil ukur
  'spiMetode',
  // Ringkasan tes kebugaran (turunan dari field tes per jenis)
  'tesKebugaran', 'hasilKebugaran',
  // Bacaan yang bukan angka per-parameter
  'ecgHasil', 'tmtHasil', 'tmHasil', 'tmtHasil', 'usg', 'visusDekat',
  'audInterp', 'spiInterp', 'chestXR', 'lumboXr', 'defWarna', 'lapangPandang',
  'ul', 'ulWarna', 'ulKejernihan', 'ulBau', 'ulBeratJenis', 'ulPh',
  'ulProtein', 'ulGlukosa', 'ulKeton', 'ulDarah', 'ulLeukositEsterase',
  'ulNitrit', 'ulBilirubin', 'ulUrobilinogen', 'ulEritrosit', 'ulLeukosit',
  'ulSelEpitel', 'ulSilinder', 'ulKristal', 'ulBakteri', 'ulJamur',
  'catatanFisik',
  // Status administratif & hasil turunan — bukan parameter klinis
  // `statusMCU` (huruf besar) adalah id sebenarnya di MCU_FIELDS — jangan
  // hanya menulis `statusMcu`, karena filter bersifat case-sensitive.
  'statusMcu', 'statusMCU', 'kesVendor', 'perluFu', 'rekFu', 'itemFu',
  // Kesimpulan/administratif yang diturunkan dari temuan — tidak boleh menjadi
  // temuan itu sendiri (mis. "Fit With Note" bukan parameter abnormal).
  'rekQSHE', 'dugaanPAK', 'tempatMCU',
  // Serologi yang hanya dibaca sekali (bukan diukur ulang per kontrol).
  // HBsAg sendiri dinilai lewat klasifikasi khusus di atas.
  'hbsag', 'antiHbs', 'vdrl', 'tpha', 'hiv',
  // NAPZA — skrining khusus, bukan parameter kontrol rutin
  'drugAmp', 'drugMeth', 'drugMorph', 'drugCanna', 'drugCoc', 'drugBenz', 'drugCaris',
  'psa', 'ggt', 'alp', 'billirubin', 'ureum',
  'eritrosit', 'hematokrit', 'mcv', 'mch', 'mchc', 'led', 'nadi',
  'balance', 'romberg', 'phalen', 'thinel', 'patrick', 'kontraPatrick', 'laseque', 'kernig',
]);

/**
 * Field yang nilainya dinilai sebagai pasangan, bukan sendiri-sendiri.
 * `tdD` tidak perlu entri terpisah karena selalu dicatat bersama `tdS`.
 */
const PASANGAN_TURUNAN = new Set(['tdD']);

/** Kata/frasa yang berarti normal pada field non-numerik. */
const KATA_NORMAL = new RegExp(
  '^(' + [
    'normal',
    'normal\\s+sinus\\s+rhythm',
    'normal\\s+variations?.*',
    'negatif',
    // "Non - Reaktif", "non reaktif", "Non-Reaktif" — spasi & tanda hubung
    // boleh berapa pun di antaranya.
    'non(?:\\s|-)*reaktif',
    'dbn',
    'n/a',
    'tidak',
    'tidak\\s+ada',
    'belum',
    'fit',
    'fit\\s+to\\s+work',
    'negative',
    'nil',
  ].join('|') + ')$',
  'i',
);

/** Field teks yang dinilai oleh parser sendiri, bukan regex "kata normal". */
const DINILAI_KHUSUS = new Set(['visusJauh']);

/**
 * Kata/ frasa yang berarti normal pada field non-numerik.
 * Dulu regex ini gagal untuk "Non - Reaktif" karena ada spasi di sekitar
 * tanda hubung, sehingga status HBsAg yang normal ikut muncul sebagai temuan.
 * Sekarang pemisah spasi/tanda hubung ditoleransi, dan "Normal Sinus Rhythm"
 * (hasil EKG) juga dikenali sebagai normal.
 */


/** Klasifikasi klinis per field (STD/006 dan kriteria klinis); null bila tidak dinilai. */
function klasifikasiKlinis(id: string, d: Record<string, unknown>, gender: string): Classification | null {
  const g = detectGender(gender);
  switch (id) {
    case 'tdS': return classifyBloodPressure(toNumber(d.tdS as string), toNumber(d.tdD as string));
    case 'tdD': return classifyBloodPressure(toNumber(d.tdS as string), toNumber(d.tdD as string));
    case 'gdp':
    case 'gd2pp':
    case 'hba1c': return classifyGlucose(toNumber(d.gdp as string), toNumber(d.gd2pp as string), toNumber(d.hba1c as string));
    case 'ldl': return classifyLdl(toNumber(d.ldl as string));
    case 'tg': return classifyTriglyceride(toNumber(d.tg as string));
    case 'egfr': return classifyEgfr(toNumber(d.egfr as string));
    case 'au': return classifyUricAcid(toNumber(d.au as string));
    case 'bmi': {
      // Sesuai arahan: IMT hanya menjadi temuan bila ≥30 (obesitas).
      // `classifyBmi` mengembalikan 'kuning' untuk 23–29,9 sehingga tanpa
      // pembatasan ini IMT 25,6 ikut muncul sebagai temuan di "Temuan Lain".
      const b = toNumber(d.bmi as string);
      if (b === null || b < 30) return null;
      return classifyBmi(b);
    }
    case 'hb': return classifyHemoglobin(toNumber(d.hb as string), g);
    case 'fev1Pct':
    case 'fev1FvcAct':
    case 'fvcPct': return classifyLung(
      toNumber(d.fev1Pct as string), toNumber(d.fev1FvcAct as string), toNumber(d.fvcPct as string),
      d.spiInterp as string, d.spiMetode as string,
    );
    case 'visusJauh': return classifyVision(d.visusJauh as string);
    case 'pta':
    case 'audInterp': return classifyHearing(toNumber(d.pta as string), d.audInterp as string);
    // `hbsag` TIDAK dipetakan ke classifyLiver: fungsi itu menggabungkan SGOT,
    // SGPT, dan status HBsAg menjadi SATU hasil, sehingga dipanggil untuk
    // hbsag ia mengembalikan temuan enzim hati — bukan temuan HBsAg.
    // Akibatnya "Non - Reaktif" pernah muncul sebagai temuan abnormal dengan
    // alasan "SGOT 66 U/L". HBsAg dinilai dari reaktivitasnya sendiri.
    case 'sgot':
    case 'sgpt': return classifyLiver(toNumber(d.sgot as string), toNumber(d.sgpt as string), false);
    case 'hbsag': {
      // Hanya "Reaktif" yang menjadi temuan. "Non - Reaktif", "Negatif",
      // "Nonreaktif" semuanya normal → tidak dikembalikan.
      const v = String(d.hbsag ?? '').trim();
      if (!v) return null;
      const nonReaktif = /non\s*-?\s*reaktif|nonreaktif|negatif|negative|^tidak$/i.test(v);
      if (nonReaktif) return null;
      return /reaktif|positif|positive/i.test(v)
        ? { severity: 'kuning', label: 'Hepatitis B Carrier (HBsAg Positif)' }
        : null;
    }
    case 'chestXR': return classifyChestXr(d.chestXR as string);
    default: return null;
  }
}

/**
 * Menentukan daftar field tindak lanjut untuk satu record MCU.
 *
 * @param baseline   data MCU (key camelCase sesuai MCU_FIELDS)
 * @param triggerZona daftar trigger yang tersimpan (dipisah " | ")
 * @param nilaiFU    nilai hasil tindak lanjut terakhir (untuk prefill)
 */
export function tentukanFieldTindakLanjut(
  baseline: Record<string, unknown>,
  triggerZona: string | null | undefined,
  nilaiFU: Record<string, string | number | null> = {},
): KelompokField[] {
  const gender = String(baseline.jenisKelamin ?? '');
  const triggers = String(triggerZona ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  // Pemetaan trigger → field, lewat nama parameter pada label trigger.
  const fieldTrigger = new Set<string>();
  for (const t of triggers) {
    const tLower = t.toLowerCase();
    if (/hypertension|tekanan darah/.test(tLower)) fieldTrigger.add('tdS');
    if (/diabetes|dm |prediabetes|glukosa|hba1c|gdp/.test(tLower)) fieldTrigger.add('hba1c');
    if (/ldl|dislipidemia/.test(tLower)) fieldTrigger.add('ldl');
    if (/triglycerid/.test(tLower)) fieldTrigger.add('tg');
    if (/uric|asam urat/.test(tLower)) fieldTrigger.add('au');
    if (/bmi|imt|obesity|overweight|obesitas/.test(tLower)) fieldTrigger.add('bmi');
    if (/kidney|ckd|egfr/.test(tLower)) fieldTrigger.add('egfr');
    if (/anemia|hemoglobin|\bhb\b/.test(tLower)) fieldTrigger.add('hb');
    if (/lung|paru/.test(tLower)) fieldTrigger.add('fev1Pct');
    if (/hearing|pendengaran|noise-induced/.test(tLower)) fieldTrigger.add('pta');
    if (/visual|visus|penglihatan/.test(tLower)) fieldTrigger.add('visusJauh');
    if (/liver|hati|sgot|sgpt|hbsag|hepatitis/.test(tLower)) fieldTrigger.add('sgpt');
    if (/pneumoconiosis|chest/.test(tLower)) fieldTrigger.add('chestXR');
    if (/sleepiness|\bess\b/.test(tLower)) fieldTrigger.add('essScore');
    if (/mental|srq|dass/.test(tLower)) fieldTrigger.add('srq20Score');
  }

  const daftar: FieldTindakLanjut[] = [];
  const sudah = new Set<string>();

  for (const field of MCU_FIELDS) {
    if (BUKAN_PARAMETER.has(field.id)) continue;
    // tdD selalu dicatat bersama tdS — jangan tampil dua baris.
    if (PASANGAN_TURUNAN.has(field.id)) continue;
    if (field.type !== 'number' && field.type !== 'select' && field.type !== 'text' && field.type !== 'textarea') continue;

    const nilaiMcu = (baseline[field.id] ?? null) as string | number | null;
    if (nilaiMcu === null || String(nilaiMcu).trim() === '') continue;

    // ── Sumber 1: trigger zona ───────────────────────────────────
    if (fieldTrigger.has(field.id)) {
      const k = klasifikasiKlinis(field.id, baseline, gender);
      daftar.push({
        ...dasarField(field, gender, nilaiMcu, nilaiFU),
        // tdS selalu ditampilkan bersama tdD — sertakan nilai diastole sebagai
        // placeholder agar petugas tahu angka pembandingnya.
        ...(field.id === 'tdS' ? { nilaiMcuDiastol: (baseline.tdD ?? null) as string | number | null } : {}),
        sumber: 'trigger',
        alasan: 'Menentukan Zona Risiko PTM (STD/006 Bab 7)',
        klasifikasi: k?.label,
      });
      sudah.add(field.id);
      continue;
    }

    // ── Sumber 2: di luar rentang standar Indonesia ──────────────
    if (field.type === 'number') {
      // ── IMT: ambang khusus IMT ≥30 ──────────────────────────────
      // `MCU_FIELDS.normalRange` untuk BMI adalah '<30' — naikkan ke sini
      // supaya IMT 25,6 (Hijau menurut STD/006) TIDAK dianggap temuan.
      // Sesuai arahan: hanya IMT ≥30 yang masuk temuan.
      if (field.id === 'bmi') {
        const bmiVal = angkaDari(String(nilaiMcu));
        if (bmiVal !== null && bmiVal >= 30) {
          daftar.push({
            ...dasarField(field, gender, nilaiMcu, nilaiFU),
            sumber: 'abnormal',
            alasan: `IMT ${fmtAngka(bmiVal)} — obesitas (≥30)`,
          });
          sudah.add(field.id);
          continue;
        }
      } else {
        // PENTING: `angkaDari()` sudah menangani desimal Indonesia ('25,6') dan
        // internasional ('25.6'). Tanpa itu, '25.6' dibaca NaN sehingga
        // nilai dianggap ABNORMAL padahal masih dalam rentang.
        const angka = angkaDari(String(nilaiMcu));
        const cek = diLuarRentang(angka, field, gender);
        if (cek?.abnormal) {
          daftar.push({
            ...dasarField(field, gender, nilaiMcu, nilaiFU),
            sumber: 'abnormal',
            alasan: `Di luar rentang normal ${labelRentang(field, gender)}`,
          });
          sudah.add(field.id);
          continue;
        }
      }
    }

    // ── Visus: teks, tetapi ada dua acuan berbeda ────────────────
    //
    // STD/006 (zona PTM)   : Hijau bila ≥6/9 → 6/9 TIDAK masuk zona.
    // Standar kesehatan ID : 6/9 adalah batas PENERIMAAN, sehingga 6/9 tepat
    //                        sudah di tepi dan lazim diminta follow up oleh
    //                        pemeriksa.
    //
    // Sesuai arahan pemilik aplikasi: 6/9 tetap DIMUNCULKAN sebagai temuan
    // abnormal Jalur 1 (standar kesehatan) sebagai tindakan berjaga-jaga,
    // tetapi TIDAK menjadi trigger ProKawan. Karena itu ambangnya di sini
    // < 1,0 (belum 6/6 / 20/20) — bukan < 6/9.
    if (field.id === 'visusJauh') {
      const v = parseVisusPerMata(String(nilaiMcu));
      if (v.terbaik.desimal !== null && v.terbaik.desimal < 1.0 - 1e-9) {
        daftar.push({
          ...dasarField(field, gender, nilaiMcu, nilaiFU),
          sumber: 'abnormal',
          alasan: v.terbaik.desimal >= 6 / 9 - 1e-9
            ? `Visus ${v.terbaik.snellen} — masih dalam zona Hijau (≥6/9), tetapi di bawah 6/6; cek bila perlu koreksi`
            : `Visus di bawah 6/9 (${v.label})`,
          teks: true,
        });
        sudah.add(field.id);
        continue;
      }
    }

    // ── Sumber 2 (lanjutan): klasifikasi klinis non-hijau ────────
    const k = klasifikasiKlinis(field.id, baseline, gender);
    if (k && k.severity !== 'hijau' && k.severity !== 'normal' && k.severity !== 'tidak-dinilai') {
      if (sudah.has(field.id)) continue;
      daftar.push({
        ...dasarField(field, gender, nilaiMcu, nilaiFU),
        sumber: 'abnormal',
        alasan: k.detail ?? k.label,
        klasifikasi: k.label,
      });
      sudah.add(field.id);
    }
  }

  // Field select/textarea yang nilainya bukan kata normal (mis. HBsAg Reaktif)
  // — masuk temuan abnormal bila belum tercakup.
  for (const field of MCU_FIELDS) {
    if (sudah.has(field.id) || BUKAN_PARAMETER.has(field.id)) continue;
    if (DINILAI_KHUSUS.has(field.id)) continue;
    if (field.type !== 'select' && field.type !== 'text' && field.type !== 'textarea') continue;
    const nilai = String(baseline[field.id] ?? '').trim();
    if (!nilai || KATA_NORMAL.test(nilai)) continue;
    daftar.push({
      ...dasarField(field, gender, nilai, nilaiFU),
      sumber: 'abnormal',
      alasan: 'Nilai tidak normal',
      teks: true,
    });
    sudah.add(field.id);
  }

  const kelompok: KelompokField[] = [
    {
      sumber: 'trigger',
      judul: 'Trigger Zona PTM',
      keterangan: 'Menentukan zona & pengendalian — wajib dikendalikan lewat ProKawan',
      fields: daftar.filter((f) => f.sumber === 'trigger'),
    },
    {
      sumber: 'abnormal',
      judul: 'Temuan Abnormal',
      keterangan: 'Di luar nilai rujukan nasional Indonesia atau ambang STD/006 yang bukan trigger zona — tidak selalu menjadi peserta ProKawan',
      fields: daftar.filter((f) => f.sumber === 'abnormal'),
    },
  ];

  return kelompok.filter((k) => k.fields.length > 0);
}

function dasarField(
  field: MCUFieldDef,
  gender: string,
  nilaiMcu: string | number | null,
  nilaiFU: Record<string, string | number | null>,
): Omit<FieldTindakLanjut, 'sumber' | 'alasan'> {
  return {
    id: field.id,
    label: field.label,
    section: field.section,
    sectionLabel: SECTION_LABEL[field.section] ?? field.section,
    unit: field.unit ?? '',
    nilaiMcu,
    nilaiFollowUp: nilaiFU[field.id] ?? null,
    rentang: field.type === 'number' ? labelRentang(field, gender) : '',
    teks: field.type !== 'number',
  };
}

/**
 * Jumlah parameter yang masih abnormal DAN bisa diukur ulang pada follow up
 * (trigger STD/006 + rujukan nasional). Dasar penutupan follow up otomatis:
 * 0 = semua parameter yang dikontrol sudah kembali normal.
 */
export function hitungSisaTindakLanjut(
  data: Record<string, unknown>,
  triggerZona: string | null | undefined,
): number {
  return tentukanFieldTindakLanjut(data, triggerZona)
    .reduce((jumlah, kelompok) => jumlah + kelompok.fields.length, 0);
}

/** Hasil skrining kualitatif yang tidak diukur ulang tetapi jelas abnormal bila reaktif/positif. */
const SKRINING_KUALITATIF = [
  'hbsag', 'vdrl', 'tpha', 'hiv',
  'drugAmp', 'drugMeth', 'drugMorph', 'drugCanna', 'drugCoc', 'drugBenz', 'drugCaris',
] as const;

const NILAI_REAKTIF = /reaktif|positif|positive/i;
const NILAI_NON_REAKTIF = /non\s*-?\s*reaktif|nonreaktif|negatif|negative/i;

/**
 * Jumlah seluruh temuan abnormal pada satu MCU: parameter yang bisa diukur ulang
 * (hitungSisaTindakLanjut) ditambah skrining reaktif/positif dan foto toraks
 * abnormal yang tidak diukur ulang. Dasar kolom `perlu_fu` otomatis.
 */
export function hitungTemuanAbnormal(
  data: Record<string, unknown>,
  triggerZona: string | null | undefined,
): number {
  let jumlah = hitungSisaTindakLanjut(data, triggerZona);

  for (const id of SKRINING_KUALITATIF) {
    const nilai = String(data[id] ?? '').trim();
    if (nilai && NILAI_REAKTIF.test(nilai) && !NILAI_NON_REAKTIF.test(nilai)) jumlah += 1;
  }

  const toraks = klasifikasiKlinis('chestXR', data, String(data.jenisKelamin ?? ''));
  if (toraks && toraks.severity !== 'hijau' && toraks.severity !== 'normal' && toraks.severity !== 'tidak-dinilai') jumlah += 1;

  return jumlah;
}

export { fmtAngka };
