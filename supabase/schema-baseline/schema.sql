--
-- PostgreSQL database dump
--

\restrict nfYDsHDpwik5uJlaM5VXap7ihNXCt8wuNO2ikzoyLbc2riAyiTCGgxISMfJgoUZ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: pipeline_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_run_status AS ENUM (
    'open',
    'in_progress',
    'succeeded',
    'rejected',
    'rolled_back'
);


--
-- Name: pipeline_run_verdict; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_run_verdict AS ENUM (
    'pending',
    'auto_merge',
    'human_review',
    'rejected',
    'rolled_back'
);


--
-- Name: pipeline_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_stage AS ENUM (
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


--
-- Name: pipeline_stage_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_stage_status AS ENUM (
    'idle',
    'active',
    'passed',
    'rejected',
    'skipped'
);


--
-- Name: pipeline_surface; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_surface AS ENUM (
    'public',
    'admin',
    'crew',
    'customer'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
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


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
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


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
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


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
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


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
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


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
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


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: admin_opt_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_opt_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: ai_v2_classify_root_cause(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_v2_classify_root_cause(signal_type text, title text, description text, affected_area text, payload jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(root_cause_id text, root_cause_key text, initiative_title text)
    LANGUAGE plpgsql IMMUTABLE
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


--
-- Name: ai_v2_normalize_area(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_v2_normalize_area(area text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select nullif(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(area, '')), '^(agents?|agent)\s*/\s*', ''), '[^a-z0-9-]+', '-', 'g'), '(^-+|-+$)', '', 'g'), '')
$_$;


--
-- Name: claim_anonymous_quotes(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_anonymous_quotes(p_user_id uuid, p_email text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: enforce_single_active_theme(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_single_active_theme() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.active = true then
    update public.lobby_themes set active = false where id <> new.id;
  end if;
  return new;
end $$;


--
-- Name: get_user_org_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_org_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT organisation_id FROM profiles WHERE id = auth.uid();
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: graph_degree(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.graph_degree(node_id uuid) RETURNS TABLE(in_degree integer, out_degree integer, total integer)
    LANGUAGE sql STABLE
    AS $$
  select
    (select count(*)::int from public.memory_edges where target_id = node_id) as in_degree,
    (select count(*)::int from public.memory_edges where source_id = node_id) as out_degree,
    (select count(*)::int from public.memory_edges
     where source_id = node_id or target_id = node_id)                       as total;
$$;


--
-- Name: graph_export(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.graph_export() RETURNS json
    LANGUAGE sql STABLE
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


--
-- Name: graph_neighbors(uuid, integer, text[], double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.graph_neighbors(start_id uuid, max_depth integer DEFAULT 2, rel_types text[] DEFAULT NULL::text[], min_strength double precision DEFAULT 0.0) RETURNS TABLE(node_id uuid, depth integer, path uuid[], relationship text, strength double precision)
    LANGUAGE sql STABLE
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


--
-- Name: graph_shortest_path(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.graph_shortest_path(from_id uuid, to_id uuid, max_hops integer DEFAULT 5) RETURNS TABLE(node_id uuid, depth integer, relationship text, path uuid[])
    LANGUAGE sql STABLE
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


--
-- Name: handle_artifacts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_artifacts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_campaign_factory_runs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_campaign_factory_runs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_content_assets_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_content_assets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_content_ideas_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_content_ideas_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_content_learning_records_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_content_learning_records_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_content_library_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_content_library_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_content_production_cards_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_content_production_cards_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_content_scripts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_content_scripts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_journal_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_journal_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: handle_marketing_campaigns_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_marketing_campaigns_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_marketing_distribution_playbooks_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_marketing_distribution_playbooks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_marketing_publishing_queue_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_marketing_publishing_queue_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_marketing_social_channels_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_marketing_social_channels_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_research_trends_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_research_trends_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_story_arcs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_arcs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_story_bible_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_bible_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: handle_story_chapters_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_chapters_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_story_characters_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_characters_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: handle_story_drafts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_drafts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_story_opps_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_opps_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_story_reviews_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_reviews_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: handle_story_threads_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_story_threads_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end; $$;


--
-- Name: increment_session_pages(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_session_pages(p_session_id text, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE analytics_sessions
  SET pages_visited = pages_visited + 1,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;


--
-- Name: increment_session_time(text, integer, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_session_time(p_session_id text, p_seconds integer, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
  UPDATE analytics_sessions
  SET total_seconds = total_seconds + p_seconds,
      last_seen_at  = p_now
  WHERE session_id = p_session_id;
$$;


--
-- Name: is_pipeline_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_pipeline_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner')
  );
$$;


--
-- Name: propagate_lead_conversation_test_flag(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_lead_conversation_test_flag() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_test = false THEN
    SELECT is_test INTO NEW.is_test FROM leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: propagate_message_environment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_message_environment() RETURNS trigger
    LANGUAGE plpgsql
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


--
-- Name: propagate_message_test_flag(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_message_test_flag() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_test = false THEN
    SELECT is_test INTO NEW.is_test FROM conversations WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: propagate_order_environment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_order_environment() RETURNS trigger
    LANGUAGE plpgsql
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


--
-- Name: propagate_order_test_flag(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.propagate_order_test_flag() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.is_test = false AND NEW.quote_id IS NOT NULL THEN
    SELECT is_test INTO NEW.is_test FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: refresh_memory_freshness(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_memory_freshness() RETURNS void
    LANGUAGE plpgsql
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


--
-- Name: sandbox_lesson_counts_by_agent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sandbox_lesson_counts_by_agent() RETURNS TABLE(agent_id text, lesson_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT agent_id, COUNT(*)::bigint AS lesson_count
  FROM   public.sandbox_lessons_learned
  WHERE  environment = 'sandbox'
  GROUP  BY agent_id;
$$;


--
-- Name: search_agent_runs(public.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_agent_runs(query_embedding public.vector, match_count integer DEFAULT 10) RETURNS TABLE(run_id uuid, agent_id text, summary text, started_at timestamp with time zone, similarity double precision)
    LANGUAGE sql STABLE
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


--
-- Name: search_memory(public.vector, double precision, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_memory(query_embedding public.vector, match_threshold double precision DEFAULT 0.70, match_count integer DEFAULT 5, filter_category text DEFAULT NULL::text, filter_scope text DEFAULT NULL::text) RETURNS TABLE(id uuid, vault_path text, category text, title text, body text, tags text[], agent_scope text, source text, freshness_score double precision, similarity double precision, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE
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


--
-- Name: search_repair_learnings(public.vector, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_repair_learnings(query_embedding public.vector, match_count integer DEFAULT 5) RETURNS TABLE(id uuid, root_cause_type text, fix_pattern text, outcome text, created_at timestamp with time zone, similarity double precision)
    LANGUAGE sql STABLE
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


--
-- Name: set_ndis_org_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_ndis_org_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at_ndis(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_ndis() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: sync_environment_from_is_test(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_environment_from_is_test() RETURNS trigger
    LANGUAGE plpgsql
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


--
-- Name: touch_conversation_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_conversation_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;


--
-- Name: touch_memory_document(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_memory_document() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: trg_fn_agent_runs_update_last_run(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_agent_runs_update_last_run() RETURNS trigger
    LANGUAGE plpgsql
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


--
-- Name: trg_fn_orders_status_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_fn_orders_status_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if NEW.status is distinct from OLD.status then
    NEW.status_updated_at := now();
  end if;
  return NEW;
end;
$$;


--
-- Name: update_root_cause_initiative_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_root_cause_initiative_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_run_quality_score(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_run_quality_score() RETURNS trigger
    LANGUAGE plpgsql
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


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    new.selected_columns = (
        select array_agg(c order by c)
        from unnest(new.selected_columns) c
    );

    return new;
end;
$$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: admin_optimization_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_optimization_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text DEFAULT 'admin-optimization'::text NOT NULL,
    run_id text NOT NULL,
    focus_area text NOT NULL,
    page_path text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    body text,
    severity text DEFAULT 'medium'::text NOT NULL,
    priority text DEFAULT 'P2'::text NOT NULL,
    friction_total integer DEFAULT 0 NOT NULL,
    friction_band text DEFAULT 'low'::text NOT NULL,
    clicks_saved integer,
    time_saved_min_week integer,
    automation_candidate boolean DEFAULT false NOT NULL,
    automation_recipe text,
    proposed_change jsonb,
    workflow_diagram text,
    is_recurring boolean DEFAULT false NOT NULL,
    evidence jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_optimization_findings_friction_band_check CHECK ((friction_band = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT admin_optimization_findings_priority_check CHECK ((priority = ANY (ARRAY['P0'::text, 'P1'::text, 'P2'::text, 'P3'::text]))),
    CONSTRAINT admin_optimization_findings_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT admin_optimization_findings_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'resolved'::text, 'wont_fix'::text])))
);


--
-- Name: admin_friction_open; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_friction_open AS
 SELECT id,
    focus_area,
    page_path,
    title,
    priority,
    friction_total,
    friction_band,
    clicks_saved,
    time_saved_min_week,
    automation_candidate,
    automation_recipe,
    is_recurring,
    created_at
   FROM public.admin_optimization_findings
  WHERE ((status = ANY (ARRAY['new'::text, 'reviewing'::text])) AND (friction_band = ANY (ARRAY['high'::text, 'critical'::text])))
  ORDER BY friction_total DESC, created_at DESC;


--
-- Name: admin_ux_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_ux_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    page_path text NOT NULL,
    audience text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    proposed_change jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_ux_proposals_audience_check CHECK ((audience = ANY (ARRAY['admin'::text, 'crew'::text, 'public'::text, 'lobby'::text]))),
    CONSTRAINT admin_ux_proposals_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT admin_ux_proposals_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'accepted'::text, 'rejected'::text, 'shipped'::text])))
);


--
-- Name: agent_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    agent_id text NOT NULL,
    action_type text NOT NULL,
    target_table text,
    target_id text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    preview text,
    requires_approval boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    executed_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    action_identity text,
    root_cause_id text,
    root_cause_key text,
    initiative_id uuid,
    superseded_by uuid,
    is_duplicate boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT agent_actions_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT agent_actions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'executed'::text, 'failed'::text])))
);


--
-- Name: agent_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_id uuid,
    agent_id text,
    source_agent text,
    severity text,
    title text,
    message text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT agent_alerts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'ignored'::text])))
);


--
-- Name: agent_config_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_config_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    version integer NOT NULL,
    config jsonb NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    proposal_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_config_versions_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'proposal'::text, 'migration'::text])))
);


--
-- Name: agent_evolutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_evolutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_agent_id text NOT NULL,
    run_id uuid,
    evolution_type text NOT NULL,
    rationale text NOT NULL,
    evidence jsonb,
    proposed_diff jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_evolutions_evolution_type_check CHECK ((evolution_type = ANY (ARRAY['prompt_tweak'::text, 'config_change'::text, 'autonomy_change'::text, 'schedule_change'::text, 'retire'::text, 'new_agent'::text]))),
    CONSTRAINT agent_evolutions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'applied'::text])))
);


--
-- Name: agent_guardrail_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_guardrail_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    agent_id text NOT NULL,
    policy_id text NOT NULL,
    hook text NOT NULL,
    verdict text NOT NULL,
    reason text,
    lineage_depth integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_guardrail_events_verdict_check CHECK ((verdict = ANY (ARRAY['warn'::text, 'modify'::text, 'block'::text, 'allow'::text])))
);


--
-- Name: agent_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    weight real DEFAULT 1.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    trigger text NOT NULL,
    triggered_by uuid,
    status text DEFAULT 'running'::text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    output jsonb,
    summary text,
    error text,
    model text,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    cost_cents integer DEFAULT 0,
    duration_ms integer,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    quality_score double precision,
    quality_signals jsonb DEFAULT '[]'::jsonb,
    cache_read_tokens integer DEFAULT 0,
    cache_creation_tokens integer DEFAULT 0,
    summary_embedding public.vector(1536),
    confidence_score real,
    evidence_payload jsonb,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT agent_runs_confidence_score_check CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::double precision) AND (confidence_score <= (1)::double precision)))),
    CONSTRAINT agent_runs_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT agent_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text, 'needs_approval'::text, 'needs_repair'::text, 'cancelled'::text]))),
    CONSTRAINT agent_runs_trigger_check CHECK ((trigger = ANY (ARRAY['cron'::text, 'manual'::text, 'webhook'::text, 'event'::text])))
);


--
-- Name: agent_workflow_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_workflow_memberships (
    workflow_id text NOT NULL,
    agent_id text NOT NULL,
    "position" integer NOT NULL
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'enabled'::text NOT NULL,
    autonomy text DEFAULT 'review'::text NOT NULL,
    schedule text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_run_at timestamp with time zone,
    last_success_at timestamp with time zone,
    stale_after_minutes integer,
    schema_dependencies text[],
    CONSTRAINT agents_autonomy_check CHECK ((autonomy = ANY (ARRAY['auto'::text, 'review'::text, 'manual'::text]))),
    CONSTRAINT agents_category_check CHECK ((category = ANY (ARRAY['sales'::text, 'support'::text, 'ops'::text, 'hiring'::text, 'finance'::text, 'compliance'::text, 'executive'::text]))),
    CONSTRAINT agents_status_check CHECK ((status = ANY (ARRAY['enabled'::text, 'paused'::text, 'disabled'::text, 'planned'::text, 'idle'::text, 'watch'::text])))
);


--
-- Name: analytics_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid,
    run_id text NOT NULL,
    finding_id text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    severity text NOT NULL,
    priority text NOT NULL,
    metric text,
    body text,
    proposed_action jsonb,
    affected_systems text[],
    backlinks text[],
    correlates_with_deployment boolean DEFAULT false NOT NULL,
    deployment_note text,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT analytics_findings_priority_check CHECK ((priority = ANY (ARRAY['P0'::text, 'P1'::text, 'P2'::text, 'P3'::text]))),
    CONSTRAINT analytics_findings_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT analytics_findings_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'wont_fix'::text])))
);


--
-- Name: analytics_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    period_days integer DEFAULT 14 NOT NULL,
    period_end date NOT NULL,
    executive_summary text,
    funnel_health jsonb,
    cta_health jsonb,
    mobile_health jsonb,
    deployment_correlation jsonb,
    trend_summary text,
    regression_alerts text[],
    posthog_available boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: analytics_funnel_trend; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.analytics_funnel_trend AS
 SELECT period_end,
    ((funnel_health ->> 'weakest_step'::text))::integer AS weakest_step,
    ((funnel_health ->> 'weakest_step_dropout_pct'::text))::numeric AS weakest_step_dropout_pct,
    ((funnel_health ->> 'overall_conversion_rate'::text))::numeric AS overall_conversion_rate
   FROM public.analytics_reports
  WHERE (funnel_health IS NOT NULL)
  ORDER BY period_end DESC
 LIMIT 8;


--
-- Name: analytics_funnels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_funnels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid,
    funnel_name text DEFAULT 'quote'::text NOT NULL,
    step_index integer NOT NULL,
    step_name text NOT NULL,
    entered integer DEFAULT 0 NOT NULL,
    dropped integer DEFAULT 0 NOT NULL,
    drop_rate numeric(5,2) DEFAULT 0 NOT NULL,
    period_end date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: analytics_latest_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.analytics_latest_report AS
 SELECT id,
    run_id,
    period_days,
    period_end,
    executive_summary,
    funnel_health,
    cta_health,
    mobile_health,
    deployment_correlation,
    trend_summary,
    regression_alerts,
    posthog_available,
    created_at,
    ( SELECT count(*) AS count
           FROM public.analytics_findings f
          WHERE (f.report_id = r.id)) AS total_findings,
    ( SELECT count(*) AS count
           FROM public.analytics_findings f
          WHERE ((f.report_id = r.id) AND (f.priority = 'P0'::text))) AS p0_count,
    ( SELECT count(*) AS count
           FROM public.analytics_findings f
          WHERE ((f.report_id = r.id) AND (f.priority = 'P1'::text))) AS p1_count
   FROM public.analytics_reports r
  ORDER BY created_at DESC
 LIMIT 1;


--
-- Name: analytics_open_critical; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.analytics_open_critical AS
 SELECT f.id,
    f.report_id,
    f.finding_id,
    f.category,
    f.title,
    f.severity,
    f.priority,
    f.metric,
    f.proposed_action,
    f.affected_systems,
    f.correlates_with_deployment,
    f.created_at,
    r.period_end
   FROM (public.analytics_findings f
     JOIN public.analytics_reports r ON ((r.id = f.report_id)))
  WHERE ((f.status = 'open'::text) AND (f.priority = ANY (ARRAY['P0'::text, 'P1'::text])))
  ORDER BY
        CASE f.priority
            WHEN 'P0'::text THEN 0
            ELSE 1
        END, f.created_at DESC;


--
-- Name: analytics_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_sessions (
    session_id text NOT NULL,
    referrer text,
    user_agent text,
    city text,
    country text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    is_returning boolean DEFAULT false NOT NULL,
    pages_visited integer DEFAULT 1 NOT NULL,
    total_seconds integer DEFAULT 0 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT analytics_sessions_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text])))
);


--
-- Name: applicants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applicants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    stage text DEFAULT 'intake'::text NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    suburb text,
    availability text[],
    services text[],
    needs_transport boolean DEFAULT false,
    pickup_suburb text,
    max_ride_minutes integer,
    ndis_participant boolean DEFAULT false,
    ndis_number text,
    ndis_funding_type text,
    support_coordinator_contact text,
    mobility_aid text,
    ride_preferences text,
    car_compliant boolean DEFAULT false,
    all_clearances boolean DEFAULT false,
    resume text,
    abn text,
    years_experience integer,
    seats_available integer,
    boot_space text,
    can_carry_aid text,
    pickup_radius_km integer,
    quality_business_name text,
    quality_contribution_types text[],
    quality_message text,
    innovation_organisation text,
    innovation_interest_areas text[],
    innovation_notes text,
    owner text,
    notes text,
    missing_docs text[],
    sla_deadline timestamp with time zone DEFAULT (now() + '72:00:00'::interval),
    consent boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    induction_progress jsonb DEFAULT '{}'::jsonb,
    agent_screened_at timestamp with time zone,
    agent_score integer,
    agent_recommendation text,
    CONSTRAINT applicants_role_check CHECK ((role = ANY (ARRAY['Casual crew'::text, 'Support worker'::text, 'Quality partner'::text, 'Innovation partner'::text]))),
    CONSTRAINT applicants_stage_check CHECK ((stage = ANY (ARRAY['intake'::text, 'verify'::text, 'paperwork'::text, 'induct'::text, 'ready'::text])))
);


--
-- Name: artifact_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifact_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_id uuid NOT NULL,
    version_number integer NOT NULL,
    schema_version text DEFAULT 'artifact.v1'::text NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    plain_text text,
    renderer text DEFAULT 'structured_react'::text NOT NULL,
    render_policy jsonb DEFAULT '{"mode": "structured", "allowHtml": false, "allowExternalAssets": false}'::jsonb NOT NULL,
    generation_input jsonb DEFAULT '{}'::jsonb NOT NULL,
    generation_model text,
    checksum text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artifact_versions_number_check CHECK ((version_number > 0)),
    CONSTRAINT artifact_versions_render_policy_structured_check CHECK (((COALESCE((render_policy ->> 'mode'::text), ''::text) = 'structured'::text) AND (COALESCE(((render_policy ->> 'allowHtml'::text))::boolean, false) = false))),
    CONSTRAINT artifact_versions_renderer_check CHECK ((renderer = 'structured_react'::text))
);


--
-- Name: artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    score numeric,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_context jsonb DEFAULT '{}'::jsonb NOT NULL,
    latest_version_id uuid,
    approved_version_id uuid,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artifacts_score_check CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (100)::numeric)))),
    CONSTRAINT artifacts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'archived'::text]))),
    CONSTRAINT artifacts_type_check CHECK ((type = ANY (ARRAY['campaign'::text, 'research'::text, 'strategy'::text, 'story'::text, 'learning'::text, 'executive'::text, 'quote'::text, 'landing_page'::text, 'marketing'::text, 'dashboard'::text, 'storyboard'::text])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_email text,
    details text
);


--
-- Name: bud_activity_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_activity_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    narrative text NOT NULL,
    actor text,
    target text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bud_approval_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_approval_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid,
    action_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archive_reason text,
    blocked_reason text,
    approval_identity text,
    last_seen_at timestamp with time zone,
    blocked_at timestamp with time zone,
    root_cause_id text,
    root_cause_key text,
    initiative_id uuid,
    superseded_by uuid,
    is_duplicate boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT bud_approval_queue_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT bud_approval_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'archived'::text, 'blocked'::text])))
);


--
-- Name: bud_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    actor_agent text,
    actor_user uuid,
    target_table text,
    target_id text,
    before_state jsonb,
    after_state jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bud_browser_test_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_browser_test_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    step_id uuid,
    test_dir text DEFAULT 'tests/e2e/golden-paths'::text NOT NULL,
    project text DEFAULT 'chromium'::text NOT NULL,
    exit_code integer,
    passed integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    skipped integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    failures jsonb,
    raw_output text,
    stderr_output text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bud_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid,
    branch_name text,
    issue_url text,
    pr_url text,
    deployment_url text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_change_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'merged'::text, 'closed'::text, 'deployed'::text, 'stale'::text])))
);


--
-- Name: bud_circuit_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_circuit_states (
    id text NOT NULL,
    state text DEFAULT 'closed'::text NOT NULL,
    failure_streak integer DEFAULT 0 NOT NULL,
    probe_successes integer DEFAULT 0 NOT NULL,
    last_failure_at timestamp with time zone,
    last_success_at timestamp with time zone,
    opens_at timestamp with time zone,
    resets_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_circuit_states_state_check CHECK ((state = ANY (ARRAY['closed'::text, 'open'::text, 'half_open'::text])))
);


--
-- Name: bud_convention_learnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_convention_learnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    rule text NOT NULL,
    category text DEFAULT 'pattern'::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    severity text DEFAULT 'error'::text NOT NULL,
    example_wrong text,
    example_correct text,
    session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_convention_learnings_category_check CHECK ((category = ANY (ARRAY['design'::text, 'import'::text, 'pattern'::text, 'agent'::text, 'other'::text]))),
    CONSTRAINT bud_convention_learnings_severity_check CHECK ((severity = ANY (ARRAY['warning'::text, 'error'::text]))),
    CONSTRAINT bud_convention_learnings_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'pipeline'::text, 'auto'::text])))
);


--
-- Name: bud_deployment_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_deployment_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    deployment_url text,
    environment text DEFAULT 'preview'::text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    checks jsonb DEFAULT '[]'::jsonb NOT NULL,
    route_results jsonb DEFAULT '[]'::jsonb NOT NULL,
    api_results jsonb DEFAULT '[]'::jsonb NOT NULL,
    console_errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    performance jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT bud_deployment_verifications_status_check CHECK ((status = ANY (ARRAY['running'::text, 'passed'::text, 'failed'::text, 'blocked'::text])))
);


--
-- Name: bud_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'recorded'::text NOT NULL,
    task_id uuid,
    command text,
    file_path text,
    deployment_id text,
    summary text,
    raw_output text,
    stderr text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_evidence_source_check CHECK ((source = ANY (ARRAY['bud_terminal'::text, 'github_webhook'::text, 'cron'::text, 'manual'::text, 'session_hook'::text]))),
    CONSTRAINT bud_evidence_status_check CHECK ((status = ANY (ARRAY['recorded'::text, 'passed'::text, 'failed'::text, 'blocked'::text]))),
    CONSTRAINT bud_evidence_type_check CHECK ((type = ANY (ARRAY['terminal_command'::text, 'build_output'::text, 'lint_output'::text, 'test_output'::text, 'git_diff'::text, 'deployment'::text, 'graphify'::text, 'approval'::text, 'learning'::text])))
);


--
-- Name: bud_improvement_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_improvement_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    signal_id uuid,
    status text DEFAULT 'detected'::text NOT NULL,
    trigger text DEFAULT 'manual'::text NOT NULL,
    title text NOT NULL,
    approach text,
    diff_summary text,
    branch_name text,
    pr_url text,
    issue_url text,
    confidence double precision,
    risk_score integer,
    ci_conclusion text,
    ci_run_url text,
    ci_workflow_run_id text,
    verification_status text,
    taste_score double precision,
    taste_pass boolean,
    taste_violations jsonb,
    taste_suggestions jsonb,
    taste_checked_files jsonb,
    taste_checked_at timestamp with time zone,
    browser_tests_passed integer,
    browser_tests_failed integer,
    browser_tests_total integer,
    browser_test_status text,
    auto_merged boolean DEFAULT false,
    auto_merged_at timestamp with time zone,
    auto_merge_blocked_reason text,
    rollback_reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    root_cause_id text,
    root_cause_key text,
    initiative_id uuid
);


--
-- Name: bud_improvement_learnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_improvement_learnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    signal_id uuid,
    memory_doc_id uuid,
    signal_type text,
    improvement_pattern text NOT NULL,
    outcome text NOT NULL,
    affected_area text,
    notes text,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bud_improvement_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_improvement_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    step_id uuid,
    level text DEFAULT 'info'::text NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bud_improvement_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_improvement_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    signal_type text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    title text NOT NULL,
    description text,
    affected_area text,
    proposed_approach text,
    reference_files text[],
    metadata jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fingerprint text,
    root_cause_id text,
    root_cause_key text,
    initiative_id uuid,
    duplicate_of uuid,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT bud_improvement_signals_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text])))
);


--
-- Name: bud_improvement_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_improvement_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    state text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    summary text,
    evidence jsonb,
    confidence double precision,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);


--
-- Name: bud_improvements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_improvements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    issue text NOT NULL,
    root_cause text,
    source text DEFAULT 'manual'::text NOT NULL,
    evidence_type text,
    evidence_ref text,
    affected_files text[] DEFAULT '{}'::text[] NOT NULL,
    risk_level text DEFAULT 'low'::text NOT NULL,
    rollback_plan text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT bud_improvements_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT bud_improvements_source_check CHECK ((source = ANY (ARRAY['vault'::text, 'graphify'::text, 'manual'::text, 'agent'::text]))),
    CONSTRAINT bud_improvements_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'dismissed'::text])))
);


--
-- Name: bud_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text,
    workflow_id text,
    category text NOT NULL,
    severity text NOT NULL,
    title text NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_insights_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: bud_lobby_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_lobby_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    operational_status text DEFAULT 'nominal'::text NOT NULL,
    bud_state text DEFAULT 'idle'::text NOT NULL,
    summary text,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    workflows jsonb DEFAULT '[]'::jsonb NOT NULL,
    kpis jsonb DEFAULT '{}'::jsonb NOT NULL,
    agent_states jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    CONSTRAINT bud_lobby_states_bud_state_check CHECK ((bud_state = ANY (ARRAY['thinking'::text, 'investigating'::text, 'repairing'::text, 'testing'::text, 'reviewing'::text, 'deploying'::text, 'learning'::text, 'idle'::text]))),
    CONSTRAINT bud_lobby_states_operational_status_check CHECK ((operational_status = ANY (ARRAY['nominal'::text, 'elevated'::text, 'critical'::text])))
);


--
-- Name: bud_repair_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_repair_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid,
    source_agent text,
    trigger text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'detected'::text NOT NULL,
    root_cause_type text,
    root_cause_summary text,
    repair_strategy jsonb DEFAULT '{}'::jsonb NOT NULL,
    risk_score numeric(5,2) DEFAULT 50 NOT NULL,
    confidence numeric(4,3),
    branch_name text,
    commit_sha text,
    diff_summary text,
    pr_url text,
    deployment_url text,
    verification_status text DEFAULT 'not_started'::text NOT NULL,
    rollback_trace jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ci_workflow_run_id text,
    ci_conclusion text,
    ci_run_url text,
    rollback_reason text,
    taste_score numeric(4,3),
    taste_pass boolean,
    taste_violations jsonb,
    taste_suggestions jsonb,
    taste_checked_files jsonb,
    taste_checked_at timestamp with time zone,
    browser_tests_passed integer,
    browser_tests_failed integer,
    browser_tests_total integer,
    browser_test_status text,
    browser_test_run_id uuid,
    issue_url text,
    intelligence_summary text,
    CONSTRAINT bud_repair_executions_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT bud_repair_executions_risk_score_check CHECK (((risk_score >= (0)::numeric) AND (risk_score <= (100)::numeric))),
    CONSTRAINT bud_repair_executions_status_check CHECK ((status = ANY (ARRAY['detected'::text, 'reproducing'::text, 'analyzing'::text, 'planning'::text, 'awaiting_approval'::text, 'patching'::text, 'validating'::text, 'deploying'::text, 'verifying'::text, 'monitoring'::text, 'recovered'::text, 'rolled_back'::text, 'blocked'::text, 'failed'::text]))),
    CONSTRAINT bud_repair_executions_trigger_check CHECK ((trigger = ANY (ARRAY['manual'::text, 'detected'::text, 'cron'::text, 'approval'::text, 'terminal'::text]))),
    CONSTRAINT bud_repair_executions_verification_status_check CHECK ((verification_status = ANY (ARRAY['not_started'::text, 'running'::text, 'passed'::text, 'failed'::text, 'blocked'::text])))
);


--
-- Name: bud_repair_learnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_repair_learnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    task_id uuid,
    memory_doc_id uuid,
    root_cause_type text,
    fix_pattern text NOT NULL,
    outcome text NOT NULL,
    confidence_delta numeric(5,2),
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    summary_embedding public.vector(1536),
    CONSTRAINT bud_repair_learnings_outcome_check CHECK ((outcome = ANY (ARRAY['recovered'::text, 'blocked'::text, 'failed'::text, 'rolled_back'::text])))
);


--
-- Name: bud_repair_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_repair_logs (
    id bigint NOT NULL,
    execution_id uuid NOT NULL,
    step_id uuid,
    level text DEFAULT 'info'::text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_repair_logs_level_check CHECK ((level = ANY (ARRAY['debug'::text, 'info'::text, 'warn'::text, 'error'::text])))
);


--
-- Name: bud_repair_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bud_repair_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bud_repair_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bud_repair_logs_id_seq OWNED BY public.bud_repair_logs.id;


--
-- Name: bud_repair_quarantine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_repair_quarantine (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch text NOT NULL,
    commit_sha text,
    deployment_id text,
    error_text text,
    failing_file text,
    failing_line integer,
    source_agent text,
    rejection_reason text,
    attempt_count integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'blocked_for_repair'::text NOT NULL,
    blocked_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_repair_quarantine_status_check CHECK ((status = ANY (ARRAY['blocked_for_repair'::text, 'abandoned'::text, 'resolved'::text])))
);


--
-- Name: bud_repair_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_repair_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    state text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    summary text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    confidence numeric(4,3),
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT bud_repair_steps_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT bud_repair_steps_state_check CHECK ((state = ANY (ARRAY['detected'::text, 'reproducing'::text, 'analyzing'::text, 'planning'::text, 'awaiting_approval'::text, 'patching'::text, 'validating'::text, 'deploying'::text, 'verifying'::text, 'monitoring'::text, 'recovered'::text, 'rolled_back'::text, 'blocked'::text, 'failed'::text]))),
    CONSTRAINT bud_repair_steps_status_check CHECK ((status = ANY (ARRAY['running'::text, 'passed'::text, 'failed'::text, 'blocked'::text, 'skipped'::text])))
);


--
-- Name: bud_rollback_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_rollback_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid,
    agent_id text,
    trigger text NOT NULL,
    branch_name text,
    ci_conclusion text,
    ci_run_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bud_root_cause_initiatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_root_cause_initiatives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    root_cause_id text NOT NULL,
    root_cause_key text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    signal_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    approval_count integer DEFAULT 0 NOT NULL,
    latest_signal_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT bud_root_cause_initiatives_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT bud_root_cause_initiatives_status_check CHECK ((status = ANY (ARRAY['open'::text, 'patching'::text, 'validating'::text, 'merged'::text, 'resolved'::text, 'blocked'::text, 'archived'::text])))
);


--
-- Name: bud_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_agent text,
    target_agent text,
    status text DEFAULT 'pending'::text NOT NULL,
    confidence numeric(4,3),
    risk_level text,
    description text NOT NULL,
    autonomy_level integer DEFAULT 2 NOT NULL,
    linked_issue text,
    linked_pr text,
    linked_deployment text,
    linked_memory_note text,
    raw_input jsonb,
    raw_output jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bud_tasks_autonomy_level_check CHECK (((autonomy_level >= 0) AND (autonomy_level <= 5))),
    CONSTRAINT bud_tasks_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT bud_tasks_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT bud_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'detected'::text, 'reproducing'::text, 'analyzing'::text, 'planning'::text, 'awaiting_approval'::text, 'patching'::text, 'validating'::text, 'deploying'::text, 'verifying'::text, 'monitoring'::text, 'recovered'::text, 'rolled_back'::text, 'blocked'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'archived'::text])))
);


