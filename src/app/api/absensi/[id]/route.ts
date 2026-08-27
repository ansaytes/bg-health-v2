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
   PATCH — Update absensi_sakit by ID
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

    // Build update object — only include fields that are provided
    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'nik', 'nama', 'jobsite', 'jabatan', 'bulan', 'tahun',
      'tgl_mulai_a', 'tgl_selesai_a', 'hari_a', 'diag_a',
      'tgl_mulai_b', 'tgl_selesai_b', 'hari_b', 'diag_b',
      'tgl_mulai_c', 'tgl_selesai_c', 'hari_c', 'diag_c',
      'spell', 'is_pak',
    ];

    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diperbarui' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('absensi_sakit')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui data absensi';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   DELETE — Delete absensi_sakit by ID
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
      .from('absensi_sakit')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Data absensi berhasil dihapus' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghapus data absensi';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
