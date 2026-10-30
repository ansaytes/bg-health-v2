import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

interface FeedItem {
  id: string;
  title: string;
  caption: string;
  media_url: string;
  source: 'instagram' | 'youtube';
  type?: 'news' | 'talk' | 'podcast';
  published_at: string;
  video_url?: string;
  external_url?: string;
  views?: number;
}

let cachedNews: FeedItem[] | null = null;
let cachedTalks: FeedItem[] | null = null;
let cachedPodcasts: FeedItem[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 jam (naik dari 15 menit)
const YOUTUBE_RSS_CHANNEL_ID = 'UCtTDlDNQNYH3jv97LD9cuJg';
const YOUTUBE_VIDEOS_PAGE_CHANNEL_ID = 'UCmwnNhvM3VomoVkAkjR5AoQ';

function isCacheValid(): boolean {
  return cachedNews !== null && cachedTalks !== null && cachedPodcasts !== null && Date.now() - cacheTime < CACHE_DURATION;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseInitialData(html: string): unknown | null {
  const marker = 'var ytInitialData = ';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = markerIndex + marker.length;
  const objectStart = html.indexOf('{', start);
  if (objectStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(objectStart, index + 1));
        } catch (error) {
          console.error('Failed to parse YouTube channel data:', error);
          return null;
        }
      }
    }
  }
  return null;
}

function findVideoId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoId(item);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;
  if (typeof record.videoId === 'string' && /^[\w-]{11}$/.test(record.videoId)) {
    return record.videoId;
  }
  for (const child of Object.values(record)) {
    const found = findVideoId(child);
    if (found) return found;
  }
  return null;
}

function collectYouTubeCards(value: unknown, cards: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    value.forEach(item => collectYouTubeCards(item, cards));
    return;
  }

  const record = asRecord(value);
  if (!record) return;
  const lockup = asRecord(record.lockupViewModel);
  if (lockup) cards.push(lockup);
  Object.values(record).forEach(child => collectYouTubeCards(child, cards));
}

function findThumbnailUrl(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findThumbnailUrl(item);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;
  if (typeof record.url === 'string' && /https?:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\//.test(record.url)) {
    return record.url;
  }
  for (const child of Object.values(record)) {
    const found = findThumbnailUrl(child);
    if (found) return found;
  }
  return null;
}

function findUploadAge(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUploadAge(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'string' && /\b\d+\s*(?:detik|menit|jam|hari|minggu|mgg|bulan|bln|tahun|thn|second|minute|hour|day|week|month|year)/i.test(value)) {
    return value;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const child of Object.values(record)) {
    const found = findUploadAge(child);
    if (found) return found;
  }
  return null;
}

