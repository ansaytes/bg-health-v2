import { NextRequest, NextResponse } from 'next/server';
import { decryptIntegrationSecret, readIntegration } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';

interface AvailableModel {
  id: string;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function providerError(response: Response, apiKey: string): Promise<string> {
  const body = await response.text();
  let message = '';
  try {
    const payload: unknown = JSON.parse(body);
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      message = payload.error.message;
    }
  } catch {
    message = '';
  }
  const safeMessage = message
    ? message.split(apiKey).join('[redacted]').slice(0, 300)
    : 'Provider menolak permintaan.';
  return `HTTP ${response.status}: ${safeMessage}`;
}

export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  try {
    const integration = await readIntegration('ai');
    const secret = decryptIntegrationSecret(integration?.secret_ciphertext ?? null);
    const apiKey = typeof secret.apiKey === 'string' ? secret.apiKey : '';
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Simpan API key AI di Pengaturan > Integrasi terlebih dahulu.' }, { status: 503 });
    }

    const provider = integration?.config.provider === 'openai-compatible' ? 'openai-compatible' : 'gemini';
    const configuredModel = typeof integration?.config.model === 'string' ? integration.config.model : '';
    let models: AvailableModel[] = [];

    if (provider === 'gemini') {
      const results: AvailableModel[] = [];
      let pageToken = '';
      for (let page = 0; page < 10; page += 1) {
        const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
        url.searchParams.set('pageSize', '1000');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const response = await fetch(url, {
          headers: { 'x-goog-api-key': apiKey },
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          console.error('[AI models] Gemini model listing failed:', response.status);
          const reason = await providerError(response, apiKey);
          return NextResponse.json({
            success: false,
            error: `Daftar model Gemini gagal (${reason}). Periksa validitas API key, akses Gemini API, dan kuota project.`,
          }, { status: 502 });
        }
        const payload: unknown = await response.json();
        if (!isRecord(payload) || !Array.isArray(payload.models)) {
          return NextResponse.json({ success: false, error: 'Respons daftar model Gemini tidak valid.' }, { status: 502 });
        }
        for (const model of payload.models) {
          if (!isRecord(model) || typeof model.name !== 'string'
            || !Array.isArray(model.supportedGenerationMethods)
            || !model.supportedGenerationMethods.includes('generateContent')) continue;
          const id = model.name.replace(/^models\//, '');
          results.push({ id, name: typeof model.displayName === 'string' ? model.displayName : id });
        }
        pageToken = typeof payload.nextPageToken === 'string' ? payload.nextPageToken : '';
        if (!pageToken) break;
      }
      models = results;
    } else {
      const baseUrl = typeof integration?.config.baseUrl === 'string'
        ? integration.config.baseUrl.replace(/\/+$/, '')
        : '';
      if (!baseUrl) {
        return NextResponse.json({ success: false, error: 'Base URL OpenAI-compatible belum diatur.' }, { status: 400 });
      }
      const endpoint = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        console.error('[AI models] OpenAI-compatible model listing failed:', response.status);
        const reason = await providerError(response, apiKey);
        return NextResponse.json({
          success: false,
          error: `Daftar model dari endpoint OpenAI-compatible gagal (${reason}).`,
        }, { status: 502 });
      }
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.data)) {
        return NextResponse.json({ success: false, error: 'Endpoint OpenAI-compatible tidak mengembalikan daftar model yang valid.' }, { status: 502 });
      }
      models = payload.data.flatMap((model): AvailableModel[] => {
        if (!isRecord(model) || typeof model.id !== 'string' || !model.id.trim()) return [];
        return [{ id: model.id, name: typeof model.name === 'string' ? model.name : model.id }];
      });
    }

    const uniqueModels = Array.from(new Map(models.map((model) => [model.id, model])).values())
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!uniqueModels.length) {
      return NextResponse.json({ success: false, error: 'Provider tidak melaporkan model yang tersedia.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, provider, configuredModel, models: uniqueModels });
  } catch (error) {
    console.error('[AI models] Failed to list available models:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal mengambil daftar model AI.' }, { status: 502 });
  }
}
