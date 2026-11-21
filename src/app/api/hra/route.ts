// src/app/api/hra/route.ts — Health Hazard Risk Assessment API (FORM/069 Rev.001)
// Murni beroperasi langsung dengan tabel Supabase:
//   - public.hra_assessments
//   - public.hra_hazards
//   - public.hra_mapping_jabatan
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_ROLES, db, fail, ok, requireCaller } from '@/lib/hc-ergo-server';
import type { HraHazardEntry, LevelRisiko } from '@/lib/hra';
import { getKategoriRisiko, hitungSkorRisiko } from '@/lib/hra';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const resource = p.get('resource') || 'hazards';

  try {
    // 1. Resource: Mapping Jabatan ke Risiko (dari tabel `hra_mapping_jabatan`)
    if (resource === 'mapping') {
      const { data, error } = await db
        .from('hra_mapping_jabatan')
        .select('*')
        .order('nomor', { ascending: true })
        .limit(500);

      if (error) {
        return ok([]);
      }
      return ok(data || []);
    }

    // 2. Resource: Dashboard / Ringkasan Metrik
    if (resource === 'dashboard') {
      const { data, error } = await db.from('hra_hazards').select('*').limit(1000);
      const all: HraHazardEntry[] = (!error && data) ? data.map(mapDbToEntry) : [];

      const total = all.length;
      let tinggi = 0;
      let sedang = 0;
      let rendah = 0;
      const perDept: Record<string, number> = {};
      const perJenis: Record<string, number> = {};

      all.forEach((h) => {
        const r = h.init_r;
        if (r >= 15) tinggi++;
        else if (r >= 5) sedang++;
        else rendah++;

        const d = h.departemen || 'LAINNYA';
        perDept[d] = (perDept[d] || 0) + 1;

        const j = h.jenis_hazard || 'Lainnya';
        perJenis[j] = (perJenis[j] || 0) + 1;
      });

      return ok({
        total,
        ringkasan: { tinggi, sedang, rendah },
        perDept,
        perJenis,
      });
    }

    // 3. Resource Default: Fetch Hazards dari tabel `hra_hazards`
    const dept = p.get('dept');
    const hazardType = p.get('hazard');
    const riskLevel = p.get('risk') as LevelRisiko | null;
    const search = (p.get('search') || '').toLowerCase().trim();

    let q = db
      .from('hra_hazards')
      .select('*, hra_assessments(divisi_departemen, lokasi_kerja, no_dokumen)')
      .order('no_urut', { ascending: true })
      .limit(1000);

    if (dept && dept !== 'ALL') {
      q = q.ilike('departemen', dept);
    }

    if (hazardType && hazardType !== 'ALL') {
      q = q.ilike('jenis_hazard', `%${hazardType}%`);
    }

    const { data, error } = await q;
    if (error) {
      return ok([]);
    }

    let items: HraHazardEntry[] = (data || []).map(mapDbToEntry);

    // Filter Kategori Risiko di level data jika diminta
    if (riskLevel && (riskLevel as any) !== 'ALL') {
      items = items.filter((h) => getKategoriRisiko(h.init_r) === riskLevel);
    }

    // Filter Search Text
    if (search) {
      items = items.filter(
        (h) =>
          (h.jenis_pekerjaan || '').toLowerCase().includes(search) ||
          (h.sumber_hazard || '').toLowerCase().includes(search) ||
          (h.kelompok_beresiko || '').toLowerCase().includes(search) ||
          (h.efek_kesehatan || '').toLowerCase().includes(search) ||
          (h.regulasi || '').toLowerCase().includes(search)
      );
    }

    return ok(items);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memproses permintaan HRA', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const init_p = Number(body.init_p) || 1;
    const init_e = Number(body.init_e) || 1;
    const init_r = hitungSkorRisiko(init_p, init_e);

    const res_p = Number(body.res_p) || 1;
    const res_e = Number(body.res_e) || 1;
    const res_r = hitungSkorRisiko(res_p, res_e);

    const payload = {
      departemen: String(body.departemen || 'OPERATION').trim(),
      no_urut: Number(body.nomor_urut) || null,
      jenis_pekerjaan: String(body.jenis_pekerjaan || '').trim(),
      jenis_hazard: String(body.jenis_hazard || 'Fisika').trim(),
      sumber_hazard: String(body.sumber_hazard || '').trim(),
      kelompok_berisiko: String(body.kelompok_beresiko || '').trim(),
      efek_kesehatan: String(body.efek_kesehatan || '').trim(),
      init_p,
      init_e,
      init_r,
      tindakan_pencegahan: String(body.tindakan_pencegahan || '').trim(),
      kontrol_tingkat: body.kontrol_tingkat || 'APD',
      res_p,
      res_e,
      res_r,
      regulasi: String(body.regulasi || '').trim(),
    };

    // Simpan ke Supabase
    const { data, error } = await db
      .from('hra_hazards')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok(mapDbToEntry(data));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal menyimpan entri HRA', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id;
    if (!id) return fail('ID entri HRA wajib diberikan', 400);

    const init_p = Number(body.init_p) || 1;
    const init_e = Number(body.init_e) || 1;
    const res_p = Number(body.res_p) || 1;
    const res_e = Number(body.res_e) || 1;

    const payload = {
      departemen: body.departemen,
      no_urut: body.nomor_urut,
      jenis_pekerjaan: body.jenis_pekerjaan,
      jenis_hazard: body.jenis_hazard,
      sumber_hazard: body.sumber_hazard,
      kelompok_berisiko: body.kelompok_beresiko,
      efek_kesehatan: body.efek_kesehatan,
      init_p,
      init_e,
      init_r: hitungSkorRisiko(init_p, init_e),
      tindakan_pencegahan: body.tindakan_pencegahan,
      kontrol_tingkat: body.kontrol_tingkat,
      res_p,
      res_e,
      res_r: hitungSkorRisiko(res_p, res_e),
      regulasi: body.regulasi,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from('hra_hazards')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return fail(error.message, 500);
    }

    return ok(mapDbToEntry(data));
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal memperbarui entri HRA', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const p = new URL(req.url).searchParams;
    const id = p.get('id');
    if (!id) return fail('ID entri HRA wajib diberikan', 400);

    const { error } = await db.from('hra_hazards').delete().eq('id', id);
    if (error) {
      return fail(error.message, 500);
    }

    return ok({ success: true, deletedId: id });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Gagal menghapus entri HRA', 500);
  }
}

/** Helper konversi baris database Supabase ke model HraHazardEntry */
function mapDbToEntry(row: any): HraHazardEntry {
  return {
    id: row.id,
    departemen: row.departemen || row.hra_assessments?.divisi_departemen || 'OPERATION',
    nomor_urut: row.no_urut,
    jenis_pekerjaan: row.jenis_pekerjaan,
    jenis_hazard: row.jenis_hazard,
    sumber_hazard: row.sumber_hazard,
    kelompok_beresiko: row.kelompok_berisiko,
    efek_kesehatan: row.efek_kesehatan,
    init_p: row.init_p,
    init_e: row.init_e,
    init_r: row.init_r,
    tindakan_pencegahan: row.tindakan_pencegahan,
    kontrol_tingkat: row.kontrol_tingkat || 'APD',
    res_p: row.res_p,
    res_e: row.res_e,
    res_r: row.res_r,
    regulasi: row.regulasi,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
