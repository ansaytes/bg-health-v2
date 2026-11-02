import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { decryptMCURecord, encrypt, hashField } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { tentukanFieldTindakLanjut, type KelompokField } from '@/lib/followup-fields';
import { formatSuratKontrolAbnormal } from '@/lib/surat-kontrol-format';
import { selectFieldsForTable } from '@/lib/mcu-table-select';
import { cariMcuByNik } from '@/lib/mcu-nik-resolver';
import { barisKeDraft } from '@/lib/prokawan-evaluasi-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * /api/followups — wadah tunggal tindak lanjut (follow ups_prokawan)
 *
 * LATAR BELAKANG
 * Dulu ada dua tempat: tab "Follow Up MCU" (mcu_followups) dan jadwal ProKawan
 * (kunjungan_kontrol). Akibatnya zona bisa dihitung dari dua sumber berbeda dan
 * hasil kontrol ProKawan tidak terlihat di riwayat follow up. Sekarang satu
 * tabel: followups_prokawan.
 *
 * ALUR DATA
 *   mcu_records (baseline, TIDAK diubah)
 *        ↓
 *   baseline ⊕ nilai follow up terbaru = dataset efektif
 *        ↓
 *   applyMCUCalculations() → zona, trigger, pengendalian, frekuensi
 *        ↓
 *   ditulis ke mcu_records (kolom turunan) + ke baris follow up
 *
 * Baseline MCU tetap utuh — nilai follow up hanya MENIMPA saat perhitungan,
 * sehingga riwayat "dulu 165/102, sekarang 131/79" tetap bisa ditelusuri.
 */
const ROLES_BACA = ['superuser', 'administrator', 'pic'];
const ROLES_TULIS = ['superuser', 'administrator', 'pic'];

function namaTerbaca(v: unknown): string {
  const s = String(v ?? '').trim();
  return s || '—';
}

