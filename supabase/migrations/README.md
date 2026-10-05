# Supabase SQL files

This directory contains SQL-editor scripts, not a configured Supabase CLI
migration history. Several files share numeric prefixes, so filenames alone
do not define a safe sequence. Check the target database and take a backup
before applying any SQL to an existing project.

## Schema scripts

- `000_employees.sql` creates the employee directory table without deleting
  existing data. The employee hash columns are added by later scripts.
- `001_mcu_tables.sql` and `002_mcu_schedule.sql` define the MCU record and
  schedule tables.
- `003_secure_employee_columns_and_mcu_formulas.sql` expects the employee and
  MCU tables to exist. Review existing employee data before running it.
- `2026-10-02_std006_ptm_ess_mental_health.sql` adds the questionnaire schema
  documented in `docs/PANDUAN-STD-006.md`.
- Inventory, diagnostic, profile, and dashboard-view SQL files add their
  named features; check dependencies in each file before applying.

## Historical health-indicator transitions

`003_health_indicators_v2.sql`, `004_health_indicators_final.sql`, and
`005_health_indicators_normalized.sql` are destructive schema transitions.
They drop and recreate health tables/views, and the later versions remove
`health_statistics` tables that application endpoints still query. Do not run
these files as a batch or on a populated database without a reviewed migration
plan and a tested backup.

## Excluded local files

Old full-schema snapshots, data-import SQL, MCU import batches, and rejected
row reports are kept in the ignored `local-only/archive/` directory on the
developer machine. They are not deployable migrations and can contain
employee or health information. The snapshot scripts also contain destructive
`DROP ... CASCADE` statements.
