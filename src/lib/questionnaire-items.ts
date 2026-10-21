// ============================================================
// Definisi Item Kuesioner — STD-006 Rev001
// ============================================================
//
// Naskah di bawah ini memakai rumusan instrumen asli, bukan adaptasi:
//
//   ESS     Epworth Sleepiness Scale, Murray & Johns (1991). Delapan situasi
//           dengan skor 0–4, rentang total 0–32.
//   SRQ-20  Self-Reporting Questionnaire-20, WHO. Ini juga instrumen resmi
//           Kemenkes RI yang dipakai Riskesdas sejak 1995, ambang batas ≥6.
//   DASS-21 Depression Anxiety Stress Scales-21, Lovibond & Lovibond (1995).
//           Skala 0–3, tiga subskala terpisah.
//   SDS-30  Survei Diagnosis Stres 30 item — Lampiran Permenaker No. 5 Tahun 2018
//           (K3 Lingkungan Kerja). Instrumen mengukur DOSA PSIKOLOGI KERJA,
//           bukan depresi. Skala 1–7, enam indikator × 5 item, skor indikator 5–35.
//
// PENTING: skor dihitung dari NOMOR item dan SKALA jawaban. Ganti teks naskah
// akan mengubah skor; mengganti urutan atau jumlah item tidak boleh dilakukan
// tanpa mengganti juga tabel skor di questionnaire-scores.ts.
//
// Catatan klinis: ESS, SRQ-20, dan DASS-21 adalah INSTRUMEN SKRINING, bukan
// alat diagnosis. SDS-30 adalah PENGUKURAN FAKTOR PSIKOLOGI KERJA. Sesuai
// STD-006, konfirmasi diagnosis dan keputusan klinis ditetapkan dokter.
// ============================================================

export interface ScaleOption {
  value: number;
  label: string;
}

export interface QuestionnaireItem {
  /** Prefix kolom di database, mis. "ess1" → kolom ess_1. */
  id: string;
  text: string;
  options: ScaleOption[];
}

// ────────────────────────────────────────────────────────────
// Epworth Sleepiness Scale — 8 item, skala 0–4, skor 0–32
// ────────────────────────────────────────────────────────────
//
// ESS menilai kantuk berlebihan di siang hari, bukan keseluruhan
// umum. Official scale anchorages: 0 = tidak pernah, 1 = jarang (kurang dari
// sebulan sekali dalam sebulan terakhir), 2 = kadang (1–2 kali dalam sebulan),
// 3 = sering (3–4 kali dalam sebulan), 4 = hampir setiap hari.

export const ESS_OPTIONS: ScaleOption[] = [
  { value: 0, label: 'Tidak pernah' },
  { value: 1, label: 'Jarang' },
  { value: 2, label: 'Kadang-kadang' },
  { value: 3, label: 'Sering' },
  { value: 4, label: 'Hampir setiap hari' },
];

export const ESS_ITEMS: QuestionnaireItem[] = [
  { id: 'ess1', text: 'Duduk dan membaca', options: ESS_OPTIONS },
  { id: 'ess2', text: 'Menonton televisi atau film', options: ESS_OPTIONS },
  { id: 'ess3', text: 'Duduk diam di tempat umum, seperti saat ceramah atau rapat', options: ESS_OPTIONS },
  { id: 'ess4', text: 'Duduk di dalam mobil saat berhenti sejenak dalam kemacetan', options: ESS_OPTIONS },
  { id: 'ess5', text: 'Duduk diam setelah makan siang', options: ESS_OPTIONS },
  { id: 'ess6', text: 'Berbaring untuk istirahat pada sore hari', options: ESS_OPTIONS },
  { id: 'ess7', text: 'Duduk dan berbicara dengan orang secara langsung', options: ESS_OPTIONS },
  { id: 'ess8', text: 'Mengendarai kendaraan, misal pada perjalanan jauh yang membosankan atau perjalanan pulang setelah shift panjang', options: ESS_OPTIONS },
];

// ────────────────────────────────────────────────────────────
// SRQ-20 — 20 item Ya/Tidak, skor 0–20, ambang batas ≥6
// ────────────────────────────────────────────────────────────
//
// Menanyakan gejala dalam 30 HARI terakhir. Nilai 1 untuk "Ya", 0 untuk
// "Tidak". Skor ≥6 berarti kemungkinan gangguan mental emosional yang perlu
// tindak lanjut (Balitbangkes Kemenkes RI).

