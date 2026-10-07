# Perubahan: Tabel Monitor MCU, NIK, dan transisi halaman

## File baru
- `src/lib/mcu-monitor.ts` — logika monitor (umur dari NIK, masa kerja, masa berlaku, notifikasi jadwal, status follow up, urutan area/jabatan). Port dari skrip GAS `updateDataMCU`.
- `src/app/api/mcu/monitor-table/route.ts` — endpoint tabel monitor. Sumber: `employees` + `mcu_records` + `mcu_schedules`, dihitung di server (NIK didekripsi di server; `ENCRYPTION_KEY` tidak pernah ke browser).

## File diubah
- `src/components/dashboard/RecordMCUTableModern.tsx` — tab Monitor MCU (kiri) & Record MCU (kanan), kolom monitor baru, tombol Refresh, ciphertext tidak pernah tampil.
- `src/app/api/mcu/records/route.ts` — NIK Karyawan yang gagal didekripsi dicari dari tabel `employees`.
- `src/lib/encryption.ts` — export `isEncryptedValue`.
- `src/app/page.tsx` + `src/app/globals.css` — transisi halaman tanpa kedip (CSS, tanpa fase kosong).
- `src/components/dashboard/MCUDashboardShared.tsx` — chart tidak lagi dibuat ulang tiap render induk.

Tidak ada perubahan skema database. Dashboard (`/api/mcu/dashboard`, view `monitor_mcu`) tidak diubah.
