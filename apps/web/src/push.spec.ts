import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePushSubscription, getPushConfig, savePushSubscription } from './api';
import { enableDevicePush, syncDevicePush } from './push';

vi.mock('./api', () => ({
  deletePushSubscription: vi.fn(), getPushConfig: vi.fn(), savePushSubscription: vi.fn(),
}));

describe('installed iPhone push lifecycle', () => {
  const requestPermission = vi.fn();
  const subscribe = vi.fn();
  const getSubscription = vi.fn();
  const unsubscribe = vi.fn();
  const subscription = { endpoint: 'https://web.push.apple.com/device-one', options: {}, unsubscribe, toJSON: () => ({ endpoint: 'https://web.push.apple.com/device-one', keys: { auth: 'secret', p256dh: 'key' } }) };

  beforeEach(() => {
    vi.resetAllMocks();
    const notification = { permission: 'default', requestPermission };
    vi.stubGlobal('Notification', notification);
    vi.stubGlobal('window', { Notification: notification, PushManager: {}, matchMedia: () => ({ matches: true }) });
    vi.stubGlobal('navigator', { userAgent: 'iPhone', standalone: true, serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }) } });
    requestPermission.mockResolvedValue('granted');
    vi.mocked(getPushConfig).mockResolvedValue({ enabled: true, publicKey: 'AQID' });
    getSubscription.mockResolvedValue(null);
    subscribe.mockResolvedValue(subscription);
    unsubscribe.mockResolvedValue(true);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('requests permission synchronously from the tap, before network or worker awaits', async () => {
    const pending = enableDevicePush();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(getPushConfig).not.toHaveBeenCalled();
    await expect(pending).resolves.toBe(subscription);
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]) });
    expect(savePushSubscription).toHaveBeenCalledWith(subscription.toJSON());
  });

  it('does not access push services after permission is denied', async () => {
    requestPermission.mockResolvedValue('denied');
    await expect(enableDevicePush()).rejects.toThrow('Настройки → Уведомления');
    expect(getPushConfig).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('explains how to open an installed app instead of requesting permission in Safari', async () => {
    vi.stubGlobal('window', { Notification: {}, PushManager: {}, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { userAgent: 'iPhone', serviceWorker: {} });
    await expect(enableDevicePush()).rejects.toThrow('с экрана «Домой»');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('reuses and saves an existing subscription after login', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' });
    getSubscription.mockResolvedValue(subscription);
    await expect(syncDevicePush()).resolves.toBe(subscription);
    expect(savePushSubscription).toHaveBeenCalledWith(subscription.toJSON());
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('replaces subscriptions created with an old server key', async () => {
    getSubscription.mockResolvedValue({ ...subscription, options: { applicationServerKey: new Uint8Array([9]).buffer } });
    await enableDevicePush();
    expect(deletePushSubscription).toHaveBeenCalledWith(subscription.endpoint);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('reports a server save failure instead of marking notifications enabled', async () => {
    vi.mocked(savePushSubscription).mockRejectedValue(new Error('Сервер недоступен'));
    await expect(enableDevicePush()).rejects.toThrow('Сервер недоступен');
  });
});
