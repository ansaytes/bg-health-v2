// ============================================================================
// Pemeriksa sintaks dasar untuk file migrasi SQL
// ============================================================================
//
// Berkas migrasi tidak bisa diuji di lingkungan ini karena tidak ada psql
// maupun CLI Supabase, dan PostgREST tidak menjalankan DDL. Script ini
// menangkap kelas kesalahan yang paling sering membuat SQL Editor gagal
// sebelum menyentuh database:
//
//   1. Kurung kurawal / kurung buka yang tidak seimbang per pernyataan.
//   2. CHECK/FOREIGN KEY yang memisahkan kondisi dengan koma. PostgreSQL
//      hanya menerima SATU ekspresi boolean di dalam CHECK; koma harus
//      diganti AND. Ini kesalahan yang sempat membuat migrasi gagal.
//   3. BEGIN/COMMIT yang tidak berpasangan.
//   4. Tanda kutip yang tidak tertutup.
//
// Pakai:  node scripts/check-sql-syntax.mjs <file.sql> [...file.sql]
// ============================================================================

import fs from 'fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Pemakaian: node scripts/check-sql-syntax.mjs <file.sql> [...file.sql]');
  process.exit(2);
}

let totalProblems = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`${file}\n  GAGAL: file tidak ditemukan`);
    totalProblems += 1;
    continue;
  }

  const raw = fs.readFileSync(file, 'utf8');
  const problems = [];

  // Lepaskan komentar dan literal string supaya tidak ikut dihitung. Baris
  // komentar '--' dan blok '/* */' diabaikan; string '...' dipotong supaya
  // kurung di dalamnya tidak dihitung sebagai kurung SQL.
  let sql = '';
  let i = 0;
  let line = 1;
  while (i < raw.length) {
    if (raw.startsWith('--', i)) {
      while (i < raw.length && raw[i] !== '\n') i += 1;
      continue;
    }
    if (raw.startsWith('/*', i)) {
      while (i < raw.length && !raw.startsWith('*/', i)) { if (raw[i] === '\n') line += 1; i += 1; }
      i += 2;
      continue;
    }
    if (raw[i] === "'") {
      sql += ' ';
      i += 1;
      while (i < raw.length) {
        if (raw[i] === "'" && raw[i + 1] === "'") { i += 2; continue; }
        if (raw[i] === '\n') line += 1;
        if (raw[i] === "'") { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (raw[i] === '\n') line += 1;
    sql += raw[i];
    i += 1;
  }

  // 1. Kurung tidak seimbang, dilacak per titik koma di level kurung 0.
  let depth = 0;
  let start = 1;
  for (let k = 0; k < sql.length; k += 1) {
    const ch = sql[k];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) { problems.push(`kurung tutup berlebih di baris ${line}`); depth = 0; }
    } else if ((ch === ';') && depth === 0) {
      start = line;
    }
  }
  if (depth !== 0) problems.push(`kurung tidak seimbang: sisa ${depth} kurung buka`);

  // 2. CHECK ( atau FOREIGN KEY ( yang isinya dipisah koma.
  //
  //    Pencocokan harus MELALUI kurung bersarang. Versi pertama memakai regex
  //    non-greedy dan berhenti pada ')' pertama, sehingga justru lolos pada
  //    berkas yang salah - persis kelas kesalahan yang mau dicek.
  function bodyOfParen(startIndex) {
    // startIndex menunjuk pada karakter '('.
    let depth = 0;
    for (let k = startIndex; k < sql.length; k += 1) {
      if (sql[k] === '(') depth += 1;
      else if (sql[k] === ')') {
        depth -= 1;
        if (depth === 0) return sql.slice(startIndex + 1, k);
      }
    }
    return null;
  }

  for (const m of sql.matchAll(/\b(?:CHECK|FOREIGN\s+KEY)\s*\(/gi)) {
    const open = m.index + m[0].length - 1;
    const body = bodyOfParen(open);
    if (body === null) continue;
    // Koma di level terluar CHECK berarti kondisi dipisah koma. Koma di
    // dalam kurung (mis. VARCHAR(10, 2)) memang sah, jadi harus diabaikan.
    let d = 0;
    let koma = false;
    for (const ch of body) {
      if (ch === '(') d += 1;
      else if (ch === ')') d -= 1;
      else if (ch === ',' && d === 0) koma = true;
    }
    if (koma) problems.push('CHECK/FOREIGN KEY memisahkan kondisi dengan koma - harus memakai AND');
  }

  // 3. BEGIN / COMMIT berpasangan.
  const begins = (sql.match(/\bBEGIN\s*;/gi) || []).length;
  const commits = (sql.match(/\bCOMMIT\s*;/gi) || []).length;
  if (begins !== commits) problems.push(`BEGIN=${begins} tapi COMMIT=${commits}`);

  // 4. Tanda kutip ganjil.
  const quotes = (raw.match(/'/g) || []).length;
  if (quotes % 2 !== 0) problems.push(`jumlah tanda kutip ganjil (${quotes})`);

  if (problems.length === 0) {
    console.log(`${file}\n  OK: tidak ditemukan masalah sintaks dasar`);
  } else {
    totalProblems += problems.length;
    console.log(`${file}`);
    for (const p of [...new Set(problems)]) console.log(`  - ${p}`);
  }
}

console.log(totalProblems === 0 ? '\nSemua berkas lolos.' : `\n${totalProblems} masalah ditemukan.`);
process.exit(totalProblems === 0 ? 0 : 1);