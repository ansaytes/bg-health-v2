'use client';

import { useEffect, useState } from 'react';
import { CloudUpload, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import type { AiProfilePublic } from '@/lib/ai-providers';
import AiProfilesEditor from './AiProfilesEditor';

type SettingsData = {
  ai: { profiles: AiProfilePublic[]; maxProfiles: number };
  drive: { folderId: string; connected: boolean; accountEmail: string };
  googleDriveOAuthConfigured: boolean;
  encryptionKeyConfigured: boolean;
};

const initial: SettingsData = {
  ai: { profiles: [], maxProfiles: 10 },
  drive: { folderId: '', connected: false, accountEmail: '' },
  googleDriveOAuthConfigured: false,
  encryptionKeyConfigured: false,
};

export default function IntegrationSettings({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    authFetch<SettingsData>('/api/integrations/settings')
      .then((result) => {
        if (active) {
          setSettings(result);
          setSettingsLoadError('');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSettingsLoadError(error instanceof Error ? error.message : 'Gagal memuat pengaturan.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    const driveStatus = new URLSearchParams(window.location.search).get('drive');
    if (driveStatus) {
      const driveMessages: Record<string, string> = {
        connected: 'Google Drive berhasil dihubungkan.',
        oauth_config_incomplete: 'Koneksi Google Drive gagal: konfigurasi OAuth server belum lengkap. Atur GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, dan GOOGLE_DRIVE_REDIRECT_URI pada environment server.',
        invalid_state: 'Koneksi Google Drive gagal karena validasi keamanan tidak cocok atau sesi OAuth kedaluwarsa. Mulai koneksi kembali.',
        expired_state: 'Sesi OAuth Google Drive kedaluwarsa. Mulai koneksi kembali.',
        authorization_failed: 'Izin Google Drive tidak diberikan atau proses otorisasi dibatalkan.',
        access_denied: 'Hanya superuser yang memulai koneksi dapat menyelesaikan otorisasi Google Drive.',
        token_exchange_failed: 'Google menolak penukaran kode OAuth. Periksa Client ID, Client Secret, dan URL callback di Google Cloud Console.',
        account_lookup_failed: 'Akun Google berhasil diotorisasi, tetapi alamat akun tidak dapat dibaca.',
        missing_refresh_token: 'Google tidak memberikan refresh token. Cabut akses aplikasi di akun Google lalu hubungkan kembali dengan persetujuan baru.',
        connection_failed: 'Koneksi Google Drive gagal saat menyimpan pengaturan. Periksa konfigurasi server dan coba kembali.',
      };
      setMessage(driveMessages[driveStatus] || `Koneksi Google Drive belum berhasil (${driveStatus}).`);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('drive');
      window.history.replaceState(
        window.history.state,
        '',
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
    return () => { active = false; };
  }, []);

  async function saveDriveFolder() {
    setSaving(true);
    setMessage('');
    try {
      await authFetch('/api/integrations/settings', {
        method: 'PUT',
        body: JSON.stringify({ drive: settings.drive }),
      });
      setMessage('Folder Google Drive berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan folder Google Drive.');
    } finally {
      setSaving(false);
    }
  }

  async function connectDrive() {
    setConnecting(true);
    setMessage('');
    try {
      const result = await authFetch<{ url: string }>('/api/integrations/google-drive/connect', { method: 'POST' });
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memulai koneksi Google Drive.');
      setConnecting(false);
    }
  }

  const inputClass = 'h-9 rounded-lg text-sm';
  return (
    <div className="flex flex-col gap-4">
      {!canEdit && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          Akun ini tidak dikenali sebagai superuser oleh aplikasi. Periksa role pada Kelola Pengguna, lalu login kembali.
        </div>
      )}
      {message && <div role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm break-words">{message}</div>}
      {settingsLoadError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm break-words">
          Pengaturan integrasi gagal dimuat: {settingsLoadError}
        </div>
      )}
      {!loading && !settingsLoadError && !settings.encryptionKeyConfigured && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
          <strong>API key belum bisa disimpan.</strong>
          <p className="mt-1">
            Tambahkan <code>INTEGRATION_ENCRYPTION_KEY</code> di Vercel → Project → Settings → Environment Variables.
            Buat nilainya satu kali dengan perintah:
          </p>
          <code className="mt-2 block select-all break-all rounded bg-background/70 p-2 text-xs">
            node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
          </code>
          <p className="mt-1">Salin 64 karakter hasilnya ke Vercel, lalu redeploy. Simpan key cadangan dengan aman; jangan ganti setelah API key disimpan karena data terenkripsi lama tidak bisa dibuka dengan key baru.</p>
        </div>
      )}
      {!loading && !settingsLoadError && (
        <AiProfilesEditor
          initialProfiles={settings.ai.profiles}
          maxProfiles={settings.ai.maxProfiles}
          canEdit={canEdit}
          encryptionKeyConfigured={settings.encryptionKeyConfigured}
          loading={loading}
          onMessage={setMessage}
        />
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-bold">Google Drive</h3>
        <p className="mb-4 text-xs text-muted-foreground">File mengikuti izin folder Drive. Atur folder perusahaan yang telah dibagikan sesuai akses staf.</p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Folder ID
            <Input className={inputClass} value={settings.drive.folderId} disabled={loading || !canEdit} maxLength={200} onChange={(event) => setSettings({ ...settings, drive: { ...settings.drive, folderId: event.target.value } })} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={loading || !canEdit || saving || !settings.encryptionKeyConfigured} onClick={() => void saveDriveFolder()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan Folder
            </Button>
            <Button type="button" variant="outline" disabled={loading || !canEdit || connecting || !settings.googleDriveOAuthConfigured} onClick={connectDrive}>
              {connecting ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
              {settings.drive.connected ? 'Ganti akun Google' : 'Hubungkan akun Google'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {settings.drive.connected ? `Terhubung${settings.drive.accountEmail ? `: ${settings.drive.accountEmail}` : ''}` : 'Belum terhubung'}
            </span>
          </div>
          {!settings.googleDriveOAuthConfigured && (
            <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
              Hubungkan akun belum aktif: konfigurasi OAuth belum lengkap di Vercel. Minta pengelola deployment mengatur Client ID, Client Secret, dan Redirect URI.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
