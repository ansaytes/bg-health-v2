'use client';

// ============================================================
// Administrator > ProKawan
// ============================================================
// Daftar peserta ProKawan (Zona Kuning/Merah) beserta panel DETAIL per peserta:
//   - Identitas (nama, NIK, site, departemen, jabatan)
//   - Zona PTM + parameter pemicu + kolom Pengendalian (per parameter STD/006,
//     bukan general per zonasi)
//   - Jadwal tanggal kontrol, tanggal aktual periksa
//   - Evidence dari dokter pemeriksa (link dokumen / resume)
//   - Hasil kontrol → dasar penilaian kepatuhan peserta
//   - Tombol kirim WhatsApp per peserta
//
// Data kunjungan diambil dari `kunjungan_kontrol` (migration 20261025);
// bila jadwal belum ada di tabel, jadwal dihitung dari MCU terakhir + frekuensi
// jalur (sama seperti dashboard ProKawan).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarClock, Calculator, CheckCircle2, ExternalLink,
  Loader2, RefreshCw, Search, Save, UserRound, XCircle, MessageCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import { PARAMETER_KONTROL } from '@/lib/prokawan-evaluasi';
import {
  JALUR_DESKRIPSI,
  JALUR_LABEL,
  STATUS_LABEL,
  STATUS_WARNA,
  type PesertaProKawan,
} from '@/lib/prokawan';

interface KunjunganRow {
  id: string;
  nik_hash: string;
  site: string | null;
  department: string | null;
  jabatan: string | null;
  zona_risiko: string | null;
  jadwal_tanggal: string | null;
  aktual_tanggal: string | null;
  evidence_url: string | null;
  catatan: string | null;
  hasil: 'MEMBAIK' | 'STABIL' | 'MEMBURUK' | 'BELUM' | null;
  no_wa: string | null;
  wa_sent_at: string | null;
}

const HASIL_LABEL: Record<string, string> = {
  MEMBAIK: 'Membaik', STABIL: 'Stabil', MEMBURUK: 'Memburuk', BELUM: 'Belum diperiksa',
};
const HASIL_WARNA: Record<string, string> = {
  MEMBAIK: '#00B894', STABIL: '#3498DB', MEMBURUK: '#FF2D2D', BELUM: '#778899',
};

