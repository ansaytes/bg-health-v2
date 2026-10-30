'use client';
import NotificationBell from '@/components/header/NotificationBell';

import { useState, useEffect , useCallback} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useMCUStore, type PageTab, type DashSidebar, type AdminSidebar, type DataEntrySidebar, type HomeSidebar } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import DashboardView from '@/components/dashboard/DashboardView';
import MonitoringMCUTabs from '@/components/dashboard/MonitoringMCUTabs';
import KunjunganBerobat from '@/components/dashboard/KunjunganBerobat';
import ReviewMCU from '@/components/review-mcu/ReviewMCU';

import InputLaggingIndicator from '@/components/administrator/InputLaggingIndicator';
import LaggingIndicatorPage from '@/components/administrator/LaggingIndicatorPage';
import KunjunganBerobatForm from '@/components/administrator/KunjunganBerobatForm';
import HealthCampaignForm from '@/components/administrator/HealthCampaignForm';
import AppSettingsPage from '@/components/settings/AppSettingsPage';
import PakRegister from '@/components/pak/PakRegister';
import AdminProKawan from '@/components/administrator/AdminProKawan';
import MonitoringKaryawanSakit from '@/components/administrator/MonitoringKaryawanSakit';
import InspeksiSanitasi from '@/components/administrator/InspeksiSanitasi';
import GiziKerja from '@/components/administrator/GiziKerja';
import SaranaKlinik from '@/components/administrator/SaranaKlinik';
import InputJadwalMCU from '@/components/administrator/InputJadwalMCUModern';
import GangguanTidurPage from '@/components/administrator/GangguanTidurPage';
import InputMentalHealthPage from '@/components/administrator/InputMentalHealthPage';
import InputPsikologiLingkunganPage from '@/components/administrator/InputPsikologiLingkunganPage';
import InventoryAdmin from '@/components/administrator/InventoryAdmin';
import { clearDashboardDataCache, preloadDashboardData } from '@/lib/dashboard-data';
import { clearMCUDashboardData } from '@/components/dashboard/MCUDashboardShared';
import HomeView from '@/components/home/HomeView';
import DataKesehatanTable from '@/components/dashboard/DataKesehatanTable';
import DataKunjunganTable from '@/components/dashboard/DataKunjunganTable';
import RecordMCUTable from '@/components/dashboard/RecordMCUTableModern';
import DataManPowerTable from '@/components/dashboard/DataManPowerTable';
import InventoryDashboard from '@/components/dashboard/InventoryDashboard';
import HearingConservationDashboard from '@/components/dashboard/HearingConservationDashboard';
import ErgonomiDashboard from '@/components/dashboard/ErgonomiDashboard';
import MentalHealthDashboard from '@/components/dashboard/MentalHealthDashboard';
import HigieneIndustriTabs from '@/components/dashboard/HigieneIndustriTabs';
import LayananKuratifTabs from '@/components/dashboard/LayananKuratifTabs';
import ProKawanDashboard from '@/components/dashboard/ProKawanDashboard';
import SPIPDashboard from '@/components/dashboard/SPIPDashboard';
import ErgoApproval from '@/components/dashboard/ErgoApproval';
import HcInputPage from '@/components/administrator/HcInputPage';
import HcAudiometriEval from '@/components/administrator/HcAudiometriEval';
import ErgoSurveyForm from '@/components/administrator/ErgoSurveyForm';
import ErgoSurveyTable from '@/components/administrator/ErgoSurveyTable';
import CenteredTabs from '@/components/ui/centered-tabs';

/*   Admin sub-tab containers (Layanan Kuratif & Higiene Industri)   */

/**
 * Administrator → Layanan Kuratif: form input Kunjungan Berobat dan
 * Inventory dalam satu menu bertab (sama seperti sisi dashboard).
 * Tab tetap di TENGAH halaman agar simetris.
 */
function AdminLayananKuratif() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<'kunjungan' | 'inventory'>('kunjungan');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <CenteredTabs
        tabs={[
          { key: 'kunjungan', label: 'Kunjungan Berobat' },
          { key: 'inventory', label: 'Inventory' },
        ]}
        active={tab}
        onChange={setTab}
        ariaLabel="Layanan Kuratif — Input"
        compact
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'kunjungan' ? (
          <AdminTogglePanel
            formContent={<KunjunganBerobatForm />}
            tableContents={[<div className="admin-form-container" key="kunjungan"><DataKunjunganTable canEdit={isAdmin} /></div>]}
            hasTable
            stepLabels={['Form Input', 'Data Kunjungan']}
          />
        ) : (
          <InventoryAdmin />
        )}
      </div>
    </div>
  );
}

