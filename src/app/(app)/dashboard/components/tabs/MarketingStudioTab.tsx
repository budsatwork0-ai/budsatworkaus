'use client';

/**
 * Marketing Studio — the home of the agent marketing team (Stanley Henry +
 * The Attention Seeker) inside /dashboard/insights.
 *
 * Self-contained tab: reads the marketing tables via the browser Supabase
 * client and degrades gracefully if migration 077 hasn't been applied yet
 * (shows an activation empty-state instead of breaking the page).
 *
 * Sections: Scoreboard · Today's Capture Brief · The Pod · Content Queue ·
 * Campaigns · Log Today's Numbers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClientSafe } from '@/lib/supabase/client';
import { brand } from '@/app/ui/theme';
import { Panel } from '../shared';

// ─── Types ──────────────────────────────────────────────────────────────────

type Channel = 'instagram' | 'tiktok' | 'facebook' | 'gbp' | 'combined';

type MetricRow = {
  snapshot_date: string;
  channel: string;
  views: number;
  engagements: number;
  followers: number;
  content_published: number;
};

type CampaignRow = {
  id: string;
  name: string;
  service_type: string | null;
  hook: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  goal_notes: string | null;
};

type BriefRow = {
  brief_date: string;
  job_context: string | null;
  shot_list: string[] | null;
  say_to_camera: string | null;
};

type DraftRow = {
  id: string;
  channel: string;
  title: string | null;
  body: string;
  status: string;
  created_at: string;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const CHANNELS: Array<{ key: Channel; label: string }> = [
  { key: 'combined', label: 'All channels' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'gbp', label: 'Google' },
];

const POD = [
  { initials: 'SH', name: 'Stanley Henry', role: 'Creative Director — premium ads & brand voice', color: '#0F3D2E', tone: 'review' as const },
  { initials: 'AS', name: 'The Attention Seeker', role: 'Growth & distribution — reach, hooks, followers', color: '#1C7C54', tone: 'live' as const },
  { initials: 'FP', name: 'Field Producer', role: 'Daily capture brief from today\'s jobs', color: '#3F7D5C', tone: 'live' as const },
  { initials: 'CA', name: 'Content Agent', role: 'Drafts posts per channel from footage', color: '#5B8A72', tone: 'review' as const },
  { initials: 'SK', name: 'Scoreboard Keeper', role: 'Tracks the numbers, flags what\'s working', color: '#7BA98F', tone: 'live' as const },
  { initials: 'CW', name: 'Competitor Watcher', role: 'Watches local rivals\' pages & offers', color: '#9CC2AE', tone: 'live' as const },
];

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: '#F1F7F3', fg: brand.muted, label: 'Draft' },
  approved: { bg: '#DDF3E4', fg: brand.accent, label: 'Approved' },
  scheduled: { bg: '#E0F2FE', fg: '#0369A1', label: 'Scheduled' },
  published: { bg: '#DDF3E4', fg: brand.accent, label: 'Published' },
  rejected: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' },
};

const today = () => new Date().toISOString().slice(0, 10);
const nDaysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600_000).toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString();

// ─── Component ──────────────────────────────────────────────────────────────

export default function MarketingStudioTab() {
  const supabase = useMemo(() => getSupabaseBrowserClientSafe(), []);
  const [tablesReady, setTablesReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<Channel>('combined');

  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [brief, setBrief] = useState<BriefRow | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  // manual log form
  const [logChannel, setLogChannel] = useState<Exclude<Channel, 'combined'>>('instagram');
  const [logViews, setLogViews] = useState('');
  const [logEng, setLogEng] = useState('');
  const [logFollowers, setLogFollowers] = useState('');
  const [logNote, setLogNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setTablesReady(false); setLoading(false); return; }
    setLoading(true);
    // New tables (migration 077) aren't in the generated Database types yet — use a loose handle.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    try {
      const [m, c, b, d] = await Promise.all([
        db.from('marketing_metrics').select('snapshot_date, channel, views, engagements, followers, content_published').gte('snapshot_date', nDaysAgo(30)).order('snapshot_date', { ascending: false }),
        db.from('marketing_campaigns').select('id, name, service_type, hook, starts_on, ends_on, status, goal_notes').order('starts_on', { ascending: true }),
        db.from('capture_briefs').select('brief_date, job_context, shot_list, say_to_camera').eq('brief_date', today()).maybeSingle(),
        db.from('content_drafts').select('id, channel, title, body, status, created_at').order('created_at', { ascending: false }).limit(12),
      ]);

      if (m.error && /relation .* does not exist|schema cache/i.test(m.error.message)) {
        setTablesReady(false);
        return;
      }
      setTablesReady(true);
      setMetrics((m.data as MetricRow[]) ?? []);
      setCampaigns((c.data as CampaignRow[]) ?? []);
      setBrief((b.data as BriefRow) ?? null);
      setDrafts((d.data as DraftRow[]) ?? []);
    } catch {
      setTablesReady(false);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  // ── KPI math ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const sevenAgo = nDaysAgo(7);
    const fourteenAgo = nDaysAgo(14);
    const inChannel = (r: MetricRow) => channel === 'combined' ? r.channel !== 'combined' : r.channel === channel;
    const rows = metrics.filter(inChannel);
    const last7 = rows.filter((r) => r.snapshot_date >= sevenAgo);
    const prev7 = rows.filter((r) => r.snapshot_date < sevenAgo && r.snapshot_date >= fourteenAgo);

    const sum = (rs: MetricRow[], k: keyof MetricRow) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const views = sum(last7, 'views');
    const viewsPrev = sum(prev7, 'views');
    const eng = sum(last7, 'engagements');
    const published = sum(last7, 'content_published');
    // followers = latest snapshot value per channel (not a sum over days)
    const latestByChannel = new Map<string, number>();
    [...rows].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)).forEach((r) => latestByChannel.set(r.channel, Number(r.followers) || 0));
    const followers = Array.from(latestByChannel.values()).reduce((a, v) => a + v, 0);

    const viewsDelta = viewsPrev > 0 ? Math.round(((views - viewsPrev) / viewsPrev) * 100) : null;
    const engRate = views > 0 ? Math.round((eng / views) * 1000) / 10 : 0;

    // publish streak across the selected channel
    const byDate = new Map<string, number>();
    rows.forEach((r) => byDate.set(r.snapshot_date, (byDate.get(r.snapshot_date) ?? 0) + (Number(r.content_published) || 0)));
    let streak = 0;
    for (let i = 0; i < 30; i += 1) {
      if ((byDate.get(nDaysAgo(i)) ?? 0) > 0) streak += 1; else break;
    }

    return { views, viewsDelta, eng, engRate, published, followers, streak };
  }, [metrics, channel]);

  const approve = useCallback(async (id: string) => {
    if (!supabase) return;
    setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, status: 'approved' } : d));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('content_drafts').update({ status: 'approved' }).eq('id', id);
  }, [supabase]);

  const saveNumbers = useCallback(async () => {
    if (!supabase) return;
    setSaving(true); setLogNote(null);
    const row = {
      snapshot_date: today(),
      channel: logChannel,
      views: Number(logViews) || 0,
      engagements: Number(logEng) || 0,
      followers: Number(logFollowers) || 0,
      source: 'manual' as const,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('marketing_metrics').upsert(row, { onConflict: 'snapshot_date,channel' });
    setSaving(false);
    if (error) { setLogNote(`Couldn't save: ${error.message}`); return; }
    setLogNote(`Saved ✓ ${fmt(row.views)} views logged for ${logChannel} today.`);
    setLogViews(''); setLogEng(''); setLogFollowers('');
    void load();
  }, [supabase, logChannel, logViews, logEng, logFollowers, load]);

  // ── Activation empty-state (migration not applied yet) ─────────────────────
  if (!tablesReady && !loading) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/10 bg-white/80 p-8 text-center">
        <p className="text-sm font-semibold" style={{ color: brand.primary }}>Marketing Studio is ready to switch on</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          The agent team and dashboard are built. Apply migration{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">077_marketing_studio.sql</code>{' '}
          to create the metrics, campaigns and capture-brief tables, then this tab goes live.
        </p>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Views', value: fmt(kpis.views), pill: kpis.viewsDelta === null ? 'last 7 days' : `${kpis.viewsDelta >= 0 ? '▲' : '▼'} ${Math.abs(kpis.viewsDelta)}% vs prev 7d`, up: (kpis.viewsDelta ?? 0) >= 0 },
    { label: 'Engagements', value: fmt(kpis.eng), pill: `${kpis.engRate}% engagement rate`, up: true },
    { label: 'Content Published', value: fmt(kpis.published), pill: kpis.streak > 0 ? `▲ ${kpis.streak}-day streak` : 'no streak yet', up: kpis.streak > 0 },
    { label: 'Followers', value: fmt(kpis.followers), pill: 'current total', up: true },
  ];

  return (
    <div className="grid gap-5">
      {/* Scoreboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Scoreboard · last 7 days</p>
          <p className="text-sm text-slate-500">The four numbers the whole team optimises for.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => {
            const on = c.key === channel;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setChannel(c.key)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                style={on
                  ? { background: brand.accentSoft, borderColor: brand.focus, color: brand.accent }
                  : { background: '#fff', borderColor: brand.border, color: brand.muted }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{k.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900">{loading ? '—' : k.value}</p>
            <div className="mt-3">
              <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: k.up ? brand.accentSoft : '#FEE2E2', color: k.up ? brand.accent : '#B91C1C' }}>
                {k.pill}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        {/* LEFT */}
        <div className="grid gap-5">
          {/* Capture brief */}
          <Panel title="Today's Capture Brief" subtitle="From the Field Producer — what to film on the job today.">
            {brief ? (
              <div className="rounded-[18px] border p-4" style={{ borderColor: brand.border, background: brand.surfaceAlt }}>
                {brief.job_context ? (
                  <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: brand.accent }}>{brief.job_context}</p>
                ) : null}
                <ol className="mt-3 space-y-2">
                  {(brief.shot_list ?? []).map((shot, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: brand.accent }}>{i + 1}</span>
                      <span>{shot}</span>
                    </li>
                  ))}
                </ol>
                {brief.say_to_camera ? (
                  <p className="mt-3 rounded-[14px] border border-dashed bg-white px-3 py-2.5 text-sm italic" style={{ borderColor: brand.focus }}>
                    &ldquo;{brief.say_to_camera}&rdquo;
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                No brief yet today. The Field Producer posts one each morning from the day&rsquo;s scheduled jobs.
              </div>
            )}
          </Panel>

          {/* Content queue */}
          <Panel title="Content Queue" subtitle="Drafts from the team. One tap to approve." right={`${drafts.filter((d) => d.status === 'draft').length} awaiting you`}>
            {drafts.length > 0 ? (
              <div className="divide-y" style={{ borderColor: brand.border }}>
                {drafts.map((d) => {
                  const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.draft;
                  return (
                    <div key={d.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{d.title || d.body.slice(0, 60)}</p>
                        <p className="mt-0.5 text-xs capitalize text-slate-500">{d.channel}</p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                      {d.status === 'draft' ? (
                        <button type="button" onClick={() => void approve(d.id)} className="rounded-[11px] px-3 py-1.5 text-xs font-bold text-white" style={{ background: brand.accent }}>
                          Approve
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                Nothing queued. Stanley Henry and the Content Agent fill this from real job footage.
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT */}
        <div className="grid gap-5">
          {/* The pod */}
          <Panel title="The Pod" subtitle="Your marketing team. Reports to Bud.">
            <div className="grid gap-2.5">
              {POD.map((a) => (
                <div key={a.name} className="flex items-center gap-3 rounded-[14px] border p-3" style={{ borderColor: brand.border }}>
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-sm font-extrabold text-white" style={{ background: a.color }}>{a.initials}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{a.name}</p>
                    <p className="truncate text-xs text-slate-500">{a.role}</p>
                  </div>
                  <span className="flex flex-none items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold"
                    style={a.tone === 'live' ? { background: brand.accentSoft, color: brand.accent } : { background: '#FEF3C7', color: '#B45309' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
                    {a.tone === 'live' ? 'Live' : 'Review'}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Campaigns */}
          <Panel title="Campaigns" subtitle="Active and upcoming marketing pushes.">
            {campaigns.length > 0 ? (
              <div className="grid gap-3">
                {campaigns.map((c) => (
                  <div key={c.id} className="rounded-[16px] border p-4" style={{ borderColor: brand.border, background: brand.surface }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-extrabold" style={{ color: brand.primary }}>{c.name}</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold capitalize" style={{ background: '#fff', color: brand.muted }}>{c.status}</span>
                    </div>
                    {c.hook ? <p className="mt-1 text-sm font-semibold italic" style={{ color: brand.accent }}>&ldquo;{c.hook}&rdquo;</p> : null}
                    {c.goal_notes ? <p className="mt-2 text-xs text-slate-500">{c.goal_notes}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/10 bg-white/70 px-4 py-6 text-sm text-slate-500">
                No campaigns yet. &ldquo;Streak-Free July&rdquo; seeds with migration 077.
              </div>
            )}
          </Panel>

          {/* Manual log */}
          <Panel title="Log Today's Numbers" subtitle="Manual for now. Platform APIs auto-fill this later.">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Channel
                  <select value={logChannel} onChange={(e) => setLogChannel(e.target.value as Exclude<Channel, 'combined'>)}
                    className="mt-1.5 w-full rounded-[11px] border bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900" style={{ borderColor: brand.border }}>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="facebook">Facebook</option>
                    <option value="gbp">Google</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Views
                  <input value={logViews} onChange={(e) => setLogViews(e.target.value)} type="number" inputMode="numeric" placeholder="0"
                    className="mt-1.5 w-full rounded-[11px] border bg-white px-3 py-2 text-sm font-normal text-slate-900" style={{ borderColor: brand.border }} />
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Engagements
                  <input value={logEng} onChange={(e) => setLogEng(e.target.value)} type="number" inputMode="numeric" placeholder="0"
                    className="mt-1.5 w-full rounded-[11px] border bg-white px-3 py-2 text-sm font-normal text-slate-900" style={{ borderColor: brand.border }} />
                </label>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Followers
                  <input value={logFollowers} onChange={(e) => setLogFollowers(e.target.value)} type="number" inputMode="numeric" placeholder="0"
                    className="mt-1.5 w-full rounded-[11px] border bg-white px-3 py-2 text-sm font-normal text-slate-900" style={{ borderColor: brand.border }} />
                </label>
              </div>
              <button type="button" onClick={() => void saveNumbers()} disabled={saving}
                className="rounded-[11px] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: brand.accent }}>
                {saving ? 'Saving…' : 'Save today\'s numbers'}
              </button>
              <p className="text-xs text-slate-500">
                {logNote ?? 'Content Published is counted automatically from the queue — no typing needed.'}
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
