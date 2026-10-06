# Investigasi: Enkripsi Nama di `monitor_mcu` vs `mcu_records`

## Ringkasan Temuan

**`monitor_mcu` bukan sebuah tabel, melainkan sebuah PostgreSQL VIEW** yang dibuat di atas tabel `mcu_records`. View ini mengekspos kolom `nama`, `nik_karyawan`, `national_id`, dan `link_mcu` apa adanya — yaitu dalam bentuk **ciphertext AES-256-GCM**, persis sama seperti yang tersimpan di `mcu_records`.

Penyebab nama tidak terbaca dengan benar di `monitor_mcu` bukan karena enkripsi tidak diterapkan, melainkan karena **kode API yang membaca dari `monitor_mcu` tidak memanggil `decryptMCURecord()`** sebelum mengembalikan data ke frontend, sementara kode yang membaca dari `mcu_records` secara konsisten selalu memanggil fungsi tersebut.

Ada satu tambahan khusus pada migration `010_mcu_dashboard_view.sql`: view generasi terbaru mengambil `e.nama` langsung dari tabel `employees` (bukan dari `mcu_records`), dan kolom `nama` di `employees` juga terenkripsi AES-256-GCM. Hasilnya tetap sama — data yang dikembalikan view adalah ciphertext, dan API tidak mendekripsinya.

---

## Bukti Terperinci

### 1. Cara `mcu_records` mengenkripsi dan mendekripsi nama

**File enkripsi utama:** `src/lib/encryption.ts`

```
// Baris 88
const MCU_SENSITIVE_FIELDS = ['national_id', 'nik_karyawan', 'nama', 'link_mcu'];

// Baris 90–108  → encryptMCURecord()
// Baris 110–123 → decryptMCURecord()
```

Fungsi `encryptMCURecord()` (baris 90) mengiterasi `MCU_SENSITIVE_FIELDS` dan mengenkripsi setiap kolom menggunakan AES-256-GCM dengan IV acak. Fungsi `decryptMCURecord()` (baris 110) melakukan kebalikannya.

**Tempat enkripsi saat menyimpan** — `src/app/api/mcu/save/route.ts`, baris 63:
```typescript
const encryptedData = encryptMCURecord(dbData);
// lalu di-insert/update ke tabel mcu_records
```

**Tempat dekripsi saat membaca** — `src/app/api/mcu/records/route.ts`, baris 3 dan 57:
```typescript
import { decryptMCURecord } from '@/lib/encryption';
// ...
const decrypted = decryptMCURecord(record);  // dipanggil untuk setiap record
```

Juga di `src/app/api/mcu/recalculate-all/route.ts` baris 3 & 36:
```typescript
import { decryptMCURecord, encryptMCURecord } from '@/lib/encryption';
// ...
const decrypted = decryptMCURecord(record);
// ...
const encryptedData = encryptMCURecord(dbData);
```

### 2. Cara `monitor_mcu` menyimpan dan menampilkan nama

**`monitor_mcu` adalah SQL VIEW, bukan tabel fisik.** Definisinya ada di dua file migrasi:

#### Definisi lama — `local-only/non-runtime/supabase/migrations/001_mcu_tables.sql` (baris 152–261):
```sql
CREATE OR REPLACE VIEW public.monitor_mcu AS
WITH ranked_mcu AS (
  SELECT *, ROW_NUMBER() OVER(
    PARTITION BY COALESCE(nik_karyawan_hash, national_id_hash)
    ORDER BY tgl_mcu DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM public.mcu_records
)
SELECT
  national_id,
  nik_karyawan,
  nama,         -- ← diambil langsung dari mcu_records, masih ciphertext
  ...
FROM ranked_mcu WHERE rn = 1;
```

#### Definisi terbaru (aktif) — `local-only/non-runtime/supabase/migrations/010_mcu_dashboard_view.sql`:
```sql
CREATE VIEW public.monitor_mcu AS
WITH manpower AS (
  SELECT
    e.nama,      -- ← diambil dari tabel employees, kolom ini juga terenkripsi
    ...
  FROM public.employees e
  ...
),
...
SELECT
  e.nama,        -- ← tetap merupakan ciphertext dari employees
  ...
FROM manpower e ...
```

Pada kedua versi view, `nama` yang dikembalikan adalah **ciphertext hex string** (format: `[12-byte IV][16-byte GCM tag][ciphertext]` di-encode sebagai hex).

**File API yang membaca `monitor_mcu`:**

