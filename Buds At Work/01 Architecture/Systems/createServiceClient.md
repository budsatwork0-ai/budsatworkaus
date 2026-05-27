---
tags: [system, supabase, infrastructure, god-node]
---

# createServiceClient

## Purpose
The most-imported function in the entire codebase (218 connections). Creates a server-side Supabase client with the service role key, bypassing row-level security. Used in every API route that needs unrestricted DB access.

## Source file
`src/lib/supabase/server.ts` L6

`createServiceClientSafe()` is the wrapped variant (198 connections) — catches errors and returns `null` instead of throwing. Prefer it in routes where a missing client should degrade gracefully rather than crash.

## Why it's a god node
Every API route imports it. If this function's signature changes, every route breaks simultaneously.

## Claude should know
- **Use `createServiceClientSafe()`** in any route where you want graceful degradation (returns `null` on failure).
- **Use `createServiceClient()`** only when you need to guarantee the client or throw — e.g., critical write paths.
- This client bypasses Row Level Security. Never expose it to the client side.
- If you're adding a new API route, import from `src/lib/supabase/server.ts` — not a re-export path.

## Related files/components
- `src/lib/supabase/server.ts` L6

## Related Systems
- [[Quote Pipeline]]
- [[Agent Runtime]]
- [[Mission Control]]
- [[getAuthUser]]

## Graphify queries
```bash
graphify explain "createServiceClient"
graphify query "supabase server client service role"
```
