import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { decryptMCURecord } from '@/lib/encryption';
import { applyMCUCalculations } from '@/lib/mcu-calculations';
import { barisKeDraft } from '@/lib/prokawan-evaluasi-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/recompute-zonasi
 *
 * MENGHITUNG ULANG kolom turunan engine STANDAR PTM pada `mcu_records` setelah
 * tabel/ambang batas pada `ptm-pengendalian.ts` disesuaikan dengan
 * BG/QSHE/STD/006 Rev.002 Bab 7:
 *
 *   zonasi · trigger_zona · pengendalian · frekuensi_evaluasi · catatan_sop · perlu_fu
 *
 * MENGAPA ENDPOINT, BUKAN SATU SKRIP SQL BESAR
 * --------------------------------------------------
 * Zonasi bergantung pada ±40 ambang klinis + logika lintas parameter
 * (mis. IMT ≥30 naik Merah hanya bila ADA komorbid; HbA1c tidak tersedia pada
 * DM terdiagnosis → minimal Kuning; tanda bahaya SRQ-20 butir 17). Menulis
 * ulang logika itu di SQL berarti memelihara DUA implementasi yang akan
 * menyimpang. Endpoint ini memakai engine TypeScript yang SAMA dengan form
 * Review MCU, sehingga satu-satunya sumber kebenaran tetap di kode.
 *
 * YANG DILAKUKAN
 *  1. Baca mcu_records (paginasi 500).
 *  2. Dekripsi field identitas (NIK/nama) untuk dibaca engine.
 *  3. applyMCUCalculations() → hasilkan kolom turunan baru.
 *  4. Bandingkan dengan nilai lama; tulis HANYA yang berubah (patch sempit).
 *  5. mode=dry-run (default) tidak menulis apa pun — hanya laporan.
 *
 * Body/Query:
 *   ?dryRun=true|false   (default true)
 *   ?limit=500           batas baris per permintaan (maks 2000)
 *   ?offset=0            untuk melanjutkan batch berikutnya
 *
 * Akses: superuser saja.
 */

const KOLOM_TURUNAN = [
  'zonasi', 'trigger_zona', 'pengendalian', 'frekuensi_evaluasi', 'catatan_sop', 'perlu_fu',
] as const;

type KolomTurunan = typeof KOLOM_TURUNAN[number];

/** Kamus camelCase (engine) → snake_case (kolom tabel). */
const PETA_KOLOM: Record<KolomTurunan, keyof ReturnType<typeof applyMCUCalculations>> = {
  zonasi: 'zonasi',
  trigger_zona: 'triggerZona',
  pengendalian: 'pengendalian',
  frekuensi_evaluasi: 'frekuensiEvaluasi',
  catatan_sop: 'catatanSOP',
  perlu_fu: 'perluFU',
};

