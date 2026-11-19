// ============================================================
// Gizi Kerja & Higiene Sanitasi Jasaboga / Kantin
// ============================================================
// Acuan Regulasi:
//   1. Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran IV (Kesehatan Kerja Pertambangan)
//   2. Permenkes No. 1096/MENKES/PER/VI/2011 tentang Higiene Sanitasi Jasaboga
//   3. Permenkes No. 28 Tahun 2019 tentang Angka Kecukupan Gizi (AKG)
//   4. Pedoman Gizi Seimbang & Pengelolaan Makanan Kerja (HACCP)

export type StatusLaikJasaboga = 'laik' | 'laik_bersyarat' | 'tidak_laik';

export interface ItemInspeksiGizi {
  id: string;
  kategori: 'legalitas' | 'fasilitas' | 'pengolahan' | 'menu_penyajian';
  judul: string;
  keterangan: string;
  bobot: number;
}

export const KATEGORI_GIZI: Record<ItemInspeksiGizi['kategori'], { label: string; bobotTotal: number }> = {
  legalitas: { label: 'Legalitas & Penjamah Makanan', bobotTotal: 25 },
  fasilitas: { label: 'Fasilitas & Sanitasi Dapur', bobotTotal: 25 },
  pengolahan: { label: 'Penyimpanan & Pengolahan Bahan', bobotTotal: 25 },
  menu_penyajian: { label: 'Penyajian, Sampel & Kalori Menu', bobotTotal: 25 },
};

export const CHECKLIST_GIZI: ItemInspeksiGizi[] = [
  // 1. Legalitas & Penjamah
  {
    id: 'slhs',
    kategori: 'legalitas',
    judul: 'Sertifikat Laik Higiene Sanitasi Jasaboga (SLHS)',
    keterangan: 'Memiliki sertifikat laik higiene sanitasi jasaboga dari instansi berwenang yang masih berlaku.',
    bobot: 7,
  },
  {
    id: 'buku_sehat',
    kategori: 'legalitas',
    judul: 'Pemeriksaan Kesehatan & Sertifikat Penjamah Makanan',
    keterangan: 'Semua food handler menjalani pemeriksaan berkala (rectal swab/buku sehat) & sertifikat higiene.',
    bobot: 6,
  },
  {
    id: 'apd_penjamah',
    kategori: 'legalitas',
    judul: 'APD & Kelengkapan Higiene Penjamah',
    keterangan: 'Memakai celemek bersih, hairnet/tutup kepala, masker, sarung tangan plastik/penjepit makanan.',
    bobot: 6,
  },
  {
    id: 'perilaku_penjamah',
    kategori: 'legalitas',
    judul: 'Perilaku Higiene Penjamah Makanan',
    keterangan: 'Mencuci tangan dengan sabun/air mengalir, tidak merokok, kuku pendek/bersih, bebas perhiasan saat mengolah.',
    bobot: 6,
  },

  // 2. Fasilitas & Sanitasi
  {
    id: 'kebersihan_dapur',
    kategori: 'fasilitas',
    judul: 'Kebersihan Area Pengolahan & Beban Vektor',
    keterangan: 'Lantai, dinding, langit-langit bersih, kedap air, tidak licin, bebas hama (lalat, tikus, kecoa).',
    bobot: 7,
  },
  {
    id: 'ventilasi_hood',
    kategori: 'fasilitas',
    judul: 'Ventilasi, Hood Penghisap Asap & Cahaya',
    keterangan: 'Exhaust hood berfungsi membuang asap/panas, sirkulasi udara baik, pencahayaan kerja memadai (min 200 Lux).',
    bobot: 6,
  },
  {
    id: 'air_bersih_minum',
    kategori: 'fasilitas',
    judul: 'Pasokan Air Bersih & Kualitas Air Minum',
    keterangan: 'Air bersih mengalir mencukupi kebutuhan, air minum kantin memenuhi standar mikrobiologi & fisik.',
    bobot: 6,
  },
  {
    id: 'limbah_grease_trap',
    kategori: 'fasilitas',
    judul: 'Pengelolaan Sampah & Saluran Lemak (Grease Trap)',
    keterangan: 'Tempat sampah tertutup berlapis plastik dipilah, grease trap dibersihkan rutin tanpa bau.',
    bobot: 6,
  },

  // 3. Penyimpanan & Pengolahan
  {
    id: 'suhu_chiller_freezer',
    kategori: 'pengolahan',
    judul: 'Suhu Penyimpanan Chiller & Freezer',
    keterangan: 'Chiller 0-4°C, Freezer <-18°C, termometer suhu terpasang dan dicatat rutin (log sheet suhu).',
    bobot: 7,
  },
  {
    id: 'fifo_separasi_bahan',
    kategori: 'pengolahan',
    judul: 'Penerapan FIFO/FEFO & Pemisahan Bahan',
    keterangan: 'Bahan makanan berlabel tanggal terima/kadaluwarsa, pemisahan ketat bahan mentah (daging/unggas) dan siap saji.',
    bobot: 6,
  },
  {
    id: 'peralatan_foodgrade',
    kategori: 'pengolahan',
    judul: 'Peralatan Masak & Wadah Food Grade',
    keterangan: 'Talangan dan pisau dipisah warna (merah/hijau/putih), wadah stainless steel/food grade, bersih dan utuh.',
    bobot: 6,
  },
  {
    id: 'pencucian_desinfeksi',
    kategori: 'pengolahan',
    judul: 'Pencucian Alat Makan (Metode 3 Bak / Air Panas)',
    keterangan: 'Pencucian alat makan dengan air panas/desinfektan, pengeringan higienis tanpa lap kotor.',
    bobot: 6,
  },

  // 4. Menu, Penyajian & Kalori
  {
    id: 'food_sample',
    kategori: 'menu_penyajian',
    judul: 'Penyimpanan Sampel Makanan 1×24 Jam',
    keterangan: 'Sampel setiap menu disimpan di wadah steril tertutup dalam chiller minimal 1x24 jam untuk uji petik.',
    bobot: 7,
  },
  {
    id: 'uji_mikrobiologi',
    kategori: 'menu_penyajian',
    judul: 'Uji Laboratorium Mikrobiologi Sampel',
    keterangan: 'Uji berkala E. coli, Salmonella, dan angka kuman makanan/usap alat dengan hasil memenuhi syarat.',
    bobot: 6,
  },
  {
    id: 'kecukupan_kalori',
    kategori: 'menu_penyajian',
    judul: 'Kesesuaian Kalori Menu vs Standar Beban Kerja',
    keterangan: 'Porsi menu memenuhi komposisi makronutrien (karbo, protein, lemak) dan kalori sesuai shift kerja lapangan.',
    bobot: 6,
  },
  {
    id: 'extra_fooding',
    kategori: 'menu_penyajian',
    judul: 'Ketersediaan Extra Fooding Shift Malam / Lembur',
    keterangan: 'Disediakan suplemen/extra fooding bergizi (susu, telur, bubur kacang hijau, buah) untuk pekerja shift malam.',
    bobot: 6,
  },
];

