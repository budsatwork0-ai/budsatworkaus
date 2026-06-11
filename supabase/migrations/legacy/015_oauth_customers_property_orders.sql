-- 015_oauth_customers_property_orders.sql
-- Three improvements:
--   1. Google OAuth signups now create a customers row (matching email-signups)
--   2. customer_properties table for portal property details (replaces localStorage)
--   3. assigned_employee_id on orders for proper employee-scoped RLS

-- ============================================================
-- FIX: Google OAuth users don't get a customers row
--
-- Migration 013 extended handle_new_auth_user() to create a profiles
-- row for OAuth signups, but it never creates a customers row.
-- Email-based customer signups do create a customers row (via the
-- register API) but OAuth signups were silently skipped, meaning the
-- RLS policies added in 014 couldn't match their orders/quotes.
--
-- Solution: extend the trigger to also insert into customers when
-- the resolved role is 'customer' (the default for OAuth signups).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name TEXT;
  resolved_role TEXT;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Password signups carry the intended role in app_metadata (set by the register API).
  -- OAuth signups have no app_metadata role yet, so default to 'customer'.
  resolved_role := COALESCE(NEW.raw_app_meta_data->>'role', 'customer');

  -- Create profiles row (ON CONFLICT DO NOTHING so the register API upsert wins
  -- for email signups where the trigger fires first).
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, display_name, NEW.email, resolved_role)
  ON CONFLICT (id) DO NOTHING;

  -- For customer-role signups (always true for OAuth, true for email-customer signups
  -- before the register API upsert runs) also seed a customers CRM row.
  -- The register API already inserts a customers row for email signups, so use
  -- ON CONFLICT DO NOTHING to avoid duplicates.
  IF resolved_role = 'customer' THEN
    INSERT INTO public.customers (full_name, email, user_id)
    VALUES (display_name, NEW.email, NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Add a UNIQUE constraint on customers.user_id so ON CONFLICT works above.
-- Only add if it doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_user_id_key'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_user_id_key UNIQUE (user_id);
  END IF;
END;
$$;

-- ============================================================
-- customer_properties: persistent portal property details
--
-- Replaces the localStorage-only implementation in
-- src/app/(app)/portal/property/page.tsx. Each portal customer
-- has at most one property record (enforced by UNIQUE user_id).
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text,
  gate_code text,
  pet_warnings text,
  parking text,
  special_instructions text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id)
);

ALTER TABLE customer_properties ENABLE ROW LEVEL SECURITY;

-- Customers manage their own record
CREATE POLICY property_own ON customer_properties
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins and employees can read all property records (needed when crew are on-site)
CREATE POLICY property_staff_select ON customer_properties
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'employee'));

-- Auto-update updated_at
CREATE TRIGGER trg_customer_properties_updated_at
  BEFORE UPDATE ON customer_properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- orders.assigned_employee_id: scoped employee RLS
--
-- Employees previously had SELECT access to ALL orders. This adds
-- an optional assignment column so the RLS can be tightened:
--   • Unassigned orders (NULL) remain visible to all employees
--     so the job-board "Find Jobs" flow still works.
--   • Once assigned, only the assigned employee + admins see it.
-- ============================================================
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_employee ON orders(assigned_employee_id);

-- Update the combined customer+employee SELECT policy
DROP POLICY IF EXISTS orders_customer_select ON orders;
CREATE POLICY orders_customer_select ON orders
  FOR SELECT TO authenticated
  USING (
    -- Customers see their own orders
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    -- Admins see everything (also covered by admin_all_orders, but explicit here)
    OR public.get_user_role() = 'admin'
    -- Employees see unassigned orders (job board) or their own assigned orders
    OR (
      public.get_user_role() = 'employee'
      AND (assigned_employee_id IS NULL OR assigned_employee_id = auth.uid())
    )
  );
