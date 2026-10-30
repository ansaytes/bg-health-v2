// ============================================================
// Pemuat peserta ProKawan — dipakai BERSAMA dua endpoint
// ============================================================
//
//  • GET /api/prokawan            → payload dengan IDENTITAS (nama, NIK, no. WA).
//                                   Hanya untuk QSHE Medic di halaman
//                                   Administrator > ProKawan.
//  • GET /api/prokawan/dashboard  → payload AGREGAT, tanpa identitas sama sekali.
//                                   Untuk dashboard manajemen.
//
// Keduanya WAJIB memakai perhitungan yang sama (zona, frekuensi, jatuh tempo,
// jalur). Kalau logika disalin ke dua tempat, angka di dashboard akan
// menyimpang dari daftar peserta — dan itu justru merusak laporan.
//
// Modul ini mengembalikan data LENGKAP (termasuk identitas). Pemanggil yang
// bertanggung jawab MEMBUANG identitas sebelum mengirim ke browser — lihat
// `keBarisAgregat()` di /api/prokawan/dashboard/route.ts.

import { adminClient } from '@/lib/questionnaire-store';
import { decrypt, hashField, isEncryptedValue } from '@/lib/encryption';
import { siteDihitung } from '@/lib/site-filter';
import {
  rencanaDariTriggers,
  statusKepatuhan,
  tambahBulan,
  type JalurProKawan,
  type PesertaProKawan,
} from '@/lib/prokawan';

/** Kolom mcu_records yang benar-benar ada (diverifikasi ke REST Supabase). */
export interface McuRow {
  nik_karyawan: string | null;
  nama: string | null;
  site: string | null;
  zonasi: string | null;
  trigger_zona: string | null;
  pengendalian: string | null;
  frekuensi_evaluasi: string | null;
  tgl_mcu: string | null;
  kes_vendor: string | null;
  /** Cadangan untuk skema lain — tidak ada di mcu_records saat ini. */
  zona_risiko?: string | null;
  tugas_area?: string | null;
  mcu_terakhir?: string | null;
  hasil_mcu?: string | null;
}

/**
 * Dekripsi nilai mcu_records.
 *
 * Sebagian record tersimpan TERENKRIPSI BERLAPIS (impor ulang menulis ulang
 * nilai yang sudah terenkripsi), sehingga satu kali dekripsi masih menghasilkan
 * ciphertext. Terus dekripsi selama hasilnya masih berbentuk ciphertext.
 */
