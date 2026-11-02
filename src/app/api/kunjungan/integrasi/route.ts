import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';
import { integrationAdminClient } from '@/lib/integration-settings';
import { encrypt, hashField } from '@/lib/encryption';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/kunjungan/integrasi — tindak lanjut otomatis dari kunjungan berobat.
 *
 * MASALAH YANG DISELESAIKAN
 * Sebelumnya data di tiga halaman tidak saling terhubung:
 *   • Kunjungan berobat dengan "Rujuk RS = Ya" selesai begitu saja, padahal
 *     karyawan yang dirujuk hampir pasti akan absen sakit dan perlu dipantau.
 *   • Kunjungan dengan kategori "Penyakit Akibat Kerja" tidak memicu Register
 *     PAK, padahal INK/017 mewajibkan setiap dugaan PAK dicatat dan ditriase
 *     dalam 1 hari kerja.
 *
 * Endpoint ini dipanggil SETELAH kunjungan tersimpan, dan:
 *
 *   rujukRS === true
 *     → membuat episode `sakit_episode` (status AKTIF, sumber RUMAH_SAKIT)
 *       sehingga otomatis muncul di Monitoring Karyawan Sakit dan ikut
 *       dihitung pada notifikasi jadwal pemantauan.
 *
 *   kategori === 'Penyakit Akibat Kerja'
 *     → membuat kasus di Register PAK dengan sumber dugaan MCU/pelayanan
 *       internal, agar batas waktu triase 1 hari kerja langsung berjalan.
 *
 * Keduanya IDEMPOTEN: bila sudah ada episode/kasus dengan tanggal & NIK yang
 * sama, tidak dibuat duplikat.
 *
 * Akses: QSHE Medic (superuser/administrator/pic).
 */
