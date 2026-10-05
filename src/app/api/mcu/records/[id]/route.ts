import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const client = createClient(url, serviceKey);

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;
    if (!token) return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });

    const { data: { user } } = await client.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Akses ditolak' }, { status: 401 });

    const { data: profile } = await client.from('user_profiles').select('role').eq('user_id', user.id).single();
    if (!profile || profile.role !== 'superuser') {
      return NextResponse.json({ error: 'Hanya superuser yang dapat menghapus data' }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    const { error } = await client.from('mcu_records').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal menghapus data' }, { status: 500 });
  }
}