--
-- Name: bud_telemetry_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_telemetry_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    improvement_id uuid,
    repair_id uuid,
    event_type text NOT NULL,
    branch_name text,
    pr_number integer,
    deployment_url text,
    metric_name text,
    metric_value double precision,
    threshold double precision,
    baseline double precision,
    rollback_triggered boolean DEFAULT false,
    rollback_notes text,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bud_terminal_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bud_terminal_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    command text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    output text,
    exit_code integer,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT bud_terminal_sessions_status_check CHECK ((status = ANY (ARRAY['running'::text, 'passed'::text, 'failed'::text, 'blocked'::text])))
);


--
-- Name: campaign_factory_run_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_factory_run_artifacts (
    run_id uuid NOT NULL,
    artifact_id uuid NOT NULL,
    role text DEFAULT 'primary'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_factory_run_artifacts_role_check CHECK ((role = ANY (ARRAY['primary'::text, 'supporting'::text, 'approved_output'::text])))
);


--
-- Name: campaign_factory_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_factory_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    current_step text DEFAULT 'goal'::text NOT NULL,
    selected_story_opportunity_id uuid,
    campaign_id uuid,
    signals jsonb DEFAULT '{}'::jsonb NOT NULL,
    research_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    strategy jsonb DEFAULT '{}'::jsonb NOT NULL,
    approval_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT campaign_factory_runs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'collecting_signals'::text, 'researching'::text, 'strategizing'::text, 'artifact_review'::text, 'approved'::text, 'rejected'::text, 'archived'::text])))
);


--
-- Name: capture_briefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capture_briefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brief_date date NOT NULL,
    job_context text,
    shot_list text[] DEFAULT '{}'::text[],
    say_to_camera text,
    run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cash_flow_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_flow_forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    weeks jsonb NOT NULL,
    warnings text[] DEFAULT '{}'::text[]
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_type text NOT NULL,
    name text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: classification_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classification_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    make text NOT NULL,
    model text NOT NULL,
    detected_category text NOT NULL,
    user_selected_category text NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT classification_feedback_detected_category_check CHECK ((detected_category = ANY (ARRAY['hatch'::text, 'sedan'::text, 'suv'::text, 'ute'::text, 'van'::text, '4wd'::text, 'luxury'::text, 'muscle'::text]))),
    CONSTRAINT classification_feedback_user_selected_category_check CHECK ((user_selected_category = ANY (ARRAY['hatch'::text, 'sedan'::text, 'suv'::text, 'ute'::text, 'van'::text, '4wd'::text, 'luxury'::text, 'muscle'::text])))
);


--
-- Name: client_agreements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    quote_id uuid,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text,
    service_type text NOT NULL,
    service_context text NOT NULL,
    service_address text,
    scheduled_date date,
    agreed_price numeric(10,2),
    filming_consent_ops boolean DEFAULT false NOT NULL,
    filming_consent_marketing boolean DEFAULT false NOT NULL,
    is_ndis boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    docusign_envelope_id text,
    created_by text,
    sent_at timestamp with time zone,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_agreements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'signed'::text, 'declined'::text, 'voided'::text])))
);


--
-- Name: competitor_intel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_intel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competitor_name text NOT NULL,
    url text NOT NULL,
    suburb text,
    service text,
    price_aud numeric,
    price_unit text,
    promo text,
    raw_snippet text,
    confidence real DEFAULT 0.5,
    source_query text,
    scraped_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: competitor_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competitor text NOT NULL,
    url text NOT NULL,
    last_snapshot text,
    last_checked timestamp with time zone,
    change_notes jsonb DEFAULT '[]'::jsonb
);


--
-- Name: content_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    asset_type text DEFAULT 'other'::text NOT NULL,
    source_url text DEFAULT ''::text NOT NULL,
    production_card_id uuid,
    idea_id uuid,
    script_id uuid,
    consent_status text DEFAULT 'unknown'::text NOT NULL,
    related_characters text[] DEFAULT '{}'::text[] NOT NULL,
    related_customer text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_assets_asset_type_check CHECK ((asset_type = ANY (ARRAY['footage'::text, 'photo'::text, 'graphic'::text, 'testimonial'::text, 'other'::text]))),
    CONSTRAINT content_assets_consent_status_check CHECK ((consent_status = ANY (ARRAY['unknown'::text, 'not_required'::text, 'pending'::text, 'confirmed'::text, 'denied'::text]))),
    CONSTRAINT content_assets_denied_not_in_production CHECK (((consent_status <> 'denied'::text) OR (production_card_id IS NULL)))
);


--
-- Name: content_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    run_id uuid,
    channel text NOT NULL,
    title text,
    body text NOT NULL,
    photo_ids uuid[] DEFAULT '{}'::uuid[],
    hashtags text[] DEFAULT '{}'::text[],
    status text DEFAULT 'draft'::text NOT NULL,
    scheduled_for timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    campaign_id uuid,
    CONSTRAINT content_drafts_channel_check CHECK ((channel = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'facebook'::text, 'gbp'::text, 'blog'::text, 'email'::text]))),
    CONSTRAINT content_drafts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'scheduled'::text, 'published'::text, 'rejected'::text])))
);


--
-- Name: content_ideas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_ideas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    opportunity_id uuid,
    related_arc_id uuid,
    related_characters text[] DEFAULT '{}'::text[] NOT NULL,
    platform_fit text DEFAULT ''::text NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    hook text DEFAULT ''::text NOT NULL,
    content_angle text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'captured'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idea_score integer,
    score_breakdown jsonb,
    score_reason text,
    scored_at timestamp with time zone,
    CONSTRAINT content_ideas_idea_score_check CHECK (((idea_score >= 0) AND (idea_score <= 100))),
    CONSTRAINT content_ideas_status_check CHECK ((status = ANY (ARRAY['captured'::text, 'developed'::text, 'approved'::text, 'scripted'::text, 'archived'::text])))
);


--
-- Name: content_learning_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_learning_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_factory_run_id uuid,
    campaign_id uuid,
    learning_artifact_id uuid,
    goal text NOT NULL,
    campaign_title text NOT NULL,
    source_artifact_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    source_library_item_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    outcome_score jsonb DEFAULT '{}'::jsonb NOT NULL,
    results jsonb DEFAULT '{}'::jsonb NOT NULL,
    what_worked jsonb DEFAULT '[]'::jsonb NOT NULL,
    what_failed jsonb DEFAULT '[]'::jsonb NOT NULL,
    supporting_evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    recommended_future_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence numeric DEFAULT 0 NOT NULL,
    confidence_reason text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_learning_records_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (100)::numeric))),
    CONSTRAINT content_learning_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'archived'::text])))
);


--
-- Name: content_library_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_library_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_type text NOT NULL,
    source_table text NOT NULL,
    source_id uuid NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    campaign_id uuid,
    artifact_id uuid,
    platform text,
    status text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    performance jsonb DEFAULT '{}'::jsonb NOT NULL,
    searchable_text text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_production_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_production_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    script_id uuid NOT NULL,
    title text NOT NULL,
    platform text DEFAULT ''::text NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    related_arc_id uuid,
    related_characters text[] DEFAULT '{}'::text[] NOT NULL,
    deadline date,
    status text DEFAULT 'to_film'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_production_cards_status_check CHECK ((status = ANY (ARRAY['to_film'::text, 'in_edit'::text, 'ready_to_publish'::text, 'published'::text])))
);


--
-- Name: content_scripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_scripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idea_id uuid NOT NULL,
    hook text DEFAULT ''::text NOT NULL,
    setup text DEFAULT ''::text NOT NULL,
    core_moment text DEFAULT ''::text NOT NULL,
    close_cta text DEFAULT ''::text NOT NULL,
    platform text DEFAULT ''::text NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_ai_generated boolean DEFAULT false NOT NULL,
    generation_model text,
    CONSTRAINT content_scripts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'archived'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    subject text,
    status text DEFAULT 'open'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT conversations_entity_type_check CHECK ((entity_type = ANY (ARRAY['customer'::text, 'crew'::text, 'lead'::text, 'applicant'::text]))),
    CONSTRAINT conversations_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: crew_coach_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crew_coach_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crew_member_id uuid NOT NULL,
    run_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    strengths text[] DEFAULT '{}'::text[],
    growth_areas text[] DEFAULT '{}'::text[],
    notable_jobs jsonb DEFAULT '[]'::jsonb,
    summary text,
    shared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    address text,
    gate_code text,
    pet_warnings text,
    parking text,
    special_instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text,
    phone text,
    region text,
    company_name text,
    abn text,
    default_address text,
    latitude numeric,
    longitude numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT customers_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text])))
);


--
-- Name: design_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id text NOT NULL,
    audit_date date NOT NULL,
    overall_score integer NOT NULL,
    score_label text NOT NULL,
    area_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    executive_summary text,
    quick_wins text[],
    violation_count integer DEFAULT 0 NOT NULL,
    p0_count integer DEFAULT 0 NOT NULL,
    p1_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_audits_overall_score_check CHECK (((overall_score >= 0) AND (overall_score <= 100))),
    CONSTRAINT design_audits_score_label_check CHECK ((score_label = ANY (ARRAY['critical'::text, 'poor'::text, 'fair'::text, 'good'::text, 'excellent'::text])))
);


--
-- Name: design_violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_id uuid,
    run_id text NOT NULL,
    violation_id text NOT NULL,
    area text NOT NULL,
    title text NOT NULL,
    severity text NOT NULL,
    priority text NOT NULL,
    component text,
    violation_type text NOT NULL,
    description text,
    proposed_fix text,
    affected_files text[],
    effort text,
    backlinks text[],
    status text DEFAULT 'open'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_violations_priority_check CHECK ((priority = ANY (ARRAY['P0'::text, 'P1'::text, 'P2'::text, 'P3'::text]))),
    CONSTRAINT design_violations_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT design_violations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'wont_fix'::text, 'accepted'::text]))),
    CONSTRAINT design_violations_violation_type_check CHECK ((violation_type = ANY (ARRAY['drift'::text, 'duplication'::text, 'missing-token'::text, 'accessibility'::text, 'simplicity'::text, 'spacing'::text])))
);


--
-- Name: design_duplication_queue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.design_duplication_queue AS
 SELECT id,
    violation_id,
    title,
    component,
    description,
    proposed_fix,
    effort,
    created_at
   FROM public.design_violations v
  WHERE ((violation_type = 'duplication'::text) AND (status = 'open'::text))
  ORDER BY priority, created_at DESC;


--
-- Name: design_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    run_id uuid,
    page_path text,
    insight_type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb,
    proposed_change jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT design_insights_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT design_insights_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'accepted'::text, 'rejected'::text, 'shipped'::text])))
);


--
-- Name: design_latest_audit; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.design_latest_audit AS
 SELECT id,
    run_id,
    audit_date,
    overall_score,
    score_label,
    area_scores,
    executive_summary,
    violation_count,
    p0_count,
    p1_count,
    created_at
   FROM public.design_audits a
  ORDER BY audit_date DESC
 LIMIT 1;


--
-- Name: design_open_critical; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.design_open_critical AS
 SELECT v.id,
    v.audit_id,
    v.violation_id,
    v.area,
    v.title,
    v.severity,
    v.priority,
    v.component,
    v.violation_type,
    v.description,
    v.proposed_fix,
    v.effort,
    v.affected_files,
    v.created_at,
    a.audit_date
   FROM (public.design_violations v
     JOIN public.design_audits a ON ((a.id = v.audit_id)))
  WHERE ((v.status = 'open'::text) AND (v.priority = ANY (ARRAY['P0'::text, 'P1'::text])))
  ORDER BY
        CASE v.priority
            WHEN 'P0'::text THEN 0
            ELSE 1
        END,
        CASE v.severity
            WHEN 'critical'::text THEN 0
            WHEN 'high'::text THEN 1
            ELSE 2
        END, v.created_at DESC;


--
-- Name: design_score_trend; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.design_score_trend AS
 SELECT audit_date,
    overall_score,
    score_label,
    violation_count,
    p0_count,
    p1_count,
    ((area_scores ->> 'glass-consistency'::text))::integer AS glass_score,
    ((area_scores ->> 'typography-hierarchy'::text))::integer AS typography_score,
    ((area_scores ->> 'component-duplication'::text))::integer AS duplication_score,
    ((area_scores ->> 'apple-simplicity'::text))::integer AS simplicity_score
   FROM public.design_audits
  ORDER BY audit_date DESC
 LIMIT 8;


--
-- Name: dev_os_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dev_os_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text,
    agents_used text[] DEFAULT '{}'::text[] NOT NULL,
    task text,
    files_changed text[] DEFAULT '{}'::text[] NOT NULL,
    summary text,
    risk_level text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: efficiency_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.efficiency_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text DEFAULT 'efficiency-architect'::text NOT NULL,
    run_id text NOT NULL,
    domain text NOT NULL,
    title text NOT NULL,
    body text,
    severity text DEFAULT 'medium'::text NOT NULL,
    priority text DEFAULT 'P2'::text NOT NULL,
    affected_agents text[] DEFAULT '{}'::text[] NOT NULL,
    affected_workflows text[] DEFAULT '{}'::text[] NOT NULL,
    current_cost text,
    proposed_fix text,
    estimated_saving text,
    automation_candidate boolean DEFAULT false NOT NULL,
    automation_trigger text,
    automation_action text,
    evidence jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT efficiency_findings_domain_check CHECK ((domain = ANY (ARRAY['agent_fleet'::text, 'workflow_redundancy'::text, 'automation_gap'::text, 'operational_throughput'::text]))),
    CONSTRAINT efficiency_findings_priority_check CHECK ((priority = ANY (ARRAY['P0'::text, 'P1'::text, 'P2'::text, 'P3'::text]))),
    CONSTRAINT efficiency_findings_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT efficiency_findings_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'resolved'::text, 'wont_fix'::text])))
);


--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    doc_type text NOT NULL,
    file_url text,
    file_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    storage_path text,
    file_size integer,
    mime_type text,
    CONSTRAINT employee_documents_doc_type_check CHECK ((doc_type = ANY (ARRAY['wwcc'::text, 'police_check'::text, 'first_aid'::text, 'cpr_certificate'::text, 'ndis_orientation'::text, 'ndis_screening'::text, 'drivers_license'::text, 'vehicle_registration'::text, 'vehicle_insurance'::text, 'abn'::text, 'insurance'::text, 'public_liability'::text, 'resume'::text, 'references'::text, 'other'::text]))),
    CONSTRAINT employee_documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: employee_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_onboarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    section text NOT NULL,
    responses jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_onboarding_section_check CHECK ((section = ANY (ARRAY['personal'::text, 'emergency'::text, 'availability'::text, 'services'::text, 'documents'::text, 'ndis'::text])))
);


--
-- Name: employee_payroll_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_payroll_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    tfn_declaration_received boolean DEFAULT false NOT NULL,
    bank_details_received boolean DEFAULT false NOT NULL,
    super_details_received boolean DEFAULT false NOT NULL,
    right_to_work_confirmed boolean DEFAULT false NOT NULL,
    employment_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tfn text,
    bank_bsb text,
    bank_account_number text,
    bank_account_name text,
    bank_institution text,
    super_fund_name text,
    super_usi text,
    super_member_number text,
    right_to_work_type text,
    right_to_work_visa_subclass text,
    right_to_work_expiry date,
    CONSTRAINT employee_payroll_details_employment_type_check CHECK ((employment_type = ANY (ARRAY['casual'::text, 'contractor'::text, 'volunteer'::text, 'trainee'::text, 'part_time'::text, 'full_time'::text]))),
    CONSTRAINT employee_payroll_details_right_to_work_type_check CHECK ((right_to_work_type = ANY (ARRAY['citizen'::text, 'permanent_resident'::text, 'work_visa'::text, 'other'::text])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    suburb text,
    availability text[],
    services text[],
    bio text,
    emergency_contact_name text,
    emergency_contact_phone text,
    onboarding_complete boolean DEFAULT false NOT NULL,
    ndis_worker boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    photo_url text,
    hourly_rate numeric(8,2) DEFAULT 25.00 NOT NULL,
    crew_access_approved boolean DEFAULT false NOT NULL,
    default_role text,
    employment_type text DEFAULT 'casual'::text NOT NULL,
    roster_active boolean DEFAULT true NOT NULL,
    CONSTRAINT employees_employment_type_check CHECK ((employment_type = ANY (ARRAY['casual'::text, 'contractor'::text, 'part_time'::text, 'full_time'::text]))),
    CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);


--
-- Name: employment_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    employee_name text NOT NULL,
    employee_email text NOT NULL,
    contract_type text NOT NULL,
    prev_rate numeric(8,2),
    new_rate numeric(8,2),
    prev_employment_type text,
    new_employment_type text,
    prev_role text,
    new_role text,
    effective_date date,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    docusign_envelope_id text,
    created_by text,
    sent_at timestamp with time zone,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employment_contracts_contract_type_check CHECK ((contract_type = ANY (ARRAY['pay_amendment'::text, 'employment_type_change'::text, 'role_change'::text, 'general_amendment'::text]))),
    CONSTRAINT employment_contracts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'signed'::text, 'declined'::text, 'voided'::text])))
);


--
-- Name: executive_agent_runs_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_agent_runs_meta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    agent_id text NOT NULL,
    decisions integer DEFAULT 0 NOT NULL,
    tasks integer DEFAULT 0 NOT NULL,
    auto_executed integer DEFAULT 0 NOT NULL,
    queued_approvals integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: executive_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    run_id uuid,
    title text NOT NULL,
    reasoning text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence numeric(4,3) NOT NULL,
    risk_level text NOT NULL,
    expected_impact text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    executed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT executive_decisions_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric))),
    CONSTRAINT executive_decisions_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT executive_decisions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'executed'::text, 'deferred'::text])))
);


--
-- Name: executive_directives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_directives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    issued_by text DEFAULT 'ceo-agent'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    target_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT executive_directives_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: executive_kpi_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_kpi_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kpi_key text NOT NULL,
    label text NOT NULL,
    target numeric(14,4) NOT NULL,
    unit text DEFAULT 'number'::text NOT NULL,
    owner text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    set_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: executive_metrics_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_metrics_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    revenue_7d_aud numeric(12,2),
    jobs_7d integer,
    leads_7d integer,
    conversion_rate numeric(5,4),
    avg_job_value numeric(10,2),
    cash_position numeric(12,2),
    crew_utilisation numeric(5,4),
    raw jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: executive_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    decision_id uuid,
    source_agent_id text NOT NULL,
    target_agent_id text,
    title text NOT NULL,
    description text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT executive_tasks_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'normal'::text, 'low'::text]))),
    CONSTRAINT executive_tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: executive_weekly_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executive_weekly_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    week_start date NOT NULL,
    summary text NOT NULL,
    wins jsonb DEFAULT '[]'::jsonb NOT NULL,
    risks jsonb DEFAULT '[]'::jsonb NOT NULL,
    priorities jsonb DEFAULT '[]'::jsonb NOT NULL,
    agent_learnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: foreman_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foreman_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id text,
    workflow_id text,
    category text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    title text NOT NULL,
    body text,
    resolved_at timestamp with time zone,
    resolved_by text,
    CONSTRAINT foreman_insights_category_check CHECK ((category = ANY (ARRAY['bottleneck'::text, 'anomaly'::text, 'pattern'::text, 'opportunity'::text, 'risk'::text]))),
    CONSTRAINT foreman_insights_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: foreman_lobby_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foreman_lobby_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    operational_status text DEFAULT 'nominal'::text NOT NULL,
    summary text,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    workflows jsonb DEFAULT '[]'::jsonb NOT NULL,
    kpis jsonb DEFAULT '{}'::jsonb NOT NULL,
    agent_states jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    CONSTRAINT foreman_lobby_states_operational_status_check CHECK ((operational_status = ANY (ARRAY['nominal'::text, 'elevated'::text, 'critical'::text])))
);


--
-- Name: founder_journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.founder_journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    wins text,
    challenges text,
    customer_activity text,
    silvan_updates text,
    business_progress text,
    bud_os_progress text,
    memorable_moments text,
    lessons_learned text,
    content_potential_notes text,
    media_references text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    content_potential_rating text DEFAULT 'none'::text NOT NULL,
    arc_connections text[] DEFAULT '{}'::text[] NOT NULL,
    story_opportunity_created boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_capture text,
    suggested_story_bible_note text,
    suggested_character_timeline_entry text,
    suggested_arc_update text,
    suggested_open_thread_update text,
    suggestion_story_bible_status text DEFAULT 'pending'::text,
    suggestion_character_timeline_status text DEFAULT 'pending'::text,
    suggestion_arc_status text DEFAULT 'pending'::text,
    suggestion_open_thread_status text DEFAULT 'pending'::text,
    suggestion_story_bible_target text,
    suggestion_character_timeline_target uuid,
    suggestion_arc_target uuid,
    suggestion_open_thread_target uuid,
    CONSTRAINT founder_journal_entries_content_potential_rating_check CHECK ((content_potential_rating = ANY (ARRAY['none'::text, 'low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: fundraising_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fundraising_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fundraising_item_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'aud'::text NOT NULL,
    payment_provider text DEFAULT 'stripe'::text NOT NULL,
    payment_reference text,
    stripe_event_id text,
    payer_name text,
    payer_email text,
    status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gross_amount_cents integer NOT NULL,
    stripe_fee_cents integer DEFAULT 0 NOT NULL,
    net_amount_cents integer NOT NULL,
    CONSTRAINT fundraising_contributions_amount_cents_check CHECK ((amount_cents >= 0)),
    CONSTRAINT fundraising_contributions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])))
);


--
-- Name: fundraising_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fundraising_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    image_url text,
    goal_amount_cents integer DEFAULT 0 NOT NULL,
    raised_amount_cents integer DEFAULT 0 NOT NULL,
    short_reason text,
    who_it_helps text,
    employment_impact text,
    cta_label text DEFAULT 'Fund This'::text NOT NULL,
    payment_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    manual_adjustment_cents integer DEFAULT 0 NOT NULL,
    supplier_url text,
    stripe_payment_link_id text,
    stripe_price_id text,
    CONSTRAINT fundraising_items_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'live'::text, 'funded'::text, 'archived'::text])))
);


--
-- Name: github_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.github_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_id text NOT NULL,
    event_type text NOT NULL,
    action text,
    repo text,
    metadata jsonb,
    status text DEFAULT 'received'::text NOT NULL,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT github_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'error'::text, 'pending'::text, 'flagged'::text])))
);


--
-- Name: github_adr_queue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.github_adr_queue AS
 SELECT id,
    delivery_id,
    repo,
    (metadata ->> 'pr_number'::text) AS pr_number,
    (metadata ->> 'pr_title'::text) AS pr_title,
    (metadata -> 'affected_systems'::text) AS affected_systems,
    (metadata ->> 'note'::text) AS note,
    created_at
   FROM public.github_events
  WHERE ((event_type = 'adr_flag'::text) AND (status = 'pending'::text))
  ORDER BY created_at DESC;


--
-- Name: github_recent_failures; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.github_recent_failures AS
 SELECT id,
    (metadata ->> 'environment'::text) AS environment,
    (metadata ->> 'sha'::text) AS sha,
    (metadata ->> 'branch'::text) AS branch,
    (metadata ->> 'description'::text) AS description,
    (metadata ->> 'url'::text) AS url,
    created_at
   FROM public.github_events
  WHERE (event_type = 'deployment_failure'::text)
  ORDER BY created_at DESC
 LIMIT 20;


--
-- Name: growth_pipeline_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.growth_pipeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    source_type text,
    source_id uuid,
    result_type text,
    result_id uuid,
    journal_entry_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    accepted_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_assignments_status_check CHECK ((status = ANY (ARRAY['available'::text, 'accepted'::text, 'declined'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: job_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    checklist_responses jsonb DEFAULT '[]'::jsonb,
    notes text,
    photos text[],
    completed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_participant_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_participant_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    max_score integer DEFAULT 100 NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    kind text NOT NULL,
    storage_path text NOT NULL,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    qa_score integer,
    qa_notes text,
    marketing_ok boolean DEFAULT false,
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT job_photos_kind_check CHECK ((kind = ANY (ARRAY['before'::text, 'after'::text, 'damage'::text, 'note'::text])))
);


--
-- Name: job_publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_publications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    published_by uuid,
    status text DEFAULT 'published'::text NOT NULL,
    override_reason text,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT jp_status_check CHECK ((status = ANY (ARRAY['published'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])))
);


--
-- Name: job_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    estimated_duration_minutes integer,
    required_support_mode text DEFAULT 'any'::text NOT NULL,
    physical_intensity text DEFAULT 'medium'::text NOT NULL,
    transport_required boolean DEFAULT false NOT NULL,
    customer_facing_required boolean DEFAULT true NOT NULL,
    service_type text,
    location_suburb text,
    location_lat numeric,
    location_lng numeric,
    start_time time without time zone,
    end_time time without time zone,
    can_split_shift boolean DEFAULT false NOT NULL,
    requires_team boolean DEFAULT false NOT NULL,
    risk_notes text,
    ndis_matching_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT jr_physical_intensity_check CHECK ((physical_intensity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT jr_support_mode_check CHECK ((required_support_mode = ANY (ARRAY['independent'::text, 'supported'::text, 'team_based'::text, 'any'::text])))
);


--
-- Name: job_variations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_variations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    original_service text NOT NULL,
    original_price numeric(10,2) NOT NULL,
    variation_description text NOT NULL,
    additional_cost numeric(10,2) DEFAULT 0 NOT NULL,
    new_total numeric(10,2) NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    docusign_envelope_id text,
    created_by text,
    sent_at timestamp with time zone,
    signed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_variations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'signed'::text, 'declined'::text, 'voided'::text])))
);


--
-- Name: knowledge_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_path text,
    title text NOT NULL,
    body text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lapsed_outreach; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lapsed_outreach (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    last_job_at timestamp with time zone,
    days_lapsed integer,
    segment text,
    drafted_body text,
    sent_at timestamp with time zone,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    direction text NOT NULL,
    channel text NOT NULL,
    body text,
    external_id text,
    author_id uuid,
    author_label text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    external_sender_id text,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT lead_conversations_channel_check CHECK ((channel = ANY (ARRAY['website'::text, 'messenger'::text, 'sms'::text, 'instagram'::text, 'email'::text, 'phone'::text, 'referral'::text, 'internal'::text, 'unknown'::text]))),
    CONSTRAINT lead_conversations_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
    CONSTRAINT lead_conversations_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text])))
);


--
-- Name: lead_follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    due_at timestamp with time zone NOT NULL,
    reason text NOT NULL,
    channel text,
    status text DEFAULT 'pending'::text NOT NULL,
    done_at timestamp with time zone,
    assignee_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_follow_ups_channel_check CHECK ((channel = ANY (ARRAY['messenger'::text, 'sms'::text, 'email'::text, 'phone'::text, 'website'::text, 'internal'::text]))),
    CONSTRAINT lead_follow_ups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'cancelled'::text, 'snoozed'::text])))
);


--
-- Name: lead_response_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_response_metrics (
    metric_day date NOT NULL,
    source text NOT NULL,
    leads_total integer DEFAULT 0 NOT NULL,
    leads_responded integer DEFAULT 0 NOT NULL,
    leads_booked integer DEFAULT 0 NOT NULL,
    avg_first_response_minutes numeric(10,2),
    median_first_response_minutes numeric(10,2),
    missed_leads integer DEFAULT 0 NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_suburb_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_suburb_analytics (
    metric_day date NOT NULL,
    suburb text NOT NULL,
    active_leads integer DEFAULT 0 NOT NULL,
    hot_leads integer DEFAULT 0 NOT NULL,
    booked_jobs integer DEFAULT 0 NOT NULL,
    revenue_cents bigint DEFAULT 0 NOT NULL,
    momentum numeric(6,3),
    lat double precision,
    lng double precision,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text,
    customer_email text,
    customer_phone text,
    service_type text,
    suburb text,
    service_address text,
    source text DEFAULT 'unknown'::text NOT NULL,
    response_status text DEFAULT 'awaiting_response'::text NOT NULL,
    temperature text,
    quote_id uuid,
    first_response_at timestamp with time zone,
    booked_at timestamp with time zone,
    completed_at timestamp with time zone,
    lost_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    external_ref text,
    reply_channel text,
    messenger_psid text,
    instagram_user_id text,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT leads_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT leads_reply_channel_check CHECK ((reply_channel = ANY (ARRAY['email'::text, 'messenger'::text, 'instagram'::text, 'sms'::text, 'phone'::text]))),
    CONSTRAINT leads_response_status_check CHECK ((response_status = ANY (ARRAY['awaiting_response'::text, 'in_conversation'::text, 'quoted'::text, 'booked'::text, 'completed'::text, 'no_response'::text, 'lost'::text]))),
    CONSTRAINT leads_source_check CHECK ((source = ANY (ARRAY['website'::text, 'messenger'::text, 'sms'::text, 'instagram'::text, 'email'::text, 'phone'::text, 'referral'::text, 'unknown'::text]))),
    CONSTRAINT leads_temperature_check CHECK ((temperature = ANY (ARRAY['HOT'::text, 'WARM'::text, 'COLD'::text, 'LOST'::text])))
);


--
-- Name: lobby_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lobby_themes (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    preview_image text,
    tokens jsonb NOT NULL,
    active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_campaign_queue_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaign_queue_items (
    campaign_id uuid NOT NULL,
    queue_item_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    service_type text,
    hook text,
    starts_on date,
    ends_on date,
    status text DEFAULT 'planning'::text NOT NULL,
    goal_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    goal text DEFAULT ''::text NOT NULL,
    related_arc_id uuid,
    target_audience text DEFAULT ''::text NOT NULL,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    start_date date,
    end_date date,
    kpis jsonb DEFAULT '{}'::jsonb NOT NULL,
    result_summary text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_campaigns_status_check CHECK ((status = ANY (ARRAY['planning'::text, 'active'::text, 'completed'::text, 'archived'::text])))
);


--
-- Name: marketing_distribution_playbooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_distribution_playbooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    content_type text DEFAULT ''::text NOT NULL,
    primary_platform text DEFAULT ''::text NOT NULL,
    secondary_platforms text[] DEFAULT '{}'::text[] NOT NULL,
    steps text[] DEFAULT '{}'::text[] NOT NULL,
    checklist text[] DEFAULT '{}'::text[] NOT NULL,
    linked_campaign_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_distribution_playbooks_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])))
);


--
-- Name: marketing_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_date date NOT NULL,
    channel text NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    engagements integer DEFAULT 0 NOT NULL,
    content_published integer DEFAULT 0 NOT NULL,
    followers integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_metrics_channel_check CHECK ((channel = ANY (ARRAY['instagram'::text, 'tiktok'::text, 'facebook'::text, 'gbp'::text, 'combined'::text]))),
    CONSTRAINT marketing_metrics_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'api'::text])))
);


--
-- Name: marketing_publishing_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_publishing_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    production_card_id uuid NOT NULL,
    platform text NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    related_arc_id uuid,
    related_characters text[] DEFAULT '{}'::text[] NOT NULL,
    target_publish_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    caption_placeholder text DEFAULT ''::text NOT NULL,
    consent_verified boolean DEFAULT false NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_created boolean DEFAULT false NOT NULL,
    performance_data jsonb,
    CONSTRAINT marketing_publishing_queue_consent_before_ready CHECK (((status <> ALL (ARRAY['ready'::text, 'published'::text])) OR (consent_verified = true))),
    CONSTRAINT marketing_publishing_queue_platform_check CHECK ((platform = ANY (ARRAY['tiktok'::text, 'instagram'::text, 'facebook'::text, 'youtube'::text, 'linkedin'::text, 'website'::text]))),
    CONSTRAINT marketing_publishing_queue_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: marketing_social_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_social_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    handle text DEFAULT ''::text NOT NULL,
    profile_url text DEFAULT ''::text NOT NULL,
    primary_format text DEFAULT ''::text NOT NULL,
    posting_target_per_week integer DEFAULT 0 NOT NULL,
    primary_audience text DEFAULT ''::text NOT NULL,
    content_notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    connected boolean DEFAULT false NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marketing_social_channels_platform_check CHECK ((platform = ANY (ARRAY['tiktok'::text, 'instagram'::text, 'facebook'::text, 'youtube'::text, 'linkedin'::text, 'website'::text]))),
    CONSTRAINT marketing_social_channels_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'planned'::text, 'archived'::text])))
);


--
-- Name: memory_contradiction_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_contradiction_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_a_id uuid NOT NULL,
    doc_b_id uuid NOT NULL,
    contradicts boolean NOT NULL,
    severity text,
    explanation text,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memory_contradiction_log_severity_check CHECK ((severity = ANY (ARRAY['minor'::text, 'major'::text])))
);


