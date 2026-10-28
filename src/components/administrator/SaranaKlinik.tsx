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
import { AlertTriangle, Check, Loader2, Plus, RefreshCw, Wrench, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
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
  obat: 'Obat',
};

const STATUS_META: Record<ItemSarana['status'], { label: string; warna: string }> = {
  ada: { label: 'Ada', warna: '#00B894' },
  rusak: { label: 'Rusak', warna: '#FF7A00' },
  tidak_ada: { label: 'Tidak ada', warna: '#FF2D2D' },
  tidak_diperlukan: { label: 'Tidak diperlukan', warna: '#778899' },
};

export default function SaranaKlinik() {
  const store = useMCUStore();
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
    padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 9,
    textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)',
    fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = { padding: '4px 7px', borderBottom: '1px solid var(--border)', fontSize: 10.5 };

  return (
    <div className="dashboard" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Toolbar */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="admin-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="semua">Semua Status</option>
            <option value="ada">Ada</option>
            <option value="rusak">Rusak</option>
            <option value="tidak_ada">Tidak ada</option>
            <option value="tidak_diperlukan">Tidak diperlukan</option>
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => setTambah((v) => !v)} className="mcu-dashboard-refresh">
            <Plus size={13} /> Tambah Item
          </button>
        </div>
        {ringkasan && (
          <div className="kunjungan-total-right">
            <span>Wajib terpenuhi <b style={{ color: ringkasan.persenWajibTerpenuhi >= 90 ? '#00B894' : ringkasan.persenWajibTerpenuhi >= 70 ? '#C99A00' : '#FF2D2D' }}>
              {ringkasan.tersedia}/{ringkasan.wajib} ({ringkasan.persenWajibTerpenuhi.toFixed(0)}%)
            </b></span>
            <span>Rusak <b style={{ color: ringkasan.rusak ? '#FF7A00' : 'inherit' }}>{ringkasan.rusak}</b></span>
            <span>Belum dicatat <b style={{ color: ringkasan.belumDicatat ? '#FF7A00' : 'inherit' }}>{ringkasan.belumDicatat}</b></span>
            <span>Kalibrasi &gt;1 thn <b style={{ color: ringkasan.kalibrasiKedaluwarsa ? '#FF2D2D' : 'inherit' }}>{ringkasan.kalibrasiKedaluwarsa}</b></span>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, fontSize: 10, color: 'var(--muted-foreground)', display: 'flex', gap: 5, alignItems: 'center' }}>
        <AlertTriangle size={11} />
        Acuan: BG/QSHE/SOP/028 poin 5.5. Item di luar daftar boleh ditambahkan manual — sesuaikan dengan kondisi lapangan.
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {tambah && <FormTambah onSelesai={() => { setTambah(false); void load(); }} />}

      {loading && !items.length && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
          <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat sarana…
        </div>
      )}

      {[...perKategori.entries()].map(([kategori, list]) => (
        <div key={kategori} className="card" style={{ padding: '8px 10px', flexShrink: 0 }}>
          <div className="card-head" style={{ marginBottom: 6 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 12 }}>{KATEGORI_LABEL[kategori] ?? kategori}</h2>
              <p style={{ fontSize: 9 }}>
                {list.filter((i) => i.status === 'ada').length} tersedia · {list.length} item
              </p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Item</th>
                  <th style={th}>Status</th>
                  <th style={th}>Jumlah</th>
                  <th style={th}>Kondisi</th>
                  <th style={th}>Kalibrasi/Inspeksi</th>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {it.nama}
                          {!it.wajib && (
                            <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                              tambahan
                            </span>
                          )}
                          {it.perluKalibrasi && <Wrench size={10} color="var(--muted-foreground)" />}
                        </div>
                      </td>
                      <td style={td}>
                        <select
                          value={it.status}
                          onChange={(e) => void simpan(it, { status: e.target.value as ItemSarana['status'] })}
                          disabled={menyimpan === it.katalogId}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                            border: `1px solid ${meta.warna}55`, background: `${meta.warna}14`, color: meta.warna,
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
                          style={{ width: 58, fontSize: 10.5, padding: '2px 5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)' }}
                        />
                      </td>
                      <td style={td}>
                        <input
                          defaultValue={it.kondisi ?? ''}
                          onBlur={(e) => { if (e.target.value !== (it.kondisi ?? '')) void simpan(it, { kondisi: e.target.value }); }}
                          placeholder="—"
                          style={{ width: 100, fontSize: 10.5, padding: '2px 5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)' }}
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
                            fontSize: 10, padding: '2px 5px', borderRadius: 6,
                            border: `1px solid ${kalibrasiLewat ? '#FF2D2D' : 'var(--border)'}`,
                            background: 'var(--background)', color: kalibrasiLewat ? '#FF2D2D' : 'inherit',
                          }}
                          title={it.perluKalibrasi ? 'Tanggal kalibrasi terakhir' : 'Tanggal inspeksi terakhir'}
                        />
                        {kalibrasiLewat && (
                          <div style={{ fontSize: 8.5, color: '#FF2D2D', marginTop: 1 }}>kalibrasi &gt;1 tahun</div>
                        )}
                      </td>
                      <td style={td}>
                        <input
                          defaultValue={it.catatan ?? ''}
                          onBlur={(e) => { if (e.target.value !== (it.catatan ?? '')) void simpan(it, { catatan: e.target.value }); }}
                          placeholder="—"
                          style={{ width: 140, fontSize: 10.5, padding: '2px 5px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)' }}
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
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11.5 }}>
          Belum ada katalog sarana untuk site ini.
        </div>
      )}
    </div>
  );
}

