'use client';

// Administrator > Higiene Industri > Form Pengukuran Pencahayaan
//
// Standar: Permenkes 48/2016 Tabel 4 & Permenaker 5/2018.
// - Pengukuran wajib dilakukan pada BIDANG KERJA (0,85 m).
// - Penilaian kepatuhan ditentukan oleh nilai LUX TERENDAH antar-titik ukur.
// - Kode titik ukur terintegrasi dengan referensi titik ukur Noise Mapping.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, UserRound, XCircle } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { NAB_LUX, type PeruntukanRuang } from '@/lib/lingkungan-kerja';
import { Btn, Field, Section, SITES, getNextKodeTitik, grid4, inputStyle, smallInput, tableStyle, thStyle, tdStyle } from './hc-ergo-ui';

interface TitikLux {
  id: string;
  kodeTitik: string;
  posisi: string;
  lux: string;
}

const newTitikLux = (n: number, defaultKode?: string, defaultPosisi?: string): TitikLux => ({
  id: `t_${Date.now()}_${n}`,
  kodeTitik: defaultKode || `T${n}`,
  posisi: defaultPosisi || '',
  lux: '',
});

export default function InspeksiPencahayaan() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const namaPengukur = profile?.full_name || profile?.username || '';

  const [site, setSite] = useState('Head Office');
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

  // Referensi titik ukur dari Noise Mapping
  const [refTitikNoise, setRefTitikNoise] = useState<{ kode: string; deskripsi: string; area: string }[]>([]);

  const [titikList, setTitikList] = useState<TitikLux[]>([
    newTitikLux(1, 'T1', 'Meja Kerja Utama'),
    newTitikLux(2, 'T2', 'Area Tengah Ruang'),
  ]);

  useEffect(() => {
    if (namaPengukur && !pengukur) {
      setPengukur(namaPengukur);
    }
  }, [namaPengukur, pengukur]);

  // Load referensi titik ukur dari Noise Mapping untuk site aktif
  const loadNoiseReference = useCallback(async () => {
    try {
      const res = await authFetch(`/api/hc?resource=noise`);
      const surveys: any[] = res.data || [];
      const pts: { kode: string; deskripsi: string; area: string }[] = [];

      for (const s of surveys) {
        if (!site || s.hc_area?.site === site) {
          const areaName = s.hc_area?.nama_area || '';
          for (const p of s.hc_noise_point || []) {
            if (p.kode_titik && !pts.some((x) => x.kode === p.kode_titik && x.area === areaName)) {
              pts.push({
                kode: p.kode_titik,
                deskripsi: p.deskripsi || '',
                area: areaName,
              });
            }
          }
        }
      }
      setRefTitikNoise(pts);
    } catch {
      setRefTitikNoise([]);
    }
  }, [site]);

  useEffect(() => {
    void loadNoiseReference();
  }, [loadNoiseReference]);

  const nabInfo = NAB_LUX[peruntukan];
  const nabMin = nabInfo?.min ?? null;

  // Real-time audit calculation of lowest measured lux
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
    const lastKode = titikList[titikList.length - 1]?.kodeTitik;
    const nextKode = getNextKodeTitik(lastKode, titikList.length + 1);
    setTitikList((prev) => [
      ...prev,
      { id: `t_${Date.now()}_${titikList.length + 1}`, kodeTitik: nextKode, posisi: '', lux: '' },
    ]);
  };

  const hapusTitik = (id: string) => {
    if (titikList.length <= 1) return;
    setTitikList((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTitik = (id: string, key: keyof TitikLux, val: string) => {
    setTitikList((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, [key]: val };
      // Bila memilih dari kode noise mapping, auto-isi posisi jika masih kosong
      if (key === 'kodeTitik') {
        const found = refTitikNoise.find((r) => r.kode === val);
        if (found && !t.posisi) {
          updated.posisi = found.deskripsi || found.area;
        }
      }
      return updated;
    }));
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
      setPesan({ kind: 'ok', text: `Pengukuran ruang ${namaRuang} berhasil disimpan. Riwayat dapat dilihat dengan menekan tombol panah di kanan.` });

      // Reset form
      setNamaRuang('');
      setLuasM2('');
      setJumlahPekerja('');
      setCatatan('');
      setTitikList([
        newTitikLux(1, 'T1', 'Meja Kerja Utama'),
        newTitikLux(2, 'T2', 'Area Tengah Ruang'),
      ]);
    } catch (err) {
      setPesan({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menyimpan data' });
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Pengukuran Pencahayaan Tempat Kerja (Lux)</h1>
          <p className="admin-form-subtitle">
            Evaluasi intensitas pencahayaan pada bidang kerja peruntukan ruang sesuai standar K3 Lingkungan Kerja &amp; Perkantoran.
          </p>
        </div>

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

        {/* Form Pengukuran Ruang */}
        <form onSubmit={simpan}>
          {/* Section 1: Lokasi & Pengukur : Baris Lurus */}
          <Section title="Informasi Lokasi &amp; Pengukur">
            <div style={grid4}>
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
                <input className="admin-input" style={smallInput} value={alatLux} onChange={(e) => setAlatLux(e.target.value)} placeholder="mis. Luxmeter Digital" />
              </Field>
            </div>
          </Section>

          {/* Section 2: Spesifikasi Ruangan : Baris Lurus */}
          <Section title="Identifikasi Ruangan &amp; Standar NAB">
            <div style={grid4}>
              <Field label="Nama Ruangan">
                <input required className="admin-input" style={smallInput} value={namaRuang} onChange={(e) => setNamaRuang(e.target.value)} placeholder="mis. Ruang Engineering" />
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

          {/* Datalist untuk referensi Titik Ukur dari Noise Mapping */}
          <datalist id="noise-points-ref">
            {refTitikNoise.map((r, idx) => (
              <option key={idx} value={r.kode}>
                {r.area ? `${r.area} : ` : ''}{r.deskripsi}
              </option>
            ))}
          </datalist>

          {/* Section 3: Titik Pengukuran */}
          <Section title="Titik Pengukuran Intensitas Cahaya (Bidang Kerja 0,85 m)">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                Kode titik ukur ditulis manual sesuai kode area (mis. <b>WS-T1</b> untuk Workshop, <b>OF-T1</b> untuk Office, dsb.) atau dapat memilih dari referensi Noise Mapping.
              </span>
              <Btn type="button" onClick={tambahTitik} style={{ height: 28, fontSize: 11 }}>
                <Plus size={12} /> Tambah Titik Ukur
              </Btn>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '18%' }}>Kode Titik Ukur</th>
                    <th style={{ ...thStyle, width: '36%' }}>Posisi / Deskripsi Titik Ukur</th>
                    <th style={{ ...thStyle, width: '22%' }}>Hasil Ukur (Lux)</th>
                    <th style={{ ...thStyle, width: '16%' }}>Status Titik</th>
                    <th style={{ ...thStyle, width: '8%', textAlign: 'center' }}>Aksi</th>
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
                            list="noise-points-ref"
                            className="admin-input"
                            style={{ ...smallInput, height: 28, fontWeight: 700 }}
                            placeholder="mis. WS-T1"
                            title="Kode titik ukur (dapat ditulis manual mis. WS-T1 atau pilih dari titik Noise Mapping)"
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
                      Penilaian ruang memakai <b>Lux Terendah</b> ({evaluasiLux.min} Lux vs NAB {nabMin} Lux).
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
      </div>
    </div>
  );
}