--
-- Name: memory_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vault_path text,
    category text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    frontmatter jsonb DEFAULT '{}'::jsonb NOT NULL,
    embedding public.vector(1536),
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    agent_scope text,
    source text DEFAULT 'human'::text NOT NULL,
    content_hash text NOT NULL,
    freshness_score double precision DEFAULT 1.0 NOT NULL,
    vault_synced_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    superseded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memory_documents_category_check CHECK ((category = ANY (ARRAY['ux'::text, 'admin'::text, 'deployments'::text, 'bugs'::text, 'architecture'::text, 'design'::text, 'sops'::text, 'analytics'::text, 'pricing'::text, 'customers'::text]))),
    CONSTRAINT memory_documents_freshness_score_check CHECK (((freshness_score >= (0.0)::double precision) AND (freshness_score <= (1.0)::double precision))),
    CONSTRAINT memory_documents_source_check CHECK ((source = ANY (ARRAY['human'::text, 'agent'::text, 'deployment'::text, 'analytics'::text, 'import'::text]))),
    CONSTRAINT memory_documents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'pending'::text])))
);


--
-- Name: memory_edges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_edges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    target_id uuid NOT NULL,
    relationship text NOT NULL,
    strength double precision DEFAULT 1.0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    extracted_by text DEFAULT 'system'::text NOT NULL,
    extracted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memory_edges_relationship_check CHECK ((relationship = ANY (ARRAY['backlink'::text, 'tag_shared'::text, 'semantic'::text, 'depends_on'::text, 'implements'::text, 'contradicts'::text, 'supersedes'::text, 'caused_by'::text, 'informs'::text]))),
    CONSTRAINT memory_edges_strength_check CHECK (((strength >= (0.0)::double precision) AND (strength <= (1.0)::double precision)))
);


--
-- Name: memory_graph_extractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_graph_extractions (
    document_id uuid NOT NULL,
    systems_mentioned text[] DEFAULT '{}'::text[] NOT NULL,
    decision_rationale text,
    problems_solved text[] DEFAULT '{}'::text[] NOT NULL,
    depends_on_raw text[] DEFAULT '{}'::text[] NOT NULL,
    implements_raw text[] DEFAULT '{}'::text[] NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    importance_score double precision DEFAULT 0.5 NOT NULL,
    extracted_at timestamp with time zone DEFAULT now() NOT NULL,
    model text,
    CONSTRAINT memory_graph_extractions_importance_score_check CHECK (((importance_score >= (0.0)::double precision) AND (importance_score <= (1.0)::double precision)))
);


--
-- Name: memory_read_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_read_log (
    id bigint NOT NULL,
    document_id uuid NOT NULL,
    agent_id text,
    run_id uuid,
    query text,
    similarity double precision,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: memory_read_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.memory_read_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: memory_read_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.memory_read_log_id_seq OWNED BY public.memory_read_log.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_type text DEFAULT 'admin'::text NOT NULL,
    sender_id uuid,
    body text NOT NULL,
    channel text DEFAULT 'internal'::text NOT NULL,
    delivery_status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT messages_channel_check CHECK ((channel = ANY (ARRAY['internal'::text, 'sms'::text, 'email'::text]))),
    CONSTRAINT messages_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['draft'::text, 'queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text]))),
    CONSTRAINT messages_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['admin'::text, 'entity'::text])))
);


--
-- Name: mission_control_latest_evidence; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.mission_control_latest_evidence AS
 SELECT source_type,
    source_id,
    label,
    body,
    stderr,
    status,
    recorded_at
   FROM ( SELECT 'terminal'::text AS source_type,
            (bud_terminal_sessions.id)::text AS source_id,
            COALESCE(bud_terminal_sessions.command, '(unknown command)'::text) AS label,
            bud_terminal_sessions.output AS body,
            NULL::text AS stderr,
                CASE bud_terminal_sessions.status
                    WHEN 'passed'::text THEN 'passed'::text
                    WHEN 'failed'::text THEN 'failed'::text
                    ELSE 'recorded'::text
                END AS status,
            bud_terminal_sessions.started_at AS recorded_at
           FROM public.bud_terminal_sessions
        UNION ALL
         SELECT 'deployment'::text AS source_type,
            (github_events.id)::text AS source_id,
            ((github_events.event_type || '/'::text) || COALESCE(github_events.action, 'unknown'::text)) AS label,
            COALESCE((github_events.metadata)::text, ''::text) AS body,
            NULL::text AS stderr,
                CASE
                    WHEN (github_events.action = 'success'::text) THEN 'passed'::text
                    WHEN (github_events.action = ANY (ARRAY['failure'::text, 'error'::text])) THEN 'failed'::text
                    ELSE 'recorded'::text
                END AS status,
            github_events.created_at AS recorded_at
           FROM public.github_events
          WHERE (github_events.event_type = ANY (ARRAY['deployment_status'::text, 'deployment_failure'::text]))
        UNION ALL
         SELECT 'evidence'::text AS source_type,
            (bud_evidence.id)::text AS source_id,
            COALESCE(bud_evidence.command, bud_evidence.summary, bud_evidence.type) AS label,
            COALESCE(bud_evidence.raw_output, bud_evidence.summary) AS body,
            bud_evidence.stderr,
            bud_evidence.status,
            bud_evidence.created_at AS recorded_at
           FROM public.bud_evidence) combined
  ORDER BY recorded_at DESC
 LIMIT 100;


--
-- Name: ndis_organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ndis_organisations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    abn text,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    website text,
    notes text,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'inactive'::text NOT NULL,
    subscription_plan text DEFAULT 'standard'::text,
    current_period_end timestamp with time zone,
    trial_ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    platform_fee_bps integer DEFAULT 600 NOT NULL,
    stripe_connect_account_id text,
    CONSTRAINT ndis_organisations_sub_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'inactive'::text, 'trialing'::text, 'past_due'::text, 'cancelled'::text])))
);


--
-- Name: ndis_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ndis_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organisation_id uuid NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    ndis_number text,
    date_of_birth date,
    status text DEFAULT 'active'::text NOT NULL,
    invite_token text DEFAULT (gen_random_uuid())::text,
    invite_sent_at timestamp with time zone,
    joined_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ndis_participants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])))
);


--
-- Name: ndis_plan_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ndis_plan_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participant_id uuid,
    plan_goals text[],
    matched_services jsonb,
    estimated_total_aud numeric,
    run_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    segment text NOT NULL,
    service_subtotal_cents integer DEFAULT 0 NOT NULL,
    retained_subtotal_cents integer DEFAULT 0 NOT NULL,
    client_fee_cents integer DEFAULT 0 NOT NULL,
    provider_fee_cents integer DEFAULT 0 NOT NULL,
    platform_total_cents integer DEFAULT 0 NOT NULL,
    gst_cents integer DEFAULT 0 NOT NULL,
    client_total_cents integer DEFAULT 0 NOT NULL,
    worker_payout_cents integer DEFAULT 0 NOT NULL,
    instant_payout_fee_cents integer DEFAULT 0 NOT NULL,
    buds_revenue_cents integer DEFAULT 0 NOT NULL,
    client_fee_bps integer DEFAULT 0 NOT NULL,
    provider_fee_bps integer DEFAULT 0 NOT NULL,
    instant_payout_bps integer DEFAULT 0 NOT NULL,
    is_gst_free boolean DEFAULT false NOT NULL,
    gst_registered boolean DEFAULT false NOT NULL,
    finalized boolean DEFAULT false NOT NULL,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid,
    customer_id uuid,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    service_type text NOT NULL,
    context text NOT NULL,
    scope text,
    frequency text DEFAULT 'none'::text,
    base_price numeric NOT NULL,
    discount_percent numeric DEFAULT 0,
    final_price numeric NOT NULL,
    scheduled_date date,
    scheduled_time text,
    status text DEFAULT 'pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    assigned_employee_id uuid,
    assigned_crew_id uuid,
    estimated_duration_minutes integer DEFAULT 120 NOT NULL,
    analytics_session_id text,
    segment text DEFAULT 'home'::text NOT NULL,
    cancellation_window text,
    cancellation_fault text,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    status_updated_at timestamp with time zone,
    CONSTRAINT orders_cancellation_fault_check CHECK ((cancellation_fault = ANY (ARRAY['client'::text, 'worker'::text]))),
    CONSTRAINT orders_cancellation_window_check CHECK ((cancellation_window = ANY (ARRAY['none'::text, 'late'::text, 'no_show'::text]))),
    CONSTRAINT orders_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT orders_segment_check CHECK ((segment = ANY (ARRAY['home'::text, 'small'::text, 'commercial'::text, 'ndis'::text])))
);


--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    page text NOT NULL,
    page_title text,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    scroll_depth integer,
    time_on_page integer,
    utm_source text,
    utm_medium text,
    utm_campaign text
);


--
-- Name: participant_support_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participant_support_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    support_window_start time without time zone,
    support_window_end time without time zone,
    max_shift_duration_minutes integer DEFAULT 240 NOT NULL,
    support_mode text DEFAULT 'independent'::text NOT NULL,
    transport_status text DEFAULT 'independent'::text NOT NULL,
    travel_radius_km integer DEFAULT 10 NOT NULL,
    preferred_services text[] DEFAULT '{}'::text[] NOT NULL,
    physical_capacity text DEFAULT 'medium'::text NOT NULL,
    customer_facing_ok boolean DEFAULT true NOT NULL,
    can_work_after_support_hours boolean DEFAULT false NOT NULL,
    supervision_notes text,
    risk_notes text,
    emergency_contact text,
    support_worker_name text,
    support_worker_provider text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT psp_physical_capacity_check CHECK ((physical_capacity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT psp_support_mode_check CHECK ((support_mode = ANY (ARRAY['independent'::text, 'supported'::text, 'team_based'::text]))),
    CONSTRAINT psp_transport_status_check CHECK ((transport_status = ANY (ARRAY['independent'::text, 'needs_transport'::text, 'arranged'::text])))
);


--
-- Name: payables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    subscription_id uuid,
    vendor_id uuid,
    amount numeric NOT NULL,
    status text DEFAULT 'pending'::text,
    reference text,
    due_date date,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT payables_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT payables_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    subscription_id uuid,
    customer_id uuid,
    amount numeric NOT NULL,
    payment_method text NOT NULL,
    payment_reference text,
    status text DEFAULT 'pending'::text,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'bank_transfer'::text, 'invoice'::text, 'other'::text]))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'partial_refund'::text])))
);


--
-- Name: payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_payout_id text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'aud'::text NOT NULL,
    status text NOT NULL,
    arrival_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    failure_code text,
    failure_message text
);


--
-- Name: phone_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    direction text NOT NULL,
    from_number text,
    to_number text,
    duration_s integer,
    recording_url text,
    transcript text,
    summary text,
    action_items jsonb DEFAULT '[]'::jsonb,
    sentiment text,
    agent_processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT phone_calls_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text])))
);


--
-- Name: pipeline_agent_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_agent_scores (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    agent text NOT NULL,
    dimension text NOT NULL,
    value numeric(4,3) NOT NULL,
    rationale text,
    is_skeptic boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pipeline_agent_scores_value_check CHECK (((value >= (0)::numeric) AND (value <= (1)::numeric)))
);


--
-- Name: pipeline_agent_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_agent_scores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_agent_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_agent_scores_id_seq OWNED BY public.pipeline_agent_scores.id;


--
-- Name: pipeline_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_artifacts (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    stage public.pipeline_stage,
    kind text NOT NULL,
    label text,
    url text,
    body jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pipeline_artifacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_artifacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_artifacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_artifacts_id_seq OWNED BY public.pipeline_artifacts.id;


--
-- Name: pipeline_kill_switch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_kill_switch (
    id integer DEFAULT 1 NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    reason text,
    paused_at timestamp with time zone,
    paused_by uuid,
    CONSTRAINT pipeline_kill_switch_id_check CHECK ((id = 1))
);


--
-- Name: pipeline_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    surface public.pipeline_surface NOT NULL,
    trigger_signal text NOT NULL,
    trigger_payload jsonb,
    status public.pipeline_run_status DEFAULT 'open'::public.pipeline_run_status NOT NULL,
    verdict public.pipeline_run_verdict DEFAULT 'pending'::public.pipeline_run_verdict NOT NULL,
    composite_score numeric(4,3),
    pr_url text,
    preview_url text,
    rolled_back_at timestamp with time zone,
    rollback_reason text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone
);


--
-- Name: pipeline_kpis_7d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pipeline_kpis_7d AS
 SELECT s.surface,
    (COALESCE(count(*) FILTER (WHERE ((r.verdict = 'auto_merge'::public.pipeline_run_verdict) AND (r.started_at > (now() - '7 days'::interval)))), (0)::bigint))::integer AS auto_merged,
    (COALESCE(count(*) FILTER (WHERE ((r.verdict = 'rejected'::public.pipeline_run_verdict) AND (r.started_at > (now() - '7 days'::interval)))), (0)::bigint))::integer AS auto_rejected,
    (COALESCE(count(*) FILTER (WHERE ((r.status = 'rolled_back'::public.pipeline_run_status) AND (r.started_at > (now() - '7 days'::interval)))), (0)::bigint))::integer AS rollbacks,
    (COALESCE(EXTRACT(epoch FROM percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY (r.ended_at - r.started_at)) FILTER (WHERE ((r.ended_at IS NOT NULL) AND (r.started_at > (now() - '7 days'::interval))))), (0)::numeric))::integer AS median_seconds
   FROM (( SELECT unnest(enum_range(NULL::public.pipeline_surface)) AS surface) s
     LEFT JOIN public.pipeline_runs r ON ((r.surface = s.surface)))
  GROUP BY s.surface;


--
-- Name: pipeline_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_policy (
    surface public.pipeline_surface NOT NULL,
    autonomy_enabled boolean DEFAULT false NOT NULL,
    daily_merge_budget integer DEFAULT 10 NOT NULL,
    class_a_auto boolean DEFAULT true NOT NULL,
    class_b_auto boolean DEFAULT false NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pipeline_stage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stage_events (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    stage public.pipeline_stage NOT NULL,
    status public.pipeline_stage_status NOT NULL,
    payload jsonb,
    ts timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pipeline_stage_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pipeline_stage_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pipeline_stage_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pipeline_stage_events_id_seq OWNED BY public.pipeline_stage_events.id;


--
-- Name: pr_review_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pr_review_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pr_number integer NOT NULL,
    branch text NOT NULL,
    plain_title text NOT NULL,
    system_area text NOT NULL,
    risk_level text NOT NULL,
    recommendation text NOT NULL,
    recommendation_score integer NOT NULL,
    evidence_confidence text NOT NULL,
    evidence_confidence_score integer NOT NULL,
    evidence_penalty integer DEFAULT 0 NOT NULL,
    predicted_outcome text NOT NULL,
    expected_best_case text,
    expected_outcome text,
    expected_worst_case text,
    business_impact jsonb,
    check_status text DEFAULT 'pending'::text NOT NULL,
    merged_at timestamp with time zone,
    deployment_succeeded boolean,
    production_healthy boolean,
    errors_increased boolean,
    workflow_affected boolean,
    rollback_needed boolean,
    improvement_happened boolean,
    outcome_notes text,
    accuracy_verdict text,
    accuracy_score integer,
    learning_notes jsonb,
    checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pr_review_predictions_accuracy_score_check CHECK (((accuracy_score >= 0) AND (accuracy_score <= 100))),
    CONSTRAINT pr_review_predictions_accuracy_verdict_check CHECK ((accuracy_verdict = ANY (ARRAY['correct'::text, 'partially_correct'::text, 'wrong'::text, 'unknown'::text]))),
    CONSTRAINT pr_review_predictions_check_status_check CHECK ((check_status = ANY (ARRAY['pending'::text, 'merged_unchecked'::text, 'confirmed'::text, 'skipped'::text, 'not_merged'::text]))),
    CONSTRAINT pr_review_predictions_evidence_confidence_check CHECK ((evidence_confidence = ANY (ARRAY['strong'::text, 'partial'::text, 'weak'::text, 'insufficient'::text]))),
    CONSTRAINT pr_review_predictions_evidence_confidence_score_check CHECK (((evidence_confidence_score >= 0) AND (evidence_confidence_score <= 100))),
    CONSTRAINT pr_review_predictions_recommendation_check CHECK ((recommendation = ANY (ARRAY['approve'::text, 'hold'::text, 'reject'::text, 'needs_manual_review'::text]))),
    CONSTRAINT pr_review_predictions_recommendation_score_check CHECK (((recommendation_score >= 0) AND (recommendation_score <= 100))),
    CONSTRAINT pr_review_predictions_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])))
);


--
-- Name: pricing_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    service text NOT NULL,
    suburb text,
    price_unit text NOT NULL,
    current_price numeric(10,2) NOT NULL,
    recommended_price numeric(10,2) NOT NULL,
    direction text NOT NULL,
    delta_pct numeric(5,2) NOT NULL,
    capacity_pct numeric(5,2),
    win_rate_pct numeric(5,2),
    competitor_p25 numeric(10,2),
    competitor_p50 numeric(10,2),
    competitor_p75 numeric(10,2),
    cost_drift_pct numeric(5,2),
    rationale text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_recommendations_direction_check CHECK ((direction = ANY (ARRAY['raise'::text, 'lower'::text, 'hold'::text]))),
    CONSTRAINT pricing_recommendations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'applied'::text, 'superseded'::text])))
);


--
-- Name: production_orders; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.production_orders AS
 SELECT id,
    quote_id,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    service_type,
    context,
    scope,
    frequency,
    base_price,
    discount_percent,
    final_price,
    scheduled_date,
    scheduled_time,
    status,
    notes,
    created_at,
    updated_at,
    completed_at,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    assigned_employee_id,
    assigned_crew_id,
    estimated_duration_minutes,
    analytics_session_id,
    segment,
    cancellation_window,
    cancellation_fault,
    cancellation_reason,
    cancelled_at,
    is_test,
    environment
   FROM public.orders
  WHERE ((environment = 'production'::text) AND (COALESCE(is_test, false) = false));


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    role text DEFAULT 'customer'::text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organisation_id uuid,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'employee'::text, 'customer'::text, 'org_admin'::text, 'ndis_participant'::text])))
);


--
-- Name: quote_funnel_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_funnel_events (
    id bigint NOT NULL,
    session_id text NOT NULL,
    event_name text NOT NULL,
    service text,
    scope text,
    context text,
    time_spent_seconds integer,
    config_changes integer,
    quote_submitted boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_funnel_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quote_funnel_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quote_funnel_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quote_funnel_events_id_seq OWNED BY public.quote_funnel_events.id;


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    service_type text NOT NULL,
    context text DEFAULT 'home'::text NOT NULL,
    scope text,
    frequency text DEFAULT 'none'::text NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    converted_order_id uuid,
    converted_subscription_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_id uuid,
    submitted_total numeric(10,2) NOT NULL,
    reviewed_total numeric(10,2),
    finalized_at timestamp with time zone,
    finalized_by text,
    payment_status text DEFAULT 'not_requested'::text NOT NULL,
    payment_requested_at timestamp with time zone,
    paid_at timestamp with time zone,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    stripe_checkout_url text,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    cancelled_by text,
    analytics_session_id text,
    ndis_management_type text,
    ndis_forward_contact text,
    ndis_forward_email text,
    ndis_estimated_hours numeric(5,2),
    ndis_hourly_rate numeric(6,2),
    ndis_forwarded_at timestamp with time zone,
    ndis_accepted_at timestamp with time zone,
    ndis_booked_at timestamp with time zone,
    service_address text,
    lead_score integer,
    lead_score_at timestamp with time zone,
    yard_sqm numeric,
    yard_complexity text,
    geo_image_url text,
    agent_triaged_at timestamp with time zone,
    agent_estimate_aud numeric,
    agent_service text,
    agent_ndis boolean,
    source text,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT quotes_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT quotes_ndis_management_type_check CHECK (((ndis_management_type IS NULL) OR (ndis_management_type = ANY (ARRAY['plan_managed'::text, 'self_managed'::text, 'agency_managed'::text])))),
    CONSTRAINT quotes_payment_status_check CHECK ((payment_status = ANY (ARRAY['not_requested'::text, 'pending_payment'::text, 'paid'::text, 'cancelled'::text]))),
    CONSTRAINT quotes_source_check CHECK ((source = ANY (ARRAY['website'::text, 'messenger'::text, 'sms'::text, 'instagram'::text, 'email'::text, 'phone'::text, 'referral'::text, 'unknown'::text]))),
    CONSTRAINT quotes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'adjusted'::text, 'converted'::text, 'submitted'::text, 'in_review'::text, 'finalized'::text, 'payment_pending'::text, 'paid'::text, 'denied'::text, 'cancelled'::text]))),
    CONSTRAINT quotes_yard_complexity_check CHECK ((yard_complexity = ANY (ARRAY[NULL::text, 'simple'::text, 'moderate'::text, 'complex'::text])))
);


--
-- Name: ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_test boolean DEFAULT false NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT ratings_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
    CONSTRAINT ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: rego_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rego_cache (
    rego text NOT NULL,
    state text NOT NULL,
    vehicle_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '60 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_trends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_trends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    trend_type text NOT NULL,
    urgency text NOT NULL,
    adaptation_angle text DEFAULT ''::text NOT NULL,
    story_arc_id uuid,
    status text DEFAULT 'watching'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    adaptation_score integer,
    adaptation_reason text,
    adapted_at timestamp with time zone,
    CONSTRAINT research_trends_adaptation_score_check CHECK (((adaptation_score >= 0) AND (adaptation_score <= 100))),
    CONSTRAINT research_trends_platform_check CHECK ((platform = ANY (ARRAY['tiktok'::text, 'instagram'::text, 'facebook'::text, 'youtube'::text, 'linkedin'::text, 'website'::text]))),
    CONSTRAINT research_trends_status_check CHECK ((status = ANY (ARRAY['watching'::text, 'adapting'::text, 'published'::text, 'expired'::text]))),
    CONSTRAINT research_trends_trend_type_check CHECK ((trend_type = ANY (ARRAY['audio'::text, 'format'::text, 'hook'::text, 'topic'::text, 'visual_style'::text, 'other'::text]))),
    CONSTRAINT research_trends_urgency_check CHECK ((urgency = ANY (ARRAY['evergreen'::text, 'two_week_window'::text, 'forty_eight_hour_window'::text])))
);


--
-- Name: resilience_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resilience_events (
    id bigint NOT NULL,
    guard text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resilience_events_guard_check CHECK ((guard = ANY (ARRAY['circuit_breaker'::text, 'zombie_reaper'::text, 'concurrency_guard'::text])))
);


--
-- Name: resilience_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resilience_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resilience_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resilience_events_id_seq OWNED BY public.resilience_events.id;


--
-- Name: reviewer_calibration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviewer_calibration (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    system_area text NOT NULL,
    score_adjustment integer DEFAULT 0 NOT NULL,
    penalty_multiplier numeric(4,2) DEFAULT 1.0 NOT NULL,
    total_predictions integer DEFAULT 0 NOT NULL,
    correct_predictions integer DEFAULT 0 NOT NULL,
    accuracy_rate numeric(5,2),
    last_updated timestamp with time zone DEFAULT now(),
    calibration_note text,
    wrong_recommendation_streak integer DEFAULT 0 NOT NULL,
    heightened_caution boolean DEFAULT false NOT NULL,
    CONSTRAINT reviewer_calibration_penalty_multiplier_check CHECK (((penalty_multiplier >= 1.0) AND (penalty_multiplier <= 2.5))),
    CONSTRAINT reviewer_calibration_score_adjustment_check CHECK (((score_adjustment >= '-20'::integer) AND (score_adjustment <= 10))),
    CONSTRAINT reviewer_calibration_wrong_recommendation_streak_check CHECK ((wrong_recommendation_streak >= 0))
);


--
-- Name: sandbox_agent_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_agent_health (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    window_end timestamp with time zone NOT NULL,
    runs integer DEFAULT 0 NOT NULL,
    pass_rate numeric,
    avg_f1 numeric,
    avg_precision numeric,
    avg_recall numeric,
    baseline_f1 numeric,
    delta_f1 numeric,
    trend text DEFAULT 'stable'::text NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sandbox_agent_health_trend_check CHECK ((trend = ANY (ARRAY['improving'::text, 'stable'::text, 'degrading'::text])))
);


--
-- Name: sandbox_agent_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_agent_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_run_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    agent_id text NOT NULL,
    summary text,
    output jsonb DEFAULT '{}'::jsonb,
    proposed_actions jsonb DEFAULT '[]'::jsonb,
    llm_calls integer DEFAULT 0,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    cost_cents integer DEFAULT 0,
    environment text DEFAULT 'sandbox'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sandbox_decision_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_decision_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    scenario_id uuid NOT NULL,
    agent_id text NOT NULL,
    precision_score numeric(5,4) DEFAULT 0,
    recall_score numeric(5,4) DEFAULT 0,
    f1_score numeric(5,4) DEFAULT 0,
    hit boolean DEFAULT false NOT NULL,
    notes text,
    environment text DEFAULT 'sandbox'::text NOT NULL,
    scored_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sandbox_lessons_learned; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_lessons_learned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    scenario_id uuid,
    title text NOT NULL,
    observation text NOT NULL,
    recommendation text,
    severity text DEFAULT 'info'::text NOT NULL,
    source text DEFAULT 'auto'::text NOT NULL,
    environment text DEFAULT 'sandbox'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sandbox_policy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_policy (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sandbox_run_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_run_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id text NOT NULL,
    trigger text DEFAULT 'cron'::text NOT NULL,
    proposal_id uuid,
    status text DEFAULT 'running'::text NOT NULL,
    scenario_count integer DEFAULT 0 NOT NULL,
    pass_count integer DEFAULT 0 NOT NULL,
    avg_f1 numeric,
    total_cost_cents integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT sandbox_run_batches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'complete'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT sandbox_run_batches_trigger_check CHECK ((trigger = ANY (ARRAY['cron'::text, 'manual'::text, 'eval'::text])))
);


--
-- Name: sandbox_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_scenarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    agent_id text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    expected_action_types text[] DEFAULT '{}'::text[],
    difficulty text DEFAULT 'medium'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    environment text DEFAULT 'sandbox'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sandbox_training_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sandbox_training_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scenario_id uuid NOT NULL,
    triggered_by text,
    trigger text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    agent_run_id text,
    duration_ms integer,
    cost_cents integer,
    environment text DEFAULT 'sandbox'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    batch_id uuid,
    CONSTRAINT sandbox_training_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'complete'::text, 'failed'::text])))
);


--
-- Name: service_pricing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_pricing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service text NOT NULL,
    suburb text,
    price_unit text NOT NULL,
    price_aud numeric(10,2) NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    set_by uuid,
    set_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_pricing_price_aud_check CHECK ((price_aud > (0)::numeric)),
    CONSTRAINT service_pricing_price_unit_check CHECK ((price_unit = ANY (ARRAY['per_hour'::text, 'per_visit'::text, 'per_sqm'::text, 'flat'::text])))
);


--
-- Name: shift_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    employee_id uuid,
    segment_number integer NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    estimated_duration_minutes integer,
    status text DEFAULT 'unassigned'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ss_status_check CHECK ((status = ANY (ARRAY['unassigned'::text, 'published'::text, 'accepted'::text, 'completed'::text])))
);


--
-- Name: site_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    photo_url text,
    status text DEFAULT 'new'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT site_feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'closed'::text]))),
    CONSTRAINT site_feedback_type_check CHECK ((type = ANY (ARRAY['bug_report'::text, 'feature_idea'::text, 'general'::text])))
);


--
-- Name: site_impact_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_impact_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    participants_supported integer DEFAULT 0 NOT NULL,
    paid_jobs_completed integer DEFAULT 0 NOT NULL,
    training_hours_delivered integer DEFAULT 0 NOT NULL,
    employment_opportunities_created integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text
);


--
-- Name: site_visitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_visitors (
    session_id text NOT NULL,
    current_page text NOT NULL,
    page_title text,
    referrer text,
    user_agent text,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    city text,
    country text
);


--
-- Name: social_proof_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_proof_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    platform text NOT NULL,
    source_url text NOT NULL,
    thumbnail_url text,
    posted_at date,
    status text DEFAULT 'draft'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_proof_items_platform_check CHECK ((platform = ANY (ARRAY['tiktok'::text, 'instagram'::text, 'facebook'::text]))),
    CONSTRAINT social_proof_items_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'live'::text, 'archived'::text])))
);


--
-- Name: story_arcs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_arcs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    start_date date,
    end_date date,
    priority integer DEFAULT 0 NOT NULL,
    characters_involved text[] DEFAULT '{}'::text[] NOT NULL,
    journal_entry_links text[] DEFAULT '{}'::text[] NOT NULL,
    progress_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT story_arcs_status_check CHECK ((status = ANY (ARRAY['active'::text, 'planted'::text, 'resolved'::text, 'abandoned'::text])))
);


--
-- Name: story_bible_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_bible_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text DEFAULT 'Jackson Taylor'::text NOT NULL
);


--
-- Name: story_chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    goal text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    started_at date,
    ended_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: story_characters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    profile text DEFAULT ''::text NOT NULL,
    role_in_story text DEFAULT ''::text NOT NULL,
    voice_perspective text DEFAULT ''::text NOT NULL,
    content_posture text DEFAULT ''::text NOT NULL,
    what_to_show text DEFAULT ''::text NOT NULL,
    what_to_protect text DEFAULT ''::text NOT NULL,
    active_story_threads text DEFAULT ''::text NOT NULL,
    consent_status text,
    consent_notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    timeline_notes text
);


--
-- Name: story_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    opportunity_id uuid NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    platform text DEFAULT ''::text NOT NULL,
    hook text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    close text DEFAULT ''::text NOT NULL,
    hashtags text[] DEFAULT '{}'::text[] NOT NULL,
    prompt_context text DEFAULT ''::text NOT NULL,
    is_ai_generated boolean DEFAULT true NOT NULL,
    generation_model text,
    generation_tokens integer,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT story_drafts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'reviewed'::text, 'approved'::text, 'archived'::text])))
);


--
-- Name: story_open_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_open_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    related_arc_id uuid,
    related_characters text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opened_date date DEFAULT CURRENT_DATE NOT NULL,
    closed_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    progress_notes text,
    CONSTRAINT story_open_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'abandoned'::text])))
);


--
-- Name: story_opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_ref_id text,
    related_arc_id uuid,
    related_characters text[] DEFAULT '{}'::text[] NOT NULL,
    content_angle text DEFAULT ''::text NOT NULL,
    suggested_format text DEFAULT ''::text NOT NULL,
    suggested_platform text DEFAULT ''::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    section text DEFAULT 'surfaced'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_auto_detected boolean DEFAULT false NOT NULL,
    detection_rule text,
    detection_reason text,
    confidence_score double precision,
    source_hash text,
    story_score integer,
    score_breakdown jsonb,
    score_reason text,
    scored_at timestamp with time zone,
    content_idea_created boolean DEFAULT false NOT NULL,
    story_category text,
    CONSTRAINT story_opportunities_section_check CHECK ((section = ANY (ARRAY['surfaced'::text, 'tension_map'::text, 'missed_moments'::text]))),
    CONSTRAINT story_opportunities_source_type_check CHECK ((source_type = ANY (ARRAY['journal'::text, 'character'::text, 'arc'::text, 'open_thread'::text, 'chapter'::text, 'manual'::text, 'milestone'::text, 'internal_system_milestone'::text]))),
    CONSTRAINT story_opportunities_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_development'::text, 'published'::text, 'passed'::text]))),
    CONSTRAINT story_opps_confidence_range CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::double precision) AND (confidence_score <= (1)::double precision)))),
    CONSTRAINT story_opps_score_range CHECK (((story_score IS NULL) OR ((story_score >= 0) AND (story_score <= 100))))
);


