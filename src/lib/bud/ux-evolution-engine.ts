export type UxEvolutionSource = 'admin_ux_proposal' | 'design_insight' | 'agent_evolution' | 'bud_insight' | 'memory' | 'failed_run';

export type UxEvolutionRecommendation = {
  id: string;
  source: UxEvolutionSource;
  source_id: string;
  title: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'reviewing' | 'accepted' | 'rejected' | 'shipped' | 'pending' | 'approved' | 'applied';
  affected_area: string;
  proposed_change: unknown;
  created_at: string;
  can_queue_approval: boolean;
};

type AdminUxProposalRow = {
  id: string;
  page_path: string | null;
  audience?: string | null;
  severity: string | null;
  title: string;
  body: string | null;
  proposed_change?: unknown;
  status: string | null;
  created_at: string;
};

type DesignInsightRow = {
  id: string;
  page_path: string | null;
  insight_type: string | null;
  severity: string | null;
  title: string;
  body: string | null;
  proposed_change?: unknown;
  status: string | null;
  created_at: string;
};

type AgentEvolutionRow = {
  id: string;
  target_agent_id: string;
  evolution_type: string;
  rationale: string;
  proposed_diff?: unknown;
  status: string | null;
  created_at: string;
};

type BudInsightRow = {
  id: string;
  category: string;
  severity: string;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type MemoryRow = {
  id: string;
  category: string;
  title: string;
  vault_path?: string | null;
  created_at: string;
};

type FailedRunRow = {
  id: string;
  agent_id: string;
  status: string;
  summary: string | null;
  started_at: string;
};

function normalizeSeverity(value: string | null | undefined): UxEvolutionRecommendation['severity'] {
  if (value === 'critical') return 'critical';
  if (value === 'high' || value === 'warning') return 'high';
  if (value === 'low' || value === 'info') return 'low';
  return 'medium';
}

function normalizeStatus(value: string | null | undefined): UxEvolutionRecommendation['status'] {
  if (value === 'reviewing') return 'reviewing';
  if (value === 'accepted') return 'accepted';
  if (value === 'rejected') return 'rejected';
  if (value === 'shipped') return 'shipped';
  if (value === 'approved') return 'approved';
  if (value === 'applied') return 'applied';
  if (value === 'pending') return 'pending';
  return 'new';
}

function short(text: string | null | undefined, fallback: string): string {
  const value = (text ?? '').trim();
  if (!value) return fallback;
  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

export function buildUxEvolutionRecommendations(args: {
  adminUxProposals?: AdminUxProposalRow[];
  designInsights?: DesignInsightRow[];
  agentEvolutions?: AgentEvolutionRow[];
  budInsights?: BudInsightRow[];
  memory?: MemoryRow[];
  failedRuns?: FailedRunRow[];
}): UxEvolutionRecommendation[] {
  const recommendations: UxEvolutionRecommendation[] = [];

  for (const row of args.adminUxProposals ?? []) {
    recommendations.push({
      id: `admin-ux:${row.id}`,
      source: 'admin_ux_proposal',
      source_id: row.id,
      title: row.title,
      summary: short(row.body, 'Bud found admin workflow friction that can be simplified.'),
      severity: normalizeSeverity(row.severity),
      status: normalizeStatus(row.status),
      affected_area: row.page_path ?? row.audience ?? 'Admin experience',
      proposed_change: row.proposed_change ?? null,
      created_at: row.created_at,
      can_queue_approval: ['new', 'reviewing'].includes(normalizeStatus(row.status)),
    });
  }

  for (const row of args.designInsights ?? []) {
    recommendations.push({
      id: `design:${row.id}`,
      source: 'design_insight',
      source_id: row.id,
      title: row.title,
      summary: short(row.body, 'Bud found a design or conversion improvement.'),
      severity: normalizeSeverity(row.severity),
      status: normalizeStatus(row.status),
      affected_area: row.page_path ?? row.insight_type ?? 'Design system',
      proposed_change: row.proposed_change ?? null,
      created_at: row.created_at,
      can_queue_approval: ['new', 'reviewing'].includes(normalizeStatus(row.status)),
    });
  }

  for (const row of args.agentEvolutions ?? []) {
    recommendations.push({
      id: `agent-evolution:${row.id}`,
      source: 'agent_evolution',
      source_id: row.id,
      title: `${row.evolution_type.replaceAll('_', ' ')} for ${row.target_agent_id}`,
      summary: short(row.rationale, 'Bud found a way to improve an agent.'),
      severity: row.evolution_type === 'retire' || row.evolution_type === 'autonomy_change' ? 'high' : 'medium',
      status: normalizeStatus(row.status),
      affected_area: row.target_agent_id,
      proposed_change: row.proposed_diff ?? null,
      created_at: row.created_at,
      can_queue_approval: normalizeStatus(row.status) === 'pending',
    });
  }

  for (const row of args.budInsights ?? []) {
    const category = row.category.toLowerCase();
    if (!['ux', 'design', 'admin', 'workflow', 'friction', 'automation'].some((token) => category.includes(token))) continue;
    recommendations.push({
      id: `bud-insight:${row.id}`,
      source: 'bud_insight',
      source_id: row.id,
      title: row.title,
      summary: short(row.body, 'Bud noticed a recurring operating-system improvement opportunity.'),
      severity: normalizeSeverity(row.severity),
      status: 'new',
      affected_area: row.category,
      proposed_change: row.metadata ?? null,
      created_at: row.created_at,
      can_queue_approval: true,
    });
  }

  for (const row of args.memory ?? []) {
    const text = `${row.category} ${row.title} ${row.vault_path ?? ''}`.toLowerCase();
    if (!['design', 'ux', 'site problem', 'recurring', 'business rule', 'pricing'].some((token) => text.includes(token))) continue;
    recommendations.push({
      id: `memory:${row.id}`,
      source: 'memory',
      source_id: row.id,
      title: row.title,
      summary: `Bud remembers this as ${row.category}${row.vault_path ? ` in ${row.vault_path}` : ''}.`,
      severity: text.includes('problem') || text.includes('failure') ? 'medium' : 'low',
      status: 'new',
      affected_area: row.category,
      proposed_change: null,
      created_at: row.created_at,
      can_queue_approval: false,
    });
  }

  for (const run of args.failedRuns ?? []) {
    if (!['failed', 'needs_repair'].includes(run.status)) continue;
    recommendations.push({
      id: `failed-run:${run.id}`,
      source: 'failed_run',
      source_id: run.id,
      title: `Reduce failure pattern in ${run.agent_id}`,
      summary: short(run.summary, 'A repeated workflow is failing and may need simplification.'),
      severity: run.status === 'needs_repair' ? 'high' : 'medium',
      status: 'new',
      affected_area: run.agent_id,
      proposed_change: null,
      created_at: run.started_at,
      can_queue_approval: true,
    });
  }

  return recommendations
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const bySeverity = severityOrder[a.severity] - severityOrder[b.severity];
      if (bySeverity !== 0) return bySeverity;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 12);
}
