'use client';
/** SVG stick-figure posture diagrams for RULA / ROSA / WERA score options. */
import type { CSSProperties, ReactNode } from 'react';

const base: CSSProperties = { width: 56, height: 56, flexShrink: 0 };
const S = { stroke: 'var(--foreground, #1a1a1a)', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
const A = { stroke: 'var(--brand-primary, #ff4d00)', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

function Svg({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={56} height={56} style={base} aria-hidden={!title}>
      {title && <title>{title}</title>}
      <rect width="64" height="64" rx="8" fill="var(--muted, #f1f5f9)" />
      {children}
    </svg>
  );
}

function Person({ armDeg = 20 }: { armDeg?: number }) {
  const r = (armDeg * Math.PI) / 180;
  const ax = 32 + Math.sin(r) * 14;
  const ay = 28 - Math.cos(r) * 14;
  return (
    <>
      <circle cx="32" cy="14" r="5" {...S} />
      <line x1="32" y1="19" x2="32" y2="38" {...S} />
      <line x1="32" y1="24" x2={ax} y2={ay} {...A} />
      <line x1="32" y1="38" x2="24" y2="54" {...S} />
      <line x1="32" y1="38" x2="40" y2="54" {...S} />
    </>
  );
}

const D: Record<string, ReactNode> = {
  arm_neutral: <Svg title="Lengan netral"><Person armDeg={10} /></Svg>,
  arm_mid: <Svg title="Lengan 20-45"><Person armDeg={35} /></Svg>,
  arm_high: <Svg title="Lengan 45-90"><Person armDeg={70} /></Svg>,
  arm_overhead: <Svg title="Lengan >90"><Person armDeg={110} /></Svg>,
  arm_adj1: <Svg title="+1"><Person armDeg={40} /><text x="4" y="12" fontSize="9" fontWeight="700" fill="var(--brand-primary, #ff4d00)">+1</text></Svg>,
  arm_adj2: <Svg title="+2"><Person armDeg={50} /><text x="4" y="12" fontSize="9" fontWeight="700" fill="var(--brand-primary, #ff4d00)">+2</text></Svg>,
  elbow_ok: <Svg title="Siku OK"><circle cx="20" cy="16" r="4" {...S} /><line x1="20" y1="20" x2="20" y2="36" {...S} /><line x1="20" y1="28" x2="36" y2="28" {...A} /><line x1="36" y1="28" x2="48" y2="36" {...A} /></Svg>,
  elbow_out: <Svg title="Siku luar"><circle cx="20" cy="16" r="4" {...S} /><line x1="20" y1="20" x2="20" y2="36" {...S} /><line x1="20" y1="28" x2="42" y2="18" {...A} /></Svg>,
  elbow_cross: <Svg title="Midline"><circle cx="32" cy="14" r="4" {...S} /><line x1="32" y1="18" x2="32" y2="40" {...S} /><line x1="32" y1="26" x2="16" y2="34" {...A} /></Svg>,
  wrist_neutral: <Svg title="Wrist netral"><line x1="12" y1="32" x2="36" y2="32" {...S} /><line x1="36" y1="32" x2="52" y2="32" {...A} /></Svg>,
  wrist_mild: <Svg title="Wrist 15"><line x1="12" y1="34" x2="36" y2="34" {...S} /><line x1="36" y1="34" x2="52" y2="26" {...A} /></Svg>,
  wrist_bent: <Svg title="Wrist >15"><line x1="12" y1="36" x2="36" y2="36" {...S} /><line x1="36" y1="36" x2="50" y2="18" {...A} /></Svg>,
  wrist_dev: <Svg title="Deviasi"><line x1="12" y1="32" x2="36" y2="32" {...S} /><line x1="36" y1="32" x2="52" y2="40" {...A} /></Svg>,
  twist_mid: <Svg title="Twist mid"><ellipse cx="32" cy="32" rx="14" ry="8" {...S} /><path d="M32 24 Q40 32 32 40" {...A} /></Svg>,
  twist_end: <Svg title="Twist end"><ellipse cx="32" cy="32" rx="14" ry="8" {...S} /><path d="M32 24 Q48 32 32 40" {...A} /></Svg>,
  neck_1: <Svg title="Leher 10"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><line x1="32" y1="16" x2="36" y2="10" {...A} /></Svg>,
  neck_2: <Svg title="Leher 20"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><line x1="32" y1="16" x2="40" y2="8" {...A} /></Svg>,
  neck_3: <Svg title="Leher >20"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><line x1="32" y1="16" x2="44" y2="6" {...A} /></Svg>,
  neck_ext: <Svg title="Ekstensi"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><line x1="32" y1="16" x2="28" y2="6" {...A} /></Svg>,
  neck_twist: <Svg title="Twist leher"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><path d="M26 14 Q32 8 38 14" {...A} /></Svg>,
  neck_combo: <Svg title="Combo leher"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><line x1="32" y1="16" x2="42" y2="6" {...A} /><text x="4" y="14" fontSize="9" fontWeight="700" fill="var(--brand-primary, #ff4d00)">+2</text></Svg>,
  trunk_1: <Svg title="Trunk tegak"><circle cx="32" cy="12" r="4" {...S} /><line x1="32" y1="16" x2="32" y2="40" {...S} /><line x1="32" y1="40" x2="24" y2="56" {...S} /><line x1="32" y1="40" x2="40" y2="56" {...S} /></Svg>,
  trunk_2: <Svg title="Trunk 20"><circle cx="34" cy="12" r="4" {...S} /><line x1="34" y1="16" x2="30" y2="40" {...A} /><line x1="30" y1="40" x2="24" y2="56" {...S} /><line x1="30" y1="40" x2="40" y2="54" {...S} /></Svg>,
  trunk_3: <Svg title="Trunk 60"><circle cx="38" cy="14" r="4" {...S} /><line x1="38" y1="18" x2="26" y2="40" {...A} /><line x1="26" y1="40" x2="22" y2="56" {...S} /><line x1="26" y1="40" x2="36" y2="54" {...S} /></Svg>,
  trunk_4: <Svg title="Trunk >60"><circle cx="44" cy="18" r="4" {...S} /><line x1="44" y1="22" x2="22" y2="42" {...A} /><line x1="22" y1="42" x2="18" y2="56" {...S} /><line x1="22" y1="42" x2="32" y2="54" {...S} /></Svg>,
  trunk_twist: <Svg title="Trunk twist"><circle cx="32" cy="12" r="4" {...S} /><line x1="32" y1="16" x2="32" y2="40" {...S} /><path d="M24 28 Q32 22 40 28" {...A} /><line x1="32" y1="40" x2="24" y2="56" {...S} /><line x1="32" y1="40" x2="40" y2="56" {...S} /></Svg>,
  trunk_combo: <Svg title="Trunk combo"><circle cx="36" cy="14" r="4" {...S} /><line x1="36" y1="18" x2="28" y2="40" {...A} /><text x="4" y="14" fontSize="9" fontWeight="700" fill="var(--brand-primary, #ff4d00)">+2</text><line x1="28" y1="40" x2="22" y2="56" {...S} /><line x1="28" y1="40" x2="38" y2="54" {...S} /></Svg>,
  legs_ok: <Svg title="Kaki OK"><circle cx="32" cy="12" r="4" {...S} /><line x1="32" y1="16" x2="32" y2="36" {...S} /><line x1="32" y1="36" x2="22" y2="54" {...S} /><line x1="32" y1="36" x2="42" y2="54" {...S} /><line x1="18" y1="54" x2="26" y2="54" {...A} /><line x1="38" y1="54" x2="46" y2="54" {...A} /></Svg>,
  legs_bad: <Svg title="Kaki buruk"><circle cx="32" cy="12" r="4" {...S} /><line x1="32" y1="16" x2="32" y2="36" {...S} /><line x1="32" y1="36" x2="20" y2="52" {...A} /><line x1="32" y1="36" x2="44" y2="48" {...S} /></Svg>,
  chair_h1: <Svg title="Kursi ideal"><rect x="18" y="28" width="28" height="6" rx="1" {...S} /><line x1="20" y1="34" x2="20" y2="50" {...S} /><line x1="44" y1="34" x2="44" y2="50" {...S} /><circle cx="32" cy="18" r="4" {...S} /><line x1="32" y1="22" x2="32" y2="28" {...S} /></Svg>,
  chair_h2: <Svg title="Kursi tinggi"><rect x="18" y="22" width="28" height="6" rx="1" {...A} /><line x1="20" y1="28" x2="20" y2="50" {...S} /><line x1="44" y1="28" x2="44" y2="50" {...S} /><circle cx="32" cy="12" r="4" {...S} /></Svg>,
  chair_h3: <Svg title="Kursi rendah"><rect x="18" y="36" width="28" height="6" rx="1" {...A} /><circle cx="32" cy="22" r="4" {...S} /><line x1="32" y1="26" x2="32" y2="36" {...S} /></Svg>,
  chair_h4: <Svg title="No footrest"><rect x="18" y="28" width="28" height="6" rx="1" {...S} /><circle cx="32" cy="18" r="4" {...S} /><text x="4" y="58" fontSize="7" fill="var(--brand-primary, #ff4d00)">no footrest</text></Svg>,
  pan_1: <Svg title="Pan OK"><rect x="14" y="30" width="36" height="10" rx="2" {...S} /></Svg>,
  pan_2: <Svg title="Pan panjang"><rect x="10" y="30" width="44" height="10" rx="2" {...A} /></Svg>,
  pan_3: <Svg title="Pan pendek"><rect x="20" y="30" width="24" height="10" rx="2" {...A} /></Svg>,
  arm_1: <Svg title="Armrest OK"><rect x="22" y="28" width="20" height="8" {...S} /><line x1="18" y1="24" x2="18" y2="40" {...A} /><line x1="46" y1="24" x2="46" y2="40" {...A} /><circle cx="32" cy="14" r="4" {...S} /></Svg>,
  arm_2: <Svg title="Armrest tinggi"><rect x="22" y="28" width="20" height="8" {...S} /><line x1="14" y1="16" x2="14" y2="40" {...A} /><line x1="50" y1="16" x2="50" y2="40" {...A} /><circle cx="32" cy="14" r="4" {...S} /></Svg>,
  arm_3: <Svg title="Armrest rendah"><rect x="22" y="28" width="20" height="8" {...S} /><line x1="18" y1="36" x2="18" y2="44" {...A} /><circle cx="32" cy="14" r="4" {...S} /></Svg>,
  back_1: <Svg title="Back OK"><rect x="20" y="20" width="8" height="28" rx="2" {...A} /><rect x="28" y="36" width="22" height="8" {...S} /><circle cx="40" cy="16" r="4" {...S} /></Svg>,
  back_2: <Svg title="Back kurang"><rect x="20" y="24" width="6" height="20" rx="1" {...S} /><rect x="26" y="36" width="22" height="8" {...S} /><circle cx="38" cy="16" r="4" {...S} /></Svg>,
  back_3: <Svg title="No back"><rect x="26" y="36" width="22" height="8" {...S} /><circle cx="38" cy="16" r="4" {...S} /><line x1="38" y1="20" x2="38" y2="36" {...A} /></Svg>,
  mon_0: <Svg title="Monitor OK"><rect x="22" y="12" width="28" height="20" rx="2" {...S} /><line x1="36" y1="32" x2="36" y2="40" {...S} /><circle cx="16" cy="28" r="3" {...A} /></Svg>,
  mon_1: <Svg title="Monitor rendah"><rect x="28" y="22" width="24" height="16" rx="2" {...A} /><circle cx="14" cy="24" r="3" {...S} /></Svg>,
  mon_2: <Svg title="Monitor tinggi"><rect x="30" y="6" width="24" height="16" rx="2" {...A} /><circle cx="14" cy="28" r="3" {...S} /></Svg>,
  mon_3: <Svg title="Monitor buruk"><rect x="32" y="8" width="22" height="14" rx="2" {...A} /><circle cx="12" cy="30" r="3" {...S} /></Svg>,
  phone_0: <Svg title="Headset"><circle cx="32" cy="20" r="8" {...S} /><path d="M24 20 Q20 28 24 36" {...A} /><path d="M40 20 Q44 28 40 36" {...A} /></Svg>,
  phone_1: <Svg title="Phone tangan"><circle cx="28" cy="18" r="5" {...S} /><rect x="36" y="22" width="10" height="16" rx="2" {...A} /></Svg>,
  phone_2: <Svg title="Phone bahu"><circle cx="28" cy="18" r="5" {...S} /><rect x="30" y="12" width="8" height="12" rx="1" {...A} /></Svg>,
  mouse_0: <Svg title="Mouse OK"><ellipse cx="36" cy="36" rx="10" ry="7" {...A} /><line x1="16" y1="28" x2="28" y2="34" {...S} /><circle cx="16" cy="20" r="4" {...S} /></Svg>,
  mouse_1: <Svg title="Mouse jauh"><ellipse cx="48" cy="40" rx="10" ry="7" {...A} /><circle cx="16" cy="20" r="4" {...S} /></Svg>,
  mouse_2: <Svg title="Mouse sangat jauh"><ellipse cx="50" cy="44" rx="9" ry="6" {...A} /><circle cx="14" cy="18" r="4" {...S} /></Svg>,
  kb_0: <Svg title="KB OK"><rect x="14" y="34" width="36" height="10" rx="2" {...S} /><circle cx="16" cy="20" r="4" {...S} /></Svg>,
  kb_1: <Svg title="KB tinggi"><rect x="14" y="28" width="36" height="10" rx="2" {...A} /><circle cx="16" cy="14" r="4" {...S} /></Svg>,
  kb_2: <Svg title="KB rendah"><rect x="14" y="42" width="36" height="10" rx="2" {...A} /><circle cx="16" cy="20" r="4" {...S} /></Svg>,
  muscle: <Svg title="Otot"><circle cx="32" cy="20" r="6" {...S} /><path d="M20 40 Q32 28 44 40" {...A} /></Svg>,
  force: <Svg title="Beban"><rect x="24" y="28" width="16" height="16" rx="2" {...A} /><line x1="32" y1="16" x2="32" y2="28" {...S} /></Svg>,
  duration: <Svg title="Durasi"><circle cx="32" cy="32" r="16" {...S} /><line x1="32" y1="32" x2="32" y2="20" {...A} /><line x1="32" y1="32" x2="40" y2="36" {...A} /></Svg>,
  vibration: <Svg title="Getaran"><path d="M16 32 Q24 20 32 32 Q40 44 48 32" {...A} /></Svg>,
  contact: <Svg title="Kontak"><path d="M20 40 L32 20 L44 40 Z" {...S} /><line x1="32" y1="28" x2="32" y2="36" {...A} /></Svg>,
  wera_shoulder: <Svg title="Bahu"><Person armDeg={90} /></Svg>,
  wera_wrist: <Svg title="Wrist"><line x1="12" y1="32" x2="36" y2="32" {...S} /><line x1="36" y1="32" x2="50" y2="18" {...A} /></Svg>,
  wera_back: <Svg title="Back"><circle cx="36" cy="14" r="4" {...S} /><line x1="36" y1="18" x2="24" y2="44" {...A} /></Svg>,
  wera_neck: <Svg title="Neck"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="21" x2="32" y2="48" {...S} /><line x1="32" y1="16" x2="42" y2="8" {...A} /></Svg>,
  wera_legs: <Svg title="Legs"><circle cx="32" cy="12" r="4" {...S} /><line x1="32" y1="16" x2="32" y2="36" {...S} /><line x1="32" y1="36" x2="22" y2="54" {...S} /><line x1="32" y1="36" x2="42" y2="54" {...S} /></Svg>,
  wera_rep: <Svg title="Rep"><path d="M20 32 A12 12 0 1 1 32 20" {...A} /><polyline points="32,14 32,20 38,20" {...A} /></Svg>,
  rula_upper_arm: <Svg title="Upper arm"><Person armDeg={45} /></Svg>,
  rula_lower_arm: <Svg title="Lower arm"><circle cx="20" cy="16" r="4" {...S} /><line x1="20" y1="28" x2="40" y2="28" {...A} /></Svg>,
  rula_wrist: <Svg title="Wrist ref"><line x1="12" y1="32" x2="52" y2="32" {...A} /></Svg>,
  rula_wrist_twist: <Svg title="Twist ref"><ellipse cx="32" cy="32" rx="14" ry="8" {...A} /></Svg>,
  rula_neck: <Svg title="Neck ref"><circle cx="32" cy="16" r="5" {...S} /><line x1="32" y1="16" x2="40" y2="8" {...A} /></Svg>,
  rula_trunk: <Svg title="Trunk ref"><circle cx="34" cy="12" r="4" {...S} /><line x1="34" y1="16" x2="28" y2="40" {...A} /></Svg>,
  rula_legs: <Svg title="Legs ref"><circle cx="32" cy="12" r="4" {...S} /><line x1="32" y1="36" x2="22" y2="54" {...S} /><line x1="32" y1="36" x2="42" y2="54" {...S} /></Svg>,
  rosa_chair_height: <Svg title="Chair"><rect x="18" y="28" width="28" height="6" {...S} /><circle cx="32" cy="18" r="4" {...S} /></Svg>,
  rosa_pan: <Svg title="Pan"><rect x="14" y="30" width="36" height="10" rx="2" {...S} /></Svg>,
  rosa_armrest: <Svg title="Armrest"><line x1="18" y1="24" x2="18" y2="40" {...A} /><circle cx="32" cy="14" r="4" {...S} /></Svg>,
  rosa_back: <Svg title="Back support"><rect x="20" y="20" width="8" height="28" rx="2" {...A} /></Svg>,
  rosa_monitor: <Svg title="Monitor"><rect x="22" y="12" width="28" height="20" rx="2" {...S} /></Svg>,
  rosa_phone: <Svg title="Phone"><circle cx="32" cy="20" r="8" {...S} /></Svg>,
  rosa_mouse: <Svg title="Mouse"><ellipse cx="36" cy="36" rx="10" ry="7" {...A} /></Svg>,
  rosa_keyboard: <Svg title="Keyboard"><rect x="14" y="34" width="36" height="10" rx="2" {...S} /></Svg>,
};

export function PostureDiagram({ id, size = 56 }: { id?: string; size?: number }) {
  if (!id) return null;
  const node = D[id];
  if (!node) {
    return (
      <div style={{ width: size, height: size, borderRadius: 8, background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>—</div>
    );
  }
  return <div style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{node}</div>;
}

export function SectionDiagram({ diagramKey }: { diagramKey?: string }) {
  if (!diagramKey) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)' }}>
      <PostureDiagram id={diagramKey} size={48} />
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.35 }}>
        Bandingkan postur pekerja dengan ilustrasi di setiap pilihan skor di bawah.
      </span>
    </div>
  );
}
