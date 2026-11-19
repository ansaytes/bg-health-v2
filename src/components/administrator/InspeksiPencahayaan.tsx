'use client';

// ============================================================
// Administrator > Higiene Industri > Pengukuran Pencahayaan
// ============================================================
//
// ACUAN K3:
// 1. Permenkes No. 48 Tahun 2016 Tabel 4 (Standar Pencahayaan Peruntukan Ruang Perkantoran)
// 2. Permenaker No. 5 Tahun 2018 Pasal 16–21 (Pencahayaan di Tempat Kerja)
// 3. Kepmen ESDM No. 1827 K/30/MEM/2018 Lampiran II (Pencahayaan Area Tambang & Fasilitas Penunjang)
//
// METODE AUDIT SMKP & HIGIENE INDUSTRI:
// - Pengukuran wajib dilakukan pada BIDANG KERJA (umumnya 0,85 m di atas lantai untuk meja kerja).
// - Penilaian kepatuhan ditentukan oleh nilai LUX TERENDAH antar-titik ukur, bukan rata-rata.
//   Satu titik di bawah Nilai Ambang Batas (NAB) merupakan ketidaksesuaian.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, UserRound, XCircle } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { NAB_LUX, type PeruntukanRuang } from '@/lib/lingkungan-kerja';
import { Btn, Field, Section, SITES, inputStyle, smallInput, tableStyle, thStyle, tdStyle, fmtDate } from './hc-ergo-ui';

interface TitikLux {
  id: string;
  kodeTitik: string;
  posisi: string;
  lux: string;
}

interface RuangItem {
  id: string;
  namaRuang: string;
  peruntukan: PeruntukanRuang;
  luasM2: number | null;
  jumlahPekerja: number | null;
  tinggiRuanganM: number | null;
  pengukuranTerakhir: Record<string, unknown> | null;
  penilaian: {
    nabLux: number | null;
    luxMin: number | null;
    luxRata: number | null;
    luxMaks: number | null;
    statusLux: string;
  } | null;
}

interface Ringkasan {
  jumlahRuang: number;
  sudahDiukur: number;
  luxTidakMemenuhi: number;
}

