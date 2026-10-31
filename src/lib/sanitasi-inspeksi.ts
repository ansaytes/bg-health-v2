// ============================================================
// Checklist Inspeksi Higiene & Sanitasi — BG/QSHE/STD/005 Rev.001
// ============================================================
//
// DASAR: SOP/028 poin 5.7 menempatkan "Fasilitas Higiene Sanitasi dan Gizi
// Kerja" sebagai bagian pengelolaan kesehatan kerja, merujuk BG/QSHE/STD/005.
//
// STRUKTUR STD/005 (8 tabel parameter):
//   A. Toilet pria / wanita (Permenkes 48/2016 Tabel 2 & 3)
//   B. Jamban & peturasan (Permenaker 5/2018 Pasal 34)
//   C. Kualitas air minum (Permenkes 48/2016 Tabel 1)
//   D. Kebisingan per ruang (Permenkes 48/2016)
//   E. Pencahayaan per ruang (Permenkes 48/2016 Tabel 4)
//   F. Vektor & binatang pembawa penyakit (Permenkes 48/2016)
//   G. Kualitas udara dalam ruangan (Permenkes 48/2016 + Permenaker 5/2018)
//   H. Tempat sampah (Permenaker 5/2018 Pasal 37–38)
//
// KEPUTUSAN DESAIN
// Sebagian parameter BISA DIHITUNG OTOMATIS dari jumlah pekerja dan hasil
// pengukuran (rasio toilet, kecukupan jamban, indeks vektor). Sebagian lagi
// hanya kualitatif (label tempat sampah, kelengkapan toilet disabilitas) dan
// harus dinilai inspektur. Keduanya dibedakan lewat `tipe`.
// ============================================================

export type TipeItem = 'hitung' | 'nilai';

export type KategoriInspeksi =
  | 'toilet'
  | 'air_minum'
  | 'kebisingan'
  | 'pencahayaan'
  | 'vektor'
  | 'udara'
  | 'sampah';

export interface ItemInspeksi {
  key: string;
  kategori: KategoriInspeksi;
  label: string;
  /** 'hitung' = sistem menghitung kepatuhan; 'nilai' = penilaian inspektur. */
  tipe: TipeItem;
  satuan?: string;
  /** Batas/ambang menurut dokumen, untuk ditampilkan di form. */
  acuan: string;
  /** Sumber pasal/tabel dokumen — penting untuk audit. */
  sumber: string;
}

export const KATEGORI_LABEL: Record<KategoriInspeksi, string> = {
  toilet: 'Toilet, Jamban & Peturasan',
  air_minum: 'Kualitas Air Minum',
  kebisingan: 'Kebisingan Ruang',
  pencahayaan: 'Pencahayaan Ruang',
  vektor: 'Vektor & Binatang Pembawa Penyakit',
  udara: 'Kualitas Udara Dalam Ruangan',
  sampah: 'Tempat Sampah',
};

