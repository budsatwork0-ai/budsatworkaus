# Bud OS Design Audit & Record Experience Proposal
*2026-06-22 · Senior Product Design / UX Architecture Review*

---

## Reference Framework

### Reference A — Artifact Detail Page (The Standard to Match)
The Artifact detail page at `/dashboard/content/artifacts/[artifactId]` is the clearest, most professional page in Bud OS. What it does right:
- `WorkbenchHeader`: eyebrow → title → description — three-level hierarchy, instantly scannable
- 4-column `MetaCard` row: Type · Status · Score · Versions — structured metadata above the content
- `ArtifactRenderer`: full structured content body
- No modals. No state machines. One page, one record, one primary render path.

**This pattern must become the baseline for every important record in Bud OS.**

### Reference B — Post Templates (Extracted Principles)
From the uploaded `budsatwork-post-templates.html` — extracted as principles, not copied:

1. **Clear eyebrow → headline → subheading hierarchy** — three levels, not two
2. **Color carries meaning, not decoration** — every color used has a function
3. **Cards are self-contained** — each card answers a question on its own
4. **CTA is always findable** — primary action anchored, never buried in content
5. **Whitespace is structure** — generous padding creates grouping without borders
6. **Data density is intentional** — the mock quote breakdown (sqm, line items, price) shows that density and clarity are not opposites
7. **Monospace for identifiers** — slugs, codes, IDs use Courier/mono consistently
8. **Brand appears in accents, not backgrounds** — background surfaces are neutral; brand color marks the action or the signal

---

## Current Design Audit — Page by Page

### 1. Mission Control (`/dashboard/mission-control`)
**What works:**
- Open enquiries panel is genuinely operational — names, wait time, triage actions
- Business snapshot bar (MTD revenue, jobs today, pending enquiries) surfaces real signals
- Agent run history is useful for system oversight

**What doesn't work:**
- 15 parallel database queries on page load — the page tries to be everything simultaneously
- No information hierarchy: agent health, business health, approval queue, GitHub events, UX evolution, and quarantine all compete at the same visual weight
- "Dashboard theatre" risk — if metrics are empty, the page looks like placeholder content
- No record orientation — everything is aggregate counts or lists, nothing links to a first-class record

**Classification:** Keep as system operations layer. Strip empty/decorative widgets. Add clear section hierarchy: Business Snapshot → Active Signals → Agent Health.

---

### 2. Leads (`/dashboard/leads`)
**What works:**
- Exists as a standalone route
- `BudLeadsWorkspace` does data fetching

**What doesn't work:**
- Leads page is a one-liner: `return <BudLeadsWorkspace />`
- The workspace fetches via `useDashboardData('full')` — a catch-all client fetch
- No lead detail page exists. Leads are not first-class records.
- Every lead interaction happens in the list, not on a record
- No title, description, or eyebrow at the route level
- No status visibility, no timeline, no history per lead

**Classification:** Highest priority for redesign. A lead is the most time-sensitive business record in the system. It currently has no record page.

---

### 3. Quotes (`/dashboard/quotes`)
**What works:**
- Workspace tabs (Needs Review / Approved / Archive) match the operational mental model
- Quote cards show all key fields: name, service, price, status
- NDIS routing information is surfaced inline
- Cancellation modal has a required reason field — good operational discipline

**What doesn't work:**
- 1,139 lines of client component — all business logic, state machines, modals, and rendering in one file
- No quote detail page — everything happens in the list card
- Adjust modal and Cancel modal are minimal — they don't show the full quote record before action
- Metric cards at the top (Needs review / Approved / Payment pending / Archive) are counts with no links — they don't help you navigate
- `MetricCard` component uses coloured `px-3 py-1 text-sm` badge inside a card — unusual double-container pattern
- The Quotes page uses `max-w-7xl mx-auto py-8 px-4` — inconsistent with other pages that use `px-4 md:px-10 lg:px-12`

**Classification:** High priority. Quote is the business's second most time-sensitive record. Needs a detail page and better header structure.

---