/**
 * GET /api/followups?nik=<NIK>
 *
 * Mengembalikan:
 *   karyawan   — identitas ringkas
 *   baseline   — data MCU terakhir (untuk pembanding)
 *   kelompok   — field tindak lanjut dikelompokkan 3 sumber
 *   riwayat    — semua baris follow up, terbaru dulu
 *   zona       — zona baseline vs zona efektif (setelah overlay follow up)
 */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_BACA.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const nik = req.nextUrl.searchParams.get('nik')?.trim();
  if (!nik) return NextResponse.json({ error: 'Parameter nik wajib diisi' }, { status: 400 });

  const nikHash = hashField(nik);
  if (!nikHash) return NextResponse.json({ error: 'NIK tidak valid' }, { status: 400 });

  const client = adminClient();

  // ── 1. Record MCU terakhir = baseline ─────────────────────────────
  // Memakai resolver: `nik_karyawan_hash` pada sebagian record dihitung dari
  // ciphertext, bukan NIK asli, sehingga `.eq('nik_karyawan_hash', hash)`
  // tidak menemukan apa pun. Lihat lib/mcu-nik-resolver.ts.
  const resolusi = await cariMcuByNik(client, nik, selectFieldsForTable());
  const mcu = resolusi.record ?? undefined;
  if (!mcu) {
    return NextResponse.json({
      error: 'Belum ada data MCU untuk karyawan ini. Tindak lanjut memerlukan baseline MCU.',
      butuhMcu: true,
    }, { status: 404 });
  }
  if (caller.role === 'pic' && (!caller.site
    || String(mcu.site ?? '').trim().toLowerCase() !== caller.site.trim().toLowerCase())) {
    return NextResponse.json({ error: 'PIC hanya dapat melihat tindak lanjut di site sendiri.' }, { status: 403 });
  }

  // decryptMCURecord hanya mendekripsi field identitas. Kolom DB masih
  // snake_case (`td_s`, `visus_jauh`) sedangkan engine membaca camelCase
  // (`tdS`, `visusJauh`). Tanpa konversi ini, field seperti tekanan darah dan
  // visus HILANG dari form — itulah sebabnya peserta Merah bisa tampil 0
  // trigger padahal trigger_zonannya jelas berisi "Hypertension Grade II".
  const baseline = barisKeDraft(decryptMCURecord(mcu) as Record<string, unknown>);

  // ── 2. Riwayat tindak lanjut ──────────────────────────────────────
  const { data: riwayat, error: riwayatError } = await client
    .from('followups_prokawan')
    .select('*')
    .eq('nik_hash', nikHash)
    .order('jadwal_tanggal', { ascending: false });

  if (riwayatError && !/does not exist|PGRST205|42P01/i.test(riwayatError.message)) {
    console.error('[Follow-up] Failed to read follow-up history:', riwayatError.code);
    return NextResponse.json({ error: 'Gagal membaca riwayat tindak lanjut.' }, { status: 500 });
  }

  const rows = (riwayat ?? []) as Record<string, unknown>[];

  // Nilai terbaru per parameter = kandidat overlay.
  const nilaiTerbaru: Record<string, string | number | null> = {};
  const selesai = rows
    .filter((r) => r.selesai === true && r.nilai)
    .sort((a, b) => String(a.aktual_tanggal ?? '').localeCompare(String(b.aktual_tanggal ?? '')));
  for (const r of selesai) {
    Object.assign(nilaiTerbaru, (r.nilai ?? {}) as Record<string, string | number>);
  }

  // ── 3. Field tindak lanjut — tiga sumber ──────────────────────────
  const kelompok: KelompokField[] = tentukanFieldTindakLanjut(
    baseline,
    String(mcu.trigger_zona ?? ''),
    nilaiTerbaru,
  );

  // ── 4. Zona efektif = baseline ditimpa nilai terbaru ──────────────
  const efektif: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(baseline)) {
    if (v !== null && v !== undefined && String(v) !== '') efektif[k] = v as string | number;
  }
  for (const [k, v] of Object.entries(nilaiTerbaru)) {
    if (v !== null && v !== undefined && String(v) !== '') efektif[k] = v;
  }
  // IMT dihitung ulang dari BB/TB terbaru bila tersedia.
  const bb = Number(String(efektif.bb ?? '').replace(',', '.'));
  const tb = Number(String(efektif.tb ?? '').replace(',', '.'));
  if (bb > 0 && tb > 0) efektif.bmi = Number((bb / ((tb / 100) ** 2)).toFixed(1));

  let zonaEfektif: Record<string, unknown> | null = null;
  try {
    const hitung = applyMCUCalculations(efektif as never);
    zonaEfektif = {
      zona: hitung.zonasi,
      trigger: hitung.triggerZona,
      pengendalian: hitung.pengendalian,
      frekuensi: hitung.frekuensiEvaluasi,
    };
  } catch {
    zonaEfektif = null;
  }

  // ── 5. Teks surat kontrol dari field abnormal ─────────────────────
  const fieldAbnormal = kelompok.flatMap((k) => k.fields.map((f) => f.id));
  const nilaiUntukSurat: Record<string, string | number | null> = {};
  for (const id of fieldAbnormal) {
    nilaiUntukSurat[id] = (nilaiTerbaru[id] ?? baseline[id] ?? null) as string | number | null;
    if (id === 'tdS') nilaiUntukSurat.tdD = (nilaiTerbaru.tdD ?? baseline.tdD ?? null) as string | number | null;
  }
  const surat = formatSuratKontrolAbnormal(nilaiUntukSurat, fieldAbnormal);

  return NextResponse.json({
    success: true,
    karyawan: {
      nik,
      nama: namaTerbaca(baseline.nama),
      jabatan: baseline.jabatan ?? null,
      site: baseline.site ?? null,
      jenisKelamin: baseline.jenisKelamin ?? null,
      usia: baseline.usia ?? null,
      tglMcu: mcu.tgl_mcu ?? null,
    },
    baseline: {
      zona: mcu.zonasi ?? null,
      triggerZona: mcu.trigger_zona ?? null,
      mcuRecordId: mcu.id,
    },
    zonaEfektif,
    kelompok,
    totalField: kelompok.reduce((s, k) => s + k.fields.length, 0),
    riwayat: rows,
    ringkasanSurat: surat.teks,
    tabelSiap: !riwayatError,
  });
}

