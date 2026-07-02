'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform = 'Instagram' | 'TikTok' | 'Facebook' | 'Email' | 'All';
type Goal = 'Generate Leads' | 'Build Trust' | 'Showcase Service' | 'Community Story' | 'Fundraising';

type ApprovedLearning = {
  id: string;
  goal: string;
  campaign_title: string;
  what_worked: Array<{ title: string; detail: string; evidence: string; signalType: string }>;
};

type PackageOutput = {
  story_brief?: string;
  hooks?: string[];
  video_script?: string;
  caption?: string;
  cta?: string;
  campaign_post?: string;
  teleprompter?: string;
  [key: string]: unknown;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = ['Instagram', 'TikTok', 'Facebook', 'Email', 'All'];
const GOALS: Goal[] = ['Generate Leads', 'Build Trust', 'Showcase Service', 'Community Story', 'Fundraising'];

const OUTPUT_TYPES: Array<{ key: keyof PackageOutput; label: string }> = [
  { key: 'story_brief',    label: 'Story Brief' },
  { key: 'hooks',          label: 'Hook Options' },
  { key: 'video_script',   label: 'Short-form Video Script' },
  { key: 'caption',        label: 'Caption' },
  { key: 'cta',            label: 'CTA' },
  { key: 'campaign_post',  label: 'Campaign Post' },
  { key: 'teleprompter',   label: 'Teleprompter Script' },
];

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Output card ───────────────────────────────────────────────────────────────

function OutputCard({ label, content }: { label: string; content: string | string[] }) {
  const displayText = Array.isArray(content) ? content.join('\n') : content;
  const isHooks = Array.isArray(content);

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: '#EFF6FF', color: '#1D4ED8' }}
        >
          {label}
        </span>
        <CopyButton text={displayText} />
      </div>

      {isHooks ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(content as string[]).map((hook, i) => (
            <span
              key={i}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              {hook}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{displayText}</p>
      )}
    </div>
  );
}

// ── Approved learnings strip ──────────────────────────────────────────────────

function LearningsStrip({ learnings }: { learnings: ApprovedLearning[] }) {
  if (learnings.length === 0) return null;

  const lessons = learnings.flatMap((l) =>
    l.what_worked.slice(0, 1).map((w) => w.title || w.detail)
  ).filter(Boolean).slice(0, 3);

  if (lessons.length === 0) return null;

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        What worked before
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {lessons.map((lesson, i) => (
          <span
            key={i}
            className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
          >
            {lesson}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function ContentPackageClient({
  initialLearnings,
}: {
  initialLearnings: ApprovedLearning[];
}) {
  const searchParams = useSearchParams();
  const ideaId = searchParams?.get('idea_id') ?? null;
  const reuseId = searchParams?.get('reuse') ?? null;

  const [ideaTitle, setIdeaTitle] = useState('');
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [goal, setGoal] = useState<Goal>('Generate Leads');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<PackageOutput | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // Pre-fill from ?idea_id= param
  useEffect(() => {
    if (!ideaId) return;
    fetch(`/api/content-ideas/${ideaId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.title) setIdeaTitle(data.title);
        if (data?.platform_fit) setPlatform((data.platform_fit as Platform) || 'Instagram');
        if (data?.notes) {
          // notes are surfaced in context but we don't have a separate field for them
        }
      })
      .catch(() => {});
  }, [ideaId]);

  // Pre-fill from ?reuse= param
  useEffect(() => {
    if (!reuseId) return;
    fetch(`/api/content-library?item_type=artifact&q=`)
      .then((r) => r.json())
      .then((data) => {
        const item = (data?.items ?? []).find((i: { id: string }) => i.id === reuseId);
        if (item) {
          if (item.title) setIdeaTitle(item.title);
          if (item.platform) setPlatform((item.platform as Platform) || 'Instagram');
        }
      })
      .catch(() => {});
  }, [reuseId]);

  async function handleGenerate() {
    if (!ideaTitle.trim()) {
      toast.error('Add an idea title first');
      return;
    }
    setLoading(true);
    setOutput(null);
    try {
      const approvedLessons = initialLearnings
        .flatMap((l) => l.what_worked.map((w) => w.title || w.detail))
        .filter(Boolean)
        .slice(0, 5);

      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'content-agent',
          input: {
            goal,
            idea_title: ideaTitle.trim(),
            platform,
            approved_learnings: approvedLessons,
            output_types: [
              'story_brief',
              'hooks',
              'video_script',
              'caption',
              'cta',
              'campaign_post',
              'teleprompter',
            ],
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Agent run failed');
        return;
      }

      // Agent result may be nested under result.output or result directly
      const raw: Record<string, unknown> = data?.result?.output ?? data?.result ?? data ?? {};
      setOutput(raw as PackageOutput);
    } catch {
      toast.error('Failed to generate package');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveToLibrary() {
    if (!output || !ideaTitle.trim()) return;
    setSaving(true);
    try {
      const storyBrief = typeof output.story_brief === 'string' ? output.story_brief : '';
      const res = await fetch('/api/content-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ideaTitle.trim(),
          content_type: 'package',
          platform,
          goal,
          summary: storyBrief.slice(0, 150),
          tags: [platform, goal],
          status: 'draft',
          item_type: 'artifact',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save to library');
        return;
      }
      toast.success('Saved to library');
      setSavedToLibrary(true);
    } catch {
      toast.error('Failed to save to library');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Approved learnings strip */}
      <LearningsStrip learnings={initialLearnings} />

      {/* Step 1 — Context panel */}
      <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Step 1 — Context
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Idea title
            </label>
            <input
              type="text"
              placeholder="What's the content about?"
              value={ideaTitle}
              onChange={(e) => setIdeaTitle(e.target.value)}
              className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Goal</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                {GOALS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !ideaTitle.trim()}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: brand.accent }}
          >
            {loading ? 'Generating...' : 'Generate full package'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="rounded-[24px] border border-black/5 bg-white/90 p-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
          <p className="text-sm text-slate-500">Building your content package...</p>
        </div>
      )}

      {/* Step 2 — Package output */}
      {output && !loading && (
        <>
          <div className="flex flex-col gap-4">
            {OUTPUT_TYPES.map(({ key, label }) => {
              const value = output[key];
              if (!value) return null;
              const content = Array.isArray(value)
                ? value.map(String)
                : String(value);
              if ((Array.isArray(content) ? content.length === 0 : !content.trim())) return null;
              return <OutputCard key={key} label={label} content={content} />;
            })}
          </div>

          {/* Save to library */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveToLibrary}
              disabled={saving || savedToLibrary}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: brand.accent }}
            >
              {saving ? 'Saving...' : savedToLibrary ? 'Saved' : 'Save to Library'}
            </button>
            {savedToLibrary && (
              <Link
                href="/dashboard/content/library"
                className="text-sm font-semibold"
                style={{ color: brand.accent }}
              >
                View in library →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
