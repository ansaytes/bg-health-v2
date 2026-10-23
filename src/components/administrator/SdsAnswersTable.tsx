'use client';

// Tabel data jawaban SDS-30 — HANYA untuk superuser & administrator.
// Menampilkan jawaban per item (1–7) beserta skor indikator yang dihitung
// otomatis oleh sistem, sehingga petugas tidak perlu menghitung manual.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

import { questionnaireAuthHeaders } from '@/components/questionnaire/QuestionnaireUI';
import { SDS_SECTIONS } from '@/lib/questionnaire-items';

interface AnswerRow {
  tanggal: string;
  nama: string;
  nik: string;
  department: string;
  jabatan: string;
  site: string;
  jawaban: (number | null)[];
  indikator: { id: string; title: string; skor: number; terisi: number; rata: number; tingkat: string }[];
  indeks: number | null;
  ringkasan: string;
}

const TINGKAT_TEXT: Record<string, string> = {
  RINGAN: '#00895f',
  SEDANG: '#b06a00',
  BERAT: '#c0392b',
};

export default function SdsAnswersTable() {
  const [rows, setRows] = useState<AnswerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await questionnaireAuthHeaders();
      const res = await fetch('/api/mental-health/sds-answers?limit=200', { headers });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Gagal memuat data jawaban.');
      setRows(body.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data jawaban.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      `${r.nama} ${r.nik} ${r.department} ${r.jabatan} ${r.site}`.toLowerCase().includes(term));
  }, [rows, search]);

  const rataIndikator = useMemo(() => {
    if (!filtered.length) return null;
    return SDS_SECTIONS.map((section) => {
      const values = filtered
        .map((r) => r.indikator.find((i) => i.id === section.id)?.skor ?? null)
        .filter((v): v is number => typeof v === 'number');
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { id: section.id, title: section.title, rata: Number(avg.toFixed(2)) };
    });
  }, [filtered]);

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1,
    padding: '5px 4px', borderBottom: '1px solid var(--border)',
    fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.03em',
    color: 'var(--muted-foreground)', fontWeight: 700, whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '4px 4px', borderBottom: '1px solid var(--border)', fontSize: 10.5,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Data Jawaban SDS-30</h2>
          <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
            {filtered.length} pengisian · skor indikator dihitung otomatis (6 × 5 item)
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="mcu-records-search" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <Search size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIK, departemen…"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11.5, color: 'var(--foreground)', width: 190 }}
            />
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="mcu-dashboard-refresh"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', minWidth: 120 }}>Tanggal</th>
              <th style={{ ...th, textAlign: 'left', minWidth: 150 }}>Karyawan</th>
              <th style={{ ...th, textAlign: 'left' }}>Departemen</th>
              <th style={{ ...th, textAlign: 'center' }}>Indeks</th>
              {Array.from({ length: 30 }, (_, i) => (
                <th key={i} style={{ ...th, textAlign: 'center', minWidth: 20 }}>{i + 1}</th>
              ))}
              {SDS_SECTIONS.map((s) => (
                <th key={s.id} style={{ ...th, textAlign: 'center', minWidth: 34 }} title={s.title}>
                  {s.title.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={`${r.nik}-${r.tanggal}-${idx}`}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.tanggal}</td>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.nama}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{r.nik} · {r.jabatan}</div>
                </td>
                <td style={{ ...td, fontSize: 10 }}>{r.department || r.site || '—'}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{r.indeks ?? '—'}</td>
                {r.jawaban.map((v, i) => (
                  <td key={i} style={{ ...td, textAlign: 'center', color: v === null ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                    {v ?? '·'}
                  </td>
                ))}
                {r.indikator.map((ind) => (
                  <td
                    key={ind.id}
                    title={`${ind.title}: ${ind.skor}/35 (${ind.tingkat})`}
                    style={{ ...td, textAlign: 'center', fontWeight: 700, color: TINGKAT_TEXT[ind.tingkat] }}
                  >
                    {ind.skor}
                  </td>
                ))}
              </tr>
            ))}
            {!filtered.length && !loading && (
              <tr>
                <td colSpan={4 + 30 + SDS_SECTIONS.length} style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                  Belum ada data jawaban SDS-30.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rataIndikator && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10.5 }}>
          {rataIndikator.map((i) => (
            <span key={i.id} style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--accent)', border: '1px solid var(--border)' }}>
              <b>{i.title}</b>: rata-rata {i.rata}/35
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
