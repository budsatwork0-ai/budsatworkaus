---
tags: [system, payments, stripe, pipeline]
---

# Quote Pipeline

## Purpose
The server-side flow from wizard submission to payment. A quote is saved first, then converted to a Stripe checkout session when the customer is ready to pay.

## Source files
- `src/app/api/quotes/route.ts` — `POST /api/quotes` saves quote to Supabase, fires "quote received" email
- `src/app/api/quotes/[id]/checkout/route.ts` — creates Stripe checkout session, fires "quote finalised" email
- `src/app/api/webhooks/stripe/route.ts` — `checkout.session.completed` marks quote paid, fires "booking confirmed" email

## Flow summary
```
WizardState → POST /api/quotes → quote saved
    → POST /api/quotes/[id]/checkout → Stripe session created
    → Stripe webhook → booking confirmed, order updated
```

## Quote status lifecycle
`draft` → `submitted` → `finalized` → `payment_pending` → `paid`  
On failure/expiry: → `finalized` (reset for retry)

## Claude should know
- Three transactional emails fire across this pipeline — do not remove email calls when editing these routes.
- The webhook handler also handles `payment_intent.succeeded` as a backup to `checkout.session.completed`.
- On checkout expiry (`checkout.session.expired`), quote resets to `finalized` so the admin can re-send payment link.
- `automatic_payment_methods: { enabled: true }` means Apple Pay, Google Pay, and Link are all active automatically.

## Related files/components
- `src/app/api/quotes/route.ts`
- `src/app/api/quotes/[id]/checkout/route.ts`
- `src/app/api/webhooks/stripe/route.ts`

## Related Systems
- [[WizardState]]
- [[Pricing Engine]]
- [[Mission Control]]
- [[Bud Core Runtime]]
- [[createServiceClient]]
- [[getAuthUser]]
- [[Stripe Integration]]
- [[Email System]]
- [[Processes/Quote Flow|Quote Flow]]
- [[Processes/Stripe Checkout|Stripe Checkout]]

## Graphify queries
```bash
graphify query "quote pipeline checkout stripe webhook"
graphify path "ServicesPageContent()" "quotes/route.ts"
graphify explain "quotes/route.ts"
```
