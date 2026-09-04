/* ═══════════════════════════════════════════════════════════════
   Constants — month abbreviations + jobsite names
   These are LABELS / ENUMS, not data. All actual health indicator
   data lives in Supabase (health_indicators + sick_employees tables).
   ═══════════════════════════════════════════════════════════════ */

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

/**
 * All 53 jobsite names (52 sites + "All Site"). Mirrors Excel sheet order.
 * Used as fallback for the jobsite selector when Supabase query fails
 * (so the form remains usable even if Supabase is briefly unreachable).
 */
export const JOBSITES: string[] = [
  'All Site',
  'Aceh', 'Angsana', 'Tanjung Tabalong', 'Tuhup', 'Batu Kajang',
  'Bengalon', 'Tanjung Redeb', 'Binuang', 'Bontang', 'Kapuas Tengah',
  'Bunyu', 'Balikpapan', 'Banjarmasin', 'Banyuwangi', 'Binungan',
  'Bukit Pinang', 'Gunung Sari', 'Gunung Bintang Awai', 'Gorontalo',
  'Halmahera Timur', 'Ketapang', 'Kaliorang', 'Kaubun', 'Gunung Mas',
  'Kayong Utara', 'Kelubir', 'Konawe', 'Kota Baru', 'Labanan',
  'Lahat', 'Luwu', 'Malinau', 'Kotamobagu', 'Melak',
  'Morowali', 'Muara Bungo', 'Muara Enim', 'Muara Teweh', 'Murung Raya',
  'Palu', 'Rantau', 'Samarinda', 'Sangatta', 'Satui',
  'Sebakis', 'Senakin', 'Soroako', 'Tabang', 'Tenggarong',
  'Tri Yoga Morowali', 'Wetar', 'Head Office',
];
