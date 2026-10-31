'use client';

// ============================================================
// Administrator > Higiene Industri > Gizi Kerja
// ============================================================
//
// DASAR: BG/QSHE/SOP/028 poin 5.7 — "Gizi Kerja adalah pemenuhan nutrisi dan
// zat makanan yang disesuaikan dengan kebutuhan kalori, JENIS PEKERJAAN, dan
// BEBAN KERJA tenaga kerja."
//
// ACUAN ANGKA: AKG Kemenkes RI 2019 (Permenkes 28/2019) + rumus Mifflin–St Jeor
// untuk BMR, dikali faktor aktivitas menurut beban kerja (Permenaker 5/2018).
//
// PENTING: ini alat PERENCANAAN MENU KANTIN & program gizi kerja — BUKAN
// preskripsi diet. Kebutuhan individu dengan kondisi medis ditetapkan dokter.

import { useCallback, useEffect, useState } from 'react';
import { Calculator, Info, Loader2, RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { FAKTOR_AKTIVITAS, type BebanKerja } from '@/lib/gizi-kerja';
import EmployeeLookupInput from '@/components/administrator/EmployeeLookupInput';

interface Hasil {
  bmr: number; kebutuhanKkal: number; faktorAktivitas: number;
  imt: number; statusGizi: string; akgAcuan: number | null; selisihAkg: number | null;
  catatan: string[];
  makro: { proteinG: number; lemakG: number; karbohidratG: number };
}

export default function GiziKerja() {
  const store = useMCUStore();
  const [nik, setNik] = useState('');
  const [beban, setBeban] = useState<BebanKerja | ''>('');
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [karyawan, setKaryawan] = useState<Record<string, unknown> | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [error, setError] = useState('');
  const [rekap, setRekap] = useState<{
    totalDihitung: number; tidakLengkap: number; acuan: string;
    perSite: { site: string; jumlah: number; rataKkal: number; rataImt: number; persenObesitas: number }[];
    perBebanKerja: [string, number][];
    distribusiStatusGizi: [string, number][];
  } | null>(null);

  const muatRekap = useCallback(async () => {
    try {
      const r = await authFetch('/api/gizi/rekap');
      setRekap(r as never);
    } catch {
      setRekap(null);
    }
  }, []);

  useEffect(() => { void muatRekap(); }, [muatRekap]);

  async function hitung() {
    if (!nik.trim()) return;
    setMemuat(true);
    setError('');
    try {
      const qs = new URLSearchParams({ nik: nik.trim() });
      if (beban) qs.set('beban', beban);
      const r = await authFetch(`/api/gizi?${qs.toString()}`);
      setHasil(r.hasil as Hasil);
      setKaryawan(r.karyawan as Record<string, unknown>);
      // Beban yang disarankan dipakai bila pengguna belum memilih.
      if (!beban && r.bebanKerja) setBeban(r.bebanKerja as BebanKerja);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghitung kalori');
      setHasil(null);
      setKaryawan(null);
    } finally {
      setMemuat(false);
    }
  }

  return (
    <div className="dashboard" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          {/* Pencarian identitas: NIK Karyawan, NIK KTP, atau NAMA — perilakunya
              sama dengan kotak pencarian di halaman Review MCU. */}
          <div style={{ flex: '1 1 280px', minWidth: 220, maxWidth: 360 }}>
            <EmployeeLookupInput
              value={nik}
              onChange={setNik}
              onEmployeeFound={(emp) => {
                setNik(String(emp.nik ?? nik));
              }}
              onAutoFill={(field, val) => { if (field === 'nik') setNik(val); }}
              placeholder="Cari NIK Karyawan, NIK KTP, atau nama"
              required={false}
            />
          </div>
          <select className="admin-filter-select" value={beban} onChange={(e) => setBeban(e.target.value as BebanKerja)} title="Beban kerja">
            <option value="">Beban kerja (otomatis)</option>
            {(Object.keys(FAKTOR_AKTIVITAS) as BebanKerja[]).map((b) => (
              <option key={b} value={b}>{FAKTOR_AKTIVITAS[b].label}</option>
            ))}
          </select>
          <button type="button" onClick={() => void hitung()} disabled={memuat || !nik.trim()} className="mcu-dashboard-refresh">
            {memuat ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />} Hitung
          </button>
          <button type="button" onClick={() => void muatRekap()} className="mcu-dashboard-refresh">
            <RefreshCw size={13} /> Refresh Rekap
          </button>
        </div>
      </div>



      {error && (
        <div style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 10.5 }}>
          {error}
        </div>
      )}

      {/* Hasil per karyawan */}
      {hasil && karyawan && (
        <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: '#00B894', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 12 }}>{String(karyawan.nama ?? nik)}</h2>
              <p style={{ fontSize: 9.5 }}>
                {String(karyawan.jabatan ?? '—')} · {String(karyawan.usia ?? '—')} th · {String(karyawan.jenisKelamin ?? '—')}
                {' '}· {String(karyawan.beratKg)} kg / {String(karyawan.tinggiCm)} cm
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Kotak label="BMR" nilai={`${hasil.bmr}`} satuan="kkal" />
            <Kotak label="Kebutuhan Kerja" nilai={`${hasil.kebutuhanKkal}`} satuan="kkal/hari" utama />
            <Kotak label="Faktor Aktivitas" nilai={`${hasil.faktorAktivitas}`} satuan="× BMR" />
            <Kotak label="IMT" nilai={`${hasil.imt}`} satuan={hasil.statusGizi} />
            <Kotak label="AKG Acuan" nilai={hasil.akgAcuan ? `${hasil.akgAcuan}` : '—'} satuan="kkal/hari" />
            <Kotak
              label="Selisih vs AKG"
              nilai={hasil.selisihAkg === null ? '—' : `${hasil.selisihAkg > 0 ? '+' : ''}${hasil.selisihAkg}`}
              satuan="kkal"
              warna={hasil.selisihAkg !== null && Math.abs(hasil.selisihAkg) > 300 ? '#FF7A00' : undefined}
            />
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10.5 }}>
            <span>Protein <b>{hasil.makro.proteinG} g</b></span>
            <span>Lemak <b>{hasil.makro.lemakG} g</b></span>
            <span>Karbohidrat <b>{hasil.makro.karbohidratG} g</b></span>
            <span style={{ color: 'var(--muted-foreground)' }}>(distribusi 15% / 25% / 60% — Pedoman Gizi Seimbang)</span>
          </div>

          <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 9.5, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            {hasil.catatan.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Rekap agregat */}
      {rekap && (
        <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 12 }}>Rekap Kebutuhan Kalori per Site</h2>
              <p style={{ fontSize: 9.5 }}>
                {rekap.totalDihitung} karyawan dihitung · {rekap.tidakLengkap} data antropometri tidak lengkap
              </p>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Site', 'Karyawan', 'Rata-rata kkal', 'Rata-rata IMT', 'Obesitas'].map((h) => (
                    <th key={h} style={{ padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 9, textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rekap.perSite.map((s) => (
                  <tr key={s.site}>
                    <td style={TD}>{s.site}</td>
                    <td style={TD}>{s.jumlah}</td>
                    <td style={{ ...TD, fontWeight: 800, color: '#ff4d00' }}>{s.rataKkal} kkal</td>
                    <td style={TD}>{s.rataImt}</td>
                    <td style={{ ...TD, color: s.persenObesitas > 30 ? '#FF2D2D' : 'inherit' }}>{s.persenObesitas}%</td>
                  </tr>
                ))}
                {!rekap.perSite.length && (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: 'var(--muted-foreground)' }}>Belum ada data antropometri.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 8, flexWrap: 'wrap', fontSize: 10 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 9, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Sebaran beban kerja</div>
              {rekap.perBebanKerja.map(([k, v]) => (
                <div key={k}>{FAKTOR_AKTIVITAS[k as BebanKerja]?.label ?? k}: <b>{v}</b></div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 9, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Status gizi</div>
              {rekap.distribusiStatusGizi.map(([k, v]) => (
                <div key={k}>{k}: <b>{v}</b></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TD: React.CSSProperties = { padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 10.5 };

function Kotak({ label, nilai, satuan, utama, warna }: {
  label: string; nilai: string; satuan?: string; utama?: boolean; warna?: string;
}) {
  return (
    <div style={{
      padding: '7px 9px', borderRadius: 8,
      background: utama ? 'rgba(255,77,0,0.07)' : 'var(--muted)',
      border: utama ? '1px solid rgba(255,77,0,0.25)' : '1px solid transparent',
    }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div style={{ fontSize: utama ? 20 : 16, fontWeight: 800, color: warna ?? (utama ? '#ff4d00' : 'var(--foreground)'), lineHeight: 1.2 }}>
        {nilai}
      </div>
      {satuan && <div style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{satuan}</div>}
    </div>
  );
}
