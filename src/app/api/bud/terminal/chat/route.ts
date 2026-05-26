import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const execFileAsync = promisify(execFile);
const CWD = process.cwd();
const MAX_OUTPUT = 8_000;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are Bud Terminal — the AI developer console for Buds At Work (budsatwork.com).

This is a production local-services platform (cleaning, windows, yard care, detailing, laundry) built with:
- Next.js 15 / React 19 / TypeScript / Tailwind v4
- Supabase (auth + database + RLS)
- Stripe (payments, webhooks)
- Resend (transactional email)
- Deployed on Vercel

Key paths:
- src/app/(public)/services/ — quote builder (5500+ lines)
- src/app/(app)/dashboard/ — admin dashboard tabs
- src/app/(app)/crew/ — crew portal
- src/app/api/ — all API routes
- src/lib/agents/ — 30+ AI agent definitions + runtime
- src/lib/bud/ — Bud OS operational intelligence

You have tools to inspect the codebase and run safe commands. Be concise and developer-focused.
When running tools, explain what you found in 1-2 sentences. Keep responses short.
For destructive operations, explain what would happen but do not execute.`;

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'run_shell',
    description: 'Run a read-only shell command. Returns stdout + stderr.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: [
            'git_status',
            'git_log',
            'git_diff_stat',
            'git_branch',
            'git_show_head',
            'tsc_check',
            'npm_build',
            'list_api_routes',
            'list_migrations',
            'list_agents',
          ],
          description: 'Which allowlisted command to run',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the project.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative file path from project root, e.g. "src/app/api/quotes/route.ts"',
        },
        max_lines: {
          type: 'number',
          description: 'Max lines to return (default 80, max 250)',
        },
        start_line: {
          type: 'number',
          description: 'Line number to start from (1-indexed, default 1)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories at a path.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path, e.g. "src/app/api"',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for a text pattern across TypeScript/TSX files.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Search pattern (grep-compatible, basic regex ok)',
        },
        directory: {
          type: 'string',
          description: 'Directory to search in relative to project root (default: "src")',
        },
        max_results: {
          type: 'number',
          description: 'Max matching lines to return (default 30)',
        },
      },
      required: ['pattern'],
    },
  },
] as const;

// ── Shell command map ─────────────────────────────────────────────────────────

const SHELL_MAP: Record<string, { cmd: string; args: string[]; display: string }> = {
  git_status:       { cmd: 'git', args: ['status', '--short'],                       display: 'git status' },
  git_log:          { cmd: 'git', args: ['log', '--oneline', '-20'],                  display: 'git log --oneline -20' },
  git_diff_stat:    { cmd: 'git', args: ['diff', '--stat'],                           display: 'git diff --stat' },
  git_branch:       { cmd: 'git', args: ['branch', '--show-current'],                 display: 'git branch --show-current' },
  git_show_head:    { cmd: 'git', args: ['show', '--stat', 'HEAD'],                   display: 'git show --stat HEAD' },
  tsc_check:        { cmd: 'npx', args: ['tsc', '--noEmit'],                          display: 'npx tsc --noEmit' },
  npm_build:        { cmd: 'npm', args: ['run', 'build'],                             display: 'npm run build' },
  list_api_routes:  { cmd: 'find', args: ['src/app/api', '-name', 'route.ts'],        display: 'find src/app/api -name route.ts' },
  list_migrations:  { cmd: 'find', args: ['supabase/migrations', '-name', '*.sql'],   display: 'find supabase/migrations -name *.sql' },
  list_agents:      { cmd: 'find', args: ['src/lib/agents/agents', '-name', '*.ts'],  display: 'find src/lib/agents/agents -name *.ts' },
};

// ── Tool executor ─────────────────────────────────────────────────────────────

function safePath(relativePath: string): string {
  const resolved = path.resolve(CWD, relativePath);
  if (!resolved.startsWith(CWD)) throw new Error('Path outside project root');
  return resolved;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n…(truncated ${text.length - MAX_OUTPUT} chars)`;
}

type ToolResult = { display: string; output: string };

