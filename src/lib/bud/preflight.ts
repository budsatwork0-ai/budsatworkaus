/**
 * Pre-flight gate for Bud improvement patches.
 *
 * A cheap, dependency-free pass over the *changed files only*, run in-process
 * BEFORE a branch or CI run is ever created. It encodes the mechanical failure
 * modes we have actually observed (Zod-v4 arity, forbidden imports, misplaced
 * test files, design-token misuse, out-of-scope file edits) so they can be
 * auto-fixed or bounced back to the model for free, instead of costing a ~60–90s
 * CI run each.
 *
 * This does NOT type-check — CI (`tsc --noEmit`) remains the source of truth.
 * Pre-flight is strictly additive: it never approves a merge, only filters out
 * obvious breakage early.
 *
 * See: Buds At Work/Dev/Bud Pipeline Pre-flight Gate — Spec 2026-06-01.md
 */

import { isUiFile } from './design-constitution';

export type PreflightSeverity = 'autofix' | 'block';

export interface PreflightFinding {
  rule: string;
  file: string;
  message: string;
  severity: PreflightSeverity;
}

export interface PreflightResult<T extends { file: string; content: string }> {
  /** true when no BLOCKING findings remain (auto-fixes may still have been applied). */
  ok: boolean;
  /** Patches with deterministic auto-fixes applied (same shape as the input). */
  patches: T[];
  findings: PreflightFinding[];
  autofixedCount: number;
  /** Model-facing block for the corrective prompt. '' when ok. */
  feedback: string;
}

interface RuleOutput {
  findings: PreflightFinding[];
  /** Present only when the rule deterministically rewrote the file. */
  fixed?: string;
}

interface Rule {
  id: string;
  appliesTo?: (file: string) => boolean;
  run: (file: string, content: string) => RuleOutput;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Given source and the index just past an opening `(`, return the inner text up
 * to the matching close paren and the index of that close paren. Respects nested
 * parens, strings, and template literals well enough for argument-counting.
 */
function readBalancedParens(src: string, openIdx: number): { inner: string; closeIdx: number } | null {
  let depth = 1;
  let i = openIdx;
  let quote: string | null = null;
  while (i < src.length) {
    const ch = src[i];
    const prev = src[i - 1];
    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) return { inner: src.slice(openIdx, i), closeIdx: i };
    }
    i++;
  }
  return null;
}

/** Count top-level (depth-0, outside strings) commas in an argument list. */
function topLevelCommaCount(inner: string): number {
  let depth = 0;
  let quote: string | null = null;
  let count = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    const prev = inner[i - 1];
    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) count++;
  }
  return count;
}

// ── rules ────────────────────────────────────────────────────────────────────

/** A1 — Zod v4 `z.record` requires two args. Auto-fix the single-arg v3 form. */
const ruleZodRecord: Rule = {
  id: 'A1',
  run(file, content) {
    const findings: PreflightFinding[] = [];
    let out = '';
    let cursor = 0;
    let changed = false;
    const marker = 'z.record(';
    let idx = content.indexOf(marker);
    while (idx !== -1) {
      const openIdx = idx + marker.length;
      const balanced = readBalancedParens(content, openIdx);
      if (!balanced) break;
      const inner = balanced.inner;
      const commas = topLevelCommaCount(inner);
      out += content.slice(cursor, idx);
      if (inner.trim() === '') {
        findings.push({ rule: 'A1', file, severity: 'block',
          message: '`z.record()` has no value schema. Use `z.record(z.string(), <valueSchema>)`.' });
        out += content.slice(idx, balanced.closeIdx + 1);
      } else if (commas === 0) {
        findings.push({ rule: 'A1', file, severity: 'autofix',
          message: '`z.record(' + inner.trim().slice(0, 40) + ')` is the Zod v3 API. Zod v4 needs a key schema: `z.record(z.string(), …)`.' });
        out += 'z.record(z.string(), ' + inner + ')';
        changed = true;
      } else {
        out += content.slice(idx, balanced.closeIdx + 1);
      }
      cursor = balanced.closeIdx + 1;
      idx = content.indexOf(marker, cursor);
    }
    out += content.slice(cursor);
    return { findings, fixed: changed ? out : undefined };
  },
};

