import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt, hashField } from './lib/encryption.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(url, serviceKey);
const { data: rows, error } = await supabase
  .from('mcu_records')
  .select('id, identity, national_id, nik_karyawan, nama, link_mcu, national_id_hash, nik_karyawan_hash');

if (error) throw error;

function plainOrExisting(value) {
  if (!value) return null;
  return decrypt(value) || String(value);
}

let changed = 0;
for (const row of rows || []) {
  const nationalId = plainOrExisting(row.national_id || row.identity);
  const nikKaryawan = plainOrExisting(row.nik_karyawan);
  const nama = plainOrExisting(row.nama);
  const linkMcu = plainOrExisting(row.link_mcu);

  const patch = {
    national_id: encrypt(nationalId),
    nik_karyawan: encrypt(nikKaryawan),
    nama: encrypt(nama),
    link_mcu: encrypt(linkMcu),
    national_id_hash: hashField(nationalId),
    nik_karyawan_hash: hashField(nikKaryawan),
    // Protect the legacy NIK KTP column as well; it remains for compatibility.
    identity: encrypt(nationalId),
  };

  if (apply) {
    const result = await supabase.from('mcu_records').update(patch).eq('id', row.id);
    if (result.error) throw result.error;
  }
  changed += 1;
}

console.log(`${apply ? 'Migrated' : 'Validated'} ${changed} MCU records without printing sensitive values.`);
if (!apply) console.log('Run again with --apply to persist the migration.');
