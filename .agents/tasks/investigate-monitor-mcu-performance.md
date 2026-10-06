# Findings Report: monitor_mcu Timeout & Dashboard Performance

## Summary Answer

**Problem 1 (timeout):** The `monitor_mcu` VIEW is a three-table CTE JOIN (`employees` × `mcu_records` × `mcu_schedules`) with an `OR` join condition on two hash columns. The dashboard API fires ALL pagination queries simultaneously via `Promise.all`, creating N concurrent heavy queries against Supabase — each query re-runs the entire CTE. On a dataset with thousands of active-mining employees this reliably hits the 8-second statement timeout. The fix is **sequential pagination** (already exists as a pattern in `schedule/route.ts`) plus eliminating the redundant `COUNT(*)` pre-flight query.

**Problem 2 (slow charts):** The shared `MCUDashboardShared.tsx` module-level cache **does work** correctly and prevents duplicate fetches across `MonitoringMCU` and `HasilTindakLanjutMCU` when they mount simultaneously. The bottleneck is entirely the API route taking too long to execute, not duplicated frontend requests. Once Problem 1 is fixed, chart loading will be much faster. A lightweight aggregate endpoint would further reduce payload for the charts.

---

## Problem 1: Statement Timeout — Root Cause

### 1a. The VIEW is a heavy 3-table CTE JOIN

File: `local-only/non-runtime/supabase/migrations/010_mcu_dashboard_view.sql`

The `monitor_mcu` VIEW consists of four CTEs:

```sql
-- CTE 1: manpower — full scan of employees with WHERE filters on 3 TEXT columns
WITH manpower AS (
  SELECT ... FROM public.employees e
  WHERE lower(coalesce(e.division, '')) = 'mining'
    AND lower(coalesce(e.employment_status, '')) = 'aktif'
    AND lower(coalesce(e.employee_status, '')) IN ('pkwt', 'permanen')
    AND e.site_name IS NOT NULL
),
-- CTE 2: ranked_records — LEFT JOIN employees → mcu_records with OR condition
ranked_records AS (
  SELECT ... FROM manpower e
  LEFT JOIN public.mcu_records r
    ON (
      (e.nik_hash IS NOT NULL AND r.nik_karyawan_hash = e.nik_hash)
      OR (e.national_id_hash IS NOT NULL AND r.national_id_hash = e.national_id_hash)
    )
   AND (lower(coalesce(r.status_mcu, '')) LIKE '%pre%'
     OR lower(coalesce(r.status_mcu, '')) LIKE '%ann%')
),
-- CTE 3: record_history — GROUP BY + COUNT FILTER aggregation
record_history AS ( ... GROUP BY employee_id ),
-- Final SELECT: re-joins all CTEs + LEFT JOIN mcu_schedules
SELECT ... FROM manpower e
JOIN record_history h ON ...
LEFT JOIN ranked_records l ON ...
LEFT JOIN public.mcu_schedules s ON s.nik_karyawan_hash = e.nik_hash;
```

**Why this is slow:**

1. **`lower(coalesce(e.division, '')) = 'mining'`** and the similar `employment_status`/`employee_status` filters use function expressions — PostgreSQL cannot use the plain `employees_employment_status_idx` index for these `lower(coalesce(...))` patterns. This causes a full sequential scan of `employees`.

2. **OR join condition on `mcu_records`** — `ON (nik_hash = X OR national_id_hash = Y)`. An OR across two columns cannot use a single composite index. PostgreSQL must either do a bitmap OR scan of the two separate indexes or a full hash join.

3. **`LIKE '%pre%'` and `LIKE '%ann%'`** in the JOIN condition — these are unanchored LIKE patterns, defeating any B-tree index on `status_mcu`.

4. **No index covers** the `lower(coalesce(...))` pattern on `employees.division`, `employees.employment_status`, or `employees.employee_status`. The indexes created in `000_employees.sql` are plain B-tree on the raw column value (`employment_status_idx`), which PostgreSQL won't use with `lower(coalesce(...))`.

5. The `mcu_schedules` LEFT JOIN uses `s.nik_karyawan_hash = e.nik_hash`. `mcu_schedules.nik_karyawan_hash` has a UNIQUE constraint (from `002_mcu_schedule.sql`) which serves as an index — this join is efficient.

### 1b. `Promise.all` makes the timeout far worse

File: `src/app/api/mcu/dashboard/route.ts`, function `fetchAllMonitorMcuRows` (lines 101–133)

```typescript
const { count, error: countError } = await client
  .from('monitor_mcu')
  .select('employee_id', { count: 'exact', head: true });  // Query 1: COUNT(*) — re-runs entire CTE

const promises = [];
for (let from = 0; from < total; from += PAGE_SIZE) {  // PAGE_SIZE = 1000
  promises.push(
    client.from('monitor_mcu').select(SELECT_FIELDS).order('site').range(from, from + PAGE_SIZE - 1)
  );
}
const results = await Promise.all(promises);  // N queries fired simultaneously
```

