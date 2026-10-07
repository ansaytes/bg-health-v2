// ============================================================================
// Logika Tabel Monitor MCU (server-side)
//
// Port dari skrip Google Apps Script `updateDataMCU`, tetapi sumber datanya
// Supabase (employees + mcu_records + mcu_schedules), bukan spreadsheet.
// Semua fungsi di sini murni (tanpa I/O) supaya mudah dites.
// ============================================================================

export type RecordLike = Record<string, any>;

// ---------------------------------------------------------------- tanggal ---

/** Terima 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm…', 'DD/MM/YYYY', atau Date. */
export function parseDate(val: unknown): Date | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const s = String(val).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(d: Date | null): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const DAY_MS = 86_400_000;
export function diffDays(a: Date, b: Date): number {
  // a - b dalam hari kalender (aman terhadap pergantian DST)
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / DAY_MS);
}

// -------------------------------------------------------------- normalisasi --

export function normalizeNIK(val: unknown): string {
  if (val == null || val === '') return '';
  return String(val).replace(/\s+/g, '').trim().replace(/^0+/, '');
}

const SITE_AREAS: Record<string, string> = Object.fromEntries(
  Object.entries({
    'Area 1': [
      'Satui', 'Angsana', 'Tanjung Tabalong', 'Rantau', 'Binuang', 'Senakin', 'Kota Baru',
      'Batu Kajang', 'Ketapang', 'Kapuas Tengah', 'Murung Raya', 'Muara Teweh', 'Tuhup',
      'Gunung Mas', 'Banjar Baru',
    ],
    'Area 2': [
      'Bontang', 'Samarinda', 'Tenggarong', 'Tabang', 'Gunung Sari', 'Bukit Pinang',
      'Sangatta', 'Bengalon', 'Kaliorang', 'Kaubun', 'Balikpapan', 'Melak',
    ],
    'Area 3': [
      'Muara Enim', 'Lahat', 'Muara Bungo', 'Banyuwangi', 'Wetar', 'Kotamobagu', 'Konawe',
      'Halmahera Timur', 'Gorontalo', 'Aceh', 'Palu', 'Malinau', 'Kelubir', 'Tanjung Redeb',
      'Labanan', 'Binungan', 'Bunyu', 'Sebakis', 'Morowali', 'Luwu', 'Soroako', 'Kayong Utara',
    ],
  }).flatMap(([area, sites]) => sites.map(site => [site.toLowerCase(), area])),
);

export function normalizeArea(rawArea: unknown, site: unknown): string {
  const v = String(rawArea ?? '').trim().toLowerCase();
  if (v === '1' || v === 'area 1') return 'Area 1';
  if (v === '2' || v === 'area 2') return 'Area 2';
  if (v === '3' || v === 'area 3') return 'Area 3';
  if (v === 'head office' || v === 'ho') return 'HO';
  return SITE_AREAS[String(site ?? '').trim().toLowerCase()] || '';
}

