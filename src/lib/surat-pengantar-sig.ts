import crypto from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG_HEX_LEN = 24;

function getHmacSecret(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) {
    throw new Error('Server signing secret belum dikonfigurasi.');
  }
  return `surat-pengantar:${key}`;
}

export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}

export function signSuratId(id: string): string {
  const cleanId = id.trim().toLowerCase();
  return crypto
    .createHmac('sha256', getHmacSecret())
    .update(cleanId)
    .digest('hex')
    .slice(0, SIG_HEX_LEN);
}

/**
 * Validasi UUID + HMAC di memori sebelum menyentuh database.
 * Menggunakan timingSafeEqual agar kebal terhadap timing attack.
 */
export function verifySuratSig(id: string, sig: string): boolean {
  const cleanId = id.trim().toLowerCase();
  const cleanSig = sig.trim().toLowerCase();
  if (!isValidUuid(cleanId)) return false;
  if (!/^[0-9a-f]{24}$/.test(cleanSig)) return false;

  try {
    const expected = signSuratId(cleanId);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(cleanSig, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Menyamarkan nama pada halaman verifikasi publik (mis. "Ahmad Abdul Rohim" -> "Ah*** Ab*** Ro***")
 * agar pihak Faskes dapat mencocokkan dengan surat fisik tanpa mengekspos nama penuh ke publik.
 */
export function maskNamaForPublic(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '-';
  return parts
    .map((p) => {
      if (p.length <= 2) return `${p[0] || ''}*`;
      return `${p.slice(0, 2)}${'*'.repeat(Math.min(5, p.length - 2))}`;
    })
    .join(' ');
}
