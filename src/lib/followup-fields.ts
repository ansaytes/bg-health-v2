// ============================================================
// Penentu field tindak lanjut — TIGA sumber
// ============================================================
//
// Field yang ditampilkan pada form tindak lanjut diambil dari tiga jalur yang
// berlapis. Perannya BERBEDA, bukan saling menggantikan:
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ 1. TRIGGER ZONA (STD/006)                                          │
// │    Parameter yang menentukan Zona Risiko PTM. Hanya yang tercantum  │
// │    di Bab 7 yang masuk. Inilah yang WAJIB dikendalikan lewat        │
// │    ProKawan, karena berhubungan dengan kewajiban & biaya program.   │
// │    Contoh: Hypertension Grade I (145/92)                            │
// ├─────────────────────────────────────────────────────────────────────┤
// │ 2. TEMUAN ABNORMAL STANDAR INDONESIA (Jalur 1)                     │
// │    Nilai di luar rentang rujukan laboratorium/klinis Indonesia      │
// │    (MCU_FIELDS normalRange). Menangkap LEBIH LUAS dari STD/006.     │
// │    Contoh: TD 120/80 = pre-hipertensi → abnormal, tetapi TIDAK      │
// │    menjadi peserta ProKawan.                                        │
// ├─────────────────────────────────────────────────────────────────────┤
// │ 3. NILAI ABNORMAL ENGINE (clinical-classification)                 │
// │    Parameter yang severity-nya bukan hijau menurut STD/006, tetapi  │
// │    tidak masuk trigger. Contoh: HDL rendah, trigliserida borderline │
// │    (severity 'normal' bukan hijau).                                 │
// └─────────────────────────────────────────────────────────────────────┘
//
// KENAPA TETAP DITAMPILKAN SEMUA
// Jalur 1 adalah praktik kedokteran yang benar: setiap penyimpangan dari nilai
// rujukan perlu ditindaklanjuti. Jalur 2 & 3 adalah kebijakan perusahaan yang
// sengaja lebih ketat ambangnya. Membuang Jalur 1 berarti mengabaikan temuan
// klinis; memakai STD/006 saja membuat ProKawan membengkak.
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

export type SumberField = 'trigger' | 'abnormal' | 'engine';

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
  /** Nilai abnormal dari engine (label klasifikasi), bila ada. */
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
  serology: 'Serologi',
  drug: 'NAPZA',
  imaging: 'Radiologi & USG',
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
  'merokok', 'alkohol', 'olahraga',
  // Bacaan yang bukan angka per-parameter
  'ecgHasil', 'tmtHasil', 'tmHasil', 'tmtHasil', 'usg', 'visusDekat',
  'audInterp', 'spiInterp', 'chestXR', 'lumboXr', 'defWarna', 'lapangPandang',
  'ul', 'catatanFisik',
  // Status administratif & hasil turunan — bukan parameter klinis
  // `statusMCU` (huruf besar) adalah id sebenarnya di MCU_FIELDS — jangan
  // hanya menulis `statusMcu`, karena filter bersifat case-sensitive.
  'statusMcu', 'statusMCU', 'kesVendor', 'perluFu', 'rekFu', 'itemFu',
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


/**
 * Klasifikasi klinis STD/006 per field — dipakai untuk menentukan sumber
 * "engine" (severity bukan hijau).
 */
function klasifikasiEngine(id: string, d: Record<string, unknown>, gender: string): Classification | null {
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
    case 'au': return classifyUricAcid(toNumber(d.au as string), g);
    case 'bmi': return classifyBmi(toNumber(d.bmi as string));
    case 'hb': return classifyHemoglobin(toNumber(d.hb as string), g);
    case 'fev1Pct':
    case 'fev1FvcAct':
    case 'fvcPct': return classifyLung(
      toNumber(d.fev1Pct as string), toNumber(d.fev1FvcAct as string), toNumber(d.fvcPct as string),
      d.spiInterp as string,
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
      const k = klasifikasiEngine(field.id, baseline, gender);
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
      // PENTING: `angkaDari()` sudah menangani desimal Indonesia ('25,6') dan
      // internasional ('25.6'). Tanpa itu, '25.6' dibaca NaN sehingga BMI 25,6
      // dianggap ABNORMAL padahal masih dalam rentang.
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

    // ── Sumber 3: abnormal menurut engine (severity ≠ hijau) ─────
    const k = klasifikasiEngine(field.id, baseline, gender);
    if (k && k.severity !== 'hijau' && k.severity !== 'normal' && k.severity !== 'tidak-dinilai') {
      if (sudah.has(field.id)) continue;
      daftar.push({
        ...dasarField(field, gender, nilaiMcu, nilaiFU),
        sumber: 'engine',
        alasan: k.detail ?? k.label,
        klasifikasi: k.label,
      });
      sudah.add(field.id);
    }
  }

  // Field select/textarea yang nilainya bukan kata normal (mis. HBsAg Reaktif)
  // — masuk sumber engine bila belum tercakup.
  for (const field of MCU_FIELDS) {
    if (sudah.has(field.id) || BUKAN_PARAMETER.has(field.id)) continue;
    if (DINILAI_KHUSUS.has(field.id)) continue;
    if (field.type !== 'select' && field.type !== 'text' && field.type !== 'textarea') continue;
    const nilai = String(baseline[field.id] ?? '').trim();
    if (!nilai || KATA_NORMAL.test(nilai)) continue;
    daftar.push({
      ...dasarField(field, gender, nilai, nilaiFU),
      sumber: 'engine',
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
      keterangan: 'Di luar rentang rujukan — tidak selalu menjadi peserta ProKawan',
      fields: daftar.filter((f) => f.sumber === 'abnormal'),
    },
    {
      sumber: 'engine',
      judul: 'Temuan Lain',
      keterangan: 'Parameter dengan nilai di luar kriteria normal',
      fields: daftar.filter((f) => f.sumber === 'engine'),
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

/** Label singkat kelompok untuk tampilan. */
export function labelSumber(s: SumberField): string {
  return s === 'trigger' ? 'Trigger Zona' : s === 'abnormal' ? 'Abnormal' : 'Lainnya';
}

export { fmtAngka };
