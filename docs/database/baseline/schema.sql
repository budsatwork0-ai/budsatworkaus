


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "extensions";


ALTER SCHEMA "extensions" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."pipeline_run_status" AS ENUM (
    'open',
    'in_progress',
    'succeeded',
    'rejected',
    'rolled_back'
);


ALTER TYPE "public"."pipeline_run_status" OWNER TO "postgres";


CREATE TYPE "public"."pipeline_run_verdict" AS ENUM (
    'pending',
    'auto_merge',
    'human_review',
    'rejected',
    'rolled_back'
);


ALTER TYPE "public"."pipeline_run_verdict" OWNER TO "postgres";


CREATE TYPE "public"."pipeline_stage" AS ENUM (
    'detect',
    'analyze',
    'design',
    'generate',
    'sandbox',
    'validate',
    'reject',
    'debate',
    'deploy',
    'observe'
);


ALTER TYPE "public"."pipeline_stage" OWNER TO "postgres";


CREATE TYPE "public"."pipeline_stage_status" AS ENUM (
    'idle',
    'active',
    'passed',
    'rejected',
    'skipped'
);


ALTER TYPE "public"."pipeline_stage_status" OWNER TO "postgres";


CREATE TYPE "public"."pipeline_surface" AS ENUM (
    'public',
    'admin',
    'crew',
    'customer'
);


ALTER TYPE "public"."pipeline_surface" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "extensions"."grant_pg_cron_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_cron_access"() IS 'Grants access to pg_cron';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_graphql_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_graphql_access"() IS 'Grants access to pg_graphql';



CREATE OR REPLACE FUNCTION "extensions"."grant_pg_net_access"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."grant_pg_net_access"() IS 'Grants access to pg_net';



CREATE OR REPLACE FUNCTION "extensions"."pgrst_ddl_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."pgrst_drop_watch"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "extensions"."set_graphql_placeholder"() RETURNS "event_trigger"
    LANGUAGE "plpgsql"
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";


COMMENT ON FUNCTION "extensions"."set_graphql_placeholder"() IS 'Reintroduces placeholder function for graphql_public.graphql';



CREATE OR REPLACE FUNCTION "public"."admin_opt_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."admin_opt_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_v2_classify_root_cause"("signal_type" "text", "title" "text", "description" "text", "affected_area" "text", "payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("root_cause_id" "text", "root_cause_key" "text", "initiative_title" "text")
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  combined text;
  area text;
begin
  combined := lower(concat_ws(' ',
    signal_type,
    title,
    description,
    affected_area,
    coalesce(payload::text, '')
  ));
  area := public.ai_v2_normalize_area(affected_area);

  if combined ~ '(silent[-\s]?success|succeeded[_\s-]?no[_\s-]?output|no[-\s]?output|empty output|produced no output|no useful output|output contract|schema validation|output schema|runtime schema|agentresult|agent-output-guard)' then
    root_cause_id := 'silent_success';
    root_cause_key := 'silent_success';
    initiative_title := 'Fleet-Wide Output Semantics / Silent Success';
  elsif combined ~ '(reply_channel|reply channel|messenger_psid|sms|phone lead|manual callback|unroutable|missing psid)' then
    root_cause_id := 'customer_reply_routing';
    root_cause_key := case when area is null then 'customer_reply_routing' else 'customer_reply_routing:' || area end;
    initiative_title := 'Customer Reply Routing Readiness';
  elsif combined ~ '(watch_urls|watch urls|competitor_pages|no competitor|knowledge_articles|knowledge corpus|corpus|not configured|config missing)' then
    root_cause_id := 'agent_config_missing';
    root_cause_key := case when area is null then 'agent_config_missing' else 'agent_config_missing:' || area end;
    initiative_title := 'Agent Configuration Readiness';
  elsif combined ~ '(observability|metric|alert|monitoring|dashboard|blind spot|telemetry)' then
    root_cause_id := 'observability_gap';
    root_cause_key := 'observability_gap';
    initiative_title := 'Silent-Success Observability';
  else
    root_cause_id := 'data_readiness';
    root_cause_key := case when area is null then 'data_readiness' else 'data_readiness:' || area end;
    initiative_title := 'Agent Data Readiness';
  end if;

  return next;
end;
$$;


ALTER FUNCTION "public"."ai_v2_classify_root_cause"("signal_type" "text", "title" "text", "description" "text", "affected_area" "text", "payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_v2_normalize_area"("area" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select nullif(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(area, '')), '^(agents?|agent)\s*/\s*', ''), '[^a-z0-9-]+', '-', 'g'), '(^-+|-+$)', '', 'g'), '')
$_$;


ALTER FUNCTION "public"."ai_v2_normalize_area"("area" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_anonymous_quotes"("p_user_id" "uuid", "p_email" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.quotes
  SET customer_id = p_user_id,
      updated_at  = now()
  WHERE lower(customer_email) = lower(p_email)
    AND customer_id IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;


ALTER FUNCTION "public"."claim_anonymous_quotes"("p_user_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_single_active_theme"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.active = true then
    update public.lobby_themes set active = false where id <> new.id;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."enforce_single_active_theme"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT organisation_id FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."graph_degree"("node_id" "uuid") RETURNS TABLE("in_degree" integer, "out_degree" integer, "total" integer)
    LANGUAGE "sql" STABLE
    AS $$
  select
    (select count(*)::int from public.memory_edges where target_id = node_id) as in_degree,
    (select count(*)::int from public.memory_edges where source_id = node_id) as out_degree,
    (select count(*)::int from public.memory_edges
     where source_id = node_id or target_id = node_id)                       as total;
$$;


ALTER FUNCTION "public"."graph_degree"("node_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."graph_export"() RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  select json_build_object(
    'nodes', (
      select json_agg(json_build_object(
        'id',            d.id,
        'title',         d.title,
        'category',      d.category,
        'tags',          d.tags,
        'freshness',     d.freshness_score,
        'source',        d.source,
        'importance',    coalesce(e.importance_score, 0.5),
        'systems',       coalesce(e.systems_mentioned, '{}'),
        'vault_path',    d.vault_path,
        'updated_at',    d.updated_at
      ))
      from public.memory_documents d
      left join public.memory_graph_extractions e on e.document_id = d.id
      where d.status = 'active'
    ),
    'links', (
      select json_agg(json_build_object(
        'source',       me.source_id,
        'target',       me.target_id,
        'type',         me.relationship,
        'strength',     me.strength,
        'metadata',     me.metadata
      ))
      from public.memory_edges me
      join public.memory_documents src on src.id = me.source_id and src.status = 'active'
      join public.memory_documents tgt on tgt.id = me.target_id and tgt.status = 'active'
    )
  );
$$;


ALTER FUNCTION "public"."graph_export"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."graph_neighbors"("start_id" "uuid", "max_depth" integer DEFAULT 2, "rel_types" "text"[] DEFAULT NULL::"text"[], "min_strength" double precision DEFAULT 0.0) RETURNS TABLE("node_id" "uuid", "depth" integer, "path" "uuid"[], "relationship" "text", "strength" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  with recursive bfs as (
    -- Base: the starting node itself (depth 0)
    select
      start_id      as node_id,
      0             as depth,
      array[start_id] as path,
      null::text    as relationship,
      1.0::float    as strength

    union all

    -- Recurse: follow edges outward from each frontier node
    select
      e.target_id,
      b.depth + 1,
      b.path || e.target_id,
      e.relationship,
      e.strength
    from bfs b
    join public.memory_edges e on e.source_id = b.node_id
    where
      b.depth < max_depth
      and e.target_id <> all(b.path)           -- no cycles
      and (rel_types is null or e.relationship = any(rel_types))
      and e.strength >= min_strength
  )
  select distinct on (node_id)
    node_id, depth, path, relationship, strength
  from bfs
  order by node_id, depth;
$$;


ALTER FUNCTION "public"."graph_neighbors"("start_id" "uuid", "max_depth" integer, "rel_types" "text"[], "min_strength" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."graph_shortest_path"("from_id" "uuid", "to_id" "uuid", "max_hops" integer DEFAULT 5) RETURNS TABLE("node_id" "uuid", "depth" integer, "relationship" "text", "path" "uuid"[])
    LANGUAGE "sql" STABLE
    AS $$
  with recursive bfs as (
    select
      from_id as node_id,
      0       as depth,
      null::text as relationship,
      array[from_id] as path

    union all

    select
      e.target_id,
      b.depth + 1,
      e.relationship,
      b.path || e.target_id
    from bfs b
    join public.memory_edges e on e.source_id = b.node_id
    where
      b.depth < max_hops
      and e.target_id <> all(b.path)
  )
  select node_id, depth, relationship, path
  from bfs
  where node_id = to_id
  order by depth
  limit 1;
$$;


ALTER FUNCTION "public"."graph_shortest_path"("from_id" "uuid", "to_id" "uuid", "max_hops" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_artifacts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_artifacts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_campaign_factory_runs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_campaign_factory_runs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_content_assets_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_content_assets_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_content_ideas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_content_ideas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_content_learning_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_content_learning_records_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_content_library_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_content_library_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_content_production_cards_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_content_production_cards_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_content_scripts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_content_scripts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_journal_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_journal_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_marketing_campaigns_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_marketing_campaigns_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_marketing_distribution_playbooks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_marketing_distribution_playbooks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_marketing_publishing_queue_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_marketing_publishing_queue_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_marketing_social_channels_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_marketing_social_channels_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- Seed the domain table that matches the role.
  -- Safe against double-inserts from the register API via ON CONFLICT DO NOTHING.
  IF resolved_role = 'customer' THEN
    INSERT INTO public.customers (full_name, email, user_id)
    VALUES (display_name, NEW.email, NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  ELSIF resolved_role = 'employee' THEN
    -- crew_access_approved intentionally left at DEFAULT (false) so an admin
    -- must explicitly approve before the employee can see the crew portal.
    INSERT INTO public.employees (user_id, full_name, email, status, onboarding_complete)
    VALUES (NEW.id, display_name, NEW.email, 'active', false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_auth_user"() IS 'Runs on auth.users INSERT. Creates profiles row for every signup, plus a customers row for customer-role signups and an employees row for employee-role signups. ON CONFLICT DO NOTHING makes it safe to coexist with any register API that also inserts these rows.';



CREATE OR REPLACE FUNCTION "public"."handle_research_trends_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_research_trends_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_arcs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_story_arcs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_bible_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_story_bible_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_chapters_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_story_chapters_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_characters_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_story_characters_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_drafts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_story_drafts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_opps_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_story_opps_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_reviews_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_story_reviews_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_story_threads_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."handle_story_threads_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_session_pages"("p_session_id" "text", "p_now" timestamp with time zone) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE analytics_sessions
  SET pages_visited = pages_visited + 1,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;


ALTER FUNCTION "public"."increment_session_pages"("p_session_id" "text", "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_session_time"("p_session_id" "text", "p_seconds" integer, "p_now" timestamp with time zone) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE analytics_sessions
  SET total_seconds = total_seconds + p_seconds,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;


ALTER FUNCTION "public"."increment_session_time"("p_session_id" "text", "p_seconds" integer, "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_pipeline_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner')
  );
$$;


ALTER FUNCTION "public"."is_pipeline_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_lead_conversation_test_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_test = false THEN
    SELECT is_test INTO NEW.is_test FROM leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_lead_conversation_test_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_message_environment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  parent_environment text;
  parent_is_test boolean;
BEGIN
  SELECT environment, is_test
  INTO parent_environment, parent_is_test
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  IF parent_environment = 'sandbox' OR parent_is_test = true THEN
    NEW.environment = 'sandbox';
    NEW.is_test = true;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_message_environment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_message_test_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_test = false THEN
    SELECT is_test INTO NEW.is_test FROM conversations WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_message_test_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_order_environment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  parent_environment text;
  parent_is_test boolean;
BEGIN
  IF NEW.quote_id IS NOT NULL THEN
    SELECT environment, is_test
    INTO parent_environment, parent_is_test
    FROM public.quotes
    WHERE id = NEW.quote_id;

    IF parent_environment = 'sandbox' OR parent_is_test = true THEN
      NEW.environment = 'sandbox';
      NEW.is_test = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_order_environment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."propagate_order_test_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_test = false AND NEW.quote_id IS NOT NULL THEN
    SELECT is_test INTO NEW.is_test FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."propagate_order_test_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_memory_freshness"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  rec        record;
  decay_rate float;
  days_old   float;
begin
  for rec in
    select id, category, updated_at, freshness_score
    from public.memory_documents
    where status = 'active'
  loop
    decay_rate := case rec.category
      when 'deployments'   then 0.93
      when 'bugs'          then 0.95
      when 'analytics'     then 0.97
      when 'pricing'       then 0.98
      when 'customers'     then 0.98
      when 'ux'            then 0.99
      when 'admin'         then 0.99
      when 'sops'          then 0.995
      when 'architecture'  then 0.999
      when 'design'        then 0.999
      else 0.99
    end;

    days_old := extract(epoch from (now() - rec.updated_at)) / 86400.0;

    update public.memory_documents
    set freshness_score = greatest(0.0, least(1.0, power(decay_rate, days_old)))
    where id = rec.id;
  end loop;
end;
$$;


ALTER FUNCTION "public"."refresh_memory_freshness"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sandbox_lesson_counts_by_agent"() RETURNS TABLE("agent_id" "text", "lesson_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT agent_id, COUNT(*)::bigint AS lesson_count
  FROM   public.sandbox_lessons_learned
  WHERE  environment = 'sandbox'
  GROUP  BY agent_id;
$$;


ALTER FUNCTION "public"."sandbox_lesson_counts_by_agent"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_agent_runs"("query_embedding" "public"."vector", "match_count" integer DEFAULT 10) RETURNS TABLE("run_id" "uuid", "agent_id" "text", "summary" "text", "started_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    id             AS run_id,
    agent_id,
    summary,
    started_at,
    1 - (summary_embedding <=> query_embedding) AS similarity
  FROM agent_runs
  WHERE summary_embedding IS NOT NULL
  ORDER BY summary_embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_agent_runs"("query_embedding" "public"."vector", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_memory"("query_embedding" "public"."vector", "match_threshold" double precision DEFAULT 0.70, "match_count" integer DEFAULT 5, "filter_category" "text" DEFAULT NULL::"text", "filter_scope" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "vault_path" "text", "category" "text", "title" "text", "body" "text", "tags" "text"[], "agent_scope" "text", "source" "text", "freshness_score" double precision, "similarity" double precision, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  select
    d.id,
    d.vault_path,
    d.category,
    d.title,
    d.body,
    d.tags,
    d.agent_scope,
    d.source,
    d.freshness_score,
    1 - (d.embedding <=> query_embedding)  as similarity,
    d.created_at,
    d.updated_at
  from public.memory_documents d
  where
    d.status       = 'active'
    and d.embedding is not null
    and (filter_category is null or d.category = filter_category)
    -- scope: include global memories (agent_scope is null) plus any docs
    -- scoped to the requesting agent
    and (filter_scope is null or d.agent_scope is null or d.agent_scope = filter_scope)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;


ALTER FUNCTION "public"."search_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_category" "text", "filter_scope" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_repair_learnings"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "root_cause_type" "text", "fix_pattern" "text", "outcome" "text", "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    id,
    root_cause_type,
    fix_pattern,
    outcome,
    created_at,
    1 - (summary_embedding <=> query_embedding) AS similarity
  FROM public.bud_repair_learnings
  WHERE summary_embedding IS NOT NULL
  ORDER BY summary_embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_repair_learnings"("query_embedding" "public"."vector", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ndis_org_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_ndis_org_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_ndis"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_ndis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_environment_from_is_test"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_test = true THEN
    NEW.environment = 'sandbox';
  END IF;

  IF NEW.environment = 'sandbox' THEN
    NEW.is_test = true;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_environment_from_is_test"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_conversation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."touch_conversation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_memory_document"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_memory_document"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_agent_runs_update_last_run"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.finished_at is not null then
    update public.agents
    set
      last_run_at = greatest(coalesce(last_run_at, '1970-01-01'::timestamptz), NEW.finished_at),
      last_success_at = case
        when NEW.status = 'succeeded'
          then greatest(coalesce(last_success_at, '1970-01-01'::timestamptz), NEW.finished_at)
        else last_success_at
      end,
      updated_at = now()
    where id = NEW.agent_id;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_fn_agent_runs_update_last_run"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_orders_status_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if NEW.status is distinct from OLD.status then
    NEW.status_updated_at := now();
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."trg_fn_orders_status_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_root_cause_initiative_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_root_cause_initiative_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_run_quality_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_delta       float;
  v_current     float;
  v_new_score   float;
  v_signal      jsonb;
BEGIN
  -- Only act on status transitions to approved or rejected
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  v_delta := CASE WHEN NEW.status = 'approved' THEN 0.2 ELSE -0.2 END;

  -- Build a signal record for the audit trail
  v_signal := jsonb_build_object(
    'action_type', NEW.action_type,
    'status',      NEW.status,
    'delta',       v_delta,
    'at',          now()
  );

  -- Read current score (NULL → 0.5 starting point)
  SELECT COALESCE(quality_score, 0.5) INTO v_current
  FROM agent_runs WHERE id = NEW.run_id;

  v_new_score := GREATEST(0.0, LEAST(1.0, v_current + v_delta));

  UPDATE agent_runs
  SET
    quality_score   = v_new_score,
    quality_signals = COALESCE(quality_signals, '[]'::jsonb) || v_signal
  WHERE id = NEW.run_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_run_quality_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_optimization_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" DEFAULT 'admin-optimization'::"text" NOT NULL,
    "run_id" "text" NOT NULL,
    "focus_area" "text" NOT NULL,
    "page_path" "text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "priority" "text" DEFAULT 'P2'::"text" NOT NULL,
    "friction_total" integer DEFAULT 0 NOT NULL,
    "friction_band" "text" DEFAULT 'low'::"text" NOT NULL,
    "clicks_saved" integer,
    "time_saved_min_week" integer,
    "automation_candidate" boolean DEFAULT false NOT NULL,
    "automation_recipe" "text",
    "proposed_change" "jsonb",
    "workflow_diagram" "text",
    "is_recurring" boolean DEFAULT false NOT NULL,
    "evidence" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_optimization_findings_friction_band_check" CHECK (("friction_band" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "admin_optimization_findings_priority_check" CHECK (("priority" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text"]))),
    CONSTRAINT "admin_optimization_findings_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "admin_optimization_findings_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'resolved'::"text", 'wont_fix'::"text"])))
);


ALTER TABLE "public"."admin_optimization_findings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_friction_open" AS
 SELECT "id",
    "focus_area",
    "page_path",
    "title",
    "priority",
    "friction_total",
    "friction_band",
    "clicks_saved",
    "time_saved_min_week",
    "automation_candidate",
    "automation_recipe",
    "is_recurring",
    "created_at"
   FROM "public"."admin_optimization_findings"
  WHERE (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text"])) AND ("friction_band" = ANY (ARRAY['high'::"text", 'critical'::"text"])))
  ORDER BY "friction_total" DESC, "created_at" DESC;


ALTER VIEW "public"."admin_friction_open" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_ux_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "page_path" "text" NOT NULL,
    "audience" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "proposed_change" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_ux_proposals_audience_check" CHECK (("audience" = ANY (ARRAY['admin'::"text", 'crew'::"text", 'public'::"text", 'lobby'::"text"]))),
    CONSTRAINT "admin_ux_proposals_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "admin_ux_proposals_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'accepted'::"text", 'rejected'::"text", 'shipped'::"text"])))
);


ALTER TABLE "public"."admin_ux_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "agent_id" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_table" "text",
    "target_id" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "preview" "text",
    "requires_approval" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "executed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action_identity" "text",
    "root_cause_id" "text",
    "root_cause_key" "text",
    "initiative_id" "uuid",
    "superseded_by" "uuid",
    "is_duplicate" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "agent_actions_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "agent_actions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'executed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."agent_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid",
    "agent_id" "text",
    "source_agent" "text",
    "severity" "text",
    "title" "text",
    "message" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "agent_alerts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."agent_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_config_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "version" integer NOT NULL,
    "config" "jsonb" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "proposal_id" "uuid",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_config_versions_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'proposal'::"text", 'migration'::"text"])))
);


ALTER TABLE "public"."agent_config_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_evolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_agent_id" "text" NOT NULL,
    "run_id" "uuid",
    "evolution_type" "text" NOT NULL,
    "rationale" "text" NOT NULL,
    "evidence" "jsonb",
    "proposed_diff" "jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_evolutions_evolution_type_check" CHECK (("evolution_type" = ANY (ARRAY['prompt_tweak'::"text", 'config_change'::"text", 'autonomy_change'::"text", 'schedule_change'::"text", 'retire'::"text", 'new_agent'::"text"]))),
    CONSTRAINT "agent_evolutions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'applied'::"text"])))
);


ALTER TABLE "public"."agent_evolutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_guardrail_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "agent_id" "text" NOT NULL,
    "policy_id" "text" NOT NULL,
    "hook" "text" NOT NULL,
    "verdict" "text" NOT NULL,
    "reason" "text",
    "lineage_depth" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_guardrail_events_verdict_check" CHECK (("verdict" = ANY (ARRAY['warn'::"text", 'modify'::"text", 'block'::"text", 'allow'::"text"])))
);


ALTER TABLE "public"."agent_guardrail_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "weight" real DEFAULT 1.0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "trigger" "text" NOT NULL,
    "triggered_by" "uuid",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "output" "jsonb",
    "summary" "text",
    "error" "text",
    "model" "text",
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "cost_cents" integer DEFAULT 0,
    "duration_ms" integer,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "quality_score" double precision,
    "quality_signals" "jsonb" DEFAULT '[]'::"jsonb",
    "cache_read_tokens" integer DEFAULT 0,
    "cache_creation_tokens" integer DEFAULT 0,
    "summary_embedding" "public"."vector"(1536),
    "confidence_score" real,
    "evidence_payload" "jsonb",
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "agent_runs_confidence_score_check" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::double precision) AND ("confidence_score" <= (1)::double precision)))),
    CONSTRAINT "agent_runs_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "agent_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'succeeded'::"text", 'failed'::"text", 'needs_approval'::"text", 'needs_repair'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "agent_runs_trigger_check" CHECK (("trigger" = ANY (ARRAY['cron'::"text", 'manual'::"text", 'webhook'::"text", 'event'::"text"])))
);


ALTER TABLE "public"."agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_workflow_memberships" (
    "workflow_id" "text" NOT NULL,
    "agent_id" "text" NOT NULL,
    "position" integer NOT NULL
);


ALTER TABLE "public"."agent_workflow_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "status" "text" DEFAULT 'enabled'::"text" NOT NULL,
    "autonomy" "text" DEFAULT 'review'::"text" NOT NULL,
    "schedule" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_run_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "stale_after_minutes" integer,
    "schema_dependencies" "text"[],
    CONSTRAINT "agents_autonomy_check" CHECK (("autonomy" = ANY (ARRAY['auto'::"text", 'review'::"text", 'manual'::"text"]))),
    CONSTRAINT "agents_category_check" CHECK (("category" = ANY (ARRAY['sales'::"text", 'support'::"text", 'ops'::"text", 'hiring'::"text", 'finance'::"text", 'compliance'::"text", 'executive'::"text"]))),
    CONSTRAINT "agents_status_check" CHECK (("status" = ANY (ARRAY['enabled'::"text", 'paused'::"text", 'disabled'::"text", 'planned'::"text", 'idle'::"text", 'watch'::"text"])))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid",
    "run_id" "text" NOT NULL,
    "finding_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "priority" "text" NOT NULL,
    "metric" "text",
    "body" "text",
    "proposed_action" "jsonb",
    "affected_systems" "text"[],
    "backlinks" "text"[],
    "correlates_with_deployment" boolean DEFAULT false NOT NULL,
    "deployment_note" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_findings_priority_check" CHECK (("priority" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text"]))),
    CONSTRAINT "analytics_findings_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "analytics_findings_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'wont_fix'::"text"])))
);


ALTER TABLE "public"."analytics_findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "text" NOT NULL,
    "period_days" integer DEFAULT 14 NOT NULL,
    "period_end" "date" NOT NULL,
    "executive_summary" "text",
    "funnel_health" "jsonb",
    "cta_health" "jsonb",
    "mobile_health" "jsonb",
    "deployment_correlation" "jsonb",
    "trend_summary" "text",
    "regression_alerts" "text"[],
    "posthog_available" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_reports" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_funnel_trend" AS
 SELECT "period_end",
    (("funnel_health" ->> 'weakest_step'::"text"))::integer AS "weakest_step",
    (("funnel_health" ->> 'weakest_step_dropout_pct'::"text"))::numeric AS "weakest_step_dropout_pct",
    (("funnel_health" ->> 'overall_conversion_rate'::"text"))::numeric AS "overall_conversion_rate"
   FROM "public"."analytics_reports"
  WHERE ("funnel_health" IS NOT NULL)
  ORDER BY "period_end" DESC
 LIMIT 8;


ALTER VIEW "public"."analytics_funnel_trend" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_funnels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid",
    "funnel_name" "text" DEFAULT 'quote'::"text" NOT NULL,
    "step_index" integer NOT NULL,
    "step_name" "text" NOT NULL,
    "entered" integer DEFAULT 0 NOT NULL,
    "dropped" integer DEFAULT 0 NOT NULL,
    "drop_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "period_end" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_funnels" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_latest_report" AS
 SELECT "id",
    "run_id",
    "period_days",
    "period_end",
    "executive_summary",
    "funnel_health",
    "cta_health",
    "mobile_health",
    "deployment_correlation",
    "trend_summary",
    "regression_alerts",
    "posthog_available",
    "created_at",
    ( SELECT "count"(*) AS "count"
           FROM "public"."analytics_findings" "f"
          WHERE ("f"."report_id" = "r"."id")) AS "total_findings",
    ( SELECT "count"(*) AS "count"
           FROM "public"."analytics_findings" "f"
          WHERE (("f"."report_id" = "r"."id") AND ("f"."priority" = 'P0'::"text"))) AS "p0_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."analytics_findings" "f"
          WHERE (("f"."report_id" = "r"."id") AND ("f"."priority" = 'P1'::"text"))) AS "p1_count"
   FROM "public"."analytics_reports" "r"
  ORDER BY "created_at" DESC
 LIMIT 1;


ALTER VIEW "public"."analytics_latest_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_open_critical" AS
 SELECT "f"."id",
    "f"."report_id",
    "f"."finding_id",
    "f"."category",
    "f"."title",
    "f"."severity",
    "f"."priority",
    "f"."metric",
    "f"."proposed_action",
    "f"."affected_systems",
    "f"."correlates_with_deployment",
    "f"."created_at",
    "r"."period_end"
   FROM ("public"."analytics_findings" "f"
     JOIN "public"."analytics_reports" "r" ON (("r"."id" = "f"."report_id")))
  WHERE (("f"."status" = 'open'::"text") AND ("f"."priority" = ANY (ARRAY['P0'::"text", 'P1'::"text"])))
  ORDER BY
        CASE "f"."priority"
            WHEN 'P0'::"text" THEN 0
            ELSE 1
        END, "f"."created_at" DESC;


ALTER VIEW "public"."analytics_open_critical" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_sessions" (
    "session_id" "text" NOT NULL,
    "referrer" "text",
    "user_agent" "text",
    "city" "text",
    "country" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "is_returning" boolean DEFAULT false NOT NULL,
    "pages_visited" integer DEFAULT 1 NOT NULL,
    "total_seconds" integer DEFAULT 0 NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "analytics_sessions_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"])))
);


ALTER TABLE "public"."analytics_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applicants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" "text" NOT NULL,
    "stage" "text" DEFAULT 'intake'::"text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "suburb" "text",
    "availability" "text"[],
    "services" "text"[],
    "needs_transport" boolean DEFAULT false,
    "pickup_suburb" "text",
    "max_ride_minutes" integer,
    "ndis_participant" boolean DEFAULT false,
    "ndis_number" "text",
    "ndis_funding_type" "text",
    "support_coordinator_contact" "text",
    "mobility_aid" "text",
    "ride_preferences" "text",
    "car_compliant" boolean DEFAULT false,
    "all_clearances" boolean DEFAULT false,
    "resume" "text",
    "abn" "text",
    "years_experience" integer,
    "seats_available" integer,
    "boot_space" "text",
    "can_carry_aid" "text",
    "pickup_radius_km" integer,
    "quality_business_name" "text",
    "quality_contribution_types" "text"[],
    "quality_message" "text",
    "innovation_organisation" "text",
    "innovation_interest_areas" "text"[],
    "innovation_notes" "text",
    "owner" "text",
    "notes" "text",
    "missing_docs" "text"[],
    "sla_deadline" timestamp with time zone DEFAULT ("now"() + '72:00:00'::interval),
    "consent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "induction_progress" "jsonb" DEFAULT '{}'::"jsonb",
    "agent_screened_at" timestamp with time zone,
    "agent_score" integer,
    "agent_recommendation" "text",
    CONSTRAINT "applicants_role_check" CHECK (("role" = ANY (ARRAY['Casual crew'::"text", 'Support worker'::"text", 'Quality partner'::"text", 'Innovation partner'::"text"]))),
    CONSTRAINT "applicants_stage_check" CHECK (("stage" = ANY (ARRAY['intake'::"text", 'verify'::"text", 'paperwork'::"text", 'induct'::"text", 'ready'::"text"])))
);


ALTER TABLE "public"."applicants" OWNER TO "postgres";


COMMENT ON TABLE "public"."applicants" IS 'People who submitted the Get Involved form, tracked through onboarding pipeline';



CREATE TABLE IF NOT EXISTS "public"."artifact_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "artifact_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "schema_version" "text" DEFAULT 'artifact.v1'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "plain_text" "text",
    "renderer" "text" DEFAULT 'structured_react'::"text" NOT NULL,
    "render_policy" "jsonb" DEFAULT '{"mode": "structured", "allowHtml": false, "allowExternalAssets": false}'::"jsonb" NOT NULL,
    "generation_input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generation_model" "text",
    "checksum" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "artifact_versions_number_check" CHECK (("version_number" > 0)),
    CONSTRAINT "artifact_versions_render_policy_structured_check" CHECK (((COALESCE(("render_policy" ->> 'mode'::"text"), ''::"text") = 'structured'::"text") AND (COALESCE((("render_policy" ->> 'allowHtml'::"text"))::boolean, false) = false))),
    CONSTRAINT "artifact_versions_renderer_check" CHECK (("renderer" = 'structured_react'::"text"))
);


ALTER TABLE "public"."artifact_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "score" numeric,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "latest_version_id" "uuid",
    "approved_version_id" "uuid",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "artifacts_score_check" CHECK ((("score" IS NULL) OR (("score" >= (0)::numeric) AND ("score" <= (100)::numeric)))),
    CONSTRAINT "artifacts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_review'::"text", 'approved'::"text", 'rejected'::"text", 'archived'::"text"]))),
    CONSTRAINT "artifacts_type_check" CHECK (("type" = ANY (ARRAY['campaign'::"text", 'research'::"text", 'strategy'::"text", 'story'::"text", 'learning'::"text", 'executive'::"text", 'quote'::"text", 'landing_page'::"text", 'marketing'::"text", 'dashboard'::"text", 'storyboard'::"text"])))
);


ALTER TABLE "public"."artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_email" "text",
    "details" "text"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_activity_feed" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "narrative" "text" NOT NULL,
    "actor" "text",
    "target" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bud_activity_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_approval_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "action_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_by" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    "archive_reason" "text",
    "blocked_reason" "text",
    "approval_identity" "text",
    "last_seen_at" timestamp with time zone,
    "blocked_at" timestamp with time zone,
    "root_cause_id" "text",
    "root_cause_key" "text",
    "initiative_id" "uuid",
    "superseded_by" "uuid",
    "is_duplicate" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "bud_approval_queue_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "bud_approval_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'archived'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."bud_approval_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "actor_agent" "text",
    "actor_user" "uuid",
    "target_table" "text",
    "target_id" "text",
    "before_state" "jsonb",
    "after_state" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bud_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_browser_test_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid",
    "step_id" "uuid",
    "test_dir" "text" DEFAULT 'tests/e2e/golden-paths'::"text" NOT NULL,
    "project" "text" DEFAULT 'chromium'::"text" NOT NULL,
    "exit_code" integer,
    "passed" integer DEFAULT 0 NOT NULL,
    "failed" integer DEFAULT 0 NOT NULL,
    "skipped" integer DEFAULT 0 NOT NULL,
    "total" integer DEFAULT 0 NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "failures" "jsonb",
    "raw_output" "text",
    "stderr_output" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bud_browser_test_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "branch_name" "text",
    "issue_url" "text",
    "pr_url" "text",
    "deployment_url" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_change_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'merged'::"text", 'closed'::"text", 'deployed'::"text", 'stale'::"text"])))
);


ALTER TABLE "public"."bud_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_circuit_states" (
    "id" "text" NOT NULL,
    "state" "text" DEFAULT 'closed'::"text" NOT NULL,
    "failure_streak" integer DEFAULT 0 NOT NULL,
    "probe_successes" integer DEFAULT 0 NOT NULL,
    "last_failure_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "opens_at" timestamp with time zone,
    "resets_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_circuit_states_state_check" CHECK (("state" = ANY (ARRAY['closed'::"text", 'open'::"text", 'half_open'::"text"])))
);