/**
 * Administrator → Higiene Industri: input Hearing Conservation dan Ergonomi
 * dalam satu menu bertab (sama seperti sisi dashboard).
 */
function AdminHigieneIndustri() {
  const [tab, setTab] = useState<'hearing' | 'ergonomi' | 'sanitasi' | 'gizi'>('hearing');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <CenteredTabs
        tabs={[
          { key: 'hearing', label: 'Hearing Conservation' },
          { key: 'ergonomi', label: 'Ergonomi' },
          // Higiene & Sanitasi (STD/005) + Gizi Kerja (AKG 2019) — SOP/028 poin 5.7
          { key: 'sanitasi', label: 'Higiene & Sanitasi' },
          { key: 'gizi', label: 'Gizi Kerja' },
        ]}
        active={tab}
        onChange={setTab}
        ariaLabel="Higiene Industri — Input"
        compact
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'sanitasi' ? (
          <InspeksiSanitasi />
        ) : tab === 'gizi' ? (
          <GiziKerja />
        ) : tab === 'hearing' ? (
          <AdminTogglePanel
            formContent={<HcInputPage />}
            tableContents={[<HcAudiometriEval key="hc-audio" />]}
            hasTable
            stepLabels={['Input HC', 'Evaluasi Audiometri & STS']}
          />
        ) : (
          <AdminTogglePanel
            formContent={<ErgoSurveyForm />}
            tableContents={[<ErgoSurveyTable key="ergo-table" />]}
            hasTable
            stepLabels={['Input Survei', 'Data Survei & PICA']}
          />
        )}
      </div>
    </div>
  );
}

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
function IconQuestionnaire() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="9" y2="13" /><line x1="12" y1="13" x2="13" y2="13" />
      <line x1="16" y1="13" x2="17" y2="13" /><line x1="8" y1="17" x2="9" y2="17" />
      <line x1="12" y1="17" x2="13" y2="17" />
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

/** Bulan & bintang — Gangguan Tidur. */
function IconTidur() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      <path d="M18 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </svg>
  );
}

/** Higiene Industri — menara pengukuran + gelombang (monitoring faktor lingkungan kerja). */
function IconHigiene() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 21h6" />
      <path d="M9 21V9" />
      <circle cx="9" cy="7" r="2" />
      <path d="M14 9c2 0 3 1.5 3 3s-1 3-3 3" />
      <path d="M17.5 5.5c3 1 4.5 3.8 4.5 6.5s-1.5 5.5-4.5 6.5" />
      <path d="M4 21V15" />
      <path d="M2 15h4" />
    </svg>
  );
}

/** Layanan Kuratif — stetoskop. */
function IconKuratif() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 4v5a4.2 4.2 0 0 0 8.4 0V4" />
      <path d="M9 13.2V15a5 5 0 0 0 5 5 4 4 0 0 0 4-4v-2" />
      <circle cx="18" cy="7" r="2" />
      <path d="M3.4 4h2.8" />
      <path d="M11.8 4h2.8" />
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
  adminOnly?: boolean;
  approverOnly?: boolean;   // khusus Manager (dan superuser): persetujuan dokumen
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

/** Laporan Mingguan — kalender dengan tanda centang. */
function IconLaporanMingguan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M9 15l1.5 1.5L14 13" />
    </svg>
  );
}

const DASH_SIDEBAR: SidebarItem[] = [
  { key: 'statistik', label: 'Statistik Kesehatan', icon: <IconStatistik /> },
  { key: 'monitoring', label: 'Monitoring MCU', icon: <IconMonitoring /> },
  { key: 'layanan-kuratif', label: 'Layanan Kuratif', icon: <IconKuratif /> },
  { key: 'prokawan-dashboard', label: 'ProKawan', icon: <IconProkawan />, adminOnly: true },
  // SPIP = Sarana, Prasarana, Instalasi, Peralatan (SOP/028 poin 5.5).
  // Menu sendiri karena bukan faktor lingkungan kerja (Higiene Industri).
  { key: 'spip', label: 'SPIP', icon: <IconSarana />, adminOnly: true },
  { key: 'higiene-industri', label: 'Higiene Industri', icon: <IconHigiene />, adminOnly: true },
  { key: 'mental-health-dashboard', label: 'Kesehatan Mental', icon: <IconBrain />, adminOnly: true },
];

