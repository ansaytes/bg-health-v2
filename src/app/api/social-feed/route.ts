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
let cachedPodcasts: FeedItem[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 15 * 60 * 1000;

function isCacheValid(): boolean {
  return cachedNews !== null && cachedTalks !== null && cachedPodcasts !== null && Date.now() - cacheTime < CACHE_DURATION;
}

/**
 * Fetch YouTube videos from RSS (which guarantees correct publish dates and is much faster)
 */
async function fetchYouTubeVideos(): Promise<FeedItem[]> {
  try {
    const channelId = 'UCmwnNhvM3VomoVkAkjR5AoQ';
    const rssRes = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!rssRes.ok) return [];
    const xml = await rssRes.text();
    
    const items: FeedItem[] = [];
    const entries = xml.split('<entry>').slice(1);
    
    for (const entry of entries) {
      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const authorMatch = entry.match(/<name>([^<]+)<\/name>/);
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const mediaMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
      
      if (videoIdMatch && titleMatch && publishedMatch) {
        const videoId = videoIdMatch[1];
        items.push({
          id: `yt-${videoId}`,
          title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
          caption: authorMatch ? authorMatch[1] : 'Bagong News Youtube',
          media_url: mediaMatch ? mediaMatch[1] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          source: 'youtube' as const,
          published_at: publishedMatch[1],
          video_url: `https://www.youtube.com/watch?v=${videoId}`,
          external_url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }
    
    // Sort by published_at desc (newest first)
    items.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    
    return items;
  } catch (err) {
    console.error('YouTube RSS fetch failed:', err);
    return [];
  }
}

async function fetchInstagramPosts(): Promise<FeedItem[]> {
  try {
    const rssUrl = process.env.INSTAGRAM_RSS_URL || 'https://rss.app/feeds/OiXO4pjBV8QvcXke.xml';
    console.log(`[IG-RSS] Fetching Instagram RSS: ${rssUrl.substring(0, 50)}${rssUrl.length > 50 ? '...' : ''}`);

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BGHealthFeedBot/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });

    console.log(`[IG-RSS] HTTP response: status=${res.status} statusText="${res.statusText}" length=${res.headers.get('content-length') || '?'}`);

    if (!res.ok) {
      console.error(`[IG-RSS] GAGAL: HTTP ${res.status} ${res.statusText} — cek URL INSTAGRAM_RSS_URL di .env.local apakah masih aktif!`);
      return [];
    }

    const xml = await res.text();
    console.log(`[IG-RSS] Response body length: ${xml.length} chars`);

    // Validate: response harus mengandung XML RSS tag (bukan teks error halaman web biasa)
    const hasRssTag = /<rss[\s>]/i.test(xml) || /<channel[\s>]/i.test(xml);
    const hasAnyItemTag = /<item[\s>]/i.test(xml);

    if (!hasRssTag || !hasAnyItemTag) {
      // Preview 200 chars pertama untuk memberi petunjuk error ke developer
      const preview = xml.replace(/\s+/g, ' ').slice(0, 200);
      console.error(
        `[IG-RSS] GAGAL: Response BUKAN format RSS/XML yang valid! ` +
        `(<rss>=${hasRssTag}, <item>=${hasAnyItemTag}). ` +
        `Kemungkinan URL INSTAGRAM_RSS_URL sudah EXPIRED / feed provider (rss.app) perlu di-upgrade. ` +
        `Preview body: "${preview}"`
      );
      return [];
    }

    const posts: FeedItem[] = [];
    const items = xml.split(/<item[\s>]*>/i).slice(1);
    console.log(`[IG-RSS] Jumlah <item> tag ditemukan: ${items.length}`);

    for (const item of items) {
      // Coba beberapa variant regex untuk link, karena format beda-beda per provider RSS
      const linkMatch =
        item.match(/<link>([^<]+)<\/link>/) ||
        item.match(/<guid[^>]*>([^<]+)<\/guid>/i);
      // Coba beberapa variant regex untuk tanggal
      const pubDateMatch =
        item.match(/<pubDate>([^<]+)<\/pubDate>/i) ||
        item.match(/<dc:date>([^<]+)<\/dc:date>/i) ||
        item.match(/<published>([^<]+)<\/published>/i);
      // Coba beberapa variant regex untuk URL media (GAMBAR/VIDEO POST)
      const mediaMatch =
        item.match(/<media:content[^>]+url="([^"]+)"/i) ||
        item.match(/<media:thumbnail[^>]+url="([^"]+)"/i) ||
        item.match(/<enclosure[^>]+url="([^"]+)"/i) ||
        item.match(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/i);
      // Coba beberapa variant regex untuk CAPTION (description bisa CDATA atau plain, atau pakai content:encoded)
      const descMatch =
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        item.match(/<description>([\s\S]*?)<\/description>/) ||
        item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i) ||
        item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);

      if (linkMatch && pubDateMatch) {
        let caption = '';
        if (descMatch) {
          caption = descMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        if (/health\s*campaign/i.test(caption)) continue;

        const link = linkMatch[1].replace(/&amp;/g, '&');

        let publishedAt: string;
        try {
          publishedAt = new Date(pubDateMatch[1]).toISOString();
        } catch {
          publishedAt = new Date().toISOString();
        }

        let mediaUrl = mediaMatch ? mediaMatch[1] : '';
        if (mediaUrl) mediaUrl = mediaUrl.replace(/&amp;/g, '&');

        const title = caption.length > 80 ? caption.slice(0, 80) + '…' : caption || 'Postingan @Bagongnews';
        // Support semua format URL Instagram: /p/ (post foto), /reel/ (reels video), /tv/ (IGTV)
        const idMatch = link.match(/\/(?:p|reel|tv)\/([^/?#]+)/);
        const id = idMatch ? `ig-${idMatch[1]}` : `ig-${Math.random().toString(36).slice(2, 14)}`;

        posts.push({
          id,
          title,
          caption: caption.slice(0, 300),
          media_url: mediaUrl,
          source: 'instagram',
          published_at: publishedAt,
          external_url: link,
        });

        if (posts.length >= 12) break;
      }
    }

    console.log(`[IG-RSS] Berhasil di-parse: ${posts.length} posts`);
    return posts;
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.message?.includes('aborted')) {
      console.error(`[IG-RSS] GAGAL: TIMEOUT (>20 detik). Server RSS lambat atau URL tidak bisa diakses dari jaringan ini.`);
    } else {
      console.error(`[IG-RSS] GAGAL (exception): ${err?.name || 'Error'} - ${err?.message || String(err)}`);
    }
    return [];
  }
}

export async function GET() {
  if (isCacheValid() && cachedNews!.length > 0) {
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

  const igPosts = await fetchInstagramPosts();
  const news: FeedItem[] = igPosts.map(p => ({ ...p, type: 'news' as const }));

  if (news.length > 0) cachedNews = news;
  if (talks.length > 0) cachedTalks = talks;
  if (podcasts.length > 0) cachedPodcasts = podcasts;
  if (news.length > 0 && talks.length > 0) cacheTime = Date.now();

  return NextResponse.json({
    news: cachedNews || [],
    healthTalks: cachedTalks || [],
    podcasts: cachedPodcasts || [],
  });
}
