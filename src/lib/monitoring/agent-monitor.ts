import { env } from '@/lib/env';

interface ErrorRecord {
  timestamp: number;
}

class AgentMonitor {
  private static instance: AgentMonitor;
  private errorRecords: Map<string, ErrorRecord[]> = new Map();
  private readonly windowMs = 60 * 60 * 1000; // 1 hour

  private constructor() {}

  static getInstance(): AgentMonitor {
    if (!AgentMonitor.instance) {
      AgentMonitor.instance = new AgentMonitor();
    }
    return AgentMonitor.instance;
  }

  private pruneOldRecords(agentId: string): void {
    const now = Date.now();
    const records = this.errorRecords.get(agentId) ?? [];
    this.errorRecords.set(
      agentId,
      records.filter((r) => now - r.timestamp < this.windowMs)
    );
  }

  async recordError(agentId: string): Promise<void> {
    this.pruneOldRecords(agentId);
    const records = this.errorRecords.get(agentId) ?? [];
    records.push({ timestamp: Date.now() });
    this.errorRecords.set(agentId, records);

    const threshold = env.AGENT_ERROR_THRESHOLD ?? 5;
    if (records.length >= threshold) {
      await this.sendAlert(agentId, records.length);
    }
  }

  getErrorCount(agentId: string): number {
    this.pruneOldRecords(agentId);
    return this.errorRecords.get(agentId)?.length ?? 0;
  }

  // Exposed for testing only
  _reset(): void {
    this.errorRecords.clear();
  }

  private async sendAlert(agentId: string, count: number): Promise<void> {
    const webhookUrl = env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Agent *${agentId}* has recorded ${count} errors in the last hour (threshold: ${env.AGENT_ERROR_THRESHOLD ?? 5}).`,
        }),
      });
    } catch (err) {
      console.error('[AgentMonitor] Failed to send Slack alert:', err);
    }
  }
}

export const agentMonitor = AgentMonitor.getInstance();
