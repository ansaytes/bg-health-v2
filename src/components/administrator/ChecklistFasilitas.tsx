'use client';

// ============================================================
// Administrator > Checklist Kelaikan Fasilitas & Aset
// ============================================================
//
// Halaman tunggal untuk tiga kelompok checklist yang sama bentuknya:
//   Kotak P3K · Ambulans · Sarana Ergonomi
//
// TAMPILAN mengikuti Sarana & Prasarana (SaranaKlinik), karena keduanya
// satu keluarga pekerjaan: daftar item per kategori, status berupa dropdown
// berwarna, dan perubahan langsung tersimpan per sel tanpa tombol simpan.
// Pengelompokan yang dipakai:
//   • P3K       → per LOKASI kotak (Workshop A, Mess Blok 1, …)
//   • Ambulans  → per UNIT ambulans (AMB-01, …) + status kesiapan unit
//   • Ergonomi  → per KATEGORI sarana (Operator, Kantor, Manual Handling)
//
// Tiga kelompok ini satu tab/halaman karena pekerjaannya sama: memeriksa
// kelengkapan & kelayakan aset. Memisahkannya jadi tiga menu membuat
// pengguna berpindah menu hanya untuk satu laporan inspeksi yang sama.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useSites } from '@/lib/site-list';
import { useMCUStore } from '@/lib/store';

export type JenisChecklist = 'p3k' | 'ambulans' | 'ergonomi';

interface KatalogItem {
  id: number | string;
  nama: string;
  kategori?: string | null;
  satuan?: string | null;
  jumlah_standar?: number | null;
  wajib?: boolean;
}

interface KondisiRow {
  id?: number;
  katalog_id: number | string;
  lokasi?: string | null;
  unit?: string | null;
  status?: string | null;
  jumlah?: number | null;
  layak?: number | null;
  rusak?: number | null;
  tanggal_expired?: string | null;
  kondisi_kotak?: string | null;
  ada_buku_catatan?: boolean | null;
  kondisi?: string | null;
  catatan?: string | null;
  tanggal_inspeksi?: string | null;
  [kunci: string]: unknown;
}

interface Data {
  tabelSiap: boolean;
  catatan?: string;
  label: string;
  pengelompok: string | null;
  site: string;
  katalog: KatalogItem[];
  kondisi: KondisiRow[];
  grup: string[];
  daftarSite: string[];
  ringkas: { total: number; ada: number; rusak: number; tidakAda: number; persenSiap: number };
}

type Status = 'ada' | 'rusak' | 'tidak_ada' | 'tidak_diperlukan';

const STATUS_META: Record<Status, { label: string; warna: string }> = {
  ada: { label: 'Ada', warna: '#00B894' },
  rusak: { label: 'Rusak', warna: '#FF7A00' },
  tidak_ada: { label: 'Tidak ada', warna: '#FF2D2D' },
  tidak_diperlukan: { label: 'Tidak diperlukan', warna: '#778899' },
};

const KATEGORI_P3K: Record<string, string> = {
  isi: 'Isi Kotak',
  obat: 'Obat & Cairan',
  alat: 'Alat',
  administrasi: 'Administrasi',
};

const KATEGORI_AMBULANS: Record<string, string> = {
  medis: 'Peralatan Medis',
  kendaraan: 'Kondisi Kendaraan',
  sanitasi: 'Sanitasi Kabin',
};

/* ── REFERENSI STANDAR (checklist "sudah ada standarnya") ─────────────────── */
// Pengguna sering mengira checklist "suruh isi sendiri" padahal isinya sudah
// baku. Di sini tiap item katalog diberi referensi aturan + standar kuantitatif
// (di luar kolom jumlah_standar di database) sehingga halamannya terbaca sebagai
// checklist kelaikan: centang "ada/sebaiknya" + catat kondisi, bukan bikin daftar.
//
// Sumber: Permenaker 15/2008 Lampiran (P3K), standar ambulans & tanggap darurat
// medis (K3), dan kebutuhan ergonomi operasional (Permenaker 5/2018).

