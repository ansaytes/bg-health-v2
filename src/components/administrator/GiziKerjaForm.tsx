'use client';

// Administrator > Higiene Industri > Form Inspeksi Gizi & Jasaboga
//
// Standar Evaluasi Kelaikan Jasaboga & Gizi Kerja:
//   1. Legalitas SLHS & Higiene Penjamah Makanan (Permenkes 1096/2011)
//   2. Fasilitas & Sanitasi Dapur Pengolahan
//   3. Pengendalian Suhu & Pencegahan Kontaminasi Silang (HACCP)
//   4. Pemenuhan Kecukupan Kalori Kerja (AKG Kemenkes 2019 / Permenkes 28/2019)
//   5. Penyimpanan Sampel Makanan 1x24 Jam & Uji Mikrobiologi

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Plus,
  Scale,
  Save,
  ShieldCheck,
  CheckCheck,
  Trash2,
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
import { MASTER_DKBM, hitungGiziSajian, type ItemDKBM } from '@/lib/gizi-kerja';
import { Btn, Field, Section, SITES, grid4, smallInput } from './hc-ergo-ui';

export default function GiziKerjaForm() {
  const store = useMCUStore();
  const { profile } = useAuth();
  const namaInspektur = profile?.full_name || profile?.username || '-';

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

  // Kalkulator DKBM Timbangan Porsi
  const [bukaDkbm, setBukaDkbm] = useState(false);
  const [bukaFormTambahMenu, setBukaFormTambahMenu] = useState(false);
  const [masterDkbm, setMasterDkbm] = useState<ItemDKBM[]>(MASTER_DKBM);
  const [loadingDkbm, setLoadingDkbm] = useState(false);
  const [sesiPilihan, setSesiPilihan] = useState<'sarapan' | 'siang' | 'malam'>('siang');
  const [daftarTimbangan, setDaftarTimbangan] = useState<{ id: string; bahanId: string; gram: number }[]>([
    { id: '1', bahanId: 'nasi-putih', gram: 200 },
    { id: '2', bahanId: 'ayam-goreng', gram: 90 },
    { id: '3', bahanId: 'tempe-goreng', gram: 50 },
    { id: '4', bahanId: 'sayur-sop', gram: 120 },
    { id: '5', bahanId: 'semangka', gram: 150 },
  ]);
  const [bahanTerpilih, setBahanTerpilih] = useState(MASTER_DKBM[0].id);
  const [gramInput, setGramInput] = useState<number | ''>(100);

  // Form Tambah Menu Baru ke Database
  const [baruNama, setBaruNama] = useState('');
  const [baruKategori, setBaruKategori] = useState<ItemDKBM['kategori']>('Lauk Hewani');
  const [baruKalori, setBaruKalori] = useState<number | ''>(200);
  const [baruProtein, setBaruProtein] = useState<number | ''>(15);
  const [baruLemak, setBaruLemak] = useState<number | ''>(8);
  const [baruKarbo, setBaruKarbo] = useState<number | ''>(5);
  const [baruPorsi, setBaruPorsi] = useState('');
  const [menyimpanMenu, setMenyimpanMenu] = useState(false);

  // Load DKBM dari database Supabase
  const loadMasterDkbm = useCallback(async () => {
    setLoadingDkbm(true);
    try {
      const res = (await authFetch('/api/gizi/dkbm')) as { success: boolean; data?: ItemDKBM[] };
      if (res.data && res.data.length > 0) {
        setMasterDkbm(res.data);
      }
    } catch (err) {
      console.error('[GiziKerja] Failed to load DKBM from database:', err);
    } finally {
      setLoadingDkbm(false);
    }
  }, []);

  useEffect(() => {
    void loadMasterDkbm();
  }, [loadMasterDkbm]);

  const hasilGiziTimbangan = useMemo(() => {
    return hitungGiziSajian(daftarTimbangan, masterDkbm);
  }, [daftarTimbangan, masterDkbm]);

  function handleTambahTimbangan() {
    if (!bahanTerpilih || !gramInput || Number(gramInput) <= 0) return;
    setDaftarTimbangan((prev) => [
      ...prev,
      { id: String(Date.now()), bahanId: bahanTerpilih, gram: Number(gramInput) },
    ]);
  }

  function handleHapusTimbangan(id: string) {
    setDaftarTimbangan((prev) => prev.filter((it) => it.id !== id));
  }

  function handleTerapkanKeKalori() {
    if (sesiPilihan === 'sarapan') setKaloriSarapan(hasilGiziTimbangan.totalKalori);
    else if (sesiPilihan === 'siang') setKaloriSiang(hasilGiziTimbangan.totalKalori);
    else setKaloriMalam(hasilGiziTimbangan.totalKalori);

    store.showToast(`Kalori ${sesiPilihan.toUpperCase()} diperbarui menjadi ${hasilGiziTimbangan.totalKalori} kkal (berdasarkan timbangan)`, 'success');
  }

  async function handleSimpanMenuDatabase() {
    if (!baruNama.trim() || !baruKalori) {
      store.showToast('Nama menu dan kalori per 100g wajib diisi', 'info');
      return;
    }
    setMenyimpanMenu(true);
    try {
      const res = (await authFetch('/api/gizi/dkbm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: baruNama.trim(),
          kategori: baruKategori,
          kaloriPer100g: Number(baruKalori),
          proteinPer100g: Number(baruProtein) || 0,
          lemakPer100g: Number(baruLemak) || 0,
          karbohidratPer100g: Number(baruKarbo) || 0,
          porsiUmum: baruPorsi.trim() || undefined,
        }),
      })) as { success?: boolean; pesan?: string; data?: ItemDKBM };

      store.showToast(res.pesan || 'Menu berhasil ditambahkan ke database master DKBM', 'success');
      setBaruNama('');
      setBukaFormTambahMenu(false);
      await loadMasterDkbm();
      if (res.data?.id) setBahanTerpilih(res.data.id);
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan menu ke database', 'error');
    } finally {
      setMenyimpanMenu(false);
    }
  }

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
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* Header Title */}
        <div style={{ marginBottom: 8 }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              Input kalori per waktu makan. Anda dapat mengisi langsung angka kalori atau menggunakan modul timbangan porsi DKBM di bawah.
            </span>
            <button
              type="button"
              onClick={() => setBukaDkbm(!bukaDkbm)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: bukaDkbm ? 'rgba(0,184,148,0.15)' : 'var(--muted)',
                border: '1px solid var(--border)',
                color: bukaDkbm ? '#00B894' : 'var(--foreground)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Scale size={13} />
              {bukaDkbm ? 'Tutup Timbangan DKBM' : 'Buka Kalkulator Timbangan DKBM'}
            </button>
          </div>

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

          {/* ── Kalkulator Timbangan Porsi DKBM ────────────────── */}
          {bukaDkbm && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Scale size={14} color="#00B894" />
                    Kalkulator Timbangan Sajian Katering (Daftar Komposisi Bahan Makanan Kemenkes)
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    Timbang satu sajian standar katering di dapur mess, masukkan gram per bahan untuk menghitung energi dan zat gizi makro.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setBukaFormTambahMenu(!bukaFormTambahMenu)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: bukaFormTambahMenu ? '#FF7A00' : 'var(--background)',
                      border: '1px solid var(--border)',
                      color: bukaFormTambahMenu ? '#fff' : 'var(--foreground)',
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={12} /> {bukaFormTambahMenu ? 'Tutup Form Menu' : '+ Menu Baru'}
                  </button>

                  <span style={{ fontSize: 11, fontWeight: 600 }}>Target:</span>
                  <select
                    value={sesiPilihan}
                    onChange={(e) => setSesiPilihan(e.target.value as 'sarapan' | 'siang' | 'malam')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <option value="sarapan">Sarapan Pagi</option>
                    <option value="siang">Makan Siang</option>
                    <option value="malam">Makan Malam</option>
                  </select>
                </div>
              </div>

              {/* Form Tambah Menu Baru ke Database (Jika Dibuka) */}
              {bukaFormTambahMenu && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF7A00' }}>
                    Tambah Bahan Makanan Baru ke Database Master DKBM
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block' }}>Nama Menu *</label>
                      <input
                        type="text"
                        placeholder="mis. Rawon Daging Sapi"
                        value={baruNama}
                        onChange={(e) => setBaruNama(e.target.value)}
                        style={{ ...smallInput, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block' }}>Kategori</label>
                      <select
                        value={baruKategori}
                        onChange={(e) => setBaruKategori(e.target.value as ItemDKBM['kategori'])}
                        style={{ ...smallInput, width: '100%' }}
                      >
                        <option value="Karbohidrat">Karbohidrat</option>
                        <option value="Lauk Hewani">Lauk Hewani</option>
                        <option value="Lauk Nabati">Lauk Nabati</option>
                        <option value="Sayuran">Sayuran</option>
                        <option value="Buah">Buah</option>
                        <option value="Ekstra / Pelengkap">Ekstra / Pelengkap</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block' }}>Kkal/100g *</label>
                      <input
                        type="number"
                        placeholder="Kalori"
                        value={baruKalori}
                        onChange={(e) => setBaruKalori(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ ...smallInput, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block' }}>Protein (g)</label>
                      <input
                        type="number"
                        value={baruProtein}
                        onChange={(e) => setBaruProtein(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ ...smallInput, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block' }}>Lemak (g)</label>
                      <input
                        type="number"
                        value={baruLemak}
                        onChange={(e) => setBaruLemak(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ ...smallInput, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'block' }}>Karbo (g)</label>
                      <input
                        type="number"
                        value={baruKarbo}
                        onChange={(e) => setBaruKarbo(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ ...smallInput, width: '100%' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setBukaFormTambahMenu(false)}
                      style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', fontSize: 11 }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={menyimpanMenu}
                      onClick={() => void handleSimpanMenuDatabase()}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 5,
                        border: 'none',
                        background: '#00B894',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {menyimpanMenu ? 'Menyimpan...' : 'Simpan ke Database'}
                    </button>
                  </div>
                </div>
              )}

              {/* Baris Tambah Bahan */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 3 }}>
                    Pilih Bahan Makanan (DKBM Database)
                  </label>
                  <select
                    value={bahanTerpilih}
                    onChange={(e) => setBahanTerpilih(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      fontSize: 11,
                    }}
                  >
                    {masterDkbm.map((b) => (
                      <option key={b.id} value={b.id}>
                        [{b.kategori}] {b.nama} : ({b.kaloriPer100g} kkal/100g)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ width: 120 }}>
                  <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 3 }}>
                    Berat Timbangan (g)
                  </label>
                  <input
                    type="number"
                    value={gramInput}
                    onChange={(e) => setGramInput(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="mis. 150"
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      fontSize: 11,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTambahTimbangan}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: '#00B894',
                    color: '#fff',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={13} /> Tambah Bahan
                </button>
              </div>

              {/* Tabel Rincian Timbangan */}
              <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px' }}>Bahan Makanan</th>
                      <th style={{ padding: '6px 10px' }}>Kategori</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Berat (g)</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Energi (kkal)</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Protein (g)</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Lemak (g)</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Karbo (g)</th>
                      <th style={{ padding: '6px 10px', width: 40, textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasilGiziTimbangan.rincian.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 14, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                          Belum ada bahan yang ditimbang. Pilih bahan makanan di atas dan masukkan berat gram.
                        </td>
                      </tr>
                    ) : (
                      hasilGiziTimbangan.rincian.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.nama}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--muted-foreground)' }}>{r.kategori}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.gram} g</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#00B894' }}>{r.kalori}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.protein}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.lemak}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{r.karbohidrat}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleHapusTimbangan(daftarTimbangan[i]?.id)}
                              style={{ background: 'transparent', border: 'none', color: '#FF2D2D', cursor: 'pointer', padding: 2 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {hasilGiziTimbangan.rincian.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--muted)', fontWeight: 800 }}>
                        <td colSpan={2} style={{ padding: '8px 10px' }}>Total Sajian Terhitung:</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          {daftarTimbangan.reduce((acc, it) => acc + it.gram, 0)} g
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#00B894', fontSize: 12 }}>
                          {hasilGiziTimbangan.totalKalori} kkal
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{hasilGiziTimbangan.totalProtein} g</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{hasilGiziTimbangan.totalLemak} g</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{hasilGiziTimbangan.totalKarbohidrat} g</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {hasilGiziTimbangan.rincian.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleTerapkanKeKalori}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: '#00B894',
                      color: '#fff',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Terapkan {hasilGiziTimbangan.totalKalori} kkal ke Kalori {sesiPilihan.toUpperCase()}
                  </button>
                </div>
              )}
            </div>
          )}

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
                <CheckCheck size={12} /> Set Semua Sesuai
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
