-- =====================================================================
-- ROLE "manager" pada user_profiles (Supabase / PostgreSQL)
-- Manager = viewer + hak menyetujui survei ergonomi (QSHE Manager / PJO).
-- Skrip ini menyesuaikan batasan role di tabel user_profiles, apa pun bentuknya:
--   (a) kolom role bertipe teks dengan CHECK constraint, atau
--   (b) kolom role bertipe ENUM.
-- Aman dijalankan ulang. Jalankan SEBELUM mendaftarkan pengguna dengan role Manager.
-- =====================================================================
do $$
declare
  v_type text; v_udt text; c record;
begin
  select data_type, udt_name into v_type, v_udt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'role';

  if v_type is null then
    raise exception 'Kolom public.user_profiles.role tidak ditemukan';
  end if;

  if v_type = 'USER-DEFINED' then
    -- (b) ENUM: tambahkan nilai baru
    execute format('alter type public.%I add value if not exists %L', v_udt, 'manager');
  else
    -- (a) CHECK constraint yang membatasi role: ganti dengan daftar yang menyertakan manager
    for c in
      select conname from pg_constraint
      where conrelid = 'public.user_profiles'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.user_profiles drop constraint %I', c.conname);
    end loop;
    alter table public.user_profiles
      add constraint user_profiles_role_check
      check (role in ('superuser','administrator','pic','viewer','employee','manager'));
  end if;
end $$;
