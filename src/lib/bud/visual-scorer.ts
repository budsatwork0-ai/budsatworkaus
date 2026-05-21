import {
  constitutionToPrompt,
  isUiFile,
  DESIGN_CONSTITUTION,
  VIOLATION_WEIGHTS,
  TASTE_PASS_THRESHOLD,
} from './design-constitution';

export type VisualScore = {
  score: number;          // 0.0 – 1.0
  pass: boolean;          // score >= TASTE_PASS_THRESHOLD (0.70)
  violations: string[];   // constitution rule violations found
  compliantPatterns: string[]; // constitution rules confirmed correct
  suggestions: string[];  // actionable fix recommendations
  reasoning: string;      // one-paragraph evaluation summary
  checkedFiles: string[]; // file paths that were evaluated
};

const VISION_MODEL = 'claude-haiku-4-5-20251001'; // Fast + cheap; cached system prompt amortises cost
const MAX_FILE_CHARS = 6_000;
const MAX_FILES = 4;

// Claude evaluates the TSX/CSS source code against the Design Constitution.
// No headless browser is needed — Claude reads visual patterns from code.
export async function scoreVisualCompliance(
  changedFiles: Array<{ path: string; content: string }>,
): Promise<VisualScore> {
  const uiFiles = changedFiles
    .filter((f) => isUiFile(f.path))
    .slice(0, MAX_FILES);

  if (uiFiles.length === 0) {
    return {
      score: 1.0,
      pass: true,
      violations: [],
      compliantPatterns: ['No UI files changed — visual compliance check skipped.'],
      suggestions: [],
      reasoning: 'No TSX/CSS files were included in this repair, so the Design Constitution was not evaluated.',
      checkedFiles: [],
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      score: 1.0,
      pass: true,
      violations: [],
      compliantPatterns: [],
      suggestions: [],
      reasoning: 'ANTHROPIC_API_KEY not configured — visual scoring skipped.',
      checkedFiles: [],
    };
  }

  const constitutionText = constitutionToPrompt();
  const requiredIds = DESIGN_CONSTITUTION
    .filter((r) => r.severity === 'required')
    .map((r) => r.id)
    .join(', ');

  const systemPrompt = buildSystemPrompt(constitutionText, requiredIds);
  const userPrompt = buildUserPrompt(uiFiles);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 2048,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' }, // Constitution is static; cache it
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }

    const json = await res.json() as { content: Array<{ type: string; text?: string }> };
    const rawText = json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');

    return parseScoreResponse(rawText, uiFiles.map((f) => f.path));

  } catch (err) {
    // Fail open — taste errors must not block the repair pipeline
    return {
      score: 1.0,
      pass: true,
      violations: [],
      compliantPatterns: [],
      suggestions: [],
      reasoning: `Visual scoring failed and was skipped (non-blocking): ${String(err)}`,
      checkedFiles: uiFiles.map((f) => f.path),
    };
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(constitutionText: string, requiredIds: string): string {
  return `You are Bud's Design Taste Engine — an expert UI code reviewer for the Buds At Work platform.

Your job is to evaluate changed TypeScript/React source files against the Buds At Work Design Constitution and return a numeric compliance score.

${constitutionText}

## Scoring algorithm
Start at 1.0.
For each REQUIRED rule (⛔) violated: subtract ${VIOLATION_WEIGHTS.required}.
For each RECOMMENDED rule (⚠️) violated: subtract ${VIOLATION_WEIGHTS.recommended}.
For each NICE-TO-HAVE rule (💡) violated: subtract ${VIOLATION_WEIGHTS['nice-to-have']}.
Clamp result to [0.0, 1.0].
Pass threshold: ${TASTE_PASS_THRESHOLD} (score >= ${TASTE_PASS_THRESHOLD} = pass).

## Evaluation focus
- Focus on what the CHANGED or ADDED code actually does visually.
- Do not penalise unchanged boilerplate or untouched sections of a file.
- Check required rules first (ids: ${requiredIds}).
- A violation must be specific: name the rule id and what was found.
- A compliant pattern must be specific: name the rule id and what was done correctly.

## Response format
Return ONLY valid JSON — no markdown fences, no prose outside the object:
{
  "score": 0.0–1.0,
  "violations": ["rule-id: specific observation"],
  "compliantPatterns": ["rule-id: specific observation"],
  "suggestions": ["concise actionable fix"],
  "reasoning": "one short paragraph summarising the evaluation"
}`;
}

function buildUserPrompt(files: Array<{ path: string; content: string }>): string {
  const blocks = files.map(
    (f) => `=== FILE: ${f.path} ===\n${f.content.slice(0, MAX_FILE_CHARS)}`,
  );
  return `Evaluate these changed UI files for Design Constitution compliance:\n\n${blocks.join('\n\n')}`;
}

// ── Response parser ──────────────────────────────────────────────────────────

function parseScoreResponse(raw: string, checkedFiles: string[]): VisualScore {
  // Strip accidental markdown fences
  const cleaned = raw.replace(/```json\s*|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    return failOpen('No JSON object found in taste engine response.', checkedFiles);
  }

  let parsed: {
    score?: number;
    violations?: unknown;
    compliantPatterns?: unknown;
    suggestions?: unknown;
    reasoning?: unknown;
  };

  try {
    parsed = JSON.parse(match[0]) as typeof parsed;
  } catch {
    return failOpen('Could not parse JSON from taste engine response.', checkedFiles);
  }

  const score = typeof parsed.score === 'number'
    ? Math.max(0, Math.min(1, parsed.score))
    : 0.5;

  return {
    score,
    pass: score >= TASTE_PASS_THRESHOLD,
    violations: toStringArray(parsed.violations),
    compliantPatterns: toStringArray(parsed.compliantPatterns),
    suggestions: toStringArray(parsed.suggestions),
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    checkedFiles,
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string') as string[];
}

function failOpen(reason: string, checkedFiles: string[]): VisualScore {
  return {
    score: 1.0,
    pass: true,
    violations: [],
    compliantPatterns: [],
    suggestions: [],
    reasoning: `Taste scoring skipped (non-blocking): ${reason}`,
    checkedFiles,
  };
}