interface Rujukan {
  aturan: string;      // rujukan peraturan
  standar: string;     // standar kuantitatif / ketetapan
  acuan?: string;      // penjelasan singkat kenapa item ini wajib
}

const REFERENSI: Record<string, Rujukan> = {
  /* ── Kotak P3K (Permenaker 15/2008) ── */
  'Kasa steril terbungkus': { aturan: 'Permenaker 15/2008 Lampiran', standar: '5 pak', acuan: 'P3K pertama untuk menutup luka' },
  'Perban (lebar 5 cm)': { aturan: 'Permenaker 15/2008 Lampiran', standar: '2 buah' },
  'Perban (lebar 10 cm)': { aturan: 'Permenaker 15/2008 Lampiran', standar: '2 buah' },
  'Plester (lebar 1,25 cm)': { aturan: 'Permenaker 15/2008 Lampiran', standar: '2 buah' },
  'Plester cepat': { aturan: 'Permenaker 15/2008 Lampiran', standar: '10 buah' },
  'Kapas (25 gram)': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 bungkus' },
  'Pembalut segitiga': { aturan: 'Permenaker 15/2008 Lampiran', standar: '2 buah', acuan: 'Pembidaian & tampon' },
  'Sarung tangan sekali pakai': { aturan: 'Permenaker 15/2008 Lampiran', standar: '4 pasang' },
  'Masker': { aturan: 'Permenaker 15/2008 Lampiran', standar: '2 buah' },
  'Pinset': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 buah' },
  'Gunting pembalut': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 buah' },
  'Peniti': { aturan: 'Permenaker 15/2008 Lampiran', standar: '12 buah', acuan: 'Menggantungkan pembalut segitiga' },
  'Larutan antiseptik (povidone iodine)': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 botol' },
  'Alkohol 70%': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 botol' },
  'Obat luka bakar': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 tube' },
  'Salep / krim antiseptik': { aturan: 'Permenaker 15/2008 Lampiran', standar: '1 tube' },
  'Buku catatan penggunaan P3K': { aturan: 'Permenaker 15/2008', standar: '1 buku', acuan: 'Administrasi: mencatat kejadian & pemakaian' },
  'Daftar isi kotak P3K': { aturan: 'Permenaker 15/2008', standar: '1 lembar', acuan: 'Kartu isi agar cepat dilengkapi' },

  /* ── Ambulans & tanggap darurat medis ── */
  'AED (Automated External Defibrillator)': { aturan: 'Standar tanggap darurat medis', standar: '1 unit', acuan: 'Penyelamatan henti jantung (CPR + AED)' },
  'Tabung oksigen + regulator/tekanan': { aturan: 'Standar ambulans medis', standar: '1 tabung', acuan: 'Dukungan napas' },
  'Suction pump': { aturan: 'Standar ambulans medis', standar: '1 unit', acuan: 'Kebersihan jalan napas' },
  'Stretcher / tandu': { aturan: 'Standar ambulans medis', standar: '1 unit' },
  'Spinal board': { aturan: 'Standar ambulans medis', standar: '1 buah', acuan: 'Imobilisasi trauma tulang belakang' },
  'Kotak P3K dalam ambulans': { aturan: 'Standar ambulans medis', standar: '1 kotak' },
  'Rem (fungsi dan kebocoran)': { aturan: 'K3 kendaraan / tanggap darurat', standar: 'Fungsi & bebas kebocoran' },
  'Ban (tebal bunga & tekanan)': { aturan: 'K3 kendaraan / tanggap darurat', standar: 'Bunga minimal & tekanan sesuai' },
  'Sirine dan lampu rotator': { aturan: 'K3 kendaraan / tanggap darurat', standar: 'Fungsi', acuan: 'Prioritas lalu lintas evakuasi' },
  'BBM minimal 3/4 tangki': { aturan: 'K3 kendaraan / tanggap darurat', standar: '≥ 75% tangki', acuan: 'Siap berangkat tanpa jeda' },
  'Sanitasi kabin pasien': { aturan: 'K3 sanitasi kendaraan', standar: 'Bersih & bebas kontaminasi' },
  'Tabung oksigen portabel': { aturan: 'Standar ambulans medis', standar: '1 tabung' },

  /* ── Sarana ergonomi operasional ── */
  'Suspension seat alat berat / unit tambang': { aturan: 'Permenaker 5/2018 (ergonomi)', standar: 'Suspensi efektif & terawat' },
  'Stasiun kerja kantor (kursi & meja ergonomis)': { aturan: 'Permenaker 5/2018 (ergonomi)', standar: 'Sesuai postur kerja' },
  'Alat bantu manual handling (trolley, lift)': { aturan: 'Permenaker 5/2018 (ergonomi)', standar: 'Fungsi & aman', acuan: 'Mengurangi angkat manual' },
  'Penopang kaki (footrest) area kerja': { aturan: 'Permenaker 5/2018 (ergonomi)', standar: 'Tersedia & sesuai' },
  'Alat bantu angkat vakum / crane kecil': { aturan: 'Permenaker 5/2018 (ergonomi)', standar: 'Fungsi & aman' },
};

