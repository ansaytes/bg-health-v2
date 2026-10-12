// src/lib/ergo-wizard.ts — definisi pertanyaan bergambar untuk survei RULA (FORM/116), ROSA (FORM/117), WERA (FORM/118).
// Gambar diambil dari formulir resmi (public/ergo/*.png). Skor tiap pilihan mengikuti worksheet/figur pada formulir.
import type { Metode } from '@/lib/hc-ergo';

export interface Choice { id: string; label: string; score: number; img?: string; }
export interface Modifier { id: string; label: string; delta: number; img?: string; }
export interface Question {
  key: string;                 // nama field input untuk lib/hc-ergo.ts (scoreRULA/ROSA/WERA)
  group: string;               // judul kelompok langkah
  title: string;
  guide: string[];             // petunjuk pengisian (dari formulir)
  image?: string;              // gambar referensi resmi (satu gambar untuk seluruh pertanyaan)
  imageCaption?: string;
  choices: Choice[];           // pilih tepat satu
  mods?: Modifier[];           // penyesuaian (boleh lebih dari satu)
  min: number; max: number;    // batas skor akhir langkah (sesuai tabel formulir)
  imageChoices?: boolean;      // (tidak dipakai lagi; kartu bergambar otomatis bila ada pilihan ber-gambar)
}
export interface WizardDef {
  metode: Metode; formNo: string; title: string; source: string; intro: string[]; questions: Question[]; interpretasi: { range: string; text: string }[];
}

export type Answer = { choice?: string; mods: string[] };
export type Answers = Record<string, Answer>;

/** Nilai langkah = skor pilihan + total penyesuaian, dibatasi min..max. Null bila belum dijawab. */
export function questionValue(q: Question, a?: Answer): number | null {
  if (!a?.choice) return null;
  const c = q.choices.find((x) => x.id === a.choice);
  if (!c) return null;
  const delta = (q.mods || []).filter((m) => a.mods.includes(m.id)).reduce((t, m) => t + m.delta, 0);
  return Math.max(q.min, Math.min(q.max, c.score + delta));
}

const P = '/ergo/';          // gambar referensi resmi (potongan formulir)
const S = '/ergo/svg/';      // ilustrasi SVG per pilihan
const ya = (id: string, label: string, score: number): Choice => ({ id, label, score });
const MUSCLE: Choice[] = [
  ya('0', 'Tidak: postur tidak statis dan gerakan tidak berulang', 0),
  ya('1', 'Ya: postur sebagian besar statis (ditahan > 10 menit) atau gerakan berulang ≥ 4× per menit (+1)', 1),
];
const FORCE: Choice[] = [
  ya('0', 'Beban < 2 kg (4,4 lbs), sesekali (intermittent) (+0)', 0),
  ya('1', 'Beban 2–10 kg (4,4–22 lbs), sesekali (+1)', 1),
  ya('2', 'Beban 2–10 kg (4,4–22 lbs), statis atau berulang (+2)', 2),
  ya('3', 'Beban > 10 kg (22 lbs), atau berulang, atau ada hentakan/kejutan (+3)', 3),
];

