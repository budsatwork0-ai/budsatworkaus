import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const firstEquals = trimmed.indexOf('=');
        if (firstEquals !== -1) {
          const key = trimmed.slice(0, firstEquals).trim();
          let val = trimmed.slice(firstEquals + 1).trim();
          // strip quotes if present
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
          } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  console.warn('Failed to load .env.local manually', e);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Dynamically import runtime after environment variables are loaded
  const { runAgent, executeApprovedAction } = await import('../src/lib/agents/runtime');

  console.log('Saving original crew.ts theme...');
  const crewPath = path.join(process.cwd(), 'src/lib/design-system/themes/crew.ts');
  const originalCrewContent = await fs.promises.readFile(crewPath, 'utf-8');

  console.log('Running design-developer agent test...');
  const result = await runAgent({
    agentId: 'design-developer',
    trigger: 'manual',
    input: {
      prompt: 'Modify the crew portal theme by changing the primary color to #0b3d2b and the sm corner radius to 11px',
    },
  });

  console.log('Run result:', result);

  if (result.status !== 'needs_approval') {
    console.error('Expected run status to be needs_approval, got:', result.status);
    process.exit(1);
  }

  // Find the pending action
  const { data: actions, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('run_id', result.runId)
    .eq('status', 'pending');

  if (error || !actions || actions.length === 0) {
    console.error('Failed to retrieve pending action:', error || 'no actions found');
    process.exit(1);
  }

  const action = actions[0];
  console.log('Found pending action:', action.id, action.preview);

  // Approve action
  console.log('Approving action...');
  const { error: approveError } = await supabase
    .from('agent_actions')
    .update({ status: 'approved' })
    .eq('id', action.id);

  if (approveError) {
    console.error('Failed to approve action:', approveError);
    process.exit(1);
  }

  // Execute approved action
  console.log('Executing approved action...');
  await executeApprovedAction(action.id);

  // Check file on disk
  console.log('Verifying theme file on disk...');
  const updatedCrewContent = await fs.promises.readFile(crewPath, 'utf-8');
  if (updatedCrewContent.includes('#0b3d2b') && updatedCrewContent.includes("sm: '11px'")) {
    console.log('SUCCESS: Theme file was updated correctly on disk!');
  } else {
    console.error('FAILURE: Theme file did not contain expected changes.');
    console.log('Updated content snippet:', updatedCrewContent.slice(0, 1000));
  }

  // Restore original theme file
  console.log('Restoring original crew.ts theme...');
  await fs.promises.writeFile(crewPath, originalCrewContent, 'utf-8');
  console.log('Original theme restored successfully.');
}

main().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
