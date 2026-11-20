'use client';

// ============================================================
// Administrator > Higiene Industri > Form Kualitas Udara & Debu
// ============================================================
//
// Standar: Permenaker 5/2018 Pasal 40–42 & Permenkes 48/2016.
// - Parameter fisik: Suhu (23–26°C), RH (40–60%).
// - Parameter kimia: O2 (19.5–23.5%), PM10 (<=0.15 mg/m3), Asbes (<=0.1 serat/ml).
// - Kode titik ukur terintegrasi dengan referensi titik ukur Noise Mapping.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, UserRound, Wind, XCircle } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { NAB_UDARA, NAB_LAIN, type PeruntukanRuang } from '@/lib/lingkungan-kerja';
import { Btn, Field, Section, SITES, getNextKodeTitik, grid4, inputStyle, smallInput, tableStyle, thStyle, tdStyle } from './hc-ergo-ui';

interface TitikUdara {
  id: string;
  kodeTitik: string;
  posisi: string;
  suhu: string;
  kelembapan: string;
  oksigen: string;
  pm10: string;
  asbes: string;
}

const newTitikUdara = (n: number, defaultKode?: string, defaultPosisi?: string): TitikUdara => ({
  id: `u_${Date.now()}_${n}`,
  kodeTitik: defaultKode || `T${n}`,
  posisi: defaultPosisi || '',
  suhu: '24.5',
  kelembapan: '52',
  oksigen: '20.9',
  pm10: '0.04',
  asbes: '0',
});

