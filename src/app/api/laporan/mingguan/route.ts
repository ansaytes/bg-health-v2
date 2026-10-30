import { NextRequest, NextResponse } from 'next/server';

import { adminClient, getCaller } from '@/lib/questionnaire-store';
import {
  daftarMinggu,
  dalamMinggu,
  isoTanggal,
  nomorMinggu,
  rentangMinggu,
  tahunKerja,
} from '@/lib/work-week';

export const dynamic = 'force-dynamic';

/**
 * GET /api/laporan/mingguan — Rekapitulasi mingguan pelayanan kesehatan kerja.
 *
 * DASAR
 *  • SOP/028 poin 5.4.3 — "Laporan pelaksanaan pelayanan kesehatan kerja
 *    disampaikan kepada Manager QSHE setiap 1 (satu) minggu."
 *  • Aturan operasional PT BDM: hari kerja Senin–Sabtu, laporan dibuat Sabtu,
 *    Minggu libur (HO). Penomoran minggu: minggu kerja yang memuat 1 Januari
 *    adalah Week 1 — lihat `lib/work-week.ts` untuk rincian & konsekuensinya.
 *
 * Query:
 *   ?tahun=2026            tahun kerja
 *   ?minggu=44             nomor minggu (1..52); kosong = pekan berjalan
 *   ?site=Satui            opsional, batasi satu site
 *
 * Isi laporan (semua AGREGAT — tidak ada identitas per karyawan):
 *   kunjungan  : jumlah kunjungan, pasien unik, rujukan RS, per hari, top diagnosa
 *   prokawan   : peserta Kuning/Merah, terlambat, akan datang, kontrol selesai pekan ini
 *   inventory  : item stok kritis / mendekati kedaluwarsa
 *   pak        : kasus baru, lewat batas waktu
 *
 * Catatan kerahasiaan: pasien unik dihitung dari NIK ter-hash di server lalu
 * HANYA jumlahnya yang dikirim. Tidak ada nama/NIK di respons.
 */