export const SRQ20_OPTIONS: ScaleOption[] = [
  { value: 0, label: 'Tidak' },
  { value: 1, label: 'Ya' },
];

export const SRQ20_ITEMS: QuestionnaireItem[] = [
  { id: 'srq1', text: 'Apakah Anda sering menderita sakit kepala?', options: SRQ20_OPTIONS },
  { id: 'srq2', text: 'Apakah Anda tidak nafsu makan?', options: SRQ20_OPTIONS },
  { id: 'srq3', text: 'Apakah Anda sulit tidur?', options: SRQ20_OPTIONS },
  { id: 'srq4', text: 'Apakah Anda mudah merasa takut?', options: SRQ20_OPTIONS },
  { id: 'srq5', text: 'Apakah Anda merasa tegang, cemas, atau kuatir?', options: SRQ20_OPTIONS },
  { id: 'srq6', text: 'Apakah tangan Anda gemetar?', options: SRQ20_OPTIONS },
  { id: 'srq7', text: 'Apakah pencernaan Anda terganggu atau buruk?', options: SRQ20_OPTIONS },
  { id: 'srq8', text: 'Apakah Anda sulit untuk berpikir jernih?', options: SRQ20_OPTIONS },
  { id: 'srq9', text: 'Apakah Anda merasa tidak bahagia?', options: SRQ20_OPTIONS },
  { id: 'srq10', text: 'Apakah Anda menangis lebih sering?', options: SRQ20_OPTIONS },
  { id: 'srq11', text: 'Apakah Anda merasa sulit untuk menikmati kegiatan sehari-hari?', options: SRQ20_OPTIONS },
  { id: 'srq12', text: 'Apakah Anda sulit untuk mengambil keputusan?', options: SRQ20_OPTIONS },
  { id: 'srq13', text: 'Apakah pekerjaan Anda sehari-hari terganggu?', options: SRQ20_OPTIONS },
  { id: 'srq14', text: 'Apakah Anda tidak mampu melakukan hal-hal yang bermanfaat dalam hidup?', options: SRQ20_OPTIONS },
  { id: 'srq15', text: 'Apakah Anda kehilangan minat pada berbagai hal?', options: SRQ20_OPTIONS },
  { id: 'srq16', text: 'Apakah Anda merasa tidak berharga?', options: SRQ20_OPTIONS },
  { id: 'srq17', text: 'Apakah Anda mempunyai pikiran untuk mengakhiri hidup?', options: SRQ20_OPTIONS },
  { id: 'srq18', text: 'Apakah Anda merasa lelah sepanjang waktu?', options: SRQ20_OPTIONS },
  { id: 'srq19', text: 'Apakah Anda mengalami rasa tidak enak di perut?', options: SRQ20_OPTIONS },
  { id: 'srq20', text: 'Apakah Anda mudah lelah?', options: SRQ20_OPTIONS },
];

// ────────────────────────────────────────────────────────────
// DASS-21 — 21 item, skala 0–3, tiga subskala
// ────────────────────────────────────────────────────────────
//
// Jawab untuk kondisi MINGGUAN TERAKHIR. Anchor skala memakai rumusan asli
// Lovibond & Lovibond, karena labelnya memengaruhi pelaporan: angka 2 berarti
// "cukup sering", bukan sekadar "kadang".

export const DASS21_OPTIONS: ScaleOption[] = [
  { value: 0, label: 'Tidak sesuai dengan saya sama sekali, atau tidak pernah' },
  { value: 1, label: 'Sesuai dengan saya sampai tingkat tertentu, atau kadang-kadang' },
  { value: 2, label: 'Sesuai dengan saya sampai batas yang dapat dipertimbangkan, atau lumayan sering' },
  { value: 3, label: 'Sangat sesuai dengan saya, atau sering sekali' },
];

/** Label ringkas untuk header kolom. Teks lengkap ada di atas. */
export const DASS21_OPTION_LABELS = ['Tidak pernah', 'Kadang-kadang', 'Lumayan sering', 'Sering sekali'];

const D21 = (id: string, text: string): QuestionnaireItem => ({ id, text, options: DASS21_OPTIONS });

