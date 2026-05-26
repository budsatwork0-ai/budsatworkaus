import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type DevOsSession = {
  id: string;
  session_id: string | null;
  agents_used: string[];
  task: string | null;
  files_changed: string[];
  summary: string | null;
  risk_level: string | null;
  created_at: string;
};

export type DevOsAgentStat = {
  runCount: number;
  lastRunAt: string | null;
};

export type DevOsResponse = {
  sessions: DevOsSession[];
  agentStats: Record<string, DevOsAgentStat>;
  totalSessions: number;
  conventionCount: number;
};

export async function GET(): Promise<NextResponse<DevOsResponse | { error: string }>> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const [sessionsRes, conventionRes] = await Promise.all([
      supabase
        .from('dev_os_sessions')
        .select('id, session_id, agents_used, task, files_changed, summary, risk_level, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('convention_learnings')
        .select('id', { count: 'exact', head: true }),
    ]);

    const sessions = (sessionsRes.data ?? []) as DevOsSession[];
    const conventionCount = conventionRes.count ?? 0;

    const agentStats: Record<string, DevOsAgentStat> = {};
    for (const session of sessions) {
      for (const agentId of session.agents_used) {
        if (!agentStats[agentId]) agentStats[agentId] = { runCount: 0, lastRunAt: null };
        agentStats[agentId].runCount++;
        if (!agentStats[agentId].lastRunAt || session.created_at > agentStats[agentId].lastRunAt!) {
          agentStats[agentId].lastRunAt = session.created_at;
        }
      }
    }

    return NextResponse.json({ sessions, agentStats, totalSessions: sessions.length, conventionCount });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