### 4. Customers (`/dashboard/customers`)
**What works:**
- Partially adopted `WorkbenchHeader`, `WorkbenchStatGrid`, `WorkbenchTabs`, `WorkbenchQueue` — the best-structured non-artifact page in the system
- Focus queue surfaces actionable cleanup items
- Three tab modes (Directory / Recent / Incomplete) match operational needs

**What doesn't work:**
- Customer detail is a slide-over drawer — not a first-class record page
- The drawer contains: email · phone · region · address · customer since — 5 fields, no orders, no quotes, no job history, no timeline
- `WorkbenchHeader` title is "Manage customer relationships with clearer triage" — a description of the old page design, not the current page intent. It should be updated.
- The description field in the header explains what changed from a previous version — this belongs in a commit message, not a page header
- Table and mobile card views both exist but the mobile cards use a local `glass` string redeclaration rather than the shared import

**Classification:** Medium priority. Header copy needs cleanup. Customer detail needs a dedicated record page, not a drawer.

---

### 5. Jobs & Orders (`/dashboard/jobs`, `/dashboard/orders`)
**What exists:** Both routes exist but weren't reviewed in depth. Based on the pattern seen in quotes and customers, likely follows the same list-first, no-detail-page pattern.

**Classification:** Medium priority. Likely needs the same treatment as Quotes — a job detail page and better status visibility.

---

### 6. Fundraising (`/dashboard/fundraising`)
**What works:**
- All fundraising operations exist and are functional
- Progress bar, contribution breakdown, and Stripe backfill are operationally solid
- Impact stats editing is clean and minimal

**What doesn't work:**
- Single page with 5 views controlled by a `view` state machine (`list | form | stats | social | social-form`) — navigation via state, not routes
- Fundraising item detail is the `form` view — an edit form doubles as a record view
- No read-only record view for a fundraising item
- The list is a plain `<table>` with row actions — the most outdated pattern in the system
- Contributions are loaded inline in a `<tr>` expansion — table-in-table pattern makes scanning difficult
- Title: `<h1>Fundraising</h1>` — no eyebrow, no description

**Classification:** High priority. The fundraising record is a public-facing business object with real financial data. It needs a proper record page.

---

### 7. Story Intelligence (`/dashboard/content/story-intelligence`)
**What works:**
- Story Intelligence outputs are consumed cleanly by Campaign Factory
- Recommendations have score, why, supporting signals — good structured data

**What doesn't work:** Not reviewed at component level, but based on architecture, story opportunities are list-only with no dedicated record page.

**Classification:** Low priority for now — Campaign Factory consumes these as inputs. Record page can come when stories become a managed asset.

---

### 8. Campaign Factory (`/dashboard/content`)
**What works:**
- Goal → Story → Generate flow is clear and linear
- Workflow step progress indicators (Research / Strategy / Campaign) are good operational feedback
- Boundary card clearly states what the system does and doesn't do

**What doesn't work:**
- Recent Runs section shows `run.title || run.goal` — falls back gracefully but hints at missing data
- No individual run detail page

**Classification:** Medium priority. Campaign runs should become first-class records with a detail page after the artifact engine stabilises.

---

### 9. Artifact Detail (`/dashboard/content/artifacts/[artifactId]`)
**What works:** Everything. This is the reference standard.
- Eyebrow → Title → Description header
- 4-up metadata row
- Full structured content renderer
- Clean, professional, high signal-to-noise

**Classification:** Keep as reference. Use as the template for other record pages.

---

### 10. Content Library (`/dashboard/content/library`)
Not reviewed at component level but likely a searchable list without record pages.
**Classification:** Low priority.

---

### 11. NDIS (`/dashboard/ndis`)
Has specialist matching at `/dashboard/ndis/match/[orderId]` — a detail page exists. Reviewed separately.
**Classification:** Medium priority — matching flow is functional. Participant record page may be needed.

---

### 12. Finance (Expenses, Invoices, Payments, Reports)
Multiple finance pages exist. Based on pattern, likely list-first with no record pages.
**Classification:** Low priority — finance data is primarily read-only reporting.

---

## Design Principles Extracted

These seven principles should govern all record pages in Bud OS:

