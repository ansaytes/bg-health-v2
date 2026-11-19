'use client';

// ============================================================
// Administrator > Higiene Industri > Form Inspeksi Gizi & Jasaboga
// ============================================================
//
// Standar Evaluasi Kelaikan Jasaboga & Gizi Kerja:
//   1. Legalitas SLHS & Higiene Penjamah Makanan (Permenkes 1096/2011)
//   2. Fasilitas & Sanitasi Dapur Pengolahan
//   3. Pengendalian Suhu & Pencegahan Kontaminasi Silang (HACCP)
//   4. Pemenuhan Kecukupan Kalori Kerja (AKG Kemenkes 2019 / Permenkes 28/2019)
//   5. Penyimpanan Sampel Makanan 1x24 Jam & Uji Mikrobiologi

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';
import {
  CHECKLIST_GIZI,
  KATEGORI_GIZI,
  hitungSkorInspeksiGizi,
  type ItemInspeksiGizi,
  type StatusLaikJasaboga,
} from '@/lib/gizi-inspeksi';
import { Btn, Field, Section, SITES, grid4, smallInput } from './hc-ergo-ui';

export default function GiziKerjaForm() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const namaInspektur = profile?.full_name || profile?.username || '—';

  // Sesi
  const [site, setSite] = useState('Head Office');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState('');
  const [namaKantin, setNamaKantin] = useState('');

  // Profil Kelaikan
  const [noSlhs, setNoSlhs] = useState('');
  const [tglKadaluwarsaSlhs, setTglKadaluwarsaSlhs] = useState('');
  const [jumlahPorsi, setJumlahPorsi] = useState<number | ''>(350);
  const [jumlahPenjamah, setJumlahPenjamah] = useState<number | ''>(12);
  const [jumlahBukuSehat, setJumlahBukuSehat] = useState<number | ''>(12);
  const [extraFooding, setExtraFooding] = useState('Tersedia Lengkap');

  // Kalori Menu
  const [kaloriSarapan, setKaloriSarapan] = useState<number | ''>(650);
  const [kaloriSiang, setKaloriSiang] = useState<number | ''>(1100);
  const [kaloriMalam, setKaloriMalam] = useState<number | ''>(950);

  // Checklist
  const [jawaban, setJawaban] = useState<Record<string, 'sesuai' | 'tidak_sesuai' | 'tidak_berlaku'>>({});
  const [catatan, setCatatan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  // Hitung Skor Real-time
  const evaluasiSkor = useMemo(() => {
    return hitungSkorInspeksiGizi(jawaban);
  }, [jawaban]);

  // Total Kalori Siklus
  const totalKaloriMenu = (Number(kaloriSarapan) || 0) + (Number(kaloriSiang) || 0) + (Number(kaloriMalam) || 0);

  const perKategori = useMemo(() => {
    const map = new Map<ItemInspeksiGizi['kategori'], ItemInspeksiGizi[]>();
    for (const item of CHECKLIST_GIZI) {
      const list = map.get(item.kategori) ?? [];
      list.push(item);
      map.set(item.kategori, list);
    }
    return map;
  }, []);

  function setJawabanItem(id: string, val: 'sesuai' | 'tidak_sesuai' | 'tidak_berlaku') {
    setJawaban((prev) => ({ ...prev, [id]: val }));
  }

  function handleIsiSemuaSesuai() {
    const update: Record<string, 'sesuai'> = {};
    for (const it of CHECKLIST_GIZI) {
      update[it.id] = 'sesuai';
    }
    setJawaban(update);
  }

  async function handleSimpan() {
    if (!vendor.trim()) {
      store.showToast('Nama vendor / pengelola kantin wajib diisi', 'info');
      return;
    }
    setMenyimpan(true);
    try {
      const payload = {
        site,
        tanggal,
        inspektur: namaInspektur,
        vendor,
        nama_kantin: namaKantin,
        jumlah_porsi: Number(jumlahPorsi) || 0,
        jumlah_penjamah: Number(jumlahPenjamah) || 0,
        jumlah_buku_sehat: Number(jumlahBukuSehat) || 0,
        no_slhs: noSlhs,
        tgl_kadaluwarsa_slhs: tglKadaluwarsaSlhs || null,
        kalori_sarapan: Number(kaloriSarapan) || 0,
        kalori_siang: Number(kaloriSiang) || 0,
        kalori_malam: Number(kaloriMalam) || 0,
        extra_fooding: extraFooding,
        jawaban,
        catatan,
      };

      const res = await authFetch('/api/gizi/inspeksi', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      store.showToast(res.pesan || 'Data inspeksi jasaboga & gizi kerja berhasil disimpan', 'success');
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan inspeksi gizi kerja', 'error');
    } finally {
      setMenyimpan(false);
    }
  }

  const badgeColor =
    evaluasiSkor.statusLaik === 'laik'
      ? '#00B894'
      : evaluasiSkor.statusLaik === 'laik_bersyarat'
      ? '#FF7A00'
      : '#FF2D2D';

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '90%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header Title */}
        <div style={{ marginBottom: 14 }}>
          <h1 className="admin-form-title">Inspeksi Jasaboga &amp; Gizi Kerja</h1>
          <p className="admin-form-subtitle">
            Standar kelaikan higiene sanitasi jasaboga/kantin dan evaluasi pemenuhan kalori menu katering pekerja lapangan sesuai regulasi kesehatan kerja.
          </p>
        </div>

        {/* Section 1: Informasi Sesi & Pengelola Jasaboga */}
        <Section title="Informasi Sesi Inspeksi">
          <div style={grid4}>
            <Field label="Job Site">
              <select className="admin-input" style={smallInput} value={site} onChange={(e) => setSite(e.target.value)}>
                {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Tanggal Inspeksi">
              <input
                type="date"
                className="admin-input"
                style={smallInput}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
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

            <Field label="Nama Vendor / Katering *">
              <input
                type="text"
                className="admin-input"
                style={smallInput}
                placeholder="mis. PT Boga Sehat Pratama"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* Section 2: Profil Operasional & Legalitas Kelaikan */}
        <Section title="Profil Operasional &amp; Legalitas Jasaboga">
          <div style={grid4}>
            <Field label="Nama Kantin / Mess Hall">
              <input
                type="text"
                className="admin-input"
                style={smallInput}
                placeholder="mis. Mess Hall Central A"
                value={namaKantin}
                onChange={(e) => setNamaKantin(e.target.value)}
              />
            </Field>

            <Field label="No. Sertifikat SLHS">
              <input
                type="text"
                className="admin-input"
                style={smallInput}
                placeholder="mis. 440/124/Dinkes/2025"
                value={noSlhs}
                onChange={(e) => setNoSlhs(e.target.value)}
              />
            </Field>

            <Field label="Masa Berlaku SLHS">
              <input
                type="date"
                className="admin-input"
                style={smallInput}
                value={tglKadaluwarsaSlhs}
                onChange={(e) => setTglKadaluwarsaSlhs(e.target.value)}
              />
            </Field>

            <Field label="Jumlah Porsi / Hari">
              <input
                type="number"
                className="admin-input"
                style={smallInput}
                placeholder="mis. 450"
                value={jumlahPorsi}
                onChange={(e) => setJumlahPorsi(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>
          </div>

          <div style={{ ...grid4, marginTop: 10 }}>
            <Field label="Total Food Handler">
              <input
                type="number"
                className="admin-input"
                style={smallInput}
                placeholder="Penjamah makanan"
                value={jumlahPenjamah}
                onChange={(e) => setJumlahPenjamah(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>

            <Field label="Penjamah Berbuku Sehat">
              <input
                type="number"
                className="admin-input"
                style={smallInput}
                placeholder="Pemeriksaan berkala"
                value={jumlahBukuSehat}
                onChange={(e) => setJumlahBukuSehat(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>

            <Field label="Extra Fooding Shift Malam">
              <select
                className="admin-input"
                style={smallInput}
                value={extraFooding}
                onChange={(e) => setExtraFooding(e.target.value)}
              >
                <option value="Tersedia Lengkap">Tersedia Lengkap (Susu, Telur, Buah)</option>
                <option value="Tersedia Terbatas">Tersedia Terbatas (Minuman/Snack saja)</option>
                <option value="Tidak Tersedia">Tidak Tersedia</option>
              </select>
            </Field>

            <div style={{ display: 'flex', alignItems: 'flex-end', height: 32 }}>
              <div
                style={{
                  ...smallInput,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--muted)',
                  fontSize: 11,
                  color: 'var(--muted-foreground)',
                  width: '100%',
                }}
              >
                <ShieldCheck size={14} color="#00B894" />
                <span>Rasio Sehat: <b>{jumlahPenjamah ? Math.round(((Number(jumlahBukuSehat) || 0) / Number(jumlahPenjamah)) * 100) : 0}%</b></span>
              </div>
            </div>
          </div>
        </Section>

        {/* Section 3: Evaluasi Menu & Asupan Kalori Kerja */}
        <Section title="Evaluasi Kalori Siklus Menu Katering">
          <div style={grid4}>
            <Field label="Kalori Sarapan (kkal)">
              <input
                type="number"
                className="admin-input"
                style={smallInput}
                value={kaloriSarapan}
                onChange={(e) => setKaloriSarapan(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>

            <Field label="Kalori Makan Siang (kkal)">
              <input
                type="number"
                className="admin-input"
                style={smallInput}
                value={kaloriSiang}
                onChange={(e) => setKaloriSiang(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>

            <Field label="Kalori Makan Malam (kkal)">
              <input
                type="number"
                className="admin-input"
                style={smallInput}
                value={kaloriMalam}
                onChange={(e) => setKaloriMalam(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </Field>

            <div style={{ display: 'flex', alignItems: 'flex-end', height: 32 }}>
              <div
                style={{
                  ...smallInput,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: totalKaloriMenu >= 2600 ? 'rgba(0,184,148,0.12)' : 'rgba(255,122,0,0.12)',
                  border: `1px solid ${totalKaloriMenu >= 2600 ? '#00B894' : '#FF7A00'}`,
                  width: '100%',
                  padding: '0 8px',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>Total Menu:</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: totalKaloriMenu >= 2600 ? '#00B894' : '#FF7A00' }}>
                  {totalKaloriMenu} kkal
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 10.5, color: 'var(--muted-foreground)', alignItems: 'center' }}>
            <Info size={12} />
            <span>Standar Energi Kerja Tambang/Lapangan: <b>2.600 – 3.200 kkal/hari</b> (Aktivitas Sedang – Berat).</span>
          </div>
        </Section>

        {/* Section 4: Checklist Higiene Sanitasi Pengolahan */}
        <Section title="Checklist Kelaikan Higiene Sanitasi Pengolahan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              Evaluasi kepatuhan 16 parameter kelaikan jasaboga &amp; pencegahan keracunan makanan.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="button" onClick={handleIsiSemuaSesuai} style={{ fontSize: 11, padding: '4px 8px' }}>
                <Sparkles size={12} /> Set Semua Sesuai
              </Btn>
              <Btn type="button" onClick={() => setJawaban({})} style={{ fontSize: 11, padding: '4px 8px' }}>
                Reset Isian
              </Btn>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Array.from(perKategori.entries()).map(([kat, items]) => {
              const meta = KATEGORI_GIZI[kat];
              return (
                <div
                  key={kat}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--card)',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'var(--muted)',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--foreground)' }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                      Bobot: {meta.bobotTotal}%
                    </span>
                  </div>

                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {items.map((it) => {
                      const cur = jawaban[it.id];
                      return (
                        <div
                          key={it.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: cur === 'tidak_sesuai' ? 'rgba(255,45,45,0.05)' : 'transparent',
                            borderBottom: '1px dashed var(--border)',
                            gap: 12,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600 }}>{it.judul}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>
                              {it.keterangan}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => setJawabanItem(it.id, 'sesuai')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 10.5,
                                fontWeight: 700,
                                border: '1px solid',
                                cursor: 'pointer',
                                background: cur === 'sesuai' ? '#00B894' : 'var(--muted)',
                                borderColor: cur === 'sesuai' ? '#00B894' : 'var(--border)',
                                color: cur === 'sesuai' ? '#ffffff' : 'var(--foreground)',
                              }}
                            >
                              Sesuai
                            </button>

                            <button
                              type="button"
                              onClick={() => setJawabanItem(it.id, 'tidak_sesuai')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 10.5,
                                fontWeight: 700,
                                border: '1px solid',
                                cursor: 'pointer',
                                background: cur === 'tidak_sesuai' ? '#FF2D2D' : 'var(--muted)',
                                borderColor: cur === 'tidak_sesuai' ? '#FF2D2D' : 'var(--border)',
                                color: cur === 'tidak_sesuai' ? '#ffffff' : 'var(--foreground)',
                              }}
                            >
                              Tidak Sesuai
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Section 5: Ringkasan Skor & Catatan Auditor */}
        <Section title="Hasil Penilaian Kelaikan &amp; Rekomendasi">
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: 'var(--muted)',
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                Kepatuhan Higiene
              </span>
              <div style={{ fontSize: 24, fontWeight: 900, color: badgeColor, lineHeight: 1.1 }}>
                {evaluasiSkor.persenSkor}%
              </div>
            </div>

            <div style={{ height: 34, width: 1, background: 'var(--border)' }} />

            <div>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
                Status Kelaikan Jasaboga
              </span>
              <div style={{ fontSize: 13, fontWeight: 800, color: badgeColor }}>
                {evaluasiSkor.statusLaik === 'laik'
                  ? 'LAIK OPERASIONAL (SANGAT BAIK)'
                  : evaluasiSkor.statusLaik === 'laik_bersyarat'
                  ? 'LAIK BERSYARAT (PERLU PERBAIKAN)'
                  : 'TIDAK LAIK (RISIKO TINGGI)'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                {evaluasiSkor.keteranganStatus}
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11 }}>
              <span>Item Dinilai: <b>{evaluasiSkor.totalItemDinilai} / {CHECKLIST_GIZI.length}</b></span>
              <span style={{ color: '#00B894' }}>Sesuai: <b>{evaluasiSkor.totalSesuai}</b></span>
              <span style={{ color: '#FF2D2D' }}>Temuan: <b>{evaluasiSkor.totalTidakSesuai}</b></span>
            </div>
          </div>

          <Field label="Catatan / Tindakan Perbaikan (PICA) Auditor">
            <textarea
              className="admin-input"
              rows={3}
              style={{ width: '100%', fontSize: 11, padding: '6px 8px' }}
              placeholder="Tuliskan temuan ketidaksesuaian, catatan suhu chiller, atau batas waktu perbaikan untuk pengelola kantin/jasaboga..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
            />
          </Field>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn
              type="button"
              onClick={handleSimpan}
              disabled={menyimpan || !vendor.trim()}
              style={{
                height: 36,
                padding: '0 20px',
                background: '#FF7A00',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {menyimpan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan Hasil Inspeksi
            </Btn>
          </div>
        </Section>
      </div>
    </div>
  );
}
