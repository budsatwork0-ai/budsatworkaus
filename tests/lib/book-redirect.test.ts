import { describe, expect, it } from 'vitest';
import { servicesPathWithQuery } from '@/app/(public)/services/lib/book-redirect';

describe('servicesPathWithQuery', () => {
  it('returns /services when there are no params', () => {
    expect(servicesPathWithQuery({})).toBe('/services');
  });

  it('preserves a single query param', () => {
    expect(servicesPathWithQuery({ service: 'windows' })).toBe('/services?service=windows');
  });

  it('preserves multiple query params', () => {
    expect(servicesPathWithQuery({ rebook: 'windows', context: 'home' })).toBe(
      '/services?rebook=windows&context=home',
    );
  });

  it('appends repeated values', () => {
    expect(servicesPathWithQuery({ tag: ['a', 'b'] })).toBe('/services?tag=a&tag=b');
  });

  it('ignores undefined values', () => {
    expect(servicesPathWithQuery({ service: 'yard', unused: undefined })).toBe(
      '/services?service=yard',
    );
  });
});
