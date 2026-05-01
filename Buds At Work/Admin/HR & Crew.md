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

## Crew Pipeline

**Dashboard:** `/dashboard/crew`

### Pipeline stages
```
intake → verify → paperwork → induct → ready
```

| Stage | What happens |
|---|---|
| Intake | Application received, basic details captured |
| Verify | Identity / eligibility check |
| Paperwork | Contracts, tax forms, compliance docs requested |
| Induct | Induction scheduled or in progress |
| Ready | Onboarding complete, awaiting admin approval |

### Approval workflow

Once a crew member completes all onboarding sections and uploads their required documents, their status changes to **"Waiting — Awaiting final approval"** in the pipeline.

**To approve (two paths):**
1. **Pipeline card** → the "Approve crew access" button appears on their card (solid green when all docs are submitted). Confirm role, employment type, and hourly rate, then approve.
2. **Documents page** → `/dashboard/crew/{employeeId}/documents` shows a green "Ready for approval" banner at the top. Click "Approve crew access" to approve directly after reviewing their docs.

Approving sets `crew_access_approved = true` and `status = active`, unlocking the full crew portal immediately.

### Requesting documents after approval

Even after approving crew access, you can request re-uploads:
- Go to `/dashboard/crew/{employeeId}/documents`
- Set a document status to **Rejected** and add a note explaining what's needed
- The crew member will see the rejection on their documents page and can re-upload
- The "Request docs" button on the pipeline card also generates a pre-filled email

**Community roles (separate track):**
- Quality Partner — mystery shopper / QA reviewer
- Sponsor — local business partnership

---

## Onboarding Checklist (New Crew)

Crew complete onboarding through their portal at `/crew/onboarding`. The Documents step collects everything below automatically — no manual chasing required.

### Compliance documents (required to be rostered)

Crew upload files directly in-app. Files go to a **private Supabase Storage bucket** — never public, only accessible by admin.

| Document | Notes |
|---|---|
| Working With Children Check (WWCC) | All crew |
| National Police Check | All crew |
| First Aid Certificate | All crew |
| CPR Certificate | All crew |
| NDIS Worker Orientation Module | All crew |
| NDIS Worker Screening Check | NDIS workers only (set in their profile) |

**Admin review:** `/dashboard/crew/{employeeId}/documents`  
Each doc shows status (Pending / Approved / Rejected / Expired), expiry date, and a notes field. Admin sets the status after reviewing the uploaded file.

### Supporting documents (optional, role-based)

Driver's licence, vehicle registration, vehicle insurance, ABN, public liability insurance, resume, references — crew upload if relevant. These don't block onboarding completion.

### Employment & payroll details

Crew enter these in the Employment details section of `/crew/onboarding/documents`. All data is stored in `employee_payroll_details` in Supabase, protected by Row Level Security — employees see only their own row, admins have full access.

| Field | Notes |
|---|---|
| Employment type | Casual, contractor, volunteer, trainee, part-time, full-time |
| Right to work | Citizen, permanent resident, work visa (+ visa subclass & expiry) |
| Tax File Number (TFN) | Stored encrypted-at-rest; displayed masked in admin view |
| Bank account | BSB, account number, account name, institution |
| Superannuation | Fund name, USI, member number |

Admin views payroll details at `/dashboard/crew/{employeeId}/documents` → Employment & payroll section. TFN requires clicking "Show" to reveal.

---

## Crew Portal

**URL:** `/crew`  
Crew see their:
- Upcoming assigned jobs (date, time, address, service)
- Customer name + phone for day-of contact
- Any special instructions / notes
- Compliance documents and employment details (`/crew/documents` and `/crew/onboarding/documents`)

**Admin assigns jobs via:** `/dashboard` → Dispatch tab → assign crew

---

## Document Expiry & Alerts

- Crew document page shows amber warning ring when a document expires within 30 days
- Admin pipeline view (`/dashboard/crew`) shows amber chips with the names of missing required docs for each crew member
- Expiry reminders automation: to be built

---

## Contractor vs Employee

Buds At Work supports casual, contractor, volunteer, trainee, part-time, and full-time employment types — set per crew member in their payroll details.

Key compliance notes:
- Must issue remittance/pay slips even for contractors
- Contractor must have their own ABN
- Super guarantee applies if contractor is "employee-like" under ATO rules — get accounting advice
- Right-to-work is confirmed and stored in Supabase (citizen / PR / work visa / other)

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
- [ ] Expiry reminder for compliance docs (WWCC, police check, first aid, CPR) — 30 days before
- [ ] Auto-notify admin when crew has no jobs assigned in 7+ days

---

## Related
- [[Admin]]
- [[Operations]]
- [[Customer Support]]
- [[New Booking]]
