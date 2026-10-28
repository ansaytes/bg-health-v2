'use client';

// ============================================================
// Dashboard > ProKawan — pelaporan AGREGAT
// ============================================================
//
// Dasar:
//  • INK/016 poin 4.6.4 — rekapitulasi ProKawan kepada manajemen disampaikan
//    secara AGREGAT, TANPA IDENTITAS KARYAWAN.
//  • INK/016 poin 4.7.3 huruf e — atasan hanya menerima status kelayakan kerja
//    dan pembatasan kerja, tanpa skor maupun diagnosis.
//  • STD/006 poin 7.2 — pelaporan rekapitulasi zonasi dalam bentuk agregat.
//  • UU 27/2022 — data kesehatan adalah data pribadi yang spesifik.
//
// Konsekuensi desain:
//  1. Dashboard ini TIDAK memakai /api/prokawan (yang memuat nama/NIK/WA).
//     Ia memakai /api/prokawan/dashboard yang HANYA mengirim angka agregat —
//     jadi membuka DevTools pun tidak membocorkan identitas siapa pun.
//  2. Tidak ada pencarian nama/NIK, tidak ada tombol WhatsApp. Tindakan
//     per-orang ada di Administrator > ProKawan (khusus QSHE Medic).
//  3. Tata letak dirancang untuk SATU layar penuh tanpa scroll: baris KPI
//     (ringkas) + baris kartu analisis dengan tinggi tetap.
//
// Tidak ada Chart.js di sini dengan sengaja: semua kartu berisi daftar
// peringkat pendek dengan label panjang, yang lebih terbaca sebagai batang HTML
// dan tidak menambah beban render.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, Loader2, RefreshCw } from 'lucide-react';

import { authFetch } from '@/lib/api-client';
import {
  JALUR_LABEL,
  STATUS_LABEL,
  STATUS_WARNA,
  type RingkasanAgregatProKawan,
  type StatusKepatuhan,
  type JalurProKawan,
} from '@/lib/prokawan';

