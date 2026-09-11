import { NextResponse } from 'next/server';

interface FeedItem {
  id: string;
  title: string;
  caption: string;
  media_url: string;
  source: 'instagram' | 'youtube';
  published_at: string;
  video_url?: string;
  external_url?: string;
  views?: number;
  lengthSeconds?: number;
}

let cachedNews: FeedItem[] | null = null;
let cachedTalks: FeedItem[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 3600_000;

function isCacheValid(): boolean {
  return cachedNews !== null && cachedTalks !== null && Date.now() - cacheTime < CACHE_DURATION;
}

function parseYouTubeRSS(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
    const videoId = videoIdMatch?.[1]?.trim();
    if (!videoId) continue;
    const titleMatch = entry.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const title = titleMatch?.[1]?.trim().replace(/&amp;/g, '&') || '';
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
    const thumbMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    const thumbnail = thumbMatch?.[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const descMatch = entry.match(/<media:description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/media:description>/);
    const desc = descMatch?.[1]?.trim().replace(/\n/g, ' ').slice(0, 300) || '';
    const viewsMatch = entry.match(/<media:statistics[^>]+views="(\d+)"/);
    const views = viewsMatch ? parseInt(viewsMatch[1]) : 0;
    items.push({
      id: `yt-${videoId}`, title, caption: desc, media_url: thumbnail,
      source: 'youtube' as const,
      published_at: publishedMatch?.[1]?.trim() || new Date().toISOString(),
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      external_url: `https://www.youtube.com/watch?v=${videoId}`, views,
    });
    if (items.length >= 15) break;
  }
  return items;
}

async function fetchYouTubeRSS(): Promise<FeedItem[]> {
  try {
    // YouTube RSS URL yang benar: /xml/feeds/videos.xml (bukan /feeds/videos.xml)
    const res = await fetch(
      'https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCmwnNhvM3VomoVkAkjR5AoQ',
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (BG-Health/2.0)' },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const xml = await res.text();
    if (!xml || xml.length < 50) throw new Error('Empty XML');
    const items = parseYouTubeRSS(xml);
    if (items.length === 0) throw new Error('No items parsed');
    return items;
  } catch (err) {
    console.error('YouTube RSS failed:', err);
    return [];
  }
}

async function fetchInstagramPosts(): Promise<FeedItem[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return [];
  try {
    const url = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=12&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const json = await res.json();
    const posts: FeedItem[] = [];
    for (const p of json.data || []) {
      const isVideo = p.media_type === 'VIDEO' || p.media_type === 'CAROUSEL_ALBUM';
      const caption = (p.caption || '').replace(/\n/g, ' ').slice(0, 300);
      posts.push({
        id: `ig-${p.id}`, title: caption.slice(0, 80) || 'Postingan @Bagongnews',
        caption, media_url: isVideo ? (p.thumbnail_url || '') : (p.media_url || ''),
        source: 'instagram' as const,
        published_at: p.timestamp || new Date().toISOString(),
        video_url: isVideo ? (p.media_url || '') : undefined,
        external_url: p.permalink || 'https://www.instagram.com/bagongnews/',
      });
      if (posts.length >= 12) break;
    }
    return posts;
  } catch (err) {
    console.error('Instagram fetch failed:', err);
    return [];
  }
}

export async function GET() {
  // Only use cache if it contains ACTUAL data (not empty)
  if (isCacheValid() && cachedNews!.length > 0) {
    return NextResponse.json({ news: cachedNews, healthTalks: cachedTalks });
  }

  const allVideos = await fetchYouTubeRSS();
  const talks: FeedItem[] = [];
  for (const v of allVideos) {
    if (/HEALTH\s*TALK/i.test(v.title)) talks.push(v);
  }

  const igPosts = await fetchInstagramPosts();
  const ytNews = allVideos.filter(v => !/HEALTH\s*TALK/i.test(v.title));
  const news: FeedItem[] = igPosts.length > 0 ? igPosts : ytNews;

  // ONLY cache if we have real data — don't cache empty results
  if (news.length > 0) cachedNews = news;
  if (talks.length > 0) cachedTalks = talks;
  if (news.length > 0 && talks.length > 0) cacheTime = Date.now();

  // Return real data or empty arrays — NO MOCK FALLBACK
  return NextResponse.json({
    news: cachedNews || [],
    healthTalks: cachedTalks || [],
  });
}
