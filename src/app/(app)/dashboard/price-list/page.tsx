import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { PriceListClient, type PriceRow } from './PriceListClient';

export const dynamic = 'force-dynamic';

export default async function PriceListPage() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') notFound();
  let rows: PriceRow[] = [];
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await db.from('price_list').select('*').order('service').order('sort_order');
    rows = (data ?? []) as PriceRow[];
  } catch { /* empty list */ }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-[#0F3F33]">Price list</h1>
        <p className="text-sm text-[#0F3F33]/70">Tap a price to change it. The website uses these prices straight away.</p>
      </div>
      <PriceListClient initialRows={rows} />
    </div>
  );
}
