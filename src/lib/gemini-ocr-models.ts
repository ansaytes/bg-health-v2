export interface GeminiOcrModel {
  id: string;
  label: string;
  description: string;
}

export const GEMINI_OCR_MODELS: GeminiOcrModel[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Akurasi Tinggi',
    description: 'Direkomendasikan untuk dokumen MCU multi-halaman atau dengan struktur pemeriksaan kompleks.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Ekstraksi Efisien',
    description: 'Pilihan efisien untuk pembacaan dokumen MCU standar.',
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Ekstraksi Seimbang',
    description: 'Pilihan seimbang untuk dokumen MCU dengan format beragam.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Pemrosesan Cepat',
    description: 'Pilihan cepat untuk ekstraksi dokumen MCU rutin.',
  },
];

export const DEFAULT_GEMINI_OCR_MODEL = GEMINI_OCR_MODELS[0].id;

export function isGeminiOcrModel(value: unknown): value is string {
  return typeof value === 'string' && GEMINI_OCR_MODELS.some((model) => model.id === value);
}

export function getGeminiOcrModel(modelId: string): GeminiOcrModel | undefined {
  return GEMINI_OCR_MODELS.find((model) => model.id === modelId);
}
