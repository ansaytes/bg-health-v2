import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import { periksaSyaratUnfit, hitungFase } from '@/lib/karyawan-sakit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/karyawan-sakit/pemantauan — catat satu sesi kontak (FORM/101 bagian C).
 * POST /api/karyawan-sakit/rekomendasi — terbitkan FORM/123.
 *
 * Dipisah lewat parameter `jenis` agar satu route menangani keduanya:
 *   ?jenis=pemantauan   (default)
 *   ?jenis=rekomendasi
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Hanya QSHE Medic / PIC yang dapat mencatat' }, { status: 403 });
  }

  const jenis = req.nextUrl.searchParams.get('jenis') || 'pemantauan';
  const body = await req.json().catch(() => ({}));
  const episodeId = String(body.episodeId ?? '').trim();
  if (!episodeId) return NextResponse.json({ error: 'episodeId wajib diisi' }, { status: 400 });

  const client = adminClient();

  // Episode harus ada — sekaligus mengambil tanggal mulai sakit untuk fase.
  const { data: episode, error: epError } = await client
    .from('sakit_episode')
    .select('id,tanggal_mulai_sakit,status')
    .eq('id', episodeId)
    .maybeSingle();
  if (epError) return NextResponse.json({ error: epError.message }, { status: 500 });
  if (!episode) return NextResponse.json({ error: 'Episode tidak ditemukan' }, { status: 404 });

  if (jenis === 'pemantauan') {
    const tanggal = String(body.tanggal ?? '').slice(0, 10);
    if (!tanggal) return NextResponse.json({ error: 'Tanggal kontak wajib diisi' }, { status: 400 });

    const { error } = await client.from('sakit_pemantauan').insert({
      episode_id: episodeId,
      tanggal,
      media: body.media || 'TELEPON',
      perkembangan: body.perkembangan || null,
      keluhan: body.keluhan || null,
      tatalaksana: body.tatalaksana || null,
      kepatuhan_obat: body.kepatuhanObat || null,
      perkiraan_pemulihan: body.perkiraanPemulihan || null,
      petugas: body.petugas || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  if (jenis === 'rekomendasi') {
    const tanggalPenilaian = String(body.tanggalPenilaian ?? '').slice(0, 10);
    const statusKelayakan = String(body.statusKelayakan ?? '');
    if (!tanggalPenilaian) return NextResponse.json({ error: 'Tanggal penilaian wajib diisi' }, { status: 400 });
    if (!['FIT', 'FIT_WITH_NOTE', 'CURRENTLY_UNFIT', 'UNFIT'].includes(statusKelayakan)) {
      return NextResponse.json({ error: 'Status kelayakan tidak valid' }, { status: 400 });
    }

    // SOP/027 poin 6.5.5: Unfit hanya boleh bila syarat (a)–(f) terpenuhi.
    // Pemeriksaan otomatis mencakup (e) 2 pemeriksaan ≥30 hari dan (f) rekam
    // pemantauan lengkap; sisanya penilaian klinis. Bila belum terpenuhi,
    // permintaan DITOLAK dengan daftar syarat — bukan diperingatkan saja,
    // karena penerbitan Unfit prematur berdampak ketenagakerjaan.
    if (statusKelayakan === 'UNFIT') {
      const [{ data: riwayat }, { data: pemantauan }] = await Promise.all([
        client.from('sakit_rekomendasi')
          .select('tanggal_penilaian,status_kelayakan')
          .eq('episode_id', episodeId),
        client.from('sakit_pemantauan').select('id').eq('episode_id', episodeId),
      ]);

      const mulai = String(episode.tanggal_mulai_sakit ?? '').slice(0, 10);
      const { definisi } = hitungFase(mulai);
      const syarat = periksaSyaratUnfit({
        jumlahRekomendasi: (riwayat ?? []).length,
        tanggalRekomendasi: [
          ...(riwayat ?? []).map((r) => String(r.tanggal_penilaian ?? '')),
          tanggalPenilaian,
        ],
        statusRekomendasi: [
          ...(riwayat ?? []).map((r) => String(r.status_kelayakan ?? '')),
          statusKelayakan,
        ],
        jumlahPemantauan: (pemantauan ?? []).length,
        faseTerkini: definisi.fase,
      });

      if (!syarat.boleh) {
        return NextResponse.json({
          error: 'Syarat penerbitan status Unfit belum terpenuhi (SOP/027 poin 6.5.5)',
          belumTerpenuhi: syarat.belumTerpenuhi,
        }, { status: 422 });
      }
    }

    const { error } = await client.from('sakit_rekomendasi').insert({
      episode_id: episodeId,
      no_dokumen: body.noDokumen || null,
      tanggal_penilaian: tanggalPenilaian,
      diagnosis_terkini: body.diagnosisTerkini || null,
      status_fungsional: body.statusFungsional || null,
      respons_tatalaksana: body.responsTatalaksana || null,
      prognosis: body.prognosis || null,
      dasar_klinis: body.dasarKlinis || null,
      status_kelayakan: statusKelayakan,
      catatan_batasan: body.catatanBatasan || null,
      tanggal_mulai_kembali_kerja: body.tanggalMulaiKembaliKerja || null,
      // Poin 6.6.1: hari pertama periode sakit, BUKAN tanggal surat.
      tanggal_hari_pertama_sakit: body.tanggalHariPertamaSakit || String(episode.tanggal_mulai_sakit ?? '').slice(0, 10),
      rekomendasi_tindak_lanjut: Array.isArray(body.rekomendasiTindakLanjut) ? body.rekomendasiTindakLanjut : null,
      disetujui_qshe_manager: body.disetujuiQsheManager || null,
      tanggal_qshe_manager: body.tanggalQsheManager || null,
      disetujui_general_manager: body.disetujuiGeneralManager || null,
      tanggal_general_manager: body.tanggalGeneralManager || null,
      diterbitkan_oleh: caller.userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Sinkronkan status episode agar dashboard & pemantauan mengikuti.
    const statusEpisode = statusKelayakan === 'FIT' ? 'FIT'
      : statusKelayakan === 'FIT_WITH_NOTE' ? 'FIT_WITH_NOTE'
        : statusKelayakan === 'UNFIT' ? 'UNFIT' : 'AKTIF';

    await client.from('sakit_episode').update({
      status: statusEpisode,
      tanggal_kembali_kerja: body.tanggalMulaiKembaliKerja || null,
      tanggal_selesai_sakit: body.tanggalSelesaiSakit || null,
      updated_at: new Date().toISOString(),
    }).eq('id', episodeId);

    return NextResponse.json({ success: true, statusEpisode });
  }

  return NextResponse.json({ error: 'jenis harus "pemantauan" atau "rekomendasi"' }, { status: 400 });
}

/** GET /api/karyawan-sakit/pemantauan?episodeId= — detail lengkap satu episode. */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !['superuser', 'administrator', 'pic', 'manager'].includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const episodeId = req.nextUrl.searchParams.get('episodeId');
  if (!episodeId) return NextResponse.json({ error: 'episodeId wajib diisi' }, { status: 400 });

  const client = adminClient();
  const [{ data: pemantauan }, { data: rekomendasi }, { data: sks }] = await Promise.all([
    client.from('sakit_pemantauan').select('*').eq('episode_id', episodeId).order('tanggal', { ascending: true }),
    client.from('sakit_rekomendasi').select('*').eq('episode_id', episodeId).order('tanggal_penilaian', { ascending: false }),
    client.from('sakit_verifikasi_sks').select('*').eq('episode_id', episodeId).order('tanggal_sks', { ascending: true }),
  ]);

  return NextResponse.json({
    success: true,
    pemantauan: pemantauan ?? [],
    rekomendasi: rekomendasi ?? [],
    verifikasiSks: sks ?? [],
  });
}
