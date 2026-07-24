# Sanitization Report — schema.sql / public-schema.sql

Scope: both exported files were inspected for the categories listed in
`authoritative-baseline-artifact-request.md` and the handling instructions
for this export. All checks were run with output redaction/pattern-matching
only — no raw connection string or credential was ever printed to the
conversation or this report.

## Checks performed and results

| Category | Method | Result |
|---|---|---|
| `COPY` statements | `grep '^COPY '` | None found |
| Data-bearing `INSERT` statements | `grep '^INSERT INTO'` | None found |
| Role/user passwords | `grep -i "PASSWORD '"` (CREATE/ALTER ROLE) | None found |
| `--role-only` cluster dump | N/A — deliberately not run | Excluded by design (see PROVENANCE.txt) |
| JWT-like secrets | `grep 'eyJ[A-Za-z0-9_-]{10,}'` | None found |
| Connection strings / `postgres://` | `grep 'postgres(ql)?://'` | None found |
| Supabase project hostnames (`*.supabase.co` etc.) | `grep` for supabase domains | None found |
| Literal email addresses | `grep` email regex over file content | None found |
| Literal phone numbers (AU formats) | `grep` phone regex over file content | None found |
| Known API key prefixes (Stripe `sk_live_`/`sk_test_`, Resend `re_`, Google `AIza`, AWS `AKIA`) | `grep` prefix patterns | One raw match, resolved as false positive (see below) |
| Long opaque literal defaults (possible embedded secrets) | `grep "DEFAULT '[A-Za-z0-9+/=_-]{20,}'"` | Two matches, both benign (see below) |
| Required content present: GRANT, RLS/POLICY, functions, triggers, extensions schema | `grep -c` per construct | Present: 808+796 GRANT statements, 175 RLS-enabled tables, 273 policies, 136 functions, `extensions` schema + bootstrap functions |

## False positives investigated and cleared

- **`re_` prefix hits**: all four matches were substrings of the column
  name `score_adjustment` (a review-calibration scoring column), not a
  Resend API key. Confirmed by viewing surrounding line context.
- **`CREATE TRIGGER` string match**: appeared only inside a Postgres event
  trigger function body, as a string literal in a `command_tag IN (...)`
  list (standard Supabase schema-notification boilerplate) — not an actual
  `CREATE TRIGGER` DDL statement and not evidence of missing trigger
  coverage.
- **Long literal `DEFAULT` values**: `'tests/e2e/golden-paths'` (a test
  directory path) and `'efficiency-architect'` (an agent identifier
  string). Both are application configuration literals, not secrets.

## Distinguishing schema references from real secrets

Per instruction, column/function/policy names containing words like
`password`, `key`, `token`, `secret`, or `email` were treated as expected
schema vocabulary and were not modified or removed — only literal *values*
(string literals that could be actual secrets or PII) were treated as
findings requiring investigation. No such literal values were found.

## Conclusion

**No application data, credentials, secrets, or personal information were
found in either exported file.** Both files are schema-only and contain the
DDL categories required by the artifact request (tables, constraints,
indexes, functions, triggers, RLS policies, and grants for
anon/authenticated/service_role/postgres).

**Artifact status: safe to review.** No sanitization/redaction of the SQL
files themselves was necessary. Nothing was moved or committed into the
repository — both files remain in the private, owner-only-permission
handoff directory pending explicit review and adoption.
