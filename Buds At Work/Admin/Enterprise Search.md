# Enterprise Search

> Find anything across all Buds At Work systems instantly.

**Dashboard trigger:** Press `⌘K` anywhere on the dashboard  
**Domain card:** Click "Enterprise Search" → opens command palette

---

## What You Can Search

| Record Type | Search Fields | Dashboard Location |
|---|---|---|
| Customers | Name, email, phone | `/dashboard/customers` |
| Invoices / Receivables | Customer name, amount, status | Receivables tab |
| Bills / Payables | Supplier, category, amount | Payables tab |
| Jobs | Customer, address, service, status | Jobs tab |
| Quotes | ID, customer email, service | `/dashboard/quotes` |
| Orders | Order ID, customer, status | `/dashboard/orders` |
| Crew | Name, role, contact | `/dashboard/crew` |

---

## Command Palette (⌘K)

**File:** `src/components/CommandPalette.tsx`

Built into the dashboard layout — accessible from every page via `⌘K` (or `Ctrl+K`).

Currently supports:
- Search across receivables, payables, and jobs
- Quick create: New Order · New Subscription
- Tab navigation shortcuts

**Planned improvements:**
- [ ] Search quotes by customer email
- [ ] Search crew members by name
- [ ] Recent records section (last 5 viewed)
- [ ] Quick actions: "Send reminder to [customer]"

---

## Supabase Direct Search

For power searches not in the UI, use Supabase dashboard:

**Find a quote by customer email:**
```sql
SELECT * FROM quotes
WHERE customer_email ILIKE '%name@email.com%'
ORDER BY created_at DESC
LIMIT 10;
```

**Find all orders for a customer:**
```sql
SELECT o.*, q.customer_name, q.customer_email
FROM orders o
JOIN quotes q ON q.id = o.quote_id
WHERE q.customer_email ILIKE '%email%'
ORDER BY o.created_at DESC;
```

**Find payment by Stripe session ID:**
```sql
SELECT * FROM payments
WHERE stripe_session_id = 'cs_live_xxxxx';
```

**Find audit log for an order:**
```sql
SELECT * FROM audit_log
WHERE resource_id = 'order-uuid-here'
ORDER BY created_at DESC;
```

---

## Stripe Search

Go to Stripe dashboard → search bar:
- Paste customer email → finds all charges
- Paste `cs_` prefix → finds checkout session
- Paste `pi_` prefix → finds payment intent

---

## Resend Search

Go to Resend dashboard → Logs:
- Filter by `to:` email address → see all emails sent to a customer
- Filter by template type → see all booking confirmations
- Status filter: `bounced`, `failed` → find delivery issues

---

## Automation Opportunities

- [ ] Expand command palette to search quotes + crew
- [ ] Universal customer profile: single view of all orders, quotes, payments per email
- [ ] Recent records in command palette (localStorage cache)
- [ ] Global search API endpoint: `/api/search?q=term` → federated results

---

## Related
- [[Admin]]
- [[Data & Analytics]]
- [[Engineering]]
- [[Customer Support]]
