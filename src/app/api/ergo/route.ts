// src/app/api/ergo/route.ts — Ergonomi RULA/ROSA/WERA (STD/036, INK/013, FORM/116-118)
// GET   ?resource=survey|recommendation|dashboard
// POST  {resource:'survey'|'recommendation', ...}
// PATCH {resource:'survey', id, action:'approve'|'reject'|'pica', pica_no?}  |  {resource:'recommendation', id, ...}
// DELETE ?resource=survey|recommendation&id=
import { NextRequest } from 'next/server';
import { addWorkdays, scoreErgo, type Metode } from '@/lib/hc-ergo';
import { db, fail, ok, requireCaller, today } from '@/lib/hc-ergo-server';

export const dynamic = 'force-dynamic';
type Row = Record<string, any>;
const METODE: Metode[] = ['RULA', 'ROSA', 'WERA'];

export async function GET(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  const resource = p.get('resource') || 'dashboard';
  try {
    if (resource === 'survey') {
      let q = db.from('ergo_survey').select('*').order('tanggal', { ascending: false }).limit(500);
      for (const k of ['site', 'metode', 'status']) { const v = p.get(k); if (v && v !== 'all') q = q.eq(k, v); }
      const tahun = p.get('tahun');
      if (tahun && tahun !== 'all') q = q.gte('tanggal', `${tahun}-01-01`).lte('tanggal', `${tahun}-12-31`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return ok(data);
    }
    if (resource === 'recommendation') {
      let q = db.from('ergo_recommendation').select('*, ergo_survey(metode,site,area_kerja,tanggal,klasifikasi)').order('due_date');
      const sid = p.get('survey_id'); if (sid) q = q.eq('survey_id', sid);
      if (p.get('open') === 'true') q = q.neq('status', 'CLOSED');
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return ok(data);
    }
    if (resource === 'dashboard') return ok(await buildDashboard(p.get('site') || ''));
    return fail('resource tidak dikenal');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memuat data', 500);
  }
}

async function buildDashboard(site: string) {
  const siteOk = (s: unknown) => !site || site === 'All Site' || s === site;
  const since = new Date(); since.setMonth(since.getMonth() - 12); since.setDate(1);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data: all } = await db.from('ergo_survey')
    .select('id,metode,sumber,site,area_kerja,tanggal,klasifikasi,skor_akhir,perlu_pica,status,sah')
    .gte('tanggal', sinceStr).order('tanggal', { ascending: false });
  const sv = (all || []).filter(s => siteOk(s.site));
  const approved = sv.filter(s => s.status === 'DISETUJUI');
  const byMetode: Record<string, number> = { RULA: 0, ROSA: 0, WERA: 0 };
  const byKlas: Record<string, Record<string, number>> = {};
  for (const s of approved) {
    byMetode[s.metode]++;
    byKlas[s.metode] = byKlas[s.metode] || { RENDAH: 0, SEDANG: 0, TINGGI: 0, SANGAT_TINGGI: 0 };
    byKlas[s.metode][s.klasifikasi]++;
  }
  // tren bulanan 12 bulan
  const months: string[] = [];
  const d = new Date(); d.setDate(1);
  for (let i = 11; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`); }
  const trend = months.map(m => ({
    bulan: m,
    total: approved.filter(s => s.tanggal.startsWith(m)).length,
    sedangKeAtas: approved.filter(s => s.tanggal.startsWith(m) && s.perlu_pica).length,
  }));
  // kepatuhan per site: internal >=1/bulan ini, pihak ketiga >=1/12 bulan (STD/036)
  const thisMonth = months[months.length - 1];
  const { data: sitesData } = await db.from('ergo_survey').select('site');
  const siteList = [...new Set((sitesData || []).map(s => s.site))].filter(siteOk).sort();
  const kepatuhan = siteList.map(st => ({
    site: st,
    internalBulanIni: approved.filter(s => s.site === st && s.sumber === 'INTERNAL' && s.tanggal.startsWith(thisMonth)).length,
    pihakKetiga12Bulan: approved.filter(s => s.site === st && s.sumber === 'PIHAK_KETIGA').length,
  }));
  const { data: recs } = await db.from('ergo_recommendation').select('status,due_date,survey_id, ergo_survey(site)');
  const rc = (recs || []).filter((r: Row) => siteOk(r.ergo_survey?.site));
  const t = today();
  return {
    totalDisetujui: approved.length,
    menungguPersetujuan: sv.filter(s => s.status === 'MENUNGGU_PERSETUJUAN').length,
    perluDiulang: sv.filter(s => s.status === 'DITOLAK_ULANG').length,
    byMetode, byKlas, trend, kepatuhan,
    rekomendasi: {
      open: rc.filter((r: Row) => r.status === 'OPEN').length,
      progress: rc.filter((r: Row) => r.status === 'PROGRESS').length,
      closed: rc.filter((r: Row) => r.status === 'CLOSED').length,
      lewatJatuhTempo: rc.filter((r: Row) => r.status !== 'CLOSED' && r.due_date < t).length,
    },
    risikoTinggi: approved.filter(s => ['TINGGI', 'SANGAT_TINGGI'].includes(s.klasifikasi)).slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const { caller } = auth;
  const b: Row = await req.json().catch(() => ({}));
  try {
    if (b.resource === 'survey') {
      if (!METODE.includes(b.metode)) return fail('Metode harus RULA, ROSA, atau WERA');
      for (const k of ['site', 'area_kerja', 'tanggal', 'departemen', 'aktivitas', 'personil_pengukur', 'kualifikasi_pengukur', 'pekerja_diamati']) {
        if (!String(b[k] ?? '').trim()) return fail(`Field ${k.replace(/_/g, ' ')} wajib diisi`);
      }
      const input: Record<string, number> = {};
      for (const [k, v] of Object.entries(b.input || {})) input[k] = Number(v);
      let sc: ReturnType<typeof scoreErgo>;
      try { sc = scoreErgo(b.metode, input); } catch (e) { return fail(e instanceof Error ? e.message : 'Input skor tidak valid'); }
      const oks = {
        ok_personil_kompeten: !!b.ok_personil_kompeten, ok_metode_sesuai: !!b.ok_metode_sesuai,
        ok_kondisi_representatif: !!b.ok_kondisi_representatif, ok_dokumentasi_lengkap: !!b.ok_dokumentasi_lengkap,
      };
      const sah = Object.values(oks).every(Boolean);
      const { data, error } = await db.from('ergo_survey').insert({
        metode: b.metode, sumber: b.sumber === 'PIHAK_KETIGA' ? 'PIHAK_KETIGA' : 'INTERNAL',
        site: b.site, area_kerja: b.area_kerja.trim(), tanggal: b.tanggal, departemen: b.departemen.trim(),
        aktivitas: b.aktivitas.trim(), personil_pengukur: b.personil_pengukur.trim(),
        kualifikasi_pengukur: b.kualifikasi_pengukur.trim(), pekerja_diamati: b.pekerja_diamati.trim(),
        foto_url: b.foto_url || null, ...oks, input, hasil: sc.hasil, skor_akhir: sc.skorAkhir,
        klasifikasi: sc.klasifikasi, perlu_pica: sc.perluPica, batas_tindak_hari_kerja: sc.batasHari,
        // STD/036 6.10: hasil tidak sah wajib diulang
        status: sah ? 'MENUNGGU_PERSETUJUAN' : 'DITOLAK_ULANG', dibuat_oleh: caller.name,
      }).select().single();
      if (error) throw new Error(error.message);
      return ok(data, { sah, pesan: sah ? undefined : 'Hasil tidak sah (ada syarat STD/036 pasal 6.10 yang belum terpenuhi): pengukuran wajib diulang.' });
    }
    if (b.resource === 'recommendation') {
      for (const k of ['survey_id', 'problem', 'tindakan', 'pic', 'due_date']) if (!String(b[k] ?? '').trim()) return fail(`Field ${k} wajib diisi`);
      const { data: sv } = await db.from('ergo_survey').select('tgl_disetujui').eq('id', b.survey_id).maybeSingle();
      if (!sv) return fail('Survei tidak ditemukan');
      const { data, error } = await db.from('ergo_recommendation').insert({
        survey_id: b.survey_id, problem: b.problem.trim(), tindakan: b.tindakan.trim(), pic: b.pic.trim(),
        due_date: b.due_date, pica_no: b.pica_no || null,
        batas_verifikasi: sv.tgl_disetujui ? addWorkdays(sv.tgl_disetujui, 30) : null,
      }).select().single();
      if (error) throw new Error(error.message);
      return ok(data);
    }
    return fail('resource tidak dikenal');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal menyimpan', 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const { caller } = auth;
  const b: Row = await req.json().catch(() => ({}));
  if (!b.id) return fail('id wajib');
  try {
    if (b.resource === 'survey') {
      if (b.action === 'approve') {
        const { data: s } = await db.from('ergo_survey').select('sah,status').eq('id', b.id).maybeSingle();
        if (!s) return fail('Survei tidak ditemukan');
        if (!s.sah) return fail('Hasil tidak sah (STD/036 6.10): tidak dapat disetujui, pengukuran wajib diulang');
        const t = today();
        const { error } = await db.from('ergo_survey').update({ status: 'DISETUJUI', disetujui_oleh: caller.name, tgl_disetujui: t, pica_no: b.pica_no || null }).eq('id', b.id);
        if (error) throw new Error(error.message);
        // verifikasi efektivitas maks 30 hari kerja sejak laporan disetujui (STD/036)
        await db.from('ergo_recommendation').update({ batas_verifikasi: addWorkdays(t, 30) }).eq('survey_id', b.id).is('batas_verifikasi', null);
        return ok({ approved: true });
      }
      if (b.action === 'reject') {
        const { error } = await db.from('ergo_survey').update({ status: 'DITOLAK_ULANG', disetujui_oleh: null, tgl_disetujui: null }).eq('id', b.id);
        if (error) throw new Error(error.message);
        return ok({ rejected: true });
      }
      if (b.action === 'pica') {
        const { error } = await db.from('ergo_survey').update({ pica_no: b.pica_no || null }).eq('id', b.id);
        if (error) throw new Error(error.message);
        return ok({ updated: true });
      }
      return fail('action tidak dikenal');
    }
    if (b.resource === 'recommendation') {
      const patch: Row = {};
      for (const f of ['status', 'pica_no', 'tgl_closed', 'verifikasi_tgl', 'verifikasi_ket', 'due_date', 'pic']) if (f in b) patch[f] = b[f] === '' ? null : b[f];
      if (patch.status === 'CLOSED' && !patch.tgl_closed) patch.tgl_closed = today();
      const { error } = await db.from('ergo_recommendation').update(patch).eq('id', b.id);
      if (error) throw new Error(error.message);
      return ok({ updated: true });
    }
    return fail('resource tidak dikenal');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memperbarui', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCaller(req);
  if ('error' in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  const table = p.get('resource') === 'survey' ? 'ergo_survey' : p.get('resource') === 'recommendation' ? 'ergo_recommendation' : null;
  const id = p.get('id');
  if (!table || !id) return fail('resource/id tidak valid');
  const { error } = await db.from(table).delete().eq('id', id);
  return error ? fail(error.message, 500) : ok({ deleted: true });
}
