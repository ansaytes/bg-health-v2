'use client';

// ============================================================
// Administrator > Program Inspeksi — RENCANA inspeksi
// ============================================================
//
// Halaman ini adalah sumber data untuk tiga metrik di dashboard:
//   • Completion rate  (selesai ÷ target)
//   • On-time vs late  (tanggal selesai vs tanggal rencana)
//   • Missed alert     (rencana lewat tanpa laporan)
//
// Alurnya sengaja sederhana: pilih site & periode → "Buat rencana periode"
// menghasilkan satu baris per objek (dari katalog modul masing-masing) →
// petugas menandai "Selesai" saat pemeriksaan benar-benar dilakukan.
//
// Status "terlewat" TIDAK disimpan; dihitung dari tanggal rencana, sehingga
// daftar selalu akurat tanpa proses latar belakang.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Plus, RefreshCw, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useSites } from '@/lib/site-list';
import { useMCUStore } from '@/lib/store';
import { usePopup, Popup } from '@/lib/popup';
import {
  FREKUENSI_HARI_BAWAAN,
  JENIS_INSPEKSI_LIST,
  JENIS_META,
  WARNA_KINERJA,
  labelFrekuensi,
  labelPeriode,
  periodeBulan,
  ringkasProgram,
  tanggalISO,
  type BarisJadwal,
  type JenisInspeksi,
} from '@/lib/inspeksi-program';

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  periode: string;
  daftarSite: string[];
  jadwal: (BarisJadwal & { status_efektif: string; petugas_nama?: string | null })[];
}

const STATUS_STYLE: Record<string, { label: string; warna: string; bg: string }> = {
  selesai: { label: 'Selesai', warna: '#00614f', bg: 'rgba(0,184,148,0.12)' },
  rencana: { label: 'Rencana', warna: '#1f5f9b', bg: 'rgba(52,152,219,0.12)' },
  terlewat: { label: 'Terlewat', warna: '#a01818', bg: 'rgba(255,45,45,0.12)' },
  dibatalkan: { label: 'Dibatalkan', warna: '#5b6570', bg: 'rgba(119,136,153,0.15)' },
};

