import { parseExcelDate } from './lib/excel-date.mjs';

const cases = [
  ['9 February 2026', '2026-02-09'],
  ['11 Mar 26', '2026-03-11'],
  ['03/01/2026', '2026-01-03'],   // dd/mm (Indonesia)
  ['05/03/2026', '2026-03-05'],
  ['1/2/27', '2027-02-01'],
  ['2026-01-02', '2026-01-02'],
  ['1/2/2027', '2027-02-01'],
  ['12/31/2026', '2026-12-31'],   // unambiguously mm/dd
  ['February 9, 2026', '2026-02-09'],
  ['Feb 9 2026', '2026-02-09'],
  ['2026-01-02T10:30:00', '2026-01-02'],
  ['31/12/2026', '2026-12-31'],
  ['29/2/2024', '2024-02-29'],     // leap year
  ['30/2/2025', null],             // tidak valid
  ['N/A', null],
  ['', null],
  [null, null],
];
let bad = 0;
for (const [inp, want] of cases) {
  const got = parseExcelDate(inp);
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${JSON.stringify(inp).padEnd(24)} → ${String(got).padEnd(12)} (want ${want})`);
}

// cross-check vs new Date() untuk spotting regresi
console.log('\n=== Bandingkan dengan new Date() ===');
for (const s of ['9 February 2026', '11 Mar 26', '03/01/2026']) {
  const legacy = new Date(s);
  console.log(`  ${s.padEnd(18)} lama=${legacy.toISOString().slice(0, 10)}  baru=${parseExcelDate(s)}`);
}
console.log(`\n${bad} gagal`);
process.exit(bad ? 1 : 0);