const SITES = [
  'Head Office', 'Satui', 'Angsana', 'Tanjung Tabalong', 'Rantau', 'Binuang', 'Senakin',
  'Kota Baru', 'Batu Kajang', 'Ketapang', 'Kapuas Tengah', 'Murung Raya', 'Muara Teweh',
  'Tuhup', 'Gunung Mas', 'Banjar Baru', 'Bontang', 'Samarinda', 'Tenggarong', 'Tabang',
  'Gunung Sari', 'Bukit Pinang', 'Sangatta', 'Bengalon', 'Kaliorang', 'Kaubun',
  'Balikpapan', 'Melak', 'Muara Enim', 'Lahat', 'Muara Bungo', 'Banyuwangi', 'Wetar',
  'Kotamobagu', 'Konawe', 'Halmahera Timur', 'Gorontalo', 'Aceh', 'Palu', 'Malinau',
  'Kelubir', 'Tanjung Redeb', 'Labanan', 'Binungan', 'Bunyu', 'Sebakis', 'Morowali',
  'Luwu', 'Soroako', 'Kayong Utara',
];

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
    <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: '#00B894', flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 12 }}>Tambah Item Sarana</h2>
          <p style={{ fontSize: 9 }}>Untuk perlengkapan yang dipakai di lapangan namun tidak tercantum di SOP/028</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginBottom: 8 }}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Nama item</span>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Nebulizer" className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Kategori</span>
          <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="h-8 rounded-lg border-input bg-background px-2 text-sm">
            {Object.entries(KATEGORI_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', fontSize: 10.5 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="checkbox" checked={wajib} onChange={(e) => setWajib(e.target.checked)} /> Wajib tersedia
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="checkbox" checked={perluKalibrasi} onChange={(e) => setPerluKalibrasi(e.target.checked)} /> Perlu kalibrasi berkala
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onSelesai}>Batal</Button>
        <Button size="sm" disabled={simpan || !nama.trim()} onClick={() => void kirim()} style={{ gap: 5 }}>
          {simpan ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan Item
        </Button>
      </div>
    </div>
  );
}
