import { describe, it, expect } from 'vitest';
import { classifySensitiveFile, sensitiveFilesIn } from '@/lib/bud/sensitive-paths';

describe('classifySensitiveFile — pricing/payments/auth require human approval', () => {
  it('flags pricing engine and constants', () => {
    expect(classifySensitiveFile('src/app/(public)/services/lib/pricing/engine.ts')).toBe('pricing');
    expect(classifySensitiveFile('src/app/(public)/services/lib/pricing/constants.ts')).toBe('pricing');
    expect(classifySensitiveFile('src/lib/services-core/ndis-pricing.ts')).toBe('pricing');
    expect(classifySensitiveFile('src/app/ui/yard/yardPricing.ts')).toBe('pricing');
    expect(classifySensitiveFile('src/lib/payments/pricing.ts')).toBe('pricing');
  });

  it('flags Stripe / payments / checkout', () => {
    expect(classifySensitiveFile('src/app/api/webhooks/stripe/route.ts')).toBe('payments');
    expect(classifySensitiveFile('src/lib/stripe/client.ts')).toBe('payments');
    expect(classifySensitiveFile('src/app/api/checkout/route.ts')).toBe('payments');
  });

  it('flags auth / middleware / server client', () => {
    expect(classifySensitiveFile('src/middleware.ts')).toBe('auth');
    expect(classifySensitiveFile('src/lib/supabase/server.ts')).toBe('auth');
    expect(classifySensitiveFile('src/lib/auth/session.ts')).toBe('auth');
  });

  it('does NOT flag ordinary files (no false positives on common code)', () => {
    expect(classifySensitiveFile('src/app/ui/home/HomePage.tsx')).toBeNull();
    expect(classifySensitiveFile('src/lib/agents/agents/quote-triage.ts')).toBeNull();
    expect(classifySensitiveFile('src/lib/agents/agents/price-optimizer.ts')).toBeNull();
    expect(classifySensitiveFile('src/app/ui/theme.ts')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(classifySensitiveFile('SRC/LIB/PRICING/Engine.ts')).toBe('pricing');
  });
});

describe('sensitiveFilesIn', () => {
  it('returns only the sensitive paths, tagged with category', () => {
    const hits = sensitiveFilesIn([
      'src/app/ui/home/HomePage.tsx',
      'src/app/(public)/services/lib/pricing/engine.ts',
      'src/app/api/webhooks/stripe/route.ts',
    ]);
    expect(hits).toEqual([
      { file: 'src/app/(public)/services/lib/pricing/engine.ts', category: 'pricing' },
      { file: 'src/app/api/webhooks/stripe/route.ts', category: 'payments' },
    ]);
  });

  it('returns [] when nothing is sensitive', () => {
    expect(sensitiveFilesIn(['src/app/ui/theme.ts', 'README.md'])).toEqual([]);
  });
});
