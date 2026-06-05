# quote-triage agent

## Empty-output detection

All nominally-successful runs pass through `handleQuoteTriageCompletion` before
being marked done. If the output is `null`, `undefined`, or an empty object/array/string,
the run is reclassified with reason `EMPTY_OUTPUT` and a row is inserted into the
`dead_letter_queue` Supabase table.

### dead_letter_queue schema (run once)

```sql
create table if not exists public.dead_letter_queue (
  id            bigint generated always as identity primary key,
  run_id        text        not null,
  agent_name    text        not null,
  failure_reason text       not null,
  original_output jsonb,
  failed_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
```

### Shared utility

`isEmpty(output)` lives in `src/agents/shared/is-empty-output.ts` and can be
imported by any other agent that needs the same guard.