export const ITEM_INSPEKSI: ItemInspeksi[] = [
  // ── Toilet (dihitung dari jumlah pekerja & fasilitas) ──────────────
  { key: 'pekerja_pria', kategori: 'toilet', label: 'Jumlah pekerja pria', tipe: 'hitung', satuan: 'orang', acuan: '—', sumber: 'Input' },
  { key: 'pekerja_wanita', kategori: 'toilet', label: 'Jumlah pekerja wanita', tipe: 'hitung', satuan: 'orang', acuan: '—', sumber: 'Input' },
  { key: 'toilet_pria', kategori: 'toilet', label: 'Jumlah toilet pria', tipe: 'hitung', satuan: 'unit', acuan: 'Rasio 1:40', sumber: 'Permenkes 48/2016 Tabel A3' },
  { key: 'toilet_wanita', kategori: 'toilet', label: 'Jumlah toilet wanita', tipe: 'hitung', satuan: 'unit', acuan: 'Rasio 1:25', sumber: 'Permenkes 48/2016 Tabel A3' },
  { key: 'jamban_total', kategori: 'toilet', label: 'Jumlah jamban', tipe: 'hitung', satuan: 'unit', acuan: 'Sesuai tabel B1', sumber: 'Permenaker 5/2018 Pasal 34(5)' },
  { key: 'peturasan', kategori: 'toilet', label: 'Jumlah peturasan', tipe: 'hitung', satuan: 'unit', acuan: 'Lihat Tabel A1', sumber: 'Permenkes 48/2016 Tabel A1' },
  { key: 'wastafel', kategori: 'toilet', label: 'Jumlah wastafel', tipe: 'hitung', satuan: 'unit', acuan: 'Lihat Tabel A1', sumber: 'Permenkes 48/2016 Tabel A1' },
  { key: 'toilet_disabilitas', kategori: 'toilet', label: 'Toilet disabilitas tersedia', tipe: 'nilai', acuan: '152,5 × 227,5 cm, pintu ≥90 cm', sumber: 'Permenaker 5/2018 Pasal 35' },
  { key: 'kebersihan_toilet', kategori: 'toilet', label: 'Kebersihan toilet', tipe: 'nilai', acuan: 'Tidak berbau, tidak ada genangan', sumber: 'Permenaker 5/2018' },

  // ── Air minum ──────────────────────────────────────────────────────
  { key: 'air_uji_terakhir', kategori: 'air_minum', label: 'Tanggal uji air terakhir', tipe: 'nilai', acuan: 'Minimal 2× per tahun', sumber: 'Permenkes 48/2016 Tabel C' },
  { key: 'air_koliform', kategori: 'air_minum', label: 'Total koliform', tipe: 'hitung', satuan: 'per 100 ml', acuan: '0', sumber: 'Permenkes 48/2016 Tabel C' },
  { key: 'air_kekeruhan', kategori: 'air_minum', label: 'Kekeruhan', tipe: 'hitung', satuan: 'NTU', acuan: '≤5', sumber: 'Permenkes 48/2016 Tabel C' },
  { key: 'air_tds', kategori: 'air_minum', label: 'Total zat padat terlarut', tipe: 'hitung', satuan: 'mg/l', acuan: '≤500', sumber: 'Permenkes 48/2016 Tabel C' },
  { key: 'air_ph', kategori: 'air_minum', label: 'pH', tipe: 'hitung', acuan: '6,5–8,5', sumber: 'Permenkes 48/2016 Tabel C' },
  { key: 'air_rasa_bau', kategori: 'air_minum', label: 'Rasa & bau', tipe: 'nilai', acuan: 'Tidak berasa, tidak berbau', sumber: 'Permenkes 48/2016 Tabel C' },
  { key: 'air_titik_sampel', kategori: 'air_minum', label: 'Titik sampel (sumber/bak/kran terjauh)', tipe: 'nilai', acuan: 'Ketiga titik diuji', sumber: 'Permenkes 48/2016 Tabel C' },

  // ── Kebisingan ─────────────────────────────────────────────────────
  { key: 'bising_kantor_terbuka', kategori: 'kebisingan', label: 'Kebisingan ruang kantor terbuka', tipe: 'hitung', satuan: 'dBA', acuan: '55–65', sumber: 'Permenkes 48/2016 Tabel D' },
  { key: 'bising_kantor_pribadi', kategori: 'kebisingan', label: 'Kebisingan ruang kantor pribadi', tipe: 'hitung', satuan: 'dBA', acuan: '50–55', sumber: 'Permenkes 48/2016 Tabel D' },
  { key: 'bising_kantin', kategori: 'kebisingan', label: 'Kebisingan ruang umum/kantin', tipe: 'hitung', satuan: 'dBA', acuan: '65–75', sumber: 'Permenkes 48/2016 Tabel D' },
  { key: 'bising_rapat', kategori: 'kebisingan', label: 'Kebisingan ruang rapat', tipe: 'hitung', satuan: 'dBA', acuan: '65–70', sumber: 'Permenkes 48/2016 Tabel D' },
  { key: 'bising_alat', kategori: 'kebisingan', label: 'Alat ukur (SLM) & tinggi pengukuran', tipe: 'nilai', acuan: 'SLM, ±1,50 m dari lantai', sumber: 'Permenkes 48/2016 Tabel D' },

  // ── Pencahayaan ────────────────────────────────────────────────────
  // DIPINDAH ke tab "Pencahayaan & Udara" (lib/lingkungan-kerja.ts).
  // Alasan: pencahayaan diukur PER RUANG pada bidang kerja dengan luxmeter,
  // dan NAB-nya bergantung peruntukan ruang (arsip 150 vs gambar 750 lux).
  // Satu angka per site tidak bisa mewakili itu. Kategori dipertahankan agar
  // data inspeksi lama tetap dapat dibaca.

  // ── Vektor ─────────────────────────────────────────────────────────
  { key: 'vektor_lalat', kategori: 'vektor', label: 'Indeks lalat', tipe: 'hitung', satuan: 'ekor/fly grill', acuan: '≤8 per 30 menit', sumber: 'Permenkes 48/2016 Tabel F' },
  { key: 'vektor_kecoa', kategori: 'vektor', label: 'Indeks kecoa', tipe: 'hitung', satuan: 'ekor/plate', acuan: '≤2 per 24 jam', sumber: 'Permenkes 48/2016 Tabel F' },
  { key: 'vektor_nyamuk', kategori: 'vektor', label: 'Container Index nyamuk', tipe: 'hitung', satuan: '%', acuan: '≤5', sumber: 'Permenkes 48/2016 Tabel F' },
  { key: 'vektor_tikus', kategori: 'vektor', label: 'Indeks tikus', tipe: 'hitung', satuan: 'indeks', acuan: '0 (nihil)', sumber: 'Permenkes 48/2016 Tabel F' },

  // ── Udara ──────────────────────────────────────────────────────────
  // DIPINDAH ke tab "Pencahayaan & Udara". Kualitas udara diukur per titik
  // dengan alat berbeda, dan PM10 sebagai rata-rata 8 jam — tidak mungkin
  // ditangkap satu angka per site.

  // ── Sampah ─────────────────────────────────────────────────────────
  { key: 'sampah_organik', kategori: 'sampah', label: 'Wadah sampah organik', tipe: 'nilai', acuan: 'Kedap air, bertutup, berlabel, terpisah', sumber: 'Permenaker 5/2018 Pasal 37' },
  { key: 'sampah_anorganik', kategori: 'sampah', label: 'Wadah sampah non-organik', tipe: 'nilai', acuan: 'Kedap air, bertutup, berlabel, terpisah', sumber: 'Permenaker 5/2018 Pasal 37' },
  { key: 'sampah_b3', kategori: 'sampah', label: 'Wadah sampah B3', tipe: 'nilai', acuan: 'Sesuai ketentuan B3, kedap air', sumber: 'Permenaker 5/2018 Pasal 37' },
  { key: 'sampah_pembalut', kategori: 'sampah', label: 'Wadah pembalut (toilet wanita)', tipe: 'nilai', acuan: 'Kedap cairan, bertutup, dibersihkan harian', sumber: 'Permenaker 5/2018 Pasal 38' },
];

