// Shared auth helpers: legacy employee-profile lookup used by both the
// login and register actions.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmployeeLoginProfile {
  id: string;
  user_id: string;
  role: string;
  username: string;
  employee_nik_hash: string | null;
}

export const LEGACY_PROFILE_COLUMNS = 'id,user_id,role,username,employee_nik_hash';

/**
 * Finds an existing user_profiles row linked to a legacy (pre-hash) employee
 * identity: NIK Karyawan or National ID stored in `username` / `national_id`.
 * Returns the matched profile, or an error response shape for callers.
 */
export async function findLegacyEmployeeProfile(
  supabaseAdmin: SupabaseClient,
  identityValues: string[],
): Promise<{ profile: EmployeeLoginProfile | null; error?: string; status?: number }> {
  for (const legacyValue of identityValues) {
    const { data: match, error } = await supabaseAdmin
      .from('user_profiles')
      .select(LEGACY_PROFILE_COLUMNS)
      .or(`username.eq."${legacyValue}",national_id.eq."${legacyValue}"`)
      .limit(2);
    if (error) {
      console.error('Legacy employee profile lookup failed:', error);
      return { profile: null, error: 'Gagal memeriksa akun karyawan', status: 500 };
    }
    if (match && match.length > 1) {
      return {
        profile: null,
        error: 'Ditemukan lebih dari satu akun untuk karyawan ini. Hubungi administrator.',
        status: 409,
      };
    }
    if (match?.[0]) return { profile: match[0] as EmployeeLoginProfile };
  }
  return { profile: null };
}

/** Legacy identity values (NIK Karyawan / National ID) of a decrypted employee. */
export function legacyIdentityValues(employeeData: { nik?: unknown; national_id?: unknown }): string[] {
  return [String(employeeData.nik ?? ''), String(employeeData.national_id ?? '')].filter(Boolean);
}
