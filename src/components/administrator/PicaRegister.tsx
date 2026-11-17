'use client';

// ============================================================
// Administrator > Register PICA — temuan ketidaksesuaian
// ============================================================
//
// PICA adalah sisi "penutupan" dari inspeksi: setiap temuan harus punya
// penanggung jawab, tenggat, dan bukti selesai. Dashboard membaca tabel ini
// untuk MTTR, overdue, distribusi per departemen, dan temuan berulang.
//
// Tenggat bawaan mengikuti tingkat temuan (kritis 3 hari, mayor 14, minor 30),
// tetapi tetap bisa ditimpa manual — kesepakatan lapangan lebih mengikat
// daripada angka bawaan.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, CheckCircle2, XCircle, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useSites } from '@/lib/site-list';
import { useMCUStore } from '@/lib/store';
import { usePopup, Popup } from '@/lib/popup';
import {
  JENIS_INSPEKSI_LIST,
  JENIS_META,
  TENGGAT_PICA_HARI,
  durasiHari,
  picaOverdue,
  selisihHari,
  tanggalISO,
  type BarisPica,
} from '@/lib/inspeksi-program';

type Pica = BarisPica & Record<string, unknown> & { overdue?: boolean };

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  daftar: Pica[];
  daftarSite: string[];
  daftarDepartemen: string[];
}

const TINGKAT_STYLE: Record<string, { label: string; warna: string; bg: string }> = {
  kritis: { label: 'Kritis', warna: '#a01818', bg: 'rgba(255,45,45,0.12)' },
  mayor: { label: 'Mayor', warna: '#8a5200', bg: 'rgba(255,122,0,0.14)' },
  minor: { label: 'Minor', warna: '#1f5f9b', bg: 'rgba(52,152,219,0.12)' },
};

const STATUS_STYLE: Record<string, { label: string; warna: string; bg: string }> = {
  open: { label: 'Open', warna: '#a01818', bg: 'rgba(255,45,45,0.10)' },
  in_progress: { label: 'Dikerjakan', warna: '#8a5200', bg: 'rgba(255,122,0,0.14)' },
  closed: { label: 'Closed', warna: '#00614f', bg: 'rgba(0,184,148,0.12)' },
  dismissed: { label: 'Dismissed', warna: '#5b6570', bg: 'rgba(119,136,153,0.15)' },
};

// Mengikuti FORM-039 (BG-QSHE-FORM-039 Rev.000):
//   Jenis PICA · Lokasi · Penyimpangan/Deviasi · Foto · Akar Masalah ·
//   Tindakan Perbaikan · Dokumentasi · Tindakan Pencegahan ·
//   PIC Penanggung Jawab · PIC Tindak Lanjut · Batas Waktu · Inisiator
const FORM_KOSONG = {
  site: '',
  jenis_inspeksi: '',
  jenis_pica: '',
  lokasi: '',
  objek_nama: '',
  deskripsi: '',
  tingkat: 'minor',
  departemen: '',
  pic_nama: '',
  pic_tindak_lanjut: '',
  tanggal_dibuat: tanggalISO(new Date()),
  due_date: '',
  akar_masalah: '',
  tindakan: '',
  tindakan_pencegahan: '',
  foto_url: '',
  dokumentasi_url: '',
};

