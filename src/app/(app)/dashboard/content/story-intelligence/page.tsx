import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildStoryIntelligenceRecommendations } from '@/lib/story-intelligence/recommendations';
import { type StoryIntelligenceRecommendation, type StoryIntelligenceSignal } from '@/types/story-intelligence';
import { WorkbenchHeader } from '../../components/Workbench';
import { GenerateStoryBriefButton } from './GenerateStoryBriefButton';

export default async function StoryIntelligencePage() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  const data = await buildStoryIntelligenceRecommendations(client as any);
  const [top, ...rest] = data.recommendations;

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content"
        title="Story Intelligence"
        description="The narrative brain for Buds At Work. It answers what we should talk about today using explainable signals from real records."
        actions={
          <Link
            href="/dashboard/content"
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Campaign Factory
          </Link>
        }
      />

      {!top ? (
        <EmptyState />
      ) : (
        <>
          <TopRecommendation recommendation={top} />

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-5">
              <SignalBreakdown recommendation={top} />
              <SourceRecords recommendation={top} />
            </div>
            <DecisionRail recommendation={top} />
          </section>

          {rest.length > 0 ? (
            <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950">Ranked Recommendations</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Every score is base story score plus visible signal bonuses. No opaque AI ranking.
                </p>
              </div>
              <div className="grid gap-3">
                {rest.map((recommendation, index) => (
                  <RankedRecommendation key={recommendation.id} recommendation={recommendation} rank={index + 2} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function TopRecommendation({ recommendation }: { recommendation: StoryIntelligenceRecommendation }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="bg-emerald-950 px-5 py-7 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
          What should we talk about today?
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">{recommendation.recommendedStory}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-50">
              {recommendation.contentAngle || `This story currently has the strongest visible signal stack for ${recommendation.businessGoal}.`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-100">Potential</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums">{recommendation.score}/100</p>
            <p className="mt-2 text-xs text-emerald-100">{recommendation.scoreFormula}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-3">
        <AnswerCard label="Why it matters" value={recommendation.why[0] ?? 'Strongest visible story opportunity.'} />
        <AnswerCard label="Business goal" value={recommendation.businessGoal} />
        <AnswerCard label="Next action" value="Generate a Story Brief Artifact for review." />
      </div>
    </section>
  );
}

function AnswerCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function SignalBreakdown({ recommendation }: { recommendation: StoryIntelligenceRecommendation }) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Signal Breakdown</h2>
          <p className="mt-1 text-sm text-slate-500">Score, supporting records, and exact reasoning.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          Base {recommendation.baseStoryScore} + Signals {recommendation.recommendationBonus}
        </span>
      </div>

      <div className="grid gap-3">
        {recommendation.supportingSignals.map((signal) => (
          <SignalRow key={signal.id} signal={signal} />
        ))}
      </div>

      {recommendation.scoreBreakdown ? (
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <ScoreDimension label="Human" value={recommendation.scoreBreakdown.human_impact} max={25} />
          <ScoreDimension label="Business" value={recommendation.scoreBreakdown.business_significance} max={25} />
          <ScoreDimension label="Stakes" value={recommendation.scoreBreakdown.emotional_tension} max={20} />
          <ScoreDimension label="Arc" value={recommendation.scoreBreakdown.transformation_potential} max={20} />
          <ScoreDimension label="Content" value={recommendation.scoreBreakdown.content_potential} max={10} />
        </div>
      ) : null}
    </section>
  );
}

function SignalRow({ signal }: { signal: StoryIntelligenceSignal }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-black/5 px-4 py-3 md:grid-cols-[130px_minmax(0,1fr)_70px] md:items-center">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{signal.type.replace(/_/g, ' ')}</p>
      <div>
        <p className="text-sm font-semibold text-slate-900">{signal.label}</p>
        <p className="mt-1 text-sm leading-5 text-slate-600">{signal.detail}</p>
      </div>
      <p className="text-right text-sm font-semibold tabular-nums text-emerald-700">+{signal.weight}</p>
    </div>
  );
}

function ScoreDimension({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}/{max}</p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
        <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SourceRecords({ recommendation }: { recommendation: StoryIntelligenceRecommendation }) {
  const groups = [
    ['Story Arcs', recommendation.relatedStoryArcs],
    ['Open Threads', recommendation.relatedOpenThreads],
    ['Fundraising', recommendation.relatedFundraisingCampaigns],
    ['Jobs', recommendation.relatedJobs],
    ['Reviews', recommendation.relatedReviews],
    ['Leads', recommendation.relatedLeads],
    ['Milestones', recommendation.relatedMilestones],
  ] as const;

  return (
    <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-base font-semibold text-slate-950">Source Records</h2>
      <p className="mt-1 text-sm text-slate-500">Concrete records behind the recommendation.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {groups.map(([label, refs]) => (
          <div key={label} className="rounded-2xl border border-black/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{refs.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {refs.length > 0 ? refs.map((ref) => (
                <Link key={ref.id} href={ref.href ?? '#'} className="rounded-xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                  <p className="text-sm font-medium text-slate-900">{ref.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{ref.detail}</p>
                </Link>
              )) : (
                <p className="text-sm text-slate-400">No direct supporting records found.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DecisionRail({ recommendation }: { recommendation: StoryIntelligenceRecommendation }) {
  return (
    <aside className="flex flex-col gap-4 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div>
        <h2 className="text-base font-semibold text-slate-950">Decision</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          This creates a structured Story Brief Artifact only. It does not generate a campaign or publish anything.
        </p>
      </div>

      <div className="rounded-2xl bg-emerald-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Recommended action</p>
        <p className="mt-2 text-sm font-semibold text-emerald-950">{recommendation.nextAction.label}</p>
      </div>

      <GenerateStoryBriefButton opportunityId={recommendation.opportunityId} />

      <div className="border-t border-black/5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Trust contract</p>
        <ul className="mt-3 grid gap-2 text-sm leading-5 text-slate-600">
          <li>No opaque AI scoring.</li>
          <li>Every signal points to a record or deterministic score reason.</li>
          <li>Story Brief approval does not create downstream content.</li>
        </ul>
      </div>
    </aside>
  );
}

function RankedRecommendation({ recommendation, rank }: { recommendation: StoryIntelligenceRecommendation; rank: number }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-black/5 p-4 lg:grid-cols-[48px_minmax(0,1fr)_150px] lg:items-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
        {rank}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-950">{recommendation.recommendedStory}</h3>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            {recommendation.businessGoal}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{recommendation.why[0]}</p>
      </div>
      <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
        <p className="text-2xl font-semibold tabular-nums text-slate-950">{recommendation.score}</p>
        <p className="text-xs text-slate-500">Base {recommendation.baseStoryScore} + Signals {recommendation.recommendationBonus}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="rounded-[24px] border border-dashed border-slate-200 bg-white/90 p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-950">No story recommendations yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Story Intelligence needs open story opportunities. Add or detect opportunities from the Founder Journal, then this page will rank them with explainable signals.
      </p>
      <Link
        href="/dashboard/story-engine/opportunities"
        className="mt-5 inline-flex rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Open Opportunities
      </Link>
    </section>
  );
}
