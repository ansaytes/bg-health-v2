// Ganti password awal untuk akun yang BELUM mengganti password (must_change_password = true).
// Akun yang sudah punya password pribadi tidak disentuh.
//
// Dry-run (default, hanya menghitung):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... EMPLOYEE_DEFAULT_PASSWORD=... node scripts/rotate-default-password.mjs
// Terapkan:
//   ... node scripts/rotate-default-password.mjs --apply
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const newPassword = process.env.EMPLOYEE_DEFAULT_PASSWORD;
const apply = process.argv.includes('--apply');

if (!url || !key || !newPassword || newPassword.length < 8) {
  console.error('Wajib: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMPLOYEE_DEFAULT_PASSWORD (min. 8 karakter).');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
let page = 1;
let pending = 0;
let updated = 0;

for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error('Gagal membaca user:', error.message); process.exit(1); }
  const users = data?.users ?? [];
  for (const user of users.filter(u => u.app_metadata?.must_change_password === true)) {
    pending++;
    if (!apply) continue;
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (updateError) console.error(`Gagal untuk ${user.id}: ${updateError.message}`);
    else updated++;
  }
  if (users.length < 1000) break;
  page++;
}

console.log(apply
  ? `Selesai: ${updated} dari ${pending} akun diperbarui.`
  : `Dry-run: ${pending} akun belum ganti password. Jalankan dengan --apply untuk mengganti.`);