#### `src/app/api/mcu/dashboard/route.ts` (baris 105–135):
```typescript
// Import: hanya mengimport hashField — TIDAK mengimport decryptMCURecord
import { hashField } from '@/lib/encryption';

async function fetchAllMonitorMcuRows() {
  const SELECT_FIELDS = 'employee_id,nama,site,...';
  // ... query ke monitor_mcu ...
}

export async function GET(request: NextRequest) {
  // ...
  const employees = rawRows.map(row => {
    return {
      ...row,   // ← nama dikembalikan apa adanya sebagai ciphertext
      client: ...,
      area: ...,
    };
  });
  return NextResponse.json({ employees });
}
```

`decryptMCURecord` **tidak pernah dipanggil** di file ini. Nama yang dikirim ke frontend adalah string hex ciphertext, bukan nama plaintext.

#### `src/app/api/mcu/schedule/route.ts` (baris 3 & 105):
```typescript
import { decrypt, decryptEmployee, decryptMCURecord, encrypt, hashField } from '@/lib/encryption';

// Baris 105: decryptMCURecord DIPANGGIL untuk data monitor_mcu
const monitors = (monitorData || []).map(decryptMCURecord);
```

Di route `schedule`, `decryptMCURecord()` **memang dipanggil** untuk data dari `monitor_mcu`. Namun hasilnya tidak digunakan langsung untuk menampilkan nama ke frontend — schedule route hanya mengekstrak `monitor.tgl_mcu` (tanggal, bukan nama) ke dalam `safeRows`. Nama karyawan di schedule diambil dari `employee.nama` yang sudah di-dekripsi lewat `decryptEmployee()`.

### 3. Mengapa `monitor_mcu` tidak mendekripsi nama

**Penyebab utama: API `dashboard/route.ts` lupa memanggil `decryptMCURecord()`.**

Kronologi penyebabnya:

1. `mcu_records` adalah tabel fisik; enkripsi/dekripsi diterapkan secara eksplisit di setiap route yang membacanya (`records/route.ts`, `save/route.ts`, `recalculate-all/route.ts`).
2. `monitor_mcu` adalah VIEW yang dibuat kemudian sebagai abstraksi dashboard. Developer yang menulis `dashboard/route.ts` hanya meng-import `hashField` — tidak terpikirkan untuk menambahkan dekripsi karena view terasa seperti "sudah jadi" datanya.
3. `010_mcu_dashboard_view.sql` memindahkan sumber `nama` dari `mcu_records` ke `employees`, tapi kolom `employees.nama` juga dienkripsi (lihat `003_secure_employee_columns_and_mcu_formulas.sql`), sehingga masalah tetap sama.
4. Di `schedule/route.ts`, `decryptMCURecord(monitors)` memang dipanggil, tapi `nama` dari monitor tidak pernah dipakai — nama diambil dari `employees` yang sudah di-dekripsi dengan `decryptEmployee()`. Jadi nama di halaman schedule tampil benar, bukan karena `monitor_mcu` nama-nya sudah bersih, tapi karena sumbernya berbeda.

**Ini bukan keputusan desain yang disengaja — ini adalah langkah yang terlewat (forgotten step).**

### 4. Bukti tambahan: `MCUDashboardRow` tidak punya field `nama`

`src/components/dashboard/MCUDashboardShared.tsx` (baris 47–75) mendefinisikan interface `MCUDashboardRow`:

```typescript
export interface MCUDashboardRow {
  employee_id: string;
  site: string | null;
  area: string;
  client: string | null;
  jabatan: string | null;
  // ... tidak ada field 'nama' ...
}
```

Field `nama` memang **tidak ada** di interface `MCUDashboardRow`. Artinya komponen dashboard (`MonitoringMCU.tsx`, `HasilTindakLanjutMCU.tsx`) tidak menampilkan nama karyawan sama sekali — data nama dikembalikan oleh API tapi tidak dipakai di frontend monitoring charts. Yang ditampilkan hanyalah agregat (jumlah Valid/Expired/No Data) berdasarkan site dan area.

Namun di halaman **Jadwal MCU** (`InputJadwalMCU.tsx` baris 207), nama karyawan **ditampilkan dalam tabel**:
```typescript
<td className="mcu-name">{row.nama}</td>
```
Dan nama ini datang dari `schedule/route.ts` yang menggunakan `decryptEmployee()` — bukan dari `monitor_mcu.nama`. Jadi halaman jadwal menampilkan nama dengan benar.

---

## Kesimpulan

