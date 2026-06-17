import React from 'react';
import type { FundraisingItem } from '@/app/api/fundraising/route';
import type { SiteImpactStats } from '@/app/api/site-impact-stats/route';
import GetInvolvedClient from './GetInvolvedClient';

async function getFundraisingItems(): Promise<FundraisingItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/fundraising`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const { items } = (await res.json()) as { items: FundraisingItem[] };
    return items ?? [];
  } catch {
    return [];
  }
}

async function getImpactStats(): Promise<Omit<SiteImpactStats, 'id' | 'updated_at'>> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/site-impact-stats`, { next: { revalidate: 60 } });
    if (!res.ok) return defaultStats;
    const { stats } = (await res.json()) as { stats: SiteImpactStats };
    return stats ?? defaultStats;
  } catch {
    return defaultStats;
  }
}

const defaultStats = {
  participants_supported: 1,
  paid_jobs_completed: 0,
  training_hours_delivered: 0,
  employment_opportunities_created: 0,
};

export default async function GetInvolvedPage() {
  const [items, stats] = await Promise.all([getFundraisingItems(), getImpactStats()]);

  return <GetInvolvedClient items={items} stats={stats} />;
}
