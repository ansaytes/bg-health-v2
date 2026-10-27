import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { decrypt, hashField, isEncryptedValue } from '@/lib/encryption';
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
  tugas_area: string | null;
  /** Kolom zonasi hasil engine (STD/006): Merah / Kuning / Hijau. */
  zonasi: string | null;
  /** Sebagian VIEW/skema memakai nama zona_risiko — dibaca sebagai cadangan. */
  zona_risiko?: string | null;
  trigger_zona: string | null;
  /** Kolom pengendalian dari engine — per parameter, bukan general per zona. */
  pengendalian: string | null;
  hasil_mcu: string | null;
  mcu_terakhir: string | null;
  tgl_mcu: string | null;
}

/**
 * Nilai pada mcu_records bisa terenkripsi (AES-256-GCM hex) atau plaintext
 * (data lama / hasil engine). Dekripsi hanya bila memang berbentuk ciphertext,
 * agar nilai lama yang sudah bersih tidak berubah.
 */
function dekripsi(value: string | null | undefined): string | null {
  if (value == null) return null;
  let text = String(value).trim();
  if (!text) return text;
  // Sebagian record tersimpan TERENKRIPSI BERLAPIS (impor ulang menulis ulang
  // nilai yang sudah terenkripsi), sehingga satu kali dekripsi masih
  // menghasilkan ciphertext. Terus dekripsi selama hasilnya masih berbentuk
  // ciphertext, maksimal 4 putaran agar nilai aneh tidak menggantung.
  for (let i = 0; i < 4; i += 1) {
    const isHexCipher = /^[0-9a-fA-F]+$/.test(text) && text.length >= 58 && text.length % 2 === 0;
    if (!isHexCipher && !isEncryptedValue(text)) break;
    const hasil = decrypt(text);
    if (hasil == null || hasil === text) break;
    text = hasil.trim();
  }
  return text;
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

  // Ambil MCU terbaru per karyawan. Kolom pakai nama sebenarnya di mcu_records
  // (hasil applyMCUCalculations: zonasi, trigger_zona, pengendalian). Kolom
  // `department` tidak ada di mcu_records — jabatan/departemen diambil dari
  // tabel employees via nik_hash.
  const attempts = [
    'nik_karyawan,nama,site,tugas_area,zonasi,trigger_zona,pengendalian,hasil_mcu,mcu_terakhir,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,trigger_zona,pengendalian,hasil_mcu,mcu_terakhir,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,trigger_zona,pengendalian,mcu_terakhir,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,trigger_zona,hasil_mcu,mcu_terakhir,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,trigger_zona,mcu_terakhir,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,mcu_terakhir,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,tgl_mcu',
    'nik_karyawan,nama,site,tgl_mcu',
  ];

  let rows: McuRow[] = [];
  let lastError = '';
  for (const cols of attempts) {
    const { data, error } = await client
      .from('mcu_records')
      .select(cols)
      .order('tgl_mcu', { ascending: false })
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

  // `nik_karyawan` dan `nama` di mcu_records tersimpan TERENKRIPSI (AES-256-GCM).
  // Tanpa dekripsi, dedupe per karyawan dan join ke tabel employees memakai
  // nilai sandi yang berbeda tiap baris, sehingga nama tampil sebagai hex acak
  // dan peserta terduplikasi. Dekripsi dulu sebelum dipakai sebagai kunci.
  for (const row of rows) {
    row.nik_karyawan = dekripsi(row.nik_karyawan);
    row.nama = dekripsi(row.nama);
  }

  // Satu baris per karyawan: record dengan DATA MCU terbaru.
  //
  // mcu_records juga menyimpan baris hasil kuesioner (ESS/SRQ/SDS) yang
  // `tgl_mcu`-nya NULL. Bila baris semacam itu terpilih sebagai "terbaru",
  // jadwal kontrol & parameter pemicu ikut kosong padahal MCU-nya ada. Karena
  // itu prioritas: (1) yang punya `zonasi`, (2) yang punya `tgl_mcu`, lalu
  // yang tgl_mcu paling akhir. Efek sampingnya: zona tetap dari MCU terakhir
  // yang benar-benar memiliki hasil zona (INK/016 poin 4.1.1).
  const terbaru = new Map<string, McuRow>();
  const skorBaris = (row: McuRow): [number, number] => [
    String(row.zonasi ?? '').trim() ? 1 : 0,
    String(row.tgl_mcu ?? row.mcu_terakhir ?? '').trim() ? 1 : 0,
  ];
  const tanggal = (row: McuRow) => String(row.tgl_mcu ?? row.mcu_terakhir ?? '').trim();
  for (const row of rows) {
    const key = String(row.nik_karyawan ?? '').trim();
    if (!key) continue;
    const ada = terbaru.get(key);
    if (!ada) { terbaru.set(key, row); continue; }
    const [zonaA, tglA] = skorBaris(row);
    const [zonaB, tglB] = skorBaris(ada);
    const lebihBaik = zonaA > zonaB
      || (zonaA === zonaB && tglA > tglB)
      || (zonaA === zonaB && tglA === tglB && tanggal(row) > tanggal(ada));
    if (lebihBaik) terbaru.set(key, row);
  }

  // Jabatan/departemen tersedia di tabel `employees` — mcu_records tidak
  // menyimpan kolom department. Join berdasarkan hash NIK (nik_hash di employees
  // = HMAC(nik) = nik_karyawan_hash di mcu_records).
  const nikHashes = [...new Set(
    [...terbaru.values()]
      .map((row) => hashField(String(row.nik_karyawan ?? '').trim()))
      .filter((h): h is string => Boolean(h)),
  )];
  const deptByNik = new Map<string, string>();
  const noWaByNik = new Map<string, string>();
  if (nikHashes.length) {
    for (let i = 0; i < nikHashes.length; i += 100) {
      const chunk = nikHashes.slice(i, i + 100);
      // Nama kolom telepon berbeda antar-schema (phone_number / no_wa / phone).
      // Dicoba bertahap; kolom yang tidak ada diabaikan, bukan menggagalkan join.
      let emps: Record<string, unknown>[] = [];
      for (const phoneCol of ['phone_number', 'no_wa', 'phone', null]) {
        const cols = ['nik_hash', 'department', 'job_position', phoneCol].filter(Boolean).join(',');
        const res = await client.from('employees').select(cols).in('nik_hash', chunk);
        if (!res.error) { emps = (res.data ?? []) as unknown as Record<string, unknown>[]; break; }
      }
      for (const emp of emps) {
        if (!emp.nik_hash) continue;
        const hash = String(emp.nik_hash);
        deptByNik.set(hash, String(emp.department || emp.job_position || ''));
        // Nomor telepon juga tersimpan terenkripsi di tabel employees.
        const wa = dekripsi(String(emp.phone_number || emp.no_wa || emp.phone || '')) ?? '';
        if (wa.trim()) noWaByNik.set(hash, wa.trim());
      }
    }
  }

  // Bila record MCU terakhir tidak menyimpan `tgl_mcu`, acuan jadwal diambil
  // dari sumber lain yang setara: tanggal MCU terakhir pada VIEW monitor_mcu
  // (dihitung dari seluruh histori) lalu jadwal MCU berikutnya.
  const jadwalByHash = new Map<string, string>();
  if (nikHashes.length) {
    // Hanya mcu_schedules yang dipakai sebagai cadangan tanggal. VIEW
    // monitor_mcu sengaja TIDAK di-query di sini: VIEW tersebut menggabungkan
    // tiga tabel dan per-chunk query-nya membuat endpoint ini butuh >30 detik.
    for (let i = 0; i < nikHashes.length; i += 150) {
      const chunkHash = nikHashes.slice(i, i + 150);
      const { data: sched } = await client.from('mcu_schedules')
        .select('nik_karyawan_hash,tanggal_jadwal')
        .in('nik_karyawan_hash', chunkHash);
      for (const s of sched ?? []) {
        const hash = String(s.nik_karyawan_hash ?? '');
        const tgl = String(s.tanggal_jadwal ?? '').trim();
        if (!hash || !tgl) continue;
        const ada = jadwalByHash.get(hash);
        if (!ada || tgl > ada) jadwalByHash.set(hash, tgl);
      }
    }
  }

  const peserta: PesertaProKawan[] = [];
  for (const row of terbaru.values()) {
    const zonaRaw = String(row.zonasi ?? row.zona_risiko ?? '').trim();
    // Hanya Zona Kuning & Merah yang menjadi peserta (INK/016 poin 4.1.1).
    if (!/^(kuning|merah)$/i.test(zonaRaw)) continue;
    const zona = zonaRaw.toUpperCase().startsWith('M') ? 'Merah' : 'Kuning';

    const nikHash = hashField(String(row.nik_karyawan ?? '').trim());
    const triggers = splitTriggers(row.trigger_zona);
    const rencana = rencanaDariTriggers(triggers, zona);

    // Dasar perhitungan jatuh tempo = tanggal MCU / pemeriksaan terakhir.
    const dasar = row.tgl_mcu || row.mcu_terakhir || null;
    const jatuhTempo = tambahBulan(dasar, rencana.bulan)
      // Tanpa tanggal MCU sama sekali: jadwal MCU berikutnya jadi acuan kontrol.
      || (nikHash ? jadwalByHash.get(nikHash) ?? null : null);

    peserta.push({
      nama: String(row.nama ?? '—'),
      nik: String(row.nik_karyawan ?? ''),
      nikHash,
      site: String(row.site ?? ''),
      area: String(row.tugas_area ?? '').trim() || null,
      department: (nikHash ? deptByNik.get(nikHash) : null) || null,
      noWa: (nikHash ? noWaByNik.get(nikHash) : null) || null,
      zona,
      triggers,
      /** Pengendalian per parameter dari engine STD/006 — bukan general per zona. */
      pengendalian: row.pengendalian ? String(row.pengendalian) : null,
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
