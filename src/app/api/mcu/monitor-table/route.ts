import { NextRequest, NextResponse } from 'next/server';
import { decrypt, decryptEmployee, hashField, isEncryptedValue } from '@/lib/encryption';
import { muatFollowUpSelesai } from '@/lib/followup-status';
import { siteDihitung } from '@/lib/site-filter';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import {
  EXEMPT_TEXT,
  NO_DATA_TEXT,
  buildNotifikasiJadwal,
  calcAgeFromBirthDate,
  calcAgeFromNIK,
  calcMasaKerja,
  classifyMcuType,
  compareMonitorRows,
  evaluateValidity,
  formatDate,
  getFollowUp,
  isExemptJabatan,
  normalizeArea,
  normalizeNIK,
  parseDate,
  titleCase,
} from '@/lib/mcu-monitor';

export const dynamic = 'force-dynamic';

const client = () => integrationAdminClient();

type Row = Record<string, any>;

// ---------------------------------------------------------------- auth ------

// ------------------------------------------------------------- data fetch ---

const PAGE_SIZE = 1000;

/**
 * Ambil seluruh baris tabel secara berurutan (tanpa query paralel supaya
 * tidak membebani database). Bila daftar kolom ada yang tidak ditemukan,
 * otomatis diulang dengan select('*').
 */
async function fetchAll(
  table: string,
  columns: string,
  configure?: (query: any) => any,
): Promise<Row[]> {
  const run = async (select: string) => {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query: any = client().from(table).select(select);
      if (configure) query = configure(query);
      const { data, error } = await query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...(data as Row[]));
      if (data.length < PAGE_SIZE) break;
    }
    return rows;
  };
  try {
    return await run(columns);
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as any)?.message || '');
    if (/column|does not exist|42703/i.test(message) && columns !== '*') return run('*');
    throw error;
  }
}

const EMPLOYEE_COLUMNS = [
  'id', 'nik', 'nama', 'gender', 'age', 'job_position', 'client', 'site_name', 'area',
  'tanggal_pkwt', 'masa_kerja', 'birth_date', 'national_id', 'division', 'employment_status',
].join(',');

const MCU_COLUMNS = [
  'id', 'national_id', 'nik_karyawan', 'status_mcu', 'tgl_mcu', 'tgl_expired',
  'kes_vendor', 'perlu_fu', 'rek_fu', 'zonasi', 'item_fu', 'diagnosa_medis', 'fram_kat',
].join(',');

const SCHEDULE_COLUMNS = 'id,national_id,nik_karyawan,tanggal_jadwal';

/** Nilai terenkripsi didekripsi di server; kunci tidak pernah dikirim ke browser. */
function plain(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  if (isEncryptedValue(text)) return decrypt(text) ?? '';
  return text.trim();
}

const key = (value: unknown) => normalizeNIK(value).toLowerCase();

// ---------------------------------------------------------------- builder ---