--
-- Name: story_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_id uuid NOT NULL,
    review_status text DEFAULT 'pending_review'::text NOT NULL,
    safety_score integer DEFAULT 0 NOT NULL,
    consent_verified boolean DEFAULT false NOT NULL,
    privacy_checked boolean DEFAULT false NOT NULL,
    factual_accuracy_checked boolean DEFAULT false NOT NULL,
    brand_alignment_checked boolean DEFAULT false NOT NULL,
    findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    reviewer_notes text DEFAULT ''::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT story_reviews_review_status_check CHECK ((review_status = ANY (ARRAY['pending_review'::text, 'changes_required'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT story_reviews_safety_score_check CHECK (((safety_score >= 0) AND (safety_score <= 100)))
);


--
-- Name: stripe_disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_disputes (
    id text NOT NULL,
    charge_id text,
    customer_id uuid,
    amount_cents integer,
    reason text,
    status text,
    evidence_due_at timestamp with time zone,
    evidence_package jsonb,
    agent_drafted_at timestamp with time zone,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid,
    order_id uuid,
    service_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    service_type text NOT NULL,
    context text NOT NULL,
    scope text,
    frequency text NOT NULL,
    base_price numeric NOT NULL,
    discount_percent numeric DEFAULT 0,
    price_per_cycle numeric NOT NULL,
    status text DEFAULT 'active'::text,
    start_date date NOT NULL,
    next_service_date date,
    last_service_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transport_arrangements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transport_arrangements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    arrangement_type text DEFAULT 'self'::text NOT NULL,
    notes text,
    confirmed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ta_type_check CHECK ((arrangement_type = ANY (ARRAY['self'::text, 'support_worker'::text, 'company'::text, 'public'::text])))
);


--
-- Name: v_agent_cache_savings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agent_cache_savings AS
 SELECT agent_id,
    sum(cache_read_tokens) AS total_cache_reads,
    sum(cache_creation_tokens) AS total_cache_writes,
    sum(input_tokens) AS total_input_tokens,
    round((((sum(cache_read_tokens))::numeric / (1000000)::numeric) *
        CASE model
            WHEN 'claude-sonnet-4-6'::text THEN ((3)::numeric * 0.9)
            WHEN 'claude-haiku-4-5-20251001'::text THEN ((1)::numeric * 0.9)
            ELSE ((3)::numeric * 0.9)
        END), 4) AS estimated_savings_usd,
    count(*) AS run_count
   FROM public.agent_runs
  WHERE (started_at > (now() - '30 days'::interval))
  GROUP BY agent_id, model;


--
-- Name: v_bud_approval_truth; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_bud_approval_truth AS
 SELECT q.id,
    q.task_id,
    q.action_type,
    q.status,
    q.created_at,
    q.archived_at,
    q.archive_reason,
    q.blocked_reason,
    q.payload,
    q.approval_identity,
    q.root_cause_id,
    q.root_cause_key,
    q.initiative_id,
    q.superseded_by,
    q.is_duplicate,
    q.environment,
    t.status AS task_status,
    t.risk_level,
    t.linked_pr,
        CASE
            WHEN COALESCE(q.is_duplicate, false) THEN 'Archived'::text
            WHEN (q.status = 'archived'::text) THEN 'Archived'::text
            WHEN (q.status = 'blocked'::text) THEN 'Blocked'::text
            WHEN (q.status <> 'pending'::text) THEN 'Archived'::text
            WHEN ((q.created_at < (now() - '24:00:00'::interval)) AND ((t.status = ANY (ARRAY['archived'::text, 'completed'::text])) OR ((t.risk_level = ANY (ARRAY['high'::text, 'critical'::text])) AND (COALESCE(t.linked_pr, ''::text) = ''::text) AND (COALESCE((q.payload ->> 'pr_url'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'pull_request_url'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'diff'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'diff_summary'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'patch'::text), ''::text) = ''::text)))) THEN 'Blocked'::text
            WHEN ((t.risk_level = ANY (ARRAY['high'::text, 'critical'::text])) AND (COALESCE(t.linked_pr, ''::text) = ''::text) AND (COALESCE((q.payload ->> 'pr_url'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'pull_request_url'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'diff'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'diff_summary'::text), ''::text) = ''::text) AND (COALESCE((q.payload ->> 'patch'::text), ''::text) = ''::text)) THEN 'Needs manual review'::text
            ELSE 'Actionable'::text
        END AS truth_label
   FROM (public.bud_approval_queue q
     LEFT JOIN public.bud_tasks t ON ((t.id = q.task_id)))
  WHERE (q.environment = 'production'::text);


--
-- Name: v_pending_agent_actions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pending_agent_actions AS
 SELECT a.id AS action_id,
    a.id,
    a.run_id,
    a.agent_id,
    ag.name AS agent_name,
    a.action_type,
    a.target_table,
    a.target_id,
    a.preview,
    a.payload,
    a.requires_approval,
    a.status,
    a.action_identity,
    a.root_cause_id,
    a.root_cause_key,
    a.initiative_id,
    a.superseded_by,
    a.is_duplicate,
    a.environment,
    a.created_at
   FROM (public.agent_actions a
     JOIN public.agents ag ON ((ag.id = a.agent_id)))
  WHERE ((a.status = 'pending'::text) AND (COALESCE(a.is_duplicate, false) = false) AND (a.environment = 'production'::text))
  ORDER BY a.created_at DESC;


--
-- Name: v_agent_intelligence_quality; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agent_intelligence_quality AS
 WITH signal_stats AS (
         SELECT (count(*))::integer AS signal_count,
            (count(DISTINCT COALESCE(bud_improvement_signals.root_cause_key, bud_improvement_signals.fingerprint, (bud_improvement_signals.id)::text)))::integer AS root_cause_count
           FROM public.bud_improvement_signals
          WHERE ((bud_improvement_signals.status = ANY (ARRAY['new'::text, 'queued'::text, 'executing'::text])) AND (bud_improvement_signals.environment = 'production'::text))
        ), approval_stats AS (
         SELECT ((( SELECT count(*) AS count
                   FROM public.v_pending_agent_actions))::integer + (( SELECT count(*) AS count
                   FROM public.v_bud_approval_truth
                  WHERE ((v_bud_approval_truth.truth_label = ANY (ARRAY['Actionable'::text, 'Needs manual review'::text])) AND (COALESCE(v_bud_approval_truth.is_duplicate, false) = false))))::integer) AS approval_count
        ), initiative_stats AS (
         SELECT (count(*))::integer AS initiative_count
           FROM public.bud_root_cause_initiatives
          WHERE ((bud_root_cause_initiatives.status = ANY (ARRAY['open'::text, 'patching'::text, 'validating'::text, 'blocked'::text])) AND (bud_root_cause_initiatives.approval_count > 0) AND (bud_root_cause_initiatives.environment = 'production'::text))
        )
 SELECT signal_stats.signal_count,
        CASE
            WHEN (signal_stats.signal_count = 0) THEN (0)::numeric
            ELSE round((((signal_stats.signal_count - signal_stats.root_cause_count))::numeric / (signal_stats.signal_count)::numeric), 4)
        END AS duplicate_rate,
    signal_stats.root_cause_count,
    approval_stats.approval_count,
    initiative_stats.initiative_count
   FROM signal_stats,
    approval_stats,
    initiative_stats;


--
-- Name: v_agent_latest_run; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agent_latest_run AS
 SELECT DISTINCT ON (agent_id) agent_id,
    id AS run_id,
    status,
    summary,
    confidence_score,
    evidence_payload,
    finished_at
   FROM public.agent_runs
  WHERE (finished_at IS NOT NULL)
  ORDER BY agent_id, finished_at DESC;


--
-- Name: v_agent_runtime_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agent_runtime_status AS
 SELECT a.id AS agent_id,
    latest.status AS last_run_outcome,
    COALESCE(stats.runs_30d, (0)::bigint) AS runs_30d,
    a.stale_after_minutes,
        CASE
            WHEN (a.status = ANY (ARRAY['disabled'::text, 'planned'::text])) THEN false
            WHEN (a.stale_after_minutes IS NULL) THEN false
            WHEN (a.last_run_at IS NULL) THEN true
            WHEN (a.last_run_at < (now() - ((a.stale_after_minutes || ' minutes'::text))::interval)) THEN true
            ELSE false
        END AS is_stale
   FROM ((public.agents a
     LEFT JOIN ( SELECT DISTINCT ON (agent_runs.agent_id) agent_runs.agent_id,
            agent_runs.status
           FROM public.agent_runs
          WHERE (agent_runs.finished_at IS NOT NULL)
          ORDER BY agent_runs.agent_id, agent_runs.finished_at DESC) latest ON ((latest.agent_id = a.id)))
     LEFT JOIN ( SELECT agent_runs.agent_id,
            count(*) AS runs_30d
           FROM public.agent_runs
          WHERE (agent_runs.started_at >= (now() - '30 days'::interval))
          GROUP BY agent_runs.agent_id) stats ON ((stats.agent_id = a.id)));


--
-- Name: v_agent_stats_7d; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_agent_stats_7d AS
 SELECT agent_id,
    (count(*))::integer AS runs,
    (count(*) FILTER (WHERE (status = 'succeeded'::text)))::integer AS successes,
    (count(*) FILTER (WHERE (status = 'failed'::text)))::integer AS failures,
    (COALESCE(sum(cost_cents), (0)::bigint))::integer AS cost_cents,
    COALESCE((round(avg(duration_ms) FILTER (WHERE (duration_ms IS NOT NULL))))::integer, 0) AS avg_duration_ms
   FROM public.agent_runs
  WHERE ((started_at >= (now() - '7 days'::interval)) AND (agent_id IS NOT NULL))
  GROUP BY agent_id;


--
-- Name: v_bud_repair_success_rate; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_bud_repair_success_rate AS
 SELECT COALESCE(r.agent_id, e.source_agent) AS agent_id,
    count(DISTINCT e.id) AS total_repairs,
    count(DISTINCT r.id) AS total_rollbacks,
    round((100.0 * ((1)::numeric - ((count(DISTINCT r.id))::numeric / (NULLIF(count(DISTINCT e.id), 0))::numeric))), 1) AS success_rate_pct
   FROM (public.bud_repair_executions e
     LEFT JOIN public.bud_rollback_events r ON ((r.execution_id = e.id)))
  WHERE (e.created_at > (now() - '30 days'::interval))
  GROUP BY COALESCE(r.agent_id, e.source_agent);


--
-- Name: v_bud_rollback_trends; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_bud_rollback_trends AS
 SELECT agent_id,
    count(*) AS total_rollbacks,
    count(*) FILTER (WHERE (trigger = 'ci_failure'::text)) AS ci_failures,
    count(*) FILTER (WHERE (trigger = 'surgical_limit'::text)) AS surgical_limits,
    count(*) FILTER (WHERE (trigger = 'taste_failure'::text)) AS taste_failures,
    count(*) FILTER (WHERE (trigger = 'browser_failure'::text)) AS browser_failures,
    min(created_at) AS first_rollback,
    max(created_at) AS last_rollback
   FROM public.bud_rollback_events
  GROUP BY agent_id;


--
-- Name: v_pricing_recs_pending; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pricing_recs_pending AS
 SELECT pr.id,
    pr.run_id,
    pr.service,
    pr.suburb,
    pr.price_unit,
    pr.current_price,
    pr.recommended_price,
    pr.direction,
    pr.delta_pct,
    pr.capacity_pct,
    pr.win_rate_pct,
    pr.competitor_p50,
    pr.rationale,
    pr.created_at,
    ar.summary AS run_summary
   FROM (public.pricing_recommendations pr
     LEFT JOIN public.agent_runs ar ON ((ar.id = pr.run_id)))
  WHERE (pr.status = 'pending'::text)
  ORDER BY pr.created_at DESC;


--
-- Name: vehicle_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    make text NOT NULL,
    model_pattern text NOT NULL,
    category text NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicle_overrides_category_check CHECK ((category = ANY (ARRAY['hatch'::text, 'sedan'::text, 'suv'::text, 'ute'::text, 'van'::text, '4wd'::text, 'luxury'::text, 'muscle'::text])))
);


--
-- Name: visitor_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text,
    event_name text NOT NULL,
    event_label text,
    page text,
    source text DEFAULT 'client'::text NOT NULL,
    quote_id uuid,
    order_id uuid,
    payment_id uuid,
    event_value numeric(10,2),
    event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    environment text DEFAULT 'production'::text NOT NULL,
    CONSTRAINT visitor_events_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text])))
);


--
-- Name: whs_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whs_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crew_member_id uuid NOT NULL,
    record_type text NOT NULL,
    reference text,
    issued_at date,
    expires_at date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whs_records_record_type_check CHECK ((record_type = ANY (ARRAY['induction'::text, 'wwcc'::text, 'first_aid'::text, 'licence'::text, 'equipment_check'::text, 'swms'::text])))
);


--
-- Name: worker_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    employee_id uuid,
    participant_id uuid,
    amount_cents integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    method text DEFAULT 'bank_transfer'::text NOT NULL,
    reference text,
    scheduled_for date,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_payouts_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'instant'::text]))),
    CONSTRAINT worker_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT worker_payouts_worker_check CHECK (((employee_id IS NOT NULL) OR (participant_id IS NOT NULL)))
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_07_18; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_18 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_07_19; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_19 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_07_20; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_20 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_07_21; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_07_22; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_22 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_07_23; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_23 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: messages_2026_07_24; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_07_24 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


--
-- Name: messages_2026_07_18; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_18 FOR VALUES FROM ('2026-07-18 00:00:00') TO ('2026-07-19 00:00:00');


--
-- Name: messages_2026_07_19; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_19 FOR VALUES FROM ('2026-07-19 00:00:00') TO ('2026-07-20 00:00:00');


--
-- Name: messages_2026_07_20; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_20 FOR VALUES FROM ('2026-07-20 00:00:00') TO ('2026-07-21 00:00:00');


--
-- Name: messages_2026_07_21; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_21 FOR VALUES FROM ('2026-07-21 00:00:00') TO ('2026-07-22 00:00:00');


--
-- Name: messages_2026_07_22; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_22 FOR VALUES FROM ('2026-07-22 00:00:00') TO ('2026-07-23 00:00:00');


--
-- Name: messages_2026_07_23; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_23 FOR VALUES FROM ('2026-07-23 00:00:00') TO ('2026-07-24 00:00:00');


