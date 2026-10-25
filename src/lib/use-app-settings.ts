'use client';

// Hook pengaturan aplikasi. Nilai default dipakai bila database belum berisi
// key, sehingga seluruh halaman bisa memakai settings tanpa cek null.

import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings } from './app-settings';

let cache: AppSettings | null = null;

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(cache ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cache);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (res.ok) {
        cache = mergeSettings(json.settings);
        setSettings(cache);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (next: AppSettings): Promise<boolean> => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      cache = next;
      setSettings(next);
      return true;
    }
    return false;
  }, []);

  return { settings, loading, reload, save };
}
