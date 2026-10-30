import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { ContentTemplates, type SavedPost } from './ContentTemplates';

export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') notFound();
  let posts: SavedPost[] = [];
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await db.from('content_posts').select('id,service,suburb,caption,cta,photo_tip,created_at')
      .is('archived_at', null).order('created_at', { ascending: false }).limit(50);
    posts = (data ?? []) as SavedPost[];
  } catch { /* show empty list */ }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[#0F3F33]">Content</h1>
        <p className="text-sm text-[#0F3F33]/70">Pick a service and suburb, then copy a post.</p>
      </div>
      <ContentTemplates initialPosts={posts} />
      <a href="/dashboard/content/all" className="hidden">Old content studio</a>
    </div>
  );
}
