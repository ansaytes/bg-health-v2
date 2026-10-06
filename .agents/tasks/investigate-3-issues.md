# Investigation Report: 3 Issues in bg-health-v2

**Date:** Investigation run on current codebase  
**Status:** READ-ONLY — no code changed

---

## Summary

| # | Issue | Root Cause | Fix Complexity |
|---|-------|-----------|----------------|
| 1 | Dosis dropdown shows deleted `2x1 Sesudah Makan` | `DEFAULT_DOSIS` hardcode in `KunjunganBerobatForm.tsx` is used as fallback initial state AND as the merge source in the API — so deleting from Supabase still leaves it in the hardcoded array | Small: remove `2x1 Sesudah Makan` from two constant arrays |
| 2 | NIK Karyawan shown un-decrypted in Tabel Monitor | `employee_id` in `monitor_mcu` is `employees.id` (UUID) — not NIK. The actual `nik_karyawan` column is in the VIEW but **not included** in `SELECT_FIELDS` in `/api/mcu/dashboard/route.ts`. So `employee_id` (UUID) is shown in the table instead of the plaintext NIK | Medium: add `nik_karyawan` to `SELECT_FIELDS`, add it to `MCU_SENSITIVE_FIELDS`, display that column instead of `employee_id` |
| 3 | Column filter feature needed for both MCU tables | Neither table has per-column filtering; only a single NIK/Nama search field exists. No other table in the project uses inline column header filters, but the Kunjungan dashboard uses `admin-filter-select` dropdowns. | Medium: add a collapsible filter-chip row above each table |

---

## Issue 1: Dosis Dropdown Still Shows Deleted Value

### Root Cause

**File:** `src/components/administrator/KunjunganBerobatForm.tsx`

The component has a **hardcoded** `DEFAULT_DOSIS` constant (lines 44–57) that includes `'2x1 Sesudah Makan'`:

```typescript
const DEFAULT_DOSIS = [
  '3DD1',
  '2DD1',
  '1DD1',
  '4DD1',
  '2TAB/BAB',
  'K/P',
  'Q4H',
  '4QH',
  '1x1 Sesudah Makan',
  '2x1 Sesudah Makan',   // ← THIS IS THE PROBLEM
  '3x1 Sesudah Makan',
];
```

This array is used as the initial value for `masterDosis` state (line 94):
```typescript
const [masterDosis, setMasterDosis] = useState<string[]>(DEFAULT_DOSIS);
```

The `useEffect` that fetches from `/api/dosis` only replaces this state if the fetch returns a non-empty array. But the **API itself also hardcodes the same list** as `INITIAL_DOSIS` in `src/app/api/dosis/route.ts` (lines 13–26):

```typescript
const INITIAL_DOSIS = [
  ...
  '2x1 Sesudah Makan',  // ← ALSO HERE
  ...
];
```

The API's `GET` handler then does:
```typescript
const combined = Array.from(new Set([...INITIAL_DOSIS, ...dbCodes]));
```

So even if the user deletes `2x1 Sesudah Makan` from the `dosis_obat` Supabase table, it's permanently in `INITIAL_DOSIS` and **always gets merged back into the combined result**. The deletion in Supabase has zero effect.

### Exact Fix

**File 1:** `src/app/api/dosis/route.ts` — remove `'2x1 Sesudah Makan'` from `INITIAL_DOSIS`, and also change the GET logic to **only return database values** (with INITIAL_DOSIS as fallback only when the table is empty/errors):

The current logic `const combined = Array.from(new Set([...INITIAL_DOSIS, ...dbCodes]))` always merges hardcoded values. It should instead use `INITIAL_DOSIS` only when `dbCodes` is empty (i.e., table is empty):
```typescript
// In GET handler:
const dbCodes = (data || []).map(...).filter(Boolean);
// Only use fallback if table is genuinely empty
const result = dbCodes.length > 0 ? dbCodes : INITIAL_DOSIS;
return NextResponse.json({ success: true, data: result });
```

**File 2:** `src/components/administrator/KunjunganBerobatForm.tsx` — remove `'2x1 Sesudah Makan'` from `DEFAULT_DOSIS` (line 54), and ensure the component always replaces state with the API response, not merges:
```typescript
// Change this:
if (json.success && Array.isArray(json.data) && json.data.length > 0) {
  setMasterDosis(json.data);  // Already correct — just overrides DEFAULT_DOSIS
}
```
The `setMasterDosis(json.data)` call already replaces the default. So the fix is: (a) remove `2x1 Sesudah Makan` from `DEFAULT_DOSIS`, and (b) fix the API to not force-merge `INITIAL_DOSIS` with DB data.

---

## Issue 2: NIK Karyawan Shown Without Decryption in MCU Tables

### Tab 1: Record MCU — `nik_karyawan` column

**File:** `src/app/api/mcu/records/route.ts`

