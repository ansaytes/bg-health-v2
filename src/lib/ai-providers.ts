// ============================================================
// AI multi-profil dengan failover otomatis (server-only)
// ============================================================
//
// Satu "profil" = satu akun/API key + model. Ekstraksi MCU mencoba profil
// BERURUTAN sesuai prioritas. Bila sebuah profil gagal karena kuota/token
// habis, key ditolak, server sibuk, atau balasannya tidak terbaca, sistem
// langsung lanjut ke profil berikutnya — operator tidak perlu mengulang.
//
// Penyimpanan: satu baris `ai` di tabel `integration_settings` (config = daftar
// profil tanpa rahasia; secret_ciphertext = API key per profil, terenkripsi
// AES-256-GCM). Semua kolom tabel terpakai, tidak ada kolom atau baris cadangan,
// dan tidak perlu migrasi. Format lama (satu AI) tidak dibaca lagi: barisnya
// langsung tertimpa saat pengaturan AI disimpan pertama kali.

import crypto from 'node:crypto';
import {
  decryptIntegrationSecret,
  readIntegration,
  writeIntegration,
} from '@/lib/integration-settings';

// Tipe di bawah ini juga dipakai komponen client lewat `import type` (terhapus
// saat build, jadi tidak membawa modul server ke browser).

export type AiProviderKind = 'gemini' | 'openai-compatible' | 'anthropic';

export interface AiProfile {
  /** Pengenal stabil (bukan rahasia); dipakai untuk menyimpan API key per profil. */
  id: string;
  /** Nama bebas, mis. "Gemini akun kantor" atau "OpenRouter cadangan". */
  name: string;
  provider: AiProviderKind;
  /** Wajib untuk openai-compatible; opsional untuk anthropic; kosong untuk gemini. */
  baseUrl: string;
  model: string;
  /** Profil nonaktif dilewati saat ekstraksi tanpa perlu dihapus. */
  enabled: boolean;
}

/** Profil yang dikirim ke browser: TIDAK pernah membawa API key. */
export interface AiProfilePublic extends AiProfile {
  hasApiKey: boolean;
}

export const MAX_AI_PROFILES = 10;

/** Ringkasan satu percobaan saat failover, aman ditampilkan ke operator. */
export interface AiAttempt {
  profileId: string;
  profileName: string;
  model: string;
  status: 'ok' | 'failed' | 'skipped';
  /** Alasan singkat berbahasa Indonesia, tanpa detail rahasia. */
  reason?: string;
  kind?: AiFailureKind;
}

export type AiFailureKind =
  | 'quota'          // kuota/token/limit pemakaian habis, rate limit
  | 'auth'           // API key salah / dicabut / tidak punya akses
  | 'overloaded'     // server provider sibuk / gangguan sementara
  | 'network'        // timeout / tidak terjangkau
  | 'bad_request'    // model tidak ada / tidak mendukung gambar / permintaan ditolak
  | 'invalid_output' // balasan bukan JSON yang bisa dibaca
  | 'cooldown';      // dilewati karena baru saja gagal (masa tunggu)

const PROFILES_KEY = 'ai';
const PROVIDERS: AiProviderKind[] = ['gemini', 'openai-compatible', 'anthropic'];

export interface StoredAiProfile extends AiProfile {
  apiKey: string;
}

export interface AvailableModel {
  id: string;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// ────────────────────────────────────────────────────────────
// Validasi
// ────────────────────────────────────────────────────────────

/**
 * Base URL harus HTTP(S) tanpa kredensial/query/fragment. Alamat metadata
 * cloud (169.254.x.x, metadata.google.internal) ditolak supaya server tidak
 * bisa dipakai membaca kredensial infrastruktur (SSRF).
 */
export function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'metadata.google.internal' || host.startsWith('169.254.') || host === '[fd00:ec2::254]') return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/;

export interface ProfileInput {
  id?: unknown;
  name?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  enabled?: unknown;
  apiKey?: unknown;
  clearApiKey?: unknown;
}

