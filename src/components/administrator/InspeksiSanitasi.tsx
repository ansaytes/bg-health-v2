'use client';

// ============================================================
// Administrator > Higiene Industri > Inspeksi Higiene & Sanitasi
// ============================================================
//
// DASAR: BG/QSHE/STD/005 Rev.001 via BG/QSHE/SOP/028 poin 5.7.
//
// Sebagian besar item DIHITUNG otomatis dari isian angka (rasio toilet,
// kecukupan jamban, kebisingan, pencahayaan, indeks vektor, kualitas udara).
// Item yang hanya bisa dinilai mata inspektur memakai pilihan Sesuai /
// Tidak sesuai / Tidak ada. Item yang tidak diisi berstatus BELUM DINILAI —
// bukan dianggap patuh.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, Save, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { ITEM_INSPEKSI, KATEGORI_LABEL, type KategoriInspeksi, type NilaiItem } from '@/lib/sanitasi-inspeksi';

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

interface Ringkasan {
  total: number; sesuai: number; tidakSesuai: number; belumDinilai: number; persenSesuai: number;
  perKategori: Record<string, { sesuai: number; tidakSesuai: number; belumDinilai: number }>;
}

interface HasilItem {
  key: string; label: string; kategori: KategoriInspeksi;
  nilai: NilaiItem; status: 'sesuai' | 'tidak_sesuai' | 'belum_dinilai';
  keterangan: string; sumber: string;
}

interface Riwayat {
  id: string; site: string; tanggal: string; inspektur: string | null;
  ringkasan: Ringkasan | null; catatan: string | null; created_at: string;
}

