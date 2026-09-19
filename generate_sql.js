const { readFileSync, writeFileSync } = require('fs');

// Simple regex to extract field ids and types from mcu-fields.ts
const content = readFileSync('src/lib/mcu-fields.ts', 'utf-8');
const regex = /{ id:\s*'([^']+)',.*?type:\s*'([^']+)'/gs;

let sql = `-- Supabase Migration: MCU Tables
-- Generated automatically

CREATE TABLE public.mcu_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
`;

let match;
while ((match = regex.exec(content)) !== null) {
  const [_, id, type] = match;
  // Map type to SQL type
  let sqlType = 'TEXT';
  if (type === 'number') sqlType = 'NUMERIC';
  else if (type === 'date') sqlType = 'DATE';
  
  // Convert id from camelCase to snake_case for DB convention
  const snakeId = id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase();
  
  sql += `    ${snakeId} ${sqlType},\n`;
}

// Remove last comma and add closing parenthesis
sql = sql.replace(/,\n$/, '\n');
sql += `);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mcu_records_modtime 
BEFORE UPDATE ON public.mcu_records 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Create View for MCU Monitor All Site
-- This view selects the latest MCU for each NIK Karyawan
CREATE OR REPLACE VIEW public.mcu_monitor_all_site AS
WITH ranked_mcu AS (
  SELECT 
    *,
    ROW_NUMBER() OVER(PARTITION BY nik_karyawan ORDER BY tgl_mcu DESC) as rn
  FROM public.mcu_records
)
SELECT * FROM ranked_mcu WHERE rn = 1;
`;

writeFileSync('supabase/migrations/001_mcu_tables.sql', sql);
console.log("SQL generated at supabase/migrations/001_mcu_tables.sql");
