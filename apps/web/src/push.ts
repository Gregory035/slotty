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

export interface DevicePushSetup {
  registration: ServiceWorkerRegistration;
  key: Uint8Array<ArrayBuffer>;
  subscription: PushSubscription | null;
}

export type PushConnectionStep = 'permission' | 'subscription' | 'saving';

// Prepare network and worker state before a tap, not between the tap and subscribe.
export async function prepareDevicePush(): Promise<DevicePushSetup> {
  const unsupported = pushSupportMessage();
  if (unsupported) throw new Error(unsupported);
  const [registration, config] = await Promise.all([
    readyRegistration(),
    withTimeout(getPushConfig(), 15_000, 'Не удалось получить настройки уведомлений. Проверьте интернет и повторите.'),
  ]);
  if (!config.enabled || !config.publicKey) throw new Error('Уведомления временно недоступны на сервере. Повторите позже.');
  const key = decodeVapidKey(config.publicKey);
  let subscription = await readSubscription(registration);
  if (subscription?.options.applicationServerKey && !sameKey(subscription.options.applicationServerKey, key)) {
    await withTimeout(deletePushSubscription(subscription.endpoint), 15_000, 'Не удалось обновить подключение уведомлений.');
    await withTimeout(subscription.unsubscribe(), 15_000, 'Не удалось отключить устаревшую подписку. Закройте и снова откройте Slotty.');
    subscription = null;
  }
  return { registration, key, subscription };
}

export async function enableDevicePush(setup: DevicePushSetup, onStep?: (step: PushConnectionStep) => void): Promise<PushSubscription> {
  const unsupported = pushSupportMessage();
  if (unsupported) throw new Error(unsupported);
  let permission = notificationPermission();
  if (permission !== 'granted') {
    onStep?.('permission');
    permission = await withTimeout(Notification.requestPermission(), 45_000,
      'Системный запрос разрешения не завершился. Закройте окно уведомлений, откройте его снова и повторите нажатие.');
  }
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Уведомления заблокированы. На iPhone: Настройки → Уведомления → Slotty → Допуск уведомлений. Затем вернитесь в приложение.'
    : 'Разрешение не получено. Нажмите «Включить уведомления» и подтвердите системный запрос.');
  onStep?.('subscription');
  // Preserve the tap context when permission has already been granted.
  const subscription = setup.subscription ?? await withTimeout(
    setup.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: setup.key }),
    20_000,
    'Сервис push не подключил устройство за 20 секунд. Повторите нажатие. Если снова не получится, проверьте соединение без VPN или фильтрации трафика.',
  );
  onStep?.('saving');
  await withTimeout(savePushSubscription(subscription.toJSON()), 15_000, 'Устройство подключено, но сервер не сохранил подписку. Проверьте интернет и повторите.');
  return subscription;
}

export async function syncDevicePush(): Promise<PushSubscription | null> {
  if (pushSupportMessage() || notificationPermission() !== 'granted') return null;
  const registration = await readyRegistration();
  const subscription = await readSubscription(registration);
  if (subscription) await withTimeout(savePushSubscription(subscription.toJSON()), 15_000, 'Не удалось сохранить подключение уведомлений.');
  return subscription;
}

export async function disableDevicePush(): Promise<void> {
  const registration = await readyRegistration();
  const subscription = await readSubscription(registration);
  if (subscription) {
    await withTimeout(deletePushSubscription(subscription.endpoint), 15_000, 'Не удалось отключить уведомления на сервере.');
    await withTimeout(subscription.unsubscribe(), 15_000, 'Сервис push не ответил на отключение. Повторите позже.');
  }
}

function readSubscription(registration: ServiceWorkerRegistration) {
  return withTimeout(registration.pushManager.getSubscription(), 15_000, 'Не удалось проверить подписку устройства. Закройте и снова откройте Slotty.');
}

function readyRegistration(): Promise<ServiceWorkerRegistration> {
  return withTimeout(navigator.serviceWorker.ready, 15_000, 'Служба уведомлений не запустилась. Закройте и снова откройте Slotty, затем повторите.');
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
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
