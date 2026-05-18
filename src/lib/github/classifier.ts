/**
 * GitHub change classifier.
 *
 * Determines ChangeType from commit messages (conventional commits),
 * file paths changed, and PR labels.
 *
 * Used by both the webhook handler and the historian agent to
 * route events to the correct Obsidian memory category.
 */

import type { ChangeClassification, ChangeType, GitHubCommit, GitHubLabel } from './types';

// ── Conventional commit prefix map ───────────────────────────────────────────

const COMMIT_PREFIX_MAP: Record<string, ChangeType> = {
  'feat':      'feature',
  'feature':   'feature',
  'fix':       'bug-fix',
  'bug':       'bug-fix',
  'hotfix':    'bug-fix',
  'refactor':  'architecture',
  'arch':      'architecture',
  'infra':     'architecture',
  'db':        'database',
  'migration': 'database',
  'agent':     'agent',
  'ui':        'ui',
  'ux':        'ui',
  'style':     'ui',
  'docs':      'docs',
  'doc':       'docs',
  'chore':     'chore',
  'ci':        'config',
  'build':     'config',
  'config':    'config',
  'breaking':  'breaking',
};

// ── File-path → system name ───────────────────────────────────────────────────

const SYSTEM_PATTERNS: Array<[RegExp, string]> = [
  [/^src\/lib\/agents\//,           'agents'],
  [/^src\/lib\/memory\//,           'memory'],
  [/^supabase\/migrations\//,       'database'],
  [/^src\/app\/api\/webhooks\//,    'webhooks'],
  [/^src\/app\/api\/quotes\//,      'quotes'],
  [/^src\/app\/api\/agents\//,      'agents'],
  [/^src\/app\/\(app\)\/dashboard/, 'dashboard'],
  [/^src\/app\/\(app\)\/crew/,      'crew-portal'],
  [/^src\/app\/\(app\)\/portal/,    'client-portal'],
  [/^src\/app\/\(public\)\/services/, 'services-page'],
  [/^src\/app\/ui\//,               'ui-components'],
  [/^src\/lib\/email\//,            'email'],
  [/^src\/lib\/stripe\//,           'stripe'],
  [/^src\/lib\/github\//,           'github-integration'],
  [/^src\/types\//,                 'types'],
  [/^\.github\//,                   'ci-cd'],
  [/^vercel\.json$/,                'ci-cd'],
  [/^scripts\//,                    'scripts'],
  [/^CLAUDE\.md$/,                  'documentation'],
];

// ── Label → type ──────────────────────────────────────────────────────────────

const LABEL_MAP: Record<string, ChangeType> = {
  'bug':          'bug-fix',
  'bug fix':      'bug-fix',
  'feature':      'feature',
  'enhancement':  'feature',
  'architecture': 'architecture',
  'refactor':     'architecture',
  'breaking':     'breaking',
  'database':     'database',
  'docs':         'docs',
  'documentation':'docs',
  'chore':        'chore',
  'agent':        'agent',
  'ui':           'ui',
  'ux':           'ui',
};

// ── Architectural file patterns ───────────────────────────────────────────────

const ARCH_PATTERNS = [
  /^supabase\/migrations\//,
  /^src\/lib\/memory\//,
  /^src\/lib\/agents\/types\.ts$/,
  /^src\/lib\/agents\/runtime\.ts$/,
  /^src\/lib\/agents\/guardrails/,
  /CLAUDE\.md$/,
  /^src\/types\//,
];

// ── Main classifier ───────────────────────────────────────────────────────────

export function classifyCommit(message: string): ChangeType {
  const lower = message.toLowerCase().trim();

  // Detect breaking change
  if (lower.includes('breaking change') || lower.startsWith('breaking:')) return 'breaking';

  // Conventional commit prefix: "type: ..." or "type(scope): ..."
  const match = lower.match(/^([a-z]+)(?:\([^)]+\))?[!]?:/);
  if (match) {
    const mapped = COMMIT_PREFIX_MAP[match[1]];
    if (mapped) return mapped;
  }

  // Keyword heuristics
  if (/\b(fix|fixed|fixes|bug|hotfix|patch)\b/.test(lower)) return 'bug-fix';
  if (/\b(feat|feature|add|added|implement|new)\b/.test(lower)) return 'feature';
  if (/\b(refactor|restructure|rework|rewrite|extract)\b/.test(lower)) return 'architecture';
  if (/\b(migration|migrate|schema|alter table|create table)\b/.test(lower)) return 'database';
  if (/\b(agent|llm|prompt)\b/.test(lower)) return 'agent';
  if (/\b(ui|ux|design|component|style|layout|mobile)\b/.test(lower)) return 'ui';
  if (/\b(docs|readme|changelog|adr)\b/.test(lower)) return 'docs';

  return 'chore';
}

function classifyFilePaths(files: string[]): ChangeType {
  // Priority: database > breaking > architecture > agent > ui > feature > bug-fix > chore
  const matches: ChangeType[] = [];

  for (const f of files) {
    if (/supabase\/migrations\//.test(f))            matches.push('database');
    if (/src\/lib\/agents\/agents\//.test(f))        matches.push('agent');
    if (/src\/lib\/memory\//.test(f))                matches.push('architecture');
    if (/src\/lib\/agents\/runtime|guardrails/.test(f)) matches.push('architecture');
    if (/src\/app\/ui\/|src\/app\/\(/.test(f))       matches.push('ui');
    if (/src\/lib\/stripe|email|resend/.test(f))     matches.push('feature');
    if (/src\/types\//.test(f))                      matches.push('architecture');
  }

  const priority: ChangeType[] = ['database', 'breaking', 'architecture', 'agent', 'ui', 'feature', 'bug-fix'];
  for (const p of priority) {
    if (matches.includes(p)) return p;
  }
  return 'chore';
}

function extractAffectedSystems(files: string[]): string[] {
  const systems = new Set<string>();
  for (const f of files) {
    for (const [pattern, system] of SYSTEM_PATTERNS) {
      if (pattern.test(f)) {
        systems.add(system);
        break;
      }
    }
  }
  return Array.from(systems);
}

function isArchitecturalChange(files: string[]): boolean {
  return files.some((f) => ARCH_PATTERNS.some((p) => p.test(f)));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function classifyPushCommits(
  commits: Array<{ message: string; added: string[]; modified: string[]; removed: string[] }>,
): ChangeClassification {
  if (commits.length === 0) {
    return {
      primary: 'chore',
      secondary: [],
      isBreaking: false,
      isArchitectural: false,
      affectedSystems: [],
    };
  }

  const allFiles = commits.flatMap((c) => [...c.added, ...c.modified, ...c.removed]);
  const messagePrimary = classifyCommit(commits[0].message);
  const filePrimary    = classifyFilePaths(allFiles);

  // File-based classification wins for db/arch; message wins for bug/feature
  const primary: ChangeType =
    filePrimary === 'database' || filePrimary === 'architecture'
      ? filePrimary
      : messagePrimary !== 'chore'
      ? messagePrimary
      : filePrimary;

  const secondarySet = new Set<ChangeType>();
  for (const c of commits) {
    const t = classifyCommit(c.message);
    if (t !== primary) secondarySet.add(t);
  }

  const isBreaking =
    commits.some((c) => c.message.includes('BREAKING CHANGE') || c.message.match(/^[a-z]+!/)) ||
    primary === 'breaking';

  return {
    primary,
    secondary: Array.from(secondarySet).slice(0, 3),
    isBreaking,
    isArchitectural: isArchitecturalChange(allFiles) || primary === 'architecture' || primary === 'database',
    affectedSystems: extractAffectedSystems(allFiles),
  };
}

export function classifyPR(
  title: string,
  body: string | null,
  labels: GitHubLabel[],
  additions: number,
  deletions: number,
): ChangeClassification {
  // Labels win over heuristics
  for (const label of labels) {
    const mapped = LABEL_MAP[label.name.toLowerCase()];
    if (mapped) {
      return {
        primary: mapped,
        secondary: [],
        isBreaking: mapped === 'breaking' || label.name.toLowerCase().includes('breaking'),
        isArchitectural: mapped === 'architecture' || mapped === 'database',
        affectedSystems: [],
      };
    }
  }

  const fromTitle  = classifyCommit(title);
  const fromBody   = body ? classifyCommit(body.split('\n')[0]) : 'chore';
  const primary    = fromTitle !== 'chore' ? fromTitle : fromBody;
  const isBreaking = title.toLowerCase().includes('breaking') || (body ?? '').toLowerCase().includes('breaking change');
  const isLarge    = additions + deletions > 500;

  return {
    primary,
    secondary: fromBody !== primary && fromBody !== 'chore' ? [fromBody] : [],
    isBreaking,
    isArchitectural: primary === 'architecture' || primary === 'database' || isLarge,
    affectedSystems: [], // filled in by the webhook handler from file list
  };
}

/** Maps a ChangeType to the Obsidian memory category for writes. */
export function changeTypeToMemoryCategory(
  type: ChangeType,
): 'deployments' | 'bugs' | 'architecture' | 'design' | 'admin' {
  switch (type) {
    case 'bug-fix':      return 'bugs';
    case 'architecture':
    case 'database':     return 'architecture';
    case 'ui':           return 'design';
    default:             return 'deployments';
  }
}
