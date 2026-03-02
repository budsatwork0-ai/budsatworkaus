-- Migration 013: Auto-create a profiles row for every new auth user.
--
-- Why: Google OAuth users bypass /api/auth/register, so they never get a
-- profiles row.  The middleware falls back to profiles.role when
-- app_metadata.role is absent — but only if the row exists.
--
-- Behaviour:
--   • Password-based sign-ups (register API):  the trigger inserts role='customer',
--     then the API immediately upserts with the correct role (employee/admin).
--     ON CONFLICT DO NOTHING means the API upsert always wins.
--   • Google OAuth sign-ups: trigger fires, inserts role='customer', done.
--   • Subsequent logins: trigger does not fire (INSERT only), no-op.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name TEXT;
BEGIN
  -- Google provides 'name'; direct registration provides 'full_name'.
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, display_name, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop and recreate so the migration is idempotent.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
