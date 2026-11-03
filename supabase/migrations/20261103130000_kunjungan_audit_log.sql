ALTER TABLE public.kunjungan_berobat
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by_role TEXT;

CREATE TABLE IF NOT EXISTS public.kunjungan_berobat_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kunjungan_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_user_id UUID,
  actor_role TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_data JSONB,
  after_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_berobat_audit_record_time
  ON public.kunjungan_berobat_audit (kunjungan_id, occurred_at DESC);

ALTER TABLE public.kunjungan_berobat_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kunjungan_berobat_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kunjungan_berobat_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kunjungan_berobat_audit_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.log_kunjungan_berobat_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  audit_actor UUID;
  audit_role TEXT;
  record_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    record_id := NEW.id;
    audit_actor := NEW.created_by;
    audit_role := NEW.created_by_role;
    INSERT INTO public.kunjungan_berobat_audit
      (kunjungan_id, action, actor_user_id, actor_role, after_data)
    VALUES (record_id, TG_OP, audit_actor, audit_role, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(OLD) - ARRAY['created_by', 'created_by_role', 'updated_by', 'updated_by_role', 'updated_at'])
      IS NOT DISTINCT FROM
       (to_jsonb(NEW) - ARRAY['created_by', 'created_by_role', 'updated_by', 'updated_by_role', 'updated_at']) THEN
      RETURN NEW;
    END IF;
    record_id := NEW.id;
    audit_actor := NEW.updated_by;
    audit_role := NEW.updated_by_role;
    INSERT INTO public.kunjungan_berobat_audit
      (kunjungan_id, action, actor_user_id, actor_role, before_data, after_data)
    VALUES (record_id, TG_OP, audit_actor, audit_role, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    record_id := OLD.id;
    audit_actor := OLD.updated_by;
    audit_role := OLD.updated_by_role;
    INSERT INTO public.kunjungan_berobat_audit
      (kunjungan_id, action, actor_user_id, actor_role, before_data)
    VALUES (record_id, TG_OP, audit_actor, audit_role, to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_kunjungan_berobat_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kunjungan_berobat_audit ON public.kunjungan_berobat;
CREATE TRIGGER trg_kunjungan_berobat_audit
AFTER INSERT OR UPDATE OR DELETE ON public.kunjungan_berobat
FOR EACH ROW EXECUTE FUNCTION public.log_kunjungan_berobat_change();
