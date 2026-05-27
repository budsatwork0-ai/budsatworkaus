---
tags: [system, stripe, payments, webhooks]
---

# Stripe Integration

## Purpose
Handles all payment sessions and webhook events. Stripe is the single payment processor — no other payment provider is wired in.

## Source files
- `src/app/api/quotes/[id]/checkout/route.ts` — creates Stripe checkout session
- `src/app/api/webhooks/stripe/route.ts` — handles all Stripe webhook events

## Key configuration
- `automatic_payment_methods: { enabled: true }` — Apple Pay, Google Pay, and Link active automatically
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Webhook events handled
| Event | Action |
|---|---|
| `checkout.session.completed` | Mark quote paid, order confirmed, fire email |
| `payment_intent.succeeded` | Backup to session.completed |
| `payment_intent.payment_failed` | Order → `failed`, quote → `finalized` |
| `checkout.session.expired` | Quote → `finalized` (retry) |
| `charge.refunded` | Payment → `refunded`, order → `cancelled` |

## Claude should know
- Webhook events are delivered once — a bug here means lost payment confirmations. See [[Refactor Plans/Known Unsafe Areas|Known Unsafe Areas]].
- Always test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- Use test card `4242 4242 4242 4242` for success, `4000 0000 0000 0002` for decline.
- The `STRIPE_WEBHOOK_SECRET` in `.env.local` must match what the Stripe CLI gives you — they differ from the dashboard secret.

## Related files/components
- `src/app/api/quotes/[id]/checkout/route.ts`
- `src/app/api/webhooks/stripe/route.ts`

## Related Systems
- [[Quote Pipeline]]
- [[Email System]]
- [[Processes/Stripe Checkout|Stripe Checkout]]
- [[Automation/Checklist Template|Checklist Template]]
- [[Refactor Plans/Known Unsafe Areas|Known Unsafe Areas]]

## Graphify queries
```bash
graphify query "stripe checkout webhook payment"
graphify explain "webhooks/stripe/route.ts"
graphify path "checkout/route.ts" "webhooks/stripe/route.ts"
```
