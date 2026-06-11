-- 014_security_hardening.sql
-- Hardens role-based access control across profiles, employees,
-- customers, orders, quotes, subscriptions, and the audit log.

-- ============================================================
-- FIX 1 (Critical): profiles_update_own — prevent role self-escalation
-- The old WITH CHECK only verified row ownership (id = auth.uid()),
-- allowing any user to run: UPDATE profiles SET role = 'admin'.
-- The new policy locks the role column to its current value.
-- ============================================================
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- FIX 3 (High): employees_update_own — add missing WITH CHECK
-- Without WITH CHECK an employee could change their own user_id,
-- effectively claiming another employee's record.
-- ============================================================
DROP POLICY IF EXISTS employees_update_own ON employees;
CREATE POLICY employees_update_own ON employees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FIX 6 (Medium): drop redundant profiles_admin_select
-- profiles_admin_all already grants SELECT + all other ops to admins.
-- The select-only policy is redundant and creates confusion.
-- ============================================================
DROP POLICY IF EXISTS profiles_admin_select ON profiles;

-- ============================================================
-- FIX 2 (High): link customers to auth.users; fix RLS policies
--
-- orders.customer_id / quotes.customer_id / subscriptions.customer_id
-- all reference customers(id) — a CRM table with its own UUIDs.
-- The previous policies used customer_id = auth.uid(), which
-- compares different ID spaces and never matches.
--
-- Solution:
--   1. Add user_id FK to customers so portal signups can be linked.
--   2. Rewrite the three SELECT policies to use a subquery join.
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- Orders
DROP POLICY IF EXISTS orders_customer_select ON orders;
CREATE POLICY orders_customer_select ON orders
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.get_user_role() IN ('admin', 'employee')
  );

-- Quotes
DROP POLICY IF EXISTS quotes_customer_select ON quotes;
CREATE POLICY quotes_customer_select ON quotes
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.get_user_role() IN ('admin', 'employee')
  );

-- Subscriptions
DROP POLICY IF EXISTS subscriptions_customer_select ON subscriptions;
CREATE POLICY subscriptions_customer_select ON subscriptions
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR public.get_user_role() IN ('admin', 'employee')
  );

-- ============================================================
-- FIX (Audit log): add missing columns referenced in application code
-- audit_log inserts in register/route.ts and users/role/route.ts
-- reference user_email and details columns that don't exist in the
-- original schema (004_audit_log.sql), causing silent insert errors.
-- ============================================================
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS details text;

CREATE INDEX IF NOT EXISTS audit_log_user_email_idx ON audit_log(user_email);
