const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const ts = require('typescript');
const vm = require('vm');

// Load the same field contract used by the form, rather than maintaining a
// second hand-written list of Supabase columns.
const source = readFileSync('src/lib/mcu-fields.ts', 'utf-8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(transpiled, { exports: moduleValue.exports, module: moduleValue, require });
const fields = moduleValue.exports.MCU_FIELDS;

let sql = `-- Supabase Migration: MCU Tables
-- Generated automatically

CREATE TABLE public.mcu_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
`;

for (const field of fields) {
  const { id, type } = field;
  // Map type to SQL type
  let sqlType = 'TEXT';
  if (type === 'number') sqlType = 'NUMERIC';
  else if (type === 'date') sqlType = 'DATE';
  
  // Convert id from camelCase to snake_case for DB convention
  const snakeId = id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
  
  sql += `    ${snakeId} ${sqlType},\n`;
}

sql += `    national_id_hash TEXT,\n    nik_karyawan_hash TEXT\n`;
sql += `);`;

const viewColumns = fields
  .map(field => field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase())
  .join(',\n  ');

sql += `
CREATE INDEX mcu_records_national_id_hash_idx
  ON public.mcu_records (national_id_hash);

CREATE INDEX mcu_records_nik_karyawan_hash_idx
  ON public.mcu_records (nik_karyawan_hash);

CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_mcu_records_modtime ON public.mcu_records;
CREATE TRIGGER update_mcu_records_modtime
BEFORE UPDATE ON public.mcu_records 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP VIEW IF EXISTS public.mcu_monitor_all_site;
CREATE OR REPLACE VIEW public.monitor_mcu AS
WITH ranked_mcu AS (
  SELECT *,
    ROW_NUMBER() OVER(
      PARTITION BY COALESCE(nik_karyawan_hash, national_id_hash)
      ORDER BY tgl_mcu DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM public.mcu_records
)
SELECT
  ${viewColumns}
FROM ranked_mcu
WHERE rn = 1;
`;

mkdirSync('supabase/migrations', { recursive: true });
writeFileSync('supabase/migrations/001_mcu_tables.sql', sql);
console.log("SQL generated at supabase/migrations/001_mcu_tables.sql");
