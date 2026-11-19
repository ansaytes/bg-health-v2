'use client';

// ============================================================
// Administrator > Higiene Industri > Form Inspeksi Higiene & Sanitasi
// ============================================================
//
// 4 Pilar Sanitasi Tempat Kerja:
//   1. Toilet & Fasilitas Sanitasi (Rasio, Kebersihan, Ventilasi, Air Mengalir/Sabun)
//   2. Penyediaan Air Minum (Kualitas Fisik/Bakteriologi, Aksesibilitas, Higiene Dispenser)
//   3. Pengendalian Vektor & Binatang Pembawa Penyakit (Lalat, Nyamuk, Tikus, Kecoa)
//   4. Pengelolaan Sampah & Limbah Padat Domestik (Pilah, Tempat Tertutup, Pengangkutan)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Save, UserRound, XCircle } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { ITEM_INSPEKSI, KATEGORI_LABEL, type KategoriInspeksi, type NilaiItem } from '@/lib/sanitasi-inspeksi';
import { Btn, Field, Section, SITES, grid4, inputStyle, smallInput } from './hc-ergo-ui';

interface Ringkasan {
  total: number;
  sesuai: number;
  tidakSesuai: number;
  belumDinilai: number;
  persenSesuai: number;
  perKategori: Record<string, { sesuai: number; tidakSesuai: number; belumDinilai: number }>;
}

interface HasilItem {
  key: string;
  label: string;
  kategori: KategoriInspeksi;
  nilai: NilaiItem;
  status: 'sesuai' | 'tidak_sesuai' | 'belum_dinilai';
  keterangan: string;
  sumber: string;
}

