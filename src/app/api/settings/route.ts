import { NextRequest, NextResponse } from 'next/server';
import { integrationAdminClient } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, SYSTEM_ROLES } from '@/lib/server-auth';

/** Settings sistem hanya dapat dibaca oleh superuser. */
export async function GET(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  try {
    const { data, error } = await integrationAdminClient().from('app_settings').select('value').eq('key', 'app').maybeSingle();
    if (error) {
      console.error('[Settings] Failed to read application settings:', error.code);
      return NextResponse.json({ error: 'Gagal membaca pengaturan.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, settings: data?.value ?? null });
  } catch {
    return NextResponse.json({ error: 'Layanan pengaturan belum dikonfigurasi.' }, { status: 503 });
  }
}

/** PUT — superuser saja. */
export async function PUT(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  try {
    const { error } = await integrationAdminClient().from('app_settings').upsert({
      key: 'app',
      value: body,
      updated_by: caller!.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[Settings] Failed to save application settings:', error.code);
      return NextResponse.json({ error: 'Gagal menyimpan pengaturan.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Layanan pengaturan belum dikonfigurasi.' }, { status: 503 });
  }
}
