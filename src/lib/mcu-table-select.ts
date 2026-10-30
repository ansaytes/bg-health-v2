// ============================================================
// Pemilihan kolom mcu_records yang aman
// ============================================================
//
// Seluruh 172 kolom mcu_records sudah diperiksa langsung ke database.
// Daftar ini hanya mengambil yang dibutuhkan untuk:
//   • baseline tindak lanjut
//   • perhitungan zona (engine STD/006)
//   • penentuan field abnormal (jalur 1 & 3)
//
// Kolom teks panjang (catatan, pemeriksaan_lain, diagnosa_medis, riwayat FU
// lama) sengaja dilewati karena tidak dipakai perhitungan dan memperlambat
// query. Bila ada kolom yang tidak ada di schema lain, JANGAN ditambahkan
// tanpa memeriksa nama sebenarnya — kesalahan satu nama membuat seluruh
// query gagal.

export const KOLOM_BASELINE = [
  // Identitas & administrasi
  'id', 'nik_karyawan', 'national_id', 'nama', 'jenis_kelamin', 'usia', 'jabatan',
  'site', 'tgl_mcu', 'tgl_expired', 'zonasi', 'trigger_zona',
  'pengendalian', 'frekuensi_evaluasi', 'kes_vendor', 'status_mcu',

  // Vital & antropometri
  'td_s', 'td_d', 'nadi', 'bb', 'tb', 'bmi', 'lp',

  // Hematologi
  'hb', 'leukosit', 'eritrosit', 'hematokrit', 'trombosit', 'mcv', 'mch', 'mchc', 'led',

  // Kimia darah
  'chol', 'tg', 'hdl', 'ldl', 'gdp', 'gd2pp', 'hba1c', 'au', 'ureum',
  'kreatinin', 'egfr', 'sgot', 'sgpt', 'ggt', 'alp', 'billirubin',

  // Serologi & NAPZA
  'hbsag', 'anti_hbs', 'vdrl', 'tpha', 'hiv',
  'drug_amp', 'drug_meth', 'drug_morph', 'drug_canna', 'drug_coc', 'drug_benz', 'drug_caris',
  'alkohol', 'psa',

  // Pencitraan & jantung
  'chest_xr', 'lumbo_xr', 'ecg_hasil', 'tm_hasil', 'usg',

  // Spirometri
  'fvc_pred', 'fvc_act', 'fvc_pct',
  'fev1_pred', 'fev1_act', 'fev1_pct',
  'fev1_fvc_pred', 'fev1_fvc_act', 'fev1_fvc_pct',
  'spi_interp',

  // Audiometri
  'acr_500', 'acr_1k', 'acr_2k', 'acr_4k', 'pta', 'aud_interp',

  // Mata
  'visus_jauh', 'visus_dekat', 'def_warna', 'lapang_pandang',

  // Neurologi & fisik
  'balance', 'romberg', 'phalen', 'thinel', 'patrick', 'kontra_patrick', 'laseque', 'kernig',

  // Anamnesis
  'merokok', 'riwayat_jantung', 'riwayat_stroke', 'riwayat_epilepsi', 'epilepsi_kepatuhan',
  'riwayat_asma', 'riwayat_sleep_apnea', 'lbp',
  'dm_komplikasi', 'mental_konfirmasi', 'artritis_urat', 'diagnosis_hati',
  'obesitas_fungsional', 'status_terapi_ess',

  // Kuesioner
  'ess_score', 'srq20_score', 'dass_depresi', 'dass_cemas', 'dass_stres',
].join(',');

export function selectFieldsForTable(): string {
  return KOLOM_BASELINE;
}