/** Ikut ProKawan — kelompok orang bertopeng satu sama lain. */
function IconProkawan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7.5" r="2.6" /><circle cx="16.5" cy="8.5" r="2.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M14 20c0-2.4 1.9-4.4 4.3-4.4" />
    </svg>
  );
}

/** Kepala dengan otak — Kesehatan Mental (input). */
function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4.5A2.5 2.5 0 0 0 7 7v.2A2.8 2.8 0 0 0 5 10a2.8 2.8 0 0 0 1 2.1A2.8 2.8 0 0 0 5.6 15 2.8 2.8 0 0 0 8 17.7v.3a2.5 2.5 0 0 0 5 .2V4.8a2 2 0 0 0-3.5-1.3z" />
      <path d="M14.5 4.5A2.5 2.5 0 0 1 17 7v.2A2.8 2.8 0 0 1 19 10a2.8 2.8 0 0 1-1 2.1 2.8 2.8 0 0 1 .4 2.9A2.8 2.8 0 0 1 16 17.7v.3a2.5 2.5 0 0 1-5 .2" />
      <path d="M12 8.5h1.5M12 12h2M12 15.5h1.5M10.5 8.5H9M10 12H8" />
    </svg>
  );
}

/** Checklist — Input Jadwal MCU. */
function IconChecklist() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M8.5 11l1.6 1.6L13 9.8" />
      <path d="M8.5 16h8" />
      <path d="M13 13.6h3.5" />
    </svg>
  );
}

/** Pena di atas lembar — Approval Survey Ergonomi. */
function IconPena() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3h5a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-5" />
      <path d="M3 21l1.2-4.6L15 5.6a1.7 1.7 0 0 1 2.4 0l1 1a1.7 1.7 0 0 1 0 2.4L7.6 19.8 3 21z" />
      <path d="M13.4 7.2l3.4 3.4" />
    </svg>
  );
}

/** Orang dalam lingkaran berpikir — Psikologi Lingkungan Kerja. */
function IconPsikologiLingkungan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 17v-1.5" />
      <path d="M9.6 9.8a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1 .9-1 1.5" />
      <path d="M3.5 8.5c1.6.6 3 .4 4-.5" />
    </svg>
  );
}

/** Roda gigi — Pengaturan aplikasi. */
function IconSetting() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.51 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .33-1.82 1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.51-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.82.33h.01a1.7 1.7 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51h.01a1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.82v.01a1.7 1.7 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Register PAK — clipboard dengan checkmark. */
function IconPakRegister() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 13l1.5 1.5L13.5 11.5" />
      <path d="M9 17h6" />
    </svg>
  );
}

/** ProKawan — hati dengan garis denyut (monitoring peserta). */
function IconProKawan() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
      <path d="M3.5 12.5h3.2l1.6-3 2.4 6 1.8-3h5.5" />
    </svg>
  );
}

/** Monitoring Karyawan Sakit — tempat tidur dengan tanda denyut. */
function IconKaryawanSakit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20V9a2 2 0 0 1 2-2h9a4 4 0 0 1 4 4v9" />
      <path d="M3 16h18M3 20h18" />
      <circle cx="7.5" cy="10.5" r="1.5" />
      <path d="M17 11h4M19 9v4" />
    </svg>
  );
}

/** Sarana & Prasarana — kotak peralatan dengan centang. */
function IconSarana() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M9 14l1.5 1.5L15 12" />
    </svg>
  );
}

