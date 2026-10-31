'use client';

// ============================================================
// Administrator > Higiene Industri > Pencahayaan & Kualitas Udara
// ============================================================
//
// ACUAN: Permenaker 5/2018 Pasal 40–42 (KUDR) dan Permenkes 48/2016
// Tabel 1 & 4 (pencahayaan per peruntukan ruang) — sama dengan
// BG/QSHE/STD/005 Rev.001 yang dipakai perusahaan.
//
// MENGAPA DIPISAH DARI CHECKLIST SANITASI
// Pencahayaan bergantung PERUNTUKAN RUANG (arsip 150 lux vs gambar 750 lux)
// dan harus diukur pada BIDANG KERJA. Kualitas udara diukur per titik dengan
// alat berbeda, dan PM10 sebagai rata-rata 8 jam. Satu angka per site tidak
// bisa mewakili keduanya.
//
// PENTING: penilaian pencahayaan memakai nilai TERENDAH antar titik, bukan
// rata-rata — satu pojok gelap tetap pelanggaran.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import {
  NAB_LUX, NAB_LAIN, NAB_UDARA, CATATAN_METODE,
  type PeruntukanRuang,
} from '@/lib/lingkungan-kerja';

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

interface Titik { id: string; kodeTitik: string; posisi: string; lux: string; suhu: string; kelembapan: string; oksigen: string; pm10: string; asbes: string }
interface Penilaian {
  nabLux: number | null; luxMin: number | null; luxRata: number | null; luxMaks: number | null;
  statusLux: string; jumlahTidakMemenuhi: number; ruangUdaraPerOrang: number | null;
  statusRuangUdara: string; statusTinggiRuangan: string;
  statusUdara: { label: string; nilai: number | null; min: number | null; max: number | null; satuan: string; status: string }[];
}
interface RuangItem {
  id: string; namaRuang: string; peruntukan: PeruntukanRuang;
  luasM2: number | null; jumlahPekerja: number | null; tinggiRuanganM: number | null;
  ventilasiBuatan: boolean; tanggalBersihVentilasi: string | null;
  pengukuranTerakhir: Record<string, unknown> | null;
  penilaian: Penilaian | null;
}
interface Ringkasan { jumlahRuang: number; sudahDiukur: number; tidakMemenuhi: number; luxTidakMemenuhi: number }

const STATUS_WARNA: Record<string, string> = {
  memenuhi: '#00B894', 'tidak-memenuhi': '#FF2D2D', 'tidak-dinilai': '#778899',
};

