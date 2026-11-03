import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const TABLE = 'integration_settings';

export interface IntegrationRecord {
  key: string;
  config: Record<string, unknown>;
  secret_ciphertext: string | null;
}

function masterKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY || '';
  if (!/^[\da-fA-F]{64}$/.test(raw)) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be configured as 32-byte hex.');
  }
  return Buffer.from(raw, 'hex');
}

export function isIntegrationEncryptionKeyConfigured(): boolean {
  return /^[\da-fA-F]{64}$/.test(process.env.INTEGRATION_ENCRYPTION_KEY || '');
}

function deriveKey(purpose: string): Buffer {
  return crypto.createHmac('sha256', masterKey()).update(`bg-health:${purpose}`).digest();
}

export function encryptIntegrationSecret(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('integration-secret'), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('hex');
}

export function decryptIntegrationSecret(ciphertext: string | null): Record<string, unknown> {
  if (!ciphertext) return {};
  const raw = Buffer.from(ciphertext, 'hex');
  if (raw.length < 28) throw new Error('Stored integration secret is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('integration-secret'), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const value = Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Stored integration secret has an invalid shape.');
  }
  return parsed as Record<string, unknown>;
}

export function signIntegrationState(payload: string): string {
  return crypto.createHmac('sha256', deriveKey('oauth-state')).update(payload).digest('base64url');
}

export function verifyIntegrationState(payload: string, signature: string): boolean {
  const expected = Buffer.from(signIntegrationState(payload));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function integrationAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('Supabase service role is not configured.');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function readIntegration(key: string): Promise<IntegrationRecord | null> {
  const { data, error } = await integrationAdminClient()
    .from(TABLE)
    .select('key,config,secret_ciphertext')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error('[Integration settings] Database read failed:', error.code);
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('INTEGRATION_SETTINGS_TABLE_MISSING');
    }
    throw new Error(`INTEGRATION_SETTINGS_READ_FAILED:${error.code || 'UNKNOWN'}`);
  }
  return data as IntegrationRecord | null;
}

export async function writeIntegration(input: {
  key: string;
  config: Record<string, unknown>;
  secrets: Record<string, unknown>;
  updatedBy: string;
}): Promise<void> {
  const { error } = await integrationAdminClient()
    .from(TABLE)
    .upsert({
      key: input.key,
      config: input.config,
      secret_ciphertext: encryptIntegrationSecret(input.secrets),
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    console.error('[Integration settings] Database write failed:', error.code);
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('INTEGRATION_SETTINGS_TABLE_MISSING');
    }
    throw new Error(`INTEGRATION_SETTINGS_WRITE_FAILED:${error.code || 'UNKNOWN'}`);
  }
}

export async function getDriveAccessToken(): Promise<string> {
  const record = await readIntegration('google_drive');
  const secrets = decryptIntegrationSecret(record?.secret_ciphertext ?? null);
  const refreshToken = typeof secrets.refreshToken === 'string' ? secrets.refreshToken : '';
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Google Drive belum terhubung atau OAuth belum dikonfigurasi.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Token Google Drive tidak dapat diperbarui.');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('access_token' in result)
    || typeof result.access_token !== 'string') {
    throw new Error('Respons token Google Drive tidak valid.');
  }
  return result.access_token;
}
