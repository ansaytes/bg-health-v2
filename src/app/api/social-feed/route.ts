import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   GET /api/social-feed
   Returns Instagram news + YouTube health talks
   YouTube: uses RSS feed (free, no API key needed)
   Instagram: curated content with link to real profile
   ═══════════════════════════════════════════════════════════════ */

interface FeedItem {
  id: string;
  title: string;
  caption: string;
  media_url: string;
  source: 'instagram' | 'youtube';
  published_at: string;
  video_url?: string;
  external_url?: string;
}

// Cache: store fetched data for 2 hours
let cachedNews: FeedItem[] | null = null;
let cachedTalks: FeedItem[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 7200_000; // 2 hours

function isCacheValid(): boolean {
  return cachedNews !== null && cachedTalks !== null && Date.now() - cacheTime < CACHE_DURATION;
}

// Curated fallback content about occupational health
const FALLBACK_NEWS: FeedItem[] = [
  {
    id: 'n1', title: 'Kemenkes Perketat Pengawasan Penyakit Menular di Lingkungan Kerja',
    caption: 'Kementerian Kesehatan meningkatkan pengawasan penyakit menular pasca lonjakan kasus di beberapa wilayah operasional perusahaan. Seluruh karyawan diwajibkan mematuhi protokol kesehatan yang telah ditetapkan.',
    media_url: '', source: 'instagram', published_at: '2026-08-16T08:00:00Z',
    external_url: 'https://www.instagram.com/bagongnews/',
  },
  {
    id: 'n2', title: 'Program Pemeriksaan Kesehatan Berkala Karyawan',
    caption: 'Pemeriksaan kesehatan berkala merupakan hak karyawan yang wajib dipenuhi perusahaan. Pastikan Anda mengikuti jadwal MCU tahunan di klinik site masing-masing.',
    media_url: '', source: 'instagram', published_at: '2026-08-12T10:30:00Z',
    external_url: 'https://www.instagram.com/bagongnews/',
  },
  {
    id: 'n3', title: 'Vaksinasi Booster untuk Kelompok Risiko Tinggi',
    caption: 'Vaksinasi booster direkomendasikan untuk karyawan yang bekerja di lingkungan berisiko tinggi. Koordinasikan jadwal vaksinasi dengan tim K3 dan klinik site Anda.',
    media_url: '', source: 'instagram', published_at: '2026-08-09T14:00:00Z',
    external_url: 'https://www.instagram.com/bagongnews/',
  },
  {
    id: 'n4', title: 'Layanan Telemedicine untuk Karyawan Remote Site',
    caption: 'Konsultasi dokter dari lokasi site kini lebih mudah diakses melalui layanan telemedicine perusahaan. Hubungi klinik site untuk informasi jadwal dan prosedur.',
    media_url: '', source: 'instagram', published_at: '2026-08-05T09:15:00Z',
    external_url: 'https://www.instagram.com/bagongnews/',
  },
  {
    id: 'n5', title: 'Sosialisasi Bulan K3 Nasional',
    caption: 'Bulan K3 nasional — seluruh site melaksanakan sosialisasi keselamatan dan kesehatan kerja. Catat partisipasi Anda dan dapatkan sertifikat pelatihan K3.',
    media_url: '', source: 'instagram', published_at: '2026-08-01T07:00:00Z',
    external_url: 'https://www.instagram.com/bagongnews/',
  },
];

const FALLBACK_TALKS: FeedItem[] = [
  {
    id: 't1', title: 'Mengenal Hipertensi: Penyebab, Gejala, dan Pencegahan',
    caption: 'Dr. Rina Sp.PD menjelaskan faktor risiko hipertensi pada pekerja industri berat dan cara pencegahannya melalui pola hidup sehat.',
    media_url: '', source: 'youtube', published_at: '2026-08-14T10:00:00Z',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
  },
  {
    id: 't2', title: 'Tips Menjaga Kesehatan Mental di Tempat Kerja',
    caption: 'Diskusi bersama psikolog industri tentang manajemen stres, work-life balance, dan pentingnya dukungan rekan kerja di lingkungan site.',
    media_url: '', source: 'youtube', published_at: '2026-08-08T11:00:00Z',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
  },
  {
    id: 't3', title: 'Ergonomi di Era Digital: Cara Duduk yang Benar',
    caption: 'Fisioterapis membahas postur kerja yang benar, pemanasan di tempat kerja, dan latihan peregangan selama istirahat.',
    media_url: '', source: 'youtube', published_at: '2026-08-02T09:00:00Z',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
  },
  {
    id: 't4', title: 'Manfaat Olahraga Ringan 15 Menit untuk Jantung',
    caption: 'Ahli jantung menjelaskan bagaimana 15 menit olahraga ringan setiap hari menurunkan risiko penyakit kardiovaskular hingga 30%.',
    media_url: '', source: 'youtube', published_at: '2026-07-25T08:30:00Z',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
  },
];

// Parse YouTube RSS XML feed into FeedItems
function parseYouTubeRSS(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  // Match each <entry> block
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const titleMatch = entry.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || entry.match(/<title>([\s\S]*?)<\/title>/);
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
    const mediaMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
    
    if (titleMatch) {
      items.push({
        id: `yt-${videoIdMatch?.[1] || items.length}`,
        title: titleMatch[1].trim().replace(/&amp;/g, '&').slice(0, 120),
        caption: '',
        media_url: mediaMatch?.[1] || '',
        source: 'youtube' as const,
        published_at: publishedMatch?.[1] || new Date().toISOString(),
        video_url: videoIdMatch ? `https://www.youtube.com/watch?v=${videoIdMatch[1]}` : 'https://www.youtube.com/@BagongNewsYoutube',
      });
    }
    if (items.length >= 6) break;
  }
  return items;
}

