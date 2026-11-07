// ============================================================
// AI account config — normalisasi & pembacaan akun tersimpan
// ============================================================

import type { AiAccount, AiAccountWithKey, AiProviderKind } from '@/lib/ai-types';

/**
 * Normalisasi satu akun dari input form/API.
 *
 * Mengembalikan null bila konfigurasi tidak lengkap, sehingga pemanggil
 * bisa menolak dengan pesan yang jelas alih-alih menyimpan akun rusak.
 */
export function normalizeAccountInput(input: unknown, index: number): AiAccount | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const rawId = typeof record.id === 'string' ? record.id.trim() : '';
  // ID dipakai sebagai kunci objek rahasia & kunci React — batasi bentuknya
  // agar tidak bisa menyuntikkan karakter aneh ke struktur data.
  const id = /^[A-Za-z0-9_-]{1,64}$/.test(rawId)
    ? rawId
    : `acc-${index + 1}-${Date.now().toString(36)}`;
  const provider: AiProviderKind = record.provider === 'openai-compatible' ? 'openai-compatible' : 'gemini';
  const baseUrl = typeof record.baseUrl === 'string' ? record.baseUrl.trim().slice(0, 500) : '';
  const model = typeof record.model === 'string' ? record.model.trim().slice(0, 200) : '';
  const label = typeof record.label === 'string' && record.label.trim()
    ? record.label.trim().slice(0, 80)
    : `Akun ${index + 1}`;

  // Akun OpenAI-compatible wajib punya base URL; Gemini tidak memerlukannya.
  if (provider === 'openai-compatible' && !baseUrl) return null;

  return { id, label, provider, baseUrl, model, enabled: record.enabled !== false };
}

/**
 * Menyusun daftar akun ber-API-key dari konfigurasi + secret tersimpan.
 *
 * Urutan array dipertahankan karena itulah urutan failover. Akun tanpa
 * API key tetap dikembalikan (apiKey kosong) agar UI bisa menandainya;
 * `callVisionWithFailover` yang menyaring akun tanpa key.
 */
export function resolveAccounts(
  config: Record<string, unknown> | null | undefined,
  secrets: Record<string, unknown>,
): AiAccountWithKey[] {
  const rawAccounts = config?.aiAccounts;
  const accountKeys = (secrets.accountKeys && typeof secrets.accountKeys === 'object' && !Array.isArray(secrets.accountKeys))
    ? secrets.accountKeys as Record<string, unknown>
    : {};

  const accounts: AiAccountWithKey[] = [];

  if (Array.isArray(rawAccounts) && rawAccounts.length > 0) {
    for (const entry of rawAccounts) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : '';
      if (!id) continue;
      const provider: AiProviderKind = record.provider === 'openai-compatible' ? 'openai-compatible' : 'gemini';
      accounts.push({
        id,
        label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : id,
        provider,
        baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : '',
        model: typeof record.model === 'string' ? record.model : '',
        enabled: record.enabled !== false,
        apiKey: typeof accountKeys[id] === 'string' ? accountKeys[id] as string : '',
      });
    }
  }

  // Kompatibilitas konfigurasi lama: satu key di level atas diperlakukan
  // sebagai satu akun "default". Tanpa ini, pengguna yang sudah menyimpan
  // API key sebelum fitur multi-akun ada akan kehilangan aksesnya.
  if (accounts.length === 0) {
    const legacyKey = typeof secrets.apiKey === 'string' ? secrets.apiKey : '';
    if (legacyKey) {
      accounts.push({
        id: 'default',
        label: 'Akun Utama',
        provider: config?.provider === 'openai-compatible' ? 'openai-compatible' : 'gemini',
        baseUrl: typeof config?.baseUrl === 'string' ? config.baseUrl : '',
        model: typeof config?.model === 'string' ? config.model : '',
        enabled: true,
        apiKey: legacyKey,
      });
    }
  }

  return accounts;
}

/** Ringkasan akun untuk ditampilkan di UI (tanpa API key). */
export function accountsForClient(accounts: AiAccountWithKey[]): Array<AiAccount & { hasApiKey: boolean }> {
  return accounts.map((account) => ({
    id: account.id,
    label: account.label,
    provider: account.provider,
    baseUrl: account.baseUrl,
    model: account.model,
    enabled: account.enabled,
    hasApiKey: Boolean(account.apiKey),
  }));
}
