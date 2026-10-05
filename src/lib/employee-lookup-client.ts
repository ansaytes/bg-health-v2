import { PREVIEW_MODE } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export async function getEmployeeLookupAccessToken(): Promise<string> {
  if (PREVIEW_MODE) return 'preview-access-token';

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) {
    throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
  }
  return session.access_token;
}
