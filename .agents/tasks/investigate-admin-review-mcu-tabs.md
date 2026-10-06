# Investigation Report: Administrator Review MCU — Monitor MCU Tab

## Summary

The user's three original requests:
1. **Encrypt `nama` in `monitor_mcu`** — `nama` is in `MCU_SENSITIVE_FIELDS` and is already decrypted by `decryptMCURecord`. The **problem** is that `monitor_mcu` is a separate Supabase view/table whose `nama` column is **not encrypted at rest** (only `mcu_records.nama` is encrypted). The dashboard API calls `decryptMCURecord` on raw monitor rows, so when `nama` is already plain text, `decrypt()` returns `null` and falls back to the raw value. No data loss — but `nama` is exposed as plaintext in `monitor_mcu`. To match `mcu_records`, the `monitor_mcu` rows either need to store `nama` encrypted, or the API must handle both cases (a format-detection decrypt would help, but the real fix is at the DB/ETL level that populates `monitor_mcu`).
2. **MCU Record table already has internal tabs** — `RecordMCUTableModern` already renders a two-tab system ("Record MCU" / "Tabel Monitor") internally inside itself. The user did **not** know this exists.
3. **Display Monitor MCU table side-by-side (tab nav) with MCU Record on the Administrator Review MCU page** — The `AdminTogglePanel` in `page.tsx` currently uses a rotating arrow to switch between `ReviewMCU` (form) and `RecordMCUTable` (database). Since `RecordMCUTableModern` already contains both tables as tabs, the user wants these two tables side-by-side as tab nav on the right side — i.e., the existing internal tab widget inside `RecordMCUTableModern` is the right UI but its *configuration* needs to match what the user wants.

---

## Q1 — Files that render the 'Administrator Review MCU' page

**Main page file:** `d:\WebApp\bg-health-v2\src\app\page.tsx`

Key lines:
- **Line 14**: `import ReviewMCU from '@/components/review-mcu/ReviewMCU'`
- **Line 29**: `import RecordMCUTable from '@/components/dashboard/RecordMCUTableModern'`
- **Lines 215–222**: `ADMIN_SIDEBAR` includes `{ key: 'review-mcu', label: 'Review MCU', icon: <IconReviewMCU /> }`
- **Lines 401–410**: `panels['review-mcu']` defines:
  ```js
  'review-mcu': {
    hasTable: true,
    labels: ['Form Input', 'DATABASE'],
    form: <div ...><ReviewMCU /></div>,
    tables: [<div className="admin-form-container" key="mcu"><RecordMCUTable /></div>],
  }
  ```
- **Lines 370–420**: `AdminTogglePanel` component uses a rotating arrow button to cycle through `[form, ...tables]`. Currently **only one table** in the array.

**Component file:** `d:\WebApp\bg-health-v2\src\components\review-mcu\ReviewMCU.tsx`  
This is the left-side form (search → OCR → form) for entering MCU data. It does not contain any table.

---

## Q2 — MCU Record table implementation

**File:** `d:\WebApp\bg-health-v2\src\components\dashboard\RecordMCUTableModern.tsx`

### Already has internal tab system (line ~200–210)
```tsx
const [activeTab, setActiveTab] = useState<'record' | 'monitor'>('record');
```
Two tab buttons rendered at the top of `mcu-records-card`:
- **"Record MCU"** tab
- **"Tabel Monitor"** tab

### "Record MCU" tab
- **API**: `GET /api/mcu/records?page=N&search=...`
- **Auth**: requires `pic | superuser | administrator` role
- **Columns**: all fields from `MCU_FIELDS` (in `src/lib/mcu-fields.ts`), converted to `snake_case`, **excluding** `id`, `created_at`, `updated_at`, `nik_karyawan_hash`, `national_id_hash`, `national_id`/`nationalid`
- **Key display columns** (from `COLUMN_WIDTHS`): `nik_karyawan`, `nama`, `usia`, `jenis_kelamin`, `jabatan`, `site`, `status_mcu`, `tgl_mcu`, `tempat_mcu`, `zonasi`, `perlu_fu`, `link_mcu`, plus all medical fields
- **Pagination**: 100 rows/page, server-side
- **Search**: by hash of NIK only (server-side, via `nik_karyawan_hash` or `national_id_hash`)
- **Features**: freeze columns, expand row detail, edit (admin/superuser), delete (admin/superuser)

