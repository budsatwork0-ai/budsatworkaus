# Operations

> Day-to-day service delivery — scheduling, dispatch, crew assignment, and job lifecycle.

**Dashboard entry:** Dispatch tab (press `2`) · Schedule tab (press `1`)  
**Quick action:** Schedule Job

---

## Daily Operations Flow

```
Quote submitted → Finalized by admin → Payment link sent → 
Customer pays → Booking Confirmed → Crew assigned → 
Day-before reminder → Service delivered → Google review CTA
```

---

## Morning Admin Checklist

- [ ] Open Dashboard → Schedule tab → review today's jobs
- [ ] Open Dispatch tab → confirm all jobs have crew assigned + address confirmed
- [ ] Check Supabase `orders` table — any stuck at `pending` status?
- [ ] Verify yesterday's completed jobs are marked `completed`
- [ ] Check Resend dashboard for any failed emails overnight
- [ ] Review notification bell — pending quotes or new applicants?

---

## Crew Assignment (Dispatch Tab)

1. Go to `/dashboard` → Dispatch tab
2. Find the confirmed order (status: `confirmed`)
3. Click assign → select crew member + scheduled date + time window
4. This fires the **Service Scheduled** email to the customer automatically
5. Crew sees the job in `/crew` portal

**Fields to confirm before assigning:**
- Service address (from quote notes — prefixed `Address:`)
- Any customer notes / access instructions
- Commercial vs residential context
- Scope (e.g., "3 Bedroom" or "Office Suite")

---

## Job Status Lifecycle

```
pending → confirmed → [in_progress] → completed
        ↘ failed (payment failed — reopen quote)
                              ↘ cancelled (full refund)
```

- **pending:** Payment received but no crew assigned
- **confirmed:** Crew assigned + scheduled date set
- **completed:** Job done — mark in dashboard
- **cancelled:** Triggered by full refund webhook

---

## Services Delivered

| Service | Key Operational Notes |
|---|---|
| Window cleaning | Ladders required? Confirm at booking. 2-storey = extra time. |
| Home cleaning | Access key/code? Confirm before assigning. |
| Yard care | Ride-on vs. push mower — confirm with crew. Waste disposal? |
| Dump runs | Truck required — confirm item types. Hazardous materials decline. |
| Car detailing | Location (customer home or drop-off)? Products needed? |
| Laundry & Sneakers | Drop-off or pickup? Turnaround time communicated? |

---

## Scheduling Rules

- No overbooking a crew member on same day/time
- Commercial jobs get 30-min setup buffer (scope often larger)
- Dump runs: allocate minimum 2 hours
- Crew assignment within Logan / South Brisbane radius only

---

## Automation Opportunities

- [ ] Auto-assign crew based on availability calendar
- [ ] Auto day-before reminder cron (currently manual)
- [ ] Auto-complete job after scheduled date + 24h if no cancellation flag
- [ ] SMS confirmation to customer at time of crew assignment

---

## Related
- [[Admin]]
- [[New Booking]]
- [[Email Triggers]]
- [[HR & Crew]]
- [[Automations Log]]
