import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('analytics asynchronous initialization', () => {
  const append = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_YM_COUNTER_ID', '112790410');
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '');
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { doNotTrack: '0' });
    vi.stubGlobal('localStorage', { getItem: () => 'granted' });
    vi.stubGlobal('document', {
      querySelector: () => null,
      createElement: () => ({}),
      head: { append },
    });
    append.mockClear();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('preserves init, first hit and conversion until the remote library loads', async () => {
    const { trackPageView, trackEvent } = await import('./analytics');
    trackPageView('/');
    trackPageView('/');
    trackEvent('registration_start');
    expect(window.ym?.a).toEqual([
      [112790410, 'init', expect.objectContaining({ defer: true, webvisor: false })],
      [112790410, 'hit', '/'],
      [112790410, 'reachGoal', 'registration_start', {}],
    ]);
    expect(append).toHaveBeenCalledTimes(1);
    const loadedTag = vi.fn();
    window.ym?.a?.forEach((command) => loadedTag(...command));
    window.ym = loadedTag;
    trackPageView('/online-zapis');
    expect(loadedTag).toHaveBeenLastCalledWith(112790410, 'hit', '/online-zapis');
    expect(loadedTag).toHaveBeenCalledTimes(4);
  });

  it.each(['denied', null])('does not load or queue analytics with consent %s', async (consent) => {
    vi.stubGlobal('localStorage', { getItem: () => consent });
    const { trackPageView, trackEvent } = await import('./analytics');
    trackPageView('/');
    trackEvent('registration_start');
    expect(append).not.toHaveBeenCalled();
    expect(window.ym).toBeUndefined();
  });

  it('respects Do Not Track even with consent', async () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' });
    const { trackPageView } = await import('./analytics');
    trackPageView('/');
    expect(append).not.toHaveBeenCalled();
    expect(window.ym).toBeUndefined();
  });
});
