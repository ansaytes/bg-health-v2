// ============================================================================
// Segarkan salinan skor kuesioner pada seluruh record MCU
// ============================================================================
//
// Setelah mcu_ess / mcu_mental_health terisi (dari migrasi data lama atau
// dari pengisian halaman kuesioner), setiap record MCU perlu salinan skor
// kuesioner yang berlaku pada tanggal pemeriksaannya. Tanpa langkah ini, zona
// MCU tidak akan memperhitungkan Gangguan Tidur dan Kesehatan Mental.
//
// Skrip ini memanggil logika yang SAMA dengan aplikasi
// (src/lib/questionnaire-store.ts → refreshQuestionnaireSnapshot), sehingga
// hasil import sama dengan hasil saat kuesioner diisi lewat UI.
//
// Pakai:  node scripts/refresh-questionnaire-snapshots.mjs
//         (idempoten, aman dijalankan berulang kali)
// ============================================================================

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi');
}
const supabase = createClient(url, serviceKey);

const { data: employees, error } = await supabase
  .from('mcu_records')
  .select('nik_karyawan_hash')
  .not('nik_karyawan_hash', 'is', null);
if (error) throw error;

const hashes = [...new Set((employees ?? []).map((r) => String(r.nik_karyawan_hash)))];
console.log(`Memproses ${hashes.length} karyawan...`);

// Modul aplikasi memakai alias '@/lib/...', jadi tidak bisa langsung diimpor
// dari skrip Node. Aturan salinan di sini sengaja dibuat sama persis dengan
// refreshQuestionnaireSnapshot() di src/lib/questionnaire-store.ts: kalau salah
// satu berubah, yang lain harus ikut berubah.

function latestOnOrBefore(rows, dateKey, before) {
  const eligible = rows.filter((row) => {
    const value = String(row[dateKey] ?? '');
    return value !== '' && (before === '' || value <= before);
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => (String(a[dateKey]) < String(b[dateKey]) ? 1 : -1));
  return eligible[0];
}

let updatedRecords = 0;
let withSnapshot = 0;
const zoneCounts = {};

for (const hash of hashes) {
  const { data: mcus } = await supabase
    .from('mcu_records')
    .select('id, tgl_mcu, ess_score, srq20_score, dass_depresi, dass_cemas, dass_stres, sds_score, kuesioner_tgl')
    .eq('nik_karyawan_hash', hash);
  if (!mcus || mcus.length === 0) continue;

  const { data: essRows } = await supabase
    .from('mcu_ess')
    .select('tgl_ess, skor_ess')
    .eq('nik_karyawan_hash', hash);
  const { data: mhRows } = await supabase
    .from('mcu_mental_health')
    .select('tgl_pemeriksaan, skor_srq20, dass_depresi, dass_ansietas, dass_stres, indeks_sds')
    .eq('nik_karyawan_hash', hash);

  for (const mcu of mcus) {
    const tgl = String(mcu.tgl_mcu ?? '');
    const ess = latestOnOrBefore(essRows ?? [], 'tgl_ess', tgl);
    const mh = latestOnOrBefore(mhRows ?? [], 'tgl_pemeriksaan', tgl);

    const dates = [ess?.tgl_ess ?? null, mh?.tgl_pemeriksaan ?? null].filter(Boolean).sort();
    const snapshotDate = dates.length > 0 ? dates[dates.length - 1] : null;

    const next = {
      ess_score: ess?.skor_ess ?? null,
      srq20_score: mh?.skor_srq20 ?? null,
      dass_depresi: mh?.dass_depresi ?? null,
      dass_cemas: mh?.dass_ansietas ?? null,
      dass_stres: mh?.dass_stres ?? null,
      sds_score: mh?.indeks_sds ?? null,
      kuesioner_tgl: snapshotDate,
    };

    const changed = Object.keys(next).some((k) => String(next[k] ?? '') !== String(mcu[k] ?? ''));
    if (!changed) continue;

    const { error: updateError } = await supabase.from('mcu_records').update(next).eq('id', mcu.id);
    if (updateError) throw updateError;
    updatedRecords += 1;
    if (snapshotDate) withSnapshot += 1;
  }
}

const { data: zonasi } = await supabase
  .from('mcu_records')
  .select('zonasi, kuesioner_tgl');
for (const row of zonasi ?? []) {
  const key = row.kuesioner_tgl ? `${row.zonasi ?? 'Kosong'} (dengan kuesioner)` : `${row.zonasi ?? 'Kosong'} (tanpa kuesioner)`;
  zoneCounts[key] = (zoneCounts[key] ?? 0) + 1;
}

console.log(`\nSalinan diperbarui : ${updatedRecords} record`);
console.log(`Memiliki kuesioner : ${withSnapshot} record`);
console.log('\nDistribusi zona:');
for (const [zone, count] of Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${zone.padEnd(32)} ${count}`);
}
console.log('\nZona dihitung ulang oleh aplikasi; skrip ini hanya mengisi salinan.');