-- 035_email_uniqueness_hardening.sql
-- Tighten email uniqueness so the same human can't accidentally end up with
-- two accounts (one email/password, one Google) for what is, in reality, the
-- same inbox.
--
-- Strategy:
--   1. Add a `normalized_email` column to profiles + customers, populated
--      by a Postgres-side `public.normalize_email(text)` helper that mirrors
--      the JS utility in src/lib/auth/normalize-email.ts.
--   2. Backfill from existing rows.
--   3. Add a UNIQUE INDEX on profiles.normalized_email so duplicates fail
--      hard at the DB layer regardless of which code path tries to insert.
--   4. Update the on-signup trigger so every new auth.users row gets a
--      profile row with normalized_email already populated.
--   5. Update claim_anonymous_quotes() to match on canonical form, so
--      anonymous quotes left under bob+test@gmail.com get reattached when
--      bob@gmail.com signs in.
--
-- Run AFTER deploying the application code in this branch.

BEGIN;

-- ============================================================
-- 1. Helper function: canonicalize an email (mirrors JS impl)
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_email(addr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text;
  at_pos  int;
  local   text;
  domain  text;
BEGIN
  IF addr IS NULL THEN
    RETURN NULL;
  END IF;

  trimmed := lower(btrim(addr));
  at_pos  := position('@' IN trimmed);

  IF at_pos = 0 OR at_pos = 1 OR at_pos = length(trimmed) THEN
    RETURN trimmed; -- malformed, hand back what we got so we don't lose data
  END IF;

  local  := substring(trimmed FROM 1 FOR at_pos - 1);
  domain := substring(trimmed FROM at_pos + 1);

  -- Strip +alias for providers that honour subaddressing.
  IF domain IN (
    'gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com',
    'icloud.com','me.com','mac.com','yahoo.com','yahoo.com.au','ymail.com',
    'fastmail.com','fastmail.fm','protonmail.com','proton.me','pm.me',
    'tutanota.com','tuta.io'
  ) THEN
    IF position('+' IN local) > 0 THEN
      local := substring(local FROM 1 FOR position('+' IN local) - 1);
    END IF;
  END IF;

  -- Gmail: ignore dots, unify googlemail.com → gmail.com.
  IF domain IN ('gmail.com','googlemail.com') THEN
    local  := replace(local, '.', '');
    domain := 'gmail.com';
  END IF;

  IF local = '' THEN
    RETURN trimmed;
  END IF;

  RETURN local || '@' || domain;
END;
$$;

COMMENT ON FUNCTION public.normalize_email(text) IS
  'Canonical email form for duplicate detection. Mirrors src/lib/auth/normalize-email.ts.';

-- ============================================================
-- 2. profiles.normalized_email
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS normalized_email text;

UPDATE public.profiles
  SET normalized_email = public.normalize_email(email)
  WHERE normalized_email IS NULL AND email IS NOT NULL;

-- Unique partial index — NULL allowed, but two rows with the same canonical
-- email cannot coexist. Partial so legacy rows with NULL email don't block
-- the migration; in practice every row should have an email going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_normalized_email
  ON public.profiles (normalized_email)
  WHERE normalized_email IS NOT NULL;

-- Lookup index for the case-insensitive duplicate check in /api/auth/register.
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (lower(email));

-- ============================================================
-- 3. customers.normalized_email
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS normalized_email text;

UPDATE public.customers
  SET normalized_email = public.normalize_email(email)
  WHERE normalized_email IS NULL AND email IS NOT NULL;

-- Unique on (user_id) already exists from migration 015. We add a unique
-- partial index on normalized_email scoped to rows that DO have an auth
-- account — anonymous-customer rows (user_id IS NULL) intentionally allow
-- duplicates because they get reconciled on sign-up via claim_anonymous_quotes.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customers_normalized_email_authed
  ON public.customers (normalized_email)
  WHERE user_id IS NOT NULL AND normalized_email IS NOT NULL;

-- ============================================================
-- 4. Trigger: populate normalized_email on every new profile row
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, normalized_email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    public.normalize_email(NEW.email),
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE
    SET email            = EXCLUDED.email,
        normalized_email = EXCLUDED.normalized_email;
  RETURN NEW;
END;
$$;

-- Keep normalized_email in sync if the email column is ever updated directly
-- (e.g. admin tooling or a user changing their email).
CREATE OR REPLACE FUNCTION public.sync_profile_normalized_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_email := public.normalize_email(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_normalized_email ON public.profiles;
CREATE TRIGGER trg_profiles_sync_normalized_email
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_normalized_email();

DROP TRIGGER IF EXISTS trg_customers_sync_normalized_email ON public.customers;
CREATE TRIGGER trg_customers_sync_normalized_email
  BEFORE INSERT OR UPDATE OF email ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_normalized_email();

-- ============================================================
-- 5. claim_anonymous_quotes — match on canonical form
-- ============================================================
-- Re-create the function so it canonicalizes both sides of the comparison.
-- The signature stays the same; callers can pass either the raw or the
-- canonical form and it'll just work.
CREATE OR REPLACE FUNCTION public.claim_anonymous_quotes(
  p_user_id uuid,
  p_email   text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_canonical text := public.normalize_email(p_email);
  v_count     int  := 0;
BEGIN
  IF v_canonical IS NULL OR v_canonical = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.quotes
     SET user_id = p_user_id
   WHERE user_id IS NULL
     AND public.normalize_email(email) = v_canonical;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_anonymous_quotes(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO authenticated, service_role, anon;

COMMIT;

-- ============================================================
-- POST-MIGRATION CHECK (run manually if you want to audit)
-- ============================================================
-- Find any historical duplicates that already snuck in:
--   SELECT normalized_email, count(*), array_agg(id) AS user_ids
--     FROM public.profiles
--    WHERE normalized_email IS NOT NULL
--    GROUP BY normalized_email
--   HAVING count(*) > 1;
--
-- For each duplicate, decide which auth.users row is canonical (usually the
-- one with the most recent activity / linked customer record), then run:
--   SELECT auth.admin_delete_user('<duplicate-uuid>'::uuid);
-- via the Supabase admin SDK. The CASCADE on profiles.id cleans up the rest.
