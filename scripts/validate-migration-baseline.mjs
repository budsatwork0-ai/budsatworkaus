import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const migrationsRoot = path.join(root, 'supabase', 'migrations');
const requiredTail = [
  '20260722090000_151_payment_workspace_hardening.sql',
  '20260722100000_152_refund_event_fanout.sql',
];
const remoteStubMarker = 'No local SQL file was available at reconciliation time';

const topLevel = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort();
const legacy = (await readdir(path.join(migrationsRoot, 'legacy'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort();

for (const filename of requiredTail) {
  if (!topLevel.includes(filename)) throw new Error(`Required migration is unreachable: ${filename}`);
}

const remoteStubs = [];
for (const filename of topLevel) {
  const sql = await readFile(path.join(migrationsRoot, filename), 'utf8');
  if (sql.includes(remoteStubMarker)) remoteStubs.push(filename);
}

const contractPath = path.join(migrationsRoot, 'BASELINE.md');
const contract = await readFile(contractPath, 'utf8').catch(() => '');
if (!contract.includes('Status: upgrade-only')) {
  throw new Error('supabase/migrations/BASELINE.md must explicitly identify the top-level chain as upgrade-only');
}
if (legacy.length === 0 || remoteStubs.length === 0) {
  throw new Error('Expected reconciled legacy migrations and remote-history stubs are missing');
}

console.log(JSON.stringify({
  status: 'upgrade-only',
  topLevelMigrations: topLevel.length,
  excludedLegacyMigrations: legacy.length,
  remoteHistoryStubs: remoteStubs.length,
  requiredTail,
}, null, 2));
