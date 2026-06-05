'use client';

import Link from 'next/link';
import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

type Section = {
  title: string;
  description: string;
  owner: string;
  phase: 3;
  status: 'live' | 'deferred';
  href?: string;
  rule?: string;
  subsections?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Ideas',
    description: 'Ideas enter from Story Opportunities, Research Lab context, or manual capture. Each idea tracks platform fit, format, hook, arc connection, priority, and notes.',
    owner: 'Jackson Taylor — manual capture and opportunity conversion only',
    phase: 3,
    status: 'live',
    href: '/dashboard/content-studio/ideas',
    rule: 'No idea enters production without a story arc connection or a direct acquisition purpose.',
    subsections: ['Story-Sourced Ideas', 'Research-Sourced Ideas', 'Manual Capture', 'Idea Status Board'],
  },
  {
    title: 'Scripts',
    description: 'Scripts are written manually from content ideas. Structure: Hook → Setup → Core Moment → Close / CTA. Approved scripts can enter the Production Board.',
    owner: 'Jackson Taylor — manual writing only',
    phase: 3,
    status: 'live',
    href: '/dashboard/content-studio/scripts',
    rule: 'A draft script is not canonical. Approval is a named, deliberate step — not a passive default.',
    subsections: ['Draft Scripts', 'Approved Scripts', 'Archived Scripts'],
  },
  {
    title: 'Production Board',
    description: 'Manual Kanban view of content in production. Cards move from To Film → In Edit → Ready to Publish → Published. Each card links to an approved script.',
    owner: 'Jackson Taylor — manual status movement only',
    phase: 3,
    status: 'live',
    href: '/dashboard/content-studio/production',
    subsections: ['To Film', 'In Edit', 'Ready to Publish', 'Published'],
  },
  {
    title: 'Asset Library',
    description: 'Manual library for footage, photos, graphics, testimonials, and other linked assets. Assets are links or file paths only; denied consent blocks production use.',
    owner: 'Jackson Taylor — manual link and consent management only',
    phase: 3,
    status: 'live',
    href: '/dashboard/content-studio/assets',
    rule: 'Assets with denied consent are not selectable for production use. Unknown and pending consent are visually flagged.',
    subsections: ['Footage (linked)', 'Customer-Approved Photos', 'Graphics + Overlays', 'Text + Video Testimonials'],
  },
];

const PHASE_STYLE = {
  bg: '#F0FDF4',
  fg: '#15803D',
  label: 'Phase 3',
};

const STATUS_STYLE: Record<Section['status'], { bg: string; fg: string; label: string }> = {
  live:     { bg: '#ECFDF5', fg: '#047857', label: 'Live' },
  deferred: { bg: '#F1F5F9', fg: '#475569', label: 'Deferred' },
};

export default function ContentStudioPage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Content Studio"
        description="Story becomes content here. Every piece produced in Content Studio must connect to a live story arc or serve a direct acquisition purpose. Content that does neither is not produced."
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
        Content Studio does not publish without a story arc connection. Every piece must be arc-connected and story-grounded. Research Lab provides trend context and format intelligence — it informs how a story is told, not what story is told.
      </p>
      <p className="mt-2 text-xs font-mono" style={{ color: '#B45309', opacity: 0.7 }}>
        docs/constitution/growth-marketing-constitution.md § VI, § VIII
      </p>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const status = STATUS_STYLE[section.status];
  const actionLabel = section.title === 'Ideas'
    ? 'Open Ideas'
    : section.title === 'Scripts'
    ? 'Open Scripts'
    : section.title === 'Production Board'
    ? 'Open Board'
    : section.title === 'Asset Library'
    ? 'Open Assets'
    : 'Open';
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
          {section.title}
        </h2>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{ background: status.bg, color: status.fg }}
          >
            {status.label}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{ background: PHASE_STYLE.bg, color: PHASE_STYLE.fg }}
          >
            {PHASE_STYLE.label}
          </span>
        </div>
      </div>

      <p className="text-sm leading-6" style={{ color: dashboardTheme.color.muted }}>
        {section.description}
      </p>

      {section.rule && (
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: '#EFF6FF', borderLeft: '3px solid #93C5FD' }}
        >
          <p className="text-[11px] font-semibold" style={{ color: '#1D4ED8' }}>
            Rule: {section.rule}
          </p>
        </div>
      )}

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

      {section.href && (
        <Link
          href={section.href}
          className="inline-flex w-fit rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90"
          style={{ background: dashboardTheme.color.primary, color: '#fff' }}
        >
          {actionLabel}
        </Link>
      )}

      <p className="mt-auto pt-2 text-[11px] font-mono border-t border-black/5" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
        Owner: {section.owner}
      </p>
    </div>
  );
}