export function dekripsi(value: string | null | undefined): string | null {
  if (value == null) return null;
  let text = String(value).trim();
  if (!text) return text;
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
export function splitTriggers(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

/**
 * Membaca angka bulan dari teks `frekuensi_evaluasi`, mis.
 * "Setiap 6 bulan" → 6, "Setiap 3 bulan sampai stabil" → 3,
 * "Evaluasi ulang setiap 3 bulan melalui MCU…" → 3.
 */
export function bulanDariFrekuensi(raw: string | null | undefined): number | null {
  const teks = String(raw ?? '').trim();
  if (!teks) return null;
  const cocok = teks.match(/(\d+)\s*bulan/i);
  if (!cocok) return null;
  const n = Number.parseInt(cocok[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface PesertaLengkap extends PesertaProKawan {
  /** Rentang hari menuju jatuh tempo: negatif = sudah lewat. */
  sisaHari: number | null;
  /** true bila tidak punya tanggal acuan sama sekali. */
  tanpaTanggalAcuan: boolean;
  /** true bila record tidak punya baris pengendalian Bab 7 (data lama). */
  pengendalianKosong: boolean;
}

export interface MuatPesertaOptions {
  /** Batasi ke satu site (dipakai PIC). */
  site?: string | null;
}

/**
 * Memuat seluruh peserta ProKawan beserta identitas.
 *
 * Sumber kepesertaan: SEMATA-MATA zona (INK/016 poin 4.1.1), bukan tabel
 * kepesertaan terpisah — sehingga selalu konsisten dengan MCU terbaru.
 */
export async function muatPesertaProKawan(opsi: MuatPesertaOptions = {}): Promise<PesertaLengkap[]> {
  const client = adminClient();

  const attempts = [
    'nik_karyawan,nama,site,zonasi,trigger_zona,pengendalian,frekuensi_evaluasi,tgl_mcu,kes_vendor',
    'nik_karyawan,nama,site,zonasi,trigger_zona,pengendalian,frekuensi_evaluasi,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,trigger_zona,pengendalian,tgl_mcu',
    'nik_karyawan,nama,site,zonasi,trigger_zona,tgl_mcu',
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
    throw new Error(`Gagal memuat data MCU: ${lastError}`);
  }

  // `nik_karyawan` dan `nama` tersimpan terenkripsi — dekripsi sebelum dipakai
  // sebagai kunci dedupe & join.
  for (const row of rows) {
    row.nik_karyawan = dekripsi(row.nik_karyawan);
    row.nama = dekripsi(row.nama);
  }

  // Satu baris per karyawan: record dengan DATA MCU terbaru.
  // mcu_records juga menyimpan baris hasil kuesioner dengan tgl_mcu NULL; bila
  // baris itu terpilih, zona/parameter/jadwal ikut kosong padahal MCU-nya ada.
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

  // Departemen & nomor telepon ada di tabel employees, bukan mcu_records.
  // Join lewat nik_hash (HMAC NIK) = nik_karyawan_hash di mcu_records.
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
      // Nama kolom telepon berbeda antar-schema; coba bertahap.
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
        const wa = dekripsi(String(emp.phone_number || emp.no_wa || emp.phone || '')) ?? '';
        if (wa.trim()) noWaByNik.set(hash, wa.trim());
      }
    }
  }

  // ── Sumber tanggal kontrol, berurutan menurut kekuatan bukti ────────────
  //
  // 1. `kunjungan_kontrol` — jadwal yang SUDAH ditetapkan/dikonfirmasi QSHE
  //    Medic (INK/016 poin 4.1.4). Ini yang paling berwenang: bisa saja QSHE
  //    Medic memajukan atau memundurkan jadwal atas rekomendasi dokter, dan
  //    angka di dashboard harus mengikuti kenyataan itu, bukan hitungan engine.
  // 2. Tanggal MCU + frekuensi (dihitung di bawah) — usulan otomatis.
  // 3. `mcu_schedules` — jadwal MCU berikutnya, cadangan terakhir.
  const kontrolByHash = new Map<string, { jadwal: string | null; aktual: string | null }>();
  const jadwalByHash = new Map<string, string>();
  if (nikHashes.length) {
    for (let i = 0; i < nikHashes.length; i += 150) {
      const chunk = nikHashes.slice(i, i + 150);
      const [kontrolRes, schedRes] = await Promise.all([
        client.from('followups_prokawan').select('nik_hash,jadwal_tanggal,aktual_tanggal').in('nik_hash', chunk),
        client.from('mcu_schedules').select('nik_karyawan_hash,tanggal_jadwal').in('nik_karyawan_hash', chunk),
      ]);

      for (const k of kontrolRes.data ?? []) {
        const hash = String(k.nik_hash ?? '');
        if (!hash) continue;
        const jadwal = String(k.jadwal_tanggal ?? '').slice(0, 10) || null;
        const aktual = String(k.aktual_tanggal ?? '').slice(0, 10) || null;
        const ada = kontrolByHash.get(hash);
        // Ambil jadwal terbaru; bila tanggal sama, yang sudah ada aktual menang.
        if (!ada || (jadwal && (!ada.jadwal || jadwal > ada.jadwal))) {
          kontrolByHash.set(hash, { jadwal, aktual: aktual ?? ada?.aktual ?? null });
        } else if (jadwal && jadwal === ada.jadwal && aktual) {
          kontrolByHash.set(hash, { jadwal, aktual });
        }
      }

      for (const s of schedRes.data ?? []) {
        const hash = String(s.nik_karyawan_hash ?? '');
        const tgl = String(s.tanggal_jadwal ?? '').trim();
        if (!hash || !tgl) continue;
        const ada = jadwalByHash.get(hash);
        if (!ada || tgl > ada) jadwalByHash.set(hash, tgl);
      }
    }
  }

  const hariIni = new Date();
  hariIni.setHours(0, 0, 0, 0);

  const peserta: PesertaLengkap[] = [];
  for (const row of terbaru.values()) {
    const zonaRaw = String(row.zonasi ?? row.zona_risiko ?? '').trim();
    // Hanya Zona Kuning & Merah yang menjadi peserta (INK/016 poin 4.1.1).
    if (!/^(kuning|merah)$/i.test(zonaRaw)) continue;

    const site = String(row.site ?? '').trim();
    // Site "Batch" = calon karyawan, bukan peserta ProKawan.
    if (!siteDihitung(site)) continue;
    if (opsi.site && opsi.site.toLowerCase() !== 'head office'
      && site.toLowerCase() !== opsi.site.toLowerCase()) continue;

    const zona = zonaRaw.toUpperCase().startsWith('M') ? 'Merah' : 'Kuning';
    const nikHash = hashField(String(row.nik_karyawan ?? '').trim());
    const triggers = splitTriggers(row.trigger_zona);

    // Frekuensi dari kolom engine `frekuensi_evaluasi` (Bab 7 per parameter).
    const bulanEngine = bulanDariFrekuensi(row.frekuensi_evaluasi);
    const rencana = bulanEngine !== null
      ? { ...rencanaDariTriggers(triggers, zona), bulan: bulanEngine }
      : rencanaDariTriggers(triggers, zona);

    const kontrol = nikHash ? kontrolByHash.get(nikHash) ?? null : null;
    const dasar = row.tgl_mcu || row.mcu_terakhir || null;
    const dariMcu = tambahBulan(dasar, rencana.bulan);
    const dariJadwal = nikHash ? jadwalByHash.get(nikHash) ?? null : null;

    // Prioritas: jadwal yang sudah ditetapkan QSHE Medic (kunjungan_kontrol)
    // → usulan otomatis dari MCU + frekuensi → jadwal MCU berikutnya.
    // Bila peserta SUDAH diperiksa (aktual_tanggal terisi), tanggal aktual
    // itulah acuan baru: kontrol berikutnya = aktual + frekuensi.
    const jatuhTempo = (kontrol?.aktual ? tambahBulan(kontrol.aktual, rencana.bulan) : null)
      ?? kontrol?.jadwal
      ?? dariMcu
      ?? dariJadwal;

    let sisaHari: number | null = null;
    if (jatuhTempo) {
      const d = new Date(`${jatuhTempo.slice(0, 10)}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        sisaHari = Math.round((d.getTime() - hariIni.getTime()) / 86400000);
      }
    }

    peserta.push({
      nama: String(row.nama ?? '—'),
      nik: String(row.nik_karyawan ?? ''),
      nikHash,
      site,
      area: String(row.tugas_area ?? '').trim() || null,
      department: (nikHash ? deptByNik.get(nikHash) : null) || null,
      noWa: (nikHash ? noWaByNik.get(nikHash) : null) || null,
      zona,
      triggers,
      pengendalian: row.pengendalian ? String(row.pengendalian) : null,
      jalur: rencana.jalur as JalurProKawan,
      bulan: rencana.bulan,
      jatuhTempo,
      status: statusKepatuhan(jatuhTempo),
      // Hanya status kelayakan kerja (bukan diagnosis).
      kelayakanKerja: row.kes_vendor
        ? String(row.kes_vendor)
        : (row.hasil_mcu ? String(row.hasil_mcu) : null),
      sisaHari,
      tanpaTanggalAcuan: !jatuhTempo,
      pengendalianKosong: !row.pengendalian,
    });
  }

  // Urut: terlambat dulu, lalu Zona Merah, lalu nama.
  const urutan: Record<string, number> = {
    terlambat: 0, 'belum-kontrol': 1, 'akan-datang': 2, 'sesuai-jadwal': 3, selesai: 4,
  };
  peserta.sort((a, b) => {
    if (a.status !== b.status) return (urutan[a.status] ?? 9) - (urutan[b.status] ?? 9);
    if (a.zona !== b.zona) return a.zona === 'Merah' ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });

  return peserta;
}