function teks(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || String(caller.role) !== 'superuser') {
    return NextResponse.json({ error: 'Hanya superuser yang dapat menghitung ulang zonasi' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const dryRun = params.get('dryRun') !== 'false';
  const limit = Math.min(Math.max(Number.parseInt(params.get('limit') || '500', 10) || 500, 1), 2000);
  const offset = Math.max(Number.parseInt(params.get('offset') || '0', 10) || 0, 0);

  const client = adminClient();

  const { data: rows, error } = await client
    .from('mcu_records')
    .select('*')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({
      success: true, dryRun, offset, processed: 0, changed: 0, selesai: true,
    });
  }

  const perubahan: {
    id: string;
    nama: string;
    dari: Partial<Record<KolomTurunan, string>>;
    ke: Partial<Record<KolomTurunan, string>>;
  }[] = [];
  const patchPerId: { id: string; patch: Record<string, string> }[] = [];
  const ringkasZona: Record<string, number> = {};
  const belumTercakup: { nama: string; catatan: string }[] = [];

  // Record yang sudah punya follow up selesai TIDAK dihitung ulang dari baseline:
  // zona, trigger, dan perlu_fu-nya sudah ditulis dari dataset efektif
  // (baseline + hasil follow up) dan akan kembali ke nilai baseline bila ditimpa.
  const idDenganFollowUp = new Set<string>();
  const { data: fuRows } = await client.from('followups_prokawan').select('mcu_record_id').eq('selesai', true).not('mcu_record_id', 'is', null);
  for (const fu of fuRows ?? []) idDenganFollowUp.add(String(fu.mcu_record_id));
  let dilewati = 0;

  for (const raw of rows as Record<string, unknown>[]) {
    if (idDenganFollowUp.has(String(raw.id))) { dilewati++; continue; }
    // Engine butuh NIK/nama terbaca; kolom itu tersimpan terenkripsi.
    const record = decryptMCURecord(raw) as Record<string, unknown>;

    let hasil: ReturnType<typeof applyMCUCalculations>;
    try {
      hasil = applyMCUCalculations(barisKeDraft(raw) as never);
    } catch {
      continue; // satu baris rusak tidak boleh menggagalkan seluruh batch
    }

    const patch: Record<string, string> = {};
    const dari: Partial<Record<KolomTurunan, string>> = {};
    const ke: Partial<Record<KolomTurunan, string>> = {};

    for (const kolom of KOLOM_TURUNAN) {
      const baru = teks(hasil[PETA_KOLOM[kolom]]);
      const lama = teks(raw[kolom]);
      if (baru !== lama) {
        patch[kolom] = baru;
        dari[kolom] = lama;
        ke[kolom] = baru;
      }
    }

    const zonaBaru = teks(hasil.zonasi) || '(kosong)';
    ringkasZona[zonaBaru] = (ringkasZona[zonaBaru] || 0) + 1;

    // Catatan SOP berisi parameter yang tidak punya baris pengendalian Bab 7.
    const catatan = teks(hasil.catatanSOP);
    if (/Pengendalian belum tercantum/i.test(catatan)) {
      belumTercakup.push({ nama: teks(record.nama) || '(tanpa nama)', catatan });
    }

    if (Object.keys(patch).length) {
      perubahan.push({ id: String(raw.id), nama: teks(record.nama), dari, ke });
      patchPerId.push({ id: String(raw.id), patch });
    }
  }

  let tertulis = 0;
  if (!dryRun) {
    for (const { id, patch } of patchPerId) {
      const { error: updateError } = await client.from('mcu_records').update(patch).eq('id', id);
      if (updateError) {
        return NextResponse.json({
          error: `Gagal menulis id=${id}: ${updateError.message}`,
          sudahTertulis: tertulis,
        }, { status: 500 });
      }
      tertulis += 1;
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    offset,
    limit,
    processed: rows.length,
    dilewatiKarenaSudahFollowUp: dilewati,
    changed: perubahan.length,
    perubahanPerKolom: perubahan.reduce<Record<string, number>>((acc, item) => {
      for (const kolom of Object.keys(item.ke)) acc[kolom] = (acc[kolom] ?? 0) + 1;
      return acc;
    }, {}),
    tertulis,
    selesai: rows.length < limit,
    offsetBerikutnya: offset + rows.length,
    ringkasZona,
    contohPerubahan: perubahan.slice(0, 25),
    belumTercakup: belumTercakup.slice(0, 25),
    jumlahBelumTercakup: belumTercakup.length,
  });
}

/** GET: ringkasan cepat tanpa menghitung (untuk melihat kondisi kolom saat ini). */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || String(caller.role) !== 'superuser') {
    return NextResponse.json({ error: 'Hanya superuser' }, { status: 403 });
  }
  const client = adminClient();
  const { count, error } = await client
    .from('mcu_records')
    .select('id', { count: 'exact', head: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    totalRecord: count ?? 0,
    kolomYangDiperbarui: KOLOM_TURUNAN,
    catatan: 'Kirim POST dengan ?dryRun=true untuk melihat dampaknya sebelum menulis.',
  });
}
