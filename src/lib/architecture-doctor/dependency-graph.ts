import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ArchitectureInventory, DependencyGraphReport } from './types';
import { capabilityForPath, isAllowedDependency } from './capability-manifest';

const SHARED_DOMAINS = new Set(['shared', 'types', 'utils', 'supabase', 'auth', 'email', 'monitoring', 'architecture-doctor']);

export async function analyzeDependencyGraph(inventory: ArchitectureInventory): Promise<DependencyGraphReport> {
  const files = inventory.sourceFiles.filter((file) => file.includes('/src/') && /\.(ts|tsx)$/.test(file));
  const fileSet = new Set(files.map((file) => toPosix(file)));
  const edges: Array<{ from: string; to: string }> = [];

  for (const file of files) {
    const text = await safeRead(file);
    for (const specifier of extractImports(text)) {
      const resolved = resolveImport(file, specifier, inventory.rootDir, fileSet);
      if (resolved) edges.push({ from: toPosix(file), to: resolved });
    }
  }

  const cycles = dedupeCycleGroups(findCycles(files.map(toPosix), edges), inventory.rootDir).slice(0, 25);
  const crossDomainImports = edges
    .map((edge) => ({
      ...edge,
      fromDomain: domainFor(edge.from),
      toDomain: domainFor(edge.to),
    }))
    .filter((edge) => isSuspiciousDomainEdge(edge.fromDomain, edge.toDomain, edge.from, edge.to, inventory.rootDir))
    .slice(0, 100);

  return {
    filesScanned: files.length,
    importEdges: edges.length,
    cycles,
    crossDomainImports,
  };
}

export function dedupeCycleGroups(cycles: string[][], rootDir = ''): DependencyGraphReport['cycles'] {
  const groups = new Map<string, string[]>();
  for (const cycle of cycles) {
    const canonical = canonicalCycleKey(cycle);
    if (!groups.has(canonical)) groups.set(canonical, cycle);
  }

  return [...groups.entries()].map(([canonicalKey, files]) => {
    const relativeFiles = files.map((file) => (rootDir ? toPosix(path.relative(rootDir, file)) : file));
    const domain = dominantDomain(relativeFiles);
    const capabilityId = firstCapability(relativeFiles);
    return {
      files,
      canonicalKey,
      domain,
      capabilityId,
      recommendedFix: recommendedCycleFix(relativeFiles, domain),
    };
  });
}

export function canonicalCycleKey(cycle: string[]): string {
  return [...new Set(cycle)].sort().join('|');
}

function extractImports(text: string): string[] {
  return [
    ...[...text.matchAll(/import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g)].map((match) => match[1]),
    ...[...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
    ...[...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]),
  ];
}

function resolveImport(fromFile: string, specifier: string, rootDir: string, fileSet: Set<string>): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/')
    ? path.join(rootDir, 'src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ].map(toPosix);

  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function findCycles(nodes: string[], edges: Array<{ from: string; to: string }>): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const seenCycles = new Set<string>();

  function visit(node: string): void {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      const cycle = stack.slice(start).concat(node);
      const key = [...new Set(cycle)].sort().join('|');
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) visit(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of nodes) visit(node);
  return cycles;
}

function domainFor(file: string): string {
  const rel = (file.split('/src/')[1] ?? file).replace(/^src\//, '');
  const parts = rel.split('/');
  if (parts[0] === 'app') {
    const apiIndex = parts.indexOf('api');
    if (apiIndex >= 0) return parts[apiIndex + 1] ?? 'app';
    const dashboardIndex = parts.indexOf('dashboard');
    if (dashboardIndex >= 0) return parts[dashboardIndex + 1] ?? 'dashboard';
    return 'app';
  }
  if (parts[0] === 'lib') return parts[1] ?? 'lib';
  return parts[0] ?? 'unknown';
}

function dominantDomain(files: string[]): string {
  const counts = new Map<string, number>();
  for (const file of files) {
    const domain = domainFor(file);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'unknown';
}

function firstCapability(files: string[]): string | undefined {
  return files.map(capabilityForPath).find(Boolean);
}

function recommendedCycleFix(files: string[], domain: string): string {
  const shortest = [...files].sort((a, b) => a.length - b.length)[0] ?? 'one file';
  return `Move the shared type/helper used by ${domain} cycle into a leaf module, starting with ${shortest}.`;
}

function isSuspiciousDomainEdge(fromDomain: string, toDomain: string, from: string, to: string, rootDir: string): boolean {
  if (!fromDomain || !toDomain || fromDomain === toDomain) return false;
  if (SHARED_DOMAINS.has(fromDomain) || SHARED_DOMAINS.has(toDomain)) return false;
  const fromRel = toPosix(path.relative(rootDir, from));
  const toRel = toPosix(path.relative(rootDir, to));
  if (isAllowedDependency(fromRel, toRel)) return false;
  const fromCapability = capabilityForPath(fromRel);
  const toCapability = capabilityForPath(toRel);
  if (fromCapability && toCapability && fromCapability === toCapability) return false;
  return true;
}

async function safeRead(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return '';
  }
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
