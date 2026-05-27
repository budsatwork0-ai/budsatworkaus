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

---

## NDIS Participant Workers

Buds At Work employs NDIS participants as crew members (supported employment). These workers have additional support needs that must be checked before assigning jobs to them.

### Support profile

Each NDIS participant crew member fills in a **Support Profile** at `/crew/support-profile` (Crew Hub → Support). It captures:

| Field | Purpose |
|---|---|
| Support window start/end | Hours during which their NDIS funding is active |
| Max shift duration (mins) | Longest shift they can safely work |
| Support mode | Independent / With Support Worker / Team Based |
| Transport | Own / Needs transport / Transport arranged |
| Support worker name + provider | If mode is "With Support Worker" |
| Physical capacity | Light / Moderate / Heavy |
| Preferred services | Which service types they want to work |
| Customer-facing ok | Whether they're comfortable with direct customer contact |
| Can work after funded hours | Whether they'll work outside their funded support window |
| Emergency contact | |

### Job matching workflow

1. Go to **Dashboard → NDIS → Job Matching**
2. Select a confirmed job → click **Match participants**
3. Set the job's support requirements (intensity, transport needed, times, etc.)
4. Click **Save & Find Matches** — the system scores all active employees against the requirements
5. Review the ranked list with match scores (0–100) and any safety flags
6. Select the participants who should receive the job
7. Click **Publish job** — job appears immediately in their Find Jobs page

### Safety flags

The matching engine raises flags before publishing:

| Flag | Severity | Action required |
|---|---|---|
| Outside support window | Warning | Informational — admin can still publish |
| Cannot work after funded hours | **Blocker** | Must enter a documented override reason to proceed |
| Shift exceeds max duration | Warning | Consider splitting the shift |
| Transport not available | Warning | Arrange transport before publishing |
| No support worker assigned | Warning | Assign a support worker in their profile |
| Physical intensity too high | Warning | Consider a different participant |

### What participants see

Published jobs appear in **Crew Hub → Find Jobs** with:
- An "NDIS matched" badge
- Match score and grade (Strong / Good / Partial / Poor)
- Safety flag badges
- Location suburb only (full address is withheld)
- Support requirements (mode, transport, time window, estimated duration)

Accept/Decline flow is the same as for any job.

**Full technical details:** [[NDIS Participant Matching — May 2026]]

---

## Related
- [[Admin]]
- [[Operations]]
- [[Customer Support]]
- [[New Booking]]
