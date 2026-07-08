-- 149_remove_foreman_agent.sql
--
-- Removes the unimplemented foreman agent row from the agents registry.
-- Foreman has no source file, no execution path, and its purpose is fully
-- covered by bud-observer (fleet monitoring) and lobby-theme-curator (lobby state).
--
-- Retains: foreman_lobby_states, foreman_insights, agent_workflow_memberships
-- (tables are harmless and agent_workflow_memberships contains useful workflow metadata).
--
-- foreman_insights.agent_id references agents(id) ON DELETE SET NULL — safe.
-- agent_config_versions.agent_id is NO ACTION — must be cleared first.
-- All other referencing tables use CASCADE or SET NULL and handle themselves.

DELETE FROM public.agent_config_versions WHERE agent_id = 'foreman';
DELETE FROM public.agents WHERE id = 'foreman';
