// Deskripsi skor resmi RULA / ROSA / WERA — sumber McAtamney 1993, Sonne 2012, Rahman 2011
// Setiap soal punya diagramKey untuk ikon postur SVG di UI.
import type { Metode } from '@/lib/hc-ergo';

export type Opt = { score: number; label: string; diagram?: string };
export type Q = {
  key: string;
  title: string;
  guide?: string;
  /** Kunci diagram referensi di PostureDiagram */
  diagramKey?: string;
  options: Opt[];
};

export const RULA_GROUP_A: Q[] = [
  {
    key: 'upper_arm',
    title: '1. Upper Arm (Lengan Atas)',
    guide: 'Lihat sudut lengan atas terhadap batang tubuh. Tambahan +1 jika bahu terangkat / lengan abduksi / lengan ditopang.',
    diagramKey: 'rula_upper_arm',
    options: [
      { score: 1, label: '20° ekstensi s/d 20° fleksi', diagram: 'arm_neutral' },
      { score: 2, label: '>20° ekstensi ATAU 20°–45° fleksi', diagram: 'arm_mid' },
      { score: 3, label: '45°–90° fleksi', diagram: 'arm_high' },
      { score: 4, label: '>90° fleksi', diagram: 'arm_overhead' },
      { score: 5, label: 'Skor dasar +1 (bahu terangkat / abduksi / ditopang)', diagram: 'arm_adj1' },
      { score: 6, label: 'Skor dasar +2 (kombinasi penyesuaian)', diagram: 'arm_adj2' },
    ],
  },
  {
    key: 'lower_arm',
    title: '2. Lower Arm (Lengan Bawah)',
    guide: 'Sudut siku. +1 jika bekerja di garis tengah tubuh atau keluar dari sisi tubuh.',
    diagramKey: 'rula_lower_arm',
    options: [
      { score: 1, label: '60°–100° fleksi', diagram: 'elbow_ok' },
      { score: 2, label: '<60° atau >100° fleksi', diagram: 'elbow_out' },
      { score: 3, label: 'Skor dasar +1 (melintasi garis tengah / keluar sisi tubuh)', diagram: 'elbow_cross' },
    ],
  },
  {
    key: 'wrist',
    title: '3. Wrist (Pergelangan Tangan)',
    guide: 'Sudut pergelangan terhadap posisi netral.',
    diagramKey: 'rula_wrist',
    options: [
      { score: 1, label: 'Posisi netral', diagram: 'wrist_neutral' },
      { score: 2, label: '0°–15° fleksi / ekstensi', diagram: 'wrist_mild' },
      { score: 3, label: '>15° fleksi / ekstensi', diagram: 'wrist_bent' },
      { score: 4, label: 'Skor dasar +1 (deviasi radial/ulnar)', diagram: 'wrist_dev' },
    ],
  },
  {
    key: 'wrist_twist',
    title: '4. Wrist Twist (Putaran Pergelangan)',
    diagramKey: 'rula_wrist_twist',
    options: [
      { score: 1, label: 'T1 — Putaran di rentang tengah', diagram: 'twist_mid' },
      { score: 2, label: 'T2 — Putaran di ujung rentang', diagram: 'twist_end' },
    ],
  },
  {
    key: 'muscle_a',
    title: '5. Skor Otot — Grup A',
    guide: '+1 jika postur statis >1 menit ATAU gerakan berulang >4× per menit.',
    diagramKey: 'muscle',
    options: [
      { score: 0, label: 'Tidak ada (postur dinamis / tidak berulang)' },
      { score: 1, label: 'Ya — statis >1 menit atau berulang >4×/menit' },
    ],
  },
  {
    key: 'force_a',
    title: '6. Skor Beban / Tenaga — Grup A',
    diagramKey: 'force',
    options: [
      { score: 0, label: 'Beban <2 kg (intermiten)' },
      { score: 1, label: '2–10 kg intermiten' },
      { score: 2, label: '2–10 kg statis / berulang, atau ≥10 kg intermiten' },
      { score: 3, label: '≥10 kg statis / berulang, atau benturan / gaya mendadak' },
    ],
  },
];

