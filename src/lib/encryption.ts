// lib/encryption.ts — AES-256-GCM encryption for sensitive employee data
// Usage:
//   import { encrypt, decrypt } from '@/lib/encryption';
//   const enc = encrypt('230802778');   // returns hex string
//   const plain = decrypt(enc);          // returns '230802778'
//
// Encryption key: set ENCRYPTION_KEY in .env.local (32-byte hex string)
// Generate key: openssl rand -hex 32

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM (recommended)
const TAG_LENGTH = 16; // 16 bytes auth tag

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
 * Encrypt plain text using AES-256-GCM
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
    // Combine iv + tag + ciphertext into single hex string
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
 * Encrypt object of employee fields — returns object ready for DB insert
 */
export function encryptEmployee(emp: Record<string, any>): Record<string, any> {
  const SENSITIVE_FIELDS = ['nik', 'national_id', 'phone_number', 'place_of_birth', 'birth_date', 'address'];
  const result: Record<string, any> = { ...emp };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null) {
      result[field] = encrypt(String(result[field]));
    }
  }
  return result;
}

/**
 * Decrypt object of employee fields — returns object with plain-text data
 */
export function decryptEmployee(emp: Record<string, any>): Record<string, any> {
  const SENSITIVE_FIELDS = ['nik', 'national_id', 'phone_number', 'place_of_birth', 'birth_date', 'address'];
  const result: Record<string, any> = { ...emp };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]) || result[field];
    }
  }
  return result;
}