export default function InspeksiSanitasi() {
  const store = useMCUStore();
  const [site, setSite] = useState('Head Office');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [inspektur, setInspektur] = useState('');
  const [nilai, setNilai] = useState<Record<string, NilaiItem>>({});
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [hasil, setHasil] = useState<HasilItem[] | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [tabelSiap, setTabelSiap] = useState(true);

  const loadRiwayat = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`/api/sanitasi?site=${encodeURIComponent(site)}`);
      setRiwayat((r.data ?? []) as Riwayat[]);
      setTabelSiap(r.tabelSiap !== false);
    } catch {
      setRiwayat([]);
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => { void loadRiwayat(); }, [loadRiwayat]);

  const perKategori = useMemo(() => {
    const map = new Map<KategoriInspeksi, typeof ITEM_INSPEKSI>();
    for (const it of ITEM_INSPEKSI) {
      const list = map.get(it.kategori) ?? [];
      list.push(it);
      map.set(it.kategori, list);
    }
    return map;
  }, []);

  async function simpan() {
    setMenyimpan(true);
    try {
      const r = await authFetch('/api/sanitasi', {
        method: 'POST',
        body: JSON.stringify({ site, tanggal, inspektur, nilai }),
      });
      setRingkasan(r.ringkasan as Ringkasan);
      setHasil(r.items as HasilItem[]);
      store.showToast('Inspeksi tersimpan', 'success');
      await loadRiwayat();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan inspeksi', 'error');
    } finally {
      setMenyimpan(false);
    }
  }

  function set(k: string, v: NilaiItem) {
    setNilai((prev) => ({ ...prev, [k]: v }));
  }

  const jumlahTerisi = Object.values(nilai).filter((v) => v !== null && v !== undefined).length;

  return (
    <div className="dashboard" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Toolbar */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-7 w-[150px] rounded-lg text-xs" />
          <Input value={inspektur} onChange={(e) => setInspektur(e.target.value)} placeholder="Nama inspektur" className="h-7 w-[160px] rounded-lg text-xs" />
          <button type="button" onClick={() => void loadRiwayat()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        {ringkasan && (
          <div className="kunjungan-total-right">
            <span>Sesuai <b style={{ color: '#00B894' }}>{ringkasan.sesuai}</b></span>
            <span>Tidak sesuai <b style={{ color: ringkasan.tidakSesuai ? '#FF2D2D' : 'inherit' }}>{ringkasan.tidakSesuai}</b></span>
            <span>Belum dinilai <b style={{ color: ringkasan.belumDinilai ? '#FF7A00' : 'inherit' }}>{ringkasan.belumDinilai}</b></span>
            <span>Kepatuhan <b>{ringkasan.persenSesuai.toFixed(0)}%</b></span>
          </div>
        )}
      </div>

      {!tabelSiap && (
        <div style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 10.5 }}>
          Tabel <b>sanitasi_inspeksi</b> belum dibuat. Jalankan migration
          <code style={{ marginLeft: 3 }}>20261028_sanitasi_inspeksi.sql</code>.
        </div>
      )}

      <div style={{ flexShrink: 0, fontSize: 10, color: 'var(--muted-foreground)', display: 'flex', gap: 5, alignItems: 'center' }}>
        <AlertTriangle size={11} />
        Acuan: BG/QSHE/STD/005 Rev.001 (Permenkes 48/2016 & Permenaker 5/2018). Item kosong = belum dinilai, <b>tidak</b> dianggap patuh.
      </div>

      {/* Form per kategori */}
      {[...perKategori.entries()].map(([kategori, items]) => {
        const kat = ringkasan?.perKategori?.[kategori];
        return (
          <div key={kategori} className="card" style={{ padding: '8px 10px', flexShrink: 0 }}>
            <div className="card-head" style={{ marginBottom: 6 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: '#1ABC9C', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 12 }}>{KATEGORI_LABEL[kategori]}</h2>
                  <p style={{ fontSize: 9 }}>{items.length} parameter diperiksa</p>
                </div>
                {kat && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 9.5, flexShrink: 0 }}>
                    <span style={{ color: '#00B894' }}>✓ {kat.sesuai}</span>
                    <span style={{ color: '#FF2D2D' }}>✗ {kat.tidakSesuai}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>? {kat.belumDinilai}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
              {items.map((it) => {
                const hasilItem = hasil?.find((h) => h.key === it.key);
                const isViolation = hasilItem?.status === 'tidak_sesuai';
                const isOk = hasilItem?.status === 'sesuai';
                return (
                  <label key={it.key} className="flex flex-col gap-0.5" title={`Acuan: ${it.acuan} — ${it.sumber}`}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      {isOk && <CheckCircle2 size={10} color="#00B894" />}
                      {isViolation && <XCircle size={10} color="#FF2D2D" />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                    </span>
                    {it.tipe === 'hitung' ? (
                      <Input
                        inputMode="decimal"
                        value={nilai[it.key] == null ? '' : String(nilai[it.key])}
                        onChange={(e) => set(it.key, e.target.value === '' ? null : Number(e.target.value.replace(',', '.')))}
                        placeholder={it.satuan ? `acuan ${it.acuan} ${it.satuan}` : `acuan ${it.acuan}`}
                        className="h-7 rounded-lg text-xs"
                        style={isViolation ? { borderColor: '#FF2D2D' } : undefined}
                      />
                    ) : (
                      <select
                        value={String(nilai[it.key] ?? '')}
                        onChange={(e) => set(it.key, (e.target.value || null) as NilaiItem)}
                        className="h-7 rounded-lg border-input bg-background px-2 text-xs"
                        style={isViolation ? { borderColor: '#FF2D2D' } : undefined}
                      >
                        <option value="">— belum dinilai —</option>
                        <option value="SESUAI">Sesuai</option>
                        <option value="TIDAK_SESUAI">Tidak sesuai</option>
                        <option value="TIDAK_ADA">Tidak ada</option>
                      </select>
                    )}
                    {hasilItem && (
                      <span style={{ fontSize: 8, color: isViolation ? '#FF2D2D' : 'var(--muted-foreground)', lineHeight: 1.25 }}>
                        {hasilItem.keterangan}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{jumlahTerisi} dari {ITEM_INSPEKSI.length} item terisi</span>
        <Button size="sm" disabled={menyimpan} onClick={() => void simpan()} style={{ gap: 5 }}>
          {menyimpan ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Inspeksi
        </Button>
      </div>

      {/* Riwayat */}
      <div className="card" style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div className="card-head" style={{ marginBottom: 6 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: '#8E44AD', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontSize: 12 }}>Riwayat Inspeksi — {site}</h2>
            <p style={{ fontSize: 9 }}>{riwayat.length} sesi tercatat</p>
          </div>
        </div>
        {!riwayat.length ? (
          <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>
            <ClipboardCheck size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            Belum ada inspeksi tercatat untuk site ini.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Tanggal', 'Inspektur', 'Kepatuhan', 'Sesuai', 'Tidak sesuai', 'Belum dinilai'].map((h) => (
                    <th key={h} style={{ padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => {
                  const k = r.ringkasan;
                  const warna = !k ? 'inherit' : k.persenSesuai >= 90 ? '#00B894' : k.persenSesuai >= 70 ? '#C99A00' : '#FF2D2D';
                  return (
                    <tr key={r.id}>
                      <td style={TD}>{new Date(`${r.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={TD}>{r.inspektur ?? '—'}</td>
                      <td style={{ ...TD, fontWeight: 800, color: warna }}>{k ? `${k.persenSesuai.toFixed(0)}%` : '—'}</td>
                      <td style={{ ...TD, color: '#00B894' }}>{k?.sesuai ?? '—'}</td>
                      <td style={{ ...TD, color: k?.tidakSesuai ? '#FF2D2D' : 'inherit' }}>{k?.tidakSesuai ?? '—'}</td>
                      <td style={{ ...TD, color: 'var(--muted-foreground)' }}>{k?.belumDinilai ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const TD: React.CSSProperties = { padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 10.5 };
