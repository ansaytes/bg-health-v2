// src/app/api/hra/route.ts — Health Hazard Risk Assessment (FORM/069 Rev.001)
// GET   ?resource=list|detail|dashboard
// POST  {resource:'assessment', ...}      — simpan HRA (superuser+admin)
// DELETE ?id=
import { NextRequest } from 'next/server';
import { hitungRisikoHra, klasifikasiR, pDariJamPaparan, type KontrolTingkat } from '@/lib/hra';
import { ADMIN_ROLES, db, fail, ok, requireCaller, today } from '@/lib/hc-ergo-server';

export const dynamic = 'force-dynamic';
type Row = Record<string, any>;

export async function GET(req: NextRequest) {
  const auth = await requireCaller(req, [...ADMIN_ROLES, 'manager']);
  if ('error' in auth) return auth.error;
  const p = new URL(req.url).searchParams;
  const resource = p.get('resource') || 'list';
  try {
    if (resource === 'list') {
      let q = db.from('hra_assessments').select('*, hra_hazards(*)').order('tanggal', { ascending: false }).limit(200);
      const lokasi = p.get('lokasi');
      if (lokasi && lokasi !== 'all') q = q.eq('lokasi_kerja', lokasi);
      const divisi = p.get('divisi');
      if (divisi && divisi !== 'all') q = q.eq('divisi_departemen', divisi);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return ok(data);
    }
    if (resource === 'dashboard') {
      return ok(await buildDashboard());
    }
    return fail('resource tidak dikenal');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memuat HRA', 500);
  }
}

async function buildDashboard() {
  const { data: assessments } = await db.from('hra_assessments').select('id,lokasi_kerja,divisi_departemen,tanggal,batas_review');
  const ids = (assessments || []).map((a: Row) => a.id);
  const { data: hazards } = ids.length
    ? await db.from('hra_hazards').select('hra_id,jenis_hazard,kelompok_berisiko,init_r,res_r,init_e,res_e').in('hra_id', ids)
    : { data: [] };

  const rows = (hazards || []) as Row[];
  const byJenis: Record<string, number> = { Fisika: 0, Kimia: 0, Biologi: 0, Ergonomi: 0, Psikososial: 0 };
  const byKelas = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  const highRiskRows: Row[] = [];
  for (const h of rows) {
    const kelas = klasifikasiR(h.res_r);
    byKelas[kelas] += 1;
    const jenis = String(h.jenis_hazard || '').split('/')[0].trim();
    if (jenis in byJenis) byJenis[jenis] += 1;
    if (kelas === 'HIGH') highRiskRows.push(h);
  }

  // HRA yang melewati batas review (FORM/069: wajib diperiksa ulang).
  const t = today();
  const lewatReview = (assessments || []).filter((a: Row) => a.batas_review && a.batas_review < t);

  return {
    totalHazard: rows.length,
    byJenis,
    byKelas,
    highRiskRows: highRiskRows.slice(0, 10),
    totalAssessment: (assessments || []).length,
    lewatReview,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireCaller(req, ADMIN_ROLES);
  if ('error' in auth) return auth.error;
  const b: Row = await req.json().catch(() => ({}));
  try {
    if (b.resource !== 'assessment') return fail('resource tidak dikenal');
    for (const k of ['lokasi_kerja', 'divisi_departemen']) {
      if (!String(b[k] ?? '').trim()) return fail(`Field ${k} wajib diisi`);
    }
    const hazards: Row[] = Array.isArray(b.hazards) ? b.hazards : [];
    if (!hazards.length) return fail('Minimal satu baris hazard wajib diisi');

    // Hitung P/R server-side dari jam paparan + kontrol (matriks Rev.01).
    const computed = hazards.map((h, i) => {
      const hasil = hitungRisikoHra({
        jamPaparanMingguan: Number(h.jamPaparanMingguan || 0),
        e: Number(h.e || 1),
        lewatNab: !!h.lewatNab,
        sumberHazard: String(h.sumberHazard || ''),
        prevalensiMerok: h.prevalensiMerok ?? null,
        isHazardMerok: !!h.isHazardMerok,
        kontrolTingkat: (h.kontrolTingkat || 'APD') as KontrolTingkat,
      });
      return {
        no_urut: i + 1,
        jenis_pekerjaan: String(h.jenisPekerjaan || '').trim(),
        jenis_hazard: String(h.jenisHazard || '').trim(),
        sumber_hazard: String(h.sumberHazard || '').trim(),
        kelompok_berisiko: String(h.kelompokBerisiko || '').trim(),
        efek_kesehatan: String(h.efekKesehatan || '').trim(),
        efek_akut: h.efekAkut || null,
        efek_kronis: h.efekKronis || null,
        init_p: hasil.initial.p, init_e: hasil.initial.e, init_r: hasil.initial.r,
        tindakan_pencegahan: String(h.tindakanPencegahan || '').trim(),
        kontrol_tingkat: h.kontrolTingkat || 'APD',
        res_p: hasil.residual.p, res_e: hasil.residual.e, res_r: hasil.residual.r,
        regulasi: h.regulasi || null,
      };
    });

    const { data, error } = await db.from('hra_assessments').insert({
      lokasi_kerja: b.lokasi_kerja, divisi_departemen: b.divisi_departemen.trim(),
      tanggal: b.tanggal || today(),
      tgl_penerbitan: b.tgl_penerbitan || today(),
      tgl_persetujuan: b.tgl_persetujuan || null,
      dibuat_oleh: b.dibuat_oleh || auth.caller.name,
      diperiksa_oleh: b.diperiksa_oleh || null,
      disetujui_oleh: b.disetujui_oleh || null,
      batas_review: b.batas_review || null,
    }).select().single();
    if (error) throw new Error(error.message);

    const { error: hErr } = await db.from('hra_hazards')
      .insert(computed.map((c) => ({ ...c, hra_id: data.id })));
    if (hErr) throw new Error(hErr.message);

    return ok(data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal menyimpan HRA', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCaller(req, ADMIN_ROLES);
  if ('error' in auth) return auth.error;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('id wajib disertakan');
  const { error } = await db.from('hra_assessments').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}
