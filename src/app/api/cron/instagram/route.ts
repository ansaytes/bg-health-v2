import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runInstagramFeedSync } from '@/app/api/social-feed/route';

export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get('authorization') ?? '');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const postsSaved = await runInstagramFeedSync();
    return NextResponse.json({ ok: true, postsSaved });
  } catch (error) {
    console.error('[Instagram] Cron sync failed:', error);
    return NextResponse.json({ error: 'Instagram sync failed; check server logs' }, { status: 502 });
  }
}
