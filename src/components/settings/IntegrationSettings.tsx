'use client';

import { useEffect, useState } from 'react';
import { CloudUpload, Loader2, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';

type SettingsData = {
  ai: { provider: 'gemini' | 'openai-compatible'; baseUrl: string; model: string; hasApiKey: boolean };
  drive: { folderId: string; connected: boolean; accountEmail: string };
  googleDriveOAuthConfigured: boolean;
};
type AvailableModel = { id: string; name: string };

const initial: SettingsData = {
  ai: { provider: 'gemini', baseUrl: '', model: '', hasApiKey: false },
  drive: { folderId: '', connected: false, accountEmail: '' },
  googleDriveOAuthConfigured: false,
};

export default function IntegrationSettings({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [savedModel, setSavedModel] = useState('');

  useEffect(() => {
    let active = true;
    authFetch<SettingsData>('/api/integrations/settings')
      .then((result) => {
        if (active) {
          setSettings(result);
          setSavedModel(result.ai.model);
        }
      })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Gagal memuat pengaturan.'); })
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
    }
    return () => { active = false; };
  }, []);

  async function saveAI() {
    setSaving(true);
    setMessage('');
    try {
      await authFetch('/api/integrations/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ai: {
            provider: settings.ai.provider,
            baseUrl: settings.ai.baseUrl,
            model: settings.ai.model,
            apiKey: apiKey || undefined,
            clearApiKey,
          },
        }),
      });
      setApiKey('');
      setClearApiKey(false);
      const updated = await authFetch<SettingsData>('/api/integrations/settings');
      setSettings(updated);
      setSavedModel(updated.ai.model);
      setAvailableModels([]);
      setMessage('API key dan pengaturan AI tersimpan. Memuat model yang tersedia...');
      if (updated.ai.hasApiKey && !clearApiKey) {
        await loadModels(updated.ai.provider, updated.ai.model);
        setMessage('API key tersimpan. Pilih model dari daftar; simpan pilihan model jika Anda mengubahnya.');
      } else {
        setMessage('Pengaturan AI tersimpan. Tambahkan API key untuk memuat model.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  }

  async function saveModel() {
    setSaving(true);
    setMessage('');
    try {
      await authFetch('/api/integrations/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ai: {
            provider: settings.ai.provider,
            baseUrl: settings.ai.baseUrl,
            model: settings.ai.model,
          },
        }),
      });
      setSavedModel(settings.ai.model);
      setMessage('Model AI berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan model AI.');
    } finally {
      setSaving(false);
    }
  }

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

  async function loadModels(
    expectedProvider: SettingsData['ai']['provider'] = settings.ai.provider,
    currentModel: string = settings.ai.model,
  ) {
    setLoadingModels(true);
    setModelError('');
    try {
      const result = await authFetch<{ provider: SettingsData['ai']['provider']; configuredModel: string; models: AvailableModel[] }>('/api/integrations/ai/models');
      setAvailableModels(result.models);
      if (result.provider !== expectedProvider) {
        setModelError('Provider yang tersimpan berbeda. Simpan provider terlebih dahulu, lalu muat ulang model.');
        setAvailableModels([]);
        return;
      }
      const selectedModel = result.models.some((model) => model.id === currentModel)
        ? currentModel
        : result.models.some((model) => model.id === result.configuredModel)
          ? result.configuredModel
          : result.models[0]?.id || '';
      setSettings((current) => ({
        ...current,
        ai: { ...current.ai, model: selectedModel },
      }));
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Gagal memuat daftar model.');
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
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
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-bold">AI / OCR</h3>
        <p className="mb-4 text-xs text-muted-foreground">1. Pilih provider dan isi key. 2. Simpan key untuk mengambil daftar model. 3. Pilih model lalu simpan pilihan.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Provider
            <select className={inputClass} value={settings.ai.provider} disabled={loading || !canEdit} onChange={(event) => { setAvailableModels([]); setSettings({ ...settings, ai: { ...settings.ai, provider: event.target.value as SettingsData['ai']['provider'], model: '' } }); }}>
              <option value="gemini">Google Gemini</option>
              <option value="openai-compatible">OpenAI-compatible</option>
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold">
            Model AI
            <div className="flex gap-2">
              <select
                className={`${inputClass} min-w-0 flex-1`}
                value={settings.ai.model}
                disabled={loading || !canEdit || availableModels.length === 0}
                onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, model: event.target.value } })}
              >
                {availableModels.length === 0 && <option value="">Muat daftar model terlebih dahulu</option>}
                {availableModels.map((model) => <option key={model.id} value={model.id}>{model.name} ({model.id})</option>)}
              </select>
              <Button type="button" variant="outline" className="h-9 shrink-0" disabled={loading || !canEdit || loadingModels || !settings.ai.hasApiKey} onClick={() => void loadModels()}>
                {loadingModels ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                <span className="sr-only">Muat model yang tersedia</span>
              </Button>
            </div>
            {modelError && <span role="alert" className="font-normal text-destructive">{modelError}</span>}
            <span className="font-normal text-muted-foreground">Simpan provider, URL, dan API key terlebih dahulu. Lalu muat ulang daftar model dari provider.</span>
          </div>
          {settings.ai.provider === 'openai-compatible' && (
            <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
              Base URL
              <Input className={inputClass} value={settings.ai.baseUrl} disabled={loading || !canEdit} maxLength={500} onChange={(event) => { setAvailableModels([]); setSettings({ ...settings, ai: { ...settings.ai, baseUrl: event.target.value } }); }} placeholder="https://api.provider.com/v1" />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            API Key {settings.ai.hasApiKey ? '(sudah tersimpan; kosongkan untuk mempertahankan)' : ''}
            <Input className={inputClass} type="password" autoComplete="new-password" value={apiKey} disabled={loading || !canEdit} maxLength={4096} onChange={(event) => { setApiKey(event.target.value); setAvailableModels([]); setClearApiKey(false); }} />
          </label>
          {settings.ai.hasApiKey && (
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input type="checkbox" checked={clearApiKey} disabled={!canEdit} onChange={(event) => { setClearApiKey(event.target.checked); if (event.target.checked) setApiKey(''); }} />
              Hapus API key yang tersimpan
            </label>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" disabled={loading || !canEdit || saving || (!apiKey && !settings.ai.hasApiKey && !clearApiKey)} onClick={() => void saveAI()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan API key & pengaturan
            </Button>
            {availableModels.length > 0 && settings.ai.model !== savedModel && (
              <Button type="button" variant="outline" disabled={!canEdit || saving} onClick={() => void saveModel()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan pilihan model
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-bold">Google Drive</h3>
        <p className="mb-4 text-xs text-muted-foreground">File mengikuti izin folder Drive. Atur folder perusahaan yang telah dibagikan sesuai akses staf.</p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Folder ID
            <Input className={inputClass} value={settings.drive.folderId} disabled={loading || !canEdit} maxLength={200} onChange={(event) => setSettings({ ...settings, drive: { ...settings.drive, folderId: event.target.value } })} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={loading || !canEdit || saving} onClick={() => void saveDriveFolder()}>
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
