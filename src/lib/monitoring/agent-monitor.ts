import { createClient } from '@supabase/supabase-js';

const ABSOLUTE_THRESHOLD = 10;
const BASELINE_MULTIPLIER = 2;
const ROLLING_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LAST_WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface MonitorConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  slackWebhookUrl: string;
  absoluteThreshold?: number;
  baselineMultiplier?: number;
}

export interface MonitorResult {
  agentId: string;
  rollingCount: number;
  baseline: number;
  breached: boolean;
  alertFired: boolean;
}

export class AgentMonitor {
  private supabase: ReturnType<typeof createClient>;
  private slackWebhookUrl: string;
  private absoluteThreshold: number;
  private baselineMultiplier: number;

  constructor(config: MonitorConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.slackWebhookUrl = config.slackWebhookUrl;
    this.absoluteThreshold = config.absoluteThreshold ?? ABSOLUTE_THRESHOLD;
    this.baselineMultiplier = config.baselineMultiplier ?? BASELINE_MULTIPLIER;
  }

  async check(agentId: string): Promise<MonitorResult> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - ROLLING_WINDOW_MS);
    const oneWeekAgo = new Date(now.getTime() - LAST_WEEK_WINDOW_MS);

    // Rolling 1-hour count
    const { count: rollingCount, error: rollingError } = await this.supabase
      .from('agent_errors')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('timestamp', oneHourAgo.toISOString());

    if (rollingError) {
      console.error('[AgentMonitor] Failed to query rolling count:', rollingError);
      return { agentId, rollingCount: 0, baseline: 0, breached: false, alertFired: false };
    }

    // Last-week total to compute hourly baseline (168 hours in a week)
    const { count: weekCount, error: weekError } = await this.supabase
      .from('agent_errors')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('timestamp', oneWeekAgo.toISOString())
      .lt('timestamp', oneHourAgo.toISOString());

    if (weekError) {
      console.error('[AgentMonitor] Failed to query week count:', weekError);
    }

    const hourlyBaseline = ((weekCount ?? 0) / 167); // errors per hour over the prior week
    const baselineThreshold = hourlyBaseline * this.baselineMultiplier;
    const current = rollingCount ?? 0;

    const breached =
      current >= this.absoluteThreshold ||
      (hourlyBaseline > 0 && current >= baselineThreshold);

    let alertFired = false;
    if (breached) {
      alertFired = await this.fireAlert(agentId, current, hourlyBaseline, baselineThreshold);
    }

    return { agentId, rollingCount: current, baseline: hourlyBaseline, breached, alertFired };
  }

  private async fireAlert(
    agentId: string,
    rollingCount: number,
    baseline: number,
    baselineThreshold: number,
  ): Promise<boolean> {
    const payload = {
      text: `🚨 *Agent Error Alert*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `🚨 *Agent Error Alert: \`${agentId}\`*`,
              `• Rolling 1-hour errors: *${rollingCount}*`,
              `• Absolute threshold: *${this.absoluteThreshold}*`,
              `• Last-week hourly baseline: *${baseline.toFixed(2)}*`,
              `• Baseline threshold (${this.baselineMultiplier}×): *${baselineThreshold.toFixed(2)}*`,
              `• Time: ${new Date().toISOString()}`,
            ].join('\n'),
          },
        },
      ],
    };

    try {
      const response = await fetch(this.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error('[AgentMonitor] Slack webhook returned non-OK status:', response.status);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[AgentMonitor] Failed to fire Slack alert:', err);
      return false;
    }
  }
}

// Singleton factory — lazily created on first use so env vars are read at runtime
let _monitor: AgentMonitor | null = null;

export function getAgentMonitor(): AgentMonitor {
  if (!_monitor) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const webhook = process.env.SLACK_ALERT_WEBHOOK_URL ?? '';
    _monitor = new AgentMonitor({ supabaseUrl: url, supabaseServiceKey: key, slackWebhookUrl: webhook });
  }
  return _monitor;
}

/** Exposed for testing — allows injecting a custom monitor instance. */
export function setAgentMonitor(monitor: AgentMonitor): void {
  _monitor = monitor;
}