export function validateProfileInput(raw: unknown, position: number): { profile: AiProfile; apiKey?: string; clearApiKey: boolean } | { error: string } {
  const label = `AI #${position + 1}`;
  if (!isRecord(raw)) return { error: `${label}: data tidak valid.` };
  const input = raw as ProfileInput;

  const provider = input.provider;
  if (typeof provider !== 'string' || !PROVIDERS.includes(provider as AiProviderKind)) {
    return { error: `${label}: provider tidak didukung.` };
  }
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 60) return { error: `${label}: nama wajib diisi (maksimal 60 karakter).` };

  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (model && !MODEL_ID.test(model)) return { error: `${label}: nama model tidak valid.` };

  let baseUrl = '';
  if (provider === 'openai-compatible') {
    const normalized = normalizeBaseUrl(input.baseUrl);
    if (!normalized) return { error: `${label}: Base URL harus HTTP(S) tanpa kredensial, query, atau fragment.` };
    baseUrl = normalized;
  } else if (provider === 'anthropic') {
    const hasUrl = typeof input.baseUrl === 'string' && input.baseUrl.trim() !== '';
    const normalized = hasUrl ? normalizeBaseUrl(input.baseUrl) : 'https://api.anthropic.com';
    if (!normalized) return { error: `${label}: Base URL tidak valid.` };
    baseUrl = normalized;
  }

  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : undefined;
  if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || (apiKey && apiKey.length > 4096))) {
    return { error: `${label}: API key tidak valid.` };
  }
  if (apiKey && /[\s\u0000-\u001f]/.test(apiKey)) return { error: `${label}: API key tidak boleh berisi spasi atau karakter kontrol.` };

  const id = typeof input.id === 'string' && /^[a-z0-9][a-z0-9-]{1,39}$/.test(input.id) ? input.id : '';
  return {
    profile: {
      id,
      name,
      provider: provider as AiProviderKind,
      baseUrl,
      model,
      enabled: input.enabled !== false,
    },
    apiKey: apiKey || undefined,
    clearApiKey: input.clearApiKey === true,
  };
}

// ────────────────────────────────────────────────────────────
// Penyimpanan
// ────────────────────────────────────────────────────────────

function readStoredProfiles(config: Record<string, unknown>, secrets: Record<string, unknown>): StoredAiProfile[] {
  const list = Array.isArray(config.profiles) ? config.profiles : [];
  const keys = isRecord(secrets.keys) ? secrets.keys : {};
  const out: StoredAiProfile[] = [];
  for (const entry of list) {
    if (!isRecord(entry) || typeof entry.id !== 'string') continue;
    const provider = PROVIDERS.includes(entry.provider as AiProviderKind) ? (entry.provider as AiProviderKind) : 'gemini';
    out.push({
      id: entry.id,
      name: typeof entry.name === 'string' && entry.name ? entry.name : entry.id,
      provider,
      baseUrl: typeof entry.baseUrl === 'string' ? entry.baseUrl : '',
      model: typeof entry.model === 'string' ? entry.model : '',
      enabled: entry.enabled !== false,
      apiKey: typeof keys[entry.id] === 'string' ? (keys[entry.id] as string) : '',
    });
  }
  return out;
}

/** Semua profil beserta API key (hanya untuk dipakai server). */
export async function loadAiProfiles(): Promise<StoredAiProfile[]> {
  const record = await readIntegration(PROFILES_KEY);
  if (!record) return [];
  return readStoredProfiles(record.config, decryptIntegrationSecret(record.secret_ciphertext));
}

export function toPublicProfile(profile: StoredAiProfile): AiProfilePublic {
  const { apiKey, ...rest } = profile;
  return { ...rest, hasApiKey: apiKey.length > 0 };
}

export async function loadAiProfilesPublic(): Promise<AiProfilePublic[]> {
  return (await loadAiProfiles()).map(toPublicProfile);
}

/**
 * Menyimpan SELURUH daftar profil (urutan = prioritas). Key profil yang tidak
 * disebut apiKey-nya dipertahankan; profil yang tidak ada dalam daftar dihapus
 * beserta key-nya.
 */
