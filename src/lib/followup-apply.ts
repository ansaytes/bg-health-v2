// ============================================================
// Terapkan hasil tindak lanjut ke dataset efektif
// ============================================================
//
// INTI LOGIKA YANG DIMINTA OWNER:
//
//   "nilai abnormal di baseline yang sudah ditimpa follow up tidak lagi
//    dihitung. Jadi kalau TD 165/102 sudah jadi 125/80, Hipertensi keluar
//    dari trigger dan zona turun sendiri."
//
// Baseline MCU TIDAK diubah. Yang dilakukan:
//
//   dataset efektif = nilai MCU  ⊕  nilai follow up (kronologis, terbaru menang)
//   → applyMCUCalculations(dataset efektif) → zona, trigger, pengendalian
//
// Baseline tetap utuh di mcu_records sehingga riwayat "dulu 165/102, sekarang
// 125/80" dapat ditelusuri kapan saja.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { barisKeDraft } from '@/lib/prokawan-evaluasi-server';
import { hitungSisaTindakLanjut, tentukanFieldTindakLanjut } from '@/lib/followup-fields';
import { formatSuratKontrolAbnormal } from '@/lib/surat-kontrol-format';

export interface HasilTerap {
  zonaSebelum: string | null;
  zonaBaru: string | null;
  arah: 'membaik' | 'memburuk' | 'tetap' | 'tidak-dapat-dinilai';
  trigger: string;
  pengendalian: string;
  frekuensi: string;
  evaluasi: Record<string, unknown>;
  /** Nilai baseline yang diukur ulang (disalin ke baris follow up). */
  baseline: Record<string, string | number>;
  /** Nilai follow up terbaru per parameter sebelum penyimpanan ini (untuk prefill form). */
  nilaiTerbaru: Record<string, string | number | null>;
  /** Parameter yang masih abnormal (bisa diukur ulang) setelah follow up ini; 0 = tuntas. */
  sisaAbnormal: number;
  /** Perlu follow up menurut dataset efektif (nilai kolom `perlu_fu`). */
  perluFollowUp: 'Ya' | 'Tidak';
  /** Seluruh baseline MCU dalam nama field engine (camelCase), tanpa overlay. */
  baselinePenuh: Record<string, string | number | undefined>;
  ringkasanSurat: string;
}

const PERINGKAT: Record<string, number> = {
  Hijau: 0, 'Belum Lengkap': 1, Kuning: 2, Merah: 3,
};

/**
 * Membangun dataset efektif dan menghitung zona dari sana.
 *
 * @param nilaiBaru hasil tindak lanjut yang BARU diisi (menimpa nilai lama)
 */
