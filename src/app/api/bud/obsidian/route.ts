import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const VAULT_SECTIONS = [
  { key: 'systems',        dir: 'Systems',        label: 'Systems' },
  { key: 'components',     dir: 'Components',      label: 'Components' },
  { key: 'refactor-plans', dir: 'Refactor Plans',  label: 'Refactor Plans' },
  { key: 'claude-memory',  dir: 'Claude Memory',   label: 'Claude Memory' },
] as const;

export type ObsidianNote = {
  title: string;
  section: string;
  sectionLabel: string;
  relativePath: string;
  preview: string;
  wordCount: number;
  updatedAt: string;
};

export type ObsidianResponse =
  | { available: false; reason: string }
  | {
      available: true;
      vaultPath: string;
      notes: ObsidianNote[];
      totalNotes: number;
      sections: { key: string; label: string; count: number }[];
    };

function previewContent(content: string, maxChars = 240): string {
  return content
    .replace(/^#+\s+.+$/gm, '')   // strip headings
    .replace(/\[\[.*?\]\]/g, '')   // strip wiki links
    .replace(/\n{2,}/g, ' ')
    .trim()
    .slice(0, maxChars)
    .trimEnd()
    + (content.length > maxChars ? '…' : '');
}

export async function GET(): Promise<NextResponse<ObsidianResponse>> {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ available: false, reason: 'unauthorized' }, { status: 401 });
  }

  const vaultBase = process.env.OBSIDIAN_VAULT_PATH
    ? path.join(process.env.OBSIDIAN_VAULT_PATH, 'architecture')
    : path.join(process.cwd(), 'Buds At Work', 'architecture');

  if (!fs.existsSync(vaultBase)) {
    return NextResponse.json({
      available: false,
      reason: `architecture vault not found at ${vaultBase}`,
    });
  }

  const notes: ObsidianNote[] = [];

  for (const section of VAULT_SECTIONS) {
    const sectionDir = path.join(vaultBase, section.dir);
    if (!fs.existsSync(sectionDir)) continue;

    const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const fullPath = path.join(sectionDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const stat = fs.statSync(fullPath);
        const title = file.replace(/\.md$/, '');
        notes.push({
          title,
          section: section.key,
          sectionLabel: section.label,
          relativePath: path.join('Buds At Work', 'architecture', section.dir, file),
          preview: previewContent(content),
          wordCount: content.split(/\s+/).filter(Boolean).length,
          updatedAt: stat.mtime.toISOString(),
        });
      } catch { /* skip unreadable file */ }
    }
  }

  // Sort: most recently updated first
  notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const sections = VAULT_SECTIONS.map(s => ({
    key: s.key,
    label: s.label,
    count: notes.filter(n => n.section === s.key).length,
  }));

  return NextResponse.json({
    available: true,
    vaultPath: vaultBase,
    notes,
    totalNotes: notes.length,
    sections,
  });
}
