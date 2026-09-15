'use client';

import { useState, useRef, useEffect } from 'react';

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  imageUrl?: string;
  variant?: 'icon' | 'full';
  menuPosition?: 'top' | 'bottom';
}

type ShareTarget = 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'linkedin' | 'email' | 'copy';

const SHARE_OPTIONS: { target: ShareTarget; label: string; color: string; icon: React.ReactNode }[] = [
  { target: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.549 4.142 1.595 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> },
  { target: 'telegram', label: 'Telegram', color: '#0088cc', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.324-.437.89-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
  { target: 'facebook', label: 'Facebook', color: '#1877f2', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { target: 'twitter', label: 'X', color: '#000', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { target: 'linkedin', label: 'LinkedIn', color: '#0a66c2', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { target: 'email', label: 'Email', color: '#ea4335', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></svg> },
  { target: 'copy', label: 'Salin Link', color: '#6b7280', icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg> },
];

export default function ShareButton({ url, title = '', text = '', variant = 'icon', menuPosition = 'top' }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleShare = (target: ShareTarget, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const shareUrl = encodeURIComponent(url);
    const shareTitle = encodeURIComponent(title);
    const shareText = encodeURIComponent(text);
    let targetUrl = '';
    switch (target) {
      case 'whatsapp': targetUrl = `https://wa.me/?text=${shareText}%0A${shareUrl}`; break;
      case 'telegram': targetUrl = `https://t.me/share/url?url=${shareUrl}&text=${shareTitle}`; break;
      case 'facebook': targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`; break;
      case 'twitter': targetUrl = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`; break;
      case 'linkedin': targetUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`; break;
      case 'email': targetUrl = `mailto:?subject=${shareTitle}&body=${shareText}%0A%0A${shareUrl}`; break;
      case 'copy':
        navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
        return;
    }
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="share-btn-wrapper" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: '50%', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s, transform 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,77,0,0.1)'; e.currentTarget.style.color = '#ff4d00'; e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.transform = 'scale(1)'; }}
        aria-label="Bagikan"
      >
        <svg viewBox="0 0 24 24" width={variant === 'full' ? 16 : 18} height={variant === 'full' ? 16 : 18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {variant === 'full' && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600 }}>Bagikan</span>}
      </button>
      {isOpen && (
        <div className="share-btn-menu" style={{
          position: 'absolute',
          [menuPosition === 'bottom' ? 'top' : 'bottom']: 'calc(100% + 6px)',
          right: 0,
          minWidth: 200,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
          padding: 6,
          zIndex: 100000,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {SHARE_OPTIONS.map((opt) => (
            <button key={opt.target} onClick={(e) => handleShare(opt.target, e)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#1a1a1a', fontSize: 12, textAlign: 'left', transition: 'background 0.12s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,77,0,0.08)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color: opt.color, display: 'flex' }}>{opt.icon}</span>
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
            </button>
          ))}
          {copied && <div style={{ padding: '6px 10px', fontSize: 11, color: '#00B894', fontWeight: 600, textAlign: 'center' }}>✓ Link tersalin!</div>}
        </div>
      )}
    </div>
  );
}