export const RULA_GROUP_B: Q[] = [
  {
    key: 'neck',
    title: '7. Neck (Leher)',
    guide: '+1 jika leher terpuntir atau miring ke samping.',
    diagramKey: 'rula_neck',
    options: [
      { score: 1, label: '0°–10° fleksi', diagram: 'neck_1' },
      { score: 2, label: '10°–20° fleksi', diagram: 'neck_2' },
      { score: 3, label: '>20° fleksi', diagram: 'neck_3' },
      { score: 4, label: 'Ekstensi', diagram: 'neck_ext' },
      { score: 5, label: 'Skor dasar +1 (puntir / miring)', diagram: 'neck_twist' },
      { score: 6, label: 'Skor dasar +2 (kombinasi penyesuaian)', diagram: 'neck_combo' },
    ],
  },
  {
    key: 'trunk',
    title: '8. Trunk (Batang Tubuh)',
    guide: '+1 jika batang tubuh terpuntir atau miring ke samping.',
    diagramKey: 'rula_trunk',
    options: [
      { score: 1, label: 'Duduk / berdiri tegak', diagram: 'trunk_1' },
      { score: 2, label: '0°–20° fleksi', diagram: 'trunk_2' },
      { score: 3, label: '20°–60° fleksi', diagram: 'trunk_3' },
      { score: 4, label: '>60° fleksi', diagram: 'trunk_4' },
      { score: 5, label: 'Skor dasar +1 (puntir / miring)', diagram: 'trunk_twist' },
      { score: 6, label: 'Skor dasar +2 (kombinasi penyesuaian)', diagram: 'trunk_combo' },
    ],
  },
  {
    key: 'legs',
    title: '9. Legs (Kaki)',
    diagramKey: 'rula_legs',
    options: [
      { score: 1, label: 'Kaki & kaki tertopang, seimbang', diagram: 'legs_ok' },
      { score: 2, label: 'Tidak tertopang / tidak seimbang', diagram: 'legs_bad' },
    ],
  },
  {
    key: 'muscle_b',
    title: '10. Skor Otot — Grup B',
    guide: '+1 jika postur statis >1 menit ATAU gerakan berulang >4× per menit.',
    diagramKey: 'muscle',
    options: [
      { score: 0, label: 'Tidak ada (postur dinamis / tidak berulang)' },
      { score: 1, label: 'Ya — statis >1 menit atau berulang >4×/menit' },
    ],
  },
  {
    key: 'force_b',
    title: '11. Skor Beban / Tenaga — Grup B',
    diagramKey: 'force',
    options: [
      { score: 0, label: 'Beban <2 kg (intermiten)' },
      { score: 1, label: '2–10 kg intermiten' },
      { score: 2, label: '2–10 kg statis / berulang, atau ≥10 kg intermiten' },
      { score: 3, label: '≥10 kg statis / berulang, atau benturan / gaya mendadak' },
    ],
  },
];

