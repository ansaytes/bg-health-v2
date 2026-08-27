import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* ═══════════════════════════════════
   Auth helper — verify session & admin role
   ═══════════════════════════════════ */
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }
  if (!accessToken) return { error: 'Tidak terautentikasi', status: 401 };

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { error: 'Sesi tidak valid', status: 401 };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile || !['superuser', 'administrator'].includes(profile.role)) {
    return { error: 'Akses ditolak. Hanya admin/superuser.', status: 403 };
  }

  return { userId: user.id, role: profile.role };
}

/* ═══════════════════════════════════
   PATCH — Update man_power by ID
   ═══════════════════════════════════ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    const allowedFields = ['jobsite', 'bulan', 'tahun', 'man_power', 'kunjungan_klinik', 'hari_kerja'];

    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diperbarui' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('man_power')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui data man power';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   DELETE — Delete man_power by ID
   ═══════════════════════════════════ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('man_power')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Data Man Power berhasil dihapus' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus data man power';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
