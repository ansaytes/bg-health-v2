import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data } = await sb.from('sick_employees').select('bulan,tahun').limit(2000);
const map = new Map();
for (const r of data ?? []) {
  const k = `${r.tahun}-${String(r.bulan).padStart(2, '0')}`;
  map.set(k, (map.get(k) || 0) + 1);
}
console.log('Sebaran sick_employees per bulan:');
for (const [k, v] of [...map.entries()].sort()) console.log(`  ${k} = ${v} baris`);
