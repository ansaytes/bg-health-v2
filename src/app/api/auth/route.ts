import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptEmployee, hashField } from '@/lib/encryption';

// Client-side Supabase (anon key) — for login, logout, session
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side admin client (service role) — for creating users
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;
// Password awal akun karyawan dibaca dari environment (server-only, JANGAN pakai prefix NEXT_PUBLIC_).
// Tanpa nilai yang valid, pembuatan akun karyawan otomatis dinonaktifkan (tidak ada fallback hardcoded).
const EMPLOYEE_DEFAULT_PASSWORD = process.env.EMPLOYEE_DEFAULT_PASSWORD || '';
const MIN_PASSWORD_LENGTH = 8;
// Password yang pernah bocor di repo tidak boleh dipakai lagi sebagai password baru.
const BLOCKED_PASSWORDS = new Set(['bagong1994']);
const EMPLOYEE_AUTH_DOMAIN = 'employee.bg-health.local';

interface EmployeeLoginProfile {
  id: string;
  user_id: string;
  role: string;
  username: string;
  employee_nik_hash: string | null;
}

// Preview mode handling: if access token is the preview mock token,
// treat caller as the role specified in NEXT_PUBLIC_PREVIEW_ROLE.
const PREVIEW_TOKEN = 'preview-access-token';
const PREVIEW_ROLE = process.env.NEXT_PUBLIC_PREVIEW_ROLE as string | undefined;


