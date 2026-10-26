import { deletePushSubscription, getPushConfig, savePushSubscription } from './api';

export function isInstalledApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupportMessage(): string | null {
  const ios = /iPhone|iPad|iPod/u.test(navigator.userAgent);
  if (ios && !isInstalledApp()) return 'На iPhone откройте Slotty с экрана «Домой», а не во вкладке Safari. Если ярлык открывает браузер, добавьте его заново с включённым «Открывать как веб-приложение».';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'В этом браузере push-уведомления недоступны. Откройте установленное приложение Slotty или поддерживаемый браузер.';
  }
  return null;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

// Keep requestPermission before every await: WebKit requires a direct user gesture.
export async function enableDevicePush(): Promise<PushSubscription> {
  const unsupported = pushSupportMessage();
  if (unsupported) throw new Error(unsupported);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Уведомления заблокированы. На iPhone: Настройки → Уведомления → Slotty → Допуск уведомлений. Затем вернитесь в приложение.'
    : 'Разрешение не получено. Нажмите «Включить уведомления» и подтвердите системный запрос.');
  const [registration, config] = await Promise.all([readyRegistration(), getPushConfig()]);
  if (!config.enabled || !config.publicKey) throw new Error('Уведомления временно недоступны на сервере. Повторите позже.');
  const key = decodeVapidKey(config.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription?.options.applicationServerKey && !sameKey(subscription.options.applicationServerKey, key)) {
    await deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await savePushSubscription(subscription.toJSON());
  return subscription;
}

export async function syncDevicePush(): Promise<PushSubscription | null> {
  if (pushSupportMessage() || notificationPermission() !== 'granted') return null;
  const registration = await readyRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await savePushSubscription(subscription.toJSON());
  return subscription;
}

export async function disableDevicePush(): Promise<void> {
  const registration = await readyRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Служба уведомлений не запустилась. Закройте и снова откройте Slotty, затем повторите.')), 15_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function sameKey(current: ArrayBuffer, expected: Uint8Array<ArrayBuffer>): boolean {
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index]);
}

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${'='.repeat((4 - value.length % 4) % 4)}`;
  const binary = atob(padded.replace(/-/gu, '+').replace(/_/gu, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
