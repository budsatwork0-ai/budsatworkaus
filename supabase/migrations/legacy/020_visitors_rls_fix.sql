-- 020_visitors_rls_fix.sql
-- Relax the SELECT policies on visitor tracking tables.
-- The original policies checked employees.user_id = auth.uid(), which excluded
-- owner/admin accounts that are not in the employees table.
-- Any authenticated user (i.e. anyone logged into the dashboard) can read.

DROP POLICY IF EXISTS "Staff can read visitors"   ON site_visitors;
DROP POLICY IF EXISTS "Staff can read page_views" ON page_views;

CREATE POLICY "Authenticated users can read visitors"
  ON site_visitors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read page_views"
  ON page_views FOR SELECT
  USING (auth.role() = 'authenticated');
