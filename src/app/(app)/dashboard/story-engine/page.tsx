'use client';

import Link from 'next/link';
import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

export default function StoryEnginePage() {
  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Story Engine"
        description="Narrative memory and continuity layer. The Story Engine is upstream of everything — without it, content has no story grounding and the audience has no reason to return."
      />

      <ConstitutionNote />

      {/* 7 live modules */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LiveCard
          title="Founder Journal"
          phase="Phase 2A"
          description="The daily capture layer. Jackson writes raw observations. Entries are private and never surfaced publicly."
          owner="Jackson Taylor only — private, never externally surfaced"
          sensitivity="Private. Agents read for signal extraction only. Never quoted directly."
          tags={["Today's Wins", "Challenges", "Customer Activity", "Silvan Updates", "Content Potential"]}
          primaryAction={{ label: "Write today's entry", href: '/dashboard/story-engine/journal/new' }}
          secondaryAction={{ label: 'All entries', href: '/dashboard/story-engine/journal' }}
        />

        <LiveCard
          title="Story Bible"
          phase="Phase 2B-lite"
          description="The manually maintained narrative source of truth. Defines mission, tone, constraints, and the long arc."
          owner="Jackson Taylor — no agent may modify"
          tags={['Mission & Purpose', 'Core Tension', 'Narrative Tone', 'What We Show', 'What We Never Do', 'The Long Arc']}
          primaryAction={{ label: 'Open Story Bible', href: '/dashboard/story-engine/story-bible' }}
        />

        <LiveCard
          title="Characters"
          phase="Phase 2B-lite"
          description="Three core characters: Jackson Taylor, Silvan, and Buds At Work. Profiles, consent gates, and boundaries."
          owner="Jackson Taylor — Silvan's profile requires consent confirmation before any content use"
          sensitivity="Silvan's profile: consent gate enforced at record level"
          tags={['Jackson Taylor', 'Silvan', 'Buds At Work']}
          primaryAction={{ label: 'Open Characters', href: '/dashboard/story-engine/characters' }}
        />

        <LiveCard
          title="Story Arcs"
          phase="Phase 2C"
          description="Long-running narrative threads. Four active arcs seeded: Building Buds, Silvan's Journey, Can Bud OS Build A Business, Community Impact."
          owner="Jackson Taylor — manual management only"
          tags={['Active', 'Planted', 'Resolved', 'Abandoned']}
          primaryAction={{ label: 'Open Story Arcs', href: '/dashboard/story-engine/arcs' }}
        />

        <LiveCard
          title="Open Threads"
          phase="Phase 2C"
          description="Unresolved story questions. 10 threads seeded. Track what remains unanswered until it closes."
          owner="Jackson Taylor — manual resolution only"
          tags={['First Recurring Customer', 'First $1K Month', 'Bud OS Generates a Customer', '+7 more']}
          primaryAction={{ label: 'Open Threads', href: '/dashboard/story-engine/open-threads' }}
        />

        <LiveCard
          title="Current Chapter"
          phase="Phase 2C"
          description="The named narrative period we are living in right now. One active chapter: The Restart."
          owner="Jackson Taylor — manual editing only, no AI edits"
          tags={['The Restart', 'One active chapter', 'Goal-driven']}
          primaryAction={{ label: 'View Current Chapter', href: '/dashboard/story-engine/current-chapter' }}
        />
      </div>

      {/* Story Opportunities — live Phase 2D */}
      <LiveCard
        title="Story Opportunities"
        phase="Phase 2D"
        description="Content-worthy story moments. Manually capture and develop content angles from the journal, arcs, characters, threads, and current chapter."
        owner="Jackson Taylor — manual management only, no AI generation"
        tags={['Surfaced', 'Tension Map', 'Missed Moments']}
        primaryAction={{ label: 'Open Opportunities', href: '/dashboard/story-engine/opportunities' }}
      />
    </div>
  );
}

// ─── Live card ────────────────────────────────────────────────────────────────

function LiveCard({
  title,
  phase,
  description,
  owner,
  sensitivity,
  tags,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  phase: string;
  description: string;
  owner: string;
  sensitivity?: string;
  tags?: string[];
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
              {title}
            </h2>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: '#ECFDF5', color: '#047857' }}
            >
              Live — {phase}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6" style={{ color: dashboardTheme.color.muted }}>
            {description}
          </p>
        </div>
      </div>

      {sensitivity && (
        <div className="rounded-xl px-3 py-2" style={{ background: '#FEF2F2', borderLeft: '3px solid #FCA5A5' }}>
          <p className="text-[11px] font-semibold" style={{ color: '#B91C1C' }}>
            Sensitivity: {sensitivity}
          </p>
        </div>
      )}

      {tags && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border px-2.5 py-1 text-[11px]"
              style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-1">
        <Link
          href={primaryAction.href}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: dashboardTheme.color.primary }}
        >
          {primaryAction.label}
        </Link>
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>

      <p className="border-t border-black/5 pt-3 text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
        Owner: {owner}
      </p>
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
        Story Engine is upstream of everything. Without it being fed — journal entries, arc updates, character timeline events — Content Studio has no story-grounded angles. Content without story is generic service content. Generic service content does not build an invested audience.
      </p>
      <p className="mt-2 text-xs font-mono" style={{ color: '#B45309', opacity: 0.7 }}>
        docs/constitution/growth-marketing-constitution.md § VI, § VIII, § IX
      </p>
    </div>
  );
}
