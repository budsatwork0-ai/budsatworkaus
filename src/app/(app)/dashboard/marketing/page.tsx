'use client';

import Link from 'next/link';
import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

type Section = {
  title: string;
  description: string;
  owner: string;
  status: 'live' | 'deferred';
  href?: string;
  subsections?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Publishing Queue',
    description: 'Manual bridge from Ready to Publish production cards into platform-specific publishing records. Published means manually published by a person.',
    owner: 'Jackson Taylor - manual queue and status control only',
    status: 'live',
    href: '/dashboard/marketing/publishing',
    subsections: ['Draft', 'Ready', 'Published', 'Archived'],
  },
  {
    title: 'Campaign Manager',
    description: 'Manual campaign planning with goals, audiences, channels, KPIs, notes, and linked Publishing Queue items. No auto-posting or analytics automation.',
    owner: 'Jackson Taylor - manual campaign management only',
    status: 'live',
    href: '/dashboard/marketing/campaigns',
    subsections: ['Planning', 'Active', 'Completed', 'Archived'],
  },
  {
    title: 'Distribution Playbooks',
    description: 'Manual instruction sets and checklists for repeatable content distribution. Playbooks do not publish, schedule, generate, or automate anything.',
    owner: 'Jackson Taylor - manual playbook management only',
    status: 'live',
    href: '/dashboard/marketing/playbooks',
    subsections: ['Active', 'Draft', 'Archived'],
  },
  {
    title: 'Social Channels',
    description: 'Manual profile records for each platform. Handles, formats, audiences, posting targets, and notes. No OAuth, no platform APIs, no posting, no analytics, no AI generation.',
    owner: 'Jackson Taylor - manual profile management only',
    status: 'live',
    href: '/dashboard/marketing/social-channels',
    subsections: ['Active', 'Paused', 'Planned', 'Archived'],
  },
];

const STATUS_STYLE: Record<Section['status'], { bg: string; fg: string; label: string }> = {
  live:     { bg: '#ECFDF5', fg: '#047857', label: 'Live' },
  deferred: { bg: '#F1F5F9', fg: '#475569', label: 'Deferred' },
};

export default function MarketingPage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Marketing Studio"
        description="Marketing Studio includes the Publishing Queue, Campaign Manager, Distribution Playbooks, and Social Channel Profiles. Platform integrations, auto-posting, AI captions, agents, automations, analytics dashboards, and Research Lab functionality remain deferred."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const status = STATUS_STYLE[section.status];
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
          {section.title}
        </h2>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: status.bg, color: status.fg }}
        >
          {status.label}
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

      {section.href && (
        <Link
          href={section.href}
          className="inline-flex w-fit rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90"
          style={{ background: dashboardTheme.color.primary, color: '#fff' }}
        >
          {section.title === 'Campaign Manager'
            ? 'Open Campaigns'
            : section.title === 'Distribution Playbooks'
            ? 'Open Playbooks'
            : section.title === 'Social Channels'
            ? 'Open Channels'
            : 'Open Publishing Queue'}
        </Link>
      )}

      <p className="mt-auto border-t border-black/5 pt-2 text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
        Owner: {section.owner}
      </p>
    </div>
  );
}
