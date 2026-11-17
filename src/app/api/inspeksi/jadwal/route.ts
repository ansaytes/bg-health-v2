import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  FREKUENSI_HARI_BAWAAN,
  JENIS_INSPEKSI_LIST,
  JENIS_META,
  frekuensiUntukJenis,
  periodeBulan,
  statusEfektif,
  tanggalISO,
  tanggalRencanaPeriode,
  type JenisInspeksi,
} from '@/lib/inspeksi-program';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/inspeksi/jadwal — RENCANA dan REALISASI inspeksi.
 *
 * GET  ?periode=YYYY-MM&site=X          daftar jadwal
 * POST { aksi: 'generate', periode }    buat jadwal periode dari katalog objek
 * POST { aksi: 'selesai', id, ... }     tandai satu jadwal selesai
 * POST { aksi: 'batal', id }            batalkan satu jadwal
 * POST { aksi: 'tambah', ... }          tambah jadwal manual
 *
 * Akses: superuser, administrator, manager (baca+tulis), pic (site sendiri).
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];
const ROLES_TULIS = ['superuser', 'administrator', 'manager', 'pic'];

const TABEL_SIAP_PESAN =
  'Tabel program inspeksi belum dibuat. Jalankan database/inspeksi_program.sql di SQL Editor Supabase.';

/** Katalog objek yang bisa dijadwalkan, per jenis inspeksi. */
const SUMBER_OBJEK: Record<JenisInspeksi, { tabel: string; kolom: string[]; jenisKolom?: string } | null> = {
  sarana_klinik: { tabel: 'sarana_katalog', kolom: ['id', 'nama'] },
  sanitasi: null, // objek sanitasi = area, tidak dari katalog
  p3k: { tabel: 'p3k_katalog', kolom: ['id', 'nama'] },
  ambulans: { tabel: 'ambulans_katalog', kolom: ['id', 'nama'] },
  ergonomi: { tabel: 'ergonomi_sarana_katalog', kolom: ['id', 'nama'] },
  kalibrasi: { tabel: 'sarana_katalog', kolom: ['id', 'nama'], jenisKolom: 'perlu_kalibrasi' },
};

