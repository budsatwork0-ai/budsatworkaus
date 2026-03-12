-- 017_claim_anonymous_quotes_fn.sql
-- Postgres function to atomically claim anonymous quotes for a newly-registered
-- or returning user. Using a SECURITY DEFINER function guarantees the UPDATE
-- runs with full DB privileges (bypasses RLS unconditionally) and keeps the
-- comparison in pure SQL — avoiding any PostgREST filter translation issues.

CREATE OR REPLACE FUNCTION public.claim_anonymous_quotes(p_user_id uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.quotes
  SET customer_id = p_user_id,
      updated_at  = now()
  WHERE lower(customer_email) = lower(p_email)
    AND customer_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
