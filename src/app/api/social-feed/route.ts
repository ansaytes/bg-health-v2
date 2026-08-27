import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════
   GET /api/social-feed
   Returns mock Instagram news + YouTube health talks
   ═══════════════════════════════════════════════════════════════ */

interface InstagramPost {
  id: string;
  title: string;
  caption: string;
  media_url: string;
  source: 'instagram';
  published_at: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  caption: string;
  thumbnail_url: string;
  video_url: string;
  source: 'youtube';
  published_at: string;
}

/* Mock Instagram posts from @Bagongnews — occupational health & company news */
const INSTAGRAM_POSTS: InstagramPost[] = [
  {
    id: 'ig-1',
    title: 'Kemenkes Perketat Pengawasan Penyakit Menular',
    caption: 'Kementerian Kesehatan meningkatkan pengawasan penyakit menular pasca lonjakan kasus di beberapa wilayah operasional perusahaan. Seluruh karyawan diwajibkan mematuhi protokol kesehatan.',
    media_url: '',
    source: 'instagram',
    published_at: '2026-08-16T08:00:00Z',
  },
  {
    id: 'ig-2',
    title: 'BPJS Kesehatan Perpanjang Program Pemeriksaan Gratis',
    caption: 'BPJS Kesehatan memperpanjang program pemeriksaan kesehatan gratis untuk seluruh peserta aktif. Manfaatkan program ini untuk menjaga kesehatan Anda dan keluarga.',
    media_url: '',
    source: 'instagram',
    published_at: '2026-08-12T10:30:00Z',
  },
  {
    id: 'ig-3',
    title: 'Vaksinasi Booster WHO untuk Musim Hujan',
    caption: 'WHO merekomendasikan vaksinasi booster untuk kelompok risiko tinggi menjelang musim hujan. Koordinasikan jadwal vaksinasi dengan tim K3 site Anda.',
    media_url: '',
    source: 'instagram',
    published_at: '2026-08-09T14:00:00Z',
  },
  {
    id: 'ig-4',
    title: 'Inovasi Telemedicine untuk Karyawan',
    caption: 'Konsultasi dokter dari lokasi site kini lebih mudah diakses melalui layanan telemedicine. Hubungi klinik site untuk informasi lebih lanjut.',
    media_url: '',
    source: 'instagram',
    published_at: '2026-08-05T09:15:00Z',
  },
  {
    id: 'ig-5',
    title: 'Sosialisasi K3 Bulan Agustus',
    caption: 'Bulan K3 nasional — seluruh site melaksanakan sosialisasi keselamatan dan kesehatan kerja. Catat partisipasi Anda dalam program ini.',
    media_url: '',
    source: 'instagram',
    published_at: '2026-08-01T07:00:00Z',
  },
];

/* Mock YouTube videos from @BagongNewsYoutube — health talks */
const YOUTUBE_VIDEOS: YouTubeVideo[] = [
  {
    id: 'yt-1',
    title: 'Mengenal Hipertensi: Penyebab, Gejala, dan Pencegahan',
    caption: 'Dr. Rina Sp.PD menjelaskan faktor risiko hipertensi pada pekerja industri berat dan cara pencegahannya melalui pola hidup sehat.',
    thumbnail_url: '',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
    source: 'youtube',
    published_at: '2026-08-14T10:00:00Z',
  },
  {
    id: 'yt-2',
    title: 'Tips Menjaga Kesehatan Mental di Tempat Kerja',
    caption: 'Diskusi bersama psikolog industri tentang manajemen stres, work-life balance, dan pentingnya dukungan rekan kerja di lingkungan site terpencil.',
    thumbnail_url: '',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
    source: 'youtube',
    published_at: '2026-08-08T11:00:00Z',
  },
  {
    id: 'yt-3',
    title: 'Ergonomi di Era Digital: Cara Duduk yang Benar',
    caption: 'Fisioterapis membahas postur kerja yang benar, pemanasan di tempat kerja, dan latihan peregangan yang bisa dilakukan selama istirahat.',
    thumbnail_url: '',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
    source: 'youtube',
    published_at: '2026-08-02T09:00:00Z',
  },
  {
    id: 'yt-4',
    title: 'Manfaat Olahraga Ringan 15 Menit Sehari untuk Jantung',
    caption: 'Ahli jantung menjelaskan bagaimana 15 menit olahraga ringan setiap hari dapat menurunkan risiko penyakit kardiovaskular hingga 30%.',
    thumbnail_url: '',
    video_url: 'https://www.youtube.com/@BagongNewsYoutube',
    source: 'youtube',
    published_at: '2026-07-25T08:30:00Z',
  },
];

export async function GET() {
  return NextResponse.json({
    news: INSTAGRAM_POSTS,
    healthTalks: YOUTUBE_VIDEOS,
  });
}
