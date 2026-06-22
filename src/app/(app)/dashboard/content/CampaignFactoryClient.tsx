'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CAMPAIGN_FACTORY_GOALS, type CampaignFactoryGoal } from '@/types/campaign-factory-mvp';
import { type StoryIntelligenceRecommendation } from '@/types/story-intelligence';

type ArtifactResult = {
  id: string;
  type: string;
  title: string;
  summary: string;
  status: string;
  score: number | null;
};

type StepState = 'idle' | 'running' | 'done';

type Props = {
  initialRecommendations: StoryIntelligenceRecommendation[];
  initialRuns: Array<{ id: string; goal: string; title: string; status: string; current_step: string }>;
  initialArtifacts: ArtifactResult[];
};

export function CampaignFactoryClient({ initialRecommendations, initialRuns, initialArtifacts }: Props) {
  const [goal, setGoal] = useState<CampaignFactoryGoal>('Generate Leads');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(initialRecommendations[0]?.opportunityId ?? '');
  const [runId, setRunId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactResult[]>([]);
  const [researchState, setResearchState] = useState<StepState>('idle');
  const [strategyState, setStrategyState] = useState<StepState>('idle');
  const [campaignState, setCampaignState] = useState<StepState>('idle');
  const [approving, setApproving] = useState(false);

  const selectedRecommendation = useMemo(
    () => initialRecommendations.find((item) => item.opportunityId === selectedOpportunityId) ?? initialRecommendations[0] ?? null,
    [initialRecommendations, selectedOpportunityId],
  );

  const primaryCampaignArtifact = artifacts.find((artifact) => artifact.type === 'campaign') ?? null;

  async function startRun() {
    if (!selectedRecommendation) {
      toast.error('Select a Story Intelligence recommendation first');
      return null;
    }

    const res = await fetch('/api/campaign-factory/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        title: `${selectedRecommendation.recommendedStory} · ${goal}`,
        status: 'collecting_signals',
        current_step: 'recommended_story',
        selected_story_opportunity_id: selectedRecommendation.opportunityId,
        signals: {
          recommendation: selectedRecommendation,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to start Campaign Factory run');
      return null;
    }
    setRunId(data.id);
    return data.id as string;
  }

  async function runStep(step: 'research' | 'strategy' | 'campaign-artifact', activeRunId: string) {
    const res = await fetch(`/api/campaign-factory/runs/${activeRunId}/${step}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Failed to run ${step}`);
    setArtifacts((prev) => [...prev, data.artifact]);
    return data;
  }

  async function generateCampaign() {
    setArtifacts([]);
    setResearchState('running');
    setStrategyState('idle');
    setCampaignState('idle');

    try {
      const activeRunId = runId ?? await startRun();
      if (!activeRunId) return;

      await runStep('research', activeRunId);
      setResearchState('done');
      setStrategyState('running');

      await runStep('strategy', activeRunId);
      setStrategyState('done');
      setCampaignState('running');

      await runStep('campaign-artifact', activeRunId);
      setCampaignState('done');
      toast.success('Campaign artifacts generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate campaign artifacts');
      if (researchState === 'running') setResearchState('idle');
      if (strategyState === 'running') setStrategyState('idle');
      if (campaignState === 'running') setCampaignState('idle');
    }
  }

  async function approveCampaignArtifact() {
    if (!primaryCampaignArtifact || !runId) return;
    setApproving(true);
    try {
      const artifactRes = await fetch(`/api/artifacts/${primaryCampaignArtifact.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_note: 'Approved in Campaign Factory MVP. No downstream automation triggered.' }),
      });
      const artifactData = await artifactRes.json();
      if (!artifactRes.ok) throw new Error(artifactData.error ?? 'Failed to approve artifact');

      const runRes = await fetch(`/api/campaign-factory/runs/${runId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          approval_state: {
            approved_artifact_id: primaryCampaignArtifact.id,
            boundary: 'approval_stops_at_artifact',
          },
        }),
      });
      const runData = await runRes.json();
      if (!runRes.ok) throw new Error(runData.error ?? 'Failed to approve Campaign Factory run');

      setArtifacts((prev) => prev.map((artifact) =>
        artifact.id === primaryCampaignArtifact.id ? { ...artifact, status: 'approved' } : artifact,
      ));
      toast.success('Campaign artifact approved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Goal-first workflow</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Goal → Recommended Story → Research → Strategy → Campaign Artifact → Approve</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Campaign Factory stops at structured artifact approval. It does not create content ideas, scripts, production cards, publishing queue items, scheduling, or social posts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/content/story-intelligence"
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              Story Intelligence
            </Link>
            <Link
              href="/dashboard/content/library"
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              Content Library
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="flex flex-col gap-5">
          <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <h2 className="text-base font-semibold text-slate-950">1. Select Business Goal</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {CAMPAIGN_FACTORY_GOALS.map((item) => {
                const active = item === goal;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setGoal(item)}
                    className="rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition"
                    style={active
                      ? { background: '#022c22', borderColor: '#022c22', color: '#fff' }
                      : { background: '#fff', borderColor: 'rgba(15,23,42,0.08)', color: '#334155' }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">2. Choose Recommended Story</h2>
                <p className="mt-1 text-sm text-slate-500">Story Intelligence provides the ranked, explainable source signal.</p>
              </div>
              {selectedRecommendation ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {selectedRecommendation.score}/100
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              {initialRecommendations.length > 0 ? initialRecommendations.map((recommendation) => {
                const active = recommendation.opportunityId === selectedOpportunityId;
                return (
                  <button
                    key={recommendation.id}
                    type="button"
                    onClick={() => setSelectedOpportunityId(recommendation.opportunityId)}
                    className="rounded-2xl border p-4 text-left transition hover:bg-slate-50"
                    style={active
                      ? { borderColor: '#059669', boxShadow: 'inset 0 0 0 1px rgba(5,150,105,0.35)' }
                      : { borderColor: 'rgba(15,23,42,0.08)' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">{recommendation.recommendedStory}</h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {recommendation.businessGoal}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{recommendation.why[0]}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {recommendation.scoreFormula}
                    </p>
                  </button>
                );
              }) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No Story Intelligence recommendations available yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">3. Generate Artifacts</h2>
                <p className="mt-1 text-sm text-slate-500">Creates Research, Strategy, and Campaign artifacts for review.</p>
              </div>
              <button
                type="button"
                onClick={generateCampaign}
                disabled={!selectedRecommendation || researchState === 'running' || strategyState === 'running' || campaignState === 'running'}
                className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Generate Campaign Artifact
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <WorkflowStep label="Research Artifact" state={researchState} />
              <WorkflowStep label="Strategy Artifact" state={strategyState} />
              <WorkflowStep label="Campaign Artifact" state={campaignState} />
            </div>
          </section>

          {artifacts.length > 0 ? (
            <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Artifacts For Review</h2>
                  <p className="mt-1 text-sm text-slate-500">Open each artifact to review the structured output.</p>
                </div>
                {primaryCampaignArtifact ? (
                  <button
                    type="button"
                    onClick={approveCampaignArtifact}
                    disabled={approving || primaryCampaignArtifact.status === 'approved'}
                    className="rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {primaryCampaignArtifact.status === 'approved' ? 'Approved' : approving ? 'Approving...' : 'Approve Campaign Artifact'}
                  </button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3">
                {artifacts.map((artifact) => (
                  <Link
                    key={artifact.id}
                    href={`/dashboard/content/artifacts/${artifact.id}`}
                    className="rounded-2xl border border-black/5 p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">{artifact.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{artifact.type}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{artifact.status}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-slate-600">{artifact.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="flex flex-col gap-5">
          <BoundaryCard />
          <RecentList title="Recent Runs" empty="No Campaign Factory runs yet." items={initialRuns.map((run) => ({
            id: run.id,
            title: run.title || run.goal,
            detail: `${run.status} · ${run.current_step}`,
          }))} />
          <RecentList title="Recent Artifacts" empty="No artifacts yet." items={initialArtifacts.map((artifact) => ({
            id: artifact.id,
            title: artifact.title,
            detail: `${artifact.type} · ${artifact.status}`,
            href: `/dashboard/content/artifacts/${artifact.id}`,
          }))} />
        </aside>
      </div>
    </div>
  );
}

function WorkflowStep({ label, state }: { label: string; state: StepState }) {
  const status = state === 'done' ? 'Done' : state === 'running' ? 'Running' : 'Waiting';
  const styles = state === 'done'
    ? 'bg-emerald-50 text-emerald-700'
    : state === 'running'
    ? 'bg-amber-50 text-amber-700'
    : 'bg-slate-100 text-slate-500';

  return (
    <div className="rounded-2xl border border-black/5 p-4">
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>
        {status}
      </span>
    </div>
  );
}

function BoundaryCard() {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-base font-semibold text-slate-950">Batch 4 Boundary</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-5 text-slate-600">
        <li>Preserve artifacts.</li>
        <li>Show campaign history.</li>
        <li>Show version visibility.</li>
        <li>Carry performance metadata.</li>
        <li>Build organisational memory.</li>
        <li>No publishing.</li>
        <li>No scheduling.</li>
        <li>No social integrations.</li>
        <li>No queue automation.</li>
      </ul>
    </section>
  );
}

function RecentList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; detail: string; href?: string }>;
}) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.length > 0 ? items.map((item) => {
          const content = (
            <>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
            </>
          );
          return item.href ? (
            <Link key={item.id} href={item.href} className="rounded-2xl border border-black/5 p-3 transition hover:bg-slate-50">
              {content}
            </Link>
          ) : (
            <div key={item.id} className="rounded-2xl border border-black/5 p-3">
              {content}
            </div>
          );
        }) : (
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </section>
  );
}
