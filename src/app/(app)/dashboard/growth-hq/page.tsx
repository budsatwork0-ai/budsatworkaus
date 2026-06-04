'use client';

import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

type Phase = 4;

type Section = {
  title: string;
  description: string;
  owner: string;
  phase: Phase;
  subsections?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Acquisition Status',
    description: 'Active lead count and heat, quote pipeline value at risk, bookings this week vs. target, and rolling conversion rate. The commercial picture visible at a glance — no scrolling required.',
    owner: 'System — derived from Bud Leads + Quotes + Jobs',
    phase: 4,
    subsections: ['Active Leads', 'Quote Pipeline', 'Bookings This Week', 'Conversion Rate (30 days)'],
  },
  {
    title: 'Next Actions',
    description: 'The most important panel. Surfaces exactly what to do right now to move money forward: overdue follow-ups, leads without contact, expiring quotes, and stalled pipeline. Each item links directly to the record.',
    owner: 'Agent: acquisition-alert [surface only] — Jackson acts',
    phase: 4,
    subsections: ['Overdue Follow-ups (>48h no response)', 'Leads Without Contact', 'Expiring Quotes (>5 days)', 'Stalled Pipeline (>7 days same stage)'],
  },
  {
    title: 'Content Momentum',
    description: 'Is the content engine running? Shows posts live in the last 7 days, the top performing piece this week, and publishing queue health. Flags when the queue is empty — content silence costs leads.',
    owner: 'System — derived from Publishing Queue + Reports',
    phase: 4,
    subsections: ['Posts Live (7 days)', 'Best Performing Piece', 'Queue Health (days of ready content)'],
  },
  {
    title: 'Story Pulse',
    description: 'Minimal read on narrative health. Shows the current active arc, open thread count with oldest unresolved thread age, and days since last Founder Journal entry. Flags if journal is overdue (>3 days).',
    owner: 'System — derived from Story Engine',
    phase: 4,
    subsections: ['Active Arc', 'Open Threads (count + oldest)', 'Journal Cadence'],
  },
  {
    title: 'Weekly Focus',
    description: 'One field. Manually set by Jackson each week. One declared priority that everything else filters through. Not automated — requires a human decision, made once per week.',
    owner: 'Jackson Taylor — manually set weekly',
    phase: 4,
    subsections: ['Weekly Priority (free text)'],
  },
];

const PHASE_STYLE = {
  bg: '#EFF6FF',
  fg: '#1D4ED8',
  label: 'Phase 4',
};

export default function GrowthHQPage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Growth HQ"
        description="Customer acquisition command centre. Every element answers one question: what do I do next to get more customers?"
      />

      <ConstitutionNote />

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

function ConstitutionNote() {
  return (
    <div
      className="rounded-[20px] border px-5 py-4"
      style={{ background: '#FFFBEB', borderColor: 'rgba(245,158,11,0.25)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B45309' }}>
        Constitution Reference
      </p>
      <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
        Growth HQ is the morning view. It reads across all workspaces and surfaces the commercial pipeline, content queue health, and story pulse in one place. It does not manage any object directly — it reads and flags. Every Next Action links to the record; Jackson acts.
      </p>
      <p className="mt-2 text-xs font-mono" style={{ color: '#B45309', opacity: 0.7 }}>
        docs/constitution/growth-marketing-constitution.md § VI
      </p>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
          {section.title}
        </h2>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: PHASE_STYLE.bg, color: PHASE_STYLE.fg }}
        >
          {PHASE_STYLE.label}
        </span>
      </div>

      <p className="text-sm leading-6" style={{ color: dashboardTheme.color.muted }}>
        {section.description}
      </p>

      {section.subsections && (
        <div className="flex flex-wrap gap-1.5">
          {section.subsections.map((sub) => (
            <span
              key={sub}
              className="rounded-full border px-2.5 py-1 text-[11px]"
              style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}
            >
              {sub}
            </span>
          ))}
        </div>
      )}

      <p className="mt-auto pt-2 text-[11px] font-mono border-t border-black/5" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
        Owner: {section.owner}
      </p>
    </div>
  );
}
