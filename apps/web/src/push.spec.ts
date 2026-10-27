import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deletePushSubscription, getPushConfig, savePushSubscription } from './api';
import { enableDevicePush, prepareDevicePush, syncDevicePush } from './push';

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
    const setup = await prepareDevicePush();
    vi.mocked(getPushConfig).mockClear();
    const pending = enableDevicePush(setup);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(getPushConfig).not.toHaveBeenCalled();
    await expect(pending).resolves.toBe(subscription);
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]) });
    expect(savePushSubscription).toHaveBeenCalledWith(subscription.toJSON());
  });

  it('does not access push services after permission is denied', async () => {
    const setup = await prepareDevicePush();
    vi.mocked(getPushConfig).mockClear();
    requestPermission.mockResolvedValue('denied');
    await expect(enableDevicePush(setup)).rejects.toThrow('Настройки → Уведомления');
    expect(getPushConfig).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('explains how to open an installed app instead of requesting permission in Safari', async () => {
    const setup = await prepareDevicePush();
    vi.stubGlobal('window', { Notification: {}, PushManager: {}, matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { userAgent: 'iPhone', serviceWorker: {} });
    await expect(enableDevicePush(setup)).rejects.toThrow('с экрана «Домой»');
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
    const setup = await prepareDevicePush();
    expect(subscribe).not.toHaveBeenCalled();
    await enableDevicePush(setup);
    expect(deletePushSubscription).toHaveBeenCalledWith(subscription.endpoint);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('reports a server save failure instead of marking notifications enabled', async () => {
    const setup = await prepareDevicePush();
    vi.mocked(savePushSubscription).mockRejectedValue(new Error('Сервер недоступен'));
    await expect(enableDevicePush(setup)).rejects.toThrow('Сервер недоступен');
  });

  it('calls subscribe synchronously from the tap when permission is already granted', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
    const setup = await prepareDevicePush();
    vi.mocked(getPushConfig).mockClear();
    getSubscription.mockClear();
    const pending = enableDevicePush(setup);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(getSubscription).not.toHaveBeenCalled();
    expect(getPushConfig).not.toHaveBeenCalled();
    await pending;
  });

  it('rejects a hanging Apple push subscription instead of waiting forever', async () => {
    vi.useFakeTimers();
    const setup = await prepareDevicePush();
    subscribe.mockReturnValue(new Promise(() => undefined));
    const pending = enableDevicePush(setup);
    const rejected = expect(pending).rejects.toThrow('за 20 секунд');
    await vi.advanceTimersByTimeAsync(20_001);
    await rejected;
    expect(savePushSubscription).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a hanging getSubscription during preparation', async () => {
    vi.useFakeTimers();
    getSubscription.mockReturnValue(new Promise(() => undefined));
    const rejected = expect(prepareDevicePush()).rejects.toThrow('Не удалось проверить подписку');
    await vi.advanceTimersByTimeAsync(15_001);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a permission prompt that never opens or resolves', async () => {
    vi.useFakeTimers();
    const setup = await prepareDevicePush();
    requestPermission.mockReturnValue(new Promise(() => undefined));
    const rejected = expect(enableDevicePush(setup)).rejects.toThrow('Системный запрос разрешения не завершился');
    await vi.advanceTimersByTimeAsync(45_001);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