export async function saveAiProfiles(
  inputs: Array<{ profile: AiProfile; apiKey?: string; clearApiKey: boolean }>,
  updatedBy: string,
): Promise<void> {
  const existing = new Map((await loadAiProfiles()).map((profile) => [profile.id, profile]));
  const usedIds = new Set<string>();
  const profiles: AiProfile[] = [];
  const keys: Record<string, string> = {};

  for (const item of inputs) {
    let id = item.profile.id;
    if (!id || usedIds.has(id)) id = `ai-${crypto.randomBytes(5).toString('hex')}`;
    usedIds.add(id);
    const previousKey = existing.get(id)?.apiKey ?? '';
    const apiKey = item.clearApiKey ? '' : (item.apiKey ?? previousKey);
    profiles.push({ ...item.profile, id });
    if (apiKey) keys[id] = apiKey;
  }

  await writeIntegration({
    key: PROFILES_KEY,
    config: { profiles },
    secrets: { keys },
    updatedBy,
  });
}

// ────────────────────────────────────────────────────────────
// Klasifikasi kegagalan
// ────────────────────────────────────────────────────────────

export class AiCallError extends Error {
  constructor(
    message: string,
    public kind: AiFailureKind,
    public status = 0,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AiCallError';
  }
}

const QUOTA_TEXT = /quota|rate.?limit|resource.?exhausted|insufficient|credit|billing|usage limit|limit.*(reached|exceeded)|exceeded.*(limit|quota)|too many requests|tokens? per (minute|day)|out of (tokens|credits)|payment required|balance/i;
const AUTH_TEXT = /api key (not valid|invalid|expired)|invalid.*api.?key|incorrect api key|unauthorized|permission.?denied|authentication|access.?denied|forbidden|disabled|has been (suspended|revoked)/i;

function parseRetryAfter(headers: Headers | undefined, body: string): number | undefined {
  const header = headers?.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 6 * 3600);
  }
  const gemini = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (gemini) return Math.min(Math.ceil(Number(gemini[1])), 6 * 3600);
  return undefined;
}

export function classifyFailure(status: number, body: string, headers?: Headers): AiCallError {
  const retryAfter = parseRetryAfter(headers, body);
  const snippet = body.replace(/\s+/g, ' ').slice(0, 200);
  if (status === 429 || status === 402 || (status === 400 && QUOTA_TEXT.test(body) && !/api key/i.test(body))) {
    return new AiCallError(`HTTP ${status}: kuota/limit habis`, 'quota', status, retryAfter);
  }
  if (status === 401 || status === 403 || AUTH_TEXT.test(body)) {
    // 403 yang sebenarnya berisi pesan kuota (sebagian provider) tetap kuota.
    if (QUOTA_TEXT.test(body) && !AUTH_TEXT.test(body)) {
      return new AiCallError(`HTTP ${status}: kuota/limit habis`, 'quota', status, retryAfter);
    }
    return new AiCallError(`HTTP ${status}: API key ditolak`, 'auth', status);
  }
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529) {
    return new AiCallError(`HTTP ${status}: server AI sibuk`, 'overloaded', status, retryAfter);
  }
  return new AiCallError(`HTTP ${status}: ${snippet || 'permintaan ditolak'}`, 'bad_request', status);
}

const REASON_TEXT: Record<AiFailureKind, string> = {
  quota: 'Kuota / batas pemakaian habis',
  auth: 'API key ditolak atau tidak punya akses',
  overloaded: 'Server AI sedang sibuk',
  network: 'Tidak dapat dihubungi atau waktu habis',
  bad_request: 'Model atau permintaan ditolak (pastikan model mendukung gambar)',
  invalid_output: 'Balasan AI tidak dapat dibaca',
  cooldown: 'Dilewati: baru saja gagal, menunggu masa tunggu',
};

// ────────────────────────────────────────────────────────────
// Pemanggilan model dengan gambar (vision)
// ────────────────────────────────────────────────────────────

export interface VisionImage {
  data: string; // base64 tanpa prefix data:
  mimeType: string;
}