async function buildRows(): Promise<Row[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [employeeRaw, mcuRaw, scheduleRaw, followUpByHash] = await Promise.all([
    fetchAll('employees', EMPLOYEE_COLUMNS, q => q.ilike('employment_status', 'Aktif').eq('division', 'Mining')),
    fetchAll('mcu_records', MCU_COLUMNS),
    fetchAll('mcu_schedules', SCHEDULE_COLUMNS),
    muatFollowUpSelesai(client()),
  ]);

  // --- karyawan (dekripsi NIK Karyawan & NIK KTP)
  const employees = employeeRaw.map(row => decryptEmployee(row) as Row);
  const byNational = new Map<string, Row>();
  const byNik = new Map<string, Row>();
  for (const emp of employees) {
    const nat = key(emp.national_id);
    const nik = key(emp.nik);
    if (nat) byNational.set(nat, emp);
    if (nik) byNik.set(nik, emp);
  }

  const resolveEmployee = (nationalIdRaw: unknown, nikRaw: unknown): Row | null => {
    const nat = key(plain(nationalIdRaw));
    if (nat && byNational.has(nat)) return byNational.get(nat)!;
    const nik = key(plain(nikRaw));
    if (nik) {
      // Di data lama, kolom NIK Karyawan kadang berisi NIK KTP
      return byNik.get(nik) || byNational.get(nik) || null;
    }
    return null;
  };

  // --- kelompokkan record MCU per karyawan
  const recordsByEmployee = new Map<Row, Row[]>();
  for (const rec of mcuRaw) {
    const emp = resolveEmployee(rec.national_id, rec.nik_karyawan);
    if (!emp) continue;
    const list = recordsByEmployee.get(emp) || [];
    list.push(rec);
    recordsByEmployee.set(emp, list);
  }

  // --- jadwal MCU selanjutnya (ambil tanggal terbaru per karyawan)
  const scheduleByEmployee = new Map<Row, Date>();
  for (const sch of scheduleRaw) {
    const emp = resolveEmployee(sch.national_id, sch.nik_karyawan);
    const date = parseDate(sch.tanggal_jadwal);
    if (!emp || !date) continue;
    const current = scheduleByEmployee.get(emp);
    if (!current || date > current) scheduleByEmployee.set(emp, date);
  }

  // --- susun baris
  const rows: Row[] = employees.map(emp => {
    const jabatan = String(emp.job_position || '').trim();
    const site = titleCase(emp.site_name);
    // Head Office TIDAK mengenal pengecualian — semua karyawan wajib MCU.
    const exempt = isExemptJabatan(jabatan, site);

    const valid = (recordsByEmployee.get(emp) || [])
      .map(rec => ({ rec, type: classifyMcuType(rec.status_mcu), date: parseDate(rec.tgl_mcu) }))
      .filter((x): x is { rec: Row; type: 'pre' | 'annual'; date: Date } => !!x.type && !!x.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const total = valid.length;
    const pre = valid.filter(x => x.type === 'pre').length;
    const annual = valid.filter(x => x.type === 'annual').length;
    const latest = valid.length ? valid[valid.length - 1] : null;
    const lastDate = latest?.date ?? null;

    // Status follow up mengikuti follow up terbaru (followups_prokawan);
    // bila belum ada, memakai kesimpulan vendor pada MCU terakhir.
    const nikHash = hashField(String(emp.nik ?? '').trim());
    const followUp = getFollowUp(latest?.rec ?? null, latest?.date ?? null, nikHash ? followUpByHash.get(nikHash) ?? [] : []);
    const validity = evaluateValidity(lastDate, latest?.rec?.tgl_expired, today);
    const jadwal = scheduleByEmployee.get(emp) ?? null;

    const notifikasi = exempt
      ? EXEMPT_TEXT
      : buildNotifikasiJadwal({
        lastDate, jadwal, isExpired: validity.isExpired, sisaHari: validity.sisaHari, today,
      });

    // FRS: kategori Framingham pada MCU terbaru yang sudah terisi
    let frs = 'FRS Belum Dimapping';
    if (exempt) frs = EXEMPT_TEXT;
    else if (!latest) frs = NO_DATA_TEXT;
    else {
      const withFrs = [...valid].reverse().find(x => String(x.rec.fram_kat ?? '').trim());
      if (withFrs) frs = String(withFrs.rec.fram_kat).trim();
    }

    const text = (v: unknown) => (v == null ? '' : String(v).trim());
    const age = calcAgeFromNIK(emp.national_id, today)
      || calcAgeFromBirthDate(emp.birth_date, today)
      || (emp.age ?? '');
    const tglMasuk = parseDate(emp.tanggal_pkwt);
    const masaKerja = calcMasaKerja(emp.tanggal_pkwt, today) || text(emp.masa_kerja);

    return {
      nik_karyawan: text(emp.nik),
      nama: text(emp.nama),
      jenis_kelamin: text(emp.gender),
      usia: age,
      jabatan,
      client: text(emp.client) || 'PT. BDM',
      site,
      area: normalizeArea(emp.area, site),
      masa_kerja: masaKerja,
      total_mcu: total,
      pre_employee: pre,
      annual,
      mcu_terakhir: exempt ? EXEMPT_TEXT : (lastDate ? formatDate(lastDate) : NO_DATA_TEXT),
      kategori_mcu_terakhir: exempt ? EXEMPT_TEXT : (latest ? (classifyMcuType(latest.rec.status_mcu) === 'pre' ? 'Pre Employee' : 'Annual') : NO_DATA_TEXT),
      kesimpulan_mcu: exempt ? EXEMPT_TEXT : (latest ? (text(latest.rec.kes_vendor) || '-') : NO_DATA_TEXT),
      status_follow_up: followUp.status,
      kesimpulan_fu: followUp.kesimpulan,
      masa_berlaku_mcu: exempt ? EXEMPT_TEXT : validity.masaBerlaku,
      kategori_masa_berlaku: exempt ? EXEMPT_TEXT : validity.kategori,
      jadwal_mcu_selanjutnya: jadwal ? formatDate(jadwal) : '',
      notifikasi_jadwal: notifikasi,
      zona_status_kesehatan: exempt ? EXEMPT_TEXT : (latest ? text(latest.rec.zonasi) : NO_DATA_TEXT),
      // Catatan = kolom item_fu pada record MCU terbaru
      catatan: latest ? plain(latest.rec.item_fu) : '',
      diagnosa: exempt ? EXEMPT_TEXT : (latest ? (text(latest.rec.diagnosa_medis) || NO_DATA_TEXT) : NO_DATA_TEXT),
      frs,
      _tglMasuk: tglMasuk,
    };
  });

  // Site "Batch" = calon karyawan — bukan bagian dari populasi yang dinilai.
  const dihitung = rows.filter((row) => siteDihitung(row.site));
  dihitung.sort(compareMonitorRows);
  return dihitung.map(({ _tglMasuk, ...row }) => row);
}

// ------------------------------------------------------------------ cache ---

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { rows: Row[]; at: number } | null = null;
let inflight: Promise<Row[]> | null = null;

async function getRows(force: boolean): Promise<Row[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  if (!inflight) {
    inflight = buildRows()
      .then(rows => { cache = { rows, at: Date.now() }; return rows; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    if (!caller) return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });
    if (caller.role === 'pic' && !caller.site) {
      return NextResponse.json({ error: 'Site akun PIC belum ditentukan' }, { status: 403 });
    }

    const force = request.nextUrl.searchParams.get('refresh') === 'true';
    let rows = await getRows(force);

    const restrictSite = caller.role === 'pic' && caller.site && caller.site.toLowerCase() !== 'head office';
    if (restrictSite) {
      const own = caller.site!.toLowerCase();
      rows = rows.filter(row => String(row.site || '').toLowerCase() === own);
    }

    return NextResponse.json({ rows, total: rows.length });
  } catch (error) {
    console.error('Gagal memuat tabel monitor MCU:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ error: 'Gagal memuat tabel monitor MCU' }, { status: 500 });
  }
}
