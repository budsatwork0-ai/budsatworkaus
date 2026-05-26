import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const REPORT_PATH = () => path.join(process.cwd(), 'graphify-out', 'GRAPH_REPORT.md');

export type GraphifyGodNode = { rank: number; name: string; edges: number };
export type GraphifyConnection = { from: string; to: string; relation: string; note: string };

export type GraphifyResponse =
  | { available: false; reason: string }
  | {
      available: true;
      builtFromCommit: string;
      currentCommit: string;
      isStale: boolean;
      reportDate: string;
      stats: { nodes: number; edges: number; communities: number; extractionPct: number };
      godNodes: GraphifyGodNode[];
      surprisingConnections: GraphifyConnection[];
      hyperedges: string[];
      reportUpdatedAt: string;
    };

function parseReport(content: string): Exclude<GraphifyResponse, { available: false }> {
  // Date from heading: # Graph Report - budsatwork  (2026-05-26)
  const dateMatch = content.match(/^# Graph Report.*?\((\d{4}-\d{2}-\d{2})\)/m);
  const reportDate = dateMatch?.[1] ?? 'unknown';

  // Stats: 8726 nodes · 16804 edges · 507 communities
  const statsMatch = content.match(/(\d+)\s+nodes\s*·\s*(\d+)\s+edges\s*·\s*(\d+)\s+communities/);
  const extractionMatch = content.match(/Extraction:\s*(\d+)%\s+EXTRACTED/);

  // Graph freshness: Built from commit: `70ba7d78`
  const commitMatch = content.match(/Built from commit:\s*`([^`]+)`/);
  const builtFromCommit = commitMatch?.[1] ?? 'unknown';

  // God nodes section
  const godNodeSection = content.match(/## God Nodes[\s\S]*?(?=\n## )/);
  const godNodes: GraphifyGodNode[] = [];
  if (godNodeSection) {
    const lines = godNodeSection[0].split('\n').filter(l => /^\d+\./.test(l.trim()));
    for (const line of lines.slice(0, 10)) {
      const m = line.match(/^(\d+)\.\s+`([^`]+)`\s+-\s+(\d+)\s+edges?/);
      if (m) godNodes.push({ rank: Number(m[1]), name: m[2], edges: Number(m[3]) });
    }
  }

  // Surprising connections section
  const connSection = content.match(/## Surprising Connections[\s\S]*?(?=\n## )/);
  const surprisingConnections: GraphifyConnection[] = [];
  if (connSection) {
    const lines = connSection[0].split('\n').filter(l => l.trim().startsWith('-'));
    for (const line of lines.slice(0, 6)) {
      const arrowMatch = line.match(/`([^`]+)`\s+--([^-]+)-->\s+`([^`]+)`/);
      const noteMatch = line.match(/^\s*([a-zA-Z0-9_./()\- ]+)\s*→\s*(.+)$/m);
      if (arrowMatch) {
        surprisingConnections.push({
          from: arrowMatch[1],
          relation: arrowMatch[2].trim(),
          to: arrowMatch[3],
          note: noteMatch ? `${noteMatch[1].trim()} → ${noteMatch[2].trim()}` : '',
        });
      }
    }
  }

  // Hyperedges
  const hyperedgeSection = content.match(/## Hyperedges[\s\S]*?(?=\n## )/);
  const hyperedges: string[] = [];
  if (hyperedgeSection) {
    const lines = hyperedgeSection[0].split('\n').filter(l => l.trim().startsWith('-'));
    for (const line of lines.slice(0, 4)) {
      const m = line.match(/\*\*(.+?)\*\*/);
      if (m) hyperedges.push(m[1]);
    }
  }

  const stat = fs.statSync(REPORT_PATH());

  return {
    available: true,
    builtFromCommit,
    currentCommit: 'unknown',
    isStale: false,
    reportDate,
    stats: {
      nodes: Number(statsMatch?.[1] ?? 0),
      edges: Number(statsMatch?.[2] ?? 0),
      communities: Number(statsMatch?.[3] ?? 0),
      extractionPct: Number(extractionMatch?.[1] ?? 0),
    },
    godNodes,
    surprisingConnections,
    hyperedges,
    reportUpdatedAt: stat.mtime.toISOString(),
  };
}

export async function GET(): Promise<NextResponse<GraphifyResponse>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ available: false, reason: 'unauthorized' }, { status: 401 });
  }

  if (!fs.existsSync(REPORT_PATH())) {
    return NextResponse.json({
      available: false,
      reason: 'graphify-out/GRAPH_REPORT.md not found — run `graphify update .` locally to generate it.',
    });
  }

  try {
    const content = fs.readFileSync(REPORT_PATH(), 'utf-8');
    const parsed = parseReport(content);

    // Check staleness: compare built-from commit to current HEAD
    let currentCommit = 'unknown';
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd(), timeout: 5000 });
      currentCommit = stdout.trim();
    } catch { /* git unavailable in this env */ }

    parsed.currentCommit = currentCommit;
    parsed.isStale = currentCommit !== 'unknown' && parsed.builtFromCommit !== 'unknown'
      && !currentCommit.startsWith(parsed.builtFromCommit)
      && !parsed.builtFromCommit.startsWith(currentCommit);

    return NextResponse.json(parsed);
  } catch (e) {
    return NextResponse.json({ available: false, reason: `Failed to read report: ${String(e)}` });
  }
}
