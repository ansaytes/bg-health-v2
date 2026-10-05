import { decrypt, encrypt } from '@/lib/encryption';

export interface RegistrationLookupClaims {
  nik: string;
  nationalId: string;
  nama: string;
  jabatan: string;
  jobsite: string;
}

interface TokenPayload extends RegistrationLookupClaims {
  expiresAt: number;
}

export function createRegistrationLookupToken(claims: RegistrationLookupClaims): string {
  const payload: TokenPayload = { ...claims, expiresAt: Date.now() + 10 * 60 * 1000 };
  const token = encrypt(JSON.stringify(payload));
  if (!token) throw new Error('Registration lookup token could not be encrypted.');
  return token;
}

export function readRegistrationLookupToken(token: unknown): RegistrationLookupClaims | null {
  if (typeof token !== 'string' || token.length > 2048) return null;

  try {
    const decoded = decrypt(token);
    if (!decoded) return null;
    const payload: unknown = JSON.parse(decoded);
    if (typeof payload !== 'object' || payload === null) return null;
    const claims = payload as Partial<TokenPayload>;
    if (
      typeof claims.expiresAt !== 'number'
      || claims.expiresAt <= Date.now()
      || typeof claims.nik !== 'string'
      || !claims.nik
      || typeof claims.nationalId !== 'string'
      || !/^\d{16}$/.test(claims.nationalId)
      || typeof claims.nama !== 'string'
      || !claims.nama
      || typeof claims.jabatan !== 'string'
      || typeof claims.jobsite !== 'string'
    ) return null;

    return {
      nik: claims.nik,
      nationalId: claims.nationalId,
      nama: claims.nama,
      jabatan: claims.jabatan,
      jobsite: claims.jobsite,
    };
  } catch {
    return null;
  }
}
