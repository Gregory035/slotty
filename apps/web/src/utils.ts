import type { AppointmentStatus } from './types';

export function formatMoney(value: string | number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export const statusLabel: Record<AppointmentStatus, string> = {
  PENDING: 'Ожидает',
  CONFIRMED: 'Подтверждена',
  COMPLETED: 'Завершена',
  CANCELLED_BY_CUSTOMER: 'Отменена клиентом',
  CANCELLED_BY_COMPANY: 'Отменена компанией',
  NO_SHOW: 'Не пришёл',
};

export const statusTone: Record<AppointmentStatus, string> = {
  PENDING: 'badge-amber',
  CONFIRMED: 'badge-green',
  COMPLETED: 'badge-blue',
  CANCELLED_BY_CUSTOMER: 'badge-muted',
  CANCELLED_BY_COMPANY: 'badge-muted',
  NO_SHOW: 'badge-red',
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Что-то пошло не так';
}
