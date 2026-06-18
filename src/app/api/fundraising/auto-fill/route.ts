import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const PRICE_RE = /(?:AUD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/i;

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'gclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid', 'ref', 'affiliate',
];

function stripTrackingParams(url: URL): URL {
  const clean = new URL(url.toString());
  for (const param of TRACKING_PARAMS) clean.searchParams.delete(param);
  return clean;
}

function isBunnings(url: URL): boolean {
  return /(?:^|\.)bunnings\.com\.au$/.test(url.hostname);
}

function titleFromSlug(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  const slug = last.replace(/_p\w+$/, '').replace(/[_-]/g, ' ').trim();
  if (!slug) return null;
  return slug.replace(/\b\w/g, (c) => c.toUpperCase());
}

function meta(content: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return decodeHtml(match[1].trim());
  }
  return null;
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function titleFromHtml(content: string) {
  const title = content.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return title ? decodeHtml(title.trim()) : null;
}

function categoryFromText(text: string) {
  const lower = text.toLowerCase();
  if (/(mower|tool|equipment|ladder|pressure|trimmer|blower|cleaner)/.test(lower)) return 'equipment';
  if (/(course|training|certificate|workshop)/.test(lower)) return 'training';
  if (/(shirt|uniform|boots|gloves|ppe|vest)/.test(lower)) return 'uniforms';
  if (/(van|ute|trailer|transport)/.test(lower)) return 'transport';
  if (/(phone|tablet|software|laptop|technology)/.test(lower)) return 'technology';
  return 'general';
}

function absoluteUrl(value: string | null, source: URL) {
  if (!value) return null;
  try {
    return new URL(value, source).toString();
  } catch {
    return value;
  }
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let productUrl: string;
  try {
    const body = (await req.json()) as { url?: unknown };
    productUrl = String(body.url ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(productUrl);
  } catch {
    return NextResponse.json({ error: 'Enter a valid product URL' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return NextResponse.json({ error: 'Only http and https URLs are supported' }, { status: 400 });
  }

  const cleanUrl = stripTrackingParams(url);

  function manualFallback(reason: string) {
    const inferredTitle = titleFromSlug(cleanUrl);
    const category = categoryFromText(`${inferredTitle ?? ''} ${cleanUrl.pathname}`);
    return NextResponse.json({
      item: {
        title: inferredTitle ?? '',
        category,
        status: 'draft',
        image_url: null,
        goal_amount_cents: 0,
        short_reason: inferredTitle ? `Help Buds At Work purchase ${inferredTitle}.` : '',
        who_it_helps: 'Buds At Work participants and crew members',
        employment_impact:
          'Supports safer, better-equipped paid shifts and helps turn community demand into practical work.',
        cta_label: 'Fund This',
        supplier_url: cleanUrl.toString(),
        payment_url: cleanUrl.toString(),
      },
      missing: { price: true, image: true, description: true },
      manual_entry: true,
      manual_entry_reason: reason,
    });
  }

  if (isBunnings(cleanUrl)) {
    return manualFallback(
      "Bunnings blocks automatic product fetching. We've saved the URL — please add the item details manually.",
    );
  }

  try {
    const response = await fetch(cleanUrl.toString(), {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'BudsAtWorkAdmin/1.0 (+https://budsatwork.com)',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 403 || response.status === 401 || response.status === 429) {
      return manualFallback(
        `This retailer blocks automatic product fetching. We've saved the URL — please add the item details manually.`,
      );
    }

    if (!response.ok) {
      return manualFallback(
        `Could not fetch product page (${response.status}). We've saved the URL — please add the item details manually.`,
      );
    }

    const html = await response.text();
    const title = meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? titleFromHtml(html) ?? cleanUrl.hostname;
    const description = meta(html, 'og:description') ?? meta(html, 'description') ?? '';
    const image = absoluteUrl(meta(html, 'og:image') ?? meta(html, 'twitter:image'), cleanUrl);
    const priceText = meta(html, 'product:price:amount') ?? html.match(PRICE_RE)?.[1] ?? null;
    const price = priceText ? Math.round(Number(priceText.replaceAll(',', '')) * 100) : 0;
    const category = categoryFromText(`${title} ${description} ${cleanUrl.pathname}`);

    return NextResponse.json({
      item: {
        title,
        category,
        status: 'draft',
        image_url: image,
        goal_amount_cents: Number.isFinite(price) ? price : 0,
        short_reason: description || `Help Buds At Work purchase ${title}.`,
        who_it_helps: 'Buds At Work participants and crew members',
        employment_impact:
          'Supports safer, better-equipped paid shifts and helps turn community demand into practical work.',
        cta_label: 'Fund This',
        supplier_url: cleanUrl.toString(),
      },
      missing: {
        price: !price,
        image: !image,
        description: !description,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auto-fill failed';
    return manualFallback(`Auto-fill encountered an error (${message}). We've saved the URL — please add the item details manually.`);
  }
}
