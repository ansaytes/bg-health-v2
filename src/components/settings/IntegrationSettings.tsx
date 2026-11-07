'use client';

import { useEffect, useState } from 'react';
import { CloudUpload, Loader2, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';

type SettingsData = {
  ai: {
    provider: 'gemini' | 'openai-compatible';
    baseUrl: string;
    model: string;
    hasApiKey: boolean;
    accounts?: Array<{
      id: string;
      label: string;
      provider: 'gemini' | 'openai-compatible';
      baseUrl: string;
      model: string;
      enabled: boolean;
      hasApiKey: boolean;
    }>;
  };
  drive: { folderId: string; connected: boolean; accountEmail: string };
  googleDriveOAuthConfigured: boolean;
  encryptionKeyConfigured: boolean;
};
type AvailableModel = { id: string; name: string };
/** Satu akun AI dalam bentuk yang bisa diedit di form. */
type AccountDraft = {
  id: string;
  label: string;
  provider: 'gemini' | 'openai-compatible';
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasApiKey: boolean;
  /** Key baru; kosong = pertahankan yang tersimpan. */
  apiKey: string;
  clearApiKey: boolean;
};

const initial: SettingsData = {
  ai: { provider: 'gemini', baseUrl: '', model: '', hasApiKey: false },
  drive: { folderId: '', connected: false, accountEmail: '' },
  googleDriveOAuthConfigured: false,
  encryptionKeyConfigured: false,
};

export default function IntegrationSettings({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState(initial);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [savedModel, setSavedModel] = useState('');
  // Daftar akun AI yang sedang diedit secara lokal sebelum disimpan.
  // `apiKey` kosong berarti "pertahankan key lama" (sama seperti perilaku
  // form satu-akun sebelumnya), sehingga operator tidak perlu mengetik
  // ulang key yang sudah tersimpan.
  const [accountsDraft, setAccountsDraft] = useState<AccountDraft[]>([]);

  useEffect(() => {
    if (!loading && !settingsLoadError && settings.ai.accounts?.length) {
      setAccountsDraft(settings.ai.accounts.map((account) => ({
        id: account.id,
        label: account.label,
        provider: account.provider,
        baseUrl: account.baseUrl,
        model: account.model,
        enabled: account.enabled,
        hasApiKey: account.hasApiKey,
        apiKey: '',
        clearApiKey: false,
      })));
    }
  }, [loading, settingsLoadError, settings.ai.accounts]);

  async function saveAccounts() {
    if (!settings.encryptionKeyConfigured) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await authFetch<{ success: boolean; accounts?: number }>(
        '/api/integrations/settings',
        {
          method: 'PUT',
          body: JSON.stringify({
            ai: {
              accounts: accountsDraft.map((account) => ({
                id: account.id,
                label: account.label,
                provider: account.provider,
                baseUrl: account.provider === 'openai-compatible' ? account.baseUrl : '',
                model: account.model,
                enabled: account.enabled,
                apiKey: account.clearApiKey ? '' : account.apiKey,
                clearApiKey: account.clearApiKey,
              })),
            },
          }),
        },
      );
      if (result.success) {
        setMessage(`Berhasil menyimpan ${result.accounts ?? accountsDraft.length} akun AI. Urutan akun menentukan urutan failover.`);
        setSettings({
          ...settings,
          ai: {
            ...settings.ai,
            provider: accountsDraft[0]?.provider ?? settings.ai.provider,
            baseUrl: accountsDraft[0]?.baseUrl ?? settings.ai.baseUrl,
            model: accountsDraft[0]?.model ?? settings.ai.model,
          },
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan akun AI.');
    } finally {
      setSaving(false);
    }
  }

  function addAccount() {
    const nextIndex = accountsDraft.length + 1;
    setAccountsDraft([...accountsDraft, {
      id: `acc-${nextIndex}-${Math.random().toString(36).slice(2, 8)}`,
      label: `Akun ${nextIndex}`,
      provider: 'gemini',
      baseUrl: '',
      model: '',
      enabled: true,
      hasApiKey: false,
      apiKey: '',
      clearApiKey: false,
    }]);
  }

  function removeAccount(id: string) {
    setAccountsDraft(accountsDraft.filter((account) => account.id !== id));
  }

  function updateAccount(id: string, patch: Partial<AccountDraft>) {
    setAccountsDraft(accountsDraft.map((account) =>
      account.id === id ? { ...account, ...patch } : account,
    ));
  }

  function moveAccount(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= accountsDraft.length) return;
    const next = [...accountsDraft];
    [next[index], next[target]] = [next[target], next[index]];
    setAccountsDraft(next);
  }


  useEffect(() => {
    let active = true;
    authFetch<SettingsData>('/api/integrations/settings')
      .then((result) => {
        if (active) {
          setSettings(result);
          setSavedModel(result.ai.model);
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
        const modelsLoaded = await loadModels(updated.ai.provider, updated.ai.model);
        setMessage(modelsLoaded
          ? 'API key tersimpan. Pilih model dari daftar; simpan pilihan model jika Anda mengubahnya.'
          : 'API key tersimpan, tetapi daftar model gagal dimuat. Lihat pesan error di bagian Model AI.');
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
  ): Promise<boolean> {
    setLoadingModels(true);
    setModelError('');
    try {
      const result = await authFetch<{ provider: SettingsData['ai']['provider']; configuredModel: string; models: AvailableModel[] }>('/api/integrations/ai/models');
      setAvailableModels(result.models);
      if (result.provider !== expectedProvider) {
        setModelError('Provider yang tersimpan berbeda. Simpan provider terlebih dahulu, lalu muat ulang model.');
        setAvailableModels([]);
        return false;
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
      return true;
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Gagal memuat daftar model.');
      setAvailableModels([]);
      return false;
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
            node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
          </code>
          <p className="mt-1">Salin 64 karakter hasilnya ke Vercel, lalu redeploy. Simpan key cadangan dengan aman; jangan ganti setelah API key disimpan karena data terenkripsi lama tidak bisa dibuka dengan key baru.</p>
        </div>
      )}
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
            <Button type="button" disabled={loading || !canEdit || saving || !settings.encryptionKeyConfigured || (!apiKey && !settings.ai.hasApiKey && !clearApiKey)} onClick={() => void saveAI()}>
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

      {/* ── AKUN AI GANDA (FAILOVER OTOMATIS) ────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-bold">Akun AI Ganda (Failover Otomatis)</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Tambahkan beberapa akun AI vision. Saat akun pertama kehabisan kuota/limit atau API key ditolak,
          ekstraksi MCU otomatis dilanjutkan ke akun berikutnya sesuai urutan. Hanya bila SEMUA akun gagal
          barulah proses dinyatakan gagal.
        </p>

        <div className="flex flex-col gap-3">
          {accountsDraft.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              Belum ada akun. Klik &quot;Tambah akun AI&quot; untuk membuat akun pertama.
            </p>
          )}

          {accountsDraft.map((account, index) => (
            <div key={account.id} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-xs font-semibold">
                  {index === 0 ? 'Akun Utama' : `Cadangan ${index}`}
                </span>
                {!account.enabled && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">nonaktif</span>
                )}
                {account.hasApiKey && !account.clearApiKey && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                    key tersimpan
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveAccount(index, -1)}
                    disabled={index === 0 || !canEdit}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                    aria-label="Naikkan prioritas akun"
                    title="Naikkan prioritas"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => moveAccount(index, 1)}
                    disabled={index === accountsDraft.length - 1 || !canEdit}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                    aria-label="Turunkan prioritas akun"
                    title="Turunkan prioritas"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => removeAccount(account.id)}
                    disabled={!canEdit}
                    className="rounded border border-destructive/50 px-1.5 py-0.5 text-[10px] text-destructive disabled:opacity-40"
                    aria-label={`Hapus ${account.label}`}
                    title="Hapus akun"
                  >Hapus</button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold">
                  Nama akun
                  <Input
                    className="h-8 rounded-lg text-xs"
                    value={account.label}
                    maxLength={80}
                    disabled={!canEdit}
                    onChange={(event) => updateAccount(account.id, { label: event.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold">
                  Provider
                  <select
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                    value={account.provider}
                    disabled={!canEdit}
                    onChange={(event) => updateAccount(account.id, {
                      provider: event.target.value as AccountDraft['provider'],
                    })}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai-compatible">OpenAI-compatible</option>
                  </select>
                </label>

                {account.provider === 'openai-compatible' && (
                  <label className="flex flex-col gap-1 text-[11px] font-semibold sm:col-span-2">
                    Base URL
                    <Input
                      className="h-8 rounded-lg text-xs"
                      value={account.baseUrl}
                      maxLength={500}
                      placeholder="https://api.provider.com/v1"
                      disabled={!canEdit}
                      onChange={(event) => updateAccount(account.id, { baseUrl: event.target.value })}
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1 text-[11px] font-semibold sm:col-span-2">
                  API Key {account.hasApiKey ? '(sudah tersimpan — kosongkan untuk mempertahankan)' : ''}
                  <Input
                    className="h-8 rounded-lg text-xs"
                    type="password"
                    autoComplete="new-password"
                    maxLength={4096}
                    value={account.apiKey}
                    disabled={!canEdit || account.clearApiKey}
                    onChange={(event) => updateAccount(account.id, { apiKey: event.target.value })}
                  />
                </label>

                <label className="flex flex-col gap-1 text-[11px] font-semibold">
                  Model (opsional — diisi otomatis saat ekstraksi)
                  <Input
                    className="h-8 rounded-lg text-xs"
                    value={account.model}
                    maxLength={200}
                    placeholder="mis. gemini-2.0-flash"
                    disabled={!canEdit}
                    onChange={(event) => updateAccount(account.id, { model: event.target.value })}
                  />
                </label>

                <div className="flex flex-col justify-end gap-1">
                  <label className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={account.enabled}
                      disabled={!canEdit}
                      onChange={(event) => updateAccount(account.id, { enabled: event.target.checked })}
                    />
                    Aktifkan akun ini
                  </label>
                  {account.hasApiKey && (
                    <label className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={account.clearApiKey}
                        disabled={!canEdit}
                        onChange={(event) => updateAccount(account.id, {
                          clearApiKey: event.target.checked,
                          apiKey: event.target.checked ? '' : account.apiKey,
                        })}
                      />
                      Hapus API key akun ini
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!canEdit || accountsDraft.length >= 20} onClick={addAccount}>
              + Tambah akun AI
            </Button>
            <Button
              type="button"
              disabled={!canEdit || saving || !settings.encryptionKeyConfigured || accountsDraft.length === 0}
              onClick={() => void saveAccounts()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan daftar akun
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Gunakan tombol panah untuk mengatur urutan failover. Akun nomor 1 dicoba lebih dulu.
          </p>
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
