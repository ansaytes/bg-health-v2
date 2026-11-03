import { NextRequest, NextResponse } from 'next/server';
import { decryptIntegrationSecret, readIntegration, writeIntegration } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, SYSTEM_ROLES } from '@/lib/server-auth';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  try {
    const [aiRecord, driveRecord] = await Promise.all([
      readIntegration('ai'),
      readIntegration('google_drive'),
    ]);
    const aiSecrets = decryptIntegrationSecret(aiRecord?.secret_ciphertext ?? null);
    const driveSecrets = decryptIntegrationSecret(driveRecord?.secret_ciphertext ?? null);
    const aiProvider = aiRecord?.config.provider === 'openai-compatible' ? 'openai-compatible' : 'gemini';
    const databaseApiKey = typeof aiSecrets.apiKey === 'string' && aiSecrets.apiKey.length > 0;
    return NextResponse.json({
      success: true,
      ai: {
        provider: aiProvider,
        baseUrl: typeof aiRecord?.config.baseUrl === 'string' ? aiRecord.config.baseUrl : '',
        model: typeof aiRecord?.config.model === 'string' ? aiRecord.config.model : '',
        hasApiKey: databaseApiKey,
      },
      drive: {
        folderId: typeof driveRecord?.config.folderId === 'string' ? driveRecord.config.folderId : '',
        connected: typeof driveSecrets.refreshToken === 'string' && driveSecrets.refreshToken.length > 0,
        accountEmail: typeof driveRecord?.config.accountEmail === 'string' ? driveRecord.config.accountEmail : '',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal membaca pengaturan integrasi.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ success: false, error: 'Body tidak valid.' }, { status: 400 });

  try {
    if (body.ai !== undefined) {
      if (!isRecord(body.ai)) return NextResponse.json({ success: false, error: 'Pengaturan AI tidak valid.' }, { status: 400 });
      const { provider, baseUrl, model, apiKey, clearApiKey } = body.ai;
      if (provider !== 'gemini' && provider !== 'openai-compatible') {
        return NextResponse.json({ success: false, error: 'Provider AI tidak didukung.' }, { status: 400 });
      }
      if (typeof model !== 'string' || !model.trim() || model.length > 200) {
        return NextResponse.json({ success: false, error: 'Nama model wajib diisi dan maksimal 200 karakter.' }, { status: 400 });
      }
      const normalizedBaseUrl = provider === 'openai-compatible' ? normalizeBaseUrl(baseUrl) : '';
      if (provider === 'openai-compatible' && !normalizedBaseUrl) {
        return NextResponse.json({ success: false, error: 'URL endpoint harus berupa HTTP(S) tanpa kredensial, query, atau fragment.' }, { status: 400 });
      }
      if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 4096)) {
        return NextResponse.json({ success: false, error: 'API key tidak valid.' }, { status: 400 });
      }
      if (clearApiKey !== undefined && typeof clearApiKey !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Opsi penghapusan API key tidak valid.' }, { status: 400 });
      }
      const existing = await readIntegration('ai');
      const secrets = decryptIntegrationSecret(existing?.secret_ciphertext ?? null);
      if (clearApiKey === true) delete secrets.apiKey;
      else if (typeof apiKey === 'string' && apiKey.length > 0) secrets.apiKey = apiKey;
      await writeIntegration({
        key: 'ai',
        config: { provider, baseUrl: normalizedBaseUrl, model: model.trim() },
        secrets,
        updatedBy: caller!.userId,
      });
    }

    if (body.drive !== undefined) {
      if (!isRecord(body.drive)) return NextResponse.json({ success: false, error: 'Pengaturan Google Drive tidak valid.' }, { status: 400 });
      const folderId = body.drive.folderId;
      if (typeof folderId !== 'string' || folderId.length > 200 || /[/\\\s]/.test(folderId)) {
        return NextResponse.json({ success: false, error: 'Folder ID Google Drive tidak valid.' }, { status: 400 });
      }
      const existing = await readIntegration('google_drive');
      await writeIntegration({
        key: 'google_drive',
        config: { ...(existing?.config || {}), folderId: folderId.trim() },
        secrets: decryptIntegrationSecret(existing?.secret_ciphertext ?? null),
        updatedBy: caller!.userId,
      });
    }

    if (body.ai === undefined && body.drive === undefined) {
      return NextResponse.json({ success: false, error: 'Tidak ada pengaturan untuk disimpan.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal menyimpan pengaturan integrasi.' }, { status: 500 });
  }
}
