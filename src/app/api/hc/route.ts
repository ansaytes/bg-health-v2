// src/app/api/hc/route.ts — Program Konservasi Pendengaran (STD/033, INK/015)
// GET   ?resource=area|noise|exposure|audiometri|sts|dashboard
// POST  {resource: area|noise|exposure|baseline|sts, ...}
// PATCH {resource:'sts', id, ...}   DELETE ?resource=area|noise|exposure&id=
import { NextRequest } from 'next/server';
import { decryptMCURecord, decrypt, encrypt, hashField } from '@/lib/encryption';
import {
  audiogramFromRecord, evaluateAudiogram, FREQS, KELAS_LABEL, type KelasPendengaran,
} from '@/lib/hc-ergo';
import { db, fail, ok, requireCaller, today } from '@/lib/hc-ergo-server';

export const dynamic = 'force-dynamic';

const MCU_COLS = 'id,nik_karyawan_hash,national_id_hash,tgl_mcu,site,jabatan,nama,nik_karyawan,'
  + FREQS.map(f => `acr_${f},acl_${f}`).join(',');

type Row = Record<string, any>;

/* ───────── helper ───────── */
async function latestExposure(): Promise<Row[]> {
  const { data, error } = await db.from('hc_exposure_class').select('*')
    .order('tanggal_penetapan', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of data || []) {
    if (seen.has(r.nik_hash)) continue;
    seen.add(r.nik_hash);
    out.push({ ...r, nik: decrypt(r.nik_enc) || '', nama: decrypt(r.nama_enc) || '', nik_enc: undefined, nama_enc: undefined });
  }
  return out;
}

/** Evaluasi audiometri karyawan Kategori A/B dari mcu_records + baseline. */
async function loadAudiometriEval() {
  const exposure = (await latestExposure()).filter(e => e.kategori !== 'C');
  if (!exposure.length) return { rows: [] as Row[], exposure };

  const byHash = new Map<string, Row>();
  for (const e of exposure) {
    byHash.set(e.nik_hash, e);
    if (e.national_id_hash) byHash.set(e.national_id_hash, e);
  }
  const hashes = [...byHash.keys()];
  const records = new Map<string, Row[]>();       // exposure.id -> records
  for (let i = 0; i < hashes.length; i += 60) {
    const list = hashes.slice(i, i + 60).join(',');
    const { data, error } = await db.from('mcu_records').select(MCU_COLS)
      .or(`nik_karyawan_hash.in.(${list}),national_id_hash.in.(${list})`).order('tgl_mcu', { ascending: false });
    if (error) throw new Error(error.message);
    for (const rec of (data as unknown as Row[]) || []) {
      const emp = byHash.get(rec.nik_karyawan_hash) || byHash.get(rec.national_id_hash);
      if (!emp || !audiogramFromRecord(rec)) continue;
      const arr = records.get(emp.id) || [];
      if (!arr.some(x => x.id === rec.id)) arr.push(rec);
      records.set(emp.id, arr);
    }
  }
  const { data: bl } = await db.from('hc_baseline').select('*').in('nik_hash', exposure.map(e => e.nik_hash));
  const baseByHash = new Map((bl || []).map(b => [b.nik_hash, b]));
  const { data: cases } = await db.from('hc_sts_case').select('id,mcu_record_id,status,retest_deadline').in('nik_hash', exposure.map(e => e.nik_hash));
  const caseByRec = new Map((cases || []).map(c => [String(c.mcu_record_id), c]));
  const year = new Date().getFullYear();

  const rows = exposure.map(e => {
    const recs = (records.get(e.id) || []).sort((a, b) => String(b.tgl_mcu).localeCompare(String(a.tgl_mcu)));
    const latest = recs[0] || null;
    const baseRow = baseByHash.get(e.nik_hash);
    const baseRec = baseRow ? recs.find(r => String(r.id) === String(baseRow.mcu_record_id)) || null : null;
    const oldest = recs.length ? recs[recs.length - 1] : null;
    const isBaseline = !!(latest && baseRec && String(latest.id) === String(baseRec.id));
    const ev = latest ? evaluateAudiogram(audiogramFromRecord(latest)!, isBaseline ? null : baseRec ? audiogramFromRecord(baseRec) : null) : null;
    const stsCase = latest ? caseByRec.get(String(latest.id)) || null : null;
    return {
      exposureId: e.id, nikHash: e.nik_hash, nik: e.nik, nama: e.nama, site: e.site, departemen: e.departemen,
      jabatan: e.jabatan, kategori: e.kategori,
      jumlahAudiometri: recs.length,
      latest: latest ? { id: String(latest.id), tanggal: latest.tgl_mcu } : null,
      tahunIni: !!latest && String(latest.tgl_mcu).startsWith(String(year)),
      baseline: baseRec ? { id: String(baseRec.id), tanggal: baseRec.tgl_mcu } : null,
      saranBaseline: !baseRec && oldest ? { id: String(oldest.id), tanggal: oldest.tgl_mcu } : null,
      isBaseline,
      kelasKanan: ev?.kanan.kelas || null, kelasKiri: ev?.kiri.kelas || null, kelasTerburuk: ev?.kelasTerburuk || null,
      avg4Kanan: ev?.kanan.avg4 ?? null, avg4Kiri: ev?.kiri.avg4 ?? null,
      sts: ev?.baseline || null,
      stsCase,
    };
  });
  return { rows, exposure };
}

