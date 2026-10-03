// ============================================================
// Bridge ke engine kalkulasi aplikasi (rumus yang BENAR-BENAR dipakai
// oleh app saat save). Import script TIDAK boleh punya salinan rumus
// sendiri, karena itu yang menyebabkan diagnostik tertinggal di versi lama.
//
// Dua file TS dikompilasi ke CJS lebih dulu supaya bisa di-require
// dari Node tanpa Next.js/ts-node.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, 'scripts', '.build', 'mcu-calc');
const STAGING_DIR = `${OUT_DIR}.staging`;
const ENTRY = path.join(OUT_DIR, 'mcu-calculations.js');
const DEPS = [
  'src/lib/mcu-calculations.ts',
  'src/lib/zonasi-engine.ts',
  'src/lib/mcu-fields.ts',
  'src/lib/mcu-diagnosis.ts',
  'src/lib/clinical-classification.ts',
  'src/lib/questionnaire-items.ts',
  'src/lib/questionnaire-scores.ts',
  'src/lib/questionnaire-conclusion.ts',
].map((rel) => path.join(ROOT, ...rel.split('/')));

let cached = null;
let columnMap = null;

function needsBuild() {
  if (!fs.existsSync(ENTRY)) return true;
  // Hasil build yang masih memuat alias berarti post-processing gagal.
  if (fs.readFileSync(ENTRY, 'utf8').includes('@/lib/')) return true;
  const built = fs.statSync(ENTRY).mtimeMs;
  return DEPS.some((dep) => fs.statSync(dep).mtimeMs > built);
}

function build() {
  // Build ke direktori staging dulu, baru tukar secara atomik. Kalau tsc
  // gagal, build lama yang masih berfungsi tidak ikut terhapus.
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  // Panggil compiler TypeScript lokal langsung; npx tidak andal di Windows.
  // --noCheck: emit hanya, tanpa memperbaiki error tipe bawaan repo.
  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
      '-p', path.join(ROOT, 'scripts', 'tsconfig.mcu-calc.json'),
      '--noCheck',
      '--outDir', STAGING_DIR,
    ],
    { cwd: ROOT, stdio: 'inherit' },
  );

  // tsc tidak menulis ulang alias "@/lib/..." pada modul CommonJS.
  // Semua alias di SELURUH file hasil build diganti menjadi path relatif.
  // Ini wajib untuk modul baru seperti clinical-classification.ts yang
  // ikut terimpor oleh mcu-fields.ts.
  const unresolved = [];
  for (const file of fs.readdirSync(STAGING_DIR)) {
    if (!file.endsWith('.js')) continue;
    const target = path.join(STAGING_DIR, file);
    const src = fs.readFileSync(target, 'utf8');
    const rewritten = src.replace(/@\/lib\/([a-z0-9-]+)/g, './$1');
    if (rewritten !== src) fs.writeFileSync(target, rewritten);
    const leftover = rewritten.match(/@\/lib\/[a-z0-9-]+/g);
    if (leftover) unresolved.push(`${file}: ${[...new Set(leftover)].join(', ')}`);
  }
  if (unresolved.length > 0) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
    throw new Error(`Alias belum tertangani pada hasil kompilasi:\n  ${unresolved.join('\n  ')}`);
  }

  if (!fs.existsSync(ENTRY)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
    throw new Error(`Entry hasil build tidak ditemukan: ${ENTRY}`);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.renameSync(STAGING_DIR, OUT_DIR);
}

const require = createRequire(import.meta.url);

function load() {
  if (cached) return cached;
  if (needsBuild()) build();
  const mod = require(ENTRY);
  if (typeof mod.applyMCUCalculations !== 'function') {
    throw new Error('applyMCUCalculations tidak ditemukan pada hasil kompilasi engine.');
  }
  cached = mod;
  return cached;
}

