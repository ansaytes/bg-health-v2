// Parser tanggal Excel yang benar.
// Masalah pada new Date(str):
//   "9 February 2026" → 2026-02-08  (ofsial 1 hari, V8 quirk)
//   "11 Mar 26"       → 2026-03-10  (2 digit tahun salah dibaca)
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
  jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};
const p2 = (n) => String(n).padStart(2, '0');
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const daysIn = (y, m) => (m === 2 && isLeap(y) ? 29 : DIM[m - 1]);
const valid = (y, m, d) => y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
const fmt = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;

export function parseExcelDate(input) {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : fmt(input.getUTCFullYear(), input.getUTCMonth() + 1, input.getUTCDate());
  if (typeof input === 'number' && isFinite(input)) {
    // Excel serial date (1900 sistem, dengan bug legacy 1900-02-29)
    const ms = Math.round((input - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  const s = String(input).trim().replace(/\s+/g, ' ');
  if (!s) return null;

  // 1) ISO: 2026-01-02 (opsional jam/menit/detik)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const [, y, mo, d] = m.map(Number); return valid(y, mo, d) ? fmt(y, mo, d) : null; }

  // 2) Teks Indonesia/Inggris: "9 February 2026", "11 Mar 26", "1 Jan 2027"
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/);
  if (m) {
    const d = +m[1];
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    let y = +m[3];
    if (y < 100) y += y > 50 ? 1900 : 2000;
    return mo && valid(y, mo, d) ? fmt(y, mo, d) : null;
  }

  // 3) Teks dengan tahun di depan: "February 9, 2026" / "Feb 9 2026"
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const d = +m[2];
    let y = +m[3];
    if (y < 100) y += y > 50 ? 1900 : 2000;
    return mo && valid(y, mo, d) ? fmt(y, mo, d) : null;
  }

  // 4)Slash/dash: dd/mm/yyyy atau mm/dd/yyyy (tentukan lewat validitas)
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    let y = +m[3];
    if (y < 100) y += y > 50 ? 1900 : 2000;
    if (valid(y, b, a)) return fmt(y, b, a);   // dd/mm
    if (valid(y, a, b)) return fmt(y, a, b);   // mm/dd
    return null;
  }

  return null;
}