import React from 'react';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FundraisingItem } from '@/app/api/fundraising/route';
import type { SiteImpactStats } from '@/app/api/site-impact-stats/route';
import type { SocialProofItem } from '@/app/api/social-proof/route';
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

async function getSocialProofItems(): Promise<SocialProofItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/social-proof`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const { items } = (await res.json()) as { items: SocialProofItem[] };
    return items ?? [];
  } catch {
    return [];
  }
}

const defaultStats = {
  participants_supported: 1,
  paid_jobs_completed: 0,
  training_hours_delivered: 0,
  employment_opportunities_created: 0,
};

export default async function GetInvolvedPage() {
  const [items, stats, socialItems] = await Promise.all([
    getFundraisingItems(),
    getImpactStats(),
    getSocialProofItems(),
  ]);

  const heroPath = path.join(process.cwd(), 'public/images/get-involved-hero.png');
  const heroImageUrl = existsSync(heroPath) ? '/images/get-involved-hero.png' : null;

  return (
    <GetInvolvedClient
      items={items}
      stats={stats}
      socialItems={socialItems}
      heroImageUrl={heroImageUrl}
    />
  );
}
