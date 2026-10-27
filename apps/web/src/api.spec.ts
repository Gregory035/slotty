import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBot, savePushSubscription, writeSession } from './api';

describe('API response parsing', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    writeSession({
      accessToken: 'access-token',
      expiresIn: 900,
      user: {
        id: 'user-id',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: null,
        emailVerified: false,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats an empty successful bot response as no connected bot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    await expect(getBot('company-id')).resolves.toBeNull();
  });

  it.each([null, 1_800_000_000_000])('sends only supported push fields when browser expirationTime is %s', async (expirationTime) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      endpoint: 'https://web.push.apple.com/device-one',
      expirationTime,
      keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
    };

    await expect(savePushSubscription(input)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/push/subscriptions'), expect.objectContaining({
      body: JSON.stringify({ endpoint: input.endpoint, keys: input.keys }),
    }));
  });
});
