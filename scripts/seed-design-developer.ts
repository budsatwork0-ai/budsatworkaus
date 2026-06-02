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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('Seeding design-developer agent...');
  const { error } = await supabase.from('agents').upsert({
    id: 'design-developer',
    name: 'Design Developer',
    description: 'Applies theme changes and visual design modifications to the dashboard, crew portal, and public themes based on natural language requests.',
    category: 'ops',
    autonomy: 'review',
    schedule: null,
    config: { allowed_themes: ['dashboard', 'crew', 'public'] },
  });

  if (error) {
    console.error('Failed to seed agent:', error);
    process.exit(1);
  }

  console.log('Successfully seeded design-developer agent!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
