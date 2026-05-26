import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { spawn } from 'node:child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODES = {
  update: {
    args: ['update', '.'],
    label: 'graphify update .',
  },
  extract_wiki: {
    args: ['extract', '.', '--backend', 'claude-cli', '--wiki'],
    label: 'graphify extract . --backend claude-cli --wiki',
  },
  extract_deep: {
    args: ['extract', '.', '--backend', 'claude-cli', '--wiki', '--directed', '--force', '--dedup-llm'],
    label: 'graphify extract . --backend claude-cli --wiki --directed --force --dedup-llm',
  },
} as const;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'graphify runs on your local machine only. Open a terminal and run:\ngraphify extract . --backend claude-cli --wiki' },
      { status: 422 },
    );
  }

  const body = await req.json() as { mode?: string };
  const mode = (body.mode ?? 'update') as keyof typeof MODES;
  const spec = MODES[mode];
  if (!spec) return NextResponse.json({ error: 'invalid mode' }, { status: 400 });

  const cwd = process.cwd();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      send({ type: 'start', cmd: spec.label });

      const proc = spawn('graphify', spec.args, {
        cwd,
        env: { ...process.env },
        shell: false,
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n')) {
          if (line.trim()) send({ type: 'log', line: line.trimEnd() });
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n')) {
          if (line.trim()) send({ type: 'log', line: line.trimEnd(), stderr: true });
        }
      });

      proc.on('close', (code) => {
        send({ type: 'done', ok: code === 0, exitCode: code });
        controller.close();
      });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        const msg = err.code === 'ENOENT'
          ? 'graphify not found — install with: npm install -g graphify'
          : err.message;
        send({ type: 'error', message: msg });
        controller.close();
      });
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