### P1 — Record Before List
Every important object in the system deserves a dedicated URL and a dedicated page. A list row is a navigation element. A record page is the destination.

### P2 — Three-Level Header, Always
Every record page must open with:
```
[EYEBROW — system context, 11px uppercase]
[TITLE — record name, 20-24px semibold]
[DESCRIPTION — one-line purpose statement, 14px muted]
```
Never collapse to two levels. Never skip the eyebrow.

### P3 — Metadata Before Content
The metadata row (Status · Type · Score · Owner · Date) must always appear before the main content body. This is scannable information that tells the user whether they need to read further.

### P4 — Actions Are Not Hidden
Primary actions must be visible in the page header, not buried in the content. Secondary actions live in the record body. Destructive actions require confirmation, not modals that replace the record view.

### P5 — Status Is Always Visible
Every record shows its current status in a chip at metadata level. Status must be the first thing visible after the title.

### P6 — Related Records Are Navigable
A quote links to a customer and an order. A lead links to a quote. A fundraising item links to contributions. These relationships must be navigable from the record page, not only discoverable through search.

### P7 — Timeline Is Always Present
Every record has a timeline. Created → Updated → Key state transitions. Even if only two events exist, they must be shown. Timeline is the audit trail.

---

## Design System Proposal

### Page Structure — All Record Pages

```
┌─────────────────────────────────────────┐
│ WORKBENCH HEADER                         │
│ ─────────────────────────────────────── │
│ Eyebrow (11px, uppercase, brand accent) │
│ Title (20px, slate-950, semibold)       │
│ Description (14px, slate-500)           │
│ Actions (top-right, primary + ghost)   │
├─────────────────────────────────────────┤
│ METADATA ROW (4-column grid)            │
│ Status │ Type │ Score/Value │ Date      │
├──────────────────────┬──────────────────┤
│ MAIN CONTENT (2/3)   │ CONTEXT (1/3)    │
│                      │                  │
│ Core record body     │ Related records  │
│ Key fields           │ Linked objects   │
│ Structured sections  │ Quick actions    │
│                      │ Timeline         │
└──────────────────────┴──────────────────┘
```

### Card Structure — MetaCard (already exists, standardise it)

```tsx
function MetaCard({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  // Eyebrow label + prominent value
  // Optional tone maps to background/text color
}
```

Current `MetaCard` in Artifact Detail is correct. The `MetricCard` in Quotes page is a different, inconsistent implementation. Consolidate to one.

### Section Structure — All Content Sections

```tsx
function RecordSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
```

This matches the pattern already used in `CampaignFactoryClient`. Standardise across the dashboard.

### Timeline Pattern — All Records

```tsx
type TimelineEvent = {
  label: string;           // "Quote submitted"
  timestamp: string;       // ISO date
  actor?: string;          // "Customer" | "Admin" | "Agent"
  note?: string;           // Optional detail
};

function RecordTimeline({ events }: { events: TimelineEvent[] }) {
  // Vertical timeline, newest first
  // Each event: dot + label + timestamp
  // Actor shown as secondary text
}
```

### Action Pattern — Contextual to Status

```
Primary action: 1 button, always visible, status-appropriate
Secondary actions: text links or ghost buttons
Destructive actions: red ghost button, requires confirmation step (not modal)
```

Never show more than 4 action buttons simultaneously. If more actions exist, group secondary ones under a "More actions" disclosure.

### Related Records Pattern

```tsx
function RelatedRecord({ label, title, href, status }: RelatedRecordProps) {
  // Small card: label chip + title + status chip + arrow link
  // No modals — always links to the related record's page
}
```

---

## Record Experience Mapping

### Lead Record

```
Eyebrow: "Enquiry"
Title: Customer name + service type
Description: Source channel + time since received

Metadata:
  Status: Awaiting Response | Replied | Converted | Closed
  Service: Cleaning / Yard / Window / etc.
  Source: Facebook / Website / Referral
  Received: [timestamp]

Main Content:
  Contact details block
  Message / enquiry content
  Service type + details

Context:
  Related Quote (if converted)
  Reply history
  Timeline: Received → Replied → Converted

Actions:
  [Reply] [Convert to Quote] [Mark Closed]
```

