'use client';

// ============================================================
// Halaman HRA — Health Hazard Risk Assessment (FORM/069 Rev.001)
// ============================================================
// Form input dengan P & R dihitung OTOMATIS dari jam paparan + kontrol
// (catatan penilaian Rev.01). Admin superuser/administrator; manager read-only
// di dashboard Higiene Industri.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';
import {
  HRA_P_LEVELS, HRA_E_LEVELS, hitungRisikoHra, klasifikasiR,
  type KontrolTingkat,
} from '@/lib/hra';

interface HazardRow {
  jenisPekerjaan: string;
  jenisHazard: string;
  sumberHazard: string;
  kelompokBerisiko: string;
  efekKesehatan: string;
  jamPaparanMingguan: number;
  e: number;
  lewatNab: boolean;
  isHazardMerok: boolean;
  prevalensiMerok: number | null;
  kontrolTingkat: KontrolTingkat;
  tindakanPencegahan: string;
  regulasi: string;
}

const JENIS_HAZARD = ['Fisika', 'Kimia', 'Biologi', 'Ergonomi', 'Psikososial', 'Fisika / Kimia', 'Psikososial / Kimia'];
const KONTROL: { v: KontrolTingkat; label: string; efek: string }[] = [
  { v: 'APD', label: 'APD', efek: 'P −1' },
  { v: 'ADMINISTRATIF', label: 'Administratif (SOP/rotasi)', efek: 'P −1' },
  { v: 'ENGINEERING', label: 'Engineering (ventilasi, pelindung mesin)', efek: 'P −2' },
  { v: 'SUBSTITUSI', label: 'Substitusi bahan/proses', efek: 'P −2' },
  { v: 'ELIMINASI', label: 'Eliminasi sumber', efek: 'P = 1' },
  { v: 'TIDAK_ADA', label: 'Belum ada', efek: '—' },
];

function rowKosong(): HazardRow {
  return {
    jenisPekerjaan: '', jenisHazard: 'Fisika', sumberHazard: '', kelompokBerisiko: '',
    efekKesehatan: '', jamPaparanMingguan: 8, e: 3, lewatNab: false,
    isHazardMerok: false, prevalensiMerok: null, kontrolTingkat: 'APD',
    tindakanPencegahan: '', regulasi: '',
  };
}

function RiskBadge({ r }: { r: number }) {
  const kelas = klasifikasiR(r);
  const color = kelas === 'LOW' ? '#00B894' : kelas === 'MEDIUM' ? '#F5A623' : '#FF2D2D';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800,
      padding: '2px 8px', borderRadius: 999, background: `${color}18`, color,
    }}>
      R={r} · {kelas}
    </span>
  );
}

