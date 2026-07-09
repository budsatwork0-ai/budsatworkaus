import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AtlasSpec, ArchitectureInventory, GovernanceCheck, GovernanceSignalName } from './types';

const SIGNALS: Record<GovernanceSignalName, RegExp[]> = {
  rls: [/row\s+level\s+security/i, /create\s+policy/i, /\bRLS\b/i],
  audit: [/auditLog\b/, /audit_log/, /logAudit\b/, /bud_audit_logs/],
  retry: [/\bretry\b/i, /\bretries\b/i, /attempt_count/i, /\bbackoff\b/i],
  monitoring: [/console\.error/, /Sentry/, /health/i, /alert/i, /monitor/i],
  fallback: [/\bfallback\b/i, /\?\?/, /\|\|/, /\bdefault\b/i],
};

export async function analyzeGovernance(atlas: AtlasSpec, inventory: ArchitectureInventory): Promise<GovernanceCheck[]> {
  const sourceTexts = await readSourceTexts(inventory.sourceFiles);
  const migrationTexts = sourceTexts.filter((entry) => entry.file.includes('/supabase/migrations/'));

  return atlas.capabilities.map((capability) => {
    const related = sourceTexts.filter(({ file, text }) => {
      const rel = toPosix(path.relative(inventory.rootDir, file));
      return (
        capability.apiRoutes.some((route) => rel.includes(apiRouteToPath(route))) ||
        capability.uiPages.some((page) => rel.includes(pageToPath(page))) ||
        capability.agents.some((agent) => rel.endsWith(`/src/lib/agents/agents/${agent}.ts`) || rel.endsWith(`agents/${agent}.ts`)) ||
        capability.tables.some((table) => text.includes(`'${table}'`) || text.includes(`"${table}"`))
      );
    });

    const relatedWithMigrations = [
      ...related,
      ...migrationTexts.filter(({ text }) => capability.tables.some((table) => text.includes(table))),
    ];

    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      signals: {
        rls: signalStatus(relatedWithMigrations, 'rls'),
        audit: signalStatus(relatedWithMigrations, 'audit'),
        retry: signalStatus(relatedWithMigrations, 'retry'),
        monitoring: signalStatus(relatedWithMigrations, 'monitoring'),
        fallback: signalStatus(relatedWithMigrations, 'fallback'),
      },
    };
  });
}

function signalStatus(files: Array<{ file: string; text: string }>, signal: GovernanceSignalName) {
  const evidence = files
    .filter(({ text }) => SIGNALS[signal].some((regex) => regex.test(text)))
    .map(({ file }) => toPosix(file))
    .slice(0, 5);

  return {
    status: evidence.length > 0 ? ('present' as const) : ('unknown' as const),
    evidence,
  };
}

async function readSourceTexts(files: string[]): Promise<Array<{ file: string; text: string }>> {
  return Promise.all(
    files.map(async (file) => {
      try {
        return { file, text: await readFile(file, 'utf8') };
      } catch {
        return { file, text: '' };
      }
    }),
  );
}

function apiRouteToPath(route: string): string {
  if (!route.startsWith('/api/') || route.includes('*')) return '\0';
  return `src/app/api/${route.slice('/api/'.length)}/route.ts`;
}

function pageToPath(page: string): string {
  if (!page.startsWith('/') || page.includes('*')) return '\0';
  return `${page.replace(/^\//, '')}/page.tsx`;
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
