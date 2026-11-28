import { NextRequest, NextResponse } from 'next/server';

import { decrypt, encrypt, hashField } from '@/lib/encryption';
import { integrationAdminClient } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole } from '@/lib/server-auth';
import { siteBatch } from '@/lib/site-filter';
import { signSuratId } from '@/lib/surat-pengantar-sig';
import {
  DEFAULT_PARAGRAF_FOLLOW_UP,
  DEFAULT_PARAGRAF_MCU,
  formatNomorSuratPengantar,
  JENIS_PENGANTAR_LIST,
  JENIS_PENGANTAR_META,
  type JenisPengantar,
  type SuratPengantarItem,
} from '@/lib/surat-pengantar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = () => integrationAdminClient();

const ROLES_READ = ['superuser', 'administrator', 'hc', 'pic', 'manager'] as const;
const ROLES_CREATE = ['superuser', 'administrator', 'hc', 'pic'] as const;
const ROLES_HC = ['superuser', 'hc'] as const;
const ROLES_QSHE = ['superuser', 'administrator'] as const;

function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42P01' || /surat_pengantar_mcu.*does not exist/i.test(err.message || '');
}

async function getCallerDisplayName(userId: string, fallbackRole: string): Promise<string> {
  const { data } = await supabase()
    .from('user_profiles')
    .select('full_name, username')
    .eq('user_id', userId)
    .maybeSingle();
  return String(data?.full_name || data?.username || fallbackRole);
}