--
-- Name: messages_2026_07_24; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_07_24 FOR VALUES FROM ('2026-07-24 00:00:00') TO ('2026-07-25 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: bud_repair_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_logs ALTER COLUMN id SET DEFAULT nextval('public.bud_repair_logs_id_seq'::regclass);


--
-- Name: memory_read_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_read_log ALTER COLUMN id SET DEFAULT nextval('public.memory_read_log_id_seq'::regclass);


--
-- Name: pipeline_agent_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_agent_scores ALTER COLUMN id SET DEFAULT nextval('public.pipeline_agent_scores_id_seq'::regclass);


--
-- Name: pipeline_artifacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_artifacts ALTER COLUMN id SET DEFAULT nextval('public.pipeline_artifacts_id_seq'::regclass);


--
-- Name: pipeline_stage_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stage_events ALTER COLUMN id SET DEFAULT nextval('public.pipeline_stage_events_id_seq'::regclass);


--
-- Name: quote_funnel_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_funnel_events ALTER COLUMN id SET DEFAULT nextval('public.quote_funnel_events_id_seq'::regclass);


--
-- Name: resilience_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resilience_events ALTER COLUMN id SET DEFAULT nextval('public.resilience_events_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: admin_optimization_findings admin_optimization_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_optimization_findings
    ADD CONSTRAINT admin_optimization_findings_pkey PRIMARY KEY (id);


--
-- Name: admin_ux_proposals admin_ux_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_ux_proposals
    ADD CONSTRAINT admin_ux_proposals_pkey PRIMARY KEY (id);


--
-- Name: agent_actions agent_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_pkey PRIMARY KEY (id);


--
-- Name: agent_alerts agent_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_alerts
    ADD CONSTRAINT agent_alerts_pkey PRIMARY KEY (id);


--
-- Name: agent_config_versions agent_config_versions_agent_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_config_versions
    ADD CONSTRAINT agent_config_versions_agent_id_version_key UNIQUE (agent_id, version);


--
-- Name: agent_config_versions agent_config_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_config_versions
    ADD CONSTRAINT agent_config_versions_pkey PRIMARY KEY (id);


--
-- Name: agent_evolutions agent_evolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_evolutions
    ADD CONSTRAINT agent_evolutions_pkey PRIMARY KEY (id);


--
-- Name: agent_guardrail_events agent_guardrail_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_guardrail_events
    ADD CONSTRAINT agent_guardrail_events_pkey PRIMARY KEY (id);


--
-- Name: agent_memory agent_memory_agent_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memory
    ADD CONSTRAINT agent_memory_agent_id_key_key UNIQUE (agent_id, key);


--
-- Name: agent_memory agent_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memory
    ADD CONSTRAINT agent_memory_pkey PRIMARY KEY (id);


--
-- Name: agent_runs agent_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_pkey PRIMARY KEY (id);


--
-- Name: agent_workflow_memberships agent_workflow_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workflow_memberships
    ADD CONSTRAINT agent_workflow_memberships_pkey PRIMARY KEY (workflow_id, agent_id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: analytics_findings analytics_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_findings
    ADD CONSTRAINT analytics_findings_pkey PRIMARY KEY (id);


--
-- Name: analytics_funnels analytics_funnels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_funnels
    ADD CONSTRAINT analytics_funnels_pkey PRIMARY KEY (id);


--
-- Name: analytics_reports analytics_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_reports
    ADD CONSTRAINT analytics_reports_pkey PRIMARY KEY (id);


--
-- Name: analytics_sessions analytics_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_sessions
    ADD CONSTRAINT analytics_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: applicants applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_pkey PRIMARY KEY (id);


--
-- Name: artifact_versions artifact_versions_artifact_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_artifact_id_version_number_key UNIQUE (artifact_id, version_number);


--
-- Name: artifact_versions artifact_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_pkey PRIMARY KEY (id);


--
-- Name: artifacts artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: bud_activity_feed bud_activity_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_activity_feed
    ADD CONSTRAINT bud_activity_feed_pkey PRIMARY KEY (id);


--
-- Name: bud_approval_queue bud_approval_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_approval_queue
    ADD CONSTRAINT bud_approval_queue_pkey PRIMARY KEY (id);


--
-- Name: bud_audit_logs bud_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_audit_logs
    ADD CONSTRAINT bud_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bud_browser_test_runs bud_browser_test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_browser_test_runs
    ADD CONSTRAINT bud_browser_test_runs_pkey PRIMARY KEY (id);


--
-- Name: bud_change_requests bud_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_change_requests
    ADD CONSTRAINT bud_change_requests_pkey PRIMARY KEY (id);


--
-- Name: bud_circuit_states bud_circuit_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_circuit_states
    ADD CONSTRAINT bud_circuit_states_pkey PRIMARY KEY (id);


--
-- Name: bud_convention_learnings bud_convention_learnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_convention_learnings
    ADD CONSTRAINT bud_convention_learnings_pkey PRIMARY KEY (id);


--
-- Name: bud_deployment_verifications bud_deployment_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_deployment_verifications
    ADD CONSTRAINT bud_deployment_verifications_pkey PRIMARY KEY (id);


--
-- Name: bud_evidence bud_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_evidence
    ADD CONSTRAINT bud_evidence_pkey PRIMARY KEY (id);


--
-- Name: bud_improvement_executions bud_improvement_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_executions
    ADD CONSTRAINT bud_improvement_executions_pkey PRIMARY KEY (id);


--
-- Name: bud_improvement_learnings bud_improvement_learnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_learnings
    ADD CONSTRAINT bud_improvement_learnings_pkey PRIMARY KEY (id);


--
-- Name: bud_improvement_logs bud_improvement_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_logs
    ADD CONSTRAINT bud_improvement_logs_pkey PRIMARY KEY (id);


--
-- Name: bud_improvement_signals bud_improvement_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_signals
    ADD CONSTRAINT bud_improvement_signals_pkey PRIMARY KEY (id);


--
-- Name: bud_improvement_steps bud_improvement_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_steps
    ADD CONSTRAINT bud_improvement_steps_pkey PRIMARY KEY (id);


--
-- Name: bud_improvements bud_improvements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvements
    ADD CONSTRAINT bud_improvements_pkey PRIMARY KEY (id);


--
-- Name: bud_insights bud_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_insights
    ADD CONSTRAINT bud_insights_pkey PRIMARY KEY (id);


--
-- Name: bud_lobby_states bud_lobby_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_lobby_states
    ADD CONSTRAINT bud_lobby_states_pkey PRIMARY KEY (id);


--
-- Name: bud_repair_executions bud_repair_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_executions
    ADD CONSTRAINT bud_repair_executions_pkey PRIMARY KEY (id);


--
-- Name: bud_repair_learnings bud_repair_learnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_learnings
    ADD CONSTRAINT bud_repair_learnings_pkey PRIMARY KEY (id);


--
-- Name: bud_repair_logs bud_repair_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_logs
    ADD CONSTRAINT bud_repair_logs_pkey PRIMARY KEY (id);


--
-- Name: bud_repair_quarantine bud_repair_quarantine_branch_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_quarantine
    ADD CONSTRAINT bud_repair_quarantine_branch_key UNIQUE (branch);


--
-- Name: bud_repair_quarantine bud_repair_quarantine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_quarantine
    ADD CONSTRAINT bud_repair_quarantine_pkey PRIMARY KEY (id);


--
-- Name: bud_repair_steps bud_repair_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_steps
    ADD CONSTRAINT bud_repair_steps_pkey PRIMARY KEY (id);


--
-- Name: bud_rollback_events bud_rollback_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_rollback_events
    ADD CONSTRAINT bud_rollback_events_pkey PRIMARY KEY (id);


--
-- Name: bud_root_cause_initiatives bud_root_cause_initiatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_root_cause_initiatives
    ADD CONSTRAINT bud_root_cause_initiatives_pkey PRIMARY KEY (id);


--
-- Name: bud_root_cause_initiatives bud_root_cause_initiatives_root_cause_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_root_cause_initiatives
    ADD CONSTRAINT bud_root_cause_initiatives_root_cause_key_key UNIQUE (root_cause_key);


--
-- Name: bud_tasks bud_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_tasks
    ADD CONSTRAINT bud_tasks_pkey PRIMARY KEY (id);


--
-- Name: bud_telemetry_events bud_telemetry_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_telemetry_events
    ADD CONSTRAINT bud_telemetry_events_pkey PRIMARY KEY (id);


--
-- Name: bud_terminal_sessions bud_terminal_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_terminal_sessions
    ADD CONSTRAINT bud_terminal_sessions_pkey PRIMARY KEY (id);


--
-- Name: campaign_factory_run_artifacts campaign_factory_run_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_run_artifacts
    ADD CONSTRAINT campaign_factory_run_artifacts_pkey PRIMARY KEY (run_id, artifact_id);


--
-- Name: campaign_factory_runs campaign_factory_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_runs
    ADD CONSTRAINT campaign_factory_runs_pkey PRIMARY KEY (id);


--
-- Name: capture_briefs capture_briefs_brief_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_briefs
    ADD CONSTRAINT capture_briefs_brief_date_key UNIQUE (brief_date);


--
-- Name: capture_briefs capture_briefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_briefs
    ADD CONSTRAINT capture_briefs_pkey PRIMARY KEY (id);


--
-- Name: cash_flow_forecasts cash_flow_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flow_forecasts
    ADD CONSTRAINT cash_flow_forecasts_pkey PRIMARY KEY (id);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: classification_feedback classification_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classification_feedback
    ADD CONSTRAINT classification_feedback_pkey PRIMARY KEY (id);


--
-- Name: client_agreements client_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_agreements
    ADD CONSTRAINT client_agreements_pkey PRIMARY KEY (id);


--
-- Name: competitor_intel competitor_intel_competitor_name_url_service_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_intel
    ADD CONSTRAINT competitor_intel_competitor_name_url_service_key UNIQUE (competitor_name, url, service);


--
-- Name: competitor_intel competitor_intel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_intel
    ADD CONSTRAINT competitor_intel_pkey PRIMARY KEY (id);


--
-- Name: competitor_pages competitor_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_pages
    ADD CONSTRAINT competitor_pages_pkey PRIMARY KEY (id);


--
-- Name: competitor_pages competitor_pages_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_pages
    ADD CONSTRAINT competitor_pages_url_key UNIQUE (url);


--
-- Name: content_assets content_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_pkey PRIMARY KEY (id);


--
-- Name: content_drafts content_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_pkey PRIMARY KEY (id);


--
-- Name: content_ideas content_ideas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_pkey PRIMARY KEY (id);


--
-- Name: content_learning_records content_learning_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_learning_records
    ADD CONSTRAINT content_learning_records_pkey PRIMARY KEY (id);


--
-- Name: content_library_items content_library_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library_items
    ADD CONSTRAINT content_library_items_pkey PRIMARY KEY (id);


--
-- Name: content_library_items content_library_items_source_table_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library_items
    ADD CONSTRAINT content_library_items_source_table_source_id_key UNIQUE (source_table, source_id);


--
-- Name: content_production_cards content_production_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_production_cards
    ADD CONSTRAINT content_production_cards_pkey PRIMARY KEY (id);


--
-- Name: content_scripts content_scripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_scripts
    ADD CONSTRAINT content_scripts_pkey PRIMARY KEY (id);


--
-- Name: memory_contradiction_log contradiction_pair_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_contradiction_log
    ADD CONSTRAINT contradiction_pair_unique UNIQUE (doc_a_id, doc_b_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: crew_coach_notes crew_coach_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_coach_notes
    ADD CONSTRAINT crew_coach_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_properties customer_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_properties
    ADD CONSTRAINT customer_properties_pkey PRIMARY KEY (id);


--
-- Name: customer_properties customer_properties_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_properties
    ADD CONSTRAINT customer_properties_user_id_key UNIQUE (user_id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_key UNIQUE (user_id);


--
-- Name: design_audits design_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_audits
    ADD CONSTRAINT design_audits_pkey PRIMARY KEY (id);


--
-- Name: design_insights design_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_insights
    ADD CONSTRAINT design_insights_pkey PRIMARY KEY (id);


--
-- Name: design_violations design_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_violations
    ADD CONSTRAINT design_violations_pkey PRIMARY KEY (id);


--
-- Name: dev_os_sessions dev_os_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dev_os_sessions
    ADD CONSTRAINT dev_os_sessions_pkey PRIMARY KEY (id);


--
-- Name: efficiency_findings efficiency_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.efficiency_findings
    ADD CONSTRAINT efficiency_findings_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_onboarding employee_onboarding_employee_id_section_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding
    ADD CONSTRAINT employee_onboarding_employee_id_section_key UNIQUE (employee_id, section);


--
-- Name: employee_onboarding employee_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding
    ADD CONSTRAINT employee_onboarding_pkey PRIMARY KEY (id);


--
-- Name: employee_payroll_details employee_payroll_details_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll_details
    ADD CONSTRAINT employee_payroll_details_employee_id_key UNIQUE (employee_id);


--
-- Name: employee_payroll_details employee_payroll_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll_details
    ADD CONSTRAINT employee_payroll_details_pkey PRIMARY KEY (id);


--
-- Name: employees employees_clerk_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_clerk_user_id_key UNIQUE (user_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employment_contracts employment_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_contracts
    ADD CONSTRAINT employment_contracts_pkey PRIMARY KEY (id);


--
-- Name: executive_agent_runs_meta executive_agent_runs_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_agent_runs_meta
    ADD CONSTRAINT executive_agent_runs_meta_pkey PRIMARY KEY (id);


--
-- Name: executive_decisions executive_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_decisions
    ADD CONSTRAINT executive_decisions_pkey PRIMARY KEY (id);


--
-- Name: executive_directives executive_directives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_directives
    ADD CONSTRAINT executive_directives_pkey PRIMARY KEY (id);


--
-- Name: executive_kpi_targets executive_kpi_targets_kpi_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_kpi_targets
    ADD CONSTRAINT executive_kpi_targets_kpi_key_key UNIQUE (kpi_key);


--
-- Name: executive_kpi_targets executive_kpi_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_kpi_targets
    ADD CONSTRAINT executive_kpi_targets_pkey PRIMARY KEY (id);


--
-- Name: executive_metrics_snapshots executive_metrics_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_metrics_snapshots
    ADD CONSTRAINT executive_metrics_snapshots_pkey PRIMARY KEY (id);


--
-- Name: executive_tasks executive_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_tasks
    ADD CONSTRAINT executive_tasks_pkey PRIMARY KEY (id);


--
-- Name: executive_weekly_reviews executive_weekly_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_weekly_reviews
    ADD CONSTRAINT executive_weekly_reviews_pkey PRIMARY KEY (id);


--
-- Name: foreman_insights foreman_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foreman_insights
    ADD CONSTRAINT foreman_insights_pkey PRIMARY KEY (id);


--
-- Name: foreman_lobby_states foreman_lobby_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foreman_lobby_states
    ADD CONSTRAINT foreman_lobby_states_pkey PRIMARY KEY (id);


--
-- Name: founder_journal_entries founder_journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.founder_journal_entries
    ADD CONSTRAINT founder_journal_entries_pkey PRIMARY KEY (id);


--
-- Name: fundraising_contributions fundraising_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_contributions
    ADD CONSTRAINT fundraising_contributions_pkey PRIMARY KEY (id);


--
-- Name: fundraising_items fundraising_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_items
    ADD CONSTRAINT fundraising_items_pkey PRIMARY KEY (id);


--
-- Name: github_events github_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.github_events
    ADD CONSTRAINT github_events_pkey PRIMARY KEY (id);


--
-- Name: growth_pipeline_events growth_pipeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.growth_pipeline_events
    ADD CONSTRAINT growth_pipeline_events_pkey PRIMARY KEY (id);


--
-- Name: job_assignments job_assignments_order_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_order_id_employee_id_key UNIQUE (order_id, employee_id);


--
-- Name: job_assignments job_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_pkey PRIMARY KEY (id);


--
-- Name: job_completions job_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_completions
    ADD CONSTRAINT job_completions_pkey PRIMARY KEY (id);


--
-- Name: job_participant_matches job_participant_matches_order_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participant_matches
    ADD CONSTRAINT job_participant_matches_order_id_employee_id_key UNIQUE (order_id, employee_id);


--
-- Name: job_participant_matches job_participant_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participant_matches
    ADD CONSTRAINT job_participant_matches_pkey PRIMARY KEY (id);


--
-- Name: job_photos job_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_photos
    ADD CONSTRAINT job_photos_pkey PRIMARY KEY (id);


--
-- Name: job_publications job_publications_order_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_publications
    ADD CONSTRAINT job_publications_order_id_employee_id_key UNIQUE (order_id, employee_id);


--
-- Name: job_publications job_publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_publications
    ADD CONSTRAINT job_publications_pkey PRIMARY KEY (id);


--
-- Name: job_requirements job_requirements_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requirements
    ADD CONSTRAINT job_requirements_order_id_key UNIQUE (order_id);


--
-- Name: job_requirements job_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requirements
    ADD CONSTRAINT job_requirements_pkey PRIMARY KEY (id);


--
-- Name: job_variations job_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_variations
    ADD CONSTRAINT job_variations_pkey PRIMARY KEY (id);


--
-- Name: knowledge_articles knowledge_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id);


--
-- Name: lapsed_outreach lapsed_outreach_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lapsed_outreach
    ADD CONSTRAINT lapsed_outreach_pkey PRIMARY KEY (id);


--
-- Name: lead_conversations lead_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_conversations
    ADD CONSTRAINT lead_conversations_pkey PRIMARY KEY (id);


--
-- Name: lead_follow_ups lead_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_pkey PRIMARY KEY (id);


--
-- Name: lead_response_metrics lead_response_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_response_metrics
    ADD CONSTRAINT lead_response_metrics_pkey PRIMARY KEY (metric_day, source);


--
-- Name: lead_suburb_analytics lead_suburb_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_suburb_analytics
    ADD CONSTRAINT lead_suburb_analytics_pkey PRIMARY KEY (metric_day, suburb);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: lobby_themes lobby_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lobby_themes
    ADD CONSTRAINT lobby_themes_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_queue_items marketing_campaign_queue_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_queue_items
    ADD CONSTRAINT marketing_campaign_queue_items_pkey PRIMARY KEY (campaign_id, queue_item_id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_distribution_playbooks marketing_distribution_playbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_distribution_playbooks
    ADD CONSTRAINT marketing_distribution_playbooks_pkey PRIMARY KEY (id);


--
-- Name: marketing_distribution_playbooks marketing_distribution_playbooks_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_distribution_playbooks
    ADD CONSTRAINT marketing_distribution_playbooks_title_key UNIQUE (title);


--
-- Name: marketing_metrics marketing_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_metrics
    ADD CONSTRAINT marketing_metrics_pkey PRIMARY KEY (id);


--
-- Name: marketing_metrics marketing_metrics_snapshot_date_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_metrics
    ADD CONSTRAINT marketing_metrics_snapshot_date_channel_key UNIQUE (snapshot_date, channel);


--
-- Name: marketing_publishing_queue marketing_publishing_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_publishing_queue
    ADD CONSTRAINT marketing_publishing_queue_pkey PRIMARY KEY (id);


--
-- Name: marketing_social_channels marketing_social_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_social_channels
    ADD CONSTRAINT marketing_social_channels_pkey PRIMARY KEY (id);


--
-- Name: marketing_social_channels marketing_social_channels_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_social_channels
    ADD CONSTRAINT marketing_social_channels_platform_key UNIQUE (platform);


--
-- Name: memory_contradiction_log memory_contradiction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_contradiction_log
    ADD CONSTRAINT memory_contradiction_log_pkey PRIMARY KEY (id);


--
-- Name: memory_documents memory_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_documents
    ADD CONSTRAINT memory_documents_pkey PRIMARY KEY (id);


--
-- Name: memory_documents memory_documents_vault_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_documents
    ADD CONSTRAINT memory_documents_vault_path_key UNIQUE (vault_path);


--
-- Name: memory_edges memory_edges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_edges
    ADD CONSTRAINT memory_edges_pkey PRIMARY KEY (id);


--
-- Name: memory_edges memory_edges_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_edges
    ADD CONSTRAINT memory_edges_unique UNIQUE (source_id, target_id, relationship);


--
-- Name: memory_graph_extractions memory_graph_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_graph_extractions
    ADD CONSTRAINT memory_graph_extractions_pkey PRIMARY KEY (document_id);


--
-- Name: memory_read_log memory_read_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_read_log
    ADD CONSTRAINT memory_read_log_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: ndis_organisations ndis_organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_organisations
    ADD CONSTRAINT ndis_organisations_pkey PRIMARY KEY (id);


--
-- Name: ndis_participants ndis_participants_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_participants
    ADD CONSTRAINT ndis_participants_invite_token_key UNIQUE (invite_token);


--
-- Name: ndis_participants ndis_participants_organisation_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_participants
    ADD CONSTRAINT ndis_participants_organisation_id_email_key UNIQUE (organisation_id, email);


--
-- Name: ndis_participants ndis_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_participants
    ADD CONSTRAINT ndis_participants_pkey PRIMARY KEY (id);


--
-- Name: ndis_plan_matches ndis_plan_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_plan_matches
    ADD CONSTRAINT ndis_plan_matches_pkey PRIMARY KEY (id);


--
-- Name: order_fees order_fees_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_fees
    ADD CONSTRAINT order_fees_order_id_key UNIQUE (order_id);


--
-- Name: order_fees order_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_fees
    ADD CONSTRAINT order_fees_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: participant_support_profiles participant_support_profiles_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_support_profiles
    ADD CONSTRAINT participant_support_profiles_employee_id_key UNIQUE (employee_id);


--
-- Name: participant_support_profiles participant_support_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_support_profiles
    ADD CONSTRAINT participant_support_profiles_pkey PRIMARY KEY (id);


--
-- Name: payables payables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);


--
-- Name: payouts payouts_stripe_payout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_stripe_payout_id_key UNIQUE (stripe_payout_id);


--
-- Name: phone_calls phone_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_calls
    ADD CONSTRAINT phone_calls_pkey PRIMARY KEY (id);


--
-- Name: pipeline_agent_scores pipeline_agent_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_agent_scores
    ADD CONSTRAINT pipeline_agent_scores_pkey PRIMARY KEY (id);


--
-- Name: pipeline_artifacts pipeline_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_artifacts
    ADD CONSTRAINT pipeline_artifacts_pkey PRIMARY KEY (id);


--
-- Name: pipeline_kill_switch pipeline_kill_switch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_kill_switch
    ADD CONSTRAINT pipeline_kill_switch_pkey PRIMARY KEY (id);


--
-- Name: pipeline_policy pipeline_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_policy
    ADD CONSTRAINT pipeline_policy_pkey PRIMARY KEY (surface);


--
-- Name: pipeline_runs pipeline_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_runs
    ADD CONSTRAINT pipeline_runs_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stage_events pipeline_stage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stage_events
    ADD CONSTRAINT pipeline_stage_events_pkey PRIMARY KEY (id);


--
-- Name: pr_review_predictions pr_review_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pr_review_predictions
    ADD CONSTRAINT pr_review_predictions_pkey PRIMARY KEY (id);


--
-- Name: pricing_recommendations pricing_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_recommendations
    ADD CONSTRAINT pricing_recommendations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: quote_funnel_events quote_funnel_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_funnel_events
    ADD CONSTRAINT quote_funnel_events_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: ratings ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_pkey PRIMARY KEY (id);


--
-- Name: rego_cache rego_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rego_cache
    ADD CONSTRAINT rego_cache_pkey PRIMARY KEY (rego, state);


--
-- Name: research_trends research_trends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_trends
    ADD CONSTRAINT research_trends_pkey PRIMARY KEY (id);


--
-- Name: resilience_events resilience_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resilience_events
    ADD CONSTRAINT resilience_events_pkey PRIMARY KEY (id);


--
-- Name: reviewer_calibration reviewer_calibration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviewer_calibration
    ADD CONSTRAINT reviewer_calibration_pkey PRIMARY KEY (id);


--
-- Name: reviewer_calibration reviewer_calibration_system_area_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviewer_calibration
    ADD CONSTRAINT reviewer_calibration_system_area_key UNIQUE (system_area);


--
-- Name: sandbox_agent_health sandbox_agent_health_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_agent_health
    ADD CONSTRAINT sandbox_agent_health_pkey PRIMARY KEY (id);


--
-- Name: sandbox_agent_responses sandbox_agent_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_agent_responses
    ADD CONSTRAINT sandbox_agent_responses_pkey PRIMARY KEY (id);


--
-- Name: sandbox_decision_scores sandbox_decision_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_decision_scores
    ADD CONSTRAINT sandbox_decision_scores_pkey PRIMARY KEY (id);


--
-- Name: sandbox_lessons_learned sandbox_lessons_learned_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_lessons_learned
    ADD CONSTRAINT sandbox_lessons_learned_pkey PRIMARY KEY (id);


--
-- Name: sandbox_policy sandbox_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_policy
    ADD CONSTRAINT sandbox_policy_pkey PRIMARY KEY (key);


--
-- Name: sandbox_run_batches sandbox_run_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_run_batches
    ADD CONSTRAINT sandbox_run_batches_pkey PRIMARY KEY (id);


--
-- Name: sandbox_scenarios sandbox_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_scenarios
    ADD CONSTRAINT sandbox_scenarios_pkey PRIMARY KEY (id);


--
-- Name: sandbox_scenarios sandbox_scenarios_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_scenarios
    ADD CONSTRAINT sandbox_scenarios_slug_key UNIQUE (slug);


--
-- Name: sandbox_training_runs sandbox_training_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_training_runs
    ADD CONSTRAINT sandbox_training_runs_pkey PRIMARY KEY (id);


--
-- Name: service_pricing service_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_pricing
    ADD CONSTRAINT service_pricing_pkey PRIMARY KEY (id);


--
-- Name: service_pricing service_pricing_service_suburb_price_unit_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_pricing
    ADD CONSTRAINT service_pricing_service_suburb_price_unit_effective_from_key UNIQUE (service, suburb, price_unit, effective_from);


--
-- Name: shift_segments shift_segments_order_id_segment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_segments
    ADD CONSTRAINT shift_segments_order_id_segment_number_key UNIQUE (order_id, segment_number);


--
-- Name: shift_segments shift_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_segments
    ADD CONSTRAINT shift_segments_pkey PRIMARY KEY (id);


--
-- Name: site_feedback site_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_feedback
    ADD CONSTRAINT site_feedback_pkey PRIMARY KEY (id);


--
-- Name: site_impact_stats site_impact_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_impact_stats
    ADD CONSTRAINT site_impact_stats_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- Name: site_visitors site_visitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_visitors
    ADD CONSTRAINT site_visitors_pkey PRIMARY KEY (session_id);


--
-- Name: social_proof_items social_proof_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_proof_items
    ADD CONSTRAINT social_proof_items_pkey PRIMARY KEY (id);


--
-- Name: story_arcs story_arcs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_arcs
    ADD CONSTRAINT story_arcs_pkey PRIMARY KEY (id);


--
-- Name: story_bible_sections story_bible_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_bible_sections
    ADD CONSTRAINT story_bible_sections_pkey PRIMARY KEY (id);


--
-- Name: story_bible_sections story_bible_sections_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_bible_sections
    ADD CONSTRAINT story_bible_sections_section_key_key UNIQUE (section_key);


--
-- Name: story_chapters story_chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_chapters
    ADD CONSTRAINT story_chapters_pkey PRIMARY KEY (id);


--
-- Name: story_characters story_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_characters
    ADD CONSTRAINT story_characters_pkey PRIMARY KEY (id);


--
-- Name: story_characters story_characters_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_characters
    ADD CONSTRAINT story_characters_slug_key UNIQUE (slug);


--
-- Name: story_drafts story_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_drafts
    ADD CONSTRAINT story_drafts_pkey PRIMARY KEY (id);


--
-- Name: story_open_threads story_open_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_open_threads
    ADD CONSTRAINT story_open_threads_pkey PRIMARY KEY (id);


--
-- Name: story_opportunities story_opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_opportunities
    ADD CONSTRAINT story_opportunities_pkey PRIMARY KEY (id);


--
-- Name: story_reviews story_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reviews
    ADD CONSTRAINT story_reviews_pkey PRIMARY KEY (id);


--
-- Name: stripe_disputes stripe_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_disputes
    ADD CONSTRAINT stripe_disputes_pkey PRIMARY KEY (id);


--
-- Name: subscription_orders subscription_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_orders
    ADD CONSTRAINT subscription_orders_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: transport_arrangements transport_arrangements_order_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_arrangements
    ADD CONSTRAINT transport_arrangements_order_id_employee_id_key UNIQUE (order_id, employee_id);


--
-- Name: transport_arrangements transport_arrangements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_arrangements
    ADD CONSTRAINT transport_arrangements_pkey PRIMARY KEY (id);


--
-- Name: vehicle_overrides vehicle_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_overrides
    ADD CONSTRAINT vehicle_overrides_pkey PRIMARY KEY (id);


--
-- Name: visitor_events visitor_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_events
    ADD CONSTRAINT visitor_events_pkey PRIMARY KEY (id);


--
-- Name: whs_records whs_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whs_records
    ADD CONSTRAINT whs_records_pkey PRIMARY KEY (id);


--
-- Name: worker_payouts worker_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payouts
    ADD CONSTRAINT worker_payouts_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_18 messages_2026_07_18_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_18
    ADD CONSTRAINT messages_2026_07_18_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_19 messages_2026_07_19_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_19
    ADD CONSTRAINT messages_2026_07_19_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_20 messages_2026_07_20_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_20
    ADD CONSTRAINT messages_2026_07_20_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_21 messages_2026_07_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_21
    ADD CONSTRAINT messages_2026_07_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_22 messages_2026_07_22_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_22
    ADD CONSTRAINT messages_2026_07_22_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_23 messages_2026_07_23_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_23
    ADD CONSTRAINT messages_2026_07_23_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_07_24 messages_2026_07_24_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_07_24
    ADD CONSTRAINT messages_2026_07_24_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: admin_opt_findings_automation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_opt_findings_automation ON public.admin_optimization_findings USING btree (automation_candidate) WHERE (automation_candidate = true);


--
-- Name: admin_opt_findings_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_opt_findings_created ON public.admin_optimization_findings USING btree (created_at DESC);


--
-- Name: admin_opt_findings_focus_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_opt_findings_focus_area ON public.admin_optimization_findings USING btree (focus_area);


--
-- Name: admin_opt_findings_friction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_opt_findings_friction ON public.admin_optimization_findings USING btree (friction_band, priority);


--
-- Name: admin_opt_findings_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_opt_findings_run_id ON public.admin_optimization_findings USING btree (run_id);


--
-- Name: admin_opt_findings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_opt_findings_status ON public.admin_optimization_findings USING btree (status);


--
-- Name: agent_actions_one_pending_per_target; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agent_actions_one_pending_per_target ON public.agent_actions USING btree (agent_id, action_type, target_table, target_id) WHERE ((status = 'pending'::text) AND (target_table IS NOT NULL) AND (target_id IS NOT NULL));


--
-- Name: agent_actions_one_pending_root_cause_review; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agent_actions_one_pending_root_cause_review ON public.agent_actions USING btree (action_identity) WHERE ((status = 'pending'::text) AND (action_identity IS NOT NULL) AND (action_type = 'flag_for_review'::text));


--
-- Name: agent_guardrail_events_agent_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_guardrail_events_agent_id_created_at_idx ON public.agent_guardrail_events USING btree (agent_id, created_at DESC);


--
-- Name: agent_guardrail_events_policy_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_guardrail_events_policy_id_idx ON public.agent_guardrail_events USING btree (policy_id);


--
-- Name: agent_guardrail_events_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_guardrail_events_run_id_idx ON public.agent_guardrail_events USING btree (run_id);


--
-- Name: analytics_findings_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_findings_category ON public.analytics_findings USING btree (category, status);


--
-- Name: analytics_findings_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_findings_created ON public.analytics_findings USING btree (created_at DESC);


--
-- Name: analytics_findings_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_findings_priority ON public.analytics_findings USING btree (priority, status);


--
-- Name: analytics_findings_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_findings_report_id ON public.analytics_findings USING btree (report_id);


--
-- Name: analytics_funnels_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_funnels_period ON public.analytics_funnels USING btree (period_end DESC, funnel_name, step_index);


--
-- Name: analytics_funnels_report_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_funnels_report_id ON public.analytics_funnels USING btree (report_id);


--
-- Name: analytics_reports_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_reports_created ON public.analytics_reports USING btree (created_at DESC);


--
-- Name: analytics_reports_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_reports_run_id ON public.analytics_reports USING btree (run_id);


--
-- Name: audit_log_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_action_idx ON public.audit_log USING btree (action);


--
-- Name: audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at DESC);


--
-- Name: audit_log_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_entity_idx ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: audit_log_user_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_user_email_idx ON public.audit_log USING btree (user_email);


--
-- Name: bud_activity_feed_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_activity_feed_created_at_idx ON public.bud_activity_feed USING btree (created_at DESC);


--
-- Name: bud_activity_feed_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_activity_feed_event_type_idx ON public.bud_activity_feed USING btree (event_type);


--
-- Name: bud_approval_queue_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_approval_queue_archived_at_idx ON public.bud_approval_queue USING btree (archived_at DESC) WHERE (status = 'archived'::text);


--
-- Name: bud_approval_queue_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_approval_queue_created_at_idx ON public.bud_approval_queue USING btree (created_at DESC);


--
-- Name: bud_approval_queue_one_pending_improvement_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bud_approval_queue_one_pending_improvement_identity ON public.bud_approval_queue USING btree (approval_identity) WHERE ((approval_identity IS NOT NULL) AND (status = 'pending'::text));


--
-- Name: bud_approval_queue_root_cause_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_approval_queue_root_cause_idx ON public.bud_approval_queue USING btree (root_cause_key, status);


--
-- Name: bud_approval_queue_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_approval_queue_status_created_at_idx ON public.bud_approval_queue USING btree (status, created_at DESC);


--
-- Name: bud_approval_queue_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_approval_queue_status_idx ON public.bud_approval_queue USING btree (status);


--
-- Name: bud_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_audit_logs_created_at_idx ON public.bud_audit_logs USING btree (created_at DESC);


--
-- Name: bud_deployment_verifications_execution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_deployment_verifications_execution_idx ON public.bud_deployment_verifications USING btree (execution_id, started_at DESC);


--
-- Name: bud_evidence_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_evidence_created_idx ON public.bud_evidence USING btree (created_at DESC);


--
-- Name: bud_evidence_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_evidence_task_idx ON public.bud_evidence USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: bud_evidence_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_evidence_type_idx ON public.bud_evidence USING btree (type);


--
-- Name: bud_improvement_learnings_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_improvement_learnings_embedding_idx ON public.bud_improvement_learnings USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='50');


--
-- Name: bud_improvement_signals_fingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_improvement_signals_fingerprint_idx ON public.bud_improvement_signals USING btree (fingerprint);


--
-- Name: bud_improvement_signals_one_active_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bud_improvement_signals_one_active_fingerprint ON public.bud_improvement_signals USING btree (fingerprint) WHERE ((fingerprint IS NOT NULL) AND (status = ANY (ARRAY['new'::text, 'queued'::text, 'executing'::text])));


--
-- Name: bud_improvement_signals_root_cause_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_improvement_signals_root_cause_idx ON public.bud_improvement_signals USING btree (root_cause_key, status);


--
-- Name: bud_improvements_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_improvements_created_idx ON public.bud_improvements USING btree (created_at DESC);


--
-- Name: bud_improvements_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_improvements_status_idx ON public.bud_improvements USING btree (status);


--
-- Name: bud_insights_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_insights_created_at_idx ON public.bud_insights USING btree (created_at DESC);


--
-- Name: bud_insights_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_insights_severity_idx ON public.bud_insights USING btree (severity);


--
-- Name: bud_lobby_states_current_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bud_lobby_states_current_idx ON public.bud_lobby_states USING btree (is_current) WHERE (is_current = true);


--
-- Name: bud_lobby_states_generated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_lobby_states_generated_at_idx ON public.bud_lobby_states USING btree (generated_at DESC);


--
-- Name: bud_repair_executions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_repair_executions_status_idx ON public.bud_repair_executions USING btree (status);


--
-- Name: bud_repair_executions_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_repair_executions_task_idx ON public.bud_repair_executions USING btree (task_id, created_at DESC);


--
-- Name: bud_repair_learnings_root_cause_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_repair_learnings_root_cause_idx ON public.bud_repair_learnings USING btree (root_cause_type, created_at DESC);


--
-- Name: bud_repair_logs_execution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_repair_logs_execution_idx ON public.bud_repair_logs USING btree (execution_id, created_at);


--
-- Name: bud_repair_quarantine_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_repair_quarantine_status_idx ON public.bud_repair_quarantine USING btree (status, blocked_until);


--
-- Name: bud_repair_steps_execution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_repair_steps_execution_idx ON public.bud_repair_steps USING btree (execution_id, started_at);


--
-- Name: bud_tasks_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_tasks_created_at_idx ON public.bud_tasks USING btree (created_at DESC);


--
-- Name: bud_tasks_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_tasks_status_idx ON public.bud_tasks USING btree (status);


--
-- Name: bud_terminal_sessions_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bud_terminal_sessions_started_idx ON public.bud_terminal_sessions USING btree (started_at DESC);


--
-- Name: content_ideas_opportunity_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX content_ideas_opportunity_id_unique ON public.content_ideas USING btree (opportunity_id) WHERE (opportunity_id IS NOT NULL);


--
-- Name: design_audits_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_audits_date ON public.design_audits USING btree (audit_date DESC);


--
-- Name: design_audits_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_audits_run_id ON public.design_audits USING btree (run_id);


--
-- Name: design_audits_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_audits_score ON public.design_audits USING btree (overall_score DESC);


--
-- Name: design_violations_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_violations_area ON public.design_violations USING btree (area, status);


--
-- Name: design_violations_audit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_violations_audit_id ON public.design_violations USING btree (audit_id);


--
-- Name: design_violations_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_violations_created ON public.design_violations USING btree (created_at DESC);


--
-- Name: design_violations_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX design_violations_priority ON public.design_violations USING btree (priority, status);


--
-- Name: dev_os_sessions_agents_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dev_os_sessions_agents_idx ON public.dev_os_sessions USING gin (agents_used);


--
-- Name: dev_os_sessions_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dev_os_sessions_created_idx ON public.dev_os_sessions USING btree (created_at DESC);


--
-- Name: efficiency_findings_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX efficiency_findings_created_at_idx ON public.efficiency_findings USING btree (created_at DESC);


--
-- Name: efficiency_findings_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX efficiency_findings_domain_idx ON public.efficiency_findings USING btree (domain);


--
-- Name: efficiency_findings_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX efficiency_findings_severity_idx ON public.efficiency_findings USING btree (severity, priority);


--
-- Name: executive_agent_runs_meta_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_agent_runs_meta_agent_id_idx ON public.executive_agent_runs_meta USING btree (agent_id);


--
-- Name: executive_agent_runs_meta_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_agent_runs_meta_created_at_idx ON public.executive_agent_runs_meta USING btree (created_at DESC);


--
-- Name: executive_decisions_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_decisions_agent_id_idx ON public.executive_decisions USING btree (agent_id);


--
-- Name: executive_decisions_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_decisions_created_at_idx ON public.executive_decisions USING btree (created_at DESC);


--
-- Name: executive_decisions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_decisions_status_idx ON public.executive_decisions USING btree (status);


--
-- Name: executive_directives_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_directives_status_idx ON public.executive_directives USING btree (status);


--
-- Name: executive_metrics_snapshots_captured_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_metrics_snapshots_captured_at_idx ON public.executive_metrics_snapshots USING btree (captured_at DESC);


--
-- Name: executive_tasks_decision_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_tasks_decision_id_idx ON public.executive_tasks USING btree (decision_id);


--
-- Name: executive_tasks_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executive_tasks_status_idx ON public.executive_tasks USING btree (status);


--
-- Name: executive_weekly_reviews_week_start_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX executive_weekly_reviews_week_start_uidx ON public.executive_weekly_reviews USING btree (week_start);


--
-- Name: foreman_insights_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foreman_insights_created_at_idx ON public.foreman_insights USING btree (created_at DESC);


--
-- Name: foreman_insights_severity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foreman_insights_severity_idx ON public.foreman_insights USING btree (severity, created_at DESC);


--
-- Name: foreman_lobby_states_current_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX foreman_lobby_states_current_idx ON public.foreman_lobby_states USING btree (is_current) WHERE (is_current = true);


--
-- Name: foreman_lobby_states_generated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foreman_lobby_states_generated_at_idx ON public.foreman_lobby_states USING btree (generated_at DESC);


--
-- Name: github_events_adr_flags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX github_events_adr_flags ON public.github_events USING btree (event_type, status) WHERE ((event_type = 'adr_flag'::text) AND (status = 'pending'::text));


--
-- Name: github_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX github_events_created ON public.github_events USING btree (created_at DESC);


--
-- Name: github_events_delivery_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX github_events_delivery_id ON public.github_events USING btree (delivery_id);


--
-- Name: github_events_deploy_failures; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX github_events_deploy_failures ON public.github_events USING btree (event_type, created_at DESC) WHERE (event_type = 'deployment_failure'::text);


--
-- Name: github_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX github_events_event_type ON public.github_events USING btree (event_type, status);


--
-- Name: growth_pipeline_events_journal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX growth_pipeline_events_journal ON public.growth_pipeline_events USING btree (journal_entry_id);


--
-- Name: growth_pipeline_events_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX growth_pipeline_events_source ON public.growth_pipeline_events USING btree (source_id);


--
-- Name: growth_pipeline_events_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX growth_pipeline_events_time ON public.growth_pipeline_events USING btree (created_at DESC);


--
-- Name: growth_pipeline_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX growth_pipeline_events_type ON public.growth_pipeline_events USING btree (event_type);


--
-- Name: idx_admin_ux_proposals_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_ux_proposals_page ON public.admin_ux_proposals USING btree (page_path);


--
-- Name: idx_admin_ux_proposals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_ux_proposals_status ON public.admin_ux_proposals USING btree (status) WHERE (status = ANY (ARRAY['new'::text, 'reviewing'::text]));


--
-- Name: idx_agent_actions_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_actions_environment ON public.agent_actions USING btree (environment);


--
-- Name: idx_agent_actions_identity_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_agent_actions_identity_pending ON public.agent_actions USING btree (action_identity) WHERE ((status = 'pending'::text) AND (action_identity IS NOT NULL));


--
-- Name: idx_agent_actions_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_actions_run ON public.agent_actions USING btree (run_id);


--
-- Name: idx_agent_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_actions_status ON public.agent_actions USING btree (status) WHERE (status = 'pending'::text);


--
-- Name: idx_agent_alerts_action_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_agent_alerts_action_id ON public.agent_alerts USING btree (action_id) WHERE (action_id IS NOT NULL);


--
-- Name: idx_agent_alerts_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_alerts_agent_id ON public.agent_alerts USING btree (agent_id);


--
-- Name: idx_agent_alerts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_alerts_created_at ON public.agent_alerts USING btree (created_at DESC);


--
-- Name: idx_agent_alerts_source_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_alerts_source_agent ON public.agent_alerts USING btree (source_agent);


--
-- Name: idx_agent_alerts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_alerts_status ON public.agent_alerts USING btree (status);


--
-- Name: idx_agent_evolutions_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_evolutions_pending ON public.agent_evolutions USING btree (target_agent_id) WHERE (status = 'pending'::text);


--
-- Name: idx_agent_runs_agent_id_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_runs_agent_id_started ON public.agent_runs USING btree (agent_id, started_at DESC);


--
-- Name: idx_agent_runs_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_runs_embedding ON public.agent_runs USING ivfflat (summary_embedding public.vector_cosine_ops) WITH (lists='50');


--
-- Name: idx_agent_runs_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_runs_environment ON public.agent_runs USING btree (environment);


--
-- Name: idx_agent_runs_quality; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_runs_quality ON public.agent_runs USING btree (agent_id, quality_score) WHERE (quality_score IS NOT NULL);


--
-- Name: idx_agent_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_runs_status ON public.agent_runs USING btree (status) WHERE (status = ANY (ARRAY['running'::text, 'needs_approval'::text]));


--
-- Name: idx_analytics_sessions_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_sessions_country ON public.analytics_sessions USING btree (country);


--
-- Name: idx_analytics_sessions_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_sessions_environment ON public.analytics_sessions USING btree (environment);


--
-- Name: idx_analytics_sessions_first_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_sessions_first_seen ON public.analytics_sessions USING btree (first_seen_at DESC);


--
-- Name: idx_analytics_sessions_utm_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_sessions_utm_source ON public.analytics_sessions USING btree (utm_source);


--
-- Name: idx_applicants_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicants_created_at ON public.applicants USING btree (created_at DESC);


--
-- Name: idx_applicants_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicants_role ON public.applicants USING btree (role);


--
-- Name: idx_applicants_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicants_stage ON public.applicants USING btree (stage);


--
-- Name: idx_applicants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicants_user_id ON public.applicants USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_artifact_versions_artifact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifact_versions_artifact ON public.artifact_versions USING btree (artifact_id);


--
-- Name: idx_artifact_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifact_versions_created_at ON public.artifact_versions USING btree (created_at DESC);


--
-- Name: idx_artifacts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_created_at ON public.artifacts USING btree (created_at DESC);


--
-- Name: idx_artifacts_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_score ON public.artifacts USING btree (score DESC NULLS LAST);


--
-- Name: idx_artifacts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_status ON public.artifacts USING btree (status);


--
-- Name: idx_artifacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_artifacts_type ON public.artifacts USING btree (type);


--
-- Name: idx_bud_approval_queue_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_approval_queue_environment ON public.bud_approval_queue USING btree (environment);


--
-- Name: idx_bud_browser_test_runs_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_browser_test_runs_execution_id ON public.bud_browser_test_runs USING btree (execution_id) WHERE (execution_id IS NOT NULL);


--
-- Name: idx_bud_browser_test_runs_failed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_browser_test_runs_failed ON public.bud_browser_test_runs USING btree (failed, created_at DESC) WHERE (failed > 0);


--
-- Name: idx_bud_improvement_signals_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_improvement_signals_environment ON public.bud_improvement_signals USING btree (environment);


--
-- Name: idx_bud_repair_executions_ci_conclusion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_repair_executions_ci_conclusion ON public.bud_repair_executions USING btree (ci_conclusion) WHERE (ci_conclusion IS NOT NULL);


--
-- Name: idx_bud_repair_executions_pr_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_repair_executions_pr_url ON public.bud_repair_executions USING btree (created_at DESC) WHERE (pr_url IS NOT NULL);


--
-- Name: idx_bud_repair_executions_taste_pass; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_repair_executions_taste_pass ON public.bud_repair_executions USING btree (taste_pass) WHERE (taste_pass IS NOT NULL);


--
-- Name: idx_bud_repair_learnings_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_repair_learnings_embedding ON public.bud_repair_learnings USING ivfflat (summary_embedding public.vector_cosine_ops) WITH (lists='10');


--
-- Name: idx_bud_rollback_events_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_rollback_events_agent ON public.bud_rollback_events USING btree (agent_id, created_at DESC);


--
-- Name: idx_bud_rollback_events_execution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_rollback_events_execution ON public.bud_rollback_events USING btree (execution_id);


--
-- Name: idx_bud_rollback_events_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_rollback_events_trigger ON public.bud_rollback_events USING btree (trigger, created_at DESC);


--
-- Name: idx_bud_root_cause_initiatives_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bud_root_cause_initiatives_environment ON public.bud_root_cause_initiatives USING btree (environment);


--
-- Name: idx_campaign_factory_run_artifacts_artifact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_factory_run_artifacts_artifact ON public.campaign_factory_run_artifacts USING btree (artifact_id);


--
-- Name: idx_campaign_factory_runs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_factory_runs_created_at ON public.campaign_factory_runs USING btree (created_at DESC);


--
-- Name: idx_campaign_factory_runs_goal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_factory_runs_goal ON public.campaign_factory_runs USING btree (goal);


--
-- Name: idx_campaign_factory_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_factory_runs_status ON public.campaign_factory_runs USING btree (status);


--
-- Name: idx_campaign_factory_runs_story; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_factory_runs_story ON public.campaign_factory_runs USING btree (selected_story_opportunity_id);


--
-- Name: idx_checklist_templates_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_templates_service ON public.checklist_templates USING btree (service_type);


--
-- Name: idx_client_agreements_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_agreements_order ON public.client_agreements USING btree (order_id);


--
-- Name: idx_client_agreements_quote; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_agreements_quote ON public.client_agreements USING btree (quote_id);


--
-- Name: idx_competitor_intel_service_suburb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitor_intel_service_suburb ON public.competitor_intel USING btree (service, suburb);


--
-- Name: idx_content_assets_consent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_assets_consent ON public.content_assets USING btree (consent_status);


--
-- Name: idx_content_assets_idea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_assets_idea ON public.content_assets USING btree (idea_id);


--
-- Name: idx_content_assets_production; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_assets_production ON public.content_assets USING btree (production_card_id);


--
-- Name: idx_content_assets_script; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_assets_script ON public.content_assets USING btree (script_id);


--
-- Name: idx_content_assets_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_assets_type ON public.content_assets USING btree (asset_type);


--
-- Name: idx_content_ideas_arc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_arc ON public.content_ideas USING btree (related_arc_id);


--
-- Name: idx_content_ideas_opportunity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_opportunity ON public.content_ideas USING btree (opportunity_id);


--
-- Name: idx_content_ideas_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_priority ON public.content_ideas USING btree (priority);


--
-- Name: idx_content_ideas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_ideas_status ON public.content_ideas USING btree (status);


--
-- Name: idx_content_learning_records_artifact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_artifact ON public.content_learning_records USING btree (learning_artifact_id);


--
-- Name: idx_content_learning_records_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_campaign ON public.content_learning_records USING btree (campaign_id);


--
-- Name: idx_content_learning_records_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_created_at ON public.content_learning_records USING btree (created_at DESC);


--
-- Name: idx_content_learning_records_goal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_goal ON public.content_learning_records USING btree (goal);


--
-- Name: idx_content_learning_records_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_run ON public.content_learning_records USING btree (campaign_factory_run_id);


--
-- Name: idx_content_learning_records_source_artifacts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_source_artifacts ON public.content_learning_records USING gin (source_artifact_ids);


--
-- Name: idx_content_learning_records_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_learning_records_status ON public.content_learning_records USING btree (status);


--
-- Name: idx_content_library_items_artifact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_artifact ON public.content_library_items USING btree (artifact_id);


--
-- Name: idx_content_library_items_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_campaign ON public.content_library_items USING btree (campaign_id);


--
-- Name: idx_content_library_items_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_created_at ON public.content_library_items USING btree (created_at DESC);


--
-- Name: idx_content_library_items_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_platform ON public.content_library_items USING btree (platform);


--
-- Name: idx_content_library_items_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_search ON public.content_library_items USING gin (to_tsvector('english'::regconfig, searchable_text));


--
-- Name: idx_content_library_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_status ON public.content_library_items USING btree (status);


--
-- Name: idx_content_library_items_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_tags ON public.content_library_items USING gin (tags);


--
-- Name: idx_content_library_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_library_items_type ON public.content_library_items USING btree (item_type);


--
-- Name: idx_content_production_cards_arc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_production_cards_arc ON public.content_production_cards USING btree (related_arc_id);


--
-- Name: idx_content_production_cards_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_production_cards_deadline ON public.content_production_cards USING btree (deadline);


--
-- Name: idx_content_production_cards_script; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_production_cards_script ON public.content_production_cards USING btree (script_id);


--
-- Name: idx_content_production_cards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_production_cards_status ON public.content_production_cards USING btree (status);


--
-- Name: idx_content_scripts_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_scripts_created ON public.content_scripts USING btree (created_at DESC);


--
-- Name: idx_content_scripts_idea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_scripts_idea ON public.content_scripts USING btree (idea_id);


--
-- Name: idx_content_scripts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_scripts_status ON public.content_scripts USING btree (status);


--
-- Name: idx_conversations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_entity ON public.conversations USING btree (entity_type, entity_id);


--
-- Name: idx_conversations_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_environment ON public.conversations USING btree (environment);


--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_environment ON public.customers USING btree (environment);


--
-- Name: idx_customers_is_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_is_test ON public.customers USING btree (is_test) WHERE (is_test = true);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_customers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);


--
-- Name: idx_design_insights_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_insights_page ON public.design_insights USING btree (page_path);


--
-- Name: idx_design_insights_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_insights_status ON public.design_insights USING btree (status) WHERE (status = ANY (ARRAY['new'::text, 'reviewing'::text]));


--
-- Name: idx_employee_documents_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_documents_employee ON public.employee_documents USING btree (employee_id);


--
-- Name: idx_employee_onboarding_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_onboarding_employee ON public.employee_onboarding USING btree (employee_id);


--
-- Name: idx_employee_payroll_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_payroll_employee ON public.employee_payroll_details USING btree (employee_id);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_employment_contracts_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employment_contracts_employee ON public.employment_contracts USING btree (employee_id);


--
-- Name: idx_employment_contracts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employment_contracts_status ON public.employment_contracts USING btree (status);


--
-- Name: idx_fundraising_contributions_item_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fundraising_contributions_item_status ON public.fundraising_contributions USING btree (fundraising_item_id, status);


--
-- Name: idx_fundraising_contributions_payment_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fundraising_contributions_payment_reference ON public.fundraising_contributions USING btree (payment_provider, payment_reference) WHERE (payment_reference IS NOT NULL);


--
-- Name: idx_fundraising_contributions_stripe_event; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fundraising_contributions_stripe_event ON public.fundraising_contributions USING btree (stripe_event_id) WHERE (stripe_event_id IS NOT NULL);


--
-- Name: idx_fundraising_items_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fundraising_items_slug ON public.fundraising_items USING btree (slug);


--
-- Name: idx_fundraising_items_status_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fundraising_items_status_sort ON public.fundraising_items USING btree (status, sort_order);


--
-- Name: idx_job_assignments_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_assignments_employee ON public.job_assignments USING btree (employee_id);


--
-- Name: idx_job_assignments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_assignments_order ON public.job_assignments USING btree (order_id);


--
-- Name: idx_job_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_assignments_status ON public.job_assignments USING btree (status);


--
-- Name: idx_job_completions_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_completions_assignment ON public.job_completions USING btree (assignment_id);


--
-- Name: idx_job_photos_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_photos_job ON public.job_photos USING btree (job_id);


--
-- Name: idx_job_photos_qa_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_photos_qa_pending ON public.job_photos USING btree (uploaded_at) WHERE (qa_score IS NULL);


--
-- Name: idx_job_variations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_variations_order ON public.job_variations USING btree (order_id);


--
-- Name: idx_journal_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_date ON public.founder_journal_entries USING btree (entry_date DESC);


--
-- Name: idx_journal_entries_date_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_journal_entries_date_unique ON public.founder_journal_entries USING btree (entry_date);


--
-- Name: idx_journal_entries_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_rating ON public.founder_journal_entries USING btree (content_potential_rating);


--
-- Name: idx_journal_entries_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_tags ON public.founder_journal_entries USING gin (tags);


--
-- Name: idx_jp_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jp_employee ON public.job_publications USING btree (employee_id);


--
-- Name: idx_jp_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jp_order ON public.job_publications USING btree (order_id);


--
-- Name: idx_jp_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jp_status ON public.job_publications USING btree (status);


--
-- Name: idx_jpm_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jpm_employee ON public.job_participant_matches USING btree (employee_id);


--
-- Name: idx_jpm_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jpm_order ON public.job_participant_matches USING btree (order_id);


--
-- Name: idx_jr_matching; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jr_matching ON public.job_requirements USING btree (ndis_matching_enabled) WHERE (ndis_matching_enabled = true);


--
-- Name: idx_jr_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jr_order ON public.job_requirements USING btree (order_id);


--
-- Name: idx_lead_conversations_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_conversations_channel ON public.lead_conversations USING btree (channel, created_at DESC);


--
-- Name: idx_lead_conversations_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_conversations_environment ON public.lead_conversations USING btree (environment);


--
-- Name: idx_lead_conversations_lead_direction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_conversations_lead_direction ON public.lead_conversations USING btree (lead_id, direction);


--
-- Name: idx_lead_conversations_lead_id_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_conversations_lead_id_created ON public.lead_conversations USING btree (lead_id, created_at DESC);


--
-- Name: idx_lead_follow_ups_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_follow_ups_due ON public.lead_follow_ups USING btree (status, due_at);


--
-- Name: idx_lead_follow_ups_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_follow_ups_lead ON public.lead_follow_ups USING btree (lead_id, status);


--
-- Name: idx_lead_response_metrics_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_response_metrics_day ON public.lead_response_metrics USING btree (metric_day DESC);


--
-- Name: idx_lead_suburb_analytics_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_suburb_analytics_day ON public.lead_suburb_analytics USING btree (metric_day DESC);


--
-- Name: idx_lead_suburb_analytics_suburb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_suburb_analytics_suburb ON public.lead_suburb_analytics USING btree (suburb, metric_day DESC);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_environment ON public.leads USING btree (environment);


--
-- Name: idx_leads_is_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_is_test ON public.leads USING btree (is_test) WHERE (is_test = true);


--
-- Name: idx_leads_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_open ON public.leads USING btree (created_at DESC) WHERE (response_status <> ALL (ARRAY['lost'::text, 'completed'::text]));


--
-- Name: idx_leads_response_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_response_status ON public.leads USING btree (response_status);


--
-- Name: idx_leads_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_source ON public.leads USING btree (source);


--
-- Name: idx_leads_source_external_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_leads_source_external_ref ON public.leads USING btree (source, external_ref) WHERE (external_ref IS NOT NULL);


--
-- Name: idx_leads_suburb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_suburb ON public.leads USING btree (suburb);


--
-- Name: idx_leads_temperature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_temperature ON public.leads USING btree (temperature);


--
-- Name: idx_marketing_campaign_queue_items_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaign_queue_items_queue ON public.marketing_campaign_queue_items USING btree (queue_item_id);


--
-- Name: idx_marketing_campaigns_arc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_arc ON public.marketing_campaigns USING btree (related_arc_id);


--
-- Name: idx_marketing_campaigns_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_dates ON public.marketing_campaigns USING btree (start_date, end_date);


--
-- Name: idx_marketing_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_campaigns_status ON public.marketing_campaigns USING btree (status);


--
-- Name: idx_marketing_distribution_playbooks_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_distribution_playbooks_campaign ON public.marketing_distribution_playbooks USING btree (linked_campaign_id);


--
-- Name: idx_marketing_distribution_playbooks_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_distribution_playbooks_platform ON public.marketing_distribution_playbooks USING btree (primary_platform);


--
-- Name: idx_marketing_distribution_playbooks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_distribution_playbooks_status ON public.marketing_distribution_playbooks USING btree (status);


--
-- Name: idx_marketing_metrics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_metrics_date ON public.marketing_metrics USING btree (snapshot_date DESC);


--
-- Name: idx_marketing_publishing_queue_arc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_publishing_queue_arc ON public.marketing_publishing_queue USING btree (related_arc_id);


--
-- Name: idx_marketing_publishing_queue_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_publishing_queue_platform ON public.marketing_publishing_queue USING btree (platform);


--
-- Name: idx_marketing_publishing_queue_production; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_publishing_queue_production ON public.marketing_publishing_queue USING btree (production_card_id);


--
-- Name: idx_marketing_publishing_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_publishing_queue_status ON public.marketing_publishing_queue USING btree (status);


--
-- Name: idx_marketing_publishing_queue_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_publishing_queue_target ON public.marketing_publishing_queue USING btree (target_publish_at);


--
-- Name: idx_marketing_social_channels_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_social_channels_platform ON public.marketing_social_channels USING btree (platform);


--
-- Name: idx_marketing_social_channels_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_social_channels_status ON public.marketing_social_channels USING btree (status);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_messages_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_environment ON public.messages USING btree (environment);


--
-- Name: idx_ndis_orgs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndis_orgs_status ON public.ndis_organisations USING btree (subscription_status);


--
-- Name: idx_ndis_orgs_stripe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndis_orgs_stripe ON public.ndis_organisations USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);


--
-- Name: idx_ndis_parts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndis_parts_email ON public.ndis_participants USING btree (email);


--
-- Name: idx_ndis_parts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndis_parts_org ON public.ndis_participants USING btree (organisation_id);


--
-- Name: idx_ndis_parts_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndis_parts_token ON public.ndis_participants USING btree (invite_token) WHERE (invite_token IS NOT NULL);


--
-- Name: idx_ndis_parts_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ndis_parts_user ON public.ndis_participants USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_order_fees_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_fees_order ON public.order_fees USING btree (order_id);


--
-- Name: idx_orders_assigned_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_assigned_employee ON public.orders USING btree (assigned_employee_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_environment ON public.orders USING btree (environment);


--
-- Name: idx_orders_is_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_is_test ON public.orders USING btree (is_test) WHERE (is_test = true);


--
-- Name: idx_orders_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_scheduled_date ON public.orders USING btree (scheduled_date);


--
-- Name: idx_orders_service_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_service_type ON public.orders USING btree (service_type);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_stripe_pi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_stripe_pi ON public.orders USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: idx_orders_stripe_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_stripe_session ON public.orders USING btree (stripe_checkout_session_id) WHERE (stripe_checkout_session_id IS NOT NULL);


--
-- Name: idx_page_views_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_page ON public.page_views USING btree (page);


--
-- Name: idx_page_views_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_session_id ON public.page_views USING btree (session_id);


--
-- Name: idx_page_views_viewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_page_views_viewed_at ON public.page_views USING btree (viewed_at DESC);


--
-- Name: idx_payables_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payables_active ON public.payables USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: idx_payables_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payables_due_date ON public.payables USING btree (due_date);


--
-- Name: idx_payables_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payables_order_id ON public.payables USING btree (order_id);


--
-- Name: idx_payables_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payables_status ON public.payables USING btree (status);


--
-- Name: idx_payables_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payables_subscription_id ON public.payables USING btree (subscription_id);


--
-- Name: idx_payables_vendor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payables_vendor_id ON public.payables USING btree (vendor_id);


--
-- Name: idx_payouts_arrival_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_arrival_date ON public.payouts USING btree (arrival_date);


--
-- Name: idx_payouts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_created_at ON public.payouts USING btree (created_at DESC);


--
-- Name: idx_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payouts_status ON public.payouts USING btree (status);


--
-- Name: idx_phone_calls_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_calls_unprocessed ON public.phone_calls USING btree (created_at) WHERE (agent_processed_at IS NULL);


--
-- Name: idx_pr_review_predictions_check_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_review_predictions_check_status ON public.pr_review_predictions USING btree (check_status);


--
-- Name: idx_pr_review_predictions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_review_predictions_created_at ON public.pr_review_predictions USING btree (created_at DESC);


--
-- Name: idx_pr_review_predictions_pr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_review_predictions_pr_number ON public.pr_review_predictions USING btree (pr_number);


--
-- Name: idx_pricing_recs_service_suburb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_recs_service_suburb ON public.pricing_recommendations USING btree (service, suburb, created_at DESC);


--
-- Name: idx_pricing_recs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_recs_status ON public.pricing_recommendations USING btree (status) WHERE (status = ANY (ARRAY['pending'::text, 'approved'::text]));


--
-- Name: idx_profiles_organisation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_organisation_id ON public.profiles USING btree (organisation_id) WHERE (organisation_id IS NOT NULL);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_psp_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psp_employee ON public.participant_support_profiles USING btree (employee_id);


--
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at DESC);


--
-- Name: idx_quotes_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_environment ON public.quotes USING btree (environment);


--
-- Name: idx_quotes_is_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_is_test ON public.quotes USING btree (is_test) WHERE (is_test = true);


--
-- Name: idx_quotes_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotes_source ON public.quotes USING btree (source);


--
-- Name: idx_ratings_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_environment ON public.ratings USING btree (environment);


--
-- Name: idx_ratings_is_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ratings_is_test ON public.ratings USING btree (is_test) WHERE (is_test = true);


--
-- Name: idx_research_trends_adaptation_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_trends_adaptation_score ON public.research_trends USING btree (adaptation_score DESC NULLS LAST);


--
-- Name: idx_research_trends_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_trends_created_at ON public.research_trends USING btree (created_at DESC);


--
-- Name: idx_research_trends_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_trends_platform ON public.research_trends USING btree (platform);


--
-- Name: idx_research_trends_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_trends_status ON public.research_trends USING btree (status);


--
-- Name: idx_research_trends_trend_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_trends_trend_type ON public.research_trends USING btree (trend_type);


--
-- Name: idx_research_trends_urgency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_trends_urgency ON public.research_trends USING btree (urgency);


--
-- Name: idx_sandbox_agent_health_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_agent_health_agent ON public.sandbox_agent_health USING btree (agent_id, computed_at DESC);


--
-- Name: idx_sandbox_agent_responses_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_agent_responses_agent ON public.sandbox_agent_responses USING btree (agent_id);


--
-- Name: idx_sandbox_agent_responses_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_agent_responses_env ON public.sandbox_agent_responses USING btree (environment);


--
-- Name: idx_sandbox_agent_responses_scenario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_agent_responses_scenario ON public.sandbox_agent_responses USING btree (scenario_id);


--
-- Name: idx_sandbox_decision_scores_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_decision_scores_agent ON public.sandbox_decision_scores USING btree (agent_id);


--
-- Name: idx_sandbox_decision_scores_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_decision_scores_env ON public.sandbox_decision_scores USING btree (environment);


--
-- Name: idx_sandbox_decision_scores_scenario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_decision_scores_scenario ON public.sandbox_decision_scores USING btree (scenario_id);


--
-- Name: idx_sandbox_lessons_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_lessons_agent ON public.sandbox_lessons_learned USING btree (agent_id);


--
-- Name: idx_sandbox_lessons_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_lessons_env ON public.sandbox_lessons_learned USING btree (environment);


--
-- Name: idx_sandbox_lessons_env_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_lessons_env_agent ON public.sandbox_lessons_learned USING btree (environment, agent_id);


--
-- Name: idx_sandbox_run_batches_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_run_batches_agent ON public.sandbox_run_batches USING btree (agent_id, started_at DESC);


--
-- Name: idx_sandbox_scenarios_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_scenarios_agent_id ON public.sandbox_scenarios USING btree (agent_id);


--
-- Name: idx_sandbox_scenarios_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_scenarios_category ON public.sandbox_scenarios USING btree (category);


--
-- Name: idx_sandbox_scenarios_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_scenarios_environment ON public.sandbox_scenarios USING btree (environment);


--
-- Name: idx_sandbox_training_runs_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_training_runs_batch ON public.sandbox_training_runs USING btree (batch_id);


--
-- Name: idx_sandbox_training_runs_env; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_training_runs_env ON public.sandbox_training_runs USING btree (environment);


--
-- Name: idx_sandbox_training_runs_scenario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_training_runs_scenario ON public.sandbox_training_runs USING btree (scenario_id);


--
-- Name: idx_sandbox_training_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sandbox_training_runs_status ON public.sandbox_training_runs USING btree (status);


--
-- Name: idx_service_pricing_service_suburb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_pricing_service_suburb ON public.service_pricing USING btree (service, suburb);


--
-- Name: idx_site_feedback_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_feedback_created_at ON public.site_feedback USING btree (created_at DESC);


--
-- Name: idx_site_feedback_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_feedback_status ON public.site_feedback USING btree (status);


--
-- Name: idx_site_impact_stats_singleton; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_site_impact_stats_singleton ON public.site_impact_stats USING btree ((true));


--
-- Name: idx_site_visitors_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_visitors_last_seen ON public.site_visitors USING btree (last_seen_at DESC);


--
-- Name: idx_social_proof_items_status_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_proof_items_status_sort ON public.social_proof_items USING btree (status, sort_order);


--
-- Name: idx_ss_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ss_order ON public.shift_segments USING btree (order_id);


--
-- Name: idx_story_arcs_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_arcs_priority ON public.story_arcs USING btree (priority);


--
-- Name: idx_story_arcs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_arcs_status ON public.story_arcs USING btree (status);


--
-- Name: idx_story_chapters_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_story_chapters_one_active ON public.story_chapters USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_story_drafts_opp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_drafts_opp ON public.story_drafts USING btree (opportunity_id);


--
-- Name: idx_story_drafts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_drafts_status ON public.story_drafts USING btree (status);


--
-- Name: idx_story_opps_arc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_opps_arc ON public.story_opportunities USING btree (related_arc_id);


--
-- Name: idx_story_opps_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_opps_score ON public.story_opportunities USING btree (story_score DESC NULLS LAST);


--
-- Name: idx_story_opps_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_opps_section ON public.story_opportunities USING btree (section);


--
-- Name: idx_story_opps_source_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_story_opps_source_hash ON public.story_opportunities USING btree (source_hash) WHERE (source_hash IS NOT NULL);


--
-- Name: idx_story_opps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_opps_status ON public.story_opportunities USING btree (status);


--
-- Name: idx_story_reviews_draft; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_reviews_draft ON public.story_reviews USING btree (draft_id);


--
-- Name: idx_story_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_reviews_status ON public.story_reviews USING btree (review_status);


--
-- Name: idx_story_threads_arc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_threads_arc ON public.story_open_threads USING btree (related_arc_id);


--
-- Name: idx_story_threads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_threads_status ON public.story_open_threads USING btree (status);


--
-- Name: idx_subscription_orders_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_orders_order_id ON public.subscription_orders USING btree (order_id);


--
-- Name: idx_subscription_orders_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_orders_subscription_id ON public.subscription_orders USING btree (subscription_id);


--
-- Name: idx_subscriptions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions USING btree (customer_id);


--
-- Name: idx_subscriptions_frequency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_frequency ON public.subscriptions USING btree (frequency);


--
-- Name: idx_subscriptions_next_service_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_next_service_date ON public.subscriptions USING btree (next_service_date);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_ta_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ta_employee ON public.transport_arrangements USING btree (employee_id);


--
-- Name: idx_ta_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ta_order ON public.transport_arrangements USING btree (order_id);


--
-- Name: idx_visitor_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_created_at ON public.visitor_events USING btree (created_at DESC);


--
-- Name: idx_visitor_events_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_environment ON public.visitor_events USING btree (environment);


--
-- Name: idx_visitor_events_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_name ON public.visitor_events USING btree (event_name);


--
-- Name: idx_visitor_events_name_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_name_created_at ON public.visitor_events USING btree (event_name, created_at DESC);


--
-- Name: idx_visitor_events_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_order_id ON public.visitor_events USING btree (order_id);


--
-- Name: idx_visitor_events_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_payment_id ON public.visitor_events USING btree (payment_id);


--
-- Name: idx_visitor_events_quote_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_quote_id ON public.visitor_events USING btree (quote_id);


--
-- Name: idx_visitor_events_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_session_id ON public.visitor_events USING btree (session_id);


--
-- Name: idx_visitor_events_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_events_source ON public.visitor_events USING btree (source);


--
-- Name: idx_whs_records_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whs_records_expiry ON public.whs_records USING btree (expires_at);


--
-- Name: idx_worker_payouts_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_payouts_employee ON public.worker_payouts USING btree (employee_id) WHERE (employee_id IS NOT NULL);


--
-- Name: idx_worker_payouts_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_payouts_order ON public.worker_payouts USING btree (order_id);


--
-- Name: idx_worker_payouts_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_payouts_participant ON public.worker_payouts USING btree (participant_id) WHERE (participant_id IS NOT NULL);


--
-- Name: idx_worker_payouts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worker_payouts_status ON public.worker_payouts USING btree (status);


--
-- Name: lead_conversations_external_sender_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_conversations_external_sender_id_idx ON public.lead_conversations USING btree (external_sender_id) WHERE (external_sender_id IS NOT NULL);


--
-- Name: leads_instagram_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_instagram_user_id_idx ON public.leads USING btree (instagram_user_id) WHERE (instagram_user_id IS NOT NULL);


--
-- Name: leads_messenger_psid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_messenger_psid_idx ON public.leads USING btree (messenger_psid) WHERE (messenger_psid IS NOT NULL);


--
-- Name: leads_reply_channel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_reply_channel_idx ON public.leads USING btree (reply_channel) WHERE (reply_channel IS NOT NULL);


--
-- Name: marketing_publishing_queue_card_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX marketing_publishing_queue_card_unique ON public.marketing_publishing_queue USING btree (production_card_id) WHERE (production_card_id IS NOT NULL);


--
-- Name: memory_documents_agent_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_agent_scope_idx ON public.memory_documents USING btree (agent_scope);


--
-- Name: memory_documents_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_category_idx ON public.memory_documents USING btree (category);


--
-- Name: memory_documents_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_embedding_idx ON public.memory_documents USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='50');


