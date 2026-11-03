'use client';

// ============================================================
// Halaman Setting — bertab, superuser-only untuk mengubah
// ============================================================
//
// Tab: Perusahaan · Dokumen · Batas PAK · Faskes & BPJS.
// Pola UI mengikuti tema aplikasi (var(--card)/var(--border)).

import { useEffect, useState } from 'react';
import { Building2, Clock, Hospital, Save, Loader2, Users, Plug } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/lib/use-app-settings';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/app-settings';
import CenteredTabs from '@/components/ui/centered-tabs';
import UserManagement from '@/components/administrator/UserManagement';
import IntegrationSettings from '@/components/settings/IntegrationSettings';

type Tab = 'perusahaan' | 'pak' | 'faskes' | 'integrasi' | 'pengguna';

const TABS: { key: Tab; label: string }[] = [
  { key: 'perusahaan', label: 'Perusahaan' },
  { key: 'pak', label: 'Batas Waktu PAK' },
  { key: 'faskes', label: 'Faskes & BPJS' },
  { key: 'integrasi', label: 'Integrasi' },
  { key: 'pengguna', label: 'Kelola Pengguna' },
];

export default function AppSettingsPage() {
  const { settings, loading, error: settingsError, save } = useAppSettings();
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('perusahaan');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => { setDraft(settings); }, [settings]);

  const canEdit = role === 'superuser';

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await save(draft);
      setMsg({ kind: 'ok', text: 'Pengaturan tersimpan.' });
    } catch (error) {
      setMsg({
        kind: 'err',
        text: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan.',
      });
    } finally {
      setSaving(false);
    }
  }

  const set = (path: string, value: string | number) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      const keys = path.split('.');
      let cur = next as any;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const labelCls = 'text-[10.5px] font-semibold text-muted-foreground';
  const inputCls = 'h-9 rounded-lg text-sm';

  return (
    <div className="relative review-mcu-page app-settings-page" style={{ overflowY: 'auto', maxHeight: '100%' }}>
      <div className="app-settings-heading">
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>Pengaturan Aplikasi</h1>
          <p style={{ fontSize: 11.5, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
            Identitas perusahaan dan konfigurasi operasional aplikasi.
          </p>
        </div>
        {canEdit && tab !== 'integrasi' && (
          <Button onClick={handleSave} disabled={saving || loading} className="h-10 rounded-xl">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Simpan
          </Button>
        )}
      </div>

      {!canEdit && (
        <div style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 11.5,
          background: 'rgba(255,196,0,0.10)', border: '1px solid rgba(255,196,0,0.4)', color: '#9a6b00',
        }}>
          Anda masuk sebagai <b>{role}</b> — pengaturan hanya dapat diubah oleh superuser. Nilai di bawah bersifat baca.
        </div>
      )}
      {settingsError && (
        <div role="alert" style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 11.5,
          background: 'rgba(255,45,45,0.08)', border: '1px solid rgba(255,45,45,0.4)', color: '#b3261e',
        }}>
          Pengaturan tidak dapat dimuat: {settingsError}
        </div>
      )}

      {msg && (
        <div style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 11.5,
          background: msg.kind === 'ok' ? 'rgba(0,184,148,0.10)' : 'rgba(255,45,45,0.08)',
          border: `1px solid ${msg.kind === 'ok' ? 'rgba(0,184,148,0.4)' : 'rgba(255,45,45,0.4)'}`,
          color: msg.kind === 'ok' ? '#00806a' : '#b3261e',
        }}>
          {msg.text}
        </div>
      )}

      <CenteredTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Pengaturan aplikasi" compact />

      <div className="app-settings-content">
        {tab === 'integrasi' && <IntegrationSettings canEdit={canEdit} />}
        {tab === 'perusahaan' && (
          <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="size-4 text-primary" />
              <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>Identitas Perusahaan</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Nama Perusahaan (kop laporan)</span>
                <Input className={inputCls} value={draft.perusahaan.nama} disabled={!canEdit} onChange={(e) => set('perusahaan.nama', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Awalan ID Kasus PAK</span>
                <Input className={inputCls} value={draft.perusahaan.prefiksId} disabled={!canEdit} onChange={(e) => set('perusahaan.prefiksId', e.target.value.toUpperCase())} maxLength={4} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Zona Waktu Default</span>
                <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={draft.perusahaan.zonaWaktu} disabled={!canEdit} onChange={(e) => set('perusahaan.zonaWaktu', e.target.value)}>
                  <option value="WIB">WIB</option>
                  <option value="WITA">WITA</option>
                  <option value="WIT">WIT</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelCls}>Alamat (opsional, untuk kop)</span>
                <Input className={inputCls} value={draft.perusahaan.alamat} disabled={!canEdit} onChange={(e) => set('perusahaan.alamat', e.target.value)} />
              </label>
            </div>
          </section>
        )}

        {tab === 'pak' && (
          <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="size-4 text-primary" />
              <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>Batas Waktu PAK</h3>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '0 0 12px' }}>
              Dipakai untuk menghitung tenggat tindak lanjut dan pelaporan PAK.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Triase Dokter (hari kerja sejak diterima)</span>
                <Input type="number" min={1} max={10} className={inputCls} value={draft.pak.triaseHariKerja} disabled={!canEdit} onChange={(e) => set('pak.triaseHariKerja', Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Laporan Medis ke QSHE Manager (×24 jam)</span>
                <Input type="number" min={1} max={72} className={inputCls} value={draft.pak.laporanMedisJam} disabled={!canEdit} onChange={(e) => set('pak.laporanMedisJam', Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Laporan Tahap I ke BPJS (×24 jam sejak diagnosis)</span>
                <Input type="number" min={24} max={168} className={inputCls} value={draft.pak.tahapSatuJam} disabled={!canEdit} onChange={(e) => set('pak.tahapSatuJam', Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Kesimpulan BPJS TK (hari kalender)</span>
                <Input type="number" min={7} max={90} className={inputCls} value={draft.pak.kesimpulanBpjsHari} disabled={!canEdit} onChange={(e) => set('pak.kesimpulanBpjsHari', Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Jawab Permintaan Info BPJS/Pengawas (hari kerja)</span>
                <Input type="number" min={1} max={30} className={inputCls} value={draft.pak.jawabInfoHariKerja} disabled={!canEdit} onChange={(e) => set('pak.jawabInfoHariKerja', Number(e.target.value))} />
              </label>
            </div>
          </section>
        )}

        {tab === 'faskes' && (
          <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Hospital className="size-4 text-primary" />
              <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>Faskes Rekanan & BPJS TK</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Kantor Cabang BPJS Ketenagakerjaan (pelaporan Tahap I)</span>
                <Input className={inputCls} value={draft.faskes.bpjsCabang} disabled={!canEdit} placeholder="Nama kantor cabang" onChange={(e) => set('faskes.bpjsCabang', e.target.value)} />
              </label>
              <div>
                <span className={labelCls}>Dinas Provinsi / Pengawas Ketenagakerjaan per Site</span>
                <div className="space-y-2 mt-1">
                  {draft.faskes.dinasPerSite.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input className={inputCls} placeholder="Site" value={row.site} disabled={!canEdit}
                        onChange={(e) => setDraft((prev) => {
                          const next = structuredClone(prev);
                          next.faskes.dinasPerSite[i].site = e.target.value;
                          return next;
                        })} />
                      <Input className={`${inputCls} flex-1`} placeholder="Instansi" value={row.instansi} disabled={!canEdit}
                        onChange={(e) => setDraft((prev) => {
                          const next = structuredClone(prev);
                          next.faskes.dinasPerSite[i].instansi = e.target.value;
                          return next;
                        })} />
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => setDraft((prev) => {
                          const next = structuredClone(prev);
                          next.faskes.dinasPerSite.splice(i, 1);
                          return next;
                        })}><span className="text-destructive">×</span></Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setDraft((prev) => ({
                      ...prev,
                      faskes: { ...prev.faskes, dinasPerSite: [...prev.faskes.dinasPerSite, { site: '', instansi: '' }] },
                    }))}>+ Tambah Site</Button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'pengguna' && (
          <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-4 text-primary" />
              <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>Kelola Pengguna</h3>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '0 0 12px' }}>
              Kelola akun dan akses pengguna sistem BG-Health.
            </p>
            <UserManagement />
          </section>
        )}

        {!loading && (
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_SETTINGS)}
            className="self-start text-[11px] text-muted-foreground underline hover:text-foreground"
          >
            Kembalikan ke nilai default (belum tersimpan)
          </button>
        )}
      </div>
    </div>
  );
}
