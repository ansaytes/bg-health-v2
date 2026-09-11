import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function getCallerRole(req: NextRequest): Promise<{ userId: string; role: string } | null> {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }
  if (!accessToken) return null;

  const client = supabaseServiceKey ? supabaseAdmin : supabase;
  const { data: { user }, error } = await client.auth.getUser(accessToken);
  if (error || !user) return null;

  const { data: profile } = await client
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, role: profile.role };
}

/** GET /api/health-campaigns — list active campaigns (public) */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('health_campaigns')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ campaigns: [] });
    return NextResponse.json({ campaigns: data || [] });
  } catch {
    return NextResponse.json({ campaigns: [] });
  }
}

/** POST /api/health-campaigns — create campaign (admin/superuser only) */
export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || !['superuser', 'administrator'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, image_url, content, is_active } = body;

    if (!title) {
      return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 });
    }

    const client = supabaseServiceKey ? supabaseAdmin : supabase;
    const { data, error } = await client
      .from('health_campaigns')
      .insert({
        title,
        description: description || null,
        image_url: image_url || null,
        content: content || null,
        author_id: caller.userId,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/health-campaigns — update campaign (admin/superuser only) */
export async function PATCH(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || !['superuser', 'administrator'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID kampanye wajib diisi' }, { status: 400 });
    }

    delete updates.id;
    delete updates.created_at;
    delete updates.author_id;

    const client = supabaseServiceKey ? supabaseAdmin : supabase;
    const { data, error } = await client
      .from('health_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan server';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE /api/health-campaigns?id=xxx (admin/superuser only) */
export async function DELETE(req: NextRequest) {
  try {
    const caller = await getCallerRole(req);
    if (!caller || !['superuser', 'administrator'].includes(caller.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('id');

    if (!campaignId) {
      return NextResponse.json({ error: 'ID kampanye wajib diisi' }, { status: 400 });
    }

    const client = supabaseServiceKey ? supabaseAdmin : supabase;
    const { error } = await client
      .from('health_campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Kampanye berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
