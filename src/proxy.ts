import { NextRequest, NextResponse } from 'next/server';
import { looksLikeSqlInjection } from '@/lib/sql-safety';

// Penegakan "wajib ganti password" di sisi SERVER.
// Modal PasswordChangeGate hanya UI; tanpa ini akun berpassword awal tetap bisa memanggil API
// langsung dengan access token-nya. Selama flag app_metadata.must_change_password aktif,
// semua endpoint /api/* ditolak kecuali /api/auth (login & ganti password).
//
// Token hanya DIBACA (tanpa verifikasi tanda tangan) untuk memutuskan menolak. Token palsu yang
// mengaku "tidak wajib ganti" tetap gagal di verifikasi Supabase pada masing-masing route.

function mustChangePassword(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))));
    return json?.app_metadata?.must_change_password === true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Lapisan pertahanan tambahan terhadap SQL/filter injection: tolak query string
  // dan path yang jelas memuat pola serangan (UNION SELECT, ' OR 1=1, pg_sleep,
  // sisipan operator PostgREST, dsb.). Ini HEURISTIK; perlindungan utamanya ada
  // di sql-safety.ts (nilai filter selalu dibersihkan dan dikutip, query lain
  // memakai parameter terikat Supabase). Body tidak dipindai di sini agar teks
  // klinis bebas tidak salah blokir; route pencarian memakai sanitizeSearchTerm.
  if (looksLikeSqlInjection(search) || looksLikeSqlInjection(pathname)) {
    console.warn('[security] Permintaan diblokir: pola SQL injection pada URL', pathname);
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  if (pathname === '/api/auth') return NextResponse.next();

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || request.cookies.get('sb-access-token')?.value;
  if (token && mustChangePassword(token)) {
    return NextResponse.json(
      { error: 'Anda harus mengganti password awal terlebih dahulu.', code: 'PASSWORD_CHANGE_REQUIRED' },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
