// lib/encryption.mjs — ESM version for sync-employees.mjs (GitHub Actions)
// Mirror of src/lib/encryption.ts but in plain JS for Node.js scripts

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw || raw.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be 32-byte hex (64 chars). Generate with: openssl rand -hex 32'
    );
  }
  return Buffer.from(raw, 'hex');
}

export function encrypt(plain) {
  if (plain == null || plain === '') return null;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('hex');
  } catch (err) {
    console.error('Encryption error:', err);
    return null;
  }
}

export function decrypt(hex) {
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
 * Deterministic HMAC-SHA256 hash — same input always produces same output
 * Use for DB lookup columns (cannot be reversed)
 */
export function hashField(plain) {
  if (plain == null || plain === '') return null;
  try {
    const key = getKey();
    return crypto.createHmac('sha256', key).update(String(plain), 'utf8').digest('hex');
  } catch (err) {
    console.error('Hash error:', err);
    return null;
  }
}

const SENSITIVE_FIELDS = ['nik', 'national_id', 'phone_number', 'place_of_birth', 'address'];
const LOOKUP_FIELDS = ['national_id'];

export function encryptEmployee(emp) {
  const result = { ...emp };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null) {
      result[field] = encrypt(String(result[field]));
    }
  }
  for (const field of LOOKUP_FIELDS) {
    const hashKey = `${field}_hash`;
    if (emp[field] != null) {
      result[hashKey] = hashField(String(emp[field]));
    }
  }
  return result;
}

export function decryptEmployee(emp) {
  const result = { ...emp };
  for (const field of SENSITIVE_FIELDS) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]) || result[field];
    }
  }
  delete result.national_id_hash;
  delete result.nik_hash;
  delete result.phone_number_hash;
  return result;
}
