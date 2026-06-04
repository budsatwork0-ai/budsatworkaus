'use client';

import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

type Section = {
  title: string;
  description: string;
  owner: string;
  phase: 4;
  rule?: string;
  subsections?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Trend Intelligence',
    description: 'Organised by platform — TikTok, Instagram, YouTube, Facebook. Each trend entry includes the adaptation angle (how it maps to Buds At Work content), urgency (evergreen / 2-week / 48-hour window), and status.',
    owner: 'Agent: trend-scout [surface, Watching status only] — Jackson curates and advances',
    phase: 4,
    subsections: ['TikTok Trends', 'Instagram Formats', 'YouTube Trends', 'Trending Audio (cross-platform)'],
  },
  {
    title: 'Competitor Analysis',
    description: 'Competitors in the attention economy — other creators and businesses occupying the same content territory. Gap analysis identifies where Buds At Work has a clear lane. The biggest identified gap: authentic, longitudinal documentation of disability employment through a small business lens.',
    owner: 'Jackson Taylor (strategic interpretation) + agent: competitor-scout [surface performance observations]',
    phase: 4,
    rule: 'Competitor data informs differentiation. It does not drive imitation.',
    subsections: ['Competitor Profiles', 'Gap Analysis', 'Benchmark Tracker'],
  },
  {
    title: 'Winning Formats',
    description: 'A curated library of formats that work, independent of platform trends. Format Library explains the psychological mechanism behind each format. Hook Library is organised by emotion triggered and platform fit. Performance Archive contains first-party data from published Buds At Work content.',
    owner: 'Jackson Taylor (curated) + agent: format-analyst [surface suggestions from performance data]',
    phase: 4,
    subsections: ['Format Library', 'Hook Library', 'Performance Archive (first-party)'],
  },
  {
    title: 'Adaptation Workspace',
    description: 'The bridge between Research Lab and Content Studio. A trend or format is translated into a Buds At Work piece here. An idea does not move to Content Studio until the adaptation has a genuine story angle — forced story-trend fits are rejected.',
    owner: 'Jackson Taylor — agent: adaptation-validator [score + flag only]; Jackson decides',
    phase: 4,
    rule: 'A trend is only usable when there is a genuine story angle to attach it to. Chasing trends without story grounding is not permitted.',
    subsections: ['Active Adaptations', 'Adaptation History'],
  },
];

const PHASE_STYLE = {
  bg: '#EFF6FF',
  fg: '#1D4ED8',
  label: 'Phase 4',
};

export default function ResearchLabPage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Research Lab"
        description="External intelligence layer. Provides trend context and format options for Content Studio. Research Lab informs how a story is told — not what story is told. Story Engine remains upstream."
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
        Research Lab does not replace Story Engine. It provides trend intelligence and format context — informing how a story is told, not what story is told. Story-first always. Trend-adapted when possible. Trend-chased never.
      </p>
      <p className="mt-2 text-xs font-mono" style={{ color: '#B45309', opacity: 0.7 }}>
        docs/constitution/growth-marketing-constitution.md § VI, § X
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
          style={{ background: '#FDF4FF', borderLeft: '3px solid #D8B4FE' }}
        >
          <p className="text-[11px] font-semibold" style={{ color: '#7E22CE' }}>
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
