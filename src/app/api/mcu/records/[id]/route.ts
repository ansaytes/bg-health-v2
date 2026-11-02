import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, SYSTEM_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

const client = () => integrationAdminClient();

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, SYSTEM_ROLES);
    if (denied) return denied;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    const { error } = await client().from('mcu_records').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus data MCU' }, { status: 500 });
  }
}
