// ============================================================
// Perlindungan SQL / filter injection
// ============================================================
//
// Aplikasi ini TIDAK menulis SQL mentah. Semua akses data lewat Supabase
// (PostgREST), yang selalu memakai parameter terikat untuk `.eq()`, `.in()`,
// `.insert()`, `.update()` dsb., jadi pola klasik `' OR 1=1 --` tidak bisa
// mengubah query.
//
// Celah yang NYATA pada aplikasi Supabase adalah string filter yang dirakit
// manual: `.or('a.eq.' + x)`, `.ilike('nama', '%' + x + '%')`. Kalau x memuat
// koma, kurung, atau tanda kutip, penyerang bisa menambah kondisi filter
// (mis. `x",role.eq."superuser`) atau memakai wildcard `%` `_` untuk menyedot
// data. Modul ini menutup celah itu secara struktural:
//
//   1. Nilai yang masuk filter selalu dibersihkan / dikutip / di-escape.
//   2. Nama kolom & tabel dinamis hanya boleh berupa identifier aman.
//   3. Lapisan tambahan (defense in depth): detektor pola serangan yang
//      dipakai proxy.ts untuk menolak query string yang jelas berbahaya.
//
// Detektor (3) adalah heuristik, BUKAN pengganti (1) dan (2).

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/i;
const HEX_DIGEST = /^[0-9a-f]{32,128}$/i;

/** Karakter kontrol (termasuk NUL) yang tidak pernah sah di input teks. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Membersihkan kata pencarian bebas (nama, departemen, dst.).
 * Hanya huruf, angka, spasi, apostrof, titik, dan tanda hubung yang lolos.
 * Koma, kurung, kutip ganda, titik koma, garis miring, dan wildcard LIKE
 * (% _ \) dibuang karena semuanya bermakna khusus di filter PostgREST.
 */
export function sanitizeSearchTerm(input: unknown, maxLength = 64): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(/[^\p{L}\p{N}\s'.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Escape wildcard LIKE/ILIKE agar `%` dan `_` dibaca sebagai huruf biasa. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Mengutip satu nilai untuk dipakai DI DALAM string filter `.or()`/`.and()`.
 * PostgREST membaca "..." sebagai satu nilai utuh, sehingga koma dan kurung
 * di dalamnya tidak lagi memisahkan kondisi. Backslash dan kutip ganda
 * di-escape supaya nilai tidak bisa keluar dari kutipnya.
 */
export function postgrestQuote(value: string): string {
  const clean = value.replace(CONTROL_CHARS, '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${clean}"`;
}

/** Nama kolom/tabel dinamis: hanya identifier SQL sederhana. */
export function assertIdentifier(name: string): string {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Identifier tidak valid: ${JSON.stringify(String(name).slice(0, 40))}`);
  }
  return name;
}

/** true bila string berupa digest hex (hasil HMAC/SHA) yang aman dimasukkan ke filter. */
export function isHexDigest(value: unknown): value is string {
  return typeof value === 'string' && HEX_DIGEST.test(value);
}

/** Kondisi `kolom.eq."nilai"` untuk `.or()`. Nilai dikutip dan di-escape. */
export function orEq(column: string, value: string): string {
  return `${assertIdentifier(column)}.eq.${postgrestQuote(value)}`;
}

/**
 * Kondisi `kolom.ilike."%kata%"` untuk `.or()`. Kata dibersihkan dahulu,
 * lalu wildcard di dalamnya di-escape; `%` pembuka/penutup ditambahkan di sini.
 * Mengembalikan null bila kata kosong setelah dibersihkan.
 */
export function orContains(column: string, term: unknown): string | null {
  const clean = sanitizeSearchTerm(term);
  if (!clean) return null;
  return `${assertIdentifier(column)}.ilike.${postgrestQuote(`%${escapeLikePattern(clean)}%`)}`;
}

/** Pola untuk `.ilike()`/`.like()` langsung (tanpa .or): "%kata%" yang aman. */
export function containsPattern(term: unknown): string | null {
  const clean = sanitizeSearchTerm(term);
  return clean ? `%${escapeLikePattern(clean)}%` : null;
}

/** Daftar nilai untuk `kolom.in.(a,b,c)`: hanya digest hex yang diterima. */
export function inHexList(column: string, values: string[]): string {
  const safe = values.filter(isHexDigest);
  return `${assertIdentifier(column)}.in.(${safe.join(',')})`;
}

// ────────────────────────────────────────────────────────────
// Detektor pola serangan (defense in depth)
// ────────────────────────────────────────────────────────────

const ATTACK_PATTERNS: RegExp[] = [
  /\bunion\b[\s\S]{0,40}\bselect\b/i,
  /\bselect\b[\s\S]{0,80}\bfrom\b[\s\S]{0,60}\b(information_schema|pg_catalog|pg_shadow|auth\.users|pg_user)\b/i,
  /['"`)]\s*(or|and)\s+['"`(]?\s*\d+\s*['"`)]?\s*[=<>]\s*['"`(]?\s*\d+/i,
  /['"`]\s*(or|and)\s+['"`][^'"`]*['"`]\s*=\s*['"`]/i,
  /;\s*(drop|alter|truncate|delete|insert|update|create|grant|revoke|copy)\b/i,
  /\b(pg_sleep|sleep|benchmark|waitfor\s+delay)\s*\(/i,
  /\b(xp_cmdshell|load_file|into\s+(out|dump)file|lo_import|pg_read_file|copy\s+\w+\s+from\s+program)\b/i,
  /\bexec(ute)?\s*(\(|\s+sp_|\s+xp_)/i,
  /\/\*[\s\S]*?\*\//,
  /\b(information_schema|pg_catalog)\b/i,
  // Injeksi operator PostgREST: menyisipkan kondisi baru ke parameter filter.
  /[",]\s*[a-z_]+\.(eq|neq|like|ilike|in|is|gt|gte|lt|lte|or|and|not)\./i,
];

/** true bila teks cocok dengan pola serangan SQL/filter yang lazim. */
export function looksLikeSqlInjection(text: string): boolean {
  if (!text) return false;
  let decoded = text;
  // Dekode berlapis supaya %2527 / %27 / + tidak menyembunyikan serangan.
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(decoded.replace(/\+/g, ' '));
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  decoded = decoded.replace(CONTROL_CHARS, ' ');
  return ATTACK_PATTERNS.some((pattern) => pattern.test(decoded));
}

/** Memeriksa semua nilai string di objek/array bersarang (maks. kedalaman 6). */
export function containsSqlInjection(value: unknown, depth = 0): boolean {
  if (depth > 6 || value == null) return false;
  if (typeof value === 'string') return looksLikeSqlInjection(value);
  if (Array.isArray(value)) return value.some((item) => containsSqlInjection(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => containsSqlInjection(item, depth + 1));
  }
  return false;
}
