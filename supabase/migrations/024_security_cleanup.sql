-- 024_security_cleanup.sql
-- Resolves all Supabase security advisor ERRORs and WARNs:
--   1. Enable RLS on tables that had policies but RLS off
--   2. Enable RLS + add policies on fully unprotected tables
--   3. Drop overly-permissive USING(true) duplicate policies
--   4. Fix function mutable search paths
--   5. Fix auth.uid() initplan performance in RLS policies
--   6. Add policy to classification_feedback (RLS on, no policy)

-- ============================================================
-- 1. ENABLE RLS on tables with existing policies but RLS off
-- ============================================================
ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. UNPROTECTED TABLES — enable RLS and add least-privilege policies
-- ============================================================

-- applicants: admin sees all, anon can insert (job applications)
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS applicants_admin_all     ON public.applicants;
DROP POLICY IF EXISTS applicants_public_insert ON public.applicants;
CREATE POLICY applicants_admin_all ON public.applicants
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY applicants_public_insert ON public.applicants
  FOR INSERT TO anon
  WITH CHECK (true);

-- job_assignments: admin all, employees see/update their own assignments
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_assignments_admin_all    ON public.job_assignments;
DROP POLICY IF EXISTS job_assignments_employee_own ON public.job_assignments;
CREATE POLICY job_assignments_admin_all ON public.job_assignments
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY job_assignments_employee_own ON public.job_assignments
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY job_assignments_employee_update ON public.job_assignments
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  );

-- job_completions: admin all, employees can insert/select for their own assignments
ALTER TABLE public.job_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_completions_admin_all    ON public.job_completions;
DROP POLICY IF EXISTS job_completions_employee_own ON public.job_completions;
CREATE POLICY job_completions_admin_all ON public.job_completions
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY job_completions_employee_own ON public.job_completions
  FOR ALL TO authenticated
  USING (
    assignment_id IN (
      SELECT ja.id FROM public.job_assignments ja
      JOIN public.employees e ON e.id = ja.employee_id
      WHERE e.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    assignment_id IN (
      SELECT ja.id FROM public.job_assignments ja
      JOIN public.employees e ON e.id = ja.employee_id
      WHERE e.user_id = (SELECT auth.uid())
    )
  );

-- employee_documents: admin all, employees manage their own docs
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_documents_admin_all   ON public.employee_documents;
DROP POLICY IF EXISTS employee_documents_employee_own ON public.employee_documents;
CREATE POLICY employee_documents_admin_all ON public.employee_documents
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY employee_documents_employee_own ON public.employee_documents
  FOR ALL TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  );

-- employee_onboarding: admin all, employees manage their own onboarding
ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_onboarding_admin_all    ON public.employee_onboarding;
DROP POLICY IF EXISTS employee_onboarding_employee_own ON public.employee_onboarding;
CREATE POLICY employee_onboarding_admin_all ON public.employee_onboarding
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY employee_onboarding_employee_own ON public.employee_onboarding
  FOR ALL TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = (SELECT auth.uid())
    )
  );

-- checklist_templates: admin manages, employees/admin can read
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checklist_templates_admin_all        ON public.checklist_templates;
DROP POLICY IF EXISTS checklist_templates_staff_select     ON public.checklist_templates;
CREATE POLICY checklist_templates_admin_all ON public.checklist_templates
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY checklist_templates_staff_select ON public.checklist_templates
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'employee'));

-- audit_log: admin read-only (inserts come from service role which bypasses RLS)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_admin_select ON public.audit_log;
CREATE POLICY audit_log_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

-- payouts: admin only — all writes come from the webhook service role
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payouts_admin_all ON public.payouts;
CREATE POLICY payouts_admin_all ON public.payouts
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================
-- 3. classification_feedback: RLS enabled but no policy existed
-- ============================================================
DROP POLICY IF EXISTS classification_feedback_admin_all ON public.classification_feedback;
CREATE POLICY classification_feedback_admin_all ON public.classification_feedback
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ============================================================
-- 4. DROP overly-permissive duplicate policies
--    (USING(true) for all authenticated — replace with admin-only)
-- ============================================================

-- payables: drop the USING(true) duplicate; keep admin_all_payables
DROP POLICY IF EXISTS authenticated_manage_payables ON public.payables;

-- site_settings: drop the USING(true) duplicate; keep admin_write_site_settings
DROP POLICY IF EXISTS authenticated_manage_site_settings ON public.site_settings;

-- ============================================================
-- 5. FIX FUNCTION SEARCH PATHS (mutable search_path = WARN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================
-- 6. FIX auth RLS INITPLAN — replace auth.uid() with (select auth.uid())
--    Prevents re-evaluation of auth.uid() for every row scanned.
-- ============================================================

-- profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  );

-- ratings
DROP POLICY IF EXISTS ratings_customer_select ON public.ratings;
CREATE POLICY ratings_customer_select ON public.ratings
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid())
    )
    OR public.get_user_role() IN ('admin', 'employee')
  );

-- quotes
DROP POLICY IF EXISTS quotes_customer_select ON public.quotes;
CREATE POLICY quotes_customer_select ON public.quotes
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid())
    )
    OR public.get_user_role() IN ('admin', 'employee')
  );

-- customer_properties (uses user_id directly, not via customers table)
DROP POLICY IF EXISTS property_own ON public.customer_properties;
CREATE POLICY property_own ON public.customer_properties
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- site_feedback
DROP POLICY IF EXISTS "Staff can view feedback" ON public.site_feedback;
CREATE POLICY "Staff can view feedback" ON public.site_feedback
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'employee'));

DROP POLICY IF EXISTS "Staff can update feedback" ON public.site_feedback;
CREATE POLICY "Staff can update feedback" ON public.site_feedback
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'employee'))
  WITH CHECK (public.get_user_role() IN ('admin', 'employee'));

-- site_visitors
DROP POLICY IF EXISTS "Authenticated users can read visitors" ON public.site_visitors;
CREATE POLICY "Authenticated users can read visitors" ON public.site_visitors
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- page_views
DROP POLICY IF EXISTS "Authenticated users can read page_views" ON public.page_views;
CREATE POLICY "Authenticated users can read page_views" ON public.page_views
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);