/* ═════════════ RULA — FORM/116 (McAtamney & Corlett) ═════════════ */
export const RULA_DEF: WizardDef = {
  metode: 'RULA', formNo: 'BG/QSHE/FORM/116', title: 'RULA — Rapid Upper Limb Assessment',
  source: 'Gambar: RULA Employee Assessment Worksheet pada FORM/116 (McAtamney & Corlett, 1993)',
  intro: [
    'Amati satu siklus kerja yang representatif (foto/video), pilih sisi tubuh yang paling berisiko.',
    'Jawab langkah demi langkah sesuai worksheet RULA: tentukan posisi, lalu centang penyesuaian (adjust) bila ada.',
    'Skor akhir diambil otomatis dari Table A, B, dan C pada formulir.',
  ],
  questions: [
    { key: 'upper_arm', group: 'A. Analisis Lengan & Pergelangan Tangan', title: 'Langkah 1 — Posisi lengan atas',
      guide: ['Cari posisi lengan atas pada gambar (sudut diukur dari badan).', 'Langkah 1a — Penyesuaian: bahu terangkat +1; lengan atas abduksi (menjauhi badan) +1; lengan tersangga atau pekerja bersandar −1.'],
      image: P + 'rula_upper_arm.png', imageCaption: 'Langkah 1: posisi lengan atas',
      choices: [ya('1', '20° ekstensi sampai 20° fleksi (+1)', 1), ya('2', 'Ekstensi > 20° atau fleksi 20°–45° (+2)', 2), ya('3', 'Fleksi 45°–90° (+3)', 3), ya('4', 'Fleksi > 90° (+4)', 4)],
      mods: [{ id: 'raised', label: 'Bahu terangkat (+1)', delta: 1 }, { id: 'abducted', label: 'Lengan atas abduksi / menjauhi badan (+1)', delta: 1 }, { id: 'supported', label: 'Lengan tersangga atau pekerja bersandar (−1)', delta: -1 }], min: 1, max: 6 },
    { key: 'lower_arm', group: 'A. Analisis Lengan & Pergelangan Tangan', title: 'Langkah 2 — Posisi lengan bawah',
      guide: ['Langkah 2a — Penyesuaian: bila salah satu lengan bekerja melewati garis tengah tubuh atau keluar ke sisi badan, tambah +1.'],
      image: P + 'rula_lower_arm.png', imageCaption: 'Langkah 2: posisi lengan bawah',
      choices: [ya('1', 'Fleksi 60°–100° (+1)', 1), ya('2', 'Fleksi < 60° atau > 100° (+2)', 2)],
      mods: [{ id: 'midline', label: 'Lengan bekerja melewati garis tengah / keluar ke sisi badan (+1)', delta: 1 }], min: 1, max: 3 },
    { key: 'wrist', group: 'A. Analisis Lengan & Pergelangan Tangan', title: 'Langkah 3 — Posisi pergelangan tangan',
      guide: ['Langkah 3a — Penyesuaian: bila pergelangan tangan menekuk menjauhi garis tengah (deviasi radial/ulnar), tambah +1.'],
      image: P + 'rula_wrist.png', imageCaption: 'Langkah 3: posisi pergelangan tangan',
      choices: [ya('1', 'Posisi netral 0° (+1)', 1), ya('2', 'Fleksi/ekstensi 0°–15° (+2)', 2), ya('3', 'Fleksi/ekstensi > 15° (+3)', 3)],
      mods: [{ id: 'dev', label: 'Pergelangan menekuk dari garis tengah (+1)', delta: 1 }], min: 1, max: 4 },
    { key: 'wrist_twist', group: 'A. Analisis Lengan & Pergelangan Tangan', title: 'Langkah 4 — Putaran pergelangan tangan (wrist twist)',
      guide: ['T1 = diputar di tengah rentang putaran.', 'T2 = diputar pada atau mendekati batas akhir rentang putaran.'],
      choices: [ya('1', 'T1 — diputar di tengah rentang (+1)', 1), ya('2', 'T2 — pada / mendekati batas akhir rentang (+2)', 2)], min: 1, max: 2 },
    { key: 'muscle_a', group: 'A. Analisis Lengan & Pergelangan Tangan', title: 'Langkah 6 — Penggunaan otot (grup A)',
      guide: ['Tambahkan +1 bila postur sebagian besar statis (ditahan > 10 menit) atau gerakan berulang 4× per menit atau lebih.'], choices: MUSCLE, min: 0, max: 1 },
    { key: 'force_a', group: 'A. Analisis Lengan & Pergelangan Tangan', title: 'Langkah 7 — Beban / tenaga (grup A)',
      guide: ['Pilih kategori beban yang sesuai (konversi: 4,4 lbs = 2 kg; 22 lbs = 10 kg).'], choices: FORCE, min: 0, max: 3 },
    { key: 'neck', group: 'B. Analisis Leher, Batang Tubuh & Kaki', title: 'Langkah 9 — Posisi leher',
      guide: ['Langkah 9a — Penyesuaian: leher terpuntir +1; leher menekuk ke samping +1.'],
      image: P + 'rula_neck.png', imageCaption: 'Langkah 9: posisi leher',
      choices: [ya('1', 'Fleksi 0°–10° (+1)', 1), ya('2', 'Fleksi 10°–20° (+2)', 2), ya('3', 'Fleksi > 20° (+3)', 3), ya('4', 'Ekstensi / mendongak (+4)', 4)],
      mods: [{ id: 'twist', label: 'Leher terpuntir (+1)', delta: 1 }, { id: 'side', label: 'Leher menekuk ke samping (+1)', delta: 1 }], min: 1, max: 6 },
    { key: 'trunk', group: 'B. Analisis Leher, Batang Tubuh & Kaki', title: 'Langkah 10 — Posisi batang tubuh',
      guide: ['Langkah 10a — Penyesuaian: batang tubuh terpuntir +1; batang tubuh menekuk ke samping +1.'],
      image: P + 'rula_trunk.png', imageCaption: 'Langkah 10: posisi batang tubuh',
      choices: [ya('1', 'Duduk dan tersangga baik, sudut pinggul–badan > 90° (+1)', 1), ya('2', 'Fleksi 0°–20° (+2)', 2), ya('3', 'Fleksi 20°–60° (+3)', 3), ya('4', 'Fleksi > 60° (+4)', 4)],
      mods: [{ id: 'twist', label: 'Batang tubuh terpuntir (+1)', delta: 1 }, { id: 'side', label: 'Batang tubuh menekuk ke samping (+1)', delta: 1 }], min: 1, max: 6 },
    { key: 'legs', group: 'B. Analisis Leher, Batang Tubuh & Kaki', title: 'Langkah 11 — Kaki',
      guide: ['Kaki dan telapak kaki tertopang dengan baik dan seimbang: +1. Bila tidak: +2.'],
      choices: [ya('1', 'Kaki dan telapak kaki tertopang, postur seimbang (+1)', 1), ya('2', 'Tidak tertopang / tidak seimbang (+2)', 2)], min: 1, max: 2 },
    { key: 'muscle_b', group: 'B. Analisis Leher, Batang Tubuh & Kaki', title: 'Langkah 13 — Penggunaan otot (grup B)',
      guide: ['Tambahkan +1 bila postur sebagian besar statis (ditahan > 10 menit) atau gerakan berulang 4× per menit atau lebih.'], choices: MUSCLE, min: 0, max: 1 },
    { key: 'force_b', group: 'B. Analisis Leher, Batang Tubuh & Kaki', title: 'Langkah 14 — Beban / tenaga (grup B)',
      guide: ['Pilih kategori beban yang sesuai (sama dengan langkah 7).'], choices: FORCE, min: 0, max: 3 },
  ],
  interpretasi: [
    { range: '1–2', text: 'Postur dapat diterima.' },
    { range: '3–4', text: 'Diperlukan penyelidikan lebih lanjut; perubahan mungkin diperlukan.' },
    { range: '5–6', text: 'Diperlukan penyelidikan lebih lanjut; segera lakukan perubahan.' },
    { range: '7', text: 'Lakukan penyelidikan dan terapkan perubahan.' },
  ],
};

