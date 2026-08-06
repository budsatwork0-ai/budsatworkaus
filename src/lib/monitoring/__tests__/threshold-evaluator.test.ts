import { recordAgentFailure, getAgentErrorCount } from '../threshold-evaluator';
import * as alertingConfig from '../alerting-config';

const AGENT = 'test-agent';
const THRESHOLD = Number(process.env.AGENT_ERROR_THRESHOLD ?? 10);

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the internal map by re-importing is not trivial; instead we rely on
  // Jest module isolation per test file. For finer control we manipulate time.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('threshold-evaluator', () => {
  it('dispatches an alert when error count reaches the threshold', async () => {
    const spy = jest
      .spyOn(alertingConfig, 'dispatchSlackAlert')
      .mockResolvedValue(undefined);

    for (let i = 0; i < THRESHOLD; i++) {
      await recordAgentFailure(AGENT);
    }

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: AGENT,
        errorCount: THRESHOLD,
      })
    );
  });

  it('does not dispatch an alert below the threshold', async () => {
    const spy = jest
      .spyOn(alertingConfig, 'dispatchSlackAlert')
      .mockResolvedValue(undefined);

    for (let i = 0; i < THRESHOLD - 1; i++) {
      await recordAgentFailure(AGENT + '-below');
    }

    expect(spy).not.toHaveBeenCalled();
  });

  it('expires errors outside the 60-minute rolling window', async () => {
    const spy = jest
      .spyOn(alertingConfig, 'dispatchSlackAlert')
      .mockResolvedValue(undefined);

    const windowAgent = AGENT + '-window';

    // Record THRESHOLD - 1 errors, then advance time past 60 minutes
    for (let i = 0; i < THRESHOLD - 1; i++) {
      await recordAgentFailure(windowAgent);
    }

    // Advance time by 61 minutes so those errors expire
    jest.advanceTimersByTime(61 * 60 * 1000);

    // Now record one more — count should be 1, not enough to breach
    await recordAgentFailure(windowAgent);

    expect(spy).not.toHaveBeenCalled();
    expect(getAgentErrorCount(windowAgent)).toBe(1);
  });
});
