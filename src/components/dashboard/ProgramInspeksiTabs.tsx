'use client';

// ============================================================
// Dashboard > Program Inspeksi (dua sudut pandang, satu menu)
// ============================================================
//
// Menu ini menggabungkan dua dashboard yang sebelumnya terpisah, karena
// keduanya sama-sama soal inspeksi aset kesehatan kerja tetapi mengukur hal
// yang BERBEDA dan saling melengkapi:
//
//   Tab 1 — EKSEKUSI
//     Apakah tim sudah memeriksa tepat waktu?
//     Sumber: inspeksi_jadwal + pica.
//     Completion rate, on-time vs late, blindspot, MTTR PICA, beban petugas.
//
//   Tab 2 — KONDISI ASET  (dulu menu "SPIP")
//     Apakah barangnya ada dan layak?
//     Sumber: sarana_katalog + sarana_site.
//     Kelengkapan, kelayakan, item rusak/belum tersedia, peringkat per site.
//
// Keduanya bisa berbeda arah: jadwal kontrol bisa 100% tepat waktu sementara
// banyak alat rusak — atau sebaliknya. Karena itu tidak saling menggantikan.
//
// KALIBRASI hanya muncul di tab Eksekusi (countdown H-60 + daftar jatuh tempo
// per alat). Versi di SPIP sudah dihapus agar tidak ada dua angka untuk satu
// data yang sama.

import { useState } from 'react';

import InspeksiDashboard from '@/components/dashboard/InspeksiDashboard';
import SPIPDashboard from '@/components/dashboard/SPIPDashboard';
import CenteredTabs from '@/components/ui/centered-tabs';

type Tab = 'eksekusi' | 'kondisi-aset';

const TABS: { key: Tab; label: string }[] = [
  { key: 'eksekusi', label: 'Eksekusi & PICA' },
  { key: 'kondisi-aset', label: 'Kondisi Aset' },
];

export default function ProgramInspeksiTabs({ initialTab = 'eksekusi' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Program Inspeksi" />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'eksekusi' ? <InspeksiDashboard /> : <SPIPDashboard />}
      </div>
    </div>
  );
}