/* ═════════════ ROSA — FORM/117 (Sonne et al., 2012) ═════════════ */
const NA = (label = 'Tidak dapat diatur / non-adjustable (+1)'): Modifier => ({ id: 'na', label, delta: 1 });
export const ROSA_DEF: WizardDef = {
  metode: 'ROSA', formNo: 'BG/QSHE/FORM/117', title: 'ROSA — Rapid Office Strain Assessment',
  source: 'Gambar: Sonne et al., Applied Ergonomics 43 (2012) 98–108, sebagaimana dimuat pada FORM/117',
  intro: [
    'Nilai workstation pekerja kantor: kursi (tinggi, kedalaman dudukan, sandaran tangan, sandaran punggung), lalu monitor, telepon, mouse, dan keyboard.',
    'Pada tiap bagian pilih kondisi dasar sesuai gambar, lalu centang penambahan (+) yang berlaku.',
    'Bila perangkat tidak dipakai (telepon/mouse/dst.), pilih “Tidak digunakan” (skor 0).',
  ],
  questions: [
    { key: 'chair_height', group: 'Kursi', title: 'Bagian A — Tinggi kursi', guide: ['Lihat sudut lutut dan kontak kaki dengan lantai.'], image: P + 'rosa_chair_height.png', imageCaption: 'Bagian A: tinggi kursi',
      choices: [ya('1', 'Lutut 90° (1)', 1), ya('2l', 'Terlalu rendah, sudut lutut < 90° (2)', 2), ya('2h', 'Terlalu tinggi, sudut lutut > 90° (2)', 2), ya('3', 'Kaki tidak menyentuh lantai (3)', 3)],
      mods: [{ id: 'space', label: 'Ruang di bawah meja tidak cukup / tidak bisa menyilangkan kaki (+1)', delta: 1 }, NA()], min: 1, max: 5 },
    { key: 'pan_depth', group: 'Kursi', title: 'Bagian B — Kedalaman dudukan', guide: ['Ukur jarak antara lutut dan tepi dudukan kursi.'], image: P + 'rosa_pan_depth.png', imageCaption: 'Bagian B: kedalaman dudukan',
      choices: [ya('1', 'Sekitar 8 cm antara lutut dan tepi dudukan (1)', 1), ya('2l', 'Terlalu panjang, jarak < 8 cm (2)', 2), ya('2s', 'Terlalu pendek, jarak > 8 cm (2)', 2)], mods: [NA()], min: 1, max: 3 },
    { key: 'armrest', group: 'Kursi', title: 'Bagian C — Sandaran tangan', guide: ['Lihat apakah siku tersangga sejajar bahu dan bahu rileks.'], image: P + 'rosa_armrest.png', imageCaption: 'Bagian C: sandaran tangan',
      choices: [ya('1', 'Siku tersangga sejajar bahu, bahu rileks (1)', 1), ya('2', 'Terlalu tinggi (bahu terangkat) / terlalu rendah (lengan tak tersangga) (2)', 2)],
      mods: [{ id: 'hard', label: 'Permukaan keras / rusak (+1)', delta: 1 }, { id: 'wide', label: 'Terlalu lebar (+1)', delta: 1 }, NA()], min: 1, max: 5 },
    { key: 'backrest', group: 'Kursi', title: 'Bagian D — Sandaran punggung', guide: ['Lihat dukungan lumbar dan sudut sandaran.'], image: P + 'rosa_backrest.png', imageCaption: 'Bagian D: sandaran punggung',
      choices: [ya('1', 'Dukungan lumbar memadai, kursi condong 95°–110° (1)', 1), ya('2a', 'Tanpa dukungan lumbar / tidak pada posisi punggung kecil (2)', 2), ya('2b', 'Terlalu condong ke belakang (> 110°) atau ke depan (< 95°) (2)', 2), ya('2c', 'Tanpa sandaran (bangku) atau pekerja membungkuk ke depan (2)', 2)],
      mods: [{ id: 'surface', label: 'Permukaan kerja terlalu tinggi, bahu terangkat (+1)', delta: 1 }, NA('Sandaran tidak dapat diatur / non-adjustable (+1)')], min: 1, max: 4 },
    { key: 'monitor', group: 'Monitor & Perangkat', title: 'Monitor', guide: ['Jarak dan tinggi layar terhadap mata; centang penambahan yang berlaku.'], image: P + 'rosa_monitor.png', imageCaption: 'Monitor',
      choices: [ya('0', 'Tidak digunakan (0)', 0), ya('1', 'Jarak lengan (40–75 cm), layar setinggi mata (1)', 1), ya('2', 'Terlalu rendah, > 30° di bawah ketinggian mata (2)', 2), ya('3', 'Terlalu tinggi, leher ekstensi (3)', 3)],
      mods: [{ id: 'far', label: 'Layar terlalu jauh (+1)', delta: 1 }, { id: 'twist', label: 'Leher terpuntir (+1)', delta: 1 }, { id: 'glare', label: 'Silau pada layar (+1)', delta: 1 }, { id: 'doc', label: 'Dokumen tanpa penahan padahal diperlukan (+1)', delta: 1 }], min: 0, max: 7 },
    { key: 'phone', group: 'Monitor & Perangkat', title: 'Telepon', guide: ['Cara memakai telepon dan jangkauannya.'], image: P + 'rosa_phone.png', imageCaption: 'Telepon',
      choices: [ya('0', 'Tidak digunakan (0)', 0), ya('1', 'Headset / satu tangan, leher netral (1)', 1), ya('2', 'Terlalu jauh, di luar jangkauan 30 cm (2)', 2)],
      mods: [{ id: 'hold', label: 'Telepon dijepit antara leher dan bahu (+2)', delta: 2 }, { id: 'nohf', label: 'Tidak ada opsi hands-free (+1)', delta: 1 }], min: 0, max: 6 },
    { key: 'mouse', group: 'Monitor & Perangkat', title: 'Mouse', guide: ['Posisi mouse terhadap bahu dan cara menggenggam.'], image: P + 'rosa_mouse.png', imageCaption: 'Mouse',
      choices: [ya('0', 'Tidak digunakan (0)', 0), ya('1', 'Mouse sejajar dengan bahu (1)', 1), ya('2', 'Menjangkau mouse (2)', 2)],
      mods: [{ id: 'surf', label: 'Mouse dan keyboard berbeda permukaan (+2)', delta: 2 }, { id: 'pinch', label: 'Genggaman pinch grip (+1)', delta: 1 }, { id: 'palm', label: 'Palmrest di depan mouse (+1)', delta: 1 }], min: 0, max: 7 },
    { key: 'keyboard', group: 'Monitor & Perangkat', title: 'Keyboard', guide: ['Posisi pergelangan tangan dan ketinggian keyboard.'], image: P + 'rosa_keyboard.png', imageCaption: 'Keyboard',
      choices: [ya('0', 'Tidak digunakan (0)', 0), ya('1', 'Pergelangan lurus, bahu rileks (1)', 1), ya('2', 'Pergelangan ekstensi > 15° / keyboard di sudut positif (2)', 2)],
      mods: [{ id: 'dev', label: 'Deviasi pergelangan saat mengetik (+1)', delta: 1 }, { id: 'high', label: 'Keyboard terlalu tinggi, bahu terangkat (+1)', delta: 1 }, { id: 'overhead', label: 'Menjangkau barang di atas kepala (+1)', delta: 1 }, { id: 'na', label: 'Platform keyboard tidak dapat diatur (+1)', delta: 1 }], min: 0, max: 7 },
  ],
  interpretasi: [
    { range: '1–3', text: 'Postur tubuh dapat diterima (Normal).' },
    { range: '4–6', text: 'Diperlukan penyelidikan, perubahan mungkin diperlukan.' },
    { range: '7–8', text: 'Diperlukan penyelidikan, segera berubah.' },
    { range: '9–10', text: 'Lakukan penyelidikan dan terapkan perubahan.' },
  ],
};