const ADMIN_SIDEBAR: SidebarItem[] = [
  { key: 'lagging-indicator', label: 'Lagging Indicator', icon: <IconInputLagging /> },
  { key: 'review-mcu', label: 'Review MCU', icon: <IconReviewMCU /> },
  { key: 'health-campaign', label: 'Health Campaign', icon: <IconCampaignAdmin /> },
  // Kunjungan Berobat + Inventory digabung menjadi satu menu "Layanan Kuratif"
  // (tab di dalamnya), konsisten dengan sisi dashboard.
  { key: 'layanan-kuratif-admin', label: 'Layanan Kuratif', icon: <IconKuratif /> },
  // Hearing Conservation + Ergonomi masuk ke menu Higiene Industri.
  { key: 'higiene-industri-admin', label: 'Higiene Industri', icon: <IconHigiene /> },
  { key: 'pak-register', label: 'Register PAK', icon: <IconPakRegister /> },
  { key: 'prokawan-admin', label: 'ProKawan', icon: <IconProKawan /> },
  // Monitoring Karyawan Sakit (SOP/027) — jalur kelayakan kerja yang BERBEDA
  // dari kesimpulan vendor MCU. Keduanya sah dan berdampingan.
  { key: 'karyawan-sakit', label: 'Monitoring Karyawan Sakit', icon: <IconKaryawanSakit /> },
  { key: 'sarana-klinik', label: 'Sarana & Prasarana', icon: <IconSarana /> },
  // Kelola Pengguna dipindah ke menu Pengaturan (tab "Kelola Pengguna").
  { key: 'pengaturan', label: 'Pengaturan', icon: <IconSetting />, superuserOnly: true },
];
const DATA_ENTRY_SIDEBAR: SidebarItem[] = [
  { key: 'input-jadwal-mcu', label: 'Input Jadwal MCU', icon: <IconChecklist /> },
  { key: 'gangguan-tidur', label: 'Gangguan Tidur', icon: <IconTidur /> },
  { key: 'kesehatan-mental', label: 'Kesehatan Mental', icon: <IconBrain /> },
  { key: 'psikologi-lingkungan', label: 'Psikologi Lingkungan Kerja', icon: <IconPsikologiLingkungan /> },
  { key: 'persetujuan-ergonomi', label: 'Approval Survey Ergonomi', icon: <IconPena />, approverOnly: true },
];

/*   Content Routers */

