import { NextRequest, NextResponse } from 'next/server';
import {
  decryptIntegrationSecret,
  isIntegrationEncryptionKeyConfigured,
  readIntegration,
  writeIntegration,
} from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, SYSTEM_ROLES } from '@/lib/server-auth';
import {
  MAX_AI_PROFILES,
  loadAiProfilesPublic,
  saveAiProfiles,
  validateProfileInput,
} from '@/lib/ai-providers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  try {
    const [aiProfiles, driveRecord] = await Promise.all([
      loadAiProfilesPublic(),
      readIntegration('google_drive'),
    ]);
    const driveSecrets = decryptIntegrationSecret(driveRecord?.secret_ciphertext ?? null);
    return NextResponse.json({
      success: true,
      // Urutan daftar = urutan prioritas failover. API key TIDAK pernah dikirim ke browser.
      ai: { profiles: aiProfiles, maxProfiles: MAX_AI_PROFILES },
      drive: {
        folderId: typeof driveRecord?.config.folderId === 'string' ? driveRecord.config.folderId : '',
        connected: typeof driveSecrets.refreshToken === 'string' && driveSecrets.refreshToken.length > 0,
        accountEmail: typeof driveRecord?.config.accountEmail === 'string' ? driveRecord.config.accountEmail : '',
      },
      googleDriveOAuthConfigured: Boolean(
        process.env.GOOGLE_DRIVE_CLIENT_ID
        && process.env.GOOGLE_DRIVE_CLIENT_SECRET
        && process.env.GOOGLE_DRIVE_REDIRECT_URI,
      ),
      encryptionKeyConfigured: isIntegrationEncryptionKeyConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'INTEGRATION_SETTINGS_TABLE_MISSING') {
      return NextResponse.json({
        success: false,
        error: 'Tabel pengaturan integrasi belum tersedia di Supabase. Terapkan migrasi supabase/migrations/20261103090000_integration_settings.sql.',
      }, { status: 503 });
    }
    if (message.startsWith('INTEGRATION_SETTINGS_READ_FAILED:')) {
      return NextResponse.json({
        success: false,
        error: `Supabase gagal membaca pengaturan integrasi (${message.split(':')[1]}).`,
      }, { status: 500 });
    }
    console.error('[Integration settings] Load request failed:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal membaca pengaturan integrasi.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ success: false, error: 'Body tidak valid.' }, { status: 400 });
  if (body.ai !== undefined && !isIntegrationEncryptionKeyConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'API key belum dapat disimpan: INTEGRATION_ENCRYPTION_KEY belum diatur di Vercel sebagai 64 karakter hexadecimal (32 byte).',
    }, { status: 503 });
  }

  try {
    if (body.ai !== undefined) {
      if (!isRecord(body.ai) || !Array.isArray(body.ai.profiles)) {
        return NextResponse.json({ success: false, error: 'Pengaturan AI tidak valid.' }, { status: 400 });
      }
      if (body.ai.profiles.length > MAX_AI_PROFILES) {
        return NextResponse.json({ success: false, error: `Maksimal ${MAX_AI_PROFILES} AI.` }, { status: 400 });
      }
      const validated: Array<Extract<ReturnType<typeof validateProfileInput>, { profile: unknown }>> = [];
      for (let index = 0; index < body.ai.profiles.length; index += 1) {
        const result = validateProfileInput(body.ai.profiles[index], index);
        if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        validated.push(result);
      }
      await saveAiProfiles(validated, caller!.userId);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'INTEGRATION_SETTINGS_TABLE_MISSING') {
      return NextResponse.json({
        success: false,
        error: 'Tabel pengaturan integrasi belum tersedia di Supabase. Terapkan migrasi supabase/migrations/20261103090000_integration_settings.sql.',
      }, { status: 503 });
    }
    if (message.startsWith('INTEGRATION_SETTINGS_WRITE_FAILED:')) {
      return NextResponse.json({
        success: false,
        error: `Supabase menolak penyimpanan pengaturan integrasi (${message.split(':')[1]}). Periksa migrasi dan hak akses tabel.`,
      }, { status: 500 });
    }
    console.error('[Integration settings] Save request failed:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal menyimpan pengaturan integrasi.' }, { status: 500 });
  }
}
