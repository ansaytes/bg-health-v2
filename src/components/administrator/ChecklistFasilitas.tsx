'use client';

// ============================================================
// Administrator > Checklist Kelaikan Fasilitas & Aset
// (Kotak P3K · Ambulans · Sarana Ergonomi)
// ============================================================
// Mengikuti model checklist "Sarana Klinik":
//   • Tampilan kartu per kategori yang rapi & terorganisir
//   • Kolom seragam: Item, Status (Pill dropdown), Jumlah, Kondisi, Tanggal Periksa/Expired, Catatan
//   • Auto-save per sel tanpa tombol simpan terpisah
//   • Filter Status, Site, dan Lokasi/Unit
//   • Tombol Tambah Item katalog lapangan
//   • Tautan langsung ke Register PICA jika ditemukan item rusak / tidak ada

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, RefreshCw } from 'lucide-react';

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
  kondisi?: string | null;
  catatan?: string | null;
  tanggal_inspeksi?: string | null;
  [kunci: string]: unknown;
}

interface AmbulansUnitRow {
  unit: string;
  status_kesiapan?: string;
  bbm_persen?: number | null;
  catatan?: string | null;
}

interface DataResponse {
  tabelSiap: boolean;
  catatan?: string;
  label: string;
  pengelompok: string | null;
  site: string;
  katalog: KatalogItem[];
  kondisi: KondisiRow[];
  grup: string[];
  unitList?: AmbulansUnitRow[];
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

const KATEGORI_LABEL_MAP: Record<JenisChecklist, Record<string, string>> = {
  p3k: {
    administrasi: 'Perlengkapan Kotak & Administrasi',
    isi: 'Bahan Pembalut & Perban',
    obat: 'Cairan, Salep & Antiseptik',
    alat: 'Alat & Perlengkapan Medis',
  },
  ambulans: {
    kendaraan: 'Kelaikan Kendaraan & Kemudi',
    medis: 'Peralatan Medis & Resusitasi',
    evakuasi: 'Peralatan Evakuasi & Imobilisasi',
    sanitasi: 'Kabin Pasien, Sanitasi & BHP',
  },
  ergonomi: {
    operator: 'Operator Alat Berat & Kendaraan Tambang',
    kantor: 'Perkantoran & Ruang Kontrol',
    manual_handling: 'Workshop, Gudang & Manual Handling',
  },
};

const DEFAULT_GRUP: Record<JenisChecklist, string[]> = {
  p3k: ['Workshop', 'Kantor Utama', 'Mess', 'Warehouse'],
  ambulans: ['AMB-01'],
  ergonomi: [],
};

interface Baris {
  katalogId: number | string;
  nama: string;
  kategori: string;
  satuan: string | null;
  wajib: boolean;
  status: Status;
  jumlah: number | null;
  jumlahStandar: number | null;
  kondisi: string;
  tanggalInspeksi: string | null;
  tanggalExpired: string | null;
  catatan: string;
  grup: string;
}

export default function ChecklistFasilitas({
  jenis,
  initialGrup,
  onBukaPica,
}: {
  jenis: JenisChecklist;
  initialGrup?: string;
  onBukaPica?: () => void;
}) {
  const { isAdmin } = useAuth();
  const store = useMCUStore();
  const { sites: daftarSite } = useSites();

  const [site, setSite] = useState('Head Office');
  const [grup, setGrup] = useState(initialGrup ?? '');
  const [grupBaru, setGrupBaru] = useState('');
  const [tambahGrup, setTambahGrup] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('semua');
  const [tambahItem, setTambahItem] = useState(false);

  const [data, setData] = useState<DataResponse | null>(null);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [unitStatus, setUnitStatus] = useState<Record<string, { kesiapan: string; bbm: number | null }>>({});

  const pengelompok = data?.pengelompok ?? (jenis === 'p3k' ? 'lokasi' : jenis === 'ambulans' ? 'unit' : null);
  const labelGrup = jenis === 'p3k' ? 'Lokasi Kotak' : jenis === 'ambulans' ? 'Unit Ambulans' : '';

  /* ── Muat Data ─────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ jenis });
      if (site) qs.set('site', site);
      const r = await authFetch(`/api/inspeksi/checklist?${qs.toString()}`) as unknown as DataResponse;
      setData(r);

      const grupTersedia = (r.grup && r.grup.length > 0)
        ? r.grup
        : DEFAULT_GRUP[jenis];

      setGrup((prev) => (prev && grupTersedia.includes(prev) ? prev : grupTersedia[0] ?? ''));

      // Status unit ambulans
      if (r.unitList) {
        const mapUnit: Record<string, { kesiapan: string; bbm: number | null }> = {};
        for (const u of r.unitList) {
          mapUnit[u.unit] = {
            kesiapan: u.status_kesiapan || 'standby',
            bbm: u.bbm_persen ?? null,
          };
        }
        setUnitStatus(mapUnit);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat checklist');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [jenis, site]);

  useEffect(() => { void load(); }, [load]);

  /* ── Gabungkan Katalog + Kondisi Tersimpan ──────────────────────────────── */
  useEffect(() => {
    if (!data?.katalog) {
      setBaris([]);
      return;
    }

    const daftar = data.katalog.map((k) => {
      const c = data.kondisi.find((x) =>
        String(x.katalog_id) === String(k.id)
        && (!pengelompok || String(x[pengelompok] ?? '') === grup)
      );

      return {
        katalogId: k.id,
        nama: k.nama,
        kategori: String(k.kategori ?? 'umum'),
        satuan: k.satuan ?? null,
        wajib: k.wajib !== undefined ? Boolean(k.wajib) : true,
        status: (String(c?.status ?? 'tidak_ada') as Status),
        jumlah: c?.jumlah !== undefined && c?.jumlah !== null ? Number(c.jumlah) : (k.jumlah_standar ?? null),
        jumlahStandar: k.jumlah_standar ?? null,
        kondisi: String(c?.kondisi ?? c?.kondisi_kotak ?? ''),
        tanggalInspeksi: c?.tanggal_inspeksi ? String(c.tanggal_inspeksi).slice(0, 10) : '',
        tanggalExpired: c?.tanggal_expired ? String(c.tanggal_expired).slice(0, 10) : '',
        catatan: String(c?.catatan ?? ''),
        grup,
      };
    });

    setBaris(daftar);
  }, [data, grup, pengelompok]);

  /* ── Simpan Per Sel (Optimistis, Pola Sarana Klinik) ───────────────────── */
  const simpan = useCallback(async (satu: Baris, patch: Partial<Baris>) => {
    const baru: Baris = { ...satu, ...patch };
    const kunci = `${satu.grup}|${satu.katalogId}`;
    setMenyimpan(kunci);

    // Update UI seketika
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
            kondisi: baru.kondisi || null,
            tanggal_expired: baru.tanggalExpired || null,
            tanggal_inspeksi: baru.tanggalInspeksi || new Date().toISOString().slice(0, 10),
            catatan: baru.catatan || null,
          }],
        }),
      });

      // Update ringkasan di memori
      setData((d) => {
        if (!d) return d;
        const updatedKondisi = [...d.kondisi];
        const idx = updatedKondisi.findIndex(
          (x) => String(x.katalog_id) === String(satu.katalogId)
            && (!pengelompok || String(x[pengelompok] ?? '') === satu.grup)
        );
        const itemPayload: KondisiRow = {
          katalog_id: satu.katalogId,
          status: baru.status,
          jumlah: baru.jumlah,
          kondisi: baru.kondisi,
          tanggal_expired: baru.tanggalExpired,
          tanggal_inspeksi: baru.tanggalInspeksi,
          catatan: baru.catatan,
          ...(pengelompok ? { [pengelompok]: satu.grup } : {}),
        };
        if (idx >= 0) {
          updatedKondisi[idx] = { ...updatedKondisi[idx], ...itemPayload };
        } else {
          updatedKondisi.push(itemPayload);
        }
        return {
          ...d,
          kondisi: updatedKondisi,
        };
      });
    } catch (e) {
      // Rollback jika gagal
      setBaris((prev) => prev.map((b) => (
        String(b.katalogId) === String(satu.katalogId) && b.grup === satu.grup ? satu : b
      )));
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
    } finally {
      setMenyimpan(null);
    }
  }, [jenis, site, pengelompok, store]);

  /* ── Simpan Status Unit Ambulans ────────────────────────────────────────── */
  const simpanStatusUnit = useCallback(async (unitNama: string, kesiapan: string, bbm: number | null) => {
    try {
      await authFetch('/api/inspeksi/checklist', {
        method: 'POST',
        body: JSON.stringify({
          aksi: 'unit',
          jenis: 'ambulans',
          site,
          unit: unitNama,
          status_kesiapan: kesiapan,
          bbm_persen: bbm,
        }),
      });
      store.showToast(`Status unit ${unitNama} diperbarui`, 'success');
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan status unit', 'error');
    }
  }, [site, store]);

  /* ── Filter & Kelompokkan Per Kategori (Pola Sarana Klinik) ─────────────── */
  const kategoriMap = KATEGORI_LABEL_MAP[jenis] ?? {};

  const barisFiltered = useMemo(() => {
    if (filterStatus === 'semua') return baris;
    return baris.filter((b) => b.status === filterStatus);
  }, [baris, filterStatus]);

  const perKategori = useMemo(() => {
    const map = new Map<string, Baris[]>();
    for (const b of barisFiltered) {
      const list = map.get(b.kategori) ?? [];
      list.push(b);
      map.set(b.kategori, list);
    }
    return map;
  }, [barisFiltered]);

  /* ── Ringkasan Kepatuhan & Temuan ───────────────────────────────────────── */
  const ringkas = useMemo(() => {
    const total = baris.length;
    const ada = baris.filter((b) => b.status === 'ada').length;
    const rusak = baris.filter((b) => b.status === 'rusak').length;
    const tidakAda = baris.filter((b) => b.status === 'tidak_ada').length;
    const tidakDiperlukan = baris.filter((b) => b.status === 'tidak_diperlukan').length;
    const wajib = baris.filter((b) => b.wajib && b.status !== 'tidak_diperlukan');
    const wajibAda = wajib.filter((b) => b.status === 'ada').length;
    const persen = wajib.length ? Math.round((wajibAda / wajib.length) * 100) : (total ? Math.round((ada / total) * 100) : 0);

    const expiredCount = baris.filter((b) => {
      if (!b.tanggalExpired) return false;
      const t = new Date(`${b.tanggalExpired}T00:00:00`).getTime();
      return !Number.isNaN(t) && t < Date.now();
    }).length;

    return {
      total,
      ada,
      rusak,
      tidakAda,
      tidakDiperlukan,
      wajibTotal: wajib.length,
      wajibAda,
      persen,
      expiredCount,
      totalTemuan: rusak + tidakAda,
    };
  }, [baris]);

  const daftarGrup = useMemo(() => {
    const dariServer = data?.grup ?? [];
    if (dariServer.length > 0) return dariServer;
    return DEFAULT_GRUP[jenis];
  }, [data?.grup, jenis]);

  /* ── Gaya Tabel & Layout Bersih Mengacu Hearing Conservation / Ergonomi ── */
  const th: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--muted-foreground)',
    fontWeight: 700,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    verticalAlign: 'middle',
  };
  const cellInput: React.CSSProperties = {
    height: 32,
    fontSize: 12,
    padding: '0 8px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--background)',
    color: 'var(--foreground)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const judulChecklist = {
    p3k: 'Kotak P3K',
    ambulans: 'Ambulans',
    ergonomi: 'Sarana Ergonomi',
  }[jenis];

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', width: '94%', margin: '0 auto' }}>
      <div className="admin-form-inner">
        {/* ── Judul Halaman ala Hearing Conservation / Ergonomi ── */}
        <div style={{ marginBottom: 8 }}>
          <h1 className="admin-form-title">Checklist Kelaikan {judulChecklist}</h1>
          <p className="admin-form-subtitle">
            {jenis === 'p3k'
              ? 'Pemeriksaan kelengkapan dan kondisi kotak P3K per lokasi kerja sesuai standar Permenaker No. 15/MEN/VIII/2008.'
              : jenis === 'ambulans'
              ? 'Pemeriksaan kelaikan unit ambulans, BBM, dan kesiapan sarana evakuasi medis darurat.'
              : 'Pemeriksaan kelayakan dan kenyamanan fasilitas kerja ergonomi sesuai standar Permenaker No. 5/2018.'}
          </p>
        </div>

        {/* ── Toolbar / Filter Bar ── */}
        <div className="kunjungan-filter-bar" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Site Selector */}
            <select
              className="admin-filter-select"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              title="Pilih Site"
              style={{ height: 32, fontSize: 12, padding: '0 24px 0 10px', borderRadius: 8 }}
            >
              {daftarSite.map((s) => <option key={s} value={s}>{s}</option>)}
              {!daftarSite.length && <option value={site}>{site || 'Head Office'}</option>}
            </select>

            {/* Lokasi / Unit Selector */}
            {pengelompok && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  className="admin-filter-select"
                  value={grup}
                  onChange={(e) => setGrup(e.target.value)}
                  style={{ height: 32, fontSize: 12, fontWeight: 700, padding: '0 24px 0 10px', borderRadius: 8, color: 'var(--brand-primary, #ff4d00)' }}
                  title={`Pilih ${labelGrup}`}
                >
                  {daftarGrup.map((g) => <option key={g} value={g}>{labelGrup}: {g}</option>)}
                </select>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setTambahGrup((v) => !v)}
                    className="mcu-dashboard-refresh"
                    title={`Tambah ${labelGrup} baru`}
                    style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Filter Status */}
            <select
              className="admin-filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              title="Filter Status"
              style={{ height: 32, fontSize: 12, padding: '0 24px 0 10px', borderRadius: 8 }}
            >
              <option value="semua">Semua Status</option>
              <option value="ada">Ada / Siap</option>
              <option value="rusak">Rusak</option>
              <option value="tidak_ada">Tidak Ada</option>
              <option value="tidak_diperlukan">Tidak Diperlukan</option>
            </select>

            {/* Refresh & Tambah Item */}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="mcu-dashboard-refresh"
              title="Muat ulang data"
              style={{ height: 32, fontSize: 12, borderRadius: 8, padding: '0 12px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setTambahItem((v) => !v)}
                className="mcu-dashboard-refresh"
                title="Tambah item katalog checklist"
                style={{ height: 32, fontSize: 12, borderRadius: 8, padding: '0 12px' }}
              >
                <Plus size={13} /> Tambah Item
              </button>
            )}
          </div>

          {/* Ringkasan Status di Sebelah Kanan */}
          <div className="kunjungan-total-right" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
            <span>
              Kesiapan{' '}
              <b style={{ color: ringkas.persen >= 90 ? '#00B894' : ringkas.persen >= 70 ? '#C99A00' : '#FF2D2D' }}>
                {ringkas.wajibAda}/{ringkas.wajibTotal || ringkas.total} ({ringkas.persen}%)
              </b>
            </span>
            <span>
              Rusak <b style={{ color: ringkas.rusak ? '#FF7A00' : 'inherit' }}>{ringkas.rusak}</b>
            </span>
            <span>
              Tidak ada <b style={{ color: ringkas.tidakAda ? '#FF2D2D' : 'inherit' }}>{ringkas.tidakAda}</b>
            </span>
            {ringkas.expiredCount > 0 && (
              <span>
                Kedaluwarsa <b style={{ color: '#FF2D2D' }}>{ringkas.expiredCount}</b>
              </span>
            )}

            {/* Tombol Pintas ke PICA jika ada temuan */}
            {ringkas.totalTemuan > 0 && onBukaPica && (
              <Button
                size="sm"
                variant="outline"
                onClick={onBukaPica}
                style={{
                  height: 28,
                  fontSize: 11.5,
                  padding: '0 10px',
                  borderRadius: 8,
                  borderColor: '#FF7A00',
                  color: '#FF7A00',
                  background: 'rgba(255,122,0,0.08)',
                  gap: 5,
                }}
                title="Buka Register PICA untuk menindaklanjuti temuan ini"
              >
                <ExternalLink size={12} /> {ringkas.totalTemuan} Temuan → PICA
              </Button>
            )}
          </div>
        </div>

        {/* Baris Status Kesiapan Khusus Ambulans */}
        {jenis === 'ambulans' && grup && (
          <div className="admin-form-card" style={{ padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--brand-primary, #ff4d00)' }}>Status Unit {grup}:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Kesiapan Operasional:</span>
                  <select
                    value={unitStatus[grup]?.kesiapan ?? 'ready'}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const baru = e.target.value;
                      const bbm = unitStatus[grup]?.bbm ?? null;
                      setUnitStatus((s) => ({ ...s, [grup]: { kesiapan: baru, bbm } }));
                      void simpanStatusUnit(grup, baru, bbm);
                    }}
                    style={{
                      height: 30,
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '0 24px 0 10px',
                      borderRadius: 999,
                      border: '1px solid var(--border)',
                      background: (unitStatus[grup]?.kesiapan ?? 'ready') === 'ready' ? 'rgba(0,184,148,0.15)' : (unitStatus[grup]?.kesiapan ?? 'ready') === 'breakdown' ? 'rgba(255,45,45,0.15)' : 'rgba(241,196,15,0.15)',
                      color: (unitStatus[grup]?.kesiapan ?? 'ready') === 'ready' ? '#00B894' : (unitStatus[grup]?.kesiapan ?? 'ready') === 'breakdown' ? '#FF2D2D' : '#C99A00',
                    }}
                  >
                    <option value="ready">Ready (Siap Operasi)</option>
                    <option value="standby">Standby with Note</option>
                    <option value="breakdown">Breakdown (Dalam Perbaikan)</option>
                  </select>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>BBM Tangki:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={unitStatus[grup]?.bbm ?? 80}
                    disabled={!isAdmin}
                    onBlur={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      const k = unitStatus[grup]?.kesiapan ?? 'ready';
                      setUnitStatus((s) => ({ ...s, [grup]: { kesiapan: k, bbm: v } }));
                      void simpanStatusUnit(grup, k, v);
                    }}
                    style={{ ...cellInput, width: 56, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 11, color: Number(unitStatus[grup]?.bbm ?? 80) < 75 ? '#FF2D2D' : 'var(--muted-foreground)' }}>
                    % (Standar &ge; 75%)
                  </span>
                </label>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                Kendaraan & perlengkapan evakuasi tanggap darurat
              </div>
            </div>
          </div>
        )}

        {/* Info Panduan Singkat */}
        <div style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--muted-foreground)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          <AlertTriangle size={13} />
          Perubahan langsung tersimpan per baris. {pengelompok && `Sedang memeriksa ${labelGrup}: ${grup}.`}
        </div>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, flexShrink: 0, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Modal Tambah Grup / Lokasi / Unit */}
        {tambahGrup && pengelompok && (
          <div className="admin-form-card" style={{ padding: '12px 16px', flexShrink: 0, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 3, height: 16, borderRadius: 2, background: '#00B894', display: 'inline-block', flexShrink: 0 }} />
              <h3 className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                Tambah {labelGrup} Baru
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Nama {labelGrup}
                </span>
                <Input
                  value={grupBaru}
                  onChange={(e) => setGrupBaru(e.target.value)}
                  placeholder={jenis === 'ambulans' ? 'mis. AMB-02' : 'mis. Ruang Lab / Batching Plant'}
                  className="h-9 w-64 rounded-lg text-sm"
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
                }}
                style={{ gap: 6, height: 36 }}
              >
                <Check size={14} /> Gunakan {labelGrup} Ini
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTambahGrup(false)} style={{ height: 36 }}>Batal</Button>
            </div>
          </div>
        )}

      {/* Modal Tambah Item Katalog */}
      {tambahItem && (
        <FormTambahItem
          jenis={jenis}
          kategoriOptions={kategoriMap}
          onSelesai={() => { setTambahItem(false); void load(); }}
        />
      )}

      {loading && !baris.length && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
          <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat checklist {judulChecklist}…
        </div>
      )}

        {/* ── KELOMPOK KARTU PER KATEGORI (POLA HEARING CONSERVATION / ERGONOMI) ── */}
        {[...perKategori.entries()].map(([kategori, list]) => {
          const siapCount = list.filter((i) => i.status === 'ada').length;
          const rusakCount = list.filter((i) => i.status === 'rusak').length;
          const tidakAdaCount = list.filter((i) => i.status === 'tidak_ada').length;

          return (
            <div key={kategori} className="admin-form-card" style={{ overflow: 'auto', marginBottom: 18, padding: '14px 18px' }}>
              {/* Header Kartu Kategori: Rata Kiri & Rapi */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--brand-primary, #ff4d00)', display: 'inline-block', flexShrink: 0 }} />
                  <h3 className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                    {kategoriMap[kategori] ?? kategori}
                  </h3>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                  <b style={{ color: '#00B894' }}>{siapCount}</b> siap · Total {list.length} item
                  {rusakCount > 0 && <span style={{ marginLeft: 8, color: '#FF7A00', fontWeight: 600 }}>({rusakCount} rusak)</span>}
                  {tidakAdaCount > 0 && <span style={{ marginLeft: 8, color: '#FF2D2D', fontWeight: 600 }}>({tidakAdaCount} tidak ada)</span>}
                </div>
              </div>

              {/* Tabel Detail Item */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={th}>Item Pemeriksaan</th>
                      <th style={{ ...th, width: 140 }}>Status</th>
                      <th style={{ ...th, width: 80, textAlign: 'center' }}>Jumlah</th>
                      <th style={{ ...th, width: 200 }}>Kondisi Detail</th>
                      <th style={{ ...th, width: 150 }}>Tanggal Inspeksi</th>
                      <th style={th}>Catatan / Tindak Lanjut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((b) => {
                      const kunci = `${b.grup}|${b.katalogId}`;
                      const sibuk = menyimpan === kunci;
                      const meta = STATUS_META[b.status];

                      return (
                        <tr key={kunci} style={{ opacity: sibuk ? 0.55 : 1 }}>
                          {/* 1. Item Nama & Standar */}
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 12.5 }}>{b.nama}</span>
                              {!b.wajib && (
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                                  opsional
                                </span>
                              )}
                              {b.satuan && (
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                                  ({b.satuan})
                                </span>
                              )}
                            </div>
                            {b.jumlahStandar !== null && (
                              <div style={{ fontSize: 11, color: '#1f5f9b', marginTop: 2, fontWeight: 500 }}>
                                Standar resmi: {b.jumlahStandar} {b.satuan ?? 'unit'}
                              </div>
                            )}
                          </td>

                          {/* 2. Status Badge Dropdown */}
                          <td style={td}>
                            <select
                              value={b.status}
                              disabled={!isAdmin || sibuk}
                              onChange={(e) => void simpan(b, { status: e.target.value as Status })}
                              style={{
                                height: 30,
                                fontSize: 11.5,
                                fontWeight: 700,
                                padding: '0 24px 0 10px',
                                borderRadius: 999,
                                border: `1px solid ${meta.warna}66`,
                                background: `${meta.warna}15`,
                                color: meta.warna,
                                cursor: 'pointer',
                                outline: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {(Object.keys(STATUS_META) as Status[]).map((s) => (
                                <option key={s} value={s}>{STATUS_META[s].label}</option>
                              ))}
                            </select>
                          </td>

                          {/* 3. Jumlah Input */}
                          <td style={td}>
                            <input
                              type="number"
                              min={0}
                              defaultValue={b.jumlah ?? ''}
                              disabled={!isAdmin || sibuk}
                              onBlur={(e) => {
                                const v = e.target.value === '' ? null : Number(e.target.value);
                                if (v !== b.jumlah) void simpan(b, { jumlah: v });
                              }}
                              style={{ ...cellInput, width: 64, textAlign: 'center' }}
                            />
                          </td>

                          {/* 4. Kondisi Detail */}
                          <td style={td}>
                            <input
                              defaultValue={b.kondisi}
                              disabled={!isAdmin || sibuk}
                              onBlur={(e) => {
                                if (e.target.value !== b.kondisi) void simpan(b, { kondisi: e.target.value });
                              }}
                              placeholder="mis. Baik / Rusak"
                              style={{ ...cellInput, width: '100%', minWidth: 150 }}
                            />
                          </td>

                          {/* 5. Tanggal Inspeksi */}
                          <td style={td}>
                            <input
                              type="date"
                              defaultValue={b.tanggalInspeksi ?? ''}
                              disabled={!isAdmin || sibuk}
                              onChange={(e) => void simpan(b, { tanggalInspeksi: e.target.value })}
                              style={{ ...cellInput, width: 140 }}
                              title="Tanggal Inspeksi"
                            />
                          </td>

                          {/* 6. Catatan */}
                          <td style={td}>
                            <input
                              defaultValue={b.catatan}
                              disabled={!isAdmin || sibuk}
                              onBlur={(e) => {
                                if (e.target.value !== b.catatan) void simpan(b, { catatan: e.target.value });
                              }}
                              placeholder="—"
                              style={{ ...cellInput, width: '100%', minWidth: 160 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {!loading && !baris.length && !error && (
          <div className="admin-form-card" style={{ padding: 28, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
            Belum ada katalog {judulChecklist.toLowerCase()} untuk site ini.
          </div>
        )}
      </div>
    </div>
  );
}

/** Form Menambah Item Katalog Checklist Baru */
function FormTambahItem({
  jenis,
  kategoriOptions,
  onSelesai,
}: {
  jenis: JenisChecklist;
  kategoriOptions: Record<string, string>;
  onSelesai: () => void;
}) {
  const store = useMCUStore();
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState(Object.keys(kategoriOptions)[0] ?? 'umum');
  const [satuan, setSatuan] = useState(jenis === 'p3k' ? 'buah' : 'unit');
  const [jumlahStandar, setJumlahStandar] = useState(1);
  const [wajib, setWajib] = useState(true);
  const [simpan, setSimpan] = useState(false);

  async function kirim() {
    if (!nama.trim()) return;
    setSimpan(true);
    try {
      await authFetch('/api/inspeksi/checklist', {
        method: 'PUT',
        body: JSON.stringify({
          jenis,
          nama: nama.trim(),
          kategori,
          satuan,
          jumlah_standar: jumlahStandar,
          wajib,
        }),
      });
      store.showToast('Item checklist berhasil ditambahkan ke katalog', 'success');
      onSelesai();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menambah item', 'error');
    } finally {
      setSimpan(false);
    }
  }

  return (
    <div className="admin-form-card" style={{ padding: '14px 18px', flexShrink: 0, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 3, height: 16, borderRadius: 2, background: '#00B894', display: 'inline-block', flexShrink: 0 }} />
        <h3 className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
          Tambah Item Checklist Baru
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3" style={{ marginBottom: 12 }}>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] font-semibold text-muted-foreground">Nama Item</span>
          <Input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis. Tabung Oksigen Cadangan 2m3"
            className="h-9 rounded-lg text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Kategori</span>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="h-9 rounded-lg border-input bg-background px-2 text-sm"
          >
            {Object.entries(kategoriOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={wajib} onChange={(e) => setWajib(e.target.checked)} /> Wajib Sesuai Standar
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="sm" onClick={onSelesai} style={{ height: 34 }}>Batal</Button>
        <Button size="sm" disabled={simpan || !nama.trim()} onClick={() => void kirim()} style={{ gap: 6, height: 34 }}>
          {simpan ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Item
        </Button>
      </div>
    </div>
  );
}