export default function PicaRegister() {
  const { isAdmin } = useAuth();
  const store = useMCUStore();
  const { popup, popupState, closePopup } = usePopup();

  const [data, setData] = useState<Data | null>(null);
  const { sites: daftarSite } = useSites();
  const [loading, setLoading] = useState(false);
  const [bekerja, setBekerja] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [cari, setCari] = useState('');
  const [formBuka, setFormBuka] = useState(false);
  const [form, setForm] = useState({ ...FORM_KOSONG });
  const [pratinjau, setPratinjau] = useState<{ total: number; perJenis: { label: string; jumlah: number }[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set('status', filterStatus);
      if (filterSite) qs.set('site', filterSite);
      const hasil = await authFetch(`/api/pica?${qs.toString()}`) as unknown as Data;
      setData(hasil);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat PICA');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSite]);

  useEffect(() => { void load(); }, [load]);

  // Pratinjau temuan yang akan menjadi PICA — dibaca, tidak menulis apa pun.
  const muatPratinjau = useCallback(async () => {
    try {
      const qs = filterSite ? `?site=${encodeURIComponent(filterSite)}` : '';
      const r = await authFetch(`/api/pica/otomatis${qs}`) as unknown as {
        total: number; perJenis: { label: string; jumlah: number }[];
      };
      setPratinjau(r);
    } catch {
      setPratinjau(null);
    }
  }, [filterSite]);

  useEffect(() => { void muatPratinjau(); }, [muatPratinjau, data]);

  const buatOtomatis = () => {
    const ringkasJenis = (pratinjau?.perJenis ?? [])
      .map(j => `${j.label}: ${j.jumlah}`)
      .join('\n');
    popup({
      type: 'confirm',
      title: 'Buat PICA dari temuan inspeksi?',
      message: pratinjau?.total
        ? `Temuan yang belum punya PICA aktif:\n${ringkasJenis}\n\nTenggat otomatis: tidak ada (kritis) 3 hari, rusak (mayor) 14 hari.`
        : 'Tidak ada temuan yang belum punya PICA aktif.',
      confirmLabel: 'Buat PICA',
      onOk: async () => {
        setBekerja(true);
        try {
          const r = await authFetch('/api/pica/otomatis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site: filterSite || undefined }),
          }) as unknown as { dibuat: number; dilewati: number; pesan?: string };
          store.showToast(r.pesan || `${r.dibuat} PICA dibuat`, r.dibuat ? 'success' : 'info');
          await load();
        } catch (e) {
          popup({ type: 'error', title: 'Gagal membuat PICA', message: e instanceof Error ? e.message : 'Coba lagi.' });
        } finally {
          setBekerja(false);
        }
      },
    });
  };

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const sumber = data?.daftar ?? [];
    if (!q) return sumber;
    return sumber.filter(p =>
      [p.deskripsi, p.objek_nama, p.departemen, p.site, p.kode]
        .some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, cari]);

  const ringkas = useMemo(() => {
    const semua = data?.daftar ?? [];
    const aktif = semua.filter(p => String(p.status ?? '') !== 'closed' && String(p.status ?? '') !== 'dismissed');
    const closed = semua.filter(p => String(p.status ?? '') === 'closed');
    const overdue = aktif.filter(p => picaOverdue(p));
    const durasi = closed.map(p => durasiHari(p)).filter((d): d is number => d !== null);
    return {
      total: semua.length,
      aktif: aktif.length,
      closed: closed.length,
      overdue: overdue.length,
      mttr: durasi.length ? Math.round((durasi.reduce((a, b) => a + b, 0) / durasi.length) * 10) / 10 : null,
    };
  }, [data]);

  const kirim = async (body: Record<string, unknown>, pesan: string) => {
    setBekerja(true);
    try {
      await authFetch('/api/pica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      store.showToast(pesan, 'success');
      await load();
      return true;
    } catch (e) {
      popup({ type: 'error', title: 'Gagal menyimpan', message: e instanceof Error ? e.message : 'Coba lagi.' });
      return false;
    } finally {
      setBekerja(false);
    }
  };

  const simpanBaru = async () => {
    if (!form.deskripsi.trim()) {
      popup({ type: 'info', title: 'Deskripsi wajib diisi', message: 'Tuliskan temuan secara singkat dan jelas.' });
      return;
    }
    const ok = await kirim({ aksi: 'tambah', ...form, sumber: 'inspeksi' }, 'PICA dicatat');
    if (ok) {
      setFormBuka(false);
      setForm({ ...FORM_KOSONG });
    }
  };

  const tutupPica = (p: Pica) => {
    popup({
      type: 'confirm',
      title: 'Tutup PICA ini?',
      message: `${p.deskripsi ?? 'Temuan'} — pastikan perbaikan sudah diverifikasi sebelum ditutup.`,
      confirmLabel: 'Tutup PICA',
      onOk: async () => {
        await kirim({ aksi: 'tutup', id: p.id, tanggal_closed: tanggalISO(new Date()) }, 'PICA ditutup');
      },
    });
  };

  return (
    <div className="admin-form-container" style={{ padding: 16, overflow: 'auto' }}>
      <div className="mcu-records-card">
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">PICA</div>
            <h3>Register Temuan Ketidaksesuaian</h3>
          </div>
          <div className="mcu-records-actions">
            <div className="mcu-records-search">
              <input
                aria-label="Cari PICA"
                placeholder="Cari temuan, objek, departemen…"
                value={cari}
                onChange={e => setCari(e.target.value)}
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
            >
              <option value="">Semua status</option>
              <option value="open">Open</option>
              <option value="in_progress">Dikerjakan</option>
              <option value="closed">Closed</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select
              value={filterSite}
              onChange={e => setFilterSite(e.target.value)}
              style={{ height: 28, minWidth: 120, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
            >
              <option value="">Semua site</option>
              {daftarSite.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="mcu-dashboard-refresh" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={buatOtomatis}
                  disabled={bekerja}
                  title="Tarik otomatis dari temuan inspeksi P3K, ambulans, ergonomi, dan sarana klinik"
                >
                  <Wand2 size={14} className="mr-1" />
                  Buat dari temuan{pratinjau?.total ? ` (${pratinjau.total})` : ''}
                </Button>
                <Button size="sm" onClick={() => setFormBuka(true)} disabled={bekerja}>
                  <Plus size={14} className="mr-1" /> Catat PICA
                </Button>
              </>
            )}
          </div>
        </div>

        {error && <div style={{ padding: '8px 12px', fontSize: 11, color: '#b3261e' }}>{error}</div>}

        {data && !data.tabelSiap ? (
          <div style={{ padding: 16, fontSize: 12, color: '#9a6b00' }}>{data.catatan}</div>
        ) : (
          <>
            <div className="mcu-records-toolbar" style={{ gap: 18 }}>
              <div className="mcu-records-toolbar-title">Ringkasan</div>
              <span style={{ fontSize: 11 }}>Total <b>{ringkas.total}</b></span>
              <span style={{ fontSize: 11 }}>Aktif <b>{ringkas.aktif}</b></span>
              <span style={{ fontSize: 11 }}>Closed <b>{ringkas.closed}</b></span>
              <span style={{ fontSize: 11 }}>
                Overdue <b style={{ color: ringkas.overdue ? '#FF2D2D' : 'inherit' }}>{ringkas.overdue}</b>
              </span>
              <span style={{ fontSize: 11 }}>
                MTTR <b>{ringkas.mttr === null ? '—' : `${ringkas.mttr} hari`}</b>
              </span>
            </div>

            <div className="mcu-records-table-wrap">
              <table className="mcu-records-table">
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>No</th>
                    <th style={{ width: 190 }}>Objek / Sumber</th>
                    <th>Deskripsi temuan</th>
                    <th style={{ width: 85 }}>Tingkat</th>
                    <th style={{ width: 140 }}>Departemen</th>
                    <th style={{ width: 95 }}>Dibuat</th>
                    <th style={{ width: 95 }}>Tenggat</th>
                    <th style={{ width: 95 }}>Sisa</th>
                    <th style={{ width: 105 }}>Status</th>
                    {isAdmin && <th style={{ width: 100 }}>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr><td colSpan={isAdmin ? 10 : 9} style={{ padding: 30, textAlign: 'center' }}>Memuat…</td></tr>
                  ) : daftar.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} style={{ padding: 30, textAlign: 'center', fontSize: 12 }}>
                        Belum ada PICA. {isAdmin && 'Klik “Catat PICA” untuk menambahkan temuan.'}
                      </td>
                    </tr>
                  ) : daftar.map((p, i) => {
                    const t = TINGKAT_STYLE[String(p.tingkat ?? 'minor')] ?? TINGKAT_STYLE.minor;
                    const s = STATUS_STYLE[String(p.status ?? 'open')] ?? STATUS_STYLE.open;
                    const overdue = picaOverdue(p);
                    const sisa = selisihHari(p.due_date);
                    const selesai = String(p.status ?? '') === 'closed' || String(p.status ?? '') === 'dismissed';
                    return (
                      <tr key={String(p.id ?? i)}>
                        <td className="mcu-records-index">{i + 1}</td>
                        <td title={String(p.objek_nama ?? '')}>
                          {p.objek_nama ?? '—'}
                          <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>
                            {JENIS_META[p.jenis_inspeksi as keyof typeof JENIS_META]?.label ?? p.sumber ?? '—'}
                            {p.site ? ` · ${p.site}` : ''}
                          </div>
                        </td>
                        <td title={String(p.deskripsi ?? '')}>{p.deskripsi ?? '—'}</td>
                        <td>
                          <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, color: t.warna, background: t.bg }}>
                            {t.label}
                          </span>
                        </td>
                        <td>{p.departemen ?? '—'}</td>
                        <td>{p.tanggal_dibuat ?? '—'}</td>
                        <td>{p.due_date ?? '—'}</td>
                        <td style={{ color: overdue ? '#FF2D2D' : 'inherit', fontWeight: overdue ? 700 : 400 }}>
                          {selesai || sisa === null ? '—' : sisa < 0 ? `+${Math.abs(sisa)}h` : `${sisa}h`}
                        </td>
                        <td>
                          <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, color: s.warna, background: s.bg }}>
                            {s.label}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="mcu-records-action">
                            {!selesai && (
                              <div style={{ display: 'flex', gap: 2 }}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-1.5 text-xs"
                                  disabled={bekerja}
                                  onClick={() => tutupPica(p)}
                                  title="Tutup PICA"
                                >
                                  <CheckCircle2 size={13} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-1.5 text-xs"
                                  disabled={bekerja}
                                  onClick={() => kirim({ aksi: 'dismiss', id: p.id }, 'PICA diabaikan')}
                                  title="Bukan temuan nyata"
                                >
                                  <XCircle size={13} />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Form PICA baru */}
      <Dialog open={formBuka} onOpenChange={setFormBuka}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Catat Temuan PICA</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium">
              <span>Site</span>
              <Input
                className="mt-1"
                value={form.site}
                onChange={e => setForm(f => ({ ...f, site: e.target.value }))}
                list="pica-daftar-site"
              />
              <datalist id="pica-daftar-site">
                {daftarSite.map(s => <option key={s} value={s} />)}
              </datalist>
            </label>
            <label className="text-xs font-medium">
              <span>Sumber inspeksi</span>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={form.jenis_inspeksi}
                onChange={e => setForm(f => ({ ...f, jenis_inspeksi: e.target.value }))}
              >
                <option value="">Pilih…</option>
                {JENIS_INSPEKSI_LIST.map(j => <option key={j} value={j}>{JENIS_META[j].label}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Objek / fasilitas</span>
              <Input
                className="mt-1"
                placeholder="mis. Kotak P3K Workshop A"
                value={form.objek_nama}
                onChange={e => setForm(f => ({ ...f, objek_nama: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              <span>Lokasi</span>
              <Input
                className="mt-1"
                placeholder="mis. Workshop A / Mess Blok 1"
                value={form.lokasi}
                onChange={e => setForm(f => ({ ...f, lokasi: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              <span>Jenis PICA</span>
              <Input
                className="mt-1"
                placeholder="mis. Inspeksi P3K / Temuan Sanitasi"
                value={form.jenis_pica}
                onChange={e => setForm(f => ({ ...f, jenis_pica: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Penyimpangan / deviasi *</span>
              <Textarea
                className="mt-1 min-h-[70px]"
                placeholder="Apa yang ditemukan, di mana, dan dampaknya"
                value={form.deskripsi}
                onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Foto penyimpangan (URL)</span>
              <Input
                className="mt-1"
                placeholder="Tautan foto temuan"
                value={form.foto_url}
                onChange={e => setForm(f => ({ ...f, foto_url: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              <span>Tingkat</span>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={form.tingkat}
                onChange={e => setForm(f => ({ ...f, tingkat: e.target.value, due_date: '' }))}
              >
                {Object.entries(TENGGAT_PICA_HARI).map(([k, hari]) => (
                  <option key={k} value={k}>{TINGKAT_STYLE[k]?.label ?? k} — tenggat {hari} hari</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              <span>Departemen penanggung jawab</span>
              <Input
                className="mt-1"
                placeholder="mis. Plant/Maintenance, GA, Logistik"
                value={form.departemen}
                onChange={e => setForm(f => ({ ...f, departemen: e.target.value }))}
                list="pica-daftar-departemen"
              />
              <datalist id="pica-daftar-departemen">
                {(data?.daftarDepartemen ?? []).map(d => <option key={d} value={d} />)}
              </datalist>
            </label>
            <label className="text-xs font-medium">
              <span>Tanggal temuan</span>
              <Input
                type="date"
                className="mt-1"
                value={form.tanggal_dibuat}
                onChange={e => setForm(f => ({ ...f, tanggal_dibuat: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              <span>Tenggat (kosong = otomatis dari tingkat)</span>
              <Input
                type="date"
                className="mt-1"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              <span>PIC penanggung jawab</span>
              <Input
                className="mt-1"
                placeholder="PJO / Section Head"
                value={form.pic_nama}
                onChange={e => setForm(f => ({ ...f, pic_nama: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium">
              <span>PIC tindak lanjut</span>
              <Input
                className="mt-1"
                placeholder="Driver / Mekanik / Officer"
                value={form.pic_tindak_lanjut}
                onChange={e => setForm(f => ({ ...f, pic_tindak_lanjut: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Akar masalah</span>
              <Input
                className="mt-1"
                value={form.akar_masalah}
                onChange={e => setForm(f => ({ ...f, akar_masalah: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Tindakan perbaikan</span>
              <Textarea
                className="mt-1 min-h-[60px]"
                value={form.tindakan}
                onChange={e => setForm(f => ({ ...f, tindakan: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Dokumentasi tindakan perbaikan (URL)</span>
              <Input
                className="mt-1"
                value={form.dokumentasi_url}
                onChange={e => setForm(f => ({ ...f, dokumentasi_url: e.target.value }))}
              />
            </label>
            <label className="text-xs font-medium md:col-span-2">
              <span>Tindakan pencegahan</span>
              <Textarea
                className="mt-1 min-h-[60px]"
                value={form.tindakan_pencegahan}
                onChange={e => setForm(f => ({ ...f, tindakan_pencegahan: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setFormBuka(false)}>Batal</Button>
            <Button onClick={simpanBaru} disabled={bekerja}>{bekerja ? 'Menyimpan…' : 'Simpan'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