export default function InspeksiLingkungan() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const pengukur = profile?.full_name || profile?.username || '—';

  const [site, setSite] = useState('Head Office');
  const [data, setData] = useState<RuangItem[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabelSiap, setTabelSiap] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [formBuka, setFormBuka] = useState(false);
  const [pesan, setPesan] = useState('');

  // Form ruang + pengukuran
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [namaRuang, setNamaRuang] = useState('');
  const [peruntukan, setPeruntukan] = useState<PeruntukanRuang>('ruang_kerja');
  const [luasM2, setLuasM2] = useState('');
  const [jumlahPekerja, setJumlahPekerja] = useState('');
  const [tinggiRuangan, setTinggiRuangan] = useState('');
  const [alatLux, setAlatLux] = useState('');
  const [alatUdara, setAlatUdara] = useState('');
  const [titik, setTitik] = useState<Titik[]>([
    { id: 't1', kodeTitik: 'T1', posisi: '', lux: '', suhu: '', kelembapan: '', oksigen: '', pm10: '', asbes: '' },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`/api/lingkungan?site=${encodeURIComponent(site)}`);
      setData((r.data ?? []) as RuangItem[]);
      setRingkasan((r.ringkasan ?? null) as Ringkasan | null);
      setTabelSiap(r.tabelSiap !== false);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [site]);

  useEffect(() => { void load(); }, [load]);

  const nabLux = NAB_LUX[peruntukan]?.min;

  // Pratinjau penilaian real-time dari isian form.
  const pratinjau = useMemo(() => {
    const luxList = titik.map((t) => Number(String(t.lux).replace(',', '.'))).filter((n) => Number.isFinite(n) && n > 0);
    if (!luxList.length || nabLux === null) return null;
    const min = Math.min(...luxList);
    return { min, ok: min >= nabLux };
  }, [titik, nabLux]);

  async function simpan() {
    if (!namaRuang.trim()) { setPesan('Nama ruang wajib diisi'); return; }
    const adaLux = titik.some((t) => String(t.lux).trim() !== '');
    if (!adaLux) { setPesan('Isi minimal satu nilai lux'); return; }

    setMenyimpan(true);
    setPesan('');
    try {
      await authFetch('/api/lingkungan', {
        method: 'POST',
        body: JSON.stringify({
          site, namaRuang: namaRuang.trim(), peruntukan, tanggal,
          luasM2: luasM2 || null, jumlahPekerja: jumlahPekerja || null, tinggiRuanganM: tinggiRuangan || null,
          alatLuxmeter: alatLux, alatKualitasUdara: alatUdara, pengukur,
          titik: titik.map((t) => ({
            kodeTitik: t.kodeTitik, posisi: t.posisi,
            lux: t.lux, suhu: t.suhu, kelembapan: t.kelembapan,
            oksigen: t.oksigen, pm10: t.pm10, asbes: t.asbes,
          })),
        }),
      });
      store.showToast('Pengukuran tersimpan', 'success');
      setNamaRuang(''); setLuasM2(''); setJumlahPekerja(''); setTinggiRuangan('');
      setTitik([{ id: 't1', kodeTitik: 'T1', posisi: '', lux: '', suhu: '', kelembapan: '', oksigen: '', pm10: '', asbes: '' }]);
      setFormBuka(false);
      await load();
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div className="dashboard" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Toolbar — seragam dengan halaman lain */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-7 w-[150px] rounded-lg text-xs" />
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', padding: '0 4px' }}>Pengukur: <b>{pengukur}</b></span>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => setFormBuka((v) => !v)} className="mcu-dashboard-refresh">
            <Plus size={13} /> {formBuka ? 'Tutup Form' : 'Ruang Baru / Ukur'}
          </button>
        </div>
        {ringkasan && (
          <div className="kunjungan-total-right">
            <span>Ruang <b>{ringkasan.jumlahRuang}</b></span>
            <span>Sudah diukur <b>{ringkasan.sudahDiukur}</b></span>
            <span>Lux tidak memenuhi <b style={{ color: ringkasan.luxTidakMemenuhi ? '#FF2D2D' : 'inherit' }}>{ringkasan.luxTidakMemenuhi}</b></span>
            <span>Total tidak memenuhi <b style={{ color: ringkasan.tidakMemenuhi ? '#FF2D2D' : 'inherit' }}>{ringkasan.tidakMemenuhi}</b></span>
          </div>
        )}
      </div>

      {!tabelSiap && (
        <div style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 10.5 }}>
          Tabel pencahayaan &amp; kualitas udara belum dibuat. Jalankan migration
          <code style={{ marginLeft: 3 }}>20261031_inspeksi_lingkungan.sql</code>.
        </div>
      )}

      {/* FORM PENGUKURAN */}
      {formBuka && (
        <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 12 }}>Pengukuran Ruang</h2>
              <p style={{ fontSize: 9.5 }}>Satu ruang per sesi. Titik ukur boleh lebih dari satu.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2" style={{ marginBottom: 8 }}>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Nama ruang</span>
              <Input value={namaRuang} onChange={(e) => setNamaRuang(e.target.value)} placeholder="mis. Ruang Admin" className="h-8 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">
                Peruntukan {nabLux !== null && <span style={{ color: '#9a6b00' }}>· NAB {nabLux} lux</span>}
              </span>
              <select value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as PeruntukanRuang)} className="h-8 rounded-lg border-input bg-background px-2 text-sm">
                {(Object.keys(NAB_LUX) as PeruntukanRuang[]).map((k) => (
                  <option key={k} value={k}>{NAB_LUX[k].label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Luas (m²)</span>
              <Input value={luasM2} onChange={(e) => setLuasM2(e.target.value)} inputMode="decimal" placeholder="40" className="h-8 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Jumlah pekerja</span>
              <Input value={jumlahPekerja} onChange={(e) => setJumlahPekerja(e.target.value)} inputMode="numeric" placeholder="5" className="h-8 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Tinggi ruangan (m)</span>
              <Input value={tinggiRuangan} onChange={(e) => setTinggiRuangan(e.target.value)} inputMode="decimal" placeholder="3" className="h-8 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">Alat luxmeter</span>
              <Input value={alatLux} onChange={(e) => setAlatLux(e.target.value)} placeholder="merek / nomor" className="h-8 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] font-semibold text-muted-foreground">Alat kualitas udara</span>
              <Input value={alatUdara} onChange={(e) => setAlatUdara(e.target.value)} placeholder="thermohygrometer / PM10 meter / gas detector" className="h-8 rounded-lg text-sm" />
            </label>
          </div>

          {/* Titik ukur */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
                Titik ukur ({titik.length})
              </span>
              <button
                type="button"
                onClick={() => setTitik((p) => [...p, { id: `t${Date.now()}`, kodeTitik: `T${p.length + 1}`, posisi: '', lux: '', suhu: '', kelembapan: '', oksigen: '', pm10: '', asbes: '' }])}
                className="mcu-dashboard-refresh"
                style={{ height: 24, fontSize: 9.5 }}
              >
                <Plus size={11} /> Tambah titik
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Titik', 'Posisi', `Lux (NAB ≥${nabLux ?? '—'})`, 'Suhu °C', 'Kelembapan %', 'O₂ %', 'PM10 mg/m³', 'Asbes serat/ml', ''].map((h) => (
                      <th key={h} style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', fontSize: 8.5, textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {titik.map((t, i) => (
                    <tr key={t.id}>
                      <td style={TD}><Input value={t.kodeTitik} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, kodeTitik: e.target.value } : x))} className="h-7 w-[54px] rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.posisi} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, posisi: e.target.value } : x))} placeholder="tengah / pojok" className="h-7 rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.lux} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, lux: e.target.value } : x))} inputMode="numeric" placeholder={String(nabLux ?? '')} className="h-7 w-[70px] rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.suhu} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, suhu: e.target.value } : x))} inputMode="decimal" placeholder={`${NAB_UDARA.suhu.min}-${NAB_UDARA.suhu.max}`} className="h-7 w-[70px] rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.kelembapan} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, kelembapan: e.target.value } : x))} inputMode="numeric" placeholder={`${NAB_UDARA.kelembapan.min}-${NAB_UDARA.kelembapan.max}`} className="h-7 w-[70px] rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.oksigen} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, oksigen: e.target.value } : x))} inputMode="decimal" placeholder={`${NAB_UDARA.oksigen.min}-${NAB_UDARA.oksigen.max}`} className="h-7 w-[70px] rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.pm10} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, pm10: e.target.value } : x))} inputMode="decimal" placeholder="≤0,15" className="h-7 w-[80px] rounded-md text-xs" /></td>
                      <td style={TD}><Input value={t.asbes} onChange={(e) => setTitik((p) => p.map((x, j) => j === i ? { ...x, asbes: e.target.value } : x))} inputMode="decimal" placeholder="≤0,1" className="h-7 w-[80px] rounded-md text-xs" /></td>
                      <td style={TD}>
                        {titik.length > 1 && (
                          <button type="button" onClick={() => setTitik((p) => p.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#b3261e' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pratinjau hasil */}
          {pratinjau && (
            <div style={{ padding: '7px 10px', borderRadius: 8, fontSize: 10.5, marginBottom: 8, background: pratinjau.ok ? 'rgba(0,184,148,0.08)' : 'rgba(255,45,45,0.08)', border: `1px solid ${pratinjau.ok ? 'rgba(0,184,148,0.35)' : 'rgba(255,45,45,0.35)'}` }}>
              <b>Lux terendah: {pratinjau.min}</b> · NAB {nabLux} → {pratinjau.ok ? 'memenuhi' : 'TIDAK memenuhi'}
              <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 2 }}>
                Penilaian memakai nilai terendah antar titik, bukan rata-rata.
              </div>
            </div>
          )}

          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 8 }}>
            {Object.values(CATATAN_METODE).join(' ')}
          </div>

          {pesan && <div style={{ fontSize: 10.5, color: '#b3261e', marginBottom: 6 }}>{pesan}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setFormBuka(false)}>Batal</Button>
            <Button size="sm" disabled={menyimpan} onClick={() => void simpan()} style={{ gap: 5 }}>
              {menyimpan ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan Pengukuran
            </Button>
          </div>
        </div>
      )}

      {/* DAFTAR RUANG */}
      {loading && !data.length && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
          <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat…
        </div>
      )}

      {!loading && !data.length && tabelSiap && (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11.5 }}>
          Belum ada ruang terukur untuk site ini. Klik <b>Ruang Baru / Ukur</b> untuk memulai.
        </div>
      )}

      {data.map((r) => {
        const p = r.penilaian;
        const rusak = (p?.jumlahTidakMemenuhi ?? 0) > 0;
        return (
          <div key={r.id} className="card" style={{ padding: '8px 10px', flexShrink: 0 }}>
            <div className="card-head" style={{ marginBottom: 6 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: rusak ? '#FF2D2D' : '#00B894', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ fontSize: 12 }}>{r.namaRuang}</h2>
                <p style={{ fontSize: 9 }}>
                  {NAB_LUX[r.peruntukan]?.label} · NAB {p?.nabLux ?? '—'} lux
                  {p && ` · terukur min ${p.luxMin ?? '—'} (rata ${p.luxRata ?? '—'})`}
                </p>
              </div>
              {p && (
                <span style={{ fontSize: 9.5, fontWeight: 800, color: STATUS_WARNA[p.statusLux] ?? 'inherit', flexShrink: 0 }}>
                  {p.statusLux === 'memenuhi' ? <CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> : <XCircle size={12} style={{ verticalAlign: -2 }} />}
                  {' '}Lux {p.statusLux === 'memenuhi' ? 'memenuhi' : p.statusLux === 'tidak-memenuhi' ? 'tidak memenuhi' : 'belum dinilai'}
                </span>
              )}
            </div>

            {!p ? (
              <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>Belum ada pengukuran.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                {p.statusUdara.map((u) => (
                  <div key={u.label} style={{ padding: '5px 8px', borderRadius: 8, background: `${STATUS_WARNA[u.status]}12`, border: `1px solid ${STATUS_WARNA[u.status]}33` }}>
                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{u.label}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: STATUS_WARNA[u.status] }}>
                      {u.nilai ?? '—'} <span style={{ fontSize: 9, fontWeight: 500 }}>{u.satuan}</span>
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--muted-foreground)' }}>
                      {u.min !== null && u.max !== null ? `${u.min}–${u.max}` : u.max !== null ? `≤${u.max}` : u.min !== null ? `≥${u.min}` : '—'}
                    </div>
                  </div>
                ))}
                <div style={{ padding: '5px 8px', borderRadius: 8, background: `${STATUS_WARNA[p.statusRuangUdara]}12`, border: `1px solid ${STATUS_WARNA[p.statusRuangUdara]}33` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Ruang udara</div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: STATUS_WARNA[p.statusRuangUdara] }}>
                    {p.ruangUdaraPerOrang ?? '—'} <span style={{ fontSize: 9, fontWeight: 500 }}>m³/orang</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted-foreground)' }}>min {NAB_LAIN.ruangUdaraPerOrang.min}</div>
                </div>
                <div style={{ padding: '5px 8px', borderRadius: 8, background: `${STATUS_WARNA[p.statusTinggiRuangan]}12`, border: `1px solid ${STATUS_WARNA[p.statusTinggiRuangan]}33` }}>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Tinggi ruangan</div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: STATUS_WARNA[p.statusTinggiRuangan] }}>
                    {r.tinggiRuanganM ?? '—'} <span style={{ fontSize: 9, fontWeight: 500 }}>m</span>
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted-foreground)' }}>min {NAB_LAIN.tinggiRuangan.min}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TD: React.CSSProperties = { padding: '3px 5px', borderBottom: '1px solid var(--border)' };