export async function buildDatasetEfektifDanZona(opsi: {
  client: SupabaseClient;
  nikHash: string;
  /** Record MCU baseline (sudah ditemukan lewat cariMcuByNik, select '*'). */
  mcu: Record<string, unknown>;
  nilaiBaru: Record<string, string | number>;
}): Promise<HasilTerap> {
  const { client, nikHash, mcu, nilaiBaru } = opsi;

  // ── 1. Baseline MCU → nama field engine ───────────────────────────
  // Kolom DB snake_case (`td_s`, `visus_jauh`) HARUS dikonversi ke camelCase
  // (`tdS`, `visusJauh`); engine dan overlay follow up memakai nama itu.
  const baseline = barisKeDraft(mcu);

  // ── 2. Nilai follow up sebelumnya (kronologis) ────────────────────
  // Hanya follow up SESUDAH MCU baseline ini: hasil follow up dari MCU yang lebih
  // lama tidak boleh menimpa baseline MCU yang lebih baru.
  const tglMcu = String(mcu.tgl_mcu ?? '').slice(0, 10);
  let kueriRiwayat = client
    .from('followups_prokawan')
    .select('aktual_tanggal,nilai,selesai')
    .eq('nik_hash', nikHash)
    .eq('selesai', true);
  if (/^\d{4}-\d{2}-\d{2}$/.test(tglMcu)) kueriRiwayat = kueriRiwayat.gte('aktual_tanggal', tglMcu);
  const { data: riwayat } = await kueriRiwayat.order('aktual_tanggal', { ascending: true });

  const overlayLama: Record<string, string | number> = {};
  for (const r of (riwayat ?? []) as Record<string, unknown>[]) {
    if (r.nilai && typeof r.nilai === 'object') {
      Object.assign(overlayLama, r.nilai as Record<string, string | number>);
    }
  }

  // ── 3. Dataset efektif: baseline ditimpa semua follow up ──────────
  const efektif: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(baseline)) {
    if (v !== null && v !== undefined && String(v) !== '') efektif[k] = v as string | number;
  }
  Object.assign(efektif, overlayLama, nilaiBaru);

  // IMT & turunan dihitung ulang dari nilai terbaru.
  const bb = Number(String(efektif.bb ?? '').replace(',', '.'));
  const tb = Number(String(efektif.tb ?? '').replace(',', '.'));
  if (bb > 0 && tb > 0) efektif.bmi = Number((bb / ((tb / 100) ** 2)).toFixed(1));

  // ── 4. Hitung zona dari dataset efektif ───────────────────────────
  const hitung = applyMCUCalculations(efektif as never);

  const zonaSebelum = String(mcu.zonasi ?? '').trim() || null;
  const zonaBaru = String(hitung.zonasi ?? '').trim() || null;

  let arah: HasilTerap['arah'] = 'tidak-dapat-dinilai';
  if (zonaSebelum && zonaBaru) {
    const a = PERINGKAT[zonaSebelum] ?? 0;
    const b = PERINGKAT[zonaBaru] ?? 0;
    arah = b < a ? 'membaik' : b > a ? 'memburuk' : 'tetap';
  }

  // ── 5. Teks surat dari field yang ditindaklanjuti ─────────────────
  const nilaiGabungan: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(efektif)) {
    nilaiGabungan[k] = (v ?? null) as string | number | null;
  }
  const kelompok = tentukanFieldTindakLanjut(baseline, String(mcu.trigger_zona ?? ''), nilaiGabungan);
  const fieldAbnormal = kelompok.flatMap((k) => k.fields.map((f) => f.id));
  const surat = formatSuratKontrolAbnormal(nilaiGabungan, fieldAbnormal);

  // Baseline yang DISALIN ke baris follow up: hanya field yang diukur,
  // agar penelusuran "dulu berapa" tidak menyimpan seluruh record.
  const baselineRingkas: Record<string, string | number> = {};
  for (const id of Object.keys({ ...overlayLama, ...nilaiBaru })) {
    const v = baseline[id];
    if (v !== null && v !== undefined && String(v) !== '') baselineRingkas[id] = v as string | number;
    if (id === 'tdS' && baseline.tdD !== undefined) baselineRingkas.tdD = baseline.tdD as string | number;
  }

  return {
    zonaSebelum,
    zonaBaru,
    arah,
    trigger: String(hitung.triggerZona ?? ''),
    pengendalian: String(hitung.pengendalian ?? ''),
    frekuensi: String(hitung.frekuensiEvaluasi ?? ''),
    evaluasi: {
      zonaSebelum, zonaBaru, arah,
      trigger: hitung.triggerZona,
      pengendalian: hitung.pengendalian,
      frekuensi: hitung.frekuensiEvaluasi,
      ringkasanSurat: surat.teks,
      nilaiTindakLanjut: nilaiBaru,
    },
    nilaiTerbaru: overlayLama,
    sisaAbnormal: hitungSisaTindakLanjut(efektif, String(hitung.triggerZona ?? '')),
    perluFollowUp: String(hitung.perluFU ?? '') === 'Ya' ? 'Ya' : 'Tidak',
    baseline: baselineRingkas,
    baselinePenuh: baseline,
    ringkasanSurat: surat.teks,
  };
}
