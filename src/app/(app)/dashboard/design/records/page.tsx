import { WorkbenchHeader } from '../../components/Workbench';
import {
  RecordPage,
  RecordHeader,
  RecordMetaCard,
  RecordMetaRow,
  RecordBody,
  RecordMain,
  RecordSection,
  RecordContext,
  RecordTimeline,
  RelatedRecordCard,
} from '../../components/RecordFrame';
import { brand } from '@/app/ui/theme';

export const dynamic = 'force-static';

// ─── Sandbox helpers ──────────────────────────────────────────────────────────

function SandboxDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-8">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-black/5 py-2.5 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      <span className="text-sm" style={{ color: brand.text }}>
        {value}
      </span>
    </div>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      style={{ background: brand.accent }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50"
      style={{ color: brand.text }}
    >
      {children}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecordFrameSandboxPage() {
  return (
    <div className="flex flex-col pb-20">
      <WorkbenchHeader
        eyebrow="Design System"
        title="Record Framework"
        description="Universal record page pattern for Bud OS. Every major business object gets a dedicated URL, a structured header, metadata row, and a content + context layout. Prove the pattern here before wiring real data."
      />

      {/* Component index */}
      <div className="mt-5 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h2 className="text-sm font-semibold" style={{ color: brand.text }}>
          Components in this framework
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['RecordPage', 'Outer flex-col gap-5 wrapper for a record'],
            ['RecordHeader', 'Eyebrow · Title · Description · Back link · Actions'],
            ['RecordMetaRow', '4-column metadata grid'],
            ['RecordMetaCard', 'Label + value cell — tone chip for Status'],
            ['RecordBody', '2/3 + 1/3 layout: main content + context sidebar'],
            ['RecordMain', 'Left content column inside RecordBody'],
            ['RecordSection', 'Titled white card section'],
            ['RecordContext', 'Right sidebar column inside RecordBody'],
            ['RecordTimeline', 'Vertical event history, newest first'],
            ['RelatedRecordCard', 'Linked chip card pointing to a related record'],
          ].map(([name, desc]) => (
            <div
              key={name}
              className="rounded-xl border border-black/5 bg-slate-50 px-3.5 py-3"
            >
              <p
                className="font-mono text-xs font-semibold"
                style={{ color: brand.accent }}
              >
                {name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lead / Enquiry ─────────────────────────────────────────────────── */}
      <SandboxDivider label="Lead / Enquiry" />
      <RecordPage>
        <RecordHeader
          eyebrow="Enquiry"
          title="Sarah Mitchell · House Cleaning"
          description="Received 2 days ago via Facebook · Awaiting first response"
          backHref="/dashboard/leads"
          backLabel="All Enquiries"
          actions={
            <>
              <PrimaryButton>Reply</PrimaryButton>
              <SecondaryButton>Convert to Quote</SecondaryButton>
            </>
          }
        />
        <RecordMetaRow>
          <RecordMetaCard label="Status" value="Awaiting Response" tone="warning" />
          <RecordMetaCard label="Service" value="House Cleaning" />
          <RecordMetaCard label="Source" value="Facebook" />
          <RecordMetaCard label="Received" value="20 Jun 2026" />
        </RecordMetaRow>
        <RecordBody>
          <RecordMain>
            <RecordSection title="Contact Details">
              <div className="flex flex-col">
                <FieldRow label="Name" value="Sarah Mitchell" />
                <FieldRow label="Email" value="sarah.mitchell@email.com" />
                <FieldRow label="Phone" value="0412 345 678" />
                <FieldRow label="Reply Channel" value="Email" />
              </div>
            </RecordSection>
            <RecordSection title="Enquiry Message">
              <p className="text-sm leading-6" style={{ color: brand.muted }}>
                &quot;Hi, I&apos;m looking for a regular fortnightly clean for my 4-bedroom
                house in Logan Central. Prefer mornings if possible. Can you give me a
                quote?&quot;
              </p>
            </RecordSection>
          </RecordMain>
          <RecordContext>
            <RecordSection title="Timeline">
              <RecordTimeline
                events={[
                  {
                    label: 'Enquiry received',
                    timestamp: '20 Jun 2026 · 9:14 am',
                    actor: 'Facebook',
                  },
                  {
                    label: 'Lead created',
                    timestamp: '20 Jun 2026 · 9:14 am',
                    actor: 'System',
                  },
                ]}
              />
            </RecordSection>
          </RecordContext>
        </RecordBody>
      </RecordPage>

      {/* ── Quote ──────────────────────────────────────────────────────────── */}
      <SandboxDivider label="Quote" />
      <RecordPage>
        <RecordHeader
          eyebrow="Quote"
          title="James & Priya Okafor · Yard Care"
          description="Submitted 3 days ago · Effective total $245.00"
          backHref="/dashboard/quotes"
          backLabel="Quotes"
          actions={
            <>
              <PrimaryButton>Approve &amp; Send Payment</PrimaryButton>
              <SecondaryButton>Adjust Price</SecondaryButton>
            </>
          }
        />
        <RecordMetaRow>
          <RecordMetaCard label="Status" value="In Review" tone="warning" />
          <RecordMetaCard label="Service" value="Yard Care" />
          <RecordMetaCard label="Context" value="Residential" />
          <RecordMetaCard label="Total" value="$245.00" tone="success" />
        </RecordMetaRow>
        <RecordBody>
          <RecordMain>
            <RecordSection title="Customer Details">
              <div className="flex flex-col">
                <FieldRow label="Name" value="James & Priya Okafor" />
                <FieldRow label="Email" value="okafor.family@email.com" />
                <FieldRow label="Phone" value="0423 887 112" />
                <FieldRow label="Address" value="7 Rosewood Cres, Marsden QLD 4132" />
              </div>
            </RecordSection>
            <RecordSection title="Service Scope">
              <div className="flex flex-col">
                <FieldRow label="Service Type" value="Yard Care — Full Mow & Edge" />
                <FieldRow label="Lawn Area" value="420 sqm" />
                <FieldRow label="Frequency" value="Fortnightly" />
                <FieldRow label="Access" value="Side gate, padlock code provided" />
              </div>
            </RecordSection>
          </RecordMain>
          <RecordContext>
            <RecordSection title="Related">
              <RelatedRecordCard
                label="Customer"
                title="James & Priya Okafor"
                href="/dashboard/customers/okafor"
                status="Active"
                statusTone="success"
              />
            </RecordSection>
            <RecordSection title="Timeline">
              <RecordTimeline
                events={[
                  {
                    label: 'Quote submitted',
                    timestamp: '19 Jun 2026 · 2:07 pm',
                    actor: 'Customer',
                  },
                  {
                    label: 'Review started',
                    timestamp: '19 Jun 2026 · 4:30 pm',
                    actor: 'Admin',
                  },
                ]}
              />
            </RecordSection>
          </RecordContext>
        </RecordBody>
      </RecordPage>

      {/* ── Customer ───────────────────────────────────────────────────────── */}
      <SandboxDivider label="Customer" />
      <RecordPage>
        <RecordHeader
          eyebrow="Customer"
          title="Linda Nguyen"
          description="Logan region · Member since 12 March 2025 · Last active 2 weeks ago"
          backHref="/dashboard/customers"
          backLabel="Customers"
          actions={
            <>
              <PrimaryButton>Message</PrimaryButton>
              <SecondaryButton>Create Quote</SecondaryButton>
            </>
          }
        />
        <RecordMetaRow>
          <RecordMetaCard label="Status" value="Active" tone="success" />
          <RecordMetaCard label="Region" value="Logan" />
          <RecordMetaCard label="Orders" value="6 completed" />
          <RecordMetaCard label="Member Since" value="12 Mar 2025" />
        </RecordMetaRow>
        <RecordBody>
          <RecordMain>
            <RecordSection title="Contact Information">
              <div className="flex flex-col">
                <FieldRow label="Email" value="linda.nguyen@email.com" />
                <FieldRow label="Phone" value="0401 223 456" />
                <FieldRow label="Address" value="22 Parkview Dr, Logan Central QLD 4114" />
              </div>
            </RecordSection>
            <RecordSection title="Recent Quotes">
              <div className="flex flex-col gap-2">
                <RelatedRecordCard
                  label="Quote #Q-2406"
                  title="House Cleaning · $185.00"
                  href="/dashboard/quotes/q2406"
                  status="Paid"
                  statusTone="success"
                />
                <RelatedRecordCard
                  label="Quote #Q-2234"
                  title="Window Cleaning · $95.00"
                  href="/dashboard/quotes/q2234"
                  status="Paid"
                  statusTone="success"
                />
              </div>
            </RecordSection>
          </RecordMain>
          <RecordContext>
            <RecordSection title="Timeline">
              <RecordTimeline
                events={[
                  {
                    label: 'Last order completed',
                    timestamp: '8 Jun 2026',
                    actor: 'Crew',
                  },
                  {
                    label: 'Second order',
                    timestamp: '12 Apr 2026',
                    actor: 'Customer',
                  },
                  {
                    label: 'First order',
                    timestamp: '22 Mar 2025',
                    actor: 'Customer',
                  },
                  {
                    label: 'Account created',
                    timestamp: '12 Mar 2025',
                    actor: 'Customer',
                  },
                ]}
              />
            </RecordSection>
          </RecordContext>
        </RecordBody>
      </RecordPage>

      {/* ── Job / Order ────────────────────────────────────────────────────── */}
      <SandboxDivider label="Job / Order" />
      <RecordPage>
        <RecordHeader
          eyebrow="Job"
          title="Whitfield Home Clean · 25 Jun 2026"
          description="12 Whitfield St, Meadowbrook QLD 4131 · Assigned to Emma Rodriguez"
          backHref="/dashboard/orders"
          backLabel="Jobs & Orders"
          actions={
            <>
              <PrimaryButton>Mark Complete</PrimaryButton>
              <SecondaryButton>Reschedule</SecondaryButton>
            </>
          }
        />
        <RecordMetaRow>
          <RecordMetaCard label="Status" value="Confirmed" tone="success" />
          <RecordMetaCard label="Service" value="House Cleaning" />
          <RecordMetaCard label="Scheduled" value="25 Jun 2026 · 9:00 am" />
          <RecordMetaCard label="Crew" value="Emma Rodriguez" />
        </RecordMetaRow>
        <RecordBody>
          <RecordMain>
            <RecordSection title="Service Details">
              <div className="flex flex-col">
                <FieldRow label="Service Type" value="House Cleaning — Standard" />
                <FieldRow label="Bedrooms" value="3" />
                <FieldRow label="Duration" value="3 hours" />
                <FieldRow label="Access" value="Lockbox at front door" />
              </div>
            </RecordSection>
          </RecordMain>
          <RecordContext>
            <RecordSection title="Related">
              <div className="flex flex-col gap-2">
                <RelatedRecordCard
                  label="Customer"
                  title="Sandra Whitfield"
                  href="/dashboard/customers/whitfield"
                  status="Active"
                  statusTone="success"
                />
                <RelatedRecordCard
                  label="Quote"
                  title="Q-2501 · $185.00"
                  href="/dashboard/quotes/q2501"
                  status="Approved"
                  statusTone="success"
                />
              </div>
            </RecordSection>
            <RecordSection title="Timeline">
              <RecordTimeline
                events={[
                  {
                    label: 'Job confirmed',
                    timestamp: '20 Jun 2026 · 11:22 am',
                    actor: 'Admin',
                  },
                  {
                    label: 'Quote approved',
                    timestamp: '19 Jun 2026 · 3:45 pm',
                    actor: 'Admin',
                  },
                  {
                    label: 'Quote submitted',
                    timestamp: '18 Jun 2026 · 8:30 am',
                    actor: 'Customer',
                  },
                ]}
              />
            </RecordSection>
          </RecordContext>
        </RecordBody>
      </RecordPage>

      {/* ── Fundraising Item ───────────────────────────────────────────────── */}
      <SandboxDivider label="Fundraising Item" />
      <RecordPage>
        <RecordHeader
          eyebrow="Fundraising Item"
          title="Commercial Vacuum — Employee Empowerment Fund"
          description="Tools category · Empowers workers with disability to take on larger residential contracts"
          backHref="/dashboard/fundraising"
          backLabel="Fundraising"
          actions={
            <>
              <PrimaryButton>Go Live</PrimaryButton>
              <SecondaryButton>Edit</SecondaryButton>
            </>
          }
        />
        <RecordMetaRow>
          <RecordMetaCard label="Status" value="Live" tone="success" />
          <RecordMetaCard label="Goal" value="$450.00" />
          <RecordMetaCard label="Raised" value="$285.00 (63%)" tone="success" />
          <RecordMetaCard label="Contributions" value="4" />
        </RecordMetaRow>
        <RecordBody>
          <RecordMain>
            <RecordSection title="Item Description">
              <p className="text-sm leading-6" style={{ color: brand.muted }}>
                A commercial-grade vacuum for a supported employee who handles residential
                cleaning contracts. This equipment directly increases the worker&apos;s
                earning capacity and independence.
              </p>
            </RecordSection>
            <RecordSection title="Progress">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: brand.muted }}>$285.00 raised of $450.00 goal</span>
                  <span className="font-semibold" style={{ color: brand.accent }}>
                    63%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: '63%', background: brand.accent }}
                  />
                </div>
                <div className="flex gap-6 text-xs" style={{ color: brand.muted }}>
                  <span>Gross: $300.00</span>
                  <span>Fees: $15.00</span>
                  <span>Net: $285.00</span>
                </div>
              </div>
            </RecordSection>
          </RecordMain>
          <RecordContext>
            <RecordSection title="Timeline">
              <RecordTimeline
                events={[
                  {
                    label: 'Last contribution',
                    timestamp: '21 Jun 2026 · 3:22 pm',
                    actor: 'Donor',
                    note: '$75.00 via PayPal',
                  },
                  {
                    label: 'Went live',
                    timestamp: '14 Jun 2026 · 10:00 am',
                    actor: 'Admin',
                  },
                  {
                    label: 'Item created',
                    timestamp: '12 Jun 2026 · 2:15 pm',
                    actor: 'Admin',
                  },
                ]}
              />
            </RecordSection>
          </RecordContext>
        </RecordBody>
      </RecordPage>
    </div>
  );
}