function estimatePublishedAt(age: string | null): string {
  if (!age) return new Date().toISOString();
  const match = age.match(/(\d+)\s*(detik|menit|jam|hari|minggu|mgg|bulan|bln|tahun|thn|second|minute|hour|day|week|month|year)/i);
  if (!match) return new Date().toISOString();
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const days = /tahun|thn|year/.test(unit) ? amount * 365
    : /bulan|bln|month/.test(unit) ? amount * 30
      : /minggu|mgg|week/.test(unit) ? amount * 7
        : /hari|day/.test(unit) ? amount
          : /jam|hour/.test(unit) ? amount / 24
            : /menit|minute/.test(unit) ? amount / 1440
              : amount / 86400;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchYouTubeVideosFromChannelPage(): Promise<FeedItem[]> {
  const pageRes = await fetch(
    `https://www.youtube.com/channel/${YOUTUBE_VIDEOS_PAGE_CHANNEL_ID}/videos`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!pageRes.ok) {
    console.error('YouTube channel page request failed with status:', pageRes.status);
    return [];
  }

  const html = await pageRes.text();
  const data = parseInitialData(html);
  if (!data) {
    console.error('YouTube channel page did not contain valid initial data');
    return [];
  }

  const cards: Record<string, unknown>[] = [];
  collectYouTubeCards(data, cards);
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const card of cards) {
    const metadata = asRecord(asRecord(card.metadata)?.lockupMetadataViewModel);
    const title = asRecord(metadata?.title)?.content;
    const videoId = findVideoId(card);
    if (typeof title !== 'string' || !title.trim() || !videoId || seen.has(videoId)) continue;

    seen.add(videoId);
    const thumbnail = findThumbnailUrl(card);
    items.push({
      id: `yt-${videoId}`,
      title: title.trim(),
      caption: 'Bagong News',
      media_url: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: 'youtube',
      published_at: estimatePublishedAt(findUploadAge(metadata)),
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      external_url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return items;
}

/**
 * Fetch YouTube videos from RSS (which guarantees correct publish dates and is much faster)
 */
async function fetchYouTubeVideos(): Promise<FeedItem[]> {
  let rssItems: FeedItem[] = [];
  try {
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_RSS_CHANNEL_ID}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (rssRes.ok) {
      const contentType = rssRes.headers.get('content-type') || '';
      if (!contentType.includes('xml')) {
        console.error('YouTube RSS returned an unexpected content type:', contentType);
      } else {
        const xml = await rssRes.text();
        const entries = xml.split('<entry>').slice(1);
        for (const entry of entries) {
          const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          const authorMatch = entry.match(/<name>([^<]+)<\/name>/);
          const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
          const mediaMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
          if (!videoIdMatch || !titleMatch || !publishedMatch) continue;

          const videoId = videoIdMatch[1];
          rssItems.push({
            id: `yt-${videoId}`,
            title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
            caption: authorMatch ? authorMatch[1] : 'Bagong News Youtube',
            media_url: mediaMatch ? mediaMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            source: 'youtube',
            published_at: publishedMatch[1],
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            external_url: `https://www.youtube.com/watch?v=${videoId}`,
          });
        }
      }
    } else {
      console.error('YouTube RSS request failed with status:', rssRes.status);
    }
  } catch (err) {
    console.error('YouTube RSS fetch failed:', err);
  }

  if (rssItems.length > 0) return rssItems;
  try {
    const pageItems = await fetchYouTubeVideosFromChannelPage();
    if (pageItems.length > 0) return pageItems;
    console.error('No YouTube videos found in RSS or channel page');
  } catch (err) {
    console.error('YouTube channel page fallback failed:', err);
  }
  return [];
}

async function fetchInstagramPosts(): Promise<FeedItem[]> {
  // ── Method 1: RapidAPI Instagram Bulk Scraper (primary) ──
  const rapidApiKey = process.env.RAPIDAPI_KEY || '8769028d1amsh51c797f7358a865p1fc02ejsn6f997537a39a';
  const username = 'bagongnews';

  // Try primary RapidAPI endpoint with retry
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = `https://instagram-public-bulk-scraper.p.rapidapi.com/v1/user_posts?nocors=true&count=40&username_or_id=${username}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': rapidApiKey,
          'x-rapidapi-host': 'instagram-public-bulk-scraper.p.rapidapi.com'
        },
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 3600 }
      });

      if (res.ok) {
        const json = await res.json();
        const posts: FeedItem[] = [];
        const edges = json?.data?.edges || [];
        console.log(`[Instagram] Primary API returned ${edges.length} edges`);

        for (const edge of edges) {
          const node = edge.node;
          if (!node) continue;

          const captionNodes = node.edge_media_to_caption?.edges || [];
          const captionText = captionNodes.length > 0 ? captionNodes[0].node?.text || '' : '';

          // Filter out Health Campaign from IG
          if (/health\s*campaign/i.test(captionText)) continue;

          const id = `ig-${node.shortcode}`;
          const title = captionText.slice(0, 80) || 'Postingan @Bagongnews';
          const link = `https://www.instagram.com/p/${node.shortcode}/`;
          const publishedAt = new Date(node.taken_at_timestamp * 1000).toISOString();
          const mediaUrl = node.display_url || '';
          const videoUrl = node.is_video ? node.video_url : undefined;

          posts.push({
            id,
            title,
            caption: captionText.slice(0, 300),
            media_url: mediaUrl,
            video_url: videoUrl,
            source: 'instagram',
            published_at: publishedAt,
            external_url: link,
          });

          if (posts.length >= 20) break;
        }

        if (posts.length > 0) {
          console.log(`[Instagram] Primary API: ${posts.length} posts fetched`);
          return posts;
        }
        console.log('[Instagram] Primary API returned 0 posts after filtering');
      } else if (res.status === 429) {
        console.warn(`[Instagram] Primary API rate-limited (429), attempt ${attempt}/3`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
      } else {
        console.error(`[Instagram] Primary API failed with status: ${res.status}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    } catch (err) {
      console.error(`[Instagram] Primary API error on attempt ${attempt}:`, err);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  // ── Method 2: Alternative RapidAPI — Instagram Scraper (fallback) ──
  try {
    const altUrl = `https://instagram-scraper-api2.p.rapidapi.com/instagram/handle/${username}`;
    const res = await fetch(altUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com'
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 3600 }
    });

    if (res.ok) {
      const json = await res.json();
      const posts: FeedItem[] = [];
      // Alternate API may return data in different shapes
      const items = json?.data || json?.items || json?.media || [];
      console.log(`[Instagram] Fallback API returned ${items.length} items`);

      for (const node of items.slice(0, 20)) {
        const captionText = node.caption?.text || node.caption || node.description || '';
        if (/health\s*campaign/i.test(captionText)) continue;

        const shortcode = node.code || node.shortcode || node.slug || '';
        const id = shortcode ? `ig-${shortcode}` : `ig-fallback-${Date.now()}`;
        const title = captionText.slice(0, 80) || 'Postingan @Bagongnews';
        const link = shortcode ? `https://www.instagram.com/p/${shortcode}/` : `https://www.instagram.com/${username}/`;
        const publishedAt = node.date || node.timestamp ? new Date(node.date || node.timestamp * 1000).toISOString() : new Date().toISOString();
        const mediaUrl = node.thumbnail || node.display_url || node.media_url || node.image || '';
        const videoUrl = node.is_video ? (node.video_url || node.video) : undefined;

        posts.push({
          id,
          title,
          caption: captionText.slice(0, 300),
          media_url: mediaUrl,
          video_url: videoUrl,
          source: 'instagram',
          published_at: publishedAt,
          external_url: link,
        });
      }

      if (posts.length > 0) {
        console.log(`[Instagram] Fallback API: ${posts.length} posts fetched`);
        return posts;
      }
    } else {
      console.error(`[Instagram] Fallback API failed with status: ${res.status}`);
    }
  } catch (err) {
    console.error('[Instagram] Fallback API error:', err);
  }

  console.warn('[Instagram] All RapidAPI methods failed — will rely on database cache');
  return [];
}

