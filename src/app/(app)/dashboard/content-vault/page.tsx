'use client';

import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

type Section = {
  title: string;
  description: string;
  owner: string;
  phase: 4;
  sensitivity?: string;
  subsections?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Published Content',
    description: 'Archive of all published content, organised by date, channel, story arc, and chapter. Auto-archived from the Publishing Queue on publish. Enables retrospective analysis and long-form episode compilation.',
    owner: 'System — auto-created on publish; Jackson adds retrospective tags',
    phase: 4,
    subsections: ['By Date', 'By Channel', 'By Story Arc', 'By Chapter'],
  },
  {
    title: 'Success Stories',
    description: 'Customer transformation outcomes documented with consent. Each record includes the service, outcome description, consent status, and linked content. Feeds back into Story Engine as new story opportunities.',
    owner: 'Jackson Taylor — consent gate enforced; unconsented records invisible to all workflows',
    phase: 4,
    sensitivity: 'Consent = confirmed required before record is visible to content workflows or agents.',
    subsections: ['Active Success Stories', 'Pending Consent', 'Story Opportunities (linked)'],
  },
  {
    title: 'Testimonials',
    description: 'Text and video testimonials from customers. Linked to Success Stories where a full story arc exists. Used in campaigns and on the website. Consent tracked per testimonial.',
    owner: 'Jackson Taylor — consent required per testimonial',
    phase: 4,
    subsections: ['Text Testimonials', 'Video Testimonials', 'Website-Published'],
  },
  {
    title: 'Campaign Archive',
    description: 'Closed campaigns with result summaries. Each archive entry includes the campaign goal, arc connection, channels used, content pieces, KPIs, and the post-campaign result summary written by Jackson.',
    owner: 'System (auto-archived on close) — result summary written by Jackson',
    phase: 4,
    subsections: ['Closed Campaigns', 'Performance Summaries', 'Lessons Captured'],
  },
];

const PHASE_STYLE = {
  bg: '#EFF6FF',
  fg: '#1D4ED8',
  label: 'Phase 4',
};

export default function ContentVaultPage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Content Vault"
        description="Published content archive, success story library, and campaign history. The Vault feeds back into the Story Engine — customer outcomes become new story opportunities, completing the growth cycle."
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
        The Vault closes the growth cycle: Success Stories feed back into Story Engine → new characters introduced → new open threads planted → content cycle continues. Do not use placeholder data in place of real outcomes. Do not claim milestones that have not occurred.
      </p>
      <p className="mt-2 text-xs font-mono" style={{ color: '#B45309', opacity: 0.7 }}>
        docs/constitution/growth-marketing-constitution.md § III, § X, § XIII
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

      {section.sensitivity && (
        <div
          className="rounded-xl px-3 py-2"
          style={{ background: '#FEF2F2', borderLeft: '3px solid #FCA5A5' }}
        >
          <p className="text-[11px] font-semibold" style={{ color: '#B91C1C' }}>
            Sensitivity: {section.sensitivity}
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
