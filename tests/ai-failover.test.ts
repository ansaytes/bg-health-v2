import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiCallError,
  classifyFailure,
  extractJsonObject,
  resetAiCooldowns,
  runVisionWithFailover,
  type StoredAiProfile,
} from '@/lib/ai-providers';

const profile = (id: string, extra: Partial<StoredAiProfile> = {}): StoredAiProfile => ({
  id, name: `AI ${id}`, provider: 'gemini', baseUrl: '', model: 'm', enabled: true, apiKey: `key-${id}`, ...extra,
});
const request = { system: 's', userText: 'u', images: [] };
const parse = (text: string) => extractJsonObject(text);

describe('classifyFailure', () => {
  it('429 dan pesan kuota → quota', () => {
    expect(classifyFailure(429, '').kind).toBe('quota');
    expect(classifyFailure(402, 'Insufficient credits').kind).toBe('quota');
    expect(classifyFailure(403, 'You exceeded your current quota').kind).toBe('quota');
  });
  it('401 / API key salah → auth', () => {
    expect(classifyFailure(401, '').kind).toBe('auth');
    expect(classifyFailure(400, 'API key not valid. Please pass a valid API key.').kind).toBe('auth');
  });
  it('5xx → overloaded', () => {
    expect(classifyFailure(503, '').kind).toBe('overloaded');
  });
  it('membaca retryDelay Gemini', () => {
    expect(classifyFailure(429, '{"retryDelay":"37s"}').retryAfterSeconds).toBe(37);
  });
});

describe('runVisionWithFailover', () => {
  beforeEach(() => resetAiCooldowns());

  it('memakai AI pertama bila berhasil', async () => {
    const calls: string[] = [];
    const result = await runVisionWithFailover({
      profiles: [profile('a'), profile('b')], request, parse,
      caller: async (p) => { calls.push(p.id); return '{"hb":"14"}'; },
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['a']);
  });

  it('kuota AI pertama habis → otomatis lanjut ke AI kedua', async () => {
    const calls: string[] = [];
    const result = await runVisionWithFailover({
      profiles: [profile('a'), profile('b')], request, parse,
      caller: async (p) => {
        calls.push(p.id);
        if (p.id === 'a') throw new AiCallError('limit', 'quota', 429);
        return '{"hb":"14"}';
      },
    });
    expect(calls).toEqual(['a', 'b']);
    expect(result.ok && result.used.profileId).toBe('b');
    expect(result.attempts.map((a) => a.status)).toEqual(['failed', 'ok']);
  });

  it('profil yang baru gagal dilewati pada permintaan berikutnya', async () => {
    const calls: string[] = [];
    const caller = async (p: StoredAiProfile) => {
      calls.push(p.id);
      if (p.id === 'a') throw new AiCallError('limit', 'quota', 429);
      return '{"hb":"14"}';
    };
    await runVisionWithFailover({ profiles: [profile('a'), profile('b')], request, parse, caller });
    calls.length = 0;
    await runVisionWithFailover({ profiles: [profile('a'), profile('b')], request, parse, caller });
    expect(calls).toEqual(['b']);
  });

  it('balasan bukan JSON → lanjut ke AI berikutnya', async () => {
    const result = await runVisionWithFailover({
      profiles: [profile('a'), profile('b')], request, parse,
      caller: async (p) => (p.id === 'a' ? 'maaf saya tidak bisa' : '```json\n{"hb":"13"}\n```'),
    });
    expect(result.ok && result.value).toEqual({ hb: '13' });
  });

  it('semua kuota habis → allQuota', async () => {
    const result = await runVisionWithFailover({
      profiles: [profile('a'), profile('b')], request, parse,
      caller: async () => { throw new AiCallError('limit', 'quota', 429, 120); },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.allQuota).toBe(true);
      expect(result.retryAfterSeconds).toBe(120);
    }
  });

  it('profil nonaktif / tanpa key dilewati; tidak ada yang siap → noUsableProfile', async () => {
    const result = await runVisionWithFailover({
      profiles: [profile('a', { enabled: false }), profile('b', { apiKey: '' })], request, parse,
      caller: async () => '{}',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.noUsableProfile).toBe(true);
  });

  it('profil pilihan operator dicoba lebih dulu', async () => {
    const calls: string[] = [];
    await runVisionWithFailover({
      profiles: [profile('a'), profile('b')], preferredProfileId: 'b', request, parse,
      caller: async (p) => { calls.push(p.id); return '{}'; },
    });
    expect(calls[0]).toBe('b');
  });
});
