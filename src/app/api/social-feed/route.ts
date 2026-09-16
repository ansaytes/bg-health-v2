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
}

let cachedNews: FeedItem[] | null = null;
let cachedTalks: FeedItem[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 3600_000;

function isCacheValid(): boolean {
  return cachedNews !== null && cachedTalks !== null && Date.now() - cacheTime < CACHE_DURATION;
}

/**
 * Fetch YouTube RSS feed for real publish dates
 * RSS: https://www.youtube.com/feeds/videos.xml?channel_id=...
 * Fallback: scrape channel page for video IDs, use today's date as publish_at
 */
async function fetchYouTubeRSSData(): Promise<Record<string, { published_at: string }>> {
  try {
    // Try RSS feed first — gives accurate publish dates
    // Hardcoded channel ID for @BagongNewsYoutube
    const channelId = 'UCmwnNhvM3VomoVkAkjR5AoQ';
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!rssRes.ok) return {};
    const xml = await rssRes.text();
    // Parse <entry> blocks to extract videoId -> publishedAt mapping
    const result: Record<string, { published_at: string }> = {};
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const videoIdMatch = entry.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      if (videoIdMatch && publishedMatch) {
        result[videoIdMatch[1]] = { published_at: publishedMatch[1] };
      }
    }
    return result;
  } catch (err) {
    console.error('YouTube RSS fetch failed:', err);
    return {};
  }
}

/**
 * Scrape video IDs from YouTube channel page + fetch real publish dates via RSS
 */
async function fetchYouTubeVideos(): Promise<FeedItem[]> {
  try {
    // Parallel: scrape channel page + fetch RSS for publish dates
    const [videosRes, rssData] = await Promise.all([
      fetch(
        'https://www.youtube.com/@BagongNewsYoutube/videos',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(15000),
        }
      ),
      fetchYouTubeRSSData(),
    ]);

    if (!videosRes.ok) throw new Error(`YouTube page ${videosRes.status}`);
    const html = await videosRes.text();

    // Extract unique video IDs (preserve order — usually newest first on channel page)
    const videoIds = new Set<string>();
    const matches = html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
    for (const m of matches) {
      videoIds.add(m[1]);
    }

    if (videoIds.size === 0) throw new Error('No video IDs found');

    // Get metadata for each video via noembed (returns title, author, thumbnail)
    const items: FeedItem[] = [];
    const ids = Array.from(videoIds).slice(0, 15);

    for (const videoId of ids) {
      try {
        const metaRes = await fetch(
          `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (meta && meta.title) {
            // Use real publish date from RSS if available, otherwise use today
            const rssInfo = rssData[videoId];
            const publishedAt = rssInfo?.published_at || new Date().toISOString();

            items.push({
              id: `yt-${videoId}`,
              title: meta.title,
              caption: meta.author_name || 'Bagong News Youtube',
              media_url: meta.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              source: 'youtube' as const,
              published_at: publishedAt,
              video_url: `https://www.youtube.com/watch?v=${videoId}`,
              external_url: `https://www.youtube.com/watch?v=${videoId}`,
            });
          }
        }
      } catch {
        // Skip this video if noembed fails
      }
    }

    // Sort by published_at desc (newest first)
    items.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    if (items.length === 0) throw new Error('No metadata fetched');
    return items;
  } catch (err) {
    console.error('YouTube fetch failed:', err);
    return [];
  }
}

async function fetchInstagramPosts(): Promise<FeedItem[]> {
  try {
    const rssUrl = process.env.INSTAGRAM_RSS_URL || 'https://rss.app/feeds/OiXO4pjBV8QvcXke.xml';
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    
    const xml = await res.text();
    const posts: FeedItem[] = [];
    const items = xml.split('<item>').slice(1);
    
    for (const item of items) {
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
      const mediaMatch = item.match(/<media:content[^>]+url="([^"]+)"/);
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/);
      
      if (linkMatch && pubDateMatch) {
        const link = linkMatch[1];
        const publishedAt = new Date(pubDateMatch[1]).toISOString();
        const mediaUrl = mediaMatch ? mediaMatch[1] : '';
        
        let caption = '';
        if (descMatch) {
          caption = descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
        }
        
        const title = caption.slice(0, 80) || 'Postingan @Bagongnews';
        const idMatch = link.match(/\/p\/([^/]+)/);
        const id = idMatch ? `ig-${idMatch[1]}` : `ig-${Math.random().toString(36).slice(2)}`;
        
        posts.push({
          id,
          title,
          caption,
          media_url: mediaUrl,
          source: 'instagram',
          published_at: publishedAt,
          external_url: link,
        });
        
        if (posts.length >= 12) break;
      }
    }
    return posts;
  } catch (err) {
    console.error('Instagram RSS fetch failed:', err);
    return [];
  }
}

export async function GET() {
  if (isCacheValid() && cachedNews!.length > 0) {
    return NextResponse.json({ news: cachedNews, healthTalks: cachedTalks });
  }

  const allVideos = await fetchYouTubeVideos();
  const talks: FeedItem[] = [];
  for (const v of allVideos) {
    if (/HEALTH\s*TALK/i.test(v.title)) talks.push(v);
  }

  const igPosts = await fetchInstagramPosts();
  const ytNews = allVideos.filter(v => !/HEALTH\s*TALK/i.test(v.title));
  const news: FeedItem[] = igPosts.length > 0 ? igPosts : ytNews;

  if (news.length > 0) cachedNews = news;
  if (talks.length > 0) cachedTalks = talks;
  if (news.length > 0 && talks.length > 0) cacheTime = Date.now();

  return NextResponse.json({
    news: cachedNews || [],
    healthTalks: cachedTalks || [],
  });
}
