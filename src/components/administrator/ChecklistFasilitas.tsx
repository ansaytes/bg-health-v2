'use client';

// ============================================================
// Administrator > Checklist Kelaikan Fasilitas & Aset
// ============================================================
//
// Satu komponen untuk tiga checklist yang bentuknya sama:
//   • p3k       — isi kotak P3K, ED obat, kondisi kotak, buku catatan
//   • ambulans  — kelengkapan alat medis, kondisi kendaraan, sanitasi kabin
//   • ergonomi  — jumlah unit layak vs rusak sarana ergonomi
//
// Perbedaan antarketiganya hanya pada kolom yang ditampilkan; semuanya
// memakai status yang sama (ada / rusak / tidak ada / tidak diperlukan)
// sehingga dashboard bisa menghitung persen siap pakai dengan satu rumus.
//
// Untuk ambulans, status kesiapan unit (Ready / Standby / Breakdown)
// dicatat terpisah — itu menilai KENDARAAN, bukan kelengkapan itemnya.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';
import { usePopup, Popup } from '@/lib/popup';

export type JenisChecklist = 'p3k' | 'ambulans' | 'ergonomi';

interface KatalogItem {
  id: number | string;
  nama: string;
  kategori?: string | null;
  jumlah_standar?: number | null;
  wajib?: boolean;
}

interface KondisiItem {
  id?: number;
  katalog_id: number | string;
  lokasi?: string | null;
  unit?: string | null;
  status?: string | null;
  jumlah?: number | null;
  layak?: number | null;
  rusak?: number | null;
  tanggal_expired?: string | null;
  kondisi_kotak?: string | null;
  ada_buku_catatan?: boolean | null;
  kondisi?: string | null;
  catatan?: string | null;
  tanggal_inspeksi?: string | null;
  /** Kolom pengelompok dinamis (`lokasi` / `unit`) dibaca lewat indeks. */
  [kunci: string]: unknown;
}

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  label: string;
  pengelompok: string | null;
  site: string;
  katalog: KatalogItem[];
  kondisi: KondisiItem[];
  grup: string[];
  daftarSite: string[];
}

interface BarisEdit {
  katalog_id: number | string;
  nama: string;
  status: string;
  jumlah: string;
  layak: string;
  rusak: string;
  tanggal_expired: string;
  kondisi_kotak: string;
  ada_buku_catatan: boolean;
  catatan: string;
}

/** Baris edit awal: gabungan katalog + kondisi tersimpan. */
function susunBaris(katalog: KatalogItem[], kondisi: KondisiItem[], grup: string, kolomGrup: string | null): BarisEdit[] {
  return katalog.map(k => {
    const c = kondisi.find(x => String(x.katalog_id) === String(k.id)
      && (!kolomGrup || String(x[kolomGrup] ?? '') === grup));
    return {
      katalog_id: k.id,
      nama: k.nama,
      status: String(c?.status ?? 'tidak_ada'),
      jumlah: c?.jumlah == null ? (k.jumlah_standar == null ? '' : String(k.jumlah_standar)) : String(c.jumlah),
      layak: c?.layak == null ? '' : String(c.layak),
      rusak: c?.rusak == null ? '' : String(c.rusak),
      tanggal_expired: c?.tanggal_expired ? String(c.tanggal_expired).slice(0, 10) : '',
      kondisi_kotak: String(c?.kondisi_kotak ?? ''),
      ada_buku_catatan: c?.ada_buku_catatan ?? true,
      catatan: String(c?.catatan ?? ''),
    };
  });
}

const STATUS_OPTIONS = [
  { value: 'ada', label: 'Ada / Layak' },
  { value: 'rusak', label: 'Rusak' },
  { value: 'tidak_ada', label: 'Tidak ada' },
  { value: 'tidak_diperlukan', label: 'Tidak diperlukan' },
];

const STATUS_WARNA: Record<string, string> = {
  ada: '#00B894',
  rusak: '#FF7A00',
  tidak_ada: '#FF2D2D',
  tidak_diperlukan: '#778899',
};