export default function InspeksiSanitasi() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const namaInspektur = profile?.full_name || profile?.username || '—';

  const [site, setSite] = useState('Head Office');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [nilai, setNilai] = useState<Record<string, NilaiItem>>({});
  const [hasil, setHasil] = useState<HasilItem[] | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

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
        body: JSON.stringify({ site, tanggal, inspektur: namaInspektur, nilai }),
      });
      setRingkasan(r.ringkasan as Ringkasan);
      setHasil(r.items as HasilItem[]);
      store.showToast('Inspeksi sanitasi berhasil disimpan', 'success');
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan inspeksi sanitasi', 'error');
    } finally {
      setMenyimpan(false);
    }
  }

  function setVal(k: string, v: NilaiItem) {
    setNilai((prev) => ({ ...prev, [k]: v }));
  }

  const jumlahTerisi = Object.values(nilai).filter((v) => v !== null && v !== undefined).length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header Title */}
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Inspeksi Higiene &amp; Sanitasi</h1>
          <p className="admin-form-subtitle">
            Standar kepatuhan fasilitas sanitasi tempat kerja (toilet, air minum, pengendalian vektor, dan limbah padat) sesuai standar K3 Lingkungan Kerja.
          </p>
        </div>

        {/* Section 1: Parameter & Identitas Sesi — Baris Lurus Sempurna */}
        <Section title="Informasi Sesi Inspeksi">
          <div style={grid4}>
            <Field label="Job Site">
              <select className="admin-input" style={smallInput} value={site} onChange={(e) => setSite(e.target.value)}>
                {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Tanggal Inspeksi">
              <input type="date" className="admin-input" style={smallInput} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </Field>

            <Field label="Petugas / Inspektur" hint="(Otomatis Login)">
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
                  {namaInspektur}
                </span>
              </div>
            </Field>

            <div style={{ display: 'flex', alignItems: 'flex-end', height: 32 }}>
              <Btn type="button" onClick={() => setNilai({})} style={{ height: 32, width: '100%' }}>
                Reset Isian
              </Btn>
            </div>
          </div>

          {/* Ringkasan Skor Kepatuhan */}
          {ringkasan && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--muted)', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              <span>Tingkat Kepatuhan: <b style={{ fontSize: 14, color: ringkasan.persenSesuai >= 85 ? '#00B894' : '#FF2D2D' }}>{ringkasan.persenSesuai.toFixed(1)}%</b></span>
              <span>Sesuai: <b style={{ color: '#00B894' }}>{ringkasan.sesuai}</b></span>
              <span>Tidak Sesuai: <b style={{ color: ringkasan.tidakSesuai ? '#FF2D2D' : 'inherit' }}>{ringkasan.tidakSesuai}</b></span>
              <span>Belum Dinilai: <b style={{ color: ringkasan.belumDinilai ? '#FF7A00' : 'inherit' }}>{ringkasan.belumDinilai}</b></span>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', gap: 5, alignItems: 'center' }}>
            <AlertTriangle size={12} color="#FF7A00" />
            <span>Item yang tidak diisi berstatus <b>Belum Dinilai</b> (tidak otomatis dianggap patuh). Gunakan tombol panah di kanan layar untuk melihat riwayat inspeksi sebelumnya.</span>
          </div>
        </Section>

        {/* Section Checklist 4 Pilar Sanitasi */}
        {[...perKategori.entries()].map(([kategori, items]) => {
          const kat = ringkasan?.perKategori?.[kategori];
          return (
            <Section key={kategori} title={KATEGORI_LABEL[kategori]}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 11, color: 'var(--muted-foreground)' }}>
                <span>{items.length} parameter checklist wajib</span>
                {kat && (
                  <div style={{ display: 'flex', gap: 10, fontWeight: 600 }}>
                    <span style={{ color: '#00B894' }}>✓ {kat.sesuai} Sesuai</span>
                    <span style={{ color: '#FF2D2D' }}>✗ {kat.tidakSesuai} Tidak Sesuai</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>? {kat.belumDinilai} Belum</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {items.map((it) => {
                  const hasilItem = hasil?.find((h) => h.key === it.key);
                  const isViolation = hasilItem?.status === 'tidak_sesuai';
                  const isOk = hasilItem?.status === 'sesuai';

                  return (
                    <div
                      key={it.key}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 7,
                        border: `1px solid ${isViolation ? '#FF2D2D' : isOk ? '#00B894' : 'var(--border)'}`,
                        background: isViolation ? 'rgba(255,45,45,0.03)' : isOk ? 'rgba(0,184,148,0.03)' : 'var(--background)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                      title={it.acuan}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                          {it.label}
                        </span>
                        {isOk && <CheckCircle2 size={13} color="#00B894" style={{ flexShrink: 0 }} />}
                        {isViolation && <XCircle size={13} color="#FF2D2D" style={{ flexShrink: 0 }} />}
                      </div>

                      {it.tipe === 'hitung' ? (
                        <input
                          type="number"
                          step="any"
                          value={nilai[it.key] == null ? '' : String(nilai[it.key])}
                          onChange={(e) => setVal(it.key, e.target.value === '' ? null : Number(e.target.value.replace(',', '.')))}
                          placeholder={it.satuan ? `Acuan ${it.acuan} ${it.satuan}` : `Acuan ${it.acuan}`}
                          className="admin-input"
                          style={{ ...smallInput, height: 30 }}
                        />
                      ) : (
                        <select
                          value={String(nilai[it.key] ?? '')}
                          onChange={(e) => setVal(it.key, (e.target.value || null) as NilaiItem)}
                          className="admin-input"
                          style={{ ...smallInput, height: 30 }}
                        >
                          <option value="">— Belum Dinilai —</option>
                          <option value="SESUAI">Sesuai</option>
                          <option value="TIDAK_SESUAI">Tidak Sesuai</option>
                          <option value="TIDAK_ADA">Tidak Ada / N/A</option>
                        </select>
                      )}

                      {hasilItem && (
                        <span style={{ fontSize: 10, color: isViolation ? '#FF2D2D' : 'var(--muted-foreground)', lineHeight: 1.25 }}>
                          {hasilItem.keterangan}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })}

        {/* Action Button: Simpan */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, margin: '18px 0 24px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
            {jumlahTerisi} dari {ITEM_INSPEKSI.length} parameter telah diisi
          </span>
          <Btn kind="primary" size="md" disabled={menyimpan} onClick={() => void simpan()}>
            {menyimpan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Hasil Inspeksi
          </Btn>
        </div>
      </div>
    </div>
  );
}
