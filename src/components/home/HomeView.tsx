'use client';

import { useState, useEffect, useCallback } from 'react';

type FeedCategory = 'semua-feed' | 'health-campaign' | 'health-talk' | 'news';

/* ── Types ── */
interface FeedItem {
  id: string;
  caption: string;
  title?: string;
  imageHint?: string;
  image_url?: string;
  thumbnail_url?: string;
  media_url?: string;
  video_url?: string;
  external_url?: string;
  source: string;
  date: string;
  type: 'campaign' | 'talk' | 'news';
  views?: number;
  lengthSeconds?: number;
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

/* Format seconds to mm:ss or h:mm:ss */
function fmtDuration(secs: number): string {
  if (!secs || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

/* ── Feed Card Component ── */
function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const isVideo = item.type === 'talk';
  const isCampaign = item.type === 'campaign';
  const isYouTube = item.source === 'youtube' || item.type === 'talk';
  const thumbnail = item.media_url || item.thumbnail_url || item.image_url;
  const clickUrl = item.video_url || item.external_url || '';

  const handleClick = useCallback(() => {
    if (clickUrl) {
      window.open(clickUrl, '_blank', 'noopener,noreferrer');
    }
  }, [clickUrl]);

  return (
    <div
      className="home-feed-card"
      role={clickUrl ? 'button' : undefined}
      tabIndex={clickUrl ? 0 : undefined}
      onClick={clickUrl ? handleClick : undefined}
      onKeyDown={clickUrl ? (e) => { if (e.key === 'Enter') handleClick(); } : undefined}
      style={clickUrl ? { cursor: 'pointer' } : undefined}
    >
      <div
        className="home-feed-card-media"
        style={{
          background: thumbnail ? '#111' : gradient,
          aspectRatio: isYouTube ? '16 / 9' : undefined,
        }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={item.title || ''}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.opacity = '0';
            }}
          />
        ) : !isCampaign ? (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', lineHeight: 1.3 }}>
              {item.imageHint || '@BagongNews'}
            </span>
          </div>
        ) : null}
        {isVideo && (
          <div className="home-feed-play-btn">
            <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        )}
        {isCampaign && !thumbnail && (
          <div style={{ padding: 12, textAlign: 'center' }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
        {isVideo && item.lengthSeconds && item.lengthSeconds > 0 && (
          <span style={{
            position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.8)',
            color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
          }}>
            {fmtDuration(item.lengthSeconds)}
          </span>
        )}
      </div>
      <div className="home-feed-card-body">
        {item.title && (
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4, lineHeight: 1.3 }}>{item.title}</p>
        )}
        <p className="home-feed-card-caption">{item.caption}</p>
        <p className="home-feed-card-meta">
          {isCampaign ? 'Admin' : isVideo ? 'Health Talk' : '@BagongNews'}
          {item.views ? ` · ${item.views.toLocaleString('id-ID')} views` : ''}
          {' · '}{item.date}
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
  const remainingCount = data.length - defaultCount;

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
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-foreground)', fontSize: 11 }}>
          Belum ada postingan.
        </div>
      )}
      {hasMore && (
        <button
          className="lihat-selengkapnya"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Tutup' : `Lihat Selengkapnya (${remainingCount} lagi)`}
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
        // Fetch social feed (YouTube RSS)
        const socialRes = await fetch('/api/social-feed');
        if (socialRes.ok) {
          const socialJson = await socialRes.json();
          const news: FeedItem[] = (socialJson.news || []).map((p: any) => ({
            id: p.id,
            caption: p.caption,
            title: p.title,
            imageHint: 'News',
            media_url: p.media_url,
            video_url: p.video_url || p.external_url,
            external_url: p.external_url,
            source: p.source === 'youtube' ? 'youtube' : '@BagongNews',
            date: fmtDate(p.published_at),
            type: 'news' as const,
            views: p.views || 0,
          }));
          setNewsData(news);

          const talks: FeedItem[] = (socialJson.healthTalks || []).map((v: any) => ({
            id: v.id,
            caption: v.caption,
            title: v.title,
            media_url: v.media_url,
            video_url: v.video_url,
            external_url: v.external_url,
            source: 'youtube',
            date: fmtDate(v.published_at),
            type: 'talk' as const,
            views: v.views || 0,
            lengthSeconds: v.lengthSeconds || 0,
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
        // fallback to empty
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
