'use client';

// Hook pengaturan aplikasi. Nilai default dipakai bila database belum berisi
// key, sehingga seluruh halaman bisa memakai settings tanpa cek null.

import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from './app-settings';
import { authFetch } from './api-client';

let cache: AppSettings | null = null;

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(cache ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await authFetch<{ settings: Partial<AppSettings> | null }>('/api/settings');
      cache = mergeSettings(result.settings);
      setSettings(cache);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Gagal memuat pengaturan aplikasi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (next: AppSettings): Promise<void> => {
    await authFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(next),
    });
    cache = next;
    setSettings(next);
  }, []);

  return { settings, loading, error, reload, save };
}