export interface VisionRequest {
  system: string;
  userText: string;
  images: VisionImage[];
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<{ status: number; headers: Headers; text: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    return { status: response.status, headers: response.headers, text: await response.text() };
  } catch {
    throw new AiCallError('Tidak dapat dihubungi atau waktu habis', 'network');
  }
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callGemini(profile: StoredAiProfile, request: VisionRequest, timeoutMs: number): Promise<string> {
  if (!MODEL_ID.test(profile.model)) throw new AiCallError('Nama model tidak valid', 'bad_request');
  const parts: Array<Record<string, unknown>> = request.images.map((image) => ({
    inlineData: { data: image.data, mimeType: image.mimeType },
  }));
  parts.push({ text: request.userText });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.model)}:generateContent`;
  const result = await postJson(url, { 'x-goog-api-key': profile.apiKey }, {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  }, timeoutMs);
  if (result.status < 200 || result.status >= 300) throw classifyFailure(result.status, result.text, result.headers);
  const payload = parseJsonSafe(result.text);
  if (!isRecord(payload)) throw new AiCallError('Respons tidak valid', 'invalid_output');
  const candidate = Array.isArray(payload.candidates) ? payload.candidates[0] : null;
  const content = isRecord(candidate) && isRecord(candidate.content) ? candidate.content : null;
  const textParts = content && Array.isArray(content.parts)
    ? content.parts.filter((part): part is { text: string } => isRecord(part) && typeof part.text === 'string')
    : [];
  if (!textParts.length) {
    // Diblokir oleh filter keamanan atau tidak ada keluaran.
    throw new AiCallError('Tidak ada keluaran dari model', 'invalid_output');
  }
  return textParts.map((part) => part.text).join('');
}

async function callOpenAiCompatible(profile: StoredAiProfile, request: VisionRequest, timeoutMs: number): Promise<string> {
  const base = profile.baseUrl.replace(/\/+$/, '');
  if (!base) throw new AiCallError('Base URL belum diatur', 'bad_request');
  const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: request.userText }];
  for (const image of request.images) {
    userContent.push({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } });
  }
  const body: Record<string, unknown> = {
    model: profile.model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };
  // Sebagian penyedia/model menolak `response_format` atau `temperature`
  // (mis. model penalaran). Ulangi tanpa parameter itu, maksimal dua kali.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await postJson(endpoint, { Authorization: `Bearer ${profile.apiKey}` }, body, timeoutMs);
    if (result.status >= 200 && result.status < 300) {
      const payload = parseJsonSafe(result.text);
      const choice = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : null;
      const message = isRecord(choice) && isRecord(choice.message) ? choice.message : null;
      const content = message?.content;
      if (typeof content === 'string' && content.trim()) return content;
      if (Array.isArray(content)) {
        const joined = content
          .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
          .join('');
        if (joined.trim()) return joined;
      }
      throw new AiCallError('Respons tidak berisi teks', 'invalid_output');
    }
    if (result.status === 400 && attempt < 2) {
      let changed = false;
      if (/response_format|json_object|json_schema/i.test(result.text) && 'response_format' in body) {
        delete body.response_format;
        changed = true;
      }
      if (/temperature/i.test(result.text) && 'temperature' in body) {
        delete body.temperature;
        changed = true;
      }
      if (changed) continue;
    }
    throw classifyFailure(result.status, result.text, result.headers);
  }
  throw new AiCallError('Permintaan ditolak', 'bad_request');
}

async function callAnthropic(profile: StoredAiProfile, request: VisionRequest, timeoutMs: number): Promise<string> {
  const base = (profile.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const endpoint = base.endsWith('/messages') ? base : `${base}/v1/messages`;
  const content: Array<Record<string, unknown>> = request.images.map((image) => ({
    type: 'image',
    source: { type: 'base64', media_type: image.mimeType, data: image.data },
  }));
  content.push({ type: 'text', text: request.userText });
  const result = await postJson(endpoint, {
    'x-api-key': profile.apiKey,
    'anthropic-version': '2023-06-01',
  }, {
    model: profile.model,
    max_tokens: 8192,
    temperature: 0.1,
    system: `${request.system}\n\nBalas HANYA dengan satu objek JSON valid, tanpa teks lain dan tanpa blok markdown.`,
    messages: [{ role: 'user', content }],
  }, timeoutMs);
  if (result.status < 200 || result.status >= 300) throw classifyFailure(result.status, result.text, result.headers);
  const payload = parseJsonSafe(result.text);
  const blocks = isRecord(payload) && Array.isArray(payload.content) ? payload.content : [];
  const text = blocks
    .map((block) => (isRecord(block) && block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .join('');
  if (!text.trim()) throw new AiCallError('Respons tidak berisi teks', 'invalid_output');
  return text;
}

export async function callVisionModel(profile: StoredAiProfile, request: VisionRequest, timeoutMs: number): Promise<string> {
  switch (profile.provider) {
    case 'gemini': return callGemini(profile, request, timeoutMs);
    case 'anthropic': return callAnthropic(profile, request, timeoutMs);
    default: return callOpenAiCompatible(profile, request, timeoutMs);
  }
}

/** Mengambil objek JSON dari balasan model (toleran terhadap ```json dan teks pembuka). */
export function extractJsonObject(text: string): Record<string, unknown> {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const candidates = [stripped];
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(stripped.slice(first, last + 1));
  for (const candidate of candidates) {
    const parsed = parseJsonSafe(candidate);
    if (isRecord(parsed)) return parsed;
  }
  throw new AiCallError('Balasan bukan JSON', 'invalid_output');
}