export const ROSA_CHAIR: Q[] = [
  {
    key: 'chair_height',
    title: 'A1. Tinggi Kursi (Chair Height)',
    guide: 'Lutut ~90°, kaki rata di lantai. Pilih postur yang paling sesuai.',
    diagramKey: 'rosa_chair_height',
    options: [
      { score: 1, label: 'Tinggi ideal — lutut ~90°, kaki rata', diagram: 'chair_h1' },
      { score: 2, label: 'Terlalu tinggi — kaki menggantung / tumit tidak menapak', diagram: 'chair_h2' },
      { score: 3, label: 'Terlalu rendah — lutut >90°', diagram: 'chair_h3' },
      { score: 4, label: 'Tidak ada sandaran kaki saat dibutuhkan', diagram: 'chair_h4' },
    ],
  },
  {
    key: 'pan_depth',
    title: 'A2. Kedalaman Dudukan (Pan Depth)',
    guide: 'Sisakan 2–3 jari antara tepi kursi dan belakang lutut.',
    diagramKey: 'rosa_pan',
    options: [
      { score: 1, label: 'Kedalaman ideal (2–3 jari ruang)', diagram: 'pan_1' },
      { score: 2, label: 'Terlalu panjang — menekan belakang lutut', diagram: 'pan_2' },
      { score: 3, label: 'Terlalu pendek — paha tidak tertopang', diagram: 'pan_3' },
    ],
  },
  {
    key: 'armrest',
    title: 'A3. Sandaran Lengan (Armrest)',
    guide: 'Siku ~90°, bahu rileks, sandaran menyangga lengan bawah.',
    diagramKey: 'rosa_armrest',
    options: [
      { score: 1, label: 'Tinggi & lebar ideal', diagram: 'arm_1' },
      { score: 2, label: 'Terlalu tinggi / terlalu lebar', diagram: 'arm_2' },
      { score: 3, label: 'Terlalu rendah / terlalu sempit / tidak ada', diagram: 'arm_3' },
    ],
  },
  {
    key: 'back_support',
    title: 'A4. Sandaran Punggung (Back Support)',
    guide: 'Sandaran lumbar menopang lekuk punggung bawah; sudut sandaran nyaman.',
    diagramKey: 'rosa_back',
    options: [
      { score: 1, label: 'Sandaran lumbar & sudut ideal', diagram: 'back_1' },
      { score: 2, label: 'Tidak ada lumbar / sudut kurang tepat', diagram: 'back_2' },
      { score: 3, label: 'Tidak ada sandaran punggung', diagram: 'back_3' },
    ],
  },
  {
    key: 'duration_chair',
    title: 'A5. Durasi Penggunaan Kursi',
    diagramKey: 'duration',
    options: [
      { score: 0, label: '<1 jam' },
      { score: 1, label: '1–4 jam' },
      { score: 2, label: '>4 jam' },
    ],
  },
];

export const ROSA_PERIPH: Q[] = [
  {
    key: 'monitor',
    title: 'B1. Monitor',
    guide: 'Bagian atas layar setinggi mata; jarak ~50–70 cm; leher netral.',
    diagramKey: 'rosa_monitor',
    options: [
      { score: 0, label: 'Posisi ideal (tinggi & jarak tepat)', diagram: 'mon_0' },
      { score: 1, label: 'Terlalu rendah / terlalu jauh', diagram: 'mon_1' },
      { score: 2, label: 'Terlalu tinggi / memutar leher', diagram: 'mon_2' },
      { score: 3, label: 'Kombinasi buruk (tinggi + jarak + putaran)', diagram: 'mon_3' },
    ],
  },
  {
    key: 'phone',
    title: 'B2. Telepon',
    guide: 'Headset lebih baik; hindari menjepit telepon di bahu.',
    diagramKey: 'rosa_phone',
    options: [
      { score: 0, label: 'Headset / hands-free', diagram: 'phone_0' },
      { score: 1, label: 'Dipegang dengan tangan', diagram: 'phone_1' },
      { score: 2, label: 'Dijepit di bahu', diagram: 'phone_2' },
    ],
  },
  {
    key: 'mouse',
    title: 'B3. Mouse',
    guide: 'Mouse sejajar dengan bahu, dekat tubuh, pergelangan netral.',
    diagramKey: 'rosa_mouse',
    options: [
      { score: 0, label: 'Posisi ideal, pergelangan netral', diagram: 'mouse_0' },
      { score: 1, label: 'Jauh dari tubuh / pergelangan bengkok', diagram: 'mouse_1' },
      { score: 2, label: 'Sangat jauh / tanpa sandaran lengan', diagram: 'mouse_2' },
    ],
  },
  {
    key: 'keyboard',
    title: 'B4. Keyboard',
    guide: 'Pergelangan netral; hindari ekstensi berlebih; tray/tinggi meja sesuai.',
    diagramKey: 'rosa_keyboard',
    options: [
      { score: 0, label: 'Tinggi ideal, pergelangan netral', diagram: 'kb_0' },
      { score: 1, label: 'Tinggi ideal, pergelangan netral', diagram: 'kb_0' },
      { score: 1, label: 'Terlalu tinggi / pergelangan ekstensi', diagram: 'kb_1' },
      { score: 2, label: 'Terlalu rendah / sudut buruk', diagram: 'kb_2' },
    ],
  },
];

