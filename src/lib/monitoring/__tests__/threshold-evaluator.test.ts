import { recordAgentFailure, getAgentErrorCount } from '../threshold-evaluator';
import * as alertingConfig from '../alerting-config';

describe('threshold-evaluator', () => {
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    dispatchSpy = jest
      .spyOn(alertingConfig, 'dispatchSlackAlert')
      .mockResolvedValue(undefined);
    // Reset module state between tests by re-requiring if needed;
    // spying is sufficient here since the rolling window is time-based.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('dispatches a Slack alert when error count breaches the threshold', async () => {
    const agentName = 'test-agent';
    const threshold = Number(process.env.AGENT_ERROR_THRESHOLD ?? '5');

    for (let i = 0; i < threshold; i++) {
      await recordAgentFailure(agentName);
    }

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ agentName })
    );
  });

  it('does not dispatch an alert below the threshold', async () => {
    const agentName = 'quiet-agent';
    const threshold = Number(process.env.AGENT_ERROR_THRESHOLD ?? '5');

    for (let i = 0; i < threshold - 1; i++) {
      await recordAgentFailure(agentName);
    }

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('getAgentErrorCount reflects recorded failures within the window', async () => {
    const agentName = 'counter-agent';

    await recordAgentFailure(agentName);
    await recordAgentFailure(agentName);

    const count = getAgentErrorCount(agentName);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('does not count errors outside the 60-minute rolling window', async () => {
    const agentName = 'stale-agent';

    await recordAgentFailure(agentName);

    // Advance time beyond the 60-minute window
    jest.advanceTimersByTime(61 * 60 * 1000);

    const count = getAgentErrorCount(agentName);
    expect(count).toBe(0);
  });
});
