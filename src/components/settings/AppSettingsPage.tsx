'use client';

// Halaman Setting — bertab, superuser-only untuk mengubah
//
// Tab: Perusahaan · Dokumen · Batas PAK · Faskes & BPJS.
// Pola UI mengikuti tema aplikasi (var(--card)/var(--border)).

import { useEffect, useState } from 'react';
import { Save, Loader2, Users, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/lib/use-app-settings';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/app-settings';
import CenteredTabs from '@/components/ui/centered-tabs';
import UserManagement from '@/components/administrator/UserManagement';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import DriveFileUpload from '@/components/settings/DriveFileUpload';

type Tab = 'perusahaan' | 'integrasi' | 'pengguna';

const TABS: { key: Tab; label: string }[] = [
  { key: 'perusahaan', label: 'Perusahaan' },
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
          Anda masuk sebagai <b>{role}</b> : pengaturan hanya dapat diubah oleh superuser. Nilai di bawah bersifat baca.
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

        {!loading && canEdit && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_SETTINGS)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--foreground)';
                e.currentTarget.style.background = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted-foreground)';
                e.currentTarget.style.background = 'var(--card)';
              }}
            >
              Kembalikan ke nilai default (belum tersimpan)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
