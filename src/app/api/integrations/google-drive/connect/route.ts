import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { signIntegrationState } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, SYSTEM_ROLES } from '@/lib/server-auth';

const STATE_COOKIE = 'google-drive-oauth-state';

export async function POST(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || '';
  if (!clientId || !redirectUri) {
    return NextResponse.json({ success: false, error: 'OAuth Google Drive belum dikonfigurasi di server.' }, { status: 503 });
  }

  try {
    const statePayload = Buffer.from(JSON.stringify({
      userId: caller!.userId,
      nonce: crypto.randomBytes(24).toString('base64url'),
      expiresAt: Date.now() + 10 * 60 * 1000,
    })).toString('base64url');
    const state = `${statePayload}.${signIntegrationState(statePayload)}`;
    const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizeUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent select_account',
      include_granted_scopes: 'true',
      state,
    }).toString();

    const response = NextResponse.json({ success: true, url: authorizeUrl.toString() });
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/integrations/google-drive/callback',
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Gagal memulai koneksi Google Drive.' }, { status: 500 });
  }
}