export default function ChecklistFasilitas({ jenis }: { jenis: JenisChecklist }) {
  const { isAdmin } = useAuth();
  const store = useMCUStore();
  const { popup, popupState, closePopup } = usePopup();

  const [site, setSite] = useState('');
  const [grup, setGrup] = useState('');
  const [grupBaru, setGrupBaru] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [baris, setBaris] = useState<BarisEdit[]>([]);
  const [loading, setLoading] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState('');
  const [unitStatus, setUnitStatus] = useState<Record<string, string>>({});

  const labelGrup = data?.pengelompok === 'unit' ? 'Unit ambulans' : data?.pengelompok === 'lokasi' ? 'Lokasi / area' : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ jenis });
      if (site) qs.set('site', site);
      const hasil = await authFetch(`/api/inspeksi/checklist?${qs.toString()}`) as unknown as Data;
      setData(hasil);
      setSite(hasil.site || site);
      const grupTersedia = hasil.grup ?? [];
      setGrup(prev => (prev && grupTersedia.includes(prev) ? prev : grupTersedia[0] ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat checklist');
    } finally {
      setLoading(false);
    }
  }, [jenis, site]);

  useEffect(() => { void load(); }, [jenis]);

  // Susun ulang baris edit setiap kali katalog / grup / data berubah.
  const kolomGrup = data?.pengelompok ?? null;
  useEffect(() => {
    if (!data) return;
    setBaris(susunBaris(data.katalog, data.kondisi, grup, kolomGrup));
  }, [data, grup, kolomGrup]);

  const ubah = (katalogId: number | string, patch: Partial<BarisEdit>) => {
    setBaris(prev => prev.map(b => (String(b.katalog_id) === String(katalogId) ? { ...b, ...patch } : b)));
  };

  const ringkas = useMemo(() => {
    const total = baris.length;
    const ada = baris.filter(b => b.status === 'ada').length;
    return {
      total,
      ada,
      rusak: baris.filter(b => b.status === 'rusak').length,
      tidakAda: baris.filter(b => b.status === 'tidak_ada').length,
      persen: total ? Math.round((ada / total) * 1000) / 10 : 0,
    };
  }, [baris]);

  const simpan = async () => {
    if (kolomGrup && !grup.trim()) {
      popup({ type: 'info', title: `${labelGrup} wajib diisi`, message: `Isi ${labelGrup.toLowerCase()} terlebih dahulu.` });
      return;
    }
    setMenyimpan(true);
    try {
      await authFetch('/api/inspeksi/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksi: 'simpan',
          jenis,
          site,
          grup,
          item: baris.map(b => ({
            katalog_id: b.katalog_id,
            status: b.status,
            jumlah: b.jumlah,
            layak: b.layak,
            rusak: b.rusak,
            tanggal_expired: b.tanggal_expired,
            kondisi_kotak: b.kondisi_kotak || null,
            ada_buku_catatan: b.ada_buku_catatan,
            catatan: b.catatan,
          })),
        }),
      });
      store.showToast('Checklist tersimpan', 'success');
      await load();
    } catch (e) {
      popup({ type: 'error', title: 'Gagal menyimpan', message: e instanceof Error ? e.message : 'Coba lagi.' });
    } finally {
      setMenyimpan(false);
    }
  };

  const simpanUnit = async (unit: string) => {
    try {
      await authFetch('/api/inspeksi/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'unit', jenis: 'ambulans', site, unit, status_kesiapan: unitStatus[unit] ?? 'standby' }),
      });
      store.showToast(`Status unit ${unit} tersimpan`, 'success');
      await load();
    } catch (e) {
      popup({ type: 'error', title: 'Gagal menyimpan status unit', message: e instanceof Error ? e.message : 'Coba lagi.' });
    }
  };

  const judul = { p3k: 'Kotak P3K', ambulans: 'Ambulans & Tanggap Darurat', ergonomi: 'Sarana Ergonomi' }[jenis];
  const sub = {
    p3k: 'Standar Permenaker 15/2008 — isi, ED obat, kondisi kotak, buku catatan',
    ambulans: 'Kelengkapan alat medis, kondisi kendaraan, sanitasi kabin',
    ergonomi: 'Kelayakan sarana ergonomi operasional (unit layak vs rusak)',
  }[jenis];

  return (
    <div className="admin-form-container" style={{ padding: 16, overflow: 'auto' }}>
      <div className="mcu-records-card">
        <div className="mcu-records-header">
          <div>
            <div className="mcu-records-kicker">CHECKLIST KELAIKAN</div>
            <h3>{judul}</h3>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{sub}</p>
          </div>
          <div className="mcu-records-actions">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span>Site</span>
              <select
                value={site}
                onChange={e => setSite(e.target.value)}
                style={{ height: 28, minWidth: 130, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
              >
                {(data?.daftarSite ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                {!data?.daftarSite?.length && <option value="">{site || '—'}</option>}
              </select>
            </label>
            {kolomGrup && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span>{labelGrup}</span>
                <select
                  value={grup}
                  onChange={e => setGrup(e.target.value)}
                  style={{ height: 28, minWidth: 150, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 6px' }}
                >
                  {(data?.grup ?? []).map(g => <option key={g} value={g}>{g}</option>)}
                  {grupBaru && !(data?.grup ?? []).includes(grupBaru) && <option value={grupBaru}>{grupBaru}</option>}
                  {!(data?.grup ?? []).length && <option value="">— belum ada —</option>}
                </select>
              </label>
            )}
            {kolomGrup && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span>+ {labelGrup.toLowerCase()} baru</span>
                <Input
                  className="h-7 w-36 text-xs"
                  value={grupBaru}
                  onChange={e => setGrupBaru(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && grupBaru.trim()) setGrup(grupBaru.trim()); }}
                  placeholder={jenis === 'ambulans' ? 'mis. AMB-01' : 'mis. Mess Blok 1'}
                />
              </label>
            )}
            <button type="button" className="mcu-dashboard-refresh" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {isAdmin && (
              <Button size="sm" onClick={simpan} disabled={menyimpan || loading}>
                <Save size={14} className="mr-1" /> {menyimpan ? 'Menyimpan…' : 'Simpan'}
              </Button>
            )}
          </div>
        </div>

        {error && <div style={{ padding: '8px 12px', fontSize: 11, color: '#b3261e' }}>{error}</div>}

        {data && !data.tabelSiap ? (
          <div style={{ padding: 16, fontSize: 12, color: '#9a6b00' }}>{data.catatan}</div>
        ) : (
          <>
            <div className="mcu-records-toolbar" style={{ gap: 18 }}>
              <span style={{ fontSize: 11 }}>Item <b>{ringkas.total}</b></span>
              <span style={{ fontSize: 11 }}>Siap <b style={{ color: STATUS_WARNA.ada }}>{ringkas.ada}</b></span>
              <span style={{ fontSize: 11 }}>Rusak <b style={{ color: STATUS_WARNA.rusak }}>{ringkas.rusak}</b></span>
              <span style={{ fontSize: 11 }}>Tidak ada <b style={{ color: STATUS_WARNA.tidak_ada }}>{ringkas.tidakAda}</b></span>
              <span style={{ fontSize: 11 }}>
                Siap pakai <b style={{ color: ringkas.persen >= 90 ? STATUS_WARNA.ada : ringkas.persen >= 70 ? '#C99A00' : STATUS_WARNA.tidak_ada }}>{ringkas.persen}%</b>
              </span>
            </div>

            {/* Status kesiapan unit (khusus ambulans). */}
            {jenis === 'ambulans' && (data?.grup ?? []).length > 0 && (
              <div className="mcu-records-toolbar" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div className="mcu-records-toolbar-title">Status kesiapan unit</div>
                {(data?.grup ?? []).map(u => (
                  <span key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <b>{u}</b>
                    <select
                      value={unitStatus[u] ?? 'standby'}
                      onChange={e => setUnitStatus(s => ({ ...s, [u]: e.target.value }))}
                      style={{ height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 5px' }}
                    >
                      <option value="ready">Ready</option>
                      <option value="standby">Standby with Note</option>
                      <option value="breakdown">Breakdown</option>
                    </select>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => void simpanUnit(u)}>
                        Simpan
                      </Button>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className="mcu-records-table-wrap">
              <table className="mcu-records-table">
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>No</th>
                    <th>Item</th>
                    <th style={{ width: 140 }}>Status</th>
                    {jenis === 'ergonomi' ? (
                      <>
                        <th style={{ width: 80 }}>Jumlah</th>
                        <th style={{ width: 80 }}>Layak</th>
                        <th style={{ width: 80 }}>Rusak</th>
                      </>
                    ) : (
                      <th style={{ width: 80 }}>Jumlah</th>
                    )}
                    {jenis === 'p3k' && <th style={{ width: 140 }}>Kedaluwarsa</th>}
                    {jenis === 'p3k' && <th style={{ width: 110 }}>Kondisi kotak</th>}
                    {jenis === 'p3k' && <th style={{ width: 90 }}>Buku catatan</th>}
                    <th style={{ width: 200 }}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data ? (
                    <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center' }}>Memuat…</td></tr>
                  ) : baris.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', fontSize: 12 }}>Katalog kosong.</td></tr>
                  ) : baris.map((b, i) => (
                    <tr key={String(b.katalog_id)}>
                      <td className="mcu-records-index">{i + 1}</td>
                      <td>{b.nama}</td>
                      <td>
                        <select
                          value={b.status}
                          disabled={!isAdmin}
                          onChange={e => ubah(b.katalog_id, { status: e.target.value })}
                          style={{
                            height: 26, width: '100%', borderRadius: 6, fontSize: 11, padding: '0 4px',
                            border: `1px solid ${STATUS_WARNA[b.status] ?? 'var(--border)'}`,
                            background: 'var(--background)',
                            color: STATUS_WARNA[b.status] ?? 'inherit',
                            fontWeight: 600,
                          }}
                        >
                          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      {jenis === 'ergonomi' ? (
                        <>
                          <td>
                            <Input className="h-7 w-16 text-xs" type="number" min={0} value={b.jumlah} disabled={!isAdmin}
                              onChange={e => ubah(b.katalog_id, { jumlah: e.target.value })} />
                          </td>
                          <td>
                            <Input className="h-7 w-16 text-xs" type="number" min={0} value={b.layak} disabled={!isAdmin}
                              onChange={e => ubah(b.katalog_id, { layak: e.target.value })} />
                          </td>
                          <td>
                            <Input className="h-7 w-16 text-xs" type="number" min={0} value={b.rusak} disabled={!isAdmin}
                              onChange={e => ubah(b.katalog_id, { rusak: e.target.value })} />
                          </td>
                        </>
                      ) : (
                        <td>
                          <Input className="h-7 w-16 text-xs" type="number" min={0} value={b.jumlah} disabled={!isAdmin}
                            onChange={e => ubah(b.katalog_id, { jumlah: e.target.value })} />
                        </td>
                      )}
                      {jenis === 'p3k' && (
                        <td>
                          <Input className="h-7 w-full text-xs" type="date" value={b.tanggal_expired} disabled={!isAdmin}
                            onChange={e => ubah(b.katalog_id, { tanggal_expired: e.target.value })} />
                        </td>
                      )}
                      {jenis === 'p3k' && (
                        <td>
                          <select
                            value={b.kondisi_kotak}
                            disabled={!isAdmin}
                            onChange={e => ubah(b.katalog_id, { kondisi_kotak: e.target.value })}
                            style={{ height: 26, width: '100%', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', fontSize: 11, padding: '0 4px' }}
                          >
                            <option value="">—</option>
                            <option value="bersih">Bersih</option>
                            <option value="kotor">Kotor</option>
                            <option value="rusak">Rusak</option>
                          </select>
                        </td>
                      )}
                      {jenis === 'p3k' && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={b.ada_buku_catatan}
                            disabled={!isAdmin}
                            onChange={e => ubah(b.katalog_id, { ada_buku_catatan: e.target.checked })}
                          />
                        </td>
                      )}
                      <td>
                        <Input className="h-7 w-full text-xs" value={b.catatan} disabled={!isAdmin}
                          onChange={e => ubah(b.katalog_id, { catatan: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}
