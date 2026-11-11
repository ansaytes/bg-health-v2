import type { SupabaseClient } from '@supabase/supabase-js';

import type { FollowUpRingkas } from '@/lib/mcu-monitor';

const PAGE_SIZE = 1000;

/**
 * Seluruh follow up yang sudah selesai, dikelompokkan per `nik_hash`
 * (HMAC NIK karyawan). Sumber tunggal status follow up untuk Monitoring MCU
 * dan dashboard: tabel `followups_prokawan`.
 *
 * Tabel yang belum ada dianggap belum ada follow up (peta kosong), bukan error,
 * supaya halaman monitoring tetap tampil sebelum tabel dibuat.
 */
export async function muatFollowUpSelesai(client: SupabaseClient): Promise<Map<string, FollowUpRingkas[]>> {
  const peta = new Map<string, FollowUpRingkas[]>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('followups_prokawan')
      .select('id,nik_hash,aktual_tanggal,kunjungan_ke,zona_sesudah,arah,sisa_abnormal,ditutup_paramedis')
      .eq('selesai', true)
      .not('aktual_tanggal', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (/does not exist|PGRST205|42P01/i.test(error.message)) return peta;
      throw error;
    }
    for (const row of data ?? []) {
      const hash = String(row.nik_hash ?? '');
      if (!hash) continue;
      const daftar = peta.get(hash) ?? [];
      daftar.push({
        aktual: String(row.aktual_tanggal ?? '').slice(0, 10),
        ke: typeof row.kunjungan_ke === 'number' ? row.kunjungan_ke : null,
        zona: row.zona_sesudah ?? null,
        arah: row.arah ?? null,
        sisa: typeof row.sisa_abnormal === 'number' ? row.sisa_abnormal : null,
        paramedis: row.ditutup_paramedis === true,
      });
      peta.set(hash, daftar);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return peta;
}
