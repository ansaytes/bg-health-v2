import { NextRequest, NextResponse } from 'next/server';
import { getServerCaller, requireServerRole, STAFF_ROLES, SYSTEM_ROLES } from '@/lib/server-auth';
import {
  ModelListError,
  listVisionModels,
  loadAiProfiles,
  loadAiProfilesPublic,
  normalizeBaseUrl,
  type AiProviderKind,
} from '@/lib/ai-providers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Daftar AI yang siap dipakai untuk ekstraksi MCU (tanpa API key), dalam urutan
 * prioritas. Dipakai halaman Review MCU untuk memilih AI yang dicoba lebih
 * dulu; sisanya tetap menjadi cadangan otomatis.
 */
export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  try {
    const profiles = (await loadAiProfilesPublic())
      .filter((profile) => profile.enabled && profile.hasApiKey && profile.model)
      .map(({ id, name, provider, model }) => ({ id, name, provider, model }));
    return NextResponse.json({ success: true, profiles });
  } catch (error) {
    console.error('[AI profiles] Load failed:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal membaca daftar AI.' }, { status: 500 });
  }
}

/**
 * Daftar model yang bisa MEMBACA GAMBAR untuk satu AI.
 *
 * Dipanggil dari Pengaturan > Integrasi (khusus admin sistem) dan memakai POST
 * karena membawa API key yang baru diketik. Bila `apiKey` kosong tetapi
 * `profileId` dikirim, key tersimpan milik profil itu yang dipakai — key tidak
 * pernah dikirim balik ke browser.
 */
export async function POST(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, SYSTEM_ROLES);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ success: false, error: 'Body tidak valid.' }, { status: 400 });

  const provider = body.provider;
  if (provider !== 'gemini' && provider !== 'openai-compatible' && provider !== 'anthropic') {
    return NextResponse.json({ success: false, error: 'Provider AI tidak didukung.' }, { status: 400 });
  }

  let baseUrl = '';
  if (provider === 'openai-compatible') {
    const normalized = normalizeBaseUrl(body.baseUrl);
    if (!normalized) return NextResponse.json({ success: false, error: 'Base URL harus HTTP(S) tanpa kredensial, query, atau fragment.' }, { status: 400 });
    baseUrl = normalized;
  } else if (provider === 'anthropic') {
    const hasUrl = typeof body.baseUrl === 'string' && body.baseUrl.trim() !== '';
    const normalized = hasUrl ? normalizeBaseUrl(body.baseUrl) : 'https://api.anthropic.com';
    if (!normalized) return NextResponse.json({ success: false, error: 'Base URL tidak valid.' }, { status: 400 });
    baseUrl = normalized;
  }

  let apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (apiKey.length > 4096 || /[\s\u0000-\u001f]/.test(apiKey)) {
    return NextResponse.json({ success: false, error: 'API key tidak valid.' }, { status: 400 });
  }

  try {
    if (!apiKey && typeof body.profileId === 'string') {
      const stored = (await loadAiProfiles()).find((profile) => profile.id === body.profileId);
      // Key tersimpan hanya dipakai bila provider yang diminta sama dengan
      // profilnya, supaya key tidak bisa dikirim ke endpoint lain.
      if (stored && stored.provider === provider && (provider === 'gemini' || stored.baseUrl === baseUrl || provider === 'anthropic')) {
        apiKey = stored.apiKey;
      }
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Isi API key terlebih dahulu.' }, { status: 400 });
    }

    const models = await listVisionModels(provider as AiProviderKind, baseUrl, apiKey);
    if (!models.length) {
      return NextResponse.json({
        success: false,
        error: 'Provider tidak melaporkan model yang dapat membaca gambar. Ekstraksi MCU membutuhkan model multimodal (mis. Gemini, GPT-4o, atau Claude).',
      }, { status: 404 });
    }
    return NextResponse.json({ success: true, provider, models });
  } catch (error) {
    if (error instanceof ModelListError) {
      return NextResponse.json({ success: false, error: `Daftar model gagal (${error.message}). Periksa API key, akses, dan kuota.` }, { status: 502 });
    }
    console.error('[AI models] Failed to list available models:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ success: false, error: 'Gagal mengambil daftar model AI.' }, { status: 502 });
  }
}