// Helper: verify session and get user profile role
async function getSessionRole(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  let accessToken = authHeader?.replace('Bearer ', '');

  // Fallback: check cookie
  if (!accessToken) {
    const cookie = req.cookies.get('sb-access-token')?.value;
    if (cookie) accessToken = cookie;
  }

  if (!accessToken) return null;
  // Preview mode bypass — preview mode is set in .env.local via NEXT_PUBLIC_PREVIEW_ROLE
  if (accessToken === 'preview-access-token' && PREVIEW_ROLE) {
    return { userId: 'preview-0000-0000-0000-000000000001', role: PREVIEW_ROLE };
  }


  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;

  // Get profile
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role, full_name, username, site, employee_nik_hash')
    .eq('user_id', user.id)
    .single();

  return {
    user,
    role: (profile?.role as string) || 'viewer',
    profile,
  };
}

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // --- LOGIN ---
    if (action === 'login') {
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      if (!username || !password) {
        return NextResponse.json({ error: 'NIK Karyawan, National ID, atau email dan password wajib diisi' }, { status: 400 });
      }

      let loginEmail = username;
      if (/^\d+$/.test(username)) {
        if (!supabaseServiceKey) {
          return NextResponse.json({ error: 'Login karyawan belum dikonfigurasi. Hubungi administrator.' }, { status: 500 });
        }

        const identifierHash = hashField(username);
        if (!identifierHash) {
          return NextResponse.json({ error: 'Identitas login tidak valid' }, { status: 400 });
        }
        const { data: employees, error: employeeError } = await supabaseAdmin
          .from('employees')
          .select('nik,nik_hash,national_id,national_id_hash,nama,site_name,employment_status')
          .or(`nik_hash.eq.${identifierHash},national_id_hash.eq.${identifierHash}`)
          .ilike('employment_status', 'Aktif')
          .limit(2);
        if (employeeError) {
          console.error('Employee login lookup failed:', employeeError);
          return NextResponse.json({ error: 'Gagal memeriksa data karyawan' }, { status: 500 });
        }
        if (!employees?.length || employees.length > 1) {
          return NextResponse.json({ error: 'NIK Karyawan atau National ID tidak ditemukan' }, { status: 401 });
        }

        const employee = employees[0];
        const employeeData = decryptEmployee(employee);
        const employeeHash = employee.nik_hash || hashField(String(employeeData.nik ?? ''));
        if (!employeeHash) {
          return NextResponse.json({ error: 'Data NIK Karyawan tidak valid' }, { status: 500 });
        }

        let profile: EmployeeLoginProfile | null = null;
        const { data: linkedProfile, error: linkedProfileError } = await supabaseAdmin
          .from('user_profiles')
          .select('id,user_id,role,username,employee_nik_hash')
          .eq('employee_nik_hash', employeeHash)
          .maybeSingle();
        if (linkedProfileError) {
          console.error('Employee profile lookup failed:', linkedProfileError);
          return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });
        }
        profile = linkedProfile;

        if (!profile) {
          const legacyValues = [String(employeeData.nik ?? ''), String(employeeData.national_id ?? '')].filter(Boolean);
          for (const legacyValue of legacyValues) {
            const { data: match, error: legacyError } = await supabaseAdmin
              .from('user_profiles')
              .select('id,user_id,role,username,employee_nik_hash')
              .or(`username.eq."${legacyValue}",national_id.eq."${legacyValue}"`)
              .limit(2);
            if (legacyError) {
              console.error('Legacy employee profile lookup failed:', legacyError);
              return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });
            }
            if (match && match.length > 1) {
              return NextResponse.json({ error: 'Ditemukan lebih dari satu akun untuk karyawan ini. Hubungi administrator.' }, { status: 409 });
            }
            if (match?.[0]) {
              profile = match[0];
              break;
            }
          }
        }

        if (!profile) {
          if (EMPLOYEE_DEFAULT_PASSWORD.length < MIN_PASSWORD_LENGTH) {
            console.error('EMPLOYEE_DEFAULT_PASSWORD belum diatur / kurang dari 8 karakter.');
            return NextResponse.json({ error: 'Login pertama karyawan belum dikonfigurasi. Hubungi administrator.' }, { status: 500 });
          }
          if (password !== EMPLOYEE_DEFAULT_PASSWORD) {
            return NextResponse.json({ error: 'NIK/National ID atau password salah' }, { status: 401 });
          }
          const email = `emp-${employeeHash}@${EMPLOYEE_AUTH_DOMAIN}`;
          const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: EMPLOYEE_DEFAULT_PASSWORD,
            email_confirm: true,
            app_metadata: { must_change_password: true },
          });
          if (createError || !created.user) {
            console.error('Employee auth account creation failed:', createError);
            return NextResponse.json({ error: 'Gagal membuat akun karyawan. Silakan coba kembali atau hubungi administrator.' }, { status: 500 });
          }

          const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert({
              user_id: created.user.id,
              username: email,
              full_name: employeeData.nama || null,
              role: 'employee',
              national_id: employeeData.national_id || null,
              employee_nik_hash: employeeHash,
              site: employeeData.site_name || null,
            });
          if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(created.user.id);
            console.error('Employee profile creation failed:', profileError);
            return NextResponse.json({ error: 'Gagal membuat profil karyawan' }, { status: 500 });
          }
          profile = {
            id: '',
            user_id: created.user.id,
            role: 'employee',
            username: email,
            employee_nik_hash: employeeHash,
          };
        } else if (!profile.employee_nik_hash) {
          const { error: linkError } = await supabaseAdmin
            .from('user_profiles')
            .update({ employee_nik_hash: employeeHash })
            .eq('id', profile.id);
          if (linkError) {
            console.error('Legacy employee profile linking failed:', linkError);
            return NextResponse.json({ error: 'Gagal menghubungkan profil dengan data karyawan' }, { status: 500 });
          }
        }

        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        if (authUserError || !authUser.user?.email) {
          console.error('Employee auth user lookup failed:', authUserError);
          return NextResponse.json({ error: 'Akun karyawan tidak dapat diverifikasi' }, { status: 500 });
        }
        loginEmail = authUser.user.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

      if (error) {
        return NextResponse.json({ error: 'NIK/National ID/email atau password salah' }, { status: 401 });
      }

      // Fetch profile
      let profile = null;
      if (data.user) {
        const { data: pData } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .single();
        profile = pData;
      }
      if (!profile) {
        return NextResponse.json({ error: 'Profil akun tidak ditemukan. Hubungi administrator.' }, { status: 403 });
      }

      return NextResponse.json({
        session: data.session,
        user: data.user,
        profile,
        mustChangePassword: data.user?.app_metadata?.must_change_password === true,
      });
    }

    if (action === 'change-password') {
      const accessToken = req.headers.get('authorization')?.replace('Bearer ', '')
        || req.cookies.get('sb-access-token')?.value;
      if (!accessToken || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Sesi atau konfigurasi autentikasi tidak tersedia' }, { status: 401 });
      }
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
      if (userError || !user) {
        return NextResponse.json({ error: 'Sesi tidak valid. Silakan masuk kembali.' }, { status: 401 });
      }
      if (user.app_metadata?.must_change_password !== true) {
        return NextResponse.json({ error: 'Tidak ada penggantian password wajib untuk akun ini' }, { status: 400 });
      }
      const newPassword = String(body.newPassword ?? '');
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json({ error: 'Password baru minimal 8 karakter' }, { status: 400 });
      }
      if (newPassword === EMPLOYEE_DEFAULT_PASSWORD || BLOCKED_PASSWORDS.has(newPassword)) {
        return NextResponse.json({ error: 'Password baru tidak boleh sama dengan password awal' }, { status: 400 });
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
        app_metadata: { ...user.app_metadata, must_change_password: false },
      });
      if (updateError) {
        console.error('Required password update failed:', updateError);
        return NextResponse.json({ error: 'Gagal memperbarui password' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // --- REGISTER (admin only) ---
    if (action === 'register') {
      const { username, password, role, full_name, national_id, site, employee_nik } = body;

      // Verify caller is admin/superuser
      const authInfo = await getSessionRole(req);
      if (!authInfo || authInfo.role !== 'superuser') {
        return NextResponse.json({ error: 'Akses ditolak. Hanya administrator yang dapat mendaftarkan pengguna.' }, { status: 403 });
      }

      // PREVIEW_REGISTER_MOCK: short-circuit in preview mode (no real Supabase)
      const _reqAuthToken = req.headers.get('authorization')?.replace('Bearer ', '');
      if (_reqAuthToken === 'preview-access-token' && process.env.NEXT_PUBLIC_PREVIEW_ROLE) {
        return NextResponse.json({
          success: true,
          message: 'Pengguna berhasil didaftarkan (preview mode — tidak disimpan ke database)',
          userId: 'preview-' + Date.now(),
        });
      }

      if (!username || !password || !role) {
        return NextResponse.json({ error: 'Username, password, dan role wajib diisi' }, { status: 400 });
      }

      const validRoles = ['superuser', 'administrator', 'pic', 'viewer', 'employee'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 });
      }

      if (!employee_nik || typeof employee_nik !== 'string') {
        return NextResponse.json({ error: 'NIK Karyawan wajib dipilih dari data employee' }, { status: 400 });
      }
      const employeeHash = hashField(employee_nik.trim());
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('nik,nama,national_id,site_name')
        .eq('nik_hash', employeeHash)
        .eq('employment_status', 'Aktif')
        .maybeSingle();
      if (!employee) {
        return NextResponse.json({ error: 'NIK Karyawan tidak ditemukan di data employee aktif' }, { status: 400 });
      }
      const employeeData = decryptEmployee(employee);

      // Check if username already exists in profiles
      const { data: emailProfiles, error: emailProfileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id,user_id,role,username,employee_nik_hash')
        .eq('username', username)
        .limit(2);
      if (emailProfileError) {
        return NextResponse.json({ error: 'Gagal memeriksa username' }, { status: 500 });
      }
      const employeeProfileResult = await supabaseAdmin
        .from('user_profiles')
        .select('id,user_id,role,username,employee_nik_hash,full_name,national_id,site')
        .eq('employee_nik_hash', employeeHash)
        .maybeSingle();
      if (employeeProfileResult.error) {
        return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });
      }
      let employeeProfile = employeeProfileResult.data;
      if (!employeeProfile) {
        const employeeIdentityValues = [String(employeeData.nik ?? ''), String(employeeData.national_id ?? '')].filter(Boolean);
        for (const identityValue of employeeIdentityValues) {
          const { data: legacyProfiles, error: legacyProfileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id,user_id,role,username,employee_nik_hash,full_name,national_id,site')
            .or(`username.eq."${identityValue}",national_id.eq."${identityValue}"`)
            .limit(2);
          if (legacyProfileError) {
            return NextResponse.json({ error: 'Gagal memeriksa akun karyawan' }, { status: 500 });
          }
          if (legacyProfiles && legacyProfiles.length > 1) {
            return NextResponse.json({ error: 'Karyawan ini terhubung ke beberapa akun. Hubungi administrator.' }, { status: 409 });
          }
          if (legacyProfiles?.[0]) {
            employeeProfile = legacyProfiles[0];
            break;
          }
        }
      }
      const usernameConflict = emailProfiles?.some(profile => profile.id !== employeeProfile?.id);
      if (usernameConflict || (emailProfiles?.length && !employeeProfile)) {
        return NextResponse.json({ error: 'Username sudah terdaftar' }, { status: 409 });
      }

      if (employeeProfile) {
        if (employeeProfile.role !== 'employee') {
          return NextResponse.json({ error: 'Karyawan ini sudah memiliki akun dengan role lebih tinggi' }, { status: 409 });
        }
        const oldProfile = {
          username: employeeProfile.username,
          full_name: employeeProfile.full_name,
          role: employeeProfile.role,
          national_id: employeeProfile.national_id,
          employee_nik_hash: employeeProfile.employee_nik_hash || null,
          site: employeeProfile.site,
        };
        const { error: updateProfileError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            username,
            full_name: employeeData.nama || full_name || null,
            role,
            national_id: employeeData.national_id || national_id || null,
            employee_nik_hash: employeeHash,
            site: employeeData.site_name || (role === 'pic' ? (site || null) : null),
          })
          .eq('id', employeeProfile.id);
        if (updateProfileError) {
          return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
        }
        const { data: existingAuthUser, error: existingAuthError } = await supabaseAdmin.auth.admin.getUserById(employeeProfile.user_id);
        if (existingAuthError || !existingAuthUser.user) {
          await supabaseAdmin.from('user_profiles').update(oldProfile).eq('id', employeeProfile.id);
          return NextResponse.json({ error: 'Akun karyawan tidak dapat diverifikasi' }, { status: 500 });
        }
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(employeeProfile.user_id, {
          email: username,
          password,
          email_confirm: true,
          app_metadata: { ...existingAuthUser.user.app_metadata, must_change_password: false },
        });
        if (updateAuthError) {
          await supabaseAdmin.from('user_profiles').update(oldProfile).eq('id', employeeProfile.id);
          return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          message: 'Akun Employee berhasil ditingkatkan. Role lama telah diganti.',
          userId: employeeProfile.user_id,
        });
      }

      // Create auth user via admin API
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: username,
        password,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        return NextResponse.json({ error: createError?.message || 'Gagal membuat pengguna' }, { status: 500 });
      }

      // Insert profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: newUser.user.id,
          username,
          full_name: employeeData.nama || full_name || null,
          role,
          national_id: employeeData.national_id || national_id || null,
          employee_nik_hash: employeeHash,
          site: employeeData.site_name || (role === 'pic' ? (site || null) : null),
        });

      if (profileError) {
        // Rollback: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Pengguna berhasil didaftarkan',
        userId: newUser.user.id,
      });
    }

    // --- LOGOUT ---
    if (action === 'logout') {
      const authHeader = req.headers.get('authorization');
      let accessToken = authHeader?.replace('Bearer ', '');
      if (!accessToken) {
        const cookie = req.cookies.get('sb-access-token')?.value;
        if (cookie) accessToken = cookie;
      }

      if (accessToken) {
        // Set the session on the server client and sign out
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// GET /api/auth/session
export async function GET(req: NextRequest) {
  try {
    const authInfo = await getSessionRole(req);
    if (!authInfo) {
      return NextResponse.json({ user: null, profile: null, role: null });
    }
    return NextResponse.json({
      user: authInfo.user,
      profile: authInfo.profile,
      role: authInfo.role,
    });
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
