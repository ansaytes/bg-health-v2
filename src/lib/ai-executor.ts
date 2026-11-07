// ============================================================
// AI vision executor — pemanggilan provider + failover berurutan
// ============================================================

import { GoogleGenAI } from '@google/genai';
import type {
  AiAccountWithKey,
  VisionAttempt,
  VisionFailureKind,
  VisionRequest,
  VisionResult,
} from '@/lib/ai-types';

/** Error provider yang sudah dinormalkan. */
class ProviderFailure extends Error {
  constructor(
    public kind: VisionFailureKind,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** Buang API key dari pesan error agar tidak bocor ke log/klien. */
function redact(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join('[redacted]');
}

/** Baca pesan error dari body respons HTTP tanpa membocorkan API key. */
async function readProviderError(response: Response, apiKey: string): Promise<string> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    return `HTTP ${response.status}`;
  }
  let message = '';
  try {
    const payload: unknown = JSON.parse(body);
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const error = record.error;
      if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
        message = String((error as Record<string, unknown>).message);
      } else if (typeof error === 'string') {
        message = error;
      } else if (typeof record.message === 'string') {
        message = record.message;
      }
    }
  } catch {
    message = '';
  }
  const safe = redact(message || body.slice(0, 200), apiKey).slice(0, 300);
  return `HTTP ${response.status}: ${safe || 'Provider menolak permintaan.'}`;
}

/**
 * Klasifikasi status HTTP menjadi jenis kegagalan.
 *
 * PENTING: hanya `quota` dan `auth` yang benar-benar berarti "akun ini
 * sudah tidak bisa dipakai" — untuk keduanya failover WAJIB jalan.
 * `network` juga layak dicoba di akun lain karena endpoint bisa berbeda,
 * dan `invalid-response` biasanya berarti model tidak mendukung vision
 * sehingga akun lain patut dicoba.
 */
function classifyStatus(status: number): VisionFailureKind {
  if (status === 429 || status === 402) return 'quota';
  if (status === 401 || status === 403) return 'auth';
  if (status === 408 || status === 504 || status >= 500) return 'network';
  return 'provider';
}

async function callGemini(account: AiAccountWithKey, request: VisionRequest): Promise<string> {
  const model = (request.model || account.model || '').trim();
  if (!model) throw new ProviderFailure('provider', 'Model Gemini belum dipilih untuk akun ini.');

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> =
    request.images.map((image) => ({ inlineData: { data: image.data, mimeType: image.mimeType } }));
  parts.push({ text: request.prompt });

  const ai = new GoogleGenAI({ apiKey: account.apiKey });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: request.systemInstruction,
        ...(request.jsonMode === false ? {} : { responseMimeType: 'application/json' }),
        temperature: request.temperature ?? 0.1,
      },
    });
    return response.text || '';
  } catch (error: unknown) {
    const apiError = error as { code?: number; status?: string; message?: string };
    const message = redact(apiError.message || '', account.apiKey);
    const code = typeof apiError.code === 'number' ? apiError.code : undefined;
    if (code === 429 || apiError.status === 'RESOURCE_EXHAUSTED'
      || /quota exceeded|rate limit|resource_exhausted|billing|exceeded your current quota/i.test(message)) {
      throw new ProviderFailure('quota', message || 'Kuota Gemini habis.', 429);
    }
    if (code === 401 || code === 403 || /api key not valid|permission denied|unauthenticated|invalid api key/i.test(message)) {
      throw new ProviderFailure('auth', message || 'API key Gemini ditolak.', code);
    }
    if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed|network|socket hang up/i.test(message)) {
      throw new ProviderFailure('network', message || 'Koneksi ke Gemini gagal.');
    }
    throw new ProviderFailure('provider', message || 'Gemini gagal memproses permintaan.', code);
  }
}

