import { NextRequest, NextResponse } from 'next/server';

import { DASS21_ITEMS, DASS21_SECTIONS, SDS_ITEMS, SRQ20_ITEMS } from '@/lib/questionnaire-items';
import { isDassActionable, scoreDass21, scoreSrq20, scoreSds } from '@/lib/questionnaire-scores';
import { kesimpulanSrqDass } from '@/lib/questionnaire-conclusion';
import {
  adminClient,
  canWriteQuestionnaires,
  denyUnlessQuestionnaireAccess,
  denyUnlessOwnEmployee,
  findEmployeeIdentity,
  getCaller,
  pesanGalat,
  questionnaireIdentityColumns,
  readNumber,
  refreshQuestionnaireSnapshot,
  upsertQuestionnaire,
} from '@/lib/questionnaire-store';

const TABLE = 'mcu_mental_health';
const DATE_COLUMN = 'tgl_pemeriksaan';

/**
 * GET /api/mental-health?query=<nama|nik>
 *   Tanpa query  → definisi item ketiga instrumen.
 *   Dengan query → identitas dan riwayat milik pemanggil.
 *
 * POST /api/mental-health
 *   Menyimpan SRQ-20, DASS-21, dan Zung SDS sekaligus dalam satu baris.
 *   Pengukuran ulang pada tanggal yang sama menimpa baris lama.
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
      instruments: {
        srq20: {
          key: 'srq20',
          title: 'SRQ-20',
          subtitle: 'Self-Reporting Questionnaire-20 (WHO)',
          description:
            'Instrumen skrining gangguan mental emosional yang tervalidasi di Indonesia oleh Kemenkes RI. '
            + 'Dua puluh pertanyaan jawaban Ya atau Tidak. Skor 6 atau lebih berarti perlu tindak lanjut.',
          items: SRQ20_ITEMS,
        },
        dass21: {
          key: 'dass21',
          title: 'DASS-21',
          subtitle: 'Depression Anxiety Stress Scales-21',
          description:
            'Dua puluh satu pernyataan yang mengukur tiga hal secara terpisah: depresi, ansietas, dan stres. '
            + 'Setiap jawaban dari 0 sampai 3.',
          items: DASS21_ITEMS,
          sections: DASS21_SECTIONS,
        },
        sds: {
          key: 'sds',
          title: 'Zung SDS',
          subtitle: 'Zung Self-Rating Depression Scale',
          description:
            'Dua puluh pernyataan untuk mengukur tingkat depresi. Setiap jawaban dari 1 sampai 4, '
            + 'dijumlahkan menjadi indeks 20 sampai 80. Normal sampai 49, mild 50 sampai 59, moderate 60 sampai 69, severe 70 ke atas.',
          items: SDS_ITEMS,
        },
      },
    });
  }

  const identity = await findEmployeeIdentity(query);
  if (!identity) {
    return NextResponse.json({ error: 'Karyawan tidak ditemukan. Gunakan NIK KTP, NIK Karyawan, atau nama.' }, { status: 404 });
  }
  const identityDenied = denyUnlessOwnEmployee(caller!, identity);
  if (identityDenied) return identityDenied;

  const client = adminClient();
  if (!canWriteQuestionnaires(caller) && !caller?.employeeNikHash) {
    return NextResponse.json({ identity, history: [], historyAvailable: false });
  }

  // Riwayat lengkap per tanggal. Kuesioner diisi lebih sering daripada MCU,
  // jadi hasil yang lama tidak boleh hilang ketika yang baru masuk.
  const { data: rows } = await client
    .from(TABLE)
    .select('tgl_pemeriksaan, skor_srq20, dass_depresi, dass_ansietas, dass_stres, indeks_sds, ringkasan_hasil, perlu_rujukan')
    .eq('nik_karyawan_hash', identity.nikKaryawanHash)
    .order(DATE_COLUMN, { ascending: false })
    .limit(50);

  const { data: mcus } = await client
    .from('mcu_records')
    .select('kuesioner_tgl')
    .eq('nik_karyawan_hash', identity.nikKaryawanHash);
  const lockedDates = new Set((mcus ?? []).map((m) => String(m.kuesioner_tgl ?? '')).filter(Boolean));

  return NextResponse.json({
    identity,
    historyAvailable: true,
    history: (rows ?? []).map((row) => ({
      tanggal: String(row.tgl_pemeriksaan ?? ''),
      skor_srq20: row.skor_srq20 ?? null,
      dass_depresi: row.dass_depresi ?? null,
      dass_ansietas: row.dass_ansietas ?? null,
      dass_stres: row.dass_stres ?? null,
      indeks_sds: row.indeks_sds ?? null,
      ringkasan: String(row.ringkasan_hasil ?? ''),
      perlu_rujukan: row.perlu_rujukan ?? false,
      dipakaiMCU: lockedDates.has(String(row.tgl_pemeriksaan ?? '')),
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

  const query = String(body.query ?? body.nikKaryawan ?? body.nationalId ?? '').trim();
  const tgl = String(body.tglPemeriksaan ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'NIK KTP, NIK Karyawan, atau nama wajib diisi' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
    return NextResponse.json({ error: 'Tanggal pemeriksaan wajib diisi dengan format YYYY-MM-DD' }, { status: 400 });
  }

  const identity = await findEmployeeIdentity(query);
  if (!identity) {
    return NextResponse.json({ error: 'Karyawan tidak ditemukan. Gunakan NIK KTP, NIK Karyawan, atau nama.' }, { status: 404 });
  }
  const identityDenied = denyUnlessOwnEmployee(caller!, identity);
  if (identityDenied) return identityDenied;

  const row: Record<string, unknown> = {
    ...questionnaireIdentityColumns(identity),
    [DATE_COLUMN]: tgl,
    lokasi_pemeriksaan: String(body.lokasiPemeriksaan ?? '').trim() || null,
    petugas: String(body.petugas ?? '').trim() || null,
    catatan: String(body.catatan ?? '').trim() || null,
  };

  const invalid: string[] = [];

  // ── SRQ-20: boolean, true berarti "Ya" ───────────────────────
  const srqAnswers: Record<string, string | number | null> = {};
  for (const item of SRQ20_ITEMS) {
    const raw = body[item.id];
    if (raw === undefined || raw === null || raw === '') {
      srqAnswers[item.id] = null;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = null;
      continue;
    }
    const text = String(raw).trim().toLowerCase();
    if (text === 'ya' || text === 'yes' || text === 'true' || text === '1') {
      srqAnswers[item.id] = 1;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = true;
    } else if (text === 'tidak' || text === 'no' || text === 'false' || text === '0') {
      srqAnswers[item.id] = 0;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = false;
    } else {
      invalid.push(item.id);
      srqAnswers[item.id] = null;
    }
  }
  const srq = scoreSrq20(srqAnswers);
  row.psy_srq20 = srq.answered > 0;
  if (srq.answered > 0) {
    row.skor_srq20 = srq.score;
  }

  // ── DASS-21: smallint 0-3 ────────────────────────────────────
  const dassAnswers: Record<string, string | number | null> = {};
  for (const item of DASS21_ITEMS) {
    const raw = body[item.id];
    if (raw === undefined || raw === null || raw === '') {
      dassAnswers[item.id] = null;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = null;
      continue;
    }
    const value = readNumber(raw, 0, 3);
    if (value === null) {
      invalid.push(item.id);
      dassAnswers[item.id] = null;
    } else {
      dassAnswers[item.id] = value;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = value;
    }
  }
  const dass = scoreDass21(dassAnswers);
  row.psy_dass21 = dass.answered > 0;
  if (dass.answered > 0) {
    row.dass_depresi = dass.depresi.score;
    row.dass_ansietas = dass.ansietas.score;
    row.dass_stres = dass.stres.score;
    row.dass_tertinggi = dass.highest.domain;
  }

  // ── Zung SDS: smallint 1-4 ───────────────────────────────────
  const sdsAnswers: Record<string, string | number | null> = {};
  for (const item of SDS_ITEMS) {
    const raw = body[item.id];
    if (raw === undefined || raw === null || raw === '') {
      sdsAnswers[item.id] = null;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = null;
      continue;
    }
    const value = readNumber(raw, 1, 4);
    if (value === null) {
      invalid.push(item.id);
      sdsAnswers[item.id] = null;
    } else {
      sdsAnswers[item.id] = value;
      row[item.id.replace(/([a-z])(\d+)/, '_$2')] = value;
    }
  }
  const sds = scoreSds(sdsAnswers);
  row.psy_sds = sds.answered > 0;
  if (sds.answered > 0) {
    row.indeks_sds = sds.rawIndex;
  }

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Jawaban tidak valid pada: ${invalid.join(', ')}. Periksa skala yang dipakai untuk tiap instrumen.` },
      { status: 400 },
    );
  }

  if (srq.answered === 0 && dass.answered === 0 && sds.answered === 0) {
    return NextResponse.json({ error: 'Minimal satu instrumen harus diisi.' }, { status: 400 });
  }

  const parts: string[] = [];
  if (srq.answered > 0) parts.push(`SRQ-20 ${srq.score} (${srq.label})`);
  if (dass.answered > 0) {
    parts.push(`DASS-21 depresi ${dass.depresi.score}, ansietas ${dass.ansietas.score}, stres ${dass.stres.score}`);
  }
  if (sds.answered > 0) parts.push(`SDS ${sds.rawIndex} (${sds.label})`);
  row.ringkasan_hasil = parts.join('; ');
  const ringkasan = row.ringkasan_hasil as string;

  // Perlu rujukan bila ada instrumen yang masuk kategori "berat", memakai
  // ambang per subskala dan ambang SDS 60. Bandingkan dengan DASS_BANDS di
  // src/lib/questionnaire-scores.ts bila salah satu angka di sini diubah.
  const perluRujukan =
    srq.category === 'perlu-tindak-lanjut'
    || isDassActionable('depresi', dass.depresi.score)
    || isDassActionable('ansietas', dass.ansietas.score)
    || isDassActionable('stres', dass.stres.score)
    || (sds.answered === SDS_ITEMS.length && sds.rawIndex >= 60);
  row.perlu_rujukan = perluRujukan;

  try {
    const saved = await upsertQuestionnaire(TABLE, identity.nikKaryawanHash, tgl, row);

    // Sama seperti ESS: hanya MCU yang diperiksa pada atau setelah tanggal ini
    // yang salinannya disegarkan, lalu zonasi MCU itu dihitung ulang.
    const sync = await refreshQuestionnaireSnapshot(identity.nikKaryawanHash, tgl);

    return NextResponse.json({
      success: true,
      action: saved.action,
      srq20: srq,
      dass21: dass,
      sds,
      // Dikembalikan juga di luar row karena popup hasil membacanya. Sebelumnya
      // ringkasan hanya disimpan ke kolom ringkasan_hasil, sehingga panel
      // "Hasil Tersimpan" selalu menampilkan tanda hubung.
      ringkasan,
      perluRujukan,
      kesimpulan: kesimpulanSrqDass(srq, dass, sds, perluRujukan),
      zonaMCU: sync.zonasi,
      mcuUpdated: sync.updated,
      // `zonasi` dipertahankan sebagai alias agar klien lama tidak ikut rusak.
      zonasi: sync.zonasi,
    });
  } catch (error) {
    return NextResponse.json(
      { error: pesanGalat(error, 'Penyimpanan hasil kesehatan mental') },
      { status: 500 },
    );
  }
}