export default function ProgramInspeksi() {
  const { isAdmin } = useAuth();
  const store = useMCUStore();
  const { popup, popupState, closePopup } = usePopup();

  const [periode, setPeriode] = useState(periodeBulan());
  const [site, setSite] = useState('');
  const [jenis, setJenis] = useState<JenisInspeksi | ''>('');
  const [data, setData] = useState<Data | null>(null);
  const { sites: daftarSite } = useSites();
  const [loading, setLoading] = useState(false);
  const [bekerja, setBekerja] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ periode });
      if (site) qs.set('site', site);
      if (jenis) qs.set('jenis', jenis);
      const hasil = await authFetch(`/api/inspeksi/jadwal?${qs.toString()}`) as unknown as Data;
      setData(hasil);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat jadwal inspeksi');
    } finally {
      setLoading(false);
    }
  }, [periode, site, jenis]);

  useEffect(() => { void load(); }, [load]);

  const ringkas = useMemo(
    () => ringkasProgram((data?.jadwal ?? []) as BarisJadwal[]),
    [data],
  );

  const aksi = async (body: Record<string, unknown>, pesanSukses: string) => {
    setBekerja(true);
    try {
      await authFetch('/api/inspeksi/jadwal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      store.showToast(pesanSukses, 'success');
      await load();
    } catch (e) {
      popup({
        type: 'error',
        title: 'Gagal memproses',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setBekerja(false);
    }
  };

  const buatRencana = () => {
    if (!site) {
      popup({ type: 'info', title: 'Pilih site', message: 'Pilih site terlebih dahulu agar rencana inspeksi bisa dibuat.' });
      return;
    }
    popup({
      type: 'confirm',
      title: `Buat rencana inspeksi ${labelPeriode(periode)}?`,
      message: `Satu jadwal akan dibuat untuk setiap objek pada site ${site}. Jadwal yang sudah ada tidak diduplikasi.`,
      confirmLabel: 'Buat rencana',
      onOk: () => aksi(
        { aksi: 'generate', periode, site, jenis: jenis ? [jenis] : undefined },
        'Rencana inspeksi dibuat',
      ),
    });
  };

  return (
    <div className="admin-form-container" style={{ padding: 16, overflow: 'auto' }}>
      <div className="mcu-records-card">
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">PROGRAM INSPEKSI</div>
            <h3>Rencana & Pelaksanaan Inspeksi</h3>
          </div>
          <div className="mcu-records-actions">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span>Periode</span>
              <input
                type="month"
                value={periode}
                onChange={e => setPeriode(e.target.value || periodeBulan())}
                style={{ height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span>Site</span>
              <select
                value={site}
                onChange={e => setSite(e.target.value)}
                style={{ height: 28, minWidth: 130, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
              >
                <option value="">Semua site</option>
                {daftarSite.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span>Jenis</span>
              <select
                value={jenis}
                onChange={e => setJenis(e.target.value as JenisInspeksi | '')}
                style={{ height: 28, minWidth: 150, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
              >
                <option value="">Semua jenis</option>
                {JENIS_INSPEKSI_LIST.map(j => <option key={j} value={j}>{JENIS_META[j].label}</option>)}
              </select>
            </label>
            <button type="button" className="mcu-dashboard-refresh" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {isAdmin && (
              <Button size="sm" onClick={buatRencana} disabled={bekerja}>
                <Plus size={14} className="mr-1" /> Buat rencana periode
              </Button>
            )}
          </div>
        </div>

        {error && <div style={{ padding: '8px 12px', fontSize: 11, color: '#b3261e' }}>{error}</div>}

        {data && !data.tabelSiap ? (
          <div style={{ padding: 16, fontSize: 12, color: '#9a6b00' }}>
            {data.catatan}
          </div>
        ) : (
          <>
            {/* Ringkasan periode */}
            <div className="mcu-records-toolbar" style={{ gap: 18 }}>
              <div className="mcu-records-toolbar-title">
                <CalendarClock size={14} /> {labelPeriode(periode)}
              </div>
              <span style={{ fontSize: 11 }} title="Jumlah kewajiban inspeksi bulan ini = jumlah objek × frekuensinya">
                Target <b>{ringkas.target}</b>
              </span>
              <span style={{ fontSize: 11 }}>
                Selesai <b style={{ color: WARNA_KINERJA[ringkas.warnaSelesai] }}>{ringkas.selesai}</b>
              </span>
              <span style={{ fontSize: 11 }}>
                Terlewat <b style={{ color: ringkas.terlewat ? WARNA_KINERJA.merah : 'inherit' }}>{ringkas.terlewat}</b>
              </span>
              <span style={{ fontSize: 11 }}>
                Penyelesaian{' '}
                <b style={{ color: WARNA_KINERJA[ringkas.warnaSelesai] }}>{ringkas.persenSelesai}%</b>
              </span>
              <span style={{ fontSize: 11 }}>
                Tepat waktu <b>{ringkas.persenTepatWaktu}%</b>
              </span>
            </div>

            <div className="mcu-records-table-wrap">
              <table className="mcu-records-table">
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>No</th>
                    <th style={{ width: 190 }}>Jenis</th>
                    <th style={{ width: 130 }}>Site</th>
                    <th>Objek</th>
                    <th style={{ width: 105 }}>Rencana</th>
                    <th style={{ width: 105 }}>Selesai</th>
                    <th style={{ width: 105 }}>Status</th>
                    <th style={{ width: 140 }}>Petugas</th>
                    {isAdmin && <th style={{ width: 130 }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr><td colSpan={isAdmin ? 9 : 8} style={{ padding: 30, textAlign: 'center' }}>Memuat…</td></tr>
                  ) : (data?.jadwal ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 8} style={{ padding: 30, textAlign: 'center', fontSize: 12 }}>
                        Belum ada jadwal untuk periode ini.
                        {isAdmin && ' Pilih site lalu klik “Buat rencana periode”.'}
                      </td>
                    </tr>
                  ) : (data?.jadwal ?? []).map((b, i) => {
                    const st = STATUS_STYLE[b.status_efektif] ?? STATUS_STYLE.rencana;
                    return (
                      <tr key={String(b.id ?? i)}>
                        <td className="mcu-records-index">{i + 1}</td>
                        <td>{JENIS_META[b.jenis as JenisInspeksi]?.label ?? b.jenis}</td>
                        <td>{b.site ?? '—'}</td>
                        <td title={b.objek_nama ?? ''}>{b.objek_nama ?? '—'}</td>
                        <td>{b.tanggal_rencana ?? '—'}</td>
                        <td>{b.tanggal_selesai ?? '—'}</td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '2px 7px', borderRadius: 5,
                            fontSize: 10, fontWeight: 700, color: st.warna, background: st.bg,
                          }}>
                            {st.label}
                          </span>
                        </td>
                        <td title={b.petugas ?? ''}>{b.petugas_nama ?? b.petugas ?? '—'}</td>
                        {isAdmin && (
                          <td className="mcu-records-action">
                            {b.status_efektif !== 'selesai' && b.status_efektif !== 'dibatalkan' ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  disabled={bekerja}
                                  onClick={() => aksi(
                                    {
                                      aksi: 'selesai',
                                      id: b.id,
                                      tanggal_selesai: tanggalISO(new Date()),
                                    },
                                    'Inspeksi ditandai selesai',
                                  )}
                                  title="Tandai inspeksi selesai hari ini — petugas otomatis dari akun yang login"
                                >
                                  <Check size={13} /> Selesai
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  disabled={bekerja}
                                  onClick={() => aksi({ aksi: 'batal', id: b.id }, 'Jadwal dibatalkan')}
                                  title="Batalkan jadwal ini"
                                >
                                  <RotateCcw size={13} />
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '8px 0 0' }}>
              Status “Terlewat” dihitung otomatis: jadwal yang belum selesai setelah tanggal rencana
              (mulai H+1). Jadwal yang dibatalkan tidak dihitung dalam target.
              Kolom Petugas terisi otomatis dari akun yang menekan “Selesai” dan tidak dapat diubah.
              <b>Frekuensi</b> menentukan berapa kali objek harus diperiksa dalam sebulan:{' '}
              {JENIS_INSPEKSI_LIST.map(j => (
                `${JENIS_META[j].label} ${labelFrekuensi(FREKUENSI_HARI_BAWAAN[j])}`
              )).join(' · ')}.
              Contoh: P3K bulanan → 1 jadwal/bulan; kalibrasi tahunan → hanya muncul di bulan Januari.
            </p>
          </>
        )}
      </div>
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
