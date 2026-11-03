import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import { encrypt, hashField } from '@/lib/encryption';

/**
 * Klien dengan SERVICE ROLE untuk membaca/menulis data.
 *
 * MENGAPA BUKAN KLIEN ANON
 * Setelah RLS `sick_employees` diaktifkan dan `anon` dicabut grant-nya (untuk
 * menutup kebocoran 795 baris data pribadi), klien anon TIDAK LAGI bisa
 * membaca tabel itu — termasuk dari server, sehingga endpoint mengembalikan
 * "permission denied for table sick_employees".
 *
 * Service role melewati RLS, jadi endpoint tetap berfungsi. Otorisasi tidak
 * hilang: pemeriksaan login & role tetap dilakukan SEBELUM query (lihat
 * periksaPemanggil), dan `anon` tetap tidak punya akses langsung ke tabel.
 */
const supabaseData = () => integrationAdminClient();

/**
 * The server uses service-role access, so every request is authorized here
 * before any employee health data is queried.
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic'];
const ROLES_TULIS = ['superuser', 'administrator'];

export async function GET(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Sesi login tidak ditemukan' }, { status: 401 });
    }
    if (!ROLES_BACA.includes(caller.role)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
    }
    if (caller.role === 'pic' && !caller.site) {
      return NextResponse.json({ success: false, error: 'Site PIC belum ditetapkan' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const jobsite = searchParams.get('jobsite') || '';
    const bulan = searchParams.get('bulan') || '';
    const tahun = searchParams.get('tahun') || '';
    const periodStart = searchParams.get('period_start') || '';
    const periodEnd = searchParams.get('period_end') || '';

    let query = supabaseData()
      .from('sick_employees')
      .select('*')
      .order('jobsite', { ascending: true })
      .order('nama', { ascending: true })
      .range(0, 9999);

    if (caller.role === 'pic') {
      if (jobsite && jobsite !== 'All Site' && jobsite.toLowerCase() !== caller.site!.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'PIC hanya dapat melihat site sendiri' }, { status: 403 });
      }
      query = query.eq('jobsite', caller.site);
    } else if (jobsite && jobsite !== 'All Site') {
      query = query.eq('jobsite', jobsite);
    }
    if (bulan) query = query.eq('bulan', parseInt(bulan));
    if (tahun) query = query.eq('tahun', parseInt(tahun));
    // Note: period_start/period_end filter dihapus karena sebagian besar rows
    // punya tgl_mulai_a = NULL. Filtering pakai bulan+tahun saja (sudah di-set
    // saat import berdasarkan aturan periode 21st prev month → 20th current month).
    // if (periodStart) query = query.gte('tgl_mulai_a', periodStart);
    // if (periodEnd) query = query.lte('tgl_mulai_a', periodEnd);

    const { data, error } = await query;
    if (error) {
      console.error('[Sick employees] Failed to read report:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal mengambil data karyawan sakit.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data || [] });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal mengambil data karyawan sakit.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getServerCaller(request);
    if (!caller) {
      return NextResponse.json({ success: false, error: 'Sesi login tidak ditemukan' }, { status: 401 });
    }
    if (!ROLES_TULIS.includes(caller.role)) {
      return NextResponse.json({ success: false, error: 'Hanya administrator yang dapat menambah data' }, { status: 403 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Body permintaan tidak valid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const readText = (key: string, maxLength: number): string | null => {
      const value = input[key];
      if (value == null || value === '') return null;
      if (typeof value !== 'string' || value.length > maxLength) throw new Error(`Field ${key} tidak valid`);
      return value.trim();
    };
    const readInteger = (key: string, min: number, max: number, fallback: number | null): number | null => {
      const value = input[key];
      if (value == null || value === '') return fallback;
      const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Field ${key} tidak valid`);
      return parsed;
    };

    let nik: string | null;
    let nama: string | null;
    let jobsite: string | null;
    let jabatan: string | null;
    let bulan: number | null;
    let tahun: number | null;
    let hariA: number | null;
    let hariB: number | null;
    let hariC: number | null;
    let jumlahSpell: number | null;
    let dates: Record<string, string | null>;
    let diagnoses: Record<string, string | null>;
    try {
      nik = readText('nik', 32);
      nama = readText('nama', 200);
      jobsite = readText('jobsite', 200);
      jabatan = readText('jabatan', 200);
      bulan = readInteger('bulan', 1, 12, null);
      tahun = readInteger('tahun', 2000, 2100, null);
      hariA = readInteger('hari_a', 0, 366, 0);
      hariB = readInteger('hari_b', 0, 366, 0);
      hariC = readInteger('hari_c', 0, 366, 0);
      jumlahSpell = readInteger('jumlah_spell', 1, 100, null) ?? readInteger('spell', 1, 100, 1);
      dates = {
        tgl_mulai_a: readText('tgl_mulai_a', 10), tgl_selesai_a: readText('tgl_selesai_a', 10),
        tgl_mulai_b: readText('tgl_mulai_b', 10), tgl_selesai_b: readText('tgl_selesai_b', 10),
        tgl_mulai_c: readText('tgl_mulai_c', 10), tgl_selesai_c: readText('tgl_selesai_c', 10),
      };
      diagnoses = {
        diag_a: readText('diag_a', 500), diag_b: readText('diag_b', 500), diag_c: readText('diag_c', 500),
      };
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Input tidak valid' }, { status: 400 });
    }

    if (!nama || !jobsite) return NextResponse.json({ success: false, error: 'Nama dan Jobsite wajib diisi' }, { status: 400 });
    const dateKeys = Object.keys(dates);
    for (const key of dateKeys) {
      const value = dates[key];
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value)
        || Number.isNaN(new Date(`${value}T00:00:00`).getTime()))) {
        return NextResponse.json({ success: false, error: `Tanggal ${key} tidak valid.` }, { status: 400 });
      }
    }

    const row = {
      nik, nama, jobsite, jabatan, bulan, tahun,
      ...dates, ...diagnoses, hari_a: hariA, hari_b: hariB, hari_c: hariC,
      jumlah_spell: jumlahSpell,
      is_pak: input.is_pak === 'Ya' || input.is_pak === true,
    };

    const client = supabaseData();
    const { data, error } = await client.from('sick_employees').insert(row).select().single();
    if (error) {
      console.error('[Sick employees] Failed to save report:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal menyimpan data karyawan sakit.' }, { status: 500 });
    }

    const reportId = String(data.id);
    const nikHash = nik ? hashField(nik) : null;
    const periods = [
      { start: dates.tgl_mulai_a, end: dates.tgl_selesai_a, diagnosis: diagnoses.diag_a },
      { start: dates.tgl_mulai_b, end: dates.tgl_selesai_b, diagnosis: diagnoses.diag_b },
      { start: dates.tgl_mulai_c, end: dates.tgl_selesai_c, diagnosis: diagnoses.diag_c },
    ].filter((period): period is { start: string; end: string | null; diagnosis: string | null } => Boolean(period.start));

    const linkedEpisodeIds: string[] = [];
    const createdEpisodeIds: string[] = [];
    const linkedExistingEpisodeIds: string[] = [];
    const rollbackReport = async () => {
      const failures: string[] = [];
      if (linkedExistingEpisodeIds.length) {
        const { error: unlinkError } = await client.from('sakit_episode').update({ sick_employee_id: null })
          .in('id', linkedExistingEpisodeIds).eq('sick_employee_id', reportId);
        if (unlinkError) failures.push(`unlink:${unlinkError.code}`);
      }
      if (createdEpisodeIds.length) {
        const { error: episodeDeleteError } = await client.from('sakit_episode').delete().in('id', createdEpisodeIds);
        if (episodeDeleteError) failures.push(`episodes:${episodeDeleteError.code}`);
      }
      const { error: reportDeleteError } = await client.from('sick_employees').delete().eq('id', reportId);
      if (reportDeleteError) failures.push(`report:${reportDeleteError.code}`);
      if (failures.length) console.error('[Sick employees] Report rollback was incomplete:', failures.join(','));
      return failures.length === 0;
    };
    if (nikHash && nik && periods.length) {
      for (const period of periods) {
        const { data: existing, error: lookupError } = await client
          .from('sakit_episode')
          .select('id,sick_employee_id')
          .eq('nik_hash', nikHash)
          .eq('tanggal_mulai_sakit', period.start)
          .limit(1)
          .maybeSingle();
        if (lookupError) {
          const rolledBack = await rollbackReport();
          console.error('[Sick employees] Failed to find a matching monitoring episode:', lookupError.code);
          return NextResponse.json({
            success: false,
            error: rolledBack
              ? 'Gagal menghubungkan laporan dengan pemantauan karyawan sakit.'
              : 'Gagal menghubungkan laporan. Sebagian perubahan belum dapat dibatalkan; periksa kembali data laporan.',
          }, { status: 500 });
        }

        if (existing) {
          if (!existing.sick_employee_id) {
            const { error: linkError } = await client
              .from('sakit_episode')
              .update({ sick_employee_id: reportId })
              .eq('id', String(existing.id))
              .is('sick_employee_id', null);
            if (linkError) {
              const rolledBack = await rollbackReport();
              console.error('[Sick employees] Failed to link an existing monitoring episode:', linkError.code);
              return NextResponse.json({
                success: false,
                error: rolledBack
                  ? 'Gagal menghubungkan laporan dengan pemantauan karyawan sakit.'
                  : 'Gagal menghubungkan laporan. Sebagian perubahan belum dapat dibatalkan; periksa kembali data laporan.',
              }, { status: 500 });
            }
            linkedExistingEpisodeIds.push(String(existing.id));
            linkedEpisodeIds.push(String(existing.id));
          } else if (String(existing.sick_employee_id) === reportId) {
            linkedEpisodeIds.push(String(existing.id));
          }
          continue;
        }

        const finished = period.end ? period.end < new Date().toISOString().slice(0, 10) : false;
        const { data: episode, error: episodeError } = await client
          .from('sakit_episode')
          .insert({
            nik_hash: nikHash,
            nik_enc: encrypt(nik),
            nama_enc: encrypt(nama),
            site: jobsite,
            jabatan,
            tanggal_mulai_sakit: period.start,
            tanggal_selesai_sakit: period.end,
            diagnosis_awal: period.diagnosis,
            sumber_laporan: 'LAPORAN_SITE',
            jenis_sakit: 'AKUT',
            status: finished ? 'SELESAI' : 'AKTIF',
            sick_employee_id: reportId,
            catatan: `Dibuat dari rekap sakit site ${bulan}/${tahun}.`,
            dibuat_oleh: caller.userId,
          })
          .select('id')
          .single();
        if (episodeError || !episode) {
          const rolledBack = await rollbackReport();
          console.error('[Sick employees] Failed to create a monitoring episode:', episodeError?.code ?? 'missing episode');
          return NextResponse.json({
            success: false,
            error: rolledBack && /sick_employee_id|sumber_laporan|does not exist|PGRST204|42703/i.test(episodeError?.message ?? '')
              ? 'Perubahan database untuk penghubung laporan sakit belum diterapkan.'
              : rolledBack
                ? 'Gagal membuat episode pemantauan dari laporan sakit.'
                : 'Gagal membuat episode pemantauan. Sebagian perubahan belum dapat dibatalkan; periksa kembali data laporan.',
          }, { status: 500 });
        }
        createdEpisodeIds.push(String(episode.id));
        linkedEpisodeIds.push(String(episode.id));
      }
    }

    return NextResponse.json({ success: true, data, linkedEpisodes: linkedEpisodeIds.length });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menyimpan data karyawan sakit.' }, { status: 500 });
  }
}