--
-- Name: memory_documents_freshness_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_freshness_idx ON public.memory_documents USING btree (freshness_score DESC);


--
-- Name: memory_documents_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_status_idx ON public.memory_documents USING btree (status);


--
-- Name: memory_documents_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_tags_idx ON public.memory_documents USING gin (tags);


--
-- Name: memory_documents_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_documents_updated_at_idx ON public.memory_documents USING btree (updated_at DESC);


--
-- Name: memory_edges_any_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_edges_any_node_idx ON public.memory_edges USING btree (source_id, target_id);


--
-- Name: memory_edges_relationship_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_edges_relationship_idx ON public.memory_edges USING btree (relationship);


--
-- Name: memory_edges_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_edges_source_idx ON public.memory_edges USING btree (source_id);


--
-- Name: memory_edges_strength_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_edges_strength_idx ON public.memory_edges USING btree (strength DESC);


--
-- Name: memory_edges_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_edges_target_idx ON public.memory_edges USING btree (target_id);


--
-- Name: memory_graph_extractions_keywords_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_graph_extractions_keywords_idx ON public.memory_graph_extractions USING gin (keywords);


--
-- Name: memory_graph_extractions_systems_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_graph_extractions_systems_idx ON public.memory_graph_extractions USING gin (systems_mentioned);


--
-- Name: memory_read_log_agent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_read_log_agent_idx ON public.memory_read_log USING btree (agent_id, read_at DESC);


--
-- Name: memory_read_log_document_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX memory_read_log_document_idx ON public.memory_read_log USING btree (document_id, read_at DESC);


--
-- Name: orders_analytics_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_analytics_session_id_idx ON public.orders USING btree (analytics_session_id);


--
-- Name: orders_assigned_crew_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_assigned_crew_id_idx ON public.orders USING btree (assigned_crew_id);


--
-- Name: orders_scheduled_date_crew_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_scheduled_date_crew_idx ON public.orders USING btree (scheduled_date, assigned_crew_id);


--
-- Name: orders_status_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_status_updated_at_idx ON public.orders USING btree (status, status_updated_at) WHERE (status = 'in_progress'::text);


--
-- Name: pipeline_agent_scores_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_agent_scores_run_idx ON public.pipeline_agent_scores USING btree (run_id);


--
-- Name: pipeline_artifacts_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_artifacts_run_idx ON public.pipeline_artifacts USING btree (run_id, created_at);


--
-- Name: pipeline_runs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_runs_status_idx ON public.pipeline_runs USING btree (status);


--
-- Name: pipeline_runs_surface_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_runs_surface_started_at_idx ON public.pipeline_runs USING btree (surface, started_at DESC);


--
-- Name: pipeline_stage_events_run_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pipeline_stage_events_run_ts_idx ON public.pipeline_stage_events USING btree (run_id, ts);


--
-- Name: quote_funnel_events_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quote_funnel_events_created_idx ON public.quote_funnel_events USING btree (created_at DESC);


--
-- Name: quote_funnel_events_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quote_funnel_events_event_idx ON public.quote_funnel_events USING btree (event_name);


--
-- Name: quote_funnel_events_service_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quote_funnel_events_service_idx ON public.quote_funnel_events USING btree (service);


--
-- Name: quote_funnel_events_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quote_funnel_events_session_idx ON public.quote_funnel_events USING btree (session_id);


--
-- Name: quotes_analytics_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_analytics_session_id_idx ON public.quotes USING btree (analytics_session_id);


--
-- Name: quotes_cancelled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_cancelled_at_idx ON public.quotes USING btree (cancelled_at DESC);


--
-- Name: quotes_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_created_at_idx ON public.quotes USING btree (created_at DESC);


--
-- Name: quotes_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_customer_id_idx ON public.quotes USING btree (customer_id);


--
-- Name: quotes_ndis_forwarded_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_ndis_forwarded_at_idx ON public.quotes USING btree (ndis_forwarded_at DESC) WHERE (ndis_forwarded_at IS NOT NULL);


--
-- Name: quotes_ndis_management_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_ndis_management_type_idx ON public.quotes USING btree (ndis_management_type) WHERE (ndis_management_type IS NOT NULL);


--
-- Name: quotes_payment_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_payment_status_idx ON public.quotes USING btree (payment_status);


--
-- Name: quotes_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_status_idx ON public.quotes USING btree (status);


--
-- Name: quotes_status_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quotes_status_payment_idx ON public.quotes USING btree (status, payment_status);


--
-- Name: ratings_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ratings_order_id_idx ON public.ratings USING btree (order_id);


--
-- Name: rego_cache_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rego_cache_expires_idx ON public.rego_cache USING btree (expires_at);


--
-- Name: resilience_events_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resilience_events_created_at_idx ON public.resilience_events USING btree (created_at DESC);


--
-- Name: resilience_events_guard_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX resilience_events_guard_idx ON public.resilience_events USING btree (guard, created_at DESC);


--
-- Name: vehicle_overrides_make_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehicle_overrides_make_idx ON public.vehicle_overrides USING btree (make);


--
-- Name: vehicle_overrides_make_model_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vehicle_overrides_make_model_unique ON public.vehicle_overrides USING btree (make, model_pattern);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_18_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_18_inserted_at_topic_idx ON realtime.messages_2026_07_18 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_19_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_19_inserted_at_topic_idx ON realtime.messages_2026_07_19 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_20_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_20_inserted_at_topic_idx ON realtime.messages_2026_07_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_21_inserted_at_topic_idx ON realtime.messages_2026_07_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_22_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_22_inserted_at_topic_idx ON realtime.messages_2026_07_22 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_23_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_23_inserted_at_topic_idx ON realtime.messages_2026_07_23 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_07_24_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_07_24_inserted_at_topic_idx ON realtime.messages_2026_07_24 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_selec; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2026_07_18_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_18_inserted_at_topic_idx;


--
-- Name: messages_2026_07_18_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_18_pkey;


--
-- Name: messages_2026_07_19_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_19_inserted_at_topic_idx;


--
-- Name: messages_2026_07_19_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_19_pkey;


--
-- Name: messages_2026_07_20_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_20_inserted_at_topic_idx;


--
-- Name: messages_2026_07_20_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_20_pkey;


--
-- Name: messages_2026_07_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_21_inserted_at_topic_idx;


--
-- Name: messages_2026_07_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_21_pkey;


--
-- Name: messages_2026_07_22_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_22_inserted_at_topic_idx;


--
-- Name: messages_2026_07_22_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_22_pkey;


--
-- Name: messages_2026_07_23_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_23_inserted_at_topic_idx;


--
-- Name: messages_2026_07_23_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_23_pkey;


--
-- Name: messages_2026_07_24_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_07_24_inserted_at_topic_idx;


--
-- Name: messages_2026_07_24_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_07_24_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


--
-- Name: admin_optimization_findings admin_opt_findings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_opt_findings_updated_at BEFORE UPDATE ON public.admin_optimization_findings FOR EACH ROW EXECUTE FUNCTION public.admin_opt_set_updated_at();


--
-- Name: memory_documents memory_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER memory_documents_updated_at BEFORE UPDATE ON public.memory_documents FOR EACH ROW EXECUTE FUNCTION public.touch_memory_document();


--
-- Name: artifacts set_artifacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_artifacts_updated_at BEFORE UPDATE ON public.artifacts FOR EACH ROW EXECUTE FUNCTION public.handle_artifacts_updated_at();


--
-- Name: campaign_factory_runs set_campaign_factory_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_campaign_factory_runs_updated_at BEFORE UPDATE ON public.campaign_factory_runs FOR EACH ROW EXECUTE FUNCTION public.handle_campaign_factory_runs_updated_at();


--
-- Name: content_assets set_content_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_content_assets_updated_at BEFORE UPDATE ON public.content_assets FOR EACH ROW EXECUTE FUNCTION public.handle_content_assets_updated_at();


--
-- Name: content_ideas set_content_ideas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_content_ideas_updated_at BEFORE UPDATE ON public.content_ideas FOR EACH ROW EXECUTE FUNCTION public.handle_content_ideas_updated_at();


--
-- Name: content_learning_records set_content_learning_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_content_learning_records_updated_at BEFORE UPDATE ON public.content_learning_records FOR EACH ROW EXECUTE FUNCTION public.handle_content_learning_records_updated_at();


--
-- Name: content_library_items set_content_library_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_content_library_items_updated_at BEFORE UPDATE ON public.content_library_items FOR EACH ROW EXECUTE FUNCTION public.handle_content_library_items_updated_at();


--
-- Name: content_production_cards set_content_production_cards_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_content_production_cards_updated_at BEFORE UPDATE ON public.content_production_cards FOR EACH ROW EXECUTE FUNCTION public.handle_content_production_cards_updated_at();


--
-- Name: content_scripts set_content_scripts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_content_scripts_updated_at BEFORE UPDATE ON public.content_scripts FOR EACH ROW EXECUTE FUNCTION public.handle_content_scripts_updated_at();


--
-- Name: founder_journal_entries set_founder_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_founder_journal_entries_updated_at BEFORE UPDATE ON public.founder_journal_entries FOR EACH ROW EXECUTE FUNCTION public.handle_journal_updated_at();


--
-- Name: marketing_campaigns set_marketing_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_marketing_campaigns_updated_at();


--
-- Name: marketing_distribution_playbooks set_marketing_distribution_playbooks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_marketing_distribution_playbooks_updated_at BEFORE UPDATE ON public.marketing_distribution_playbooks FOR EACH ROW EXECUTE FUNCTION public.handle_marketing_distribution_playbooks_updated_at();


--
-- Name: marketing_publishing_queue set_marketing_publishing_queue_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_marketing_publishing_queue_updated_at BEFORE UPDATE ON public.marketing_publishing_queue FOR EACH ROW EXECUTE FUNCTION public.handle_marketing_publishing_queue_updated_at();


--
-- Name: marketing_social_channels set_marketing_social_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_marketing_social_channels_updated_at BEFORE UPDATE ON public.marketing_social_channels FOR EACH ROW EXECUTE FUNCTION public.handle_marketing_social_channels_updated_at();


--
-- Name: research_trends set_research_trends_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_research_trends_updated_at BEFORE UPDATE ON public.research_trends FOR EACH ROW EXECUTE FUNCTION public.handle_research_trends_updated_at();


--
-- Name: story_arcs set_story_arcs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_arcs_updated_at BEFORE UPDATE ON public.story_arcs FOR EACH ROW EXECUTE FUNCTION public.handle_story_arcs_updated_at();


--
-- Name: story_bible_sections set_story_bible_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_bible_sections_updated_at BEFORE UPDATE ON public.story_bible_sections FOR EACH ROW EXECUTE FUNCTION public.handle_story_bible_updated_at();


--
-- Name: story_chapters set_story_chapters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_chapters_updated_at BEFORE UPDATE ON public.story_chapters FOR EACH ROW EXECUTE FUNCTION public.handle_story_chapters_updated_at();


--
-- Name: story_characters set_story_characters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_characters_updated_at BEFORE UPDATE ON public.story_characters FOR EACH ROW EXECUTE FUNCTION public.handle_story_characters_updated_at();


--
-- Name: story_drafts set_story_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_drafts_updated_at BEFORE UPDATE ON public.story_drafts FOR EACH ROW EXECUTE FUNCTION public.handle_story_drafts_updated_at();


--
-- Name: story_open_threads set_story_open_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_open_threads_updated_at BEFORE UPDATE ON public.story_open_threads FOR EACH ROW EXECUTE FUNCTION public.handle_story_threads_updated_at();


--
-- Name: story_opportunities set_story_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_opportunities_updated_at BEFORE UPDATE ON public.story_opportunities FOR EACH ROW EXECUTE FUNCTION public.handle_story_opps_updated_at();


--
-- Name: story_reviews set_story_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_story_reviews_updated_at BEFORE UPDATE ON public.story_reviews FOR EACH ROW EXECUTE FUNCTION public.handle_story_reviews_updated_at();


--
-- Name: agent_actions trg_action_quality; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_action_quality AFTER UPDATE OF status ON public.agent_actions FOR EACH ROW EXECUTE FUNCTION public.update_run_quality_score();


--
-- Name: agent_memory trg_agent_memory_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agent_memory_updated_at BEFORE UPDATE ON public.agent_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agent_runs trg_agent_runs_update_last_run; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agent_runs_update_last_run AFTER INSERT OR UPDATE OF status, finished_at ON public.agent_runs FOR EACH ROW EXECUTE FUNCTION public.trg_fn_agent_runs_update_last_run();


--
-- Name: agents trg_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: checklist_templates trg_checklist_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_checklist_templates_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: conversations trg_conversations_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_conversations_sync_environment BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: customer_properties trg_customer_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_properties_updated_at BEFORE UPDATE ON public.customer_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: customers trg_customers_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_sync_environment BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: employee_documents trg_employee_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_documents_updated_at BEFORE UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employee_onboarding trg_employee_onboarding_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_onboarding_updated_at BEFORE UPDATE ON public.employee_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employees trg_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: executive_decisions trg_exec_decisions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_exec_decisions_updated_at BEFORE UPDATE ON public.executive_decisions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: executive_directives trg_exec_directives_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_exec_directives_updated_at BEFORE UPDATE ON public.executive_directives FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: executive_kpi_targets trg_exec_kpi_targets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_exec_kpi_targets_updated_at BEFORE UPDATE ON public.executive_kpi_targets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: executive_tasks trg_exec_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_exec_tasks_updated_at BEFORE UPDATE ON public.executive_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: fundraising_items trg_fundraising_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fundraising_items_updated_at BEFORE UPDATE ON public.fundraising_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bud_improvement_executions trg_improvement_executions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_improvement_executions_updated_at BEFORE UPDATE ON public.bud_improvement_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bud_improvement_signals trg_improvement_signals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_improvement_signals_updated_at BEFORE UPDATE ON public.bud_improvement_signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: job_assignments trg_job_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_job_assignments_updated_at BEFORE UPDATE ON public.job_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: job_requirements trg_jr_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_jr_updated_at BEFORE UPDATE ON public.job_requirements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ndis();


