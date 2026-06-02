/**
 * Design Developer Agent — applies theme changes based on user prompts.
 *
 * Responsibilities:
 *   · Read themes (dashboard.ts, crew.ts, public.ts) from disk
 *   · Understand design change requests (colors, radius, shadows, fonts, night mode)
 *   · Produce the updated TypeScript code for the target theme file
 *   · Propose a 'write_theme_file' action to write the updated theme to disk
 */
import type { AgentDefinition, AgentContext } from '../types';
import fs from 'fs';
import path from 'path';

const SYSTEM = `You are the Design Developer Agent for Buds At Work.
You receive:
1. The current source code of all three product themes:
   - Admin Dashboard (\`themes/dashboard.ts\`)
   - Crew Portal (\`themes/crew.ts\`)
   - Public Site (\`themes/public.ts\`)
2. A request from the user to change or tweak the visual design (colors, corner radiuses, shadows, navigation styles, typography sizing, or night mode).

Your task:
Analyze the request and modify the EXACT file content for the appropriate theme to apply the change. Do not invent new structures; keep all comments and imports intact. Preserve everything in the theme except the exact values/keys that need to be changed to fulfill the design request.

Ensure that the output values are consistent with the existing theme structure and tailwind classes (if used in glass properties).
Ensure the changes are high-quality, modern, and beautiful. Follow Apple-inspired premium aesthetics (harmonious colors, no raw primary colors unless intended).

Return a strict JSON object (no markdown formatting, no fences):
{
  "theme": "dashboard" | "crew" | "public",
  "rationale": "Brief explanation of the changes made, referencing specific colors/values changed.",
  "content": "The full and complete updated source code of the modified theme file. Must compile and be valid TypeScript, maintaining the exact format, export name, and imports."
}

Output only the raw JSON. Do not include markdown code block syntax (like \`\`\`json).`;

export const designDeveloperAgent: AgentDefinition = {
  id: 'design-developer',
  name: 'Design Developer',
  description: 'Applies design modifications and theme updates to the dashboard, crew portal, and public themes.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const prompt = (ctx.input?.prompt as string | undefined) || '';
    if (!prompt.trim()) {
      return {
        summary: 'No prompt provided. Please specify a design modification request.',
        output: { status: 'skipped', error: 'empty_prompt' }
      };
    }

    ctx.log('Design Developer agent starting', { prompt });

    // 1. Read current themes from disk
    const themes = ['dashboard', 'crew', 'public'];
    const themeContents: Record<string, string> = {};

    try {
      for (const t of themes) {
        const filePath = path.join(process.cwd(), 'src/lib/design-system/themes', `${t}.ts`);
        themeContents[t] = await fs.promises.readFile(filePath, 'utf-8');
      }
    } catch (err) {
      throw new Error(`Failed to read theme files: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Prepare LLM input
    const llmPrompt = [
      '### User Design Request',
      `"${prompt}"`,
      '',
      '### Current Theme Files',
      ...themes.map((t) => [
        `#### File: themes/${t}.ts`,
        '```typescript',
        themeContents[t],
        '```',
        ''
      ].join('\n')),
      'Analyze the design request, decide which theme(s) to edit, and return the modified file contents in the requested JSON format.'
    ].join('\n');

    // 3. Call LLM
    const raw = await ctx.llm(llmPrompt, { system: SYSTEM });

    // 4. Parse output
    let parsed: { theme: string; rationale: string; content: string };
    try {
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      ctx.log('LLM raw output parsing failed', { raw });
      return {
        summary: 'Failed to parse Design Developer LLM output.',
        output: { status: 'failed', error: 'invalid_json', raw }
      };
    }

    if (!themes.includes(parsed.theme)) {
      return {
        summary: `LLM selected invalid theme: "${parsed.theme}". Must be dashboard, crew, or public.`,
        output: { status: 'failed', error: 'invalid_theme', parsed }
      };
    }

    if (!parsed.content || !parsed.content.trim()) {
      return {
        summary: 'LLM returned empty file content for the updated theme.',
        output: { status: 'failed', error: 'empty_content', parsed }
      };
    }

    // 5. Propose the action
    const preview = `[Design Update] Modify ${parsed.theme} theme: ${parsed.rationale}`;
    await ctx.proposeAction({
      action_type: 'write_theme_file',
      payload: {
        theme: parsed.theme,
        content: parsed.content,
        rationale: parsed.rationale
      },
      preview,
      requiresApproval: true,
      confidence: 0.95,
      risk_level: 'medium'
    });

    const summary = `Proposed theme update for "${parsed.theme}": ${parsed.rationale}`;
    return {
      summary,
      output: {
        status: 'success',
        summary,
        theme: parsed.theme,
        rationale: parsed.rationale,
        recommended_actions: [`Approve design change for themes/${parsed.theme}.ts`]
      }
    };
  }
};