// ────────────────────────────────────────────────────────────
// Failover
// ────────────────────────────────────────────────────────────

/**
 * Masa tunggu per profil, disimpan di memori proses. Profil yang baru gagal
 * karena kuota/key/server sibuk dilewati pada permintaan berikutnya, supaya
 * operator tidak menunggu satu panggilan gagal setiap kali. Bersifat
 * "sebaik mungkin": di lingkungan serverless memori bisa direset, dan itu
 * tidak apa-apa — profil hanya akan dicoba lagi lebih awal.
 */
const cooldowns = new Map<string, number>();

function cooldownKey(profile: StoredAiProfile): string {
  const fingerprint = crypto.createHash('sha256').update(profile.apiKey).digest('hex').slice(0, 8);
  return `${profile.id}:${profile.model}:${fingerprint}`;
}

function cooldownSeconds(error: AiCallError): number {
  switch (error.kind) {
    case 'quota': return error.retryAfterSeconds ? Math.max(error.retryAfterSeconds, 30) : 600;
    case 'auth': return 3600;
    case 'overloaded': return error.retryAfterSeconds ?? 30;
    case 'bad_request': return 300;
    default: return 0;
  }
}

/** Untuk pengujian: hapus semua masa tunggu. */
export function resetAiCooldowns(): void {
  cooldowns.clear();
}

export interface FailoverOptions<T> {
  profiles: StoredAiProfile[];
  /** Bila diisi dan valid, profil ini dicoba lebih dulu; sisanya mengikuti urutan. */
  preferredProfileId?: string;
  request: VisionRequest;
  parse: (text: string) => T;
  /** Batas waktu total semua percobaan (default 55 dtk, sesuai batas fungsi server). */
  deadlineMs?: number;
  /** Batas waktu satu percobaan (default 45 dtk). */
  attemptTimeoutMs?: number;
  /** Injeksi untuk pengujian. */
  caller?: (profile: StoredAiProfile, request: VisionRequest, timeoutMs: number) => Promise<string>;
  now?: () => number;
}

export type FailoverResult<T> =
  | { ok: true; value: T; used: AiAttempt; attempts: AiAttempt[] }
  | { ok: false; attempts: AiAttempt[]; allQuota: boolean; retryAfterSeconds?: number; noUsableProfile: boolean };

