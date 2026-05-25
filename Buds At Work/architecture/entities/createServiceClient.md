# createServiceClient

## Purpose
The most-imported function in the entire codebase (218 connections). Creates a server-side Supabase client with the service role key, bypassing row-level security. Used in every API route that needs unrestricted DB access.

## Source file
`src/lib/supabase/server.ts` L6

`createServiceClientSafe()` is the wrapped variant (198 connections) — catches errors and returns `null` instead of throwing. Prefer it in routes where a missing client should degrade gracefully rather than crash.

## Why it's a god node
Every API route imports it. If this function's signature changes, every route breaks simultaneously.

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
