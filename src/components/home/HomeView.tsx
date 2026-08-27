'use client';

import { useState, useEffect } from 'react';

type FeedCategory = 'semua-feed' | 'health-campaign' | 'health-talk' | 'news';

/* ── Types ── */
interface FeedItem {
  id: string;
  caption: string;
  title?: string;
  imageHint?: string;
  image_url?: string;
  thumbnail_url?: string;
  video_url?: string;
  source: string;
  date: string;
  type: 'campaign' | 'talk' | 'news';
}

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

/* Format date for display */
function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/* ── Feed Card Component ── */
function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const isVideo = item.type === 'talk';
  const isCampaign = item.type === 'campaign';

  return (
    <div className="home-feed-card">
      {/* Image / Video Thumbnail */}
      <div className="home-feed-card-media" style={{ background: gradient }}>
        {isVideo && (
          <a
            href={item.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="home-feed-play-btn"
            style={{ textDecoration: 'none' }}
          >
            <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </a>
        )}
        {isCampaign && item.image_url && (
          <img
            src={item.image_url}
            alt={item.title || ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {!isVideo && !isCampaign && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', lineHeight: 1.3 }}>
              {item.imageHint || '@BagongNews'}
            </span>
          </div>
        )}
        {isCampaign && !item.image_url && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>
      {/* Caption & Meta */}
      <div className="home-feed-card-body">
        {item.title && (
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4, lineHeight: 1.3 }}>{item.title}</p>
        )}
        <p className="home-feed-card-caption">{item.caption}</p>
        <p className="home-feed-card-meta">
          {isCampaign ? 'Admin' : isVideo ? 'Health Talk' : '@BagongNews'} &middot; {item.date}
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
  const [newsData, setNewsData] = useState<FeedItem[]>([]);
  const [talkData, setTalkData] = useState<FeedItem[]>([]);
  const [campaignData, setCampaignData] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch social feed (Instagram + YouTube)
        const socialRes = await fetch('/api/social-feed');
        if (socialRes.ok) {
          const socialJson = await socialRes.json();
          const news: FeedItem[] = (socialJson.news || []).map((p: any) => ({
            id: p.id,
            caption: p.caption,
            title: p.title,
            imageHint: 'News',
            media_url: p.media_url,
            source: '@BagongNews',
            date: fmtDate(p.published_at),
            type: 'news' as const,
          }));
          setNewsData(news);

          const talks: FeedItem[] = (socialJson.healthTalks || []).map((v: any) => ({
            id: v.id,
            caption: v.caption,
            title: v.title,
            thumbnail_url: v.thumbnail_url,
            video_url: v.video_url,
            source: 'Health Talk',
            date: fmtDate(v.published_at),
            type: 'talk' as const,
          }));
          setTalkData(talks);
        }

        // Fetch health campaigns
        const campRes = await fetch('/api/health-campaigns');
        if (campRes.ok) {
          const campJson = await campRes.json();
          const campaigns: FeedItem[] = (campJson.campaigns || []).map((c: any) => ({
            id: c.id,
            caption: c.description || c.title,
            title: c.title,
            image_url: c.image_url,
            imageHint: 'Health Campaign',
            source: 'Admin',
            date: fmtDate(c.start_date || c.created_at),
            type: 'campaign' as const,
          }));
          setCampaignData(campaigns);
        }
      } catch {
        // fallback to empty — will show no data message
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="home-feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
          <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--foreground)', borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
          Memuat feed...
        </div>
      </div>
    );
  }

  if (activeTab === 'semua-feed') {
    return (
      <div className="home-feed">
        <FeedSection title="News" data={newsData} />
        <FeedSection title="Health Campaign" data={campaignData} />
        <FeedSection title="Health Talk" data={talkData} />
      </div>
    );
  }

  const config = {
    'health-campaign': { title: 'Health Campaign', data: campaignData },
    'health-talk': { title: 'Health Talk', data: talkData },
    'news': { title: 'News', data: newsData },
  }[activeTab];

  return (
    <div className="home-feed">
      <FeedSection title={config.title} data={config.data} defaultCount={99} />
    </div>
  );
}
