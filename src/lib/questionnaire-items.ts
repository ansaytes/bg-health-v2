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
//   SDS     Zung Self-Rating Depression Scale, Zung (1965). Skala 1–4,
//           indeks kasar 20–80.
//
// PENTING: skor dihitung dari NOMOR item dan SKALA jawaban. Ganti teks naskah
// akan mengubah skor; mengganti urutan atau jumlah item tidak boleh dilakukan
// tanpa mengganti juga tabel skor di questionnaire-scores.ts.
//
// Catatan klinis: keempat instrumen ini adalah INSTRUMEN SKRINING, bukan
// alat diagnosis. Sesuai STD-006, konfirmasi diagnosis dan keputusan klinis
// ditetapkan oleh dokter atau psikiater.
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
// Zung Self-Rating Depression Scale — 20 item, skala 1–4
// Indeks kasar 20–80
// ────────────────────────────────────────────────────────────
//
// Sepuluh item bernada positif dinilai TERBALIK (skor = 5 − jawaban). Daftar
// item terbalik ada di SDS_REVERSED_ITEMS dan dipakai questionnaire-scores.ts.
// Tanpa pembalikan itu indeks jadi tidak bermakna: skor depresi bisa terlihat rendah
// justru pada orang yang paling depresif.
//
// Jawab untuk kondisi MINGGUAN TERAKHIR.

export const SDS_OPTIONS: ScaleOption[] = [
  { value: 1, label: 'Tidak pernah atau sangat jarang' },
  { value: 2, label: 'Kadang-kadang' },
  { value: 3, label: 'Cukup sering' },
  { value: 4, label: 'Hampir selalu atau selalu' },
];

/** Label ringkas untuk header kolom. */
export const SDS_OPTION_LABELS = ['Tidak pernah', 'Kadang-kadang', 'Cukup sering', 'Hampir selalu'];

/**
 * Nomor item SDS yang bernada positif, jadi dinilai terbalik.
 * Delapan dari sepuluh item ini adalah item bermuatan negatif; yang positif
 * justru dihitung dengan 5 − jawaban.
 */
export const SDS_REVERSED_ITEMS = [2, 4, 6, 11, 12, 14, 16, 17, 18, 20];

const S20 = (index: number, text: string): QuestionnaireItem => ({
  id: `sds${index}`,
  text,
  options: SDS_OPTIONS,
});

export const SDS_ITEMS: QuestionnaireItem[] = [
  S20(1, 'Saya merasa tidak bersemangat dan sedih'),
  S20(2, 'Saya merasa paling semangat pada pagi hari'),
  S20(3, 'Saya menangis atau merasa seperti ingin menangis'),
  S20(4, 'Saya makan sebanyak yang saya bisa makan'),
  S20(5, 'Saya mengalami kesulitan tidur pada malam hari'),
  S20(6, 'Saya masih menikmati seks'),
  S20(7, 'Saya merasa berat badan saya turun'),
  S20(8, 'Saya mengalami masalah pencernaan'),
  S20(9, 'Jantung saya berdetak lebih cepat dari normal'),
  S20(10, 'Saya merasa lelah tanpa alasan tertentu'),
  S20(11, 'Pikiran saya jernih seperti biasanya'),
  S20(12, 'Saya merasa mudah melakukan hal-hal yang biasa saya lakukan'),
  S20(13, 'Saya merasa gelisah dan tidak dapat tenang'),
  S20(14, 'Saya merasa penuh harapan akan masa depan'),
  S20(15, 'Saya lebih mudah tersinggung daripada biasanya'),
  S20(16, 'Saya merasa mudah membuat keputusan'),
  S20(17, 'Saya merasa saya berguna dan dibutuhkan'),
  S20(18, 'Hidup saya cukup bermakna'),
  S20(19, 'Saya merasa orang lain akan lebih baik jika saya mati'),
  S20(20, 'Saya masih menikmati hal-hal yang biasa saya lakukan'),
];
