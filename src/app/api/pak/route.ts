// src/app/api/pak/route.ts — Register PAK (INK/017, lifecycle PAK-01/02/03)
// GET    ?resource=list|saran|detail
// POST   — buat kasus (superuser+administrator)
// PATCH  — update lifecycle (triase/diagnosis/tahap)
// DELETE ?id=
import { NextRequest } from 'next/server';
import { ADMIN_ROLES, db, fail, ok, requireCaller } from '@/lib/hc-ergo-server';
import { prefiksIdRegister, batasTriase, batasJam, sisaJam } from '@/lib/app-settings';
import { hitungSaranPemicu, type McuLike } from '@/lib/pemicu-pak';
import { mergeSettings } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';
type Row = Record<string, any>;

const WRITE_ROLES = ['superuser', 'administrator'];
const READ_ROLES = [...WRITE_ROLES, 'manager', 'pic'];

/** Ambil pengaturan (batas waktu PAK + prefiks) dari app_settings. */
async function getSettings(): Promise<ReturnType<typeof mergeSettings>> {
  const { data } = await db.from('app_settings').select('value').eq('key', 'app').maybeSingle();
  return mergeSettings(data?.value ?? null);
}

async function generateIdRegister(prefiks: string): Promise<string> {
  const now = new Date();
  const prefix = prefiksIdRegister(prefiks, now);
  // Hitung nomor urut bulan ini (aman terhadap duplikat kasus bersamaan).
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await db.from('pak_cases')
    .select('id', { count: 'exact', head: true })
    .gte('tanggal_diterima', startOfMonth);
  const next = String((count || 0) + 1).padStart(3, '0');
  // Loop kecil bila tetap bentrok.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${next}`;
    const { data: existing } = await db.from('pak_cases').select('id').eq('id_register', candidate).maybeSingle();
    if (!existing) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireCaller(req, READ_ROLES);
  if ('error' in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  const resource = p.get('resource') || 'list';
  try {
    if (resource === 'list') {
      const { data, error } = await db.from('pak_cases').select('*').order('tanggal_diterima', { ascending: false }).limit(300);
      if (error) throw new Error(error.message);
      const settings = await getSettings();
      const now = new Date();
      // Tambahkan info deadline & status ketepatan waktu (turunan, tidak disimpan).
      const rows = (data || []).map((r: Row) => ({
        ...r,
        deadline_info: {
          triaseSisaJam: r.triase_batas ? sisaJam(new Date(r.triase_batas), now) : null,
          laporanMedisSisaJam: r.laporan_medis_batas ? sisaJam(new Date(r.laporan_medis_batas), now) : null,
          tahap1SisaJam: r.tahap1_batas ? sisaJam(new Date(r.tahap1_batas), now) : null,
        },
      }));
      return ok(rows, { pak: settings.pak, dokumen: settings.dokumen });
    }

    if (resource === 'saran') {
      // Saran pemicu untuk satu karyawan: baca sejarah MCU + kategori pajanan.
      const nik = p.get('nik');
      const kategori = (p.get('kategori') || null) as 'A' | 'B' | 'C' | null;
      if (!nik) return fail('nik wajib disertakan');
      const { data: mcus, error } = await db.from('mcu_records')
        .select('id,tgl_mcu,acr_2k,acr_3k,acr_4k,acl_2k,acl_3k,acl_4k,acr_500,acr_1k,acr_6k,acr_8k,acl_500,acl_1k,acl_6k,acl_8k,pta,aud_interp,fev1_fvc_act,fev1_pct,fvc_pct,spi_interp,sgot,sgpt,kreatinin,egfr,hb,leukosit,trombosit,chest_xr,visus_jauh,lbp,riwayat_epilepsi')
        .eq('nik_karyawan_hash', nik)
        .order('tgl_mcu', { ascending: true });
      if (error) throw new Error(error.message);

      // Dekripsi & konversi snake_case → camelCase ala McuLike.
      const { decryptMCURecord } = await import('@/lib/encryption');
      const history: McuLike[] = (mcus || []).map((row: Row) => {
        const d = decryptMCURecord(row);
        return {
          id: row.id, tglMcu: row.tgl_mcu,
          acr_2k: d.acr2k ?? null, acr_3k: d.acr3k ?? null, acr_4k: d.acr4k ?? null,
          acl_2k: d.acl2k ?? null, acl_3k: d.acl3k ?? null, acl_4k: d.acl4k ?? null,
          acr_500: d.acr500 ?? null, acr_1k: d.acr1k ?? null, acr_6k: d.acr6k ?? null, acr_8k: d.acr8k ?? null,
          acl_500: d.acl500 ?? null, acl_1k: d.acl1k ?? null, acl_6k: d.acl6k ?? null, acl_8k: d.acl8k ?? null,
          pta: d.pta ?? null, audInterp: d.audInterp ?? null,
          fev1FvcAct: d.fev1FvcAct ?? null, fev1Pct: d.fev1Pct ?? null, fvcPct: d.fvcPct ?? null,
          spiInterp: d.spiInterp ?? null,
          sgot: d.sgot ?? null, sgpt: d.sgpt ?? null, ggt: d.ggt ?? null,
          kreatinin: d.kreatinin ?? null, egfr: d.egfr ?? null,
          hb: d.hb ?? null, leukosit: d.leukosit ?? null, trombosit: d.trombosit ?? null,
          chestXR: d.chestXR ?? null, visusJauh: d.visusJauh ?? null,
          lbp: d.lbp ?? null, riwayatEpilepsi: d.riwayatEpilepsi ?? null,
          sumber: null,
        };
      });
      return ok({ saran: hitungSaranPemicu(history, kategori), jumlahMcu: history.length });
    }

    if (resource === 'detail') {
      const id = p.get('id');
      if (!id) return fail('id wajib disertakan');
      const { data, error } = await db.from('pak_cases').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return ok(data);
    }

    return fail('resource tidak dikenal');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memuat Register PAK', 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCaller(req, WRITE_ROLES);
  if ('error' in auth) return auth.error;
  const b: Row = await req.json().catch(() => ({}));
  try {
    if (!String(b.nik_hash ?? '').trim()) return fail('NIK karyawan wajib (untuk baseline sejarah MCU)');
    const settings = await getSettings();
    const idRegister = await generateIdRegister(settings.perusahaan.prefiksId || 'BG');
    const now = new Date();
    const triaseBatas = batasTriase(now, settings.pak.triaseHariKerja);

    const { data, error } = await db.from('pak_cases').insert({
      id_register: idRegister,
      tanggal_diterima: now.toISOString(),
      diterima_oleh: auth.caller.name,
      lokasi: b.lokasi || null, jobsite_nama: b.jobsite_nama || null,
      sumber_dugaan: b.sumber_dugaan || 'MCU', sumber_detail: b.sumber_detail || null,
      pelapor_nama: b.pelapor_nama || null, pelapor_telepon: b.pelapor_telepon || null,
      nik_hash: b.nik_hash, nik_enc: b.nik_enc || null, nama_enc: b.nama_enc || null,
      jabatan: b.jabatan || null, department: b.department || null,
      jenis_pekerjaan: b.jenis_pekerjaan || null,
      masa_kerja_tahun: b.masa_kerja_tahun ?? null, masa_kerja_bulan: b.masa_kerja_bulan ?? null,
      sumber_pajanan: b.sumber_pajanan || null,
      diagnosis_klinis: b.diagnosis_klinis || null,
      diagnosis_tgl: b.diagnosis_tgl || null, diagnosis_faskes: b.diagnosis_faskes || null,
      diagnosis_dokter: b.diagnosis_dokter || null,
      hasil_mcu_pemicu: b.hasil_mcu_pemicu || null,
      status_bpjs_tk: b.status_bpjs_tk || null, upah: b.upah || null,
      mcu_record_id: b.mcu_record_id || null,
      triase_batas: triaseBatas.toISOString(),
      status: 'DITERIMA', created_by: auth.caller.name,
    }).select().single();
    if (error) throw new Error(error.message);
    return ok(data, { triaseBatas: triaseBatas.toISOString() });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal membuat kasus PAK', 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireCaller(req, WRITE_ROLES);
  if ('error' in auth) return auth.error;
  const b: Row = await req.json().catch(() => ({}));
  if (!b.id) return fail('id wajib disertakan');
  try {
    const settings = await getSettings();
    const now = new Date();
    const patch: Row = { updated_at: now.toISOString() };
    const setIf = (k: string, v: unknown) => { if (v !== undefined) patch[k] = v === '' ? null : v; };

    // Triase (PAK-01 bagian C)
    if (b.action === 'triase') {
      setIf('triase_keputusan', b.triase_keputusan);
      setIf('triase_alasan', b.triase_alasan);
      setIf('triase_tgl', now.toISOString());
      setIf('triase_dokter', auth.caller.name);
      // Status lanjutan sesuai keputusan triase.
      if (b.triase_keputusan === 'TIDAK_MEMENUHI') patch.status = 'DITUTUP';
      else if (b.triase_keputusan === 'LANJUT_PAK02') patch.status = 'PENEGAKAN';
      else patch.status = 'DITRIASE';
    }

    // Verifikasi dokumen HRA (INK/017 Lampiran 1) — konfirmasi manual petugas
    // bahwa pajanan pada HRA unit kerja sesuai dengan keluhan/diagnosis.
    if (b.action === 'verify_hra') {
      patch.hra_verified = true;
      patch.hra_verified_by = auth.caller.name;
      patch.hra_verified_tgl = now.toISOString();
    }
    if (b.action === 'unverify_hra') {
      patch.hra_verified = false;
      patch.hra_verified_by = null;
      patch.hra_verified_tgl = null;
    }

    // Penegakan diagnosis (PAK-02 bagian E)
    if (b.action === 'diagnosis') {
      setIf('telaah7', b.telaah7);
      setIf('dokumen_pendukung', b.dokumen_pendukung);
      setIf('konsultasi', b.konsultasi);
      setIf('diagnosis_okupasi', b.diagnosis_okupasi);
      setIf('diagnosis_tegak_tgl', b.diagnosis_tegak_tgl ? new Date(b.diagnosis_tegak_tgl).toISOString() : now.toISOString());
      setIf('kelaikan_kerja', b.kelaikan_kerja);
      setIf('tindak_lanjut_pengendalian', b.tindak_lanjut_pengendalian);
      if (b.diagnosis_okupasi === 'BUKAN_PAK') patch.status = 'DITUTUP';
      else {
        patch.status = 'TAHAP_I';
        // Laporan medis 1×24 jam; Tahap I 2×24 jam sejak diagnosis.
        patch.laporan_medis_batas = batasJam(now, settings.pak.laporanMedisJam).toISOString();
        patch.tahap1_batas = batasJam(now, settings.pak.tahapSatuJam).toISOString();
      }
    }

    // Laporan (PAK-03)
    if (b.action === 'laporan') {
      setIf('laporan_medis_tgl', b.laporan_medis_tgl ? new Date(b.laporan_medis_tgl).toISOString() : now.toISOString());
      setIf('tahap1_selesai_tgl', b.tahap1_selesai_tgl ? new Date(b.tahap1_selesai_tgl).toISOString() : null);
      setIf('tahap1_tepat_waktu', b.tahap1_tepat_waktu);
      setIf('tahap1_bukti', b.tahap1_bukti);
      setIf('kesimpulan_bpjs', b.kesimpulan_bpjs);
      setIf('kesimpulan_bpjs_tgl', b.kesimpulan_bpjs_tgl || null);
      setIf('tahap2_selesai_tgl', b.tahap2_selesai_tgl ? new Date(b.tahap2_selesai_tgl).toISOString() : null);
      setIf('tahap2_bukti', b.tahap2_bukti);
      if (b.tahap2_selesai_tgl) patch.status = 'TAHAP_II';
      else if (b.kesimpulan_bpjs) patch.status = 'DITUTUP';
    }

    // Fallback: field langsung (mis. koreksi data minimal)
    for (const k of ['sumber_pajanan', 'diagnosis_klinis', 'hasil_mcu_pemicu', 'status_bpjs_tk', 'upah',
      'jabatan', 'department', 'jenis_pekerjaan', 'masa_kerja_tahun', 'masa_kerja_bulan',
      'diagnosis_tgl', 'diagnosis_faskes', 'diagnosis_dokter', 'pelapor_nama', 'pelapor_telepon']) {
      if (k in b) setIf(k, b[k]);
    }

    const { data, error } = await db.from('pak_cases').update(patch).eq('id', b.id).select().single();
    if (error) throw new Error(error.message);
    return ok(data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memperbarui kasus PAK', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCaller(req, WRITE_ROLES);
  if ('error' in auth) return auth.error;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('id wajib disertakan');
  const { error } = await db.from('pak_cases').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}