export async function runVisionWithFailover<T>(options: FailoverOptions<T>): Promise<FailoverResult<T>> {
  const now = options.now ?? Date.now;
  const caller = options.caller ?? callVisionModel;
  const startedAt = now();
  const deadline = startedAt + (options.deadlineMs ?? 55_000);
  const perAttempt = options.attemptTimeoutMs ?? 45_000;

  let usable = options.profiles.filter((profile) => profile.enabled && profile.apiKey && profile.model);
  if (options.preferredProfileId) {
    const preferred = usable.find((profile) => profile.id === options.preferredProfileId);
    if (preferred) usable = [preferred, ...usable.filter((profile) => profile !== preferred)];
  }
  if (!usable.length) return { ok: false, attempts: [], allQuota: false, noUsableProfile: true };

  const attempts: AiAttempt[] = [];
  const failures: AiCallError[] = [];
  const describe = (profile: StoredAiProfile) => ({ profileId: profile.id, profileName: profile.name, model: profile.model });

  const tryProfile = async (profile: StoredAiProfile): Promise<{ ok: true; value: T; used: AiAttempt } | { ok: false }> => {
    const remaining = deadline - now();
    if (remaining < 4_000) {
      attempts.push({ ...describe(profile), status: 'skipped', reason: 'Waktu pemrosesan habis sebelum profil ini dicoba' });
      return { ok: false };
    }
    try {
      const text = await caller(profile, options.request, Math.min(perAttempt, remaining - 1_000));
      let value: T;
      try {
        value = options.parse(text);
      } catch (error) {
        throw error instanceof AiCallError ? error : new AiCallError('Balasan AI tidak dapat dibaca', 'invalid_output');
      }
      cooldowns.delete(cooldownKey(profile));
      const used: AiAttempt = { ...describe(profile), status: 'ok' };
      attempts.push(used);
      return { ok: true, value, used };
    } catch (error) {
      const failure = error instanceof AiCallError ? error : new AiCallError('Kesalahan tak terduga', 'network');
      failures.push(failure);
      const seconds = cooldownSeconds(failure);
      if (seconds > 0) cooldowns.set(cooldownKey(profile), now() + seconds * 1000);
      attempts.push({ ...describe(profile), status: 'failed', kind: failure.kind, reason: REASON_TEXT[failure.kind] });
      console.warn(`[AI failover] profil "${profile.name}" gagal (${failure.kind}, HTTP ${failure.status || '-'}); lanjut ke profil berikutnya bila ada.`);
      return { ok: false };
    }
  };

  // Putaran 1: lewati profil yang sedang dalam masa tunggu.
  const deferred: StoredAiProfile[] = [];
  for (const profile of usable) {
    const until = cooldowns.get(cooldownKey(profile)) ?? 0;
    if (until > now()) {
      deferred.push(profile);
      continue;
    }
    const outcome = await tryProfile(profile);
    if (outcome.ok) return { ok: true, value: outcome.value, used: outcome.used, attempts };
  }

  // Putaran 2: semua profil yang tersisa sedang menunggu — coba juga, yang masa
  // tunggunya paling cepat berakhir lebih dulu. Lebih baik mencoba daripada
  // menolak operator padahal kuota mungkin sudah pulih.
  deferred.sort((a, b) => (cooldowns.get(cooldownKey(a)) ?? 0) - (cooldowns.get(cooldownKey(b)) ?? 0));
  for (const profile of deferred) {
    const outcome = await tryProfile(profile);
    if (outcome.ok) return { ok: true, value: outcome.value, used: outcome.used, attempts };
  }

  const allQuota = failures.length > 0 && failures.every((failure) => failure.kind === 'quota');
  const retryAfters = failures.map((failure) => failure.retryAfterSeconds).filter((v): v is number => typeof v === 'number');
  return {
    ok: false,
    attempts,
    allQuota,
    retryAfterSeconds: retryAfters.length ? Math.min(...retryAfters) : undefined,
    noUsableProfile: false,
  };
}

/** Ringkasan satu kalimat untuk operator: apa yang terjadi di tiap profil. */
export function summariseAttempts(attempts: AiAttempt[]): string {
  return attempts
    .map((attempt) => `${attempt.profileName} (${attempt.model}): ${attempt.status === 'ok' ? 'berhasil' : attempt.reason ?? 'gagal'}`)
    .join('; ');
}

// ────────────────────────────────────────────────────────────
// Daftar model (hanya yang bisa membaca gambar)
// ────────────────────────────────────────────────────────────

const NON_VISION_PATTERNS = [
  /embedding/i, /^text-embedding/i, /aqa/i, /imagen/i, /image-generation/i,
  /tts/i, /audio/i, /speech/i, /whisper/i, /veo/i, /video/i, /learnlm/i,
  /gemma/i, /^text-bison/i, /^chat-bison/i, /^code-/i, /codex/i,
  /dall-e/i, /moderation/i, /rerank/i, /guard/i, /instruct$/i,
];

export function isVisionModel(id: string, name: string, declaredInputs?: string[]): boolean {
  // 1. Metadata provider paling dapat dipercaya.
  if (declaredInputs && declaredInputs.length > 0) {
    return declaredInputs.some((input) => /image|vision|multimodal/i.test(input));
  }
  // 2. Pola nama model.
  const label = `${id} ${name}`;
  if (NON_VISION_PATTERNS.some((pattern) => pattern.test(label))) return false;
  return /gemini|gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|gpt-5|\bo[134](-|\b)|claude|llava|pixtral|qwen.*vl|internvl|minicpm|llama-?4|llama.*vision|mistral-(small|medium|large)|grok.*(vision|4)|vision|multimodal|omni/i.test(label);
}

