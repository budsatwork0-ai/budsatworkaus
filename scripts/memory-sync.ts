#!/usr/bin/env npx tsx
/**
 * Memory sync CLI script.
 *
 * Reads the Obsidian vault and syncs all memory notes into Supabase.
 * Run with: npx tsx scripts/memory-sync.ts [--category=ux] [--force]
 *
 * Requires: OBSIDIAN_VAULT_PATH, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: OPENAI_API_KEY (semantic search; keyword fallback if absent)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // fallback to .env
import { syncVault, exportAgentMemories, scaffoldVault } from '../src/lib/memory';
import type { MemoryCategory } from '../src/lib/memory';

const args = process.argv.slice(2);
const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1] as MemoryCategory | undefined;
const force       = args.includes('--force');
const exportFlag  = args.includes('--export');
const scaffold    = args.includes('--scaffold');

async function main() {
  if (scaffold) {
    console.log('Scaffolding vault folder structure…');
    const created = scaffoldVault();
    if (created.length === 0) {
      console.log('  All folders already exist.');
    } else {
      for (const d of created) console.log('  Created:', d);
    }
    console.log('Done.\n');
  }

  console.log(`Syncing vault → Supabase${categoryArg ? ` (category: ${categoryArg})` : ''}…`);
  const stats = await syncVault({ category: categoryArg, forceReembed: force });

  console.log(`\n  ✓ Scanned:  ${stats.scanned}`);
  console.log(`  ✓ Inserted: ${stats.inserted}`);
  console.log(`  ✓ Updated:  ${stats.updated}`);
  console.log(`  ✓ Skipped:  ${stats.skipped}`);
  if (stats.errors.length > 0) {
    console.log(`  ✗ Errors:   ${stats.errors.length}`);
    for (const e of stats.errors) console.error('    ', e);
  }
  console.log(`  ⏱  Duration: ${stats.durationMs}ms`);

  if (exportFlag) {
    console.log('\nExporting agent-written memories to vault…');
    const result = await exportAgentMemories();
    console.log(`  ✓ Exported: ${result.exported}`);
    if (result.errors.length > 0) {
      for (const e of result.errors) console.error('    ', e);
    }
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