/** Nilai isian satu item: angka (hitung) atau status (nilai). */
export type NilaiItem = number | 'SESUAI' | 'TIDAK_SESUAI' | 'TIDAK_ADA' | null;

export interface HasilItem {
  key: string;
  label: string;
  kategori: KategoriInspeksi;
  nilai: NilaiItem;
  /** 'sesuai' | 'tidak_sesuai' | 'belum_dinilai' */
  status: 'sesuai' | 'tidak_sesuai' | 'belum_dinilai';
  keterangan: string;
  sumber: string;
}

/**
 * Rentang patuh untuk parameter numerik, menurut STD/005.
 * Format: [min, max]; null = tidak dibatasi.
 */
const RENTANG: Record<string, [number | null, number | null]> = {
  air_koliform: [null, 0],
  air_kekeruhan: [null, 5],
  air_tds: [null, 500],
  air_ph: [6.5, 8.5],
  bising_kantor_terbuka: [55, 65],
  bising_kantor_pribadi: [50, 55],
  bising_kantin: [65, 75],
  bising_rapat: [65, 70],
  lux_kerja: [300, null],
  lux_gambar: [750, null],
  lux_arsip: [150, null],
  lux_koridor: [100, null],
  vektor_lalat: [null, 8],
  vektor_kecoa: [null, 2],
  vektor_nyamuk: [null, 5],
  vektor_tikus: [null, 0],
  udara_suhu: [23, 26],
  udara_kelembapan: [40, 60],
  udara_oksigen: [19.5, 23.5],
  udara_pm10: [null, 0.15],
  udara_ruang_per_orang: [10, null],
};

/**
 * Kebutuhan minimum jamban menurut jumlah tenaga kerja per satu waktu kerja.
 * Permenaker 5/2018 Pasal 34 ayat (5).
 */
export function jambanMinimum(jumlahPekerja: number): number {
  const tabel = [
    { max: 15, jamban: 1 },
    { max: 30, jamban: 2 },
    { max: 45, jamban: 3 },
    { max: 60, jamban: 4 },
    { max: 80, jamban: 5 },
    { max: 100, jamban: 6 },
  ];
  const baris = tabel.find((t) => jumlahPekerja <= t.max);
  if (baris) return baris.jamban;
  // Setiap penambahan 40 orang → +1 jamban (di atas 100).
  return 6 + Math.ceil((jumlahPekerja - 100) / 40);
}