### Quote Record

```
Eyebrow: "Quote"
Title: Customer name + service type
Description: Submitted [date] · Effective total [price]

Metadata:
  Status: Submitted | In Review | Approved | Payment Pending | Paid | Denied | Cancelled
  Service: [type]
  Context: Residential / NDIS
  Total: $[effective amount]

Main Content:
  Customer details
  Service scope
  Pricing breakdown (submitted → reviewed total)
  NDIS details if applicable
  Notes

Context:
  Related Customer (link)
  Related Order (link, if converted)
  Timeline: Submitted → Reviewed → Approved → Paid

Actions:
  [Approve & Send Payment] or [Send Payment Link] (primary)
  [Adjust Price] [Deny] [Cancel] (secondary)
```

### Customer Record

```
Eyebrow: "Customer"
Title: Full name
Description: Region + joined date

Metadata:
  Status: Active | Incomplete | Inactive
  Region: [region]
  Contact: Email / Phone present or missing
  Member Since: [date]

Main Content:
  Contact information
  Address
  Profile completeness score

Context:
  Recent Quotes (last 3, linked)
  Recent Orders (last 3, linked)
  Timeline: Joined → First quote → First order → Last activity

Actions:
  [Message] [Create Quote] (primary)
  [Edit] (secondary)
```

### Job / Order Record

```
Eyebrow: "Job"
Title: Customer name + service type + date
Description: Address + crew assignment

Metadata:
  Status: Confirmed | In Progress | Completed | Cancelled
  Service: [type]
  Scheduled: [date]
  Crew: [assigned member]

Main Content:
  Service details + scope
  Address + map link
  Pricing

Context:
  Related Customer (link)
  Related Quote (link)
  Crew assignment details
  Timeline: Quoted → Confirmed → Completed

Actions:
  [Mark Complete] (primary)
  [Reschedule] [Reassign Crew] (secondary)
```

### Fundraising Item Record

```
Eyebrow: "Fundraising Item"
Title: Item title
Description: Category + short reason

Metadata:
  Status: Draft | Live | Funded | Archived
  Goal: $[amount]
  Raised: $[amount] ([pct]%)
  Contributions: [count]

Main Content:
  Description (who it helps, employment impact)
  Progress bar + breakdown (gross / fees / net)
  Payment link

Context:
  Contribution history (list, linked)
  Stripe payment link status
  Timeline: Created → Live → First contribution → Funded

Actions:
  [Go Live] (primary, if Draft)
  [Generate Payment Link] [Edit] (secondary)
```

### Campaign Run Record

```
Eyebrow: "Campaign Factory Run"
Title: Story · Goal
Description: Status + current step

Metadata:
  Status: Collecting Signals | Researching | Strategizing | Artifact Review | Approved
  Goal: [campaign goal]
  Story: [recommended story]
  Created: [date]

Main Content:
  Research Artifact (linked)
  Strategy Artifact (linked)
  Campaign Artifact (linked, primary)

Context:
  Selected Story Intelligence recommendation
  Applied learning guidance
  Timeline: Created → Research → Strategy → Campaign → Approved

Actions:
  [Approve Campaign Artifact] (primary, if ready)
```

### Artifact Record (reference — already implemented)

Already correct. No changes needed.

---

## Priority Ranking

### Highest Priority — Build Now

| Page | Reason |
|------|--------|
| **Lead Detail** | Most time-sensitive record. No detail page exists. Lead → Quote conversion is the primary revenue path. |
| **Quote Detail** | Second most time-sensitive. 1,139-line client component has no record page. Payment flow needs a clear record context. |
| **Fundraising Item Detail** | Public-facing financial record with no read-only view. Currently uses an edit form as a detail view. |

### Medium Priority — Next Sprint

| Page | Reason |
|------|--------|
| **Customer Detail** | Currently a slide-over drawer with 5 fields. Needs a full record page with orders, quotes, and timeline. |
| **Job / Order Detail** | Assumed list-only pattern. Jobs are the operational output of the business — they deserve record pages. |
| **Campaign Run Detail** | Campaign Factory runs are now stored as records (migration applied). Detail page needed. |

