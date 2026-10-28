'use client';

// ============================================================
// Administrator > Monitoring Karyawan Sakit (BG/QSHE/SOP/027 Rev.002)
// ============================================================
//
// HUBUNGAN DENGAN KELAYAKAN KERJA MCU
//  • `mcu_records.kes_vendor` = kesimpulan vendor MCU. SAH, tidak diubah.
//  • Modul ini = penilaian ulang QSHE Medic atas kondisi aktual karyawan sakit,
//    berbasis SKS / Surat Pernyataan Mandiri / asesmen, diterbitkan via FORM/123.
//  Dua jalur berbeda yang berdampingan — bukan saling menimpa. Karena itu
//  dashboard menampilkan keduanya agar tidak tertukar.
//
// FOKUS UTAMA: memantau JADWAL EVALUASI/KONSULTASI. Setiap episode punya
// fase (SOP/027 poin 6.5) dan jadwal kontak berikutnya; yang terlambat
// ditandai merah agar langsung terlihat.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Loader2,
  Phone, Plus, RefreshCw, Search, ShieldAlert,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import {
  FASE, JENIS_SAKIT_LABEL, MEDIA_LABEL, STATUS_KELAYAKAN_LABEL, STATUS_KELAYAKAN_WARNA,
} from '@/lib/karyawan-sakit';

interface Episode {
  id: string;
  nik: string | null;
  nama: string | null;
  site: string | null;
  department: string | null;
  jabatan: string | null;
  noWa: string | null;
  tanggalMulaiSakit: string;
  tanggalSksPertama: string | null;
  diagnosisAwal: string | null;
  dokterFaskes: string | null;
  sumberLaporan: string | null;
  jenisSakit: string | null;
  status: string;
  tanggalKembaliKerja: string | null;
  catatan: string | null;
  hariKe: number;
  fase: string | null;
  faseLabel: string | null;
  kewajiban: string[];
  jumlahPemantauan: number;
  kontakTerakhir: string | null;
  jedaTerpanjang: number;
  jadwalBerikutnya: string | null;
  jadwalAlasan: string | null;
  sisaHari: number | null;
  terlambat: boolean;
  rekomendasiTerakhir: Record<string, unknown> | null;
  jumlahRekomendasi: number;
  syaratUnfit: { boleh: boolean; belumTerpenuhi: string[] };
}

interface Ringkasan {
  total: number; aktif: number; terlambat: number; berkepanjangan: number;
  perFase: Record<string, number>;
  perJenis: Record<string, number>;
}

