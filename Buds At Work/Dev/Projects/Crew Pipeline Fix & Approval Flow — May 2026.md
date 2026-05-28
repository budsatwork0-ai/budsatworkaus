# Crew Pipeline Fix & Approval Flow — May 2026

**Date:** 2026-05-01
**Status:** Implemented
**Scope:** Fixed crew pipeline failing to load; built admin approval flow for crew onboarding

---

## Why This Was Done

Two issues were addressed in this session:

1. **Pipeline wouldn't load** — `employees` table was missing three columns (`default_role`, `employment_type`, `roster_active`) added by migration `027_crew_pipeline_staff_setup.sql`. The migration was never applied to the production Supabase database, causing the pipeline API to return a 500 on every load.

2. **No visible approval path** — Once a crew member completed all onboarding, the admin saw "Waiting — Awaiting final approval" in the pipeline but no button to actually approve them. The "Convert to Staff" button was gated behind `stage === 'ready'`, so the admin had to manually advance pipeline stages before the approve action appeared. There was also no way to approve from the documents review page.

---

## Changes

### 1. Apply missing migration to production

**Action:** Applied `027_crew_pipeline_staff_setup.sql` via Supabase MCP.

Added to `employees` table:
- `default_role text`
- `employment_type text NOT NULL DEFAULT 'casual'` (+ CHECK constraint)
- `roster_active boolean NOT NULL DEFAULT true`

All 4 existing employee rows defaulted cleanly.

---

### 2. Fix `canConvertToStaff` stage gate

**File:** `src/app/api/crew/pipeline/route.ts`

**Before:**
```ts
canConvertToStaff: stage === 'ready' && (!employee || !employee.crew_access_approved),
```

**After:**
```ts
canConvertToStaff: !employee?.crew_access_approved && (stage === 'ready' || Boolean(onboarding?.awaitingApproval)),
isApprovalAction: Boolean(employee && !employee.crew_access_approved),
```

`awaitingApproval` is already computed in `buildEmployeeOnboardingSnapshot` as `onboardingComplete && !crewAccessApproved`. This means the approve button now surfaces as soon as onboarding is complete, without the admin needing to advance pipeline stages first.

`isApprovalAction` distinguishes "approve existing employee" (has an account, completed onboarding) from "convert applicant to staff" (no account yet — sends email invite).

Also extended `canRequestDocs` to include rejected/expired docs, not just missing ones — so the admin can flag re-uploads after initial approval.

---

### 3. Differentiate "Approve" vs "Convert to Staff" in pipeline view

**File:** `src/app/(app)/dashboard/crew/CrewPipelineView.tsx`

- Added `isApprovalAction: boolean` to `PipelinePerson` type
- Button label: `isApprovalAction` → **"Approve crew access"** (solid green when all docs submitted), otherwise **"Convert to Staff"** (outlined green)
- Modal title and body text adapts: approval copy vs invite copy
- Modal save button: **"Approve crew access"** vs **"Save and continue"**

---

### 4. Approval CTA on admin documents page

**File:** `src/app/(app)/dashboard/crew/[employeeId]/documents/page.tsx`

- Added `crew_access_approved` and `onboarding_complete` to the local `Employee` type (already returned by the API)
- Added `awaitingApproval` to the local `OnboardingSnapshot` type
- Added `approving` state + `handleApprove()` — POSTs to `/api/crew/employees/${employeeId}/approve` with empty body, updates local state on success
- **"Ready for approval" banner**: green strip shown when `!crew_access_approved && onboarding.awaitingApproval` — shows "Approve crew access" button
- **"Crew access approved" strip**: shown after approval confirming the portal is unlocked

This gives a second approval path: admin reviews the docs, then approves from the same page without navigating back to the pipeline.

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/app/api/crew/pipeline/route.ts` | `canConvertToStaff` no longer stage-gated; `isApprovalAction` flag added; `canRequestDocs` extended for rejected/expired docs |
| `src/app/(app)/dashboard/crew/CrewPipelineView.tsx` | `isApprovalAction` type; differentiated button label/style; modal copy adapts |
| `src/app/(app)/dashboard/crew/[employeeId]/documents/page.tsx` | `approving` state; `handleApprove()`; approval banner + confirmed strip |
| Supabase (production) | Migration `027_crew_pipeline_staff_setup` applied |

---

## Verification

- [x] Pipeline loads — all employee rows returned with new columns
- [x] "Approve crew access" button visible on pipeline card immediately after onboarding complete (no stage advancing required)
- [x] Button is solid green when all required docs submitted, outlined green otherwise
- [x] Modal shows "Approve crew access" title and appropriate copy when `isApprovalAction`
- [x] Documents page shows green "Ready for approval" banner for pending employees
- [x] Documents page shows "Crew access approved" confirmation after approving
- [x] TypeScript: `npx tsc --noEmit` passes clean
- [x] Standalone employees (no applicant record) also show `isApprovalAction = true` correctly
