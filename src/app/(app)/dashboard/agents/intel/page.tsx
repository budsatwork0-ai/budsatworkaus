/**
 * /dashboard/agents/intel — Competitor Intel dashboard.
 *
 * Reads from `competitor_intel` (populated by the Competitor Scout
 * agent), and presents it as:
 *   • a price-distribution chart per service (you vs. the market)
 *   • a comparison matrix (competitor × service)
 *   • a feed of recent scrapes + promo callouts
 */
import { createClient } from '@supabase/supabase-js';
import { IntelClient } from './_components/IntelClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function load() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [intelRes, ourPricingRes] = await Promise.all([
    supabase
      .from('competitor_intel')
      .select('id, competitor_name, url, suburb, service, price_aud, price_unit, promo, raw_snippet, confidence, scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(500),
    supabase
      .from('site_settings')
      .select('key, value')
      .like('key', 'pricing.%'),
  ]);

  return {
    intel: intelRes.data ?? [],
    ourPricing: ourPricingRes.data ?? [],
  };
}

export default async function IntelPage() {
  const { intel, ourPricing } = await load();
  return <IntelClient intel={intel} ourPricing={ourPricing} />;
}
