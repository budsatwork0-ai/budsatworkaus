# Schema Baseline

Point-in-time, schema-only snapshots of the production Supabase database.

## What these files are

| File | Contents |
|---|---|
| `schema.sql` | DDL for all database schemas (no data) |
| `public-schema.sql` | DDL for the `public` schema only (subset of `schema.sql`) |
| `SHA256SUMS.txt` | SHA-256 integrity checksums for the two SQL files |
| `PROVENANCE.txt` | How and when the artifacts were produced |
| `SANITIZATION_REPORT.md` | Results of credential and data scan before promotion |

## Important constraints

- **Not migrations.** These files must not be applied automatically by Supabase CLI or any migration runner.
- **DDL only.** The SQL files contain no `INSERT`, `COPY`, or other data statements — schema structure only.
- **Point-in-time.** They represent the database state at export time and will drift as migrations are applied.

## Verifying integrity

```sh
cd supabase/schema-baseline
shasum -a 256 -c SHA256SUMS.txt
```

## Refreshing this baseline

When refreshing, replace the full artifact set together:

1. Re-export `schema.sql` and `public-schema.sql` using `pg_dump --schema-only`.
2. Re-run the sanitization scan (see `SANITIZATION_REPORT.md` for the checklist).
3. Regenerate `SHA256SUMS.txt` from the new SQL files.
4. Update `PROVENANCE.txt` with the new export date and tool version.
5. Commit all six files together.
