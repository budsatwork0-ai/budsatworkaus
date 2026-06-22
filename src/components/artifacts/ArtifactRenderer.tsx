import { type ArtifactContent, type ArtifactVersion } from '@/types/artifact';

type RendererProps = {
  content: ArtifactContent;
  version?: Pick<ArtifactVersion, 'version_number' | 'created_at' | 'checksum'> | null;
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

export function ArtifactRenderer({ content, version }: RendererProps) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="border-b border-black/5 bg-slate-50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Structured Artifact · {content.artifactType.replace(/_/g, ' ')}
          </p>
          {version ? (
            <p className="font-mono text-[11px] text-slate-400">
              v{version.version_number} · {version.checksum.slice(0, 10)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-black/5">
        {content.blocks.map((block) => {
          switch (block.type) {
            case 'hero':
              return <HeroBlock key={block.id} data={block.data} />;
            case 'summary':
              return <SummaryBlock key={block.id} title={block.title} data={block.data} />;
            case 'scorecard':
              return <ScorecardBlock key={block.id} title={block.title} data={block.data} />;
            case 'insight_list':
              return <InsightListBlock key={block.id} title={block.title} data={block.data} />;
            case 'recommendation_list':
              return <RecommendationListBlock key={block.id} title={block.title} data={block.data} />;
            case 'channel_plan':
              return <ChannelPlanBlock key={block.id} title={block.title} data={block.data} />;
            case 'timeline':
              return <TimelineBlock key={block.id} title={block.title} data={block.data} />;
            case 'asset_list':
              return <AssetListBlock key={block.id} title={block.title} data={block.data} />;
            case 'metric_grid':
              return <MetricGridBlock key={block.id} title={block.title} data={block.data} />;
            case 'decision_panel':
              return <DecisionPanelBlock key={block.id} title={block.title} data={block.data} />;
            default:
              return null;
          }
        })}
      </div>
    </article>
  );
}

function BlockShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-5">
      {title ? <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2> : null}
      {children}
    </section>
  );
}

function HeroBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <section className="bg-emerald-950 px-5 py-7 text-white">
      {text(data.eyebrow) ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">{text(data.eyebrow)}</p>
      ) : null}
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
        <div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.03em]">{text(data.heading, 'Untitled artifact')}</h1>
          {text(data.subheading) ? <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">{text(data.subheading)}</p> : null}
        </div>
        {text(data.primaryMetricValue) ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-100">{text(data.primaryMetricLabel, 'Score')}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{text(data.primaryMetricValue)}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const bullets = stringArray(data.bullets);
  return (
    <BlockShell title={title}>
      <p className="max-w-3xl text-sm leading-6 text-slate-600">{text(data.body)}</p>
      {bullets.length > 0 ? (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="rounded-2xl border border-black/5 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </BlockShell>
  );
}

function ScorecardBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const score = Math.max(0, Math.min(100, number(data.score)));
  const reasons = stringArray(data.reasons);
  return (
    <BlockShell title={title}>
      <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
        <div className="rounded-2xl bg-emerald-50 p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{text(data.label, 'Potential')}</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-emerald-950">{score}</p>
          <div className="mt-3 h-2 rounded-full bg-emerald-100">
            <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${score}%` }} />
          </div>
        </div>
        <div className="grid gap-2">
          {reasons.map((reason) => (
            <div key={reason} className="rounded-2xl border border-black/5 px-4 py-3 text-sm text-slate-700">
              {reason}
            </div>
          ))}
        </div>
      </div>
    </BlockShell>
  );
}

function InsightListBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const insights = objectArray(data.insights);
  return (
    <BlockShell title={title ?? 'Research Findings'}>
      <div className="grid gap-3">
        {insights.map((insight, index) => (
          <div key={`${text(insight.title)}-${index}`} className="rounded-2xl border border-black/5 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">{text(insight.title)}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{text(insight.detail)}</p>
            {text(insight.source) ? <p className="mt-2 text-[11px] font-mono text-slate-400">{text(insight.source)}</p> : null}
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

function RecommendationListBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const recommendations = objectArray(data.recommendations);
  return (
    <BlockShell title={title ?? 'Recommendations'}>
      <div className="grid gap-3">
        {recommendations.map((item, index) => {
          const priority = text(item.priority, 'medium');
          return (
            <div key={`${text(item.title)}-${index}`} className="rounded-2xl border border-black/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{text(item.title)}</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.medium}`}>
                  {priority}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text(item.rationale)}</p>
            </div>
          );
        })}
      </div>
    </BlockShell>
  );
}

function ChannelPlanBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const channels = objectArray(data.channels);
  return (
    <BlockShell title={title ?? 'Channel Plan'}>
      <div className="grid gap-3 md:grid-cols-2">
        {channels.map((channel, index) => (
          <div key={`${text(channel.platform)}-${index}`} className="rounded-2xl border border-black/5 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{text(channel.platform)}</p>
            <h3 className="mt-2 text-sm font-semibold text-slate-900">{text(channel.format)}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text(channel.angle)}</p>
            {text(channel.cadence) ? <p className="mt-3 text-xs font-medium text-emerald-700">{text(channel.cadence)}</p> : null}
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

function TimelineBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const items = objectArray(data.items);
  return (
    <BlockShell title={title ?? 'Timeline'}>
      <div className="grid gap-3">
        {items.map((item, index) => (
          <div key={`${text(item.label)}-${index}`} className="grid gap-2 rounded-2xl border border-black/5 px-4 py-3 md:grid-cols-[160px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">{text(item.label)}</p>
              {text(item.date) ? <p className="mt-1 text-xs text-slate-500">{text(item.date)}</p> : null}
            </div>
            <p className="text-sm leading-6 text-slate-600">{text(item.detail)}</p>
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

function AssetListBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const assets = objectArray(data.assets);
  return (
    <BlockShell title={title ?? 'Assets'}>
      <div className="grid gap-3 md:grid-cols-2">
        {assets.map((asset, index) => (
          <div key={`${text(asset.title)}-${index}`} className="rounded-2xl border border-black/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{text(asset.title)}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{text(asset.type)}</span>
              {text(asset.status) ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{text(asset.status)}</span> : null}
            </div>
            {text(asset.note) ? <p className="mt-2 text-sm leading-6 text-slate-600">{text(asset.note)}</p> : null}
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

function MetricGridBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const metrics = objectArray(data.metrics);
  return (
    <BlockShell title={title ?? 'Metrics'}>
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.map((metric, index) => (
          <div key={`${text(metric.label)}-${index}`} className="rounded-2xl border border-black/5 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{text(metric.label)}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{text(metric.value)}</p>
            {text(metric.detail) ? <p className="mt-1 text-xs text-slate-500">{text(metric.detail)}</p> : null}
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

function DecisionPanelBlock({ title, data }: { title?: string; data: Record<string, unknown> }) {
  const options = stringArray(data.options);
  return (
    <BlockShell title={title ?? 'Decision'}>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-950">{text(data.decision)}</p>
        {options.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => (
              <span key={option} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800">
                {option}
              </span>
            ))}
          </div>
        ) : null}
        {text(data.approvalNote) ? <p className="mt-3 text-sm leading-6 text-emerald-800">{text(data.approvalNote)}</p> : null}
      </div>
    </BlockShell>
  );
}
