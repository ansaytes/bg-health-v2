'use client';

// Register PAK — Dashboard (INK/017)
// Superuser/administrator: kelola kasus (input, triase, diagnosis, laporan).
// Manager/pic: read-only (menandatangani laporan Tahap I).
// Dokumen register dicetak melalui print CSS.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Printer, Plus, AlertTriangle, RefreshCw, Search, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DownloadButton from '@/components/ui/download-button';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useMCUStore } from '@/lib/store';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from '@/lib/app-settings';
import EmployeeLookupInput from '@/components/administrator/EmployeeLookupInput';
import { usePopup, Popup } from '@/lib/popup';
import HraInspectorModal, { HraLiveJabatanPreview } from './HraInspectorModal';

interface PakCase {
  id: string;
  id_register: string;
  tanggal_diterima: string;
  diterima_oleh: string;
  lokasi: string | null;
  jobsite_nama: string | null;
  sumber_dugaan: string;
  sumber_detail: string | null;
  pelapor_nama: string | null;
  nama_enc: string | null;
  jabatan: string | null;
  department: string | null;
  jenis_pekerjaan: string | null;
  sumber_pajanan: string | null;
  diagnosis_klinis: string | null;
  diagnosis_tgl: string | null;
  diagnosis_faskes: string | null;
  diagnosis_dokter: string | null;
  hasil_mcu_pemicu: string | null;
  status_bpjs_tk: string | null;
  upah: string | null;
  triase_keputusan: string | null;
  triase_alasan: string | null;
  triase_tgl: string | null;
  triase_dokter: string | null;
  triase_batas: string | null;
  diagnosis_okupasi: string | null;
  diagnosis_tegak_tgl: string | null;
  kelaikan_kerja: string | null;
  dokter_perusahaan: string | null;
  laporan_medis_tgl: string | null;
  laporan_medis_batas: string | null;
  tahap1_batas: string | null;
  tahap1_selesai_tgl: string | null;
  tahap1_tepat_waktu: boolean | null;
  kesimpulan_bpjs: string | null;
  kesimpulan_bpjs_tgl: string | null;
  tahap2_selesai_tgl: string | null;
  status: string;
  /** Verifikasi dokumen HRA: true = telah diperiksa dan sesuai (INK/017 Lampiran 1). */
  hra_verified: boolean | null;
  hra_verified_by: string | null;
  hra_verified_tgl: string | null;
  deadline_info?: { triaseSisaJam: number | null; laporanMedisSisaJam: number | null; tahap1SisaJam: number | null };
}

const STATUS_LABEL: Record<string, string> = {
  DITERIMA: 'Diterima', DITRIASE: 'Ditriase', PENEGAKAN: 'Penegakan',
  PAK: 'PAK', DUGAAN_PAK: 'Dugaan PAK', BUKAN_PAK: 'Bukan PAK',
  TAHAP_I: 'Tahap I (pelaporan)', TAHAP_II: 'Tahap II', DITUTUP: 'Ditutup',
};

const STATUS_COLOR: Record<string, string> = {
  DITERIMA: '#778899', DITRIASE: '#3498DB', PENEGAKAN: '#8E44AD',
  PAK: '#FF2D2D', DUGAAN_PAK: '#FF7A00', BUKAN_PAK: '#00B894',
  TAHAP_I: '#FF2D2D', TAHAP_II: '#8E44AD', DITUTUP: '#00B894',
};

const SUMBER_DUGAAN = [
  { v: 'MCU', label: 'MCU (Pre-employee / Annual / Khusus / Exit)' },
  { v: 'PELAYANAN_INTERNAL', label: 'Pelayanan kesehatan perusahaan (klinik / Paramedic Site)' },
  { v: 'BEROBAT_LUAR', label: 'Berobat di luar tim medik perusahaan' },
  { v: 'PIHAK_LAIN', label: 'Pemberitahuan pihak lain' },
  { v: 'KLUSTER_HRA', label: 'Kluster / penyelidikan HRA / pengukuran lingkungan' },
];

