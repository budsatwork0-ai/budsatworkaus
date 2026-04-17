# Engineering

> Tech stack, system health, deployments, incidents, and dev practices for Buds At Work.

**Dashboard entry:** `/dashboard/audit-log`  
**Domain card shows:** "System healthy" · Links to audit log

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | TypeScript, `src/` layout |
| Hosting | Vercel | Auto-deploy from main branch |
| Database | Supabase (PostgreSQL) | RLS enabled |
| Payments | Stripe | AUD, auto payment methods |
| Email | Resend | `hello@budsatwork.com` |
| Auth | Supabase Auth | Session management, role-based |
| Animations | Framer Motion | Dashboard transitions |
| Styling | Tailwind CSS | `brand` theme tokens |
| CAPTCHA | Cloudflare Turnstile | Services wizard |

---

## Environment Variables (Required)

| Key | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (server only) |
| `STRIPE_SECRET_KEY` | Vercel env (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel env |
| `STRIPE_WEBHOOK_SECRET` | Vercel env (server only) |
| `RESEND_API_KEY` | Vercel env (server only) |
| `TURNSTILE_SECRET_KEY` | Vercel env (server only) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel env |

---

## Key File Map

| Feature | File |
|---|---|
| Dashboard home | `src/app/(app)/dashboard/page.tsx` |
| Dashboard layout + sidebar | `src/app/(app)/dashboard/layout.tsx` |
| Domain Command Panel (new) | `src/app/(app)/dashboard/components/DomainCommandPanel.tsx` |
| Quick actions | `src/app/(app)/dashboard/components/QuickActions.tsx` |
| Dashboard data hook | `src/app/(app)/dashboard/hooks/useDashboardData.ts` |
| Dashboard API | `src/app/api/dashboard/route.ts` |
| Stripe webhooks | `src/app/api/webhooks/stripe/route.ts` |
| Quote API | `src/app/api/quotes/route.ts` |
| Email templates | `src/lib/email/templates.ts` |
| Pricing engine | `src/app/(public)/services/lib/pricing/engine.ts` |
| Supabase client (browser) | `src/lib/supabase/client.ts` |

---

## Deployment Process

1. Commit to `main` branch → Vercel auto-deploys
2. Check Vercel dashboard for build success
3. Test on production URL before sharing with crew
4. Monitor `/dashboard/audit-log` for errors post-deploy

**Stripe CLI (local testing):**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

**Test card:** `4242 4242 4242 4242` (any future expiry, any CVC)

---

## Incident Response

If something breaks in production:
1. Check Vercel function logs (Vercel dashboard → Functions)
2. Check Supabase logs (Supabase dashboard → Logs)
3. Check Resend dashboard (failed email sends)
4. Check Stripe webhook delivery (Stripe → Developers → Webhooks)
5. If data is corrupted: use Supabase audit_log to trace what happened
6. Roll back via Vercel (previous deployment → Promote to production)

---

## Tech Debt & Backlog

- [ ] Invoice creation form is mock (simulate only) — needs real Supabase insert
- [ ] Expense recording form is mock — needs real insert to `bills` table
- [ ] Schedule Job form is mock — needs to call `POST /api/orders`
- [ ] Goals targets are hardcoded ($15k revenue, 30 jobs) — make configurable in settings
- [ ] Dashboard cache TTL is 60s — consider server-sent events for real-time

---

## Automation Opportunities

- [ ] Automated Lighthouse CI on every deploy
- [ ] Uptime monitoring (UptimeRobot or Checkly)
- [ ] Error alerting: Sentry or LogSnag
- [ ] Database backup verification: weekly Supabase backup check
- [ ] Dependency update bot (Renovate or Dependabot)

---

## Related
- [[Admin]]
- [[Stripe Checkout]]
- [[Email Triggers]]
- [[Data & Analytics]]
- [[Services Flow Improvements — April 2026]]
