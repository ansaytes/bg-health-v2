'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import { useMCUStore } from '@/lib/store';
import type { KelompokField } from '@/lib/followup-fields';
import { formatSuratKontrolAbnormal } from '@/lib/surat-kontrol-format';

export interface PesertaTindakLanjut {
  nik: string;
  nama: string;
  site: string | null;
  department?: string | null;
}

/**
 * Form TINDAK LANJUT — wadah tunggal hasil follow up, dipakai dari halaman
 * ProKawan (peserta zona Kuning/Merah) dan Monitoring MCU (semua orang dengan
 * temuan abnormal, termasuk zona Hijau).
 *
 * DASAR
 *  • INK/016 4.4.5 & 4.6.1 — hasil pemeriksaan Faskes Rekanan menjadi bahan
 *    evaluasi dan pembaruan Zona Risiko PTM.
 *  • ProKawan adalah istilah untuk pengendalian temuan spesifik STD/006 —
 *    bukan program terpisah. Karena itu follow up temuan MCU dan kontrol
 *    rutin ProKawan dicatat di tempat yang SAMA.
 *
 * FIELD YANG DITAMPILKAN
 * Hanya parameter yang abnormal menurut DUA acuan:
 *   1. Trigger Zona PTM (STD/006) — menentukan zona
 *   2. Nilai rujukan nasional Indonesia (dan ambang STD/006 yang bukan trigger)
 *
 * HASIL
 * Nilai ditimpa ke baseline saat perhitungan — baseline MCU sendiri TIDAK
 * diubah, sehingga riwayat "dulu 165/102, sekarang 131/79" tetap terlacak.
 *
 * PENUTUPAN
 * Otomatis bila zona Hijau dan tidak ada parameter abnormal tersisa. Tombol
 * "Konfirmasi paramedis" menutupnya manual (wajib catatan alasan).
 */
