# Stripe launch-readiness audit

Read every Stripe code path on the `main` branch as of today. Findings ranked by impact. Each item has a file:line and a one-line fix.

Files audited:
- `src/lib/stripe/server.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/quotes/[id]/checkout/route.ts`
- `src/app/api/orders/by-session/route.ts`

---

## P0 — fix before taking real money

### 1. `success_url`/`cancel_url` trust the request `Origin` header
`src/app/api/quotes/[id]/checkout/route.ts:138`

```ts
const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
```

`Origin` is request-controlled. An attacker who can trigger a checkout for their own quote can set `Origin: https://attacker.example` and Stripe will redirect the post-payment user to that URL — and that URL also gets serialised into Stripe's payment receipts and webhook responses.

**Fix:** flip the precedence — always prefer the env var; only fall back to the request origin in dev.

```ts
const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';
```

### 2. Stripe API version is unpinned
`src/lib/stripe/server.ts:13`

```ts
return new Stripe(key, { typescript: true });
```

Stripe defaults the API version to whatever your account is set to in the Dashboard. That bumps when you accept a Dashboard prompt. Webhook payload shapes can change between versions. You'll find out the day Stripe ships a breaking change.

**Fix:**

```ts
return new Stripe(key, { apiVersion: '2024-09-30.acacia', typescript: true });
```

