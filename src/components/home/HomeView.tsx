'use client';

import { useState, useEffect, useCallback } from 'react';
import ShareButton from '@/components/ui/share-button';

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
  publishedAt?: number; // unix timestamp for sorting
}

/* ── Neutral placeholder backgrounds (no pastel gradients) ── */
const PLACEHOLDER_BG = [
  { bg: 'var(--brand-navy)', label: 'BG-Health' },
  { bg: 'var(--brand-navy-soft)', label: 'News' },
  { bg: 'var(--muted-foreground)', label: 'Health Talk' },
  { bg: 'var(--brand-primary)', label: 'Campaign' },
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

/* ── Normalize image URLs ──
   Google Drive share links cannot be used directly as <img src>.
   Convert to a direct image URL. Returns null if input is empty/invalid. */
function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // Google Drive: /file/d/FILE_ID/...
  let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1000-h600-p-k-no-nu`;

  // Google Drive: open?id=FILE_ID
  m = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1000-h600-p-k-no-nu`;

  // Google Drive: uc?export=view&id=FILE_ID
  m = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1000-h600-p-k-no-nu`;

  return url;
}

/* Caption considered "long" if >120 chars or >2 lines — needs toggle */
const LONG_CAPTION_THRESHOLD = 120;

/* ── Feed Card Component ── */
function FeedCard({ item, index, onOpen }: { item: FeedItem; index: number; onOpen: (item: FeedItem) => void }) {
  const placeholder = PLACEHOLDER_BG[index % PLACEHOLDER_BG.length];
  const isVideo = item.type === 'talk' || (item.type === 'news' && (!!item.video_url || !!item.media_url));
  const isCampaign = item.type === 'campaign';
  const isYouTube = item.source === 'youtube' || item.type === 'talk';
  // Normalize the thumbnail URL (auto-converts Google Drive share links to direct image URLs)
  const thumbnail = normalizeImageUrl(item.media_url || item.thumbnail_url || item.image_url);
  const [imgError, setImgError] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const captionText = item.caption || '';
  const isCaptionLong = captionText.length > LONG_CAPTION_THRESHOLD || captionText.split('\n').length > 2;

  const showImage = !!thumbnail && !imgError;

  const handleClick = useCallback(() => {
    onOpen(item);
  }, [onOpen, item]);


  return (
    <div
      className="home-feed-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="home-feed-card-media"
        style={{
          background: showImage ? '#0a0b0e' : placeholder.bg,
          aspectRatio: '4 / 3',
        }}
      >
        {showImage ? (
          <img
            src={thumbnail}
            alt={item.title || ''}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
              {placeholder.label}
            </span>
          </div>
        )}
        {isVideo && showImage && (
          <div className="home-feed-play-btn">
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          </div>
        )}
        {isVideo && item.lengthSeconds && item.lengthSeconds > 0 && (
          <span style={{
            position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.85)',
            color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
          }}>
            {fmtDuration(item.lengthSeconds)}
          </span>
        )}
      </div>
      <div className="home-feed-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {item.title && (
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4, lineHeight: 1.3 }}>{item.title}</p>
        )}
        <p
          className="home-feed-card-caption"
          style={captionExpanded ? { WebkitLineClamp: 'unset', overflow: 'visible' } : undefined}
        >
          {captionText}
        </p>
        {isCaptionLong && (
          <button
            type="button"
            className="caption-toggle-btn"
            onClick={(e) => { e.stopPropagation(); setCaptionExpanded(v => !v); }}
            aria-expanded={captionExpanded}
          >
            {captionExpanded ? 'Tutup' : 'Baca Selengkapnya'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <p className="home-feed-card-meta" style={{ margin: 0 }}>
            {isCampaign ? 'Admin' : (isVideo || item.source === 'youtube') ? '@BagongNewsYoutube' : '@BagongNews'}
            {item.views ? ` · ${item.views.toLocaleString('id-ID')} views` : ''}
            {' · '}{item.date}
          </p>
          <ShareButton
            url={thumbnail || item.video_url || item.external_url || (typeof window !== 'undefined' ? window.location.href : '')}
            title={item.title || ''}
            text={item.caption || ''}
            imageUrl={thumbnail || undefined}
            variant="icon"
            menuPosition="top"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Feed Section Component ── */
function FeedSection({
  title,
  data,
  defaultCount = 3,
  onOpen,
}: {
  title: string;
  data: FeedItem[];
  defaultCount?: number;
  onOpen: (item: FeedItem) => void;
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
            <FeedCard key={item.id} item={item} index={i} onOpen={onOpen} />
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

/* ── Content Modal — Instagram-style for campaigns, full video for others ── */
function ContentModal({ item, onClose }: { item: FeedItem | null; onClose: () => void }) {
  if (!item) return null;
  const isVideo = item.type === 'talk' || (item.type === 'news' && (!!item.video_url || !!item.media_url));
  const isCampaign = item.type === 'campaign';
  const thumbnail = normalizeImageUrl(item.media_url || item.thumbnail_url || item.image_url);
  const videoUrl = item.video_url || item.external_url || '';
  const getYouTubeEmbed = (url: string): string | null => {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0` : null;
  };
  const embedUrl = isVideo ? getYouTubeEmbed(videoUrl) : null;

  // For campaigns: IG-style layout (image full + scrollable caption side/below)
  if (isCampaign) {
    return (
      <div className="content-modal-overlay" onClick={onClose}>
        <div className="content-modal ig-style" onClick={(e) => e.stopPropagation()}>
          <button className="content-modal-close" onClick={onClose} aria-label="Tutup">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
          <div className="ig-modal-inner">
            {/* Image section — full size, scrollable to view entire image */}
            <div className="ig-modal-image-section">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnail} alt={item.title || ''} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>Tidak ada gambar</div>
              )}
            </div>
            {/* Caption section — scrollable, IG-style */}
            <div className="ig-modal-caption-section">
              <div className="ig-modal-header">
                <div className="ig-modal-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/BM.png" alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
                </div>
                <div>
                  <div className="ig-modal-username">Admin</div>
                  <div className="ig-modal-date">{item.date}</div>
                </div>
              </div>
              <div className="ig-modal-caption-body">
                {item.title && <h3 className="ig-modal-title">{item.title}</h3>}
                <p className="ig-modal-caption">{item.caption}</p>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                  <ShareButton
                    url={thumbnail || (typeof window !== 'undefined' ? window.location.href : '')}
                    title={item.title || ''}
                    text={item.caption || ''}
                    imageUrl={thumbnail || undefined}
                    variant="icon"
                    menuPosition="bottom"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For videos (News + Health Talk): full-screen video player
  return (
    <div className="content-modal-overlay" onClick={onClose}>
      <div className="content-modal video-style" onClick={(e) => e.stopPropagation()}>
        <button className="content-modal-close" onClick={onClose} aria-label="Tutup">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
        <div className="video-modal-media">
          {isVideo && embedUrl ? (
            <iframe
              src={embedUrl}
              title={item.title || 'Video Player'}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : isVideo && videoUrl ? (
            <video src={videoUrl} controls autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }} />
          ) : thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)' }}>Tidak ada media</div>
          )}
        </div>
        <div className="video-modal-body">
          {item.title && <h3 className="content-modal-title">{item.title}</h3>}
          <p className="content-modal-caption">{item.caption}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
            <p className="content-modal-meta" style={{ margin: 0 }}>
              {(isVideo || item.source === 'youtube') ? '@BagongNewsYoutube' : '@BagongNews'}
              {item.views ? ` · ${item.views.toLocaleString('id-ID')} views` : ''}
              {' · '}{item.date}
            </p>
            <ShareButton
              url={item.video_url || item.external_url || (typeof window !== 'undefined' ? window.location.href : '')}
              title={item.title || ''}
              text={item.caption || ''}
              imageUrl={thumbnail || undefined}
              variant="full"
              menuPosition="top"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Home View ── */