async function providerErrorMessage(status: number, text: string, apiKey: string): Promise<string> {
  let message = '';
  const payload = parseJsonSafe(text);
  if (isRecord(payload)) {
    if (isRecord(payload.error) && typeof payload.error.message === 'string') message = payload.error.message;
    else if (typeof payload.message === 'string') message = payload.message;
  }
  const safe = message ? message.split(apiKey).join('[redacted]').slice(0, 300) : 'Provider menolak permintaan.';
  return `HTTP ${status}: ${safe}`;
}

export class ModelListError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ModelListError';
  }
}

async function getJson(url: string, headers: Record<string, string>, apiKey: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ModelListError('Provider tidak dapat dijangkau atau waktu habis.', 502);
  }
  const text = await response.text();
  if (!response.ok) throw new ModelListError(await providerErrorMessage(response.status, text, apiKey), 502);
  const payload = parseJsonSafe(text);
  if (payload === null) throw new ModelListError('Respons daftar model tidak valid.', 502);
  return payload;
}

export async function listVisionModels(
  provider: AiProviderKind,
  baseUrl: string,
  apiKey: string,
): Promise<AvailableModel[]> {
  let models: AvailableModel[] = [];

  if (provider === 'gemini') {
    let pageToken = '';
    for (let page = 0; page < 10; page += 1) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '1000');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const payload = await getJson(url.toString(), { 'x-goog-api-key': apiKey }, apiKey);
      if (!isRecord(payload) || !Array.isArray(payload.models)) throw new ModelListError('Respons daftar model Gemini tidak valid.', 502);
      for (const model of payload.models) {
        if (!isRecord(model) || typeof model.name !== 'string'
          || !Array.isArray(model.supportedGenerationMethods)
          || !model.supportedGenerationMethods.includes('generateContent')) continue;
        const id = model.name.replace(/^models\//, '');
        const displayName = typeof model.displayName === 'string' ? model.displayName : id;
        const declaredInputs = Array.isArray(model.inputModalities)
          ? model.inputModalities.filter((entry): entry is string => typeof entry === 'string')
          : undefined;
        if (isVisionModel(id, displayName, declaredInputs)) models.push({ id, name: displayName });
      }
      pageToken = typeof payload.nextPageToken === 'string' ? payload.nextPageToken : '';
      if (!pageToken) break;
    }
  } else if (provider === 'anthropic') {
    const base = (baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const payload = await getJson(`${base}/v1/models?limit=1000`, {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }, apiKey);
    if (!isRecord(payload) || !Array.isArray(payload.data)) throw new ModelListError('Respons daftar model Anthropic tidak valid.', 502);
    models = payload.data.flatMap((model): AvailableModel[] => {
      if (!isRecord(model) || typeof model.id !== 'string') return [];
      return [{ id: model.id, name: typeof model.display_name === 'string' ? model.display_name : model.id }];
    });
  } else {
    const base = baseUrl.replace(/\/+$/, '');
    if (!base) throw new ModelListError('Base URL belum diatur.', 400);
    const endpoint = base.endsWith('/models') ? base : `${base}/models`;
    const payload = await getJson(endpoint, { Authorization: `Bearer ${apiKey}` }, apiKey);
    if (!isRecord(payload) || !Array.isArray(payload.data)) throw new ModelListError('Endpoint tidak mengembalikan daftar model yang valid.', 502);
    models = payload.data.flatMap((model): AvailableModel[] => {
      if (!isRecord(model) || typeof model.id !== 'string' || !model.id.trim()) return [];
      const name = typeof model.name === 'string' ? model.name : model.id;
      const architecture = isRecord(model.architecture) ? model.architecture : null;
      const declaredInputs = architecture && Array.isArray(architecture.input_modalities)
        ? architecture.input_modalities.filter((entry): entry is string => typeof entry === 'string')
        : undefined;
      return isVisionModel(model.id, name, declaredInputs) ? [{ id: model.id, name }] : [];
    });
  }

  return Array.from(new Map(models.map((model) => [model.id, model])).values())
    .sort((a, b) => a.name.localeCompare(b.name));
}

