// Menulis database/mcu_columns.sql sebagai UTF-8 TANPA BOM.
//
// PENTING: jangan memakai `node scripts/gen-mcu-columns-sql.mjs > file.sql`
// di PowerShell — operator `>` menulis UTF-16 (dengan BOM), sehingga setiap
// karakter menjadi 2 byte ber-NUL dan SQL Editor menolaknya dengan
// "syntax error at or near ...". Pakai skrip ini:
//
//   node scripts/tulis-sql-kolom-mcu.mjs
//
// Setelah selesai, jalankan file database/mcu_columns.sql di SQL Editor.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tujuan = join(here, '..', 'database', 'mcu_columns.sql');

const sql = execFileSync(process.execPath, [join(here, 'gen-mcu-columns-sql.mjs')], {
  encoding: 'utf8',
});

// Utf8 tanpa BOM: tulis string apa adanya.
writeFileSync(tujuan, sql, 'utf8');

const jumlah = [...sql.matchAll(/add column if not exists /g)].length;
console.log(`Tertulis: database/mcu_columns.sql (${jumlah} kolom, UTF-8 tanpa BOM)`);