async function executeTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
  if (name === 'run_shell') {
    const spec = SHELL_MAP[input.command as string];
    if (!spec) return { display: String(input.command), output: `Blocked: not in allowlist.` };
    try {
      const { stdout, stderr } = await execFileAsync(spec.cmd, spec.args, {
        cwd: CWD, timeout: 30_000, maxBuffer: 1024 * 1024 * 4,
      });
      return { display: spec.display, output: truncate((stdout + (stderr ? `\nstderr:\n${stderr}` : '')).trim() || '(no output)') };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; code?: number };
      return { display: spec.display, output: truncate(`Exit ${err.code ?? 1}\n${err.stdout ?? ''}\n${err.stderr ?? String(e)}`.trim()) };
    }
  }

  if (name === 'read_file') {
    const filePath = input.path as string;
    const maxLines = Math.min(Number(input.max_lines ?? 80), 250);
    const startLine = Math.max(1, Number(input.start_line ?? 1));
    try {
      const abs = safePath(filePath);
      const content = fs.readFileSync(abs, 'utf-8');
      const allLines = content.split('\n');
      const slice = allLines.slice(startLine - 1, startLine - 1 + maxLines);
      const suffix = allLines.length > startLine - 1 + maxLines ? `\n…(${allLines.length - (startLine - 1 + maxLines)} more lines)` : '';
      return {
        display: `cat ${filePath} | sed -n '${startLine},${startLine + maxLines - 1}p'`,
        output: slice.map((l, i) => `${startLine + i}\t${l}`).join('\n') + suffix,
      };
    } catch (e) {
      return { display: `cat ${filePath}`, output: `Error: ${String(e)}` };
    }
  }

  if (name === 'list_directory') {
    const dirPath = input.path as string;
    try {
      const abs = safePath(dirPath);
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      const output = entries
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
        .map(e => `${e.isDirectory() ? 'd' : '-'} ${e.name}`)
        .join('\n');
      return { display: `ls ${dirPath}`, output: output || '(empty directory)' };
    } catch (e) {
      return { display: `ls ${dirPath}`, output: `Error: ${String(e)}` };
    }
  }

  if (name === 'search_files') {
    const pattern = input.pattern as string;
    const directory = (input.directory as string) ?? 'src';
    const maxResults = Math.min(Number(input.max_results ?? 30), 100);
    try {
      const abs = safePath(directory);
      const { stdout } = await execFileAsync(
        'grep',
        ['-r', '--include=*.ts', '--include=*.tsx', '-n', '-m', String(maxResults), pattern, abs],
        { cwd: CWD, timeout: 10_000, maxBuffer: 1024 * 1024 },
      );
      const lines = stdout.trim().split('\n').slice(0, maxResults).join('\n');
      return { display: `grep -r "${pattern}" ${directory}`, output: truncate(lines || '(no matches)') };
    } catch (e) {
      const err = e as { code?: number; stdout?: string };
      if (err.code === 1) return { display: `grep -r "${pattern}" ${directory}`, output: '(no matches)' };
      return { display: `grep -r "${pattern}" ${directory}`, output: `Error: ${String(e)}` };
    }
  }

  return { display: name, output: 'Unknown tool' };
}

// ── Anthropic types ───────────────────────────────────────────────────────────

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

type AnthropicMessage =
  | { role: 'user'; content: string }
  | { role: 'user'; content: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> }
  | { role: 'assistant'; content: AnthropicContentBlock[] };

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const body = await req.json() as { messages?: Array<{ role: string; content: string }> };
  const incomingMessages = body.messages ?? [];

  const startedAt = new Date();
  const lastUserMsg = [...incomingMessages].reverse().find(m => m.role === 'user');
  const command = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : 'chat session').slice(0, 500);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const collectedOutput: string[] = [];
      let errorOccurred = false;

      type ShellEvidence = { command: string; display: string; output: string; evidenceType: string; status: string };
      const shellEvidences: ShellEvidence[] = [];

      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        // Convert incoming plain messages to Anthropic format
        let messages: AnthropicMessage[] = incomingMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })) as AnthropicMessage[];

        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        if (!ANTHROPIC_API_KEY) {
          send({ type: 'error', message: 'ANTHROPIC_API_KEY is not configured.' });
          return;
        }

        // Agentic loop — max 5 tool-use rounds
        for (let round = 0; round < 5; round++) {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 2048,
              system: SYSTEM,
              tools: TOOLS,
              messages,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            send({ type: 'error', message: `Anthropic API ${res.status}: ${errText.slice(0, 200)}` });
            break;
          }

          const data = await res.json() as {
            content: AnthropicContentBlock[];
            stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
          };

          const toolUseBlocks = data.content.filter((b): b is Extract<AnthropicContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');
          const textBlocks = data.content.filter((b): b is Extract<AnthropicContentBlock, { type: 'text' }> => b.type === 'text');

          // Send any text content
          for (const block of textBlocks) {
            if (block.text.trim()) {
              collectedOutput.push(block.text);
              send({ type: 'text', content: block.text });
            }
          }

          // No tool calls — done
          if (data.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break;

          // Execute each tool and stream results
          const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
          for (const block of toolUseBlocks) {
            const { display, output } = await executeTool(block.name, block.input);
            send({ type: 'tool', name: block.name, id: block.id, input: block.input, display, output });
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output });

            // Collect shell command evidence
            if (block.name === 'run_shell') {
              const cmd = String(block.input.command ?? '');
              const evidenceType =
                cmd === 'npm_build'    ? 'build_output' :
                cmd === 'tsc_check'    ? 'lint_output'  :
                cmd.startsWith('git_') ? 'git_diff'     : 'terminal_command';
              const failed = /^Exit [^0]|error TS|ERROR in/.test(output);
              shellEvidences.push({ command: display, display, output, evidenceType, status: failed ? 'failed' : 'passed' });
            }
          }

          // Append assistant turn + tool results and loop
          messages = [
            ...messages,
            { role: 'assistant', content: data.content },
            { role: 'user', content: toolResults },
          ];
        }
      } catch (e) {
        errorOccurred = true;
        send({ type: 'error', message: String(e) });
      } finally {
        send({ type: 'done' });
        controller.close();

        // Persist session + evidence records (best-effort, non-blocking)
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } },
          );
          const finishedAt = new Date().toISOString();
          await supabase.from('bud_terminal_sessions').insert({
            user_id: user.id,
            command,
            status: errorOccurred ? 'failed' : 'passed',
            output: collectedOutput.join('\n\n').slice(0, 10_000) || null,
            exit_code: errorOccurred ? 1 : 0,
            started_at: startedAt.toISOString(),
            finished_at: finishedAt,
          });
          // Write evidence row for each shell command that ran
          if (shellEvidences.length > 0) {
            await supabase.from('bud_evidence').insert(
              shellEvidences.map(e => ({
                type: e.evidenceType,
                source: 'bud_terminal',
                status: e.status,
                command: e.command,
                raw_output: e.output.slice(0, 10_000) || null,
                created_at: finishedAt,
              })),
            );
          }
        } catch { /* persistence failure must not affect the response */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
