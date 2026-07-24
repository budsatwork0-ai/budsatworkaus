# Authoritative schema baseline artifact request

Phase 2 cannot proceed until the project owner supplies or authorises access to the artifact described here. Repository migrations are not an authoritative source for reconstructing the missing baseline.

## Required owner action

Provide one of the following, in priority order:

1. Temporary access to a disposable clone of the deployed Supabase project, with permission to export schema only.
2. A reviewed schema-only PostgreSQL dump exported from that disposable clone.
3. A reviewed schema-only dump from an authorised non-production Supabase environment confirmed to match the deployed schema.

Do not provide production database credentials. Do not export application rows, auth users, storage objects, or other customer or employee data.

## Artifact contents

The preferred artifact is a plain-text, schema-only PostgreSQL dump covering application schemas and the definitions needed to reproduce Supabase-facing behaviour:

- schemas and required extensions;
- enum and domain types;
- tables, sequences, identity configuration, columns, defaults, and generated columns;
- primary keys, foreign keys, unique constraints, and check constraints;
- indexes;
- functions and procedures, including signatures, ownership, security mode, configuration, and `search_path`;
- triggers;
- RLS enablement and policies;
- schema, table, sequence, and function grants/revokes for `anon`, `authenticated`, and `service_role`;
- references to Supabase-managed schemas such as `auth`, without exporting their data;
- the migration-history versions known to be applied, exported separately as metadata rather than fabricated `INSERT` statements in the baseline.

The dump must not contain `COPY` or application-data `INSERT` statements, role passwords, secrets, tokens, connection strings, project URLs, project references, personal information, or storage object contents.

## Suggested export procedure

Run the export only against an authorised disposable clone or matching non-production environment. Keep the connection string outside shell history where possible and do not place it in the repository.

```sh
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --format=plain \
  --schema=public \
  --schema=extensions \
  --file=authoritative-schema.sql \
  "$AUTHORISED_DISPOSABLE_DATABASE_URL"
```

Because `--no-privileges` intentionally omits grants, also provide a separately reviewed privileges export or inspection report for schema/table/sequence/function access by `anon`, `authenticated`, and `service_role`. Supabase-managed `auth` definitions should be supplied only where needed to resolve application references; never include `auth.users` data.

If Supabase CLI is used, its schema-only output is acceptable when the exact CLI version and command are recorded and the result contains no data or credentials.

## Required provenance metadata

Supply a short text or JSON sidecar containing:

- source type: disposable clone or authorised non-production environment;
- authorising owner or team;
- UTC export date;
- PostgreSQL version;
- Supabase CLI version, if used;
- source state represented;
- latest migration version known to be applied;
- whether migrations `20260722090000` and `20260722100000` are included;
- confirmation that the export contains no application data;
- SHA-256 checksum of each supplied artifact.

Do not include hostnames, credentials, project references, or connection strings in the metadata.

## Secure delivery and review

Deliver the uncommitted artifact through the workspace attachment mechanism or another owner-approved secure channel. It must first be placed outside tracked repository paths and reviewed for:

- `COPY` and data-bearing `INSERT` statements;
- credentials, hashes, tokens, URLs, project references, and hostnames;
- personal information and storage paths;
- deployment-specific ownership;
- unsupported Supabase internal objects;
- destructive statements inappropriate for empty-database bootstrap.

Only the sanitized, reviewed schema and its non-sensitive provenance/checksum metadata may be adopted as the repository baseline.

## Acceptance boundary

Receiving a dump is not sufficient by itself. Phase 2 can resume only after its provenance is authorised and its represented migration state is known. If either is ambiguous, the artifact must be rejected rather than used to infer migration history.
