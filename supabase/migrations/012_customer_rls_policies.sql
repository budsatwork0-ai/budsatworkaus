-- 012_customer_rls_policies.sql
-- Add customer-scoped SELECT policies on orders, quotes, subscriptions.
-- Previously these tables had only admin_all_* policies; customers were filtered
-- at the API level only. These policies add database-level enforcement so that
-- direct PostgREST calls with a user session cannot read other customers' data.

-- ============================================================
-- ORDERS: customer SELECT alongside existing admin_all_orders
-- ============================================================
CREATE POLICY orders_customer_select ON orders
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'employee')
  );

-- ============================================================
-- QUOTES: RLS was never enabled in migrations 009/010
-- Enable it now and add all required policies.
-- ============================================================
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Admins and employees can do everything
CREATE POLICY quotes_admin_employee_all ON quotes
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('admin', 'employee'));

-- Customers can only read their own quotes (matched by customer_id)
CREATE POLICY quotes_customer_select ON quotes
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- ============================================================
-- SUBSCRIPTIONS: customer SELECT alongside existing admin_all_subscriptions
-- ============================================================
CREATE POLICY subscriptions_customer_select ON subscriptions
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_user_role() IN ('admin', 'employee')
  );