/**
 * Peta nama kolom DB (snake_case) -> id field kanonik (camelCase).
 * Mengikuti transformasi yang dipakai src/app/api/mcu/save/route.ts, sehingga
 * tglMCU -> tgl_mcu, spiInterp -> spi_interp, rekQSHE -> rek_qshe, dan seterusnya.
 */
function buildColumnMap() {
  const { MCU_FIELDS } = require(path.join(OUT_DIR, 'mcu-fields.js'));
  const map = new Map();
  for (const field of MCU_FIELDS) {
    const snake = field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
    map.set(snake, field.id);
  }
  return map;
}

// Kolom DB (snake_case) yang ditulis engine, dipetakan ke nama camelCase
// yang dipakai src/lib/mcu-calculations.ts dan mcu-fields.ts.
//
// egfr TIDAK ada di RECOMPUTE_FROM_SCRATCH: bila Excel punya nilai hasil
// laboratorium, nilai itu dipertahankan; engine hanya menghitung bila kosong.
const OUTPUT_KEYS = {
  bmi: 'bmi',
  mchc: 'mchc',
  egfr: 'egfr',
  fvc_pct: 'fvcPct',
  fev1_pct: 'fev1Pct',
  fev1_fvc_act: 'fev1FvcAct',
  fev1_fvc_pct: 'fev1FvcPct',
  diabetes: 'diabetes',
  tgl_expired: 'tglExpired',
  diagnosa_medis: 'diagnosaMedis',
  item_fu: 'itemFU',
  perlu_fu: 'perluFU',
  fram_score: 'framScore',
  fram_prob: 'framProb',
  fram_kat: 'framKat',
  zonasi: 'zonasi',
  trigger_zona: 'triggerZona',
  pengendalian: 'pengendalian',
};

// Kolom yang nilainya di Excel berasal dari rumus spreadsheets lama. Engine
// aplikasi hanya mengisi diagnosaMedis bila masih kosong, sehingga nilai lama
// harus dikosongkan lebih dulu agar dihitung ulang sesuai SOP saat ini.
const RECOMPUTE_FROM_SCRATCH = ['diagnosa_medis'];

export function calculateRecord(record) {
  const { applyMCUCalculations } = load();
  if (!columnMap) columnMap = buildColumnMap();
  const input = {};
  for (const [key, value] of Object.entries(record)) {
    if (RECOMPUTE_FROM_SCRATCH.includes(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    input[columnMap.get(key) ?? key] = value;
  }
  const out = applyMCUCalculations(input);
  for (const [dbKey, camelKey] of Object.entries(OUTPUT_KEYS)) {
    const value = out[camelKey];
    record[dbKey] = value === null || value === undefined || value === '' ? null : value;
  }
  return record;
}

/**
 * Memuat modul skor kuesioner dari hasil kompilasi yang sama dengan engine
 * aplikasi, supaya uji skor tidak menguji salinan yang bisa berbeda dari yang
 * benar-benar dipakai aplikasi.
 */
export function loadQuestionnaireScores() {
  if (needsBuild()) build();
  return require(path.join(OUT_DIR, 'questionnaire-scores.js'));
}

/**
 * Memuat modul kesimpulan hasil kuesioner.
 *
 * Dipisah dari loadQuestionnaireScores karena modul kesimpulan adalah lapisan
 * presentasi yang berdiri sendiri; mengujinya bersama skor akan membuat
 * kegagalan sulit dilacak.
 */
export function loadQuestionnaireConclusion() {
  if (needsBuild()) build();
  return require(path.join(OUT_DIR, 'questionnaire-conclusion.js'));
}

/**
 * Memuat kamus temuan klinis (EKG, treadmill, audiometri, dan lain-lain).
 *
 * Dipisah agar pengujian free-text bertulis bebas menguji kamus yang sama
 * dengan yang dipakai engine, bukan daftar ekspektasi yang ditulis ulang.
 */
export function loadClinicalClassification() {
  if (needsBuild()) build();
  return require(path.join(OUT_DIR, 'clinical-classification.js'));
}

export { OUTPUT_KEYS as CALCULATED_COLUMNS };
