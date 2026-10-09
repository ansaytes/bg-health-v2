// src/lib/api-client.ts — fetch ke API internal dengan token Supabase (pola sama dengan HealthCampaignForm)
import { supabase } from '@/lib/supabase';

export async function authFetch<T = any>(input: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || (process.env.NEXT_PUBLIC_PREVIEW_ROLE ? 'preview-access-token' : '');
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.error || `Permintaan gagal (${res.status})`);
  return json as T;
}