This tab IS correctly decrypted. `nik_karyawan` is in `MCU_SENSITIVE_FIELDS` in `encryption.ts`, and `decryptMCURecord()` is called on every record before returning. This tab's NIK display is **correct**.

However, one edge case exists: when `record.national_id_hash === record.nik_karyawan_hash`, the API overwrites with the employee table NIK lookup — also correctly decrypted via `decryptEmployee()`. So `nik_karyawan` is reliably decrypted in the Record MCU tab.

**Conclusion for Tab 1:** No bug — encryption is correctly handled in `/api/mcu/records`.

### Tab 2: Tabel Monitor — `employee_id` column

This is the real problem. Two separate issues compound:

**Issue 2a: `employee_id` is a UUID, not a NIK**

The `monitor_mcu` VIEW (`010_mcu_dashboard_view.sql` line 21 and 102):
```sql
WITH manpower AS (
  SELECT
    e.id AS employee_id,   -- ← This is uuid PRIMARY KEY, NOT NIK
    e.nik,                  -- ← This IS the NIK (encrypted)
    ...
```

The VIEW exposes `employee_id` (UUID of the employee row) as the first column. The component (`RecordMCUTableModern.tsx` line 229) maps `employee_id` to label `nik_karyawan`:
```typescript
const monitorColumns = useMemo(() => [
  { key: 'employee_id', label: 'nik_karyawan' },  // UUID displayed as NIK label
  ...
```

So the column is displaying a UUID and calling it NIK. A UUID like `3f2e4a1b-...` is neither NIK nor encrypted text — it's just the wrong field.

**Issue 2b: The VIEW also outputs `nik_karyawan` but it's not fetched**

The VIEW SELECT (line 103) does produce:
```sql
coalesce(l.nik_karyawan, e.nik) AS nik_karyawan,
```

This `nik_karyawan` column contains the **encrypted** NIK (from `mcu_records.nik_karyawan` which is AES-256-GCM encrypted, or `employees.nik` also encrypted). The VIEW output for `nik_karyawan` is ciphertext.

**Issue 2c: `nik_karyawan` is NOT in `SELECT_FIELDS` in the dashboard API**

`src/app/api/mcu/dashboard/route.ts` line 103:
```typescript
const SELECT_FIELDS = 'employee_id,nama,site,area_raw,client,jabatan,exempt,total_mcu,...';
// nik_karyawan is NOT in this list
```

`nik_karyawan` is never fetched from the view, so there is no encrypted NIK to decrypt.

**Issue 2d: `decryptMCURecord()` is called but `nik_karyawan` is not in the fetched data**

Even though `decryptMCURecord()` is called on each row (`rawRows = fetched.map(decryptMCURecord)`, line 157), `nik_karyawan` is absent from the fetched data, so nothing gets decrypted.

**Issue 2e: `employee_id` is also NOT in `MCU_SENSITIVE_FIELDS`**

`MCU_SENSITIVE_FIELDS = ['national_id', 'nik_karyawan', 'nama', 'link_mcu']`

Even if `employee_id` were passed through `decryptMCURecord()`, it would not be decrypted because it's not in that list. But `employee_id` is just a UUID — it's never encrypted to begin with — it's simply the wrong field.

**Also: `nama` IS in `MCU_SENSITIVE_FIELDS` and IS in `SELECT_FIELDS`** — so employee names are decrypted correctly. Only the NIK field is wrong.

### Exact Fix for Issue 2

**Step 1:** In `src/app/api/mcu/dashboard/route.ts`, add `nik_karyawan` to `SELECT_FIELDS`:
```typescript
const SELECT_FIELDS = 'employee_id,nik_karyawan,nama,site,area_raw,...';
```

**Step 2:** `decryptMCURecord()` already handles `nik_karyawan` — no changes needed to `encryption.ts`. The fetched row will have `nik_karyawan` as encrypted hex, and `decryptMCURecord()` will decrypt it correctly.

**Step 3:** In `src/components/dashboard/RecordMCUTableModern.tsx`, change the `monitorColumns` definition to use `nik_karyawan` instead of `employee_id`:
```typescript
const monitorColumns = useMemo(() => [
  { key: 'nik_karyawan', label: 'nik_karyawan' },  // was: employee_id
  { key: 'nama', label: 'nama' },
  ...
], []);
```

Also update `frozenColumnsMonitor` initial state (line 38):
```typescript
const [frozenColumnsMonitor, setFrozenColumnsMonitor] = useState<string[]>(['nik_karyawan', 'nama']);
// was: ['employee_id', 'nama']
```

And update `COLUMN_WIDTHS` (which already has `employee_id: 130`) — rename key to `nik_karyawan` or add it:
```typescript
nik_karyawan: 130,  // already exists for record tab — monitor tab will reuse it
```