function fmtJam(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.toLocaleDateString('id-ID')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Badge deadline: hijau = aman, oranye = <24 jam, merah = lewat. */
function DeadlineBadge({ sisaJam: sisa, label }: { sisaJam: number | null; label: string }) {
  if (sisa === null) return null;
  const color = sisa < 0 ? '#FF2D2D' : sisa <= 24 ? '#FF7A00' : '#00B894';
  const text = sisa < 0 ? `Lewat ${Math.abs(sisa)} jam` : sisa <= 24 ? `${sisa} jam lagi` : `${Math.round(sisa / 24)} hari lagi`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${color}15`, color }}>
      {sisa < 0 && <AlertTriangle size={11} />}
      {label}: {text}
    </span>
  );
}

export default function PakRegister() {
  const store = useMCUStore();
  const { role } = useAuth();
  const { popup, popupState, closePopup } = usePopup();
  const canWrite = role === 'superuser' || role === 'administrator';
  const [cases, setCases] = useState<PakCase[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inspectingKasus, setInspectingKasus] = useState<PakCase | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/pak?resource=list');
      setCases(Array.isArray(res.data) ? res.data : []);
      if (res.pak) setSettings(mergeSettings({ pak: res.pak }));
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal memuat Register PAK', 'error');
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => { void load(); }, [load]);

  const mcuFocusRequest = useMCUStore((s) => s.mcuFocusRequest);
  useEffect(() => {
    if (!mcuFocusRequest) return;
    const query = (mcuFocusRequest.nama || mcuFocusRequest.nikKaryawan || '').trim();
    if (query) {
      setSearch(query);
      setFilterStatus('semua');
    }
  }, [mcuFocusRequest?.requestId]);

  const filtered = useMemo(() => cases.filter((c) => {
    if (filterStatus !== 'semua' && c.status !== filterStatus) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return `${c.id_register} ${c.nama_enc ?? ''} ${c.jabatan ?? ''} ${c.department ?? ''}`.toLowerCase().includes(term);
  }), [cases, filterStatus, search]);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) map[c.status] = (map[c.status] || 0) + 1;
    return map;
  }, [cases]);

  const lewatDeadline = useMemo(() => cases.filter((c) => {
    const d = c.deadline_info;
    if (!d) return false;
    return (d.triaseSisaJam !== null && d.triaseSisaJam < 0)
      || (d.laporanMedisSisaJam !== null && d.laporanMedisSisaJam < 0)
      || (d.tahap1SisaJam !== null && d.tahap1SisaJam < 0);
  }).length, [cases]);

  async function createCase(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      await authFetch('/api/pak', { method: 'POST', body: JSON.stringify(payload) });
      store.showToast('Kasus PAK dibuat di Register', 'success');
      setCreating(false);
      await load();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal membuat kasus', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function patchCase(id: string, patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await authFetch('/api/pak', { method: 'PATCH', body: JSON.stringify({ id, ...patch }) });
      store.showToast('Kasus diperbarui', 'success');
      await load();
    } catch (e) {
      store.showToast(e instanceof Error ? e.message : 'Gagal memperbarui', 'error');
    } finally {
      setSaving(false);
    }
  }

  function deleteCase(id: string) {
    popup({
      type: 'confirm',
      title: 'Hapus kasus PAK?',
      message: 'Hapus kasus PAK ini dari Register?',
      confirmLabel: 'Hapus',
      onOk: async () => {
        try {
          await authFetch(`/api/pak?id=${id}`, { method: 'DELETE' });
          store.showToast('Kasus dihapus', 'success');
          await load();
        } catch {
          store.showToast('Gagal menghapus', 'error');
        }
      },
    });
  }

  const th = 'px-2.5 py-1.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-foreground border-b bg-muted whitespace-nowrap';
  const td = 'px-2.5 py-2 text-[11.5px] border-b align-top';

  const tableDataForExport = () => {
    return filtered.map((c, idx) => ({
      No: idx + 1,
      ID_Register: c.id_register,
      Nama: c.nama_enc ?? '-',
      Jabatan: c.jabatan ?? '-',
      Departemen: c.department ?? '-',
      Sumber_Dugaan: c.sumber_dugaan,
      Detail_Sumber: c.sumber_detail ?? '-',
      Verifikasi_HRA: c.hra_verified ? 'Ya' : 'Belum',
      Tgl_Diterima: c.tanggal_diterima ? fmtJam(c.tanggal_diterima) : '-',
      Triase_Keputusan: c.triase_keputusan ?? 'Menunggu',
      Diagnosis_Okupasi: c.diagnosis_okupasi ?? '-',
      Kelaikan_Kerja: c.kelaikan_kerja ?? '-',
      Status: STATUS_LABEL[c.status] ?? c.status,
    }));
  };

  return (
    <div className="admin-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px 8px 16px', height: '100%', minHeight: 0, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 4px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 className="admin-form-title">Register Penyakit Akibat Kerja (PAK)</h1>
          <p className="admin-form-subtitle">
            Pencatatan kasus, triase kelaikan kerja, dan pemenuhan pelaporan statutori 2×24 jam (Permenaker 01/1981 &amp; PP 44/2015).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} style={{ height: 30, fontSize: 11.5 }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
          {canWrite && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="admin-form-btn-primary compact-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, fontSize: 11.5 }}
            >
              <Plus size={14} /> Kasus Baru
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mcu-records-toolbar" style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'transparent', padding: '0', border: 'none', flexWrap: 'nowrap' }}>
        <div className="mcu-records-search" style={{ flex: '1 1 0px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--card)', padding: '0 10px', height: '30px', borderRadius: '6px', border: '1px solid var(--border)', boxSizing: 'border-box' }}>
          <Search size={14} className="text-muted-foreground" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari ID Register / nama karyawan / jabatan / departemen..."
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '11.5px', color: 'var(--foreground)', width: '100%', height: '100%' }}
          />
        </div>
        <div style={{ flexShrink: 0, width: '180px' }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '11.5px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
          >
            <option value="semua">Semua Status ({cases.length})</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v} ({statusCounts[k] || 0})</option>)}
          </select>
        </div>
        <div style={{ flexShrink: 0 }}>
          <DownloadButton
            variant="compact"
            filename="Register_PAK_Tambang"
            title="Register PAK Tambang"
            getData={tableDataForExport}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm"><Loader2 className="size-5 animate-spin inline mr-2" />Memuat Register…</div>
      ) : (
        <>
          {/* Tabel kasus */}
          <div className="mcu-records-table-wrap" style={{ border: '1px solid var(--border)', borderRadius: '8px', flex: '1 1 auto', minHeight: 360, overflowX: 'auto' }}>
            <table className="mcu-records-table" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11.5px' }}>
              <thead><tr>
                <th className={th}>ID Register</th>
                <th className={th}>Karyawan</th>
                <th className={th}>Sumber Dugaan</th>
                <th className={th}>Verifikasi HRA</th>
                <th className={th}>Diterima</th>
                <th className={th}>Triase</th>
                <th className={th}>Diagnosis</th>
                <th className={th}>Batas Waktu</th>
                <th className={th}>Status</th>
                {canWrite && <th className={th} style={{ textAlign: 'center' }}>Aksi</th>}
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/40" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className={td} style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{c.id_register}</td>
                    <td className={td}>
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>{c.nama_enc ?? '-'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>{c.jabatan ?? '-'} · {c.department ?? '-'}</div>
                    </td>
                    <td className={td} style={{ fontSize: '11px' }}>
                      {SUMBER_DUGAAN.find((s) => s.v === c.sumber_dugaan)?.label.split('(')[0].trim() ?? c.sumber_dugaan}
                      {c.sumber_detail && <div style={{ fontSize: '9.5px', color: 'var(--muted-foreground)' }}>{c.sumber_detail}</div>}
                    </td>
                    <td className={td}>
                      {c.hra_verified ? (
                        <button
                          type="button"
                          onClick={() => setInspectingKasus(c)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#00895f',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                          }}
                          title={`Diverifikasi oleh ${c.hra_verified_by ?? '-'} pada ${fmtJam(c.hra_verified_tgl)} : Klik untuk melihat rincian bahaya HRA`}
                        >
                          <ShieldCheck size={12} /> Terverifikasi
                          <div style={{ fontSize: '9px', color: 'var(--muted-foreground)', fontWeight: 400 }}>{c.hra_verified_by}</div>
                        </button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          style={{ height: 24, fontSize: '10px', padding: '0 6px' }}
                          title="Periksa dokumen HRA dan verifikasi kesesuaian pajanan"
                          onClick={() => setInspectingKasus(c)}
                        >
                          <ShieldAlert size={11} className="mr-1 text-amber-600" /> Periksa HRA
                        </Button>
                      )}
                    </td>
                    <td className={td} style={{ whiteSpace: 'nowrap', fontSize: '11px' }}>{fmtJam(c.tanggal_diterima)}<div style={{ fontSize: '9.5px', color: 'var(--muted-foreground)' }}>{c.diterima_oleh}</div></td>
                    <td className={td} style={{ fontSize: '11px' }}>
                      {c.triase_keputusan
                        ? <><b>{c.triase_keputusan === 'TIDAK_MEMENUHI' ? 'Tidak memenuhi' : c.triase_keputusan === 'LANJUT_PAK02' ? 'Lanjut pemeriksaan' : 'Perlu tambahan'}</b><div style={{ fontSize: '9.5px', color: 'var(--muted-foreground)' }}>{fmtJam(c.triase_tgl)}</div></>
                        : <DeadlineBadge sisaJam={c.deadline_info?.triaseSisaJam ?? null} label="Triase" />}
                    </td>
                    <td className={td} style={{ fontSize: '11px' }}>
                      {c.diagnosis_okupasi
                        ? <><b>{c.diagnosis_okupasi}</b>{c.kelaikan_kerja && <div style={{ fontSize: '9.5px', color: 'var(--muted-foreground)' }}>{c.kelaikan_kerja}</div>}</>
                        : '-'}
                    </td>
                    <td className={td} style={{ fontSize: '11px' }}>
                      <DeadlineBadge sisaJam={c.deadline_info?.laporanMedisSisaJam ?? null} label="Lap. medis" />
                      <div style={{ marginTop: 2 }}>
                        <DeadlineBadge sisaJam={c.deadline_info?.tahap1SisaJam ?? null} label="Tahap I" />
                      </div>
                    </td>
                    <td className={td}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '9.5px', fontWeight: 800, background: `${STATUS_COLOR[c.status] ?? '#778899'}18`, color: STATUS_COLOR[c.status] ?? '#778899' }}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    {canWrite && (
                      <td className={td} style={{ textAlign: 'center' }}>
                        <div className="flex gap-1 justify-center">
                          <Button size="sm" variant="outline" style={{ height: 24, width: 24, padding: 0 }} onClick={() => window.print()} title="Cetak formulir"><Printer size={11} /></Button>
                          <Button size="sm" variant="ghost" style={{ height: 24, width: 24, padding: 0 }} onClick={() => deleteCase(c.id)} title="Hapus"><Trash2 size={11} className="text-destructive" /></Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={canWrite ? 10 : 9} style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11.5 }}>
                    Belum ada kasus PAK pada filter ini.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Form kasus baru */}
          {creating && canWrite && (
            <NewCaseForm
              saving={saving}
              onCancel={() => setCreating(false)}
              onSubmit={createCase}
            />
          )}

          {/* Triase cepat untuk kasus yang belum ditriase */}
          {canWrite && filtered.some((c) => !c.triase_keputusan && c.status === 'DITERIMA') && (
            <div className="card" style={{ padding: 14, marginTop: 12 }}>
              <h3 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Triase Menunggu (batas {settings.pak.triaseHariKerja} hari kerja)</h3>
              <div className="space-y-2">
                {filtered.filter((c) => !c.triase_keputusan && c.status === 'DITERIMA').map((c) => (
                  <TriaseRow key={c.id} kasus={c} saving={saving} onSubmit={(keputusan, alasan) => patchCase(c.id, { action: 'triase', triase_keputusan: keputusan, triase_alasan: alasan })} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <HraInspectorModal
        kasus={inspectingKasus}
        isOpen={!!inspectingKasus}
        onClose={() => setInspectingKasus(null)}
        onVerify={async () => {
          if (inspectingKasus) {
            await patchCase(inspectingKasus.id, { action: 'verify_hra' });
          }
        }}
        canWrite={canWrite}
      />
      <Popup state={popupState} closePopup={closePopup} />
    </div>
  );
}

function NewCaseForm({ saving, onCancel, onSubmit }: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const label = 'text-[10.5px] font-semibold text-muted-foreground';

  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <h3 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Kasus PAK Baru</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {/* Identitas diisi lewat pencarian karyawan yang SAMA dengan Review MCU.
            Sebelumnya pengguna harus mengetik `nik_karyawan_hash` manual : tidak
            mungkin dilakukan tanpa membuka database. */}
        <div className="sm:col-span-2">
          <EmployeeLookupInput
            value={form.nik_hash ?? ''}
            onChange={(v) => set('nik_hash', v)}
            onEmployeeFound={(emp) => {
              set('nama', String(emp.nama ?? ''));
              set('jabatan', String(emp.jabatan ?? ''));
              set('department', String(emp.department ?? ''));
            }}
            onAutoFill={(_field, val) => { if (_field === 'nama') set('nama', val); }}
            placeholder="Cari nama / NIK / NIK KTP"
            label={<span className={label}>Karyawan</span>}
            required
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className={label}>Lokasi</span>
          <select value={form.lokasi ?? 'Head Office'} onChange={(e) => set('lokasi', e.target.value)} className="h-9 rounded-lg border-input bg-background px-3 text-sm">
            <option value="Head Office">Head Office</option>
            <option value="Jobsite">Jobsite</option>
          </select>
        </label>
        {form.lokasi === 'Jobsite' && (
          <label className="flex flex-col gap-1">
            <span className={label}>Nama Jobsite</span>
            <Input value={form.jobsite_nama ?? ''} onChange={(e) => set('jobsite_nama', e.target.value)} className="h-9 rounded-lg text-sm" />
          </label>
        )}
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={label}>Sumber Dugaan</span>
          <select value={form.sumber_dugaan ?? 'MCU'} onChange={(e) => set('sumber_dugaan', e.target.value)} className="h-9 rounded-lg border-input bg-background px-3 text-sm">
            {SUMBER_DUGAAN.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </label>
        {/* Pengingat dokumen HRA sebagai rujukan klarifikasi pajanan (INK/017 Lampiran 1). */}
        {['BEROBAT_LUAR', 'PIHAK_LAIN', 'KLUSTER_HRA'].includes(form.sumber_dugaan ?? 'MCU') && (
          <div className="sm:col-span-3 flex items-start gap-2 p-3 rounded-lg text-xs" style={{ background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Periksa dokumen <b>HRA (Health Risk Assessment)</b> untuk memastikan hubungan pajanan
              dengan keluhan/diagnosis sebelum menetapkan dugaan PAK. Sumber
              pajanan yang tercantum di HRA unit kerja karyawan menjadi dasar klarifikasi.
            </span>
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className={label}>Jabatan</span>
          <Input value={form.jabatan ?? ''} onChange={(e) => set('jabatan', e.target.value)} className="h-9 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Departemen</span>
          <Input value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} className="h-9 rounded-lg text-sm" />
        </label>
        <div className="sm:col-span-3">
          <HraLiveJabatanPreview jabatan={form.jabatan} department={form.department} />
        </div>
        <label className="flex flex-col gap-1 sm:col-span-3">
          <span className={label}>Diagnosis Klinis (bila ada)</span>
          <Input value={form.diagnosis_klinis ?? ''} onChange={(e) => set('diagnosis_klinis', e.target.value)} placeholder="mis. NIHL bilateral, Silikosis" className="h-9 rounded-lg text-sm" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-3">
          <span className={label}>Hasil MCU Pemicu</span>
          <Textarea rows={2} value={form.hasil_mcu_pemicu ?? ''} onChange={(e) => set('hasil_mcu_pemicu', e.target.value)} placeholder="mis. STS kanan 12 dB vs baseline 2025" className="text-sm rounded-lg bg-background" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={() => onSubmit(form)} disabled={saving || !(form.nik_hash ?? '').trim()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Buat Kasus
        </Button>
      </div>
    </div>
  );
}

function TriaseRow({ kasus, saving, onSubmit }: {
  kasus: PakCase;
  saving: boolean;
  onSubmit: (keputusan: string, alasan: string) => void;
}) {
  const [keputusan, setKeputusan] = useState('LANJUT_PAK02');
  const [alasan, setAlasan] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border">
      <div className="flex-1 min-w-0">
        <b style={{ fontSize: 12 }}>{kasus.id_register}</b> <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{kasus.nama_enc ?? '-'}</span>
        <DeadlineBadge sisaJam={kasus.deadline_info?.triaseSisaJam ?? null} label="Batas triase" />
      </div>
      <select value={keputusan} onChange={(e) => setKeputusan(e.target.value)} className="h-9 rounded-lg border-input bg-background px-2 text-xs">
        <option value="TIDAK_MEMENUHI">Tidak memenuhi dugaan PAK</option>
        <option value="PERLU_TAMBAHAN">Perlu pemeriksaan tambahan</option>
        <option value="LANJUT_PAK02">Dugaan PAK : lanjut pemeriksaan</option>
      </select>
      <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan / catatan triase" className="h-9 flex-1 rounded-lg text-sm min-w-[200px]" />
      <Button size="sm" onClick={() => onSubmit(keputusan, alasan)} disabled={saving || (keputusan === 'TIDAK_MEMENUHI' && !alasan.trim())}>
        Simpan Triase
      </Button>
    </div>
  );
}
