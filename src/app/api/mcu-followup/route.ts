import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildDatasetEfektif, type MCUFollowUp } from '@/lib/mcu-followup';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const client = createClient(url, serviceKey || anonKey);

async function getCaller(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
  if (!token) return null;
  if (token === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
    return { role: process.env.NEXT_PUBLIC_PREVIEW_ROLE };
  }
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await client.from('user_profiles').select('role').eq('user_id', user.id).single();
  return profile;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    if (!caller || !['pic', 'superuser', 'administrator', 'user'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mcuRecordId = searchParams.get('mcu_record_id');
    const nikKaryawan = searchParams.get('nik_karyawan');
    const withEffective = searchParams.get('with_effective') === 'true';

    if (!mcuRecordId && !nikKaryawan) {
      return NextResponse.json({ error: 'mcu_record_id atau nik_karyawan harus disertakan' }, { status: 400 });
    }

    let query = client.from('mcu_followups').select('*').order('kunjungan_ke', { ascending: true });

    if (mcuRecordId) {
      query = query.eq('mcu_record_id', mcuRecordId);
    } else if (nikKaryawan) {
      query = query.eq('nik_karyawan', nikKaryawan);
    }

    const { data: followups, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Jika diminta perhitungan dataset efektif dan mcu_record_id tersedia
    if (withEffective && mcuRecordId) {
      const { data: baseline, error: baselineError } = await client
        .from('mcu_records')
        .select('*')
        .eq('id', mcuRecordId)
        .maybeSingle();

      if (!baselineError && baseline) {
        const datasetEfektif = buildDatasetEfektif(baseline, (followups || []) as MCUFollowUp[]);
        return NextResponse.json({
          followups: followups || [],
          datasetEfektif,
        });
      }
    }

    return NextResponse.json({ followups: followups || [] });
  } catch (err: any) {
    console.error('Error fetching mcu followups:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    if (!caller || !['pic', 'superuser', 'administrator'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      mcu_record_id,
      nik_karyawan,
      kunjungan_ke,
      tgl_fu,
      lokasi_fu,
      dokter_pemeriksa,
      hasil_parameters,
      catatan,
      kesimpulan,
      link_dokumen,
      rekomendasi_berikutnya,
    } = body;

    if (!mcu_record_id || !nik_karyawan || !kunjungan_ke) {
      return NextResponse.json(
        { error: 'mcu_record_id, nik_karyawan, dan kunjungan_ke wajib diisi' },
        { status: 400 }
      );
    }

    const payload = {
      mcu_record_id,
      nik_karyawan,
      kunjungan_ke: Number(kunjungan_ke),
      tgl_fu: tgl_fu || null,
      lokasi_fu: lokasi_fu || null,
      dokter_pemeriksa: dokter_pemeriksa || null,
      hasil_parameters: hasil_parameters || {},
      catatan: catatan || null,
      kesimpulan: kesimpulan || null,
      link_dokumen: link_dokumen || null,
      rekomendasi_berikutnya: rekomendasi_berikutnya || null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      result = await client
        .from('mcu_followups')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    } else {
      result = await client
        .from('mcu_followups')
        .upsert(payload, { onConflict: 'mcu_record_id,kunjungan_ke' })
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, followup: result.data });
  } catch (err: any) {
    console.error('Error saving mcu followup:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getCaller(req);
    if (!caller || !['pic', 'superuser', 'administrator'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id wajib disertakan' }, { status: 400 });
    }

    const { error } = await client.from('mcu_followups').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting mcu followup:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
