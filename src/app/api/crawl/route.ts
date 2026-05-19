/**
 * POST /api/crawl
 *
 * Crawls the public-facing pages of budsatwork.com, strips HTML to plain text,
 * and upserts each page as a memory_document (category='architecture', source='import').
 *
 * Detection: connected.crawler in MissionControlClient checks for memory_documents
 * with vault_path starting with 'site/'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { upsertMemory } from '@/lib/memory/write';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Public pages to index
const CRAWL_PAGES: { path: string; title: string; category: 'architecture' | 'ux' | 'sops' }[] = [
  { path: '/',          title: 'Homepage — Buds At Work',               category: 'ux' },
  { path: '/services',  title: 'Services & Quote Builder — Buds At Work', category: 'ux' },
  { path: '/about',     title: 'About — Buds At Work',                  category: 'sops' },
  { path: '/contact',   title: 'Contact — Buds At Work',                category: 'sops' },
];

function stripHtml(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Replace block elements with newlines
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|br)>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://budsatwork.com';
  const results: { path: string; result: string }[] = [];
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const page of CRAWL_PAGES) {
    const url = `${siteUrl}${page.path}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BudsAtWork-Crawler/1.0' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        results.push({ path: page.path, result: `skip (${res.status})` });
        continue;
      }
      const html = await res.text();
      const body = stripHtml(html).slice(0, 6000); // cap at 6k chars

      const outcome = await upsertMemory(supabase as Parameters<typeof upsertMemory>[0], {
        vaultPath:    `site${page.path === '/' ? '/homepage' : page.path}.md`,
        category:     page.category,
        title:        page.title,
        body,
        tags:         ['site', 'crawled'],
        agentScope:   null,
        source:       'import',
        embedding:    [], // embeddings generated async or skipped
        frontmatter:  { url, crawled_at: new Date().toISOString() },
      });

      if (outcome === 'inserted') inserted++;
      else if (outcome === 'updated') updated++;
      else updated++; // 'skipped' counts as already up-to-date

      results.push({ path: page.path, result: outcome });
    } catch (err) {
      failed++;
      results.push({ path: page.path, result: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  return NextResponse.json({ inserted, updated, failed, pages: results });
}