(Whichever version you've been developing against — check `stripe.api_version` in the Dashboard.)

---

## P1 — high-impact reliability / billing risk

### 3. Idempotency race on `checkout.session.completed`
`src/app/api/webhooks/stripe/route.ts:130-168`

The "already confirmed?" check is a separate query from the update + payments insert:

```ts
const { data: currentOrder } = ...select('status').eq('id', resolvedOrderId).maybeSingle();
if (currentOrder?.status === 'confirmed') break;
await ...update({ status: 'confirmed' })...
await ...from('payments').insert(...)
```

Two concurrent webhook deliveries (Stripe retries on a 5xx + your `payment_intent.succeeded` backup handler at line 373) can both pass the check, both fall through. You get duplicate `payments` rows for the same charge.

**Fix:** make the update conditional on prior status, then check affected rows.

```ts
const { data: updated } = await client.from('orders')
  .update({ status: 'confirmed', stripe_payment_intent_id: pi })
  .eq('id', resolvedOrderId)
  .eq('status', 'pending')   // <-- gate
  .select('id');
if (!updated?.length) break;  // someone else won the race
```

Then add a unique index `payments(payment_reference, status)` so duplicate inserts fail at the DB even if app-level guards miss.

### 4. `payments` table has no uniqueness on `(payment_reference, status)`
Same root cause as #3, also affects the refund handler at `webhooks/stripe/route.ts:432-440`. Stripe can re-deliver `charge.refunded` and you'd insert two rows.

**Fix:** unique index, or `.upsert(..., { onConflict: 'payment_reference,status' })` like the payouts handler already does.

### 5. In-memory rate limit is meaningless on serverless
`src/app/api/checkout/route.ts:8-24`

```ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

Vercel cold-starts a fresh function instance per request batch. The map is empty for each new instance. There is effectively no rate limit. A bot can flood your `quotes` table.

**Fix:** Upstash Redis (`@upstash/ratelimit`), or a Supabase RPC that increments a counter with a TTL.

### 6. Disputes are only logged
`src/app/api/webhooks/stripe/route.ts:612-623`

`charge.dispute.created` writes an audit row and nothing else. No ops email, no order flag, no automatic evidence package. Stripe disputes have a fixed evidence-submission window (often 7 days). If you don't notice, you lose by default.

**Fix:** at minimum, fire a Resend email to ops with the dispute amount, charge ID, reason, and a link to the Stripe Dashboard.

### 7. No automated test for the webhook handler
There are no test files in the repo. The webhook handler is the most important code path you have and it's untested.

**Fix:** at least three tests using Stripe's fixture event payloads — happy-path `checkout.session.completed`, replay of the same event (assert no duplicate payment row), `payment_intent.payment_failed`.

### 8. `stripe_customer_id` write-back race
Two writers: the checkout route (`[id]/checkout/route.ts:152-170`) and the webhook (`webhooks/stripe/route.ts:218-229`). If two checkouts for the same email run before the first webhook lands, the second `customers.create` call makes a second Stripe Customer, and only one of the IDs gets persisted. The orphan exists in Stripe forever with payment methods attached to it.

**Fix:** make the customer-row update happen *only* in the checkout route (not the webhook), wrapped in a row-level lock or a `select for update`. The webhook should never need to back-fill.

---

## P2 — should fix soon, not a blocker

### 9. Webhook handler does sequential awaits, risks timeout
`src/app/api/webhooks/stripe/route.ts` — each `checkout.session.completed` does 5+ Supabase round-trips serially. Stripe times out after ~10s and retries (which makes #3 worse). On a slow DB day this snowballs.

**Fix:** queue the slow work, return 200 fast. Or `Promise.all` the independent updates.

### 10. `payment_intent.succeeded` backup handler doesn't update order status
`webhooks/stripe/route.ts:373-410` inserts the payment row but never sets `orders.status = 'confirmed'`. If `succeeded` arrives before `completed` (rare but unguaranteed delivery order), the order sits in `pending` indefinitely.

### 11. No `payment_intent.requires_action` handling
3DS / SCA challenges. AU consumer cards don't always trigger this, but when they do and the user abandons the challenge, the session expires and you fall into your existing `checkout.session.expired` path — so you're partly covered. Note for awareness.

### 12. Env-var validation is lazy
Both `STRIPE_SECRET_KEY` (`lib/stripe/server.ts:6`) and `STRIPE_WEBHOOK_SECRET` (`webhooks/stripe/route.ts:43`) are only checked on first use. In prod you find out on the first user checkout (500 to user) or first webhook (Stripe auto-disables the endpoint after 3 days of failures).

**Fix:** add `/api/health` that asserts both env vars + a Supabase ping. Hit it in your deploy pipeline.

### 13. No CSRF defence-in-depth on checkout POSTs
Auth gate in `quotes/[id]/checkout/route.ts:21-27` is the main protection, but an Origin/Referer check costs nothing.

### 14. Email comparison doesn't trim
`quotes/[id]/checkout/route.ts:46`. If a customer registered with `" jane@example.com"` (leading space, possible from a paste) the comparison silently fails.

### 15. Money stored as float, not integer cents
`amount * 100` and `Math.round` everywhere. `Math.round` saves you in practice, but float prices in the DB are a class of bug waiting to happen. Migrate to integer cents (or `numeric`) when convenient.

### 16. `payments.currency` not stored
You're hardcoded AUD everywhere, so this is fine for launch. Add the column when you internationalise.

### 17. Quote status state machine sprawls
`quotes/[id]/checkout/route.ts:53-58` quietly re-maps `approved`→`finalized` and `adjusted`→`in_review` for the gate, then writes `payment_pending`. Multiple status fields (`status`, `payment_status`, `paid_at`, `stripe_checkout_url`) all model overlapping things. Document the intended state machine, then collapse.

---

## Pre-launch checklist

These aren't code findings — they're operational checks. Worth running through manually the day of launch.

- [ ] `STRIPE_SECRET_KEY` is `sk_live_...` (not `sk_test_...`) in production env
- [ ] `STRIPE_WEBHOOK_SECRET` matches the **live-mode** endpoint, not test mode
- [ ] Webhook endpoint in Stripe Dashboard points at `https://<prod-domain>/api/webhooks/stripe` and is **enabled**
- [ ] Webhook is subscribed to: `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `payout.created`, `payout.paid`, `payout.failed`, `payout.canceled`, `payout.updated`, `payout.reconciliation_completed`
- [ ] `NEXT_PUBLIC_SITE_URL` is the production URL with no trailing slash
- [ ] NAB business account is the verified payout destination in Stripe
- [ ] Resend API key is set and `FROM_ADDRESS` resolves DKIM/SPF on your domain
- [ ] One end-to-end live test: $1 charge using your own card, confirm webhook fires, order appears as `confirmed`, payment row inserted, customer + ops emails arrive
- [ ] Refund the test $1 from the Dashboard, confirm `charge.refunded` fires, payment row inserted with status `refunded`
- [ ] Tail logs during the test — there should be zero `[webhook] Failed to ...` warnings

---

## Recommended fix order

If launch is imminent and time is tight: do **#1 (origin)**, **#2 (apiVersion)**, **#5 (rate limit)**, and run the pre-launch checklist. Everything else is a high-priority follow-up but not a hard blocker for accepting card payments — duplicate `payments` rows from #3/#4 are recoverable with a one-time SQL clean-up; the security and rate-limit items are not.