export default function ProKawanDashboard() {
  const [ringkas, setRingkas] = useState<RingkasanAgregatProKawan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diperbarui, setDiperbarui] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await authFetch('/api/prokawan/dashboard');
      if (!r.success || !r.ringkasan) throw new Error('Ringkasan ProKawan tidak tersedia');
      setRingkas(r.ringkasan as RingkasanAgregatProKawan);
      setDiperbarui(r.dihitungPada ? new Date(r.dihitungPada as string).toLocaleString('id-ID') : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data ProKawan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !ringkas) {
    return (
      <div className="dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12 }}>
          <Loader2 size={16} className="animate-spin" /> Memuat rekapitulasi ProKawan…
        </div>
      </div>
    );
  }

  if (!ringkas) {
    return (
      <div className="dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 12 }}>
          {error || 'Data ProKawan tidak tersedia.'}
        </div>
      </div>
    );
  }

  const total = ringkas.total;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  return (
    <div
      className="dashboard"
      style={{
        // SATU HALAMAN TANPA SCROLL: baris KPI (auto) + baris kartu (flex 1).
        overflow: 'hidden',
        gap: 8,
      }}
    >
      {/* ── Baris 1: KPI ringkas ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, flexShrink: 0 }}>
        <Kpi label="Peserta ProKawan" nilai={total} keterangan="Zona Kuning + Merah" warna="#ff4d00" />
        <Kpi label="Zona Merah" nilai={ringkas.byZona.Merah} keterangan={`${pct(ringkas.byZona.Merah).toFixed(1)}% dari peserta`} warna="#FF2D2D" />
        <Kpi label="Zona Kuning" nilai={ringkas.byZona.Kuning} keterangan={`${pct(ringkas.byZona.Kuning).toFixed(1)}% dari peserta`} warna="#C99A00" />
        <Kpi
          label="Terlambat Kontrol"
          nilai={ringkas.jumlahPerluTindakLanjut}
          keterangan={ringkas.merahTerlambat ? `${ringkas.merahTerlambat} di antaranya Zona Merah` : 'tidak ada Zona Merah'}
          warna={ringkas.jumlahPerluTindakLanjut ? '#FF2D2D' : '#00B894'}
        />
        <Kpi
          label="Kepatuhan"
          nilai={`${ringkas.tingkatKepatuhan.toFixed(1)}%`}
          keterangan="sesuai jadwal / akan datang / selesai"
          warna="#00B894"
        />
        <Kpi
          label="Tanpa Jadwal"
          nilai={ringkas.jumlahBelumTerjadwal}
          keterangan="tanggal MCU belum tersedia"
          warna={ringkas.jumlahBelumTerjadwal ? '#FF7A00' : '#778899'}
        />
      </div>

      {error && (
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.08)', color: '#b3261e', fontSize: 11, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* ── Baris 2: Peringkat trigger + parameter ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 8, flex: 1.15, minHeight: 0 }}>
        <PeringkatTriggerZona
          data={ringkas.byParameter}
          total={total}
          judul="Peringkat Trigger Zona"
          keterangan="Parameter klinis pemicu zona (STD/006 Bab 7) — 9 teratas"
        />
        <PanelBatang
          judul="Frekuensi Kontrol"
          keterangan="Frekuensi yang berlaku per peserta — paling ketat antar parameternya"
          data={ringkas.byFrekuensi}
          total={total}
          labelKategori="Interval kontrol peserta"
          labelNilai="Jumlah peserta"
          warna={(label) => {
            if (label.startsWith('1')) return '#FF2D2D';
            if (label.startsWith('3')) return '#FFD400';
            if (label.startsWith('6')) return '#3498DB';
            return '#778899';
          }}
        />
        <PanelBatang
          judul="Status Kelayakan Kerja"
          keterangan="Satu-satunya status yang boleh dibagikan ke atasan (4.7.3e)"
          data={ringkas.byKelayakan}
          total={total}
          labelKategori="Status dari MCU (kes_vendor)"
          labelNilai="Jumlah peserta"
          warna={(_, i) => ['#00B894', '#3498DB', '#FF7A00', '#778899'][i % 4]}
        />
      </div>

      {/* ── Baris 3: jadwal, jalur, zona, site ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1.1fr)', gap: 8, flex: 1, minHeight: 0 }}>
        <PanelJadwal data={ringkas.byUmurJadwal} total={total} />
        <PanelBatang
          judul="Jalur Pengendalian"
          keterangan="INK/016 poin 4.2 — per parameter Pengendalian"
          data={(Object.keys(ringkas.byJalur) as JalurProKawan[]).map((k) => [JALUR_LABEL[k], ringkas.byJalur[k]])}
          total={total}
          labelKategori="Jalur ProKawan"
          labelNilai="Jumlah peserta"
          warna={(_, i) => ['#3498DB', '#2ECC71', '#F1C40F', '#9B59B6'][i % 4]}
          kosongkanNol
        />
        <PanelBatang
          judul="Komposisi Zona"
          keterangan="Kepesertaan murni dari zona (INK/016 4.1.1)"
          data={[['Zona Merah', ringkas.byZona.Merah], ['Zona Kuning', ringkas.byZona.Kuning]]}
          total={total}
          labelKategori="Zona risiko PTM"
          labelNilai="Jumlah peserta"
          warna={(label) => (label.includes('Merah') ? '#FF2D2D' : '#FFD400')}
        />
        <PanelBatang
          judul="Peserta per Site"
          keterangan="7 site dengan peserta terbanyak"
          data={ringkas.bySite.slice(0, 7)}
          total={total}
          labelKategori="Nama site"
          labelNilai="Jumlah peserta"
          warna={(_, i) => ['#3498DB', '#2ECC71', '#F1C40F', '#E67E22', '#9B59B6', '#1ABC9C', '#E74C3C', '#95A5A6', '#2980B9', '#8E44AD'][i % 10]}
        />
      </div>

      {/* ── Baris 4: status kepatuhan + catatan ──────────────── */}
      {/* paddingLeft 56px: tombol mengambang aplikasi (FAB) duduk di pojok
          kiri bawah dan sebelumnya menutupi kotak pertama kartu ini. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 8, flexShrink: 0, paddingLeft: 56 }}>
        <div className="card" style={{ padding: '8px 10px', minWidth: 0 }}>
          <div className="card-head" style={{ marginBottom: 5, flexShrink: 0 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: '#00B894', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Status Kepatuhan Kontrol</h2>
              <p style={{ fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Jadwal vs tanggal aktual periksa (diisi Paramedic Site)</p>
            </div>
          </div>
          {/* Grid 5 kolom sama lebar — sebelumnya flex-wrap membuat kotak
              terakhir turun dan terpotong karena tinggi kartu dipatok. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 5 }}>
            {(Object.keys(STATUS_LABEL) as StatusKepatuhan[]).map((k) => (
              <div
                key={k}
                style={{
                  minWidth: 0, padding: '4px 7px', borderRadius: 8,
                  background: `${STATUS_WARNA[k]}12`, border: `1px solid ${STATUS_WARNA[k]}33`,
                }}
                title={STATUS_LABEL[k]}
              >
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {STATUS_LABEL[k]}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: STATUS_WARNA[k], lineHeight: 1.2 }}>
                  {ringkas.byStatus[k]}
                  <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--muted-foreground)', marginLeft: 2 }}>
                    ({pct(ringkas.byStatus[k]).toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--muted-foreground)' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            <span>
              Rekapitulasi <b>agregat tanpa identitas karyawan</b> (BG/QSHE/INK/016 poin 4.6.4).
              Daftar per-orang, pengingat WhatsApp, dan evidence dokter ada di
              <b> Administrator › ProKawan</b> (akses QSHE Medic).
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9.5, color: 'var(--muted-foreground)' }}>
            <CalendarClock size={11} style={{ flexShrink: 0 }} />
            {diperbarui ? `Dihitung ${diperbarui}` : 'Periode mengikuti MCU terakhir per karyawan'}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="mcu-dashboard-refresh"
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Komponen
   ══════════════════════════════════════════════════════════════ */

function Kpi({ label, nilai, keterangan, warna }: {
  label: string;
  nilai: number | string;
  keterangan: string;
  warna: string;
}) {
  return (
    <div className="card" style={{ padding: '7px 10px', minWidth: 0, justifyContent: 'center' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: warna, lineHeight: 1.15 }}>{nilai}</div>
      <div style={{ fontSize: 8.5, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={keterangan}>
        {keterangan}
      </div>
    </div>
  );
}

/**
 * Peringkat Trigger Zona — daftar parameter pemicu terbanyak.
 *
 * Angka berasal dari kolom `trigger_zona` per record MCU terakhir. Label
 * dibersihkan dari sufiks zona dan detail nilai, sehingga yang tampil adalah
 * NAMA PARAMETER (mis. "Hypertension Grade I"), bukan kalimat panjang.
 */
function PeringkatTriggerZona({ data, total, judul, keterangan }: {
  data: [string, number][];
  total: number;
  judul: string;
  keterangan: string;
}) {
  const tampil = data.slice(0, 9);
  const maks = Math.max(...tampil.map(([, v]) => v), 1);
  const PALET = ['#FF2D2D', '#FF6B35', '#FF8C42', '#F1C40F', '#2ECC71', '#1ABC9C', '#3498DB', '#9B59B6', '#95A5A6'];

  return (
    <div className="card" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 10px' }}>
      <div className="card-head" style={{ flexShrink: 0, marginBottom: 4 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#FF2D2D', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 11.5 }}>{judul}</h2>
          <p style={{ fontSize: 9 }}>{keterangan}</p>
        </div>
      </div>

      {/* Nama sumbu nilai (X) — mengikuti pola PanelBatang. */}
      <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 4 }}>
        → Jumlah peserta yang terpicu
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'space-evenly' }}>
        {!tampil.length && (
          <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>
            Belum ada parameter pemicu tercatat.
          </p>
        )}
        {tampil.map(([label, nilai], i) => (
          <div key={label} style={{ flexShrink: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontSize: 9.5 }}>
              <span style={{
                flexShrink: 0, width: 14, height: 14, borderRadius: 4,
                background: `${PALET[i % PALET.length]}1f`, color: PALET[i % PALET.length],
                fontSize: 8, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
                {label}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 800 }}>
                {nilai}
                <span style={{ fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 8.5 }}>
                  {' '}peserta ({total ? ((nilai / total) * 100).toFixed(1) : '0'}%)
                </span>
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--muted)', marginTop: 2, marginLeft: 19, overflow: 'hidden' }}>
              <div
                style={{
                  // 92% agar batang terpanjang tidak menempel tepi kanan.
                  width: `${(nilai / maks) * 92}%`, height: '100%', borderRadius: 2,
                  background: PALET[i % PALET.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {data.length > tampil.length && (
        <div style={{ flexShrink: 0, fontSize: 8.5, color: 'var(--muted-foreground)', paddingTop: 2 }}>
          + {data.length - tampil.length} parameter lain
        </div>
      )}
    </div>
  );
}

/**
 * Kartu batang horizontal generik untuk satu dimensi agregat.
 *
 * SETIAP SUMBU WAJIB BERNAMA. Sebelumnya kartu ini hanya menampilkan deretan
 * batang dengan angka di ujungnya, tanpa keterangan sumbu kategori maupun sumbu
 * nilai — pembaca tidak bisa tahu "angka 417 itu apa". Sekarang:
 *   • sumbu kategori (Y)  → label parameter/kelompok + judul sumbu di kiri bawah
 *   • sumbu nilai    (X)  → judul "Jumlah peserta" + garis dasar 0
 */
function PanelBatang({ judul, keterangan, data, total, warna, kosongkanNol, labelKategori, labelNilai }: {
  judul: string;
  keterangan: string;
  data: [string, number][];
  total: number;
  warna: (label: string, index: number) => string;
  kosongkanNol?: boolean;
  /** Nama sumbu kategori (sumbu Y). */
  labelKategori: string;
  /** Nama sumbu nilai (sumbu X). */
  labelNilai: string;
}) {
  const baris = kosongkanNol ? data.filter(([, v]) => v > 0) : data;
  const maks = Math.max(...baris.map(([, v]) => v), 1);

  return (
    <div className="card" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 10px' }}>
      <div className="card-head" style={{ flexShrink: 0, marginBottom: 4 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#3498DB', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 11.5 }}>{judul}</h2>
          <p style={{ fontSize: 9 }}>{keterangan}</p>
        </div>
      </div>

      {/* Nama sumbu nilai (X) di atas, supaya angka batang punya konteks. */}
      <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 4 }}>
        → {labelNilai}
      </div>

      {/* TANPA RUANG KOSONG: baris mengisi tinggi kartu dengan `gap` yang
          disebar merata. `space-evenly` dipakai bersama `gap` agar jarak antar
          item tidak saling menimpa label (sebelumnya bar item berikutnya naik
          menutupi teks label item di atasnya). */}
      {/* `justifyContent: space-between` (bukan space-evenly) + gap 3px: ruang
          dipakai merata tanpa menambah tinggi total, sehingga 7–9 baris tetap
          muat di kartu setinggi ~150px tanpa meluber ke label sumbu bawah. */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'space-evenly' }}>
        {!baris.length && (
          <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: 0 }}>Belum ada data.</p>
        )}
        {baris.map(([label, nilai], i) => (
          <div key={label} style={{ flexShrink: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9.5, marginBottom: 1, lineHeight: 1.15 }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
                {label}
              </span>
              <span style={{ fontWeight: 800, flexShrink: 0 }}>
                {nilai}
                <span style={{ fontWeight: 500, color: 'var(--muted-foreground)', fontSize: 8.5 }}>
                  {' '}peserta ({total ? ((nilai / total) * 100).toFixed(1) : '0'}%)
                </span>
              </span>
            </div>
            {/* Skala maksimum 92%, bukan 100%: batang terpanjang menyisakan
                ruang agar tidak menempel/menimpa tepi kanan kartu. */}
            <div style={{ height: 5, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden' }}>
              <div style={{ width: `${(nilai / maks) * 92}%`, height: '100%', borderRadius: 3, background: warna(label, i) }} />
            </div>
          </div>
        ))}
      </div>

      {/* Nama sumbu kategori (Y) di bawah. */}
      <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 2, marginTop: 2 }}>
        ↑ {labelKategori}
      </div>
    </div>
  );
}

/** Kartu status jadwal kontrol: sudah lewat, mendesak, dan jauh. */
function PanelJadwal({ data, total }: {
  data: RingkasanAgregatProKawan['byUmurJadwal'];
  total: number;
}) {
  const item: { label: string; nilai: number; warna: string; ket: string }[] = [
    { label: 'Lewat >30 hari', nilai: data.lewatBerat, warna: '#FF2D2D', ket: 'prioritas' },
    { label: 'Lewat <=30 hari', nilai: data.lewatRingan, warna: '#FF7A00', ket: 'menyusul' },
    { label: 'Segera (<=14 hari)', nilai: data.segera, warna: '#3498DB', ket: 'diingatkan' },
    { label: 'Terjadwal', nilai: data.jauh, warna: '#00B894', ket: 'aman' },
    { label: 'Tanpa jadwal', nilai: data.tanpaJadwal, warna: '#778899', ket: 'data kurang' },
  ];

  return (
    <div className="card" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 10px' }}>
      <div className="card-head" style={{ flexShrink: 0, marginBottom: 4 }}>
        <span style={{ width: 3, height: 18, borderRadius: 2, background: '#FF7A00', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 11.5 }}>Status Jadwal Kontrol</h2>
          <p style={{ fontSize: 9 }}>Jatuh tempo = tgl MCU + frekuensi parameter</p>
        </div>
      </div>
      {/* Nama sumbu nilai (X) — konsisten dengan PanelBatang. */}
      <div style={{ flexShrink: 0, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', paddingBottom: 2, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span>↑ Rentang jatuh tempo</span>
        <span>→ Jumlah peserta</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
        {item.map((it) => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: it.warna, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 9.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label}
            </span>
            <span style={{ fontSize: 8, color: 'var(--muted-foreground)', flexShrink: 0 }}>{it.ket}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: it.warna, minWidth: 56, textAlign: 'right', flexShrink: 0 }}>
              {it.nilai}
              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--muted-foreground)', marginLeft: 2 }}>
                peserta ({total ? `${((it.nilai / total) * 100).toFixed(0)}%` : '0%'})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