/** A2 — forbidden `createClient` import from the server Supabase module. */
const ruleSupabaseImport: Rule = {
  id: 'A2',
  run(file, content) {
    const re = /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*['"]@\/lib\/supabase\/server['"]/;
    if (re.test(content)) {
      return { findings: [{ rule: 'A2', file, severity: 'block',
        message: '`createClient` is not exported from `@/lib/supabase/server`. Use `createServiceClient()` (synchronous).' }] };
    }
    return { findings: [] };
  },
};

/** A3 — `*.test.ts(x)` placed under `src/` (gets type-checked, breaks CI). */
const ruleTestLocation: Rule = {
  id: 'A3',
  run(file) {
    if (/^src\/.*\.test\.tsx?$/.test(file)) {
      return { findings: [{ rule: 'A3', file, severity: 'block',
        message: 'Test files must live under `tests/` (excluded from the typecheck), not under `src/`.' }] };
    }
    return { findings: [] };
  },
};

/** A4 — `glass`/`glassSoft` are strings; spreading them into `style` is wrong. */
const ruleGlassMisuse: Rule = {
  id: 'A4',
  appliesTo: isUiFile,
  run(file, content) {
    const findings: PreflightFinding[] = [];
    let fixed = content;
    let changed = false;
    const patterns: Array<[RegExp, string]> = [
      [/style=\{\{\s*\.\.\.\s*(glassSoft|glass)\s*\}\}/g, 'className={$1}'],
      [/style=\{\s*(glassSoft|glass)\s*\}/g, 'className={$1}'],
    ];
    for (const [re, repl] of patterns) {
      if (re.test(fixed)) {
        fixed = fixed.replace(re, repl);
        changed = true;
        findings.push({ rule: 'A4', file, severity: 'autofix',
          message: '`glass`/`glassSoft` are class-name strings — use `className={glass}`, not `style={{...glass}}`.' });
      }
    }
    return { findings, fixed: changed ? fixed : undefined };
  },
};

/** A5 — action/button backgrounds must use `brand.accent`, never `brand.primary`. */
const ruleBrandPrimaryButton: Rule = {
  id: 'A5',
  appliesTo: isUiFile,
  run(file, content) {
    const findings: PreflightFinding[] = [];
    for (const line of content.split('\n')) {
      if (/brand\.primary/.test(line) && /\b(bg|background|backgroundColor)\b/i.test(line)) {
        findings.push({ rule: 'A5', file, severity: 'block',
          message: 'Action/button backgrounds must use `brand.accent` (#1C7C54), not `brand.primary`.' });
        break;
      }
    }
    return { findings };
  },
};

/** A6 — theme tokens must import from the canonical `@/app/ui/theme`. */
const ruleThemeImportPath: Rule = {
  id: 'A6',
  run(file, content) {
    const findings: PreflightFinding[] = [];
    let fixed = content;
    let changed = false;
    const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
    fixed = fixed.replace(importRe, (full, names: string, source: string) => {
      const mentionsTokens = /\b(glass|glassSoft|brand)\b/.test(names);
      const badSource = source === '../theme' || source === '@/app/ui/theme.ts' || source === '@/app/ui/theme.tsx';
      if (mentionsTokens && badSource) {
        changed = true;
        findings.push({ rule: 'A6', file, severity: 'autofix',
          message: 'Import theme tokens from `@/app/ui/theme`, not `' + source + '`.' });
        return full.replace(`'${source}'`, "'@/app/ui/theme'").replace(`"${source}"`, "'@/app/ui/theme'");
      }
      return full;
    });
    return { findings, fixed: changed ? fixed : undefined };
  },
};

/** A7 — patches must never touch secrets or deployment/CI config. */
const ruleForbiddenFiles: Rule = {
  id: 'A7',
  run(file) {
    if (/(^|\/)\.env/.test(file)
      || file === 'vercel.json'
      || /^next\.config\./.test(file)
      || file.startsWith('.github/workflows/')) {
      return { findings: [{ rule: 'A7', file, severity: 'block',
        message: 'Out of scope: patches must not edit env, Vercel, Next, or CI workflow config.' }] };
    }
    return { findings: [] };
  },
};

/** A8 — empty or visibly truncated file content. */
const ruleTruncation: Rule = {
  id: 'A8',
  run(file, content) {
    if (content.trim() === '') {
      return { findings: [{ rule: 'A8', file, severity: 'block',
        message: 'Empty file content — regenerate the complete file.' }] };
    }
    const opens = (content.match(/\{/g) ?? []).length;
    const closes = (content.match(/\}/g) ?? []).length;
    const backticks = (content.match(/`/g) ?? []).length;
    if (Math.abs(opens - closes) > 1 || backticks % 2 !== 0) {
      return { findings: [{ rule: 'A8', file, severity: 'block',
        message: 'File looks truncated (unbalanced braces or backticks). Return the complete file.' }] };
    }
    return { findings: [] };
  },
};

const RULES: Rule[] = [
  ruleZodRecord,
  ruleSupabaseImport,
  ruleTestLocation,
  ruleGlassMisuse,
  ruleBrandPrimaryButton,
  ruleThemeImportPath,
  ruleForbiddenFiles,
  ruleTruncation,
];

// ── entrypoint ───────────────────────────────────────────────────────────────

export function preflightPatches<T extends { file: string; content: string }>(
  patches: readonly T[],
): PreflightResult<T> {
  const findings: PreflightFinding[] = [];
  let autofixedCount = 0;

  const out = patches.map((patch) => {
    let content = patch.content;
    for (const rule of RULES) {
      if (rule.appliesTo && !rule.appliesTo(patch.file)) continue;
      const res = rule.run(patch.file, content);
      if (res.findings.length) findings.push(...res.findings);
      if (res.fixed !== undefined && res.fixed !== content) {
        content = res.fixed;
        autofixedCount += res.findings.filter((f) => f.severity === 'autofix').length || 1;
      }
    }
    return content === patch.content ? patch : { ...patch, content };
  });

  const blocking = findings.filter((f) => f.severity === 'block');
  const feedback = blocking.length
    ? [
        'PRE-FLIGHT REJECTED YOUR PATCH. Fix these before resubmitting:',
        ...blocking.map((f) => `- ${f.file}: ${f.message}`),
        'Return corrected patches in the same JSON format.',
      ].join('\n')
    : '';

  return { ok: blocking.length === 0, patches: out, findings, autofixedCount, feedback };
}
