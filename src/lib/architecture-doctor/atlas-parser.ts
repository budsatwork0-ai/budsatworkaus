import { readFile } from 'node:fs/promises';
import type { AtlasSpec, CapabilitySpec } from './types';

const CAPABILITY_HEADING = /^###\s+(C\d{2})\s+-\s+(.+)$/;

const FIELD_MAP: Record<string, keyof CapabilitySpec> = {
  'UI pages': 'uiPages',
  'API routes': 'apiRoutes',
  Agents: 'agents',
  'Cron / workers': 'cronWorkers',
  Tables: 'tables',
  Buckets: 'buckets',
  'External integrations': 'externalIntegrations',
  'Env vars': 'envVars',
  'Feature flags': 'featureFlags',
};

export async function parseAtlasFile(sourcePath: string): Promise<AtlasSpec> {
  const markdown = await readFile(sourcePath, 'utf8');
  return parseAtlas(markdown, sourcePath);
}

export function parseAtlas(markdown: string, sourcePath = '<memory>'): AtlasSpec {
  const lines = markdown.split(/\r?\n/);
  const capabilities: CapabilitySpec[] = [];
  let current: CapabilitySpec | null = null;

  for (const line of lines) {
    const heading = line.match(CAPABILITY_HEADING);
    if (heading) {
      current = createCapability(heading[1], heading[2].trim());
      capabilities.push(current);
      continue;
    }

    if (!current || !line.startsWith('|')) continue;

    const cells = splitMarkdownTableRow(line);
    if (cells.length < 2) continue;

    const [field, value] = cells;
    if (field === 'Owner') {
      current.owner = stripMarkdown(value);
      continue;
    }

    if (field === 'Criticality / Maturity / Priority') {
      const parts = value
        .split('/')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((part) => Number.isFinite(part));
      current.criticality = parts[0];
      current.maturity = parts[1];
      current.priority = parts[2];
      continue;
    }

    const target = FIELD_MAP[field];
    if (!target) continue;
    (current[target] as string[]) = parseListValue(value, field);
  }

  return { sourcePath, capabilities };
}

function createCapability(id: string, name: string): CapabilitySpec {
  return {
    id,
    name,
    uiPages: [],
    apiRoutes: [],
    agents: [],
    cronWorkers: [],
    tables: [],
    buckets: [],
    externalIntegrations: [],
    envVars: [],
    featureFlags: [],
  };
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function parseListValue(value: string, field: string): string[] {
  if (/none/i.test(value) && !value.includes('`')) return [];

  if (field === 'Env vars') {
    return expandEnvVars(extractBackticks(value));
  }

  const backticks = extractBackticks(value);
  if (backticks.length > 0) return filterFieldValues(unique(backticks.flatMap(expandMaybeCsv)), field);

  if (field === 'External integrations') {
    return unique(
      stripMarkdown(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  return filterFieldValues(
    unique(
    stripMarkdown(value)
      .split(/;|,/)
      .map((item) => item.trim())
      .filter(Boolean),
    ),
    field,
  );
}

function extractBackticks(value: string): string[] {
  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim()).filter(Boolean);
}

function expandMaybeCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandEnvVars(values: string[]): string[] {
  const expanded = new Set<string>();
  for (const value of values) {
    if (value.endsWith('_*')) {
      expanded.add(value);
      continue;
    }
    expanded.add(value);
  }
  return [...expanded].sort();
}

function stripMarkdown(value: string): string {
  return value.replace(/`/g, '').replace(/\*\*/g, '').trim();
}

function filterFieldValues(values: string[], field: string): string[] {
  if (field === 'API routes' || field === 'UI pages') {
    return values.filter((value) => value.startsWith('/'));
  }
  return values;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}