export default function FormTindakLanjut({ peserta, jenis, onSelesai }: {
  peserta: PesertaTindakLanjut;
  /** 'prokawan' untuk peserta zona Kuning/Merah, 'mcu' untuk temuan di luar ProKawan. */
  jenis: 'prokawan' | 'mcu';
  onSelesai: () => void;
}) {
  const store = useMCUStore();
  const [data, setData] = useState<{
    karyawan: Record<string, unknown>;
    baseline: { zona: string | null; mcuRecordId: string };
    zonaEfektif: { zona: string; trigger: string; frekuensi: string } | null;
    kelompok: KelompokField[];
    riwayat: Record<string, unknown>[];
    ringkasanSurat: string;
    totalField: number;
    butuhMcu?: boolean;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [aktual, setAktual] = useState(new Date().toISOString().slice(0, 10));
  const [evidence, setEvidence] = useState('');
  const [catatan, setCatatan] = useState('');
  const [tutupParamedis, setTutupParamedis] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [terbuka, setTerbuka] = useState<Record<string, boolean>>({});
  const [tersalin, setTersalin] = useState(false);
  const [hasilSimpan, setHasilSimpan] = useState<{
    zonaSebelum: string | null; zonaSesudah: string; arah: string; ringkasanSurat: string;
    ditutup: boolean; sisaAbnormal: number; paramedis: boolean;
  } | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`/api/followups?nik=${encodeURIComponent(peserta.nik)}`);
      setData(r as never);
      // Kelompok default terbuka semua; pengguna bisa melipat.
      const buka: Record<string, boolean> = {};
      for (const k of ((r.kelompok ?? []) as KelompokField[])) buka[k.sumber] = true;
      setTerbuka(buka);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data tindak lanjut';
      setData({ error: msg } as never);
    } finally {
      setLoading(false);
    }
  }, [peserta.nik]);

  useEffect(() => { void muat(); }, [muat]);

  const jumlahTerisi = Object.values(nilai).filter((v) => String(v).trim() !== '').length;

  // Pratinjau teks surat dari nilai yang sedang diketik.
  const pratinjauSurat = useMemo(() => {
    if (!data) return '';
    const gabungan: Record<string, string | number | null> = {};
    for (const k of data.kelompok) {
      for (const f of k.fields) {
        const baru = nilai[f.id];
        gabungan[f.id] = baru !== undefined && baru !== ''
          ? (Number.isFinite(Number(String(baru).replace(',', '.'))) && !f.teks ? Number(String(baru).replace(',', '.')) : baru)
          : (f.nilaiFollowUp ?? f.nilaiMcu);
        if (f.id === 'tdS') {
          const tdD = nilai.tdD !== undefined && nilai.tdD !== '' ? nilai.tdD : (f.nilaiMcu);
          gabungan.tdD = Number.isFinite(Number(String(tdD).replace(',', '.'))) ? Number(String(tdD).replace(',', '.')) : tdD;
        }
      }
    }
    const ids = data.kelompok.flatMap((k) => k.fields.map((f) => f.id));
    return formatSuratKontrolAbnormal(gabungan, ids).teks;
  }, [data, nilai]);

  async function simpan() {
    if (!jumlahTerisi && !(tutupParamedis && catatan.trim())) {
      store.showToast('Isi minimal satu hasil tindak lanjut, atau tutup dengan konfirmasi paramedis dan catatan', 'error');
      return;
    }
    if (tutupParamedis && !catatan.trim()) {
      store.showToast('Konfirmasi paramedis wajib disertai catatan alasan penutupan', 'error');
      return;
    }
    setMenyimpan(true);
    try {
      const payloadNilai: Record<string, string | number> = {};
      for (const [id, v] of Object.entries(nilai)) {
        const teks = String(v).trim();
        if (!teks) continue;
        const n = Number(teks.replace(',', '.'));
        // Visus & interpretasi tetap teks; numerik disimpan sebagai angka.
        payloadNilai[id] = Number.isFinite(n) && !/[a-zA-Z/]/.test(teks) ? n : teks;
      }
      const r = await authFetch('/api/followups', {
        method: 'POST',
        body: JSON.stringify({
          nik: peserta.nik,
          nama: peserta.nama,
          site: peserta.site,
          department: peserta.department,
          jabatan: null,
          jadwal_tanggal: aktual,
          aktual_tanggal: aktual,
          nilai: payloadNilai,
          evidence_url: evidence || null,
          catatan: catatan || null,
          jenis,
          tutupParamedis,
        }),
      });
      setHasilSimpan({
        zonaSebelum: (r.zonaSebelum as string | null) ?? null,
        zonaSesudah: String(r.zonaSesudah ?? '—'),
        arah: String(r.arah ?? ''),
        ringkasanSurat: String(r.ringkasanSurat ?? ''),
        ditutup: r.ditutup === true,
        sisaAbnormal: Number(r.sisaAbnormal ?? 0),
        paramedis: tutupParamedis,
      });
      setNilai({}); setEvidence(''); setCatatan(''); setTutupParamedis(false);
      store.showToast('Tindak lanjut tersimpan, zona diperbarui', 'success');
      await muat();
      onSelesai();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan tindak lanjut', 'error');
    } finally {
      setMenyimpan(false);
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 16, flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>
          <Loader2 className="size-3 animate-spin inline mr-1" /> Memuat tindak lanjut…
        </p>
      </div>
    );
  }

  if (data?.error || data?.butuhMcu) {
    return (
      <div className="card" style={{ padding: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: '#9a6b00' }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{data?.error ?? 'Belum ada data MCU.'}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const ARAH_WARNA: Record<string, string> = {
    membaik: '#00B894', memburuk: '#FF2D2D', tetap: '#778899', 'tidak-dapat-dinilai': '#778899',
  };

  return (
    <>
      {/* Ringkasan zona */}
      <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Tindak Lanjut</h2>
            <p style={{ fontSize: 9.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
              {data.totalField} parameter perlu ditindaklanjuti
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <InfoMini label="Zona baseline" value={String(data.baseline.zona ?? '—')} />
            <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>&rarr;</span>
            <InfoMini
              label="Zona efektif"
              value={String(data.zonaEfektif?.zona ?? data.baseline.zona ?? '—')}
              warna={String(data.zonaEfektif?.zona ?? '') === 'Merah' ? '#FF2D2D' : String(data.zonaEfektif?.zona ?? '') === 'Kuning' ? '#C99A00' : '#00B894'}
            />
          </div>
        </div>
        {data.zonaEfektif?.frekuensi && (
          <p style={{ fontSize: 9.5, color: 'var(--muted-foreground)', margin: '6px 0 0' }}>
            Frekuensi mengikuti nilai terbaru: <b>{data.zonaEfektif.frekuensi}</b>
          </p>
        )}
      </div>

      {/* Form field — dilipat per kelompok */}
      <div className="card" style={{ padding: '10px 12px', flexShrink: 0 }}>
        <div className="card-head" style={{ marginBottom: 8 }}>
          <span style={{ width: 3, height: 18, borderRadius: 2, background: '#ff4d00', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 12 }}>Hasil Tindak Lanjut</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginBottom: 10 }}>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Tanggal tindak lanjut</span>
            <Input type="date" value={aktual} onChange={(e) => setAktual(e.target.value)} className="h-8 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[10px] font-semibold text-muted-foreground">Bukti / hasil pemeriksaan (link)</span>
            <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://… surat kontrol / hasil lab" className="h-8 rounded-lg text-sm" />
          </label>
        </div>

        {data.kelompok.map((k) => {
          const buka = terbuka[k.sumber] !== false;
          const WARNA = k.sumber === 'trigger' ? '#FF2D2D' : '#FF7A00';
          return (
            <div key={k.sumber} style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setTerbuka((p) => ({ ...p, [k.sumber]: !buka }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '7px 10px', border: 'none', background: 'var(--muted)', cursor: 'pointer',
                  borderRadius: buka ? '8px 8px 0 0' : 8, fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 3, height: 14, borderRadius: 2, background: WARNA, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', display: 'block' }}>
                    {k.judul} ({k.fields.length})
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{k.keterangan}</span>
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{buka ? '▾' : '▸'}</span>
              </button>

              {buka && (
                <div style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {k.fields.map((f) => {
                    // ── TEKANAN DARAH: DUA KOTAK ───────────────────────
                    // tdS = Sistole, tdD = Diastole. Keduanya WAJIB terisi
                    // supaya engine bisa mengklasifikasi (classifyBloodPressure
                    // membutuhkan dua angka). Dulu hanya satu field sehingga
                    // diastole tidak ikut terkirim.
                    if (f.id === 'tdS') {
                      const sistol = nilai.tdS ?? '';
                      const diastol = nilai.tdD ?? '';
                      return (
                        <div key={f.id} className="flex flex-col gap-0.5" title={f.alasan}>
                          <span style={{ fontSize: 9.5, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'baseline', minWidth: 0 }}>
                            <span>Tekanan Darah</span>
                            <span style={{ fontSize: 8.5, color: 'var(--muted-foreground)', flexShrink: 0 }}>mmHg</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Input
                              value={sistol}
                              onChange={(e) => setNilai((p) => ({ ...p, tdS: e.target.value }))}
                              placeholder={`Sistole ${String(f.nilaiMcu)}`}
                              className="h-8 rounded-lg text-sm"
                              style={{ minWidth: 0 }}
                            />
                            <span style={{ color: 'var(--muted-foreground)', fontWeight: 700 }}>/</span>
                            <Input
                              value={diastol}
                              onChange={(e) => setNilai((p) => ({ ...p, tdD: e.target.value }))}
                              placeholder={`Diastole ${String(f.nilaiMcuDiastol ?? '')}`}
                              className="h-8 rounded-lg text-sm"
                              style={{ minWidth: 0 }}
                            />
                          </div>
                          <span style={{ fontSize: 8, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>
                            {f.klasifikasi ? `${f.klasifikasi} · ` : ''}Sistole/Diastole — isi keduanya
                          </span>
                        </div>
                      );
                    }
                    return (
                      <label key={f.id} className="flex flex-col gap-0.5" title={f.alasan}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, display: 'flex', gap: 4, alignItems: 'baseline', minWidth: 0 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                          {f.unit && <span style={{ fontSize: 8.5, color: 'var(--muted-foreground)', flexShrink: 0 }}>{f.unit}</span>}
                        </span>
                        <Input
                          value={nilai[f.id] ?? ''}
                          onChange={(e) => setNilai((p) => ({ ...p, [f.id]: e.target.value }))}
                          placeholder={`MCU: ${String(f.nilaiMcu)}${f.rentang ? ` (normal ${f.rentang})` : ''}`}
                          className="h-8 rounded-lg text-sm"
                        />
                        <span style={{ fontSize: 8, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>
                          {f.klasifikasi ? `${f.klasifikasi} · ` : ''}{f.alasan}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <label className="flex flex-col gap-1" style={{ marginBottom: 8 }}>
          <span className="text-[10px] font-semibold text-muted-foreground">Catatan dokter / paramedis</span>
          <Input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder={tutupParamedis ? 'Alasan penutupan (wajib)' : ''} className="h-8 rounded-lg text-sm" />
        </label>

        {/* Konfirmasi paramedis — penutupan manual. Tanpa ini, FU ditutup otomatis
            bila zona Hijau dan semua parameter sudah normal. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 8,
          borderRadius: 8, border: `1px solid ${tutupParamedis ? '#00B89466' : 'var(--border)'}`,
          background: tutupParamedis ? 'rgba(0,184,148,0.07)' : 'var(--muted)',
        }}>
          <button
            type="button"
            role="switch"
            aria-checked={tutupParamedis}
            aria-label="Konfirmasi paramedis"
            onClick={() => setTutupParamedis((v) => !v)}
            style={{
              position: 'relative', width: 38, height: 22, flexShrink: 0, borderRadius: 11, border: 'none',
              cursor: 'pointer', background: tutupParamedis ? '#00B894' : 'var(--border)', transition: 'background .15s',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: tutupParamedis ? 18 : 2, width: 18, height: 18,
              borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)',
            }} />
          </button>
          <span style={{ minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, display: 'block' }}>
              {tutupParamedis ? 'Ditutup oleh paramedis' : 'Tutup otomatis'}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', lineHeight: 1.4, display: 'block' }}>
              {tutupParamedis
                ? 'Tindak lanjut ditutup meski masih ada temuan. Catatan alasan wajib diisi.'
                : 'Ditutup otomatis bila zona Hijau dan semua parameter sudah normal. Aktifkan untuk menutup manual.'}
            </span>
          </span>
        </div>

        {/* Pratinjau surat kontrol — bisa disalin untuk ditempel ke surat pengantar */}
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--muted)', fontSize: 10.5, lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
              Teks surat pengantar
            </span>
            <button
              type="button"
              onClick={async () => {
                const teks = pratinjauSurat || data.ringkasanSurat || '';
                if (!teks) return;
                try {
                  await navigator.clipboard.writeText(teks);
                  setTersalin(true);
                  setTimeout(() => setTersalin(false), 1800);
                } catch {
                  store.showToast('Gagal menyalin — salin manual dari kotak teks', 'error');
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--card)',
                color: tersalin ? '#00B894' : 'var(--foreground)',
              }}
            >
              {tersalin ? <CheckCircle2 size={11} /> : <Copy size={11} />}
              {tersalin ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <div style={{ fontFamily: 'Consolas, monospace', wordBreak: 'break-word' }}>
            {pratinjauSurat || data.ringkasanSurat || '—'}
          </div>
        </div>

        {hasilSimpan && (
          <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 8, background: `${ARAH_WARNA[hasilSimpan.arah] ?? '#778899'}12`, border: `1px solid ${ARAH_WARNA[hasilSimpan.arah] ?? '#778899'}44`, fontSize: 10.5 }}>
            <b>Zona: {hasilSimpan.zonaSebelum ?? '—'} &rarr; {hasilSimpan.zonaSesudah}</b>
            <span style={{ color: ARAH_WARNA[hasilSimpan.arah] ?? '#778899', fontWeight: 800 }}> ({hasilSimpan.arah})</span>
            <div style={{ marginTop: 2 }}>
              {hasilSimpan.ditutup
                ? <b style={{ color: '#00806a' }}>Tindak lanjut ditutup {hasilSimpan.paramedis ? '(konfirmasi paramedis)' : '(otomatis: semua parameter normal)'}</b>
                : <b style={{ color: '#9a6b00' }}>Masih terbuka — {hasilSimpan.sisaAbnormal} parameter abnormal tersisa</b>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)', marginRight: 'auto' }}>
            {jumlahTerisi} parameter diisi
          </span>
          <Button size="sm" disabled={menyimpan} onClick={() => void simpan()} style={{ gap: 5 }}>
            {menyimpan ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Simpan Tindak Lanjut
          </Button>
        </div>
      </div>
    </>
  );
}

function InfoMini({ label, value, warna }: { label: string; value: string; warna?: string }) {
  return (
    <div style={{ padding: '4px 9px', borderRadius: 8, background: 'var(--muted)', textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: warna ?? 'var(--foreground)' }}>{value}</div>
    </div>
  );
}
