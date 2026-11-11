'use client';

import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/api-client';
import type { AiProfile, AiProfilePublic, AiProviderKind } from '@/lib/ai-providers';

interface AiPreset {
  id: string;
  label: string;
  provider: AiProviderKind;
  baseUrl: string;
  /** Petunjuk format key agar mudah dikenali operator. */
  keyHint: string;
}

/** Pilihan cepat di form "Tambah AI", seperti daftar provider pada Cline. */
const AI_PRESETS: AiPreset[] = [
  { id: 'gemini', label: 'Google Gemini', provider: 'gemini', baseUrl: '', keyHint: 'AIza…' },
  { id: 'openai', label: 'OpenAI', provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', keyHint: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic (Claude)', provider: 'anthropic', baseUrl: 'https://api.anthropic.com', keyHint: 'sk-ant-…' },
  { id: 'openrouter', label: 'OpenRouter', provider: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', keyHint: 'sk-or-…' },
  { id: 'custom', label: 'Lainnya (OpenAI-compatible)', provider: 'openai-compatible', baseUrl: '', keyHint: 'API key dari penyedia' },
];

function presetForProfile(profile: Pick<AiProfile, 'provider' | 'baseUrl'>): AiPreset {
  const base = profile.baseUrl.replace(/\/+$/, '');
  return (
    AI_PRESETS.find((preset) => preset.provider === profile.provider && preset.id !== 'custom'
      && preset.baseUrl.replace(/\/+$/, '') === base)
    ?? AI_PRESETS.find((preset) => preset.provider === profile.provider && preset.id !== 'custom')
    ?? AI_PRESETS[AI_PRESETS.length - 1]
  );
}

type AvailableModel = { id: string; name: string };

/** Satu baris di editor: profil tersimpan + isian yang belum disimpan. */
interface Draft extends AiProfilePublic {
  /** Key yang baru diketik; kosong = pertahankan key tersimpan. */
  apiKey: string;
  clearApiKey: boolean;
  models: AvailableModel[];
  loadingModels: boolean;
  modelError: string;
}

function toDraft(profile: AiProfilePublic): Draft {
  return { ...profile, apiKey: '', clearApiKey: false, models: [], loadingModels: false, modelError: '' };
}

function newDraft(presetId: string): Draft {
  const preset = AI_PRESETS.find((item) => item.id === presetId) ?? AI_PRESETS[0];
  return toDraft({
    id: '',
    name: preset.label,
    provider: preset.provider,
    baseUrl: preset.baseUrl,
    model: '',
    enabled: true,
    hasApiKey: false,
  });
}

interface Props {
  initialProfiles: AiProfilePublic[];
  /** Batas jumlah AI, ditetapkan server (MAX_AI_PROFILES). */
  maxProfiles: number;
  canEdit: boolean;
  encryptionKeyConfigured: boolean;
  loading: boolean;
  onMessage: (message: string) => void;
  onSaved?: () => void;
}

/**
 * Pengaturan AI bergaya Cline: daftar akun/API key dengan model masing-masing.
 * Urutan daftar = urutan prioritas. Saat ekstraksi MCU berjalan, AI paling atas
 * dicoba lebih dulu; bila kuota/tokennya habis (atau key-nya ditolak), sistem
 * otomatis lanjut ke AI berikutnya.
 */
export default function AiProfilesEditor({ initialProfiles, maxProfiles, canEdit, encryptionKeyConfigured, loading, onMessage, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>(() => initialProfiles.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [presetToAdd, setPresetToAdd] = useState(AI_PRESETS[0].id);
  const listId = useId();
  const inputClass = 'h-9 rounded-lg text-sm';
  const disabled = loading || !canEdit;

  function update(index: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function move(index: number, delta: -1 | 1) {
    setDrafts((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function loadModels(index: number) {
    const draft = drafts[index];
    update(index, { loadingModels: true, modelError: '' });
    try {
      const result = await authFetch<{ models: AvailableModel[] }>('/api/integrations/ai', {
        method: 'POST',
        body: JSON.stringify({
          profileId: draft.id || undefined,
          provider: draft.provider,
          baseUrl: draft.baseUrl,
          apiKey: draft.apiKey || undefined,
        }),
      });
      update(index, { models: result.models, loadingModels: false });
    } catch (error) {
      update(index, {
        models: [],
        loadingModels: false,
        modelError: error instanceof Error ? error.message : 'Gagal memuat daftar model.',
      });
    }
  }

  async function save() {
    const incomplete = drafts.findIndex((draft) => draft.enabled && !draft.model.trim());
    if (incomplete >= 0) {
      onMessage(`AI #${incomplete + 1} (${drafts[incomplete].name}) belum punya model. Pilih atau ketik model, atau nonaktifkan AI tersebut.`);
      return;
    }
    const noKey = drafts.findIndex((draft) => draft.enabled && !draft.hasApiKey && !draft.apiKey.trim());
    if (noKey >= 0) {
      onMessage(`AI #${noKey + 1} (${drafts[noKey].name}) belum punya API key.`);
      return;
    }
    setSaving(true);
    onMessage('');
    try {
      await authFetch('/api/integrations/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ai: {
            profiles: drafts.map((draft) => ({
              id: draft.id || undefined,
              name: draft.name,
              provider: draft.provider,
              baseUrl: draft.baseUrl,
              model: draft.model,
              enabled: draft.enabled,
              apiKey: draft.apiKey || undefined,
              clearApiKey: draft.clearApiKey,
            })),
          },
        }),
      });
      const updated = await authFetch<{ ai: { profiles: AiProfilePublic[] } }>('/api/integrations/settings');
      setDrafts(updated.ai.profiles.map(toDraft));
      onMessage('Pengaturan AI tersimpan. Urutan daftar adalah urutan prioritas: AI berikutnya dipakai otomatis bila AI di atasnya kehabisan kuota.');
      onSaved?.();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Gagal menyimpan pengaturan AI.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-1 text-sm font-bold">AI / OCR (bisa lebih dari satu)</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Tambahkan satu atau beberapa AI yang dapat membaca gambar. Urutan daftar = urutan prioritas: bila AI pertama
        kehabisan token/kuota atau API key-nya ditolak, ekstraksi otomatis dilanjutkan ke AI kedua, dan seterusnya.
        API key disimpan terenkripsi dan tidak pernah ditampilkan kembali.
      </p>

      {drafts.length === 0 && (
        <p className="mb-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Belum ada AI. Pilih penyedia di bawah lalu klik &quot;Tambah AI&quot;.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {drafts.map((draft, index) => {
          const preset = presetForProfile(draft);
          const isCustomUrl = draft.provider === 'openai-compatible';
          return (
            <li key={draft.id || `new-${index}`} className={`rounded-lg border p-3 ${draft.enabled ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                <span className="text-xs font-semibold">{index === 0 ? 'Utama' : `Cadangan ${index}`}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{preset.label}</span>
                <div className="ml-auto flex items-center gap-1">
                  <label className="mr-2 flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={draft.enabled} disabled={disabled} onChange={(event) => update(index, { enabled: event.target.checked })} />
                    Aktif
                  </label>
                  <Button type="button" variant="outline" size="icon" className="size-8" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="size-4" /><span className="sr-only">Naikkan prioritas</span>
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="size-8" disabled={disabled || index === drafts.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown className="size-4" /><span className="sr-only">Turunkan prioritas</span>
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="size-8 text-destructive" disabled={disabled} onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}>
                    <Trash2 className="size-4" /><span className="sr-only">Hapus AI ini</span>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  Nama
                  <Input className={inputClass} value={draft.name} maxLength={60} disabled={disabled} onChange={(event) => update(index, { name: event.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold">
                  Provider
                  <select
                    className={inputClass}
                    value={draft.provider}
                    disabled={disabled}
                    onChange={(event) => {
                      const provider = event.target.value as AiProviderKind;
                      const defaults = AI_PRESETS.find((item) => item.provider === provider && item.id !== 'custom');
                      update(index, {
                        provider,
                        baseUrl: defaults?.baseUrl ?? '',
                        model: '',
                        models: [],
                        modelError: '',
                      });
                    }}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai-compatible">OpenAI / OpenRouter / lainnya (OpenAI-compatible)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                </label>

                {(isCustomUrl || draft.provider === 'anthropic') && (
                  <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
                    Base URL
                    <Input
                      className={inputClass}
                      value={draft.baseUrl}
                      maxLength={500}
                      disabled={disabled}
                      placeholder={isCustomUrl ? 'https://api.provider.com/v1' : 'https://api.anthropic.com'}
                      onChange={(event) => update(index, { baseUrl: event.target.value, models: [] })}
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
                  API Key {draft.hasApiKey && !draft.clearApiKey ? '(sudah tersimpan; kosongkan untuk mempertahankan)' : ''}
                  <Input
                    className={inputClass}
                    type="password"
                    autoComplete="new-password"
                    value={draft.apiKey}
                    maxLength={4096}
                    disabled={disabled}
                    placeholder={preset.keyHint}
                    onChange={(event) => update(index, { apiKey: event.target.value, clearApiKey: false, models: [] })}
                  />
                </label>
                {draft.hasApiKey && (
                  <label className="flex items-center gap-2 text-xs sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={draft.clearApiKey}
                      disabled={disabled}
                      onChange={(event) => update(index, { clearApiKey: event.target.checked, apiKey: event.target.checked ? '' : draft.apiKey })}
                    />
                    Hapus API key yang tersimpan
                  </label>
                )}

                <div className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
                  Model (harus bisa membaca gambar)
                  <div className="flex gap-2">
                    <Input
                      className={`${inputClass} min-w-0 flex-1`}
                      list={`${listId}-${index}`}
                      value={draft.model}
                      maxLength={200}
                      disabled={disabled}
                      placeholder="Muat daftar model, atau ketik nama model"
                      onChange={(event) => update(index, { model: event.target.value })}
                    />
                    <datalist id={`${listId}-${index}`}>
                      {draft.models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                    </datalist>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={disabled || draft.loadingModels || (!draft.apiKey && !draft.hasApiKey)}
                      onClick={() => void loadModels(index)}
                    >
                      {draft.loadingModels ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      <span className="ml-1 hidden sm:inline">Muat model</span>
                      <span className="sr-only sm:hidden">Muat model yang tersedia</span>
                    </Button>
                  </div>
                  {draft.models.length > 0 && <span className="font-normal text-muted-foreground">{draft.models.length} model pembaca gambar ditemukan; ketik untuk menyaring.</span>}
                  {draft.modelError && <span role="alert" className="font-normal text-destructive">{draft.modelError}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-lg text-sm"
          value={presetToAdd}
          disabled={disabled || drafts.length >= maxProfiles}
          onChange={(event) => setPresetToAdd(event.target.value)}
        >
          {AI_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={disabled || drafts.length >= maxProfiles} onClick={() => setDrafts((current) => [...current, newDraft(presetToAdd)])}>
          <Plus className="size-4" /> Tambah AI
        </Button>
        <Button type="button" className="ml-auto" disabled={disabled || saving || !encryptionKeyConfigured} onClick={() => void save()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan semua AI
        </Button>
      </div>
    </section>
  );
}
