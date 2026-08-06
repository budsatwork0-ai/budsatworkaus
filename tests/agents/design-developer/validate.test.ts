import { describe, it, expect } from 'vitest';
import { validateDesignDeveloperInput } from '@/agents/design-developer/validate';

const validTheme = {
  color: {
    accent:  '#1C7C54',
    primary: '#134E35',
    text:    '#0F1A14',
    muted:   '#6B7280',
    bg:      '#F9FAFB',
    card:    '#FFFFFF',
    surface: '#F3F4F6',
  },
};

describe('validateDesignDeveloperInput', () => {
  it('accepts a valid input', () => {
    const result = validateDesignDeveloperInput({
      componentName: 'HeroSection',
      theme: validTheme,
    });
    expect(result.ok).toBe(true);
  });

  it('accepts valid input with optional props', () => {
    const result = validateDesignDeveloperInput({
      componentName: 'ServiceCard',
      props: { label: 'Cleaning', price: 99 },
      theme: validTheme,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects missing componentName', () => {
    const result = validateDesignDeveloperInput({
      theme: validTheme,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/componentName/);
    }
  });

  it('rejects missing theme', () => {
    const result = validateDesignDeveloperInput({
      componentName: 'HeroSection',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects theme with missing color token', () => {
    const result = validateDesignDeveloperInput({
      componentName: 'HeroSection',
      theme: {
        color: {
          accent:  '#1C7C54',
          // primary intentionally omitted
          text:    '#0F1A14',
          muted:   '#6B7280',
          bg:      '#F9FAFB',
          card:    '#FFFFFF',
          surface: '#F3F4F6',
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.length).toBeGreaterThan(0);
    }
  });

  it('rejects null input', () => {
    const result = validateDesignDeveloperInput(null);
    expect(result.ok).toBe(false);
  });

  it('rejects empty string componentName', () => {
    const result = validateDesignDeveloperInput({
      componentName: '',
      theme: validTheme,
    });
    expect(result.ok).toBe(false);
  });
});