ALTER TABLE "public"."bud_circuit_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_convention_learnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "rule" "text" NOT NULL,
    "category" "text" DEFAULT 'pattern'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "severity" "text" DEFAULT 'error'::"text" NOT NULL,
    "example_wrong" "text",
    "example_correct" "text",
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_convention_learnings_category_check" CHECK (("category" = ANY (ARRAY['design'::"text", 'import'::"text", 'pattern'::"text", 'agent'::"text", 'other'::"text"]))),
    CONSTRAINT "bud_convention_learnings_severity_check" CHECK (("severity" = ANY (ARRAY['warning'::"text", 'error'::"text"]))),
    CONSTRAINT "bud_convention_learnings_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'pipeline'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."bud_convention_learnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_deployment_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid",
    "deployment_url" "text",
    "environment" "text" DEFAULT 'preview'::"text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "checks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "route_results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "api_results" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "console_errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "performance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "bud_deployment_verifications_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'passed'::"text", 'failed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."bud_deployment_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" DEFAULT 'recorded'::"text" NOT NULL,
    "task_id" "uuid",
    "command" "text",
    "file_path" "text",
    "deployment_id" "text",
    "summary" "text",
    "raw_output" "text",
    "stderr" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_evidence_source_check" CHECK (("source" = ANY (ARRAY['bud_terminal'::"text", 'github_webhook'::"text", 'cron'::"text", 'manual'::"text", 'session_hook'::"text"]))),
    CONSTRAINT "bud_evidence_status_check" CHECK (("status" = ANY (ARRAY['recorded'::"text", 'passed'::"text", 'failed'::"text", 'blocked'::"text"]))),
    CONSTRAINT "bud_evidence_type_check" CHECK (("type" = ANY (ARRAY['terminal_command'::"text", 'build_output'::"text", 'lint_output'::"text", 'test_output'::"text", 'git_diff'::"text", 'deployment'::"text", 'graphify'::"text", 'approval'::"text", 'learning'::"text"])))
);


ALTER TABLE "public"."bud_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_improvement_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signal_id" "uuid",
    "status" "text" DEFAULT 'detected'::"text" NOT NULL,
    "trigger" "text" DEFAULT 'manual'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "approach" "text",
    "diff_summary" "text",
    "branch_name" "text",
    "pr_url" "text",
    "issue_url" "text",
    "confidence" double precision,
    "risk_score" integer,
    "ci_conclusion" "text",
    "ci_run_url" "text",
    "ci_workflow_run_id" "text",
    "verification_status" "text",
    "taste_score" double precision,
    "taste_pass" boolean,
    "taste_violations" "jsonb",
    "taste_suggestions" "jsonb",
    "taste_checked_files" "jsonb",
    "taste_checked_at" timestamp with time zone,
    "browser_tests_passed" integer,
    "browser_tests_failed" integer,
    "browser_tests_total" integer,
    "browser_test_status" "text",
    "auto_merged" boolean DEFAULT false,
    "auto_merged_at" timestamp with time zone,
    "auto_merge_blocked_reason" "text",
    "rollback_reason" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone,
    "root_cause_id" "text",
    "root_cause_key" "text",
    "initiative_id" "uuid"
);


ALTER TABLE "public"."bud_improvement_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_improvement_learnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid",
    "signal_id" "uuid",
    "memory_doc_id" "uuid",
    "signal_type" "text",
    "improvement_pattern" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "affected_area" "text",
    "notes" "text",
    "embedding" "public"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bud_improvement_learnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_improvement_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bud_improvement_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_improvement_signals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "signal_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "affected_area" "text",
    "proposed_approach" "text",
    "reference_files" "text"[],
    "metadata" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "fingerprint" "text",
    "root_cause_id" "text",
    "root_cause_key" "text",
    "initiative_id" "uuid",
    "duplicate_of" "uuid",
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "bud_improvement_signals_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"])))
);


ALTER TABLE "public"."bud_improvement_signals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_improvement_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "state" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "summary" "text",
    "evidence" "jsonb",
    "confidence" double precision,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "finished_at" timestamp with time zone
);


ALTER TABLE "public"."bud_improvement_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_improvements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "issue" "text" NOT NULL,
    "root_cause" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "evidence_type" "text",
    "evidence_ref" "text",
    "affected_files" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "risk_level" "text" DEFAULT 'low'::"text" NOT NULL,
    "rollback_plan" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "bud_improvements_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "bud_improvements_source_check" CHECK (("source" = ANY (ARRAY['vault'::"text", 'graphify'::"text", 'manual'::"text", 'agent'::"text"]))),
    CONSTRAINT "bud_improvements_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'completed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."bud_improvements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text",
    "workflow_id" "text",
    "category" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_insights_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."bud_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_lobby_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "operational_status" "text" DEFAULT 'nominal'::"text" NOT NULL,
    "bud_state" "text" DEFAULT 'idle'::"text" NOT NULL,
    "summary" "text",
    "sections" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "workflows" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "kpis" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "agent_states" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_current" boolean DEFAULT false NOT NULL,
    CONSTRAINT "bud_lobby_states_bud_state_check" CHECK (("bud_state" = ANY (ARRAY['thinking'::"text", 'investigating'::"text", 'repairing'::"text", 'testing'::"text", 'reviewing'::"text", 'deploying'::"text", 'learning'::"text", 'idle'::"text"]))),
    CONSTRAINT "bud_lobby_states_operational_status_check" CHECK (("operational_status" = ANY (ARRAY['nominal'::"text", 'elevated'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."bud_lobby_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_repair_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "source_agent" "text",
    "trigger" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'detected'::"text" NOT NULL,
    "root_cause_type" "text",
    "root_cause_summary" "text",
    "repair_strategy" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "risk_score" numeric(5,2) DEFAULT 50 NOT NULL,
    "confidence" numeric(4,3),
    "branch_name" "text",
    "commit_sha" "text",
    "diff_summary" "text",
    "pr_url" "text",
    "deployment_url" "text",
    "verification_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "rollback_trace" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ci_workflow_run_id" "text",
    "ci_conclusion" "text",
    "ci_run_url" "text",
    "rollback_reason" "text",
    "taste_score" numeric(4,3),
    "taste_pass" boolean,
    "taste_violations" "jsonb",
    "taste_suggestions" "jsonb",
    "taste_checked_files" "jsonb",
    "taste_checked_at" timestamp with time zone,
    "browser_tests_passed" integer,
    "browser_tests_failed" integer,
    "browser_tests_total" integer,
    "browser_test_status" "text",
    "browser_test_run_id" "uuid",
    "issue_url" "text",
    "intelligence_summary" "text",
    CONSTRAINT "bud_repair_executions_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "bud_repair_executions_risk_score_check" CHECK ((("risk_score" >= (0)::numeric) AND ("risk_score" <= (100)::numeric))),
    CONSTRAINT "bud_repair_executions_status_check" CHECK (("status" = ANY (ARRAY['detected'::"text", 'reproducing'::"text", 'analyzing'::"text", 'planning'::"text", 'awaiting_approval'::"text", 'patching'::"text", 'validating'::"text", 'deploying'::"text", 'verifying'::"text", 'monitoring'::"text", 'recovered'::"text", 'rolled_back'::"text", 'blocked'::"text", 'failed'::"text"]))),
    CONSTRAINT "bud_repair_executions_trigger_check" CHECK (("trigger" = ANY (ARRAY['manual'::"text", 'detected'::"text", 'cron'::"text", 'approval'::"text", 'terminal'::"text"]))),
    CONSTRAINT "bud_repair_executions_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['not_started'::"text", 'running'::"text", 'passed'::"text", 'failed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."bud_repair_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_repair_learnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid",
    "task_id" "uuid",
    "memory_doc_id" "uuid",
    "root_cause_type" "text",
    "fix_pattern" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "confidence_delta" numeric(5,2),
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "summary_embedding" "public"."vector"(1536),
    CONSTRAINT "bud_repair_learnings_outcome_check" CHECK (("outcome" = ANY (ARRAY['recovered'::"text", 'blocked'::"text", 'failed'::"text", 'rolled_back'::"text"])))
);


ALTER TABLE "public"."bud_repair_learnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_repair_logs" (
    "id" bigint NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "level" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_repair_logs_level_check" CHECK (("level" = ANY (ARRAY['debug'::"text", 'info'::"text", 'warn'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."bud_repair_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bud_repair_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bud_repair_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bud_repair_logs_id_seq" OWNED BY "public"."bud_repair_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."bud_repair_quarantine" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch" "text" NOT NULL,
    "commit_sha" "text",
    "deployment_id" "text",
    "error_text" "text",
    "failing_file" "text",
    "failing_line" integer,
    "source_agent" "text",
    "rejection_reason" "text",
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'blocked_for_repair'::"text" NOT NULL,
    "blocked_until" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_repair_quarantine_status_check" CHECK (("status" = ANY (ARRAY['blocked_for_repair'::"text", 'abandoned'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."bud_repair_quarantine" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_repair_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "state" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "summary" "text" NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence" numeric(4,3),
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "bud_repair_steps_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "bud_repair_steps_state_check" CHECK (("state" = ANY (ARRAY['detected'::"text", 'reproducing'::"text", 'analyzing'::"text", 'planning'::"text", 'awaiting_approval'::"text", 'patching'::"text", 'validating'::"text", 'deploying'::"text", 'verifying'::"text", 'monitoring'::"text", 'recovered'::"text", 'rolled_back'::"text", 'blocked'::"text", 'failed'::"text"]))),
    CONSTRAINT "bud_repair_steps_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'passed'::"text", 'failed'::"text", 'blocked'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."bud_repair_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_rollback_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid",
    "agent_id" "text",
    "trigger" "text" NOT NULL,
    "branch_name" "text",
    "ci_conclusion" "text",
    "ci_run_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bud_rollback_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_root_cause_initiatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "root_cause_id" "text" NOT NULL,
    "root_cause_key" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "signal_count" integer DEFAULT 0 NOT NULL,
    "duplicate_count" integer DEFAULT 0 NOT NULL,
    "approval_count" integer DEFAULT 0 NOT NULL,
    "latest_signal_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "bud_root_cause_initiatives_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "bud_root_cause_initiatives_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'patching'::"text", 'validating'::"text", 'merged'::"text", 'resolved'::"text", 'blocked'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."bud_root_cause_initiatives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_agent" "text",
    "target_agent" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confidence" numeric(4,3),
    "risk_level" "text",
    "description" "text" NOT NULL,
    "autonomy_level" integer DEFAULT 2 NOT NULL,
    "linked_issue" "text",
    "linked_pr" "text",
    "linked_deployment" "text",
    "linked_memory_note" "text",
    "raw_input" "jsonb",
    "raw_output" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bud_tasks_autonomy_level_check" CHECK ((("autonomy_level" >= 0) AND ("autonomy_level" <= 5))),
    CONSTRAINT "bud_tasks_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "bud_tasks_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "bud_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'detected'::"text", 'reproducing'::"text", 'analyzing'::"text", 'planning'::"text", 'awaiting_approval'::"text", 'patching'::"text", 'validating'::"text", 'deploying'::"text", 'verifying'::"text", 'monitoring'::"text", 'recovered'::"text", 'rolled_back'::"text", 'blocked'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."bud_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_telemetry_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "improvement_id" "uuid",
    "repair_id" "uuid",
    "event_type" "text" NOT NULL,
    "branch_name" "text",
    "pr_number" integer,
    "deployment_url" "text",
    "metric_name" "text",
    "metric_value" double precision,
    "threshold" double precision,
    "baseline" double precision,
    "rollback_triggered" boolean DEFAULT false,
    "rollback_notes" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bud_telemetry_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bud_terminal_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "command" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "output" "text",
    "exit_code" integer,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "bud_terminal_sessions_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'passed'::"text", 'failed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."bud_terminal_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_factory_run_artifacts" (
    "run_id" "uuid" NOT NULL,
    "artifact_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'primary'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaign_factory_run_artifacts_role_check" CHECK (("role" = ANY (ARRAY['primary'::"text", 'supporting'::"text", 'approved_output'::"text"])))
);


ALTER TABLE "public"."campaign_factory_run_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_factory_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "current_step" "text" DEFAULT 'goal'::"text" NOT NULL,
    "selected_story_opportunity_id" "uuid",
    "campaign_id" "uuid",
    "signals" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "research_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "strategy" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "approval_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaign_factory_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'collecting_signals'::"text", 'researching'::"text", 'strategizing'::"text", 'artifact_review'::"text", 'approved'::"text", 'rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."campaign_factory_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capture_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brief_date" "date" NOT NULL,
    "job_context" "text",
    "shot_list" "text"[] DEFAULT '{}'::"text"[],
    "say_to_camera" "text",
    "run_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."capture_briefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_flow_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "weeks" "jsonb" NOT NULL,
    "warnings" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."cash_flow_forecasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_default" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."checklist_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classification_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "make" "text" NOT NULL,
    "model" "text" NOT NULL,
    "detected_category" "text" NOT NULL,
    "user_selected_category" "text" NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "classification_feedback_detected_category_check" CHECK (("detected_category" = ANY (ARRAY['hatch'::"text", 'sedan'::"text", 'suv'::"text", 'ute'::"text", 'van'::"text", '4wd'::"text", 'luxury'::"text", 'muscle'::"text"]))),
    CONSTRAINT "classification_feedback_user_selected_category_check" CHECK (("user_selected_category" = ANY (ARRAY['hatch'::"text", 'sedan'::"text", 'suv'::"text", 'ute'::"text", 'van'::"text", '4wd'::"text", 'luxury'::"text", 'muscle'::"text"])))
);


ALTER TABLE "public"."classification_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "quote_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_phone" "text",
    "service_type" "text" NOT NULL,
    "service_context" "text" NOT NULL,
    "service_address" "text",
    "scheduled_date" "date",
    "agreed_price" numeric(10,2),
    "filming_consent_ops" boolean DEFAULT false NOT NULL,
    "filming_consent_marketing" boolean DEFAULT false NOT NULL,
    "is_ndis" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "docusign_envelope_id" "text",
    "created_by" "text",
    "sent_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_agreements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'signed'::"text", 'declined'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."client_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_intel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitor_name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "suburb" "text",
    "service" "text",
    "price_aud" numeric,
    "price_unit" "text",
    "promo" "text",
    "raw_snippet" "text",
    "confidence" real DEFAULT 0.5,
    "source_query" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."competitor_intel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competitor" "text" NOT NULL,
    "url" "text" NOT NULL,
    "last_snapshot" "text",
    "last_checked" timestamp with time zone,
    "change_notes" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."competitor_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "asset_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "source_url" "text" DEFAULT ''::"text" NOT NULL,
    "production_card_id" "uuid",
    "idea_id" "uuid",
    "script_id" "uuid",
    "consent_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "related_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "related_customer" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_assets_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['footage'::"text", 'photo'::"text", 'graphic'::"text", 'testimonial'::"text", 'other'::"text"]))),
    CONSTRAINT "content_assets_consent_status_check" CHECK (("consent_status" = ANY (ARRAY['unknown'::"text", 'not_required'::"text", 'pending'::"text", 'confirmed'::"text", 'denied'::"text"]))),
    CONSTRAINT "content_assets_denied_not_in_production" CHECK ((("consent_status" <> 'denied'::"text") OR ("production_card_id" IS NULL)))
);


ALTER TABLE "public"."content_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "run_id" "uuid",
    "channel" "text" NOT NULL,
    "title" "text",
    "body" "text" NOT NULL,
    "photo_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "hashtags" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scheduled_for" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_id" "uuid",
    CONSTRAINT "content_drafts_channel_check" CHECK (("channel" = ANY (ARRAY['instagram'::"text", 'tiktok'::"text", 'facebook'::"text", 'gbp'::"text", 'blog'::"text", 'email'::"text"]))),
    CONSTRAINT "content_drafts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'scheduled'::"text", 'published'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."content_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_ideas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "opportunity_id" "uuid",
    "related_arc_id" "uuid",
    "related_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "platform_fit" "text" DEFAULT ''::"text" NOT NULL,
    "format" "text" DEFAULT ''::"text" NOT NULL,
    "hook" "text" DEFAULT ''::"text" NOT NULL,
    "content_angle" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'captured'::"text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idea_score" integer,
    "score_breakdown" "jsonb",
    "score_reason" "text",
    "scored_at" timestamp with time zone,
    CONSTRAINT "content_ideas_idea_score_check" CHECK ((("idea_score" >= 0) AND ("idea_score" <= 100))),
    CONSTRAINT "content_ideas_status_check" CHECK (("status" = ANY (ARRAY['captured'::"text", 'developed'::"text", 'approved'::"text", 'scripted'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_ideas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_learning_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_factory_run_id" "uuid",
    "campaign_id" "uuid",
    "learning_artifact_id" "uuid",
    "goal" "text" NOT NULL,
    "campaign_title" "text" NOT NULL,
    "source_artifact_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "source_library_item_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "outcome_score" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "results" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "what_worked" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "what_failed" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "supporting_evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "recommended_future_actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confidence" numeric DEFAULT 0 NOT NULL,
    "confidence_reason" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_learning_records_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (100)::numeric))),
    CONSTRAINT "content_learning_records_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_review'::"text", 'approved'::"text", 'rejected'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_learning_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_library_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_type" "text" NOT NULL,
    "source_table" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "campaign_id" "uuid",
    "artifact_id" "uuid",
    "platform" "text",
    "status" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "performance" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "searchable_text" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_library_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_production_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "script_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text" DEFAULT ''::"text" NOT NULL,
    "format" "text" DEFAULT ''::"text" NOT NULL,
    "related_arc_id" "uuid",
    "related_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "deadline" "date",
    "status" "text" DEFAULT 'to_film'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_production_cards_status_check" CHECK (("status" = ANY (ARRAY['to_film'::"text", 'in_edit'::"text", 'ready_to_publish'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."content_production_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_scripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "idea_id" "uuid" NOT NULL,
    "hook" "text" DEFAULT ''::"text" NOT NULL,
    "setup" "text" DEFAULT ''::"text" NOT NULL,
    "core_moment" "text" DEFAULT ''::"text" NOT NULL,
    "close_cta" "text" DEFAULT ''::"text" NOT NULL,
    "platform" "text" DEFAULT ''::"text" NOT NULL,
    "format" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_ai_generated" boolean DEFAULT false NOT NULL,
    "generation_model" "text",
    CONSTRAINT "content_scripts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_scripts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "subject" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "conversations_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['customer'::"text", 'crew'::"text", 'lead'::"text", 'applicant'::"text"]))),
    CONSTRAINT "conversations_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'One conversation thread per entity (customer/crew/lead/applicant). Admin-only.';



CREATE TABLE IF NOT EXISTS "public"."crew_coach_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crew_member_id" "uuid" NOT NULL,
    "run_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "strengths" "text"[] DEFAULT '{}'::"text"[],
    "growth_areas" "text"[] DEFAULT '{}'::"text"[],
    "notable_jobs" "jsonb" DEFAULT '[]'::"jsonb",
    "summary" "text",
    "shared_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crew_coach_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "address" "text",
    "gate_code" "text",
    "pet_warnings" "text",
    "parking" "text",
    "special_instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "region" "text",
    "company_name" "text",
    "abn" "text",
    "default_address" "text",
    "latitude" numeric,
    "longitude" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "customers_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"])))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_audits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "text" NOT NULL,
    "audit_date" "date" NOT NULL,
    "overall_score" integer NOT NULL,
    "score_label" "text" NOT NULL,
    "area_scores" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "executive_summary" "text",
    "quick_wins" "text"[],
    "violation_count" integer DEFAULT 0 NOT NULL,
    "p0_count" integer DEFAULT 0 NOT NULL,
    "p1_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "design_audits_overall_score_check" CHECK ((("overall_score" >= 0) AND ("overall_score" <= 100))),
    CONSTRAINT "design_audits_score_label_check" CHECK (("score_label" = ANY (ARRAY['critical'::"text", 'poor'::"text", 'fair'::"text", 'good'::"text", 'excellent'::"text"])))
);


ALTER TABLE "public"."design_audits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_violations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "audit_id" "uuid",
    "run_id" "text" NOT NULL,
    "violation_id" "text" NOT NULL,
    "area" "text" NOT NULL,
    "title" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "priority" "text" NOT NULL,
    "component" "text",
    "violation_type" "text" NOT NULL,
    "description" "text",
    "proposed_fix" "text",
    "affected_files" "text"[],
    "effort" "text",
    "backlinks" "text"[],
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "design_violations_priority_check" CHECK (("priority" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text"]))),
    CONSTRAINT "design_violations_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "design_violations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'wont_fix'::"text", 'accepted'::"text"]))),
    CONSTRAINT "design_violations_violation_type_check" CHECK (("violation_type" = ANY (ARRAY['drift'::"text", 'duplication'::"text", 'missing-token'::"text", 'accessibility'::"text", 'simplicity'::"text", 'spacing'::"text"])))
);


ALTER TABLE "public"."design_violations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."design_duplication_queue" AS
 SELECT "id",
    "violation_id",
    "title",
    "component",
    "description",
    "proposed_fix",
    "effort",
    "created_at"
   FROM "public"."design_violations" "v"
  WHERE (("violation_type" = 'duplication'::"text") AND ("status" = 'open'::"text"))
  ORDER BY "priority", "created_at" DESC;


ALTER VIEW "public"."design_duplication_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."design_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "run_id" "uuid",
    "page_path" "text",
    "insight_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb",
    "proposed_change" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "design_insights_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "design_insights_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'accepted'::"text", 'rejected'::"text", 'shipped'::"text"])))
);


ALTER TABLE "public"."design_insights" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."design_latest_audit" AS
 SELECT "id",
    "run_id",
    "audit_date",
    "overall_score",
    "score_label",
    "area_scores",
    "executive_summary",
    "violation_count",
    "p0_count",
    "p1_count",
    "created_at"
   FROM "public"."design_audits" "a"
  ORDER BY "audit_date" DESC
 LIMIT 1;


ALTER VIEW "public"."design_latest_audit" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."design_open_critical" AS
 SELECT "v"."id",
    "v"."audit_id",
    "v"."violation_id",
    "v"."area",
    "v"."title",
    "v"."severity",
    "v"."priority",
    "v"."component",
    "v"."violation_type",
    "v"."description",
    "v"."proposed_fix",
    "v"."effort",
    "v"."affected_files",
    "v"."created_at",
    "a"."audit_date"
   FROM ("public"."design_violations" "v"
     JOIN "public"."design_audits" "a" ON (("a"."id" = "v"."audit_id")))
  WHERE (("v"."status" = 'open'::"text") AND ("v"."priority" = ANY (ARRAY['P0'::"text", 'P1'::"text"])))
  ORDER BY
        CASE "v"."priority"
            WHEN 'P0'::"text" THEN 0
            ELSE 1
        END,
        CASE "v"."severity"
            WHEN 'critical'::"text" THEN 0
            WHEN 'high'::"text" THEN 1
            ELSE 2
        END, "v"."created_at" DESC;


ALTER VIEW "public"."design_open_critical" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."design_score_trend" AS
 SELECT "audit_date",
    "overall_score",
    "score_label",
    "violation_count",
    "p0_count",
    "p1_count",
    (("area_scores" ->> 'glass-consistency'::"text"))::integer AS "glass_score",
    (("area_scores" ->> 'typography-hierarchy'::"text"))::integer AS "typography_score",
    (("area_scores" ->> 'component-duplication'::"text"))::integer AS "duplication_score",
    (("area_scores" ->> 'apple-simplicity'::"text"))::integer AS "simplicity_score"
   FROM "public"."design_audits"
  ORDER BY "audit_date" DESC
 LIMIT 8;


ALTER VIEW "public"."design_score_trend" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dev_os_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text",
    "agents_used" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "task" "text",
    "files_changed" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "summary" "text",
    "risk_level" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dev_os_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."efficiency_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" DEFAULT 'efficiency-architect'::"text" NOT NULL,
    "run_id" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "priority" "text" DEFAULT 'P2'::"text" NOT NULL,
    "affected_agents" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "affected_workflows" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "current_cost" "text",
    "proposed_fix" "text",
    "estimated_saving" "text",
    "automation_candidate" boolean DEFAULT false NOT NULL,
    "automation_trigger" "text",
    "automation_action" "text",
    "evidence" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "efficiency_findings_domain_check" CHECK (("domain" = ANY (ARRAY['agent_fleet'::"text", 'workflow_redundancy'::"text", 'automation_gap'::"text", 'operational_throughput'::"text"]))),
    CONSTRAINT "efficiency_findings_priority_check" CHECK (("priority" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text"]))),
    CONSTRAINT "efficiency_findings_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "efficiency_findings_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text", 'resolved'::"text", 'wont_fix'::"text"])))
);


ALTER TABLE "public"."efficiency_findings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "file_url" "text",
    "file_name" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "reviewed_by" "text",
    "reviewed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "storage_path" "text",
    "file_size" integer,
    "mime_type" "text",
    CONSTRAINT "employee_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['wwcc'::"text", 'police_check'::"text", 'first_aid'::"text", 'cpr_certificate'::"text", 'ndis_orientation'::"text", 'ndis_screening'::"text", 'drivers_license'::"text", 'vehicle_registration'::"text", 'vehicle_insurance'::"text", 'abn'::"text", 'insurance'::"text", 'public_liability'::"text", 'resume'::"text", 'references'::"text", 'other'::"text"]))),
    CONSTRAINT "employee_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."employee_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_onboarding" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "section" "text" NOT NULL,
    "responses" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employee_onboarding_section_check" CHECK (("section" = ANY (ARRAY['personal'::"text", 'emergency'::"text", 'availability'::"text", 'services'::"text", 'documents'::"text", 'ndis'::"text"])))
);


ALTER TABLE "public"."employee_onboarding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_payroll_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "tfn_declaration_received" boolean DEFAULT false NOT NULL,
    "bank_details_received" boolean DEFAULT false NOT NULL,
    "super_details_received" boolean DEFAULT false NOT NULL,
    "right_to_work_confirmed" boolean DEFAULT false NOT NULL,
    "employment_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tfn" "text",
    "bank_bsb" "text",
    "bank_account_number" "text",
    "bank_account_name" "text",
    "bank_institution" "text",
    "super_fund_name" "text",
    "super_usi" "text",
    "super_member_number" "text",
    "right_to_work_type" "text",
    "right_to_work_visa_subclass" "text",
    "right_to_work_expiry" "date",
    CONSTRAINT "employee_payroll_details_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['casual'::"text", 'contractor'::"text", 'volunteer'::"text", 'trainee'::"text", 'part_time'::"text", 'full_time'::"text"]))),
    CONSTRAINT "employee_payroll_details_right_to_work_type_check" CHECK (("right_to_work_type" = ANY (ARRAY['citizen'::"text", 'permanent_resident'::"text", 'work_visa'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."employee_payroll_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "suburb" "text",
    "availability" "text"[],
    "services" "text"[],
    "bio" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "onboarding_complete" boolean DEFAULT false NOT NULL,
    "ndis_worker" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photo_url" "text",
    "hourly_rate" numeric(8,2) DEFAULT 25.00 NOT NULL,
    "crew_access_approved" boolean DEFAULT false NOT NULL,
    "default_role" "text",
    "employment_type" "text" DEFAULT 'casual'::"text" NOT NULL,
    "roster_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "employees_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['casual'::"text", 'contractor'::"text", 'part_time'::"text", 'full_time'::"text"]))),
    CONSTRAINT "employees_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


COMMENT ON COLUMN "public"."employees"."crew_access_approved" IS 'Whether an admin has approved this employee for crew portal access. New signups start at false and require approval.';



CREATE TABLE IF NOT EXISTS "public"."employment_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "employee_name" "text" NOT NULL,
    "employee_email" "text" NOT NULL,
    "contract_type" "text" NOT NULL,
    "prev_rate" numeric(8,2),
    "new_rate" numeric(8,2),
    "prev_employment_type" "text",
    "new_employment_type" "text",
    "prev_role" "text",
    "new_role" "text",
    "effective_date" "date",
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "docusign_envelope_id" "text",
    "created_by" "text",
    "sent_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employment_contracts_contract_type_check" CHECK (("contract_type" = ANY (ARRAY['pay_amendment'::"text", 'employment_type_change'::"text", 'role_change'::"text", 'general_amendment'::"text"]))),
    CONSTRAINT "employment_contracts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'signed'::"text", 'declined'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."employment_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_agent_runs_meta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "agent_id" "text" NOT NULL,
    "decisions" integer DEFAULT 0 NOT NULL,
    "tasks" integer DEFAULT 0 NOT NULL,
    "auto_executed" integer DEFAULT 0 NOT NULL,
    "queued_approvals" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."executive_agent_runs_meta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "run_id" "uuid",
    "title" "text" NOT NULL,
    "reasoning" "text" NOT NULL,
    "evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "confidence" numeric(4,3) NOT NULL,
    "risk_level" "text" NOT NULL,
    "expected_impact" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "executed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "executive_decisions_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "executive_decisions_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "executive_decisions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'executed'::"text", 'deferred'::"text"])))
);


