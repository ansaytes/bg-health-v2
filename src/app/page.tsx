'use client';
import NotificationBell from '@/components/header/NotificationBell';

import { useState, useEffect , useCallback} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useMCUStore, type PageTab, type DashSidebar, type AdminSidebar, type DataEntrySidebar, type HomeSidebar } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import DashboardView from '@/components/dashboard/DashboardView';
import MonitoringMCU from '@/components/dashboard/MonitoringMCU';
import HasilTindakLanjutMCU from '@/components/dashboard/HasilTindakLanjutMCU';
import KunjunganBerobat from '@/components/dashboard/KunjunganBerobat';
import ReviewMCU from '@/components/review-mcu/ReviewMCU';
import InputLaggingIndicator from '@/components/administrator/InputLaggingIndicator';
import LaggingIndicatorPage from '@/components/administrator/LaggingIndicatorPage';
import KunjunganBerobatForm from '@/components/administrator/KunjunganBerobatForm';
import HealthCampaignForm from '@/components/administrator/HealthCampaignForm';
import UserManagement from '@/components/administrator/UserManagement';
import InputJadwalMCU from '@/components/administrator/InputJadwalMCUModern';
import HomeView from '@/components/home/HomeView';
import DataKesehatanTable from '@/components/dashboard/DataKesehatanTable';
import DataKunjunganTable from '@/components/dashboard/DataKunjunganTable';
import RecordMCUTable from '@/components/dashboard/RecordMCUTableModern';
import DataManPowerTable from '@/components/dashboard/DataManPowerTable';

/*   Sidebar Icon Components */

function IconStatistik() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconMonitoring() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 9l2 2-2 2" />
      <path d="M13 13h2" />
      <path d="M17 9l-2 2 2 2" />
    </svg>
  );
}
function IconTindakLanjut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  );
}
function IconKunjunganDash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function IconSemuaFeed() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconHealthCampaign() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  );
}
function IconHealthTalk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}
function IconNews() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <line x1="10" y1="6" x2="18" y2="6" /><line x1="10" y1="10" x2="18" y2="10" /><line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function IconReviewMCU() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconStatistikHealth() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /><circle cx="12" cy="7" r="3" /><path d="M12 4v1" />
    </svg>
  );
}
function IconInputLagging() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function IconCampaignAdmin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function IconKunjunganAdmin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/*   Sidebar Configs */

const ALL_HEADER_NAV: { key: PageTab; label: string; adminOnly: boolean }[] = [
  { key: 'home', label: 'Home', adminOnly: false },
  { key: 'dashboard', label: 'Dashboard', adminOnly: false },
  { key: 'data-entry', label: 'Data Entry', adminOnly: true },
  { key: 'administrator', label: 'Administrator', adminOnly: true },
];

interface SidebarItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  superuserOnly?: boolean;
}

function IconPodcast() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

const HOME_SIDEBAR: SidebarItem[] = [
  { key: 'semua-feed', label: 'Semua Feed', icon: <IconSemuaFeed /> },
  { key: 'health-campaign', label: 'Health Campaign', icon: <IconHealthCampaign /> },
  { key: 'health-talk', label: 'Health Talk', icon: <IconHealthTalk /> },
  { key: 'podcast', label: 'Podcast', icon: <IconPodcast /> },
  { key: 'news', label: 'News', icon: <IconNews /> },
];

const DASH_SIDEBAR: SidebarItem[] = [
  { key: 'statistik', label: 'Statistik Kesehatan', icon: <IconStatistik /> },
  { key: 'monitoring', label: 'Monitoring MCU', icon: <IconMonitoring /> },
  { key: 'tindak-lanjut', label: 'Analisa & Tindak Lanjut MCU', icon: <IconTindakLanjut /> },
  { key: 'kunjungan', label: 'Kunjungan Berobat', icon: <IconKunjunganDash /> },
];