// Fetch real YouTube videos via RSS (no API key needed)
async function fetchYouTubeVideos(): Promise<FeedItem[]> {
  try {
    // YouTube RSS feed by channel handle
    const res = await fetch('https://www.youtube.com/feeds/videos.xml?handle=BagongNewsYoutube', {
      headers: { 'User-Agent': 'BG-Health/2.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    const xml = await res.text();
    const items = parseYouTubeRSS(xml);
    if (items.length > 0) return items;
    throw new Error('No items parsed');
  } catch {
    return [];
  }
}

// Fetch real Instagram page via page reader SDK (best effort)
async function fetchInstagramPosts(): Promise<FeedItem[]> {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', {
      url: 'https://www.instagram.com/bagongnews/',
    });
    if (!result?.data?.html) return [];
    
    const html = result.data.html;
    const items: FeedItem[] = [];
    
    // Try to extract from script tag with shared data
    const scriptMatch = html.match(/"edge_owner_to_timeline_media"\s*:\s*\{[\s\S]*?"edges"\s*:\s*\[([\s\S]*?)\]/);
    if (scriptMatch) {
      const nodeRegex = /"node"\s*:\s*\{([\s\S]*?)\}(?=,\s*"node"|$)/g;
      let nodeMatch;
      while ((nodeMatch = nodeRegex.exec(scriptMatch[1])) !== null && items.length < 6) {
        const node = nodeMatch[1];
        const titleMatch = node.match(/"title"\s*:\s*"([^"]*)"/);
        const captionMatch = node.match(/"text"\s*:\s*"([^"]*?)"/);
        const imgMatch = node.match(/"display_url"\s*:\s*"([^"]+)"/);
        const dateMatch = node.match(/"taken_at_timestamp"\s*:\s*(\d+)/);
        
        items.push({
          id: `ig-${items.length}`,
          title: titleMatch?.[1]?.replace(/&amp;/g, '&') || `Update @Bagongnews #${items.length + 1}`,
          caption: captionMatch?.[1]?.replace(/\n/g, ' ').replace(/&amp;/g, '&').slice(0, 300) || '',
          media_url: imgMatch?.[1] || '',
          source: 'instagram' as const,
          published_at: dateMatch ? new Date(parseInt(dateMatch[1]) * 1000).toISOString() : new Date().toISOString(),
          external_url: 'https://www.instagram.com/bagongnews/',
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET() {
  if (isCacheValid()) {
    return NextResponse.json({ news: cachedNews, healthTalks: cachedTalks });
  }

  // Fetch YouTube videos via RSS (reliable, free)
  const ytVideos = await fetchYouTubeVideos();
  const talkItems = ytVideos.length > 0 ? ytVideos : FALLBACK_TALKS;

  // Try Instagram (best effort, may be blocked)
  const igPosts = await fetchInstagramPosts();
  const newsItems = igPosts.length > 0 ? igPosts : FALLBACK_NEWS;

  cachedNews = newsItems;
  cachedTalks = talkItems;
  cacheTime = Date.now();

  return NextResponse.json({ news: newsItems, healthTalks: talkItems });
}
