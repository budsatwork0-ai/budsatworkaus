# Alert: agent.run.empty_output — Threshold Exceeded

## Summary

Fires when the fraction of agent runs producing a null, empty, or zero-length
output payload exceeds **10 % over any 15-minute rolling window**, across all
agents or for a single named agent.

---

## Alert Configuration

```yaml
alert: agent_empty_output_rate_high
expr: |
  (
    sum(rate(agent_run_empty_output_total[15m])) by (agent_name)
    /
    sum(rate(agent_run_success_total[15m] + rate(agent_run_failure_total[15m])) by (agent_name)
  ) > 0.10
for: 15m
labels:
  severity: warning
  signal_type: agent_quality
annotations:
  summary: "{{ $labels.agent_name }} empty-output rate {{ $value | humanizePercentage }} > 10 %"
  runbook: "https://github.com/your-org/your-repo/blob/main/src/monitoring/alerts/empty-output-alert.md"
```

> **Metric names** emitted by `recordAgentRun()` in `src/monitoring/agent-metrics.ts`:
> | TypeScript constant | Prometheus counter |
> |---|---|
> | `agent.run.success` | `agent_run_success_total` |
> | `agent.run.failure` | `agent_run_failure_total` |
> | `agent.run.empty_output` | `agent_run_empty_output_total` |
>
> Tags/labels: `agent_name` (always), plus any `extra_tags` passed to `recordAgentRun()`.

---

## Runbook

### 1. Identify the offending agent

```promql
topk(5,
  sum(rate(agent_run_empty_output_total[15m])) by (agent_name)
  /
  sum(rate(agent_run_success_total[15m]) + rate(agent_run_failure_total[15m])) by (agent_name)
)
```

### 2. Check recent logs

Each `recordAgentRun()` call writes a structured JSON log line with
`"level": "metric"`, `"metric": "agent.run.empty_output"`, and `"tags"`.
Filter your log aggregator for:

```
level=metric metric=agent.run.empty_output tags.agent_name=<agent>
```

### 3. Common causes

| Cause | Signal | Remediation |
|---|---|---|
| Upstream LLM returning empty completions | `agent.run.empty_output` spikes without `agent.run.failure` | Check LLM API quotas / temperature settings |
| Schema validation silently coercing output to `{}` | Low failure rate, high empty-output rate | Tighten Zod schema; add `.strict()` or `.min(1)` |
| Agent short-circuits on missing context | Correlates with specific input shape | Add guard in agent entry point using `isEmptyOutput()` from `agent-metrics.ts` |
| Downstream serialiser dropping keys | Appears only on certain agent versions | Compare output before/after serialisation |

### 4. Escalation path

1. **< 25 %** — monitor; check logs; no page.
2. **25 – 50 %** — page on-call engineer; trace a sample run end-to-end.
3. **> 50 %** — incident; consider disabling the affected agent or routing
   requests to a fallback until the root cause is resolved.

### 5. Verification

Once a fix is deployed, confirm the rate returns below 5 % over two consecutive
15-minute windows before resolving the alert.

---

## Related

- `src/monitoring/agent-metrics.ts` — metric emission source
- Historical pattern: `agent/quote-triage`, `agent/bud-observer` — both
  exhibit the succeeded-no-output pattern that this alert is designed to catch.
