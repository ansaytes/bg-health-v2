// ============================================================
// Evaluasi zona dari hasil kontrol — sisi server
// ============================================================
//
// Memisahkan pengambilan BASELINE (dari mcu_records / kontrol sebelumnya) dari
// perhitungan zona. Pemisahan ini penting karena:
//
//   1. Baseline harus PERMANEN. Bila nilai MCU berubah (MCU baru), riwayat
//      kontrol lama tetap harus bisa dibandingkan dengan nilai yang berlaku
//      saat kontrol itu terjadi. Karena itu baseline disalin ke baris
//      kunjungan_kontrol, bukan hanya direferensikan.
//
//   2. Perhitungan zona memakai engine yang sama dengan MCU (`assessZonasi`),
//      sehingga tidak ada dua implementasi aturan yang bisa menyimpang.
//
//   3. mcu_records menyimpan kolom snake_case dan sebagian terenkripsi;
//      konversi ke bentuk yang dibaca engine dilakukan di sini.

import type { SupabaseClient } from '@supabase/supabase-js';

import { decryptMCURecord } from '@/lib/encryption';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import {
  evaluasiZonaDariKontrol,
  type HasilEvaluasiZona,
  type NilaiKontrol,
} from '@/lib/prokawan-evaluasi';

/** Peta snake_case (kolom DB) → camelCase (kunci engine). */
const KOLOM_EKSTRA: Record<string, string> = {
  td_s: 'tdS', td_d: 'tdD', gd_2pp: 'gd2pp',
  fev1_pct: 'fev1Pct', fev1_fvc_act: 'fev1FvcAct', fvc_pct: 'fvcPct',
  visus_jauh: 'visusJauh', chest_xr: 'chestXR',
  ess_score: 'essScore', srq_20_score: 'srq20Score', srq20_score: 'srq20Score',
  dass_depresi: 'dassDepresi', dass_cemas: 'dassCemas', dass_stres: 'dassStres',
  dm_komplikasi: 'dmKomplikasi', mental_konfirmasi: 'mentalKonfirmasi',
  artritis_urat: 'artritisUrat', diagnosis_hati: 'diagnosisHati',
  obesitas_fungsional: 'obesitasFungsional', riwayat_jantung: 'riwayatJantung',
  riwayat_stroke: 'riwayatStroke', riwayat_epilepsi: 'riwayatEpilepsi',
  epilepsi_kepatuhan: 'epilepsiKepatuhan', status_terapi_ess: 'statusTerapiEss',
  srq_17_bahaya: 'srq17Bahaya', srq17_bahaya: 'srq17Bahaya',
  jenis_kelamin: 'jenisKelamin', riwayat_asma: 'riwayatAsma',
  riwayat_sleep_apnea: 'riwayatSleepApnea',
};

/** Kunci engine yang diambil sebagai nilai acuan (baseline) dari MCU. */
const KUNCI_BASELINE = [
  'tdS', 'tdD', 'bb', 'tb', 'lp', 'bmi',
  'gdp', 'gd2pp', 'hba1c', 'ldl', 'tg', 'au', 'hb', 'kreatinin', 'egfr', 'sgot', 'sgpt',
  'fev1Pct', 'fev1FvcAct', 'fvcPct', 'visusJauh', 'pta',
  'essScore', 'srq20Score', 'dassDepresi', 'dassCemas', 'dassStres',
];

const PROFIL_MCU = [
  'usia', 'jenisKelamin', 'dmKomplikasi', 'mentalKonfirmasi', 'artritisUrat',
  'diagnosisHati', 'obesitasFungsional', 'riwayatJantung', 'riwayatStroke',
  'lbp', 'riwayatEpilepsi', 'epilepsiKepatuhan', 'statusTerapiEss',
  'srq17Bahaya', 'riwayatAsma', 'riwayatSleepApnea',
];

/**
 * Konversi baris mcu_records (snake_case) ke objek yang dibaca engine.
 * Kolom sensitif didekripsi lebih dulu.
 */
function barisKeDraft(record: Record<string, unknown>): Record<string, string | number | undefined> {
  const dekripsi = decryptMCURecord(record) as Record<string, unknown>;
  const peta = new Map<string, string>();
  for (const field of MCU_FIELDS) {
    peta.set(field.id.replace(/([a-z0-9])([A-Z]+)/g, '$1_$2').toLowerCase(), field.id);
  }

  const draft: Record<string, string | number | undefined> = {};
  for (const [kolom, nilai] of Object.entries(dekripsi)) {
    if (['created_at', 'updated_at', 'id'].includes(kolom) || nilai == null) continue;
    const kunci = KOLOM_EKSTRA[kolom] ?? peta.get(kolom)
      ?? kolom.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    draft[kunci] = typeof nilai === 'number' ? nilai : String(nilai);
  }
  return draft;
}

export interface HasilEvaluasiServer {
  kunjunganId: string | null;
  mcuRecordId: string;
  evaluasi: HasilEvaluasiZona;
  baselineRingkas: NilaiKontrol;
}

