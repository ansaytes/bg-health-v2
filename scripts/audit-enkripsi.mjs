// ============================================================
// AUDIT — membaca saja, TIDAK mengubah apa pun
// ============================================================
// Memeriksa apakah nilai sensitif di database terenkripsi berlapis,
// dan apakah hash NIK konsisten dengan nilai yang didekripsi.
//
// Pakai:  node scripts/audit-enkripsi.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const hashField = (v) => crypto.createHmac('sha256', key).update(String(v)).digest('hex');

function dekripsiSekali(hex) {
  try {
    const b = Buffer.from(String(hex), 'hex');
    if (b.length < 29) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch { return null; }
}

/** Berapa lapis enkripsi? 0 = sudah teks biasa. */
function hitungLapis(value) {
  let text = String(value ?? '').trim();
  let lapis = 0;
  for (let i = 0; i < 5; i += 1) {
    if (!/^[0-9a-fA-F]+$/.test(text) || text.length < 58 || text.length % 2 !== 0) break;
    const hasil = dekripsiSekali(text);
    if (hasil == null) break;
    text = hasil;
    lapis += 1;
  }
  return { lapis, plain: text };
}

async function ambilSemua(tabel, kolom) {
  const rows = [];
  // Halaman kecil (200) & retry: tabel mcu_records berisi kolom teks panjang
  // sehingga 1.000 baris sekaligus membuat koneksi terputus.
  const PAGE = 200;
  for (let from = 0; ; from += PAGE) {
    let gagal = 0;
    let data = null;
    while (gagal < 3) {
      const res = await sb.from(tabel).select(`id,${kolom.join(',')}`).order('id').range(from, from + PAGE - 1);
      if (!res.error) { data = res.data; break; }
      gagal += 1;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function audit(tabel, kolom, hashKolom, hashDari) {
  console.log(`\n═══ ${tabel} ═══`);
  const rows = await ambilSemua(tabel, [...kolom, ...(hashKolom ? [hashKolom] : [])]);
  console.log(`  ${rows.length} baris`);

  for (const k of kolom) {
    const sebaran = {};
    let contoh = null;
    for (const r of rows) {
      if (r[k] == null || r[k] === '') continue;
      const { lapis } = hitungLapis(r[k]);
      sebaran[lapis] = (sebaran[lapis] || 0) + 1;
      if (!contoh && lapis > 1) contoh = { id: r.id, lapis };
    }
    const ringkas = Object.entries(sebaran)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([l, n]) => `${l} lapis: ${n}`)
      .join(' | ');
    console.log(`  ${k.padEnd(18)} ${ringkas || '(kosong)'}`);
    if (contoh) console.log(`     contoh berlapis >1: id=${contoh.id}`);
  }

  if (hashKolom && hashDari) {
    let cocok = 0, beda = 0, kosong = 0;
    for (const r of rows) {
      if (!r[hashKolom]) { kosong += 1; continue; }
      const { lapis, plain } = hitungLapis(r[hashDari]);
      if (lapis === 0) { kosong += 1; continue; }
      // Hash seharusnya dihitung dari plaintext akhir.
      if (hashField(plain) === r[hashKolom]) cocok += 1; else beda += 1;
    }
    console.log(`  ${hashKolom.padEnd(18)} cocok=${cocok} beda=${beda} kosong=${kosong}`);
    if (beda > 0) console.log(`     ⚠ hash TIDAK konsisten dengan plaintext akhir`);
  }
}

await audit('mcu_records', ['nik_karyawan', 'national_id', 'nama'], 'nik_karyawan_hash', 'nik_karyawan');
await audit('employees', ['nik', 'national_id', 'nama'], 'nik_hash', 'nik');
await audit('mcu_schedules', ['nik_karyawan', 'national_id', 'nama'], 'nik_karyawan_hash', 'nik_karyawan');

console.log('\nSelesai. Tidak ada data yang diubah.');
