'use client';

import { useEffect, useState } from 'react';
import { CloudUpload, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';

type SettingsData = {
  ai: { provider: 'gemini' | 'openai-compatible'; baseUrl: string; model: string; hasApiKey: boolean };
  drive: { folderId: string; connected: boolean; accountEmail: string };
};

const initial: SettingsData = {
  ai: { provider: 'gemini', baseUrl: '', model: '', hasApiKey: false },
  drive: { folderId: '', connected: false, accountEmail: '' },
};

export default function IntegrationSettings() {
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    authFetch<{ ai: SettingsData['ai']; drive: SettingsData['drive'] }>('/api/integrations/settings')
      .then((result) => { if (active) setSettings({ ai: result.ai, drive: result.drive }); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Gagal memuat pengaturan.'); })
      .finally(() => { if (active) setLoading(false); });
    const driveStatus = new URLSearchParams(window.location.search).get('drive');
    if (driveStatus) {
      setMessage(driveStatus === 'connected'
        ? 'Google Drive berhasil dihubungkan.'
        : `Koneksi Google Drive belum berhasil (${driveStatus}).`);
    }
    return () => { active = false; };
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await authFetch('/api/integrations/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ai: {
            ...settings.ai,
            apiKey: apiKey || undefined,
            clearApiKey,
          },
          drive: settings.drive,
        }),
      });
      setApiKey('');
      setClearApiKey(false);
      setSettings((current) => ({ ...current, ai: { ...current.ai, hasApiKey: clearApiKey ? false : current.ai.hasApiKey || Boolean(apiKey) } }));
      setMessage('Pengaturan integrasi berhasil disimpan.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan.');
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
      {message && <div role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{message}</div>}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-bold">AI / OCR</h3>
        <p className="mb-4 text-xs text-muted-foreground">API key disimpan terenkripsi dan tidak pernah ditampilkan kembali. Endpoint lokal hanya dapat diatur Superuser.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Provider
            <select className={inputClass} value={settings.ai.provider} disabled={loading} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, provider: event.target.value as SettingsData['ai']['provider'] } })}>
              <option value="gemini">Google Gemini</option>
              <option value="openai-compatible">OpenAI-compatible</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Model
            <Input className={inputClass} value={settings.ai.model} disabled={loading} maxLength={200} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, model: event.target.value } })} placeholder={settings.ai.provider === 'gemini' ? 'gemini-2.5-flash' : 'model name'} />
          </label>
          {settings.ai.provider === 'openai-compatible' && (
            <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
              Base URL
              <Input className={inputClass} value={settings.ai.baseUrl} disabled={loading} maxLength={500} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, baseUrl: event.target.value } })} placeholder="http://host-lokal:port/v1" />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            API Key {settings.ai.hasApiKey ? '(sudah tersimpan; kosongkan untuk mempertahankan)' : ''}
            <Input className={inputClass} type="password" autoComplete="new-password" value={apiKey} disabled={loading} maxLength={4096} onChange={(event) => { setApiKey(event.target.value); setClearApiKey(false); }} />
          </label>
          {settings.ai.hasApiKey && (
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input type="checkbox" checked={clearApiKey} onChange={(event) => { setClearApiKey(event.target.checked); if (event.target.checked) setApiKey(''); }} />
              Hapus API key yang tersimpan
            </label>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-bold">Google Drive</h3>
        <p className="mb-4 text-xs text-muted-foreground">File mengikuti izin folder Drive. Atur folder perusahaan yang telah dibagikan sesuai akses staf.</p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Folder ID
            <Input className={inputClass} value={settings.drive.folderId} disabled={loading} maxLength={200} onChange={(event) => setSettings({ ...settings, drive: { ...settings.drive, folderId: event.target.value } })} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={loading || connecting} onClick={connectDrive}>
              {connecting ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
              {settings.drive.connected ? 'Ganti akun Google' : 'Hubungkan akun Google'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {settings.drive.connected ? `Terhubung${settings.drive.accountEmail ? `: ${settings.drive.accountEmail}` : ''}` : 'Belum terhubung'}
            </span>
          </div>
        </div>
      </section>

      <div>
        <Button type="button" disabled={loading || saving} onClick={save}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan integrasi
        </Button>
      </div>
    </div>
  );
}