function HomeContent() {
  const activeHomeSidebar = useMCUStore((s) => s.activeHomeSidebar);
  const { role } = useAuth();
  return (
    <>
      {role === 'employee' && (
        <div style={{ flexShrink: 0, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <a
            href="/kuesioner"
            style={{ color: '#ff4d00', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
          >
            Buka Kuesioner →
          </a>
        </div>
      )}
      <HomeView activeTab={activeHomeSidebar} />
    </>
  );
}

function DataEntryContent() {
  const activeDataEntrySidebar = useMCUStore((s) => s.activeDataEntrySidebar);
  if (activeDataEntrySidebar === 'gangguan-tidur') {
    return <div className="admin-form-container"><GangguanTidurPage /></div>;
  }
  if (activeDataEntrySidebar === 'kesehatan-mental') {
    return <div className="admin-form-container"><InputMentalHealthPage /></div>;
  }
  // SDS-30 = faktor psikologi lingkungan kerja → menu sendiri (bukan di Kesehatan Mental).
  if (activeDataEntrySidebar === 'psikologi-lingkungan') {
    return <div className="admin-form-container"><InputPsikologiLingkunganPage /></div>;
  }
  if (activeDataEntrySidebar === 'persetujuan-ergonomi') {
    return <div className="admin-form-container" style={{ overflow: 'hidden' }}><ErgoApproval /></div>;
  }
  return activeDataEntrySidebar === 'input-jadwal-mcu'
    ? <div className="admin-form-container"><InputJadwalMCU /></div>
    : null;
}

function DashContent() {
  const activeDashSidebar = useMCUStore((s) => s.activeDashSidebar);
  const { user, profile } = useAuth();
  const isLoggedIn = !!user && !!profile;

  useEffect(() => {
    if (!isLoggedIn) {
      clearDashboardDataCache();
      clearMCUDashboardData();
      return;
    }

    const role = profile?.role || '';
    void preloadDashboardData({
      canViewMCU: ['pic', 'administrator', 'superuser'].includes(role),
      canViewInventory: ['administrator', 'superuser'].includes(role),
    }).catch(error => {
      console.error('Gagal memuat data awal dashboard:', error);
    });
  }, [isLoggedIn, profile?.role]);

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
    case 'monitoring': return <MonitoringMCUTabs />;
    case 'tindak-lanjut': return <MonitoringMCUTabs initialTab="tindak-lanjut" />;
    case 'layanan-kuratif': return <LayananKuratifTabs />;
    case 'kunjungan': return <LayananKuratifTabs initialTab="kunjungan" />;
    case 'inventory-dashboard': return <LayananKuratifTabs initialTab="inventory" />;
    case 'prokawan-dashboard': return <ProKawanDashboard />;
    case 'spip': return <SPIPDashboard />;
    case 'higiene-industri': return <HigieneIndustriTabs />;
    case 'hearing-dashboard': return <HigieneIndustriTabs initialTab="hearing" />;
    case 'ergonomi-dashboard': return <HigieneIndustriTabs initialTab="ergonomi" />;
    // SDS-30 = faktor psikologi lingkungan kerja → bagian Higiene Industri.
    case 'mental-health-dashboard': return <MentalHealthDashboard />;
    case 'pemetaan-psikologis': return <HigieneIndustriTabs initialTab="psikologi" />;
    default: return <DashboardView />;
  }
}

/*   Admin Toggle Panel — form/table switcher with smart rotating arrow */

/**
 * Review MCU — input hasil pemeriksaan.
 *
 * Tab "Follow Up MCU" DIHAPUS: tindak lanjut sekarang dicatat di satu tempat,
 * yaitu menu ProKawan (tabel followups_prokawan), agar baseline MCU dan hasil
 * tindak lanjut tidak terpisah di dua sumber.
 */
function ReviewMCUWithTabs() {
  return (
    <div
      className="admin-form-container"
      style={{ width: '90%', margin: '0 auto', padding: 16, overflow: 'hidden', flex: 1, minHeight: 0 }}
    >
      <ReviewMCU />
    </div>
  );
}

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

  // Kelola Pengguna kini menjadi tab di dalam menu Pengaturan.
  if (activeAdminSidebar === 'pengaturan' || activeAdminSidebar === 'kelola-pengguna') {
    return <div className="admin-form-container"><AppSettingsPage /></div>;
  }

  if (activeAdminSidebar === 'layanan-kuratif-admin') {
    return <AdminLayananKuratif />;
  }

  if (activeAdminSidebar === 'higiene-industri-admin') {
    return <AdminHigieneIndustri />;
  }

  if (activeAdminSidebar === 'pak-register') {
    return <PakRegister />;
  }

  if (activeAdminSidebar === 'prokawan-admin') {
    return <AdminProKawan />;
  }

  if (activeAdminSidebar === 'karyawan-sakit') {
    return <MonitoringKaryawanSakit />;
  }

  if (activeAdminSidebar === 'sarana-klinik') {
    return <SaranaKlinik />;
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
      labels: ['Form Input', 'DATABASE'],
      form: <ReviewMCUWithTabs />,
      tables: [<div className="admin-form-container" key="mcu"><RecordMCUTable /></div>],
    },
    'health-campaign': {
      hasTable: false,
      form: <HealthCampaignForm />,
      tables: [],
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login"|"register">("login");
  const [regNik, setRegNik] = useState("");
  const [regNama, setRegNama] = useState("");
  const [regJabatan, setRegJabatan] = useState("");
  const [regJobsite, setRegJobsite] = useState("");
  const [regEmployee, setRegEmployee] = useState<{
    nama: string;
    job_position: string;
    site_name: string;
    lookupToken: string;
  } | null>(null);
  const [regCandidates, setRegCandidates] = useState<NonNullable<typeof regEmployee>[]>([]);
  const [regLookupStatus, setRegLookupStatus] = useState<'idle' | 'searching' | 'found' | 'select' | 'not_found' | 'error'>('idle');
  const [regLookupError, setRegLookupError] = useState('');
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  useEffect(() => {
    const query = regNik.trim();
    const searchBy = /^\d{16}$/.test(query)
      ? 'national_id'
      : /^\d+$/.test(query)
        ? 'nik'
        : 'nama';
    const isSearchable = searchBy === 'national_id'
      || (searchBy === 'nik' && /^\d{4,15}$/.test(query))
      || (searchBy === 'nama' && query.length >= 3);

    setRegEmployee(null);
    setRegCandidates([]);
    if (!isSearchable) {
      setRegLookupStatus('idle');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRegLookupStatus('searching');
      setRegLookupError('');
      try {
        const response = await fetch('/api/employee/register-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, searchBy }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (response.status === 404) {
          setRegLookupStatus('not_found');
          setRegLookupError(payload.error || 'Karyawan tidak ditemukan.');
          return;
        }
        if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
          throw new Error(payload.error || 'Karyawan tidak ditemukan.');
        }
        if (controller.signal.aborted) return;
        const employees = payload.data.filter((employee: NonNullable<typeof regEmployee>) =>
          employee.lookupToken && employee.nama,
        );
        if (employees.length === 0) {
          setRegLookupStatus('not_found');
          setRegLookupError('Data karyawan belum lengkap untuk pendaftaran.');
          return;
        }
        if (employees.length === 1) {
          const employee = employees[0];
          setRegEmployee(employee);
          setRegNama(employee.nama);
          setRegJabatan(employee.job_position || '');
          setRegJobsite(employee.site_name || '');
          setRegLookupStatus('found');
        } else {
          setRegCandidates(employees);
          setRegLookupStatus('select');
        }
      } catch (lookupError) {
        if (controller.signal.aborted) return;
        setRegLookupStatus('error');
        setRegLookupError(lookupError instanceof Error ? lookupError.message : 'Lookup karyawan gagal.');
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [regNik]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regLookupStatus !== 'found' || !regEmployee) {
      setError('Pastikan data karyawan berhasil ditemukan sebelum mendaftar.');
      return;
    }
    setLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.session) {
        setError(payload.error || 'Login gagal.');
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      if (returnTo?.startsWith('/kuesioner')) {
        window.location.assign(returnTo);
      } else {
        setUsername('');
        setPassword('');
        onClose();
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Terjadi kesalahan. Coba lagi.');
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
          <p className="login-card-subtitle">{mode === 'login' ? 'Masuk dengan email atau identitas karyawan' : 'Daftar akun baru'}</p>

          {mode === 'login' ? (
          <>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="login-input-group">
              <label className="login-input-label">NIK Karyawan / National ID / Email</label>
              <input
                type="text"
                className="login-input"
                placeholder="NIK Karyawan, NIK KTP, atau email"
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
            Perlu akses petugas?{' '}
            <button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: '#ff4d00', fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: 0 }}>
              Daftar di sini
            </button>
          </p>
          <p className="login-footer-text" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            Employee dapat login dengan NIK Karyawan atau National ID. Akun dibuat otomatis pada login pertama;
            gunakan password awal dari administrator, lalu ganti password untuk melanjutkan.
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
                  employee_lookup_token: regEmployee?.lookupToken,
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
              <label className="login-input-label">Cari NIK KTP, NIK Karyawan, atau Nama *</label>
              <input
                type="text"
                className="login-input"
                placeholder="NIK KTP, NIK Karyawan, atau Nama"
                value={regNik}
                onChange={(e) => {
                  const val = e.target.value;
                  setRegNik(val);
                  setRegEmployee(null);
                  setRegCandidates([]);
                  setRegNama('');
                  setRegJabatan('');
                  setRegJobsite('');
                  setRegLookupStatus('idle');
                  setRegLookupError('');
                }}
              />
              {regLookupStatus === 'searching' && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>Memeriksa data karyawan…</div>
              )}
              {regLookupStatus === 'select' && (
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Beberapa karyawan cocok. Pilih yang sesuai:</span>
                  {regCandidates.map((employee) => (
                    <button
                      key={employee.lookupToken}
                      type="button"
                      onClick={() => {
                        setRegEmployee(employee);
                        setRegNama(employee.nama);
                        setRegJabatan(employee.job_position || '');
                        setRegJobsite(employee.site_name || '');
                        setRegLookupStatus('found');
                        setRegLookupError('');
                      }}
                      style={{
                        padding: '8px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 7,
                        background: 'var(--background)',
                        color: 'var(--foreground)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <strong>{employee.nama}</strong>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {employee.job_position} · {employee.site_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {regNama && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '4px 8px', borderRadius: 6 }}>
                  ✓ {regNama} — {regJabatan} — {regJobsite}
                </div>
              )}
              {regLookupError && (
                <div role="status" style={{ marginTop: 6, fontSize: 11, color: '#dc2626' }}>{regLookupError}</div>
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
  // Selector terpisah: referensi setter stabil, sehingga dependensi useCallback di bawah
  // eksplisit (tidak bergantung pada objek store yang dibuat ulang tiap render).
  const setActiveHomeSidebar = useMCUStore((s) => s.setActiveHomeSidebar);
  const setActiveDashSidebar = useMCUStore((s) => s.setActiveDashSidebar);
  const setActiveDataEntrySidebar = useMCUStore((s) => s.setActiveDataEntrySidebar);
  const setActiveAdminSidebar = useMCUStore((s) => s.setActiveAdminSidebar);
  const { theme, setTheme } = useTheme();
  const { user, profile, loading: authLoading, isAdmin, isSuperuser, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const activePage = role === 'employee' ? 'home' : store.activePage;

  const isLoggedIn = !!user && !!profile;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1') {
      const timer = setTimeout(() => setShowLogin(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  // Employee accounts are limited to Home and questionnaire routes.
  useEffect(() => {
    if (authLoading) return;
    if (role === 'employee' && store.activePage !== 'home') {
      store.setActivePage('home');
      return;
    }
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
    if (page === 'home') setActiveHomeSidebar('semua-feed');
    else if (page === 'dashboard') setActiveDashSidebar('statistik');
    else if (page === 'data-entry') setActiveDataEntrySidebar('input-jadwal-mcu');
    else if (page === 'administrator') setActiveAdminSidebar('lagging-indicator');
  }, [setActiveHomeSidebar, setActiveDashSidebar, setActiveDataEntrySidebar, setActiveAdminSidebar]);

  useEffect(() => {
    resetSidebar(activePage);
  }, [activePage, resetSidebar]);

  // Role-based header nav
  const headerNav = ALL_HEADER_NAV.filter((item) => {
    if (role === 'employee') return item.key === 'home';
    if (item.key === 'administrator') return ['administrator', 'superuser'].includes(role || '');
    if (item.key === 'data-entry') return ['pic', 'administrator', 'superuser', 'manager'].includes(role || '');
    return true;
  });

  // Role-based sidebar items
  const getSidebarItems = (): SidebarItem[] => {
    if (activePage === 'home') return HOME_SIDEBAR;
    if (activePage === 'dashboard') {
      return DASH_SIDEBAR.filter((item) => {
        if (item.adminOnly && !['administrator', 'superuser'].includes(role || '')) return false;
        if (item.approverOnly && !['manager', 'superuser'].includes(role || '')) return false;
        if (item.superuserOnly && !isSuperuser) return false;
        return true;
      });
    }
    if (activePage === 'data-entry') {
      return DATA_ENTRY_SIDEBAR.filter((item) => {
        if (item.approverOnly && !['manager', 'superuser'].includes(role || '')) return false;
        return true;
      });
    }
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

  // Konten di-remount hanya saat halaman/menu sidebar berganti. Home mengatur tab-nya sendiri.
  const pageTransitionKey = activePage === 'home' ? 'home' : `${activePage}:${activeSidebarKey}`;

  const handleNav = (tab: PageTab) => {
    if (role === 'employee' && tab !== 'home') return;
    // Prevent non-admins from going to administrator
    if (tab === 'administrator' && !['administrator', 'superuser'].includes(role || '')) return;
    if (tab === 'data-entry' && !['pic', 'administrator', 'superuser', 'manager'].includes(role || '')) return;
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
  const roleLabel = profile?.role === 'superuser' ? 'Superuser'
    : profile?.role === 'administrator' ? 'Administrator'
      : profile?.role === 'pic' ? 'PIC'
        : profile?.role === 'employee' ? 'Employee'
          : profile?.role === 'manager' ? 'Manager' : 'Viewer';

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
              <NotificationBell
                isSuperuser={isSuperuser}
                // Notifikasi tindak lanjut hanya untuk QSHE Medic.
                canMedic={['superuser', 'administrator', 'pic'].includes(role ?? '')}
              />
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
          {/*
            Transisi halaman tanpa kedip: konten lama diganti langsung oleh konten baru
            (tidak ada fase "kosong" seperti AnimatePresence mode="wait"), lalu konten baru
            hanya melakukan fade/slide masuk yang sangat singkat lewat CSS.
          */}
          <div
            key={pageTransitionKey}
            className="page-transition"
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}
          >
            {activePage === 'home' ? <HomeContent />
              : activePage === 'dashboard' ? <DashContent />
              : activePage === 'data-entry' ? <DataEntryContent />
              : activePage === 'administrator' ? <AdminContent />
              : null}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLogin && <LoginPopup onClose={() => setShowLogin(false)} />}
      </AnimatePresence>
    </div>
  );
}