/**
 * POST /api/followups — catat hasil tindak lanjut.
 *
 * Body:
 *   { nik, id?, jadwal_tanggal, aktual_tanggal, nilai: {...},
 *     evidence_url?, catatan?, jenis?: 'mcu'|'prokawan', terapkanZona?: boolean }
 *
 * Setelah tersimpan:
 *   1. ringkasan_teks dibentuk dari nilai (untuk surat kontrol)
 *   2. dataset efektif dihitung → zona/trigger/pengendalian baru
 *   3. bila terapkanZona, kolom turunan di mcu_records diperbarui
 *   4. baseline MCU TIDAK diubah
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Hanya QSHE Medic / PIC yang dapat mencatat tindak lanjut' }, { status: 403 });
  }

  const parsedBody: unknown = await req.json().catch(() => null);
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: 'Body permintaan tidak valid.' }, { status: 400 });
  }
  const body = parsedBody as Record<string, unknown>;
  const nik = String(body.nik ?? '').trim();
  const aktual = String(body.aktual_tanggal ?? '').slice(0, 10);
  if (!nik) return NextResponse.json({ error: 'NIK wajib diisi' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aktual) || Number.isNaN(Date.parse(`${aktual}T00:00:00Z`))) {
    return NextResponse.json({ error: 'Tanggal aktual tindak lanjut wajib diisi dengan format YYYY-MM-DD.' }, { status: 400 });
  }

  if (!body.nilai || typeof body.nilai !== 'object' || Array.isArray(body.nilai)) {
    return NextResponse.json({ error: 'Hasil tindak lanjut tidak valid.' }, { status: 400 });
  }
  const nilai = body.nilai as Record<string, unknown>;
  if (!Object.keys(nilai).length) {
    return NextResponse.json({ error: 'Isi minimal satu hasil tindak lanjut' }, { status: 400 });
  }
  if (Object.keys(nilai).length > 40 || Object.values(nilai).some((value) =>
    (typeof value !== 'string' && typeof value !== 'number')
    || (typeof value === 'string' && value.length > 500)
    || (typeof value === 'number' && !Number.isFinite(value)))) {
    return NextResponse.json({ error: 'Nilai tindak lanjut tidak valid.' }, { status: 400 });
  }

  const nikHash = hashField(nik);
  if (!nikHash) return NextResponse.json({ error: 'NIK tidak valid' }, { status: 400 });

  const client = adminClient();

  // Baseline MCU — sumber hitungan sekaligus untuk kolom mcu_record_id.
  const { data: mcuRows } = await client
    .from('mcu_records')
    .select('id,trigger_zona,zonasi,site,nama,jabatan,department')
    .eq('nik_karyawan_hash', nikHash)
    .order('tgl_mcu', { ascending: false, nullsFirst: false })
    .limit(1);
  const mcu = mcuRows?.[0] as unknown as Record<string, unknown> | undefined;
  if (!mcu) return NextResponse.json({ error: 'Data MCU karyawan tidak ditemukan.' }, { status: 404 });
  if (caller.role === 'pic' && (!caller.site
    || String(mcu.site ?? '').trim().toLowerCase() !== caller.site.trim().toLowerCase())) {
    return NextResponse.json({ error: 'PIC hanya dapat mencatat tindak lanjut di site sendiri.' }, { status: 403 });
  }

  const { buildDatasetEfektifDanZona } = await import('@/lib/followup-apply');
  const baselineResult = await buildDatasetEfektifDanZona({ client, nikHash, nilaiBaru: {} });
  const allowedFields = new Set(tentukanFieldTindakLanjut(
    baselineResult.baseline,
    String(mcu.trigger_zona ?? ''),
  ).flatMap((group) => group.fields.map((field) => field.id)));
  if (Object.keys(nilai).some((field) => !allowedFields.has(field))) {
    return NextResponse.json({ error: 'Hasil memuat parameter yang tidak dapat ditindaklanjuti.' }, { status: 400 });
  }
  const typedNilai = nilai as Record<string, string | number>;

  // Nomor urut untuk riwayat kronologis.
  const { count } = await client
    .from('followups_prokawan')
    .select('id', { count: 'exact', head: true })
    .eq('nik_hash', nikHash)
    .eq('selesai', true);

  // Teks surat dari field abnormal + nilai baru.
  const hasil = await buildDatasetEfektifDanZona({
    client, nikHash, nilaiBaru: typedNilai,
  });

  const evidenceUrl = body.evidence_url ? String(body.evidence_url).trim() : '';
  if (evidenceUrl) {
    try {
      if (evidenceUrl.length > 2000 || new URL(evidenceUrl).protocol !== 'https:') throw new Error();
    } catch {
      return NextResponse.json({ error: 'URL bukti harus menggunakan HTTPS.' }, { status: 400 });
    }
  }
  const jadwal = String(body.jadwal_tanggal ?? aktual).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jadwal) || Number.isNaN(Date.parse(`${jadwal}T00:00:00Z`))) {
    return NextResponse.json({ error: 'Tanggal jadwal tindak lanjut tidak valid.' }, { status: 400 });
  }

  const payload = {
    nik_hash: nikHash,
    nik_enc: encrypt(nik),
    nama_enc: baselineResult.baseline.nama ? encrypt(String(baselineResult.baseline.nama)) : null,
    site: mcu.site ?? null,
    department: mcu.department ?? null,
    jabatan: mcu.jabatan ?? null,
    zona_risiko: hasil.zonaSebelum,
    jadwal_tanggal: jadwal,
    aktual_tanggal: aktual,
    evidence_url: evidenceUrl || null,
    catatan: typeof body.catatan === 'string' ? body.catatan.slice(0, 2000) : null,
    hasil: hasil.arah === 'membaik' ? 'MEMBAIK' : hasil.arah === 'memburuk' ? 'MEMBURUK' : 'STABIL',
    nilai: typedNilai,
    baseline: hasil.baseline,
    zona_sebelum: hasil.zonaSebelum,
    zona_sesudah: hasil.zonaBaru,
    arah: hasil.arah,
    evaluasi: hasil.evaluasi,
    dievaluasi_pada: new Date().toISOString(),
    dievaluasi_oleh: caller.userId,
    selesai: true,
    jenis: body.jenis === 'mcu' ? 'mcu' : 'prokawan',
    mcu_record_id: mcu?.id ?? null,
    kunjungan_ke: (count ?? 0) + 1,
    ringkasan_teks: hasil.ringkasanSurat,
    dicatat_oleh: caller.userId,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (body.id) {
    if (typeof body.id !== 'string' || body.id.length > 100) {
      return NextResponse.json({ error: 'ID tindak lanjut tidak valid.' }, { status: 400 });
    }
    const { data: ownedRow, error: ownershipError } = await client
      .from('followups_prokawan')
      .select('id')
      .eq('id', body.id)
      .eq('nik_hash', nikHash)
      .maybeSingle();
    if (ownershipError) return NextResponse.json({ error: 'Gagal memeriksa tindak lanjut.' }, { status: 500 });
    if (!ownedRow) return NextResponse.json({ error: 'Tindak lanjut tidak ditemukan.' }, { status: 404 });
    ({ error } = await client.from('followups_prokawan').update(payload).eq('id', body.id).eq('nik_hash', nikHash));
  } else {
    ({ error } = await client.from('followups_prokawan').insert({ ...payload, created_by: caller.userId }));
  }

  if (error) {
    if (/does not exist|PGRST205|42P01/i.test(error.message)) {
      return NextResponse.json({
        error: 'Tabel followups_prokawan belum ada. Jalankan migration 20261029_followups_prokawan.sql.',
      }, { status: 500 });
    }
    console.error('[Follow-up] Failed to save follow-up:', error.code);
    return NextResponse.json({ error: 'Gagal menyimpan tindak lanjut.' }, { status: 500 });
  }

  // Terapkan zona baru ke kolom turunan mcu_records (baseline TIDAK diubah).
  let zonaDiterapkan = false;
  if (body.terapkanZona !== false && mcu?.id && hasil.zonaBaru) {
    const { error: upErr } = await client.from('mcu_records').update({
      zonasi: hasil.zonaBaru,
      trigger_zona: hasil.trigger,
      pengendalian: hasil.pengendalian,
      frekuensi_evaluasi: hasil.frekuensi,
    }).eq('id', mcu.id);
    zonaDiterapkan = !upErr;
  }

  return NextResponse.json({
    success: true,
    zonaSebelum: hasil.zonaSebelum,
    zonaSesudah: hasil.zonaBaru,
    arah: hasil.arah,
    ringkasanSurat: hasil.ringkasanSurat,
    zonaDiterapkan,
  });
}

/** DELETE ?id= — hapus satu baris tindak lanjut. */
export async function DELETE(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

  const { error } = await adminClient().from('followups_prokawan').delete().eq('id', id);
  if (error) {
    console.error('[Follow-up] Failed to delete follow-up:', error.code);
    return NextResponse.json({ error: 'Gagal menghapus tindak lanjut.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
