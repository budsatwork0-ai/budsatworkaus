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
→ POST /api/quotes/[id]/checkout → Stripe session
→ Stripe webhook → booking confirmed
```

## Related Systems

- [[WizardState]]
- [[Pricing Engine]]
- [[Mission Control]]
- [[Bud Core Runtime]]
- [[createServiceClient]]
- [[getAuthUser]]
- [[Quote Flow]]
- [[Stripe Checkout]]
- [[Email Triggers]]

## Graphify queries
```bash
graphify query "quote pipeline checkout stripe webhook"
graphify path "ServicesPageContent()" "quotes/route.ts"
graphify explain "quotes/route.ts"
```