async function getInstagramPostsFromDatabase(): Promise<FeedItem[]> {
  if (!supabaseAdmin) return [];
  try {
    // 1. Prioritas: Coba baca dari tabel `instagram_posts` jika ada
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from('instagram_posts')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(20);

    if (!tableError && tableData && tableData.length > 0) {
      return tableData.map((node: any) => ({
        id: node.id,
        title: node.title,
        caption: node.caption || '',
        media_url: node.media_url || '',
        video_url: node.video_url || undefined,
        source: 'instagram',
        published_at: node.published_at,
        external_url: node.external_url || 'https://www.instagram.com/bagongnews/',
      }));
    }

    // 2. Fallback: Baca dari `app_settings` (key 'instagram_feed')
    const { data: setting, error: settingError } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'instagram_feed')
      .single();

    if (!settingError && setting?.value?.posts && Array.isArray(setting.value.posts) && setting.value.posts.length > 0) {
      return setting.value.posts;
    }
  } catch (err) {
    console.error('[Instagram] Error reading from Supabase:', err);
  }
  return [];
}

async function saveInstagramPostsToDatabase(posts: FeedItem[]): Promise<void> {
  if (!supabaseAdmin || posts.length === 0) return;
  
  // 1. Coba simpan ke tabel instagram_posts
  try {
    await supabaseAdmin.from('instagram_posts').upsert(
      posts.map(p => ({
        id: p.id,
        title: p.title,
        caption: p.caption,
        media_url: p.media_url,
        video_url: p.video_url || null,
        external_url: p.external_url || 'https://www.instagram.com/bagongnews/',
        source: 'instagram',
        published_at: p.published_at,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'id' }
    );
  } catch {
    // Abaikan bila tabel belum dibuat di SQL editor
  }

  // 2. Simpan juga ke app_settings agar selalu ada backup
  try {
    await supabaseAdmin.from('app_settings').upsert({
      key: 'instagram_feed',
      value: {
        posts,
        updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (err) {
    console.error('[Instagram] Error updating app_settings fallback:', err);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRevalidate = searchParams.get('revalidate') === '1';
  const forceSync = searchParams.get('sync') === '1';

  if (!forceRevalidate && !forceSync && isCacheValid()) {
    return NextResponse.json({ news: cachedNews, healthTalks: cachedTalks, podcasts: cachedPodcasts });
  }

  const allVideos = await fetchYouTubeVideos();
  const talks: FeedItem[] = [];
  const podcasts: FeedItem[] = [];
  
  for (const v of allVideos) {
    if (/HEALTH\s*TALK/i.test(v.title)) {
      talks.push({ ...v, type: 'talk' as const });
    } else {
      podcasts.push({ ...v, type: 'podcast' as const });
    }
  }

  // 1. Ambil data dari database Supabase (0 kuota RapidAPI, cepat dan stabil)
  let igPosts = await getInstagramPostsFromDatabase();

  // 2. Hanya panggil RapidAPI jika database benar-benar kosong ATAU user memicu ?sync=1
  if (igPosts.length === 0 || forceSync) {
    const freshPosts = await fetchInstagramPosts();
    if (freshPosts.length > 0) {
      igPosts = freshPosts;
      await saveInstagramPostsToDatabase(freshPosts);
    }
  }

  const news: FeedItem[] = igPosts.map(p => ({ ...p, type: 'news' as const }));

  // Jaga cache agar tidak tertimpa array kosong bila fetch gagal
  if (news.length > 0 || cachedNews === null) {
    cachedNews = news;
  }
  if (talks.length > 0 || cachedTalks === null) {
    cachedTalks = talks;
  }
  if (podcasts.length > 0 || cachedPodcasts === null) {
    cachedPodcasts = podcasts;
  }
  cacheTime = Date.now();

  return NextResponse.json({
    news: cachedNews || [],
    healthTalks: cachedTalks || [],
    podcasts: cachedPodcasts || [],
  });
}
