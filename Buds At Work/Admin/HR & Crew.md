# HR & Crew

> Crew recruitment, onboarding, scheduling, compliance, and performance for Buds At Work.

**Dashboard entry:** `/dashboard/crew` · `/dashboard/applicants`  
**Quick action:** Add Crew Member (sends onboarding invite)

---

## Crew Roles

| Role | Services They Deliver | Min Requirements |
|---|---|---|
| Cleaner | Home & commercial cleaning | Police check, own transport |
| Window Cleaner | Window cleaning (all heights) | Heights cert (2+ storey) |
| Yard Crew | Yard care, mowing, rubbish | Own tools or company tools? |
| Driver | Dump runs | Valid licence, phone |
| Detailer | Car detailing | Products training |
| Laundry/Sneakers | Laundry & sneaker care | Product knowledge |
| Supervisor | All services oversight | Experience + leadership |

---

## Applicant Pipeline

**Dashboard:** `/dashboard/applicants`

Stages:
```
intake → screening → interview → reference_check → onboarded → active
```

**Community roles (separate track):**
- Quality Partner — mystery shopper / QA reviewer
- Sponsor — local business partnership

**Daily check:** Open notification bell → "New applicants" alert → review `/dashboard/applicants`

---

## Onboarding Checklist (New Crew)

- [ ] Collect full legal name, DOB, ABN (if contractor) or TFN (if employed)
- [ ] Confirm service area (Logan / South Brisbane coverage?)
- [ ] Send induction link → `/dashboard/inductions`
- [ ] Complete Buds At Work induction modules
- [ ] Verify police check or working with children check (if applicable)
- [ ] Set up in crew portal → `/crew` (confirm login works)
- [ ] Assign first shadowing job with experienced crew member
- [ ] Confirm bank details for payment

---

## Crew Portal

**URL:** `/crew`  
Crew see their:
- Upcoming assigned jobs (date, time, address, service)
- Customer name + phone for day-of contact
- Any special instructions / notes

**Admin assigns jobs via:** `/dashboard` → Dispatch tab → assign crew

---

## Contractor vs Employee

Buds At Work currently operates with **contractors (ABN holders).**  
Key compliance notes:
- Must issue remittance/pay slips even for contractors
- Contractor must have their own ABN
- Super guarantee applies if contractor is "employee-like" under ATO rules — get accounting advice
- Public liability insurance: does the crew member have their own, or does Buds At Work cover?

---

## Performance & Quality

- Customer satisfaction: Google Review link sent in every Booking Confirmed email
- Quality issues → [[Customer Support]] escalation path
- Repeat quality complaints against crew member → internal review → offboard if unresolved
- Mystery shopper (Quality Partner program) — check applicant pipeline for QP applicants

---

## Automation Opportunities

- [ ] Auto-send induction link when crew member status changes to `onboarding`
- [ ] Weekly crew schedule email (Monday summary of week's jobs)
- [ ] Birthday/anniversary recognition automation
- [ ] Expiry reminder for police checks, licences (yearly)
- [ ] Auto-notify admin when crew has no jobs assigned in 7+ days

---

## Related
- [[Admin]]
- [[Operations]]
- [[Customer Support]]
- [[New Booking]]