const ADMIN_SIDEBAR: SidebarItem[] = [
  { key: 'lagging-indicator', label: 'Lagging Indicator', icon: <IconInputLagging /> },
  { key: 'review-mcu', label: 'Review MCU', icon: <IconReviewMCU /> },
  { key: 'health-campaign', label: 'Health Campaign', icon: <IconCampaignAdmin /> },
  { key: 'kunjungan-admin', label: 'Kunjungan Berobat', icon: <IconKunjunganAdmin /> },
  { key: 'kelola-pengguna', label: 'Kelola Pengguna', icon: <IconUsers />, superuserOnly: true },
];
const DATA_ENTRY_SIDEBAR: SidebarItem[] = [
  { key: 'input-jadwal-mcu', label: 'Input Jadwal MCU', icon: <IconReviewMCU /> },
];

/*   Content Routers */

function HomeContent() {
  const activeHomeSidebar = useMCUStore((s) => s.activeHomeSidebar);
  return <HomeView activeTab={activeHomeSidebar} />;
}

function DataEntryContent() {
  const activeDataEntrySidebar = useMCUStore((s) => s.activeDataEntrySidebar);
  return activeDataEntrySidebar === 'input-jadwal-mcu'
    ? <div className="admin-form-container"><InputJadwalMCU /></div>
    : null;
}

function DashContent() {
  const activeDashSidebar = useMCUStore((s) => s.activeDashSidebar);
  const isLoggedIn = !!useAuth().user && !!useAuth().profile;

  if (!isLoggedIn) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flex: 1, textAlign: 'center', padding: 40,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(255,77,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ff4d00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', marginBottom: 6 }}>
          Silahkan Login Untuk Mengakses Halaman Ini!
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          Masuk dengan akun Anda untuk melihat data dashboard.
        </p>
      </div>
    );
  }

  switch (activeDashSidebar) {
    case 'statistik': return <DashboardView />;
    case 'monitoring': return <MonitoringMCU />;
    case 'tindak-lanjut': return <HasilTindakLanjutMCU />;
    case 'kunjungan': return <KunjunganBerobat />;
    default: return <DashboardView />;
  }
}

/*   Admin Toggle Panel — form/table switcher with smart rotating arrow */

function AdminTogglePanel({ formContent, tableContents, hasTable, stepLabels }: {
  formContent: React.ReactNode;
  tableContents: React.ReactNode[];
  hasTable: boolean;
  stepLabels?: string[];
}) {
  const [step, setStep] = useState(0);
  const [rotation, setRotation] = useState(0);

  if (!hasTable) {
    return <>{formContent}</>;
  }

  const panels = [formContent, ...tableContents];
  const idx = step % panels.length;
  const isForm = idx === 0;
  const nextIdx = (step + 1) % panels.length;

  const handleClick = () => {
    setRotation(r => r + 180);
    setStep(s => s + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: isForm ? -40 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isForm ? -40 : 40 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
          >
            {panels[idx]}
          </motion.div>
        </AnimatePresence>
      </div>
      <button
        className="admin-toggle-arrow"
        onClick={handleClick}
        title={stepLabels ? `Lihat ${stepLabels[nextIdx]}` : 'Lihat Data'}
      >
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: rotation }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <polyline points="9 6 15 12 9 18" />
        </motion.svg>
      </button>
    </div>
  );
}

