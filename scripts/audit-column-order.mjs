// Cocokkan daftar kolom output script dengan skema DB mcu_records yang sebenarnya.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r = await fetch(`${url}/rest/v1/mcu_records?select=*&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const dbCols = Object.keys((await r.json())[0]);

for (const [file, name] of [
  ['scripts/import-mcu-excel.mjs', 'ALL_DB_COLUMNS_ORDERED'],
  ['scripts/split-sql-and-csv.mjs', 'ALL_COLUMNS_ORDERED'],
]) {
  let s = fs.readFileSync(file, 'utf8');
  const re = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`);
  const mm = s.match(re);
  const listed = mm[1].match(/'([a-z0-9_]+)'/g).map((x) => x.replace(/'/g, ''));
  console.log(`== ${file}`);
  console.log(`   listed=${listed.length} db=${dbCols.length}`);
  console.log(`   tidak ada di script: ${dbCols.filter((c) => !listed.includes(c)).join(', ') || '(none)'}`);
  console.log(`   tidak ada di DB    : ${listed.filter((c) => !dbCols.includes(c)).join(', ') || '(none)'}`);
  console.log(`   urutan beda        : ${JSON.stringify(listed) === JSON.stringify(dbCols) ? 'sama' : 'BEDA'}`);
}