/** Label kategori ergonomi (dipakai saat DB belum memberi kategori). */
const KATEGORI_ERGONOMI: Record<string, string> = {
  operator: 'Operator / Alat Berat',
  kantor: 'Kantor',
  manual_handling: 'Manual Handling',
};

/** Satu baris gabungan katalog + kondisi tersimpan. */
interface Baris {
  katalogId: number | string;
  nama: string;
  kategori: string;
  satuan: string | null;
  wajib: boolean;
  status: Status;
  jumlah: number | null;
  jumlahStandar: number | null;
  layak: number | null;
  rusak: number | null;
  tanggalExpired: string | null;
  kondisiKotak: string;
  adaBukuCatatan: boolean;
  kondisi: string;
  catatan: string;
  grup: string;
}

/** Kunci baris pada tabel kondisi (lokasi/unit), kosong untuk ergonomi. */

function gabungBaris(
  katalog: KatalogItem[],
  kondisi: KondisiRow[],
  grup: string,
  pengelompok: string | null,
): Baris[] {
  return katalog.map((k) => {
    const c = kondisi.find((x) =>
      String(x.katalog_id) === String(k.id)
      && (!pengelompok || String(x[pengelompok] ?? '') === grup));

    return {
      katalogId: k.id,
      nama: k.nama,
      kategori: String(k.kategori ?? ''),
      satuan: k.satuan ?? null,
      wajib: Boolean(k.wajib),
      status: (String(c?.status ?? 'tidak_ada') as Status),
      jumlah: c?.jumlah ?? k.jumlah_standar ?? null,
      jumlahStandar: k.jumlah_standar ?? null,
      layak: c?.layak ?? null,
      rusak: c?.rusak ?? null,
      tanggalExpired: c?.tanggal_expired ? String(c.tanggal_expired).slice(0, 10) : '',
      kondisiKotak: String(c?.kondisi_kotak ?? ''),
      adaBukuCatatan: c?.ada_buku_catatan ?? true,
      kondisi: String(c?.kondisi ?? ''),
      catatan: String(c?.catatan ?? ''),
      grup,
    };
  });
}