export default function HomeView({ activeTab }: { activeTab: FeedCategory }) {
  const [newsData, setNewsData] = useState<FeedItem[]>([]);
  const [talkData, setTalkData] = useState<FeedItem[]>([]);
  const [campaignData, setCampaignData] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const handleOpenItem = useCallback((item: FeedItem) => setSelectedItem(item), []);
  const handleCloseItem = useCallback(() => setSelectedItem(null), []);

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
          news.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
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
          talks.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
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
          campaigns.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
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
          <div className="loading-spinner" style={{ margin: '0 auto 10px' }}>
            <img src="/BM.png" alt="Loading" />
          </div>
          Memuat feed...
        </div>
      </div>
    );
  }

  if (activeTab === 'semua-feed') {
    return (
      <div className="home-feed">
        <FeedSection title="Health Campaign" data={campaignData} onOpen={handleOpenItem} />
        <FeedSection title="Health Talk" data={talkData} onOpen={handleOpenItem} />
        <FeedSection title="News" data={newsData} onOpen={handleOpenItem} />
        <ContentModal item={selectedItem} onClose={handleCloseItem} />
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
      <FeedSection title={config.title} data={config.data} defaultCount={99} onOpen={handleOpenItem} />
      <ContentModal item={selectedItem} onClose={handleCloseItem} />
    </div>
  );
}
