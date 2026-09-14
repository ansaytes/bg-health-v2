// lib/encryption.ts — AES-256-GCM encryption + deterministic HMAC-SHA256 for lookup
//
// Strategy:
//   - AES-256-GCM (random IV, non-deterministic) for storing sensitive data
//     → looks like random hex string in DB, cannot be used for lookup
//   - HMAC-SHA256 (deterministic, one-way) for lookup keys
//     → same input always produces same output, can be used for WHERE clause
//
// Two hash columns:
//   - nik_hash → hash of NIK Karyawan (internal employee number, e.g. "230802778")
//   - national_id_hash → hash of NIK KTP / National ID (16-digit national ID)

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw || raw.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be 32-byte hex (64 chars). Generate with: openssl rand -hex 32'
    );
  }
  return Buffer.from(raw, 'hex');
}

/** Encrypt plain text using AES-256-GCM (random IV — non-deterministic) */
export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('hex');
  } catch (err) {
    console.error('Encryption error:', err);
    return null;
  }
}

/** Decrypt AES-256-GCM hex string back to plain text */
export function decrypt(hex: string | null | undefined): string | null {
  if (!hex) return null;
  try {
    const buf = Buffer.from(hex, 'hex');
    if (buf.length < IV_LENGTH + TAG_LENGTH) return null;
    const key = getKey();
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('Decryption error:', err);
    return null;
  }
}

/** Hash value using HMAC-SHA256 (deterministic — same input always produces same output) */
export function hashField(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  try {
    const key = getKey();
    return crypto.createHmac('sha256', key).update(String(plain), 'utf8').digest('hex');
  } catch (err) {
    console.error('Hash error:', err);
    return null;
  }
}

// Sensitive fields that need encryption
// birth_date NOT included — it's a DATE column, PostgreSQL rejects hex string as date
const SENSITIVE_FIELDS = ['nik', 'national_id', 'phone_number', 'place_of_birth', 'address'];

// Hash columns for lookup — supports both NIK Karyawan and NIK KTP search
const LOOKUP_HASH_MAP: Record<string, string> = {
  'nik': 'nik_hash',                    // NIK Karyawan → nik_hash column
  'national_id': 'national_id_hash',    // NIK KTP / National ID → national_id_hash column
};

/** Encrypt + compute hashes for employee fields */
export function encryptEmployee(emp: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...emp };

  // Encrypt sensitive fields
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null) {
      result[field] = encrypt(String(result[field]));
    }
  }

  // Compute deterministic hashes for lookup fields
  for (const [field, hashCol] of Object.entries(LOOKUP_HASH_MAP)) {
    if (emp[field] != null) {
      result[hashCol] = hashField(String(emp[field]));
    }
  }

  return result;
}

/** Decrypt sensitive fields, strip hash columns from response */
export function decryptEmployee(emp: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...emp };

  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]) || result[field];
    }
  }

  // Remove hash columns from response (internal use only)
  for (const hashCol of Object.values(LOOKUP_HASH_MAP)) {
    delete result[hashCol];
  }

  return result;
}
