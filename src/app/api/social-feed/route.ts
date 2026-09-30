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
    const rapidApiKey = process.env.RAPIDAPI_KEY || '8769028d1amsh51c797f7358a865p1fc02ejsn6f997537a39a';
    const username = 'bagongnews'; // atau ambil dari env jika diinginkan
    const url = `https://instagram-public-bulk-scraper.p.rapidapi.com/v1/user_posts?nocors=true&count=12&username_or_id=${username}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'instagram-public-bulk-scraper.p.rapidapi.com'
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 3600 }
    });
    
    if (!res.ok) return [];
    
    const json = await res.json();
    const posts: FeedItem[] = [];
    
    // API v1/user_posts langsung mengembalikan posts di json.data.edges
    const edges = json?.data?.edges || [];
    
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
      
      posts.push({
        id,
        title,
        caption: captionText.slice(0, 300),
        media_url: mediaUrl,
        source: 'instagram',
        published_at: publishedAt,
        external_url: link,
      });
      
      if (posts.length >= 12) break;
    }
    return posts;
  } catch (err) {
    console.error('Instagram API fetch failed:', err);
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