function AdminContent() {
  const activeAdminSidebar = useMCUStore((s) => s.activeAdminSidebar);
  const { isAdmin, role } = useAuth();

  // Kelola Pengguna is standalone (no toggle)
  if (activeAdminSidebar === 'kelola-pengguna') {
    return <div className="admin-form-container"><UserManagement /></div>;
  }

  const panels: Record<string, { form: React.ReactNode; tables: React.ReactNode[]; hasTable: boolean; labels?: string[] }> = {
    'lagging-indicator': {
      hasTable: true,
      labels: ['Lagging Indicator', 'Data Kesehatan', 'Σ Man Power'],
      form: <LaggingIndicatorPage />,
      tables: [
        <div className="admin-form-container" key="kesehatan"><DataKesehatanTable canEdit={isAdmin} /></div>,
        <div className="admin-form-container" key="manpower"><DataManPowerTable canEdit={isAdmin} /></div>,
      ],
    },
    'review-mcu': {
      hasTable: true,
      labels: ['Form Input', 'Record MCU'],
      form: (
        <div style={{ display: 'flex', flexDirection: 'column', width: '90%', margin: '0 auto', padding: 16, overflow: 'auto', flex: 1, minHeight: 0 }}>
          <ReviewMCU />
        </div>
      ),
      tables: [<div className="admin-form-container" key="mcu"><RecordMCUTable /></div>],
    },
    'health-campaign': {
      hasTable: false,
      form: <HealthCampaignForm />,
      tables: [],
    },
    'kunjungan-admin': {
      hasTable: true,
      labels: ['Form Input', 'Data Kunjungan'],
      form: <KunjunganBerobatForm />,
      tables: [<div className="admin-form-container" key="kunjungan"><DataKunjunganTable canEdit={isAdmin} /></div>],
    },
  };

  const panel = panels[activeAdminSidebar] || panels['review-mcu'];
  return (
    <AdminTogglePanel
      formContent={panel.form}
      tableContents={panel.tables}
      hasTable={panel.hasTable}
      stepLabels={panel.labels}
    />
  );
}

/*   Login Popup (Apple-style) */

