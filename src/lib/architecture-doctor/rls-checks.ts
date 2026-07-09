import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AtlasSpec, ArchitectureInventory, RlsReport, RlsStatus, RlsTableCheck } from './types';
import { physicalTableCandidates } from './table-aliases';

export async function analyzeRls(atlas: AtlasSpec, inventory: ArchitectureInventory): Promise<RlsReport> {
  const migrationFiles = inventory.sourceFiles.filter((file) => file.includes('/supabase/migrations/') && file.endsWith('.sql'));
  const migrations = await Promise.all(
    migrationFiles.map(async (file) => ({ file, text: await safeRead(file) })),
  );
  const discoveredTables = new Set([...inventory.migrationTables, ...inventory.tableUsages]);
  const discoveredViews = new Set(inventory.migrationViews);
  const capabilityByTable = new Map<string, Set<string>>();

  for (const capability of atlas.capabilities) {
    for (const table of capability.tables) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) continue;
      if (!capabilityByTable.has(table)) capabilityByTable.set(table, new Set());
      capabilityByTable.get(table)?.add(capability.id);
    }
  }

  const checks: RlsTableCheck[] = [...capabilityByTable.entries()].map(([table, capabilityIds]) => {
    const evidence: string[] = [];
    const physicalTables = physicalTableCandidates(table);
    const enabled = migrations.some(({ file, text }) => {
      const found = physicalTables.some((physicalTable) => rlsRegex(physicalTable).test(text) || dynamicRlsSignal(physicalTable, text, 'enable'));
      if (found) evidence.push(toPosix(file));
      return found;
    });
    const policy = migrations.some(({ file, text }) => {
      const found = physicalTables.some((physicalTable) => policyRegex(physicalTable).test(text) || dynamicRlsSignal(physicalTable, text, 'policy'));
      if (found) evidence.push(toPosix(file));
      return found;
    });

    let status: RlsStatus = 'unknown';
    if (discoveredViews.has(table)) status = 'confirmed_view';
    else if (policy) status = 'confirmed_policy';
    else if (enabled) status = 'confirmed_enabled';
    else if (physicalTables.some((physicalTable) => discoveredTables.has(physicalTable))) status = 'missing_signal';

    return {
      table,
      capabilityIds: [...capabilityIds].sort(),
      status,
      evidence: [...new Set(evidence)].slice(0, 5),
    };
  });

  return {
    tablesChecked: checks.length,
    confirmedEnabled: checks.filter((check) => check.status === 'confirmed_enabled').length,
    confirmedPolicies: checks.filter((check) => check.status === 'confirmed_policy' || check.status === 'confirmed_view').length,
    missingSignals: checks.filter((check) => check.status === 'missing_signal').length,
    unknown: checks.filter((check) => check.status === 'unknown').length,
    tables: checks.sort((a, b) => a.table.localeCompare(b.table)),
  };
}

function rlsRegex(table: string): RegExp {
  return new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:"?public"?\\.)?"?${escapeRegex(table)}"?\\s+enable\\s+row\\s+level\\s+security`, 'i');
}

function policyRegex(table: string): RegExp {
  return new RegExp(`create\\s+policy[\\s\\S]{0,240}\\s+on\\s+(?:public\\.)?"?${escapeRegex(table)}"?`, 'i');
}

function dynamicRlsSignal(table: string, text: string, signal: 'enable' | 'policy'): boolean {
  return dynamicRlsLoops(text).some((loop) => {
    if (!loop.tables.includes(table)) return false;
    if (signal === 'enable') {
      return /execute\s+format\(\s*['"`$f]*[\s\S]{0,160}alter\s+table\s+public\.%I\s+enable\s+row\s+level\s+security/i.test(loop.body);
    }
    return /execute\s+format\([\s\S]{0,260}create\s+policy[\s\S]{0,260}on\s+public\.%(?:1\$)?I/i.test(loop.body);
  });
}

function dynamicRlsLoops(text: string): Array<{ tables: string[]; body: string }> {
  const loops: Array<{ tables: string[]; body: string }> = [];
  for (const match of text.matchAll(/(?:for\s+\w+\s+in\s+select\s+unnest\(array\[([\s\S]*?)\]\)|foreach\s+\w+\s+in\s+array\s+array\[([\s\S]*?)\])([\s\S]*?)end\s+loop/gi)) {
    const rawTables = match[1] ?? match[2] ?? '';
    const body = match[3] ?? '';
    const tables = [...rawTables.matchAll(/'([a-zA-Z_][a-zA-Z0-9_]*)'/g)].map((tableMatch) => tableMatch[1]);
    loops.push({ tables, body });
  }
  return loops;
}

async function safeRead(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return '';
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
