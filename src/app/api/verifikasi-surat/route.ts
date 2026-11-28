import { NextRequest, NextResponse } from 'next/server';

import { decrypt } from '@/lib/encryption';
import { integrationAdminClient } from '@/lib/integration-settings';
import { JENIS_PENGANTAR_META, type JenisPengantar } from '@/lib/surat-pengantar';
import { maskNamaForPublic, verifySuratSig } from '@/lib/surat-pengantar-sig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/verifikasi-surat?id=<uuid>&sig=<hmac24>
 *
 * Endpoint verifikasi publik (read-only) untuk QR Code pada Surat Pengantar.
 * Keamanan:
 *  - Validasi UUID & HMAC di memori sebelum menyentuh database.
 *  - Hanya mengembalikan metadata pengesahan untuk surat berstatus DISETUJUI.
 *  - Tidak pernah mengembalikan NIK, hasil lab, atau temuan abnormal.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || '';
    const sig = searchParams.get('sig') || '';

    if (!verifySuratSig(id, sig)) {
      return NextResponse.json(
        { valid: false, error: 'Tanda tangan digital tidak valid atau URL verifikasi rusak.' },
        { status: 403 },
      );
    }

    const client = integrationAdminClient();
    const { data, error } = await client
      .from('surat_pengantar_mcu')
      .select(
        'id, no_surat, jenis_pengantar, is_calon_karyawan, nama_enc, site, faskes_tujuan, tanggal_rencana, status, hc_by_name, hc_at, qshe_by_name, qshe_at',
      )
      .eq('id', id.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ valid: false, error: 'Gagal memverifikasi dokumen.' }, { status: 500 });
    }

    if (!data || data.status !== 'DISETUJUI') {
      return NextResponse.json(
        { valid: false, error: 'Dokumen tidak ditemukan atau belum disetujui resmi.' },
        { status: 404 },
      );
    }

    const rawNama = (data.nama_enc ? decrypt(data.nama_enc) : '') || '';
    const jenis = data.jenis_pengantar as JenisPengantar;

    return NextResponse.json({
      valid: true,
      document: {
        no_surat: data.no_surat,
        jenis_label: JENIS_PENGANTAR_META[jenis]?.label || jenis,
        is_calon_karyawan: Boolean(data.is_calon_karyawan),
        nama_masked: maskNamaForPublic(rawNama),
        site: data.site,
        faskes_tujuan: data.faskes_tujuan,
        tanggal_rencana: String(data.tanggal_rencana || '').slice(0, 10),
        hc_by_name: data.hc_by_name,
        hc_at: data.hc_at,
        qshe_by_name: data.qshe_by_name,
        qshe_at: data.qshe_at,
        sig_digest: sig.slice(0, 8).toUpperCase(),
      },
    });
  } catch (err) {
    console.error('GET /api/verifikasi-surat error:', err);
    return NextResponse.json({ valid: false, error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
