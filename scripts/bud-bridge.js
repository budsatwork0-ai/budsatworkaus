#!/usr/bin/env node
/**
 * Bud Bridge — local sidecar that lets budsatwork.com reach your machine.
 *
 * Start:  node scripts/bud-bridge.js
 * Port:   3747  (override with BUD_BRIDGE_PORT env var)
 *
 * Routes
 *   GET  /health                — liveness ping
 *   POST /graphify/extract      — stream graphify output as SSE
 *   POST /shell                 — run an allowlisted shell command
 */

import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.BUD_BRIDGE_PORT ?? 3747);

// Origins allowed to call this bridge
const ALLOWED_ORIGINS = new Set([
  'https://budsatwork.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
]);

// Allowlisted graphify extract modes
const EXTRACT_MODES = {
  update:        { args: ['update', '.'],                                                              label: 'graphify update .' },
  extract_wiki:  { args: ['extract', '.', '--backend', 'claude-cli', '--wiki'],                       label: 'graphify extract . --backend claude-cli --wiki' },
  extract_deep:  { args: ['extract', '.', '--backend', 'claude-cli', '--wiki', '--directed', '--force', '--dedup-llm'], label: 'graphify extract . --backend claude-cli --wiki --directed --force --dedup-llm' },
};

// Allowlisted shell commands (read-only, safe)
const SHELL_COMMANDS = {
  git_status:      { cmd: 'git', args: ['status', '--short'] },
  git_log:         { cmd: 'git', args: ['log', '--oneline', '-20'] },
  graphify_query:  null, // handled separately — requires 'question' arg
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cors(req, res) {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

// ── Route: GET /health ────────────────────────────────────────────────────────

function handleHealth(req, res) {
  json(res, 200, { ok: true, pid: process.pid, cwd: PROJECT_ROOT, version: 1 });
}

// ── Route: POST /graphify/extract ─────────────────────────────────────────────

async function handleGraphifyExtract(req, res) {
  const body = await readBody(req);
  const mode = body.mode ?? 'update';
  const spec = EXTRACT_MODES[mode];

  if (!spec) return json(res, 400, { error: `Unknown mode: ${mode}` });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start', cmd: spec.label });
  console.log(`[bridge] ${spec.label}`);

  const proc = spawn('graphify', spec.args, { cwd: PROJECT_ROOT, shell: false });

  proc.stdout.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) send({ type: 'log', line: line.trimEnd() });
    }
  });

  proc.stderr.on('data', (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) send({ type: 'log', line: line.trimEnd(), stderr: true });
    }
  });

  proc.on('close', (code) => {
    send({ type: 'done', ok: code === 0, exitCode: code });
    console.log(`[bridge] done (exit ${code})`);
    res.end();
  });

  proc.on('error', (err) => {
    const msg = err.code === 'ENOENT'
      ? 'graphify not found — install with: npm install -g graphify'
      : err.message;
    send({ type: 'error', message: msg });
    res.end();
  });

  req.on('close', () => proc.kill());
}

// ── Route: POST /shell ────────────────────────────────────────────────────────

async function handleShell(req, res) {
  const body = await readBody(req);
  const command = body.command;
  const spec = SHELL_COMMANDS[command];

  if (spec === undefined) return json(res, 400, { error: `Blocked: ${command} not in allowlist` });

  // graphify_query needs a question arg
  if (command === 'graphify_query') {
    const question = String(body.question ?? '').trim().slice(0, 200);
    if (!question) return json(res, 400, { error: 'question required' });
    try {
      const { stdout, stderr } = await execFileAsync('graphify', ['query', question], { cwd: PROJECT_ROOT, timeout: 30_000 });
      return json(res, 200, { output: (stdout + (stderr ? `\nstderr:\n${stderr}` : '')).trim() });
    } catch (e) {
      return json(res, 200, { output: `Exit ${e.code ?? 1}\n${e.stderr ?? String(e)}` });
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(spec.cmd, spec.args, { cwd: PROJECT_ROOT, timeout: 30_000 });
    json(res, 200, { output: (stdout + (stderr ? `\nstderr:\n${stderr}` : '')).trim() });
  } catch (e) {
    json(res, 200, { output: `Exit ${e.code ?? 1}\n${e.stderr ?? String(e)}` });
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  cors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'GET'  && url.pathname === '/health')            return handleHealth(req, res);
  if (req.method === 'POST' && url.pathname === '/graphify/extract')  return void handleGraphifyExtract(req, res);
  if (req.method === 'POST' && url.pathname === '/shell')             return void handleShell(req, res);

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🌉 Bud Bridge running on http://localhost:${PORT}`);
  console.log(`   Project root: ${PROJECT_ROOT}`);
  console.log(`   Allowed origins: ${[...ALLOWED_ORIGINS].join(', ')}`);
  console.log(`\n   Open Mission Control at https://budsatwork.com/dashboard/mission-control`);
  console.log(`   Press Ctrl+C to stop\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. Is the bridge already running?`);
    console.error(`Kill it with: kill $(lsof -t -i:${PORT})`);
  } else {
    console.error('Bridge error:', err);
  }
  process.exit(1);
});
