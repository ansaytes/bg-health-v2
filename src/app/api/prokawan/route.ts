import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  rencanaDariTriggers,
  statusKepatuhan,
  tambahBulan,
  type JalurProKawan,
  type PesertaProKawan,
} from '@/lib/prokawan';

export const dynamic = 'force-dynamic';

/**
 * GET /api/prokawan
 *
 * Daftar peserta ProKawan — karyawan Zona Kuning / Zona Merah menurut
 * MG/QSHE/STD/006 Rev.002, beserta jalur pengendalian dan jadwal kontrolnya
 * (BG/QSHE/INK/016).
 *
 * SUMBER DATA
 *  - mcu_records: zona_risiko terakhir per karyawan (hasil MCU terbaru).
 *  - tidak ada tabel kepesertaan terpisah: mengikuti INK/016 poin 4.1.1,
 *    kepesertaan ditetapkan SEMATA-MATA dari zona, sehingga selalu konsisten
 *    dengan hasil MCU terakhir.
 *
 * KERAHASIAAN (INK/016 poin 4.7.3 huruf e)
 *  - Hanya mengembalikan: nama, NIK, site, departemen, ZONA, label pemicu
 *    (parameter klinis), jalur, jadwal, dan status kelayakan kerja.
 *  - Tidak ada diagnosis, hasil laboratorium, atau skor kuesioner.
 */

const ROLES = ['superuser', 'administrator', 'pic', 'manager'];

interface McuRow {
  nik_karyawan: string | null;
  nama: string | null;
  site: string | null;
  department: string | null;
  tugas_area: string | null;
  zona_risiko: string | null;
  trigger_zona: string | null;
  hasil_mcu: string | null;
  mcu_terakhir: string | null;
  tanggal_mcu: string | null;
}

/** Memecah label trigger yang disimpan zonasi-engine (dipisah " | "). */
function splitTriggers(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) {
    return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  }
  if (!ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();

  // Ambil MCU terbaru per karyawan. Query bertingkat agar tetap jalan pada
  // database yang kolomnya belum lengkap.
  const attempts = [
    'nik_karyawan,nama,site,department,tugas_area,zona_risiko,trigger_zona,hasil_mcu,mcu_terakhir,tanggal_mcu',
    'nik_karyawan,nama,site,department,zona_risiko,trigger_zona,hasil_mcu,mcu_terakhir,tanggal_mcu',
    'nik_karyawan,nama,site,department,zona_risiko,zona_kategori,trigger_zona,mcu_terakhir',
    'nik_karyawan,nama,site,department,zona_risiko,mcu_terakhir',
  ];

  let rows: McuRow[] = [];
  let lastError = '';
  for (const cols of attempts) {
    const { data, error } = await client
      .from('mcu_records')
      .select(cols)
      .order('tanggal_mcu', { ascending: false })
      .limit(5000);
    if (!error) {
      rows = (data ?? []) as unknown as McuRow[];
      break;
    }
    lastError = error.message;
    if (!/does not exist|PGRST204|42703/i.test(error.message)) break;
  }

  if (!rows.length && lastError) {
    return NextResponse.json({ error: `Gagal memuat data MCU: ${lastError}` }, { status: 500 });
  }

  // Hanya baris terbaru per karyawan yang dipakai.
  const terbaru = new Map<string, McuRow>();
  for (const row of rows) {
    const key = String(row.nik_karyawan ?? '').trim();
    if (!key || terbaru.has(key)) continue;
    terbaru.set(key, row);
  }

  const peserta: PesertaProKawan[] = [];
  for (const row of terbaru.values()) {
    const zonaRaw = String(row.zona_risiko ?? '').trim();
    // Hanya Zona Kuning & Merah yang menjadi peserta (INK/016 poin 4.1.1).
    if (!/^(kuning|merah)$/i.test(zonaRaw)) continue;
    const zona = zonaRaw.toUpperCase().startsWith('M') ? 'Merah' : 'Kuning';

    const triggers = splitTriggers(row.trigger_zona);
    const rencana = rencanaDariTriggers(triggers);

    // Dasar perhitungan jatuh tempo = tanggal MCU / pemeriksaan terakhir.
    const dasar = row.tanggal_mcu || row.mcu_terakhir;
    const jatuhTempo = tambahBulan(dasar, rencana.bulan);

    peserta.push({
      nama: String(row.nama ?? '—'),
      nik: String(row.nik_karyawan ?? ''),
      site: String(row.site ?? ''),
      area: String(row.tugas_area ?? '') || null,
      department: String(row.department ?? '') || null,
      zona,
      triggers,
      jalur: rencana.jalur as JalurProKawan,
      bulan: rencana.bulan,
      jatuhTempo,
      status: statusKepatuhan(jatuhTempo),
      // Status kelayakan kerja saja — atasan tidak menerima diagnosis.
      kelayakanKerja: row.hasil_mcu ? String(row.hasil_mcu) : null,
    });
  }

  // Urut: yang terlambat dulu, lalu zona Merah.
  const urutan: Record<string, number> = {
    terlambat: 0, 'belum-kontrol': 1, 'akan-datang': 2, 'sesuai-jadwal': 3, selesai: 4,
  };
  peserta.sort((a, b) => {
    if (a.status !== b.status) return (urutan[a.status] ?? 9) - (urutan[b.status] ?? 9);
    if (a.zona !== b.zona) return a.zona === 'Merah' ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });

  return NextResponse.json({ success: true, data: peserta, total: peserta.length });
}
