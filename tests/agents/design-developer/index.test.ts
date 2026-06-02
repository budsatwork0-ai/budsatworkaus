import { describe, it, expect, vi } from 'vitest';
import { runDesignDeveloperAgent, type AgentEvent } from '@/agents/design-developer/index';

const validInput = {
  componentName: 'HeroSection',
  theme: {
    color: {
      accent:  '#1C7C54',
      primary: '#134E35',
      text:    '#0F1A14',
      muted:   '#6B7280',
      bg:      '#F9FAFB',
      card:    '#FFFFFF',
      surface: '#F3F4F6',
    },
  },
};

describe('runDesignDeveloperAgent', () => {
  it('emits a success event for valid input', async () => {
    const handler = vi.fn<[AgentEvent], void>();
    const event = await runDesignDeveloperAgent(validInput, handler);
    expect(event.type).toBe('design_developer.success');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('emits a validation_error failure event for invalid input', async () => {
    const handler = vi.fn<[AgentEvent], void>();
    const event = await runDesignDeveloperAgent({ componentName: '' }, handler);
    expect(event.type).toBe('design_developer.failure');
    if (event.type === 'design_developer.failure') {
      expect(event.reason).toBe('validation_error');
      expect(typeof event.message).toBe('string');
    }
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emits a validation_error failure event for null input', async () => {
    const handler = vi.fn<[AgentEvent], void>();
    const event = await runDesignDeveloperAgent(null, handler);
    expect(event.type).toBe('design_developer.failure');
    if (event.type === 'design_developer.failure') {
      expect(event.reason).toBe('validation_error');
    }
  });

  it('records durationMs on every event', async () => {
    const event = await runDesignDeveloperAgent(validInput);
    expect(typeof event.durationMs).toBe('number');
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not throw on null input', async () => {
    await expect(runDesignDeveloperAgent(null)).resolves.toBeDefined();
  });
});