export async function POST(req: NextRequest) {
  const caller = await getServerCaller(req);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;
  if (!caller) return NextResponse.json({ success: false, error: 'Sesi login tidak valid.' }, { status: 401 });
  const parsedBody: unknown = await req.json().catch(() => null);
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ success: false, error: 'Body permintaan tidak valid.' }, { status: 400 });
  }
  const kunjunganId = 'kunjunganId' in parsedBody && typeof parsedBody.kunjunganId === 'string'
    ? parsedBody.kunjunganId.trim() : '';
  if (!kunjunganId || kunjunganId.length > 100) {
    return NextResponse.json({ success: false, error: 'ID kunjungan tidak valid.' }, { status: 400 });
  }

  const client = integrationAdminClient();
  const { data: kunjungan, error: kunjunganError } = await client
    .from('kunjungan_berobat')
    .select('nik,nama,jobsite,tanggal,rujuk_rs,nama_rs,keluhan,kategori')
    .eq('id', kunjunganId)
    .maybeSingle();
  if (kunjunganError) return NextResponse.json({ success: false, error: 'Gagal memverifikasi kunjungan.' }, { status: 500 });
  if (!kunjungan) return NextResponse.json({ success: false, error: 'Kunjungan tidak ditemukan.' }, { status: 404 });

  const nik = String(kunjungan.nik ?? '').trim();
  const nama = String(kunjungan.nama ?? '').trim();
  const tanggal = String(kunjungan.tanggal ?? '').slice(0, 10);
  const site = String(kunjungan.jobsite ?? '').trim();
  const kategori = String(kunjungan.kategori ?? '').trim();
  const rujukRS = kunjungan.rujuk_rs === true;
  const namaRS = String(kunjungan.nama_rs ?? '').trim();
  const keluhan = String(kunjungan.keluhan ?? '').trim();
  if (caller!.role === 'pic' && (!caller!.site || caller!.site.toLowerCase() !== site.toLowerCase())) {
    return NextResponse.json({ success: false, error: 'PIC hanya dapat memproses kunjungan site sendiri.' }, { status: 403 });
  }
  if (!nik || !nama || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    return NextResponse.json({ success: false, error: 'Kunjungan tidak memiliki identitas yang cukup untuk tindak lanjut.' }, { status: 400 });
  }

  const nikHash = hashField(nik);
  if (!nikHash) return NextResponse.json({ error: 'NIK tidak valid' }, { status: 400 });

  const hasil: { karyawanSakit?: string; registerPak?: string; catatan: string[] } = { catatan: [] };

  /* ── 1. Rujuk RS → episode karyawan sakit ───────────────────────────── */
  if (rujukRS) {
    try {
      // Idempoten: episode dengan NIK + tanggal mulai yang sama tidak dibuat ulang.
      const { data: ada } = await client
        .from('sakit_episode')
        .select('id')
        .eq('nik_hash', nikHash)
        .eq('tanggal_mulai_sakit', tanggal)
        .maybeSingle();

      if (ada?.id) {
        hasil.karyawanSakit = 'sudah-ada';
        hasil.catatan.push('Episode karyawan sakit untuk tanggal ini sudah ada.');
      } else {
        const { error } = await client.from('sakit_episode').insert({
          nik_hash: nikHash,
          nik_enc: encrypt(nik),
          nama_enc: encrypt(nama),
          site: site || null,
          tanggal_mulai_sakit: tanggal,
          diagnosis_awal: keluhan || null,
          dokter_faskes: namaRS || null,
          // Rujukan ke rumah sakit = perawatan di luar tim medik perusahaan.
          sumber_laporan: 'RUMAH_SAKIT',
          jenis_sakit: 'AKUT',
          status: 'AKTIF',
          catatan: `Dibuat otomatis dari kunjungan berobat${namaRS ? ` (rujukan ke ${namaRS})` : ''}.`,
          dibuat_oleh: caller.userId,
        });
        if (error) {
          console.error('[Kunjungan integration] Sick episode insert failed:', error.code);
          hasil.catatan.push('Gagal membuat episode karyawan sakit.');
        } else {
          hasil.karyawanSakit = 'dibuat';
          hasil.catatan.push('Episode karyawan sakit dibuat dari rujukan RS.');
        }
      }
    } catch {
      hasil.catatan.push('Gagal membuat episode karyawan sakit.');
    }
  }

  /* ── 2. Kategori PAK → Register PAK ─────────────────────────────────── */
  if (/penyakit\s*akibat\s*kerja/i.test(kategori)) {
    try {
      const { data: ada } = await client
        .from('pak_cases')
        .select('id')
        .eq('nik_hash', nikHash)
        .maybeSingle();

      if (ada?.id) {
        hasil.registerPak = 'sudah-ada';
        hasil.catatan.push('Kasus PAK untuk karyawan ini sudah ada di Register.');
      } else {
        // Nomor register mengikuti pola INK/017: PAK-tahun-urut.
        const tahun = tanggal.slice(0, 4);
        const { count } = await client
          .from('pak_cases')
          .select('id', { count: 'exact', head: true })
          .like('id_register', `PAK-${tahun}-%`);
        const urut = String((count ?? 0) + 1).padStart(3, '0');

        const { error } = await client.from('pak_cases').insert({
          id_register: `PAK-${tahun}-${urut}`,
          tanggal_diterima: new Date().toISOString(),
          diterima_oleh: caller.userId,
          lokasi: site ? 'Jobsite' : 'Head Office',
          jobsite_nama: site || null,
          // Dugaan pertama datang dari pelayanan kesehatan perusahaan.
          sumber_dugaan: 'PELAYANAN_INTERNAL',
          sumber_detail: 'Otomatis dari kunjungan berobat berkategori Penyakit Akibat Kerja',
          pelapor_nama: nama,
          nik_hash: nikHash,
          nama_enc: encrypt(nama),
          status: 'DITERIMA',
        });
        if (error) {
          console.error('[Kunjungan integration] PAK case insert failed:', error.code);
          hasil.catatan.push('Gagal membuat kasus PAK.');
        } else {
          hasil.registerPak = `PAK-${tahun}-${urut}`;
          hasil.catatan.push(`Kasus PAK PAK-${tahun}-${urut} dibuat. Triase wajib dalam 1 hari kerja.`);
        }
      }
    } catch {
      hasil.catatan.push('Gagal membuat kasus PAK.');
    }
  }

  return NextResponse.json({ success: true, ...hasil });
}
