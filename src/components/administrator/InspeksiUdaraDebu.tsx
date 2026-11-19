'use client';

// ============================================================
// Administrator > Higiene Industri > Pengukuran Kualitas Udara & Debu
// ============================================================
//
// ACUAN K3 LINGKUNGAN KERJA:
// 1. Permenaker No. 5 Tahun 2018 Pasal 40–42 (Kualitas Udara Dalam Ruang Kerja / KUDR):
//    • Suhu kering: 23 – 26 °C
//    • Kelembapan relatif: 40 – 60 %
//    • Kadar Oksigen (O₂): 19,5 – 23,5 % vol
//    • Ruang udara minimal: 10 m³ / orang
//    • Pembersihan ventilasi mekanik / AC: minimal setiap 3 bulan
// 2. Permenkes No. 48 Tahun 2016 Tabel 1 (Standar Fisik & Kimia Udara Perkantoran):
//    • Debu respirabel PM10: maksimal 0,15 mg/m³
//    • Serat Asbes bebas: maksimal 0,1 serat/ml udara

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, UserRound, Wind, XCircle } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { NAB_UDARA, NAB_LAIN, type PeruntukanRuang } from '@/lib/lingkungan-kerja';
import { Btn, Field, Section, SITES, inputStyle, smallInput, tableStyle, thStyle, tdStyle, fmtDate } from './hc-ergo-ui';

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

interface RuangItem {
  id: string;
  namaRuang: string;
  peruntukan: PeruntukanRuang;
  luasM2: number | null;
  jumlahPekerja: number | null;
  tinggiRuanganM: number | null;
  ventilasiBuatan: boolean;
  tanggalBersihVentilasi: string | null;
  pengukuranTerakhir: Record<string, unknown> | null;
  penilaian: {
    statusUdara: {
      parameter: string;
      label: string;
      nilai: number | null;
      min: number | null;
      max: number | null;
      satuan: string;
      status: string;
    }[];
    jumlahTidakMemenuhi: number;
    ruangUdaraPerOrang: number | null;
    statusRuangUdara: string;
  } | null;
}