async function callOpenAiCompatible(account: AiAccountWithKey, request: VisionRequest): Promise<string> {
  const baseUrl = account.baseUrl.replace(/\/+$/, '');
  if (!baseUrl) throw new ProviderFailure('provider', 'Base URL akun OpenAI-compatible belum diatur.');
  const model = (request.model || account.model || '').trim();
  if (!model) throw new ProviderFailure('provider', 'Model belum dipilih untuk akun ini.');

  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: request.prompt }];
  for (const image of request.images) {
    userContent.push({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content: userContent },
        ],
        temperature: request.temperature ?? 0.1,
        ...(request.jsonMode === false ? {} : { response_format: { type: 'json_object' } }),
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 60_000),
      cache: 'no-store',
    });
  } catch {
    throw new ProviderFailure('network', 'Endpoint AI tidak dapat dijangkau atau waktu permintaan habis.');
  }

  if (!response.ok) {
    const message = await readProviderError(response, account.apiKey);
    throw new ProviderFailure(classifyStatus(response.status), message, response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderFailure('invalid-response', 'Respons AI bukan JSON yang valid.');
  }
  const choices = (payload as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ProviderFailure('invalid-response', 'Respons AI tidak memuat pilihan jawaban.');
  }
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  if (typeof content !== 'string') {
    throw new ProviderFailure('invalid-response', 'Respons AI tidak memuat teks jawaban.');
  }
  return content;
}

/**
 * Menjalankan satu permintaan vision dengan FAILOVER berurutan.
 *
 * Urutan percobaan = urutan array `accounts`. Akun nonaktif atau tanpa
 * API key dilewati. Begitu satu akun berhasil, hasilnya langsung
 * dikembalikan — akun sesudahnya tidak disentuh, sehingga kuota mereka
 * tetap utuh untuk pekerjaan berikutnya.
 */
export async function callVisionWithFailover(
  accounts: AiAccountWithKey[],
  request: VisionRequest,
): Promise<VisionResult> {
  const attempts: VisionAttempt[] = [];
  const usable = accounts.filter((account) => account.enabled && account.apiKey);

  if (usable.length === 0) {
    return {
      ok: false,
      text: '',
      accountId: '',
      accountLabel: '',
      attempts,
      errorKind: 'no-account',
      errorMessage: 'Belum ada akun AI aktif dengan API key. Atur di Pengaturan > Integrasi.',
    };
  }

  for (const account of usable) {
    try {
      const text = account.provider === 'gemini'
        ? await callGemini(account, request)
        : await callOpenAiCompatible(account, request);
      attempts.push({ accountId: account.id, label: account.label, provider: account.provider, success: true });
      return { ok: true, text, accountId: account.id, accountLabel: account.label, attempts };
    } catch (error: unknown) {
      const failure = error instanceof ProviderFailure
        ? error
        : new ProviderFailure(
          'provider',
          error instanceof Error ? redact(error.message, account.apiKey) : 'Kegagalan tidak dikenal.',
        );
      attempts.push({
        accountId: account.id,
        label: account.label,
        provider: account.provider,
        success: false,
        failureKind: failure.kind,
        status: failure.status,
        message: failure.message.slice(0, 300),
      });
      // Failover ke akun berikutnya — inilah inti fitur ini.
      console.warn(`[AI failover] Akun "${account.label}" gagal (${failure.kind}); lanjut ke akun berikutnya.`);
    }
  }

  const last = attempts[attempts.length - 1];
  const kinds = attempts.map((attempt) => attempt.failureKind);
  const dominant: VisionFailureKind = kinds.every((kind) => kind === 'quota') ? 'quota'
    : kinds.every((kind) => kind === 'auth') ? 'auth'
      : last?.failureKind ?? 'provider';

  const ringkasan = attempts
    .map((attempt) => `${attempt.label}: ${attempt.message || attempt.failureKind}`)
    .join('; ');

  return {
    ok: false,
    text: '',
    accountId: '',
    accountLabel: '',
    attempts,
    errorKind: dominant,
    errorMessage: `Semua ${attempts.length} akun AI gagal. ${ringkasan}`.slice(0, 600),
    retryAfterSeconds: dominant === 'quota' ? 60 : undefined,
  };
}
