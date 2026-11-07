// ============================================================
// Query Safety — sanitasi nilai yang masuk ke filter PostgREST
// ============================================================
//
// MENGAPA MODUL INI ADA
// ----------------------------------------------------------------
// Aplikasi ini tidak memakai SQL mentah; semua akses lewat supabase-js.
// Namun supabase-js meneruskan string filter `.or(...)`, `.filter(...)`,
// dan `.not(...)` APA ADANYA ke PostgREST, dan PostgREST MEMPARSE string
// itu sebagai bahasa filter mini: koma memisahkan kondisi, tanda kurung
// membuka grup logika, titik memisahkan kolom dari operator, dan tanda
// kutip ganda menutup nilai.
//
// Artinya `q.or(\`nama.ilike.%${input}%\`)` dapat disuntik:
//   input = 'x%,role.eq.admin'  -> menambah kondisi `role.eq.admin`
// sehingga penyerang bisa melebarkan hasil pencarian melewati batas
// site/role, atau memancing error yang membocorkan struktur tabel.
//
// Ini adalah SQL injection pada lapisan filter (PostgREST), bukan pada
// driver database. Karena itu pertahanannya bukan prepared statement,
// melainkan MENGHAPUS karakter kontrol sintaks filter dari input.
//
// ATURAN
// ----------------------------------------------------------------
//  • Nilai yang boleh masuk filter hanya huruf, angka, spasi, dan tanda
//    baca yang tidak bermakna bagi PostgREST.
//  • Hash HMAC (hex 64 karakter) divalidasi bentuknya sebelum dipakai.
//  • Pola LIKE (`%`, `_`, `\`) di-escape agar tidak jadi wildcard liar.

/** Karakter yang bermakna sintaks PostgREST dan wajib dibuang. */
const POSTGREST_SYNTAX_CHARS = /[(),."\\:*!<>=\[\]{}|&;+\n\r\t]/g;

/** Karakter kontrol (0x00–0x1F) dan DEL. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Membersihkan satu nilai agar aman dipakai di dalam string filter
 * PostgREST (`.or()`, `.filter()`, `.not()`).
 *
 * Contoh:
 *   sanitizeFilterValue('Budi, S.Pd')      -> 'Budi S.Pd'
 *   sanitizeFilterValue('x%,role.eq.admin') -> 'x roleeqadmin'
 *
 * Panjang dibatasi agar payload raksasa tidak membebani parser.
 */
export function sanitizeFilterValue(input: unknown, maxLength = 120): string {
  if (input == null) return '';
  const text = String(input)
    .replace(CONTROL_CHARS, ' ')
    .replace(POSTGREST_SYNTAX_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxLength);
}

/**
 * Membersihkan istilah pencarian yang akan dipakai sebagai pola LIKE.
 * Karakter wildcard LIKE (`%`, `_`) dan escape (`\`) dibuang supaya
 * pengguna tidak bisa memaksa pencarian seluruh tabel.
 */
export function sanitizeSearchTerm(input: unknown, maxLength = 120): string {
  return sanitizeFilterValue(input, maxLength)
    .replace(/[%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * true bila nilai berbentuk hash HMAC-SHA256 yang sah (hex 64 karakter).
 *
 * Hash dihitung di server dari input pengguna, jadi seharusnya selalu
 * aman. Validasi ini adalah lapisan pertahanan kedua: bila suatu saat
 * hash kosong/gagal dibuat, nilai kosong TIDAK boleh masuk ke filter
 * karena `eq.` tanpa nilai akan mengubah arti filter.
 */
export function isSafeHash(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** Hash sah atau null — dipakai pemanggil untuk memutuskan batal query. */
export function safeHash(value: unknown): string | null {
  return isSafeHash(value) ? (value as string) : null;
}

/**
 * Validasi nama kolom sebelum dipakai di `.order()` / `.select()`.
 * Kolom berasal dari kode, bukan pengguna, tetapi daftar putih ini
 * mencegah kolom liar bila nilai suatu saat datang dari parameter.
 */
export function isSafeColumnName(value: unknown): boolean {
  return typeof value === 'string' && /^[a-z_][a-z0-9_]{0,62}$/.test(value);
}

/**
 * Membatasi nilai numerik yang datang dari query string, sehingga
 * `.range()` / `.limit()` tidak menerima NaN atau angka negatif.
 */
export function safeInt(value: unknown, fallback: number, min = 0, max = 1_000_000): number {
  if (value === null || value === undefined) return fallback;
  // Number('') === 0, jadi string kosong harus ditolak lebih dulu — kalau
  // tidak, parameter yang tidak dikirim akan terbaca sebagai 0 (bukan default).
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
