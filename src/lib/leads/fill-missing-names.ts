// Looks up the real name of Messenger / Instagram leads that came in without
// one (older leads, or a failed first-touch lookup) and saves it on the lead.
// Uses the page's own Graph API token; no AI involved.
import type { SupabaseClient } from '@supabase/supabase-js';

type NamelessLead = {
  id: string;
  customer_name: string | null;
  messenger_psid?: string | null;
  instagram_user_id?: string | null;
};

const GRAPH = 'https://graph.facebook.com/v20.0';

async function lookup(id: string, ig: boolean, token: string): Promise<string | null> {
  const fields = ig ? 'name' : 'first_name,last_name';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${GRAPH}/${id}?fields=${fields}&access_token=${token}`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.error(`[leads] name lookup failed status=${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return null;
    }
    const p = (await res.json()) as { name?: string; first_name?: string; last_name?: string };
    const name = (p.name || [p.first_name, p.last_name].filter(Boolean).join(' ')).trim();
    return name || null;
  } catch {
    return null;
  }
}

/** Fills customer_name in place for up to `max` nameless social leads. */
export async function fillMissingLeadNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  leads: NamelessLead[],
  max = 8,
): Promise<void> {
  const token = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  if (!token) return;
  const todo = leads.filter((l) => !l.customer_name && (l.messenger_psid || l.instagram_user_id)).slice(0, max);
  const cache = new Map<string, string | null>();
  await Promise.all(
    todo.map(async (l) => {
      const ig = !l.messenger_psid;
      const sid = (l.messenger_psid || l.instagram_user_id) as string;
      if (!cache.has(sid)) cache.set(sid, await lookup(sid, ig, token));
      const name = cache.get(sid);
      if (!name) return;
      l.customer_name = name;
      const col = ig ? 'instagram_user_id' : 'messenger_psid';
      await db.from('leads').update({ customer_name: name }).eq(col, sid).is('customer_name', null);
    }),
  );
}
