export interface GeminiOcrModel {
  id: string;
  label: string;
  description: string;
}

export const GEMINI_OCR_MODELS: GeminiOcrModel[] = [
  {
    id: 'gemini-3.8-flash',
    label: '3.8 Flash',
    description: 'Pilihan utama untuk membaca hasil MCU kompleks dengan akurasi dan konteks yang kuat.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: '3.5 Flash Lite',
    description: 'Pilihan ringan untuk ekstraksi teks MCU dengan batas permintaan yang lebih longgar.',
  },
  {
    id: 'gemini-3.5-flash',
    label: '3.5 Flash',
    description: 'Model Flash serbaguna untuk ekstraksi teks terstruktur.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: '3.1 Flash Lite',
    description: 'Model ringan untuk ekstraksi rutin yang mengutamakan kecepatan.',
  },
];

export const DEFAULT_GEMINI_OCR_MODEL = GEMINI_OCR_MODELS[0].id;

export function isGeminiOcrModel(value: unknown): value is string {
  return typeof value === 'string' && GEMINI_OCR_MODELS.some((model) => model.id === value);
}

export function getGeminiOcrModel(modelId: string): GeminiOcrModel | undefined {
  return GEMINI_OCR_MODELS.find((model) => model.id === modelId);
}
