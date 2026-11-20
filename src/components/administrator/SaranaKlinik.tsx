'use client';

// ============================================================
// Administrator > Sarana & Prasarana Klinik
// ============================================================
//
// DASAR: BG/QSHE/SOP/028 poin 5.5 — daftar ruangan, peralatan medis, sarana
// penunjang, dan alat evakuasi. Dokumen menutup dengan catatan:
//
//   "Sarana dan Prasarana Kesehatan di jobsite bersifat menyesuaikan apabila
//    tidak disediakan oleh klien / customer."
//
// Karena itu katalog SOP dipakai sebagai ACUAN, dan setiap site mengisi
// kondisinya sendiri. Item boleh ditambah manual sesuai kondisi lapangan —
// daftar dokumen memang lebih lengkap daripada kenyataan saat ini, dan
// memaksanya hanya akan menghasilkan data palsu.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Plus, RefreshCw, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useSites } from '@/lib/site-list';
import { useMCUStore } from '@/lib/store';

interface ItemSarana {
  katalogId: string;
  nama: string;
  kategori: string;
  wajib: boolean;
  perluKalibrasi: boolean;
  status: 'ada' | 'tidak_ada' | 'rusak' | 'tidak_diperlukan';
  jumlah: number | null;
  kondisi: string | null;
  tanggalKalibrasi: string | null;
  tanggalInspeksi: string | null;
  catatan: string | null;
  tersedia: boolean;
}

interface Ringkasan {
  total: number; wajib: number; tersedia: number; persenWajibTerpenuhi: number;
  rusak: number; belumDicatat: number; kalibrasiKedaluwarsa: number;
}

const KATEGORI_LABEL: Record<string, string> = {
  perlengkapan_umum: 'Perlengkapan Umum',
  ruangan: 'Ruangan',
  peralatan_medis: 'Peralatan Medis',
  sarana_penunjang: 'Sarana Penunjang',
  alat_evakuasi: 'Alat Evakuasi',
  // Kategori 'obat' sengaja TIDAK ditampilkan: persediaan obat & BHP sudah
  // dikelola di halaman Inventory dengan batch, ED, dan pemakaian. Menampilkannya
  // lagi di sini hanya menghasilkan dua angka berbeda.
};

const STATUS_META: Record<ItemSarana['status'], { label: string; warna: string }> = {
  ada: { label: 'Ada', warna: '#00B894' },
  rusak: { label: 'Rusak', warna: '#FF7A00' },
  tidak_ada: { label: 'Tidak ada', warna: '#FF2D2D' },
  tidak_diperlukan: { label: 'Tidak diperlukan', warna: '#778899' },
};

