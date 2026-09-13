// lib/encryption.ts — AES-256-GCM encryption + deterministic HMAC-SHA256 for lookup
//
// Why two approaches?
//   - AES-GCM with random IV: secure encryption, but each call produces different output
//     → cannot be used as lookup key in DB (every search would fail)
//   - HMAC-SHA256 with same key: deterministic (same input → same output)
//     → safe to use as lookup key in DB (indexed, unique)
//
// Strategy:
//   - Store encrypted value in original column (e.g., national_id) — looks like random hex
//   - Store hash value in separate column (e.g., national_id_hash) — deterministic, indexed
//   - To search: compute hash of query, then WHERE national_id_hash = '<hash>'
//   - To read: fetch encrypted value, decrypt with AES-GCM

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

/**
 * Encrypt plain text using AES-256-GCM (random IV — non-deterministic)
 * Returns hex string: iv(24hex) + tag(32hex) + ciphertext
 */
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

/**
 * Decrypt AES-256-GCM hex string back to plain text
 */
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

/**
 * Hash value using HMAC-SHA256 (deterministic — same input always produces same output)
 * Use this for DB lookup columns. Cannot be reversed (one-way hash).
 */
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

/**
 * Encrypt object of employee fields — returns object ready for DB insert
 * Adds *_hash columns for fields that need lookup
 */
export function encryptEmployee(emp: Record<string, any>): Record<string, any> {
  const SENSITIVE_FIELDS = ['nik', 'national_id', 'phone_number', 'place_of_birth', 'address'];
  const LOOKUP_FIELDS = ['national_id']; // fields that need hash for DB lookup
  const result: Record<string, any> = { ...emp };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null) {
      result[field] = encrypt(String(result[field]));
    }
  }
  // Add hash columns for lookup fields (deterministic)
  for (const field of LOOKUP_FIELDS) {
    const hashKey = `${field}_hash`;
    if (emp[field] != null) {
      result[hashKey] = hashField(String(emp[field]));
    }
  }
  return result;
}

/**
 * Decrypt object of employee fields — returns object with plain-text data
 */
export function decryptEmployee(emp: Record<string, any>): Record<string, any> {
  const SENSITIVE_FIELDS = ['nik', 'national_id', 'phone_number', 'place_of_birth', 'address'];
  const result: Record<string, any> = { ...emp };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]) || result[field];
    }
  }
  // Remove hash columns from response (internal use only)
  delete result.national_id_hash;
  delete result.nik_hash;
  delete result.phone_number_hash;
  return result;
}