/* ═════════════ WERA — FORM/118 ═════════════ */
const lv = (f: string, labels: [string, string, string]): Choice[] =>
  (['low', 'med', 'high'] as const).map((l, i) => ({ id: l, label: labels[i], score: i + 1, img: `${P}wera_${f}_${l}.png` }));
const WERA_GUIDE = 'Nilai setiap faktor berdasarkan kriteria Low/Medium/High pada gambar. Skor faktor dihitung otomatis dari tabel scoring system pada formulir.';
const w = (key: string, group: string, title: string, f: string, labels: [string, string, string], extra: string[] = []): Question =>
  ({ key, group, title, guide: [WERA_GUIDE, ...extra], choices: lv(f, labels), imageChoices: true, min: 1, max: 3 });
export const WERA_DEF: WizardDef = {
  metode: 'WERA', formNo: 'BG/QSHE/FORM/118', title: 'WERA — Workplace Ergonomic Risk Assessment',
  source: 'Gambar: kriteria Low / Medium / High pada FORM/118',
  intro: [
    'Nilai 9 faktor risiko fisik: bahu, pergelangan tangan, punggung, leher, kaki, kuat, getaran, tekanan langsung, dan durasi kerja.',
    'Klik gambar yang paling sesuai dengan kondisi kerja (LOW / MED / HIGH).',
    'Skor akhir = jumlah 9 faktor (18–54).',
  ],
  questions: [
    w('bahu_sikap', 'Faktor 1 — Bahu', '1a. Bahu — Sikap', '1a', ['Tangan lurus dengan pinggang, bahu pada posisi lurus', 'Tangan setinggi dada, bahu terangkat naik', 'Tangan di atas dada, bahu terangkat naik hingga lurus']),
    w('bahu_ulang', 'Faktor 1 — Bahu', '1b. Bahu — Pengulangan', '1b', ['Ringan: menggerakkan benda dengan lebih banyak jeda', 'Sedang: menggerakkan benda dengan lebih banyak jeda', 'Berat: menggerakkan benda tanpa ada istirahat']),
    w('tangan_sikap', 'Faktor 2 — Pergelangan Tangan', '2a. Pergelangan tangan — Sikap', '2a', ['Pergelangan tangan pada posisi netral', 'Pergelangan tangan sedang ditekuk ke atas atau ke bawah', 'Pergelangan tangan sangat ditekuk ke atas/bawah dengan memutar']),
    w('tangan_ulang', 'Faktor 2 — Pergelangan Tangan', '2b. Pergelangan tangan — Pengulangan', '2b', ['0–10 kali per menit', '11–20 kali per menit', 'Lebih dari 20 kali per menit']),
    w('punggung_sikap', 'Faktor 3 — Punggung', '3a. Punggung — Sikap', '3a', ['Punggung pada posisi netral', 'Punggung sedang ditekuk kedepan', 'Punggung sangat membungkuk kedepan']),
    w('punggung_ulang', 'Faktor 3 — Punggung', '3b. Punggung — Pengulangan', '3b', ['1–3 kali per menit', '4–8 kali per menit', '9–12 kali per menit']),
    w('leher_sikap', 'Faktor 4 — Leher', '4a. Leher — Sikap', '4a', ['Leher posisi netral, dengan sedikit membungkuk kedepan (0°–10°)', 'Leher ditekuk maju (10°–20°)', 'Leher sangat ditekuk kedepan atau kebelakang (> 20°)']),
    w('leher_ulang', 'Faktor 4 — Leher', '4b. Leher — Pengulangan', '4b', ['Ringan: pergerakan dengan lebih banyak jeda', 'Sedang: pergerakan dengan lebih banyak jeda', 'Berat: pergerakan tanpa istirahat']),
    w('kaki_sikap', 'Faktor 5 — Kaki', '5a. Kaki — Sikap', '5a', ['Kaki posisi netral atau sejajar dengan lantai/pijakan kaki', 'Kaki ditekuk sedang ke depan (30°–60°)', 'Kaki sangat ditekuk ke depan (> 60°)'],
      ['Skor faktor 5 dihitung dari sikap kaki × durasi kerja (faktor 9).']),
    w('lvl_kuat', 'Faktor 6 — Kuat', '6. Kuat — Mengangkat beban', '6', ['Mengangkat beban 0–5 kg', 'Mengangkat beban 5–10 kg', 'Mengangkat beban lebih dari 10 kg'], ['Skor faktor 6 dihitung dari sikap punggung (3a) × level kuat, sesuai tabel pada formulir.']),
    w('lvl_getaran', 'Faktor 7 — Getaran', '7. Getaran — Menggunakan alat getaran', '7', ['Tidak pernah menggunakan alat getar, atau < 1 jam per hari', 'Sesekali menggunakan alat getar, 1–4 jam per hari', 'Penggunaan alat getar secara konstan, > 4 jam per hari'], ['Skor faktor 7 dihitung dari sikap pergelangan tangan (2a) × level getaran.']),
    w('lvl_tekanan', 'Faktor 8 — Menekan secara langsung', '8. Menekan langsung — pegangan alat / memakai sarung tangan', '8', ['Gagang lembut/bulat atau memakai sarung tangan penuh', 'Gagang keras/tajam atau memakai setengah penutup sarung tangan', 'Tanpa pegangan alat, atau sarung tangan belum pernah dipakai'], ['Skor faktor 8 dihitung dari sikap pergelangan tangan (2a) × level tekanan langsung.']),
    w('lvl_durasi', 'Faktor 9 — Durasi kerja', '9. Durasi kerja — jam per hari', '9', ['< 2 jam per hari', '2–4 jam per hari', '> 4 jam per hari'], ['Skor faktor 9 dihitung dari level kuat (6) × durasi kerja.']),
  ],
  interpretasi: [
    { range: '18–27 (LOW)', text: 'Tugas diterima.' },
    { range: '28–44 (MED)', text: 'Tugas perlu diselidiki lebih lanjut dan diperlukan perubahan.' },
    { range: '45–54 (HIGH)', text: 'Tugas tidak diterima, segera ubah.' },
  ],
};