const fmt = (v: string | null | undefined) =>
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MonitoringKaryawanSakit() {
  const store = useMCUStore();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabelSiap, setTabelSiap] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('AKTIF');
  const [filterFase, setFilterFase] = useState('semua');
  const [selected, setSelected] = useState<string | null>(null);
  const [membuat, setMembuat] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch('/api/karyawan-sakit?status=semua');
      setEpisodes((r.data ?? []) as Episode[]);
      setRingkasan((r.ringkasan ?? null) as Ringkasan | null);
      setTabelSiap(r.tabelSiap !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data karyawan sakit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => episodes.filter((e) => {
    if (filterStatus !== 'semua' && e.status !== filterStatus) return false;
    if (filterFase !== 'semua' && e.fase !== filterFase) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${e.nama ?? ''} ${e.nik ?? ''} ${e.department ?? ''} ${e.site ?? ''}`.toLowerCase().includes(term);
  }), [episodes, filterStatus, filterFase, search]);

  const aktifTerpilih = filtered.find((e) => e.id === selected) ?? filtered[0] ?? null;

  return (
    <div className="dashboard" style={{ overflowY: 'hidden', overflowX: 'hidden' }}>
      {/* Toolbar */}
      <div className="kunjungan-top-bar" style={{ flexShrink: 0 }}>
        <div className="kunjungan-filter-bar">
          <select className="admin-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="AKTIF">Sedang sakit</option>
            <option value="semua">Semua status</option>
            <option value="FIT">Fit</option>
            <option value="FIT_WITH_NOTE">Fit with Note</option>
            <option value="UNFIT">Unfit</option>
          </select>
          <select className="admin-filter-select" value={filterFase} onChange={(e) => setFilterFase(e.target.value)}>
            <option value="semua">Semua fase</option>
            {FASE.map((f) => <option key={f.fase} value={f.fase}>{f.label}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)' }}>
            <Search size={13} color="var(--muted-foreground)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / NIK / departemen"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11, color: 'var(--foreground)', width: 180 }}
            />
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => setMembuat((v) => !v)} className="mcu-dashboard-refresh">
            <Plus size={13} /> Episode Baru
          </button>
        </div>
        {ringkasan && (
          <div className="kunjungan-total-right">
            <span>Sedang sakit <b>{ringkasan.aktif}</b></span>
            <span>Terlambat <b style={{ color: ringkasan.terlambat ? '#FF2D2D' : 'inherit' }}>{ringkasan.terlambat}</b></span>
            <span>Berkepanjangan <b style={{ color: ringkasan.berkepanjangan ? '#FF7A00' : 'inherit' }}>{ringkasan.berkepanjangan}</b></span>
          </div>
        )}
      </div>

      {!tabelSiap && (
        <div style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00', fontSize: 10.5 }}>
          Tabel modul ini belum dibuat. Jalankan migration
          <code style={{ marginLeft: 3 }}>20261028_karyawan_sakit.sql</code>.
        </div>
      )}

      {error && (
        <div style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 10.5 }}>
          {error}
        </div>
      )}

      {membuat && <FormEpisodeBaru onSelesai={() => { setMembuat(false); void load(); }} />}

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)', gap: 8 }}>
        {/* Daftar episode */}
        <div className="card" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 6px' }}>
          <div className="card-head" style={{ flexShrink: 0, paddingBottom: 4 }}>
            <span style={{ width: 3, height: 18, borderRadius: 2, background: '#E63946', flexShrink: 0 }} />
            <div>
              <h2 style={{ fontSize: 12 }}>Daftar Episode</h2>
              <p style={{ fontSize: 9 }}>{filtered.length} episode · SOP/027</p>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
                <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat…
              </div>
            )}
            {!loading && !filtered.length && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
                Tidak ada episode pada filter ini.
              </div>
            )}
            {filtered.map((e) => {
              const aktif = aktifTerpilih?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(e.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '7px 9px', marginBottom: 2, borderRadius: 8, border: 'none',
                    background: aktif ? 'rgba(230,57,70,0.09)' : 'transparent',
                    boxShadow: aktif ? 'inset 2px 0 0 #E63946' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.nama ?? e.nik ?? '(tanpa nama)'}
                    </span>
                    {e.terlambat && <AlertTriangle size={11} color="#FF2D2D" />}
                    <span style={{
                      fontSize: 8.5, fontWeight: 800, padding: '1px 5px', borderRadius: 999, flexShrink: 0,
                      background: e.status === 'AKTIF' ? 'rgba(255,122,0,0.14)' : 'rgba(0,184,148,0.12)',
                      color: e.status === 'AKTIF' ? '#B35C00' : '#00806a',
                    }}>
                      {e.status === 'AKTIF' ? `Hari ${e.hariKe}` : STATUS_KELAYAKAN_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginTop: 1 }}>
                    {e.faseLabel ?? '—'} · {e.site ?? '—'}
                  </div>
                  <div style={{ fontSize: 9.5, marginTop: 1, fontWeight: 700, color: e.terlambat ? '#FF2D2D' : 'var(--muted-foreground)' }}>
                    {e.status === 'AKTIF'
                      ? (e.jadwalBerikutnya
                        ? `Jadwal: ${fmt(e.jadwalBerikutnya)}${e.sisaHari !== null ? ` (${e.sisaHari < 0 ? `lewat ${Math.abs(e.sisaHari)} hr` : `${e.sisaHari} hr lagi`})` : ''}`
                        : 'Jadwal belum dihitung')
                      : e.tanggalKembaliKerja ? `Kembali kerja: ${fmt(e.tanggalKembaliKerja)}` : 'Selesai'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail episode */}
        <div style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
          {!aktifTerpilih && !loading && (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
              {episodes.length ? 'Pilih episode di daftar kiri.' : 'Belum ada episode karyawan sakit.'}
            </div>
          )}

          {aktifTerpilih && (
            <DetailEpisode
              key={aktifTerpilih.id}
              episode={aktifTerpilih}
              onBerubah={() => void load()}
              toast={(m, t) => store.showToast(m, t ?? 'info')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Detail + pemantauan + rekomendasi
   ══════════════════════════════════════════════════════════════ */

function DetailEpisode({ episode, onBerubah, toast }: {
  episode: Episode;
  onBerubah: () => void;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [pemantauan, setPemantauan] = useState<Record<string, unknown>[]>([]);
  const [rekomendasi, setRekomendasi] = useState<Record<string, unknown>[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  // Form kontak
  const [tglKontak, setTglKontak] = useState(new Date().toISOString().slice(0, 10));
  const [media, setMedia] = useState('TELEPON');
  const [perkembangan, setPerkembangan] = useState('STABIL');
  const [keluhan, setKeluhan] = useState('');
  const [tatalaksana, setTatalaksana] = useState('');

  // Form rekomendasi
  const [tglPenilaian, setTglPenilaian] = useState(new Date().toISOString().slice(0, 10));
  const [statusKelayakan, setStatusKelayakan] = useState('CURRENTLY_UNFIT');
  const [diagnosis, setDiagnosis] = useState('');
  const [prognosis, setPrognosis] = useState('');
  const [batasan, setBatasan] = useState('');
  const [tglKembali, setTglKembali] = useState('');
  const [tolakUnfit, setTolakUnfit] = useState<string[]>([]);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await authFetch(`/api/karyawan-sakit/pemantauan?episodeId=${episode.id}`);
      setPemantauan((r.pemantauan ?? []) as Record<string, unknown>[]);
      setRekomendasi((r.rekomendasi ?? []) as Record<string, unknown>[]);
    } catch {
      setPemantauan([]);
    } finally {
      setMemuat(false);
    }
  }, [episode.id]);

  useEffect(() => { void muat(); }, [muat]);

  async function catatKontak() {
    setMenyimpan(true);
    try {
      await authFetch('/api/karyawan-sakit/pemantauan?jenis=pemantauan', {
        method: 'POST',
        body: JSON.stringify({
          episodeId: episode.id, tanggal: tglKontak, media, perkembangan,
          keluhan, tatalaksana: tatalaksana,
        }),
      });
      toast('Kontak pemantauan tercatat', 'success');
      setKeluhan(''); setTatalaksana('');
      await muat(); onBerubah();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
    } finally {
      setMenyimpan(false);
    }
  }

  async function terbitkanRekomendasi() {
    setMenyimpan(true);
    setTolakUnfit([]);
    try {
      await authFetch('/api/karyawan-sakit/pemantauan?jenis=rekomendasi', {
        method: 'POST',
        body: JSON.stringify({
          episodeId: episode.id,
          tanggalPenilaian: tglPenilaian,
          statusKelayakan,
          diagnosisTerkini: diagnosis,
          prognosis,
          catatanBatasan: batasan,
          tanggalMulaiKembaliKerja: tglKembali || null,
          responsTatalaksana: 'STABIL',
        }),
      });
      toast('Rekomendasi (FORM/123) diterbitkan', 'success');
      await muat(); onBerubah();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal menerbitkan rekomendasi';
      // 422 = syarat Unfit belum terpenuhi; detail dikirim di pesan.
      setTolakUnfit(msg.split('\n').filter(Boolean));
      toast(msg, 'error');
    } finally {
      setMenyimpan(false);
    }
  }

  const kartu: React.CSSProperties = { padding: '10px 12px', flexShrink: 0 };

  return (
    <>
      {/* Identitas + fase */}
      <div className="card" style={kartu}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{episode.nama ?? '—'}</h2>
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
              NIK {episode.nik ?? '—'} · {episode.site ?? '—'} · {episode.department ?? 'Departemen tidak tercatat'}
            </p>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
            background: episode.terlambat ? 'rgba(255,45,45,0.12)' : 'rgba(52,152,219,0.12)',
            color: episode.terlambat ? '#FF2D2D' : '#2471A3',
          }}>
            Hari ke-{episode.hariKe} · {episode.faseLabel ?? '—'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 10 }}>
          <Info label="Mulai sakit" value={fmt(episode.tanggalMulaiSakit)} />
          <Info label="SKS pertama" value={fmt(episode.tanggalSksPertama)} />
          <Info label="Diagnosis awal" value={episode.diagnosisAwal ?? '—'} />
          <Info label="Faskes pemeriksa" value={episode.dokterFaskes ?? '—'} />
          <Info label="Jenis sakit" value={episode.jenisSakit ? JENIS_SAKIT_LABEL[episode.jenisSakit] ?? episode.jenisSakit : '—'} />
          <Info label="Kontak terakhir" value={fmt(episode.kontakTerakhir)} />
        </div>

        {/* Jadwal — fokus utama modul ini */}
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          background: episode.terlambat ? 'rgba(255,45,45,0.08)' : 'rgba(0,184,148,0.08)',
          border: `1px solid ${episode.terlambat ? 'rgba(255,45,45,0.3)' : 'rgba(0,184,148,0.3)'}`,
        }}>
          <CalendarClock size={14} color={episode.terlambat ? '#FF2D2D' : '#00806a'} />
          <span style={{ fontSize: 11, fontWeight: 700, color: episode.terlambat ? '#FF2D2D' : '#00806a' }}>
            {episode.status !== 'AKTIF'
              ? 'Episode selesai — tidak ada jadwal pemantauan'
              : episode.jadwalBerikutnya
                ? `Jadwal evaluasi berikutnya: ${fmt(episode.jadwalBerikutnya)}${episode.sisaHari !== null
                  ? ` — ${episode.sisaHari < 0 ? `TERLAMBAT ${Math.abs(episode.sisaHari)} hari` : `${episode.sisaHari} hari lagi`}`
                  : ''}`
                : 'Jadwal belum dihitung'}
          </span>
          {episode.jadwalAlasan && (
            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>({episode.jadwalAlasan})</span>
          )}
        </div>

        {/* Kewajiban fase */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', marginBottom: 3 }}>
            Kewajiban {episode.faseLabel} (SOP/027 6.5)
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: 'var(--foreground)', lineHeight: 1.55 }}>
            {episode.kewajiban.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </div>
      </div>

      {/* Catat kontak */}
      <div className="card" style={kartu}>
        <div className="card-head" style={{ marginBottom: 8 }}>
          <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontSize: 12 }}>Catat Kontak Pemantauan</h2>
            <p style={{ fontSize: 9.5 }}>FORM/101 bagian C — dicatat setiap sesi kontak</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Tanggal kontak</span>
            <Input type="date" value={tglKontak} onChange={(e) => setTglKontak(e.target.value)} className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Media</span>
            <select value={media} onChange={(e) => setMedia(e.target.value)} className="h-8 rounded-lg border-input bg-background px-2 text-sm">
              {Object.entries(MEDIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Perkembangan</span>
            <select value={perkembangan} onChange={(e) => setPerkembangan(e.target.value)} className="h-8 rounded-lg border-input bg-background px-2 text-sm">
              <option value="MEMBAIK">Membaik</option>
              <option value="STABIL">Stabil</option>
              <option value="MEMBURUK">Memburuk</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Tatalaksana / keterangan</span>
            <Input value={tatalaksana} onChange={(e) => setTatalaksana(e.target.value)} placeholder="singkat" className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-4">
            <span className="text-[10px] font-semibold text-muted-foreground">Keluhan / kondisi terkini</span>
            <Input value={keluhan} onChange={(e) => setKeluhan(e.target.value)} placeholder="Ringkasan kondisi, mobilitas, aktivitas harian" className="h-8 rounded-lg text-sm" />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button size="sm" disabled={menyimpan} onClick={() => void catatKontak()} style={{ gap: 5 }}>
            {menyimpan ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />} Simpan Kontak
          </Button>
        </div>
      </div>

      {/* Riwayat pemantauan */}
      <div className="card" style={kartu}>
        <div className="card-head" style={{ marginBottom: 6 }}>
          <span style={{ width: 3, height: 18, borderRadius: 2, background: '#2ECC71', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontSize: 12 }}>Riwayat Pemantauan</h2>
            <p style={{ fontSize: 9.5 }}>
              {pemantauan.length} kontak · jeda terpanjang {episode.jedaTerpanjang} hari
              {episode.jedaTerpanjang > 30 && <span style={{ color: '#FF7A00' }}> — melebihi interval fase</span>}
            </p>
          </div>
        </div>
        {memuat ? (
          <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>
            <Loader2 className="size-3 animate-spin inline mr-1" /> Memuat…
          </p>
        ) : !pemantauan.length ? (
          <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>Belum ada kontak tercatat.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Tanggal</th>
                  <th style={TH}>Media</th>
                  <th style={TH}>Perkembangan</th>
                  <th style={TH}>Keluhan</th>
                  <th style={TH}>Tatalaksana</th>
                </tr>
              </thead>
              <tbody>
                {pemantauan.map((p) => {
                  const warna = p.perkembangan === 'MEMBAIK' ? '#00B894' : p.perkembangan === 'MEMBURUK' ? '#FF2D2D' : '#778899';
                  return (
                    <tr key={String(p.id)}>
                      <td style={TD}>{fmt(String(p.tanggal ?? ''))}</td>
                      <td style={TD}>{MEDIA_LABEL[String(p.media ?? '')] ?? p.media ?? '—'}</td>
                      <td style={{ ...TD, color: warna, fontWeight: 700 }}>{String(p.perkembangan ?? '—')}</td>
                      <td style={{ ...TD, maxWidth: 200 }}>{String(p.keluhan ?? '—')}</td>
                      <td style={{ ...TD, maxWidth: 160 }}>{String(p.tatalaksana ?? '—')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM/123 */}
      <div className="card" style={kartu}>
        <div className="card-head" style={{ marginBottom: 8 }}>
          <span style={{ width: 3, height: 18, borderRadius: 2, background: '#E63946', flexShrink: 0 }} />
          <div>
            <h2 style={{ fontSize: 12 }}>Surat Rekomendasi Karyawan Sakit (FORM/123)</h2>
            <p style={{ fontSize: 9.5 }}>
              Penilaian ulang QSHE Medic — TERPISAH dari kesimpulan vendor MCU
            </p>
          </div>
        </div>

        {rekomendasi.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Tanggal</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Diagnosis</th>
                  <th style={TH}>Kembali kerja</th>
                </tr>
              </thead>
              <tbody>
                {rekomendasi.map((r) => {
                  const s = String(r.status_kelayakan ?? '');
                  return (
                    <tr key={String(r.id)}>
                      <td style={TD}>{fmt(String(r.tanggal_penilaian ?? ''))}</td>
                      <td style={{ ...TD, fontWeight: 800, color: STATUS_KELAYAKAN_WARNA[s] ?? '#778899' }}>
                        {STATUS_KELAYAKAN_LABEL[s] ?? s}
                      </td>
                      <td style={{ ...TD, maxWidth: 180 }}>{String(r.diagnosis_terkini ?? '—')}</td>
                      <td style={TD}>{fmt(String(r.tanggal_mulai_kembali_kerja ?? ''))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Tanggal penilaian</span>
            <Input type="date" value={tglPenilaian} onChange={(e) => setTglPenilaian(e.target.value)} className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Status kelayakan</span>
            <select value={statusKelayakan} onChange={(e) => setStatusKelayakan(e.target.value)} className="h-8 rounded-lg border-input bg-background px-2 text-sm">
              {Object.entries(STATUS_KELAYAKAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Mulai kembali kerja</span>
            <Input type="date" value={tglKembali} onChange={(e) => setTglKembali(e.target.value)} className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Prognosis</span>
            <Input value={prognosis} onChange={(e) => setPrognosis(e.target.value)} placeholder="singkat" className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-semibold text-muted-foreground">Diagnosis terkini</span>
            <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-semibold text-muted-foreground">Catatan / batasan medis (Fit with Note)</span>
            <Input value={batasan} onChange={(e) => setBatasan(e.target.value)} placeholder="mis. tidak mengangkat >15 kg selama 1 bulan" className="h-8 rounded-lg text-sm" />
          </label>
        </div>

        {/* Syarat Unfit ditampilkan lebih dulu agar QSHE Medic tahu sebelum menekan */}
        {statusKelayakan === 'UNFIT' && (
          <div style={{
            marginTop: 8, padding: '7px 10px', borderRadius: 8,
            background: episode.syaratUnfit.boleh ? 'rgba(0,184,148,0.08)' : 'rgba(255,122,0,0.08)',
            border: `1px solid ${episode.syaratUnfit.boleh ? 'rgba(0,184,148,0.35)' : 'rgba(255,122,0,0.35)'}`,
            fontSize: 10, lineHeight: 1.5,
          }}>
            {episode.syaratUnfit.boleh ? (
              <span style={{ color: '#00806a', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={12} /> Syarat penerbitan Unfit terpenuhi (SOP/027 6.5.5)
              </span>
            ) : (
              <>
                <span style={{ color: '#9a6b00', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                  <ShieldAlert size={12} /> Syarat Unfit belum terpenuhi (SOP/027 6.5.5)
                </span>
                <ul style={{ margin: '3px 0 0', paddingLeft: 18 }}>
                  {episode.syaratUnfit.belumTerpenuhi.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {tolakUnfit.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#b3261e' }}>
            {tolakUnfit.map((t) => <div key={t}>{t}</div>)}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button size="sm" disabled={menyimpan} onClick={() => void terbitkanRekomendasi()} style={{ gap: 5 }}>
            {menyimpan ? <Loader2 size={13} className="animate-spin" /> : <ClipboardList size={13} />} Terbitkan Rekomendasi
          </Button>
        </div>
      </div>
    </>
  );
}

const TH: React.CSSProperties = {
  padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 9,
  textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)',
  fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '5px 7px', borderBottom: '1px solid var(--border)', fontSize: 10.5 };

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '5px 8px', borderRadius: 8, background: 'var(--muted)', minWidth: 0 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>
        {value}
      </div>
    </div>
  );
}

/** Form episode baru — tanggal mulai sakit wajib (SOP/027 poin 6.6.1). */
function FormEpisodeBaru({ onSelesai }: { onSelesai: () => void }) {
  const store = useMCUStore();
  const [nik, setNik] = useState('');
  const [nama, setNama] = useState('');
  const [site, setSite] = useState('Head Office');
  const [department, setDepartment] = useState('');
  const [mulai, setMulai] = useState(new Date().toISOString().slice(0, 10));
  const [sks, setSks] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [faskes, setFaskes] = useState('');
  const [jenis, setJenis] = useState('BERKEPANJANGAN');
  const [simpan, setSimpan] = useState(false);

  async function kirim() {
    if (!nik.trim() || !mulai) return;
    setSimpan(true);
    try {
      await authFetch('/api/karyawan-sakit', {
        method: 'POST',
        body: JSON.stringify({
          nik: nik.trim(), nama, site, department,
          tanggalMulaiSakit: mulai,
          tanggalSksPertama: sks || null,
          diagnosisAwal: diagnosis, dokterFaskes: faskes,
          jenisSakit: jenis, sumberLaporan: 'SKS', status: 'AKTIF',
        }),
      });
      store.showToast('Episode karyawan sakit dicatat', 'success');
      onSelesai();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
    } finally {
      setSimpan(false);
    }
  }

  return (
    <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#ff4d00', flexShrink: 0 }} />
        <div>
          <h2 style={{ fontSize: 12 }}>Episode Sakit Baru</h2>
          <p style={{ fontSize: 9.5 }}>Tanggal mulai sakit = dasar perhitungan fase & hari sakit (SOP/027 6.6.1)</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">NIK karyawan</span>
          <Input value={nik} onChange={(e) => setNik(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-muted-foreground">Nama</span>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Jenis sakit</span>
          <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="h-8 rounded-lg border-input bg-background px-2 text-sm">
            {Object.entries(JENIS_SAKIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Site</span>
          <Input value={site} onChange={(e) => setSite(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Departemen</span>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Mulai sakit</span>
          <Input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground">SKS pertama</span>
          <Input type="date" value={sks} onChange={(e) => setSks(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-muted-foreground">Diagnosis awal (SKS)</span>
          <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-muted-foreground">Dokter / faskes pemeriksa</span>
          <Input value={faskes} onChange={(e) => setFaskes(e.target.value)} className="h-8 rounded-lg text-sm" />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
        <Button variant="outline" size="sm" onClick={onSelesai}>Batal</Button>
        <Button size="sm" disabled={simpan || !nik.trim()} onClick={() => void kirim()} style={{ gap: 5 }}>
          {simpan ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Simpan Episode
        </Button>
      </div>
    </div>
  );
}