function bad(msg: string) { return fail(msg, 400); }

/* ───────── GET ───────── */
export async function GET(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  const resource = p.get('resource') || 'dashboard';
  try {
    if (resource === 'area') {
      const { data, error } = await db.from('v_hc_area_zona_terkini').select('*').order('site').order('nama_area');
      if (error) throw new Error(error.message);
      return ok(data);
    }
    if (resource === 'noise') {
      let q = db.from('hc_noise_survey').select('*, hc_area(site,nama_area), hc_noise_point(*)')
        .order('tanggal', { ascending: false }).limit(200);
      const areaId = p.get('area_id'); if (areaId) q = q.eq('area_id', areaId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return ok(data);
    }
    if (resource === 'exposure') return ok(await latestExposure());
    if (resource === 'audiometri') return ok((await loadAudiometriEval()).rows);
    if (resource === 'sts') {
      const { data, error } = await db.from('hc_sts_case').select('*').order('tanggal_deteksi', { ascending: false });
      if (error) throw new Error(error.message);
      return ok((data || []).map(c => ({ ...c, nik: decrypt(c.nik_enc) || '', nama: decrypt(c.nama_enc) || '', nik_enc: undefined, nama_enc: undefined })));
    }
    if (resource === 'dashboard') return ok(await buildDashboard(p.get('site') || ''));
    return bad('resource tidak dikenal');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memuat data', 500);
  }
}

async function buildDashboard(site: string) {
  const siteOk = (s: unknown) => !site || site === 'All Site' || s === site;
  const { data: areaAll } = await db.from('v_hc_area_zona_terkini').select('*');
  const areas = (areaAll || []).filter(a => siteOk(a.site));
  const zona = { HIJAU: 0, KUNING: 0, MERAH: 0, BELUM: 0 };
  for (const a of areas) zona[(a.zona as keyof typeof zona) || 'BELUM']++;
  const { rows, exposure } = await loadAudiometriEval();
  const emp = rows.filter(r => siteOk(r.site));
  const expAll = (await latestExposure()).filter(e => siteOk(e.site));
  const kategori = { A: 0, B: 0, C: 0 };
  for (const e of expAll) kategori[e.kategori as 'A' | 'B' | 'C']++;
  const cakupan = (['A', 'B'] as const).map(k => {
    const g = emp.filter(r => r.kategori === k);
    return {
      kategori: k, total: g.length,
      sudahTahunIni: g.filter(r => r.tahunIni).length,
      belumBaseline: g.filter(r => !r.baseline && !r.isBaseline).length,
      belumPernahAudiometri: g.filter(r => r.jumlahAudiometri === 0).length,
    };
  });
  const kelas: Record<string, number> = {};
  for (const r of emp) if (r.kelasTerburuk) kelas[r.kelasTerburuk] = (kelas[r.kelasTerburuk] || 0) + 1;
  const { data: cases } = await db.from('hc_sts_case').select('status,retest_deadline,site');
  const cs = (cases || []).filter(c => siteOk(c.site));
  const t = today();
  const sts = {
    belumDitindaklanjuti: emp.filter(r => r.sts?.sts && !r.stsCase).length,
    suspek: cs.filter(c => c.status === 'SUSPEK').length,
    retestDijadwalkan: cs.filter(c => c.status === 'RETEST_DIJADWALKAN').length,
    terkonfirmasi: cs.filter(c => c.status === 'TERKONFIRMASI').length,
    retestTerlambat: cs.filter(c => ['SUSPEK', 'RETEST_DIJADWALKAN'].includes(c.status) && c.retest_deadline < t).length,
  };
  return {
    zona, areaTerlambat: areas.filter(a => a.terlambat).length, areas, kategori, cakupan,
    kelas: Object.fromEntries(Object.entries(kelas).map(([k, v]) => [KELAS_LABEL[k as KelasPendengaran], v])),
    sts, totalEvaluasi: emp.length, adaExposure: exposure.length,
  };
}

/* ───────── POST ───────── */
export async function POST(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const { caller } = auth;
  let b: Row;
  try { b = await req.json(); } catch { return bad('Body tidak valid'); }
  try {
    switch (b.resource) {
      case 'area': {
        if (!b.site || !b.nama_area?.trim()) return bad('Site dan nama area wajib diisi');
        const { data, error } = await db.from('hc_area').insert({
          site: b.site, nama_area: String(b.nama_area).trim(), sumber_bising: b.sumber_bising || null,
        }).select().single();
        if (error) throw new Error(error.code === '23505' ? 'Area tersebut sudah terdaftar pada site ini' : error.message);
        return ok(data);
      }
      case 'noise': {
        if (!b.area_id || !b.tanggal || !b.petugas?.trim()) return bad('Area, tanggal, dan petugas wajib diisi');
        const pts: Row[] = Array.isArray(b.points) ? b.points : [];
        if (!pts.length) return bad('Minimal satu titik ukur');
        const kodes = new Set<string>();
        for (const pt of pts) {
          const leq = Number(pt.leq_dba), dur = Number(pt.durasi_menit);
          if (!pt.kode_titik?.trim()) return bad('Kode titik wajib diisi');
          if (kodes.has(pt.kode_titik.trim())) return bad(`Kode titik ganda: ${pt.kode_titik}`);
          kodes.add(pt.kode_titik.trim());
          if (!Number.isFinite(leq) || leq < 30 || leq > 140) return bad(`Leq titik ${pt.kode_titik} harus 30-140 dB(A)`);
          if (!Number.isFinite(dur) || dur < 5) return bad(`Durasi titik ${pt.kode_titik} minimal 5 menit (INK/015)`);
        }
        if (b.sertifikat_kalibrasi_sd && b.sertifikat_kalibrasi_sd < b.tanggal) {
          return bad('Sertifikat kalibrasi SLM sudah kedaluwarsa pada tanggal pengukuran');
        }
        const { data: s, error } = await db.from('hc_noise_survey').insert({
          area_id: b.area_id, tanggal: b.tanggal, tipe: b.tipe || 'BERKALA', petugas: String(b.petugas).trim(),
          slm_merk_tipe: b.slm_merk_tipe || null, slm_serial: b.slm_serial || null, slm_kelas: Number(b.slm_kelas) || 2,
          sertifikat_kalibrasi_sd: b.sertifikat_kalibrasi_sd || null,
          kalibrasi_sebelum_db: b.kalibrasi_sebelum_db === '' || b.kalibrasi_sebelum_db == null ? null : Number(b.kalibrasi_sebelum_db),
          kalibrasi_sesudah_db: b.kalibrasi_sesudah_db === '' || b.kalibrasi_sesudah_db == null ? null : Number(b.kalibrasi_sesudah_db),
          rambu_terpasang: !!b.rambu_terpasang, apt_tersedia: !!b.apt_tersedia,
          apt_nrr_tersedia: b.apt_nrr_tersedia ? Number(b.apt_nrr_tersedia) : null,
          catatan: b.catatan || null, status: 'FINAL', created_by: caller.name,
        }).select().single();
        if (error) throw new Error(error.message);
        const { error: pe } = await db.from('hc_noise_point').insert(pts.map(pt => ({
          survey_id: s.id, kode_titik: pt.kode_titik.trim(), deskripsi: pt.deskripsi || null,
          leq_dba: Number(pt.leq_dba), durasi_menit: Number(pt.durasi_menit),
        })));
        if (pe) { await db.from('hc_noise_survey').delete().eq('id', s.id); throw new Error(pe.message); }
        return ok(s);
      }
      case 'exposure': {
        if (!b.nik?.trim() || !b.nama?.trim()) return bad('NIK dan nama karyawan wajib diisi');
        if (!['A', 'B', 'C'].includes(b.kategori)) return bad('Kategori harus A, B, atau C');
        if (b.kategori === 'A' && !(Number(b.jam_per_hari_zona) >= 4)) return bad('Kategori A: terpajan minimal 4 jam/hari di zona Kuning/Merah (STD/033 6.3)');
        const { data, error } = await db.from('hc_exposure_class').insert({
          nik_hash: hashField(String(b.nik).trim()), national_id_hash: b.national_id ? hashField(String(b.national_id).trim()) : null,
          nik_enc: encrypt(String(b.nik).trim()), nama_enc: encrypt(String(b.nama).trim()),
          site: b.site || null, departemen: b.departemen || null, jabatan: b.jabatan || null,
          area_id: b.area_id || null, kategori: b.kategori,
          jam_per_hari_zona: b.jam_per_hari_zona === '' || b.jam_per_hari_zona == null ? null : Number(b.jam_per_hari_zona),
          tanggal_penetapan: b.tanggal_penetapan || today(), catatan: b.catatan || null, created_by: caller.name,
        }).select('id').single();
        if (error) throw new Error(error.code === '23505' ? 'Klasifikasi untuk karyawan dan tanggal ini sudah ada' : error.message);
        return ok(data);
      }
      case 'baseline': {
        if (!b.nik_hash || !b.mcu_record_id) return bad('nik_hash dan mcu_record_id wajib');
        const { data: rec } = await db.from('mcu_records').select('id,tgl_mcu').eq('id', b.mcu_record_id).maybeSingle();
        if (!rec) return bad('Data MCU tidak ditemukan');
        const { error } = await db.from('hc_baseline').upsert({
          nik_hash: b.nik_hash, mcu_record_id: String(rec.id), tanggal: rec.tgl_mcu, catatan: b.catatan || null, created_by: caller.name,
        });
        if (error) throw new Error(error.message);
        return ok({ saved: true });
      }
      case 'sts': {
        if (!b.nik_hash || !b.mcu_record_id) return bad('nik_hash dan mcu_record_id wajib');
        const { rows } = await loadAudiometriEval();
        const r = rows.find(x => x.nikHash === b.nik_hash);
        if (!r || !r.latest || r.latest.id !== String(b.mcu_record_id)) return bad('Hanya audiometri terbaru karyawan yang dapat dibuat kasus');
        if (!r.sts?.sts) return bad('Audiometri ini tidak memenuhi kriteria STS (geser rata-rata 2000/3000/4000 Hz < 10 dB)');
        const { data: exp } = await db.from('hc_exposure_class').select('nik_enc,nama_enc,site').eq('nik_hash', b.nik_hash)
          .order('tanggal_penetapan', { ascending: false }).limit(1).single();
        const telinga = r.sts.stsKanan && r.sts.stsKiri ? 'KEDUA' : r.sts.stsKanan ? 'KANAN' : 'KIRI';
        const { data, error } = await db.from('hc_sts_case').insert({
          nik_hash: b.nik_hash, nik_enc: exp?.nik_enc, nama_enc: exp?.nama_enc, site: exp?.site || null,
          mcu_record_id: r.latest.id, tanggal_deteksi: today(), telinga,
          geser_kanan: r.sts.geserKanan, geser_kiri: r.sts.geserKiri, berbasis_estimasi: r.sts.berbasisEstimasi,
          created_by: caller.name,
        }).select().single();
        if (error) throw new Error(error.code === '23505' ? 'Kasus STS untuk audiometri ini sudah dibuat' : error.message);
        return ok(data);
      }
      default: return bad('resource tidak dikenal');
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal menyimpan', 500);
  }
}

/* ───────── PATCH (tindak lanjut STS) ───────── */
const STS_FIELDS = ['status', 'retest_mcu_record_id', 'riwayat_non_okupasi', 'dilaporkan_qshe_manager_tgl', 'rujuk_tht',
  'rujuk_tht_tgl', 'kajian_pak', 'dilaporkan_disnaker_tgl', 'catatan'];

export async function PATCH(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const b: Row = await req.json().catch(() => ({}));
  if (b.resource !== 'sts' || !b.id) return bad('resource/id tidak valid');
  const patch: Row = {};
  for (const f of STS_FIELDS) if (f in b) patch[f] = b[f] === '' ? null : b[f];
  if (patch.rujuk_tht === false) patch.rujuk_tht_tgl = null;
  const { error } = await db.from('hc_sts_case').update(patch).eq('id', b.id);
  if (error) return fail(error.message, 500);
  return ok({ updated: true });
}

/* ───────── DELETE ───────── */
export async function DELETE(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  const id = p.get('id'), resource = p.get('resource');
  if (!id) return bad('id wajib');
  const table = resource === 'noise' ? 'hc_noise_survey' : resource === 'exposure' ? 'hc_exposure_class' : null;
  if (resource === 'area') {
    const { error } = await db.from('hc_area').update({ aktif: false }).eq('id', id);
    return error ? fail(error.message, 500) : ok({ deactivated: true });
  }
  if (!table) return bad('resource tidak dapat dihapus');
  const { error } = await db.from(table).delete().eq('id', id);
  return error ? fail(error.message, 500) : ok({ deleted: true });
}