/** Kebutuhan minimum toilet pria (1:40) & wanita (1:25). */
export function toiletMinimum(pria: number, wanita: number): { pria: number; wanita: number } {
  return {
    pria: pria > 0 ? Math.ceil(pria / 40) : 0,
    wanita: wanita > 0 ? Math.ceil(wanita / 25) : 0,
  };
}

/**
 * Menilai satu sesi inspeksi.
 *
 * `nilai` berisi isian per key. Item yang tidak diisi berstatus
 * `belum_dinilai` — BUKAN dianggap sesuai. Ini penting: checklist yang tidak
 * diisi tidak boleh memberi kesan patuh.
 */
export function nilaiInspeksi(nilai: Record<string, NilaiItem>): {
  items: HasilItem[];
  ringkasan: {
    total: number; sesuai: number; tidakSesuai: number; belumDinilai: number;
    persenSesuai: number;
    perKategori: Record<string, { sesuai: number; tidakSesuai: number; belumDinilai: number }>;
  };
} {
  const items: HasilItem[] = [];

  const pria = Number(nilai.pekerja_pria ?? 0);
  const wanita = Number(nilai.pekerja_wanita ?? 0);
  const minToilet = toiletMinimum(pria, wanita);
  const minJamban = jambanMinimum(pria + wanita);

  for (const it of ITEM_INSPEKSI) {
    const v = nilai[it.key] ?? null;
    let status: HasilItem['status'] = 'belum_dinilai';
    let keterangan = '';

    if (it.tipe === 'nilai') {
      if (v === 'SESUAI') { status = 'sesuai'; keterangan = 'Sesuai'; }
      else if (v === 'TIDAK_SESUAI' || v === 'TIDAK_ADA') {
        status = 'tidak_sesuai';
        keterangan = v === 'TIDAK_ADA' ? 'Tidak tersedia' : 'Tidak sesuai';
      }
    } else if (v !== null && Number.isFinite(Number(v))) {
      const angka = Number(v);
      let patuh = true;

      // Rasio fasilitas dihitung, bukan dibandingkan langsung.
      if (it.key === 'toilet_pria') {
        patuh = angka >= minToilet.pria;
        keterangan = `Minimum ${minToilet.pria} unit untuk ${pria} pekerja pria (1:40)`;
      } else if (it.key === 'toilet_wanita') {
        patuh = angka >= minToilet.wanita;
        keterangan = `Minimum ${minToilet.wanita} unit untuk ${wanita} pekerja wanita (1:25)`;
      } else if (it.key === 'jamban_total') {
        patuh = angka >= minJamban;
        keterangan = `Minimum ${minJamban} jamban untuk ${pria + wanita} pekerja (Pasal 34 ayat 5)`;
      } else if (RENTANG[it.key]) {
        const [min, max] = RENTANG[it.key];
        patuh = (min === null || angka >= min) && (max === null || angka <= max);
        keterangan = patuh ? 'Dalam rentang' : `Di luar rentang ${it.acuan} ${it.satuan ?? ''}`;
      } else {
        keterangan = '—';
      }

      status = patuh ? 'sesuai' : 'tidak_sesuai';
    }

    items.push({
      key: it.key, label: it.label, kategori: it.kategori,
      nilai: v, status, keterangan, sumber: it.sumber,
    });
  }

  const dinilai = items.filter((i) => i.status !== 'belum_dinilai');
  const sesuai = items.filter((i) => i.status === 'sesuai').length;
  const tidakSesuai = items.filter((i) => i.status === 'tidak_sesuai').length;

  const perKategori: Record<string, { sesuai: number; tidakSesuai: number; belumDinilai: number }> = {};
  for (const i of items) {
    const k = perKategori[i.kategori] ?? { sesuai: 0, tidakSesuai: 0, belumDinilai: 0 };
    if (i.status === 'sesuai') k.sesuai += 1;
    else if (i.status === 'tidak_sesuai') k.tidakSesuai += 1;
    else k.belumDinilai += 1;
    perKategori[i.kategori] = k;
  }

  return {
    items,
    ringkasan: {
      total: items.length,
      sesuai,
      tidakSesuai,
      belumDinilai: items.length - dinilai.length,
      // Persentase dihitung dari item YANG DINILAI, agar checklist setengah
      // jadi tidak terlihat lebih buruk daripada yang sebenarnya — tetapi
      // jumlah belum dinilai tetap ditampilkan terpisah.
      persenSesuai: dinilai.length ? (sesuai / dinilai.length) * 100 : 0,
      perKategori,
    },
  };
}
