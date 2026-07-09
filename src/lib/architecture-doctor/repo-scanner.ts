import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArchitectureInventory, CronEntry } from './types';

const IGNORED_DIRS = new Set(['.git', '.next', 'node_modules', 'coverage']);

export async function scanRepository(rootDir: string): Promise<ArchitectureInventory> {
  const sourceRoots = [
    path.join(rootDir, 'src'),
    path.join(rootDir, 'supabase/migrations'),
    path.join(rootDir, 'scripts'),
  ];
  const [pages, apiRoutes, agentFiles, allFiles, cronEntries] = await Promise.all([
    collectFiles(path.join(rootDir, 'src/app'), (file) => file.endsWith('/page.tsx')),
    collectFiles(path.join(rootDir, 'src/app/api'), (file) => file.endsWith('/route.ts')),
    collectFiles(path.join(rootDir, 'src/lib/agents/agents'), (file) => file.endsWith('.ts')),
    collectSourceFiles(sourceRoots, rootDir),
    readCronEntries(rootDir),
  ]);

  const sourceFiles = allFiles.filter((file) => !file.includes('/node_modules/') && !file.includes('/.next/'));
  const sourceTexts = await readFiles(sourceFiles);
  const migrationTexts = sourceTexts.filter((entry) => entry.file.includes('/supabase/migrations/'));

  const migrationTables = unique(
    migrationTexts.flatMap(({ text }) => [
      ...matchSqlNames(text, /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/gi),
      ...matchSqlNames(text, /\balter\s+table\s+(?:if\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/gi),
    ]),
  );

  const migrationViews = unique(
    migrationTexts.flatMap(({ text }) =>
      matchSqlNames(text, /\bcreate\s+(?:or\s+replace\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/gi),
    ),
  );

  const tableUsages = unique(
    sourceTexts.flatMap(({ text }) => [
      ...matchStringArgs(text, /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)/g),
      ...matchStringArgs(text, /\.rpc\(\s*['"`]([^'"`]+)['"`]\s*\)/g),
    ]).filter(isSqlIdentifier),
  );

  const envVars = unique(
    sourceTexts.flatMap(({ text }) => [
      ...matchStringArgs(text, /process\.env\.([A-Z0-9_]+)/g),
      ...matchStringArgs(text, /process\.env\[['"]([A-Z0-9_]+)['"]\]/g),
    ]),
  );

  const storageBuckets = unique(
    sourceTexts.flatMap(({ text }) => [
      ...matchStringArgs(text, /bucket_id\s*=\s*['"]([^'"]+)['"]/g),
      ...matchStringArgs(text, /\.from\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(?:upload|download|remove|getPublicUrl|createSignedUrl)/g),
      ...matchStringArgs(text, /storage\.buckets[\s\S]{0,400}values\s*\(\s*['"]([^'"]+)['"]/gi),
    ]),
  );

  const normalizedApiRoutes = unique(apiRoutes.map((file) => apiRouteFromFile(rootDir, file)));
  const cronRouteCandidates = unique([
    ...normalizedApiRoutes.filter((route) => route.startsWith('/api/cron/')),
    ...normalizedApiRoutes.filter((route) => route === '/api/agents/cron' || route === '/api/agents/reap-zombies'),
  ]);

  return {
    rootDir,
    sourceFiles,
    pages: unique(pages.map((file) => pageRouteFromFile(rootDir, file))),
    apiRoutes: normalizedApiRoutes,
    agents: unique(agentFiles.map((file) => path.basename(file, '.ts'))),
    cronEntries,
    cronRouteCandidates,
    migrationTables,
    migrationViews,
    tableUsages,
    envVars,
    storageBuckets,
  };
}

async function collectFiles(dir: string, predicate: (file: string) => boolean): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && predicate(toPosix(fullPath))) {
        files.push(toPosix(fullPath));
      }
    }
  }

  await walk(dir);
  return files.sort();
}

async function collectSourceFiles(sourceRoots: string[], rootDir: string): Promise<string[]> {
  const files = (
    await Promise.all(sourceRoots.map((sourceRoot) => collectFiles(sourceRoot, (file) => /\.(ts|tsx|js|mjs|sql)$/.test(file))))
  ).flat();
  files.push(path.join(rootDir, 'vercel.json'));
  return unique(files.map(toPosix));
}

async function readFiles(files: string[]): Promise<Array<{ file: string; text: string }>> {
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        return { file, text: await readFile(file, 'utf8') };
      } catch {
        return { file, text: '' };
      }
    }),
  );
  return entries;
}

async function readCronEntries(rootDir: string): Promise<CronEntry[]> {
  try {
    const text = await readFile(path.join(rootDir, 'vercel.json'), 'utf8');
    const parsed = JSON.parse(text) as { crons?: Array<{ path?: string; schedule?: string }> };
    return (parsed.crons ?? [])
      .filter((entry): entry is { path: string; schedule: string } => Boolean(entry.path && entry.schedule))
      .map((entry) => ({
        path: entry.path,
        routePath: entry.path.split('?')[0],
        schedule: entry.schedule,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    return [];
  }
}

function pageRouteFromFile(rootDir: string, file: string): string {
  const rel = toPosix(path.relative(path.join(rootDir, 'src/app'), file));
  const segments = rel.split('/').slice(0, -1).filter((segment) => !isRouteGroup(segment));
  return normalizeRoute(`/${segments.join('/')}`);
}

function apiRouteFromFile(rootDir: string, file: string): string {
  const rel = toPosix(path.relative(path.join(rootDir, 'src/app/api'), file));
  const segments = rel.split('/').slice(0, -1).filter((segment) => !isRouteGroup(segment));
  return normalizeRoute(`/api/${segments.join('/')}`);
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function normalizeRoute(route: string): string {
  const cleaned = route.replace(/\/+/g, '/').replace(/\/$/, '');
  return cleaned === '' ? '/' : cleaned;
}

function matchStringArgs(text: string, regex: RegExp): string[] {
  return [...text.matchAll(regex)].map((match) => normalizeSqlName(match[1])).filter(Boolean);
}

function matchSqlNames(text: string, regex: RegExp): string[] {
  return [...text.matchAll(regex)].map((match) => normalizeSqlName(match[1])).filter(Boolean);
}

function normalizeSqlName(value: string): string {
  return value.trim().replace(/^public\./, '').replace(/^"|"$/g, '');
}

function isSqlIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}