ALTER TABLE "public"."executive_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_directives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "issued_by" "text" DEFAULT 'ceo-agent'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "target_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "executive_directives_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."executive_directives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_kpi_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kpi_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "target" numeric(14,4) NOT NULL,
    "unit" "text" DEFAULT 'number'::"text" NOT NULL,
    "owner" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "set_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."executive_kpi_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_metrics_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revenue_7d_aud" numeric(12,2),
    "jobs_7d" integer,
    "leads_7d" integer,
    "conversion_rate" numeric(5,4),
    "avg_job_value" numeric(10,2),
    "cash_position" numeric(12,2),
    "crew_utilisation" numeric(5,4),
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."executive_metrics_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_id" "uuid",
    "source_agent_id" "text" NOT NULL,
    "target_agent_id" "text",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "executive_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'normal'::"text", 'low'::"text"]))),
    CONSTRAINT "executive_tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."executive_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."executive_weekly_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "week_start" "date" NOT NULL,
    "summary" "text" NOT NULL,
    "wins" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "risks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "priorities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "agent_learnings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."executive_weekly_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."foreman_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "agent_id" "text",
    "workflow_id" "text",
    "category" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "text",
    CONSTRAINT "foreman_insights_category_check" CHECK (("category" = ANY (ARRAY['bottleneck'::"text", 'anomaly'::"text", 'pattern'::"text", 'opportunity'::"text", 'risk'::"text"]))),
    CONSTRAINT "foreman_insights_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."foreman_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."foreman_lobby_states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "operational_status" "text" DEFAULT 'nominal'::"text" NOT NULL,
    "summary" "text",
    "sections" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "workflows" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "kpis" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "agent_states" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_current" boolean DEFAULT false NOT NULL,
    CONSTRAINT "foreman_lobby_states_operational_status_check" CHECK (("operational_status" = ANY (ARRAY['nominal'::"text", 'elevated'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."foreman_lobby_states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."founder_journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "wins" "text",
    "challenges" "text",
    "customer_activity" "text",
    "silvan_updates" "text",
    "business_progress" "text",
    "bud_os_progress" "text",
    "memorable_moments" "text",
    "lessons_learned" "text",
    "content_potential_notes" "text",
    "media_references" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "content_potential_rating" "text" DEFAULT 'none'::"text" NOT NULL,
    "arc_connections" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "story_opportunity_created" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_capture" "text",
    "suggested_story_bible_note" "text",
    "suggested_character_timeline_entry" "text",
    "suggested_arc_update" "text",
    "suggested_open_thread_update" "text",
    "suggestion_story_bible_status" "text" DEFAULT 'pending'::"text",
    "suggestion_character_timeline_status" "text" DEFAULT 'pending'::"text",
    "suggestion_arc_status" "text" DEFAULT 'pending'::"text",
    "suggestion_open_thread_status" "text" DEFAULT 'pending'::"text",
    "suggestion_story_bible_target" "text",
    "suggestion_character_timeline_target" "uuid",
    "suggestion_arc_target" "uuid",
    "suggestion_open_thread_target" "uuid",
    CONSTRAINT "founder_journal_entries_content_potential_rating_check" CHECK (("content_potential_rating" = ANY (ARRAY['none'::"text", 'low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."founder_journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fundraising_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fundraising_item_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "currency" "text" DEFAULT 'aud'::"text" NOT NULL,
    "payment_provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "payment_reference" "text",
    "stripe_event_id" "text",
    "payer_name" "text",
    "payer_email" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gross_amount_cents" integer NOT NULL,
    "stripe_fee_cents" integer DEFAULT 0 NOT NULL,
    "net_amount_cents" integer NOT NULL,
    CONSTRAINT "fundraising_contributions_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "fundraising_contributions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."fundraising_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fundraising_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "image_url" "text",
    "goal_amount_cents" integer DEFAULT 0 NOT NULL,
    "raised_amount_cents" integer DEFAULT 0 NOT NULL,
    "short_reason" "text",
    "who_it_helps" "text",
    "employment_impact" "text",
    "cta_label" "text" DEFAULT 'Fund This'::"text" NOT NULL,
    "payment_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "manual_adjustment_cents" integer DEFAULT 0 NOT NULL,
    "supplier_url" "text",
    "stripe_payment_link_id" "text",
    "stripe_price_id" "text",
    CONSTRAINT "fundraising_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'live'::"text", 'funded'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."fundraising_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."github_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "action" "text",
    "repo" "text",
    "metadata" "jsonb",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "github_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processed'::"text", 'error'::"text", 'pending'::"text", 'flagged'::"text"])))
);


ALTER TABLE "public"."github_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."github_adr_queue" AS
 SELECT "id",
    "delivery_id",
    "repo",
    ("metadata" ->> 'pr_number'::"text") AS "pr_number",
    ("metadata" ->> 'pr_title'::"text") AS "pr_title",
    ("metadata" -> 'affected_systems'::"text") AS "affected_systems",
    ("metadata" ->> 'note'::"text") AS "note",
    "created_at"
   FROM "public"."github_events"
  WHERE (("event_type" = 'adr_flag'::"text") AND ("status" = 'pending'::"text"))
  ORDER BY "created_at" DESC;


ALTER VIEW "public"."github_adr_queue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."github_recent_failures" AS
 SELECT "id",
    ("metadata" ->> 'environment'::"text") AS "environment",
    ("metadata" ->> 'sha'::"text") AS "sha",
    ("metadata" ->> 'branch'::"text") AS "branch",
    ("metadata" ->> 'description'::"text") AS "description",
    ("metadata" ->> 'url'::"text") AS "url",
    "created_at"
   FROM "public"."github_events"
  WHERE ("event_type" = 'deployment_failure'::"text")
  ORDER BY "created_at" DESC
 LIMIT 20;


ALTER VIEW "public"."github_recent_failures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."growth_pipeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "source_type" "text",
    "source_id" "uuid",
    "result_type" "text",
    "result_id" "uuid",
    "journal_entry_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."growth_pipeline_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "accepted_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_assignments_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'accepted'::"text", 'declined'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."job_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "checklist_responses" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "photos" "text"[],
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_participant_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "score" integer DEFAULT 0 NOT NULL,
    "max_score" integer DEFAULT 100 NOT NULL,
    "reasons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "flags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_participant_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "qa_score" integer,
    "qa_notes" "text",
    "marketing_ok" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "job_photos_kind_check" CHECK (("kind" = ANY (ARRAY['before'::"text", 'after'::"text", 'damage'::"text", 'note'::"text"])))
);


ALTER TABLE "public"."job_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_publications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "published_by" "uuid",
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "override_reason" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "jp_status_check" CHECK (("status" = ANY (ARRAY['published'::"text", 'accepted'::"text", 'declined'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."job_publications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "estimated_duration_minutes" integer,
    "required_support_mode" "text" DEFAULT 'any'::"text" NOT NULL,
    "physical_intensity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "transport_required" boolean DEFAULT false NOT NULL,
    "customer_facing_required" boolean DEFAULT true NOT NULL,
    "service_type" "text",
    "location_suburb" "text",
    "location_lat" numeric,
    "location_lng" numeric,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "can_split_shift" boolean DEFAULT false NOT NULL,
    "requires_team" boolean DEFAULT false NOT NULL,
    "risk_notes" "text",
    "ndis_matching_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jr_physical_intensity_check" CHECK (("physical_intensity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "jr_support_mode_check" CHECK (("required_support_mode" = ANY (ARRAY['independent'::"text", 'supported'::"text", 'team_based'::"text", 'any'::"text"])))
);


ALTER TABLE "public"."job_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_variations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "original_service" "text" NOT NULL,
    "original_price" numeric(10,2) NOT NULL,
    "variation_description" "text" NOT NULL,
    "additional_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "new_total" numeric(10,2) NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "docusign_envelope_id" "text",
    "created_by" "text",
    "sent_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_variations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'signed'::"text", 'declined'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."job_variations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_path" "text",
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lapsed_outreach" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "last_job_at" timestamp with time zone,
    "days_lapsed" integer,
    "segment" "text",
    "drafted_body" "text",
    "sent_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lapsed_outreach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "body" "text",
    "external_id" "text",
    "author_id" "uuid",
    "author_label" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_sender_id" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "lead_conversations_channel_check" CHECK (("channel" = ANY (ARRAY['website'::"text", 'messenger'::"text", 'sms'::"text", 'instagram'::"text", 'email'::"text", 'phone'::"text", 'referral'::"text", 'internal'::"text", 'unknown'::"text"]))),
    CONSTRAINT "lead_conversations_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "lead_conversations_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"])))
);


ALTER TABLE "public"."lead_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_conversations" IS 'Append-only message log per lead. Source of truth for first-response timing and inbox rendering.';



CREATE TABLE IF NOT EXISTS "public"."lead_follow_ups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "due_at" timestamp with time zone NOT NULL,
    "reason" "text" NOT NULL,
    "channel" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "done_at" timestamp with time zone,
    "assignee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_follow_ups_channel_check" CHECK (("channel" = ANY (ARRAY['messenger'::"text", 'sms'::"text", 'email'::"text", 'phone'::"text", 'website'::"text", 'internal'::"text"]))),
    CONSTRAINT "lead_follow_ups_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'done'::"text", 'cancelled'::"text", 'snoozed'::"text"])))
);


ALTER TABLE "public"."lead_follow_ups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_response_metrics" (
    "metric_day" "date" NOT NULL,
    "source" "text" NOT NULL,
    "leads_total" integer DEFAULT 0 NOT NULL,
    "leads_responded" integer DEFAULT 0 NOT NULL,
    "leads_booked" integer DEFAULT 0 NOT NULL,
    "avg_first_response_minutes" numeric(10,2),
    "median_first_response_minutes" numeric(10,2),
    "missed_leads" integer DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_response_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_response_metrics" IS 'Daily roll-up of response performance per source. Refreshed by a scheduled job; never edited by hand.';



CREATE TABLE IF NOT EXISTS "public"."lead_suburb_analytics" (
    "metric_day" "date" NOT NULL,
    "suburb" "text" NOT NULL,
    "active_leads" integer DEFAULT 0 NOT NULL,
    "hot_leads" integer DEFAULT 0 NOT NULL,
    "booked_jobs" integer DEFAULT 0 NOT NULL,
    "revenue_cents" bigint DEFAULT 0 NOT NULL,
    "momentum" numeric(6,3),
    "lat" double precision,
    "lng" double precision,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_suburb_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "service_type" "text",
    "suburb" "text",
    "service_address" "text",
    "source" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "response_status" "text" DEFAULT 'awaiting_response'::"text" NOT NULL,
    "temperature" "text",
    "quote_id" "uuid",
    "first_response_at" timestamp with time zone,
    "booked_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "lost_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_ref" "text",
    "reply_channel" "text",
    "messenger_psid" "text",
    "instagram_user_id" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "leads_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "leads_reply_channel_check" CHECK (("reply_channel" = ANY (ARRAY['email'::"text", 'messenger'::"text", 'instagram'::"text", 'sms'::"text", 'phone'::"text"]))),
    CONSTRAINT "leads_response_status_check" CHECK (("response_status" = ANY (ARRAY['awaiting_response'::"text", 'in_conversation'::"text", 'quoted'::"text", 'booked'::"text", 'completed'::"text", 'no_response'::"text", 'lost'::"text"]))),
    CONSTRAINT "leads_source_check" CHECK (("source" = ANY (ARRAY['website'::"text", 'messenger'::"text", 'sms'::"text", 'instagram'::"text", 'email'::"text", 'phone'::"text", 'referral'::"text", 'unknown'::"text"]))),
    CONSTRAINT "leads_temperature_check" CHECK (("temperature" = ANY (ARRAY['HOT'::"text", 'WARM'::"text", 'COLD'::"text", 'LOST'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."leads" IS 'Universal lead record. Wired in once channels other than the website (Messenger, SMS, Instagram, etc.) start producing leads. Until then, Bud Leads derives Lead[] from quotes.';



COMMENT ON COLUMN "public"."leads"."external_ref" IS 'Channel-native unique identifier (Messenger PSID, IG thread id, Twilio MessageSid, etc.). Paired with source to deduplicate webhook re-deliveries. NULL for leads created without an external system (manual entry, form fills).';



CREATE TABLE IF NOT EXISTS "public"."lobby_themes" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "preview_image" "text",
    "tokens" "jsonb" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lobby_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_campaign_queue_items" (
    "campaign_id" "uuid" NOT NULL,
    "queue_item_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_campaign_queue_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "service_type" "text",
    "hook" "text",
    "starts_on" "date",
    "ends_on" "date",
    "status" "text" DEFAULT 'planning'::"text" NOT NULL,
    "goal_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "goal" "text" DEFAULT ''::"text" NOT NULL,
    "related_arc_id" "uuid",
    "target_audience" "text" DEFAULT ''::"text" NOT NULL,
    "channels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "kpis" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result_summary" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_campaigns_status_check" CHECK (("status" = ANY (ARRAY['planning'::"text", 'active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."marketing_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_distribution_playbooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "content_type" "text" DEFAULT ''::"text" NOT NULL,
    "primary_platform" "text" DEFAULT ''::"text" NOT NULL,
    "secondary_platforms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "steps" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "checklist" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "linked_campaign_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_distribution_playbooks_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'draft'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."marketing_distribution_playbooks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "channel" "text" NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "engagements" integer DEFAULT 0 NOT NULL,
    "content_published" integer DEFAULT 0 NOT NULL,
    "followers" integer DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_metrics_channel_check" CHECK (("channel" = ANY (ARRAY['instagram'::"text", 'tiktok'::"text", 'facebook'::"text", 'gbp'::"text", 'combined'::"text"]))),
    CONSTRAINT "marketing_metrics_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'api'::"text"])))
);


ALTER TABLE "public"."marketing_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_publishing_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "production_card_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "format" "text" DEFAULT ''::"text" NOT NULL,
    "related_arc_id" "uuid",
    "related_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "target_publish_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "caption_placeholder" "text" DEFAULT ''::"text" NOT NULL,
    "consent_verified" boolean DEFAULT false NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_created" boolean DEFAULT false NOT NULL,
    "performance_data" "jsonb",
    CONSTRAINT "marketing_publishing_queue_consent_before_ready" CHECK ((("status" <> ALL (ARRAY['ready'::"text", 'published'::"text"])) OR ("consent_verified" = true))),
    CONSTRAINT "marketing_publishing_queue_platform_check" CHECK (("platform" = ANY (ARRAY['tiktok'::"text", 'instagram'::"text", 'facebook'::"text", 'youtube'::"text", 'linkedin'::"text", 'website'::"text"]))),
    CONSTRAINT "marketing_publishing_queue_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'ready'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."marketing_publishing_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_social_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "handle" "text" DEFAULT ''::"text" NOT NULL,
    "profile_url" "text" DEFAULT ''::"text" NOT NULL,
    "primary_format" "text" DEFAULT ''::"text" NOT NULL,
    "posting_target_per_week" integer DEFAULT 0 NOT NULL,
    "primary_audience" "text" DEFAULT ''::"text" NOT NULL,
    "content_notes" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "connected" boolean DEFAULT false NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_social_channels_platform_check" CHECK (("platform" = ANY (ARRAY['tiktok'::"text", 'instagram'::"text", 'facebook'::"text", 'youtube'::"text", 'linkedin'::"text", 'website'::"text"]))),
    CONSTRAINT "marketing_social_channels_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'planned'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."marketing_social_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_contradiction_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doc_a_id" "uuid" NOT NULL,
    "doc_b_id" "uuid" NOT NULL,
    "contradicts" boolean NOT NULL,
    "severity" "text",
    "explanation" "text",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "memory_contradiction_log_severity_check" CHECK (("severity" = ANY (ARRAY['minor'::"text", 'major'::"text"])))
);


ALTER TABLE "public"."memory_contradiction_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vault_path" "text",
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "frontmatter" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "embedding" "public"."vector"(1536),
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "agent_scope" "text",
    "source" "text" DEFAULT 'human'::"text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "freshness_score" double precision DEFAULT 1.0 NOT NULL,
    "vault_synced_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "superseded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "memory_documents_category_check" CHECK (("category" = ANY (ARRAY['ux'::"text", 'admin'::"text", 'deployments'::"text", 'bugs'::"text", 'architecture'::"text", 'design'::"text", 'sops'::"text", 'analytics'::"text", 'pricing'::"text", 'customers'::"text"]))),
    CONSTRAINT "memory_documents_freshness_score_check" CHECK ((("freshness_score" >= (0.0)::double precision) AND ("freshness_score" <= (1.0)::double precision))),
    CONSTRAINT "memory_documents_source_check" CHECK (("source" = ANY (ARRAY['human'::"text", 'agent'::"text", 'deployment'::"text", 'analytics'::"text", 'import'::"text"]))),
    CONSTRAINT "memory_documents_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."memory_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_edges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "relationship" "text" NOT NULL,
    "strength" double precision DEFAULT 1.0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "extracted_by" "text" DEFAULT 'system'::"text" NOT NULL,
    "extracted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "memory_edges_relationship_check" CHECK (("relationship" = ANY (ARRAY['backlink'::"text", 'tag_shared'::"text", 'semantic'::"text", 'depends_on'::"text", 'implements'::"text", 'contradicts'::"text", 'supersedes'::"text", 'caused_by'::"text", 'informs'::"text"]))),
    CONSTRAINT "memory_edges_strength_check" CHECK ((("strength" >= (0.0)::double precision) AND ("strength" <= (1.0)::double precision)))
);


ALTER TABLE "public"."memory_edges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_graph_extractions" (
    "document_id" "uuid" NOT NULL,
    "systems_mentioned" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "decision_rationale" "text",
    "problems_solved" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "depends_on_raw" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "implements_raw" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "importance_score" double precision DEFAULT 0.5 NOT NULL,
    "extracted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "model" "text",
    CONSTRAINT "memory_graph_extractions_importance_score_check" CHECK ((("importance_score" >= (0.0)::double precision) AND ("importance_score" <= (1.0)::double precision)))
);


ALTER TABLE "public"."memory_graph_extractions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memory_read_log" (
    "id" bigint NOT NULL,
    "document_id" "uuid" NOT NULL,
    "agent_id" "text",
    "run_id" "uuid",
    "query" "text",
    "similarity" double precision,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."memory_read_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."memory_read_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."memory_read_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."memory_read_log_id_seq" OWNED BY "public"."memory_read_log"."id";



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_type" "text" DEFAULT 'admin'::"text" NOT NULL,
    "sender_id" "uuid",
    "body" "text" NOT NULL,
    "channel" "text" DEFAULT 'internal'::"text" NOT NULL,
    "delivery_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "messages_channel_check" CHECK (("channel" = ANY (ARRAY['internal'::"text", 'sms'::"text", 'email'::"text"]))),
    CONSTRAINT "messages_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['draft'::"text", 'queued'::"text", 'sent'::"text", 'delivered'::"text", 'failed'::"text"]))),
    CONSTRAINT "messages_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['admin'::"text", 'entity'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Individual messages in a conversation. delivery_status=draft until explicitly sent.';



CREATE OR REPLACE VIEW "public"."mission_control_latest_evidence" AS
 SELECT "source_type",
    "source_id",
    "label",
    "body",
    "stderr",
    "status",
    "recorded_at"
   FROM ( SELECT 'terminal'::"text" AS "source_type",
            ("bud_terminal_sessions"."id")::"text" AS "source_id",
            COALESCE("bud_terminal_sessions"."command", '(unknown command)'::"text") AS "label",
            "bud_terminal_sessions"."output" AS "body",
            NULL::"text" AS "stderr",
                CASE "bud_terminal_sessions"."status"
                    WHEN 'passed'::"text" THEN 'passed'::"text"
                    WHEN 'failed'::"text" THEN 'failed'::"text"
                    ELSE 'recorded'::"text"
                END AS "status",
            "bud_terminal_sessions"."started_at" AS "recorded_at"
           FROM "public"."bud_terminal_sessions"
        UNION ALL
         SELECT 'deployment'::"text" AS "source_type",
            ("github_events"."id")::"text" AS "source_id",
            (("github_events"."event_type" || '/'::"text") || COALESCE("github_events"."action", 'unknown'::"text")) AS "label",
            COALESCE(("github_events"."metadata")::"text", ''::"text") AS "body",
            NULL::"text" AS "stderr",
                CASE
                    WHEN ("github_events"."action" = 'success'::"text") THEN 'passed'::"text"
                    WHEN ("github_events"."action" = ANY (ARRAY['failure'::"text", 'error'::"text"])) THEN 'failed'::"text"
                    ELSE 'recorded'::"text"
                END AS "status",
            "github_events"."created_at" AS "recorded_at"
           FROM "public"."github_events"
          WHERE ("github_events"."event_type" = ANY (ARRAY['deployment_status'::"text", 'deployment_failure'::"text"]))
        UNION ALL
         SELECT 'evidence'::"text" AS "source_type",
            ("bud_evidence"."id")::"text" AS "source_id",
            COALESCE("bud_evidence"."command", "bud_evidence"."summary", "bud_evidence"."type") AS "label",
            COALESCE("bud_evidence"."raw_output", "bud_evidence"."summary") AS "body",
            "bud_evidence"."stderr",
            "bud_evidence"."status",
            "bud_evidence"."created_at" AS "recorded_at"
           FROM "public"."bud_evidence") "combined"
  ORDER BY "recorded_at" DESC
 LIMIT 100;


ALTER VIEW "public"."mission_control_latest_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ndis_organisations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "abn" "text",
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_phone" "text",
    "website" "text",
    "notes" "text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "subscription_plan" "text" DEFAULT 'standard'::"text",
    "current_period_end" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform_fee_bps" integer DEFAULT 600 NOT NULL,
    "stripe_connect_account_id" "text",
    CONSTRAINT "ndis_organisations_sub_status_check" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'trialing'::"text", 'past_due'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ndis_organisations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ndis_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organisation_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "ndis_number" "text",
    "date_of_birth" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "invite_token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "invite_sent_at" timestamp with time zone,
    "joined_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ndis_participants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."ndis_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ndis_plan_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "uuid",
    "plan_goals" "text"[],
    "matched_services" "jsonb",
    "estimated_total_aud" numeric,
    "run_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ndis_plan_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_fees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "segment" "text" NOT NULL,
    "service_subtotal_cents" integer DEFAULT 0 NOT NULL,
    "retained_subtotal_cents" integer DEFAULT 0 NOT NULL,
    "client_fee_cents" integer DEFAULT 0 NOT NULL,
    "provider_fee_cents" integer DEFAULT 0 NOT NULL,
    "platform_total_cents" integer DEFAULT 0 NOT NULL,
    "gst_cents" integer DEFAULT 0 NOT NULL,
    "client_total_cents" integer DEFAULT 0 NOT NULL,
    "worker_payout_cents" integer DEFAULT 0 NOT NULL,
    "instant_payout_fee_cents" integer DEFAULT 0 NOT NULL,
    "buds_revenue_cents" integer DEFAULT 0 NOT NULL,
    "client_fee_bps" integer DEFAULT 0 NOT NULL,
    "provider_fee_bps" integer DEFAULT 0 NOT NULL,
    "instant_payout_bps" integer DEFAULT 0 NOT NULL,
    "is_gst_free" boolean DEFAULT false NOT NULL,
    "gst_registered" boolean DEFAULT false NOT NULL,
    "finalized" boolean DEFAULT false NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_fees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid",
    "customer_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_email" "text",
    "customer_phone" "text",
    "service_type" "text" NOT NULL,
    "context" "text" NOT NULL,
    "scope" "text",
    "frequency" "text" DEFAULT 'none'::"text",
    "base_price" numeric NOT NULL,
    "discount_percent" numeric DEFAULT 0,
    "final_price" numeric NOT NULL,
    "scheduled_date" "date",
    "scheduled_time" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "assigned_employee_id" "uuid",
    "assigned_crew_id" "uuid",
    "estimated_duration_minutes" integer DEFAULT 120 NOT NULL,
    "analytics_session_id" "text",
    "segment" "text" DEFAULT 'home'::"text" NOT NULL,
    "cancellation_window" "text",
    "cancellation_fault" "text",
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    "status_updated_at" timestamp with time zone,
    CONSTRAINT "orders_cancellation_fault_check" CHECK (("cancellation_fault" = ANY (ARRAY['client'::"text", 'worker'::"text"]))),
    CONSTRAINT "orders_cancellation_window_check" CHECK (("cancellation_window" = ANY (ARRAY['none'::"text", 'late'::"text", 'no_show'::"text"]))),
    CONSTRAINT "orders_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "orders_segment_check" CHECK (("segment" = ANY (ARRAY['home'::"text", 'small'::"text", 'commercial'::"text", 'ndis'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "page" "text" NOT NULL,
    "page_title" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scroll_depth" integer,
    "time_on_page" integer,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text"
);


ALTER TABLE "public"."page_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participant_support_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "support_window_start" time without time zone,
    "support_window_end" time without time zone,
    "max_shift_duration_minutes" integer DEFAULT 240 NOT NULL,
    "support_mode" "text" DEFAULT 'independent'::"text" NOT NULL,
    "transport_status" "text" DEFAULT 'independent'::"text" NOT NULL,
    "travel_radius_km" integer DEFAULT 10 NOT NULL,
    "preferred_services" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "physical_capacity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "customer_facing_ok" boolean DEFAULT true NOT NULL,
    "can_work_after_support_hours" boolean DEFAULT false NOT NULL,
    "supervision_notes" "text",
    "risk_notes" "text",
    "emergency_contact" "text",
    "support_worker_name" "text",
    "support_worker_provider" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "psp_physical_capacity_check" CHECK (("physical_capacity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "psp_support_mode_check" CHECK (("support_mode" = ANY (ARRAY['independent'::"text", 'supported'::"text", 'team_based'::"text"]))),
    CONSTRAINT "psp_transport_status_check" CHECK (("transport_status" = ANY (ARRAY['independent'::"text", 'needs_transport'::"text", 'arranged'::"text"])))
);


ALTER TABLE "public"."participant_support_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "subscription_id" "uuid",
    "vendor_id" "uuid",
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "reference" "text",
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "payables_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payables_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "subscription_id" "uuid",
    "customer_id" "uuid",
    "amount" numeric NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_reference" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'card'::"text", 'bank_transfer'::"text", 'invoice'::"text", 'other'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text", 'partial_refund'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_payout_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'aud'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "arrival_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "failure_code" "text",
    "failure_message" "text"
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "direction" "text" NOT NULL,
    "from_number" "text",
    "to_number" "text",
    "duration_s" integer,
    "recording_url" "text",
    "transcript" "text",
    "summary" "text",
    "action_items" "jsonb" DEFAULT '[]'::"jsonb",
    "sentiment" "text",
    "agent_processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "phone_calls_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."phone_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_agent_scores" (
    "id" bigint NOT NULL,
    "run_id" "uuid" NOT NULL,
    "agent" "text" NOT NULL,
    "dimension" "text" NOT NULL,
    "value" numeric(4,3) NOT NULL,
    "rationale" "text",
    "is_skeptic" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pipeline_agent_scores_value_check" CHECK ((("value" >= (0)::numeric) AND ("value" <= (1)::numeric)))
);


ALTER TABLE "public"."pipeline_agent_scores" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pipeline_agent_scores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pipeline_agent_scores_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pipeline_agent_scores_id_seq" OWNED BY "public"."pipeline_agent_scores"."id";



CREATE TABLE IF NOT EXISTS "public"."pipeline_artifacts" (
    "id" bigint NOT NULL,
    "run_id" "uuid" NOT NULL,
    "stage" "public"."pipeline_stage",
    "kind" "text" NOT NULL,
    "label" "text",
    "url" "text",
    "body" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pipeline_artifacts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pipeline_artifacts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pipeline_artifacts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pipeline_artifacts_id_seq" OWNED BY "public"."pipeline_artifacts"."id";



CREATE TABLE IF NOT EXISTS "public"."pipeline_kill_switch" (
    "id" integer DEFAULT 1 NOT NULL,
    "paused" boolean DEFAULT false NOT NULL,
    "reason" "text",
    "paused_at" timestamp with time zone,
    "paused_by" "uuid",
    CONSTRAINT "pipeline_kill_switch_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."pipeline_kill_switch" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "surface" "public"."pipeline_surface" NOT NULL,
    "trigger_signal" "text" NOT NULL,
    "trigger_payload" "jsonb",
    "status" "public"."pipeline_run_status" DEFAULT 'open'::"public"."pipeline_run_status" NOT NULL,
    "verdict" "public"."pipeline_run_verdict" DEFAULT 'pending'::"public"."pipeline_run_verdict" NOT NULL,
    "composite_score" numeric(4,3),
    "pr_url" "text",
    "preview_url" "text",
    "rolled_back_at" timestamp with time zone,
    "rollback_reason" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone
);


ALTER TABLE "public"."pipeline_runs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pipeline_kpis_7d" AS
 SELECT "s"."surface",
    (COALESCE("count"(*) FILTER (WHERE (("r"."verdict" = 'auto_merge'::"public"."pipeline_run_verdict") AND ("r"."started_at" > ("now"() - '7 days'::interval)))), (0)::bigint))::integer AS "auto_merged",
    (COALESCE("count"(*) FILTER (WHERE (("r"."verdict" = 'rejected'::"public"."pipeline_run_verdict") AND ("r"."started_at" > ("now"() - '7 days'::interval)))), (0)::bigint))::integer AS "auto_rejected",
    (COALESCE("count"(*) FILTER (WHERE (("r"."status" = 'rolled_back'::"public"."pipeline_run_status") AND ("r"."started_at" > ("now"() - '7 days'::interval)))), (0)::bigint))::integer AS "rollbacks",
    (COALESCE(EXTRACT(epoch FROM "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY ("r"."ended_at" - "r"."started_at")) FILTER (WHERE (("r"."ended_at" IS NOT NULL) AND ("r"."started_at" > ("now"() - '7 days'::interval))))), (0)::numeric))::integer AS "median_seconds"
   FROM (( SELECT "unnest"("enum_range"(NULL::"public"."pipeline_surface")) AS "surface") "s"
     LEFT JOIN "public"."pipeline_runs" "r" ON (("r"."surface" = "s"."surface")))
  GROUP BY "s"."surface";


ALTER VIEW "public"."pipeline_kpis_7d" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_policy" (
    "surface" "public"."pipeline_surface" NOT NULL,
    "autonomy_enabled" boolean DEFAULT false NOT NULL,
    "daily_merge_budget" integer DEFAULT 10 NOT NULL,
    "class_a_auto" boolean DEFAULT true NOT NULL,
    "class_b_auto" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pipeline_policy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_stage_events" (
    "id" bigint NOT NULL,
    "run_id" "uuid" NOT NULL,
    "stage" "public"."pipeline_stage" NOT NULL,
    "status" "public"."pipeline_stage_status" NOT NULL,
    "payload" "jsonb",
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pipeline_stage_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pipeline_stage_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pipeline_stage_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pipeline_stage_events_id_seq" OWNED BY "public"."pipeline_stage_events"."id";



CREATE TABLE IF NOT EXISTS "public"."pr_review_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pr_number" integer NOT NULL,
    "branch" "text" NOT NULL,
    "plain_title" "text" NOT NULL,
    "system_area" "text" NOT NULL,
    "risk_level" "text" NOT NULL,
    "recommendation" "text" NOT NULL,
    "recommendation_score" integer NOT NULL,
    "evidence_confidence" "text" NOT NULL,
    "evidence_confidence_score" integer NOT NULL,
    "evidence_penalty" integer DEFAULT 0 NOT NULL,
    "predicted_outcome" "text" NOT NULL,
    "expected_best_case" "text",
    "expected_outcome" "text",
    "expected_worst_case" "text",
    "business_impact" "jsonb",
    "check_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "merged_at" timestamp with time zone,
    "deployment_succeeded" boolean,
    "production_healthy" boolean,
    "errors_increased" boolean,
    "workflow_affected" boolean,
    "rollback_needed" boolean,
    "improvement_happened" boolean,
    "outcome_notes" "text",
    "accuracy_verdict" "text",
    "accuracy_score" integer,
    "learning_notes" "jsonb",
    "checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pr_review_predictions_accuracy_score_check" CHECK ((("accuracy_score" >= 0) AND ("accuracy_score" <= 100))),
    CONSTRAINT "pr_review_predictions_accuracy_verdict_check" CHECK (("accuracy_verdict" = ANY (ARRAY['correct'::"text", 'partially_correct'::"text", 'wrong'::"text", 'unknown'::"text"]))),
    CONSTRAINT "pr_review_predictions_check_status_check" CHECK (("check_status" = ANY (ARRAY['pending'::"text", 'merged_unchecked'::"text", 'confirmed'::"text", 'skipped'::"text", 'not_merged'::"text"]))),
    CONSTRAINT "pr_review_predictions_evidence_confidence_check" CHECK (("evidence_confidence" = ANY (ARRAY['strong'::"text", 'partial'::"text", 'weak'::"text", 'insufficient'::"text"]))),
    CONSTRAINT "pr_review_predictions_evidence_confidence_score_check" CHECK ((("evidence_confidence_score" >= 0) AND ("evidence_confidence_score" <= 100))),
    CONSTRAINT "pr_review_predictions_recommendation_check" CHECK (("recommendation" = ANY (ARRAY['approve'::"text", 'hold'::"text", 'reject'::"text", 'needs_manual_review'::"text"]))),
    CONSTRAINT "pr_review_predictions_recommendation_score_check" CHECK ((("recommendation_score" >= 0) AND ("recommendation_score" <= 100))),
    CONSTRAINT "pr_review_predictions_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."pr_review_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "service" "text" NOT NULL,
    "suburb" "text",
    "price_unit" "text" NOT NULL,
    "current_price" numeric(10,2) NOT NULL,
    "recommended_price" numeric(10,2) NOT NULL,
    "direction" "text" NOT NULL,
    "delta_pct" numeric(5,2) NOT NULL,
    "capacity_pct" numeric(5,2),
    "win_rate_pct" numeric(5,2),
    "competitor_p25" numeric(10,2),
    "competitor_p50" numeric(10,2),
    "competitor_p75" numeric(10,2),
    "cost_drift_pct" numeric(5,2),
    "rationale" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_recommendations_direction_check" CHECK (("direction" = ANY (ARRAY['raise'::"text", 'lower'::"text", 'hold'::"text"]))),
    CONSTRAINT "pricing_recommendations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'applied'::"text", 'superseded'::"text"])))
);


ALTER TABLE "public"."pricing_recommendations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."production_orders" AS
 SELECT "id",
    "quote_id",
    "customer_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "service_type",
    "context",
    "scope",
    "frequency",
    "base_price",
    "discount_percent",
    "final_price",
    "scheduled_date",
    "scheduled_time",
    "status",
    "notes",
    "created_at",
    "updated_at",
    "completed_at",
    "stripe_checkout_session_id",
    "stripe_payment_intent_id",
    "assigned_employee_id",
    "assigned_crew_id",
    "estimated_duration_minutes",
    "analytics_session_id",
    "segment",
    "cancellation_window",
    "cancellation_fault",
    "cancellation_reason",
    "cancelled_at",
    "is_test",
    "environment"
   FROM "public"."orders"
  WHERE (("environment" = 'production'::"text") AND (COALESCE("is_test", false) = false));


ALTER VIEW "public"."production_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "role" "text" DEFAULT 'customer'::"text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organisation_id" "uuid",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'employee'::"text", 'customer'::"text", 'org_admin'::"text", 'ndis_participant'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_funnel_events" (
    "id" bigint NOT NULL,
    "session_id" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "service" "text",
    "scope" "text",
    "context" "text",
    "time_spent_seconds" integer,
    "config_changes" integer,
    "quote_submitted" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quote_funnel_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."quote_funnel_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."quote_funnel_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."quote_funnel_events_id_seq" OWNED BY "public"."quote_funnel_events"."id";



CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text",
    "customer_phone" "text",
    "service_type" "text" NOT NULL,
    "context" "text" DEFAULT 'home'::"text" NOT NULL,
    "scope" "text",
    "frequency" "text" DEFAULT 'none'::"text" NOT NULL,
    "total" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "converted_order_id" "uuid",
    "converted_subscription_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_id" "uuid",
    "submitted_total" numeric(10,2) NOT NULL,
    "reviewed_total" numeric(10,2),
    "finalized_at" timestamp with time zone,
    "finalized_by" "text",
    "payment_status" "text" DEFAULT 'not_requested'::"text" NOT NULL,
    "payment_requested_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_checkout_url" "text",
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "text",
    "analytics_session_id" "text",
    "ndis_management_type" "text",
    "ndis_forward_contact" "text",
    "ndis_forward_email" "text",
    "ndis_estimated_hours" numeric(5,2),
    "ndis_hourly_rate" numeric(6,2),
    "ndis_forwarded_at" timestamp with time zone,
    "ndis_accepted_at" timestamp with time zone,
    "ndis_booked_at" timestamp with time zone,
    "service_address" "text",
    "lead_score" integer,
    "lead_score_at" timestamp with time zone,
    "yard_sqm" numeric,
    "yard_complexity" "text",
    "geo_image_url" "text",
    "agent_triaged_at" timestamp with time zone,
    "agent_estimate_aud" numeric,
    "agent_service" "text",
    "agent_ndis" boolean,
    "source" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "quotes_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "quotes_ndis_management_type_check" CHECK ((("ndis_management_type" IS NULL) OR ("ndis_management_type" = ANY (ARRAY['plan_managed'::"text", 'self_managed'::"text", 'agency_managed'::"text"])))),
    CONSTRAINT "quotes_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['not_requested'::"text", 'pending_payment'::"text", 'paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "quotes_source_check" CHECK (("source" = ANY (ARRAY['website'::"text", 'messenger'::"text", 'sms'::"text", 'instagram'::"text", 'email'::"text", 'phone'::"text", 'referral'::"text", 'unknown'::"text"]))),
    CONSTRAINT "quotes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'adjusted'::"text", 'converted'::"text", 'submitted'::"text", 'in_review'::"text", 'finalized'::"text", 'payment_pending'::"text", 'paid'::"text", 'denied'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "quotes_yard_complexity_check" CHECK (("yard_complexity" = ANY (ARRAY[NULL::"text", 'simple'::"text", 'moderate'::"text", 'complex'::"text"])))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotes"."source" IS 'Where this quote/lead originated. Set on insert by the route that created the quote (e.g. /api/quotes/submit defaults to ''website''). Read by Bud Leads to attribute conversion by channel.';



CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_test" boolean DEFAULT false NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "ratings_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"]))),
    CONSTRAINT "ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rego_cache" (
    "rego" "text" NOT NULL,
    "state" "text" NOT NULL,
    "vehicle_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '60 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rego_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."research_trends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "trend_type" "text" NOT NULL,
    "urgency" "text" NOT NULL,
    "adaptation_angle" "text" DEFAULT ''::"text" NOT NULL,
    "story_arc_id" "uuid",
    "status" "text" DEFAULT 'watching'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "adaptation_score" integer,
    "adaptation_reason" "text",
    "adapted_at" timestamp with time zone,
    CONSTRAINT "research_trends_adaptation_score_check" CHECK ((("adaptation_score" >= 0) AND ("adaptation_score" <= 100))),
    CONSTRAINT "research_trends_platform_check" CHECK (("platform" = ANY (ARRAY['tiktok'::"text", 'instagram'::"text", 'facebook'::"text", 'youtube'::"text", 'linkedin'::"text", 'website'::"text"]))),
    CONSTRAINT "research_trends_status_check" CHECK (("status" = ANY (ARRAY['watching'::"text", 'adapting'::"text", 'published'::"text", 'expired'::"text"]))),
    CONSTRAINT "research_trends_trend_type_check" CHECK (("trend_type" = ANY (ARRAY['audio'::"text", 'format'::"text", 'hook'::"text", 'topic'::"text", 'visual_style'::"text", 'other'::"text"]))),
    CONSTRAINT "research_trends_urgency_check" CHECK (("urgency" = ANY (ARRAY['evergreen'::"text", 'two_week_window'::"text", 'forty_eight_hour_window'::"text"])))
);


ALTER TABLE "public"."research_trends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resilience_events" (
    "id" bigint NOT NULL,
    "guard" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resilience_events_guard_check" CHECK (("guard" = ANY (ARRAY['circuit_breaker'::"text", 'zombie_reaper'::"text", 'concurrency_guard'::"text"])))
);


ALTER TABLE "public"."resilience_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."resilience_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."resilience_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."resilience_events_id_seq" OWNED BY "public"."resilience_events"."id";



CREATE TABLE IF NOT EXISTS "public"."reviewer_calibration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "system_area" "text" NOT NULL,
    "score_adjustment" integer DEFAULT 0 NOT NULL,
    "penalty_multiplier" numeric(4,2) DEFAULT 1.0 NOT NULL,
    "total_predictions" integer DEFAULT 0 NOT NULL,
    "correct_predictions" integer DEFAULT 0 NOT NULL,
    "accuracy_rate" numeric(5,2),
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "calibration_note" "text",
    "wrong_recommendation_streak" integer DEFAULT 0 NOT NULL,
    "heightened_caution" boolean DEFAULT false NOT NULL,
    CONSTRAINT "reviewer_calibration_penalty_multiplier_check" CHECK ((("penalty_multiplier" >= 1.0) AND ("penalty_multiplier" <= 2.5))),
    CONSTRAINT "reviewer_calibration_score_adjustment_check" CHECK ((("score_adjustment" >= '-20'::integer) AND ("score_adjustment" <= 10))),
    CONSTRAINT "reviewer_calibration_wrong_recommendation_streak_check" CHECK (("wrong_recommendation_streak" >= 0))
);


ALTER TABLE "public"."reviewer_calibration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_agent_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "runs" integer DEFAULT 0 NOT NULL,
    "pass_rate" numeric,
    "avg_f1" numeric,
    "avg_precision" numeric,
    "avg_recall" numeric,
    "baseline_f1" numeric,
    "delta_f1" numeric,
    "trend" "text" DEFAULT 'stable'::"text" NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sandbox_agent_health_trend_check" CHECK (("trend" = ANY (ARRAY['improving'::"text", 'stable'::"text", 'degrading'::"text"])))
);


ALTER TABLE "public"."sandbox_agent_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_agent_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_run_id" "uuid" NOT NULL,
    "scenario_id" "uuid" NOT NULL,
    "agent_id" "text" NOT NULL,
    "summary" "text",
    "output" "jsonb" DEFAULT '{}'::"jsonb",
    "proposed_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "llm_calls" integer DEFAULT 0,
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "cost_cents" integer DEFAULT 0,
    "environment" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sandbox_agent_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_decision_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "scenario_id" "uuid" NOT NULL,
    "agent_id" "text" NOT NULL,
    "precision_score" numeric(5,4) DEFAULT 0,
    "recall_score" numeric(5,4) DEFAULT 0,
    "f1_score" numeric(5,4) DEFAULT 0,
    "hit" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "environment" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "scored_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sandbox_decision_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_lessons_learned" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "scenario_id" "uuid",
    "title" "text" NOT NULL,
    "observation" "text" NOT NULL,
    "recommendation" "text",
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "source" "text" DEFAULT 'auto'::"text" NOT NULL,
    "environment" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sandbox_lessons_learned" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_policy" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sandbox_policy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_run_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "text" NOT NULL,
    "trigger" "text" DEFAULT 'cron'::"text" NOT NULL,
    "proposal_id" "uuid",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "scenario_count" integer DEFAULT 0 NOT NULL,
    "pass_count" integer DEFAULT 0 NOT NULL,
    "avg_f1" numeric,
    "total_cost_cents" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "sandbox_run_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'complete'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "sandbox_run_batches_trigger_check" CHECK (("trigger" = ANY (ARRAY['cron'::"text", 'manual'::"text", 'eval'::"text"])))
);


ALTER TABLE "public"."sandbox_run_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "agent_id" "text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expected_action_types" "text"[] DEFAULT '{}'::"text"[],
    "difficulty" "text" DEFAULT 'medium'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "environment" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sandbox_scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sandbox_training_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scenario_id" "uuid" NOT NULL,
    "triggered_by" "text",
    "trigger" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "agent_run_id" "text",
    "duration_ms" integer,
    "cost_cents" integer,
    "environment" "text" DEFAULT 'sandbox'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "batch_id" "uuid",
    CONSTRAINT "sandbox_training_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'complete'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sandbox_training_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service" "text" NOT NULL,
    "suburb" "text",
    "price_unit" "text" NOT NULL,
    "price_aud" numeric(10,2) NOT NULL,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "set_by" "uuid",
    "set_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_pricing_price_aud_check" CHECK (("price_aud" > (0)::numeric)),
    CONSTRAINT "service_pricing_price_unit_check" CHECK (("price_unit" = ANY (ARRAY['per_hour'::"text", 'per_visit'::"text", 'per_sqm'::"text", 'flat'::"text"])))
);


ALTER TABLE "public"."service_pricing" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_pricing" IS 'Live service rate card. The Price Optimizer agent reads from this table to know the baseline and proposes updates that, once approved by an admin in /dashboard/agents, are written back here.';



CREATE TABLE IF NOT EXISTS "public"."shift_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "segment_number" integer NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "estimated_duration_minutes" integer,
    "status" "text" DEFAULT 'unassigned'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ss_status_check" CHECK (("status" = ANY (ARRAY['unassigned'::"text", 'published'::"text", 'accepted'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."shift_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text" NOT NULL,
    "photo_url" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_feedback_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'reviewed'::"text", 'closed'::"text"]))),
    CONSTRAINT "site_feedback_type_check" CHECK (("type" = ANY (ARRAY['bug_report'::"text", 'feature_idea'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."site_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_impact_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participants_supported" integer DEFAULT 0 NOT NULL,
    "paid_jobs_completed" integer DEFAULT 0 NOT NULL,
    "training_hours_delivered" integer DEFAULT 0 NOT NULL,
    "employment_opportunities_created" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."site_impact_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "text"
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_visitors" (
    "session_id" "text" NOT NULL,
    "current_page" "text" NOT NULL,
    "page_title" "text",
    "referrer" "text",
    "user_agent" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "city" "text",
    "country" "text"
);


ALTER TABLE "public"."site_visitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_proof_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "posted_at" "date",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_proof_items_platform_check" CHECK (("platform" = ANY (ARRAY['tiktok'::"text", 'instagram'::"text", 'facebook'::"text"]))),
    CONSTRAINT "social_proof_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'live'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."social_proof_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_arcs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "priority" integer DEFAULT 0 NOT NULL,
    "characters_involved" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "journal_entry_links" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "progress_notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "story_arcs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'planted'::"text", 'resolved'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."story_arcs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_bible_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_key" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text" DEFAULT 'Jackson Taylor'::"text" NOT NULL
);


ALTER TABLE "public"."story_bible_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "goal" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "started_at" "date",
    "ended_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "profile" "text" DEFAULT ''::"text" NOT NULL,
    "role_in_story" "text" DEFAULT ''::"text" NOT NULL,
    "voice_perspective" "text" DEFAULT ''::"text" NOT NULL,
    "content_posture" "text" DEFAULT ''::"text" NOT NULL,
    "what_to_show" "text" DEFAULT ''::"text" NOT NULL,
    "what_to_protect" "text" DEFAULT ''::"text" NOT NULL,
    "active_story_threads" "text" DEFAULT ''::"text" NOT NULL,
    "consent_status" "text",
    "consent_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timeline_notes" "text"
);


ALTER TABLE "public"."story_characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opportunity_id" "uuid" NOT NULL,
    "format" "text" DEFAULT ''::"text" NOT NULL,
    "platform" "text" DEFAULT ''::"text" NOT NULL,
    "hook" "text" DEFAULT ''::"text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "close" "text" DEFAULT ''::"text" NOT NULL,
    "hashtags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "prompt_context" "text" DEFAULT ''::"text" NOT NULL,
    "is_ai_generated" boolean DEFAULT true NOT NULL,
    "generation_model" "text",
    "generation_tokens" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "story_drafts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'reviewed'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."story_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_open_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "related_arc_id" "uuid",
    "related_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "opened_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "closed_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "progress_notes" "text",
    CONSTRAINT "story_open_threads_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."story_open_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_ref_id" "text",
    "related_arc_id" "uuid",
    "related_characters" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "content_angle" "text" DEFAULT ''::"text" NOT NULL,
    "suggested_format" "text" DEFAULT ''::"text" NOT NULL,
    "suggested_platform" "text" DEFAULT ''::"text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "section" "text" DEFAULT 'surfaced'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_auto_detected" boolean DEFAULT false NOT NULL,
    "detection_rule" "text",
    "detection_reason" "text",
    "confidence_score" double precision,
    "source_hash" "text",
    "story_score" integer,
    "score_breakdown" "jsonb",
    "score_reason" "text",
    "scored_at" timestamp with time zone,
    "content_idea_created" boolean DEFAULT false NOT NULL,
    "story_category" "text",
    CONSTRAINT "story_opportunities_section_check" CHECK (("section" = ANY (ARRAY['surfaced'::"text", 'tension_map'::"text", 'missed_moments'::"text"]))),
    CONSTRAINT "story_opportunities_source_type_check" CHECK (("source_type" = ANY (ARRAY['journal'::"text", 'character'::"text", 'arc'::"text", 'open_thread'::"text", 'chapter'::"text", 'manual'::"text", 'milestone'::"text", 'internal_system_milestone'::"text"]))),
    CONSTRAINT "story_opportunities_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'in_development'::"text", 'published'::"text", 'passed'::"text"]))),
    CONSTRAINT "story_opps_confidence_range" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::double precision) AND ("confidence_score" <= (1)::double precision)))),
    CONSTRAINT "story_opps_score_range" CHECK ((("story_score" IS NULL) OR (("story_score" >= 0) AND ("story_score" <= 100))))
);


ALTER TABLE "public"."story_opportunities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."story_opportunities"."story_category" IS 'Classified story type: employment_outcome | customer_validation | community_impact | business_milestone | founder_journey | internal_operations';



CREATE TABLE IF NOT EXISTS "public"."story_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "draft_id" "uuid" NOT NULL,
    "review_status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "safety_score" integer DEFAULT 0 NOT NULL,
    "consent_verified" boolean DEFAULT false NOT NULL,
    "privacy_checked" boolean DEFAULT false NOT NULL,
    "factual_accuracy_checked" boolean DEFAULT false NOT NULL,
    "brand_alignment_checked" boolean DEFAULT false NOT NULL,
    "findings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reviewer_notes" "text" DEFAULT ''::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "story_reviews_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending_review'::"text", 'changes_required'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "story_reviews_safety_score_check" CHECK ((("safety_score" >= 0) AND ("safety_score" <= 100)))
);


ALTER TABLE "public"."story_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_disputes" (
    "id" "text" NOT NULL,
    "charge_id" "text",
    "customer_id" "uuid",
    "amount_cents" integer,
    "reason" "text",
    "status" "text",
    "evidence_due_at" timestamp with time zone,
    "evidence_package" "jsonb",
    "agent_drafted_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_disputes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid",
    "order_id" "uuid",
    "service_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_email" "text",
    "customer_phone" "text",
    "service_type" "text" NOT NULL,
    "context" "text" NOT NULL,
    "scope" "text",
    "frequency" "text" NOT NULL,
    "base_price" numeric NOT NULL,
    "discount_percent" numeric DEFAULT 0,
    "price_per_cycle" numeric NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "start_date" "date" NOT NULL,
    "next_service_date" "date",
    "last_service_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transport_arrangements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "arrangement_type" "text" DEFAULT 'self'::"text" NOT NULL,
    "notes" "text",
    "confirmed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ta_type_check" CHECK (("arrangement_type" = ANY (ARRAY['self'::"text", 'support_worker'::"text", 'company'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."transport_arrangements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_agent_cache_savings" AS
 SELECT "agent_id",
    "sum"("cache_read_tokens") AS "total_cache_reads",
    "sum"("cache_creation_tokens") AS "total_cache_writes",
    "sum"("input_tokens") AS "total_input_tokens",
    "round"(((("sum"("cache_read_tokens"))::numeric / (1000000)::numeric) *
        CASE "model"
            WHEN 'claude-sonnet-4-6'::"text" THEN ((3)::numeric * 0.9)
            WHEN 'claude-haiku-4-5-20251001'::"text" THEN ((1)::numeric * 0.9)
            ELSE ((3)::numeric * 0.9)
        END), 4) AS "estimated_savings_usd",
    "count"(*) AS "run_count"
   FROM "public"."agent_runs"
  WHERE ("started_at" > ("now"() - '30 days'::interval))
  GROUP BY "agent_id", "model";


ALTER VIEW "public"."v_agent_cache_savings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bud_approval_truth" AS
 SELECT "q"."id",
    "q"."task_id",
    "q"."action_type",
    "q"."status",
    "q"."created_at",
    "q"."archived_at",
    "q"."archive_reason",
    "q"."blocked_reason",
    "q"."payload",
    "q"."approval_identity",
    "q"."root_cause_id",
    "q"."root_cause_key",
    "q"."initiative_id",
    "q"."superseded_by",
    "q"."is_duplicate",
    "q"."environment",
    "t"."status" AS "task_status",
    "t"."risk_level",
    "t"."linked_pr",
        CASE
            WHEN COALESCE("q"."is_duplicate", false) THEN 'Archived'::"text"
            WHEN ("q"."status" = 'archived'::"text") THEN 'Archived'::"text"
            WHEN ("q"."status" = 'blocked'::"text") THEN 'Blocked'::"text"
            WHEN ("q"."status" <> 'pending'::"text") THEN 'Archived'::"text"
            WHEN (("q"."created_at" < ("now"() - '24:00:00'::interval)) AND (("t"."status" = ANY (ARRAY['archived'::"text", 'completed'::"text"])) OR (("t"."risk_level" = ANY (ARRAY['high'::"text", 'critical'::"text"])) AND (COALESCE("t"."linked_pr", ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'pr_url'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'pull_request_url'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'diff'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'diff_summary'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'patch'::"text"), ''::"text") = ''::"text")))) THEN 'Blocked'::"text"
            WHEN (("t"."risk_level" = ANY (ARRAY['high'::"text", 'critical'::"text"])) AND (COALESCE("t"."linked_pr", ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'pr_url'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'pull_request_url'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'diff'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'diff_summary'::"text"), ''::"text") = ''::"text") AND (COALESCE(("q"."payload" ->> 'patch'::"text"), ''::"text") = ''::"text")) THEN 'Needs manual review'::"text"
            ELSE 'Actionable'::"text"
        END AS "truth_label"
   FROM ("public"."bud_approval_queue" "q"
     LEFT JOIN "public"."bud_tasks" "t" ON (("t"."id" = "q"."task_id")))
  WHERE ("q"."environment" = 'production'::"text");


ALTER VIEW "public"."v_bud_approval_truth" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pending_agent_actions" AS
 SELECT "a"."id" AS "action_id",
    "a"."id",
    "a"."run_id",
    "a"."agent_id",
    "ag"."name" AS "agent_name",
    "a"."action_type",
    "a"."target_table",
    "a"."target_id",
    "a"."preview",
    "a"."payload",
    "a"."requires_approval",
    "a"."status",
    "a"."action_identity",
    "a"."root_cause_id",
    "a"."root_cause_key",
    "a"."initiative_id",
    "a"."superseded_by",
    "a"."is_duplicate",
    "a"."environment",
    "a"."created_at"
   FROM ("public"."agent_actions" "a"
     JOIN "public"."agents" "ag" ON (("ag"."id" = "a"."agent_id")))
  WHERE (("a"."status" = 'pending'::"text") AND (COALESCE("a"."is_duplicate", false) = false) AND ("a"."environment" = 'production'::"text"))
  ORDER BY "a"."created_at" DESC;


ALTER VIEW "public"."v_pending_agent_actions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_agent_intelligence_quality" AS
 WITH "signal_stats" AS (
         SELECT ("count"(*))::integer AS "signal_count",
            ("count"(DISTINCT COALESCE("bud_improvement_signals"."root_cause_key", "bud_improvement_signals"."fingerprint", ("bud_improvement_signals"."id")::"text")))::integer AS "root_cause_count"
           FROM "public"."bud_improvement_signals"
          WHERE (("bud_improvement_signals"."status" = ANY (ARRAY['new'::"text", 'queued'::"text", 'executing'::"text"])) AND ("bud_improvement_signals"."environment" = 'production'::"text"))
        ), "approval_stats" AS (
         SELECT ((( SELECT "count"(*) AS "count"
                   FROM "public"."v_pending_agent_actions"))::integer + (( SELECT "count"(*) AS "count"
                   FROM "public"."v_bud_approval_truth"
                  WHERE (("v_bud_approval_truth"."truth_label" = ANY (ARRAY['Actionable'::"text", 'Needs manual review'::"text"])) AND (COALESCE("v_bud_approval_truth"."is_duplicate", false) = false))))::integer) AS "approval_count"
        ), "initiative_stats" AS (
         SELECT ("count"(*))::integer AS "initiative_count"
           FROM "public"."bud_root_cause_initiatives"
          WHERE (("bud_root_cause_initiatives"."status" = ANY (ARRAY['open'::"text", 'patching'::"text", 'validating'::"text", 'blocked'::"text"])) AND ("bud_root_cause_initiatives"."approval_count" > 0) AND ("bud_root_cause_initiatives"."environment" = 'production'::"text"))
        )
 SELECT "signal_stats"."signal_count",
        CASE
            WHEN ("signal_stats"."signal_count" = 0) THEN (0)::numeric
            ELSE "round"(((("signal_stats"."signal_count" - "signal_stats"."root_cause_count"))::numeric / ("signal_stats"."signal_count")::numeric), 4)
        END AS "duplicate_rate",
    "signal_stats"."root_cause_count",
    "approval_stats"."approval_count",
    "initiative_stats"."initiative_count"
   FROM "signal_stats",
    "approval_stats",
    "initiative_stats";


ALTER VIEW "public"."v_agent_intelligence_quality" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_agent_latest_run" AS
 SELECT DISTINCT ON ("agent_id") "agent_id",
    "id" AS "run_id",
    "status",
    "summary",
    "confidence_score",
    "evidence_payload",
    "finished_at"
   FROM "public"."agent_runs"
  WHERE ("finished_at" IS NOT NULL)
  ORDER BY "agent_id", "finished_at" DESC;


ALTER VIEW "public"."v_agent_latest_run" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_agent_runtime_status" AS
 SELECT "a"."id" AS "agent_id",
    "latest"."status" AS "last_run_outcome",
    COALESCE("stats"."runs_30d", (0)::bigint) AS "runs_30d",
    "a"."stale_after_minutes",
        CASE
            WHEN ("a"."status" = ANY (ARRAY['disabled'::"text", 'planned'::"text"])) THEN false
            WHEN ("a"."stale_after_minutes" IS NULL) THEN false
            WHEN ("a"."last_run_at" IS NULL) THEN true
            WHEN ("a"."last_run_at" < ("now"() - (("a"."stale_after_minutes" || ' minutes'::"text"))::interval)) THEN true
            ELSE false
        END AS "is_stale"
   FROM (("public"."agents" "a"
     LEFT JOIN ( SELECT DISTINCT ON ("agent_runs"."agent_id") "agent_runs"."agent_id",
            "agent_runs"."status"
           FROM "public"."agent_runs"
          WHERE ("agent_runs"."finished_at" IS NOT NULL)
          ORDER BY "agent_runs"."agent_id", "agent_runs"."finished_at" DESC) "latest" ON (("latest"."agent_id" = "a"."id")))
     LEFT JOIN ( SELECT "agent_runs"."agent_id",
            "count"(*) AS "runs_30d"
           FROM "public"."agent_runs"
          WHERE ("agent_runs"."started_at" >= ("now"() - '30 days'::interval))
          GROUP BY "agent_runs"."agent_id") "stats" ON (("stats"."agent_id" = "a"."id")));


ALTER VIEW "public"."v_agent_runtime_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_agent_stats_7d" AS
 SELECT "agent_id",
    ("count"(*))::integer AS "runs",
    ("count"(*) FILTER (WHERE ("status" = 'succeeded'::"text")))::integer AS "successes",
    ("count"(*) FILTER (WHERE ("status" = 'failed'::"text")))::integer AS "failures",
    (COALESCE("sum"("cost_cents"), (0)::bigint))::integer AS "cost_cents",
    COALESCE(("round"("avg"("duration_ms") FILTER (WHERE ("duration_ms" IS NOT NULL))))::integer, 0) AS "avg_duration_ms"
   FROM "public"."agent_runs"
  WHERE (("started_at" >= ("now"() - '7 days'::interval)) AND ("agent_id" IS NOT NULL))
  GROUP BY "agent_id";


ALTER VIEW "public"."v_agent_stats_7d" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bud_repair_success_rate" AS
 SELECT COALESCE("r"."agent_id", "e"."source_agent") AS "agent_id",
    "count"(DISTINCT "e"."id") AS "total_repairs",
    "count"(DISTINCT "r"."id") AS "total_rollbacks",
    "round"((100.0 * ((1)::numeric - (("count"(DISTINCT "r"."id"))::numeric / (NULLIF("count"(DISTINCT "e"."id"), 0))::numeric))), 1) AS "success_rate_pct"
   FROM ("public"."bud_repair_executions" "e"
     LEFT JOIN "public"."bud_rollback_events" "r" ON (("r"."execution_id" = "e"."id")))
  WHERE ("e"."created_at" > ("now"() - '30 days'::interval))
  GROUP BY COALESCE("r"."agent_id", "e"."source_agent");


ALTER VIEW "public"."v_bud_repair_success_rate" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bud_rollback_trends" AS
 SELECT "agent_id",
    "count"(*) AS "total_rollbacks",
    "count"(*) FILTER (WHERE ("trigger" = 'ci_failure'::"text")) AS "ci_failures",
    "count"(*) FILTER (WHERE ("trigger" = 'surgical_limit'::"text")) AS "surgical_limits",
    "count"(*) FILTER (WHERE ("trigger" = 'taste_failure'::"text")) AS "taste_failures",
    "count"(*) FILTER (WHERE ("trigger" = 'browser_failure'::"text")) AS "browser_failures",
    "min"("created_at") AS "first_rollback",
    "max"("created_at") AS "last_rollback"
   FROM "public"."bud_rollback_events"
  GROUP BY "agent_id";


ALTER VIEW "public"."v_bud_rollback_trends" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pricing_recs_pending" AS
 SELECT "pr"."id",
    "pr"."run_id",
    "pr"."service",
    "pr"."suburb",
    "pr"."price_unit",
    "pr"."current_price",
    "pr"."recommended_price",
    "pr"."direction",
    "pr"."delta_pct",
    "pr"."capacity_pct",
    "pr"."win_rate_pct",
    "pr"."competitor_p50",
    "pr"."rationale",
    "pr"."created_at",
    "ar"."summary" AS "run_summary"
   FROM ("public"."pricing_recommendations" "pr"
     LEFT JOIN "public"."agent_runs" "ar" ON (("ar"."id" = "pr"."run_id")))
  WHERE ("pr"."status" = 'pending'::"text")
  ORDER BY "pr"."created_at" DESC;


ALTER VIEW "public"."v_pricing_recs_pending" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicle_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "make" "text" NOT NULL,
    "model_pattern" "text" NOT NULL,
    "category" "text" NOT NULL,
    "priority" integer DEFAULT 50 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vehicle_overrides_category_check" CHECK (("category" = ANY (ARRAY['hatch'::"text", 'sedan'::"text", 'suv'::"text", 'ute'::"text", 'van'::"text", '4wd'::"text", 'luxury'::"text", 'muscle'::"text"])))
);


ALTER TABLE "public"."vehicle_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visitor_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text",
    "event_name" "text" NOT NULL,
    "event_label" "text",
    "page" "text",
    "source" "text" DEFAULT 'client'::"text" NOT NULL,
    "quote_id" "uuid",
    "order_id" "uuid",
    "payment_id" "uuid",
    "event_value" numeric(10,2),
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "environment" "text" DEFAULT 'production'::"text" NOT NULL,
    CONSTRAINT "visitor_events_environment_check" CHECK (("environment" = ANY (ARRAY['production'::"text", 'sandbox'::"text"])))
);


ALTER TABLE "public"."visitor_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whs_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crew_member_id" "uuid" NOT NULL,
    "record_type" "text" NOT NULL,
    "reference" "text",
    "issued_at" "date",
    "expires_at" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whs_records_record_type_check" CHECK (("record_type" = ANY (ARRAY['induction'::"text", 'wwcc'::"text", 'first_aid'::"text", 'licence'::"text", 'equipment_check'::"text", 'swms'::"text"])))
);


ALTER TABLE "public"."whs_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "participant_id" "uuid",
    "amount_cents" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "method" "text" DEFAULT 'bank_transfer'::"text" NOT NULL,
    "reference" "text",
    "scheduled_for" "date",
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_payouts_method_check" CHECK (("method" = ANY (ARRAY['bank_transfer'::"text", 'instant'::"text"]))),
    CONSTRAINT "worker_payouts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "worker_payouts_worker_check" CHECK ((("employee_id" IS NOT NULL) OR ("participant_id" IS NOT NULL)))
);


ALTER TABLE "public"."worker_payouts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bud_repair_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bud_repair_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."memory_read_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."memory_read_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pipeline_agent_scores" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pipeline_agent_scores_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pipeline_artifacts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pipeline_artifacts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pipeline_stage_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."pipeline_stage_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."quote_funnel_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."quote_funnel_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."resilience_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."resilience_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_optimization_findings"
    ADD CONSTRAINT "admin_optimization_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_ux_proposals"
    ADD CONSTRAINT "admin_ux_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_alerts"
    ADD CONSTRAINT "agent_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_config_versions"
    ADD CONSTRAINT "agent_config_versions_agent_id_version_key" UNIQUE ("agent_id", "version");



ALTER TABLE ONLY "public"."agent_config_versions"
    ADD CONSTRAINT "agent_config_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_evolutions"
    ADD CONSTRAINT "agent_evolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_guardrail_events"
    ADD CONSTRAINT "agent_guardrail_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_agent_id_key_key" UNIQUE ("agent_id", "key");



ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_workflow_memberships"
    ADD CONSTRAINT "agent_workflow_memberships_pkey" PRIMARY KEY ("workflow_id", "agent_id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_findings"
    ADD CONSTRAINT "analytics_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_funnels"
    ADD CONSTRAINT "analytics_funnels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_reports"
    ADD CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_sessions"
    ADD CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."applicants"
    ADD CONSTRAINT "applicants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."artifact_versions"
    ADD CONSTRAINT "artifact_versions_artifact_id_version_number_key" UNIQUE ("artifact_id", "version_number");



ALTER TABLE ONLY "public"."artifact_versions"
    ADD CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."artifacts"
    ADD CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_activity_feed"
    ADD CONSTRAINT "bud_activity_feed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_approval_queue"
    ADD CONSTRAINT "bud_approval_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_audit_logs"
    ADD CONSTRAINT "bud_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_browser_test_runs"
    ADD CONSTRAINT "bud_browser_test_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_change_requests"
    ADD CONSTRAINT "bud_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_circuit_states"
    ADD CONSTRAINT "bud_circuit_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_convention_learnings"
    ADD CONSTRAINT "bud_convention_learnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_deployment_verifications"
    ADD CONSTRAINT "bud_deployment_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_evidence"
    ADD CONSTRAINT "bud_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_improvement_executions"
    ADD CONSTRAINT "bud_improvement_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_improvement_learnings"
    ADD CONSTRAINT "bud_improvement_learnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_improvement_logs"
    ADD CONSTRAINT "bud_improvement_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_improvement_signals"
    ADD CONSTRAINT "bud_improvement_signals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_improvement_steps"
    ADD CONSTRAINT "bud_improvement_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_improvements"
    ADD CONSTRAINT "bud_improvements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_insights"
    ADD CONSTRAINT "bud_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_lobby_states"
    ADD CONSTRAINT "bud_lobby_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_repair_executions"
    ADD CONSTRAINT "bud_repair_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_repair_learnings"
    ADD CONSTRAINT "bud_repair_learnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_repair_logs"
    ADD CONSTRAINT "bud_repair_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_repair_quarantine"
    ADD CONSTRAINT "bud_repair_quarantine_branch_key" UNIQUE ("branch");



ALTER TABLE ONLY "public"."bud_repair_quarantine"
    ADD CONSTRAINT "bud_repair_quarantine_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_repair_steps"
    ADD CONSTRAINT "bud_repair_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_rollback_events"
    ADD CONSTRAINT "bud_rollback_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_root_cause_initiatives"
    ADD CONSTRAINT "bud_root_cause_initiatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_root_cause_initiatives"
    ADD CONSTRAINT "bud_root_cause_initiatives_root_cause_key_key" UNIQUE ("root_cause_key");



ALTER TABLE ONLY "public"."bud_tasks"
    ADD CONSTRAINT "bud_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_telemetry_events"
    ADD CONSTRAINT "bud_telemetry_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bud_terminal_sessions"
    ADD CONSTRAINT "bud_terminal_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_factory_run_artifacts"
    ADD CONSTRAINT "campaign_factory_run_artifacts_pkey" PRIMARY KEY ("run_id", "artifact_id");



ALTER TABLE ONLY "public"."campaign_factory_runs"
    ADD CONSTRAINT "campaign_factory_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capture_briefs"
    ADD CONSTRAINT "capture_briefs_brief_date_key" UNIQUE ("brief_date");



ALTER TABLE ONLY "public"."capture_briefs"
    ADD CONSTRAINT "capture_briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_flow_forecasts"
    ADD CONSTRAINT "cash_flow_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_templates"
    ADD CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classification_feedback"
    ADD CONSTRAINT "classification_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_agreements"
    ADD CONSTRAINT "client_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_intel"
    ADD CONSTRAINT "competitor_intel_competitor_name_url_service_key" UNIQUE ("competitor_name", "url", "service");



ALTER TABLE ONLY "public"."competitor_intel"
    ADD CONSTRAINT "competitor_intel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_pages"
    ADD CONSTRAINT "competitor_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_pages"
    ADD CONSTRAINT "competitor_pages_url_key" UNIQUE ("url");



ALTER TABLE ONLY "public"."content_assets"
    ADD CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_ideas"
    ADD CONSTRAINT "content_ideas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_learning_records"
    ADD CONSTRAINT "content_learning_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_library_items"
    ADD CONSTRAINT "content_library_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_library_items"
    ADD CONSTRAINT "content_library_items_source_table_source_id_key" UNIQUE ("source_table", "source_id");



ALTER TABLE ONLY "public"."content_production_cards"
    ADD CONSTRAINT "content_production_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_scripts"
    ADD CONSTRAINT "content_scripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_contradiction_log"
    ADD CONSTRAINT "contradiction_pair_unique" UNIQUE ("doc_a_id", "doc_b_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crew_coach_notes"
    ADD CONSTRAINT "crew_coach_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_properties"
    ADD CONSTRAINT "customer_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_properties"
    ADD CONSTRAINT "customer_properties_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."design_audits"
    ADD CONSTRAINT "design_audits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_insights"
    ADD CONSTRAINT "design_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."design_violations"
    ADD CONSTRAINT "design_violations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dev_os_sessions"
    ADD CONSTRAINT "dev_os_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."efficiency_findings"
    ADD CONSTRAINT "efficiency_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_onboarding"
    ADD CONSTRAINT "employee_onboarding_employee_id_section_key" UNIQUE ("employee_id", "section");



ALTER TABLE ONLY "public"."employee_onboarding"
    ADD CONSTRAINT "employee_onboarding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_payroll_details"
    ADD CONSTRAINT "employee_payroll_details_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."employee_payroll_details"
    ADD CONSTRAINT "employee_payroll_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_clerk_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_agent_runs_meta"
    ADD CONSTRAINT "executive_agent_runs_meta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_decisions"
    ADD CONSTRAINT "executive_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_directives"
    ADD CONSTRAINT "executive_directives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_kpi_targets"
    ADD CONSTRAINT "executive_kpi_targets_kpi_key_key" UNIQUE ("kpi_key");



ALTER TABLE ONLY "public"."executive_kpi_targets"
    ADD CONSTRAINT "executive_kpi_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_metrics_snapshots"
    ADD CONSTRAINT "executive_metrics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_tasks"
    ADD CONSTRAINT "executive_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."executive_weekly_reviews"
    ADD CONSTRAINT "executive_weekly_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."foreman_insights"
    ADD CONSTRAINT "foreman_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."foreman_lobby_states"
    ADD CONSTRAINT "foreman_lobby_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founder_journal_entries"
    ADD CONSTRAINT "founder_journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fundraising_contributions"
    ADD CONSTRAINT "fundraising_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fundraising_items"
    ADD CONSTRAINT "fundraising_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."github_events"
    ADD CONSTRAINT "github_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."growth_pipeline_events"
    ADD CONSTRAINT "growth_pipeline_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_order_id_employee_id_key" UNIQUE ("order_id", "employee_id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_completions"
    ADD CONSTRAINT "job_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_participant_matches"
    ADD CONSTRAINT "job_participant_matches_order_id_employee_id_key" UNIQUE ("order_id", "employee_id");



ALTER TABLE ONLY "public"."job_participant_matches"
    ADD CONSTRAINT "job_participant_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_publications"
    ADD CONSTRAINT "job_publications_order_id_employee_id_key" UNIQUE ("order_id", "employee_id");



ALTER TABLE ONLY "public"."job_publications"
    ADD CONSTRAINT "job_publications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_requirements"
    ADD CONSTRAINT "job_requirements_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."job_requirements"
    ADD CONSTRAINT "job_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_variations"
    ADD CONSTRAINT "job_variations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_articles"
    ADD CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lapsed_outreach"
    ADD CONSTRAINT "lapsed_outreach_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_conversations"
    ADD CONSTRAINT "lead_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_follow_ups"
    ADD CONSTRAINT "lead_follow_ups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_response_metrics"
    ADD CONSTRAINT "lead_response_metrics_pkey" PRIMARY KEY ("metric_day", "source");



ALTER TABLE ONLY "public"."lead_suburb_analytics"
    ADD CONSTRAINT "lead_suburb_analytics_pkey" PRIMARY KEY ("metric_day", "suburb");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lobby_themes"
    ADD CONSTRAINT "lobby_themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_campaign_queue_items"
    ADD CONSTRAINT "marketing_campaign_queue_items_pkey" PRIMARY KEY ("campaign_id", "queue_item_id");



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_distribution_playbooks"
    ADD CONSTRAINT "marketing_distribution_playbooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_distribution_playbooks"
    ADD CONSTRAINT "marketing_distribution_playbooks_title_key" UNIQUE ("title");



ALTER TABLE ONLY "public"."marketing_metrics"
    ADD CONSTRAINT "marketing_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_metrics"
    ADD CONSTRAINT "marketing_metrics_snapshot_date_channel_key" UNIQUE ("snapshot_date", "channel");



ALTER TABLE ONLY "public"."marketing_publishing_queue"
    ADD CONSTRAINT "marketing_publishing_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_social_channels"
    ADD CONSTRAINT "marketing_social_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_social_channels"
    ADD CONSTRAINT "marketing_social_channels_platform_key" UNIQUE ("platform");



ALTER TABLE ONLY "public"."memory_contradiction_log"
    ADD CONSTRAINT "memory_contradiction_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_documents"
    ADD CONSTRAINT "memory_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_documents"
    ADD CONSTRAINT "memory_documents_vault_path_key" UNIQUE ("vault_path");



ALTER TABLE ONLY "public"."memory_edges"
    ADD CONSTRAINT "memory_edges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memory_edges"
    ADD CONSTRAINT "memory_edges_unique" UNIQUE ("source_id", "target_id", "relationship");



ALTER TABLE ONLY "public"."memory_graph_extractions"
    ADD CONSTRAINT "memory_graph_extractions_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."memory_read_log"
    ADD CONSTRAINT "memory_read_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndis_organisations"
    ADD CONSTRAINT "ndis_organisations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndis_participants"
    ADD CONSTRAINT "ndis_participants_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."ndis_participants"
    ADD CONSTRAINT "ndis_participants_organisation_id_email_key" UNIQUE ("organisation_id", "email");



ALTER TABLE ONLY "public"."ndis_participants"
    ADD CONSTRAINT "ndis_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndis_plan_matches"
    ADD CONSTRAINT "ndis_plan_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_fees"
    ADD CONSTRAINT "order_fees_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_fees"
    ADD CONSTRAINT "order_fees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participant_support_profiles"
    ADD CONSTRAINT "participant_support_profiles_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."participant_support_profiles"
    ADD CONSTRAINT "participant_support_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_stripe_payout_id_key" UNIQUE ("stripe_payout_id");



ALTER TABLE ONLY "public"."phone_calls"
    ADD CONSTRAINT "phone_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_agent_scores"
    ADD CONSTRAINT "pipeline_agent_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_artifacts"
    ADD CONSTRAINT "pipeline_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_kill_switch"
    ADD CONSTRAINT "pipeline_kill_switch_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_policy"
    ADD CONSTRAINT "pipeline_policy_pkey" PRIMARY KEY ("surface");



ALTER TABLE ONLY "public"."pipeline_runs"
    ADD CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline_stage_events"
    ADD CONSTRAINT "pipeline_stage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pr_review_predictions"
    ADD CONSTRAINT "pr_review_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_recommendations"
    ADD CONSTRAINT "pricing_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_funnel_events"
    ADD CONSTRAINT "quote_funnel_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rego_cache"
    ADD CONSTRAINT "rego_cache_pkey" PRIMARY KEY ("rego", "state");



ALTER TABLE ONLY "public"."research_trends"
    ADD CONSTRAINT "research_trends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resilience_events"
    ADD CONSTRAINT "resilience_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviewer_calibration"
    ADD CONSTRAINT "reviewer_calibration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviewer_calibration"
    ADD CONSTRAINT "reviewer_calibration_system_area_key" UNIQUE ("system_area");



ALTER TABLE ONLY "public"."sandbox_agent_health"
    ADD CONSTRAINT "sandbox_agent_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_agent_responses"
    ADD CONSTRAINT "sandbox_agent_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_decision_scores"
    ADD CONSTRAINT "sandbox_decision_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_lessons_learned"
    ADD CONSTRAINT "sandbox_lessons_learned_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_policy"
    ADD CONSTRAINT "sandbox_policy_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."sandbox_run_batches"
    ADD CONSTRAINT "sandbox_run_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_scenarios"
    ADD CONSTRAINT "sandbox_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sandbox_scenarios"
    ADD CONSTRAINT "sandbox_scenarios_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sandbox_training_runs"
    ADD CONSTRAINT "sandbox_training_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_pricing"
    ADD CONSTRAINT "service_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_pricing"
    ADD CONSTRAINT "service_pricing_service_suburb_price_unit_effective_from_key" UNIQUE ("service", "suburb", "price_unit", "effective_from");



ALTER TABLE ONLY "public"."shift_segments"
    ADD CONSTRAINT "shift_segments_order_id_segment_number_key" UNIQUE ("order_id", "segment_number");



ALTER TABLE ONLY "public"."shift_segments"
    ADD CONSTRAINT "shift_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_feedback"
    ADD CONSTRAINT "site_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_impact_stats"
    ADD CONSTRAINT "site_impact_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."site_visitors"
    ADD CONSTRAINT "site_visitors_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."social_proof_items"
    ADD CONSTRAINT "social_proof_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_arcs"
    ADD CONSTRAINT "story_arcs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_bible_sections"
    ADD CONSTRAINT "story_bible_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_bible_sections"
    ADD CONSTRAINT "story_bible_sections_section_key_key" UNIQUE ("section_key");



ALTER TABLE ONLY "public"."story_chapters"
    ADD CONSTRAINT "story_chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_characters"
    ADD CONSTRAINT "story_characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_characters"
    ADD CONSTRAINT "story_characters_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."story_drafts"
    ADD CONSTRAINT "story_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_open_threads"
    ADD CONSTRAINT "story_open_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_opportunities"
    ADD CONSTRAINT "story_opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_reviews"
    ADD CONSTRAINT "story_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_disputes"
    ADD CONSTRAINT "stripe_disputes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_arrangements"
    ADD CONSTRAINT "transport_arrangements_order_id_employee_id_key" UNIQUE ("order_id", "employee_id");



ALTER TABLE ONLY "public"."transport_arrangements"
    ADD CONSTRAINT "transport_arrangements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicle_overrides"
    ADD CONSTRAINT "vehicle_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitor_events"
    ADD CONSTRAINT "visitor_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whs_records"
    ADD CONSTRAINT "whs_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_payouts"
    ADD CONSTRAINT "worker_payouts_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_opt_findings_automation" ON "public"."admin_optimization_findings" USING "btree" ("automation_candidate") WHERE ("automation_candidate" = true);



CREATE INDEX "admin_opt_findings_created" ON "public"."admin_optimization_findings" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_opt_findings_focus_area" ON "public"."admin_optimization_findings" USING "btree" ("focus_area");



CREATE INDEX "admin_opt_findings_friction" ON "public"."admin_optimization_findings" USING "btree" ("friction_band", "priority");



CREATE INDEX "admin_opt_findings_run_id" ON "public"."admin_optimization_findings" USING "btree" ("run_id");



CREATE INDEX "admin_opt_findings_status" ON "public"."admin_optimization_findings" USING "btree" ("status");



CREATE UNIQUE INDEX "agent_actions_one_pending_per_target" ON "public"."agent_actions" USING "btree" ("agent_id", "action_type", "target_table", "target_id") WHERE (("status" = 'pending'::"text") AND ("target_table" IS NOT NULL) AND ("target_id" IS NOT NULL));



CREATE UNIQUE INDEX "agent_actions_one_pending_root_cause_review" ON "public"."agent_actions" USING "btree" ("action_identity") WHERE (("status" = 'pending'::"text") AND ("action_identity" IS NOT NULL) AND ("action_type" = 'flag_for_review'::"text"));



CREATE INDEX "agent_guardrail_events_agent_id_created_at_idx" ON "public"."agent_guardrail_events" USING "btree" ("agent_id", "created_at" DESC);



CREATE INDEX "agent_guardrail_events_policy_id_idx" ON "public"."agent_guardrail_events" USING "btree" ("policy_id");



CREATE INDEX "agent_guardrail_events_run_id_idx" ON "public"."agent_guardrail_events" USING "btree" ("run_id");



CREATE INDEX "analytics_findings_category" ON "public"."analytics_findings" USING "btree" ("category", "status");



CREATE INDEX "analytics_findings_created" ON "public"."analytics_findings" USING "btree" ("created_at" DESC);



CREATE INDEX "analytics_findings_priority" ON "public"."analytics_findings" USING "btree" ("priority", "status");



CREATE INDEX "analytics_findings_report_id" ON "public"."analytics_findings" USING "btree" ("report_id");



CREATE INDEX "analytics_funnels_period" ON "public"."analytics_funnels" USING "btree" ("period_end" DESC, "funnel_name", "step_index");



CREATE INDEX "analytics_funnels_report_id" ON "public"."analytics_funnels" USING "btree" ("report_id");



CREATE INDEX "analytics_reports_created" ON "public"."analytics_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "analytics_reports_run_id" ON "public"."analytics_reports" USING "btree" ("run_id");



CREATE INDEX "audit_log_action_idx" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "audit_log_created_at_idx" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "audit_log_user_email_idx" ON "public"."audit_log" USING "btree" ("user_email");



CREATE INDEX "bud_activity_feed_created_at_idx" ON "public"."bud_activity_feed" USING "btree" ("created_at" DESC);



CREATE INDEX "bud_activity_feed_event_type_idx" ON "public"."bud_activity_feed" USING "btree" ("event_type");



CREATE INDEX "bud_approval_queue_archived_at_idx" ON "public"."bud_approval_queue" USING "btree" ("archived_at" DESC) WHERE ("status" = 'archived'::"text");



CREATE INDEX "bud_approval_queue_created_at_idx" ON "public"."bud_approval_queue" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "bud_approval_queue_one_pending_improvement_identity" ON "public"."bud_approval_queue" USING "btree" ("approval_identity") WHERE (("approval_identity" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE INDEX "bud_approval_queue_root_cause_idx" ON "public"."bud_approval_queue" USING "btree" ("root_cause_key", "status");



CREATE INDEX "bud_approval_queue_status_created_at_idx" ON "public"."bud_approval_queue" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "bud_approval_queue_status_idx" ON "public"."bud_approval_queue" USING "btree" ("status");



CREATE INDEX "bud_audit_logs_created_at_idx" ON "public"."bud_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "bud_deployment_verifications_execution_idx" ON "public"."bud_deployment_verifications" USING "btree" ("execution_id", "started_at" DESC);



CREATE INDEX "bud_evidence_created_idx" ON "public"."bud_evidence" USING "btree" ("created_at" DESC);



CREATE INDEX "bud_evidence_task_idx" ON "public"."bud_evidence" USING "btree" ("task_id") WHERE ("task_id" IS NOT NULL);



CREATE INDEX "bud_evidence_type_idx" ON "public"."bud_evidence" USING "btree" ("type");



CREATE INDEX "bud_improvement_learnings_embedding_idx" ON "public"."bud_improvement_learnings" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='50');



CREATE INDEX "bud_improvement_signals_fingerprint_idx" ON "public"."bud_improvement_signals" USING "btree" ("fingerprint");



CREATE UNIQUE INDEX "bud_improvement_signals_one_active_fingerprint" ON "public"."bud_improvement_signals" USING "btree" ("fingerprint") WHERE (("fingerprint" IS NOT NULL) AND ("status" = ANY (ARRAY['new'::"text", 'queued'::"text", 'executing'::"text"])));



CREATE INDEX "bud_improvement_signals_root_cause_idx" ON "public"."bud_improvement_signals" USING "btree" ("root_cause_key", "status");



CREATE INDEX "bud_improvements_created_idx" ON "public"."bud_improvements" USING "btree" ("created_at" DESC);



CREATE INDEX "bud_improvements_status_idx" ON "public"."bud_improvements" USING "btree" ("status");



CREATE INDEX "bud_insights_created_at_idx" ON "public"."bud_insights" USING "btree" ("created_at" DESC);



CREATE INDEX "bud_insights_severity_idx" ON "public"."bud_insights" USING "btree" ("severity");



CREATE UNIQUE INDEX "bud_lobby_states_current_idx" ON "public"."bud_lobby_states" USING "btree" ("is_current") WHERE ("is_current" = true);



CREATE INDEX "bud_lobby_states_generated_at_idx" ON "public"."bud_lobby_states" USING "btree" ("generated_at" DESC);



CREATE INDEX "bud_repair_executions_status_idx" ON "public"."bud_repair_executions" USING "btree" ("status");



CREATE INDEX "bud_repair_executions_task_idx" ON "public"."bud_repair_executions" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "bud_repair_learnings_root_cause_idx" ON "public"."bud_repair_learnings" USING "btree" ("root_cause_type", "created_at" DESC);



CREATE INDEX "bud_repair_logs_execution_idx" ON "public"."bud_repair_logs" USING "btree" ("execution_id", "created_at");



CREATE INDEX "bud_repair_quarantine_status_idx" ON "public"."bud_repair_quarantine" USING "btree" ("status", "blocked_until");



CREATE INDEX "bud_repair_steps_execution_idx" ON "public"."bud_repair_steps" USING "btree" ("execution_id", "started_at");



CREATE INDEX "bud_tasks_created_at_idx" ON "public"."bud_tasks" USING "btree" ("created_at" DESC);



CREATE INDEX "bud_tasks_status_idx" ON "public"."bud_tasks" USING "btree" ("status");



CREATE INDEX "bud_terminal_sessions_started_idx" ON "public"."bud_terminal_sessions" USING "btree" ("started_at" DESC);



CREATE UNIQUE INDEX "content_ideas_opportunity_id_unique" ON "public"."content_ideas" USING "btree" ("opportunity_id") WHERE ("opportunity_id" IS NOT NULL);



CREATE INDEX "design_audits_date" ON "public"."design_audits" USING "btree" ("audit_date" DESC);



CREATE INDEX "design_audits_run_id" ON "public"."design_audits" USING "btree" ("run_id");



CREATE INDEX "design_audits_score" ON "public"."design_audits" USING "btree" ("overall_score" DESC);



CREATE INDEX "design_violations_area" ON "public"."design_violations" USING "btree" ("area", "status");



CREATE INDEX "design_violations_audit_id" ON "public"."design_violations" USING "btree" ("audit_id");



CREATE INDEX "design_violations_created" ON "public"."design_violations" USING "btree" ("created_at" DESC);



CREATE INDEX "design_violations_priority" ON "public"."design_violations" USING "btree" ("priority", "status");



CREATE INDEX "dev_os_sessions_agents_idx" ON "public"."dev_os_sessions" USING "gin" ("agents_used");



CREATE INDEX "dev_os_sessions_created_idx" ON "public"."dev_os_sessions" USING "btree" ("created_at" DESC);



CREATE INDEX "efficiency_findings_created_at_idx" ON "public"."efficiency_findings" USING "btree" ("created_at" DESC);



CREATE INDEX "efficiency_findings_domain_idx" ON "public"."efficiency_findings" USING "btree" ("domain");



CREATE INDEX "efficiency_findings_severity_idx" ON "public"."efficiency_findings" USING "btree" ("severity", "priority");



CREATE INDEX "executive_agent_runs_meta_agent_id_idx" ON "public"."executive_agent_runs_meta" USING "btree" ("agent_id");



CREATE INDEX "executive_agent_runs_meta_created_at_idx" ON "public"."executive_agent_runs_meta" USING "btree" ("created_at" DESC);



CREATE INDEX "executive_decisions_agent_id_idx" ON "public"."executive_decisions" USING "btree" ("agent_id");



CREATE INDEX "executive_decisions_created_at_idx" ON "public"."executive_decisions" USING "btree" ("created_at" DESC);



CREATE INDEX "executive_decisions_status_idx" ON "public"."executive_decisions" USING "btree" ("status");



CREATE INDEX "executive_directives_status_idx" ON "public"."executive_directives" USING "btree" ("status");



CREATE INDEX "executive_metrics_snapshots_captured_at_idx" ON "public"."executive_metrics_snapshots" USING "btree" ("captured_at" DESC);



CREATE INDEX "executive_tasks_decision_id_idx" ON "public"."executive_tasks" USING "btree" ("decision_id");



CREATE INDEX "executive_tasks_status_idx" ON "public"."executive_tasks" USING "btree" ("status");



CREATE UNIQUE INDEX "executive_weekly_reviews_week_start_uidx" ON "public"."executive_weekly_reviews" USING "btree" ("week_start");



CREATE INDEX "foreman_insights_created_at_idx" ON "public"."foreman_insights" USING "btree" ("created_at" DESC);



CREATE INDEX "foreman_insights_severity_idx" ON "public"."foreman_insights" USING "btree" ("severity", "created_at" DESC);



CREATE UNIQUE INDEX "foreman_lobby_states_current_idx" ON "public"."foreman_lobby_states" USING "btree" ("is_current") WHERE ("is_current" = true);



CREATE INDEX "foreman_lobby_states_generated_at_idx" ON "public"."foreman_lobby_states" USING "btree" ("generated_at" DESC);



CREATE INDEX "github_events_adr_flags" ON "public"."github_events" USING "btree" ("event_type", "status") WHERE (("event_type" = 'adr_flag'::"text") AND ("status" = 'pending'::"text"));



CREATE INDEX "github_events_created" ON "public"."github_events" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "github_events_delivery_id" ON "public"."github_events" USING "btree" ("delivery_id");



CREATE INDEX "github_events_deploy_failures" ON "public"."github_events" USING "btree" ("event_type", "created_at" DESC) WHERE ("event_type" = 'deployment_failure'::"text");



CREATE INDEX "github_events_event_type" ON "public"."github_events" USING "btree" ("event_type", "status");



CREATE INDEX "growth_pipeline_events_journal" ON "public"."growth_pipeline_events" USING "btree" ("journal_entry_id");



CREATE INDEX "growth_pipeline_events_source" ON "public"."growth_pipeline_events" USING "btree" ("source_id");



CREATE INDEX "growth_pipeline_events_time" ON "public"."growth_pipeline_events" USING "btree" ("created_at" DESC);



CREATE INDEX "growth_pipeline_events_type" ON "public"."growth_pipeline_events" USING "btree" ("event_type");



CREATE INDEX "idx_admin_ux_proposals_page" ON "public"."admin_ux_proposals" USING "btree" ("page_path");



CREATE INDEX "idx_admin_ux_proposals_status" ON "public"."admin_ux_proposals" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text"]));



CREATE INDEX "idx_agent_actions_environment" ON "public"."agent_actions" USING "btree" ("environment");



CREATE UNIQUE INDEX "idx_agent_actions_identity_pending" ON "public"."agent_actions" USING "btree" ("action_identity") WHERE (("status" = 'pending'::"text") AND ("action_identity" IS NOT NULL));



CREATE INDEX "idx_agent_actions_run" ON "public"."agent_actions" USING "btree" ("run_id");



CREATE INDEX "idx_agent_actions_status" ON "public"."agent_actions" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE UNIQUE INDEX "idx_agent_alerts_action_id" ON "public"."agent_alerts" USING "btree" ("action_id") WHERE ("action_id" IS NOT NULL);



CREATE INDEX "idx_agent_alerts_agent_id" ON "public"."agent_alerts" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_alerts_created_at" ON "public"."agent_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agent_alerts_source_agent" ON "public"."agent_alerts" USING "btree" ("source_agent");



CREATE INDEX "idx_agent_alerts_status" ON "public"."agent_alerts" USING "btree" ("status");



CREATE INDEX "idx_agent_evolutions_pending" ON "public"."agent_evolutions" USING "btree" ("target_agent_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_agent_runs_agent_id_started" ON "public"."agent_runs" USING "btree" ("agent_id", "started_at" DESC);



CREATE INDEX "idx_agent_runs_embedding" ON "public"."agent_runs" USING "ivfflat" ("summary_embedding" "public"."vector_cosine_ops") WITH ("lists"='50');



CREATE INDEX "idx_agent_runs_environment" ON "public"."agent_runs" USING "btree" ("environment");



CREATE INDEX "idx_agent_runs_quality" ON "public"."agent_runs" USING "btree" ("agent_id", "quality_score") WHERE ("quality_score" IS NOT NULL);



CREATE INDEX "idx_agent_runs_status" ON "public"."agent_runs" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['running'::"text", 'needs_approval'::"text"]));



CREATE INDEX "idx_analytics_sessions_country" ON "public"."analytics_sessions" USING "btree" ("country");



CREATE INDEX "idx_analytics_sessions_environment" ON "public"."analytics_sessions" USING "btree" ("environment");



CREATE INDEX "idx_analytics_sessions_first_seen" ON "public"."analytics_sessions" USING "btree" ("first_seen_at" DESC);



CREATE INDEX "idx_analytics_sessions_utm_source" ON "public"."analytics_sessions" USING "btree" ("utm_source");



CREATE INDEX "idx_applicants_created_at" ON "public"."applicants" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_applicants_role" ON "public"."applicants" USING "btree" ("role");



CREATE INDEX "idx_applicants_stage" ON "public"."applicants" USING "btree" ("stage");



CREATE INDEX "idx_applicants_user_id" ON "public"."applicants" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_artifact_versions_artifact" ON "public"."artifact_versions" USING "btree" ("artifact_id");



CREATE INDEX "idx_artifact_versions_created_at" ON "public"."artifact_versions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_artifacts_created_at" ON "public"."artifacts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_artifacts_score" ON "public"."artifacts" USING "btree" ("score" DESC NULLS LAST);



CREATE INDEX "idx_artifacts_status" ON "public"."artifacts" USING "btree" ("status");



CREATE INDEX "idx_artifacts_type" ON "public"."artifacts" USING "btree" ("type");



CREATE INDEX "idx_bud_approval_queue_environment" ON "public"."bud_approval_queue" USING "btree" ("environment");



CREATE INDEX "idx_bud_browser_test_runs_execution_id" ON "public"."bud_browser_test_runs" USING "btree" ("execution_id") WHERE ("execution_id" IS NOT NULL);



CREATE INDEX "idx_bud_browser_test_runs_failed" ON "public"."bud_browser_test_runs" USING "btree" ("failed", "created_at" DESC) WHERE ("failed" > 0);



CREATE INDEX "idx_bud_improvement_signals_environment" ON "public"."bud_improvement_signals" USING "btree" ("environment");



CREATE INDEX "idx_bud_repair_executions_ci_conclusion" ON "public"."bud_repair_executions" USING "btree" ("ci_conclusion") WHERE ("ci_conclusion" IS NOT NULL);



CREATE INDEX "idx_bud_repair_executions_pr_url" ON "public"."bud_repair_executions" USING "btree" ("created_at" DESC) WHERE ("pr_url" IS NOT NULL);



CREATE INDEX "idx_bud_repair_executions_taste_pass" ON "public"."bud_repair_executions" USING "btree" ("taste_pass") WHERE ("taste_pass" IS NOT NULL);



CREATE INDEX "idx_bud_repair_learnings_embedding" ON "public"."bud_repair_learnings" USING "ivfflat" ("summary_embedding" "public"."vector_cosine_ops") WITH ("lists"='10');



CREATE INDEX "idx_bud_rollback_events_agent" ON "public"."bud_rollback_events" USING "btree" ("agent_id", "created_at" DESC);



CREATE INDEX "idx_bud_rollback_events_execution" ON "public"."bud_rollback_events" USING "btree" ("execution_id");



CREATE INDEX "idx_bud_rollback_events_trigger" ON "public"."bud_rollback_events" USING "btree" ("trigger", "created_at" DESC);



CREATE INDEX "idx_bud_root_cause_initiatives_environment" ON "public"."bud_root_cause_initiatives" USING "btree" ("environment");



CREATE INDEX "idx_campaign_factory_run_artifacts_artifact" ON "public"."campaign_factory_run_artifacts" USING "btree" ("artifact_id");



CREATE INDEX "idx_campaign_factory_runs_created_at" ON "public"."campaign_factory_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_campaign_factory_runs_goal" ON "public"."campaign_factory_runs" USING "btree" ("goal");



CREATE INDEX "idx_campaign_factory_runs_status" ON "public"."campaign_factory_runs" USING "btree" ("status");



CREATE INDEX "idx_campaign_factory_runs_story" ON "public"."campaign_factory_runs" USING "btree" ("selected_story_opportunity_id");



CREATE INDEX "idx_checklist_templates_service" ON "public"."checklist_templates" USING "btree" ("service_type");



CREATE INDEX "idx_client_agreements_order" ON "public"."client_agreements" USING "btree" ("order_id");



CREATE INDEX "idx_client_agreements_quote" ON "public"."client_agreements" USING "btree" ("quote_id");



CREATE INDEX "idx_competitor_intel_service_suburb" ON "public"."competitor_intel" USING "btree" ("service", "suburb");



CREATE INDEX "idx_content_assets_consent" ON "public"."content_assets" USING "btree" ("consent_status");



CREATE INDEX "idx_content_assets_idea" ON "public"."content_assets" USING "btree" ("idea_id");



CREATE INDEX "idx_content_assets_production" ON "public"."content_assets" USING "btree" ("production_card_id");



CREATE INDEX "idx_content_assets_script" ON "public"."content_assets" USING "btree" ("script_id");



CREATE INDEX "idx_content_assets_type" ON "public"."content_assets" USING "btree" ("asset_type");



CREATE INDEX "idx_content_ideas_arc" ON "public"."content_ideas" USING "btree" ("related_arc_id");



CREATE INDEX "idx_content_ideas_opportunity" ON "public"."content_ideas" USING "btree" ("opportunity_id");



CREATE INDEX "idx_content_ideas_priority" ON "public"."content_ideas" USING "btree" ("priority");



CREATE INDEX "idx_content_ideas_status" ON "public"."content_ideas" USING "btree" ("status");



CREATE INDEX "idx_content_learning_records_artifact" ON "public"."content_learning_records" USING "btree" ("learning_artifact_id");



CREATE INDEX "idx_content_learning_records_campaign" ON "public"."content_learning_records" USING "btree" ("campaign_id");



CREATE INDEX "idx_content_learning_records_created_at" ON "public"."content_learning_records" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_learning_records_goal" ON "public"."content_learning_records" USING "btree" ("goal");



CREATE INDEX "idx_content_learning_records_run" ON "public"."content_learning_records" USING "btree" ("campaign_factory_run_id");



CREATE INDEX "idx_content_learning_records_source_artifacts" ON "public"."content_learning_records" USING "gin" ("source_artifact_ids");



CREATE INDEX "idx_content_learning_records_status" ON "public"."content_learning_records" USING "btree" ("status");



CREATE INDEX "idx_content_library_items_artifact" ON "public"."content_library_items" USING "btree" ("artifact_id");



CREATE INDEX "idx_content_library_items_campaign" ON "public"."content_library_items" USING "btree" ("campaign_id");



CREATE INDEX "idx_content_library_items_created_at" ON "public"."content_library_items" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_library_items_platform" ON "public"."content_library_items" USING "btree" ("platform");



CREATE INDEX "idx_content_library_items_search" ON "public"."content_library_items" USING "gin" ("to_tsvector"('"english"'::"regconfig", "searchable_text"));



CREATE INDEX "idx_content_library_items_status" ON "public"."content_library_items" USING "btree" ("status");



CREATE INDEX "idx_content_library_items_tags" ON "public"."content_library_items" USING "gin" ("tags");



CREATE INDEX "idx_content_library_items_type" ON "public"."content_library_items" USING "btree" ("item_type");



CREATE INDEX "idx_content_production_cards_arc" ON "public"."content_production_cards" USING "btree" ("related_arc_id");



CREATE INDEX "idx_content_production_cards_deadline" ON "public"."content_production_cards" USING "btree" ("deadline");



CREATE INDEX "idx_content_production_cards_script" ON "public"."content_production_cards" USING "btree" ("script_id");



CREATE INDEX "idx_content_production_cards_status" ON "public"."content_production_cards" USING "btree" ("status");



CREATE INDEX "idx_content_scripts_created" ON "public"."content_scripts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_scripts_idea" ON "public"."content_scripts" USING "btree" ("idea_id");



CREATE INDEX "idx_content_scripts_status" ON "public"."content_scripts" USING "btree" ("status");



CREATE INDEX "idx_conversations_entity" ON "public"."conversations" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_conversations_environment" ON "public"."conversations" USING "btree" ("environment");



CREATE INDEX "idx_conversations_status" ON "public"."conversations" USING "btree" ("status");



CREATE INDEX "idx_customers_email" ON "public"."customers" USING "btree" ("email");



CREATE INDEX "idx_customers_environment" ON "public"."customers" USING "btree" ("environment");



CREATE INDEX "idx_customers_is_test" ON "public"."customers" USING "btree" ("is_test") WHERE ("is_test" = true);



CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("phone");



CREATE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");



CREATE INDEX "idx_design_insights_page" ON "public"."design_insights" USING "btree" ("page_path");



CREATE INDEX "idx_design_insights_status" ON "public"."design_insights" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['new'::"text", 'reviewing'::"text"]));



CREATE INDEX "idx_employee_documents_employee" ON "public"."employee_documents" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_onboarding_employee" ON "public"."employee_onboarding" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_payroll_employee" ON "public"."employee_payroll_details" USING "btree" ("employee_id");



CREATE INDEX "idx_employees_status" ON "public"."employees" USING "btree" ("status");



CREATE INDEX "idx_employees_user_id" ON "public"."employees" USING "btree" ("user_id");



CREATE INDEX "idx_employment_contracts_employee" ON "public"."employment_contracts" USING "btree" ("employee_id");



CREATE INDEX "idx_employment_contracts_status" ON "public"."employment_contracts" USING "btree" ("status");



CREATE INDEX "idx_fundraising_contributions_item_status" ON "public"."fundraising_contributions" USING "btree" ("fundraising_item_id", "status");



CREATE UNIQUE INDEX "idx_fundraising_contributions_payment_reference" ON "public"."fundraising_contributions" USING "btree" ("payment_provider", "payment_reference") WHERE ("payment_reference" IS NOT NULL);



CREATE UNIQUE INDEX "idx_fundraising_contributions_stripe_event" ON "public"."fundraising_contributions" USING "btree" ("stripe_event_id") WHERE ("stripe_event_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_fundraising_items_slug" ON "public"."fundraising_items" USING "btree" ("slug");



CREATE INDEX "idx_fundraising_items_status_sort" ON "public"."fundraising_items" USING "btree" ("status", "sort_order");



CREATE INDEX "idx_job_assignments_employee" ON "public"."job_assignments" USING "btree" ("employee_id");



CREATE INDEX "idx_job_assignments_order" ON "public"."job_assignments" USING "btree" ("order_id");



CREATE INDEX "idx_job_assignments_status" ON "public"."job_assignments" USING "btree" ("status");



CREATE INDEX "idx_job_completions_assignment" ON "public"."job_completions" USING "btree" ("assignment_id");



CREATE INDEX "idx_job_photos_job" ON "public"."job_photos" USING "btree" ("job_id");



CREATE INDEX "idx_job_photos_qa_pending" ON "public"."job_photos" USING "btree" ("uploaded_at") WHERE ("qa_score" IS NULL);



CREATE INDEX "idx_job_variations_order" ON "public"."job_variations" USING "btree" ("order_id");



CREATE INDEX "idx_journal_entries_date" ON "public"."founder_journal_entries" USING "btree" ("entry_date" DESC);



CREATE UNIQUE INDEX "idx_journal_entries_date_unique" ON "public"."founder_journal_entries" USING "btree" ("entry_date");



CREATE INDEX "idx_journal_entries_rating" ON "public"."founder_journal_entries" USING "btree" ("content_potential_rating");



CREATE INDEX "idx_journal_entries_tags" ON "public"."founder_journal_entries" USING "gin" ("tags");



CREATE INDEX "idx_jp_employee" ON "public"."job_publications" USING "btree" ("employee_id");



CREATE INDEX "idx_jp_order" ON "public"."job_publications" USING "btree" ("order_id");



CREATE INDEX "idx_jp_status" ON "public"."job_publications" USING "btree" ("status");



CREATE INDEX "idx_jpm_employee" ON "public"."job_participant_matches" USING "btree" ("employee_id");



CREATE INDEX "idx_jpm_order" ON "public"."job_participant_matches" USING "btree" ("order_id");



CREATE INDEX "idx_jr_matching" ON "public"."job_requirements" USING "btree" ("ndis_matching_enabled") WHERE ("ndis_matching_enabled" = true);



CREATE INDEX "idx_jr_order" ON "public"."job_requirements" USING "btree" ("order_id");



CREATE INDEX "idx_lead_conversations_channel" ON "public"."lead_conversations" USING "btree" ("channel", "created_at" DESC);



CREATE INDEX "idx_lead_conversations_environment" ON "public"."lead_conversations" USING "btree" ("environment");



CREATE INDEX "idx_lead_conversations_lead_direction" ON "public"."lead_conversations" USING "btree" ("lead_id", "direction");



CREATE INDEX "idx_lead_conversations_lead_id_created" ON "public"."lead_conversations" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_lead_follow_ups_due" ON "public"."lead_follow_ups" USING "btree" ("status", "due_at");



CREATE INDEX "idx_lead_follow_ups_lead" ON "public"."lead_follow_ups" USING "btree" ("lead_id", "status");



CREATE INDEX "idx_lead_response_metrics_day" ON "public"."lead_response_metrics" USING "btree" ("metric_day" DESC);



CREATE INDEX "idx_lead_suburb_analytics_day" ON "public"."lead_suburb_analytics" USING "btree" ("metric_day" DESC);



CREATE INDEX "idx_lead_suburb_analytics_suburb" ON "public"."lead_suburb_analytics" USING "btree" ("suburb", "metric_day" DESC);



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_environment" ON "public"."leads" USING "btree" ("environment");



CREATE INDEX "idx_leads_is_test" ON "public"."leads" USING "btree" ("is_test") WHERE ("is_test" = true);



CREATE INDEX "idx_leads_open" ON "public"."leads" USING "btree" ("created_at" DESC) WHERE ("response_status" <> ALL (ARRAY['lost'::"text", 'completed'::"text"]));



CREATE INDEX "idx_leads_response_status" ON "public"."leads" USING "btree" ("response_status");



CREATE INDEX "idx_leads_source" ON "public"."leads" USING "btree" ("source");



CREATE UNIQUE INDEX "idx_leads_source_external_ref" ON "public"."leads" USING "btree" ("source", "external_ref") WHERE ("external_ref" IS NOT NULL);



CREATE INDEX "idx_leads_suburb" ON "public"."leads" USING "btree" ("suburb");



CREATE INDEX "idx_leads_temperature" ON "public"."leads" USING "btree" ("temperature");



CREATE INDEX "idx_marketing_campaign_queue_items_queue" ON "public"."marketing_campaign_queue_items" USING "btree" ("queue_item_id");



CREATE INDEX "idx_marketing_campaigns_arc" ON "public"."marketing_campaigns" USING "btree" ("related_arc_id");



CREATE INDEX "idx_marketing_campaigns_dates" ON "public"."marketing_campaigns" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_marketing_campaigns_status" ON "public"."marketing_campaigns" USING "btree" ("status");



CREATE INDEX "idx_marketing_distribution_playbooks_campaign" ON "public"."marketing_distribution_playbooks" USING "btree" ("linked_campaign_id");



CREATE INDEX "idx_marketing_distribution_playbooks_platform" ON "public"."marketing_distribution_playbooks" USING "btree" ("primary_platform");



CREATE INDEX "idx_marketing_distribution_playbooks_status" ON "public"."marketing_distribution_playbooks" USING "btree" ("status");



CREATE INDEX "idx_marketing_metrics_date" ON "public"."marketing_metrics" USING "btree" ("snapshot_date" DESC);



CREATE INDEX "idx_marketing_publishing_queue_arc" ON "public"."marketing_publishing_queue" USING "btree" ("related_arc_id");



CREATE INDEX "idx_marketing_publishing_queue_platform" ON "public"."marketing_publishing_queue" USING "btree" ("platform");



CREATE INDEX "idx_marketing_publishing_queue_production" ON "public"."marketing_publishing_queue" USING "btree" ("production_card_id");



CREATE INDEX "idx_marketing_publishing_queue_status" ON "public"."marketing_publishing_queue" USING "btree" ("status");



CREATE INDEX "idx_marketing_publishing_queue_target" ON "public"."marketing_publishing_queue" USING "btree" ("target_publish_at");



CREATE INDEX "idx_marketing_social_channels_platform" ON "public"."marketing_social_channels" USING "btree" ("platform");



CREATE INDEX "idx_marketing_social_channels_status" ON "public"."marketing_social_channels" USING "btree" ("status");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_messages_environment" ON "public"."messages" USING "btree" ("environment");



CREATE INDEX "idx_ndis_orgs_status" ON "public"."ndis_organisations" USING "btree" ("subscription_status");



CREATE INDEX "idx_ndis_orgs_stripe" ON "public"."ndis_organisations" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_ndis_parts_email" ON "public"."ndis_participants" USING "btree" ("email");



CREATE INDEX "idx_ndis_parts_org" ON "public"."ndis_participants" USING "btree" ("organisation_id");



CREATE INDEX "idx_ndis_parts_token" ON "public"."ndis_participants" USING "btree" ("invite_token") WHERE ("invite_token" IS NOT NULL);



CREATE INDEX "idx_ndis_parts_user" ON "public"."ndis_participants" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_order_fees_order" ON "public"."order_fees" USING "btree" ("order_id");



CREATE INDEX "idx_orders_assigned_employee" ON "public"."orders" USING "btree" ("assigned_employee_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_customer_id" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "idx_orders_environment" ON "public"."orders" USING "btree" ("environment");



CREATE INDEX "idx_orders_is_test" ON "public"."orders" USING "btree" ("is_test") WHERE ("is_test" = true);



CREATE INDEX "idx_orders_scheduled_date" ON "public"."orders" USING "btree" ("scheduled_date");



CREATE INDEX "idx_orders_service_type" ON "public"."orders" USING "btree" ("service_type");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_stripe_pi" ON "public"."orders" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "idx_orders_stripe_session" ON "public"."orders" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "idx_page_views_page" ON "public"."page_views" USING "btree" ("page");



CREATE INDEX "idx_page_views_session_id" ON "public"."page_views" USING "btree" ("session_id");



CREATE INDEX "idx_page_views_viewed_at" ON "public"."page_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_payables_active" ON "public"."payables" USING "btree" ("id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_payables_due_date" ON "public"."payables" USING "btree" ("due_date");



CREATE INDEX "idx_payables_order_id" ON "public"."payables" USING "btree" ("order_id");



CREATE INDEX "idx_payables_status" ON "public"."payables" USING "btree" ("status");



CREATE INDEX "idx_payables_subscription_id" ON "public"."payables" USING "btree" ("subscription_id");



CREATE INDEX "idx_payables_vendor_id" ON "public"."payables" USING "btree" ("vendor_id");



CREATE INDEX "idx_payouts_arrival_date" ON "public"."payouts" USING "btree" ("arrival_date");



CREATE INDEX "idx_payouts_created_at" ON "public"."payouts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_payouts_status" ON "public"."payouts" USING "btree" ("status");



CREATE INDEX "idx_phone_calls_unprocessed" ON "public"."phone_calls" USING "btree" ("created_at") WHERE ("agent_processed_at" IS NULL);



CREATE INDEX "idx_pr_review_predictions_check_status" ON "public"."pr_review_predictions" USING "btree" ("check_status");



CREATE INDEX "idx_pr_review_predictions_created_at" ON "public"."pr_review_predictions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pr_review_predictions_pr_number" ON "public"."pr_review_predictions" USING "btree" ("pr_number");



CREATE INDEX "idx_pricing_recs_service_suburb" ON "public"."pricing_recommendations" USING "btree" ("service", "suburb", "created_at" DESC);



CREATE INDEX "idx_pricing_recs_status" ON "public"."pricing_recommendations" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'approved'::"text"]));



CREATE INDEX "idx_profiles_organisation_id" ON "public"."profiles" USING "btree" ("organisation_id") WHERE ("organisation_id" IS NOT NULL);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_psp_employee" ON "public"."participant_support_profiles" USING "btree" ("employee_id");



CREATE INDEX "idx_quotes_created_at" ON "public"."quotes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_quotes_environment" ON "public"."quotes" USING "btree" ("environment");



CREATE INDEX "idx_quotes_is_test" ON "public"."quotes" USING "btree" ("is_test") WHERE ("is_test" = true);



CREATE INDEX "idx_quotes_source" ON "public"."quotes" USING "btree" ("source");



CREATE INDEX "idx_ratings_environment" ON "public"."ratings" USING "btree" ("environment");



CREATE INDEX "idx_ratings_is_test" ON "public"."ratings" USING "btree" ("is_test") WHERE ("is_test" = true);



CREATE INDEX "idx_research_trends_adaptation_score" ON "public"."research_trends" USING "btree" ("adaptation_score" DESC NULLS LAST);



CREATE INDEX "idx_research_trends_created_at" ON "public"."research_trends" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_research_trends_platform" ON "public"."research_trends" USING "btree" ("platform");



CREATE INDEX "idx_research_trends_status" ON "public"."research_trends" USING "btree" ("status");



CREATE INDEX "idx_research_trends_trend_type" ON "public"."research_trends" USING "btree" ("trend_type");



CREATE INDEX "idx_research_trends_urgency" ON "public"."research_trends" USING "btree" ("urgency");



CREATE INDEX "idx_sandbox_agent_health_agent" ON "public"."sandbox_agent_health" USING "btree" ("agent_id", "computed_at" DESC);



CREATE INDEX "idx_sandbox_agent_responses_agent" ON "public"."sandbox_agent_responses" USING "btree" ("agent_id");



CREATE INDEX "idx_sandbox_agent_responses_env" ON "public"."sandbox_agent_responses" USING "btree" ("environment");



CREATE INDEX "idx_sandbox_agent_responses_scenario" ON "public"."sandbox_agent_responses" USING "btree" ("scenario_id");



CREATE INDEX "idx_sandbox_decision_scores_agent" ON "public"."sandbox_decision_scores" USING "btree" ("agent_id");



CREATE INDEX "idx_sandbox_decision_scores_env" ON "public"."sandbox_decision_scores" USING "btree" ("environment");



CREATE INDEX "idx_sandbox_decision_scores_scenario" ON "public"."sandbox_decision_scores" USING "btree" ("scenario_id");



CREATE INDEX "idx_sandbox_lessons_agent" ON "public"."sandbox_lessons_learned" USING "btree" ("agent_id");



CREATE INDEX "idx_sandbox_lessons_env" ON "public"."sandbox_lessons_learned" USING "btree" ("environment");



CREATE INDEX "idx_sandbox_lessons_env_agent" ON "public"."sandbox_lessons_learned" USING "btree" ("environment", "agent_id");



CREATE INDEX "idx_sandbox_run_batches_agent" ON "public"."sandbox_run_batches" USING "btree" ("agent_id", "started_at" DESC);



CREATE INDEX "idx_sandbox_scenarios_agent_id" ON "public"."sandbox_scenarios" USING "btree" ("agent_id");



CREATE INDEX "idx_sandbox_scenarios_category" ON "public"."sandbox_scenarios" USING "btree" ("category");



CREATE INDEX "idx_sandbox_scenarios_environment" ON "public"."sandbox_scenarios" USING "btree" ("environment");



CREATE INDEX "idx_sandbox_training_runs_batch" ON "public"."sandbox_training_runs" USING "btree" ("batch_id");



CREATE INDEX "idx_sandbox_training_runs_env" ON "public"."sandbox_training_runs" USING "btree" ("environment");



CREATE INDEX "idx_sandbox_training_runs_scenario" ON "public"."sandbox_training_runs" USING "btree" ("scenario_id");



CREATE INDEX "idx_sandbox_training_runs_status" ON "public"."sandbox_training_runs" USING "btree" ("status");



CREATE INDEX "idx_service_pricing_service_suburb" ON "public"."service_pricing" USING "btree" ("service", "suburb");



CREATE INDEX "idx_site_feedback_created_at" ON "public"."site_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_site_feedback_status" ON "public"."site_feedback" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_site_impact_stats_singleton" ON "public"."site_impact_stats" USING "btree" ((true));



CREATE INDEX "idx_site_visitors_last_seen" ON "public"."site_visitors" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_social_proof_items_status_sort" ON "public"."social_proof_items" USING "btree" ("status", "sort_order");



CREATE INDEX "idx_ss_order" ON "public"."shift_segments" USING "btree" ("order_id");



CREATE INDEX "idx_story_arcs_priority" ON "public"."story_arcs" USING "btree" ("priority");



CREATE INDEX "idx_story_arcs_status" ON "public"."story_arcs" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_story_chapters_one_active" ON "public"."story_chapters" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_story_drafts_opp" ON "public"."story_drafts" USING "btree" ("opportunity_id");



CREATE INDEX "idx_story_drafts_status" ON "public"."story_drafts" USING "btree" ("status");



CREATE INDEX "idx_story_opps_arc" ON "public"."story_opportunities" USING "btree" ("related_arc_id");



CREATE INDEX "idx_story_opps_score" ON "public"."story_opportunities" USING "btree" ("story_score" DESC NULLS LAST);



CREATE INDEX "idx_story_opps_section" ON "public"."story_opportunities" USING "btree" ("section");



CREATE UNIQUE INDEX "idx_story_opps_source_hash" ON "public"."story_opportunities" USING "btree" ("source_hash") WHERE ("source_hash" IS NOT NULL);



CREATE INDEX "idx_story_opps_status" ON "public"."story_opportunities" USING "btree" ("status");



CREATE INDEX "idx_story_reviews_draft" ON "public"."story_reviews" USING "btree" ("draft_id");



CREATE INDEX "idx_story_reviews_status" ON "public"."story_reviews" USING "btree" ("review_status");



CREATE INDEX "idx_story_threads_arc" ON "public"."story_open_threads" USING "btree" ("related_arc_id");



CREATE INDEX "idx_story_threads_status" ON "public"."story_open_threads" USING "btree" ("status");



CREATE INDEX "idx_subscription_orders_order_id" ON "public"."subscription_orders" USING "btree" ("order_id");



CREATE INDEX "idx_subscription_orders_subscription_id" ON "public"."subscription_orders" USING "btree" ("subscription_id");



CREATE INDEX "idx_subscriptions_customer_id" ON "public"."subscriptions" USING "btree" ("customer_id");



CREATE INDEX "idx_subscriptions_frequency" ON "public"."subscriptions" USING "btree" ("frequency");



CREATE INDEX "idx_subscriptions_next_service_date" ON "public"."subscriptions" USING "btree" ("next_service_date");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_ta_employee" ON "public"."transport_arrangements" USING "btree" ("employee_id");



CREATE INDEX "idx_ta_order" ON "public"."transport_arrangements" USING "btree" ("order_id");



CREATE INDEX "idx_visitor_events_created_at" ON "public"."visitor_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_visitor_events_environment" ON "public"."visitor_events" USING "btree" ("environment");



CREATE INDEX "idx_visitor_events_name" ON "public"."visitor_events" USING "btree" ("event_name");



CREATE INDEX "idx_visitor_events_name_created_at" ON "public"."visitor_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_visitor_events_order_id" ON "public"."visitor_events" USING "btree" ("order_id");



CREATE INDEX "idx_visitor_events_payment_id" ON "public"."visitor_events" USING "btree" ("payment_id");



CREATE INDEX "idx_visitor_events_quote_id" ON "public"."visitor_events" USING "btree" ("quote_id");



CREATE INDEX "idx_visitor_events_session_id" ON "public"."visitor_events" USING "btree" ("session_id");



CREATE INDEX "idx_visitor_events_source" ON "public"."visitor_events" USING "btree" ("source");



CREATE INDEX "idx_whs_records_expiry" ON "public"."whs_records" USING "btree" ("expires_at");



CREATE INDEX "idx_worker_payouts_employee" ON "public"."worker_payouts" USING "btree" ("employee_id") WHERE ("employee_id" IS NOT NULL);



CREATE INDEX "idx_worker_payouts_order" ON "public"."worker_payouts" USING "btree" ("order_id");



CREATE INDEX "idx_worker_payouts_participant" ON "public"."worker_payouts" USING "btree" ("participant_id") WHERE ("participant_id" IS NOT NULL);



CREATE INDEX "idx_worker_payouts_status" ON "public"."worker_payouts" USING "btree" ("status");



CREATE INDEX "lead_conversations_external_sender_id_idx" ON "public"."lead_conversations" USING "btree" ("external_sender_id") WHERE ("external_sender_id" IS NOT NULL);



CREATE INDEX "leads_instagram_user_id_idx" ON "public"."leads" USING "btree" ("instagram_user_id") WHERE ("instagram_user_id" IS NOT NULL);



CREATE INDEX "leads_messenger_psid_idx" ON "public"."leads" USING "btree" ("messenger_psid") WHERE ("messenger_psid" IS NOT NULL);



CREATE INDEX "leads_reply_channel_idx" ON "public"."leads" USING "btree" ("reply_channel") WHERE ("reply_channel" IS NOT NULL);



CREATE UNIQUE INDEX "marketing_publishing_queue_card_unique" ON "public"."marketing_publishing_queue" USING "btree" ("production_card_id") WHERE ("production_card_id" IS NOT NULL);



CREATE INDEX "memory_documents_agent_scope_idx" ON "public"."memory_documents" USING "btree" ("agent_scope");



CREATE INDEX "memory_documents_category_idx" ON "public"."memory_documents" USING "btree" ("category");



CREATE INDEX "memory_documents_embedding_idx" ON "public"."memory_documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='50');



CREATE INDEX "memory_documents_freshness_idx" ON "public"."memory_documents" USING "btree" ("freshness_score" DESC);



CREATE INDEX "memory_documents_status_idx" ON "public"."memory_documents" USING "btree" ("status");



CREATE INDEX "memory_documents_tags_idx" ON "public"."memory_documents" USING "gin" ("tags");



CREATE INDEX "memory_documents_updated_at_idx" ON "public"."memory_documents" USING "btree" ("updated_at" DESC);



CREATE INDEX "memory_edges_any_node_idx" ON "public"."memory_edges" USING "btree" ("source_id", "target_id");



CREATE INDEX "memory_edges_relationship_idx" ON "public"."memory_edges" USING "btree" ("relationship");



CREATE INDEX "memory_edges_source_idx" ON "public"."memory_edges" USING "btree" ("source_id");



CREATE INDEX "memory_edges_strength_idx" ON "public"."memory_edges" USING "btree" ("strength" DESC);



CREATE INDEX "memory_edges_target_idx" ON "public"."memory_edges" USING "btree" ("target_id");



CREATE INDEX "memory_graph_extractions_keywords_idx" ON "public"."memory_graph_extractions" USING "gin" ("keywords");



CREATE INDEX "memory_graph_extractions_systems_idx" ON "public"."memory_graph_extractions" USING "gin" ("systems_mentioned");



CREATE INDEX "memory_read_log_agent_idx" ON "public"."memory_read_log" USING "btree" ("agent_id", "read_at" DESC);



CREATE INDEX "memory_read_log_document_idx" ON "public"."memory_read_log" USING "btree" ("document_id", "read_at" DESC);



CREATE INDEX "orders_analytics_session_id_idx" ON "public"."orders" USING "btree" ("analytics_session_id");



CREATE INDEX "orders_assigned_crew_id_idx" ON "public"."orders" USING "btree" ("assigned_crew_id");



CREATE INDEX "orders_scheduled_date_crew_idx" ON "public"."orders" USING "btree" ("scheduled_date", "assigned_crew_id");



CREATE INDEX "orders_status_updated_at_idx" ON "public"."orders" USING "btree" ("status", "status_updated_at") WHERE ("status" = 'in_progress'::"text");



CREATE INDEX "pipeline_agent_scores_run_idx" ON "public"."pipeline_agent_scores" USING "btree" ("run_id");



CREATE INDEX "pipeline_artifacts_run_idx" ON "public"."pipeline_artifacts" USING "btree" ("run_id", "created_at");



CREATE INDEX "pipeline_runs_status_idx" ON "public"."pipeline_runs" USING "btree" ("status");



CREATE INDEX "pipeline_runs_surface_started_at_idx" ON "public"."pipeline_runs" USING "btree" ("surface", "started_at" DESC);



CREATE INDEX "pipeline_stage_events_run_ts_idx" ON "public"."pipeline_stage_events" USING "btree" ("run_id", "ts");



CREATE INDEX "quote_funnel_events_created_idx" ON "public"."quote_funnel_events" USING "btree" ("created_at" DESC);



CREATE INDEX "quote_funnel_events_event_idx" ON "public"."quote_funnel_events" USING "btree" ("event_name");



CREATE INDEX "quote_funnel_events_service_idx" ON "public"."quote_funnel_events" USING "btree" ("service");



CREATE INDEX "quote_funnel_events_session_idx" ON "public"."quote_funnel_events" USING "btree" ("session_id");



CREATE INDEX "quotes_analytics_session_id_idx" ON "public"."quotes" USING "btree" ("analytics_session_id");



CREATE INDEX "quotes_cancelled_at_idx" ON "public"."quotes" USING "btree" ("cancelled_at" DESC);



CREATE INDEX "quotes_created_at_idx" ON "public"."quotes" USING "btree" ("created_at" DESC);



CREATE INDEX "quotes_customer_id_idx" ON "public"."quotes" USING "btree" ("customer_id");



CREATE INDEX "quotes_ndis_forwarded_at_idx" ON "public"."quotes" USING "btree" ("ndis_forwarded_at" DESC) WHERE ("ndis_forwarded_at" IS NOT NULL);



CREATE INDEX "quotes_ndis_management_type_idx" ON "public"."quotes" USING "btree" ("ndis_management_type") WHERE ("ndis_management_type" IS NOT NULL);



CREATE INDEX "quotes_payment_status_idx" ON "public"."quotes" USING "btree" ("payment_status");



CREATE INDEX "quotes_status_idx" ON "public"."quotes" USING "btree" ("status");



CREATE INDEX "quotes_status_payment_idx" ON "public"."quotes" USING "btree" ("status", "payment_status");



CREATE UNIQUE INDEX "ratings_order_id_idx" ON "public"."ratings" USING "btree" ("order_id");



CREATE INDEX "rego_cache_expires_idx" ON "public"."rego_cache" USING "btree" ("expires_at");



CREATE INDEX "resilience_events_created_at_idx" ON "public"."resilience_events" USING "btree" ("created_at" DESC);



CREATE INDEX "resilience_events_guard_idx" ON "public"."resilience_events" USING "btree" ("guard", "created_at" DESC);



CREATE INDEX "vehicle_overrides_make_idx" ON "public"."vehicle_overrides" USING "btree" ("make");



CREATE UNIQUE INDEX "vehicle_overrides_make_model_unique" ON "public"."vehicle_overrides" USING "btree" ("make", "model_pattern");



CREATE OR REPLACE TRIGGER "admin_opt_findings_updated_at" BEFORE UPDATE ON "public"."admin_optimization_findings" FOR EACH ROW EXECUTE FUNCTION "public"."admin_opt_set_updated_at"();



CREATE OR REPLACE TRIGGER "memory_documents_updated_at" BEFORE UPDATE ON "public"."memory_documents" FOR EACH ROW EXECUTE FUNCTION "public"."touch_memory_document"();



CREATE OR REPLACE TRIGGER "set_artifacts_updated_at" BEFORE UPDATE ON "public"."artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_artifacts_updated_at"();



CREATE OR REPLACE TRIGGER "set_campaign_factory_runs_updated_at" BEFORE UPDATE ON "public"."campaign_factory_runs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_campaign_factory_runs_updated_at"();



CREATE OR REPLACE TRIGGER "set_content_assets_updated_at" BEFORE UPDATE ON "public"."content_assets" FOR EACH ROW EXECUTE FUNCTION "public"."handle_content_assets_updated_at"();



CREATE OR REPLACE TRIGGER "set_content_ideas_updated_at" BEFORE UPDATE ON "public"."content_ideas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_content_ideas_updated_at"();



CREATE OR REPLACE TRIGGER "set_content_learning_records_updated_at" BEFORE UPDATE ON "public"."content_learning_records" FOR EACH ROW EXECUTE FUNCTION "public"."handle_content_learning_records_updated_at"();



CREATE OR REPLACE TRIGGER "set_content_library_items_updated_at" BEFORE UPDATE ON "public"."content_library_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_content_library_items_updated_at"();



CREATE OR REPLACE TRIGGER "set_content_production_cards_updated_at" BEFORE UPDATE ON "public"."content_production_cards" FOR EACH ROW EXECUTE FUNCTION "public"."handle_content_production_cards_updated_at"();



CREATE OR REPLACE TRIGGER "set_content_scripts_updated_at" BEFORE UPDATE ON "public"."content_scripts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_content_scripts_updated_at"();



CREATE OR REPLACE TRIGGER "set_founder_journal_entries_updated_at" BEFORE UPDATE ON "public"."founder_journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."handle_journal_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketing_campaigns_updated_at" BEFORE UPDATE ON "public"."marketing_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."handle_marketing_campaigns_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketing_distribution_playbooks_updated_at" BEFORE UPDATE ON "public"."marketing_distribution_playbooks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_marketing_distribution_playbooks_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketing_publishing_queue_updated_at" BEFORE UPDATE ON "public"."marketing_publishing_queue" FOR EACH ROW EXECUTE FUNCTION "public"."handle_marketing_publishing_queue_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketing_social_channels_updated_at" BEFORE UPDATE ON "public"."marketing_social_channels" FOR EACH ROW EXECUTE FUNCTION "public"."handle_marketing_social_channels_updated_at"();



CREATE OR REPLACE TRIGGER "set_research_trends_updated_at" BEFORE UPDATE ON "public"."research_trends" FOR EACH ROW EXECUTE FUNCTION "public"."handle_research_trends_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_arcs_updated_at" BEFORE UPDATE ON "public"."story_arcs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_arcs_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_bible_sections_updated_at" BEFORE UPDATE ON "public"."story_bible_sections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_bible_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_chapters_updated_at" BEFORE UPDATE ON "public"."story_chapters" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_chapters_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_characters_updated_at" BEFORE UPDATE ON "public"."story_characters" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_characters_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_drafts_updated_at" BEFORE UPDATE ON "public"."story_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_drafts_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_open_threads_updated_at" BEFORE UPDATE ON "public"."story_open_threads" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_threads_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_opportunities_updated_at" BEFORE UPDATE ON "public"."story_opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_opps_updated_at"();



CREATE OR REPLACE TRIGGER "set_story_reviews_updated_at" BEFORE UPDATE ON "public"."story_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_story_reviews_updated_at"();



CREATE OR REPLACE TRIGGER "trg_action_quality" AFTER UPDATE OF "status" ON "public"."agent_actions" FOR EACH ROW EXECUTE FUNCTION "public"."update_run_quality_score"();



CREATE OR REPLACE TRIGGER "trg_agent_memory_updated_at" BEFORE UPDATE ON "public"."agent_memory" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_agent_runs_update_last_run" AFTER INSERT OR UPDATE OF "status", "finished_at" ON "public"."agent_runs" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_agent_runs_update_last_run"();



CREATE OR REPLACE TRIGGER "trg_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_checklist_templates_updated_at" BEFORE UPDATE ON "public"."checklist_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_conversations_sync_environment" BEFORE INSERT OR UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_customer_properties_updated_at" BEFORE UPDATE ON "public"."customer_properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_customers_sync_environment" BEFORE INSERT OR UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_employee_documents_updated_at" BEFORE UPDATE ON "public"."employee_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_employee_onboarding_updated_at" BEFORE UPDATE ON "public"."employee_onboarding" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exec_decisions_updated_at" BEFORE UPDATE ON "public"."executive_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exec_directives_updated_at" BEFORE UPDATE ON "public"."executive_directives" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exec_kpi_targets_updated_at" BEFORE UPDATE ON "public"."executive_kpi_targets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_exec_tasks_updated_at" BEFORE UPDATE ON "public"."executive_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fundraising_items_updated_at" BEFORE UPDATE ON "public"."fundraising_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_improvement_executions_updated_at" BEFORE UPDATE ON "public"."bud_improvement_executions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_improvement_signals_updated_at" BEFORE UPDATE ON "public"."bud_improvement_signals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_job_assignments_updated_at" BEFORE UPDATE ON "public"."job_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_jr_updated_at" BEFORE UPDATE ON "public"."job_requirements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_ndis"();



CREATE OR REPLACE TRIGGER "trg_lead_conversation_inherit_test" BEFORE INSERT ON "public"."lead_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_lead_conversation_test_flag"();



CREATE OR REPLACE TRIGGER "trg_lead_conversations_sync_environment" BEFORE INSERT OR UPDATE ON "public"."lead_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_lead_follow_ups_updated_at" BEFORE UPDATE ON "public"."lead_follow_ups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leads_sync_environment" BEFORE INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lobby_themes_single_active" BEFORE INSERT OR UPDATE ON "public"."lobby_themes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_single_active_theme"();



CREATE OR REPLACE TRIGGER "trg_message_inherit_environment" BEFORE INSERT OR UPDATE OF "conversation_id" ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_message_environment"();



CREATE OR REPLACE TRIGGER "trg_message_inherit_test" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_message_test_flag"();



CREATE OR REPLACE TRIGGER "trg_messages_sync_environment" BEFORE INSERT OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_messages_touch_conversation" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_conversation_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ndis_org_updated_at" BEFORE UPDATE ON "public"."ndis_organisations" FOR EACH ROW EXECUTE FUNCTION "public"."set_ndis_org_updated_at"();



CREATE OR REPLACE TRIGGER "trg_order_inherit_environment" BEFORE INSERT OR UPDATE OF "quote_id" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_order_environment"();



CREATE OR REPLACE TRIGGER "trg_order_inherit_test" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_order_test_flag"();



CREATE OR REPLACE TRIGGER "trg_orders_status_updated_at" BEFORE UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_orders_status_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_sync_environment" BEFORE INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_psp_updated_at" BEFORE UPDATE ON "public"."participant_support_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_ndis"();



CREATE OR REPLACE TRIGGER "trg_quotes_sync_environment" BEFORE INSERT OR UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_ratings_sync_environment" BEFORE INSERT OR UPDATE ON "public"."ratings" FOR EACH ROW EXECUTE FUNCTION "public"."sync_environment_from_is_test"();



CREATE OR REPLACE TRIGGER "trg_root_cause_initiatives_updated_at" BEFORE UPDATE ON "public"."bud_root_cause_initiatives" FOR EACH ROW EXECUTE FUNCTION "public"."update_root_cause_initiative_updated_at"();



CREATE OR REPLACE TRIGGER "trg_site_impact_stats_updated_at" BEFORE UPDATE ON "public"."site_impact_stats" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_social_proof_items_updated_at" BEFORE UPDATE ON "public"."social_proof_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payables_updated_at" BEFORE UPDATE ON "public"."payables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_site_settings_updated_at" BEFORE UPDATE ON "public"."site_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_ux_proposals"
    ADD CONSTRAINT "admin_ux_proposals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "public"."bud_root_cause_initiatives"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_actions"
    ADD CONSTRAINT "agent_actions_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."agent_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_alerts"
    ADD CONSTRAINT "agent_alerts_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."agent_actions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_config_versions"
    ADD CONSTRAINT "agent_config_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."agent_evolutions"
    ADD CONSTRAINT "agent_evolutions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_evolutions"
    ADD CONSTRAINT "agent_evolutions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_evolutions"
    ADD CONSTRAINT "agent_evolutions_target_agent_id_fkey" FOREIGN KEY ("target_agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_guardrail_events"
    ADD CONSTRAINT "agent_guardrail_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_guardrail_events"
    ADD CONSTRAINT "agent_guardrail_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_memory"
    ADD CONSTRAINT "agent_memory_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agent_workflow_memberships"
    ADD CONSTRAINT "agent_workflow_memberships_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_findings"
    ADD CONSTRAINT "analytics_findings_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."analytics_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_funnels"
    ADD CONSTRAINT "analytics_funnels_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."analytics_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applicants"
    ADD CONSTRAINT "applicants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."artifact_versions"
    ADD CONSTRAINT "artifact_versions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."artifact_versions"
    ADD CONSTRAINT "artifact_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."artifacts"
    ADD CONSTRAINT "artifacts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."artifacts"
    ADD CONSTRAINT "artifacts_approved_version_fk" FOREIGN KEY ("approved_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."artifacts"
    ADD CONSTRAINT "artifacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."artifacts"
    ADD CONSTRAINT "artifacts_latest_version_fk" FOREIGN KEY ("latest_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_approval_queue"
    ADD CONSTRAINT "bud_approval_queue_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "public"."bud_root_cause_initiatives"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_approval_queue"
    ADD CONSTRAINT "bud_approval_queue_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bud_approval_queue"
    ADD CONSTRAINT "bud_approval_queue_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."bud_approval_queue"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_approval_queue"
    ADD CONSTRAINT "bud_approval_queue_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."bud_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_audit_logs"
    ADD CONSTRAINT "bud_audit_logs_actor_user_fkey" FOREIGN KEY ("actor_user") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bud_browser_test_runs"
    ADD CONSTRAINT "bud_browser_test_runs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_browser_test_runs"
    ADD CONSTRAINT "bud_browser_test_runs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."bud_repair_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_change_requests"
    ADD CONSTRAINT "bud_change_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."bud_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_deployment_verifications"
    ADD CONSTRAINT "bud_deployment_verifications_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_evidence"
    ADD CONSTRAINT "bud_evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."bud_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_executions"
    ADD CONSTRAINT "bud_improvement_executions_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "public"."bud_root_cause_initiatives"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_executions"
    ADD CONSTRAINT "bud_improvement_executions_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "public"."bud_improvement_signals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_learnings"
    ADD CONSTRAINT "bud_improvement_learnings_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_improvement_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_learnings"
    ADD CONSTRAINT "bud_improvement_learnings_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "public"."bud_improvement_signals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_logs"
    ADD CONSTRAINT "bud_improvement_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_improvement_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_improvement_logs"
    ADD CONSTRAINT "bud_improvement_logs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."bud_improvement_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_signals"
    ADD CONSTRAINT "bud_improvement_signals_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "public"."bud_improvement_signals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_signals"
    ADD CONSTRAINT "bud_improvement_signals_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "public"."bud_root_cause_initiatives"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_improvement_steps"
    ADD CONSTRAINT "bud_improvement_steps_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_improvement_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_repair_executions"
    ADD CONSTRAINT "bud_repair_executions_browser_test_run_id_fkey" FOREIGN KEY ("browser_test_run_id") REFERENCES "public"."bud_browser_test_runs"("id");



ALTER TABLE ONLY "public"."bud_repair_executions"
    ADD CONSTRAINT "bud_repair_executions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bud_repair_executions"
    ADD CONSTRAINT "bud_repair_executions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."bud_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_repair_learnings"
    ADD CONSTRAINT "bud_repair_learnings_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_repair_learnings"
    ADD CONSTRAINT "bud_repair_learnings_memory_doc_id_fkey" FOREIGN KEY ("memory_doc_id") REFERENCES "public"."memory_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_repair_learnings"
    ADD CONSTRAINT "bud_repair_learnings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."bud_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_repair_logs"
    ADD CONSTRAINT "bud_repair_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_repair_logs"
    ADD CONSTRAINT "bud_repair_logs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."bud_repair_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_repair_steps"
    ADD CONSTRAINT "bud_repair_steps_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bud_rollback_events"
    ADD CONSTRAINT "bud_rollback_events_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_telemetry_events"
    ADD CONSTRAINT "bud_telemetry_events_improvement_id_fkey" FOREIGN KEY ("improvement_id") REFERENCES "public"."bud_improvement_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_telemetry_events"
    ADD CONSTRAINT "bud_telemetry_events_repair_id_fkey" FOREIGN KEY ("repair_id") REFERENCES "public"."bud_repair_executions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bud_terminal_sessions"
    ADD CONSTRAINT "bud_terminal_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."campaign_factory_run_artifacts"
    ADD CONSTRAINT "campaign_factory_run_artifacts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_factory_run_artifacts"
    ADD CONSTRAINT "campaign_factory_run_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."campaign_factory_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_factory_runs"
    ADD CONSTRAINT "campaign_factory_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_factory_runs"
    ADD CONSTRAINT "campaign_factory_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_factory_runs"
    ADD CONSTRAINT "campaign_factory_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_factory_runs"
    ADD CONSTRAINT "campaign_factory_runs_selected_story_opportunity_id_fkey" FOREIGN KEY ("selected_story_opportunity_id") REFERENCES "public"."story_opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."capture_briefs"
    ADD CONSTRAINT "capture_briefs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cash_flow_forecasts"
    ADD CONSTRAINT "cash_flow_forecasts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_agreements"
    ADD CONSTRAINT "client_agreements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_agreements"
    ADD CONSTRAINT "client_agreements_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_assets"
    ADD CONSTRAINT "content_assets_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "public"."content_ideas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_assets"
    ADD CONSTRAINT "content_assets_production_card_id_fkey" FOREIGN KEY ("production_card_id") REFERENCES "public"."content_production_cards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_assets"
    ADD CONSTRAINT "content_assets_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."content_scripts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_drafts"
    ADD CONSTRAINT "content_drafts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_ideas"
    ADD CONSTRAINT "content_ideas_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."story_opportunities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_ideas"
    ADD CONSTRAINT "content_ideas_related_arc_id_fkey" FOREIGN KEY ("related_arc_id") REFERENCES "public"."story_arcs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_learning_records"
    ADD CONSTRAINT "content_learning_records_campaign_factory_run_id_fkey" FOREIGN KEY ("campaign_factory_run_id") REFERENCES "public"."campaign_factory_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_learning_records"
    ADD CONSTRAINT "content_learning_records_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_learning_records"
    ADD CONSTRAINT "content_learning_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_learning_records"
    ADD CONSTRAINT "content_learning_records_learning_artifact_id_fkey" FOREIGN KEY ("learning_artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_learning_records"
    ADD CONSTRAINT "content_learning_records_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_library_items"
    ADD CONSTRAINT "content_library_items_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_library_items"
    ADD CONSTRAINT "content_library_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_production_cards"
    ADD CONSTRAINT "content_production_cards_related_arc_id_fkey" FOREIGN KEY ("related_arc_id") REFERENCES "public"."story_arcs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_production_cards"
    ADD CONSTRAINT "content_production_cards_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."content_scripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_scripts"
    ADD CONSTRAINT "content_scripts_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "public"."content_ideas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crew_coach_notes"
    ADD CONSTRAINT "crew_coach_notes_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_properties"
    ADD CONSTRAINT "customer_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."design_insights"
    ADD CONSTRAINT "design_insights_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."design_insights"
    ADD CONSTRAINT "design_insights_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."design_insights"
    ADD CONSTRAINT "design_insights_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."design_violations"
    ADD CONSTRAINT "design_violations_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "public"."design_audits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_onboarding"
    ADD CONSTRAINT "employee_onboarding_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_payroll_details"
    ADD CONSTRAINT "employee_payroll_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employment_contracts"
    ADD CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."executive_tasks"
    ADD CONSTRAINT "executive_tasks_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "public"."executive_decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "fk_employees_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."foreman_insights"
    ADD CONSTRAINT "foreman_insights_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fundraising_contributions"
    ADD CONSTRAINT "fundraising_contributions_fundraising_item_id_fkey" FOREIGN KEY ("fundraising_item_id") REFERENCES "public"."fundraising_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."growth_pipeline_events"
    ADD CONSTRAINT "growth_pipeline_events_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."founder_journal_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_completions"
    ADD CONSTRAINT "job_completions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."job_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_participant_matches"
    ADD CONSTRAINT "job_participant_matches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_participant_matches"
    ADD CONSTRAINT "job_participant_matches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_photos"
    ADD CONSTRAINT "job_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_publications"
    ADD CONSTRAINT "job_publications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_publications"
    ADD CONSTRAINT "job_publications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_publications"
    ADD CONSTRAINT "job_publications_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_requirements"
    ADD CONSTRAINT "job_requirements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_variations"
    ADD CONSTRAINT "job_variations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lapsed_outreach"
    ADD CONSTRAINT "lapsed_outreach_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_conversations"
    ADD CONSTRAINT "lead_conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_follow_ups"
    ADD CONSTRAINT "lead_follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_campaign_queue_items"
    ADD CONSTRAINT "marketing_campaign_queue_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_campaign_queue_items"
    ADD CONSTRAINT "marketing_campaign_queue_items_queue_item_id_fkey" FOREIGN KEY ("queue_item_id") REFERENCES "public"."marketing_publishing_queue"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_related_arc_id_fkey" FOREIGN KEY ("related_arc_id") REFERENCES "public"."story_arcs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_distribution_playbooks"
    ADD CONSTRAINT "marketing_distribution_playbooks_linked_campaign_id_fkey" FOREIGN KEY ("linked_campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketing_publishing_queue"
    ADD CONSTRAINT "marketing_publishing_queue_production_card_id_fkey" FOREIGN KEY ("production_card_id") REFERENCES "public"."content_production_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_publishing_queue"
    ADD CONSTRAINT "marketing_publishing_queue_related_arc_id_fkey" FOREIGN KEY ("related_arc_id") REFERENCES "public"."story_arcs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memory_contradiction_log"
    ADD CONSTRAINT "memory_contradiction_log_doc_a_id_fkey" FOREIGN KEY ("doc_a_id") REFERENCES "public"."memory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_contradiction_log"
    ADD CONSTRAINT "memory_contradiction_log_doc_b_id_fkey" FOREIGN KEY ("doc_b_id") REFERENCES "public"."memory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_documents"
    ADD CONSTRAINT "memory_documents_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."memory_documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memory_edges"
    ADD CONSTRAINT "memory_edges_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."memory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_edges"
    ADD CONSTRAINT "memory_edges_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."memory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_graph_extractions"
    ADD CONSTRAINT "memory_graph_extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."memory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memory_read_log"
    ADD CONSTRAINT "memory_read_log_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."memory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ndis_participants"
    ADD CONSTRAINT "ndis_participants_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."ndis_organisations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ndis_participants"
    ADD CONSTRAINT "ndis_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ndis_plan_matches"
    ADD CONSTRAINT "ndis_plan_matches_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_fees"
    ADD CONSTRAINT "order_fees_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_crew_id_fkey" FOREIGN KEY ("assigned_crew_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participant_support_profiles"
    ADD CONSTRAINT "participant_support_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payables"
    ADD CONSTRAINT "payables_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."phone_calls"
    ADD CONSTRAINT "phone_calls_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pipeline_agent_scores"
    ADD CONSTRAINT "pipeline_agent_scores_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_artifacts"
    ADD CONSTRAINT "pipeline_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_stage_events"
    ADD CONSTRAINT "pipeline_stage_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_recommendations"
    ADD CONSTRAINT "pricing_recommendations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "public"."ndis_organisations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_converted_order_id_fkey" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_converted_subscription_id_fkey" FOREIGN KEY ("converted_subscription_id") REFERENCES "public"."subscriptions"("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."sandbox_agent_health"
    ADD CONSTRAINT "sandbox_agent_health_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."sandbox_agent_responses"
    ADD CONSTRAINT "sandbox_agent_responses_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."sandbox_scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sandbox_agent_responses"
    ADD CONSTRAINT "sandbox_agent_responses_training_run_id_fkey" FOREIGN KEY ("training_run_id") REFERENCES "public"."sandbox_training_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sandbox_decision_scores"
    ADD CONSTRAINT "sandbox_decision_scores_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."sandbox_agent_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sandbox_decision_scores"
    ADD CONSTRAINT "sandbox_decision_scores_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."sandbox_scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sandbox_lessons_learned"
    ADD CONSTRAINT "sandbox_lessons_learned_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."sandbox_scenarios"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sandbox_run_batches"
    ADD CONSTRAINT "sandbox_run_batches_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id");



ALTER TABLE ONLY "public"."sandbox_training_runs"
    ADD CONSTRAINT "sandbox_training_runs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."sandbox_run_batches"("id");



ALTER TABLE ONLY "public"."sandbox_training_runs"
    ADD CONSTRAINT "sandbox_training_runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."sandbox_scenarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_pricing"
    ADD CONSTRAINT "service_pricing_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_segments"
    ADD CONSTRAINT "shift_segments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_segments"
    ADD CONSTRAINT "shift_segments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_drafts"
    ADD CONSTRAINT "story_drafts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."story_opportunities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_open_threads"
    ADD CONSTRAINT "story_open_threads_related_arc_id_fkey" FOREIGN KEY ("related_arc_id") REFERENCES "public"."story_arcs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."story_opportunities"
    ADD CONSTRAINT "story_opportunities_related_arc_id_fkey" FOREIGN KEY ("related_arc_id") REFERENCES "public"."story_arcs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."story_reviews"
    ADD CONSTRAINT "story_reviews_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."story_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_reviews"
    ADD CONSTRAINT "story_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."stripe_disputes"
    ADD CONSTRAINT "stripe_disputes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transport_arrangements"
    ADD CONSTRAINT "transport_arrangements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transport_arrangements"
    ADD CONSTRAINT "transport_arrangements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visitor_events"
    ADD CONSTRAINT "visitor_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visitor_events"
    ADD CONSTRAINT "visitor_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visitor_events"
    ADD CONSTRAINT "visitor_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visitor_events"
    ADD CONSTRAINT "visitor_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("session_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_payouts"
    ADD CONSTRAINT "worker_payouts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_payouts"
    ADD CONSTRAINT "worker_payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_payouts"
    ADD CONSTRAINT "worker_payouts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."ndis_participants"("id") ON DELETE SET NULL;



CREATE POLICY "Admins full access to payroll details" ON "public"."employee_payroll_details" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage artifact versions" ON "public"."artifact_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage artifacts" ON "public"."artifacts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage campaign factory run artifacts" ON "public"."campaign_factory_run_artifacts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage campaign factory runs" ON "public"."campaign_factory_runs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage content assets" ON "public"."content_assets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage content ideas" ON "public"."content_ideas" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage content learning records" ON "public"."content_learning_records" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage content library items" ON "public"."content_library_items" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage content production cards" ON "public"."content_production_cards" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage content scripts" ON "public"."content_scripts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage job_participant_matches" ON "public"."job_participant_matches" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage job_publications" ON "public"."job_publications" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage job_requirements" ON "public"."job_requirements" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage marketing campaign queue links" ON "public"."marketing_campaign_queue_items" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage marketing campaigns" ON "public"."marketing_campaigns" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage marketing distribution playbooks" ON "public"."marketing_distribution_playbooks" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage marketing publishing queue" ON "public"."marketing_publishing_queue" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage marketing social channels" ON "public"."marketing_social_channels" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage ndis_organisations" ON "public"."ndis_organisations" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage ndis_participants" ON "public"."ndis_participants" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage order_fees" ON "public"."order_fees" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage participant_support_profiles" ON "public"."participant_support_profiles" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage research trends" ON "public"."research_trends" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage shift_segments" ON "public"."shift_segments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage story drafts" ON "public"."story_drafts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage story reviews" ON "public"."story_reviews" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins manage transport_arrangements" ON "public"."transport_arrangements" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage worker_payouts" ON "public"."worker_payouts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins read foreman insights" ON "public"."foreman_insights" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read foreman lobby states" ON "public"."foreman_lobby_states" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read guardrail events" ON "public"."agent_guardrail_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read journal entries" ON "public"."founder_journal_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read memory_contradiction_log" ON "public"."memory_contradiction_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read memory_documents" ON "public"."memory_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read memory_edges" ON "public"."memory_edges" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read memory_graph_extractions" ON "public"."memory_graph_extractions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read memory_read_log" ON "public"."memory_read_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read open threads" ON "public"."story_open_threads" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read story arcs" ON "public"."story_arcs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read story bible" ON "public"."story_bible_sections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read story chapters" ON "public"."story_chapters" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read story characters" ON "public"."story_characters" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Admins read story opportunities" ON "public"."story_opportunities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Authenticated users can read page_views" ON "public"."page_views" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated users can read visitors" ON "public"."site_visitors" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));



CREATE POLICY "Authenticated users read rollback events" ON "public"."bud_rollback_events" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Employees manage own support profile" ON "public"."participant_support_profiles" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees manage their own payroll details" ON "public"."employee_payroll_details" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "employee_payroll_details"."employee_id") AND ("employees"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees"
  WHERE (("employees"."id" = "employee_payroll_details"."employee_id") AND ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "Employees read job requirements for published jobs" ON "public"."job_requirements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."job_publications" "jp"
     JOIN "public"."employees" "e" ON (("e"."id" = "jp"."employee_id")))
  WHERE (("jp"."order_id" = "job_requirements"."order_id") AND ("e"."user_id" = "auth"."uid"()) AND ("jp"."status" = 'published'::"text")))));



CREATE POLICY "Employees read own job publications" ON "public"."job_publications" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees read own match scores" ON "public"."job_participant_matches" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees read own shift segments" ON "public"."shift_segments" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees read own transport arrangements" ON "public"."transport_arrangements" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees update own job publication response" ON "public"."job_publications" FOR UPDATE USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"())))) WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Employees view own payouts" ON "public"."worker_payouts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "worker_payouts"."employee_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "NDIS participants view available orders" ON "public"."orders" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ndis_participant'::"text")))) AND ("status" = ANY (ARRAY['confirmed'::"text", 'scheduled'::"text"]))));



CREATE POLICY "Org admins manage own participants" ON "public"."ndis_participants" USING ((("organisation_id" = "public"."get_user_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'org_admin'::"text"))))));



CREATE POLICY "Org admins view own organisation" ON "public"."ndis_organisations" FOR SELECT USING ((("id" = "public"."get_user_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'org_admin'::"text"))))));



CREATE POLICY "Org admins view participant order_fees" ON "public"."order_fees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."worker_payouts" "wp"
     JOIN "public"."ndis_participants" "np" ON (("np"."id" = "wp"."participant_id")))
     JOIN "public"."profiles" "p" ON (("p"."organisation_id" = "np"."organisation_id")))
  WHERE (("wp"."order_id" = "order_fees"."order_id") AND ("p"."id" = "auth"."uid"()) AND ("p"."role" = 'org_admin'::"text")))));



CREATE POLICY "Participants view org siblings" ON "public"."ndis_participants" FOR SELECT USING ((("organisation_id" = "public"."get_user_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ndis_participant'::"text"))))));



CREATE POLICY "Participants view own organisation" ON "public"."ndis_organisations" FOR SELECT USING ((("id" = "public"."get_user_org_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ndis_participant'::"text"))))));



CREATE POLICY "Participants view own payouts" ON "public"."worker_payouts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ndis_participants" "np"
  WHERE (("np"."id" = "worker_payouts"."participant_id") AND ("np"."user_id" = "auth"."uid"())))));



CREATE POLICY "Participants view own record" ON "public"."ndis_participants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Public can insert analytics_sessions" ON "public"."analytics_sessions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert feedback" ON "public"."site_feedback" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert page_views" ON "public"."page_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert visitor_events" ON "public"."visitor_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert visitors" ON "public"."site_visitors" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can update analytics_sessions" ON "public"."analytics_sessions" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to bud_repair_quarantine" ON "public"."bud_repair_quarantine" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_agent_runs_meta" ON "public"."executive_agent_runs_meta" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_decisions" ON "public"."executive_decisions" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_directives" ON "public"."executive_directives" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_kpi_targets" ON "public"."executive_kpi_targets" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_metrics_snapshots" ON "public"."executive_metrics_snapshots" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_tasks" ON "public"."executive_tasks" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to executive_weekly_reviews" ON "public"."executive_weekly_reviews" USING (true) WITH CHECK (true);



CREATE POLICY "Service role manages rollback events" ON "public"."bud_rollback_events" USING (true);



CREATE POLICY "Staff can read analytics_sessions" ON "public"."analytics_sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text")))));



CREATE POLICY "Staff can read visitor_events" ON "public"."visitor_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."status" = 'active'::"text")))));



CREATE POLICY "Staff can update feedback" ON "public"."site_feedback" FOR UPDATE TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "Staff can view feedback" ON "public"."site_feedback" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "admin read" ON "public"."analytics_findings" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin read" ON "public"."analytics_funnels" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin read" ON "public"."analytics_reports" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin read" ON "public"."design_audits" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin read" ON "public"."design_violations" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "admin_all" ON "public"."employment_contracts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_agreements" ON "public"."client_agreements" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_bud_activity_feed" ON "public"."bud_activity_feed" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_approval_queue" ON "public"."bud_approval_queue" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_audit_logs" ON "public"."bud_audit_logs" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_change_requests" ON "public"."bud_change_requests" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_deployment_verifications" ON "public"."bud_deployment_verifications" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_insights" ON "public"."bud_insights" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_lobby_states" ON "public"."bud_lobby_states" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_repair_executions" ON "public"."bud_repair_executions" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_repair_learnings" ON "public"."bud_repair_learnings" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_repair_logs" ON "public"."bud_repair_logs" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_repair_steps" ON "public"."bud_repair_steps" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_tasks" ON "public"."bud_tasks" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_bud_terminal_sessions" ON "public"."bud_terminal_sessions" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_all_customers" ON "public"."customers" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_orders" ON "public"."orders" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_payables" ON "public"."payables" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_payments" ON "public"."payments" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_ratings" ON "public"."ratings" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_rego_cache" ON "public"."rego_cache" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_subscription_orders" ON "public"."subscription_orders" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_subscriptions" ON "public"."subscriptions" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "admin_all_variations" ON "public"."job_variations" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_vehicle_overrides" ON "public"."vehicle_overrides" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."admin_optimization_findings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_service_bud_evidence" ON "public"."bud_evidence" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



CREATE POLICY "admin_service_bud_improvements" ON "public"."bud_improvements" USING ((("auth"."jwt"() ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'service_role'::"text"])));



ALTER TABLE "public"."admin_ux_proposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_ux_proposals_admin_read" ON "public"."admin_ux_proposals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "admin_ux_proposals_admin_write" ON "public"."admin_ux_proposals" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "admin_ux_proposals_service" ON "public"."admin_ux_proposals" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "admin_write_site_settings" ON "public"."site_settings" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."agent_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_actions_admin_read" ON "public"."agent_actions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_actions_admin_write" ON "public"."agent_actions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_actions_service" ON "public"."agent_actions" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_config_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_config_versions_admin_read" ON "public"."agent_config_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_config_versions_admin_write" ON "public"."agent_config_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_config_versions_service" ON "public"."agent_config_versions" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_evolutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_evolutions_admin_read" ON "public"."agent_evolutions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_evolutions_admin_write" ON "public"."agent_evolutions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_evolutions_service" ON "public"."agent_evolutions" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_guardrail_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_memory" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_memory_service" ON "public"."agent_memory" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_runs_admin_read" ON "public"."agent_runs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agent_runs_service" ON "public"."agent_runs" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."agent_workflow_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agents_admin_read" ON "public"."agents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agents_admin_write" ON "public"."agents" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "agents_service_all" ON "public"."agents" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."analytics_findings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_funnels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon read conventions" ON "public"."bud_convention_learnings" FOR SELECT USING (true);



ALTER TABLE "public"."applicants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applicants_admin_all" ON "public"."applicants" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "applicants_public_insert" ON "public"."applicants" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."artifact_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_admin_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."bud_activity_feed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_approval_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_browser_test_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_circuit_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_convention_learnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_deployment_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_improvement_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_improvement_learnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_improvement_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_improvement_signals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_improvement_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_improvements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_lobby_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_repair_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_repair_learnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_repair_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_repair_quarantine" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_repair_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_rollback_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_root_cause_initiatives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_telemetry_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bud_terminal_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_factory_run_artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_factory_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."capture_briefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "capture_briefs_admin_read" ON "public"."capture_briefs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "capture_briefs_service_all" ON "public"."capture_briefs" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."cash_flow_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cash_flow_forecasts_admin_read" ON "public"."cash_flow_forecasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "cash_flow_forecasts_service" ON "public"."cash_flow_forecasts" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."checklist_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checklist_templates_admin_all" ON "public"."checklist_templates" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "checklist_templates_staff_select" ON "public"."checklist_templates" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



ALTER TABLE "public"."classification_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classification_feedback_admin_all" ON "public"."classification_feedback" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."client_agreements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitor_intel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "competitor_intel_admin_read" ON "public"."competitor_intel" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "competitor_intel_admin_write" ON "public"."competitor_intel" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "competitor_intel_service" ON "public"."competitor_intel" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."competitor_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "competitor_pages_admin_read" ON "public"."competitor_pages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "competitor_pages_service" ON "public"."competitor_pages" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."content_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_drafts_admin_read" ON "public"."content_drafts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "content_drafts_service" ON "public"."content_drafts" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."content_ideas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_learning_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_library_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_production_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_scripts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_admin_all" ON "public"."conversations" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."crew_coach_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crew_coach_notes_admin_read" ON "public"."crew_coach_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "crew_coach_notes_service" ON "public"."crew_coach_notes" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."customer_properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_audits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."design_insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "design_insights_admin_read" ON "public"."design_insights" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "design_insights_admin_write" ON "public"."design_insights" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "design_insights_service" ON "public"."design_insights" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."design_violations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dev_os_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."efficiency_findings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_documents_admin_all" ON "public"."employee_documents" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "employee_documents_employee_own" ON "public"."employee_documents" TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."employee_onboarding" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_onboarding_admin_all" ON "public"."employee_onboarding" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "employee_onboarding_employee_own" ON "public"."employee_onboarding" TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."employee_payroll_details" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_read_own" ON "public"."employment_contracts" FOR SELECT USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_admin_all" ON "public"."employees" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "employees_insert_own" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "employees_select_own" ON "public"."employees" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "employees_update_own" ON "public"."employees" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."employment_contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_agent_runs_meta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_directives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_kpi_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_metrics_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."executive_weekly_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."foreman_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."foreman_lobby_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."founder_journal_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fundraising_contributions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fundraising_contributions_no_public_read" ON "public"."fundraising_contributions" FOR SELECT TO "authenticated", "anon" USING (false);



ALTER TABLE "public"."fundraising_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fundraising_items_public_read" ON "public"."fundraising_items" FOR SELECT TO "authenticated", "anon" USING (("status" = 'live'::"text"));



ALTER TABLE "public"."github_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."growth_pipeline_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_assignments_admin_all" ON "public"."job_assignments" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "job_assignments_employee_own" ON "public"."job_assignments" FOR SELECT TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "job_assignments_employee_update" ON "public"."job_assignments" FOR UPDATE TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."job_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_completions_admin_all" ON "public"."job_completions" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "job_completions_employee_own" ON "public"."job_completions" TO "authenticated" USING (("assignment_id" IN ( SELECT "ja"."id"
   FROM ("public"."job_assignments" "ja"
     JOIN "public"."employees" "e" ON (("e"."id" = "ja"."employee_id")))
  WHERE ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("assignment_id" IN ( SELECT "ja"."id"
   FROM ("public"."job_assignments" "ja"
     JOIN "public"."employees" "e" ON (("e"."id" = "ja"."employee_id")))
  WHERE ("e"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."job_participant_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_photos_admin_read" ON "public"."job_photos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "job_photos_service" ON "public"."job_photos" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."job_publications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_variations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "knowledge_articles_admin_read" ON "public"."knowledge_articles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "knowledge_articles_service" ON "public"."knowledge_articles" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."lapsed_outreach" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lapsed_outreach_admin_read" ON "public"."lapsed_outreach" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "lapsed_outreach_service" ON "public"."lapsed_outreach" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."lead_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_conversations_staff_read" ON "public"."lead_conversations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."lead_follow_ups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_follow_ups_staff_read" ON "public"."lead_follow_ups" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."lead_response_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_response_metrics_staff_read" ON "public"."lead_response_metrics" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."lead_suburb_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_suburb_analytics_staff_read" ON "public"."lead_suburb_analytics" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_staff_read" ON "public"."leads" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."lobby_themes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lobby_themes_admin_read" ON "public"."lobby_themes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "lobby_themes_admin_write" ON "public"."lobby_themes" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "lobby_themes_service" ON "public"."lobby_themes" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."marketing_campaign_queue_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_distribution_playbooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_metrics_admin_read" ON "public"."marketing_metrics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "marketing_metrics_admin_update" ON "public"."marketing_metrics" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "marketing_metrics_admin_write" ON "public"."marketing_metrics" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "marketing_metrics_service_all" ON "public"."marketing_metrics" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."marketing_publishing_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_social_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_contradiction_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_edges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_graph_extractions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memory_read_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_admin_all" ON "public"."messages" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."ndis_organisations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ndis_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ndis_plan_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ndis_plan_matches_admin_read" ON "public"."ndis_plan_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "ndis_plan_matches_service" ON "public"."ndis_plan_matches" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."order_fees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_customer_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))) OR ("public"."get_user_role"() = 'admin'::"text") OR (("public"."get_user_role"() = 'employee'::"text") AND (("assigned_employee_id" IS NULL) OR ("assigned_employee_id" = "auth"."uid"())))));



ALTER TABLE "public"."page_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participant_support_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payouts_admin_all" ON "public"."payouts" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



ALTER TABLE "public"."phone_calls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "phone_calls_admin_read" ON "public"."phone_calls" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "phone_calls_service" ON "public"."phone_calls" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."pipeline_agent_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_agent_scores read" ON "public"."pipeline_agent_scores" FOR SELECT USING ("public"."is_pipeline_admin"());



ALTER TABLE "public"."pipeline_artifacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_artifacts read" ON "public"."pipeline_artifacts" FOR SELECT USING ("public"."is_pipeline_admin"());



ALTER TABLE "public"."pipeline_kill_switch" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_kill_switch read" ON "public"."pipeline_kill_switch" FOR SELECT USING ("public"."is_pipeline_admin"());



CREATE POLICY "pipeline_kill_switch write" ON "public"."pipeline_kill_switch" FOR UPDATE USING ("public"."is_pipeline_admin"()) WITH CHECK ("public"."is_pipeline_admin"());



ALTER TABLE "public"."pipeline_policy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_policy read" ON "public"."pipeline_policy" FOR SELECT USING ("public"."is_pipeline_admin"());



CREATE POLICY "pipeline_policy write" ON "public"."pipeline_policy" FOR UPDATE USING ("public"."is_pipeline_admin"()) WITH CHECK ("public"."is_pipeline_admin"());



ALTER TABLE "public"."pipeline_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_runs read" ON "public"."pipeline_runs" FOR SELECT USING ("public"."is_pipeline_admin"());



ALTER TABLE "public"."pipeline_stage_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_stage_events read" ON "public"."pipeline_stage_events" FOR SELECT USING ("public"."is_pipeline_admin"());



ALTER TABLE "public"."pr_review_predictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_recs_admin_read" ON "public"."pricing_recommendations" FOR SELECT USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "pricing_recs_service_write" ON "public"."pricing_recommendations" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_all" ON "public"."profiles" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("role" = ( SELECT "p"."role"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "property_own" ON "public"."customer_properties" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "property_staff_select" ON "public"."customer_properties" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "public_read_site_settings" ON "public"."site_settings" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."quote_funnel_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotes_admin_employee_all" ON "public"."quotes" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "quotes_customer_select" ON "public"."quotes" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))));



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ratings_customer_select" ON "public"."ratings" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))));



ALTER TABLE "public"."rego_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."research_trends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resilience_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviewer_calibration" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sandbox_agent_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_agent_health_admin_read" ON "public"."sandbox_agent_health" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_agent_health_admin_write" ON "public"."sandbox_agent_health" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_agent_health_service" ON "public"."sandbox_agent_health" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_agent_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_agent_responses_admin_read" ON "public"."sandbox_agent_responses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_agent_responses_admin_write" ON "public"."sandbox_agent_responses" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_agent_responses_service" ON "public"."sandbox_agent_responses" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_decision_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_decision_scores_admin_read" ON "public"."sandbox_decision_scores" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_decision_scores_admin_write" ON "public"."sandbox_decision_scores" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_decision_scores_service" ON "public"."sandbox_decision_scores" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_lessons_learned" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_lessons_learned_admin_read" ON "public"."sandbox_lessons_learned" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_lessons_learned_admin_write" ON "public"."sandbox_lessons_learned" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_lessons_learned_service" ON "public"."sandbox_lessons_learned" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_policy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_policy_admin_read" ON "public"."sandbox_policy" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_policy_admin_write" ON "public"."sandbox_policy" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_policy_service" ON "public"."sandbox_policy" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_run_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_run_batches_admin_read" ON "public"."sandbox_run_batches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_run_batches_admin_write" ON "public"."sandbox_run_batches" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_run_batches_service" ON "public"."sandbox_run_batches" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_scenarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_scenarios_admin_read" ON "public"."sandbox_scenarios" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_scenarios_admin_write" ON "public"."sandbox_scenarios" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_scenarios_service" ON "public"."sandbox_scenarios" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."sandbox_training_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sandbox_training_runs_admin_read" ON "public"."sandbox_training_runs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_training_runs_admin_write" ON "public"."sandbox_training_runs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "sandbox_training_runs_service" ON "public"."sandbox_training_runs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service role full access" ON "public"."admin_optimization_findings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."agent_alerts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."analytics_findings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."analytics_funnels" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."analytics_reports" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."design_audits" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."design_violations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."github_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role only" ON "public"."bud_browser_test_runs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service write conventions" ON "public"."bud_convention_learnings" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."service_pricing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_pricing_admin_read" ON "public"."service_pricing" FOR SELECT USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "service_pricing_admin_write" ON "public"."service_pricing" USING (((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = ANY (ARRAY['admin'::"text", 'owner'::"text"])));



CREATE POLICY "service_pricing_service_write" ON "public"."service_pricing" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "public"."bud_circuit_states" USING (true);



CREATE POLICY "service_role_all" ON "public"."efficiency_findings" USING (true);



CREATE POLICY "service_role_all" ON "public"."resilience_events" USING (true);



CREATE POLICY "service_role_all_improvement_executions" ON "public"."bud_improvement_executions" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_improvement_learnings" ON "public"."bud_improvement_learnings" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_improvement_logs" ON "public"."bud_improvement_logs" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_improvement_signals" ON "public"."bud_improvement_signals" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_improvement_steps" ON "public"."bud_improvement_steps" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_root_cause_initiatives" ON "public"."bud_root_cause_initiatives" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_telemetry" ON "public"."bud_telemetry_events" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_only" ON "public"."dev_os_sessions" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text")) WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



ALTER TABLE "public"."shift_segments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_impact_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_impact_stats_public_read" ON "public"."site_impact_stats" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_visitors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_proof_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "social_proof_items_public_read" ON "public"."social_proof_items" FOR SELECT TO "authenticated", "anon" USING (("status" = 'live'::"text"));



ALTER TABLE "public"."story_arcs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_bible_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_characters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_open_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_disputes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stripe_disputes_admin_read" ON "public"."stripe_disputes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "stripe_disputes_service" ON "public"."stripe_disputes" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."subscription_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_customer_select" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((("customer_id" IN ( SELECT "customers"."id"
   FROM "public"."customers"
  WHERE ("customers"."user_id" = "auth"."uid"()))) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))));



