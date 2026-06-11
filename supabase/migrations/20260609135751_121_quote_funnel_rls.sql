-- Enable RLS on quote_funnel_events.
-- With RLS enabled and no permissive policies, all anon/authenticated
-- reads, updates, and deletes are denied by default.
-- Inserts only reach this table via the service-role API route
-- (/api/analytics/quote-funnel), which bypasses RLS entirely.
alter table quote_funnel_events enable row level security;

