import { decrypt, encrypt } from '@/lib/encryption';

export interface QuestionnaireTokenClaims {
  nik: string;
  nationalId: string;
  nikHash: string;
  nationalIdHash: string | null;
  nama: string;
  jabatan: string;
  departemen?: string;
  site: string;
  usia: string;
  jenisKelamin: string;
  tglMCU?: string;
  expiresAt: number; // Timestamp milidetik saat token kadaluarsa
}

export const QUESTIONNAIRE_TOKEN_MAX_MINUTES = 30;

/**
 * Membuat One-Time Token terenkripsi AES-256-GCM untuk pengisian kuesioner mandiri.
 * Maksimal durasi aktif adalah 30 menit sesuai instruksi keamanan sistem.
 */
export function createQuestionnaireToken(
  claims: Omit<QuestionnaireTokenClaims, 'expiresAt'>,
  durationMinutes = QUESTIONNAIRE_TOKEN_MAX_MINUTES
): string {
  const validDuration = Math.min(Math.max(durationMinutes, 1), QUESTIONNAIRE_TOKEN_MAX_MINUTES);
  const payload: QuestionnaireTokenClaims = {
    ...claims,
    expiresAt: Date.now() + validDuration * 60 * 1000,
  };
  const token = encrypt(JSON.stringify(payload));
  if (!token) throw new Error('Gagal mengenkripsi One-Time Token kuesioner.');
  return token;
}

/**
 * Memverifikasi dan mendekripsi One-Time Token kuesioner.
 * Mengembalikan null bila token palsu, rusak, atau telah kadaluarsa (> 30 menit).
 */
export function verifyQuestionnaireToken(token: unknown): QuestionnaireTokenClaims | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  try {
    const raw = decrypt(token);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Partial<QuestionnaireTokenClaims>;
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) {
      return null; // Kadaluarsa
    }
    if (!payload.nik || !payload.nikHash || !payload.nama) {
      return null;
    }
    return payload as QuestionnaireTokenClaims;
  } catch {
    return null;
  }
}