function fmtTanggal(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Normalisasi nomor WA Indonesia ke format internasional tanpa tanda plus. */
function nomorWa(raw: string | null | undefined): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

/**
 * Pesan pengingat kontrol ProKawan (format permintaan):
 * "Salam, menginformasikan bahwa karyawan a/n … terjadwal untuk melakukan
 * kontrol rutin pada tanggal …"
 */
export function pesanWaProKawan(p: PesertaProKawan, tanggalKontrol: string | null): string {
  const tanggal = fmtTanggal(tanggalKontrol ?? p.jatuhTempo);
  return [
    'Salam,',
    '',
    `Menginformasikan bahwa karyawan a/n ${p.nama} (NIK ${p.nik}${p.site ? `, ${p.site}` : ''}) `
    + `terjadwal untuk melakukan kontrol rutin ProKawan pada tanggal ${tanggal}.`,
    '',
    'Demikian informasi ini kami sampaikan. Mohon hadir sesuai jadwal dan membawa bukti kontrol.',
    'Terima kasih.',
  ].join('\n');
}

/** Buka WhatsApp (aplikasi/web) dengan nomor & pesan terisi. */
function bukaWhatsApp(noWa: string | null | undefined, pesan: string) {
  const nomor = nomorWa(noWa);
  const url = nomor
    ? `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`
    : `https://wa.me/?text=${encodeURIComponent(pesan)}`;
  window.open(url, '_blank', 'noopener');
}

export default function AdminProKawan() {
  const store = useMCUStore();
  const [peserta, setPeserta] = useState<PesertaProKawan[]>([]);
  const [kunjungan, setKunjungan] = useState<KunjunganRow[]>([]);
  const [tabelSiap, setTabelSiap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterZona, setFilterZona] = useState<'semua' | 'Kuning' | 'Merah'>('semua');
  const [filterSite, setFilterSite] = useState('semua');
  const [selectedNik, setSelectedNik] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Hasil usulan jadwal (GET) — belum menulis apa pun sampai dikonfirmasi.
  const [jadwalUsulan, setJadwalUsulan] = useState<{
    diusulkan: number; tanpaJadwal: number; sudahAda: number;
  } | null>(null);
  const [jadwalLoading, setJadwalLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, k] = await Promise.all([
        authFetch('/api/prokawan'),
        authFetch('/api/prokawan/kunjungan').catch(() => ({ data: [], tabelSiap: true })),
      ]);
      const list = Array.isArray(p.data) ? (p.data as PesertaProKawan[]) : [];
      setPeserta(list);
      setKunjungan(Array.isArray(k.data) ? (k.data as KunjunganRow[]) : []);
      setTabelSiap(k.tabelSiap !== false);
      setSelectedNik((prev) => prev ?? list[0]?.nik ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data ProKawan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sites = useMemo(
    () => [...new Set(peserta.map((p) => p.site).filter(Boolean))].sort(),
    [peserta],
  );

  const filtered = useMemo(() => peserta.filter((p) => {
    if (filterZona !== 'semua' && p.zona !== filterZona) return false;
    if (filterSite !== 'semua' && p.site !== filterSite) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${p.nama} ${p.nik} ${p.department ?? ''} ${p.site}`.toLowerCase().includes(term);
  }), [peserta, filterZona, filterSite, search]);

  const selected = useMemo(
    () => filtered.find((p) => p.nik === selectedNik) ?? filtered[0] ?? null,
    [filtered, selectedNik],
  );

  const kunjunganPeserta = useMemo(() => {
    if (!selected) return [] as KunjunganRow[];
    return kunjungan
      .filter((k) => (selected.nikHash ? k.nik_hash === selected.nikHash : false))
      .sort((a, b) => String(b.jadwal_tanggal ?? '').localeCompare(String(a.jadwal_tanggal ?? '')));
  }, [kunjungan, selected]);

  const kontrolTerakhir = kunjunganPeserta[0] ?? null;
  const jadwalBerlaku = kontrolTerakhir?.jadwal_tanggal ?? selected?.jatuhTempo ?? null;

  const kepatuhan = useMemo(() => {
    if (!selected) return null;
    if (kontrolTerakhir?.aktual_tanggal) {
      const tepat = !kontrolTerakhir.jadwal_tanggal
        || kontrolTerakhir.aktual_tanggal <= kontrolTerakhir.jadwal_tanggal;
      return {
        label: tepat ? 'Patuh — kontrol tepat waktu' : 'Terlambat — kontrol melewati jadwal',
        warna: tepat ? '#00B894' : '#FF2D2D',
        icon: tepat ? 'patuh' : 'lambat',
      };
    }
    if (selected.status === 'terlambat') {
      return { label: 'Tidak patuh — lewat jatuh tempo, belum ada bukti periksa', warna: '#FF2D2D', icon: 'lambat' };
    }
    if (selected.status === 'belum-kontrol') {
      return { label: 'Belum kontrol', warna: '#FF2D2D', icon: 'lambat' };
    }
    return { label: 'Menunggu jadwal kontrol', warna: STATUS_WARNA[selected.status], icon: 'tunggu' };
  }, [selected, kontrolTerakhir]);

  async function simpanKunjungan(patch: Partial<KunjunganRow> & { jadwal_tanggal: string }) {
    if (!selected) return;
    setSaving(true);
    try {
      await authFetch('/api/prokawan/kunjungan', {
        method: 'POST',
        body: JSON.stringify({
          id: kontrolTerakhir?.id,
          nik: selected.nik,
          nama: selected.nama,
          site: selected.site,
          department: selected.department,
          jabatan: null,
          zona_risiko: selected.zona,
          no_wa: selected.noWa ?? null,
          ...patch,
        }),
      });
      store.showToast('Data kontrol tersimpan', 'success');
      await load();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan data kontrol', 'error');
    } finally {
      setSaving(false);
    }
  }

  /**
   * Menghitung usulan jadwal kontrol (tidak menulis).
   * Nama fungsi ini sengaja "tinjau", bukan "tetapkan": INK/016 poin 4.1.4
   * menempatkan kewenangan penetapan pada QSHE Medic, bukan pada sistem.
   */
  async function tinjauJadwal() {
    setJadwalLoading(true);
    try {
      const r = await authFetch('/api/prokawan/jadwal');
      setJadwalUsulan({
        diusulkan: Number(r.diusulkan ?? 0),
        tanpaJadwal: Number(r.tanpaJadwal ?? 0),
        sudahAda: Number(r.sudahAda ?? 0),
      });
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menghitung usulan jadwal', 'error');
    } finally {
      setJadwalLoading(false);
    }
  }

  /** Menulis jadwal usulan ke kunjungan_kontrol setelah dikonfirmasi QSHE Medic. */
  async function tulisJadwal() {
    if (!jadwalUsulan) return;
    const setuju = confirm(
      `Tetapkan ${jadwalUsulan.diusulkan} jadwal kontrol ProKawan?\n\n`
      + 'Dasar: tanggal pemeriksaan terakhir + frekuensi kolom Pengendalian Bab 7.\n'
      + 'Jadwal yang sudah ada tidak diubah.',
    );
    if (!setuju) return;

    setJadwalLoading(true);
    try {
      const r = await authFetch('/api/prokawan/jadwal?mode=konfirmasi', { method: 'POST' });
      store.showToast(`${Number(r.ditulis ?? 0)} jadwal kontrol ditetapkan`, 'success');
      setJadwalUsulan(null);
      await load();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menetapkan jadwal', 'error');
    } finally {
      setJadwalLoading(false);
    }
  }

  async function kirimWa() {
    if (!selected) return;
    bukaWhatsApp(selected.noWa ?? kontrolTerakhir?.no_wa, pesanWaProKawan(selected, jadwalBerlaku));
    // Catat waktu pengiriman agar riwayat pengingat terlihat.
    if (kontrolTerakhir) {
      try {
        await authFetch('/api/prokawan/kunjungan', {
          method: 'POST',
          body: JSON.stringify({
            id: kontrolTerakhir.id,
            nik: selected.nik,
            nama: selected.nama,
            site: selected.site,
            department: selected.department,
            zona_risiko: selected.zona,
            jadwal_tanggal: kontrolTerakhir.jadwal_tanggal,
            wa_sent_at: new Date().toISOString(),
          }),
        });
        void load();
      } catch {
        // Pengiriman WA tetap berjalan walau pencatatan gagal.
      }
    }
  }

  return (
    <div className="dashboard" style={{ overflowY: 'hidden', overflowX: 'hidden' }}>
      {/* Toolbar */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <select className="admin-filter-select" value={filterZona} onChange={(e) => setFilterZona(e.target.value as typeof filterZona)}>
            <option value="semua">Semua Zona</option>
            <option value="Kuning">Zona Kuning</option>
            <option value="Merah">Zona Merah</option>
          </select>
          <select className="admin-filter-select" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
            <option value="semua">Semua Site</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)' }}>
            <Search size={13} color="var(--muted-foreground)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / NIK / departemen"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11, color: 'var(--foreground)', width: 190 }}
            />
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {/* Penetapan jadwal: QSHE Medic MENETAPKAN & memberitahukan jadwal
              kontrol pertama (INK/016 poin 4.1.4). Tanggalnya diusulkan sistem
              dari tanggal MCU + frekuensi Bab 7, lalu diperiksa di sini sebelum
              ditulis ke kunjungan_kontrol. */}
          <button
            type="button"
            onClick={() => void tinjauJadwal()}
            disabled={jadwalLoading}
            className="mcu-dashboard-refresh"
            title="Hitung usulan tanggal kontrol dari tgl MCU + frekuensi parameter"
          >
            {jadwalLoading ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
            Usulan Jadwal
          </button>
          {jadwalUsulan && (
            <button
              type="button"
              onClick={() => void tulisJadwal()}
              disabled={jadwalLoading}
              className="mcu-dashboard-refresh"
              style={{ background: 'rgba(0,184,148,0.12)', borderColor: 'rgba(0,184,148,0.4)', color: '#00806a' }}
            >
              {jadwalLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Tetapkan {jadwalUsulan.diusulkan} Jadwal
            </button>
          )}
        </div>
        <div className="kunjungan-total-right">
          <span>Peserta <b>{filtered.length}</b></span>
          <span>Kuning <b style={{ color: '#C99A00' }}>{filtered.filter((p) => p.zona === 'Kuning').length}</b></span>
          <span>Merah <b style={{ color: '#FF2D2D' }}>{filtered.filter((p) => p.zona === 'Merah').length}</b></span>
        </div>
      </div>

      {/* Ringkasan hasil usulan jadwal */}
      {jadwalUsulan && (
        <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '7px 12px', borderRadius: 8, background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.28)', fontSize: 10.5 }}>
          <b style={{ color: '#2471A3' }}>Usulan jadwal kontrol:</b>
          <span>{jadwalUsulan.diusulkan} dapat dijadwalkan otomatis</span>
          <span>· {jadwalUsulan.tanpaJadwal} tanpa jadwal kontrol dokter</span>
          <span>· {jadwalUsulan.sudahAda} sudah tertetapkan</span>
          <span style={{ color: 'var(--muted-foreground)' }}>
            Dasar: tgl pemeriksaan terakhir + frekuensi kolom Pengendalian Bab 7 (INK/016 poin 4.1.4)
          </span>
          <button
            type="button"
            onClick={() => setJadwalUsulan(null)}
            style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 10.5, color: 'var(--muted-foreground)' }}
          >
            Tutup
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11.5, flexShrink: 0 }}>
          {error}
        </div>
      )}
      {!tabelSiap && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 11.5, flexShrink: 0 }}>
          Tabel <b>kunjungan_kontrol</b> belum dibuat — jadwal kontrol masih dihitung dari MCU terakhir. Jalankan migration
          <code style={{ marginLeft: 4 }}>20261025_prokawan_kunjungan.sql</code>.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)', gap: 8 }}>
        {/* Daftar peserta */}
        <div className="card" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 6px' }}>
          <div className="card-head" style={{ flexShrink: 0, paddingBottom: 4 }}>
            <span style={{ width: 3, height: 20, borderRadius: 2, background: '#ff4d00', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 12 }}>Daftar Peserta</h2>
              <p style={{ fontSize: 9.5 }}>Zona Kuning &amp; Merah — INK/016 poin 4.1.1</p>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
                <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat peserta…
              </div>
            )}
            {!loading && !filtered.length && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
                Tidak ada peserta pada filter ini.
              </div>
            )}
            {filtered.map((p) => {
              const aktif = selected?.nik === p.nik;
              return (
                <button
                  key={p.nik}
                  type="button"
                  onClick={() => setSelectedNik(p.nik)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '7px 9px', marginBottom: 2, borderRadius: 8, border: 'none',
                    background: aktif ? 'rgba(255,77,0,0.10)' : 'transparent',
                    boxShadow: aktif ? 'inset 2px 0 0 #ff4d00' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.nama}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, flexShrink: 0,
                      background: p.zona === 'Merah' ? 'rgba(255,45,45,0.12)' : 'rgba(255,212,0,0.18)',
                      color: p.zona === 'Merah' ? '#FF2D2D' : '#9a6b00',
                    }}>{p.zona}</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 1 }}>
                    {p.nik} · {p.site}
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: STATUS_WARNA[p.status], marginTop: 1 }}>
                    {STATUS_LABEL[p.status]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail peserta */}
        <div style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
          {loading && (
            <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12 }}>
              <Loader2 className="size-4 animate-spin" /> Memuat detail peserta ProKawan…
            </div>
          )}

          {!selected && !loading && (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
              {peserta.length
                ? 'Pilih peserta di daftar kiri untuk melihat detail ProKawan.'
                : 'Belum ada karyawan pada Zona Kuning atau Zona Merah.'}
            </div>
          )}

          {selected && (
            <>
              {/* Identitas + aksi */}
              <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,77,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserRound size={18} color="#ff4d00" />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{selected.nama}</h2>
                    <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                      NIK {selected.nik} · {selected.site || '—'} · {selected.department ?? 'Departemen tidak tercatat'}
                      {selected.area ? ` · ${selected.area}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Button
                      size="sm"
                      onClick={() => void kirimWa()}
                      style={{ background: '#25D366', color: '#fff', gap: 5 }}
                      title="Kirim pesan pengingat kontrol via WhatsApp"
                    >
                      <MessageCircle size={13} /> Kirim WA
                    </Button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 10 }}>
                  <Info label="Zona PTM" value={selected.zona} warna={selected.zona === 'Merah' ? '#FF2D2D' : '#C99A00'} />
                  <Info label="Jalur Pengendalian" value={JALUR_LABEL[selected.jalur]} />
                  <Info label="Frekuensi" value={selected.bulan === null ? 'Tanpa kontrol berkala' : `Setiap ${selected.bulan} bulan`} />
                  <Info label="Jadwal Kontrol" value={fmtTanggal(jadwalBerlaku)} />
                  <Info label="Aktual Periksa" value={fmtTanggal(kontrolTerakhir?.aktual_tanggal)} />
                  <Info label="No. WhatsApp" value={selected.noWa ?? kontrolTerakhir?.no_wa ?? 'Belum tercatat'} />
                </div>
                <div
                  title={kepatuhan?.label}
                  style={{
                    marginTop: 10, padding: '7px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7,
                    fontSize: 11, fontWeight: 700,
                    background: `${kepatuhan?.warna ?? '#778899'}14`,
                    color: kepatuhan?.warna ?? '#778899',
                    border: `1px solid ${kepatuhan?.warna ?? '#778899'}33`,
                  }}
                >
                  {kepatuhan?.icon === 'patuh' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  Kepatuhan: {kepatuhan?.label ?? '—'}
                </div>
              </div>

              {/* Parameter & pengendalian */}
              <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
                <div className="card-head" style={{ marginBottom: 6 }}>
                  <span style={{ width: 3, height: 18, borderRadius: 2, background: '#8E44AD', flexShrink: 0 }} />
                  <div>
                    <h2 style={{ fontSize: 12 }}>Zona PTM &amp; Pengendalian</h2>
                    <p style={{ fontSize: 9.5 }}>Per parameter — bukan general per zonasi (STD/006 Rev.002)</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                  {selected.triggers.length
                    ? selected.triggers.map((t) => (
                      <span key={t} style={{
                        fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: selected.zona === 'Merah' ? 'rgba(255,45,45,0.10)' : 'rgba(255,212,0,0.16)',
                        color: selected.zona === 'Merah' ? '#FF2D2D' : '#9a6b00',
                      }}>{t}</span>
                    ))
                    : <span style={{ fontSize: 10.5, color: 'var(--muted-foreground)' }}>Parameter pemicu tidak tercatat.</span>}
                </div>
                <div style={{ fontSize: 10.5, whiteSpace: 'pre-line', lineHeight: 1.55, color: 'var(--foreground)' }}>
                  {selected.pengendalian ?? 'Kolom pengendalian belum terisi pada record MCU terakhir.'}
                </div>
                <p style={{ fontSize: 9.5, color: 'var(--muted-foreground)', margin: '8px 0 0' }}>
                  {JALUR_DESKRIPSI[selected.jalur]}
                </p>
              </div>

              {/* Form jadwal & evidence */}
              <KontrolForm
                key={`${selected.nik}-${kontrolTerakhir?.id ?? 'baru'}`}
                peserta={selected}
                row={kontrolTerakhir}
                defaultJadwal={jadwalBerlaku}
                saving={saving}
                onSave={simpanKunjungan}
              />

              {/* Riwayat kontrol */}
              <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
                <div className="card-head" style={{ marginBottom: 6 }}>
                  <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
                  <div>
                    <h2 style={{ fontSize: 12 }}>Riwayat Kontrol</h2>
                    <p style={{ fontSize: 9.5 }}>{kunjunganPeserta.length} kunjungan tercatat</p>
                  </div>
                </div>
                {!kunjunganPeserta.length ? (
                  <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>
                    Belum ada kunjungan kontrol tercatat untuk peserta ini.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={TH}>Jadwal</th>
                          <th style={TH}>Aktual Periksa</th>
                          <th style={TH}>Hasil</th>
                          <th style={TH}>Evidence</th>
                          <th style={TH}>Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kunjunganPeserta.map((k) => {
                          const telat = !!k.aktual_tanggal && !!k.jadwal_tanggal && k.aktual_tanggal > k.jadwal_tanggal;
                          return (
                            <tr key={k.id}>
                              <td style={TD}>{fmtTanggal(k.jadwal_tanggal)}</td>
                              <td style={{ ...TD, color: telat ? '#FF7A00' : undefined, fontWeight: 700 }}>
                                {fmtTanggal(k.aktual_tanggal)}
                                {telat && <span style={{ fontSize: 9, marginLeft: 4 }}>(terlambat)</span>}
                              </td>
                              <td style={TD}>
                                {k.hasil
                                  ? <span style={{ fontSize: 9.5, fontWeight: 800, color: HASIL_WARNA[k.hasil] }}>{HASIL_LABEL[k.hasil]}</span>
                                  : '—'}
                              </td>
                              <td style={TD}>
                                {k.evidence_url
                                  ? <a href={k.evidence_url} target="_blank" rel="noopener noreferrer" style={{ color: '#ff4d00', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <ExternalLink size={11} /> Lihat
                                  </a>
                                  : '—'}
                              </td>
                              <td style={{ ...TD, maxWidth: 220 }}>{k.catatan ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Form nilai kontrol → evaluasi zona otomatis.
                  Inilah yang membuat "kontrol" bermakna: nilai parameter dari
                  Faskes Rekanan diolah engine STANDAR PTM, bukan sekadar
                  dicap tanggal (INK/016 poin 4.4.5 & 4.6.1). */}
              <FormEvaluasiKontrol
                key={`eval-${selected.nik}-${kontrolTerakhir?.id ?? 'baru'}`}
                peserta={selected}
                onSelesai={() => void load()}
              />

              {/* Jejak audit: setiap peralihan zona, sumbernya, dan dasarnya. */}
              <RiwayatZona nik={selected.nik} versi={kontrolTerakhir?.id ?? 'baru'} />

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px 12px', fontSize: 9.5, color: 'var(--muted-foreground)' }}>
                <AlertTriangle size={11} />
                Kepatuhan dinilai dari ada/tidaknya tanggal aktual periksa dalam bukti dokter pemeriksa. Diagnosis tidak ditampilkan (INK/016 poin 4.7.3 huruf e).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 9,
  textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)',
  fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 10.5 };

function Info({ label, value, warna }: { label: string; value: string; warna?: string }) {
  return (
    <div style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--muted)', minWidth: 0 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: warna ?? 'var(--foreground)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
    </div>
  );
}

function KontrolForm({ peserta, row, defaultJadwal, saving, onSave }: {
  peserta: PesertaProKawan;
  row: KunjunganRow | null;
  defaultJadwal: string | null;
  saving: boolean;
  onSave: (patch: Partial<KunjunganRow> & { jadwal_tanggal: string }) => void;
}) {
  const [jadwal, setJadwal] = useState((row?.jadwal_tanggal ?? defaultJadwal ?? '').slice(0, 10));
  const [aktual, setAktual] = useState((row?.aktual_tanggal ?? '').slice(0, 10));
  const [evidence, setEvidence] = useState(row?.evidence_url ?? '');
  const [catatan, setCatatan] = useState(row?.catatan ?? '');
  const [hasil, setHasil] = useState<'MEMBAIK' | 'STABIL' | 'MEMBURUK' | 'BELUM'>(row?.hasil ?? 'BELUM');

  const label = 'text-[10px] font-semibold text-muted-foreground';

  return (
    <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#00B894', flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 12 }}>Jadwal &amp; Evidence Kontrol</h2>
          <p style={{ fontSize: 9.5 }}>Diisi Paramedic Site setelah peserta kembali dari kontrol</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="flex flex-col gap-1">
          <span className={label}>Jadwal tanggal kontrol</span>
          <Input type="date" value={jadwal} onChange={(e) => setJadwal(e.target.value)} className="h-9 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Aktual tanggal periksa</span>
          <Input type="date" value={aktual} onChange={(e) => setAktual(e.target.value)} className="h-9 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Hasil kontrol</span>
          <select value={hasil} onChange={(e) => setHasil(e.target.value as 'MEMBAIK' | 'STABIL' | 'MEMBURUK' | 'BELUM')} className="h-9 rounded-lg border-input bg-background px-2 text-sm">
            {Object.entries(HASIL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Evidence dokter (link)</span>
          <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://… surat/resume dokter" className="h-9 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className={label}>Catatan dokter / paramedis</span>
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Ringkasan hasil pemeriksaan, saran kontrol berikutnya" className="h-9 rounded-lg text-sm" />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
        <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <CalendarClock size={11} /> Jatuh tempo dari jalur: {JALUR_LABEL[peserta.jalur]}
        </span>
        <Button
          size="sm"
          disabled={saving || !jadwal}
          onClick={() => onSave({
            jadwal_tanggal: jadwal,
            aktual_tanggal: aktual || null,
            evidence_url: evidence || null,
            catatan: catatan || null,
            hasil: (hasil ?? 'BELUM') as KunjunganRow['hasil'],
          })}
          style={{ gap: 5 }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Simpan kontrol
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Form nilai kontrol + evaluasi zona otomatis
   ══════════════════════════════════════════════════════════════ */

/**
 * Form input NILAI PARAMETER hasil kontrol dari Fasilitas Kesehatan Rekanan.
 *
 * DASAR DOKUMEN (INK/016):
 *  • 4.4.5 — hasil pemeriksaan Faskes Rekanan menjadi bahan evaluasi dan
 *    pembaruan Zona Risiko PTM.
 *  • 4.6.1 — QSHE Medic mengevaluasi hasil dan memperbarui zona.
 *  • 4.6.2 / 4.6.3 — tetap Kuning/Merah ⇒ lanjut ProKawan; menjadi Hijau ⇒
 *    dihentikan kepesertaannya (dengan pemantauan MCU rutin).
 *
 * Perilaku:
 *  1. Nilai diisi dari hasil lab/pemeriksaan kontrol — tidak semua parameter
 *     wajib; yang tidak diukur memakai nilai acuan sebelumnya agar zona tidak
 *     berubah hanya karena data kosong.
 *  2. Tombol "Hitung Zona" menjalankan engine STANDAR PTM yang SAMA dengan MCU.
 *  3. Hasil evaluasi menampilkan zona sebelum → sesudah, arah (membaik/
 *     memburuk/tetap), dan tren per parameter.
 *  4. "Simpan & Perbarui Zona" menulis hasil ke kunjungan_kontrol (riwayat
 *     permanen + baseline) DAN memperbarui zona peserta.
 */
function FormEvaluasiKontrol({ peserta, onSelesai }: {
  peserta: PesertaProKawan;
  onSelesai: () => void;
}) {
  const store = useMCUStore();
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [evidence, setEvidence] = useState('');
  const [catatan, setCatatan] = useState('');
  const [menghitung, setMenghitung] = useState(false);
  const [hasil, setHasil] = useState<{
    zonaBaru: string; arah: string; zonaSebelumnya: string | null;
    frekuensiEvaluasi: string; triggers: string[];
    parameterBerubah: { key: string; label: string; sebelum: string | null; sekarang: string | null; tren: string }[];
    parameterKosong: string[];
  } | null>(null);

  const terisi = PARAMETER_KONTROL.filter((p) => String(nilai[p.key] ?? '').trim() !== '');

  function nilaiAngka(): Record<string, number | string> {
    const out: Record<string, number | string> = {};
    for (const p of terisi) {
      const raw = String(nilai[p.key]).replace(',', '.').trim();
      const n = Number(raw);
      // Visus disimpan sebagai teks (6/9), sisanya angka.
      out[p.key] = Number.isFinite(n) && /^[\d.,]+$/.test(raw) ? n : raw;
    }
    return out;
  }

  async function hitung(terapkanZona: boolean) {
    if (!terisi.length) {
      store.showToast('Isi minimal satu nilai parameter hasil kontrol', 'error');
      return;
    }
    setMenghitung(true);
    try {
      const r = await authFetch('/api/prokawan/evaluasi', {
        method: 'POST',
        body: JSON.stringify({
          nik: peserta.nik,
          aktual_tanggal: tanggal,
          nilai: nilaiAngka(),
          evidence_url: evidence || null,
          catatan: catatan || null,
          terapkanZona,
        }),
      });
      setHasil(r.evaluasi as typeof hasil);
      store.showToast(
        terapkanZona ? String(r.pesan ?? 'Zona diperbarui') : 'Zona dihitung — tinjau hasilnya',
        'success',
      );
      if (terapkanZona) { setNilai({}); onSelesai(); }
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal mengevaluasi hasil kontrol', 'error');
    } finally {
      setMenghitung(false);
    }
  }

  const TREN_WARNA: Record<string, string> = {
    membaik: '#00B894', memburuk: '#FF2D2D', tetap: '#778899', baru: '#3498DB',
  };
  const TREN_LABEL: Record<string, string> = {
    membaik: 'membaik', memburuk: 'memburuk', tetap: 'tetap', baru: 'pengukuran pertama',
  };
  const kelompok = [
    { id: 'vital', judul: 'Vital & Antropometri' },
    { id: 'lab', judul: 'Laboratorium' },
    { id: 'fungsi', judul: 'Fungsi & Skrining' },
  ] as const;

  return (
    <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#ff4d00', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 12 }}>Nilai Hasil Kontrol → Evaluasi Zona</h2>
          <p style={{ fontSize: 9.5 }}>
            Isi nilai dari Fasilitas Kesehatan Rekanan. Zona dihitung engine STANDAR PTM yang sama dengan MCU
            (INK/016 4.4.5 &amp; 4.6.1) — tidak semua parameter wajib.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginBottom: 8 }}>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Tanggal aktual periksa</span>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-muted-foreground">Evidence dokter / hasil lab (link)</span>
          <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://… surat kontrol / resume dokter" className="h-8 rounded-lg text-sm" />
        </label>
      </div>

      {kelompok.map((k) => (
        <div key={k.id} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: 4 }}>
            {k.judul}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
            {PARAMETER_KONTROL.filter((p) => p.kelompok === k.id).map((p) => (
              <label key={p.key} className="flex flex-col gap-0.5" title={`${p.label} (${p.unit})`}>
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.label} <span style={{ opacity: 0.7 }}>{p.unit}</span>
                </span>
                <Input
                  value={nilai[p.key] ?? ''}
                  onChange={(e) => setNilai((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  inputMode={p.key === 'visusJauh' ? 'text' : 'decimal'}
                  placeholder="—"
                  className="h-8 rounded-lg text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      <label className="flex flex-col gap-1" style={{ marginBottom: 8 }}>
        <span className="text-[10px] font-semibold text-muted-foreground">Catatan dokter / paramedis</span>
        <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Ringkasan kontrol, saran kontrol berikutnya" className="h-8 rounded-lg text-sm" />
      </label>

      {/* Hasil evaluasi */}
      {hasil && (
        <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, border: `1px solid ${TREN_WARNA[hasil.arah] ?? '#778899'}44`, background: `${TREN_WARNA[hasil.arah] ?? '#778899'}0f` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            <b>Zona: {hasil.zonaSebelumnya ?? '—'} &rarr; {hasil.zonaBaru}</b>
            <span style={{ fontWeight: 800, color: TREN_WARNA[hasil.arah] ?? '#778899' }}>
              ({TREN_LABEL[hasil.arah] ?? hasil.arah})
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>Frekuensi berikutnya: {hasil.frekuensiEvaluasi}</span>
          </div>
          <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '3px 12px', fontSize: 9.5 }}>
            {hasil.parameterBerubah.map((p) => (
              <span key={p.key} style={{ color: TREN_WARNA[p.tren] }}>
                {p.label}: <b>{p.sebelum ?? '—'} &rarr; {p.sekarang ?? '—'}</b> ({TREN_LABEL[p.tren]})
              </span>
            ))}
          </div>
          {hasil.parameterKosong.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 9, color: 'var(--muted-foreground)' }}>
              Tidak diukur: {hasil.parameterKosong.slice(0, 8).join(', ')}
              {hasil.parameterKosong.length > 8 ? ` +${hasil.parameterKosong.length - 8}` : ''}
              {' '}— memakai nilai acuan sebelumnya.
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span style={{ marginRight: 'auto', fontSize: 9.5, color: 'var(--muted-foreground)', alignSelf: 'center' }}>
          {terisi.length} parameter terisi
        </span>
        <Button size="sm" variant="outline" disabled={menghitung} onClick={() => void hitung(false)} style={{ gap: 5 }}>
          {menghitung ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />}
          Hitung Zona
        </Button>
        <Button size="sm" disabled={menghitung || !hasil} onClick={() => void hitung(true)} style={{ gap: 5 }}>
          {menghitung ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Simpan &amp; Perbarui Zona
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Riwayat perubahan zona (audit trail)
   ══════════════════════════════════════════════════════════════ */

interface BarisHistoriZona {
  id: string;
  created_at: string;
  sumber: 'kontrol' | 'mcu' | 'manual';
  zona_lama: string | null;
  zona_baru: string;
  tanggal_acuan: string | null;
  catatan: string | null;
  diubah_oleh: string | null;
}

const SUMBER_LABEL: Record<string, string> = {
  kontrol: 'Hasil kontrol',
  mcu: 'MCU',
  manual: 'Manual',
};

/**
 * Riwayat perubahan Zona Risiko PTM.
 *
 * Zona pada `mcu_records` memang ditimpa saat diperbarui dari hasil kontrol.
 * Kartu ini membaca `zona_histori` (append-only) sehingga nilai sebelum &
 * sesudah setiap perubahan tetap dapat dilihat — inilah catatan historinya.
 */
function RiwayatZona({ nik, versi }: { nik: string; versi: string }) {
  const [baris, setBaris] = useState<BarisHistoriZona[]>([]);
  const [tersedia, setTersedia] = useState(true);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await authFetch(`/api/prokawan/evaluasi?nik=${encodeURIComponent(nik)}`);
      setBaris(Array.isArray(r.historiZona) ? (r.historiZona as BarisHistoriZona[]) : []);
      setTersedia(r.historiZonaTersedia !== false);
    } catch {
      setBaris([]);
    } finally {
      setMemuat(false);
    }
  }, [nik]);

  useEffect(() => { void muat(); }, [muat, versi]);

  const warna = (z: string | null) => (z === 'Merah' ? '#FF2D2D' : z === 'Kuning' ? '#C99A00' : z === 'Hijau' ? '#00B894' : '#778899');

  return (
    <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
      <div className="card-head" style={{ marginBottom: 6 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#8E44AD', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 12 }}>Riwayat Perubahan Zona</h2>
          <p style={{ fontSize: 9.5 }}>
            Jejak audit — zona pada record MCU ditimpa setiap pembaruan, riwayatnya disimpan di sini
          </p>
        </div>
      </div>

      {!tersedia && (
        <p style={{ fontSize: 10, color: '#9a6b00', margin: 0 }}>
          Tabel <b>zona_histori</b> belum ada. Jalankan migration
          <code style={{ marginLeft: 3 }}>20261028_prokawan_nilai_kontrol.sql</code>.
        </p>
      )}

      {memuat && (
        <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>
          <Loader2 className="size-3 animate-spin inline mr-1" /> Memuat riwayat…
        </p>
      )}

      {!memuat && tersedia && !baris.length && (
        <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>
          Belum ada perubahan zona tercatat.
        </p>
      )}

      {!memuat && baris.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Waktu</th>
                <th style={TH}>Sumber</th>
                <th style={TH}>Zona</th>
                <th style={TH}>Tgl acuan</th>
                <th style={TH}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((h) => (
                <tr key={h.id}>
                  <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>
                    {new Date(h.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={TD}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
                      background: h.sumber === 'kontrol' ? 'rgba(52,152,219,0.12)' : 'rgba(119,136,153,0.14)',
                      color: h.sumber === 'kontrol' ? '#2471A3' : '#5a6b7b',
                    }}>
                      {SUMBER_LABEL[h.sumber] ?? h.sumber}
                    </span>
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 700 }}>
                    <span style={{ color: warna(h.zona_lama) }}>{h.zona_lama ?? '—'}</span>
                    <span style={{ margin: '0 4px', color: 'var(--muted-foreground)' }}>&rarr;</span>
                    <span style={{ color: warna(h.zona_baru) }}>{h.zona_baru}</span>
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{fmtTanggal(h.tanggal_acuan)}</td>
                  <td style={{ ...TD, maxWidth: 220, color: 'var(--muted-foreground)' }}>{h.catatan ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
