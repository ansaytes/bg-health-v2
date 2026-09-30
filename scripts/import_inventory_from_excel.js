const { createClient } = require('@supabase/supabase-js');
const XLSX = require('../node_modules/xlsx');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

const excelPath = 'C:/Users/bagon/Downloads/KUNJUNGAN KLINIK 2026.xlsx';
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets['Pemakaian Obat'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

function determineCategory(name, unit) {
  const n = String(name).toLowerCase();
  const u = String(unit).toLowerCase();
  if (
    n.includes('spuit') || n.includes('infus set') || n.includes('iv cath') ||
    n.includes('kasa') || n.includes('kassa') || n.includes('plester') ||
    n.includes('needle') || n.includes('alkohol') || n.includes('kapas') ||
    n.includes('handschoen') || n.includes('sarung tangan') || n.includes('masker') ||
    n.includes('underpad') || n.includes('strip') || u.includes('pcs') || u.includes('roll')
  ) {
    return 'Bahan Medis';
  }
  return 'Obat';
}

async function main() {
  console.log('--- Importing Inventory from Excel (Sheet: Pemakaian Obat) ---');

  // Bersihkan inventory lama
  await supabase.from('inventory_batches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('inventory_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Existing inventory cleared.');

  const items = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const name = row[0] ? String(row[0]).trim() : '';
    if (!name || name === 'TOTAL' || name.startsWith('Jumlah')) continue;

    const initialStock = parseInt(row[1], 10) || 0;
    // Pemakaian 12 bulan (Jan - Des)
    let totalUsage = 0;
    let monthsWithUsage = 0;
    for (let m = 2; m <= 13; m++) {
      const val = parseInt(row[m], 10) || 0;
      totalUsage += val;
      if (val > 0) monthsWithUsage++;
    }

    const sisaRaw = parseInt(row[14], 10);
    const sisa = isNaN(sisaRaw) ? Math.max(0, initialStock - totalUsage) : Math.max(0, sisaRaw);
    const unit = row[15] && String(row[15]).trim() ? String(row[15]).trim() : 'Tablet';
    const category = determineCategory(name, unit);

    const avgMonthly = Math.round(totalUsage / Math.max(1, monthsWithUsage || 7));

    items.push({
      name,
      category,
      unit,
      avg_monthly_usage: avgMonthly,
      sisa,
      initialStock
    });
  }

  console.log(`Parsed ${items.length} inventory items.`);

  // Tanggal kadaluarsa FEFO sample yang realistis agar dashboard kaya visual & alert
  // Beberapa diset expired, beberapa < 3 bulan, beberapa aman 2027/2028
  const now = new Date();
  
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];

    // 1. Insert item master
    const { data: itemData, error: itemErr } = await supabase
      .from('inventory_items')
      .insert({
        name: it.name,
        category: it.category,
        unit: it.unit,
        avg_monthly_usage: it.avg_monthly_usage,
        stock: it.sisa
      })
      .select()
      .single();

    if (itemErr) {
      console.error(`Error inserting item ${it.name}:`, itemErr);
      continue;
    }

    // 2. Tentukan tanggal expired realistis
    let expDate = '2027-10-31';
    let inDate = '2026-01-10';

    // Berikan beberapa item khusus status kadaluarsa / kritis untuk evaluasi dashboard
    if (it.name.includes('Antrain') || it.name.includes('Otsu - WI')) {
      expDate = '2026-02-15'; // Sudah kadaluarsa
    } else if (it.name.includes('Amoxicilin') || it.name.includes('Degirol')) {
      expDate = '2026-10-25'; // < 30 hari / < 1 bulan
    } else if (it.name.includes('Anadex') || it.name.includes('Grantusif') || it.name.includes('Piroxicam')) {
      expDate = '2026-11-20'; // < 2 bulan
    } else if (it.name.includes('Ranitidine') || it.name.includes('Paracetamol')) {
      expDate = '2027-01-15'; // < 4 bulan
    } else if (idx % 7 === 0) {
      expDate = '2026-11-15'; // < 2 bulan
    } else if (idx % 5 === 0) {
      expDate = '2026-12-30'; // < 3 bulan
    } else if (idx % 3 === 0) {
      expDate = '2027-04-15'; // 6 bulan
    } else {
      expDate = '2027-12-31'; // Aman
    }

    // 3. Insert ke inventory_batches jika ada sisa stok atau buat batch 0 untuk item habis
    const { error: batchErr } = await supabase.from('inventory_batches').insert({
      item_id: itemData.id,
      sisa_stok: it.sisa,
      tanggal_masuk: inDate,
      tanggal_expired: expDate
    });

    if (batchErr) {
      console.error(`Error inserting batch for ${it.name}:`, batchErr);
    }
  }

  // Verifikasi View
  const { data: summary, error: sumErr } = await supabase.from('v_inventory_summary').select('*');
  console.log(`Inventory Summary View: ${summary?.length} items ready.`);
  console.log('Sample summary items:', summary?.slice(0, 3));
}

main().catch(console.error);
