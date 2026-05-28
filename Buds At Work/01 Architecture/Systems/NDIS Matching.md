---
tags: [system, ndis, crew, matching, scoring]
---

# NDIS Matching

## Purpose
Worker coordination layer for NDIS participants. Crew members who are NDIS participants get support profiles; admins match them to jobs using a rule-based scoring algorithm.

## Source files
- `src/lib/services-core/ndis-pricing.ts` — **canonical NDIS pricing** (rates, helpers, types). Single source of truth.
- `src/app/(public)/services/lib/pricing/ndis.ts` — thin shim: `export * from '@/lib/services-core/ndis-pricing'`
- `src/types/ndis.ts` — all NDIS participant/matching types
- `src/lib/ndis/matching.ts` — rule-based scoring algorithm (100 pts across 8 criteria)
- Migration `036_ndis_matching.sql` — 6 new tables

## Database tables (from migration 036)
- `participant_support_profiles` — crew member NDIS profiles
- `job_requirements` — NDIS requirements per job
- `job_participant_matches` — scored match records
- `job_publications` — published NDIS job ads
- `shift_segments` — shift breakdown per participant
- `transport_arrangements` — transport logistics per match

## API routes
- `GET|POST /api/ndis/jobs/[orderId]/requirements` — job requirements
- `GET|POST /api/ndis/jobs/[orderId]/matches` — match scoring
- `GET|POST /api/ndis/jobs/[orderId]/publish` — publish to eligible participants
- `GET|PUT /api/crew/support-profile` — crew member's own profile

## Admin flow
Dashboard → NDIS → Job Matching → `/dashboard/ndis/match/[orderId]`

## Crew flow
`/crew/support-profile` → `/crew/jobs` (shows NDIS match badges)

## Claude should know
- Safety blockers (`severity='blocker'`) require an admin override note before the job can be published.
- Publishing creates both a `job_publications` record AND a `job_assignments` record — the existing crew portal works unchanged because it reads `job_assignments`.
- NDIS rates are legislated — see [[Known Unsafe Areas]] before changing pricing.
- The scoring algorithm is in `src/lib/ndis/matching.ts` and awards up to 100 points across 8 criteria.

## Related files/components
- `src/lib/services-core/ndis-pricing.ts` — canonical pricing (Batch 5)
- `src/app/(public)/services/lib/pricing/ndis.ts` — shim
- `src/types/ndis.ts`
- `src/lib/ndis/matching.ts`
- `src/app/(app)/dashboard/ndis/` — admin UI
- `src/app/(app)/crew/support-profile/` — crew UI
- `migrations/036_ndis_matching.sql`

## Related Systems
- [[Pricing Engine]] — NDIS rate overrides
- [[Agent Runtime]] — `ndis-compliance` and `ndis-plan-matcher` agents
- [[Mission Control]]
- [[createServiceClient]]
- [[../03 Active Refactors/Known Unsafe Areas|Known Unsafe Areas]]

## Graphify queries
```bash
graphify query "NDIS matching participant support profile"
graphify explain "matching.ts"
graphify path "matching.ts" "job_participant_matches"
```