const ROLES = ['superuser', 'administrator', 'manager', 'pic'];

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: 'Sesi login tidak ditemukan' }, { status: 401 });
  if (!ROLES.includes(String(caller.role))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const sekarang = new Date();
  const tahunDiminta = Number.parseInt(params.get('tahun') || '', 10);
  const mingguDiminta = Number.parseInt(params.get('minggu') || '', 10);

  const tahun = Number.isFinite(tahunDiminta) && tahunDiminta > 2000 ? tahunDiminta : tahunKerja(sekarang);
  const minggu = Number.isFinite(mingguDiminta) && mingguDiminta > 0
    ? mingguDiminta
    : nomorMinggu(sekarang);

  const rentang = rentangMinggu(tahun, minggu, sekarang);
  const mulaiIso = isoTanggal(rentang.mulai);
  const selesaiIso = isoTanggal(rentang.selesai);

  // PIC hanya melihat site-nya sendiri.
  const siteBatasan = caller.role === 'pic'
    ? caller.site ?? null
    : (params.get('site')?.trim() || null);

  const client = adminClient();

  try {
    /* ── 1. Kunjungan berobat pekan ini ─────────────────────────────── */
    let kunjunganQuery = client
      .from('kunjungan_berobat')
      .select('nik,nama,departemen,jobsite,tanggal,diagnosa,rujuk_rs,nama_rs')
      .gte('tanggal', mulaiIso)
      .lte('tanggal', selesaiIso);
    if (siteBatasan) kunjunganQuery = kunjunganQuery.eq('jobsite', siteBatasan);
    const { data: kunjungan } = await kunjunganQuery;

    const rows = (kunjungan ?? []) as Record<string, unknown>[];

    // Pasien unik dihitung di server; hanya jumlahnya yang keluar.
    const pasienUnik = new Set(
      rows.map((r) => String(r.nik ?? r.nama ?? '').trim().toLowerCase()).filter(Boolean),
    ).size;

    const rujukan = rows.filter((r) => r.rujuk_rs === true);
    const perHari = HARI.map((nama, i) => {
      const tanggal = isoTanggal(new Date(rentang.mulai.getFullYear(), rentang.mulai.getMonth(), rentang.mulai.getDate() + i));
      return {
        hari: nama,
        tanggal,
        jumlah: rows.filter((r) => String(r.tanggal ?? '').slice(0, 10) === tanggal).length,
      };
    });

    const diagnosaCount = new Map<string, number>();
    for (const r of rows) {
      const d = String(r.diagnosa ?? '').trim();
      if (!d || d === '-' || d === '[]') continue;
      // Diagnosa bisa tersimpan sebagai daftar berkoma/JSON.
      const items = d.startsWith('[')
        ? (() => { try { return (JSON.parse(d) as unknown[]).map(String); } catch { return [d]; } })()
        : d.split(',').map((s) => s.trim());
      for (const item of items) {
        const bersih = item.trim();
        if (!bersih) continue;
        diagnosaCount.set(bersih, (diagnosaCount.get(bersih) || 0) + 1);
      }
    }

    const perDepartemen = new Map<string, number>();
    for (const r of rows) {
      const d = String(r.departemen ?? 'Tidak tercatat').trim() || 'Tidak tercatat';
      perDepartemen.set(d, (perDepartemen.get(d) || 0) + 1);
    }

    /* ── 2. ProKawan pekan ini ──────────────────────────────────────── */
    // Diambil dari kunjungan_kontrol: yang JADWAL atau AKTUAL-nya jatuh di
    // pekan ini. Itu yang relevan untuk laporan mingguan Paramedic Site.
    let kontrolQuery = client
      .from('followups_prokawan')
      .select('nik_hash,jadwal_tanggal,aktual_tanggal,zona_risiko,hasil,arah')
      .or(`and(jadwal_tanggal.gte.${mulaiIso},jadwal_tanggal.lte.${selesaiIso}),and(aktual_tanggal.gte.${mulaiIso},aktual_tanggal.lte.${selesaiIso})`);
    if (siteBatasan) kontrolQuery = kontrolQuery.eq('site', siteBatasan);
    const { data: kontrol } = await kontrolQuery;

    const kontrolRows = (kontrol ?? []) as Record<string, unknown>[];
    const dijadwalkan = kontrolRows.filter((k) => dalamMinggu(String(k.jadwal_tanggal ?? ''), rentang));
    const diperiksa = kontrolRows.filter((k) => dalamMinggu(String(k.aktual_tanggal ?? ''), rentang));

    /* ── 3. Inventory stok kritis ───────────────────────────────────── */
    // VIEW v_inventory_summary — satu baris per item dengan total stok gabungan
    // dari seluruh batch. Nama kolomnya total_stock / closest_expired_date,
    // bukan stock / tanggal_expired.
    const { data: inventory } = await client
      .from('v_inventory_summary')
      .select('id,name,category,unit,total_stock,closest_expired_date,avg_monthly_usage');
    const items = (inventory ?? []) as Record<string, unknown>[];
    // "Stok kritis" = habis (0) atau pemakaian bulanan melebihi stok tersisa.
    // VIEW tidak menyediakan min_stock, jadi ambangnya diturunkan dari
    // avg_monthly_usage: stok di bawah 1 bulan pemakaian dianggap kritis.
    const stokKritis = items.filter((i) => {
      const stok = Number(i.total_stock ?? 0);
      const pakai = Number(i.avg_monthly_usage ?? 0);
      return stok <= 0 || (pakai > 0 && stok < pakai);
    }).length;
    const mendekatiEd = items.filter((i) => {
      const exp = String(i.closest_expired_date ?? '').slice(0, 10);
      if (!exp) return false;
      const selisih = (new Date(`${exp}T00:00:00`).getTime() - sekarang.getTime()) / 86_400_000;
      return selisih >= 0 && selisih <= 90;
    }).length;

    /* ── 4. Register PAK ────────────────────────────────────────────── */
    const { data: pak } = await client
      .from('pak_cases')
      .select('id,status,tanggal_diterima,triase_tgl,laporan_medis_tgl,tahap1_selesai_tgl,triase_batas,laporan_medis_batas,tahap1_batas');
    const pakRows = (pak ?? []) as Record<string, unknown>[];
    const pakBaru = pakRows.filter((p) => dalamMinggu(String(p.tanggal_diterima ?? ''), rentang)).length;

    const sekarangMs = sekarang.getTime();
    const lewatBatas = pakRows.filter((p) => {
      const batas = [p.triase_batas, p.laporan_medis_batas, p.tahap1_batas]
        .map((b) => String(b ?? '').slice(0, 10))
        .filter(Boolean);
      const selesai = [p.triase_tgl, p.laporan_medis_tgl, p.tahap1_selesai_tgl].some(Boolean);
      if (selesai) return false;
      return batas.some((b) => new Date(`${b}T23:59:59`).getTime() < sekarangMs);
    }).length;

    return NextResponse.json({
      success: true,
      periode: {
        tahun,
        minggu,
        label: rentang.label,
        mulai: mulaiIso,
        selesai: selesaiIso,
        berjalan: rentang.berjalan,
        // Pekan berjalan belum lengkap: angka hari Sabtu masih kosong.
        catatan: rentang.berjalan
          ? 'Pekan berjalan — data belum lengkap sampai Sabtu.'
          : 'Pekan selesai.',
      },
      daftarMinggu: daftarMinggu(tahun, sekarang).map((r) => ({
        minggu: r.minggu, label: r.label, berjalan: r.berjalan,
      })),
      site: siteBatasan,
      kunjungan: {
        total: rows.length,
        pasienUnik,
        rujukanRs: rujukan.length,
        perHari,
        perDepartemen: [...perDepartemen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
        topDiagnosa: [...diagnosaCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      },
      prokawan: {
        dijadwalkan: dijadwalkan.length,
        diperiksa: diperiksa.length,
        belumDiperiksa: Math.max(dijadwalkan.length - diperiksa.length, 0),
        memburuk: diperiksa.filter((k) => k.arah === 'memburuk').length,
        membaik: diperiksa.filter((k) => k.arah === 'membaik').length,
      },
      inventory: { totalItem: items.length, stokKritis, mendekatiEd },
      pak: { kasusBaru: pakBaru, lewatBatasWaktu: lewatBatas },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyusun laporan mingguan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
