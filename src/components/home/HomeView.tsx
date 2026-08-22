'use client';

import { useState } from 'react';

type FeedCategory = 'semua-feed' | 'health-campaign' | 'health-talk' | 'news';

/* ── Placeholder Data ── */
interface FeedItem {
  id: string;
  caption: string;
  imageHint: string;
  source: string;
  date: string;
  type: 'campaign' | 'talk' | 'news';
  videoUrl?: string;
}

const CAMPAIGN_DATA: FeedItem[] = [
  { id: 'c1', caption: 'Cek kesehatan rutin bulan Agustus telah dimulai. Pastikan Anda memenuhi jadwal MCU.', imageHint: 'Health Check', source: 'Admin', date: '15 Agu 2026', type: 'campaign' },
  { id: 'c2', caption: 'Program vaksinasi influenza gratis untuk seluruh karyawan dan keluarga inti.', imageHint: 'Vaccination', source: 'Admin', date: '10 Agu 2026', type: 'campaign' },
  { id: 'c3', caption: 'Sosialisasi pencegahan demam berdarah di lingkungan kerja dan perumahan.', imageHint: 'Dengue Prevention', source: 'Admin', date: '5 Agu 2026', type: 'campaign' },
  { id: 'c4', caption: 'Senam pagi bersama setiap Jumat pukul 06.30 di area parkir utama.', imageHint: 'Morning Exercise', source: 'Admin', date: '1 Agu 2026', type: 'campaign' },
  { id: 'c5', caption: 'Konsultasi gizi gratis bersama ahli gizi dari RS Partners setiap bulan.', imageHint: 'Nutrition', source: 'Admin', date: '28 Jul 2026', type: 'campaign' },
];

const TALK_DATA: FeedItem[] = [
  { id: 't1', caption: 'Mengenal Hipertensi: Penyebab, Gejala, dan Pencegahan', imageHint: 'Hypertension Talk', source: 'Health Talk', date: '14 Agu 2026', type: 'talk', videoUrl: 'https://youtube.com/watch?v=example1' },
  { id: 't2', caption: 'Tips Menjaga Kesehatan Mental di Tempat Kerja', imageHint: 'Mental Health', source: 'Health Talk', date: '8 Agu 2026', type: 'talk', videoUrl: 'https://youtube.com/watch?v=example2' },
  { id: 't3', caption: 'Ergonomi di Era Digital: Cara Duduk yang Benar', imageHint: 'Ergonomics', source: 'Health Talk', date: '2 Agu 2026', type: 'talk', videoUrl: 'https://youtube.com/watch?v=example3' },
  { id: 't4', caption: 'Manfaat Olahraga Ringan 15 Menit Sehari untuk Jantung', imageHint: 'Exercise', source: 'Health Talk', date: '25 Jul 2026', type: 'talk', videoUrl: 'https://youtube.com/watch?v=example4' },
];

const NEWS_DATA: FeedItem[] = [
  { id: 'n1', caption: 'Kemenkes tingkatkan pengawasan penyakit menular pasca lonjakan kasus di beberapa wilayah.', imageHint: 'Health News', source: '@BagongNews', date: '16 Agu 2026', type: 'news' },
  { id: 'n2', caption: 'BPJS Kesehatan perpanjang program pemeriksaan gratis untuk peserta aktif.', imageHint: 'BPJS Update', source: '@BagongNews', date: '12 Agu 2026', type: 'news' },
  { id: 'n3', caption: 'WHO rekomendasikan vaksinasi booster untuk kelompok risiko tinggi menjelang musim hujan.', imageHint: 'WHO News', source: '@BagongNews', date: '9 Agu 2026', type: 'news' },
  { id: 'n4', caption: 'Inovasi telemedicine: Konsultasi dokter dari rumah kini lebih mudah diakses.', imageHint: 'Telemedicine', source: '@BagongNews', date: '5 Agu 2026', type: 'news' },
];

/* ── Gradient backgrounds for placeholder images ── */
const GRADIENTS = [
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
];

/* ── Feed Card Component ── */
function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const isVideo = item.type === 'talk';

  return (
    <div className="home-feed-card">
      {/* Image / Video Thumbnail */}
      <div className="home-feed-card-media" style={{ background: gradient }}>
        {isVideo && (
          <div className="home-feed-play-btn">
            <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        )}
        {!isVideo && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', lineHeight: 1.3 }}>
              {item.imageHint}
            </span>
          </div>
        )}
      </div>
      {/* Caption & Meta */}
      <div className="home-feed-card-body">
        <p className="home-feed-card-caption">{item.caption}</p>
        <p className="home-feed-card-meta">
          {item.source} &middot; {item.date}
        </p>
      </div>
    </div>
  );
}

/* ── Feed Section Component ── */
function FeedSection({
  title,
  data,
  defaultCount = 3,
}: {
  title: string;
  data: FeedItem[];
  defaultCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, defaultCount);
  const hasMore = data.length > defaultCount;

  return (
    <div className="home-feed-section">
      <div className="home-feed-section-head">
        <h3 className="home-feed-section-title">{title}</h3>
      </div>
      {visible.length > 0 ? (
        <div className="home-feed-grid">
          {visible.map((item, i) => (
            <FeedCard key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--fg-dim)', fontSize: 11 }}>
          Belum ada postingan.
        </div>
      )}
      {hasMore && (
        <button
          className="lihat-selengkapnya"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Tutup' : 'Lihat Selengkapnya'}
        </button>
      )}
    </div>
  );
}

/* ── Main Home View ── */
export default function HomeView({ activeTab }: { activeTab: FeedCategory }) {
  if (activeTab === 'semua-feed') {
    return (
      <div className="home-feed">
        <FeedSection title="News" data={NEWS_DATA} />
        <FeedSection title="Health Campaign" data={CAMPAIGN_DATA} />
        <FeedSection title="Health Talk" data={TALK_DATA} />
      </div>
    );
  }

  const config = {
    'health-campaign': { title: 'Health Campaign', data: CAMPAIGN_DATA },
    'health-talk': { title: 'Health Talk', data: TALK_DATA },
    'news': { title: 'News', data: NEWS_DATA },
  }[activeTab];

  return (
    <div className="home-feed">
      <FeedSection title={config.title} data={config.data} defaultCount={99} />
    </div>
  );
}