export const DASS21_ITEMS: QuestionnaireItem[] = [
  D21('dass1', 'Saya merasa sulit untuk beristirahat'),
  D21('dass2', 'Saya merasa bibir saya sering kering'),
  D21('dass3', 'Saya tidak bisa merasakan perasaan positif'),
  D21('dass4', 'Saya merasa sulit bernapas'),
  D21('dass5', 'Saya merasa kesulitan untuk memiliki inisiatif melakukan suatu hal'),
  D21('dass6', 'Saya sering kali bereaksi secara berlebihan dalam menanggapi suatu hal'),
  D21('dass7', 'Saya sering merasakan tremor atau gemetar di tangan saya'),
  D21('dass8', 'Saya merasa sering kehabisan tenaga akibat perasaan cemas'),
  D21('dass9', 'Saya sering merasa khawatir berada pada situasi yang dapat membuat saya merasa panik dan bersikap konyol'),
  D21('dass10', 'Saya merasa tidak memiliki sesuatu untuk dikerjakan'),
  D21('dass11', 'Saya sering merasa cemas atau khawatir'),
  D21('dass12', 'Saya sering kesulitan untuk bersantai'),
  D21('dass13', 'Saya sering merasa sedih dan tertekan'),
  D21('dass14', 'Saya tidak dapat mentoleransi semua hal yang mengganggu apa yang sedang saya kerjakan'),
  D21('dass15', 'Saya merasa sering panik'),
  D21('dass16', 'Saya tidak merasa enkhusiat dalam segala hal'),
  D21('dass17', 'Saya merasa tidak berguna sebagai manusia'),
  D21('dass18', 'Saya cenderung mudah tersinggung'),
  D21('dass19', 'Saya sering dapat merasakan ketika jantung berdetak kencang'),
  D21('dass20', 'Saya sering merasa takut tanpa alasan'),
  D21('dass21', 'Saya merasa hidup saya tidak berharga'),
];

/**
 * Pembagian item DASS-21 ke tiga subskala, mengikuti naskah asli
 * Lovibond & Lovibond (1995).
 */
export const DASS21_SECTIONS = [
  { id: 'depresi' as const, title: 'Depresi', subtitle: 'Depression', items: [3, 5, 10, 13, 16, 17, 19, 20, 21] },
  { id: 'ansietas' as const, title: 'Ansietas', subtitle: 'Anxiety', items: [2, 4, 6, 9, 12, 15, 18] },
  { id: 'stres' as const, title: 'Stres', subtitle: 'Stress', items: [1, 7, 8, 11, 14] },
];

// ────────────────────────────────────────────────────────────
// SDS-30 — Survei Diagnosis Stres, 30 item
// Lampiran Permenaker No. 5 Tahun 2018 (K3 Lingkungan Kerja)
// Skala 1–7 · 6 indikator × 5 item · skor indikator 5–35
// ────────────────────────────────────────────────────────────
//
// Instrumen ini mengukur FAKTOR PSIKOLOGI KERJA (ketaksaan peran, konflik
// peran, beban kerja berlebih, pengembangan karir, tanggung jawab terhadap
// orang lain) — BUKAN depresi. Tidak ada item yang dinilai terbalik.
//
// Rentang waktu yang ditanyakan: 1 BULAN TERAKHIR.

export const SDS_OPTIONS: ScaleOption[] = [
  { value: 1, label: 'Sangat tidak pernah / sangat tidak sesuai' },
  { value: 2, label: 'Tidak pernah / tidak sesuai' },
  { value: 3, label: 'Jarang / kurang sesuai' },
  { value: 4, label: 'Kadang-kadang / agak sesuai' },
  { value: 5, label: 'Sering / sesuai' },
  { value: 6, label: 'Sangat sering / sangat sesuai' },
  { value: 7, label: 'Selalu / sangat sesuai sekali' },
];

/** Label ringkas untuk header kolom. */
export const SDS_OPTION_LABELS = ['1', '2', '3', '4', '5', '6', '7'];

/**
 * Enam indikator SDS-30, masing-masing 5 nomor item — sesuai Lampiran
 * Permenaker 5/2018. Nomor 1-based mengikuti urutan pertanyaan kuesioner.
 */
export const SDS_SECTIONS = [
  { id: 'ketaksaan-peran' as const, title: 'Ketaksaan Peran', items: [1, 7, 13, 19, 25] },
  { id: 'konflik-peran' as const, title: 'Konflik Peran', items: [2, 8, 14, 20, 26] },
  { id: 'beban-kuantitatif' as const, title: 'Beban Kerja Kuantitatif Berlebih', items: [3, 9, 15, 21, 27] },
  { id: 'beban-kualitatif' as const, title: 'Beban Kerja Kualitatif Berlebih', items: [4, 10, 16, 22, 28] },
  { id: 'pengembangan-karir' as const, title: 'Pengembangan Karir', items: [5, 11, 17, 23, 29] },
  { id: 'tanggung-jawab' as const, title: 'Tanggung Jawab Terhadap Orang Lain', items: [6, 12, 18, 24, 30] },
];