For 3,000 employees this fires **4 queries simultaneously** (1 COUNT + 3 data pages), each of which re-executes the full CTE. Supabase's per-connection statement timeout (default 8s) applies to each query individually, but 4 concurrent queries on a shared connection pool cause:
- Each query competes for the same underlying table read I/O
- The 3-table CTE aggregation is re-run 4 times concurrently
- Total DB load = 4× what sequential would be, causing slowdowns that cascade into timeouts

The `schedule/route.ts` already uses sequential pagination correctly (lines 42–50):
```typescript
async function fetchAllRows(fetchPage) {
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}
```

### 1c. Redundant COUNT(*) pre-flight

The `COUNT(*)` head request on line 106–109 runs the full CTE just to get row count, then the actual data pages re-run it. This is one wasted expensive query that the sequential approach avoids entirely.

---

## Problem 2: Dashboard Chart Data Fetching Assessment

### 2a. Is the module-level cache working?

**Yes — it works correctly.** File: `src/components/dashboard/MCUDashboardShared.tsx` (lines 72–115)

```typescript
let dashboardCache: { rows: MCUDashboardRow[]; savedAt: number } | null = null;
let dashboardRequest: Promise<MCUDashboardRow[]> | null = null;
```

The `dashboardRequest` singleton promise means if `MonitoringMCU` and `HasilTindakLanjutMCU` both call `useMCUDashboardData()` at the same time, only ONE API call is made — the second component awaits the same promise. After completion the `dashboardCache` is populated and subsequent mounts skip the API call entirely (for 5 minutes).

**However**, `RecordMCUTableModern.tsx` (line 111) has its own independent fetch:
```typescript
const response = await fetch('/api/mcu/dashboard', { ... });
```
This component does NOT use `useMCUDashboardData()` — it bypasses the shared cache and makes a separate request. This is a secondary inefficiency but not the primary cause of slowness.

### 2b. Payload size

The `SELECT_FIELDS` string in `route.ts` (line 102) requests 24 columns:
```
employee_id, nama, site, area_raw, client, jabatan, exempt, total_mcu,
mcu_terakhir, kategori_mcu_terakhir, hasil_mcu, perlu_fu, rekomendasi_fu,
item_fu, diagnosa, fram_score, fram_prob, frs_kategori, zona_risiko,
masa_berlaku_mcu, status_mcu, status_follow_up, jadwal_mcu_selanjutnya
```

For 3,000 employees with text-heavy `diagnosa`, `item_fu`, and `rekomendasi_fu` fields, the JSON payload could reach 3–8 MB. This is acceptable since it's cached server-side (5 min TTL in `route.ts`) and client-side.

**The charts only actually use:**
- `MonitoringMCU`: `site`, `area`, `client`, `exempt`, `status_mcu`, `masa_berlaku_mcu`, `jadwal_mcu_selanjutnya`, `mcu_terakhir`
- `HasilTindakLanjutMCU`: `site`, `area`, `client`, `exempt`, `status_follow_up`, `diagnosa`, `hasil_mcu`, `rekomendasi_fu`, `frs_kategori`, `zona_risiko`

A lightweight aggregate API (`/api/mcu/dashboard/summary`) that returns pre-computed counts instead of raw rows would reduce payload by 90%+ for the charts, but is only worth implementing once the timeout is resolved.

---

## Recommended Fixes

### Fix 1 (Critical): Replace `Promise.all` with sequential pagination

**File to modify:** `src/app/api/mcu/dashboard/route.ts`

Replace the `fetchAllMonitorMcuRows` function entirely:

```typescript
async function fetchAllMonitorMcuRows(): Promise<Record<string, unknown>[]> {
  const SELECT_FIELDS = 'employee_id,nama,site,area_raw,client,jabatan,exempt,total_mcu,mcu_terakhir,kategori_mcu_terakhir,hasil_mcu,perlu_fu,rekomendasi_fu,item_fu,diagnosa,fram_score,fram_prob,frs_kategori,zona_risiko,masa_berlaku_mcu,status_mcu,status_follow_up,jadwal_mcu_selanjutnya';
  const PAGE_SIZE = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('monitor_mcu')
      .select(SELECT_FIELDS)
      .order('site', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;  // last page
  }

  return rows;
}
```

**Why this works:**
- Eliminates the `COUNT(*)` pre-flight query (saves one full CTE execution)
- Each page query runs after the previous completes — no concurrent load on the CTE
- Terminates naturally when a page returns fewer than `PAGE_SIZE` rows
- Follows the exact pattern already used in `src/app/api/mcu/schedule/route.ts` (lines 42–50)
- Each individual page query (1,000 rows at a time) should complete well within the 8s timeout