export default function InspeksiUdaraDebu() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const namaPengukur = profile?.full_name || profile?.username || '';

  const [site, setSite] = useState('Head Office');
  const [data, setData] = useState<RuangItem[]>([]);
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
  const [ventilasiBuatan, setVentilasiBuatan] = useState(true);
  const [tanggalBersihVentilasi, setTanggalBersihVentilasi] = useState('');
  const [alatUdara, setAlatUdara] = useState('Direct Reading Dust & Gas Analyzer');
  const [catatan, setCatatan] = useState('');

  const [titikList, setTitikList] = useState<TitikUdara[]>([
    { id: 'u1', kodeTitik: 'U1', posisi: 'Tengah Ruang Kerja', suhu: '24.5', kelembapan: '52', oksigen: '20.9', pm10: '0.04', asbes: '0' },
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

  const tambahTitik = () => {
    const nextIdx = titikList.length + 1;
    setTitikList((prev) => [
      ...prev,
      { id: `u${Date.now()}`, kodeTitik: `U${nextIdx}`, posisi: '', suhu: '', kelembapan: '', oksigen: '', pm10: '', asbes: '' },
    ]);
  };

  const hapusTitik = (id: string) => {
    if (titikList.length <= 1) return;
    setTitikList((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTitik = (id: string, key: keyof TitikUdara, val: string) => {
    setTitikList((prev) => prev.map((t) => (t.id === id ? { ...t, [key]: val } : t)));
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
      setPesan({ kind: 'ok', text: `Pengukuran kualitas udara ruang ${namaRuang} berhasil disimpan.` });

      // Reset form
      setNamaRuang('');
      setLuasM2('');
      setJumlahPekerja('');
      setCatatan('');
      setTitikList([
        { id: 'u1', kodeTitik: 'U1', posisi: 'Tengah Ruang Kerja', suhu: '24.5', kelembapan: '52', oksigen: '20.9', pm10: '0.04', asbes: '0' },
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
          <h1 className="admin-form-title">Pengukuran Kualitas Udara &amp; Debu Industri</h1>
          <p className="admin-form-subtitle">
            Pemantauan Kualitas Udara Dalam Ruang (KUDR), debu partikulat PM10, serat asbes, dan ventilasi tempat kerja sesuai Permenaker 5/2018 &amp; Permenkes 48/2016.
          </p>
        </div>

        {!tabelSiap && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11 }}>
            Tabel database kualitas udara belum dibuat. Jalankan migration <code>20261031_inspeksi_lingkungan.sql</code>.
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
          <Section title="Informasi Sesi &amp; Pengukur">
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

              <Field label="Peralatan Sampling &amp; Analisis">
                <input className="admin-input" style={smallInput} value={alatUdara} onChange={(e) => setAlatUdara(e.target.value)} placeholder="mis. Particle Counter / Dust Sampler" />
              </Field>
            </div>
          </Section>

          <Section title="Spesifikasi Ruangan &amp; Ventilasi">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <Field label="Nama Ruangan / Area" hint="(Contoh: Ruang Control Room)">
                <input required className="admin-input" style={smallInput} value={namaRuang} onChange={(e) => setNamaRuang(e.target.value)} placeholder="Nama ruangan / area kerja" />
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

              <Field label="Luas (m²) &amp; Pekerja">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" step="any" className="admin-input" style={smallInput} value={luasM2} onChange={(e) => setLuasM2(e.target.value)} placeholder="Luas m²" />
                  <input type="number" className="admin-input" style={smallInput} value={jumlahPekerja} onChange={(e) => setJumlahPekerja(e.target.value)} placeholder="Org" />
                </div>
              </Field>

              <Field label="Tinggi Plafon (m)">
                <input type="number" step="any" className="admin-input" style={smallInput} value={tinggiRuangan} onChange={(e) => setTinggiRuangan(e.target.value)} placeholder="Tinggi m (min. 3m)" />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 12 }}>
              <Field label="Ventilasi Buatan (AC / Exhaust)">
                <select className="admin-input" style={smallInput} value={ventilasiBuatan ? '1' : '0'} onChange={(e) => setVentilasiBuatan(e.target.value === '1')}>
                  <option value="1">Ada (AC Sentral / Split / Fan)</option>
                  <option value="0">Tidak Ada (Ventilasi Alami Saja)</option>
                </select>
              </Field>

              <Field label="Tanggal Cuci / Servis AC Terakhir" hint="(Max 3 bln)">
                <input type="date" className="admin-input" style={smallInput} value={tanggalBersihVentilasi} onChange={(e) => setTanggalBersihVentilasi(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Hasil Pengukuran Kualitas Udara, Gas &amp; Debu">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                Catat parameter fisik (suhu, kelembapan) dan kimia (oksigen, PM10, serat asbes) per titik ukur.
              </span>
              <Btn type="button" onClick={tambahTitik} style={{ height: 28, fontSize: 11 }}>
                <Plus size={12} /> Tambah Titik Ukur
              </Btn>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '10%' }}>Kode</th>
                    <th style={{ ...thStyle, width: '22%' }}>Lokasi Titik</th>
                    <th style={{ ...thStyle, width: '13%' }}>Suhu (°C)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>23–26</span></th>
                    <th style={{ ...thStyle, width: '13%' }}>RH (%)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>40–60</span></th>
                    <th style={{ ...thStyle, width: '13%' }}>O₂ (%)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>19.5–23.5</span></th>
                    <th style={{ ...thStyle, width: '13%' }}>PM10 (mg/m³)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>≤ 0.15</span></th>
                    <th style={{ ...thStyle, width: '11%' }}>Asbes (s/ml)<br /><span style={{ fontSize: 9, fontWeight: 'normal' }}>≤ 0.1</span></th>
                    <th style={{ ...thStyle, width: '5%', textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {titikList.map((t) => (
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
              background: evaluasiUdara.memenuhi ? 'rgba(0,184,148,0.06)' : 'rgba(255,45,45,0.06)',
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

        {/* Section Riwayat Kualitas Udara Ruangan */}
        <Section title={`Daftar Pemantauan Kualitas Udara Ruangan — ${site}`}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Btn type="button" onClick={() => void loadData()} disabled={loading} style={{ height: 28 }}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Data
            </Btn>
          </div>

          {!data.length ? (
            <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '4px 0' }}>
              Belum ada pemantauan kualitas udara tercatat untuk site ini.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Nama Ruangan', 'Peruntukan', 'Ventilasi Buatan', 'Parameter Udara', 'Temuan Tidak Sesuai', 'Tanggal Pemantauan'].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => {
                    const p = r.penilaian;
                    const gagal = p?.statusUdara ? p.statusUdara.filter((x) => x.status === 'tidak-memenuhi').length : 0;
                    const warna = !p ? 'var(--muted-foreground)' : gagal === 0 ? '#00B894' : '#FF2D2D';

                    return (
                      <tr key={r.id}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{r.namaRuang}</td>
                        <td style={tdStyle}>{r.peruntukan.replace('_', ' ')}</td>
                        <td style={tdStyle}>{r.ventilasiBuatan ? 'Ada (AC/Exhaust)' : 'Alami'}</td>
                        <td style={tdStyle}>
                          {p?.statusUdara ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {p.statusUdara.map((u, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: 9.5,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    background: u.status === 'memenuhi' ? 'rgba(0,184,148,0.1)' : 'rgba(255,45,45,0.1)',
                                    color: u.status === 'memenuhi' ? '#00B894' : '#FF2D2D',
                                    fontWeight: 600,
                                  }}
                                >
                                  {u.label}: {u.nilai ?? '—'}{u.satuan}
                                </span>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: warna }}>
                          {!p ? 'Belum Diukur' : gagal === 0 ? '✓ Sesuai Standar' : `✗ ${gagal} Parameter Gagal`}
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
