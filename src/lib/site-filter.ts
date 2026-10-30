// ============================================================
// Filter site "Batch"
// ============================================================
//
// ATURAN OPERASIONAL
// Site yang mengandung kata "Batch" (mis. "Batch 33", "Batch 34") berisi
// calon karyawan yang belum tentu menjadi karyawan. Mereka TIDAK boleh ikut
// dihitung pada data dashboard, zonasi, maupun ProKawan.
//
// DITERAPKAN DI SERVER, bukan di komponen. Alasannya: bila filter hanya ada di
// UI, angka yang dikirim API tetap memuat mereka dan dashboard mana pun yang
// lupa memfilter akan menampilkan total yang salah.
//
// CATATAN: filter ini TIDAK menghapus data. Record tetap ada di database dan
// tetap bisa dicari di Review MCU untuk keperluan administratif — hanya tidak
// diikutkan pada perhitungan agregat.

/** true bila site berisi calon karyawan (Batch) dan harus dikecualikan. */
export function siteBatch(site: unknown): boolean {
  return /batch/i.test(String(site ?? ''));
}

/** true bila record layak dihitung pada dashboard. */
export function siteDihitung(site: unknown): boolean {
  const s = String(site ?? '').trim();
  if (!s) return false;
  return !siteBatch(s);
}

/**
 * Menyaring array baris berdasarkan kolom site.
 * Nama kolom bisa berbeda (`site`, `site_name`, `jobsite`) — pemanggil
 * menentukan sendiri lewat `pick`.
 */
export function tanpaBatch<T>(rows: T[], pick: (row: T) => unknown): T[] {
  return rows.filter((r) => siteDihitung(pick(r)));
}