function LoginPopup({ onClose }: { onClose: () => void }) {
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login"|"register">("login");
  const [regNik, setRegNik] = useState("");
  const [regNama, setRegNama] = useState("");
  const [regJabatan, setRegJabatan] = useState("");
  const [regJobsite, setRegJobsite] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email: username,
        password,
      });

      if (supabaseError) {
        setError(supabaseError.message);
        return;
      }

      if (data.session) {
        await refreshProfile();
        setUsername('');
        setPassword('');
        onClose();
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="login-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="login-card"
        style={{ position: 'relative' }}
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 24 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <button className="login-close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>

        <div style={{ paddingTop: 24, paddingBottom: 4, textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/BM.png" alt="BG-Health" className="login-logo-rotating" />
        </div>

        <div className="login-card-body">
          <h2>{mode === 'login' ? 'Masuk' : 'Daftar'}</h2>
          <p className="login-card-subtitle">{mode === 'login' ? 'Masuk ke BG-Health untuk mengakses dashboard' : 'Daftar akun baru'}</p>

          {mode === 'login' ? (
          <>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="login-input-group">
              <label className="login-input-label">Username / Email</label>
              <input
                type="text"
                className="login-input"
                placeholder="username@email.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="login-input-group">
              <label className="login-input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="password-toggle-btn"
                  aria-label={showLoginPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showLoginPassword ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p className="login-error-msg">{error}</p>
            )}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p className="login-footer-text">
            Belum punya akun?{' '}
            <button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: '#ff4d00', fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 }}>
              Daftar di sini
            </button>
          </p>
          </>
          ) : (
          <>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setLoading(true);
            try {
              const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  /* register via notifications API */
                  email: regEmail,
                  password: regPassword,
                  full_name: regNama,
                  role: 'viewer',
                  national_id: regNik,
                  username: regNik,
                }),
              });
              const json = await res.json();
              if (!json.success) throw new Error(json.error || 'Gagal mendaftar');
              setMode('login');
              setError('');
              alert('Pendaftaran berhasil! Silakan login.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Gagal mendaftar');
            } finally {
              setLoading(false);
            }
          }} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="login-input-group">
              <label className="login-input-label">NIK (National ID) *</label>
              <input
                type="text"
                className="login-input"
                placeholder="Masukkan NIK"
                value={regNik}
                onChange={async (e) => {
                  const val = e.target.value;
                  setRegNik(val);
                  if (val.length >= 6) {
                    try {
                      const res = await fetch('/api/employee', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: val }),
                      });
                      const json = await res.json();
                      if (json.success && json.data && json.data.length > 0) {
                        const emp = json.data[0];
                        setRegNama(emp.nama || '');
                        setRegJabatan(emp.job_position || '');
                        setRegJobsite(emp.site_name || '');
                        setRegEmail(emp.nik ? `${String(emp.nik)}@bg-health.local` : '');
                      }
                    } catch {}
                  }
                }}
              />
              {regNama && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '4px 8px', borderRadius: 6 }}>
                  ✓ {regNama} — {regJabatan} — {regJobsite}
                </div>
              )}
            </div>
            <div className="login-input-group">
              <label className="login-input-label">Email *</label>
              <input type="email" className="login-input" placeholder="email@perusahaan.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
            </div>
            <div className="login-input-group">
              <label className="login-input-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Minimal 6 karakter"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="password-toggle-btn"
                  aria-label={showRegPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showRegPassword ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error && <p className="login-error-msg">{error}</p>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Memproses...' : 'Daftar'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              ← Kembali ke Login
            </button>
          </form>
          </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/*   Main Page */

export default function Home() {
  const store = useMCUStore();
  const { theme, setTheme } = useTheme();
  const { user, profile, loading: authLoading, isAdmin, isSuperuser, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const activePage = store.activePage;

  const isLoggedIn = !!user && !!profile;

  // Redirect non-admin away from administrator page
  useEffect(() => {
    if (authLoading) return;
    if (activePage === 'administrator' && !['administrator', 'superuser'].includes(role || '')) {
      store.setActivePage('home');
    }
    if (activePage === 'data-entry' && !['pic', 'administrator', 'superuser'].includes(role || '')) {
      store.setActivePage('home');
    }
  }, [activePage, authLoading, role, store]);

  // Reset sub-sidebar to topmost when main page changes
  // Use ref to avoid infinite loop (don't depend on store object)
  const resetSidebar = useCallback((page: string) => {
    if (page === 'home') store.setActiveHomeSidebar('semua-feed');
    else if (page === 'dashboard') store.setActiveDashSidebar('statistik');
    else if (page === 'data-entry') store.setActiveDataEntrySidebar('input-jadwal-mcu');
    else if (page === 'administrator') store.setActiveAdminSidebar('lagging-indicator');
  }, [store.setActiveHomeSidebar, store.setActiveDashSidebar, store.setActiveDataEntrySidebar, store.setActiveAdminSidebar]);

  useEffect(() => {
    resetSidebar(activePage);
  }, [activePage, resetSidebar]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(true), 0);
    const t2 = setTimeout(() => setLoading(false), 50);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [activePage, store.activeDashSidebar, store.activeDataEntrySidebar, store.activeAdminSidebar, store.activeHomeSidebar]);

  // Role-based header nav
  const headerNav = ALL_HEADER_NAV.filter((item) => {
    if (item.key === 'administrator') return ['administrator', 'superuser'].includes(role || '');
    if (item.key === 'data-entry') return ['pic', 'administrator', 'superuser'].includes(role || '');
    return true;
  });

  // Role-based sidebar items
  const getSidebarItems = (): SidebarItem[] => {
    if (activePage === 'home') return HOME_SIDEBAR;
    if (activePage === 'dashboard') return DASH_SIDEBAR;
    if (activePage === 'data-entry') return DATA_ENTRY_SIDEBAR;
    // Administrator sidebar — filter by role
    return ADMIN_SIDEBAR.filter((item) => {
      if (item.superuserOnly && !isSuperuser) return false;
      return true;
    });
  };

  const sidebarItems = getSidebarItems();

  const activeSidebarKey =
    activePage === 'home' ? store.activeHomeSidebar :
    activePage === 'dashboard' ? store.activeDashSidebar :
    activePage === 'data-entry' ? store.activeDataEntrySidebar :
    store.activeAdminSidebar;

  const handleNav = (tab: PageTab) => {
    // Prevent non-admins from going to administrator
    if (tab === 'administrator' && !['administrator', 'superuser'].includes(role || '')) return;
    if (tab === 'data-entry' && !['pic', 'administrator', 'superuser'].includes(role || '')) return;
    store.setActivePage(tab);
    setMobileOpen(false);
  };

  const handleSidebarClick = (key: string) => {
    if (activePage === 'home') store.setActiveHomeSidebar(key as HomeSidebar);
    else if (activePage === 'dashboard') store.setActiveDashSidebar(key as DashSidebar);
    else if (activePage === 'data-entry') store.setActiveDataEntrySidebar(key as DataEntrySidebar);
    else store.setActiveAdminSidebar(key as AdminSidebar);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowLogin(false);
    // If on admin page, redirect to home
    if (activePage === 'administrator' || activePage === 'data-entry') {
      store.setActivePage('home');
    }
  };

  // Get user display name and initials
  const displayName = profile?.full_name || profile?.username || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const roleLabel = profile?.role === 'superuser' ? 'Superuser' : profile?.role === 'administrator' ? 'Administrator' : profile?.role === 'pic' ? 'PIC' : 'Viewer';

  return (
    <div className="app-shell">
      <div className={"sidebar-overlay" + (mobileOpen ? ' show' : '')} onClick={() => setMobileOpen(false)} />
      <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
      </button>

      <aside className={"sidebar" + (mobileOpen ? ' open' : '')}>
        <div className="sidebar-head">
          <div className="sidebar-logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/LogoBDM.png" alt="Logo" className="sidebar-logo-img" />
          </div>
        </div>

        {/* Bus 2023 image - full width, reduced height, 85% opacity */}
        <div style={{ padding: '0 12px', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Bus2023.png" alt="" style={{ width: '100%', height: 80, objectFit: 'cover', objectPosition: 'center', opacity: 0.85, borderRadius: 6, display: 'block' }} />
        </div>

        <div className="sidebar-label">BG-Health v2</div>
        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              className={`nav-btn${activeSidebarKey === item.key ? ' active' : ''}`}
              onClick={() => handleSidebarClick(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Tuwuh lan ngrembaka — above login */}
        <div className="sidebar-tuwuh-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/TuwuhLanNgrembaka_float.png" alt="" className="sidebar-tuwuh-img" />
        </div>

        <div className="sidebar-footer">
          {isLoggedIn ? (
            <div className="sidebar-account">
              <div className="sidebar-avatar">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="sidebar-account-info">
                <div className="sidebar-account-name">{displayName}</div>
                <div className="sidebar-account-role">{roleLabel}</div>
              </div>
              <button className="sidebar-logout-btn" onClick={handleLogout} aria-label="Keluar" title="Keluar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
            </div>
          ) : (
            <button className="sidebar-login-btn" onClick={() => setShowLogin(true)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>Masuk</span>
            </button>
          )}
        </div>
      </aside>

      <div className="main">
        <div className="header">
          <div className="header-top">
            <div className="header-left-spacer" />
            <nav className="header-nav">
              {headerNav.map((item) => (
                <button
                  key={item.key}
                  className={`header-nav-item${activePage === item.key ? ' active' : ''}`}
                  onClick={() => handleNav(item.key)}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="header-right">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/BestK3.png" alt="BestK3" className="header-right-logo" />
              <NotificationBell isSuperuser={isSuperuser} />
              <button className="theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark'
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="#FDCB6E" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                }
              </button>
            </div>
          </div>
        </div>

        <div className="page-content has-content" style={{ position: 'relative' }}>
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/BM.png" alt="Loading" />
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {activePage === 'home' ? (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
              >
                <HomeContent />
              </motion.div>
            ) : activePage === 'dashboard' ? (
              <motion.div
                key={store.activeDashSidebar}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
              >
                <DashContent />
              </motion.div>
            ) : activePage === 'data-entry' ? (
              <motion.div
                key={store.activeDataEntrySidebar}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
              >
                <DataEntryContent />
              </motion.div>
            ) : activePage === 'administrator' ? (
              <motion.div
                key={store.activeAdminSidebar}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
              >
                <AdminContent />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showLogin && <LoginPopup onClose={() => setShowLogin(false)} />}
      </AnimatePresence>
    </div>
  );
}
