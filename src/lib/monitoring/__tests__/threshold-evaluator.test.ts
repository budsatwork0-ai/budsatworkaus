import { recordAgentFailure, getAgentErrorCount, resetAgentErrorCount, AGENT_ERROR_THRESHOLD } from '../threshold-evaluator';
import * as alertingConfig from '../alerting-config';

jest.mock('../alerting-config', () => ({
  dispatchSlackAlert: jest.fn().mockResolvedValue(undefined),
}));

const dispatchSlackAlert = alertingConfig.dispatchSlackAlert as jest.MockedFunction<
  typeof alertingConfig.dispatchSlackAlert
>;

const AGENT = 'test-agent';

beforeEach(() => {
  resetAgentErrorCount(AGENT);
  dispatchSlackAlert.mockClear();
});

describe('recordAgentFailure', () => {
  it('returns false and does not alert below threshold', async () => {
    for (let i = 0; i < AGENT_ERROR_THRESHOLD - 1; i++) {
      const breached = await recordAgentFailure(AGENT);
      expect(breached).toBe(false);
    }
    expect(dispatchSlackAlert).not.toHaveBeenCalled();
  });

  it('returns true and fires alert at threshold', async () => {
    for (let i = 0; i < AGENT_ERROR_THRESHOLD; i++) {
      await recordAgentFailure(AGENT);
    }
    const breached = await recordAgentFailure(AGENT);
    expect(breached).toBe(true);
    expect(dispatchSlackAlert).toHaveBeenCalledTimes(2); // at threshold and +1
  });

  it('includes correct agent name and count in the alert payload', async () => {
    for (let i = 0; i < AGENT_ERROR_THRESHOLD; i++) {
      await recordAgentFailure(AGENT);
    }
    expect(dispatchSlackAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: AGENT,
        errorCount: AGENT_ERROR_THRESHOLD,
        windowMinutes: 60,
      }),
    );
  });
});

describe('getAgentErrorCount', () => {
  it('reflects recorded failures', async () => {
    await recordAgentFailure(AGENT);
    await recordAgentFailure(AGENT);
    expect(getAgentErrorCount(AGENT)).toBe(2);
  });

  it('returns 0 for unknown agent', () => {
    expect(getAgentErrorCount('unknown-agent')).toBe(0);
  });
});

describe('resetAgentErrorCount', () => {
  it('clears the error window', async () => {
    await recordAgentFailure(AGENT);
    resetAgentErrorCount(AGENT);
    expect(getAgentErrorCount(AGENT)).toBe(0);
  });
});