export function hitungSkorInspeksiGizi(jawaban: Record<string, 'sesuai' | 'tidak_sesuai' | 'tidak_berlaku'>): {
  totalSkor: number;
  persenSkor: number;
  statusLaik: StatusLaikJasaboga;
  keteranganStatus: string;
  totalItemDinilai: number;
  totalSesuai: number;
  totalTidakSesuai: number;
} {
  let bobotMaksimal = 0;
  let bobotDiperoleh = 0;
  let totalSesuai = 0;
  let totalTidakSesuai = 0;

  for (const item of CHECKLIST_GIZI) {
    const status = jawaban[item.id];
    if (status === 'sesuai') {
      bobotMaksimal += item.bobot;
      bobotDiperoleh += item.bobot;
      totalSesuai += 1;
    } else if (status === 'tidak_sesuai') {
      bobotMaksimal += item.bobot;
      totalTidakSesuai += 1;
    }
  }

  const persenSkor = bobotMaksimal > 0 ? Math.round((bobotDiperoleh / bobotMaksimal) * 100) : 0;

  let statusLaik: StatusLaikJasaboga = 'tidak_laik';
  let keteranganStatus = 'Tidak Laik Operasional — Risiko tinggi pencemaran dan keracunan makanan.';

  if (persenSkor >= 85) {
    statusLaik = 'laik';
    keteranganStatus = 'Laik Operasional — Memenuhi standar higiene sanitasi jasaboga.';
  } else if (persenSkor >= 70) {
    statusLaik = 'laik_bersyarat';
    keteranganStatus = 'Laik Bersyarat — Perlu tindakan korektif segera dalam batas waktu yang ditentukan.';
  }

  return {
    totalSkor: bobotDiperoleh,
    persenSkor,
    statusLaik,
    keteranganStatus,
    totalItemDinilai: totalSesuai + totalTidakSesuai,
    totalSesuai,
    totalTidakSesuai,
  };
}
