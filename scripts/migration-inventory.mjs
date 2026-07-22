import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const migrationsRoot = path.join(root, 'supabase', 'migrations');
const outputPath = path.join(root, 'docs', 'database', 'migration-inventory.json');

const patterns = {
  tablesCreated: /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([\w."']+)/gi,
  tablesAltered: /\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+([\w."']+)/gi,
  functions: /\bCREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([\w."']+)/gi,
  triggers: /\bCREATE\s+TRIGGER\s+([\w."']+)/gi,
  policies: /\bCREATE\s+POLICY\s+([\w."']+)/gi,
  indexes: /\bCREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([\w."']+)/gi,
  types: /\bCREATE\s+TYPE\s+([\w."']+)/gi,
  extensions: /\bCREATE\s+EXTENSION(?:\s+IF\s+NOT\s+EXISTS)?\s+([\w."'-]+)/gi,
  references: /\bREFERENCES\s+([\w."']+)/gi,
};

const normalise = (value) => value.replaceAll('"', '').replaceAll("'", '').replace(/^public\./, '').toLowerCase();
const collect = (sql, regex) => [...sql.matchAll(regex)].map((match) => normalise(match[1]));
const unique = (values) => [...new Set(values)].sort();

const topLevel = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => ({ location: 'top-level', filename: entry.name, relativePath: entry.name }));
const legacy = (await readdir(path.join(migrationsRoot, 'legacy'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => ({ location: 'legacy', filename: entry.name, relativePath: path.join('legacy', entry.name) }));

const files = [...topLevel, ...legacy].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
const inventory = [];

for (const file of files) {
  const sql = await readFile(path.join(migrationsRoot, file.relativePath), 'utf8');
  const objects = Object.fromEntries(Object.entries(patterns).map(([key, regex]) => [key, unique(collect(sql, regex))]));
  const orderingPrefix = file.filename.match(/^(\d+[a-z]?|\d{14})[_-]/i)?.[1] ?? null;
  const created = new Set(objects.tablesCreated);
  const dependencies = unique([
    ...objects.references,
    ...objects.tablesAltered,
  ].filter((object) => !created.has(object)));
  const isRemoteStub = /No local SQL file was available at reconciliation time/.test(sql);
  const createsObjects = Object.entries(objects).some(([key, values]) => key !== 'references' && values.length > 0);
  let classification = file.location === 'legacy' ? 'historical' : 'production-relevant';
  if (file.filename === 'combined_migration.sql') classification = 'superseded-baseline-candidate';
  else if (isRemoteStub) classification = 'remote-history-stub';
  else if (!createsObjects && /Applied and tracked/.test(sql)) classification = 'tracking-stub';
  else if (/Run this single file in Supabase SQL Editor/i.test(sql)) classification = 'transitional';

  inventory.push({
    ...file,
    orderingPrefix,
    classification,
    byteLength: Buffer.byteLength(sql),
    lineCount: sql.split('\n').length,
    objects,
    dependencies,
    flags: {
      remoteOnlySqlMissing: isRemoteStub,
      securityDefiner: /\bSECURITY\s+DEFINER\b/i.test(sql),
      securityInvoker: /\bSECURITY\s+INVOKER\b/i.test(sql),
      rowLevelSecurity: /\bROW\s+LEVEL\s+SECURITY\b/i.test(sql),
      grantsOrRevokes: /\b(?:GRANT|REVOKE)\b/i.test(sql),
      destructiveDdl: /\b(?:DROP\s+TABLE|TRUNCATE)\b/i.test(sql),
      dataMutation: /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(sql),
    },
  });
}

const creators = new Map();
for (const item of inventory) {
  for (const table of item.objects.tablesCreated) {
    const paths = creators.get(table) ?? [];
    paths.push(item.relativePath);
    creators.set(table, paths);
  }
}
const overlaps = Object.fromEntries([...creators.entries()].filter(([, paths]) => paths.length > 1).sort());

const document = {
  generatedBy: 'scripts/migration-inventory.mjs',
  counts: { total: inventory.length, topLevel: topLevel.length, legacy: legacy.length },
  overlaps,
  migrations: inventory,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Wrote ${inventory.length} migration records to ${path.relative(root, outputPath)}`);
