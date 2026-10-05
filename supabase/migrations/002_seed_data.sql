-- ═══════════════════════════════════════════════════════════════
-- Seed Data — Data dari Lagging Indicator.xlsx (Jan-Apr 2026)
-- Jalankan SETELAH migration 001
-- ═══════════════════════════════════════════════════════════════

INSERT INTO health_statistics (tahun, bulan, man_power, man_hours, tk_sakit, absensi_sakit, spell, rkk, cmr, mfr, ssr, asr, fr_pak, kaptk) VALUES
(2026, 1, 3173, 625560, 174, 535, 174, 0.9959, 0.0548, 278.15, 3.075, 855.23, 0, 0),
(2026, 2, 1369, 296776, 128, 426, 128, 0.9934, 0.0935, 431.30, 3.328, 1435.43, 0, 0),
(2026, 3, 1095, 267608, 34, 136, 34, 0.9982, 0.0311, 127.05, 4.0, 508.21, 0, 0),
(2026, 4, 1358, 312404, 123, 307, 121, 0.9985, 0.0906, 393.72, 2.537, 982.70, 0, 0)
ON CONFLICT (tahun, bulan) DO NOTHING;

INSERT INTO health_statistics_sites (tahun, bulan, jobsite, man_power, asr) VALUES
(2026, 1, 'Banyuwangi', 37, 407.6),
(2026, 1, 'Balikpapan', 16, 10165.7),
(2026, 1, 'Banjarmasin', 4, 0),
(2026, 1, 'Head Office', 264, 4133.5),
(2026, 1, 'Bengalon', 51, 1462.0),
(2026, 1, 'Tanjung Redeb', 173, 729.3),
(2026, 1, 'Aceh', 70, 3698.7),
(2026, 1, 'Bontang', 33, 1552.8),
(2026, 1, 'Tanjung Tabalong', 102, 87.7),
(2026, 1, 'Binuang', 74, 2177.1),
(2026, 1, 'Kaliorang', 0, 1088.2),
(2026, 1, 'Kotamobagu', 0, 7084.1),
(2026, 1, 'Morowali', 0, 6465.5),
(2026, 1, 'Batu Kajang', 60, 0),
(2026, 1, 'Angsana', 288, 173.1),
(2026, 1, 'Tuhup', 120, 326.3),
(2026, 2, 'Banyuwangi', 37, 3928.2),
(2026, 2, 'Balikpapan', 16, 13503.1),
(2026, 2, 'Head Office', 270, 4639.3),
(2026, 2, 'Bengalon', 51, 2624.0),
(2026, 2, 'Tanjung Redeb', 173, 1183.1),
(2026, 2, 'Aceh', 70, 907.5),
(2026, 2, 'Bontang', 33, 1295.3),
(2026, 2, 'Tanjung Tabalong', 103, 216.7),
(2026, 2, 'Binuang', 74, 1846.1),
(2026, 2, 'Batu Kajang', 60, 315.3),
(2026, 2, 'Angsana', 294, 92.1),
(2026, 3, 'Banyuwangi', 37, 3877.2),
(2026, 3, 'Balikpapan', 16, 11363.6),
(2026, 3, 'Tanjung Redeb', 173, 274.2),
(2026, 3, 'Aceh', 68, 621.1),
(2026, 3, 'Bontang', 33, 877.8),
(2026, 3, 'Tanjung Tabalong', 104, 0),
(2026, 3, 'Binuang', 74, 1100.7),
(2026, 3, 'Angsana', 300, 148.6),
(2026, 4, 'Banyuwangi', 37, 32485.9),
(2026, 4, 'Balikpapan', 16, 10693.2),
(2026, 4, 'Banjarmasin', 4, 6578.9),
(2026, 4, 'Head Office', 269, 4568.3),
(2026, 4, 'Bengalon', 51, 686.2),
(2026, 4, 'Tanjung Redeb', 173, 680.2),
(2026, 4, 'Aceh', 71, 459.8),
(2026, 4, 'Bontang', 33, 168.2),
(2026, 4, 'Tanjung Tabalong', 105, 130.1)
ON CONFLICT (tahun, bulan, jobsite) DO NOTHING;