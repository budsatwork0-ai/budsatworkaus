import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ImprovementItem = {
  id: string;
  title: string;
  issue: string;
  root_cause: string | null;
  source: 'vault' | 'graphify' | 'manual' | 'agent';
  evidence_type: string | null;
  evidence_ref: string | null;
  affected_files: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  rollback_plan: string | null;
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';
  created_at: string;
};

export type ImprovementsResponse = {
  items: ImprovementItem[];
  totals: { open: number; in_progress: number; completed: number; dismissed: number };
};

// ── Vault-derived improvements ────────────────────────────────────────────────

function vaultImprovements(): ImprovementItem[] {
  const refactorDir = path.join(process.cwd(), 'Buds At Work', 'architecture', 'Refactor Plans');
  const items: ImprovementItem[] = [];

  if (!fs.existsSync(refactorDir)) return items;

  const files = fs.readdirSync(refactorDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    try {
      const fullPath = path.join(refactorDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const stat = fs.statSync(fullPath);
      const title = file.replace(/\.md$/, '');

      // Extract first meaningful paragraph as the issue
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('tags:'));
      const issue = lines[0]?.trim() ?? title;

      // Infer risk from content
      const upper = content.toUpperCase();
      const risk_level: ImprovementItem['risk_level'] =
        upper.includes('CRITICAL') ? 'critical' :
        upper.includes('HIGH')     ? 'high' :
        upper.includes('MEDIUM')   ? 'medium' : 'low';

      items.push({
        id: `vault-${file}`,
        title,
        issue: issue.slice(0, 200),
        root_cause: null,
        source: 'vault',
        evidence_type: 'obsidian_note',
        evidence_ref: path.join('Buds At Work', 'architecture', 'Refactor Plans', file),
        affected_files: [],
        risk_level,
        rollback_plan: null,
        status: 'open',
        created_at: stat.mtime.toISOString(),
      });
    } catch { /* skip unreadable */ }
  }

  return items;
}

// ── Graphify-derived improvements (god node hotspots) ─────────────────────────

function graphifyImprovements(): ImprovementItem[] {
  const reportPath = path.join(process.cwd(), 'graphify-out', 'GRAPH_REPORT.md');
  if (!fs.existsSync(reportPath)) return [];

  const content = fs.readFileSync(reportPath, 'utf-8');
  const godSection = content.match(/## God Nodes[\s\S]*?(?=\n## )/);
  if (!godSection) return [];

  const items: ImprovementItem[] = [];
  const lines = godSection[0].split('\n').filter(l => /^\d+\./.test(l.trim()));

  for (const line of lines.slice(0, 8)) {
    const m = line.match(/^(\d+)\.\s+`([^`]+)`\s+-\s+(\d+)\s+edges?/);
    if (!m) continue;
    const [, rank, name, edgesStr] = m;
    const edges = Number(edgesStr);

    // Skip community meta-nodes
    if (name.toLowerCase().includes('communit')) continue;

    const risk_level: ImprovementItem['risk_level'] =
      edges > 200 ? 'critical' :
      edges > 100 ? 'high' :
      edges > 60  ? 'medium' : 'low';

    items.push({
      id: `graphify-${rank}-${name.replace(/[^a-z0-9]/gi, '-')}`,
      title: `High coupling: ${name}`,
      issue: `${name} has ${edges} edges — it is a god node and a change blast radius risk.`,
      root_cause: `Too many files depend on or are depended on by ${name}. Any change propagates widely.`,
      source: 'graphify',
      evidence_type: 'graphify',
      evidence_ref: `God node #${rank}: ${name} (${edges} edges)`,
      affected_files: [name],
      risk_level,
      rollback_plan: 'Extract incrementally using Bud Factory with Bud Researcher blast-radius check first.',
      status: 'open',
      created_at: fs.statSync(reportPath).mtime.toISOString(),
    });
  }

  return items;
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<ImprovementsResponse>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ items: [], totals: { open: 0, in_progress: 0, completed: 0, dismissed: 0 } }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: manual } = await supabase
    .from('bud_improvements')
    .select('id, title, issue, root_cause, source, evidence_type, evidence_ref, affected_files, risk_level, rollback_plan, status, created_at')
    .order('created_at', { ascending: false });

  const items: ImprovementItem[] = [
    ...(manual ?? []) as ImprovementItem[],
    ...vaultImprovements(),
    ...graphifyImprovements(),
  ];

  const totals = {
    open:        items.filter(i => i.status === 'open').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    completed:   items.filter(i => i.status === 'completed').length,
    dismissed:   items.filter(i => i.status === 'dismissed').length,
  };

  return NextResponse.json({ items, totals });
}

export async function POST(req: NextRequest): Promise<NextResponse<{ id: string } | { error: string }>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json() as Partial<ImprovementItem>;
  if (!body.title?.trim() || !body.issue?.trim()) {
    return NextResponse.json({ error: 'title and issue are required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from('bud_improvements')
    .insert({
      title:          body.title.trim(),
      issue:          body.issue.trim(),
      root_cause:     body.root_cause?.trim() ?? null,
      source:         'manual',
      evidence_type:  body.evidence_type ?? null,
      evidence_ref:   body.evidence_ref ?? null,
      affected_files: body.affected_files ?? [],
      risk_level:     body.risk_level ?? 'low',
      rollback_plan:  body.rollback_plan?.trim() ?? null,
      status:         'open',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: NextRequest): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id, status } = await req.json() as { id: string; status: string };
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase
    .from('bud_improvements')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