export default function ChecklistFasilitas({ jenis, initialGrup }: {
  jenis: JenisChecklist;
  initialGrup?: string;
}) {
  const { isAdmin } = useAuth();
  const store = useMCUStore();
  const { sites: daftarSite } = useSites();

  const [site, setSite] = useState('');
  const [grup, setGrup] = useState(initialGrup ?? '');
  const [grupBaru, setGrupBaru] = useState('');
  const [tambahGrup, setTambahGrup] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState<string | number | null>(null);
  const [error, setError] = useState('');
  const [unitStatus, setUnitStatus] = useState<Record<string, string>>({});

  const labelGrup = data?.pengelompok === 'unit'
    ? 'unit'
    : data?.pengelompok === 'lokasi'
      ? 'lokasi'
      : '';

  /* ── Muat ─────────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ jenis });
      if (site) qs.set('site', site);
      const r = await authFetch(`/api/inspeksi/checklist?${qs.toString()}`) as unknown as Data;
      setData(r);
      setSite(r.site || site);
      const tersedia = r.grup ?? [];
      setGrup((prev) => (prev && tersedia.includes(prev) ? prev : tersedia[0] ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat checklist');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [jenis, site]);

  useEffect(() => { void load(); }, [jenis]);

  const pengelompok = data?.pengelompok ?? null;

  useEffect(() => {
    if (!data) { setBaris([]); return; }
    setBaris(gabungBaris(data.katalog, data.kondisi, grup, pengelompok));
  }, [data, grup, pengelompok]);

  /* ── Simpan per sel (pola SaranaKlinik: tanpa tombol simpan) ──────────── */
  const simpan = useCallback(async (satu: Baris, patch: Partial<Baris>) => {
    const baru = { ...satu, ...patch };
    setMenyimpan(`${satu.grup}|${satu.katalogId}`);
    // Optimistis: tampilan langsung berubah, dikembalikan bila gagal.
    setBaris((prev) => prev.map((b) => (
      String(b.katalogId) === String(satu.katalogId) && b.grup === satu.grup ? baru : b
    )));
    try {
      await authFetch('/api/inspeksi/checklist', {
        method: 'POST',
        body: JSON.stringify({
          aksi: 'simpan',
          jenis,
          site,
          grup: satu.grup,
          item: [{
            katalog_id: satu.katalogId,
            status: baru.status,
            jumlah: baru.jumlah,
            layak: baru.layak,
            rusak: baru.rusak,
            tanggal_expired: baru.tanggalExpired,
            kondisi_kotak: baru.kondisiKotak || null,
            ada_buku_catatan: baru.adaBukuCatatan,
            kondisi: baru.kondisi || null,
            catatan: baru.catatan,
          }],
        }),
      });
      // Ringkasan di top bar ikut diperbarui tanpa memuat ulang tabel.
      setData((d) => d ? {
        ...d,
        ringkas: hitungRingkas(baris.map((b) => (
          String(b.katalogId) === String(satu.katalogId) && b.grup === satu.grup ? baru : b
        ))),
      } : d);
    } catch (e) {
      setBaris((prev) => prev.map((b) => (
        String(b.katalogId) === String(satu.katalogId) && b.grup === satu.grup ? satu : b
      )));
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
    } finally {
      setMenyimpan(null);
    }
  }, [jenis, site, baris]);

  const simpanUnit = useCallback(async (unit: string) => {
    try {
      await authFetch('/api/inspeksi/checklist', {
        method: 'POST',
        body: JSON.stringify({
          aksi: 'unit',
          jenis: 'ambulans',
          site,
          unit,
          status_kesiapan: unitStatus[unit] ?? 'standby',
        }),
      });
      store.showToast(`Status unit ${unit} tersimpan`, 'success');
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan status unit', 'error');
    }
  }, [site, unitStatus, store]);

  /* ── Kelompokkan per kategori (seperti SaranaKlinik) ──────────────────── */
  const LABEL_KATEGORI = jenis === 'p3k'
    ? KATEGORI_P3K
    : jenis === 'ambulans'
      ? KATEGORI_AMBULANS
      : KATEGORI_ERGONOMI;

  const perKategori = useMemo(() => {
    const map = new Map<string, Baris[]>();
    for (const b of baris) {
      const list = map.get(b.kategori) ?? [];
      list.push(b);
      map.set(b.kategori, list);
    }
    return map;
  }, [baris]);

  const ringkas = useMemo(() => hitungRingkas(baris), [baris]);
  const judul = { p3k: 'Kotak P3K', ambulans: 'Ambulans', ergonomi: 'Sarana Ergonomi' }[jenis];

  /* ── Gaya sel: rapat, sama dengan Sarana & Prasarana ──────────────────── */
  const th: React.CSSProperties = {
    padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 9,
    textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)',
    fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '4px 7px', borderBottom: '1px solid var(--border)', fontSize: 10.5,
  };
  const inputKecil: React.CSSProperties = {
    fontSize: 10.5, padding: '2px 5px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--background)',
  };

  return (
    <div className="dashboard" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Toolbar */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <select className="admin-filter-select" value={site} onChange={(e) => setSite(e.target.value)}>
            {daftarSite.map((s) => <option key={s} value={s}>{s}</option>)}
            {!daftarSite.length && <option value={site}>{site || '—'}</option>}
          </select>

          {/* Pemilih kelompok: lokasi kotak / unit ambulans */}
          {pengelompok && (data?.grup ?? []).length > 0 && (
            <select className="admin-filter-select" value={grup} onChange={(e) => setGrup(e.target.value)}>
              {(data?.grup ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          {pengelompok && isAdmin && (
            <button type="button" onClick={() => setTambahGrup((v) => !v)} className="mcu-dashboard-refresh">
              <Plus size={13} /> Tambah {labelGrup}
            </button>
          )}
        </div>

        <div className="kunjungan-total-right">
          <span>
            Siap pakai{' '}
            <b style={{ color: ringkas.persenSiap >= 90 ? '#00B894' : ringkas.persenSiap >= 70 ? '#C99A00' : '#FF2D2D' }}>
              {ringkas.ada}/{ringkas.total} ({ringkas.persenSiap.toFixed(0)}%)
            </b>
          </span>
          <span>Rusak <b style={{ color: ringkas.rusak ? '#FF7A00' : 'inherit' }}>{ringkas.rusak}</b></span>
          <span>Tidak ada <b style={{ color: ringkas.tidakAda ? '#FF2D2D' : 'inherit' }}>{ringkas.tidakAda}</b></span>
        </div>
      </div>

      <div style={{ flexShrink: 0, fontSize: 10, color: 'var(--muted-foreground)', display: 'flex', gap: 5, alignItems: 'center' }}>
        <AlertTriangle size={11} />
        Perubahan langsung tersimpan saat kolom diisi.
        {pengelompok && ` Satu ${labelGrup} = satu kotak/unit yang diperiksa.`}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {data && !data.tabelSiap && (
        <div className="card" style={{ padding: '10px 12px', fontSize: 11.5, color: '#9a6b00', flexShrink: 0 }}>
          {data.catatan}
        </div>
      )}

      {/* Tambah lokasi/unit baru */}
      {tambahGrup && pengelompok && (
        <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
          <div className="card-head" style={{ marginBottom: 8 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: '#00B894', flexShrink: 0 }} />
            <div><h2 style={{ fontSize: 12 }}>Tambah {labelGrup}</h2></div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">
                Nama {labelGrup}
              </span>
              <Input
                value={grupBaru}
                onChange={(e) => setGrupBaru(e.target.value)}
                placeholder={jenis === 'ambulans' ? 'mis. AMB-01' : 'mis. Mess Blok 1'}
                className="h-8 w-52 rounded-lg text-sm"
              />
            </label>
            <Button
              size="sm"
              disabled={!grupBaru.trim()}
              onClick={() => {
                const nama = grupBaru.trim();
                if (!nama) return;
                setGrup(nama);
                setGrupBaru('');
                setTambahGrup(false);
                // Baris baru muncul setelah item pertama disimpan.
                setBaris(gabungBaris(data?.katalog ?? [], [], nama, pengelompok));
              }}
              style={{ gap: 5 }}
            >
              <Check size={13} /> Pakai {labelGrup} ini
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTambahGrup(false)}>Batal</Button>
          </div>
        </div>
      )}

      {/* Status kesiapan unit (khusus ambulans) */}
      {jenis === 'ambulans' && (data?.grup ?? []).length > 0 && (
        <div className="card" style={{ padding: '8px 10px', flexShrink: 0 }}>
          <div className="card-head" style={{ marginBottom: 6 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 12 }}>Status Kesiapan Unit</h2>
              <p style={{ fontSize: 9 }}>Menilai kendaraan, bukan kelengkapan itemnya</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {(data?.grup ?? []).map((u) => {
              const nilai = unitStatus[u] ?? 'standby';
              const warna = nilai === 'ready' ? '#00B894' : nilai === 'breakdown' ? '#FF2D2D' : '#F1C40F';
              return (
                <span key={u} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5 }}>
                  <b>{u}</b>
                  <select
                    value={nilai}
                    disabled={!isAdmin}
                    onChange={(e) => setUnitStatus((s) => ({ ...s, [u]: e.target.value }))}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                      border: `1px solid ${warna}55`, background: `${warna}14`, color: warna,
                    }}
                  >
                    <option value="ready">Ready</option>
                    <option value="standby">Standby with Note</option>
                    <option value="breakdown">Breakdown</option>
                  </select>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void simpanUnit(u)}
                      className="mcu-dashboard-refresh"
                      style={{ height: 24, padding: '0 6px' }}
                      title="Simpan status unit ini"
                    >
                      <Check size={11} /> Simpan
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {loading && !baris.length && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
          <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat checklist…
        </div>
      )}

          {/* Kartu per kategori — pola Sarana & Prasarana */}
          {[...perKategori.entries()].map(([kategori, list]) => (
            <div key={kategori} className="card" style={{ padding: '8px 10px', flexShrink: 0 }}>
              <div className="card-head" style={{ marginBottom: 6 }}>
                <span style={{ width: 3, height: 16, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 12 }}>{LABEL_KATEGORI[kategori] ?? (kategori || 'Item')}</h2>
                  <p style={{ fontSize: 9 }}>
                    {list.filter((i) => i.status === 'ada').length} siap · {list.length} item
                    {(() => {
                      // Persentase sesuai standar: item yang status "ada" dan
                      // jumlah memenuhi standar (jika ada) dari total item.
                      const sesuai = list.filter((i) => {
                        if (i.status !== 'ada') return false;
                        const rujukan = REFERENSI[i.nama];
                        if (!rujukan || i.jumlahStandar == null) return true;
                        return i.jumlah !== null && i.jumlah >= i.jumlahStandar;
                      }).length;
                      const persen = list.length ? Math.round((sesuai / list.length) * 100) : 0;
                      return (
                        <span style={{ marginLeft: 8, color: persen >= 90 ? '#00B894' : persen >= 70 ? '#C99A00' : '#FF2D2D' }}>
                          {sesuai}/{list.length} sesuai standar ({persen}%)
                        </span>
                      );
                    })()}
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Item</th>
                      <th style={th}>Status</th>
                      {jenis === 'ergonomi' ? (
                        <>
                          <th style={th}>Jumlah</th>
                          <th style={th}>Layak</th>
                          <th style={th}>Rusak</th>
                        </>
                      ) : (
                        <th style={th}>Jumlah</th>
                      )}
                      {jenis === 'p3k' && <th style={th}>Kedaluwarsa</th>}
                      {jenis === 'p3k' && <th style={th}>Kondisi Kotak</th>}
                      {jenis === 'p3k' && <th style={th}>Buku Catatan</th>}
                      {jenis === 'ambulans' && <th style={th}>Kondisi</th>}
                      <th style={th}>Tanggal Periksa</th>
                      <th style={th}>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((b) => {
                      const kunci = `${b.grup}|${b.katalogId}`;
                      const sibuk = menyimpan === kunci;
                      const meta = STATUS_META[b.status];
                      const expired = b.tanggalExpired
                        ? Math.round((new Date(`${b.tanggalExpired}T00:00:00`).getTime() - Date.now()) / 86_400_000)
                        : null;
                      const expiredLewat = expired !== null && expired < 0;
                      const expiredDekat = expired !== null && expired >= 0 && expired <= 30;

                      return (
                        <tr key={kunci} style={{ opacity: sibuk ? 0.55 : 1 }}>
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {b.nama}
                              {!b.wajib && (
                                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                                  tambahan
                                </span>
                              )}
                              {b.satuan && <span style={{ fontSize: 8, color: 'var(--muted-foreground)' }}>{b.satuan}</span>}
                            </div>
                            {/* Referensi standar: isi checklist ini sudah baku, bukan diisi manual. */}
                            {(() => {
                              const rujukan = REFERENSI[b.nama];
                              if (!rujukan) return null;
                              return (
                                <div style={{ fontSize: 8.5, color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.35 }} title={rujukan.acuan}>
                                  <span style={{ color: '#1f5f9b', fontWeight: 600 }}>{rujukan.standar}</span>
                                  {' · '}{rujukan.aturan}
                                </div>
                              );
                            })()}
                          </td>

                          <td style={td}>
                            <select
                              value={b.status}
                              disabled={!isAdmin || sibuk}
                              onChange={(e) => void simpan(b, { status: e.target.value as Status })}
                              style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
                                border: `1px solid ${meta.warna}55`, background: `${meta.warna}14`, color: meta.warna,
                              }}
                            >
                              {(Object.keys(STATUS_META) as Status[]).map((s) => (
                                <option key={s} value={s}>{STATUS_META[s].label}</option>
                              ))}
                            </select>
                          </td>

                          {/* Jumlah / layak / rusak */}
                          {jenis === 'ergonomi' ? (
                            <>
                              <td style={td}>
                                <input
                                  type="number" min={0} defaultValue={b.jumlah ?? ''}
                                  disabled={!isAdmin || sibuk}
                                  onBlur={(e) => {
                                    const v = e.target.value === '' ? null : Number(e.target.value);
                                    if (v !== b.jumlah) void simpan(b, { jumlah: v });
                                  }}
                                  style={{ ...inputKecil, width: 58 }}
                                />
                              </td>
                              <td style={td}>
                                <input
                                  type="number" min={0} defaultValue={b.layak ?? ''}
                                  disabled={!isAdmin || sibuk}
                                  onBlur={(e) => {
                                    const v = e.target.value === '' ? null : Number(e.target.value);
                                    if (v !== b.layak) void simpan(b, { layak: v });
                                  }}
                                  style={{ ...inputKecil, width: 58 }}
                                />
                              </td>
                              <td style={td}>
                                <input
                                  type="number" min={0} defaultValue={b.rusak ?? ''}
                                  disabled={!isAdmin || sibuk}
                                  onBlur={(e) => {
                                    const v = e.target.value === '' ? null : Number(e.target.value);
                                    if (v !== b.rusak) void simpan(b, { rusak: v });
                                  }}
                                  style={{ ...inputKecil, width: 58, color: Number(b.rusak ?? 0) > 0 ? '#FF2D2D' : 'inherit' }}
                                />
                              </td>
                            </>
                          ) : (
                            <td style={td}>
                              <input
                                type="number" min={0} defaultValue={b.jumlah ?? ''}
                                disabled={!isAdmin || sibuk}
                                onBlur={(e) => {
                                  const v = e.target.value === '' ? null : Number(e.target.value);
                                  if (v !== b.jumlah) void simpan(b, { jumlah: v });
                                }}
                                style={{ ...inputKecil, width: 58 }}
                              />
                            </td>
                          )}

                          {/* Kolom khusus P3K */}
                          {jenis === 'p3k' && (
                            <td style={td}>
                              <input
                                type="date"
                                defaultValue={b.tanggalExpired ?? ''}
                                disabled={!isAdmin || sibuk}
                                onChange={(e) => void simpan(b, { tanggalExpired: e.target.value })}
                                style={{
                                  ...inputKecil,
                                  border: `1px solid ${expiredLewat ? '#FF2D2D' : expiredDekat ? '#F1C40F' : 'var(--border)'}`,
                                  color: expiredLewat ? '#FF2D2D' : 'inherit',
                                }}
                                title={expired === null ? 'Tanggal kedaluwarsa' : expiredLewat ? `Sudah lewat ${Math.abs(expired)} hari` : `${expired} hari lagi`}
                              />
                              {expiredLewat && <div style={{ fontSize: 8.5, color: '#FF2D2D', marginTop: 1 }}>kedaluwarsa</div>}
                              {expiredDekat && <div style={{ fontSize: 8.5, color: '#C99A00', marginTop: 1 }}>{expired} hari lagi</div>}
                            </td>
                          )}
                          {jenis === 'p3k' && (
                            <td style={td}>
                              <select
                                value={b.kondisiKotak}
                                disabled={!isAdmin || sibuk}
                                onChange={(e) => void simpan(b, { kondisiKotak: e.target.value })}
                                style={{ ...inputKecil, padding: '2px 4px' }}
                              >
                                <option value="">—</option>
                                <option value="bersih">Bersih</option>
                                <option value="kotor">Kotor</option>
                                <option value="rusak">Rusak</option>
                              </select>
                            </td>
                          )}
                          {jenis === 'p3k' && (
                            <td style={{ ...td, textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={b.adaBukuCatatan}
                                disabled={!isAdmin || sibuk}
                                onChange={(e) => void simpan(b, { adaBukuCatatan: e.target.checked })}
                                title="Buku catatan penggunaan P3K tersedia"
                              />
                            </td>
                          )}

                          {/* Kondisi khusus ambulans */}
                          {jenis === 'ambulans' && (
                            <td style={td}>
                              <input
                                defaultValue={b.kondisi}
                                disabled={!isAdmin || sibuk}
                                onBlur={(e) => { if (e.target.value !== b.kondisi) void simpan(b, { kondisi: e.target.value }); }}
                                placeholder="—"
                                style={{ ...inputKecil, width: 130 }}
                              />
                            </td>
                          )}

                          <td style={td}>
                            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>
                              {b.katalogId && data?.kondisi.find((k) => String(k.katalog_id) === String(b.katalogId)
                                && (!pengelompok || String(k[pengelompok] ?? '') === b.grup))?.tanggal_inspeksi
                                ? String(data.kondisi.find((k) => String(k.katalog_id) === String(b.katalogId)
                                  && (!pengelompok || String(k[pengelompok] ?? '') === b.grup))?.tanggal_inspeksi).slice(0, 10)
                                : '—'}
                            </span>
                          </td>

                          <td style={td}>
                            <input
                              defaultValue={b.catatan}
                              disabled={!isAdmin || sibuk}
                              onBlur={(e) => { if (e.target.value !== b.catatan) void simpan(b, { catatan: e.target.value }); }}
                              placeholder="—"
                              style={{ ...inputKecil, width: 150 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {!loading && !baris.length && !error && data?.tabelSiap && (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11.5 }}>
              Belum ada katalog {judul.toLowerCase()}.
            </div>
          )}
        </div>
      );
}

      /** Ringkasan status dari baris yang sedang ditampilkan. */
      function hitungRingkas(baris: Baris[]) {
  const total = baris.length;
  const ada = baris.filter((b) => b.status === 'ada').length;
      return {
        total,
        ada,
        rusak: baris.filter((b) => b.status === 'rusak').length,
    tidakAda: baris.filter((b) => b.status === 'tidak_ada').length,
      persenSiap: total ? Math.round((ada / total) * 1000) / 10 : 0,
  };
}
