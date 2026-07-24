# Database migration baseline

Status: upgrade-only

The SQL files directly in this directory represent the migration history reconciled with the deployed Supabase project. They are the supported path for upgrading a database that already contains the historical application schema. They are not a supported empty-database bootstrap.

Do not run `supabase db reset`, or replay this directory against an empty database, until a reviewed schema-only baseline has been captured and adopted. The first top-level migration creates only the early orders/subscriptions schema; later timestamped migrations depend on objects that were moved to `legacy/` during migration-history reconciliation.

The files under `legacy/` are retained as historical evidence. They must not be moved back into the Supabase migration directory or replayed automatically:

- their versions were not the migration versions reconciled with the deployed project;
- some migrations are mutually inconsistent for a fresh install (for example, migration 006 creates `employees.user_id`, while migration 007 expects `employees.clerk_user_id`);
- `combined_migration.sql` overlaps multiple numbered migrations;
- several timestamped top-level files are tracking stubs for SQL applied directly to the deployed database but not retained locally.

## Required fresh-install repair

A supported fresh install requires a schema-only baseline captured from an authorised disposable clone or another reviewed authoritative schema source. The baseline must include tables, constraints, functions, triggers, RLS policies, grants, extensions, and Supabase roles without application data or credentials. It must be validated independently before the post-baseline migration tail is applied.

Do not synthesize that baseline by concatenating `legacy/`, do not mark historical migrations as applied, and do not use production credentials to obtain it.

Run `node scripts/validate-migration-baseline.mjs` to verify that the repository continues to expose this limitation explicitly and that migrations 151 and 152 remain present. Run `node scripts/migration-inventory.mjs` to refresh the structured inventory in `docs/database/migration-inventory.json`.
