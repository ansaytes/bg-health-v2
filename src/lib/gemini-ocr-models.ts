export interface GeminiOcrModel {
  id: string;
  label: string;
  description: string;
  recommendation: string;
}

export const GEMINI_OCR_MODELS: GeminiOcrModel[] = [
  {
    id: 'gemini-3.8-flash',
    label: '3.8 Flash',
    description: 'Pilihan utama untuk membaca hasil MCU kompleks dengan akurasi dan konteks yang kuat.',
    recommendation: 'Direkomendasikan untuk PDF/hasil MCU lengkap.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: '3.5 Flash Lite',
    description: 'Lebih ringan dan kuota RPM pada tangkapan layar lebih longgar daripada 3.8 Flash.',
    recommendation: 'Direkomendasikan untuk teks pendek atau saat kuota 3.8 habis.',
  },
  {
    id: 'gemini-3.5-flash',
    label: '3.5 Flash',
    description: 'Model Flash umum untuk ekstraksi teks, dengan batas RPM yang terlihat lebih rendah daripada Lite.',
    recommendation: 'Alternatif seimbang.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: '3.1 Flash Lite',
    description: 'Pilihan ringan dengan batas RPM tinggi pada tangkapan layar.',
    recommendation: 'Alternatif cepat untuk pemakaian rutin.',
  },
  {
    id: 'gemini-3-flash',
    label: '3 Flash',
    description: 'Model Flash serbaguna untuk input teks dan ekstraksi terstruktur.',
    recommendation: 'Alternatif bila model lain tidak tersedia.',
  },
  {
    id: 'gemini-2.5-flash',
    label: '2.5 Flash',
    description: 'Generasi Flash sebelumnya; mendukung tugas ekstraksi teks terstruktur.',
    recommendation: 'Cadangan kompatibilitas.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: '2.5 Flash Lite',
    description: 'Versi ringan generasi 2.5 dengan RPM lebih tinggi pada tangkapan layar.',
    recommendation: 'Cadangan ringan.',
  },
];

export const DEFAULT_GEMINI_OCR_MODEL = GEMINI_OCR_MODELS[0].id;

export function isGeminiOcrModel(value: unknown): value is string {
  return typeof value === 'string' && GEMINI_OCR_MODELS.some((model) => model.id === value);
}

export function getGeminiOcrModel(modelId: string): GeminiOcrModel | undefined {
  return GEMINI_OCR_MODELS.find((model) => model.id === modelId);
}
