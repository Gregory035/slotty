import { AdaptivePollingLoop } from './adaptive-polling-loop';

describe('AdaptivePollingLoop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('backs off while idle and resets after processing work', async () => {
    const poll = jest.fn<Promise<number>, []>()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    const loop = new AdaptivePollingLoop(poll, {
      activeDelayMs: 250,
      idleDelaysMs: [500, 1_000, 2_000],
      onError: jest.fn(),
    });

    loop.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(499);
    expect(poll).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(poll).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(250);
    expect(poll).toHaveBeenCalledTimes(4);
    loop.stop();
  });

  it('never overlaps polls and stops pending timers', async () => {
    let resolvePoll: ((value: number) => void) | undefined;
    const poll = jest.fn(() => new Promise<number>((resolve) => { resolvePoll = resolve; }));
    const loop = new AdaptivePollingLoop(poll, {
      activeDelayMs: 250,
      idleDelaysMs: [500],
      onError: jest.fn(),
    });

    loop.start();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(1);
    resolvePoll?.(1);
    await Promise.resolve();
    loop.stop();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it('reports errors and continues with idle backoff', async () => {
    const onError = jest.fn();
    const poll = jest.fn<Promise<number>, []>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(0);
    const loop = new AdaptivePollingLoop(poll, {
      activeDelayMs: 250,
      idleDelaysMs: [500],
      onError,
    });

    loop.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    await jest.advanceTimersByTimeAsync(500);
    expect(poll).toHaveBeenCalledTimes(2);
    loop.stop();
  });
});
