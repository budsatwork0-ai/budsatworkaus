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

const key = process.env.GEMINI_API_KEY!;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

async function main() {
  const res = await fetch(url);
  const json = await res.json() as any;
  if (json.error) {
    console.error(json.error);
  } else {
    console.log(json.models.map((m: any) => m.name));
  }
}

main().catch(console.error);
