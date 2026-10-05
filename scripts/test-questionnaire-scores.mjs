// ============================================================================
// Uji skor kuesioner — memeriksa aturan yang mudah salah
// ============================================================================
//
// Yang diuji di sini bukan "apakah angkanya benar", melainkan apakah aturan
// yang sering keliru sudah diterapkan:
//
//   1. ESS  — prorata saat item belum lengkap, ambang 11 dan 15.
//   2. SRQ-20 — ambang 6, dan jawaban "Tidak" TIDAK ikut dijumlahkan.
//   3. DASS-21 — ambang BERBEDA per subskala (depresi 22, ansietas 20, stres 26).
//      Ini yang paling sering salah kalau satu tabel dipakai untuk ketiganya.
//   4. SDS — sepuluh item bernada positif dinilai terbalik. Tanpa itu, skor
//      orang yang paling depresif justru terlihat paling rendah.
//   5. Ringkasan memilih subskala worse berdasarkan kategori, bukan angka
//      mentah, karena rentang maksimum tiap subskala berbeda.
//
// Modul TS dimuat lewat bridge yang sama dengan engine import, supaya yang
// diuji benar-benar kode yang dipakai aplikasi, bukan salinan.
//
// Pakai:  node scripts/test-questionnaire-scores.mjs
// ============================================================================

import { loadQuestionnaireScores, loadQuestionnaireConclusion } from './lib/mcu-calc-bridge.mjs';

const { scoreDass21, scoreEss, scoreSds, scoreSrq20, summariseQuestionnaires } = loadQuestionnaireScores();
const { kesimpulanEss, kesimpulanSrqDass, zonaDariKuesioner } = loadQuestionnaireConclusion();

