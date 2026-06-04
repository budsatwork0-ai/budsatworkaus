'use client';

import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

type Section = {
  title: string;
  description: string;
  owner: string;
  phase: 3;
  rule?: string;
  subsections?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Ideas',
    description: 'Ideas enter from three sources: story-sourced (from Story Opportunities and journal entries), research-sourced (from Research Lab Adaptation Workspace), and manual capture. Each idea tracks platform fit, format, hook, and arc connection.',
    owner: 'Jackson Taylor — agent: idea-generator [surface candidates only]; Jackson creates the record',
    phase: 3,
    rule: 'No idea enters production without a story arc connection or a direct acquisition purpose.',
    subsections: ['Story-Sourced Ideas', 'Research-Sourced Ideas', 'Manual Capture', 'Idea Status Board'],
  },
  {
    title: 'Scripts',
    description: 'Scripts are developed from approved ideas. Structure: Hook (first 3 seconds) → Setup → Core Moment → Close. AI-assisted drafting is available. No script enters production without Jackson\'s explicit approval.',
    owner: 'Jackson Taylor — agent: script-drafter [draft only, pending until approved]',
    phase: 3,
    rule: 'A draft script is not canonical. Approval is a named, deliberate step — not a passive default.',
    subsections: ['In Draft', 'Ready to Shoot', 'Script Generator (AI-assisted)'],
  },
  {
    title: 'Production Board',
    description: 'Kanban view of content in production. Cards move from To Film → In Edit → Ready to Publish → Published. Each card links to its approved script. No agent advances a Production Board card — status advance is human-only.',
    owner: 'Jackson Taylor — no agent modifies card status',
    phase: 3,
    subsections: ['To Film', 'In Edit', 'Ready to Publish', 'Published'],
  },
  {
    title: 'Asset Library',
    description: 'Organised links to footage, photos, graphics, and testimonials. Assets are linked, not stored in-app. Assets involving customers or crew require a consent field confirmed before they appear in any content workflow.',
    owner: 'Jackson Taylor — consent gate enforced at record level for customer/crew assets',
    phase: 3,
    rule: 'Unconfirmed consent assets are invisible to all content workflows and agent processing.',
    subsections: ['Footage (linked)', 'Customer-Approved Photos', 'Graphics + Overlays', 'Text + Video Testimonials'],
  },
];

const PHASE_STYLE = {
  bg: '#F0FDF4',
  fg: '#15803D',
  label: 'Phase 3',
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
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
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

      <p className="mt-auto pt-2 text-[11px] font-mono border-t border-black/5" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
        Owner: {section.owner}
      </p>
    </div>
  );
}
