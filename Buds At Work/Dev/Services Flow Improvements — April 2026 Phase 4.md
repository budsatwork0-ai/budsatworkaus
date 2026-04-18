# Services Flow Improvements — April 2026 Phase 4

**Date:** 2026-04-18
**Status:** Implemented
**Scope:** Authenticated Step 3 contact flow hardening, portal profile API, portal UX polish, register phone support

**Related:** [[Quote Flow]] · [[Services Flow Improvements — April 2026 Phase 3]] · [[Client Portal]]

---

## Why This Was Done

After Phase 3 shipped the email loop (quote received ✓ confirmed working in prod), two trust-breaking issues remained in the authenticated quote flow:

1. Step 3 showed "We've filled this from your account" but phone was still blank with a required validation error visible on load — contradictory state that undermined account awareness.
2. Profile save on quote submission was fire-and-forget; silent failures meant phone/address updates could be dropped without any indication.

Additionally, the portal lacked a customer profile API, the rebook links omitted `scope`, and subscription cards had no "Book Again" CTA.

---

## Changes by Layer

### Layer 1 — `/api/portal/profile` (new route)

**File:** `src/app/api/portal/profile/route.ts`

- **GET** — returns `full_name, email, phone, region, company_name, abn, default_address` from the `customers` row for the authenticated user (`user_id = auth.uid()`)
- **PUT** — updates allowed fields (email explicitly excluded); syncs `full_name` to `profiles` table if changed; trims all string values

---

### Layer 2 — Step 3 authenticated contact flow (`services/page.tsx`)

#### Problem
Phone is not stored in `user_metadata`, so it only arrives via the `/api/portal/profile` fetch (~300–500ms after mount). Before this fix, the autofocus effect fired at 150ms and could focus the empty phone field. Any subsequent blur (scroll, click elsewhere) called `touchField('phone')` which showed the required error — even though phone was about to be filled. The "We've filled this from your account" banner appeared simultaneously, creating contradictory UI.

#### Fix — `profileHydrated` state

New `useState(false)` set to `true` once the profile fetch settles (success **or** failure). Gates three behaviours:

| Behaviour | Before | After |
|-----------|--------|-------|
| Autofocus | Fires at 150ms regardless | Waits until `profileHydrated` for auth users |
| Inline required errors | Show on blur at any time | Suppressed for auth users until `profileHydrated` |
| Account banner | Always shows "We've filled this" | Three states (see below) |

#### Account banner — three states

| State | Copy |
|-------|------|
| Loading (`!profileHydrated`) | "Loading your details…" (slate-400) |
| All filled (`profileHydrated && phone.trim()`) | "✓ We've filled this from your account — edit below to change" (green) |
| Phone missing (`profileHydrated && !phone.trim()`) | "We filled what we could from your account — add your phone to continue." (amber) |

#### Profile save — awaited

The fire-and-forget PUT to `/api/portal/profile` on submission is now `await`ed inside a `try/catch`. The profile is reliably saved before `window.location.href` redirects. Failures log to console but do not block checkout.

---

### Layer 3 — Register route phone support (`/api/auth/register/route.ts`)

- Body type extended with optional `phone?: string`
- `customers` row changed from `insert` to `upsert` (conflict on `user_id`) — handles race with any DB trigger that may pre-insert the row
- Phone persisted to `customers` on registration if provided

---

### Layer 4 — Portal UX polish

#### Orders page — rebook with scope (`portal/orders/page.tsx`)
Rebook link now passes `scope` query param so the wizard lands with the correct scope pre-selected:
```
/services?rebook=cleaning&context=residential&scope=2bed-1bath
```

#### Subscriptions page — "Book Again" button (`portal/subscriptions/page.tsx`)
Added a "Book Again" `<Link>` button to each active subscription card, matching the pattern from orders. Passes `service_type`, `context`, and `scope`. Actions row uses `flex-wrap` to handle the extra button cleanly.

---

## Email Flow — Confirmed Working

- **Quote received** email fired correctly in production on first live quote submission ✓

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/app/api/portal/profile/route.ts` | **NEW** — customer profile GET/PUT API |
| `src/app/(public)/services/page.tsx` | `profileHydrated` state, hydration gating, banner fix, awaited profile save |
| `src/app/api/auth/register/route.ts` | Optional phone on register; upsert instead of insert |
| `src/app/(app)/portal/orders/page.tsx` | Rebook link passes `scope` param |
| `src/app/(app)/portal/subscriptions/page.tsx` | "Book Again" button; `flex-wrap` on actions row |

---

## Verification

- [ ] Auth user with phone in DB → Step 3 loads → brief "Loading…" → all fields filled → green banner — no errors visible before any interaction
- [ ] Auth user without phone in DB → amber banner copy — phone field empty, no error until blur
- [ ] Unauthenticated user → validation errors still show on blur (unaffected)
- [ ] Submit quote with "Save these details" checked → check network tab: profile PUT completes before redirect
- [ ] Portal orders page → "Rebook" on a completed order → lands on `/services` with scope pre-selected
- [ ] Portal subscriptions page → "Book Again" button visible on active/paused subscriptions