export default function InspeksiUdaraDebu() {
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
  const [ventilasiBuatan, setVentilasiBuatan] = useState(true);
  const [tanggalBersihVentilasi, setTanggalBersihVentilasi] = useState('');
  const [alatUdara, setAlatUdara] = useState('Direct Reading Dust & Gas Analyzer');
  const [catatan, setCatatan] = useState('');

  // Referensi titik ukur dari Noise Mapping
  const [refTitikNoise, setRefTitikNoise] = useState<{ kode: string; deskripsi: string; area: string }[]>([]);

  const [titikList, setTitikList] = useState<TitikUdara[]>([
    newTitikUdara(1, 'T1', 'Tengah Ruang Kerja'),
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

  const tambahTitik = () => {
    const lastKode = titikList[titikList.length - 1]?.kodeTitik;
    const nextKode = getNextKodeTitik(lastKode, titikList.length + 1);
    setTitikList((prev) => [
      ...prev,
      newTitikUdara(titikList.length + 1, nextKode),
    ]);
  };

  const hapusTitik = (id: string) => {
    if (titikList.length <= 1) return;
    setTitikList((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTitik = (id: string, key: keyof TitikUdara, val: string) => {
    setTitikList((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, [key]: val };
      if (key === 'kodeTitik') {
        const found = refTitikNoise.find((r) => r.kode === val);
        if (found && !t.posisi) {
          updated.posisi = found.deskripsi || found.area;
        }
      }
      return updated;
    }));
  };

  // Live evaluation of indoor air quality parameters
  const evaluasiUdara = useMemo(() => {
    const parse = (v: string) => {
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };

    const issues: string[] = [];
    let titikChecked = 0;

    for (const t of titikList) {
      const suhu = parse(t.suhu);
      const hum = parse(t.kelembapan);
      const o2 = parse(t.oksigen);
      const pm10 = parse(t.pm10);
      const asbes = parse(t.asbes);

      if (suhu !== null || hum !== null || o2 !== null || pm10 !== null || asbes !== null) {
        titikChecked++;
      }

      if (suhu !== null && (suhu < NAB_UDARA.suhu.min || suhu > NAB_UDARA.suhu.max)) {
        issues.push(`${t.kodeTitik}: Suhu ${suhu}°C (Standar ${NAB_UDARA.suhu.min}–${NAB_UDARA.suhu.max}°C)`);
      }
      if (hum !== null && (hum < NAB_UDARA.kelembapan.min || hum > NAB_UDARA.kelembapan.max)) {
        issues.push(`${t.kodeTitik}: Kelembapan ${hum}% (Standar ${NAB_UDARA.kelembapan.min}–${NAB_UDARA.kelembapan.max}%)`);
      }
      if (o2 !== null && (o2 < NAB_UDARA.oksigen.min || o2 > NAB_UDARA.oksigen.max)) {
        issues.push(`${t.kodeTitik}: Kadar Oksigen ${o2}% (Standar ${NAB_UDARA.oksigen.min}–${NAB_UDARA.oksigen.max}%)`);
      }
      if (pm10 !== null && pm10 > (NAB_UDARA.pm10.max ?? 0.15)) {
        issues.push(`${t.kodeTitik}: Debu PM10 ${pm10} mg/m³ (NAB Maks ${NAB_UDARA.pm10.max} mg/m³)`);
      }
      if (asbes !== null && asbes > (NAB_UDARA.asbes.max ?? 0.1)) {
        issues.push(`${t.kodeTitik}: Asbes ${asbes} serat/ml (NAB Maks ${NAB_UDARA.asbes.max} serat/ml)`);
      }
    }

    // Ruang udara per orang
    const luas = Number(luasM2);
    const org = Number(jumlahPekerja);
    const tgi = Number(tinggiRuangan) || 3;
    let cubicPerPerson: number | null = null;
    if (luas > 0 && org > 0) {
      cubicPerPerson = Number(((luas * Math.min(tgi, 4)) / org).toFixed(1));
      if (cubicPerPerson < NAB_LAIN.ruangUdaraPerOrang.min) {
        issues.push(`Volume ruang udara ${cubicPerPerson} m³/orang (Standar Min ${NAB_LAIN.ruangUdaraPerOrang.min} m³/orang)`);
      }
    }

    return {
      titikChecked,
      issues,
      memenuhi: issues.length === 0,
      cubicPerPerson,
    };
  }, [titikList, luasM2, jumlahPekerja, tinggiRuangan]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!namaRuang.trim()) {
      setPesan({ kind: 'err', text: 'Nama ruang / area wajib diisi' });
      return;
    }

    const adaParameter = titikList.some((t) => t.suhu || t.kelembapan || t.oksigen || t.pm10 || t.asbes);
    if (!adaParameter) {
      setPesan({ kind: 'err', text: 'Harap isi minimal salah satu parameter kualitas udara / debu' });
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
          ventilasiBuatan,
          tanggalBersihVentilasi: tanggalBersihVentilasi || null,
          alatKualitasUdara: alatUdara,
          pengukur: pengukur || namaPengukur,
          catatan,
          titik: titikList.map((t) => ({
            kodeTitik: t.kodeTitik,
            posisi: t.posisi,
            suhu: t.suhu ? Number(t.suhu.replace(',', '.')) : null,
            kelembapan: t.kelembapan ? Number(t.kelembapan.replace(',', '.')) : null,
            oksigen: t.oksigen ? Number(t.oksigen.replace(',', '.')) : null,
            pm10: t.pm10 ? Number(t.pm10.replace(',', '.')) : null,
            asbes: t.asbes ? Number(t.asbes.replace(',', '.')) : null,
          })),
        }),
      });

      store.showToast('Data kualitas udara & debu berhasil disimpan', 'success');
      setPesan({ kind: 'ok', text: `Pengukuran kualitas udara ruang ${namaRuang} berhasil disimpan. Riwayat dapat dilihat dengan menekan tombol panah di kanan.` });

      // Reset form
      setNamaRuang('');
      setLuasM2('');
      setJumlahPekerja('');
      setCatatan('');
      setTitikList([
        newTitikUdara(1, 'T1', 'Tengah Ruang Kerja'),
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
          <h1 className="admin-form-title">Pengukuran Kualitas Udara &amp; Debu Industri</h1>
          <p className="admin-form-subtitle">
            Pemantauan Kualitas Udara Dalam Ruang (KUDR), debu partikulat PM10, serat asbes, dan ventilasi tempat kerja sesuai standar K3 Lingkungan Kerja &amp; Perkantoran.
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

        {/* Acuan Standar Cepat */}
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--muted)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, fontSize: 11 }}>
          <div><b style={{ color: 'var(--brand-primary, #ff4d00)' }}>Suhu Nyaman:</b> 23 – 26 °C</div>
          <div><b style={{ color: 'var(--brand-primary, #ff4d00)' }}>Kelembapan:</b> 40 – 60 %</div>
          <div><b style={{ color: 'var(--brand-primary, #ff4d00)' }}>Oksigen (O₂):</b> 19,5 – 23,5 %</div>
          <div><b style={{ color: 'var(--brand-primary, #ff4d00)' }}>Debu PM10:</b> ≤ 0,15 mg/m³</div>
          <div><b style={{ color: 'var(--brand-primary, #ff4d00)' }}>Asbes Bebas:</b> ≤ 0,1 serat/ml</div>
          <div><b style={{ color: 'var(--brand-primary, #ff4d00)' }}>Volume Udara:</b> ≥ 10 m³/org</div>
        </div>

        {/* Form Pengukuran Udara & Debu */}
        <form onSubmit={simpan}>
          {/* Section 1: Informasi Sesi & Pengukur — Baris Lurus */}
          <Section title="Informasi Sesi &amp; Pengukur">
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

              <Field label="Peralatan Sampling &amp; Analisis">
                <input className="admin-input" style={smallInput} value={alatUdara} onChange={(e) => setAlatUdara(e.target.value)} placeholder="mis. Particle Counter" />
              </Field>
            </div>
          </Section>

          {/* Section 2: Spesifikasi Ruangan & Ventilasi — Baris Lurus */}
          <Section title="Spesifikasi Ruangan &amp; Ventilasi">
            <div style={grid4}>
              <Field label="Nama Ruangan / Area">
                <input required className="admin-input" style={smallInput} value={namaRuang} onChange={(e) => setNamaRuang(e.target.value)} placeholder="mis. Ruang Control Room" />
              </Field>

              <Field label="Peruntukan Ruang">
                <select className="admin-input" style={smallInput} value={peruntukan} onChange={(e) => setPeruntukan(e.target.value as PeruntukanRuang)}>
                  <option value="ruang_kerja">Ruang Kerja / Kantor</option>
                  <option value="ruang_rapat">Ruang Rapat</option>
                  <option value="ruang_arsip">Ruang Arsip</option>
                  <option value="ruang_makan">Ruang Makan / Kantin</option>
                  <option value="koridor_lobi">Koridor / Lobi</option>
                  <option value="lainnya">Area Operasional / Lainnya</option>
                </select>
              </Field>

              <Field label="Luas (m²)">
                <input type="number" step="any" className="admin-input" style={smallInput} value={luasM2} onChange={(e) => setLuasM2(e.target.value)} placeholder="Luas m²" />
              </Field>

              <Field label="Jumlah Pekerja">
                <input type="number" className="admin-input" style={smallInput} value={jumlahPekerja} onChange={(e) => setJumlahPekerja(e.target.value)} placeholder="Jumlah penghuni" />
              </Field>
            </div>

            <div style={{ ...grid4, marginTop: 14 }}>
              <Field label="Tinggi Plafon (m)">
                <input type="number" step="any" className="admin-input" style={smallInput} value={tinggiRuangan} onChange={(e) => setTinggiRuangan(e.target.value)} placeholder="Tinggi m (min. 3m)" />
              </Field>

              <Field label="Ventilasi Buatan (AC / Exhaust)">
                <select className="admin-input" style={smallInput} value={ventilasiBuatan ? '1' : '0'} onChange={(e) => setVentilasiBuatan(e.target.value === '1')}>
                  <option value="1">Ada (AC Sentral / Split / Fan)</option>
                  <option value="0">Tidak Ada (Ventilasi Alami Saja)</option>
                </select>
              </Field>

              <Field label="Tanggal Cuci / Servis AC" hint="(Maks 3 bln)">
                <input type="date" className="admin-input" style={smallInput} value={tanggalBersihVentilasi} onChange={(e) => setTanggalBersihVentilasi(e.target.value)} />
              </Field>

              <div style={{ display: 'flex', alignItems: 'flex-end', height: 32 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Standar: cuci ventilasi tiap ≤ 3 bln</span>
              </div>
            </div>
          </Section>

          {/* Datalist untuk referensi Titik Ukur dari Noise Mapping */}
          <datalist id="noise-points-ref-udara">
            {refTitikNoise.map((r, idx) => (
              <option key={idx} value={r.kode}>
                {r.area ? `${r.area} — ` : ''}{r.deskripsi}
              </option>
            ))}
          </datalist>

          {/* Section 3: Hasil Pengukuran Kualitas Udara */}
          <Section title="Hasil Pengukuran Kualitas Udara, Gas &amp; Debu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                Kode titik ukur dapat ditulis manual sesuai area yang diukur (contoh: <b>WS-T1</b> untuk Workshop, <b>CR-T1</b> untuk Control Room, dsb.) atau memilih dari referensi Noise Mapping.
              </span>
              <Btn type="button" onClick={tambahTitik} style={{ height: 28, fontSize: 11 }}>
                <Plus size={12} /> Tambah Titik Ukur
              </Btn>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '15%' }}>Kode Titik Ukur</th>
                    <th style={{ ...thStyle, width: '22%' }}>Lokasi Titik</th>
                    <th style={{ ...thStyle, width: '12%' }}>Suhu (°C)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>23–26</span></th>
                    <th style={{ ...thStyle, width: '12%' }}>RH (%)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>40–60</span></th>
                    <th style={{ ...thStyle, width: '12%' }}>O₂ (%)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>19.5–23.5</span></th>
                    <th style={{ ...thStyle, width: '13%' }}>PM10 (mg/m³)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>≤ 0.15</span></th>
                    <th style={{ ...thStyle, width: '10%' }}>Asbes (s/ml)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>≤ 0.1</span></th>
                    <th style={{ ...thStyle, width: '4%', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {titikList.map((t) => (
                    <tr key={t.id}>
                      <td style={tdStyle}>
                        <input
                          list="noise-points-ref-udara"
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
                          placeholder="mis. Titik Pusat Kerja"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="any"
                          className="admin-input"
                          style={{ ...smallInput, height: 28 }}
                          value={t.suhu}
                          onChange={(e) => updateTitik(t.id, 'suhu', e.target.value)}
                          placeholder="24"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="any"
                          className="admin-input"
                          style={{ ...smallInput, height: 28 }}
                          value={t.kelembapan}
                          onChange={(e) => updateTitik(t.id, 'kelembapan', e.target.value)}
                          placeholder="50"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="any"
                          className="admin-input"
                          style={{ ...smallInput, height: 28 }}
                          value={t.oksigen}
                          onChange={(e) => updateTitik(t.id, 'oksigen', e.target.value)}
                          placeholder="20.9"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="any"
                          className="admin-input"
                          style={{ ...smallInput, height: 28 }}
                          value={t.pm10}
                          onChange={(e) => updateTitik(t.id, 'pm10', e.target.value)}
                          placeholder="0.05"
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          step="any"
                          className="admin-input"
                          style={{ ...smallInput, height: 28 }}
                          value={t.asbes}
                          onChange={(e) => updateTitik(t.id, 'asbes', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => hapusTitik(t.id)}
                          disabled={titikList.length <= 1}
                          style={{ background: 'none', border: 'none', color: titikList.length <= 1 ? 'var(--muted)' : '#FF2D2D', cursor: titikList.length <= 1 ? 'not-allowed' : 'pointer', padding: 4 }}
                          title="Hapus titik"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live Evaluation of Air Quality */}
            <div style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${evaluasiUdara.memenuhi ? '#00B894' : '#FF2D2D'}`,
              background: evaluasiUdara.memenuhi ? 'rgba(0,184,148,0.06)' : 'rgba(255,45,45,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: evaluasiUdara.memenuhi ? '#00B894' : '#FF2D2D' }}>
                {evaluasiUdara.memenuhi ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{evaluasiUdara.memenuhi ? 'Semua Parameter Kualitas Udara Memenuhi Standar K3' : `${evaluasiUdara.issues.length} Parameter Melampaui / Tidak Memenuhi Standar K3:`}</span>
              </div>
              {!evaluasiUdara.memenuhi && (
                <ul style={{ margin: '6px 0 0 20px', padding: 0, fontSize: 11, color: '#FF2D2D' }}>
                  {evaluasiUdara.issues.map((iss, i) => (
                    <li key={i}>{iss}</li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {/* Action Simpan */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, margin: '16px 0 24px' }}>
            <Btn kind="primary" size="md" type="submit" disabled={menyimpan}>
              {menyimpan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Pengukuran Kualitas Udara
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
