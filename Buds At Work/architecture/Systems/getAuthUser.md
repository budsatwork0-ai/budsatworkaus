---
tags: [system, auth, supabase, god-node]
---

# getAuthUser

## Purpose
Single auth helper (85 connections) that extracts the authenticated Supabase user from the current request. Called at the top of every protected API route and server component to gate access.

## Source file
`src/lib/auth.ts` L6

## Pattern
```ts
const user = await getAuthUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

## Why it's a god node
Every protected route depends on it. If the auth strategy changes (e.g. switching from Supabase Auth to another provider), this is the single file to update.

## Claude should know
- Always call `getAuthUser()` at the top of protected routes before any DB queries.
- Do not inline auth logic in route handlers — use this helper so auth changes propagate everywhere.
- If a route is unexpectedly returning 401, check that `getAuthUser()` is being called and that the session cookie is present.

## Related files/components
- `src/lib/auth.ts` L6

## Related Systems
- [[createServiceClient]]
- [[Quote Pipeline]]
- [[Mission Control]]
- [[Agent Runtime]]

## Graphify queries
```bash
graphify explain "getAuthUser"
graphify query "auth user session protected route"
```
