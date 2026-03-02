-- 007_supabase_auth_migration.sql
-- Migrate from Clerk to Supabase Auth:
--   1. Create profiles table linked to auth.users
--   2. Rename employees.clerk_user_id -> user_id (uuid FK)
--   3. Replace Clerk JWT-based RLS policies with profiles-based ones

-- ============================================================
-- 1. profiles — user profile linked to auth.users
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'customer'
    CHECK (role IN ('admin', 'employee', 'customer')),
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at on profiles
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Helper function: get current user's role from profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================
-- 2. Rename employees.clerk_user_id -> user_id
-- ============================================================
ALTER TABLE employees ALTER COLUMN clerk_user_id DROP NOT NULL;
UPDATE employees SET clerk_user_id = NULL;
ALTER TABLE employees ALTER COLUMN clerk_user_id TYPE uuid USING NULL;
ALTER TABLE employees RENAME COLUMN clerk_user_id TO user_id;
ALTER TABLE employees ADD CONSTRAINT fk_employees_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_employees_clerk;
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

-- ============================================================
-- 3. Drop old Clerk JWT-based RLS policies
-- ============================================================
DROP POLICY IF EXISTS admin_all_customers ON customers;
DROP POLICY IF EXISTS admin_all_orders ON orders;
DROP POLICY IF EXISTS admin_all_subscriptions ON subscriptions;
DROP POLICY IF EXISTS admin_all_subscription_orders ON subscription_orders;
DROP POLICY IF EXISTS admin_all_rego_cache ON rego_cache;
DROP POLICY IF EXISTS admin_all_vehicle_overrides ON vehicle_overrides;
DROP POLICY IF EXISTS admin_write_site_settings ON site_settings;
DROP POLICY IF EXISTS admin_all_payables ON payables;

-- ============================================================
-- 4. Recreate admin policies using get_user_role()
-- ============================================================
CREATE POLICY admin_all_customers ON customers
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_all_orders ON orders
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_all_subscriptions ON subscriptions
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_all_subscription_orders ON subscription_orders
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_all_rego_cache ON rego_cache
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_all_vehicle_overrides ON vehicle_overrides
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_write_site_settings ON site_settings
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

CREATE POLICY admin_all_payables ON payables
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================
-- 5. Profiles RLS policies
-- ============================================================

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile (but not role — admin API handles that)
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY profiles_admin_select ON profiles
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

-- Admins can manage all profiles
CREATE POLICY profiles_admin_all ON profiles
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');

-- ============================================================
-- 6. Employees RLS policies
-- ============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select_own ON employees
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY employees_update_own ON employees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY employees_insert_own ON employees
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY employees_admin_all ON employees
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin');