export function titleCase(val: unknown): string {
  return String(val ?? '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// -------------------------------------------------------------------- usia --

/** Hitung usia dari NIK KTP 16 digit (digit 7-12 = ddmmyy, perempuan dd+40). */
export function calcAgeFromNIK(nikRaw: unknown, today = new Date()): number | '' {
  if (!nikRaw) return '';
  let s = String(nikRaw).replace(/\s+/g, '').trim();
  while (s.length < 16) s = '0' + s;
  if (s.length !== 16 || !/^\d{16}$/.test(s)) return '';

  let dd = parseInt(s.substring(6, 8), 10);
  const mm = parseInt(s.substring(8, 10), 10);
  const yy = parseInt(s.substring(10, 12), 10);
  if (dd > 40) dd -= 40;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';

  const currentYear = today.getFullYear();
  const century = Math.floor(currentYear / 100) * 100;
  let birthYear = century + yy;
  if (birthYear > currentYear) birthYear -= 100;

  const birth = new Date(birthYear, mm - 1, dd);
  if (isNaN(birth.getTime())) return '';

  let age = currentYear - birth.getFullYear();
  const diffMonth = today.getMonth() - birth.getMonth();
  if (diffMonth < 0 || (diffMonth === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : '';
}

export function calcAgeFromBirthDate(birthRaw: unknown, today = new Date()): number | '' {
  const birth = parseDate(birthRaw);
  if (!birth) return '';
  let age = today.getFullYear() - birth.getFullYear();
  const diffMonth = today.getMonth() - birth.getMonth();
  if (diffMonth < 0 || (diffMonth === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 120 ? age : '';
}

// ------------------------------------------------------------- masa kerja ---

/** "xx Tahun, xx Bulan, xx Hari" dihitung dari tanggal masuk kerja. */
export function calcMasaKerja(tglMasukRaw: unknown, today: Date): string {
  const start = parseDate(tglMasukRaw);
  if (!start || start > today) return '';
  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  let days = today.getDate() - start.getDate();
  if (days < 0) {
    months--;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years} Tahun, ${months} Bulan, ${days} Hari`;
}

// ------------------------------------------------------ urutan area/jabatan --

export function getAreaRank(area: unknown): number {
  const a = String(area ?? '').trim().toLowerCase();
  if (a === 'ho') return 0;
  if (a === 'area 1') return 1;
  if (a === 'area 2') return 2;
  if (a === 'area 3') return 3;
  return 4;
}

export const JABATAN_ORDER = [
  // 1. Top Management
  'General Manager',
  // 2. Superintendent
  'Superintendent - Plant', 'Superintendent - Area', 'Superintendent Area Jakarta',
  // 3. Manager (QSHE di atas)
  'Manager - QSHE', 'Manager - HCGS', 'Manager - Operation', 'Manager - Plant',
  'Sr. Manager - Finance, Account, & Tax',
  // 4. Penanggung Jawab / Representative
  'Penanggung Jawab Operasional', 'Penanggung Jawab Area', 'PJO - Representative',
  // 5. Supervisor (SHE/QSHE di atas)
  'Supervisor - SHE Operational', 'Supervisor - QSHE Area',
  'Supervisor - Plant', 'Supervisor - Operation', 'Supervisor - Finance', 'Supervisor - Accounting',
  'Supervisor - Tax', 'Supervisor - Marketing', 'Supervisor - Organization Development',
  'Supervisor - General Services', 'Supervisor - Warehouse & Logistic', 'Supervisor - Inventory',
  'Supervisor - Officer TDC', 'Supervisor - Trainer Plant', 'Supervisor - Trainer Operation',
  'Supervisor - SEED', 'SPV - Plant',
  // 6. Foreman (SHE/QSHE & Paramedic di atas)
  'Foreman - SHE Operational', 'Foreman - QSHE Representatif', 'Paramedic', 'Paramedic - Representatif',
  'Foreman - Operation', 'Foreman - Plant', 'Foreman - Planner', 'Foreman - Warehouse & Inventory',
  'Foreman - Trainer Operation', 'Foreman - Trainer Plant', 'Foreman - Tax', 'Foreman - AP',
  'Foreman - QC QA Finishing', 'Foreman - Treasury', 'Foreman - QE Plant', 'Foreman - IT',
  'Foreman - AR', 'Foreman - Inventory', 'Foreman - Procurement', 'Foreman - Warehouse & Dispatching',
  'Foreman - Marketing', 'Foreman - Industrial Relation', 'Foreman - GS Area', 'Foreman - Recruitment',
  'Foreman - Organization Development', 'Foreman - Employee Services', 'Foreman - Legal',
  'Foreman - Warehouse & Receiving', 'Foreman - HC Area', 'Foreman - Refurbish', 'Foreman - Tyre',
  'Foreman - Development Plant',
  // 7. Staff / Personal Assistant / Secretary (SHE/QSHE di atas)
  'Staff - Document Control QSHE', 'Staff - Safety Support',
  'Personal Assistant', 'Secretary', 'Content Creator', 'Staff - Data Evaluator', 'Staff - IT',
  'Staff - Purchasing', 'Staff - Planner', 'Staff - Surat', 'Staff - Plant', 'Staff - General Services',
  'Staff - Treasury', 'Staff - Setoran AKDP', 'Staff - Accounting', 'Staff - AP', 'Staff - Tax',
  'Staff - Operation', 'Staff - AR', 'Staff - TDC', 'Staff - Procurement Legal', 'Staff - Recruitment',
  'Staff - Employee Services', 'Staff - MEP', 'Staff - Inventory', 'Staff - Warehouse & Dispatching',
  // 8. Admin (SHE/Environment di atas)
  'Admin - System & Enviro',
  'Admin - Umum', 'Admin - Plant & SCM', 'Admin - SCM', 'Admin - Plant',
  'Admin - Receiving dan Binning', 'Admin - Setoran AKDP', 'Admin - AP Site',
  'Admin - Recruitment', 'Admin - Treasury', 'Admin - Operation', 'Admin - Purchasing',
  'Admin - Accounting', 'Admin - Employee Services', 'Admin - Warehouse', 'Admin - General Services',
  'Admin - Inventory', 'Admin IT - System Solution', 'Admin - IER',
  // 9. Teknisi / Mekanik
  'Sr. Mekanik', 'Md. Mekanik', 'Jr. Mekanik', 'Mekanik', 'Mekanik - Plant', 'Mekanik - Umum',
  'Mekanik Transmisi', 'Welder', 'Toolskepeer',
  // 10. Helper / Operator Gudang & Logistik
  'Helper - Mekanik', 'Helper - Plant', 'Helper - SCM', 'Operator - Forklift', 'Part Counter - SCM',
  'Storeman - SCM', 'Package - SCM',
  // 11. Driver
  'Driver - Operation', 'Driver Spare - Operation', 'Driver - Head Office', 'Helper Driver - Operation',
  // 12. Keamanan
  'Komandan Regu', 'Security HO', 'Security',
  // 13. Support Layanan Umum
  'Wakar', 'Juru Masak', 'Chef', 'Cleaning Service',
];

const normalizeJabatanText = (val: unknown) =>
  String(val ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const JABATAN_ORDER_MAP: Record<string, number> = {};
JABATAN_ORDER.forEach((jab, idx) => {
  const key = normalizeJabatanText(jab);
  if (!(key in JABATAN_ORDER_MAP)) JABATAN_ORDER_MAP[key] = idx;
});

export function getJabatanRank(jab: unknown): number {
  const idx = JABATAN_ORDER_MAP[normalizeJabatanText(jab)];
  return idx !== undefined ? idx : JABATAN_ORDER.length;
}

// ------------------------------------------------------------ pengecualian --

/**
 * Jabatan yang tidak memerlukan Mine Permit.
 * Skrip lama memakai substring (mis. "sec" ikut mengecualikan "Secretary"),
 * di sini dipakai batas kata supaya hanya jabatan yang dimaksud yang terkena.
 */
const EXEMPT_REGEX = /\b(wakar|cook|masak|juru masak|clean|cleaning|cs|security|sec)\b/;
export function isExemptJabatan(jabatan: unknown): boolean {
  return EXEMPT_REGEX.test(String(jabatan ?? '').toLowerCase());
}

export const EXEMPT_TEXT = 'Tidak Perlu Mine Permit';
export const NO_DATA_TEXT = 'No Data';

// ------------------------------------------------------------ follow up -----

const clean = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Tahap follow up dari paling kanan (terbaru) ke kiri. Pasangan
 * kesimpulan -> rekomendasi yang mengikutinya:
 *   kesimpulan_fu3 -> rek_fu4,  kesimpulan_fu2 -> rek_fu3,
 *   kesimpulan_fu1 -> rek_fu2,  kes_vendor     -> rek_fu
 */
const FU_STAGES: Array<{ kesimpulan: string; rekomendasi: string }> = [
  { kesimpulan: 'kesimpulan_fu3', rekomendasi: 'rek_fu4' },
  { kesimpulan: 'kesimpulan_fu2', rekomendasi: 'rek_fu3' },
  { kesimpulan: 'kesimpulan_fu1', rekomendasi: 'rek_fu2' },
  { kesimpulan: 'kes_vendor', rekomendasi: 'rek_fu' },
];

export function getFollowUp(rec: RecordLike | null): { status: string; kesimpulan: string } {
  if (!rec) return { status: '', kesimpulan: '' };
  for (const stage of FU_STAGES) {
    const value = clean(rec[stage.kesimpulan]);
    if (!value) continue;
    const lower = value.toLowerCase();
    if (lower === 'fit to work' || lower === 'fit') return { status: 'Close: FTW', kesimpulan: value };
    if (lower === 'unfit') return { status: 'Close: UNFIT', kesimpulan: value };
    const rek = clean(rec[stage.rekomendasi]);
    return { status: rek ? `Open: FU - ${rek}` : 'Open: FU', kesimpulan: value };
  }
  return { status: '', kesimpulan: '' };
}

// ------------------------------------------------------------ masa berlaku --

export function evaluateValidity(lastDate: Date | null, expiryRaw: unknown, today: Date) {
  if (!lastDate) {
    return {
      masaBerlaku: NO_DATA_TEXT, kategori: NO_DATA_TEXT,
      isExpired: true, sisaHari: -9999,
    };
  }
  let expDate = parseDate(expiryRaw);
  if (!expDate) {
    expDate = new Date(lastDate);
    expDate.setFullYear(expDate.getFullYear() + 1);
  }
  const sisa = diffDays(expDate, today);
  const isExpired = sisa < 0;
  const masaBerlaku = sisa >= 0 ? `${sisa} Hari lagi` : `Expired ${Math.abs(sisa)} Hari`;

  let kategori: string;
  if (sisa >= 0) {
    kategori = sisa <= 30 ? 'Valid ≤ 1 Bulan' : sisa <= 90 ? 'Valid ≤ 3 Bulan' : 'Valid > 3 Bulan';
  } else {
    const abs = Math.abs(sisa);
    kategori = abs <= 30 ? 'Expired ≤ 1 Bulan'
      : abs <= 90 ? 'Expired ≤ 3 Bulan'
      : abs <= 365 ? 'Expired ≤ 1 Tahun'
      : 'Expired > 1 Tahun';
  }
  return { masaBerlaku, kategori, isExpired, sisaHari: sisa };
}

// -------------------------------------------------------- notifikasi jadwal --

export function buildNotifikasiJadwal(opts: {
  lastDate: Date | null;
  jadwal: Date | null;
  isExpired: boolean;
  sisaHari: number;
  today: Date;
}): string {
  const { lastDate, jadwal, isExpired, sisaHari, today } = opts;

  if (!lastDate) {
    if (!jadwal) return 'MCU Tidak Ditemukan, Belum Dijadwalkan MCU';
    const diff = diffDays(jadwal, today);
    return diff >= 0
      ? `MCU Tidak Ditemukan, Dijadwalkan MCU ${diff} Hari Lagi`
      : `MCU Tidak Ditemukan, Jadwal MCU Terlewat ${Math.abs(diff)} Hari`;
  }

  if (!jadwal) {
    return !isExpired
      ? 'MCU Valid, Belum Dijadwalkan MCU Ulang'
      : 'MCU Expired, Belum Dijadwalkan MCU Ulang';
  }

  const diffTodayToJadwal = diffDays(jadwal, today);
  const diffMcuToJadwal = diffDays(jadwal, lastDate);

  if (!isExpired) {
    if (diffTodayToJadwal >= 0) return `MCU Valid, Dijadwalkan ${diffTodayToJadwal} Hari Lagi`;
    if (diffMcuToJadwal < 0) return `MCU Valid, Pelaksanaan Terlambat ${Math.abs(diffMcuToJadwal)} Hari`;
    if (diffMcuToJadwal > 0) {
      return sisaHari >= 100
        ? `MCU Valid, Pelaksanaan ${diffMcuToJadwal} Hari Lebih Cepat`
        : `MCU Valid, Jadwal Terlewat ${Math.abs(diffTodayToJadwal)} Hari`;
    }
    return 'MCU Valid, Pelaksanaan Tepat Waktu';
  }
  return diffTodayToJadwal >= 0
    ? `MCU Expired, Dijadwalkan ${diffTodayToJadwal} Hari Lagi`
    : `MCU Expired, Jadwal Terlewat ${Math.abs(diffTodayToJadwal)} Hari`;
}

// ------------------------------------------------------------ tipe MCU ------

/**
 * Hanya MCU "Pre Employee" dan "Annual" yang dihitung (sama dengan skrip lama).
 * Status "Follow Up - …", "Specific", dan "Retirement" tidak dihitung sebagai
 * MCU baru. Ubah di sini bila ingin aturan lain.
 */
export function classifyMcuType(raw: unknown): 'pre' | 'annual' | null {
  const t = clean(raw).toLowerCase();
  if (!t || t.startsWith('follow up')) return null;
  if (t.includes('pre')) return 'pre';
  if (t.includes('ann')) return 'annual';
  return null;
}

// ------------------------------------------------------------ sortir --------

export function compareMonitorRows(a: RecordLike, b: RecordLike): number {
  const areaCmp = getAreaRank(a.area) - getAreaRank(b.area);
  if (areaCmp !== 0) return areaCmp;

  const siteCmp = String(a.site || '').localeCompare(String(b.site || ''));
  if (siteCmp !== 0) return siteCmp;

  const clientCmp = String(a.client || '').trim().toLowerCase()
    .localeCompare(String(b.client || '').trim().toLowerCase());
  if (clientCmp !== 0) return clientCmp;

  const jabCmp = getJabatanRank(a.jabatan) - getJabatanRank(b.jabatan);
  if (jabCmp !== 0) return jabCmp;

  // Tanggal masuk lebih awal = masa kerja lebih lama = didahulukan
  const tglA = a._tglMasuk as Date | null;
  const tglB = b._tglMasuk as Date | null;
  if (tglA && tglB) {
    if (tglA.getTime() !== tglB.getTime()) return tglA.getTime() - tglB.getTime();
  } else if (tglA && !tglB) return -1;
  else if (!tglA && tglB) return 1;

  return String(a.nama || '').localeCompare(String(b.nama || ''));
}