**Step 4:** Also update `filteredMonitorRows` useMemo which currently searches on `employee_id`:
```typescript
// Change:
return monitorRows.filter(r => String(r.employee_id || '').toLowerCase().includes(lower) || ...);
// To:
return monitorRows.filter(r => String(r.nik_karyawan || '').toLowerCase().includes(lower) || ...);
```

---

## Issue 3: Column Filter Feature for Both MCU Tables

### Current State

`RecordMCUTableModern.tsx` currently has:
- A single text search input (searches `nik_karyawan_hash` via backend for Record tab, or filters by `employee_id`/`nama` client-side for Monitor tab)
- A "Bekukan kolom" picker (frozen columns)
- No per-column filtering

No other component in the project implements inline table column filters. The closest patterns are:
- `KunjunganBerobat.tsx` — top-bar filter dropdowns using `admin-filter-select` CSS class (month/week/dept selects)
- `MCUDashboardFilters` in `MCUDashboardShared.tsx` — separate filter bar with site/area/client dropdowns
- `DataManPowerTable.tsx` — filter state vars + dropdown selects in the toolbar

### Recommended UX: Collapsible Filter Chip Row

Given the project's UI pattern of using dropdowns rather than inline table inputs (as seen in KunjunganBerobat and MCUDashboardFilters), the best fit is:

**A collapsible filter panel** that appears below the search/toolbar row, triggered by a "Filter Kolom" button (similar to the existing frozen-column picker). This matches the `mcu-records-toolbar` pattern already in the component and avoids cluttering the table header row.

For the **Tabel Monitor** tab, the most useful filterable columns are:
- `site` — select from unique values (already done in MCUDashboardFilters)
- `zona_risiko` — select: Hijau, Kuning, Merah, Hitam
- `status_mcu` — select: Valid, Expired, No Data, Exempt
- `status_follow_up` — select: Perlu FU, Selesai FU, Belum Review, Tidak Perlu FU, Exempt
- `hasil_mcu` — text search (Fit, Fit With Note, Unfit)

For the **Record MCU** tab (server-side paginated), client-side column filtering won't work across pages. Server-side filtering by additional columns (site, jabatan, status_mcu) would require extending the `/api/mcu/records` API params.

### Exact Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/RecordMCUTableModern.tsx` | Add `columnFilters` state (map of column key → filter value), add "Filter Kolom" toggle button in toolbar, render filter chips row with `<select>` or `<input>` per active filter column, wire `filteredMonitorRows` useMemo to also apply `columnFilters` |
| `src/app/api/mcu/records/route.ts` | (Optional) Accept `site`, `jabatan`, `status_mcu` query params and apply to the Supabase query for server-side filtering on the Record tab |

### Implementation Pattern

```typescript
// State to add in RecordMCUTableModern
const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
const [showColumnFilterPicker, setShowColumnFilterPicker] = useState(false);

// Add to filteredMonitorRows useMemo:
const filteredMonitorRows = useMemo(() => {
  let result = monitorRows;
  if (monitorSearch.trim()) {
    const lower = monitorSearch.toLowerCase();
    result = result.filter(r => 
      String(r.nik_karyawan || '').toLowerCase().includes(lower) ||
      String(r.nama || '').toLowerCase().includes(lower)
    );
  }
  // Apply column filters
  for (const [key, value] of Object.entries(columnFilters)) {
    if (!value) continue;
    result = result.filter(r => 
      String(r[key] || '').toLowerCase().includes(value.toLowerCase())
    );
  }
  return result;
}, [monitorRows, monitorSearch, columnFilters]);
```

The filter UI can be a row of `<select>` elements for enum columns (site, zona_risiko, status_mcu, status_follow_up) and `<input type="text">` for free-text columns (hasil_mcu, jabatan). Options for `<select>` are derived at render time from the loaded `monitorRows` data using `useMemo`.

For the Record MCU tab, since data is paginated server-side, add URL params to the fetch call and extend the API to filter in Supabase. The columns most useful for server-side filtering: `site`, `status_mcu`, `jabatan` (exact match or ILIKE).

---

## Conclusions and Recommended Action Order

1. **Fix dosis dropdown (Issue 1)** — 5 minutes. Remove `'2x1 Sesudah Makan'` from `INITIAL_DOSIS` in `route.ts` and from `DEFAULT_DOSIS` in `KunjunganBerobatForm.tsx`. Change API to not merge hardcoded list with DB results.

2. **Fix NIK decryption in Monitor tab (Issue 2)** — 20 minutes. Add `nik_karyawan` to `SELECT_FIELDS` in dashboard API, change `monitorColumns` to use `nik_karyawan` key instead of `employee_id`, update `frozenColumnsMonitor` and the monitor search filter.

3. **Add column filters (Issue 3)** — 1–2 hours. Add collapsible filter panel for Monitor tab (client-side, no API changes needed). For Record MCU tab, decide whether to do client-side-only (limited to current page) or extend the API (full filtering across all pages).