export const WIZARDS: Record<Metode, WizardDef> = { RULA: RULA_DEF, ROSA: ROSA_DEF, WERA: WERA_DEF };

export function interpretasiFor(metode: Metode, skor: number): string {
  const d = WIZARDS[metode].interpretasi;
  if (metode === 'RULA') return skor <= 2 ? d[0].text : skor <= 4 ? d[1].text : skor <= 6 ? d[2].text : d[3].text;
  if (metode === 'ROSA') return skor <= 3 ? d[0].text : skor <= 6 ? d[1].text : skor <= 8 ? d[2].text : d[3].text;
  return skor <= 27 ? d[0].text : skor <= 44 ? d[1].text : d[2].text;
}

/* ───────── Ilustrasi SVG per pilihan / penyesuaian (RULA & ROSA) ───────── */
const CHOICE_IMG: Record<string, Record<string, string>> = {
  upper_arm: { '1': 'rula_ua_1', '2': 'rula_ua_2', '3': 'rula_ua_3', '4': 'rula_ua_4' },
  lower_arm: { '1': 'rula_la_1', '2': 'rula_la_2' },
  wrist: { '1': 'rula_wr_1', '2': 'rula_wr_2', '3': 'rula_wr_3' },
  wrist_twist: { '1': 'rula_tw_1', '2': 'rula_tw_2' },
  neck: { '1': 'rula_nk_1', '2': 'rula_nk_2', '3': 'rula_nk_3', '4': 'rula_nk_4' },
  trunk: { '1': 'rula_tk_1', '2': 'rula_tk_2', '3': 'rula_tk_3', '4': 'rula_tk_4' },
  legs: { '1': 'rula_lg_1', '2': 'rula_lg_2' },
  chair_height: { '1': 'rosa_ch_1', '2l': 'rosa_ch_2l', '2h': 'rosa_ch_2h', '3': 'rosa_ch_3' },
  pan_depth: { '1': 'rosa_pd_1', '2l': 'rosa_pd_2l', '2s': 'rosa_pd_2s' },
  armrest: { '1': 'rosa_ar_1', '2': 'rosa_ar_2' },
  backrest: { '1': 'rosa_bk_1', '2a': 'rosa_bk_2a', '2b': 'rosa_bk_2b', '2c': 'rosa_bk_2c' },
  monitor: { '1': 'rosa_mo_1', '2': 'rosa_mo_2', '3': 'rosa_mo_3' },
  phone: { '1': 'rosa_ph_1', '2': 'rosa_ph_2' },
  mouse: { '1': 'rosa_mu_1', '2': 'rosa_mu_2' },
  keyboard: { '1': 'rosa_kb_1', '2': 'rosa_kb_2' },
};
const MOD_IMG: Record<string, Record<string, string>> = {
  upper_arm: { raised: 'rula_ua_mod', abducted: 'rula_ua_mod', supported: 'rula_ua_mod' },
  lower_arm: { midline: 'rula_la_mod' },
  wrist: { dev: 'rula_wr_mod' },
  neck: { twist: 'rula_nk_mod', side: 'rula_nk_mod' },
  trunk: { twist: 'rula_tk_mod', side: 'rula_tk_mod' },
  chair_height: { space: 'rosa_ch_mod_space', na: 'rosa_na' },
  pan_depth: { na: 'rosa_na' },
  armrest: { hard: 'rosa_ar_mod_hard', wide: 'rosa_ar_mod_wide', na: 'rosa_na' },
  backrest: { surface: 'rosa_bk_mod_surface', na: 'rosa_na' },
  monitor: { far: 'rosa_mo_mod_far', twist: 'rosa_mo_mod_twist', glare: 'rosa_mo_mod_glare', doc: 'rosa_mo_mod_doc' },
  phone: { hold: 'rosa_ph_mod_hold', nohf: 'rosa_ph_mod_nohf' },
  mouse: { surf: 'rosa_mu_mod_surface', pinch: 'rosa_mu_mod_pinch', palm: 'rosa_mu_mod_palm' },
  keyboard: { dev: 'rosa_kb_mod_dev', high: 'rosa_kb_mod_high', overhead: 'rosa_kb_mod_overhead', na: 'rosa_na' },
};
for (const def of [RULA_DEF, ROSA_DEF]) {
  for (const q of def.questions) {
    for (const c of q.choices) { const n = CHOICE_IMG[q.key]?.[c.id]; if (n) c.img = `${S}${n}.svg`; }
    for (const m of q.mods || []) { const n = MOD_IMG[q.key]?.[m.id]; if (n) m.img = `${S}${n}.svg`; }
  }
}