export async function evaluateFromKontrol(opsi: {
  client: SupabaseClient;
  nikHash: string;
  nik: string;
  aktualTanggal: string;
  nilai: NilaiKontrol;
  kunjunganId: string | null;
}): Promise<HasilEvaluasiServer> {
  const { client, nikHash, aktualTanggal } = opsi;

  // ── 1. Record MCU terakhir peserta = sumber profil & default baseline ────
  //
  // Urutan prioritas sama dengan pemuat peserta: record yang punya zonasi,
  // lalu yang punya tgl_mcu terbaru.
  const { data: mcuRows, error: mcuError } = await client
    .from('mcu_records')
    .select('*')
    .eq('nik_karyawan_hash', nikHash)
    .order('tgl_mcu', { ascending: false, nullsFirst: false })
    .limit(50);

  if (mcuError) throw new Error(`Gagal membaca MCU: ${mcuError.message}`);

  const mcu = (mcuRows ?? []).find((r) => String(r.zonasi ?? '').trim())
    ?? (mcuRows ?? []).find((r) => r.tgl_mcu)
    ?? (mcuRows ?? [])[0];

  if (!mcu) {
    throw new Error('Record MCU peserta tidak ditemukan. Evaluasi zona memerlukan data MCU sebagai acuan.');
  }

  const draftMcu = barisKeDraft(mcu as Record<string, unknown>);

  // ── 2. Baseline: kontrol sebelumnya bila ada, selain itu nilai MCU ───────
  //
  // Memakai kontrol sebelumnya lebih tepat bila peserta sudah pernah kontrol:
  // perubahan diukur antar-kontrol, bukan dari MCU yang bisa berumur setahun.
  const { data: kontrolLalu } = await client
    .from('kunjungan_kontrol')
    .select('id,aktual_tanggal,nilai,zona_sesudah')
    .eq('nik_hash', nikHash)
    .not('nilai', 'is', null)
    .order('aktual_tanggal', { ascending: false, nullsFirst: false })
    .limit(1);

  const sebelumnya = kontrolLalu?.[0] ?? null;

  const baselineDariMcu: NilaiKontrol = {};
  for (const kunci of KUNCI_BASELINE) {
    const v = draftMcu[kunci];
    if (v !== undefined && v !== null && String(v).trim() !== '') baselineDariMcu[kunci] = v;
  }

  const baseline: NilaiKontrol = sebelumnya?.nilai
    ? { ...baselineDariMcu, ...(sebelumnya.nilai as NilaiKontrol) }
    : baselineDariMcu;

  const zonaSebelumnya = (sebelumnya?.zona_sesudah
    ?? String(mcu.zonasi ?? '').trim()
    ?? null) as 'Kuning' | 'Merah' | null;

  // ── 3. Evaluasi memakai engine yang sama dengan MCU ─────────────────────
  const profil: Record<string, unknown> = {};
  for (const k of PROFIL_MCU) profil[k] = draftMcu[k];
  profil.usia = draftMcu.usia;
  profil.jenisKelamin = draftMcu.jenisKelamin;
  profil.hbsag = draftMcu.hbsag;
  profil.chestXR = draftMcu.chestXR;

  const evaluasi = await evaluasiZonaDariKontrol({
    nilaiKontrol: opsi.nilai,
    baseline,
    zonaSebelumnya: zonaSebelumnya === 'Kuning' || zonaSebelumnya === 'Merah' ? zonaSebelumnya : null,
    profil: profil as never,
  });

  // ── 4. Simpan ke kunjungan_kontrol (buat baris baru bila belum ada) ─────
  const payload = {
    nik_hash: nikHash,
    aktual_tanggal: aktualTanggal,
    nilai: opsi.nilai,
    baseline,
    zona_sebelum: zonaSebelumnya,
    zona_sesudah: evaluasi.zonaBaru,
    arah: evaluasi.arah,
    hasil: evaluasi.arah === 'membaik' ? 'MEMBAIK'
      : evaluasi.arah === 'memburuk' ? 'MEMBURUK'
        : evaluasi.arah === 'tetap' ? 'STABIL' : 'BELUM',
    evaluasi,
    dievaluasi_pada: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let kunjunganId = opsi.kunjunganId;
  if (kunjunganId) {
    const { error } = await client.from('kunjungan_kontrol').update(payload).eq('id', kunjunganId);
    if (error) throw new Error(`Gagal menyimpan hasil kontrol: ${error.message}`);
  } else {
    const { data, error } = await client.from('kunjungan_kontrol')
      .insert({ ...payload, jadwal_tanggal: aktualTanggal, created_by: 'evaluasi-kontrol' })
      .select('id')
      .single();
    if (error) throw new Error(`Gagal menyimpan hasil kontrol: ${error.message}`);
    kunjunganId = data?.id ?? null;
  }

  const baselineRingkas: NilaiKontrol = {};
  for (const [k, v] of Object.entries(baseline)) {
    if (v !== null && v !== undefined) baselineRingkas[k] = v;
  }

  return {
    kunjunganId,
    mcuRecordId: String(mcu.id),
    evaluasi,
    baselineRingkas,
  };
}