export default function HraInputPage() {
  const store = useMCUStore();
  const { role } = useAuth();
  const canEdit = role === 'superuser' || role === 'administrator';
  const [rows, setRows] = useState<HazardRow[]>([rowKosong()]);
  const [lokasi, setLokasi] = useState('Head Office');
  const [divisi, setDivisi] = useState('');
  const [batasReview, setBatasReview] = useState('');
  const [saving, setSaving] = useState(false);

  // Hitung ulang setiap baris secara live.
  const computed = useMemo(() => rows.map((r) => hitungRisikoHra({
    jamPaparanMingguan: r.jamPaparanMingguan,
    e: r.e,
    lewatNab: r.lewatNab,
    sumberHazard: r.sumberHazard,
    prevalensiMerok: r.prevalensiMerok,
    isHazardMerok: r.isHazardMerok,
    kontrolTingkat: r.kontrolTingkat,
  })), [rows]);

  const set = <K extends keyof HazardRow>(i: number, key: K, value: HazardRow[K]) => {
    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  };

  const handleSave = useCallback(async () => {
    if (!divisi.trim()) { store.showToast('Divisi/Departemen wajib diisi', 'error'); return; }
    if (rows.some((r) => !r.jenisPekerjaan.trim() || !r.sumberHazard.trim() || !r.efekKesehatan.trim())) {
      store.showToast('Lengkapi Jenis Pekerjaan, Sumber Hazard, dan Efek Kesehatan di semua baris', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/hra', {
        method: 'POST',
        body: JSON.stringify({
          resource: 'assessment',
          lokasi_kerja: lokasi,
          divisi_departemen: divisi,
          batas_review: batasReview || null,
          hazards: rows,
        }),
      });
      store.showToast('HRA berhasil disimpan', 'success');
      setRows([rowKosong()]);
      setDivisi('');
      setBatasReview('');
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal menyimpan HRA', 'error');
    } finally {
      setSaving(false);
    }
  }, [lokasi, divisi, batasReview, rows, store]);

  const labelCls = 'text-[10.5px] font-semibold text-muted-foreground';

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--foreground)' }}>Health Hazard Risk Assessment (HRA)</h1>
        <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '3px 0 0', lineHeight: 1.5 }}>
          FORM/069 Rev.001 — P dihitung dari akumulasi jam paparan mingguan; kontrol menurunkan P
          (APD/administratif −1, engineering/substitusi −2). Karsinogen IARC Grup 1 → P min 2; hasil
          ukur &gt; NAB → P min 4.
        </p>
      </div>

      {/* Header assessment */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Lokasi Kerja</span>
            <Input value={lokasi} disabled={!canEdit} onChange={(e) => setLokasi(e.target.value)} className="h-9 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Divisi / Departemen *</span>
            <Input value={divisi} disabled={!canEdit} placeholder="mis. Operation" onChange={(e) => setDivisi(e.target.value)} className="h-9 rounded-lg text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Batas Pemeriksaan Ulang</span>
            <Input type="date" value={batasReview} disabled={!canEdit} onChange={(e) => setBatasReview(e.target.value)} className="h-9 rounded-lg text-sm" />
          </label>
        </div>
      </section>

      {/* Baris hazard */}
      {rows.map((row, i) => (
        <section key={i} style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Hazard #{i + 1}</span>
            <div className="flex items-center gap-2">
              <RiskBadge r={computed[i].initial.r} />
              <span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>→</span>
              <RiskBadge r={computed[i].residual.r} />
              {canEdit && rows.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Jenis Pekerjaan *</span>
              <Input value={row.jenisPekerjaan} disabled={!canEdit} placeholder="mis. Mengemudikan Kendaraan Tambang (Hauling)" onChange={(e) => set(i, 'jenisPekerjaan', e.target.value)} className="h-9 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Jenis Hazard</span>
              <select value={row.jenisHazard} disabled={!canEdit} onChange={(e) => set(i, 'jenisHazard', e.target.value)} className="h-9 rounded-lg border-input bg-background px-3 text-sm">
                {JENIS_HAZARD.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={labelCls}>Sumber Health Hazard *</span>
              <Input value={row.sumberHazard} disabled={!canEdit} placeholder="mis. Getaran Whole Body (WBV) dari kendaraan" onChange={(e) => set(i, 'sumberHazard', e.target.value)} className="h-9 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Kelompok Berisiko (jabatan yang terpapar) *</span>
              <Input value={row.kelompokBerisiko} disabled={!canEdit} placeholder="mis. Driver / Operator" onChange={(e) => set(i, 'kelompokBerisiko', e.target.value)} className="h-9 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Efek Kesehatan *</span>
              <Input value={row.efekKesehatan} disabled={!canEdit} placeholder="mis. LBP, HNP, NIHL" onChange={(e) => set(i, 'efekKesehatan', e.target.value)} className="h-9 rounded-lg text-sm" />
            </label>
          </div>

          {/* Matriks P × E — otomatis */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Jam Paparan / Minggu</span>
              <Input type="number" min={0} max={60} value={row.jamPaparanMingguan} disabled={!canEdit} onChange={(e) => set(i, 'jamPaparanMingguan', Number(e.target.value))} className="h-9 rounded-lg text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>P (Peluang) — otomatis</span>
              <Input value={`${computed[i].initial.p} — ${HRA_P_LEVELS[computed[i].initial.p - 1]?.label ?? ''}`} readOnly className="h-9 rounded-lg text-sm bg-muted" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>E (Efek) — pilih tingkat</span>
              <select value={row.e} disabled={!canEdit} onChange={(e) => set(i, 'e', Number(e.target.value))} className="h-9 rounded-lg border-input bg-background px-3 text-sm">
                {HRA_E_LEVELS.map((lv) => <option key={lv.skor} value={lv.skor}>{lv.skor} — {lv.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Tingkat Kontrol (menurunkan P)</span>
              <select value={row.kontrolTingkat} disabled={!canEdit} onChange={(e) => set(i, 'kontrolTingkat', e.target.value as KontrolTingkat)} className="h-9 rounded-lg border-input bg-background px-3 text-sm">
                {KONTROL.map((k) => <option key={k.v} value={k.v}>{k.label} ({k.efek})</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-3">
            <label className="flex items-center gap-2 text-[11.5px]">
              <input type="checkbox" checked={row.lewatNab} disabled={!canEdit} onChange={(e) => set(i, 'lewatNab', e.target.checked)} />
              Hasil pengukuran &gt; NAB (P min 4)
            </label>
            <label className="flex items-center gap-2 text-[11.5px]">
              <input type="checkbox" checked={row.isHazardMerok} disabled={!canEdit} onChange={(e) => set(i, 'isHazardMerok', e.target.checked)} />
              Hazard merok aktif (P dari prevalensi MCU)
            </label>
            {row.isHazardMerok && (
              <label className="flex items-center gap-2 text-[11.5px]">
                Prevalensi (%):
                <Input type="number" min={0} max={100} value={row.prevalensiMerok ?? ''} disabled={!canEdit} onChange={(e) => set(i, 'prevalensiMerok', e.target.value ? Number(e.target.value) : null)} className="h-8 w-20 rounded-lg text-sm" />
              </label>
            )}
          </div>

          {/* Catatan aturan yang berlaku */}
          {(computed[i].initial.catatan.length > 0) && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.3)' }}>
              {computed[i].initial.catatan.map((c, k) => (
                <p key={k} style={{ fontSize: 10.5, color: '#9a6b00', margin: 0, lineHeight: 1.5 }}>{c}</p>
              ))}
            </div>
          )}

          <label className="flex flex-col gap-1 mb-3">
            <span className={labelCls}>Tindakan Pencegahan yang Telah Dilakukan</span>
            <Textarea rows={2} value={row.tindakanPencegahan} disabled={!canEdit} onChange={(e) => set(i, 'tindakanPencegahan', e.target.value)} className="text-sm rounded-lg bg-background" />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Peraturan Perundangan &amp; Persyaratan Lainnya</span>
            <Input value={row.regulasi} disabled={!canEdit} placeholder="mis. Permenaker No.5/2018 K3 Lingkungan Kerja" onChange={(e) => set(i, 'regulasi', e.target.value)} className="h-9 rounded-lg text-sm" />
          </label>
        </section>
      ))}

      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRows((prev) => [...prev, rowKosong()])} className="rounded-xl">
            <Plus className="size-4" /> Tambah Hazard
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl flex-1">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Simpan HRA
          </Button>
        </div>
      )}
    </div>
  );
}