### Low Priority — Defer

| Page | Reason |
|------|--------|
| Mission Control | Operates correctly as a system dashboard. Refinements are additive, not structural. |
| Story Intelligence | Stories are consumed by Campaign Factory. Record pages can come with Batch 5+ of content system. |
| Content Library | Read-only reference. Record pages are a nice-to-have. |
| Finance pages | Reporting-oriented. No record actions required. |
| NDIS Matching | Specialist flow, already has a detail page at `/ndis/match/[orderId]`. |

---

## Pilot Recommendation

### Redesign Lead Detail First

**Why not Quote?**
Quote is larger (more fields, more actions, NDIS routing) and already has the workspace tab structure working correctly. Redesigning it requires extracting shared components and adding a route simultaneously. Safer as a second step.

**Why not Customer?**
Customer is already partially migrated to the Workbench pattern. Adding a detail page is incremental, not transformational.

**Why not Fundraising?**
Fundraising items are not time-sensitive (they don't generate revenue directly). They're important but not urgent.

**Why Lead Detail?**
1. **Highest business urgency.** An unanswered lead is lost revenue. The current experience requires navigating into `BudLeadsWorkspace` and operating purely from a list card.
2. **Smallest data footprint.** A lead has: name, email, phone, service type, source, message, status, reply channel, created_at. Simple to model as a record.
3. **Proof of pattern.** Lead detail will establish the exact component structure (`LeadRecordHeader`, `LeadMetaRow`, `LeadContent`, `LeadContext`, `LeadTimeline`) that all other records will follow.
4. **No pricing complexity.** Lead detail involves no financial calculations — it's safe to design and build without Pricing Guard involvement.
5. **High visual impact.** The difference between a list card and a proper record page is immediately visible to anyone opening a lead. The improvement is demonstrable in a single session.

**What the Lead Detail page should include:**

```
Route: /dashboard/leads/[id]

WorkbenchHeader:
  Eyebrow: "Enquiry"
  Title: [customer_name] · [service_type]
  Description: Received [X days ago] via [source]
  Actions: [Reply] [Convert to Quote]

MetaRow (4 cards):
  Status chip | Service type | Source | Received date

Main (2/3):
  Contact block: name / email / phone / reply channel
  Enquiry content: full message or service details
  NDIS flag if applicable

Context (1/3):
  Related quote (if converted)
  Quick reply panel
  Timeline: Received → Replied → Converted / Closed

Sticky footer (mobile):
  [Reply] [Convert to Quote]
```

**What it establishes:**
- The `WorkbenchHeader` pattern as the standard for all records
- The MetaRow as the standard for record metadata
- The 2/3 + 1/3 layout as the standard for main content + context
- The `RecordTimeline` component as reusable
- The sticky footer as the standard for mobile CTA placement

Every subsequent record page (Quote, Customer, Job, Fundraising) will copy this structure and adjust only the fields and actions.

---

## Implementation Constraints (Do Not Violate)

- Do not redesign the entire dashboard — pilot Lead Detail first, then extend
- Do not change business logic — only page structure and information architecture
- Do not change database schemas — all data is already available
- Do not create new workflows — existing actions remain unchanged
- Do not break the Quotes workspace tab pattern — it works operationally
- All components must use `brand.*` tokens from `@/app/ui/theme` — no new colour values
- `glass` and `glassSoft` remain strings — never spread as objects
- All record pages must render server-side where possible (`async` server component + client boundary only for interactivity)

---

## Summary

Bud OS has one page that feels like professional software: the Artifact Detail page.

The design system exists. The component primitives exist (`WorkbenchHeader`, `MetaCard`, `RecordSection`). The pattern works. The problem is that it hasn't been applied consistently.

The proposal is not to rebuild the dashboard. The proposal is to apply the Artifact Detail pattern — eyebrow, title, metadata row, structured content body, context sidebar, timeline — to every major record, starting with Lead Detail.

**The measure of success:** A Bud OS administrator should be able to open any lead, quote, customer, or fundraising item and immediately read it as a structured business document — not navigate a form, expand a table row, or look in a slide-over drawer.