--
-- Name: lead_conversations trg_lead_conversation_inherit_test; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lead_conversation_inherit_test BEFORE INSERT ON public.lead_conversations FOR EACH ROW EXECUTE FUNCTION public.propagate_lead_conversation_test_flag();


--
-- Name: lead_conversations trg_lead_conversations_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lead_conversations_sync_environment BEFORE INSERT OR UPDATE ON public.lead_conversations FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: lead_follow_ups trg_lead_follow_ups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lead_follow_ups_updated_at BEFORE UPDATE ON public.lead_follow_ups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: leads trg_leads_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leads_sync_environment BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: leads trg_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lobby_themes trg_lobby_themes_single_active; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lobby_themes_single_active BEFORE INSERT OR UPDATE ON public.lobby_themes FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_theme();


--
-- Name: messages trg_message_inherit_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_message_inherit_environment BEFORE INSERT OR UPDATE OF conversation_id ON public.messages FOR EACH ROW EXECUTE FUNCTION public.propagate_message_environment();


--
-- Name: messages trg_message_inherit_test; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_message_inherit_test BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.propagate_message_test_flag();


--
-- Name: messages trg_messages_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_messages_sync_environment BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: messages trg_messages_touch_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_messages_touch_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_updated_at();


--
-- Name: ndis_organisations trg_ndis_org_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ndis_org_updated_at BEFORE UPDATE ON public.ndis_organisations FOR EACH ROW EXECUTE FUNCTION public.set_ndis_org_updated_at();


--
-- Name: orders trg_order_inherit_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_inherit_environment BEFORE INSERT OR UPDATE OF quote_id ON public.orders FOR EACH ROW EXECUTE FUNCTION public.propagate_order_environment();


--
-- Name: orders trg_order_inherit_test; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_order_inherit_test BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.propagate_order_test_flag();


--
-- Name: orders trg_orders_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_status_updated_at BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trg_fn_orders_status_updated_at();


--
-- Name: orders trg_orders_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_sync_environment BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: participant_support_profiles trg_psp_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_psp_updated_at BEFORE UPDATE ON public.participant_support_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ndis();


--
-- Name: quotes trg_quotes_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_quotes_sync_environment BEFORE INSERT OR UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: ratings trg_ratings_sync_environment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ratings_sync_environment BEFORE INSERT OR UPDATE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.sync_environment_from_is_test();


--
-- Name: bud_root_cause_initiatives trg_root_cause_initiatives_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_root_cause_initiatives_updated_at BEFORE UPDATE ON public.bud_root_cause_initiatives FOR EACH ROW EXECUTE FUNCTION public.update_root_cause_initiative_updated_at();


--
-- Name: site_impact_stats trg_site_impact_stats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_site_impact_stats_updated_at BEFORE UPDATE ON public.site_impact_stats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: social_proof_items trg_social_proof_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_social_proof_items_updated_at BEFORE UPDATE ON public.social_proof_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payables update_payables_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payables_updated_at BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: site_settings update_site_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_ux_proposals admin_ux_proposals_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_ux_proposals
    ADD CONSTRAINT admin_ux_proposals_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: agent_actions agent_actions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_actions agent_actions_initiative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.bud_root_cause_initiatives(id) ON DELETE SET NULL;


--
-- Name: agent_actions agent_actions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agent_actions agent_actions_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE CASCADE;


--
-- Name: agent_actions agent_actions_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_actions
    ADD CONSTRAINT agent_actions_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.agent_actions(id) ON DELETE SET NULL;


--
-- Name: agent_alerts agent_alerts_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_alerts
    ADD CONSTRAINT agent_alerts_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.agent_actions(id) ON DELETE SET NULL;


--
-- Name: agent_config_versions agent_config_versions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_config_versions
    ADD CONSTRAINT agent_config_versions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_evolutions agent_evolutions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_evolutions
    ADD CONSTRAINT agent_evolutions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agent_evolutions agent_evolutions_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_evolutions
    ADD CONSTRAINT agent_evolutions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: agent_evolutions agent_evolutions_target_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_evolutions
    ADD CONSTRAINT agent_evolutions_target_agent_id_fkey FOREIGN KEY (target_agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_guardrail_events agent_guardrail_events_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_guardrail_events
    ADD CONSTRAINT agent_guardrail_events_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_guardrail_events agent_guardrail_events_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_guardrail_events
    ADD CONSTRAINT agent_guardrail_events_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE CASCADE;


--
-- Name: agent_memory agent_memory_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_memory
    ADD CONSTRAINT agent_memory_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_runs agent_runs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: agent_runs agent_runs_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_runs
    ADD CONSTRAINT agent_runs_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agent_workflow_memberships agent_workflow_memberships_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_workflow_memberships
    ADD CONSTRAINT agent_workflow_memberships_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: analytics_findings analytics_findings_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_findings
    ADD CONSTRAINT analytics_findings_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.analytics_reports(id) ON DELETE CASCADE;


--
-- Name: analytics_funnels analytics_funnels_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_funnels
    ADD CONSTRAINT analytics_funnels_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.analytics_reports(id) ON DELETE CASCADE;


--
-- Name: applicants applicants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: artifact_versions artifact_versions_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;


--
-- Name: artifact_versions artifact_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifact_versions
    ADD CONSTRAINT artifact_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: artifacts artifacts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: artifacts artifacts_approved_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_approved_version_fk FOREIGN KEY (approved_version_id) REFERENCES public.artifact_versions(id) ON DELETE SET NULL;


--
-- Name: artifacts artifacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: artifacts artifacts_latest_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artifacts
    ADD CONSTRAINT artifacts_latest_version_fk FOREIGN KEY (latest_version_id) REFERENCES public.artifact_versions(id) ON DELETE SET NULL;


--
-- Name: bud_approval_queue bud_approval_queue_initiative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_approval_queue
    ADD CONSTRAINT bud_approval_queue_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.bud_root_cause_initiatives(id) ON DELETE SET NULL;


--
-- Name: bud_approval_queue bud_approval_queue_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_approval_queue
    ADD CONSTRAINT bud_approval_queue_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: bud_approval_queue bud_approval_queue_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_approval_queue
    ADD CONSTRAINT bud_approval_queue_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.bud_approval_queue(id) ON DELETE SET NULL;


--
-- Name: bud_approval_queue bud_approval_queue_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_approval_queue
    ADD CONSTRAINT bud_approval_queue_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.bud_tasks(id) ON DELETE CASCADE;


--
-- Name: bud_audit_logs bud_audit_logs_actor_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_audit_logs
    ADD CONSTRAINT bud_audit_logs_actor_user_fkey FOREIGN KEY (actor_user) REFERENCES auth.users(id);


--
-- Name: bud_browser_test_runs bud_browser_test_runs_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_browser_test_runs
    ADD CONSTRAINT bud_browser_test_runs_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL;


--
-- Name: bud_browser_test_runs bud_browser_test_runs_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_browser_test_runs
    ADD CONSTRAINT bud_browser_test_runs_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.bud_repair_steps(id) ON DELETE SET NULL;


--
-- Name: bud_change_requests bud_change_requests_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_change_requests
    ADD CONSTRAINT bud_change_requests_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.bud_tasks(id) ON DELETE CASCADE;


--
-- Name: bud_deployment_verifications bud_deployment_verifications_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_deployment_verifications
    ADD CONSTRAINT bud_deployment_verifications_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL;


--
-- Name: bud_evidence bud_evidence_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_evidence
    ADD CONSTRAINT bud_evidence_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.bud_tasks(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_executions bud_improvement_executions_initiative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_executions
    ADD CONSTRAINT bud_improvement_executions_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.bud_root_cause_initiatives(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_executions bud_improvement_executions_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_executions
    ADD CONSTRAINT bud_improvement_executions_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.bud_improvement_signals(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_learnings bud_improvement_learnings_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_learnings
    ADD CONSTRAINT bud_improvement_learnings_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_improvement_executions(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_learnings bud_improvement_learnings_signal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_learnings
    ADD CONSTRAINT bud_improvement_learnings_signal_id_fkey FOREIGN KEY (signal_id) REFERENCES public.bud_improvement_signals(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_logs bud_improvement_logs_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_logs
    ADD CONSTRAINT bud_improvement_logs_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_improvement_executions(id) ON DELETE CASCADE;


--
-- Name: bud_improvement_logs bud_improvement_logs_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_logs
    ADD CONSTRAINT bud_improvement_logs_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.bud_improvement_steps(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_signals bud_improvement_signals_duplicate_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_signals
    ADD CONSTRAINT bud_improvement_signals_duplicate_of_fkey FOREIGN KEY (duplicate_of) REFERENCES public.bud_improvement_signals(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_signals bud_improvement_signals_initiative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_signals
    ADD CONSTRAINT bud_improvement_signals_initiative_id_fkey FOREIGN KEY (initiative_id) REFERENCES public.bud_root_cause_initiatives(id) ON DELETE SET NULL;


--
-- Name: bud_improvement_steps bud_improvement_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_improvement_steps
    ADD CONSTRAINT bud_improvement_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_improvement_executions(id) ON DELETE CASCADE;


--
-- Name: bud_repair_executions bud_repair_executions_browser_test_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_executions
    ADD CONSTRAINT bud_repair_executions_browser_test_run_id_fkey FOREIGN KEY (browser_test_run_id) REFERENCES public.bud_browser_test_runs(id);


--
-- Name: bud_repair_executions bud_repair_executions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_executions
    ADD CONSTRAINT bud_repair_executions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: bud_repair_executions bud_repair_executions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_executions
    ADD CONSTRAINT bud_repair_executions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.bud_tasks(id) ON DELETE CASCADE;


--
-- Name: bud_repair_learnings bud_repair_learnings_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_learnings
    ADD CONSTRAINT bud_repair_learnings_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL;


--
-- Name: bud_repair_learnings bud_repair_learnings_memory_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_learnings
    ADD CONSTRAINT bud_repair_learnings_memory_doc_id_fkey FOREIGN KEY (memory_doc_id) REFERENCES public.memory_documents(id) ON DELETE SET NULL;


--
-- Name: bud_repair_learnings bud_repair_learnings_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_learnings
    ADD CONSTRAINT bud_repair_learnings_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.bud_tasks(id) ON DELETE SET NULL;


--
-- Name: bud_repair_logs bud_repair_logs_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_logs
    ADD CONSTRAINT bud_repair_logs_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_repair_executions(id) ON DELETE CASCADE;


--
-- Name: bud_repair_logs bud_repair_logs_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_logs
    ADD CONSTRAINT bud_repair_logs_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.bud_repair_steps(id) ON DELETE SET NULL;


--
-- Name: bud_repair_steps bud_repair_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_repair_steps
    ADD CONSTRAINT bud_repair_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_repair_executions(id) ON DELETE CASCADE;


--
-- Name: bud_rollback_events bud_rollback_events_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_rollback_events
    ADD CONSTRAINT bud_rollback_events_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL;


--
-- Name: bud_telemetry_events bud_telemetry_events_improvement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_telemetry_events
    ADD CONSTRAINT bud_telemetry_events_improvement_id_fkey FOREIGN KEY (improvement_id) REFERENCES public.bud_improvement_executions(id) ON DELETE SET NULL;


--
-- Name: bud_telemetry_events bud_telemetry_events_repair_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_telemetry_events
    ADD CONSTRAINT bud_telemetry_events_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL;


--
-- Name: bud_terminal_sessions bud_terminal_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bud_terminal_sessions
    ADD CONSTRAINT bud_terminal_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: campaign_factory_run_artifacts campaign_factory_run_artifacts_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_run_artifacts
    ADD CONSTRAINT campaign_factory_run_artifacts_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE CASCADE;


--
-- Name: campaign_factory_run_artifacts campaign_factory_run_artifacts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_run_artifacts
    ADD CONSTRAINT campaign_factory_run_artifacts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.campaign_factory_runs(id) ON DELETE CASCADE;


--
-- Name: campaign_factory_runs campaign_factory_runs_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_runs
    ADD CONSTRAINT campaign_factory_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: campaign_factory_runs campaign_factory_runs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_runs
    ADD CONSTRAINT campaign_factory_runs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;


--
-- Name: campaign_factory_runs campaign_factory_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_runs
    ADD CONSTRAINT campaign_factory_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: campaign_factory_runs campaign_factory_runs_selected_story_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_factory_runs
    ADD CONSTRAINT campaign_factory_runs_selected_story_opportunity_id_fkey FOREIGN KEY (selected_story_opportunity_id) REFERENCES public.story_opportunities(id) ON DELETE SET NULL;


--
-- Name: capture_briefs capture_briefs_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capture_briefs
    ADD CONSTRAINT capture_briefs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: cash_flow_forecasts cash_flow_forecasts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flow_forecasts
    ADD CONSTRAINT cash_flow_forecasts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: client_agreements client_agreements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_agreements
    ADD CONSTRAINT client_agreements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: client_agreements client_agreements_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_agreements
    ADD CONSTRAINT client_agreements_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;


--
-- Name: content_assets content_assets_idea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.content_ideas(id) ON DELETE SET NULL;


--
-- Name: content_assets content_assets_production_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_production_card_id_fkey FOREIGN KEY (production_card_id) REFERENCES public.content_production_cards(id) ON DELETE SET NULL;


--
-- Name: content_assets content_assets_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.content_scripts(id) ON DELETE SET NULL;


--
-- Name: content_drafts content_drafts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: content_drafts content_drafts_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;


--
-- Name: content_drafts content_drafts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_drafts
    ADD CONSTRAINT content_drafts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: content_ideas content_ideas_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.story_opportunities(id) ON DELETE SET NULL;


--
-- Name: content_ideas content_ideas_related_arc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_related_arc_id_fkey FOREIGN KEY (related_arc_id) REFERENCES public.story_arcs(id) ON DELETE SET NULL;


--
-- Name: content_learning_records content_learning_records_campaign_factory_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_learning_records
    ADD CONSTRAINT content_learning_records_campaign_factory_run_id_fkey FOREIGN KEY (campaign_factory_run_id) REFERENCES public.campaign_factory_runs(id) ON DELETE SET NULL;


--
-- Name: content_learning_records content_learning_records_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_learning_records
    ADD CONSTRAINT content_learning_records_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;


--
-- Name: content_learning_records content_learning_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_learning_records
    ADD CONSTRAINT content_learning_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: content_learning_records content_learning_records_learning_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_learning_records
    ADD CONSTRAINT content_learning_records_learning_artifact_id_fkey FOREIGN KEY (learning_artifact_id) REFERENCES public.artifacts(id) ON DELETE SET NULL;


--
-- Name: content_learning_records content_learning_records_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_learning_records
    ADD CONSTRAINT content_learning_records_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: content_library_items content_library_items_artifact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library_items
    ADD CONSTRAINT content_library_items_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES public.artifacts(id) ON DELETE SET NULL;


--
-- Name: content_library_items content_library_items_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_library_items
    ADD CONSTRAINT content_library_items_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;


--
-- Name: content_production_cards content_production_cards_related_arc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_production_cards
    ADD CONSTRAINT content_production_cards_related_arc_id_fkey FOREIGN KEY (related_arc_id) REFERENCES public.story_arcs(id) ON DELETE SET NULL;


--
-- Name: content_production_cards content_production_cards_script_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_production_cards
    ADD CONSTRAINT content_production_cards_script_id_fkey FOREIGN KEY (script_id) REFERENCES public.content_scripts(id) ON DELETE CASCADE;


--
-- Name: content_scripts content_scripts_idea_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_scripts
    ADD CONSTRAINT content_scripts_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.content_ideas(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: crew_coach_notes crew_coach_notes_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_coach_notes
    ADD CONSTRAINT crew_coach_notes_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: customer_properties customer_properties_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_properties
    ADD CONSTRAINT customer_properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: design_insights design_insights_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_insights
    ADD CONSTRAINT design_insights_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;


--
-- Name: design_insights design_insights_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_insights
    ADD CONSTRAINT design_insights_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: design_insights design_insights_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_insights
    ADD CONSTRAINT design_insights_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: design_violations design_violations_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_violations
    ADD CONSTRAINT design_violations_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.design_audits(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_onboarding employee_onboarding_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding
    ADD CONSTRAINT employee_onboarding_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_payroll_details employee_payroll_details_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_payroll_details
    ADD CONSTRAINT employee_payroll_details_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employment_contracts employment_contracts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_contracts
    ADD CONSTRAINT employment_contracts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: executive_tasks executive_tasks_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executive_tasks
    ADD CONSTRAINT executive_tasks_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES public.executive_decisions(id) ON DELETE CASCADE;


--
-- Name: employees fk_employees_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: foreman_insights foreman_insights_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foreman_insights
    ADD CONSTRAINT foreman_insights_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;


--
-- Name: fundraising_contributions fundraising_contributions_fundraising_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fundraising_contributions
    ADD CONSTRAINT fundraising_contributions_fundraising_item_id_fkey FOREIGN KEY (fundraising_item_id) REFERENCES public.fundraising_items(id) ON DELETE CASCADE;


--
-- Name: growth_pipeline_events growth_pipeline_events_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.growth_pipeline_events
    ADD CONSTRAINT growth_pipeline_events_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.founder_journal_entries(id) ON DELETE SET NULL;


--
-- Name: job_assignments job_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: job_assignments job_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: job_completions job_completions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_completions
    ADD CONSTRAINT job_completions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.job_assignments(id) ON DELETE CASCADE;


--
-- Name: job_participant_matches job_participant_matches_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participant_matches
    ADD CONSTRAINT job_participant_matches_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: job_participant_matches job_participant_matches_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_participant_matches
    ADD CONSTRAINT job_participant_matches_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: job_photos job_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_photos
    ADD CONSTRAINT job_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: job_publications job_publications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_publications
    ADD CONSTRAINT job_publications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: job_publications job_publications_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_publications
    ADD CONSTRAINT job_publications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: job_publications job_publications_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_publications
    ADD CONSTRAINT job_publications_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: job_requirements job_requirements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_requirements
    ADD CONSTRAINT job_requirements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: job_variations job_variations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_variations
    ADD CONSTRAINT job_variations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: lapsed_outreach lapsed_outreach_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lapsed_outreach
    ADD CONSTRAINT lapsed_outreach_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: lead_conversations lead_conversations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_conversations
    ADD CONSTRAINT lead_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_follow_ups lead_follow_ups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;


--
-- Name: marketing_campaign_queue_items marketing_campaign_queue_items_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_queue_items
    ADD CONSTRAINT marketing_campaign_queue_items_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_queue_items marketing_campaign_queue_items_queue_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaign_queue_items
    ADD CONSTRAINT marketing_campaign_queue_items_queue_item_id_fkey FOREIGN KEY (queue_item_id) REFERENCES public.marketing_publishing_queue(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_related_arc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_related_arc_id_fkey FOREIGN KEY (related_arc_id) REFERENCES public.story_arcs(id) ON DELETE SET NULL;


--
-- Name: marketing_distribution_playbooks marketing_distribution_playbooks_linked_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_distribution_playbooks
    ADD CONSTRAINT marketing_distribution_playbooks_linked_campaign_id_fkey FOREIGN KEY (linked_campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;


--
-- Name: marketing_publishing_queue marketing_publishing_queue_production_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_publishing_queue
    ADD CONSTRAINT marketing_publishing_queue_production_card_id_fkey FOREIGN KEY (production_card_id) REFERENCES public.content_production_cards(id) ON DELETE CASCADE;


--
-- Name: marketing_publishing_queue marketing_publishing_queue_related_arc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_publishing_queue
    ADD CONSTRAINT marketing_publishing_queue_related_arc_id_fkey FOREIGN KEY (related_arc_id) REFERENCES public.story_arcs(id) ON DELETE SET NULL;


--
-- Name: memory_contradiction_log memory_contradiction_log_doc_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_contradiction_log
    ADD CONSTRAINT memory_contradiction_log_doc_a_id_fkey FOREIGN KEY (doc_a_id) REFERENCES public.memory_documents(id) ON DELETE CASCADE;


--
-- Name: memory_contradiction_log memory_contradiction_log_doc_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_contradiction_log
    ADD CONSTRAINT memory_contradiction_log_doc_b_id_fkey FOREIGN KEY (doc_b_id) REFERENCES public.memory_documents(id) ON DELETE CASCADE;


--
-- Name: memory_documents memory_documents_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_documents
    ADD CONSTRAINT memory_documents_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.memory_documents(id) ON DELETE SET NULL;


--
-- Name: memory_edges memory_edges_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_edges
    ADD CONSTRAINT memory_edges_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.memory_documents(id) ON DELETE CASCADE;


--
-- Name: memory_edges memory_edges_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_edges
    ADD CONSTRAINT memory_edges_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.memory_documents(id) ON DELETE CASCADE;


--
-- Name: memory_graph_extractions memory_graph_extractions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_graph_extractions
    ADD CONSTRAINT memory_graph_extractions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.memory_documents(id) ON DELETE CASCADE;


--
-- Name: memory_read_log memory_read_log_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_read_log
    ADD CONSTRAINT memory_read_log_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.memory_documents(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ndis_participants ndis_participants_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_participants
    ADD CONSTRAINT ndis_participants_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.ndis_organisations(id) ON DELETE CASCADE;


--
-- Name: ndis_participants ndis_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_participants
    ADD CONSTRAINT ndis_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ndis_plan_matches ndis_plan_matches_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ndis_plan_matches
    ADD CONSTRAINT ndis_plan_matches_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE SET NULL;


--
-- Name: order_fees order_fees_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_fees
    ADD CONSTRAINT order_fees_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_assigned_crew_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_crew_id_fkey FOREIGN KEY (assigned_crew_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: orders orders_assigned_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_assigned_employee_id_fkey FOREIGN KEY (assigned_employee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: page_views page_views_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.analytics_sessions(session_id) ON DELETE CASCADE;


--
-- Name: participant_support_profiles participant_support_profiles_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participant_support_profiles
    ADD CONSTRAINT participant_support_profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payables payables_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: payables payables_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: payables payables_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payables
    ADD CONSTRAINT payables_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: phone_calls phone_calls_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_calls
    ADD CONSTRAINT phone_calls_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: pipeline_agent_scores pipeline_agent_scores_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_agent_scores
    ADD CONSTRAINT pipeline_agent_scores_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.pipeline_runs(id) ON DELETE CASCADE;


--
-- Name: pipeline_artifacts pipeline_artifacts_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_artifacts
    ADD CONSTRAINT pipeline_artifacts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.pipeline_runs(id) ON DELETE CASCADE;


--
-- Name: pipeline_stage_events pipeline_stage_events_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stage_events
    ADD CONSTRAINT pipeline_stage_events_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.pipeline_runs(id) ON DELETE CASCADE;


--
-- Name: pricing_recommendations pricing_recommendations_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_recommendations
    ADD CONSTRAINT pricing_recommendations_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.agent_runs(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organisation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organisation_id_fkey FOREIGN KEY (organisation_id) REFERENCES public.ndis_organisations(id) ON DELETE SET NULL;


--
-- Name: quotes quotes_converted_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_converted_order_id_fkey FOREIGN KEY (converted_order_id) REFERENCES public.orders(id);


--
-- Name: quotes quotes_converted_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_converted_subscription_id_fkey FOREIGN KEY (converted_subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ratings ratings_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: ratings ratings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ratings
    ADD CONSTRAINT ratings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: sandbox_agent_health sandbox_agent_health_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_agent_health
    ADD CONSTRAINT sandbox_agent_health_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: sandbox_agent_responses sandbox_agent_responses_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_agent_responses
    ADD CONSTRAINT sandbox_agent_responses_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.sandbox_scenarios(id) ON DELETE CASCADE;


--
-- Name: sandbox_agent_responses sandbox_agent_responses_training_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_agent_responses
    ADD CONSTRAINT sandbox_agent_responses_training_run_id_fkey FOREIGN KEY (training_run_id) REFERENCES public.sandbox_training_runs(id) ON DELETE CASCADE;


--
-- Name: sandbox_decision_scores sandbox_decision_scores_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_decision_scores
    ADD CONSTRAINT sandbox_decision_scores_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.sandbox_agent_responses(id) ON DELETE CASCADE;


--
-- Name: sandbox_decision_scores sandbox_decision_scores_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_decision_scores
    ADD CONSTRAINT sandbox_decision_scores_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.sandbox_scenarios(id) ON DELETE CASCADE;


--
-- Name: sandbox_lessons_learned sandbox_lessons_learned_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_lessons_learned
    ADD CONSTRAINT sandbox_lessons_learned_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.sandbox_scenarios(id) ON DELETE SET NULL;


--
-- Name: sandbox_run_batches sandbox_run_batches_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_run_batches
    ADD CONSTRAINT sandbox_run_batches_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: sandbox_training_runs sandbox_training_runs_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_training_runs
    ADD CONSTRAINT sandbox_training_runs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.sandbox_run_batches(id);


--
-- Name: sandbox_training_runs sandbox_training_runs_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sandbox_training_runs
    ADD CONSTRAINT sandbox_training_runs_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.sandbox_scenarios(id) ON DELETE CASCADE;


--
-- Name: service_pricing service_pricing_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_pricing
    ADD CONSTRAINT service_pricing_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: shift_segments shift_segments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_segments
    ADD CONSTRAINT shift_segments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: shift_segments shift_segments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_segments
    ADD CONSTRAINT shift_segments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: story_drafts story_drafts_opportunity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_drafts
    ADD CONSTRAINT story_drafts_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES public.story_opportunities(id) ON DELETE CASCADE;


--
-- Name: story_open_threads story_open_threads_related_arc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_open_threads
    ADD CONSTRAINT story_open_threads_related_arc_id_fkey FOREIGN KEY (related_arc_id) REFERENCES public.story_arcs(id) ON DELETE SET NULL;


--
-- Name: story_opportunities story_opportunities_related_arc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_opportunities
    ADD CONSTRAINT story_opportunities_related_arc_id_fkey FOREIGN KEY (related_arc_id) REFERENCES public.story_arcs(id) ON DELETE SET NULL;


--
-- Name: story_reviews story_reviews_draft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reviews
    ADD CONSTRAINT story_reviews_draft_id_fkey FOREIGN KEY (draft_id) REFERENCES public.story_drafts(id) ON DELETE CASCADE;


--
-- Name: story_reviews story_reviews_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reviews
    ADD CONSTRAINT story_reviews_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: stripe_disputes stripe_disputes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_disputes
    ADD CONSTRAINT stripe_disputes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: subscription_orders subscription_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_orders
    ADD CONSTRAINT subscription_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: subscription_orders subscription_orders_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_orders
    ADD CONSTRAINT subscription_orders_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: transport_arrangements transport_arrangements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_arrangements
    ADD CONSTRAINT transport_arrangements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: transport_arrangements transport_arrangements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_arrangements
    ADD CONSTRAINT transport_arrangements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: visitor_events visitor_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_events
    ADD CONSTRAINT visitor_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: visitor_events visitor_events_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_events
    ADD CONSTRAINT visitor_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: visitor_events visitor_events_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_events
    ADD CONSTRAINT visitor_events_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;


--
-- Name: visitor_events visitor_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_events
    ADD CONSTRAINT visitor_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.analytics_sessions(session_id) ON DELETE SET NULL;


--
-- Name: worker_payouts worker_payouts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payouts
    ADD CONSTRAINT worker_payouts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: worker_payouts worker_payouts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payouts
    ADD CONSTRAINT worker_payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: worker_payouts worker_payouts_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_payouts
    ADD CONSTRAINT worker_payouts_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.ndis_participants(id) ON DELETE SET NULL;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_payroll_details Admins full access to payroll details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins full access to payroll details" ON public.employee_payroll_details TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: artifact_versions Admins manage artifact versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage artifact versions" ON public.artifact_versions USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));


--
-- Name: artifacts Admins manage artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage artifacts" ON public.artifacts USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));


--
-- Name: campaign_factory_run_artifacts Admins manage campaign factory run artifacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage campaign factory run artifacts" ON public.campaign_factory_run_artifacts USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));


--
-- Name: campaign_factory_runs Admins manage campaign factory runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage campaign factory runs" ON public.campaign_factory_runs USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));


--
-- Name: content_assets Admins manage content assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage content assets" ON public.content_assets USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: content_ideas Admins manage content ideas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage content ideas" ON public.content_ideas USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: content_learning_records Admins manage content learning records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage content learning records" ON public.content_learning_records USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));


--
-- Name: content_library_items Admins manage content library items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage content library items" ON public.content_library_items USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));


--
-- Name: content_production_cards Admins manage content production cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage content production cards" ON public.content_production_cards USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: content_scripts Admins manage content scripts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage content scripts" ON public.content_scripts USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: job_participant_matches Admins manage job_participant_matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage job_participant_matches" ON public.job_participant_matches USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: job_publications Admins manage job_publications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage job_publications" ON public.job_publications USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: job_requirements Admins manage job_requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage job_requirements" ON public.job_requirements USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: marketing_campaign_queue_items Admins manage marketing campaign queue links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage marketing campaign queue links" ON public.marketing_campaign_queue_items USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_campaigns Admins manage marketing campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage marketing campaigns" ON public.marketing_campaigns USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_distribution_playbooks Admins manage marketing distribution playbooks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage marketing distribution playbooks" ON public.marketing_distribution_playbooks USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_publishing_queue Admins manage marketing publishing queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage marketing publishing queue" ON public.marketing_publishing_queue USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_social_channels Admins manage marketing social channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage marketing social channels" ON public.marketing_social_channels USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: ndis_organisations Admins manage ndis_organisations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage ndis_organisations" ON public.ndis_organisations USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: ndis_participants Admins manage ndis_participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage ndis_participants" ON public.ndis_participants USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: order_fees Admins manage order_fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage order_fees" ON public.order_fees USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: participant_support_profiles Admins manage participant_support_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage participant_support_profiles" ON public.participant_support_profiles USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: research_trends Admins manage research trends; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage research trends" ON public.research_trends USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: shift_segments Admins manage shift_segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage shift_segments" ON public.shift_segments USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: story_drafts Admins manage story drafts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage story drafts" ON public.story_drafts USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_reviews Admins manage story reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage story reviews" ON public.story_reviews USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: transport_arrangements Admins manage transport_arrangements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage transport_arrangements" ON public.transport_arrangements USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: worker_payouts Admins manage worker_payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage worker_payouts" ON public.worker_payouts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: agent_workflow_memberships Admins read agent workflow memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read agent workflow memberships" ON public.agent_workflow_memberships FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: foreman_insights Admins read foreman insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read foreman insights" ON public.foreman_insights FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: foreman_lobby_states Admins read foreman lobby states; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read foreman lobby states" ON public.foreman_lobby_states FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_guardrail_events Admins read guardrail events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read guardrail events" ON public.agent_guardrail_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: founder_journal_entries Admins read journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read journal entries" ON public.founder_journal_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: memory_contradiction_log Admins read memory_contradiction_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read memory_contradiction_log" ON public.memory_contradiction_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: memory_documents Admins read memory_documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read memory_documents" ON public.memory_documents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: memory_edges Admins read memory_edges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read memory_edges" ON public.memory_edges FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: memory_graph_extractions Admins read memory_graph_extractions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read memory_graph_extractions" ON public.memory_graph_extractions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: memory_read_log Admins read memory_read_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read memory_read_log" ON public.memory_read_log FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_open_threads Admins read open threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read open threads" ON public.story_open_threads FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_arcs Admins read story arcs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read story arcs" ON public.story_arcs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_bible_sections Admins read story bible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read story bible" ON public.story_bible_sections FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_chapters Admins read story chapters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read story chapters" ON public.story_chapters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_characters Admins read story characters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read story characters" ON public.story_characters FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: story_opportunities Admins read story opportunities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins read story opportunities" ON public.story_opportunities FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: page_views Authenticated users can read page_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read page_views" ON public.page_views FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: site_visitors Authenticated users can read visitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read visitors" ON public.site_visitors FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


--
-- Name: bud_rollback_events Authenticated users read rollback events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users read rollback events" ON public.bud_rollback_events FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: participant_support_profiles Employees manage own support profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees manage own support profile" ON public.participant_support_profiles USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: employee_payroll_details Employees manage their own payroll details; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees manage their own payroll details" ON public.employee_payroll_details TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_payroll_details.employee_id) AND (employees.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = employee_payroll_details.employee_id) AND (employees.user_id = auth.uid())))));


--
-- Name: job_requirements Employees read job requirements for published jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees read job requirements for published jobs" ON public.job_requirements FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.job_publications jp
     JOIN public.employees e ON ((e.id = jp.employee_id)))
  WHERE ((jp.order_id = job_requirements.order_id) AND (e.user_id = auth.uid()) AND (jp.status = 'published'::text)))));


--
-- Name: job_publications Employees read own job publications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees read own job publications" ON public.job_publications FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: job_participant_matches Employees read own match scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees read own match scores" ON public.job_participant_matches FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: shift_segments Employees read own shift segments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees read own shift segments" ON public.shift_segments FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: transport_arrangements Employees read own transport arrangements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees read own transport arrangements" ON public.transport_arrangements FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: job_publications Employees update own job publication response; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees update own job publication response" ON public.job_publications FOR UPDATE USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid())))) WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: worker_payouts Employees view own payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees view own payouts" ON public.worker_payouts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = worker_payouts.employee_id) AND (e.user_id = auth.uid())))));


--
-- Name: orders NDIS participants view available orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "NDIS participants view available orders" ON public.orders FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ndis_participant'::text)))) AND (status = ANY (ARRAY['confirmed'::text, 'scheduled'::text]))));


--
-- Name: ndis_participants Org admins manage own participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins manage own participants" ON public.ndis_participants USING (((organisation_id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'org_admin'::text))))));


--
-- Name: ndis_organisations Org admins view own organisation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins view own organisation" ON public.ndis_organisations FOR SELECT USING (((id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'org_admin'::text))))));


--
-- Name: order_fees Org admins view participant order_fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins view participant order_fees" ON public.order_fees FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((public.worker_payouts wp
     JOIN public.ndis_participants np ON ((np.id = wp.participant_id)))
     JOIN public.profiles p ON ((p.organisation_id = np.organisation_id)))
  WHERE ((wp.order_id = order_fees.order_id) AND (p.id = auth.uid()) AND (p.role = 'org_admin'::text)))));


--
-- Name: ndis_participants Participants view org siblings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view org siblings" ON public.ndis_participants FOR SELECT USING (((organisation_id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ndis_participant'::text))))));


--
-- Name: ndis_organisations Participants view own organisation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view own organisation" ON public.ndis_organisations FOR SELECT USING (((id = public.get_user_org_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'ndis_participant'::text))))));


--
-- Name: worker_payouts Participants view own payouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view own payouts" ON public.worker_payouts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ndis_participants np
  WHERE ((np.id = worker_payouts.participant_id) AND (np.user_id = auth.uid())))));