function mapRow(row: Record<string, any>): SuratPengantarItem {
  return {
    id: String(row.id),
    no_surat: row.no_surat ? String(row.no_surat) : null,
    nomor_urut: typeof row.nomor_urut === 'number' ? row.nomor_urut : null,
    tahun_surat: Number(row.tahun_surat || new Date().getFullYear()),
    jenis_pengantar: row.jenis_pengantar as JenisPengantar,
    is_calon_karyawan: Boolean(row.is_calon_karyawan),
    nik_karyawan: (row.nik_karyawan_enc ? decrypt(row.nik_karyawan_enc) : '') || '',
    nik_ktp: (row.nik_ktp_enc ? decrypt(row.nik_ktp_enc) : '') || '',
    nama: (row.nama_enc ? decrypt(row.nama_enc) : '') || '',
    jenis_kelamin: String(row.jenis_kelamin || ''),
    usia: typeof row.usia === 'number' ? row.usia : null,
    jabatan: String(row.jabatan || ''),
    departemen: String(row.departemen || ''),
    site: String(row.site || ''),
    mcu_record_id: row.mcu_record_id ? String(row.mcu_record_id) : null,
    tgl_mcu: row.tgl_mcu ? String(row.tgl_mcu).slice(0, 10) : null,
    faskes_tujuan: String(row.faskes_tujuan || ''),
    tanggal_rencana: String(row.tanggal_rencana || '').slice(0, 10),
    paket_pemeriksaan: Array.isArray(row.paket_pemeriksaan) ? row.paket_pemeriksaan : [],
    parameter_abnormal: String(row.parameter_abnormal || ''),
    paragraf_pendukung: String(row.paragraf_pendukung || ''),
    catatan_pic: String(row.catatan_pic || ''),
    status: row.status,
    created_by: row.created_by ? String(row.created_by) : null,
    created_by_name: String(row.created_by_name || ''),
    created_by_role: String(row.created_by_role || ''),
    hc_status: row.hc_status || null,
    hc_by_name: row.hc_by_name ? String(row.hc_by_name) : null,
    hc_at: row.hc_at ? String(row.hc_at) : null,
    hc_catatan: row.hc_catatan ? String(row.hc_catatan) : null,
    qshe_status: row.qshe_status || null,
    qshe_by_name: row.qshe_by_name ? String(row.qshe_by_name) : null,
    qshe_at: row.qshe_at ? String(row.qshe_at) : null,
    qshe_catatan: row.qshe_catatan ? String(row.qshe_catatan) : null,
    verify_sig: row.status === 'DISETUJUI' ? signSuratId(String(row.id)) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, ROLES_READ);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || '';
    const jenisFilter = searchParams.get('jenis') || '';
    const siteFilter = searchParams.get('site') || '';

    let q = supabase()
      .from('surat_pengantar_mcu')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (caller!.role === 'pic' && caller!.site) {
      q = q.or(`site.eq.${caller!.site},created_by.eq.${caller!.userId}`);
    } else if (siteFilter && siteFilter !== 'ALL') {
      q = q.eq('site', siteFilter);
    }

    if (statusFilter && statusFilter !== 'ALL') {
      q = q.eq('status', statusFilter);
    }
    if (jenisFilter && jenisFilter !== 'ALL') {
      q = q.eq('jenis_pengantar', jenisFilter);
    }

    const { data, error } = await q;
    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ data: [], tabelSiap: false });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((r) => mapRow(r as Record<string, any>));
    return NextResponse.json({ data: rows, tabelSiap: true });
  } catch (err) {
    console.error('GET /api/surat-pengantar error:', err);
    return NextResponse.json({ error: 'Gagal memuat daftar surat pengantar' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, ROLES_CREATE);
    if (denied) return denied;

    const body = await req.json();
    const jenis = String(body.jenis_pengantar || '') as JenisPengantar;
    if (!JENIS_PENGANTAR_LIST.includes(jenis)) {
      return NextResponse.json({ error: 'Jenis pengantar tidak valid' }, { status: 400 });
    }

    const nama = String(body.nama || '').trim();
    const nikKaryawan = String(body.nik_karyawan || '').trim();
    const nikKtp = String(body.nik_ktp || '').trim();
    const isCalon = Boolean(body.is_calon_karyawan) || !nikKaryawan;
    const rawSite = String(body.site || '').trim();
    const site =
      caller!.role === 'pic' && caller!.site && !siteBatch(rawSite)
        ? caller!.site
        : rawSite || caller!.site || 'HEAD OFFICE';
    const faskes = String(body.faskes_tujuan || '').trim();
    const tanggalRencana = String(body.tanggal_rencana || '').trim();

    if (!nama) {
      return NextResponse.json({ error: 'Nama karyawan / calon karyawan wajib diisi' }, { status: 400 });
    }
    if (!nikKaryawan && !nikKtp) {
      return NextResponse.json({ error: 'Minimal NIK Karyawan atau NIK KTP wajib diisi' }, { status: 400 });
    }
    if (!faskes) {
      return NextResponse.json({ error: 'Faskes tujuan wajib diisi' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalRencana)) {
      return NextResponse.json({ error: 'Tanggal rencana pemeriksaan wajib diisi' }, { status: 400 });
    }

    const paketRaw = Array.isArray(body.paket_pemeriksaan)
      ? body.paket_pemeriksaan.map((p: unknown) => String(p).trim()).filter(Boolean)
      : [];
    const paket = paketRaw.length > 0 ? paketRaw : JENIS_PENGANTAR_META[jenis].defaultPaket;

    const paragraf =
      String(body.paragraf_pendukung || '').trim() ||
      (jenis === 'FOLLOW_UP' ? DEFAULT_PARAGRAF_FOLLOW_UP : DEFAULT_PARAGRAF_MCU);

    const createdByName = await getCallerDisplayName(caller!.userId, caller!.role);
    const usiaNum = body.usia !== undefined && body.usia !== null && String(body.usia).trim() !== ''
      ? Number(body.usia)
      : null;

    const payload = {
      tahun_surat: new Date().getFullYear(),
      jenis_pengantar: jenis,
      is_calon_karyawan: isCalon,
      nik_karyawan_enc: nikKaryawan ? encrypt(nikKaryawan) : null,
      nik_karyawan_hash: nikKaryawan ? hashField(nikKaryawan) : null,
      nik_ktp_enc: nikKtp ? encrypt(nikKtp) : null,
      nik_ktp_hash: nikKtp ? hashField(nikKtp) : null,
      nama_enc: encrypt(nama) || nama,
      jenis_kelamin: String(body.jenis_kelamin || '').trim() || null,
      usia: Number.isFinite(usiaNum) ? usiaNum : null,
      jabatan: String(body.jabatan || '').trim() || null,
      departemen: String(body.departemen || '').trim() || null,
      site,
      mcu_record_id: body.mcu_record_id ? String(body.mcu_record_id) : null,
      tgl_mcu: body.tgl_mcu && /^\d{4}-\d{2}-\d{2}$/.test(String(body.tgl_mcu)) ? String(body.tgl_mcu) : null,
      faskes_tujuan: faskes,
      tanggal_rencana: tanggalRencana,
      paket_pemeriksaan: paket,
      parameter_abnormal: String(body.parameter_abnormal || '').trim() || null,
      paragraf_pendukung: paragraf,
      catatan_pic: String(body.catatan_pic || '').trim() || null,
      status: 'MENUNGGU_HC',
      created_by: caller!.userId,
      created_by_name: createdByName,
      created_by_role: caller!.role,
    };

    const { data, error } = await supabase()
      .from('surat_pengantar_mcu')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { error: 'Tabel surat_pengantar_mcu belum dibuat. Jalankan SQL migration 20261128_surat_pengantar_mcu.sql.' },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: mapRow(data as Record<string, any>) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/surat-pengantar error:', err);
    return NextResponse.json({ error: 'Gagal menyimpan pengajuan surat pengantar' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) return NextResponse.json({ error: 'Sesi login tidak valid' }, { status: 401 });

    const body = await req.json();
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();
    const catatan = String(body.catatan || '').trim() || null;

    if (!id || !action) {
      return NextResponse.json({ error: 'ID dan aksi persetujuan wajib diisi' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase()
      .from('surat_pengantar_mcu')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Pengajuan surat pengantar tidak ditemukan' }, { status: 404 });
    }

    const actorName = await getCallerDisplayName(caller.userId, caller.role);
    const nowIso = new Date().toISOString();

    if (action === 'hc_approve' || action === 'hc_reject') {
      const denied = requireServerRole(caller, ROLES_HC);
      if (denied) return denied;
      if (existing.status !== 'MENUNGGU_HC') {
        return NextResponse.json(
          { error: `Pengajuan ini berstatus ${existing.status}, tidak berada pada tahap persetujuan HC.` },
          { status: 409 },
        );
      }
      if (action === 'hc_reject' && !catatan) {
        return NextResponse.json({ error: 'Catatan alasan penolakan HC wajib diisi' }, { status: 400 });
      }

      const { data: updated, error: updErr } = await supabase()
        .from('surat_pengantar_mcu')
        .update({
          hc_status: action === 'hc_approve' ? 'DISETUJUI' : 'DITOLAK',
          hc_by: caller.userId,
          hc_by_name: actorName,
          hc_at: nowIso,
          hc_catatan: catatan,
          status: action === 'hc_approve' ? 'MENUNGGU_QSHE' : 'DITOLAK',
          updated_at: nowIso,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ data: mapRow(updated as Record<string, any>) });
    }

    if (action === 'qshe_approve' || action === 'qshe_reject') {
      const denied = requireServerRole(caller, ROLES_QSHE);
      if (denied) return denied;
      if (existing.status !== 'MENUNGGU_QSHE') {
        return NextResponse.json(
          { error: 'Persetujuan QSHE Medic hanya dapat dilakukan setelah disetujui HC terlebih dahulu.' },
          { status: 409 },
        );
      }
      if (action === 'qshe_reject' && !catatan) {
        return NextResponse.json({ error: 'Catatan alasan penolakan QSHE Medic wajib diisi' }, { status: 400 });
      }

      const updateFields: Record<string, any> = {
        qshe_status: action === 'qshe_approve' ? 'DISETUJUI' : 'DITOLAK',
        qshe_by: caller.userId,
        qshe_by_name: actorName,
        qshe_at: nowIso,
        qshe_catatan: catatan,
        status: action === 'qshe_approve' ? 'DISETUJUI' : 'DITOLAK',
        updated_at: nowIso,
      };

      if (action === 'qshe_approve') {
        const now = new Date();
        const tahunSurat = now.getFullYear();
        const { data: maxRow } = await supabase()
          .from('surat_pengantar_mcu')
          .select('nomor_urut')
          .eq('tahun_surat', tahunSurat)
          .not('nomor_urut', 'is', null)
          .order('nomor_urut', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextUrut = (Number(maxRow?.nomor_urut) || 0) + 1;
        updateFields.tahun_surat = tahunSurat;
        updateFields.nomor_urut = nextUrut;
        updateFields.no_surat = formatNomorSuratPengantar(nextUrut, String(existing.site || 'HO'), now);

        if (typeof body.parameter_abnormal === 'string') {
          updateFields.parameter_abnormal = body.parameter_abnormal.trim() || null;
        }
        if (typeof body.paragraf_pendukung === 'string' && body.paragraf_pendukung.trim()) {
          updateFields.paragraf_pendukung = body.paragraf_pendukung.trim();
        }
        if (Array.isArray(body.paket_pemeriksaan) && body.paket_pemeriksaan.length > 0) {
          updateFields.paket_pemeriksaan = body.paket_pemeriksaan.map((p: unknown) => String(p).trim()).filter(Boolean);
        }
      }

      const { data: updated, error: updErr } = await supabase()
        .from('surat_pengantar_mcu')
        .update(updateFields)
        .eq('id', id)
        .select('*')
        .single();

      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ data: mapRow(updated as Record<string, any>) });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err) {
    console.error('PATCH /api/surat-pengantar error:', err);
    return NextResponse.json({ error: 'Gagal memproses persetujuan surat pengantar' }, { status: 500 });
  }
}