ALTER TABLE "public"."transport_arrangements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicle_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visitor_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whs_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whs_records_admin_read" ON "public"."whs_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "whs_records_service" ON "public"."whs_records" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."worker_payouts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT ALL ON SCHEMA "extensions" TO "dashboard_user";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;



REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM "supabase_admin";
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "supabase_admin" WITH GRANT OPTION;
GRANT ALL ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";



GRANT ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;



GRANT ALL ON FUNCTION "public"."admin_opt_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_opt_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_opt_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_v2_classify_root_cause"("signal_type" "text", "title" "text", "description" "text", "affected_area" "text", "payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ai_v2_classify_root_cause"("signal_type" "text", "title" "text", "description" "text", "affected_area" "text", "payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_v2_classify_root_cause"("signal_type" "text", "title" "text", "description" "text", "affected_area" "text", "payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_v2_normalize_area"("area" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ai_v2_normalize_area"("area" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_v2_normalize_area"("area" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_anonymous_quotes"("p_user_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_anonymous_quotes"("p_user_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_anonymous_quotes"("p_user_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_single_active_theme"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_single_active_theme"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_single_active_theme"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."graph_degree"("node_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."graph_degree"("node_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."graph_degree"("node_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."graph_export"() TO "anon";
GRANT ALL ON FUNCTION "public"."graph_export"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."graph_export"() TO "service_role";



GRANT ALL ON FUNCTION "public"."graph_neighbors"("start_id" "uuid", "max_depth" integer, "rel_types" "text"[], "min_strength" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."graph_neighbors"("start_id" "uuid", "max_depth" integer, "rel_types" "text"[], "min_strength" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."graph_neighbors"("start_id" "uuid", "max_depth" integer, "rel_types" "text"[], "min_strength" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."graph_shortest_path"("from_id" "uuid", "to_id" "uuid", "max_hops" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."graph_shortest_path"("from_id" "uuid", "to_id" "uuid", "max_hops" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."graph_shortest_path"("from_id" "uuid", "to_id" "uuid", "max_hops" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_artifacts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_artifacts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_artifacts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_campaign_factory_runs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_campaign_factory_runs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_campaign_factory_runs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_content_assets_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_content_assets_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_content_assets_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_content_ideas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_content_ideas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_content_ideas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_content_learning_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_content_learning_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_content_learning_records_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_content_library_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_content_library_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_content_library_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_content_production_cards_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_content_production_cards_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_content_production_cards_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_content_scripts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_content_scripts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_content_scripts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_journal_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_journal_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_journal_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_marketing_campaigns_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_marketing_campaigns_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_marketing_campaigns_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_marketing_distribution_playbooks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_marketing_distribution_playbooks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_marketing_distribution_playbooks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_marketing_publishing_queue_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_marketing_publishing_queue_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_marketing_publishing_queue_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_marketing_social_channels_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_marketing_social_channels_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_marketing_social_channels_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_research_trends_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_research_trends_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_research_trends_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_arcs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_arcs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_arcs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_bible_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_bible_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_bible_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_chapters_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_chapters_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_chapters_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_characters_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_characters_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_characters_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_drafts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_drafts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_drafts_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_opps_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_opps_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_opps_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_reviews_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_reviews_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_reviews_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_story_threads_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_story_threads_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_story_threads_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_session_pages"("p_session_id" "text", "p_now" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_session_pages"("p_session_id" "text", "p_now" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_session_pages"("p_session_id" "text", "p_now" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_session_time"("p_session_id" "text", "p_seconds" integer, "p_now" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_session_time"("p_session_id" "text", "p_seconds" integer, "p_now" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_session_time"("p_session_id" "text", "p_seconds" integer, "p_now" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_pipeline_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_pipeline_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_pipeline_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_lead_conversation_test_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_lead_conversation_test_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_lead_conversation_test_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_message_environment"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_message_environment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_message_environment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_message_test_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_message_test_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_message_test_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_order_environment"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_order_environment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_order_environment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."propagate_order_test_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."propagate_order_test_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."propagate_order_test_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_memory_freshness"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_memory_freshness"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_memory_freshness"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sandbox_lesson_counts_by_agent"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sandbox_lesson_counts_by_agent"() TO "anon";
GRANT ALL ON FUNCTION "public"."sandbox_lesson_counts_by_agent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sandbox_lesson_counts_by_agent"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_agent_runs"("query_embedding" "public"."vector", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_agent_runs"("query_embedding" "public"."vector", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_agent_runs"("query_embedding" "public"."vector", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_category" "text", "filter_scope" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_category" "text", "filter_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_memory"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "filter_category" "text", "filter_scope" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_repair_learnings"("query_embedding" "public"."vector", "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_repair_learnings"("query_embedding" "public"."vector", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_repair_learnings"("query_embedding" "public"."vector", "match_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ndis_org_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ndis_org_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ndis_org_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_ndis"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_ndis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_ndis"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_environment_from_is_test"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_environment_from_is_test"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_environment_from_is_test"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_conversation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_conversation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_conversation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_memory_document"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_memory_document"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_memory_document"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_fn_agent_runs_update_last_run"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_fn_agent_runs_update_last_run"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_fn_agent_runs_update_last_run"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_fn_orders_status_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_fn_orders_status_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_fn_orders_status_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_root_cause_initiative_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_root_cause_initiative_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_root_cause_initiative_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_run_quality_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_run_quality_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_run_quality_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_optimization_findings" TO "anon";
GRANT ALL ON TABLE "public"."admin_optimization_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_optimization_findings" TO "service_role";



GRANT ALL ON TABLE "public"."admin_friction_open" TO "anon";
GRANT ALL ON TABLE "public"."admin_friction_open" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_friction_open" TO "service_role";



GRANT ALL ON TABLE "public"."admin_ux_proposals" TO "anon";
GRANT ALL ON TABLE "public"."admin_ux_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_ux_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."agent_actions" TO "anon";
GRANT ALL ON TABLE "public"."agent_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_actions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_alerts" TO "anon";
GRANT ALL ON TABLE "public"."agent_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."agent_config_versions" TO "anon";
GRANT ALL ON TABLE "public"."agent_config_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_config_versions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_evolutions" TO "anon";
GRANT ALL ON TABLE "public"."agent_evolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_evolutions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_guardrail_events" TO "anon";
GRANT ALL ON TABLE "public"."agent_guardrail_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_guardrail_events" TO "service_role";



GRANT ALL ON TABLE "public"."agent_memory" TO "anon";
GRANT ALL ON TABLE "public"."agent_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_memory" TO "service_role";



GRANT ALL ON TABLE "public"."agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."agent_workflow_memberships" TO "anon";
GRANT ALL ON TABLE "public"."agent_workflow_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_workflow_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_findings" TO "anon";
GRANT ALL ON TABLE "public"."analytics_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_findings" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_reports" TO "anon";
GRANT ALL ON TABLE "public"."analytics_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_reports" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_funnel_trend" TO "anon";
GRANT ALL ON TABLE "public"."analytics_funnel_trend" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_funnel_trend" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_funnels" TO "anon";
GRANT ALL ON TABLE "public"."analytics_funnels" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_funnels" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_latest_report" TO "anon";
GRANT ALL ON TABLE "public"."analytics_latest_report" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_latest_report" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_open_critical" TO "anon";
GRANT ALL ON TABLE "public"."analytics_open_critical" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_open_critical" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_sessions" TO "anon";
GRANT ALL ON TABLE "public"."analytics_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."applicants" TO "anon";
GRANT ALL ON TABLE "public"."applicants" TO "authenticated";
GRANT ALL ON TABLE "public"."applicants" TO "service_role";



GRANT ALL ON TABLE "public"."artifact_versions" TO "anon";
GRANT ALL ON TABLE "public"."artifact_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."artifact_versions" TO "service_role";



GRANT ALL ON TABLE "public"."artifacts" TO "anon";
GRANT ALL ON TABLE "public"."artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."bud_activity_feed" TO "anon";
GRANT ALL ON TABLE "public"."bud_activity_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_activity_feed" TO "service_role";



GRANT ALL ON TABLE "public"."bud_approval_queue" TO "anon";
GRANT ALL ON TABLE "public"."bud_approval_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_approval_queue" TO "service_role";



GRANT ALL ON TABLE "public"."bud_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."bud_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bud_browser_test_runs" TO "anon";
GRANT ALL ON TABLE "public"."bud_browser_test_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_browser_test_runs" TO "service_role";



GRANT ALL ON TABLE "public"."bud_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."bud_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."bud_circuit_states" TO "anon";
GRANT ALL ON TABLE "public"."bud_circuit_states" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_circuit_states" TO "service_role";



GRANT ALL ON TABLE "public"."bud_convention_learnings" TO "anon";
GRANT ALL ON TABLE "public"."bud_convention_learnings" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_convention_learnings" TO "service_role";



GRANT ALL ON TABLE "public"."bud_deployment_verifications" TO "anon";
GRANT ALL ON TABLE "public"."bud_deployment_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_deployment_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."bud_evidence" TO "anon";
GRANT ALL ON TABLE "public"."bud_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."bud_improvement_executions" TO "anon";
GRANT ALL ON TABLE "public"."bud_improvement_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_improvement_executions" TO "service_role";



GRANT ALL ON TABLE "public"."bud_improvement_learnings" TO "anon";
GRANT ALL ON TABLE "public"."bud_improvement_learnings" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_improvement_learnings" TO "service_role";



GRANT ALL ON TABLE "public"."bud_improvement_logs" TO "anon";
GRANT ALL ON TABLE "public"."bud_improvement_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_improvement_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bud_improvement_signals" TO "anon";
GRANT ALL ON TABLE "public"."bud_improvement_signals" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_improvement_signals" TO "service_role";



GRANT ALL ON TABLE "public"."bud_improvement_steps" TO "anon";
GRANT ALL ON TABLE "public"."bud_improvement_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_improvement_steps" TO "service_role";



GRANT ALL ON TABLE "public"."bud_improvements" TO "anon";
GRANT ALL ON TABLE "public"."bud_improvements" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_improvements" TO "service_role";



GRANT ALL ON TABLE "public"."bud_insights" TO "anon";
GRANT ALL ON TABLE "public"."bud_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_insights" TO "service_role";



GRANT ALL ON TABLE "public"."bud_lobby_states" TO "anon";
GRANT ALL ON TABLE "public"."bud_lobby_states" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_lobby_states" TO "service_role";



GRANT ALL ON TABLE "public"."bud_repair_executions" TO "anon";
GRANT ALL ON TABLE "public"."bud_repair_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_repair_executions" TO "service_role";



GRANT ALL ON TABLE "public"."bud_repair_learnings" TO "anon";
GRANT ALL ON TABLE "public"."bud_repair_learnings" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_repair_learnings" TO "service_role";



GRANT ALL ON TABLE "public"."bud_repair_logs" TO "anon";
GRANT ALL ON TABLE "public"."bud_repair_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_repair_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bud_repair_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bud_repair_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bud_repair_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bud_repair_quarantine" TO "anon";
GRANT ALL ON TABLE "public"."bud_repair_quarantine" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_repair_quarantine" TO "service_role";



GRANT ALL ON TABLE "public"."bud_repair_steps" TO "anon";
GRANT ALL ON TABLE "public"."bud_repair_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_repair_steps" TO "service_role";



GRANT ALL ON TABLE "public"."bud_rollback_events" TO "anon";
GRANT ALL ON TABLE "public"."bud_rollback_events" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_rollback_events" TO "service_role";



GRANT ALL ON TABLE "public"."bud_root_cause_initiatives" TO "anon";
GRANT ALL ON TABLE "public"."bud_root_cause_initiatives" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_root_cause_initiatives" TO "service_role";



GRANT ALL ON TABLE "public"."bud_tasks" TO "anon";
GRANT ALL ON TABLE "public"."bud_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."bud_telemetry_events" TO "anon";
GRANT ALL ON TABLE "public"."bud_telemetry_events" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_telemetry_events" TO "service_role";



GRANT ALL ON TABLE "public"."bud_terminal_sessions" TO "anon";
GRANT ALL ON TABLE "public"."bud_terminal_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."bud_terminal_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_factory_run_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."campaign_factory_run_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_factory_run_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_factory_runs" TO "anon";
GRANT ALL ON TABLE "public"."campaign_factory_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_factory_runs" TO "service_role";



GRANT ALL ON TABLE "public"."capture_briefs" TO "anon";
GRANT ALL ON TABLE "public"."capture_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."capture_briefs" TO "service_role";



GRANT ALL ON TABLE "public"."cash_flow_forecasts" TO "anon";
GRANT ALL ON TABLE "public"."cash_flow_forecasts" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_flow_forecasts" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_templates" TO "anon";
GRANT ALL ON TABLE "public"."checklist_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_templates" TO "service_role";



GRANT ALL ON TABLE "public"."classification_feedback" TO "anon";
GRANT ALL ON TABLE "public"."classification_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."classification_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."client_agreements" TO "anon";
GRANT ALL ON TABLE "public"."client_agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."client_agreements" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_intel" TO "anon";
GRANT ALL ON TABLE "public"."competitor_intel" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_intel" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_pages" TO "anon";
GRANT ALL ON TABLE "public"."competitor_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_pages" TO "service_role";



GRANT ALL ON TABLE "public"."content_assets" TO "anon";
GRANT ALL ON TABLE "public"."content_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."content_assets" TO "service_role";



GRANT ALL ON TABLE "public"."content_drafts" TO "anon";
GRANT ALL ON TABLE "public"."content_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."content_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."content_ideas" TO "anon";
GRANT ALL ON TABLE "public"."content_ideas" TO "authenticated";
GRANT ALL ON TABLE "public"."content_ideas" TO "service_role";



GRANT ALL ON TABLE "public"."content_learning_records" TO "anon";
GRANT ALL ON TABLE "public"."content_learning_records" TO "authenticated";
GRANT ALL ON TABLE "public"."content_learning_records" TO "service_role";



GRANT ALL ON TABLE "public"."content_library_items" TO "anon";
GRANT ALL ON TABLE "public"."content_library_items" TO "authenticated";
GRANT ALL ON TABLE "public"."content_library_items" TO "service_role";



GRANT ALL ON TABLE "public"."content_production_cards" TO "anon";
GRANT ALL ON TABLE "public"."content_production_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."content_production_cards" TO "service_role";



GRANT ALL ON TABLE "public"."content_scripts" TO "anon";
GRANT ALL ON TABLE "public"."content_scripts" TO "authenticated";
GRANT ALL ON TABLE "public"."content_scripts" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."crew_coach_notes" TO "anon";
GRANT ALL ON TABLE "public"."crew_coach_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."crew_coach_notes" TO "service_role";



GRANT ALL ON TABLE "public"."customer_properties" TO "anon";
GRANT ALL ON TABLE "public"."customer_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_properties" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."design_audits" TO "anon";
GRANT ALL ON TABLE "public"."design_audits" TO "authenticated";
GRANT ALL ON TABLE "public"."design_audits" TO "service_role";



GRANT ALL ON TABLE "public"."design_violations" TO "anon";
GRANT ALL ON TABLE "public"."design_violations" TO "authenticated";
GRANT ALL ON TABLE "public"."design_violations" TO "service_role";



GRANT ALL ON TABLE "public"."design_duplication_queue" TO "anon";
GRANT ALL ON TABLE "public"."design_duplication_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."design_duplication_queue" TO "service_role";



GRANT ALL ON TABLE "public"."design_insights" TO "anon";
GRANT ALL ON TABLE "public"."design_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."design_insights" TO "service_role";



GRANT ALL ON TABLE "public"."design_latest_audit" TO "anon";
GRANT ALL ON TABLE "public"."design_latest_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."design_latest_audit" TO "service_role";



GRANT ALL ON TABLE "public"."design_open_critical" TO "anon";
GRANT ALL ON TABLE "public"."design_open_critical" TO "authenticated";
GRANT ALL ON TABLE "public"."design_open_critical" TO "service_role";



GRANT ALL ON TABLE "public"."design_score_trend" TO "anon";
GRANT ALL ON TABLE "public"."design_score_trend" TO "authenticated";
GRANT ALL ON TABLE "public"."design_score_trend" TO "service_role";



GRANT ALL ON TABLE "public"."dev_os_sessions" TO "anon";
GRANT ALL ON TABLE "public"."dev_os_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."dev_os_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."efficiency_findings" TO "anon";
GRANT ALL ON TABLE "public"."efficiency_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."efficiency_findings" TO "service_role";



GRANT ALL ON TABLE "public"."employee_documents" TO "anon";
GRANT ALL ON TABLE "public"."employee_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_documents" TO "service_role";



GRANT ALL ON TABLE "public"."employee_onboarding" TO "anon";
GRANT ALL ON TABLE "public"."employee_onboarding" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_onboarding" TO "service_role";



GRANT ALL ON TABLE "public"."employee_payroll_details" TO "anon";
GRANT ALL ON TABLE "public"."employee_payroll_details" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_payroll_details" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."employment_contracts" TO "anon";
GRANT ALL ON TABLE "public"."employment_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."employment_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."executive_agent_runs_meta" TO "anon";
GRANT ALL ON TABLE "public"."executive_agent_runs_meta" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_agent_runs_meta" TO "service_role";



GRANT ALL ON TABLE "public"."executive_decisions" TO "anon";
GRANT ALL ON TABLE "public"."executive_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."executive_directives" TO "anon";
GRANT ALL ON TABLE "public"."executive_directives" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_directives" TO "service_role";



GRANT ALL ON TABLE "public"."executive_kpi_targets" TO "anon";
GRANT ALL ON TABLE "public"."executive_kpi_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_kpi_targets" TO "service_role";



GRANT ALL ON TABLE "public"."executive_metrics_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."executive_metrics_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_metrics_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."executive_tasks" TO "anon";
GRANT ALL ON TABLE "public"."executive_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."executive_weekly_reviews" TO "anon";
GRANT ALL ON TABLE "public"."executive_weekly_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."executive_weekly_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."foreman_insights" TO "anon";
GRANT ALL ON TABLE "public"."foreman_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."foreman_insights" TO "service_role";



GRANT ALL ON TABLE "public"."foreman_lobby_states" TO "anon";
GRANT ALL ON TABLE "public"."foreman_lobby_states" TO "authenticated";
GRANT ALL ON TABLE "public"."foreman_lobby_states" TO "service_role";



GRANT ALL ON TABLE "public"."founder_journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."founder_journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."founder_journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."fundraising_contributions" TO "anon";
GRANT ALL ON TABLE "public"."fundraising_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."fundraising_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."fundraising_items" TO "anon";
GRANT ALL ON TABLE "public"."fundraising_items" TO "authenticated";
GRANT ALL ON TABLE "public"."fundraising_items" TO "service_role";



GRANT ALL ON TABLE "public"."github_events" TO "anon";
GRANT ALL ON TABLE "public"."github_events" TO "authenticated";
GRANT ALL ON TABLE "public"."github_events" TO "service_role";



GRANT ALL ON TABLE "public"."github_adr_queue" TO "anon";
GRANT ALL ON TABLE "public"."github_adr_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."github_adr_queue" TO "service_role";



GRANT ALL ON TABLE "public"."github_recent_failures" TO "anon";
GRANT ALL ON TABLE "public"."github_recent_failures" TO "authenticated";
GRANT ALL ON TABLE "public"."github_recent_failures" TO "service_role";



GRANT ALL ON TABLE "public"."growth_pipeline_events" TO "anon";
GRANT ALL ON TABLE "public"."growth_pipeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."growth_pipeline_events" TO "service_role";



GRANT ALL ON TABLE "public"."job_assignments" TO "anon";
GRANT ALL ON TABLE "public"."job_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."job_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."job_completions" TO "anon";
GRANT ALL ON TABLE "public"."job_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."job_completions" TO "service_role";



GRANT ALL ON TABLE "public"."job_participant_matches" TO "anon";
GRANT ALL ON TABLE "public"."job_participant_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."job_participant_matches" TO "service_role";



GRANT ALL ON TABLE "public"."job_photos" TO "anon";
GRANT ALL ON TABLE "public"."job_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."job_photos" TO "service_role";



GRANT ALL ON TABLE "public"."job_publications" TO "anon";
GRANT ALL ON TABLE "public"."job_publications" TO "authenticated";
GRANT ALL ON TABLE "public"."job_publications" TO "service_role";



GRANT ALL ON TABLE "public"."job_requirements" TO "anon";
GRANT ALL ON TABLE "public"."job_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."job_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."job_variations" TO "anon";
GRANT ALL ON TABLE "public"."job_variations" TO "authenticated";
GRANT ALL ON TABLE "public"."job_variations" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_articles" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_articles" TO "service_role";



GRANT ALL ON TABLE "public"."lapsed_outreach" TO "anon";
GRANT ALL ON TABLE "public"."lapsed_outreach" TO "authenticated";
GRANT ALL ON TABLE "public"."lapsed_outreach" TO "service_role";



GRANT ALL ON TABLE "public"."lead_conversations" TO "anon";
GRANT ALL ON TABLE "public"."lead_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."lead_follow_ups" TO "anon";
GRANT ALL ON TABLE "public"."lead_follow_ups" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_follow_ups" TO "service_role";



GRANT ALL ON TABLE "public"."lead_response_metrics" TO "anon";
GRANT ALL ON TABLE "public"."lead_response_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_response_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."lead_suburb_analytics" TO "anon";
GRANT ALL ON TABLE "public"."lead_suburb_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_suburb_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."lobby_themes" TO "anon";
GRANT ALL ON TABLE "public"."lobby_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."lobby_themes" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_campaign_queue_items" TO "anon";
GRANT ALL ON TABLE "public"."marketing_campaign_queue_items" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_campaign_queue_items" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."marketing_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_distribution_playbooks" TO "anon";
GRANT ALL ON TABLE "public"."marketing_distribution_playbooks" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_distribution_playbooks" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_metrics" TO "anon";
GRANT ALL ON TABLE "public"."marketing_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_publishing_queue" TO "anon";
GRANT ALL ON TABLE "public"."marketing_publishing_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_publishing_queue" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_social_channels" TO "anon";
GRANT ALL ON TABLE "public"."marketing_social_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_social_channels" TO "service_role";



GRANT ALL ON TABLE "public"."memory_contradiction_log" TO "anon";
GRANT ALL ON TABLE "public"."memory_contradiction_log" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_contradiction_log" TO "service_role";



GRANT ALL ON TABLE "public"."memory_documents" TO "anon";
GRANT ALL ON TABLE "public"."memory_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_documents" TO "service_role";



GRANT ALL ON TABLE "public"."memory_edges" TO "anon";
GRANT ALL ON TABLE "public"."memory_edges" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_edges" TO "service_role";



GRANT ALL ON TABLE "public"."memory_graph_extractions" TO "anon";
GRANT ALL ON TABLE "public"."memory_graph_extractions" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_graph_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."memory_read_log" TO "anon";
GRANT ALL ON TABLE "public"."memory_read_log" TO "authenticated";
GRANT ALL ON TABLE "public"."memory_read_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."memory_read_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."memory_read_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."memory_read_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."mission_control_latest_evidence" TO "anon";
GRANT ALL ON TABLE "public"."mission_control_latest_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_control_latest_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."ndis_organisations" TO "anon";
GRANT ALL ON TABLE "public"."ndis_organisations" TO "authenticated";
GRANT ALL ON TABLE "public"."ndis_organisations" TO "service_role";



GRANT ALL ON TABLE "public"."ndis_participants" TO "anon";
GRANT ALL ON TABLE "public"."ndis_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."ndis_participants" TO "service_role";



GRANT ALL ON TABLE "public"."ndis_plan_matches" TO "anon";
GRANT ALL ON TABLE "public"."ndis_plan_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."ndis_plan_matches" TO "service_role";



GRANT ALL ON TABLE "public"."order_fees" TO "anon";
GRANT ALL ON TABLE "public"."order_fees" TO "authenticated";
GRANT ALL ON TABLE "public"."order_fees" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."page_views" TO "anon";
GRANT ALL ON TABLE "public"."page_views" TO "authenticated";
GRANT ALL ON TABLE "public"."page_views" TO "service_role";



GRANT ALL ON TABLE "public"."participant_support_profiles" TO "anon";
GRANT ALL ON TABLE "public"."participant_support_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."participant_support_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."payables" TO "anon";
GRANT ALL ON TABLE "public"."payables" TO "authenticated";
GRANT ALL ON TABLE "public"."payables" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."phone_calls" TO "anon";
GRANT ALL ON TABLE "public"."phone_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_calls" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_agent_scores" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_agent_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_agent_scores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pipeline_agent_scores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pipeline_agent_scores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pipeline_agent_scores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_artifacts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pipeline_artifacts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pipeline_artifacts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pipeline_artifacts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_kill_switch" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_kill_switch" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_kill_switch" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_runs" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_runs" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_kpis_7d" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_kpis_7d" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_kpis_7d" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_policy" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_policy" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_policy" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_stage_events" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_stage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_stage_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pipeline_stage_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pipeline_stage_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pipeline_stage_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pr_review_predictions" TO "anon";
GRANT ALL ON TABLE "public"."pr_review_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."pr_review_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."pricing_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."production_orders" TO "anon";
GRANT ALL ON TABLE "public"."production_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."production_orders" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."quote_funnel_events" TO "anon";
GRANT ALL ON TABLE "public"."quote_funnel_events" TO "authenticated";
GRANT ALL ON TABLE "public"."quote_funnel_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."quote_funnel_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."quote_funnel_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."quote_funnel_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."quotes" TO "anon";
GRANT ALL ON TABLE "public"."quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotes" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."rego_cache" TO "anon";
GRANT ALL ON TABLE "public"."rego_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."rego_cache" TO "service_role";



GRANT ALL ON TABLE "public"."research_trends" TO "anon";
GRANT ALL ON TABLE "public"."research_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."research_trends" TO "service_role";



GRANT ALL ON TABLE "public"."resilience_events" TO "anon";
GRANT ALL ON TABLE "public"."resilience_events" TO "authenticated";
GRANT ALL ON TABLE "public"."resilience_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."resilience_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."resilience_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."resilience_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reviewer_calibration" TO "anon";
GRANT ALL ON TABLE "public"."reviewer_calibration" TO "authenticated";
GRANT ALL ON TABLE "public"."reviewer_calibration" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_agent_health" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_agent_health" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_agent_health" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_agent_responses" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_agent_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_agent_responses" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_decision_scores" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_decision_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_decision_scores" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_lessons_learned" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_lessons_learned" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_lessons_learned" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_policy" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_policy" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_policy" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_run_batches" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_run_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_run_batches" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."sandbox_training_runs" TO "anon";
GRANT ALL ON TABLE "public"."sandbox_training_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."sandbox_training_runs" TO "service_role";



GRANT ALL ON TABLE "public"."service_pricing" TO "anon";
GRANT ALL ON TABLE "public"."service_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."service_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."shift_segments" TO "anon";
GRANT ALL ON TABLE "public"."shift_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_segments" TO "service_role";



GRANT ALL ON TABLE "public"."site_feedback" TO "anon";
GRANT ALL ON TABLE "public"."site_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."site_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."site_impact_stats" TO "anon";
GRANT ALL ON TABLE "public"."site_impact_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."site_impact_stats" TO "service_role";



GRANT ALL ON TABLE "public"."site_settings" TO "anon";
GRANT ALL ON TABLE "public"."site_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."site_settings" TO "service_role";



GRANT ALL ON TABLE "public"."site_visitors" TO "anon";
GRANT ALL ON TABLE "public"."site_visitors" TO "authenticated";
GRANT ALL ON TABLE "public"."site_visitors" TO "service_role";



GRANT ALL ON TABLE "public"."social_proof_items" TO "anon";
GRANT ALL ON TABLE "public"."social_proof_items" TO "authenticated";
GRANT ALL ON TABLE "public"."social_proof_items" TO "service_role";



GRANT ALL ON TABLE "public"."story_arcs" TO "anon";
GRANT ALL ON TABLE "public"."story_arcs" TO "authenticated";
GRANT ALL ON TABLE "public"."story_arcs" TO "service_role";



GRANT ALL ON TABLE "public"."story_bible_sections" TO "anon";
GRANT ALL ON TABLE "public"."story_bible_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."story_bible_sections" TO "service_role";



GRANT ALL ON TABLE "public"."story_chapters" TO "anon";
GRANT ALL ON TABLE "public"."story_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."story_chapters" TO "service_role";



GRANT ALL ON TABLE "public"."story_characters" TO "anon";
GRANT ALL ON TABLE "public"."story_characters" TO "authenticated";
GRANT ALL ON TABLE "public"."story_characters" TO "service_role";



GRANT ALL ON TABLE "public"."story_drafts" TO "anon";
GRANT ALL ON TABLE "public"."story_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."story_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."story_open_threads" TO "anon";
GRANT ALL ON TABLE "public"."story_open_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."story_open_threads" TO "service_role";



GRANT ALL ON TABLE "public"."story_opportunities" TO "anon";
GRANT ALL ON TABLE "public"."story_opportunities" TO "authenticated";
GRANT ALL ON TABLE "public"."story_opportunities" TO "service_role";



GRANT ALL ON TABLE "public"."story_reviews" TO "anon";
GRANT ALL ON TABLE "public"."story_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."story_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_disputes" TO "anon";
GRANT ALL ON TABLE "public"."stripe_disputes" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_disputes" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_orders" TO "anon";
GRANT ALL ON TABLE "public"."subscription_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_orders" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."transport_arrangements" TO "anon";
GRANT ALL ON TABLE "public"."transport_arrangements" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_arrangements" TO "service_role";



GRANT ALL ON TABLE "public"."v_agent_cache_savings" TO "anon";
GRANT ALL ON TABLE "public"."v_agent_cache_savings" TO "authenticated";
GRANT ALL ON TABLE "public"."v_agent_cache_savings" TO "service_role";



GRANT ALL ON TABLE "public"."v_bud_approval_truth" TO "anon";
GRANT ALL ON TABLE "public"."v_bud_approval_truth" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bud_approval_truth" TO "service_role";



GRANT ALL ON TABLE "public"."v_pending_agent_actions" TO "anon";
GRANT ALL ON TABLE "public"."v_pending_agent_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pending_agent_actions" TO "service_role";



GRANT ALL ON TABLE "public"."v_agent_intelligence_quality" TO "anon";
GRANT ALL ON TABLE "public"."v_agent_intelligence_quality" TO "authenticated";
GRANT ALL ON TABLE "public"."v_agent_intelligence_quality" TO "service_role";



GRANT ALL ON TABLE "public"."v_agent_latest_run" TO "anon";
GRANT ALL ON TABLE "public"."v_agent_latest_run" TO "authenticated";
GRANT ALL ON TABLE "public"."v_agent_latest_run" TO "service_role";



GRANT ALL ON TABLE "public"."v_agent_runtime_status" TO "anon";
GRANT ALL ON TABLE "public"."v_agent_runtime_status" TO "authenticated";
GRANT ALL ON TABLE "public"."v_agent_runtime_status" TO "service_role";



GRANT ALL ON TABLE "public"."v_agent_stats_7d" TO "anon";
GRANT ALL ON TABLE "public"."v_agent_stats_7d" TO "authenticated";
GRANT ALL ON TABLE "public"."v_agent_stats_7d" TO "service_role";



GRANT ALL ON TABLE "public"."v_bud_repair_success_rate" TO "anon";
GRANT ALL ON TABLE "public"."v_bud_repair_success_rate" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bud_repair_success_rate" TO "service_role";



GRANT ALL ON TABLE "public"."v_bud_rollback_trends" TO "anon";
GRANT ALL ON TABLE "public"."v_bud_rollback_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bud_rollback_trends" TO "service_role";



GRANT ALL ON TABLE "public"."v_pricing_recs_pending" TO "anon";
GRANT ALL ON TABLE "public"."v_pricing_recs_pending" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pricing_recs_pending" TO "service_role";



GRANT ALL ON TABLE "public"."vehicle_overrides" TO "anon";
GRANT ALL ON TABLE "public"."vehicle_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicle_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."visitor_events" TO "anon";
GRANT ALL ON TABLE "public"."visitor_events" TO "authenticated";
GRANT ALL ON TABLE "public"."visitor_events" TO "service_role";



GRANT ALL ON TABLE "public"."whs_records" TO "anon";
GRANT ALL ON TABLE "public"."whs_records" TO "authenticated";
GRANT ALL ON TABLE "public"."whs_records" TO "service_role";



GRANT ALL ON TABLE "public"."worker_payouts" TO "anon";
GRANT ALL ON TABLE "public"."worker_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_payouts" TO "service_role";












ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