function sitePIC(caller: { role?: string | null; site?: string | null }) {
  return caller.role === 'pic' ? (caller.site ?? null) : null;
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const params = req.nextUrl.searchParams;
  const periode = params.get('periode')?.trim() || periodeBulan();
  const siteParam = params.get('site')?.trim() || '';
  const jenisFilter = params.get('jenis')?.trim() || '';
  const fokusSite = sitePIC(caller) || siteParam;

  let query = client
    .from('inspeksi_jadwal')
    .select('*')
    .eq('periode', periode)
    .order('tanggal_rencana', { ascending: true });
  if (fokusSite) query = query.eq('site', fokusSite);
  if (jenisFilter) query = query.eq('jenis', jenisFilter);

  const { data, error } = await query;
  if (error) {
    // Kode 42P01 = tabel belum ada; PGRST205 = tidak ada di cache skema.
    const belumAda = /42P01|PGRST205|does not exist|schema cache/i.test(
      `${error.code ?? ''} ${error.message ?? ''}`,
    );
    if (belumAda) return NextResponse.json({ success: true, tabelSiap: false, catatan: TABEL_SIAP_PESAN, jadwal: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // `petugas` disimpan sebagai user id. Nama dibaca dari user_profiles supaya
  // tabel dan dashboard menampilkan orang, bukan UUID. Kegagalan lookup
  // tidak menggagalkan halaman — id tetap ditampilkan apa adanya.
  const idPetugas = [...new Set((data ?? []).map(b => String(b.petugas ?? '').trim()).filter(Boolean))];
  const namaPetugas = new Map<string, string>();
  if (idPetugas.length) {
    const { data: profil } = await client
      .from('user_profiles')
      .select('user_id,username,full_name')
      .in('user_id', idPetugas);
    for (const pr of profil ?? []) {
      const nama = String(pr.full_name ?? '').trim() || String(pr.username ?? '').trim();
      if (nama) namaPetugas.set(String(pr.user_id), nama);
    }
  }

  const daftar = (data ?? []).map(b => ({
    ...b,
    status_efektif: statusEfektif(b),
    petugas_nama: b.petugas ? (namaPetugas.get(String(b.petugas)) ?? String(b.petugas)) : null,
  }));

  return NextResponse.json({
    success: true,
    tabelSiap: true,
    periode,
    daftarSite: [...new Set(daftar.map(b => String(b.site ?? '')).filter(Boolean))].sort(),
    jenis: JENIS_META,
    jadwal: daftar,
    ringkas: {
      target: daftar.length,
      selesai: daftar.filter(b => b.status_efektif === 'selesai').length,
      terlewat: daftar.filter(b => b.status_efektif === 'terlewat').length,
    },
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ROLES_TULIS.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const client = adminClient();
  const body = await req.json().catch(() => ({}));
  const aksi = String(body?.aksi ?? '').trim();
  const picSite = sitePIC(caller);

  try {
    if (aksi === 'generate') {
      const periode = String(body?.periode ?? '').trim() || periodeBulan();
      const siteTarget = picSite || String(body?.site ?? '').trim();
      const jenisList = (Array.isArray(body?.jenis) && body.jenis.length
        ? body.jenis
        : JENIS_INSPEKSI_LIST) as JenisInspeksi[];

      if (!siteTarget) {
        return NextResponse.json({ error: 'Site wajib dipilih untuk membuat rencana inspeksi.' }, { status: 400 });
      }

      const dibuat: Record<string, unknown>[] = [];

      for (const jenis of jenisList) {
        if (!JENIS_META[jenis]) continue;
        const sumber = SUMBER_OBJEK[jenis];

        // Objek untuk jenis tanpa katalog (sanitasi) memakai satu baris per site.
        let objek: { id: string; nama: string }[] = [];
        if (sumber) {
          const { data: katalog, error } = await client.from(sumber.tabel).select('*').order('urutan');
          if (error) continue;
          objek = (katalog ?? [])
            .filter((k: Record<string, unknown>) => (sumber.jenisKolom ? Boolean(k[sumber.jenisKolom]) : true))
            .map((k: Record<string, unknown>) => ({ id: String(k.id), nama: String(k.nama ?? '') }));
        } else {
          objek = [{ id: `area:${siteTarget}`, nama: `Inspeksi area ${siteTarget}` }];
        }
        if (objek.length === 0) continue;

        // Frekuensi menentukan BERAPA KALI objek ini diperiksa dalam sebulan.
        //  30 hari → 1× (tanggal terakhir bulan)
        //  14 hari → 2× (pertengahan & akhir)
        //   7 hari → 4× (tiap minggu)
        //  90 hari → tiap 3 bulan (bulan ke-1, 4, 7, 10)
        // 365 hari → sekali setahun (bulan yang sama dengan periode mulai)
        const frekuensi = frekuensiUntukJenis(jenis, body?.frekuensi_hari);
        const tanggalRencana = tanggalRencanaPeriode(periode, frekuensi);
        if (tanggalRencana.length === 0) continue;

        for (const o of objek) {
          for (const tanggal of tanggalRencana) {
            dibuat.push({
              jenis,
              site: siteTarget,
              objek_id: o.id,
              objek_nama: o.nama,
              periode,
              // H+0 masih boleh diselesaikan; terlewat mulai H+1.
              tanggal_rencana: tanggal,
              status: 'rencana',
              frekuensi_hari: frekuensi,
            });
          }
        }
      }

      if (dibuat.length === 0) {
        return NextResponse.json({ error: 'Tidak ada objek yang bisa dijadwalkan untuk site ini.' }, { status: 400 });
      }

      // Jadwal yang sudah ada dibaca dulu, lalu hanya yang BELUM ada yang
      // ditambahkan. Ini wajib karena satu objek kini bisa punya beberapa
      // jadwal per bulan (frekuensi mingguan). Upsert biasa akan menimpa
      // baris mana pun yang kuncinya sama — termasuk jadwal yang sudah
      // SELESAI — sehingga riwayat pelaksanaan bisa hilang.
      const { data: sudahAda, error: bacaError } = await client
        .from('inspeksi_jadwal')
        .select('jenis,objek_id,tanggal_rencana')
        .eq('site', siteTarget)
        .eq('periode', periode);
      if (bacaError) throw bacaError;

      const kunci = (j: string, o: string, t: string) => `${j}|${o}|${t}`;
      const ada = new Set(
        (sudahAda ?? []).map(b => kunci(
          String(b.jenis),
          String(b.objek_id ?? ''),
          String(b.tanggal_rencana ?? '').slice(0, 10),
        )),
      );

      const baru = dibuat.filter(b => !ada.has(kunci(
        String(b.jenis),
        String(b.objek_id ?? ''),
        String(b.tanggal_rencana ?? '').slice(0, 10),
      )));

      if (baru.length > 0) {
        const { error } = await client.from('inspeksi_jadwal').insert(baru);
        if (error) throw error;
      }

      return NextResponse.json({
        success: true,
        dibuat: baru.length,
        dilewati: dibuat.length - baru.length,
        periode,
      });
    }

    if (aksi === 'selesai') {
      const id = body?.id;
      if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });

      // Petugas SELALU dari sesi login, tidak pernah dibaca dari body.
      // Atribusi beban kerja harus tidak bisa dipalsukan atau tertukar:
      // siapa pun yang menekan "Selesai", dialah yang tercatat.
      const patch: Record<string, unknown> = {
        status: 'selesai',
        tanggal_selesai: String(body?.tanggal_selesai ?? '').slice(0, 10) || tanggalISO(new Date()),
        petugas: caller.userId ?? null,
        waktu_lapor: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (body?.catatan != null) patch.catatan = String(body.catatan);

      let q = client.from('inspeksi_jadwal').update(patch).eq('id', id);
      if (picSite) q = q.eq('site', picSite);
      const { error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (aksi === 'batal') {
      const id = body?.id;
      if (!id) return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
      let q = client.from('inspeksi_jadwal')
        .update({ status: 'dibatalkan', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (picSite) q = q.eq('site', picSite);
      const { error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (aksi === 'tambah') {
      const jenis = String(body?.jenis ?? '').trim() as JenisInspeksi;
      if (!JENIS_META[jenis]) return NextResponse.json({ error: 'Jenis inspeksi tidak dikenal' }, { status: 400 });
      const site = picSite || String(body?.site ?? '').trim();
      const tanggal = String(body?.tanggal_rencana ?? '').slice(0, 10);
      if (!site || !tanggal) {
        return NextResponse.json({ error: 'Site dan tanggal rencana wajib diisi' }, { status: 400 });
      }
      const { error } = await client.from('inspeksi_jadwal').insert({
        jenis,
        site,
        objek_id: String(body?.objek_id ?? ''),
        objek_nama: String(body?.objek_nama ?? ''),
        periode: periodeBulan(tanggal),
        tanggal_rencana: tanggal,
        status: 'rencana',
        frekuensi_hari: Number(body?.frekuensi_hari) || FREKUENSI_HARI_BAWAAN[jenis],
        catatan: String(body?.catatan ?? '') || null,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err) {
    const pesan = err instanceof Error ? err.message : 'Gagal memproses jadwal inspeksi';
    if (/42P01|PGRST205|does not exist|schema cache/i.test(pesan)) {
      return NextResponse.json({ error: TABEL_SIAP_PESAN }, { status: 500 });
    }
    console.error('[inspeksi/jadwal]', err);
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