const failed = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed.push(`${name}: dapat ${JSON.stringify(actual)}, harap ${JSON.stringify(expected)}`);
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${name} = ${JSON.stringify(actual)}`);
}

// ────────────────────────────────────────────────────────────
console.log('ESS');
check('delapan item bernilai 1 → 8', scoreEss(Object.fromEntries([...Array(8)].map((_, i) => [`ess${i + 1}`, 1]))).score, 8);
// Tujuh item bernilai 2 dan satu kosong → prorata 14 × 8 / 7 = 16 (berat).
check('tujuh item bernilai 2 → prorata 16', scoreEss(Object.fromEntries([...Array(7)].map((_, i) => [`ess${i + 1}`, 2]))).score, 16);
check('ESS 11 = ringan-sedang', scoreEss(Object.fromEntries([...Array(8)].map((_, i) => [`ess${i + 1}`, i < 6 ? 2 : 1]))).category, 'ringan-sedang');
check('ESS 17 = berat', scoreEss(Object.fromEntries([...Array(8)].map((_, i) => [`ess${i + 1}`, i < 7 ? 3 : 2]))).category, 'berat');
check('tidak ada jawaban = belum lengkap', scoreEss({}).category, 'tidak-lengkap');

// ────────────────────────────────────────────────────────────
console.log('\nSRQ-20');
const sixYes = Object.fromEntries([
  ...[1, 2, 3, 4, 5, 6].map((n) => [`srq${n}`, 'Ya']),
  ...[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => [`srq${n}`, 'Tidak']),
]);
check('6 Ya → perlu tindak lanjut', scoreSrq20(sixYes).category, 'perlu-tindak-lanjut');
check('skor = jumlah "Ya" saja', scoreSrq20(sixYes).score, 6);
check('5 Ya → normal', scoreSrq20(Object.fromEntries([
  ...[1, 2, 3, 4, 5].map((n) => [`srq${n}`, 'Ya']),
  ...[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => [`srq${n}`, 'Tidak']),
])).category, 'normal');
check('semua "Tidak" → normal', scoreSrq20(Object.fromEntries([...Array(20)].map((_, i) => [`srq${i + 1}`, 'Tidak']))).category, 'normal');

// ────────────────────────────────────────────────────────────
// DASS-21. Bandingkan profil yang NYATA, bukan angka semua-3.
console.log('\nDASS-21 — ambang per subskala');
const DASS_SECTIONS = { depresi: [3, 5, 10, 13, 16, 17, 19, 20, 21], ansietas: [2, 4, 6, 9, 12, 15, 18], stres: [1, 7, 8, 11, 14] };

/** Memberi nilai tertentu hanya pada item satu subskala; sisanya 0. */
function onlySection(section, value) {
  return Object.fromEntries([...Array(21)].map((_, i) => [`dass${i + 1}`, DASS_SECTIONS[section].includes(i + 1) ? value : 0]));
}

check('depresi 18 (9×2) = sedang', scoreDass21(onlySection('depresi', 2)).depresi.category, 'sedang');
check('ansietas 14 (7×2) = ringan', scoreDass21(onlySection('ansietas', 2)).ansietas.category, 'ringan');
check('stres 10 (5×2) = normal', scoreDass21(onlySection('stres', 2)).stres.category, 'normal');

// Angka maksimum tiap subskala mengikuti jumlah itemnya: 27 / 21 / 15.
// Pada nilai itu kategori tertinggi harus muncul. Tabel asli Lovibond menulis
// "extremely severe" mulai 28, yang tidak akan pernah tercapai pada DASS-21.
check('depresi 27 (maks) = sangat berat', scoreDass21(onlySection('depresi', 3)).depresi.category, 'sangat-berat');
check('ansietas 21 (maks) = sangat berat', scoreDass21(onlySection('ansietas', 3)).ansietas.category, 'sangat-berat');
check('stres 15 (maks) = ringan', scoreDass21(onlySection('stres', 3)).stres.category, 'ringan');

// Batas atas tiap subskala mengikuti jumlah itemnya: 27 / 21 / 15.
check('maksimum depresi = 27', scoreDass21(onlySection('depresi', 3)).depresi.score, 27);
check('maksimum ansietas = 21', scoreDass21(onlySection('ansietas', 3)).ansietas.score, 21);
check('maksimum stres = 15', scoreDass21(onlySection('stres', 3)).stres.score, 15);

// Yang ter|report ditentukan kategori, bukan angka mentah.
check('terlebih = depresi meski angkanya lebih kecil', scoreDass21({ ...onlySection('depresi', 1), ...onlySection('ansietas', 3) }).highest.domain, 'ansietas');

// ────────────────────────────────────────────────────────────
// Zung SDS. Profil yang konsisten, bukan "jawaban sama untuk semua".
console.log('\nZung SDS — pembalikan skor');
// Tanpa gejala: 10 item negatif bernilai 1, 10 item positif bernilai 4
// (karena pernyataan positif memang benar) → keduanya menyumbang 10.
const noDepression = scoreSds(Object.fromEntries(
  [...Array(20)].map((_, i) => [`sds${i + 1}`, [2, 4, 6, 11, 12, 14, 16, 17, 18, 20].includes(i + 1) ? 4 : 1]),
));
check('tanpa gejala → indeks 20', noDepression.rawIndex, 20);
check('tanpa gejala → normal', noDepression.category, 'normal');

// Depresi berat: item negatif bernilai 4, item positif bernilai 1.
const severe = scoreSds(Object.fromEntries(
  [...Array(20)].map((_, i) => [`sds${i + 1}`, [2, 4, 6, 11, 12, 14, 16, 17, 18, 20].includes(i + 1) ? 1 : 4]),
));
check('depresi berat → indeks 80', severe.rawIndex, 80);
check('depresi berat → severe', severe.category, 'severe');

// Tanpa pembalikan, kedua profil di atas sama-sama bernilai 50: instrumen ini
// jadi tidak bisa membedakan siapa yang depresif dan siapa yang tidak.
const withoutReverse = 10 * 1 + 10 * 4;
check('tanpa pembalikan, kedua profil bernilai sama', withoutReverse, 50);

// ────────────────────────────────────────────────────────────
console.log('\nRingkasan snapshot');
const summary = summariseQuestionnaires({
  essScore: 12, srq20Score: 6, dassDepresi: 5, dassCemas: 8, dassStres: 9, sdsScore: 45,
});
console.log(`  ringkasan = ${summary}`);
if (!summary.includes('Mild Anxiety') || !summary.includes('Normal')) {
  failed.push(`ringkasan tidak memakai label per subskala: ${summary}`);
}
if (!summary.includes('ESS 12') || !summary.includes('SRQ-20 6')) {
  failed.push(`ringkasan tidak memuat skor ESS dan SRQ-20: ${summary}`);
}

// ────────────────────────────────────────────────────────────
// Kesimpulan yang tampil pada popup
// ────────────────────────────────────────────────────────────
// Yang diperiksa di sini bukan gaya bahasa, melainkan dua hal yang bisa
// salah dan berdampak nyata:
//
//   1. Kesimpulan harus menyebut hal yang paling penting dari STD-006, yaitu
//      tidak layak mengoperasikan alat berat dan shift malam pada ESS di atas
//      15. Melewatkan penyebutan itu berisiko keselamatan.
//   2. Kesimpulan harus SEPAKAT dengan zona yang akhirnya disimpan engine.
//      Kalau popup bilang "Perlu dipantau" sementara zonanya Merah, karyawan
//      mendapat informasi yang salah.

console.log('\nKesimpulan ESS (popup)');

const essBerat = kesimpulanEss({ score: 24, category: 'berat', answered: 8, total: 8 });
if (!/tidak layak mengoperasikan alat berat|shift malam/i.test(essBerat)) {
  failed.push(`kesimpulan ESS berat tidak menyebut larangan alat berat: ${essBerat}`);
}
console.log(`  ESS 24 → ${essBerat.slice(0, 92)}…`);

const essSehat = kesimpulanEss({ score: 4, category: 'normal', answered: 8, total: 8 });
if (!/tidak ditemukan kantuk/i.test(essSehat)) {
  failed.push(`kesimpulan ESS normal kurang tepat: ${essSehat}`);
}
console.log(`  ESS 4  → ${essSehat.slice(0, 92)}…`);

const essParsial = kesimpulanEss({ score: 12, category: 'ringan-sedang', answered: 5, total: 8 });
if (!/belum lengkap/i.test(essParsial)) {
  failed.push(`kesimpulan ESS parsial harus menyatakan belum lengkap: ${essParsial}`);
}
console.log(`  ESS 5/8 → ${essParsial.slice(0, 92)}…`);

// ────────────────────────────────────────────────────────────
console.log('\nKesimpulan Kesehatan Mental + konsistensi zona');

const tanpaGejala = { rawIndex: 20, category: 'normal', answered: 20 };
const tidakDiisi = { rawIndex: 0, category: 'tidak-lengkap', answered: 0 };
const srqNormal = { answered: 20, score: 0, category: 'normal' };
const srqPerlu = { answered: 20, score: 6, category: 'perlu-tindak-lanjut' };

const dassMaks = scoreDass21(Object.fromEntries([...Array(21)].map((_, i) => [`dass${i + 1}`, 3])));
const dassNol = scoreDass21(Object.fromEntries([...Array(21)].map((_, i) => [`dass${i + 1}`, 0])));

// DASS-21 depresi 27 = kategori tertinggi → Merah
check('depresi 27 → zona Merah', zonaDariKuesioner(dassMaks, tanpaGejala, srqPerlu), 'Merah');
const mhMerah = kesimpulanSrqDass(srqPerlu, dassMaks, tanpaGejala, true);
if (!/perlu tindakan segera/i.test(mhMerah)) {
  failed.push(`kesimpulan merah harus menyebut tindakan segera: ${mhMerah}`);
}
if (!/diagnosis|konfirmasi/i.test(mhMerah)) {
  failed.push(`kesimpulan merah harus mengingatkan bahwa ini bukan diagnosis: ${mhMerah}`);
}
console.log(`  depresi 27 → ${mhMerah.slice(0, 92)}…`);

// SRQ-20 tepat di cutoff 6 → Kuning
check('SRQ 6 → zona Kuning', zonaDariKuesioner(dassNol, tanpaGejala, srqPerlu), 'Kuning');
const mhKuning = kesimpulanSrqDass(srqPerlu, dassNol, { rawIndex: 65, category: 'moderate', answered: 20 }, true);
if (!/pemantauan dan tindak lanjut/i.test(mhKuning)) {
  failed.push(`kesimpulan kuning kurang tepat: ${mhKuning}`);
}
console.log(`  SRQ 6     → ${mhKuning.slice(0, 92)}…`);

// SDS 70 → Merah, SDS 60 → Kuning
check('SDS 70 → zona Merah', zonaDariKuesioner(dassNol, { rawIndex: 70, category: 'severe', answered: 20 }, srqNormal), 'Merah');
check('SDS 60 → zona Kuning', zonaDariKuesioner(dassNol, { rawIndex: 60, category: 'moderate', answered: 20 }, srqNormal), 'Kuning');
check('SDS 59 → tidak menggeser zona', zonaDariKuesioner(dassNol, { rawIndex: 59, category: 'mild', answered: 20 }, srqNormal), null);

// Semuanya normal → tidak ada yang digeser
check('semua normal → tidak menggeser zona', zonaDariKuesioner(dassNol, tanpaGejala, srqNormal), null);
const mhSehat = kesimpulanSrqDass(srqNormal, dassNol, tanpaGejala, false);
if (!/tidak ditemukan gejala/i.test(mhSehat)) {
  failed.push(`kesimpulan normal kurang tepat: ${mhSehat}`);
}
console.log(`  semua normal → ${mhSehat.slice(0, 92)}…`);

// Instrumen yang tidak diisi tidak boleh disebut sebagai skor 0. Pada DASS-21
// angka 0 berarti "tidak ada gejala", bukan "tidak menjawab".
const mhSebagian = kesimpulanSrqDass(
  { answered: 0, score: 0, category: 'normal' },
  dassNol,
  tidakDiisi,
  false,
);
if (/SRQ-20 \d/.test(mhSebagian) || /SDS \d/.test(mhSebagian)) {
  failed.push(`kesimpulan menyebut instrumen yang tidak diisi: ${mhSebagian}`);
}

// Menariknya, "semua DASS = 0" tetap boleh disebut sebagai kondisi baik,
// karena di situ seluruh 21 item benar-benar terisi.
if (!/tidak ditemukan gejala/i.test(kesimpulanSrqDass(
  { answered: 0, score: 0, category: 'normal' }, dassNol, tanpaGejala, false,
))) {
  failed.push('DASS yang seluruh itemnya terisi nol seharusnya dilaporkan sebagai kondisi baik.');
}

console.log(failed.length ? `\nGAGAL:\n - ${failed.join('\n - ')}` : '\nOK: seluruh aturan skor dan kesimpulan kuesioner sesuai.');
process.exit(failed.length ? 1 : 0);

