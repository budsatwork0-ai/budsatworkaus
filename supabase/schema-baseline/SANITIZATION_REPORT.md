# Sanitization Report

**Date:** 2026-07-24  
**Artifacts inspected:** `schema.sql` (20,594 lines), `public-schema.sql` (15,600 lines)

---

## Checks Performed

| Check | Tool/Pattern | Result |
|---|---|---|
| No data rows | `grep -ci "^INSERT "` on both files | **0** INSERT statements in either file |
| No embedded connection strings | `grep -E "://[^@]+:[^@]+@"` | **0** matches |
| No high-entropy quoted literals ≥40 chars | `grep -oE "'[A-Za-z0-9+/]{40,}'"` | **0** matches |
| No embedded password values | `grep -niE "(password=\|:.*@)"` (value patterns) | **0** matches |
| pg_dump stderr | Captured to `/tmp/pg_err.txt` | **Empty** — no warnings |

---

## Benign Matches (flagged for review, classified safe)

The keyword scan (`password`, `token`, `secret`, `api_key`, `service_role`, `anon`) produced matches that are all structural DDL — not credential values:

- **Type/enum names**: `auth.one_time_token_type`, `confirmation_token`, `reauthentication_token`, `recovery_token`, `email_change_token_*`, `phone_change_token` — Supabase auth schema enum values.
- **PostgreSQL role names**: `anon`, `authenticated`, `service_role` — standard Supabase roles referenced in GRANT statements.
- **Column names**: `tokens`, `invite_token`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `generation_tokens` — column definitions, not values.
- **Function signatures**: `pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)` — function return type declaration.
- **Code comments**: `-- Password signups carry the intended role in app_metadata` — inline SQL comment, no credential.

None of these constitute sensitive data. All are schema structure.

---

## Conclusion

**Both artifacts are safe to distribute as schema-only handoff material.**  
No credentials, connection strings, data rows, or high-entropy secrets were found.  
Integrity checksums are recorded in `SHA256SUMS.txt`.
