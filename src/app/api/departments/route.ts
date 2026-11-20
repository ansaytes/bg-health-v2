import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, READ_ROLES, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/departments — daftar departemen dinamis dari database (tabel employees & monitor_mcu).
 * Single Source of Truth agar tidak ada hardcode statis di komponen frontend.
 */
export async function GET(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, READ_ROLES);
  if (denied) return denied;

  const client = integrationAdminClient();

  try {
    // 1. Ambil distinct department dari monitor_mcu / employees
    const { data, error } = await client
      .from('monitor_mcu')
      .select('department')
      .not('department', 'is', null)
      .limit(5000);

    if (error || !data || data.length === 0) {
      // Fallback bila view belum ada data
      const { data: empData, error: empError } = await client
        .from('employees')
        .select('department')
        .not('department', 'is', null)
        .limit(5000);

      if (empError) {
        return NextResponse.json({ success: true, departments: [] });
      }

      const unique = [...new Set((empData || []).map((r: { department: string }) => r.department?.trim()).filter(Boolean))].sort();
      return NextResponse.json({ success: true, departments: unique });
    }

    const unique = [...new Set((data || []).map((r: { department: string }) => r.department?.trim()).filter(Boolean))].sort();
    return NextResponse.json({ success: true, departments: unique });
  } catch {
    return NextResponse.json({ success: true, departments: [] });
  }
}