export default function InspeksiPencahayaan() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const namaPengukur = profile?.full_name || profile?.username || '';

  const [site, setSite] = useState('Head Office');
  const [data, setData] = useState<RuangItem[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabelSiap, setTabelSiap] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Form Fields
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [pengukur, setPengukur] = useState(namaPengukur);
  const [namaRuang, setNamaRuang] = useState('');
  const [peruntukan, setPeruntukan] = useState<PeruntukanRuang>('ruang_kerja');
  const [luasM2, setLuasM2] = useState('');
  const [jumlahPekerja, setJumlahPekerja] = useState('');
  const [tinggiRuangan, setTinggiRuangan] = useState('3.0');
  const [alatLux, setAlatLux] = useState('Luxmeter Digital (Terkalibrasi)');
  const [catatan, setCatatan] = useState('');

  const [titikList, setTitikList] = useState<TitikLux[]>([
    { id: 't1', kodeTitik: 'T1', posisi: 'Meja Kerja Utama', lux: '' },
    { id: 't2', kodeTitik: 'T2', posisi: 'Area Tengah Ruang', lux: '' },
  ]);

  useEffect(() => {
    if (namaPengukur && !pengukur) {
      setPengukur(namaPengukur);
    }
  }, [namaPengukur, pengukur]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setPesan(null);
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const nabInfo = NAB_LUX[peruntukan];
  const nabMin = nabInfo?.min ?? null;

  // Real-time live calculation of lowest measured lux
  const evaluasiLux = useMemo(() => {
    const luxNums = titikList
      .map((t) => Number(String(t.lux).replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!luxNums.length || nabMin === null) return null;
    const min = Math.min(...luxNums);
    const avg = Number((luxNums.reduce((a, b) => a + b, 0) / luxNums.length).toFixed(1));
    const max = Math.max(...luxNums);
    const memenuhi = min >= nabMin;

    return { min, avg, max, memenuhi, count: luxNums.length };
  }, [titikList, nabMin]);

  const tambahTitik = () => {
    const nextIdx = titikList.length + 1;
    setTitikList((prev) => [
      ...prev,
      { id: `t${Date.now()}`, kodeTitik: `T${nextIdx}`, posisi: '', lux: '' },
    ]);
  };

  const hapusTitik = (id: string) => {
    if (titikList.length <= 1) return;
    setTitikList((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTitik = (id: string, key: keyof TitikLux, val: string) => {
    setTitikList((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: val } : t)));
  };

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!namaRuang.trim()) {
      setPesan({ kind: 'err', text: 'Nama ruang wajib diisi' });
      return;
    }
    const adaLux = titikList.some((t) => String(t.lux).trim() !== '');
    if (!adaLux) {
      setPesan({ kind: 'err', text: 'Harap isi minimal 1 titik pengukuran lux' });
      return;
    }

    setMenyimpan(true);
    setPesan(null);
    try {
      await authFetch('/api/lingkungan', {
        method: 'POST',
        body: JSON.stringify({
          site,
          namaRuang: namaRuang.trim(),
          peruntukan,
          tanggal,
          luasM2: luasM2 ? Number(luasM2) : null,
          jumlahPekerja: jumlahPekerja ? Number(jumlahPekerja) : null,
          tinggiRuanganM: tinggiRuangan ? Number(tinggiRuangan) : null,
          alatLuxmeter: alatLux,
          pengukur: pengukur || namaPengukur,
          catatan,
          titik: titikList.map((t) => ({
            kodeTitik: t.kodeTitik,
            posisi: t.posisi,
            lux: t.lux ? Number(t.lux.replace(',', '.')) : null,
          })),
        }),
      });

      store.showToast('Data pengukuran pencahayaan berhasil disimpan', 'success');
      setPesan({ kind: 'ok', text: `Pengukuran ruang ${namaRuang} berhasil disimpan.` });

      // Reset form fields
      setNamaRuang('');
      setLuasM2('');
      setJumlahPekerja('');
      setCatatan('');
      setTitikList([
        { id: 't1', kodeTitik: 'T1', posisi: 'Meja Kerja Utama', lux: '' },
        { id: 't2', kodeTitik: 'T2', posisi: 'Area Tengah Ruang', lux: '' },
      ]);
      await loadData();
    } catch (err) {
      setPesan({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan data' });
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 className="admin-form-title">Pengukuran Pencahayaan Tempat Kerja (Lux)</h1>
          <p className="admin-form-subtitle">
            Evaluasi intensitas pencahayaan pada bidang kerja peruntukan ruang sesuai Permenkes 48/2016 Tabel 4 &amp; Permenaker 5/2018.
          </p>
        </div>

        {!tabelSiap && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
            Tabel database pencahayaan belum dibuat. Jalankan migration <code>20261031_inspeksi_lingkungan.sql</code>.
          </div>
        )}

        {pesan && (
          <div style={{
            marginBottom: 14,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            background: pesan.kind === 'ok' ? 'rgba(0,184,148,0.1)' : 'rgba(255,45,45,0.1)',
            color: pesan.kind === 'ok' ? '#00B894' : '#FF2D2D',
            border: `1px solid ${pesan.kind === 'ok' ? '#00B894' : '#FF2D2D'}`,
          }}>
            {pesan.text}
          </div>
        )}

        {/* Ringkasan Status Site */}
        {ringkasan && (
          <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--muted)', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
            <span>Total Ruang Terdata: <b>{ringkasan.jumlahRuang}</b></span>
            <span>Telah Diukur: <b>{ringkasan.sudahDiukur}</b></span>
            <span>Lux Memenuhi NAB: <b style={{ color: '#00B894' }}>{Math.max(0, ringkasan.sudahDiukur - ringkasan.luxTidakMemenuhi)}</b></span>
            <span>Lux Di Bawah NAB: <b style={{ color: ringkasan.luxTidakMemenuhi ? '#FF2D2D' : '#00B894' }}>{ringkasan.luxTidakMemenuhi}</b></span>
          </div>
        )}

        {/* Form Pengukuran Ruang */}
        <form onSubmit={simpan}>
          <Section title="Informasi Lokasi &amp; Pengukur">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Field label="Job Site">
                <select className="admin-input" style={smallInput} value={site} onChange={(e) => setSite(e.target.value)}>
                  {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Tanggal Pengukuran">
                <input type="date" required className="admin-input" style={smallInput} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </Field>

              <Field label="Personil Pengukur" hint="(Otomatis Login)">
                <div
                  title="Diisi otomatis dari akun yang sedang login"
                  style={{
                    ...smallInput,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                    cursor: 'not-allowed',
                  }}
                >
                  <UserRound size={13} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {pengukur || namaPengukur}
                  </span>
                </div>
              </Field>

              <Field label="Peralatan Luxmeter" hint="(Merk & Kalibrasi)">
                <input className="admin-input" style={smallInput} value={alatLux} onChange={(e) => setAlatLux(e.target.value)} placeholder="mis. Luxmeter Kyoritsu / Testo 540" />
              </Field>
            </div>
          </Section>

          <Section title="Identifikasi Ruangan &amp; Standar NAB">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Field label="Nama Ruangan" hint="(Contoh: Ruang Engineering)">
                <input required className="admin-input" style={smallInput} value={namaRuang} onChange={(e) => setNamaRuang(e.target.value)} placeholder="Nama ruang / area spesifik" />
              </Field>

              <Field label="Peruntukan Ruang">
                <select className="admin-input" style={smallInput} value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as PeruntukanRuang)}>
                  {Object.entries(NAB_LUX).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label} {v.min ? `(NAB: ${v.min} Lux)` : '(Manual)'}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Luas Ruangan (m²)">
                <input type="number" step="any" className="admin-input" style={smallInput} value={luasM2} onChange={(e) => setLuasM2(e.target.value)} placeholder="Luas lantai m²" />
              </Field>

              <Field label="Jumlah Pekerja">
                <input type="number" className="admin-input" style={smallInput} value={jumlahPekerja} onChange={(e) => setJumlahPekerja(e.target.value)} placeholder="Jumlah penghuni" />
              </Field>
            </div>

            {/* Banner Kriteria NAB */}
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 7, background: 'rgba(255,77,0,0.06)', border: '1px solid rgba(255,77,0,0.2)', fontSize: 11.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Standar NAB <b>{nabInfo?.label}</b>: <b style={{ color: 'var(--brand-primary, #ff4d00)' }}>{nabMin ? `${nabMin} Lux` : 'Kustom / Evaluasi Ahli'}</b> (pada bidang kerja 0,85 m).</span>
              <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>{nabInfo?.sumber}</span>
            </div>
          </Section>

          <Section title="Titik Pengukuran Intensitas Cahaya (Bidang Kerja)">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                Tinggi bidang kerja standar: <b>0,85 meter</b> dari lantai. Masukkan hasil bacaan alat pada tiap titik.
              </span>
              <Btn type="button" onClick={tambahTitik} style={{ height: 28, fontSize: 11 }}>
                <Plus size={12} /> Tambah Titik Ukur
              </Btn>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '12%' }}>Kode Titik</th>
                    <th style={{ ...thStyle, width: '38%' }}>Posisi / Deskripsi Titik Ukur</th>
                    <th style={{ ...thStyle, width: '25%' }}>Hasil Ukur (Lux)</th>
                    <th style={{ ...thStyle, width: '15%' }}>Status Titik</th>
                    <th style={{ ...thStyle, width: '10%', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {titikList.map((t) => {
                    const luxVal = Number(String(t.lux).replace(',', '.'));
                    const isFilled = Number.isFinite(luxVal) && luxVal > 0;
                    const isOk = isFilled && nabMin !== null ? luxVal >= nabMin : null;

                    return (
                      <tr key={t.id}>
                        <td style={tdStyle}>
                          <input
                            className="admin-input"
                            style={{ ...smallInput, height: 28, fontWeight: 700 }}
                            value={t.kodeTitik}
                            onChange={(e) => updateTitik(t.id, 'kodeTitik', e.target.value)}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            className="admin-input"
                            style={{ ...smallInput, height: 28 }}
                            value={t.posisi}
                            onChange={(e) => updateTitik(t.id, 'posisi', e.target.value)}
                            placeholder="mis. Meja Staf Admin / Dekat Lemari"
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            step="any"
                            className="admin-input"
                            style={{ ...smallInput, height: 28, fontWeight: 700 }}
                            value={t.lux}
                            onChange={(e) => updateTitik(t.id, 'lux', e.target.value)}
                            placeholder="Nilai lux"
                          />
                        </td>
                        <td style={tdStyle}>
                          {!isFilled ? (
                            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Belum diisi</span>
                          ) : isOk ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#00B894', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} /> Memenuhi
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF2D2D', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <XCircle size={12} /> Di Bawah NAB
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => hapusTitik(t.id)}
                            disabled={titikList.length <= 1}
                            style={{ background: 'none', border: 'none', color: titikList.length <= 1 ? 'var(--muted)' : '#FF2D2D', cursor: titikList.length <= 1 ? 'not-allowed' : 'pointer', padding: 4 }}
                            title="Hapus titik ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Real-Time Live Audit Evaluation */}
            {evaluasiLux && (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, border: `1px solid ${evaluasiLux.memenuhi ? '#00B894' : '#FF2D2D'}`, background: evaluasiLux.memenuhi ? 'rgba(0,184,148,0.06)' : 'rgba(255,45,45,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: evaluasiLux.memenuhi ? '#00B894' : '#FF2D2D' }}>
                      {evaluasiLux.memenuhi ? '✓ TINGKAT PENCAHAYAAN MEMENUHI NAB' : '✗ TIDAK MEMENUHI NAB (TERDAPAT TITIK KURANG TERANG)'}
                    </span>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                      Berdasarkan kriteria audit SMKP: penilaian ruang memakai <b>Lux Terendah</b> ({evaluasiLux.min} Lux vs NAB {nabMin} Lux).
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5 }}>
                    <span>Terendah: <b style={{ color: evaluasiLux.min >= (nabMin ?? 0) ? '#00B894' : '#FF2D2D' }}>{evaluasiLux.min} Lux</b></span>
                    <span>Rata-rata: <b>{evaluasiLux.avg} Lux</b></span>
                    <span>Tertinggi: <b>{evaluasiLux.max} Lux</b></span>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Tombol Simpan */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, margin: '16px 0 24px' }}>
            <Btn kind="primary" size="md" type="submit" disabled={menyimpan}>
              {menyimpan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Pengukuran Pencahayaan
            </Btn>
          </div>
        </form>

        {/* Section Riwayat Pengukuran Ruang */}
        <Section title={`Daftar Pengukuran Pencahayaan Ruangan — ${site}`}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Btn type="button" onClick={() => void loadData()} disabled={loading} style={{ height: 28 }}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Daftar
            </Btn>
          </div>

          {!data.length ? (
            <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '4px 0' }}>
              Belum ada data pengukuran ruang tercatat untuk site ini.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Nama Ruangan', 'Peruntukan', 'Luas / Pekerja', 'Lux Terendah', 'Standar NAB', 'Status Kepatuhan', 'Tanggal Terakhir'].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => {
                    const p = r.penilaian;
                    const status = p?.statusLux;
                    const warna = status === 'memenuhi' ? '#00B894' : status === 'tidak-memenuhi' ? '#FF2D2D' : 'var(--muted-foreground)';

                    return (
                      <tr key={r.id}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{r.namaRuang}</td>
                        <td style={tdStyle}>{NAB_LUX[r.peruntukan]?.label || r.peruntukan}</td>
                        <td style={tdStyle}>{r.luasM2 ? `${r.luasM2} m²` : '—'} / {r.jumlahPekerja ? `${r.jumlahPekerja} org` : '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{p?.luxMin != null ? `${p.luxMin} Lux` : '—'}</td>
                        <td style={tdStyle}>{p?.nabLux != null ? `${p.nabLux} Lux` : '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: warna }}>
                          {status === 'memenuhi' ? '✓ Memenuhi' : status === 'tidak-memenuhi' ? '✗ Tidak Memenuhi' : 'Belum Diukur'}
                        </td>
                        <td style={tdStyle}>
                          {r.pengukuranTerakhir?.tanggal ? fmtDate(String(r.pengukuranTerakhir.tanggal)) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