export const WERA_QS: Q[] = [
  { key: 'bahu_sikap', title: '1a. Bahu — Sikap', diagramKey: 'wera_shoulder', options: [
    { score: 1, label: 'LOW — lengan di bawah bahu' },
    { score: 2, label: 'MED — lengan setinggi bahu' },
    { score: 3, label: 'HIGH — lengan di atas bahu' },
  ]},
  { key: 'bahu_ulang', title: '1b. Bahu — Pengulangan', diagramKey: 'wera_rep', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'wrist_sikap', title: '2a. Pergelangan — Sikap', diagramKey: 'wera_wrist', options: [
    { score: 1, label: 'LOW — netral' },
    { score: 2, label: 'MED — fleksi/ekstensi sedang' },
    { score: 3, label: 'HIGH — fleksi/ekstensi ekstrem' },
  ]},
  { key: 'wrist_ulang', title: '2b. Pergelangan — Pengulangan', diagramKey: 'wera_rep', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'punggung_sikap', title: '3a. Punggung — Sikap', diagramKey: 'wera_back', options: [
    { score: 1, label: 'LOW — tegak / fleksi ringan' },
    { score: 2, label: 'MED — fleksi 20°–60°' },
    { score: 3, label: 'HIGH — fleksi >60° / putaran' },
  ]},
  { key: 'punggung_ulang', title: '3b. Punggung — Pengulangan', diagramKey: 'wera_rep', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'leher_sikap', title: '4a. Leher — Sikap', diagramKey: 'wera_neck', options: [
    { score: 1, label: 'LOW — netral / fleksi ringan' },
    { score: 2, label: 'MED — fleksi / putaran sedang' },
    { score: 3, label: 'HIGH — fleksi ekstrem / putaran' },
  ]},
  { key: 'leher_ulang', title: '4b. Leher — Pengulangan', diagramKey: 'wera_rep', options: [
    { score: 1, label: 'LOW — <10× per menit' },
    { score: 2, label: 'MED — 10–20× per menit' },
    { score: 3, label: 'HIGH — >20× per menit' },
  ]},
  { key: 'kaki_sikap', title: '5a. Kaki — Sikap', diagramKey: 'wera_legs', options: [
    { score: 1, label: 'LOW — kaki tertopang seimbang' },
    { score: 2, label: 'MED — berdiri lama / posisi kurang ideal' },
    { score: 3, label: 'HIGH — jongkok / tidak seimbang' },
  ]},
  { key: 'lvl_kuat', title: '6. Kekuatan (Angkat Beban)', diagramKey: 'force', options: [
    { score: 1, label: 'LOW — 0–5 kg' },
    { score: 2, label: 'MED — 5–10 kg' },
    { score: 3, label: 'HIGH — >10 kg' },
  ]},
  { key: 'lvl_getaran', title: '7. Getaran', diagramKey: 'vibration', options: [
    { score: 1, label: 'LOW — <1 jam/hari' },
    { score: 2, label: 'MED — 1–4 jam/hari' },
    { score: 3, label: 'HIGH — >4 jam/hari' },
  ]},
  { key: 'lvl_tekanan', title: '8. Tekanan Langsung', diagramKey: 'contact', options: [
    { score: 1, label: 'LOW — memakai sarung tangan pelindung' },
    { score: 2, label: 'MED — permukaan keras' },
    { score: 3, label: 'HIGH — tanpa pelindung / tepi tajam' },
  ]},
  { key: 'lvl_durasi', title: '9. Durasi Kerja', diagramKey: 'duration', options: [
    { score: 1, label: 'LOW — <2 jam/hari' },
    { score: 2, label: 'MED — 2–4 jam/hari' },
    { score: 3, label: 'HIGH — >4 jam/hari' },
  ]},
];

const ALL_KEYS: Record<Metode, string[]> = {
  RULA: [...RULA_GROUP_A, ...RULA_GROUP_B].map((q) => q.key),
  ROSA: [...ROSA_CHAIR, ...ROSA_PERIPH].map((q) => q.key),
  WERA: WERA_QS.map((q) => q.key),
};

export function blankInput(m: Metode): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const k of ALL_KEYS[m]) {
    defaults[k] = m === 'ROSA' && ['monitor', 'phone', 'mouse', 'keyboard'].includes(k) ? 0 : 1;
  }
  if (m === 'RULA') {
    defaults.muscle_a = 0;
    defaults.force_a = 0;
    defaults.muscle_b = 0;
    defaults.force_b = 0;
  }
  return defaults;
}
