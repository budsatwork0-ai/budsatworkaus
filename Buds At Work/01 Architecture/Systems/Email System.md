---
tags: [system, email, resend, transactional]
---

# Email System

## Purpose
Transactional email delivery via Resend. Three emails fire automatically across the quote-to-booking lifecycle. All are server-side only — no client-side email calls.

## Source files
- `src/lib/email/resend.ts` — Resend client singleton
- `src/lib/email/templates.ts` — HTML templates for all emails

## Emails and triggers

| Email | Trigger | Route |
|---|---|---|
| Quote received | Customer submits wizard | `POST /api/quotes` |
| Quote finalised | Admin sets payment link | `POST /api/quotes/[id]/checkout` |
| Booking confirmed | Stripe webhook fires | `checkout.session.completed` |

## Configuration
- FROM: `Buds At Work <admin@budsatwork.com>`
- Domain: `budsatwork.com` — **Verified** in Resend (Tokyo / ap-northeast-1)
- Env var: `RESEND_API_KEY` — set in `.env.local` and Vercel

## Claude should know
- All three email calls are in separate route files — if you edit a route, confirm the email call is still present.
- The Resend client is a singleton in `resend.ts` — do not instantiate it again in route files.
- `budsatwork.com` is already verified in Resend — domain verification is not needed again.
- Email templates are HTML strings in `templates.ts` — test render in a browser before deploying changes.

## Related files/components
- `src/lib/email/resend.ts`
- `src/lib/email/templates.ts`

## Related Systems
- [[Quote Pipeline]]
- [[06 Operations/Processes/Email Triggers|Email Triggers]]
- [[06 Operations/Processes/Stripe Checkout|Stripe Checkout]]

## Graphify queries
```bash
graphify query "email resend transactional template"
graphify explain "resend.ts"
graphify path "resend.ts" "quotes/route.ts"
```
