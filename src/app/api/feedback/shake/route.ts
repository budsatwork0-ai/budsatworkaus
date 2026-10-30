import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

// Shake-to-feedback from the admin. Saves to site_feedback; screenshot goes to
// the private "feedback-screenshots" bucket. No AI, nothing sent to anyone.
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const form = await req.formData();
  const text = String(form.get('text') ?? '').trim();
  const pageUrl = String(form.get('url') ?? '').slice(0, 500);
  const shot = form.get('screenshot');
  if (!text && !(shot instanceof Blob)) return NextResponse.json({ error: 'Empty' }, { status: 400 });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const now = new Date();
  let photoUrl: string | null = null;
  if (shot instanceof Blob && shot.size > 0 && shot.size < 8_000_000) {
    const path = `${now.toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;
    const up = await db.storage.from('feedback-screenshots').upload(path, shot, { contentType: 'image/png' });
    if (!up.error) {
      const signed = await db.storage.from('feedback-screenshots').createSignedUrl(path, 60 * 60 * 24 * 365);
      photoUrl = signed.data?.signedUrl ?? `feedback-screenshots/${path}`;
    }
  }
  const description = `${text || '(no text)'}\n\nPage: ${pageUrl}\nTime: ${now.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })} AEST\nFrom: ${user.email ?? user.id}`;
  const { error } = await db.from('site_feedback').insert({
    type: 'general', subject: `Shake feedback: ${(text || pageUrl).slice(0, 60)}`, description, photo_url: photoUrl, status: 'new',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
