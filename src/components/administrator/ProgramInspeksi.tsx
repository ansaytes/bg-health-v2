'use client';

// ============================================================
// Administrator > Perencanaan Jadwal Inspeksi
// ============================================================
// Halaman operasional untuk MENETAPKAN TARGET & TANGGAL RENCANA inspeksi:
//   • Buat rencana periode bulanan per site secara otomatis
//   • Tambah jadwal inspeksi khusus / ad-hoc dengan tanggal rencana tertentu
//   • Realisasi tercatat 100% otomatis saat checklist lapangan diisi
//
// Catatan: Grafik, metrik kepatuhan, MTTR, dan analisis KPI makro
//          berada di Menu Dashboard → Program Inspeksi.

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, Info, Plus, RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useSites } from '@/lib/site-list';
import { useMCUStore } from '@/lib/store';
import { usePopup, Popup } from '@/lib/popup';
import {
  FREKUENSI_HARI_BAWAAN,
  JENIS_INSPEKSI_LIST,
  JENIS_META,
  labelFrekuensi,
  labelPeriode,
  periodeBulan,
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

  // Modal Tambah Jadwal Khusus
  const [modalBuka, setModalBuka] = useState(false);
  const [tambahJenis, setTambahJenis] = useState<JenisInspeksi>('p3k');
  const [tambahSite, setTambahSite] = useState('');
  const [tambahObjek, setTambahObjek] = useState('');
  const [tambahTanggal, setTambahTanggal] = useState(tanggalISO(new Date()));
  const [tambahCatatan, setTambahCatatan] = useState('');

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
      popup({ type: 'info', title: 'Pilih Site', message: 'Pilih site terlebih dahulu agar target rencana inspeksi bisa dibuat.' });
      return;
    }
    popup({
      type: 'confirm',
      title: `Buat Target Rencana ${labelPeriode(periode)}?`,
      message: `Jadwal rencana inspeksi bulanan akan dibuat untuk setiap fasilitas di site ${site}. Rencana yang sudah ada tidak akan diduplikasi.`,
      confirmLabel: 'Buat Rencana Periode',
      onOk: () => aksi(
        { aksi: 'generate', periode, site, jenis: jenis ? [jenis] : undefined },
        'Rencana inspeksi periode berhasil dibuat',
      ),
    });
  };

  const simpanJadwalKhusus = async () => {
    if (!tambahSite) {
      store.showToast('Pilih site terlebih dahulu', 'error');
      return;
    }
    if (!tambahTanggal) {
      store.showToast('Tentukan tanggal rencana', 'error');
      return;
    }
    await aksi(
      {
        aksi: 'tambah',
        jenis: tambahJenis,
        site: tambahSite,
        objek_nama: tambahObjek.trim() || JENIS_META[tambahJenis].label,
        tanggal_rencana: tambahTanggal,
        catatan: tambahCatatan.trim(),
      },
      'Jadwal inspeksi khusus berhasil ditambahkan',
    );
    setModalBuka(false);
    setTambahObjek('');
    setTambahCatatan('');
  };

  return (
    <div className="admin-form-container" style={{ padding: 16, overflow: 'auto' }}>
      <div className="mcu-records-card">
        {/* Header Toolbar Perencanaan */}
        <div className="mcu-records-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="mcu-records-kicker">FORM ADMINISTRASI OPERASIONAL</div>
            <h3 style={{ fontSize: 15, margin: 0 }}>Perencanaan Jadwal Inspeksi Lapangan</h3>
          </div>
          <div className="mcu-records-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
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
                style={{ height: 28, minWidth: 120, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
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
                style={{ height: 28, minWidth: 140, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
              >
                <option value="">Semua jenis</option>
                {JENIS_INSPEKSI_LIST.map(j => <option key={j} value={j}>{JENIS_META[j].label}</option>)}
              </select>
            </label>
            <button type="button" className="mcu-dashboard-refresh" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {isAdmin && (
              <>
                <Button size="sm" onClick={buatRencana} disabled={bekerja}>
                  <Plus size={14} className="mr-1" /> Buat Rencana Periode
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setTambahSite(site || daftarSite[0] || ''); setModalBuka(true); }} disabled={bekerja}>
                  <Plus size={14} className="mr-1" /> Jadwal Khusus
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Banner Penjelasan Alur Digitalisasi */}
        <div style={{ margin: '8px 0 12px', padding: '8px 12px', fontSize: 10.5, color: 'var(--muted-foreground)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--muted)/25', borderRadius: 8, borderLeft: '3px solid #00B894' }}>
          <Check size={14} color="#00B894" style={{ flexShrink: 0 }} />
          <div>
            <b>Realisasi Otomatis dari Checklist:</b> Saat petugas mengisi tanggal pelaksanaan pada tab <i>Sarana Klinik</i>, <i>Kotak P3K</i>, <i>Ambulans</i>, atau <i>Sarana Ergonomi</i>, jadwal terkait langsung ditandai <b>Selesai</b> bersama identitas pemeriksa tanpa perlu dicatat ulang.
            <div style={{ marginTop: 2, color: 'var(--primary)', fontSize: 10 }}>
              💡 Untuk melihat grafik capaian KPI, kepatuhan on-time, MTTR, dan tren inspeksi, silakan buka <b>Menu Dashboard → Program Inspeksi</b>.
            </div>
          </div>
        </div>

        {error && <div style={{ padding: '8px 12px', fontSize: 11, color: '#b3261e' }}>{error}</div>}

        {/* Modal Dialog Tambah Jadwal Khusus */}
        {modalBuka && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12, border: '1px solid var(--primary)', background: 'var(--card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Tambah Jadwal Rencana Inspeksi Khusus</h4>
              <button type="button" onClick={() => setModalBuka(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2" style={{ marginBottom: 8 }}>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Jenis Inspeksi</span>
                <select
                  value={tambahJenis}
                  onChange={e => setTambahJenis(e.target.value as JenisInspeksi)}
                  className="h-8 rounded-lg border-input bg-background px-2 text-sm"
                >
                  {JENIS_INSPEKSI_LIST.map(j => <option key={j} value={j}>{JENIS_META[j].label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Site</span>
                <select
                  value={tambahSite}
                  onChange={e => setTambahSite(e.target.value)}
                  className="h-8 rounded-lg border-input bg-background px-2 text-sm"
                >
                  {daftarSite.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Target Tanggal Rencana</span>
                <Input
                  type="date"
                  value={tambahTanggal}
                  onChange={e => setTambahTanggal(e.target.value)}
                  className="h-8 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Nama Objek / Lokasi</span>
                <Input
                  value={tambahObjek}
                  onChange={e => setTambahObjek(e.target.value)}
                  placeholder="mis. Kotak P3K Pit West"
                  className="h-8 text-sm"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Button size="sm" variant="outline" onClick={() => setModalBuka(false)}>Batal</Button>
              <Button size="sm" onClick={() => void simpanJadwalKhusus()} disabled={bekerja}>
                <Check size={13} className="mr-1" /> Simpan Target Jadwal
              </Button>
            </div>
          </div>
        )}

        {/* Tabel Daftar Rencana & Realisasi */}
        <div className="mcu-records-table-wrap">
          <table className="mcu-records-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>No</th>
                <th style={{ width: 170 }}>Jenis Fasilitas</th>
                <th style={{ width: 120 }}>Site</th>
                <th>Objek / Sarana</th>
                <th style={{ width: 105 }}>Target Rencana</th>
                <th style={{ width: 105 }}>Tgl Realisasi</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 140 }}>Petugas Pemeriksa</th>
                {isAdmin && <th style={{ width: 110 }}>Aksi Cadangan</th>}
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={isAdmin ? 9 : 8} style={{ padding: 30, textAlign: 'center' }}>Memuat jadwal…</td></tr>
              ) : (data?.jadwal ?? []).length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ padding: 30, textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)' }}>
                    Belum ada rencana jadwal untuk periode ini.
                    {isAdmin && ' Klik tombol "Buat Rencana Periode" di atas untuk menetapkan target bulanan.'}
                  </td>
                </tr>
              ) : (data?.jadwal ?? []).map((b, i) => {
                const st = STATUS_STYLE[b.status_efektif] ?? STATUS_STYLE.rencana;
                return (
                  <tr key={String(b.id ?? i)}>
                    <td className="mcu-records-index">{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{JENIS_META[b.jenis as JenisInspeksi]?.label ?? b.jenis}</td>
                    <td>{b.site ?? '—'}</td>
                    <td title={b.objek_nama ?? ''}>{b.objek_nama ?? '—'}</td>
                    <td>{b.tanggal_rencana ?? '—'}</td>
                    <td style={{ color: b.tanggal_selesai ? '#00B894' : 'inherit', fontWeight: b.tanggal_selesai ? 600 : 'normal' }}>
                      {b.tanggal_selesai ?? '—'}
                    </td>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            disabled={bekerja}
                            onClick={() => aksi(
                              {
                                aksi: 'selesai',
                                id: b.id,
                                tanggal_selesai: tanggalISO(new Date()),
                              },
                              'Inspeksi ditandai selesai',
                            )}
                            title="Tandai selesai manual jika inspeksi dilakukan di luar checklist digital"
                          >
                            <Check size={11} className="mr-1" /> Selesai Manual
                          </Button>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Tercatat</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