const S30 = (index: number, text: string): QuestionnaireItem => ({
  id: `sds${index}`,
  text,
  options: SDS_OPTIONS,
});

export const SDS_ITEMS: QuestionnaireItem[] = [
  // Ketaksaan Peran
  S30(1, 'Saya tidak tahu pasti apa yang menjadi tanggung jawab utama dalam pekerjaan saya'),
  // Konflik Peran
  S30(2, 'Saya harus melanggar prosedur atau aturan untuk menyelesaikan suatu pekerjaan'),
  // Beban Kerja Kuantitatif Berlebih
  S30(3, 'Saya memiliki terlalu banyak pekerjaan yang harus diselesaikan dalam kurun waktu singkat'),
  // Beban Kerja Kualitatif Berlebih
  S30(4, 'Tingkat kesulitan tugas saya berada di atas batas kemampuan atau keterampilan yang saya miliki'),
  // Pengembangan Karir
  S30(5, 'Peluang promosi atau kemajuan jenjang karir saya di perusahaan ini sangat terbatas'),
  // Tanggung Jawab Terhadap Orang Lain
  S30(6, 'Pekerjaan saya menuntut tanggung jawab besar atas keselamatan atau kesejahteraan orang lain'),

  S30(7, 'Saya tidak mengerti bagaimana tugas-tugas saya saling berkaitan satu sama lain'),
  S30(8, 'Saya menerima perintah atau permintaan yang bertentangan dari dua atasan atau lebih'),
  S30(9, 'Waktu yang diberikan untuk menyelesaikan volume pekerjaan saya sangat terbatas'),
  S30(10, 'Saya sering menghadapi tuntutan pekerjaan yang terlalu rumit atau kompleks'),
  S30(11, 'Saya merasa cemas terhadap kepastian masa depan dan jaminan keberlanjutan pekerjaan saya'),
  S30(12, 'Saya merasa terbeban karena harus memikirkan nasib, kinerja, atau masalah bawahan/rekan kerja'),

  S30(13, 'Sasaran dan target kinerja pekerjaan saya tidak dijelaskan secara jernih oleh pimpinan'),
  S30(14, 'Saya diminta melakukan hal-hal yang tidak sesuai atau bertentangan dengan prinsip pribadi saya'),
  S30(15, 'Saya harus bekerja tergesa-gesa karena tumpukan volume pekerjaan yang sangat banyak'),
  S30(16, 'Kurangnya pelatihan membuat saya kesulitan menyelesaikan tugas-tugas khusus'),
  S30(17, 'Hasil kerja keras dan prestasi saya jarang diakui atau dihargai oleh pihak manajemen'),
  S30(18, 'Kesalahan kecil yang saya buat dalam bekerja dapat berdampak fatal bagi orang lain'),

  S30(19, 'Saya tidak yakin seberapa besar batasan wewenang yang saya miliki dalam pengambilan keputusan'),
  S30(20, 'Saya sering diberikan tugas-tugas tambahan yang tidak relevan dengan posisi kerja saya'),
  S30(21, 'Tingginya jumlah pekerjaan mengganggu mutu dan kualitas hasil kerja saya'),
  S30(22, 'Saya dituntut membuat keputusan penting mengenai hal yang belum saya kuasai sepenuhnya'),
  S30(23, 'Posisi saya saat ini tidak memberikan kesempatan untuk mengembangkan potensi diri'),
  S30(24, 'Saya sering harus memediasi atau menangani konflik antarpekerja yang menguras energi'),

  S30(25, 'Perencanaan kerja dan alokasi waktu penugasan tidak disampaikan dengan jelas'),
  S30(26, 'Saya menerima penugasan tanpa didukung oleh fasilitas, peralatan, atau sumber daya yang memadai'),
  S30(27, 'Saya tidak memiliki waktu istirahat yang cukup saat jam kerja akibat tumpukan tugas'),
  S30(28, 'Standar kualitas hasil kerja yang ditetapkan perusahaan sangat tinggi dan sulit dicapai'),
  S30(29, 'Penilaian kinerja pekerja dilakukan secara tidak adil atau tidak transparan'),
  S30(30, 'Saya memikul beban tanggung jawab atas pembagian tugas dan hasil evaluasi kerja staf lain'),
];
