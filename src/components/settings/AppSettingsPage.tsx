'use client';

// ============================================================
// Halaman Setting — bertab, superuser-only untuk mengubah
// ============================================================
//
// Tab: Perusahaan · Dokumen · Batas PAK · Faskes & BPJS.
// Pola UI mengikuti tema aplikasi (var(--card)/var(--border)).

import { useEffect, useState } from 'react';
import { Building2, Clock, Hospital, Save, Loader2, Users, Gauge, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/lib/use-app-settings';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/app-settings';
import CenteredTabs from '@/components/ui/centered-tabs';
import UserManagement from '@/components/administrator/UserManagement';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import DriveFileUpload from '@/components/settings/DriveFileUpload';

type Tab = 'perusahaan' | 'pak' | 'faskes' | 'integrasi' | 'pengguna' | 'nab';

const TABS: { key: Tab; label: string }[] = [
  { key: 'perusahaan', label: 'Perusahaan' },
  { key: 'pak', label: 'Batas Waktu PAK' },
  { key: 'faskes', label: 'Faskes & BPJS' },
  { key: 'nab', label: 'Nilai Ambang Batas' },
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
        {canEdit && tab !== 'integrasi' && tab !== 'pengguna' && (
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
          <div className="flex flex-col gap-4">
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

            <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Image className="size-4 text-primary" />
                <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>Branding &amp; Tampilan Visual</h3>
              </div>
              <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '0 0 12px' }}>
                Kustomisasi nama aplikasi dan logo antarmuka. Anda dapat mengunggah file langsung ke Google Drive (otomatis diatur resolusi optimalnya) atau menempelkan link/path gambar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className={labelCls}>Nama Aplikasi (Sidebar &amp; Judul)</span>
                  <Input className={inputCls} value={draft.branding?.namaAplikasi || ''} placeholder="Contoh: BG-Health v2" disabled={!canEdit} onChange={(e) => set('branding.namaAplikasi', e.target.value)} />
                </label>

                {/* Logo Perusahaan */}
                <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-muted/20">
                  <span className={labelCls}>Logo Perusahaan (Sidebar Atas)</span>
                  <span className="text-[10px] text-muted-foreground">Dimensi optimal: 480 × 208 px (Maks: 25 MB)</span>
                  <Input className={inputCls} value={draft.branding?.logoPerusahaanUrl || ''} placeholder="Default: /LogoBDM.png" disabled={!canEdit} onChange={(e) => set('branding.logoPerusahaanUrl', e.target.value)} />
                  {canEdit && (
                    <div className="mt-1">
                      <DriveFileUpload
                        category="branding"
                        accept="image/png,image/jpeg,image/webp"
                        label="Unggah Logo (480x208)"
                        targetWidth={480}
                        targetHeight={208}
                        onUploaded={(url) => set('branding.logoPerusahaanUrl', url)}
                      />
                    </div>
                  )}
                </div>

                {/* Banner Bus */}
                <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-muted/20">
                  <span className={labelCls}>Banner Armada / Bus (Sidebar)</span>
                  <span className="text-[10px] text-muted-foreground">Dimensi optimal: 1400 × 323 px (Rasio ~4:1)</span>
                  <Input className={inputCls} value={draft.branding?.logoBusUrl || ''} placeholder="Default: /Bus2023.png" disabled={!canEdit} onChange={(e) => set('branding.logoBusUrl', e.target.value)} />
                  {canEdit && (
                    <div className="mt-1">
                      <DriveFileUpload
                        category="branding"
                        accept="image/png,image/jpeg,image/webp"
                        label="Unggah Banner (1400x323)"
                        targetWidth={1400}
                        targetHeight={323}
                        onUploaded={(url) => set('branding.logoBusUrl', url)}
                      />
                    </div>
                  )}
                </div>

                {/* Logo Best K3 */}
                <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-muted/20">
                  <span className={labelCls}>Logo K3 (Header Kanan)</span>
                  <span className="text-[10px] text-muted-foreground">Dimensi optimal: 480 × 172 px</span>
                  <Input className={inputCls} value={draft.branding?.logoBestK3Url || ''} placeholder="Default: /BestK3.png" disabled={!canEdit} onChange={(e) => set('branding.logoBestK3Url', e.target.value)} />
                  {canEdit && (
                    <div className="mt-1">
                      <DriveFileUpload
                        category="branding"
                        accept="image/png,image/jpeg,image/webp"
                        label="Unggah Logo K3 (480x172)"
                        targetWidth={480}
                        targetHeight={172}
                        onUploaded={(url) => set('branding.logoBestK3Url', url)}
                      />
                    </div>
                  )}
                </div>

                {/* Logo Tuwuh */}
                <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-muted/20">
                  <span className={labelCls}>Logo Slogan / Tuwuh (Sidebar Bawah)</span>
                  <span className="text-[10px] text-muted-foreground">Dimensi optimal: 640 × 229 px</span>
                  <Input className={inputCls} value={draft.branding?.logoTuwuhUrl || ''} placeholder="Default: /TuwuhLanNgrembaka_float.png" disabled={!canEdit} onChange={(e) => set('branding.logoTuwuhUrl', e.target.value)} />
                  {canEdit && (
                    <div className="mt-1">
                      <DriveFileUpload
                        category="branding"
                        accept="image/png,image/jpeg,image/webp"
                        label="Unggah Slogan (640x229)"
                        targetWidth={640}
                        targetHeight={229}
                        onUploaded={(url) => set('branding.logoTuwuhUrl', url)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
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

        {tab === 'nab' && (
          <section style={{ background: 'var(--card)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-primary" />
              <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>Nilai Ambang Batas (NAB)</h3>
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '-12px 0 0' }}>
              Batas paparan lingkungan kerja sesuai regulasi. Dipakai sebagai acuan penilaian otomatis pada modul Lingkungan Kerja.
            </p>

            {/* NAB Pencahayaan */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
                Pencahayaan (lux) <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>(Permenkes 48/2016 Tabel 4)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { field: 'ruang_kerja',  label: 'Ruang Kerja (lux)',    min: 50, max: 2000 },
                  { field: 'ruang_gambar', label: 'Ruang Gambar (lux)',   min: 50, max: 2000 },
                  { field: 'resepsionis',  label: 'Resepsionis (lux)',    min: 50, max: 2000 },
                  { field: 'ruang_arsip',  label: 'Ruang Arsip (lux)',    min: 50, max: 2000 },
                  { field: 'ruang_rapat',  label: 'Ruang Rapat (lux)',    min: 50, max: 2000 },
                  { field: 'ruang_makan',  label: 'Ruang Makan (lux)',    min: 50, max: 2000 },
                  { field: 'koridor_lobi', label: 'Koridor / Lobi (lux)', min: 50, max: 2000 },
                ] as { field: keyof typeof draft.nab.lux; label: string; min: number; max: number }[]).map(({ field, label, min, max }) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className={labelCls}>{label}</span>
                    <Input
                      type="number" min={min} max={max}
                      className={inputCls}
                      value={draft.nab.lux[field]}
                      disabled={!canEdit}
                      onChange={(e) => set(`nab.lux.${field}`, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* NAB Kualitas Udara */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
                Kualitas Udara <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>(Permenkes 48/2016 Pasal 11)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { field: 'suhuMin',       label: 'Suhu Min (°C)',           min: 10, max: 40,  step: 0.5 },
                  { field: 'suhuMax',       label: 'Suhu Maks (°C)',          min: 10, max: 40,  step: 0.5 },
                  { field: 'kelembabanMin', label: 'Kelembaban Min (%)',       min: 10, max: 100, step: 1 },
                  { field: 'kelembabanMax', label: 'Kelembaban Maks (%)',      min: 10, max: 100, step: 1 },
                  { field: 'oksigenMin',    label: 'O₂ Min (%)',              min: 10, max: 25,  step: 0.1 },
                  { field: 'oksigenMax',    label: 'O₂ Maks (%)',             min: 10, max: 25,  step: 0.1 },
                  { field: 'pm10Max',       label: 'PM10 Maks (mg/m³)',       min: 0,  max: 1,   step: 0.01 },
                  { field: 'asbesMax',      label: 'Asbes Maks (serat/ml)',   min: 0,  max: 1,   step: 0.01 },
                ] as { field: keyof typeof draft.nab.udara; label: string; min: number; max: number; step: number }[]).map(({ field, label, min, max, step }) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className={labelCls}>{label}</span>
                    <Input
                      type="number" min={min} max={max} step={step}
                      className={inputCls}
                      value={draft.nab.udara[field]}
                      disabled={!canEdit}
                      onChange={(e) => set(`nab.udara.${field}`, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* NAB Kebisingan */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
                Kebisingan – dB(A) <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>(Kepmenaker 51/1999)</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { field: 'jam8', label: 'Paparan 8 jam/hari (dB)', min: 70, max: 140 },
                  { field: 'jam4', label: 'Paparan 4 jam/hari (dB)', min: 70, max: 140 },
                  { field: 'jam2', label: 'Paparan 2 jam/hari (dB)', min: 70, max: 140 },
                  { field: 'jam1', label: 'Paparan 1 jam/hari (dB)', min: 70, max: 140 },
                ] as { field: keyof typeof draft.nab.kebisingan; label: string; min: number; max: number }[]).map(({ field, label, min, max }) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className={labelCls}>{label}</span>
                    <Input
                      type="number" min={min} max={max}
                      className={inputCls}
                      value={draft.nab.kebisingan[field]}
                      disabled={!canEdit}
                      onChange={(e) => set(`nab.kebisingan.${field}`, Number(e.target.value))}
                    />
                  </label>
                ))}
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