### "Tabel Monitor" tab (already exists inside the same component)
- **API**: `GET /api/mcu/dashboard`
- **Columns** (defined at line ~130–145):
  ```
  employee_id → nik_karyawan
  nama        → nama
  site        → site
  area_raw    → area
  client      → client
  jabatan     → jabatan
  total_mcu   → total_mcu
  mcu_terakhir → tgl_mcu_terakhir
  kategori_mcu_terakhir → kategori_mcu
  hasil_mcu   → kes_vendor
  diagnosa    → diagnosa_medis
  zona_risiko → zonasi
  status_mcu  → status_mcu
  status_follow_up → status_fu
  ```
- **Pagination**: client-side, 100 rows/page
- **Search**: by `employee_id` or `nama` (client-side filter)
- **Features**: freeze columns, expand row detail (read-only — no edit/delete)

### `nama` encryption issue in Monitor tab
`decryptMCURecord` decrypts the fields `['national_id', 'nik_karyawan', 'nama', 'link_mcu']`. But `monitor_mcu` stores `nama` as **plaintext** (it's a view/aggregated table, not `mcu_records`). When `decrypt()` receives a plaintext value it fails silently and falls back to the raw value. So `nama` renders correctly, but it's **not encrypted at rest** — this is a data layer issue, not a frontend bug. The `employee_id` column (which maps to NIK) is also stored plaintext in `monitor_mcu` since it's not decrypted by `decryptMCURecord` (the field is named `employee_id`, not `nik_karyawan`). So neither NIK nor nama are actually encrypted in `monitor_mcu`.

---

## Q3 — Tab / nav system on the page

**Yes**, there is a tab-like system — the `AdminTogglePanel` component in `page.tsx` (lines 370–420).

### How it works
- It takes `formContent`, `tableContents[]`, `hasTable`, and `stepLabels`
- Renders a rotating **arrow button** (`.admin-toggle-arrow`) at the bottom of the panel
- Clicking it cycles through: `[form, table1, table2, ...]`
- For `review-mcu`, currently: `['Form Input', 'DATABASE']` → form OR one table

This is **not** a side-by-side tab nav but a single-panel switcher. The user wants the table section to show tab nav with both "Record MCU" and "Monitor MCU" tables side by side as tabs — which is **already the case** inside `RecordMCUTableModern` when you switch to the DATABASE panel.

**Conclusion**: The tab nav already exists *inside* `RecordMCUTableModern` — it renders both "Record MCU" and "Tabel Monitor" tabs. The user may simply not be aware that clicking the arrow shows `RecordMCUTableModern`, which already has both tabs. The only issue is configuration/labeling alignment.

---

## Q4 — What Monitor MCU table needs to display

**Source:** `d:\WebApp\bg-health-v2\src\app\api\mcu\dashboard\route.ts`

### `SELECT_FIELDS` from `monitor_mcu` table (line 102)
```
employee_id, nama, site, area_raw, client, jabatan, exempt,
total_mcu, mcu_terakhir, kategori_mcu_terakhir, hasil_mcu,
perlu_fu, rekomendasi_fu, item_fu, diagnosa, fram_score,
fram_prob, frs_kategori, zona_risiko, masa_berlaku_mcu,
status_mcu, status_follow_up, jadwal_mcu_selanjutnya
```

### API response shape (`json.employees[]`)
Each row in `json.employees` (after `decryptMCURecord` + normalization):
```ts
{
  employee_id: string,        // NIK karyawan (plaintext in monitor_mcu)
  nama: string,               // Nama karyawan (plaintext in monitor_mcu)
  site: string | null,
  area_raw: string,           // raw area value from DB
  area: string,               // normalized: 'Area 1' | 'Area 2' | 'Area 3' | 'HO' | ''
  client: string,             // normalized, default 'PT. BDM'
  jabatan: string | null,
  exempt: boolean,
  total_mcu: number,
  mcu_terakhir: string | null,          // date string
  kategori_mcu_terakhir: string | null,
  hasil_mcu: string | null,
  perlu_fu: string | null,
  rekomendasi_fu: string | null,
  item_fu: string | null,
  diagnosa: string | null,
  fram_score: number | null,
  fram_prob: string | null,
  frs_kategori: string | null,
  zona_risiko: string | null,
  masa_berlaku_mcu: string | null,      // date string
  status_mcu: 'Valid' | 'Expired' | 'No Data' | 'Exempt',
  status_follow_up: 'Perlu FU' | 'Selesai FU' | 'Belum Review' | 'Tidak Perlu FU' | 'Exempt',
  jadwal_mcu_selanjutnya: string | null // date string
}
```

---

## Q5 — Shared types and interfaces

**File:** `d:\WebApp\bg-health-v2\src\components\dashboard\MCUDashboardShared.tsx`

### `MCUDashboardRow` interface (line ~50)
```ts
export interface MCUDashboardRow {
  employee_id: string;
  site: string | null;
  area: string;
  client: string | null;
  jabatan: string | null;
  exempt: boolean;
  total_mcu: number;
  mcu_2024_count: number; mcu_2025_count: number; mcu_2026_count: number;
  mcu_2024: string | null; mcu_2025: string | null; mcu_2026: string | null;
  mcu_terakhir: string | null;
  kategori_mcu_terakhir: string | null;
  hasil_mcu: string | null;
  perlu_fu: string | null;
  rekomendasi_fu: string | null;
  item_fu: string | null;
  diagnosa: string | null;
  fram_score: number | null;
  fram_prob: string | null;
  frs_kategori: string | null;
  zona_risiko: string | null;
  masa_berlaku_mcu: string | null;
  status_mcu: 'Valid' | 'Expired' | 'No Data' | 'Exempt';
  status_follow_up: 'Perlu FU' | 'Selesai FU' | 'Belum Review' | 'Tidak Perlu FU' | 'Exempt';
  jadwal_mcu_selanjutnya: string | null;
}
```

Note: `MCUDashboardRow` does **not** include `nama`. The dashboard data hook `useMCUDashboardData` + `fetchDashboardRows` use this type. `RecordMCUTableModern` uses `Record<string, any>` for both tables.

Also relevant:
- **`useMCUDashboardData()`** — hook exported from `MCUDashboardShared.tsx` — fetches from `/api/mcu/dashboard`, caches in module-level variable, exposes `{ rows, loading, error, refresh }`.

---

## Q6 — Shape of data returned by both APIs

### (a) `/api/mcu/records` (paginated list mode)
**File:** `d:\WebApp\bg-health-v2\src\app\api\mcu\records\route.ts`

Response:
```json
{
  "records": [
    {
      "nik_karyawan": "string (decrypted)",
      "nama": "string (decrypted)",
      "national_id": "(removed — deleted from response)",
      "nik_karyawan_hash": "string (kept for internal use)",
      "tgl_mcu": "date string",
      "...all other MCU_FIELDS in snake_case": "string | null"
    }
  ],
  "page": 1,
  "pageSize": 100,
  "total": 1234,
  "totalPages": 13
}
```
Sensitive fields decrypted: `national_id` (then deleted), `nik_karyawan`, `nama`, `link_mcu`.

### (b) `/api/mcu/dashboard`
**File:** `d:\WebApp\bg-health-v2\src\app\api\mcu\dashboard\route.ts`

Response:
```json
{
  "employees": [
    {
      "employee_id": "string (plaintext NIK — NOT decrypted, not in MCU_SENSITIVE_FIELDS)",
      "nama": "string (plaintext — NOT encrypted in monitor_mcu)",
      "site": "string | null",
      "area_raw": "string",
      "area": "Area 1 | Area 2 | Area 3 | HO | ''",
      "client": "string (default 'PT. BDM')",
      "jabatan": "string | null",
      "exempt": "boolean",
      "total_mcu": "number",
      "mcu_terakhir": "date string | null",
      "kategori_mcu_terakhir": "string | null",
      "hasil_mcu": "string | null",
      "perlu_fu": "string | null",
      "rekomendasi_fu": "string | null",
      "item_fu": "string | null",
      "diagnosa": "string | null",
      "fram_score": "number | null",
      "fram_prob": "string | null",
      "frs_kategori": "string | null",
      "zona_risiko": "string | null",
      "masa_berlaku_mcu": "date string | null",
      "status_mcu": "'Valid' | 'Expired' | 'No Data' | 'Exempt'",
      "status_follow_up": "'Perlu FU' | 'Selesai FU' | 'Belum Review' | 'Tidak Perlu FU' | 'Exempt'",
      "jadwal_mcu_selanjutnya": "date string | null"
    }
  ]
}
```

---

## Q7 — Files that would need to be created or modified

### Issue 1: `nama` (and `employee_id`) not encrypted in `monitor_mcu`

The root cause is at the **database/ETL level** — `monitor_mcu` is populated from some process that stores plaintext. `decryptMCURecord` already handles `nama` (it's in `MCU_SENSITIVE_FIELDS`), but since the value in `monitor_mcu` is not AES-256-GCM encoded, `decrypt()` fails silently and returns the raw plaintext. No data is lost (the fallback shows the raw value), but it's inconsistent with `mcu_records`.

**Files to modify:**
- The ETL/sync process that populates `monitor_mcu` (not found in this codebase — likely an external script or Supabase function)
- Alternatively, `src/app/api/mcu/dashboard/route.ts` — add format-detection so it only decrypts if the value looks like an AES-GCM hex string (length ≥ 56 chars). This prevents the silent fallback and clarifies intent.

### Issue 2: Monitor MCU tab already exists in `RecordMCUTableModern`

The `RecordMCUTableModern` component already has both tabs. The user's request is to have "tabel monitor MCU ditampilkan bersebelahan tab nav dengan mcu_record di sebelah kanan halaman administrator review mcu, setingan tabel monitor mcu sama dengan mcu record."

**The tab already exists!** Clicking the arrow in the Admin Review MCU page shows `RecordMCUTableModern`, which already displays:
- Tab "Record MCU"  
- Tab "Tabel Monitor"

**What may need to change** (based on "settings sama dengan mcu record"):

The Monitor tab's column config (`monitorColumns`) maps `employee_id` → label `nik_karyawan` and `nama` → label `nama`, but the **Monitor tab currently lacks**:
1. `nama` column is present (`monitorColumns` includes `{ key: 'nama', label: 'nama' }`) ✓
2. The Monitor tab column widths default to 110px (no `COLUMN_WIDTHS` entry for `employee_id`, `area_raw`, etc.)
3. The Monitor tab has no edit/delete (correct — read-only view)
4. The `frozenColumns` state is **shared** between both tabs — switching tabs resets context

**Files to modify:**
1. `d:\WebApp\bg-health-v2\src\components\dashboard\RecordMCUTableModern.tsx`
   - Add `COLUMN_WIDTHS` entries for monitor columns: `employee_id`, `area_raw`, `total_mcu`, `mcu_terakhir`, `kategori_mcu_terakhir`, `hasil_mcu`, `diagnosa`, `zona_risiko`, `status_mcu`, `status_follow_up`
   - Optionally: separate `frozenColumns` state per tab (so monitor tab remembers its own frozen columns)
   - Optionally: rename the tab labels from "Record MCU" / "Tabel Monitor" to better match user expectations

---

## Conclusions and Recommendations

### For the `nama` encryption issue (original question 1)
The `monitor_mcu` table stores `nama` and `employee_id` as **plaintext**. The `decryptMCURecord` function already has `nama` in `MCU_SENSITIVE_FIELDS`, so it tries to decrypt it but silently falls back to the raw value when decryption fails. This is **not a frontend bug** — the data is plaintext in the DB. Fix options:
1. **Best fix (database level):** Encrypt `nama` in the `monitor_mcu` table/ETL to match `mcu_records`.
2. **Defensive fix (API level):** In `src/app/api/mcu/dashboard/route.ts`, detect whether a field value is AES-GCM encoded (hex string with length ≥ 56) before attempting decrypt, and skip decryption for plaintext values. This prevents confusion.

### For the Monitor MCU tab display (original question 3)
`RecordMCUTableModern.tsx` **already implements** a two-tab UI that shows both "Record MCU" and "Tabel Monitor" side by side as tabs. The user's request is already implemented. What may need adjustment:
1. **Column widths** for the monitor columns (currently fall back to 110px default)
2. **Frozen columns** reset when switching tabs — they should be per-tab
3. The `nama` column in the Monitor tab **works** (displays correctly via decrypt-fallback), but `employee_id` is displayed as NIK without encryption/decryption

### Files summary
| File | Change needed |
|------|---------------|
| `src/components/dashboard/RecordMCUTableModern.tsx` | Add `COLUMN_WIDTHS` for monitor columns; optionally per-tab frozen state |
| `src/app/api/mcu/dashboard/route.ts` | Optional: format-detect before decrypt to avoid silent fallback |
| `monitor_mcu` DB/ETL (external) | Encrypt `nama` and `employee_id` at rest to match `mcu_records` |
