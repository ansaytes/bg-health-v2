import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';

const KUNJUNGAN_ADMIN_ROLES = ['superuser', 'administrator'] as const;

/* ═══════════════════════════════════
   PATCH — Update kunjungan_berobat by ID
   ═══════════════════════════════════ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, KUNJUNGAN_ADMIN_ROLES);
    if (denied) return denied;

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body permintaan tidak valid' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'nik', 'nama', 'departemen', 'jobsite', 'tanggal',
      'diagnosa', 'jenis_obat', 'izin_absen', 'rujuk_rs', 'nama_rs',
      'usia', 'jk', 'jabatan', 'keluhan', 'kategori',
    ];

    for (const key of allowedFields) {
      if (key in body) {
        const value = (body as Record<string, unknown>)[key];
        if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          return NextResponse.json({ error: `Field ${key} tidak valid` }, { status: 400 });
        }
        updates[key] = typeof value === 'string' ? value.slice(0, 2000) : value;
      }
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diperbarui' }, { status: 400 });
    }
    updates.updated_by = caller!.userId;
    updates.updated_by_role = caller!.role;

    const { data, error } = await integrationAdminClient()
      .from('kunjungan_berobat')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Kunjungan] Failed to update record:', error.code);
      return NextResponse.json({ error: 'Gagal memperbarui data kunjungan' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Data kunjungan tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui data kunjungan' }, { status: 500 });
  }
}

/* ═══════════════════════════════════
   DELETE — Delete kunjungan_berobat by ID
   ═══════════════════════════════════ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getServerCaller(request);
    const denied = requireServerRole(caller, KUNJUNGAN_ADMIN_ROLES);
    if (denied) return denied;

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });

    const client = integrationAdminClient();
    const { error: attributionError } = await client
      .from('kunjungan_berobat')
      .update({ updated_by: caller!.userId, updated_by_role: caller!.role })
      .eq('id', id);
    if (attributionError) {
      console.error('[Kunjungan] Failed to attribute deletion:', attributionError.code);
      return NextResponse.json({ error: 'Gagal mencatat pelaku penghapusan data kunjungan.' }, { status: 500 });
    }

    const { data, error } = await client
      .from('kunjungan_berobat')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('[Kunjungan] Failed to delete record:', error.code);
      return NextResponse.json({ error: 'Gagal menghapus data kunjungan' }, { status: 500 });
    }
    if (!data?.length) return NextResponse.json({ error: 'Data kunjungan tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, message: 'Data kunjungan berhasil dihapus' });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus data kunjungan' }, { status: 500 });
  }
}
