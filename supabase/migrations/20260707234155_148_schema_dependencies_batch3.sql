-- =====================================================================
-- Migration 148: schema_dependencies batch 3
-- =====================================================================
-- Closes the schema_dependencies audit for the final two agents.
--
-- browser-agent: writes to bud_browser_test_runs via browser-executor.ts
--   (storeBrowserTestRun, line 210). Dependency confirmed by source audit.
--
-- design-developer: reads filesystem only (fs.promises.readFile on theme
--   files). Zero Supabase calls. ARRAY[]::text[] disambiguates "audited,
--   no deps" from NULL ("not yet audited").
--
-- foreman: no source file, no execution path — left NULL intentionally.
-- =====================================================================

update public.agents
  set schema_dependencies = ARRAY['bud_browser_test_runs']
  where id = 'browser-agent';

update public.agents
  set schema_dependencies = ARRAY[]::text[]
  where id = 'design-developer';
