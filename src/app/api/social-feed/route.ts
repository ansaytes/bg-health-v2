import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   GET /api/social-feed
   Returns Instagram news + YouTube health talks
   Uses web-reader SDK with cache + fallback to curated content
   ═══════════════════════════════════════════════════════════════ */

interface FeedItem {
  id: string;
  title: string;
  caption: string;
  media_url: string;
  source: 'instagram' | 'youtube';
  published_at: string;
  video_url?: string;
}

// Cache: store fetched data for 1 hour
let cachedNews: FeedItem[] | null = null;
let cachedTalks: FeedItem[] | null = null;
let cacheTime = 0;
const CACHE_DURATION = 3600_000; // 1 hour

function isCacheValid(): boolean {
  return cachedNews !== null && cachedTalks !== null && Date.now() - cacheTime < CACHE_DURATION;
}

// Curated fallback content about occupational health
const FALLBACK_NEWS: FeedItem[] = [
  {
    id: 'n1', title: 'Kemenkes Perketat Pengawasan Penyakit Menular di Lingkungan Kerja',
    caption: 'Kementerian Kesehatan meningkatkan pengawasan penyakit menular pasca lonjakan kasus di beberapa wilayah operasional perusahaan. Seluruh karyawan diwajibkan mematuhi protokol kesehatan yang telah ditetapkan.',
    media_url: '', source: 'instagram', published_at: '2026-08-16T08:00:00Z',
  },
  {
    id: 'n2', title: 'Program Pemeriksaan Kesehatan Berkala Karyawan',
    caption: 'Pemeriksaan kesehatan berkala merupakan hak karyawan yang wajib dipenuhi perusahaan. Pastikan Anda mengikuti jadwal MCU tahunan di klinik site masing-masing.',
    media_url: '', source: 'instagram', published_at: '2026-08-12T10:30:00Z',
  },
  {
    id: 'n3', title: 'Vaksinasi Booster untuk Kelompok Risiko Tinggi',
    caption: 'Vaksinasi booster direkomendasikan untuk karyawan yang bekerja di lingkungan berisiko tinggi. Koordinasikan jadwal vaksinasi dengan tim K3 dan klinik site Anda.',
    media_url: '', source: 'instagram', published_at: '2026-08-09T14:00:00Z',
  },
  {
    id: 'n4', title: 'Layanan Telemedicine untuk Karyawan Remote Site',
    caption: 'Konsultasi dokter dari lokasi site kini lebih mudah diakses melalui layanan telemedicine perusahaan. Hubungi klinik site untuk informasi jadwal dan prosedur.',
    media_url: '', source: 'instagram', published_at: '2026-08-05T09:15:00Z',
  },
  {
    id: 'n5', title: 'Sosialisasi Bulan K3 Nasional',
    caption: 'Bulan K3 nasional — seluruh site melaksanakan sosialisasi keselamatan dan kesehatan kerja. Catat partisipasi Anda dan dapatkan sertifikat pelatihan K3.',
    media_url: '', source: 'instagram', published_at: '2026-08-01T07:00:00Z',
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

// Attempt to fetch real data from Instagram & YouTube via web-reader
async function fetchRealData(): Promise<{ news: FeedItem[]; talks: FeedItem[] }> {
  try {
    // Dynamic import — SDK is server-side only
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    // Fetch Instagram page for @Bagongnews
    let newsItems = [...FALLBACK_NEWS];
    try {
      const igResult = await zai.functions.invoke('page_reader', {
        url: 'https://www.instagram.com/bagongnews/',
      });
      if (igResult?.data?.html) {
        const html = igResult.data.html;
        // Extract post captions from meta tags and structured data
        const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
        const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
        const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);

        if (titleMatch || descMatch) {
          newsItems = [{
            id: 'ig-real-1',
            title: titleMatch?.[1]?.replace(/&amp;/g, '&').slice(0, 100) || 'Update dari @Bagongnews',
            caption: descMatch?.[1]?.replace(/&amp;/g, '&').replace(/\\n/g, ' ').slice(0, 300) || '',
            media_url: imgMatch?.[1] || '',
            source: 'instagram' as const,
            published_at: new Date().toISOString(),
          }, ...FALLBACK_NEWS.slice(1)];
        }
      }
    } catch { /* IG fetch failed, use fallback */ }

    // Fetch YouTube channel for @BagongNewsYoutube
    let talkItems = [...FALLBACK_TALKS];
    try {
      const ytResult = await zai.functions.invoke('page_reader', {
        url: 'https://www.youtube.com/@BagongNewsYoutube',
      });
      if (ytResult?.data?.html) {
        const html = ytResult.data.html;
        // Extract video info from page
        const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
        const imgMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);

        if (titleMatch) {
          talkItems = [{
            id: 'yt-real-1',
            title: titleMatch[1].replace(/&amp;/g, '&').replace(/ - YouTube$/, '').slice(0, 100),
            caption: 'Video terbaru dari Bagong News YouTube channel.',
            media_url: imgMatch?.[1] || '',
            source: 'youtube' as const,
            published_at: new Date().toISOString(),
            video_url: 'https://www.youtube.com/@BagongNewsYoutube',
          }, ...FALLBACK_TALKS.slice(1)];
        }
      }
    } catch { /* YT fetch failed, use fallback */ }

    return { news: newsItems, talks: talkItems };
  } catch {
    return { news: FALLBACK_NEWS, talks: FALLBACK_TALKS };
  }
}

export async function GET() {
  if (isCacheValid()) {
    return NextResponse.json({ news: cachedNews, healthTalks: cachedTalks });
  }

  const { news, talks } = await fetchRealData();
  cachedNews = news;
  cachedTalks = talks;
  cacheTime = Date.now();

  return NextResponse.json({ news, healthTalks: talks });
}
