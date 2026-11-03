import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ success: false, error: 'ID kunjungan tidak valid.' }, { status: 400 });
  }

  try {
    const client = integrationAdminClient();
    if (caller!.role === 'pic') {
      if (!caller!.site) {
        return NextResponse.json({ success: false, error: 'Site PIC belum ditetapkan.' }, { status: 403 });
      }
      const { data: visit, error: visitError } = await client
        .from('kunjungan_berobat')
        .select('jobsite')
        .eq('id', id)
        .maybeSingle();
      if (visitError) {
        console.error('[Kunjungan audit] Failed to verify visit scope:', visitError.code);
        return NextResponse.json({ success: false, error: 'Gagal memeriksa akses riwayat kunjungan.' }, { status: 500 });
      }
      if (!visit || String(visit.jobsite).toLowerCase() !== caller!.site.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'Akses ke riwayat kunjungan ditolak.' }, { status: 403 });
      }
    }

    const { data, error } = await client
      .from('kunjungan_berobat_audit')
      .select('id,action,actor_user_id,actor_role,occurred_at,before_data,after_data')
      .eq('kunjungan_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[Kunjungan audit] Failed to read audit trail:', error.code);
      return NextResponse.json({ success: false, error: 'Gagal mengambil riwayat kunjungan.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: data || [] });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal mengambil riwayat kunjungan.' }, { status: 500 });
  }
}
