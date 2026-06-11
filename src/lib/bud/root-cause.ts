import { createHash } from 'node:crypto';

export const ROOT_CAUSE_IDS = [
  'silent_success',
  'output_contract',
  'customer_reply_routing',
  'agent_config_missing',
  'observability_gap',
  'data_readiness',
] as const;

export type RootCauseId = typeof ROOT_CAUSE_IDS[number];

export type RootCauseSignalInput = {
  signalType?: string | null;
  title?: string | null;
  description?: string | null;
  affectedArea?: string | null;
  referenceFiles?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type RootCauseClassification = {
  rootCauseId: RootCauseId;
  rootCauseKey: string;
  initiativeTitle: string;
};

function textOf(input: RootCauseSignalInput): string {
  return [
    input.signalType,
    input.title,
    input.description,
    input.affectedArea,
    ...(input.referenceFiles ?? []),
    input.metadata ? JSON.stringify(input.metadata) : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizeArea(area?: string | null): string {
  return (area ?? '')
    .toLowerCase()
    .replace(/^agent\s*\/\s*/, '')
    .replace(/^agents\s*\/\s*/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function rootCauseKey(rootCauseId: RootCauseId, input: RootCauseSignalInput): string {
  if (rootCauseId === 'silent_success' || rootCauseId === 'output_contract' || rootCauseId === 'observability_gap') {
    return rootCauseId;
  }
  const area = normalizeArea(input.affectedArea);
  return area ? `${rootCauseId}:${area}` : rootCauseId;
}

function initiativeTitle(rootCauseId: RootCauseId, key: string): string {
  if (rootCauseId === 'silent_success') return 'Fleet-Wide Output Semantics';
  if (rootCauseId === 'output_contract') return 'Agent Output Contract Enforcement';
  if (rootCauseId === 'customer_reply_routing') return 'Customer Reply Routing Readiness';
  if (rootCauseId === 'agent_config_missing') return 'Agent Configuration Readiness';
  if (rootCauseId === 'observability_gap') return 'Silent-Success Observability';
  if (rootCauseId === 'data_readiness') return 'Agent Data Readiness';
  return key;
}

export function classifyRootCause(input: RootCauseSignalInput): RootCauseClassification {
  const text = textOf(input);
  let rootCauseId: RootCauseId = 'data_readiness';

  if (
    /silent[-\s]?success|succeeded[_\s-]?no[_\s-]?output|no[-\s]?output|empty output|produced no output|no useful output/.test(text)
  ) {
    rootCauseId = 'silent_success';
  } else if (
    /output contract|schema validation|output schema|runtime schema|agentresult|validation_error|agent-output-guard/.test(text)
  ) {
    rootCauseId = 'output_contract';
  } else if (/reply_channel|reply channel|messenger_psid|sms|phone lead|manual callback|unroutable|missing psid/.test(text)) {
    rootCauseId = 'customer_reply_routing';
  } else if (/watch_urls|watch urls|competitor_pages|no competitor|knowledge_articles|knowledge corpus|corpus|not configured|config missing/.test(text)) {
    rootCauseId = 'agent_config_missing';
  } else if (/observability|metric|alert|monitoring|dashboard|blind spot|telemetry/.test(text)) {
    rootCauseId = 'observability_gap';
  }

  const key = rootCauseKey(rootCauseId, input);
  return {
    rootCauseId,
    rootCauseKey: key,
    initiativeTitle: initiativeTitle(rootCauseId, key),
  };
}

export function rootCauseFingerprint(input: RootCauseSignalInput): string {
  const root = classifyRootCause(input);
  return createHash('sha256').update(`${root.rootCauseId}:${root.rootCauseKey}`).digest('hex');
}

export function initiativeKeyFor(input: RootCauseSignalInput): string {
  return classifyRootCause(input).rootCauseKey;
}
