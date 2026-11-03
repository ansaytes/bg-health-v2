import { NextRequest, NextResponse } from 'next/server';
import {
  decryptIntegrationSecret,
  integrationAdminClient,
  readIntegration,
  verifyIntegrationState,
  writeIntegration,
} from '@/lib/integration-settings';

const STATE_COOKIE = 'google-drive-oauth-state';

function redirectToSettings(status: string): NextResponse {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: `/?page=administrator&menu=pengaturan&drive=${encodeURIComponent(status)}` },
  });
  response.cookies.set(STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/integrations/google-drive/callback',
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state') || '';
  const [payload, signature, extra] = state.split('.');
  if (!payload || !signature || extra || request.cookies.get(STATE_COOKIE)?.value !== state
    || !verifyIntegrationState(payload, signature)) {
    return redirectToSettings('invalid_state');
  }

  let stateData: { userId?: string; expiresAt?: number };
  try {
    stateData = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return redirectToSettings('invalid_state');
  }
  if (typeof stateData.userId !== 'string' || typeof stateData.expiresAt !== 'number'
    || stateData.expiresAt < Date.now()) {
    return redirectToSettings('expired_state');
  }

  const code = request.nextUrl.searchParams.get('code');
  if (!code || request.nextUrl.searchParams.has('error')) return redirectToSettings('authorization_failed');

  try {
    const admin = integrationAdminClient();
    const [{ data: authResult, error: authError }, { data: profile, error: profileError }] = await Promise.all([
      admin.auth.admin.getUserById(stateData.userId),
      admin.from('user_profiles').select('role').eq('user_id', stateData.userId).maybeSingle(),
    ]);
    if (authError || !authResult.user || authResult.user.app_metadata?.approval_pending === true
      || profileError || profile?.role !== 'superuser') {
      return redirectToSettings('access_denied');
    }

    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || '';
    if (!clientId || !clientSecret || !redirectUri) return redirectToSettings('oauth_config_incomplete');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) return redirectToSettings('token_exchange_failed');
    const tokenData: unknown = await tokenResponse.json();
    if (!tokenData || typeof tokenData !== 'object' || !('access_token' in tokenData)
      || typeof tokenData.access_token !== 'string') {
      return redirectToSettings('token_exchange_failed');
    }

    const accountResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!accountResponse.ok) return redirectToSettings('account_lookup_failed');
    const accountData: unknown = await accountResponse.json();
    const accountEmail = accountData && typeof accountData === 'object'
      && 'user' in accountData && accountData.user && typeof accountData.user === 'object'
      && 'emailAddress' in accountData.user && typeof accountData.user.emailAddress === 'string'
      ? accountData.user.emailAddress : '';

    const existing = await readIntegration('google_drive');
    const secrets = decryptIntegrationSecret(existing?.secret_ciphertext ?? null);
    const receivedRefreshToken = 'refresh_token' in tokenData && typeof tokenData.refresh_token === 'string';
    const existingEmail = typeof existing?.config.accountEmail === 'string' ? existing.config.accountEmail : '';
    if (!receivedRefreshToken && existingEmail && accountEmail && existingEmail.toLowerCase() !== accountEmail.toLowerCase()) {
      return redirectToSettings('missing_refresh_token');
    }
    if (receivedRefreshToken) {
      secrets.refreshToken = tokenData.refresh_token;
    }
    if (!secrets.refreshToken) return redirectToSettings('missing_refresh_token');
    await writeIntegration({
      key: 'google_drive',
      config: { ...(existing?.config || {}), accountEmail },
      secrets,
      updatedBy: stateData.userId,
    });
    return redirectToSettings('connected');
  } catch {
    return redirectToSettings('connection_failed');
  }
}
