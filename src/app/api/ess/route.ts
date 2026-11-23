import { NextRequest, NextResponse } from 'next/server';

import { ESS_ITEMS, ESS_OPTIONS } from '@/lib/questionnaire-items';
import { scoreEss } from '@/lib/questionnaire-scores';
import { kesimpulanEss } from '@/lib/questionnaire-conclusion';
import {
  adminClient,
  canWriteQuestionnaires,
  denyUnlessQuestionnaireAccess,
  denyUnlessOwnEmployee,
  findEmployeeIdentity,
  findEmployeeIdentityForCaller,
  getCaller,
  pesanGalat,
  questionnaireIdentityColumns,
  readNumber,
  refreshQuestionnaireSnapshot,
  upsertQuestionnaire,
} from '@/lib/questionnaire-store';

/**
 * GET /api/ess?query=<nama|nik>
 *   Tanpa query → mengembalikan definisi item + skala jawaban.
 *   Dengan query  → mengembalikan identitas dan riwayat milik pemanggil.
 *
 * POST /api/ess
 *   Menyimpan hasil ESS. Memakai aturan satu baris per karyawan per tanggal,
 *   jadi pengukuran ulang pada tanggal yang sama menimpa baris lama.
 *
 * Pengisian wajib memakai sesi yang valid. Akun Employee hanya boleh membuka
 * dan menyimpan kuesioner untuk NIK Karyawannya sendiri.
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  const denied = denyUnlessQuestionnaireAccess(caller);
  if (denied) return denied;

  const query = new URL(req.url).searchParams.get('query')?.trim() ?? '';

  if (!query) {
    return NextResponse.json({
      instrument: {
        key: 'ess',
        title: 'Epworth Sleepiness Scale',
        subtitle: 'Excessive Daytime Sleepiness',
        description:
          'Delapan pertanyaan tentang kantuk di berbagai situasi. Skor 0 sampai 32. '
          + 'Menurut STD-006 Rev001: normal di bawah 11, kantuk berlebihan ringan sampai sedang 11 sampai 15, berat di atas 15.',
        scale: ESS_OPTIONS,
        items: ESS_ITEMS,
      },
    });
  }

  // Setiap pengguna (role apapun) selalu mengisi atas namanya sendiri (sesi login aktif)
  const identity = await findEmployeeIdentityForCaller(caller!);
  if (!identity) {
    return NextResponse.json({ error: 'Data profil karyawan untuk akun Anda tidak ditemukan. Hubungi administrator/HR.' }, { status: 404 });
  }
  const identityDenied = denyUnlessOwnEmployee(caller!, identity);
  if (identityDenied) return identityDenied;

  const client = adminClient();
  if (!canWriteQuestionnaires(caller) && !caller?.employeeNikHash) {
    return NextResponse.json({ identity, history: [], historyAvailable: false });
  }

  // Riwayat lengkap, bukan cuma hasil terakhir. Kuesioner diisi setiap 3 atau
  // 6 bulan, jadi assessor butuh melihat perubahannya dari waktu ke waktu.
  const { data: rows } = await client
    .from('mcu_ess')
    .select('tgl_ess, skor_ess, jumlah_terisi, kategori, interpretasi, catatan')
    .eq('nik_karyawan_hash', identity.nikKaryawanHash)
    .order('tgl_ess', { ascending: false })
    .limit(50);

  // Tandai baris yang dipakai MCU, supaya terlihat skor mana yang mengunci zona.
  const { data: mcus } = await client
    .from('mcu_records')
    .select('tgl_mcu, kuesioner_tgl')
    .eq('nik_karyawan_hash', identity.nikKaryawanHash);
  const lockedDates = new Set((mcus ?? []).map((m) => String(m.kuesioner_tgl ?? '')).filter(Boolean));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEntry = (rows ?? []).find((r) => String(r.tgl_ess ?? '').slice(0, 10) === todayStr);

  return NextResponse.json({
    identity,
    historyAvailable: true,
    serverTime: new Date().toISOString(),
    todayFilled: todayEntry ? {
      skor: todayEntry.skor_ess,
      kategori: String(todayEntry.kategori ?? ''),
      interpretasi: String(todayEntry.interpretasi ?? ''),
    } : null,
    history: (rows ?? []).map((row) => ({
      tanggal: String(row.tgl_ess ?? ''),
      skor: row.skor_ess,
      kategori: String(row.kategori ?? ''),
      interpretasi: String(row.interpretasi ?? ''),
      jumlah_terisi: row.jumlah_terisi,
      catatan: row.catatan ?? null,
      dipakaiMCU: lockedDates.has(String(row.tgl_ess ?? '')),
    })),
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  const denied = denyUnlessQuestionnaireAccess(caller);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body permintaan tidak valid' }, { status: 400 });
  }

  const tglEss = String(body.tglEss ?? '').trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tglEss)) {
    return NextResponse.json({ error: 'Tanggal ESS wajib diisi dengan format YYYY-MM-DD' }, { status: 400 });
  }

  // Setiap pengguna (role apapun) selalu mengisi atas namanya sendiri (sesi login aktif)
  const identity = await findEmployeeIdentityForCaller(caller!);
  if (!identity) {
    return NextResponse.json({ error: 'Data profil karyawan untuk akun Anda tidak ditemukan. Hubungi administrator/HR.' }, { status: 404 });
  }
  const identityDenied = denyUnlessOwnEmployee(caller!, identity);
  if (identityDenied) return identityDenied;

  // Skala ESS 0-4. Nilai di luar rentang ditolak, bukan dibulatkan diam-diam.
  const answers: Record<string, string | number | null> = {};
  const invalid: string[] = [];
  for (const item of ESS_ITEMS) {
    const raw = body[item.id];
    if (raw === undefined || raw === null || raw === '') {
      answers[item.id] = null;
      continue;
    }
    const value = readNumber(raw, 0, 4);
    if (value === null) {
      invalid.push(item.id);
      answers[item.id] = null;
    } else {
      answers[item.id] = value;
    }
  }
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Jawaban tidak valid pada: ${invalid.join(', ')}. Skala ESS hanya 0 sampai 4.` },
      { status: 400 },
    );
  }

  const result = scoreEss(answers);
  if (result.answered === 0) {
    return NextResponse.json({ error: 'Minimal satu item ESS harus diisi.' }, { status: 400 });
  }

  const sesiSkrining = String(body.sesiSkrining ?? '').trim();
  let catatanFinal = String(body.catatan ?? '').trim() || null;
  if (sesiSkrining) {
    catatanFinal = catatanFinal ? `[${sesiSkrining}] ${catatanFinal}` : `[${sesiSkrining}]`;
  }

  const row: Record<string, unknown> = {
    ...questionnaireIdentityColumns(identity),
    tgl_ess: tglEss,
    lokasi_ess: String(body.lokasiEss ?? '').trim() || null,
    petugas: String(body.petugas ?? '').trim() || null,
    skor_ess: result.score,
    jumlah_terisi: result.answered,
    kategori: result.category,
    interpretasi: result.label,
    catatan: catatanFinal,
  };
  for (const item of ESS_ITEMS) {
    row[item.id.replace(/([a-z])(\d+)/, '_$2')] = answers[item.id];
  }

  try {
    const saved = await upsertQuestionnaire('mcu_ess', identity.nikKaryawanHash, tglEss, row);

    // Skor ESS ikut menentukan zona. Segarkan salinan pada MCU yang
    // diperiksa pada atau setelah tanggal ESS ini. MCU yang lebih lama
    // mengunci nilai kuesioner yang berlaku saat pemeriksaannya, jadi
    // mengisi ESS hari ini tidak menimpa riwayat MCU tahun lalu.
    const sync = await refreshQuestionnaireSnapshot(identity.nikKaryawanHash, tglEss);

    return NextResponse.json({
      success: true,
      action: saved.action,
      result,
      kesimpulan: kesimpulanEss(result),
      zonaMCU: sync.zonasi,
      mcuUpdated: sync.updated,
      // `zonasi` dipertahankan sebagai alias agar klien lama tidak ikut rusak.
      zonasi: sync.zonasi,
    });
  } catch (error) {
    return NextResponse.json(
      { error: pesanGalat(error, 'Penyimpanan hasil ESS') },
      { status: 500 },
    );
  }
}