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

  it('queues registration success without form fields or an extra private pageview', async () => {
    const { trackEvent } = await import('./analytics');
    expect(trackEvent('registration_success')).toBe(true);
    expect(window.ym?.a).toEqual([
      [112790410, 'init', expect.objectContaining({ defer: true })],
      [112790410, 'reachGoal', 'registration_success', {}],
    ]);
  });

  it('allows retrying a registration event after consent is granted', async () => {
    let consent: string | null = null;
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('localStorage', {
      getItem: () => consent,
      setItem: (_key: string, value: string) => { consent = value; },
    });
    const { trackEvent, setAnalyticsConsent } = await import('./analytics');
    expect(trackEvent('registration_start')).toBe(false);
    expect(append).not.toHaveBeenCalled();
    setAnalyticsConsent('granted');
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'slotty:analytics-consent' }));
    expect(trackEvent('registration_start')).toBe(true);
    expect(window.ym?.a?.at(-1)).toEqual([112790410, 'reachGoal', 'registration_start', {}]);
  });

  it('does not mark an event as queued when no counter is configured', async () => {
    vi.stubEnv('VITE_YM_COUNTER_ID', '');
    const { trackEvent } = await import('./analytics');
    expect(trackEvent('registration_start')).toBe(false);
    expect(append).not.toHaveBeenCalled();
  });

  it('never sends private or unknown URLs, including after consent in the workspace', async () => {
    const { trackPageView } = await import('./analytics');
    for (const path of ['/companies/internal-id/dashboard', '/app?token=secret', '/miniapp/internal-id', '/company/private-slug', '/unknown']) trackPageView(path);
    expect(append).not.toHaveBeenCalled();
    expect(window.ym).toBeUndefined();
    trackPageView('/?token=secret#private');
    expect(window.ym?.a?.at(-1)).toEqual([112790410, 'hit', '/']);
  });
});
