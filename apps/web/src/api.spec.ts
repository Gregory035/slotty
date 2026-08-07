import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBot, writeSession } from './api';

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
      refreshToken: 'refresh-token',
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
});