| Aspek | `mcu_records` | `monitor_mcu` (via dashboard API) |
|---|---|---|
| Jenis objek DB | Tabel fisik | SQL VIEW di atas `mcu_records`/`employees` |
| Kolom `nama` tersimpan | Ciphertext AES-256-GCM | Ciphertext (diwariskan dari tabel sumber) |
| Dekripsi saat baca | Ya — `decryptMCURecord()` dipanggil | **Tidak** — tidak ada dekripsi di `dashboard/route.ts` |
| Field `nama` di frontend | Ditampilkan sebagai plaintext | Tidak ada di `MCUDashboardRow` (tidak ditampilkan) |

**Skenario di mana enkripsi menjadi masalah yang terlihat nyata:**
- Jika ada fitur di masa depan yang menampilkan nama dari data `monitor_mcu` di dashboard (misalnya tabel daftar karyawan dengan nama).
- Jika field `nama` ditambahkan ke `SELECT_FIELDS` di `dashboard/route.ts` dan dikirim ke frontend — yang terjadi adalah nama tampil sebagai string hex panjang, bukan nama asli.

---

## Rekomendasi Perbaikan

### Perubahan yang diperlukan

**File:** `src/app/api/mcu/dashboard/route.ts`

**Langkah 1:** Tambahkan import `decryptMCURecord` dan/atau `decryptEmployee`:
```typescript
// Sebelum
import { hashField } from '@/lib/encryption';

// Sesudah
import { decryptEmployee, hashField } from '@/lib/encryption';
```

**Langkah 2:** Karena view `monitor_mcu` terbaru (`010_mcu_dashboard_view.sql`) mengambil `nama` dari tabel `employees`, dan data employees di-dekripsi menggunakan `decryptEmployee()`, pilihan paling tepat adalah memastikan field `nama` di-dekripsi sebelum dikirim ke frontend.

Dalam fungsi `fetchAllMonitorMcuRows()`, field `nama` perlu di-decrypt. Cara paling bersih: tambahkan `nama` ke daftar field yang di-decrypt, atau panggil `decrypt()` secara langsung pada field tersebut:

```typescript
// Di dalam GET handler, saat memproses rawRows:
import { decrypt, hashField } from '@/lib/encryption';

const employees = rawRows.map(row => {
  const exempt = Boolean(row.exempt);
  return {
    ...row,
    nama: decrypt(row.nama as string) || row.nama,  // decrypt nama
    client: String(row.client || '').trim() || 'PT. BDM',
    area: normalizeArea(row.area_raw, row.site),
    status_mcu: normalizeMcuStatus(row.status_mcu, exempt),
    status_follow_up: normalizeFollowUpStatus(row.status_follow_up, exempt),
  };
});
```

Alternatif lebih bersih: panggil `decryptMCURecord()` jika view masih mengandung kolom dari `mcu_records`:
```typescript
import { decryptMCURecord, hashField } from '@/lib/encryption';

const employees = rawRows.map(row => {
  const decrypted = decryptMCURecord(row);  // mendekripsi nama, nik_karyawan, national_id, link_mcu
  const exempt = Boolean(decrypted.exempt);
  return {
    ...decrypted,
    client: String(decrypted.client || '').trim() || 'PT. BDM',
    area: normalizeArea(decrypted.area_raw, decrypted.site),
    status_mcu: normalizeMcuStatus(decrypted.status_mcu, exempt),
    status_follow_up: normalizeFollowUpStatus(decrypted.status_follow_up, exempt),
  };
});
```

**Perlu diperhatikan:** Pada `010_mcu_dashboard_view.sql`, `nama` berasal dari `employees`, bukan `mcu_records`. Kolom `employees.nama` dienkripsi dengan `encryptEmployee()` yang menggunakan field list berbeda (`SENSITIVE_FIELDS = ['nik', 'national_id', ...]` — `nama` ada di dalamnya). Kunci enkripsi (`ENCRYPTION_KEY`) sama, sehingga fungsi `decrypt()` dasar bisa mendekripsi keduanya.

**Langkah 3:** Tambahkan field `nama` ke interface `MCUDashboardRow` di `MCUDashboardShared.tsx` jika ada rencana untuk menampilkannya di dashboard:
```typescript
export interface MCUDashboardRow {
  employee_id: string;
  nama: string | null;  // ← tambahkan ini
  site: string | null;
  // ...
}
```

### Tidak ada perubahan database yang diperlukan

Enkripsi di tabel `mcu_records` dan `employees` sudah benar. View `monitor_mcu` hanya perlu diperlakukan sama seperti `mcu_records` dari sisi API — selalu dekripsi field sensitif sebelum mengirim ke frontend.