export default function SaranaKlinik({ onBukaPica }: { onBukaPica?: () => void } = {}) {
  const store = useMCUStore();
  const { sites: daftarSite } = useSites();
  const [site, setSite] = useState('Head Office');
  const [items, setItems] = useState<ItemSarana[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('semua');
  const [tambah, setTambah] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch(`/api/sarana?site=${encodeURIComponent(site)}`);
      setItems((r.items ?? []) as ItemSarana[]);
      setRingkasan(r.ringkasan as Ringkasan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data sarana');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => { void load(); }, [load]);

  async function simpan(item: ItemSarana, patch: Partial<ItemSarana>) {
    setMenyimpan(item.katalogId);
    try {
      await authFetch('/api/sarana', {
        method: 'POST',
        body: JSON.stringify({
          site,
          katalogId: item.katalogId,
          status: patch.status ?? item.status,
          jumlah: patch.jumlah ?? item.jumlah,
          kondisi: patch.kondisi ?? item.kondisi,
          tanggalKalibrasi: patch.tanggalKalibrasi ?? item.tanggalKalibrasi,
          tanggalInspeksi: patch.tanggalInspeksi ?? item.tanggalInspeksi,
          catatan: patch.catatan ?? item.catatan,
        }),
      });
      await load();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
    } finally {
      setMenyimpan(null);
    }
  }

  const perKategori = useMemo(() => {
    const map = new Map<string, ItemSarana[]>();
    for (const it of items) {
      if (filter !== 'semua' && it.status !== filter) continue;
      const list = map.get(it.kategori) ?? [];
      list.push(it);
      map.set(it.kategori, list);
    }
    return map;
  }, [items, filter]);

  const th: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--muted-foreground)',
    fontWeight: 700,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    verticalAlign: 'middle',
  };
  const cellInput: React.CSSProperties = {
    height: 32,
    fontSize: 12,
    padding: '0 8px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Judul Halaman ala Hearing Conservation / Ergonomi */}
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Sarana & Prasarana Klinik</h1>
          <p className="admin-form-subtitle">
            Standar kelengkapan ruangan, peralatan medis, APD, dan evakuasi fasilitas pelayanan kesehatan kerja.
          </p>
        </div>

        {/* Toolbar / Filter Bar */}
        <div className="kunjungan-filter-bar" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="admin-filter-select"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              style={{ height: 32, fontSize: 12, padding: '0 24px 0 10px', borderRadius: 8 }}
            >
              <option value="">All Site</option>
              {daftarSite.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="admin-filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ height: 32, fontSize: 12, padding: '0 24px 0 10px', borderRadius: 8 }}
            >
              <option value="semua">Semua Status</option>
              <option value="ada">Ada</option>
              <option value="rusak">Rusak</option>
              <option value="tidak_ada">Tidak ada</option>
              <option value="tidak_diperlukan">Tidak diperlukan</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="mcu-dashboard-refresh"
              style={{ height: 32, fontSize: 12, borderRadius: 8, padding: '0 12px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setTambah((v) => !v)}
              className="mcu-dashboard-refresh"
              style={{ height: 32, fontSize: 12, borderRadius: 8, padding: '0 12px' }}
            >
              <Plus size={13} /> Tambah Item
            </button>
          </div>
          {ringkasan && (
            <div className="kunjungan-total-right" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
              <span>Wajib terpenuhi <b style={{ color: ringkasan.persenWajibTerpenuhi >= 90 ? '#00B894' : ringkasan.persenWajibTerpenuhi >= 70 ? '#C99A00' : '#FF2D2D' }}>
                {ringkasan.tersedia}/{ringkasan.wajib} ({ringkasan.persenWajibTerpenuhi.toFixed(0)}%)
              </b></span>
              <span>Rusak <b style={{ color: ringkasan.rusak ? '#FF7A00' : 'inherit' }}>{ringkasan.rusak}</b></span>
              <span>Belum dicatat <b style={{ color: ringkasan.belumDicatat ? '#FF7A00' : 'inherit' }}>{ringkasan.belumDicatat}</b></span>
              <span>Kalibrasi &gt;1 thn <b style={{ color: ringkasan.kalibrasiKedaluwarsa ? '#FF2D2D' : 'inherit' }}>{ringkasan.kalibrasiKedaluwarsa}</b></span>
              {ringkasan.rusak > 0 && onBukaPica && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onBukaPica}
                  style={{
                    height: 28,
                    fontSize: 11.5,
                    padding: '0 10px',
                    borderRadius: 8,
                    borderColor: '#FF7A00',
                    color: '#FF7A00',
                    background: 'rgba(255,122,0,0.08)',
                    gap: 5,
                  }}
                  title="Buka Register PICA untuk menindaklanjuti temuan ini"
                >
                  {ringkasan.rusak} Temuan Rusak → PICA
                </Button>
              )}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--muted-foreground)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          <AlertTriangle size={13} />
          Item boleh ditambahkan manual sesuai kondisi lapangan.
        </div>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, flexShrink: 0, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {tambah && <FormTambah onSelesai={() => { setTambah(false); void load(); }} />}

        {loading && !items.length && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat sarana…
          </div>
        )}

        {[...perKategori.entries()].map(([kategori, list]) => (
          <div key={kategori} className="admin-form-card" style={{ overflow: 'auto', marginBottom: 18, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--brand-primary, #ff4d00)', display: 'inline-block', flexShrink: 0 }} />
                <h3 className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                  {KATEGORI_LABEL[kategori] ?? kategori}
                </h3>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                {list.filter((i) => i.status === 'ada').length} tersedia · {list.length} item
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>Item</th>
                    <th style={{ ...th, width: 140 }}>Status</th>
                    <th style={{ ...th, width: 80, textAlign: 'center' }}>Jumlah</th>
                    <th style={{ ...th, width: 180 }}>Kondisi</th>
                    <th style={{ ...th, width: 160 }}>Kalibrasi/Inspeksi</th>
                    <th style={th}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((it) => {
                    const meta = STATUS_META[it.status];
                    const kalibrasiLewat = it.perluKalibrasi && it.tanggalKalibrasi
                      && (Date.now() - new Date(`${it.tanggalKalibrasi}T00:00:00`).getTime()) / 86_400_000 > 365;
                    return (
                      <tr key={it.katalogId} style={{ opacity: menyimpan === it.katalogId ? 0.55 : 1 }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 12.5 }}>{it.nama}</span>
                            {!it.wajib && (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                                tambahan
                              </span>
                            )}
                            {it.perluKalibrasi && <Wrench size={12} color="var(--muted-foreground)" />}
                          </div>
                        </td>
                        <td style={td}>
                          <select
                            value={it.status}
                            onChange={(e) => void simpan(it, { status: e.target.value as ItemSarana['status'] })}
                            disabled={menyimpan === it.katalogId}
                            style={{
                              height: 30,
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '0 24px 0 10px',
                              borderRadius: 999,
                              border: `1px solid ${meta.warna}66`,
                              background: `${meta.warna}15`,
                              color: meta.warna,
                              cursor: 'pointer',
                              outline: 'none',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {(Object.keys(STATUS_META) as ItemSarana['status'][]).map((s) => (
                              <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={td}>
                          <input
                            type="number"
                            defaultValue={it.jumlah ?? ''}
                            onBlur={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              if (v !== it.jumlah) void simpan(it, { jumlah: v });
                            }}
                            style={{ ...cellInput, width: 64, textAlign: 'center' }}
                          />
                        </td>
                        <td style={td}>
                          <input
                            defaultValue={it.kondisi ?? ''}
                            onBlur={(e) => { if (e.target.value !== (it.kondisi ?? '')) void simpan(it, { kondisi: e.target.value }); }}
                            placeholder="—"
                            style={{ ...cellInput, width: '100%', minWidth: 140 }}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="date"
                            defaultValue={it.perluKalibrasi ? (it.tanggalKalibrasi ?? '') : (it.tanggalInspeksi ?? '')}
                            onChange={(e) => void simpan(it, it.perluKalibrasi
                              ? { tanggalKalibrasi: e.target.value }
                              : { tanggalInspeksi: e.target.value })}
                            style={{
                              ...cellInput,
                              width: 140,
                              border: `1px solid ${kalibrasiLewat ? '#FF2D2D' : 'var(--border)'}`,
                              color: kalibrasiLewat ? '#FF2D2D' : 'inherit',
                            }}
                            title={it.perluKalibrasi ? 'Tanggal kalibrasi terakhir' : 'Tanggal inspeksi terakhir'}
                          />
                          {kalibrasiLewat && (
                            <div style={{ fontSize: 10, color: '#FF2D2D', marginTop: 2, fontWeight: 600 }}>kalibrasi &gt;1 tahun</div>
                          )}
                        </td>
                        <td style={td}>
                          <input
                            defaultValue={it.catatan ?? ''}
                            onBlur={(e) => { if (e.target.value !== (it.catatan ?? '')) void simpan(it, { catatan: e.target.value }); }}
                            placeholder="—"
                            style={{ ...cellInput, width: '100%', minWidth: 160 }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!loading && !items.length && !error && (
          <div className="admin-form-card" style={{ padding: 28, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            Belum ada katalog sarana untuk site ini.
          </div>
        )}
      </div>
    </div>
  );
}

/** Form menambah item katalog di luar daftar SOP — sesuai kondisi lapangan. */
function FormTambah({ onSelesai }: { onSelesai: () => void }) {
  const store = useMCUStore();
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState('peralatan_medis');
  const [wajib, setWajib] = useState(false);
  const [perluKalibrasi, setPerluKalibrasi] = useState(false);
  const [simpan, setSimpan] = useState(false);

  async function kirim() {
    if (!nama.trim()) return;
    setSimpan(true);
    try {
      await authFetch('/api/sarana', {
        method: 'PUT',
        body: JSON.stringify({ nama: nama.trim(), kategori, wajib, perluKalibrasi }),
      });
      store.showToast('Item sarana ditambahkan', 'success');
      setNama('');
      onSelesai();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menambah item', 'error');
    } finally {
      setSimpan(false);
    }
  }

  return (
    <div className="admin-form-card" style={{ padding: '14px 18px', flexShrink: 0, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: '#00B894', display: 'inline-block', flexShrink: 0 }} />
        <h3 className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          Tambah Item Sarana
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginBottom: 12 }}>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Nama item</span>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Nebulizer" className="h-9 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Kategori</span>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="h-9 rounded-lg border-input bg-background px-2 text-sm">
            {Object.entries(KATEGORI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={wajib} onChange={(e) => setWajib(e.target.checked)} /> Wajib tersedia
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={perluKalibrasi} onChange={(e) => setPerluKalibrasi(e.target.checked)} /> Perlu kalibrasi berkala
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onSelesai} style={{ height: 34 }}>Batal</Button>
        <Button size="sm" disabled={simpan || !nama.trim()} onClick={() => void kirim()} style={{ gap: 6, height: 34 }}>
          {simpan ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan Item
        </Button>
      </div>
    </div>
  );
}