--
-- Name: ndis_participants Participants view own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants view own record" ON public.ndis_participants FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: analytics_sessions Public can insert analytics_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert analytics_sessions" ON public.analytics_sessions FOR INSERT WITH CHECK (true);


--
-- Name: site_feedback Public can insert feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert feedback" ON public.site_feedback FOR INSERT WITH CHECK (true);


--
-- Name: page_views Public can insert page_views; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert page_views" ON public.page_views FOR INSERT WITH CHECK (true);


--
-- Name: visitor_events Public can insert visitor_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert visitor_events" ON public.visitor_events FOR INSERT WITH CHECK (true);


--
-- Name: site_visitors Public can insert visitors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can insert visitors" ON public.site_visitors FOR INSERT WITH CHECK (true);


--
-- Name: analytics_sessions Public can update analytics_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can update analytics_sessions" ON public.analytics_sessions FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: bud_repair_quarantine Service role full access to bud_repair_quarantine; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to bud_repair_quarantine" ON public.bud_repair_quarantine USING (true) WITH CHECK (true);


--
-- Name: executive_agent_runs_meta Service role full access to executive_agent_runs_meta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_agent_runs_meta" ON public.executive_agent_runs_meta USING (true) WITH CHECK (true);


--
-- Name: executive_decisions Service role full access to executive_decisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_decisions" ON public.executive_decisions USING (true) WITH CHECK (true);


--
-- Name: executive_directives Service role full access to executive_directives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_directives" ON public.executive_directives USING (true) WITH CHECK (true);


--
-- Name: executive_kpi_targets Service role full access to executive_kpi_targets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_kpi_targets" ON public.executive_kpi_targets USING (true) WITH CHECK (true);


--
-- Name: executive_metrics_snapshots Service role full access to executive_metrics_snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_metrics_snapshots" ON public.executive_metrics_snapshots USING (true) WITH CHECK (true);


--
-- Name: executive_tasks Service role full access to executive_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_tasks" ON public.executive_tasks USING (true) WITH CHECK (true);


--
-- Name: executive_weekly_reviews Service role full access to executive_weekly_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to executive_weekly_reviews" ON public.executive_weekly_reviews USING (true) WITH CHECK (true);


--
-- Name: agent_workflow_memberships Service role manages agent workflow memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages agent workflow memberships" ON public.agent_workflow_memberships USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: bud_rollback_events Service role manages rollback events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages rollback events" ON public.bud_rollback_events USING (true);


--
-- Name: analytics_sessions Staff can read analytics_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can read analytics_sessions" ON public.analytics_sessions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.user_id = auth.uid()) AND (e.status = 'active'::text)))));


--
-- Name: visitor_events Staff can read visitor_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can read visitor_events" ON public.visitor_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.user_id = auth.uid()) AND (e.status = 'active'::text)))));


--
-- Name: site_feedback Staff can update feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update feedback" ON public.site_feedback FOR UPDATE TO authenticated USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))) WITH CHECK ((public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


--
-- Name: site_feedback Staff can view feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view feedback" ON public.site_feedback FOR SELECT TO authenticated USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


--
-- Name: analytics_findings admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read" ON public.analytics_findings FOR SELECT TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: analytics_funnels admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read" ON public.analytics_funnels FOR SELECT TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: analytics_reports admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read" ON public.analytics_reports FOR SELECT TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: design_audits admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read" ON public.design_audits FOR SELECT TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: design_violations admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read" ON public.design_violations FOR SELECT TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'admin'::text));


--
-- Name: employment_contracts admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all ON public.employment_contracts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: client_agreements admin_all_agreements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_agreements ON public.client_agreements USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: bud_activity_feed admin_all_bud_activity_feed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_activity_feed ON public.bud_activity_feed USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_approval_queue admin_all_bud_approval_queue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_approval_queue ON public.bud_approval_queue USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_audit_logs admin_all_bud_audit_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_audit_logs ON public.bud_audit_logs USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_change_requests admin_all_bud_change_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_change_requests ON public.bud_change_requests USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_deployment_verifications admin_all_bud_deployment_verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_deployment_verifications ON public.bud_deployment_verifications USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_insights admin_all_bud_insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_insights ON public.bud_insights USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_lobby_states admin_all_bud_lobby_states; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_lobby_states ON public.bud_lobby_states USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_repair_executions admin_all_bud_repair_executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_repair_executions ON public.bud_repair_executions USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_repair_learnings admin_all_bud_repair_learnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_repair_learnings ON public.bud_repair_learnings USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_repair_logs admin_all_bud_repair_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_repair_logs ON public.bud_repair_logs USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_repair_steps admin_all_bud_repair_steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_repair_steps ON public.bud_repair_steps USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_tasks admin_all_bud_tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_tasks ON public.bud_tasks USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_terminal_sessions admin_all_bud_terminal_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_bud_terminal_sessions ON public.bud_terminal_sessions USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: customers admin_all_customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_customers ON public.customers TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: orders admin_all_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_orders ON public.orders TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: payables admin_all_payables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_payables ON public.payables TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: payments admin_all_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_payments ON public.payments TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: ratings admin_all_ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_ratings ON public.ratings TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: rego_cache admin_all_rego_cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_rego_cache ON public.rego_cache TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: subscription_orders admin_all_subscription_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_subscription_orders ON public.subscription_orders TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: subscriptions admin_all_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_subscriptions ON public.subscriptions TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: job_variations admin_all_variations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_variations ON public.job_variations USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: vehicle_overrides admin_all_vehicle_overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_vehicle_overrides ON public.vehicle_overrides TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: admin_optimization_findings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_optimization_findings ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_evidence admin_service_bud_evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_service_bud_evidence ON public.bud_evidence USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: bud_improvements admin_service_bud_improvements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_service_bud_improvements ON public.bud_improvements USING (((auth.jwt() ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text, 'service_role'::text])));


--
-- Name: admin_ux_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_ux_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_ux_proposals admin_ux_proposals_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_ux_proposals_admin_read ON public.admin_ux_proposals FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: admin_ux_proposals admin_ux_proposals_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_ux_proposals_admin_write ON public.admin_ux_proposals USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: admin_ux_proposals admin_ux_proposals_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_ux_proposals_service ON public.admin_ux_proposals USING ((auth.role() = 'service_role'::text));


--
-- Name: site_settings admin_write_site_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_write_site_settings ON public.site_settings TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: agent_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_actions agent_actions_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_actions_admin_read ON public.agent_actions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_actions agent_actions_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_actions_admin_write ON public.agent_actions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_actions agent_actions_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_actions_service ON public.agent_actions USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_config_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_config_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_config_versions agent_config_versions_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_config_versions_admin_read ON public.agent_config_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_config_versions agent_config_versions_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_config_versions_admin_write ON public.agent_config_versions USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_config_versions agent_config_versions_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_config_versions_service ON public.agent_config_versions USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_evolutions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_evolutions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_evolutions agent_evolutions_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_evolutions_admin_read ON public.agent_evolutions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_evolutions agent_evolutions_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_evolutions_admin_write ON public.agent_evolutions USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_evolutions agent_evolutions_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_evolutions_service ON public.agent_evolutions USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_guardrail_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_guardrail_events ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_memory agent_memory_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_memory_service ON public.agent_memory USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_runs agent_runs_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_runs_admin_read ON public.agent_runs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agent_runs agent_runs_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_runs_service ON public.agent_runs USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_workflow_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_workflow_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

--
-- Name: agents agents_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_admin_read ON public.agents FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agents agents_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_admin_write ON public.agents USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: agents agents_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_service_all ON public.agents USING ((auth.role() = 'service_role'::text));


--
-- Name: analytics_findings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_findings ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_funnels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_funnels ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_convention_learnings anon read conventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "anon read conventions" ON public.bud_convention_learnings FOR SELECT USING (true);


--
-- Name: applicants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

--
-- Name: applicants applicants_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applicants_admin_all ON public.applicants TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: applicants applicants_public_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applicants_public_insert ON public.applicants FOR INSERT TO anon WITH CHECK (true);


--
-- Name: artifact_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifact_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: bud_activity_feed; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_activity_feed ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_approval_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_approval_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_browser_test_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_browser_test_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_circuit_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_circuit_states ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_convention_learnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_convention_learnings ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_deployment_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_deployment_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_improvement_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_improvement_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_improvement_learnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_improvement_learnings ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_improvement_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_improvement_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_improvement_signals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_improvement_signals ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_improvement_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_improvement_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_improvements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_improvements ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_lobby_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_lobby_states ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_repair_executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_repair_executions ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_repair_learnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_repair_learnings ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_repair_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_repair_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_repair_quarantine; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_repair_quarantine ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_repair_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_repair_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_rollback_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_rollback_events ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_root_cause_initiatives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_root_cause_initiatives ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_telemetry_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_telemetry_events ENABLE ROW LEVEL SECURITY;

--
-- Name: bud_terminal_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bud_terminal_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_factory_run_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_factory_run_artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_factory_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_factory_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: capture_briefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.capture_briefs ENABLE ROW LEVEL SECURITY;

--
-- Name: capture_briefs capture_briefs_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capture_briefs_admin_read ON public.capture_briefs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: capture_briefs capture_briefs_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY capture_briefs_service_all ON public.capture_briefs TO service_role USING (true) WITH CHECK (true);


--
-- Name: cash_flow_forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_flow_forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_flow_forecasts cash_flow_forecasts_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_flow_forecasts_admin_read ON public.cash_flow_forecasts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: cash_flow_forecasts cash_flow_forecasts_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cash_flow_forecasts_service ON public.cash_flow_forecasts USING ((auth.role() = 'service_role'::text));


--
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_templates checklist_templates_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_admin_all ON public.checklist_templates TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: checklist_templates checklist_templates_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY checklist_templates_staff_select ON public.checklist_templates FOR SELECT TO authenticated USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


--
-- Name: classification_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classification_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: classification_feedback classification_feedback_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classification_feedback_admin_all ON public.classification_feedback TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: client_agreements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: competitor_intel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitor_intel ENABLE ROW LEVEL SECURITY;

--
-- Name: competitor_intel competitor_intel_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY competitor_intel_admin_read ON public.competitor_intel FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: competitor_intel competitor_intel_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY competitor_intel_admin_write ON public.competitor_intel USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: competitor_intel competitor_intel_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY competitor_intel_service ON public.competitor_intel USING ((auth.role() = 'service_role'::text));


--
-- Name: competitor_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competitor_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: competitor_pages competitor_pages_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY competitor_pages_admin_read ON public.competitor_pages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: competitor_pages competitor_pages_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY competitor_pages_service ON public.competitor_pages USING ((auth.role() = 'service_role'::text));


--
-- Name: content_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: content_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: content_drafts content_drafts_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_drafts_admin_read ON public.content_drafts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: content_drafts content_drafts_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_drafts_service ON public.content_drafts USING ((auth.role() = 'service_role'::text));


--
-- Name: content_ideas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

--
-- Name: content_learning_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_learning_records ENABLE ROW LEVEL SECURITY;

--
-- Name: content_library_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_library_items ENABLE ROW LEVEL SECURITY;

--
-- Name: content_production_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_production_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: content_scripts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_scripts ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_admin_all ON public.conversations TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: crew_coach_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crew_coach_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: crew_coach_notes crew_coach_notes_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crew_coach_notes_admin_read ON public.crew_coach_notes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: crew_coach_notes crew_coach_notes_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY crew_coach_notes_service ON public.crew_coach_notes USING ((auth.role() = 'service_role'::text));


--
-- Name: customer_properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_properties ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: design_audits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_audits ENABLE ROW LEVEL SECURITY;

--
-- Name: design_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: design_insights design_insights_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_insights_admin_read ON public.design_insights FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: design_insights design_insights_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_insights_admin_write ON public.design_insights USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: design_insights design_insights_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_insights_service ON public.design_insights USING ((auth.role() = 'service_role'::text));


--
-- Name: design_violations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: dev_os_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dev_os_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: efficiency_findings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.efficiency_findings ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_documents employee_documents_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_documents_admin_all ON public.employee_documents TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: employee_documents employee_documents_employee_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_documents_employee_own ON public.employee_documents TO authenticated USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: employee_onboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_onboarding employee_onboarding_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_onboarding_admin_all ON public.employee_onboarding TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: employee_onboarding employee_onboarding_employee_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_onboarding_employee_own ON public.employee_onboarding TO authenticated USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: employee_payroll_details; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_payroll_details ENABLE ROW LEVEL SECURITY;

--
-- Name: employment_contracts employee_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employee_read_own ON public.employment_contracts FOR SELECT USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = auth.uid()))));


--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_admin_all ON public.employees TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: employees employees_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_insert_own ON public.employees FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: employees employees_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_select_own ON public.employees FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: employees employees_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_update_own ON public.employees FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: employment_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_agent_runs_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_agent_runs_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_directives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_directives ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_kpi_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_kpi_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_metrics_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_metrics_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: executive_weekly_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executive_weekly_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: foreman_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foreman_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: foreman_lobby_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.foreman_lobby_states ENABLE ROW LEVEL SECURITY;

--
-- Name: founder_journal_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.founder_journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: fundraising_contributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fundraising_contributions ENABLE ROW LEVEL SECURITY;

--
-- Name: fundraising_contributions fundraising_contributions_no_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fundraising_contributions_no_public_read ON public.fundraising_contributions FOR SELECT TO authenticated, anon USING (false);


--
-- Name: fundraising_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fundraising_items ENABLE ROW LEVEL SECURITY;

--
-- Name: fundraising_items fundraising_items_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fundraising_items_public_read ON public.fundraising_items FOR SELECT TO authenticated, anon USING ((status = 'live'::text));


--
-- Name: github_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.github_events ENABLE ROW LEVEL SECURITY;

--
-- Name: growth_pipeline_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.growth_pipeline_events ENABLE ROW LEVEL SECURITY;

--
-- Name: job_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: job_assignments job_assignments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_assignments_admin_all ON public.job_assignments TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: job_assignments job_assignments_employee_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_assignments_employee_own ON public.job_assignments FOR SELECT TO authenticated USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: job_assignments job_assignments_employee_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_assignments_employee_update ON public.job_assignments FOR UPDATE TO authenticated USING ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((employee_id IN ( SELECT employees.id
   FROM public.employees
  WHERE (employees.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: job_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: job_completions job_completions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_completions_admin_all ON public.job_completions TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: job_completions job_completions_employee_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_completions_employee_own ON public.job_completions TO authenticated USING ((assignment_id IN ( SELECT ja.id
   FROM (public.job_assignments ja
     JOIN public.employees e ON ((e.id = ja.employee_id)))
  WHERE (e.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((assignment_id IN ( SELECT ja.id
   FROM (public.job_assignments ja
     JOIN public.employees e ON ((e.id = ja.employee_id)))
  WHERE (e.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: job_participant_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_participant_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: job_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: job_photos job_photos_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_photos_admin_read ON public.job_photos FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: job_photos job_photos_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_photos_service ON public.job_photos USING ((auth.role() = 'service_role'::text));


--
-- Name: job_publications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_publications ENABLE ROW LEVEL SECURITY;

--
-- Name: job_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: job_variations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_variations ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_articles knowledge_articles_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_articles_admin_read ON public.knowledge_articles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: knowledge_articles knowledge_articles_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_articles_service ON public.knowledge_articles USING ((auth.role() = 'service_role'::text));


--
-- Name: lapsed_outreach; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lapsed_outreach ENABLE ROW LEVEL SECURITY;

--
-- Name: lapsed_outreach lapsed_outreach_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lapsed_outreach_admin_read ON public.lapsed_outreach FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: lapsed_outreach lapsed_outreach_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lapsed_outreach_service ON public.lapsed_outreach USING ((auth.role() = 'service_role'::text));


--
-- Name: lead_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_conversations lead_conversations_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_conversations_staff_read ON public.lead_conversations FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: lead_follow_ups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_follow_ups lead_follow_ups_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_follow_ups_staff_read ON public.lead_follow_ups FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: lead_response_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_response_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_response_metrics lead_response_metrics_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_response_metrics_staff_read ON public.lead_response_metrics FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: lead_suburb_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_suburb_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_suburb_analytics lead_suburb_analytics_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_suburb_analytics_staff_read ON public.lead_suburb_analytics FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leads leads_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_staff_read ON public.leads FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: lobby_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lobby_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: lobby_themes lobby_themes_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lobby_themes_admin_read ON public.lobby_themes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: lobby_themes lobby_themes_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lobby_themes_admin_write ON public.lobby_themes USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: lobby_themes lobby_themes_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lobby_themes_service ON public.lobby_themes USING ((auth.role() = 'service_role'::text));


--
-- Name: marketing_campaign_queue_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_campaign_queue_items ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_distribution_playbooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_distribution_playbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_metrics marketing_metrics_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_metrics_admin_read ON public.marketing_metrics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_metrics marketing_metrics_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_metrics_admin_update ON public.marketing_metrics FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_metrics marketing_metrics_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_metrics_admin_write ON public.marketing_metrics FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: marketing_metrics marketing_metrics_service_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_metrics_service_all ON public.marketing_metrics TO service_role USING (true) WITH CHECK (true);


--
-- Name: marketing_publishing_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_publishing_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_social_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_social_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_contradiction_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_contradiction_log ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_edges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_edges ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_graph_extractions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_graph_extractions ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_read_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_read_log ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_admin_all ON public.messages TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: ndis_organisations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ndis_organisations ENABLE ROW LEVEL SECURITY;

--
-- Name: ndis_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ndis_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: ndis_plan_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ndis_plan_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: ndis_plan_matches ndis_plan_matches_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ndis_plan_matches_admin_read ON public.ndis_plan_matches FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: ndis_plan_matches ndis_plan_matches_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ndis_plan_matches_service ON public.ndis_plan_matches USING ((auth.role() = 'service_role'::text));


--
-- Name: order_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_customer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_customer_select ON public.orders FOR SELECT TO authenticated USING (((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))) OR (public.get_user_role() = 'admin'::text) OR ((public.get_user_role() = 'employee'::text) AND ((assigned_employee_id IS NULL) OR (assigned_employee_id = auth.uid())))));


--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: participant_support_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.participant_support_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: payables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: payouts payouts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payouts_admin_all ON public.payouts TO authenticated USING ((public.get_user_role() = 'admin'::text)) WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: phone_calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.phone_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: phone_calls phone_calls_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phone_calls_admin_read ON public.phone_calls FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: phone_calls phone_calls_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phone_calls_service ON public.phone_calls USING ((auth.role() = 'service_role'::text));


--
-- Name: pipeline_agent_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_agent_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_agent_scores pipeline_agent_scores read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_agent_scores read" ON public.pipeline_agent_scores FOR SELECT USING (public.is_pipeline_admin());


--
-- Name: pipeline_artifacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_artifacts pipeline_artifacts read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_artifacts read" ON public.pipeline_artifacts FOR SELECT USING (public.is_pipeline_admin());


--
-- Name: pipeline_kill_switch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_kill_switch ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_kill_switch pipeline_kill_switch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_kill_switch read" ON public.pipeline_kill_switch FOR SELECT USING (public.is_pipeline_admin());


--
-- Name: pipeline_kill_switch pipeline_kill_switch write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_kill_switch write" ON public.pipeline_kill_switch FOR UPDATE USING (public.is_pipeline_admin()) WITH CHECK (public.is_pipeline_admin());


--
-- Name: pipeline_policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_policy ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_policy pipeline_policy read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_policy read" ON public.pipeline_policy FOR SELECT USING (public.is_pipeline_admin());


--
-- Name: pipeline_policy pipeline_policy write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_policy write" ON public.pipeline_policy FOR UPDATE USING (public.is_pipeline_admin()) WITH CHECK (public.is_pipeline_admin());


--
-- Name: pipeline_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_runs pipeline_runs read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_runs read" ON public.pipeline_runs FOR SELECT USING (public.is_pipeline_admin());


--
-- Name: pipeline_stage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_stage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stage_events pipeline_stage_events read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pipeline_stage_events read" ON public.pipeline_stage_events FOR SELECT USING (public.is_pipeline_admin());


--
-- Name: pr_review_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pr_review_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_recommendations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_recommendations ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_recommendations pricing_recs_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_recs_admin_read ON public.pricing_recommendations FOR SELECT USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text])));


--
-- Name: pricing_recommendations pricing_recs_service_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pricing_recs_service_write ON public.pricing_recommendations USING ((auth.role() = 'service_role'::text));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_all ON public.profiles TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) AND (role = ( SELECT p.role
   FROM public.profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: customer_properties property_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_own ON public.customer_properties TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: customer_properties property_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY property_staff_select ON public.customer_properties FOR SELECT TO authenticated USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


--
-- Name: site_settings public_read_site_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_site_settings ON public.site_settings FOR SELECT TO anon USING (true);


--
-- Name: quote_funnel_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quote_funnel_events ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes quotes_admin_employee_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_admin_employee_all ON public.quotes TO authenticated USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text])));


--
-- Name: quotes quotes_customer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quotes_customer_select ON public.quotes FOR SELECT TO authenticated USING (((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = ( SELECT auth.uid() AS uid)))) OR (public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))));


--
-- Name: ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: ratings ratings_customer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ratings_customer_select ON public.ratings FOR SELECT TO authenticated USING (((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = ( SELECT auth.uid() AS uid)))) OR (public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))));


--
-- Name: rego_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rego_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: research_trends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.research_trends ENABLE ROW LEVEL SECURITY;

--
-- Name: resilience_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resilience_events ENABLE ROW LEVEL SECURITY;

--
-- Name: reviewer_calibration; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviewer_calibration ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_agent_health; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_agent_health ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_agent_health sandbox_agent_health_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_agent_health_admin_read ON public.sandbox_agent_health FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_agent_health sandbox_agent_health_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_agent_health_admin_write ON public.sandbox_agent_health USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_agent_health sandbox_agent_health_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_agent_health_service ON public.sandbox_agent_health USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_agent_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_agent_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_agent_responses sandbox_agent_responses_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_agent_responses_admin_read ON public.sandbox_agent_responses FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_agent_responses sandbox_agent_responses_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_agent_responses_admin_write ON public.sandbox_agent_responses USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_agent_responses sandbox_agent_responses_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_agent_responses_service ON public.sandbox_agent_responses USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_decision_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_decision_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_decision_scores sandbox_decision_scores_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_decision_scores_admin_read ON public.sandbox_decision_scores FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_decision_scores sandbox_decision_scores_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_decision_scores_admin_write ON public.sandbox_decision_scores USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_decision_scores sandbox_decision_scores_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_decision_scores_service ON public.sandbox_decision_scores USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_lessons_learned; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_lessons_learned ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_lessons_learned sandbox_lessons_learned_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_lessons_learned_admin_read ON public.sandbox_lessons_learned FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_lessons_learned sandbox_lessons_learned_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_lessons_learned_admin_write ON public.sandbox_lessons_learned USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_lessons_learned sandbox_lessons_learned_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_lessons_learned_service ON public.sandbox_lessons_learned USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_policy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_policy ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_policy sandbox_policy_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_policy_admin_read ON public.sandbox_policy FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_policy sandbox_policy_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_policy_admin_write ON public.sandbox_policy USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_policy sandbox_policy_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_policy_service ON public.sandbox_policy USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_run_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_run_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_run_batches sandbox_run_batches_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_run_batches_admin_read ON public.sandbox_run_batches FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_run_batches sandbox_run_batches_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_run_batches_admin_write ON public.sandbox_run_batches USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_run_batches sandbox_run_batches_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_run_batches_service ON public.sandbox_run_batches USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_scenarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_scenarios ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_scenarios sandbox_scenarios_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_scenarios_admin_read ON public.sandbox_scenarios FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_scenarios sandbox_scenarios_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_scenarios_admin_write ON public.sandbox_scenarios USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_scenarios sandbox_scenarios_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_scenarios_service ON public.sandbox_scenarios USING ((auth.role() = 'service_role'::text));


--
-- Name: sandbox_training_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sandbox_training_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: sandbox_training_runs sandbox_training_runs_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_training_runs_admin_read ON public.sandbox_training_runs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_training_runs sandbox_training_runs_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_training_runs_admin_write ON public.sandbox_training_runs USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: sandbox_training_runs sandbox_training_runs_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sandbox_training_runs_service ON public.sandbox_training_runs USING ((auth.role() = 'service_role'::text));


--
-- Name: admin_optimization_findings service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.admin_optimization_findings TO service_role USING (true) WITH CHECK (true);


--
-- Name: agent_alerts service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.agent_alerts TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_findings service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.analytics_findings TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_funnels service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.analytics_funnels TO service_role USING (true) WITH CHECK (true);


--
-- Name: analytics_reports service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.analytics_reports TO service_role USING (true) WITH CHECK (true);


--
-- Name: design_audits service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.design_audits TO service_role USING (true) WITH CHECK (true);


--
-- Name: design_violations service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.design_violations TO service_role USING (true) WITH CHECK (true);


--
-- Name: github_events service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role full access" ON public.github_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: bud_browser_test_runs service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service role only" ON public.bud_browser_test_runs USING ((auth.role() = 'service_role'::text));


--
-- Name: bud_convention_learnings service write conventions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service write conventions" ON public.bud_convention_learnings FOR INSERT WITH CHECK (true);


--
-- Name: service_pricing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

--
-- Name: service_pricing service_pricing_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_pricing_admin_read ON public.service_pricing FOR SELECT USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text])));


--
-- Name: service_pricing service_pricing_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_pricing_admin_write ON public.service_pricing USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'owner'::text])));


--
-- Name: service_pricing service_pricing_service_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_pricing_service_write ON public.service_pricing USING ((auth.role() = 'service_role'::text));


--
-- Name: bud_circuit_states service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.bud_circuit_states USING (true);


--
-- Name: efficiency_findings service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.efficiency_findings USING (true);


--
-- Name: resilience_events service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.resilience_events USING (true);


--
-- Name: bud_improvement_executions service_role_all_improvement_executions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_improvement_executions ON public.bud_improvement_executions USING (true) WITH CHECK (true);


--
-- Name: bud_improvement_learnings service_role_all_improvement_learnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_improvement_learnings ON public.bud_improvement_learnings USING (true) WITH CHECK (true);


--
-- Name: bud_improvement_logs service_role_all_improvement_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_improvement_logs ON public.bud_improvement_logs USING (true) WITH CHECK (true);


--
-- Name: bud_improvement_signals service_role_all_improvement_signals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_improvement_signals ON public.bud_improvement_signals USING (true) WITH CHECK (true);


--
-- Name: bud_improvement_steps service_role_all_improvement_steps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_improvement_steps ON public.bud_improvement_steps USING (true) WITH CHECK (true);


--
-- Name: bud_root_cause_initiatives service_role_all_root_cause_initiatives; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_root_cause_initiatives ON public.bud_root_cause_initiatives USING (true) WITH CHECK (true);


--
-- Name: bud_telemetry_events service_role_all_telemetry; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all_telemetry ON public.bud_telemetry_events USING (true) WITH CHECK (true);


--
-- Name: dev_os_sessions service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_only ON public.dev_os_sessions USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));


--
-- Name: shift_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: site_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: site_impact_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_impact_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: site_impact_stats site_impact_stats_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_impact_stats_public_read ON public.site_impact_stats FOR SELECT TO authenticated, anon USING (true);


--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_visitors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;

--
-- Name: social_proof_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_proof_items ENABLE ROW LEVEL SECURITY;

--
-- Name: social_proof_items social_proof_items_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY social_proof_items_public_read ON public.social_proof_items FOR SELECT TO authenticated, anon USING ((status = 'live'::text));


--
-- Name: story_arcs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_arcs ENABLE ROW LEVEL SECURITY;

--
-- Name: story_bible_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_bible_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: story_chapters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_chapters ENABLE ROW LEVEL SECURITY;

--
-- Name: story_characters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_characters ENABLE ROW LEVEL SECURITY;

--
-- Name: story_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: story_open_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_open_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: story_opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: story_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.story_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_disputes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_disputes ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_disputes stripe_disputes_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stripe_disputes_admin_read ON public.stripe_disputes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: stripe_disputes stripe_disputes_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stripe_disputes_service ON public.stripe_disputes USING ((auth.role() = 'service_role'::text));


--
-- Name: subscription_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions subscriptions_customer_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_customer_select ON public.subscriptions FOR SELECT TO authenticated USING (((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))) OR (public.get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))));


--
-- Name: transport_arrangements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transport_arrangements ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicle_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: visitor_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;

--
-- Name: whs_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whs_records ENABLE ROW LEVEL SECURITY;

--
-- Name: whs_records whs_records_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY whs_records_admin_read ON public.whs_records FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));


--
-- Name: whs_records whs_records_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY whs_records_service ON public.whs_records USING ((auth.role() = 'service_role'::text));


--
-- Name: worker_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.worker_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Admins read crew documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Admins read crew documents" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'crew-documents'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));


--
-- Name: objects Authenticated users can upload avatars 1oj01fe_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload avatars 1oj01fe_0" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));


--
-- Name: objects Employees read own documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Employees read own documents" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'crew-documents'::text) AND (EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.user_id = auth.uid()) AND (objects.name ~~ ((employees.id)::text || '/%'::text)))))));


--
-- Name: objects authenticated users can update avatars; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "authenticated users can update avatars" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'avatars'::text)) WITH CHECK ((bucket_id = 'avatars'::text));


--
-- Name: objects authenticated users can upload avatars; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime agent_actions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.agent_actions;


--
-- Name: supabase_realtime agent_runs; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.agent_runs;


--
-- Name: supabase_realtime analytics_sessions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.analytics_sessions;


--
-- Name: supabase_realtime bud_activity_feed; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bud_activity_feed;


--
-- Name: supabase_realtime bud_lobby_states; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.bud_lobby_states;


--
-- Name: supabase_realtime design_insights; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.design_insights;


--
-- Name: supabase_realtime foreman_insights; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.foreman_insights;


--
-- Name: supabase_realtime foreman_lobby_states; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.foreman_lobby_states;


--
-- Name: supabase_realtime lead_conversations; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.lead_conversations;


--
-- Name: supabase_realtime lead_follow_ups; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.lead_follow_ups;


--
-- Name: supabase_realtime leads; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.leads;


--
-- Name: supabase_realtime memory_documents; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.memory_documents;


--
-- Name: supabase_realtime page_views; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.page_views;


--
-- Name: supabase_realtime pipeline_agent_scores; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.pipeline_agent_scores;


--
-- Name: supabase_realtime pipeline_artifacts; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.pipeline_artifacts;


--
-- Name: supabase_realtime pipeline_runs; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.pipeline_runs;


--
-- Name: supabase_realtime pipeline_stage_events; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.pipeline_stage_events;


--
-- Name: supabase_realtime site_visitors; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.site_visitors;


--
-- Name: supabase_realtime visitor_events; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.visitor_events;


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict nfYDsHDpwik5uJlaM5VXap7ihNXCt8wuNO2ikzoyLbc2riAyiTCGgxISMfJgoUZ