### Fix 2 (Important): Add functional indexes to `employees` table

**File to create:** `local-only/non-runtime/supabase/migrations/011_employees_functional_indexes.sql`

```sql
-- Functional indexes to support the monitor_mcu VIEW's WHERE filters.
-- Without these, every VIEW query performs a full sequential scan of employees.

CREATE INDEX IF NOT EXISTS employees_division_lower_idx
  ON public.employees (lower(division))
  WHERE lower(division) = 'mining';

CREATE INDEX IF NOT EXISTS employees_employment_status_lower_idx
  ON public.employees (lower(employment_status))
  WHERE lower(employment_status) = 'aktif';

CREATE INDEX IF NOT EXISTS employees_employee_status_lower_idx
  ON public.employees (lower(employee_status))
  WHERE lower(employee_status) IN ('pkwt', 'permanen');
```

**Why this works:** PostgreSQL partial functional indexes allow the planner to use index scans for `lower(coalesce(e.division, '')) = 'mining'` patterns when the `lower()` function is indexed. This converts the `manpower` CTE from a full table scan to an index scan — the most expensive step in the VIEW.

### Fix 3 (Important): Add a functional index on `mcu_records.status_mcu`

**File:** Same `011_employees_functional_indexes.sql`

```sql
-- Functional index for the LIKE '%pre%' / '%ann%' pattern in ranked_records CTE.
-- An unanchored LIKE pattern cannot use a standard B-tree index.
-- pg_trgm GIN index can accelerate ILIKE/LIKE patterns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS mcu_records_status_mcu_trgm_idx
  ON public.mcu_records USING gin (status_mcu gin_trgm_ops);
```

**Why:** The `ranked_records` CTE filters `mcu_records` with `lower(...status_mcu...) LIKE '%pre%' OR ... LIKE '%ann%'`. A trigram GIN index enables PostgreSQL to use an index scan for unanchored LIKE patterns.

### Fix 4 (Secondary): Make `RecordMCUTableModern.tsx` use the shared cache

**File to modify:** `src/components/dashboard/RecordMCUTableModern.tsx`

The `loadMonitor` function (around line 108–117) currently makes an independent fetch, bypassing the module-level cache in `MCUDashboardShared.tsx`. Replace it with `preloadMCUDashboardData()`:

```typescript
// Before (bypasses cache):
const response = await fetch('/api/mcu/dashboard', { ... });
const json = await response.json();
setMonitorRows(json.employees || []);

// After (uses shared cache):
import { preloadMCUDashboardData } from '@/components/dashboard/MCUDashboardShared';
// ...
const rows = await preloadMCUDashboardData();
setMonitorRows(rows);
```

This ensures that if the admin page has already loaded the dashboard charts, switching to the Monitor tab costs zero additional API calls.

---

## Parallel vs Sequential Pagination — Does It Matter?

**Yes, significantly.** The `monitor_mcu` VIEW is not a simple table read — every query re-executes the full 3-table CTE aggregation from scratch. Running N=4 concurrent executions of this CTE:

- Each execution needs to read all active-mining employees from `employees`
- Each execution needs to aggregate all matching rows from `mcu_records`
- Each execution needs to LEFT JOIN `mcu_schedules`
- All 4 run simultaneously, competing for the same disk/buffer cache

Sequential execution: 4 × T_one_page, but each page can reuse the OS page cache from the previous — total wall-clock time is roughly linear.  
Parallel execution: all 4 start cold simultaneously — total resource demand is 4×, timeout risk is maximal.

The sequential approach trades away concurrency (which does not help here since all queries hit the same tables) for reliability and predictability.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/mcu/dashboard/route.ts` | Replace `fetchAllMonitorMcuRows` — remove `Promise.all`, use sequential loop (Fix 1) |
| `src/components/dashboard/RecordMCUTableModern.tsx` | Replace `loadMonitor` fetch with `preloadMCUDashboardData()` call (Fix 4) |
| `local-only/non-runtime/supabase/migrations/011_employees_functional_indexes.sql` | **Create new** — add functional indexes on `employees` and trigram index on `mcu_records.status_mcu` (Fixes 2 & 3) |

The Supabase migrations must be applied via the Supabase Dashboard SQL editor or `supabase db push` against the hosted project. The API route change is a pure TypeScript edit with no schema dependency.

---

## Priority Order

1. **Fix 1 (route.ts sequential pagination)** — eliminates the timeout immediately, zero schema dependency, can be deployed right away.
2. **Fix 2 + 3 (indexes)** — reduces per-query execution time from several seconds to sub-second for the `manpower` CTE scan. Apply to Supabase after Fix 1 is live.
3. **Fix 4 (RecordMCUTableModern cache)** — secondary optimization, eliminates one redundant API call when the admin opens the Monitor tab.
