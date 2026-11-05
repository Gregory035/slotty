import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { parseDateOnly, parseTimeToMinutes } from '../scheduling/time-zone.util';

export function telegramAppointmentStatus(status: AppointmentStatus): string {
  const labels: Record<AppointmentStatus, string> = {
    PENDING: 'Ожидает подтверждения',
    CONFIRMED: 'Подтверждена',
    COMPLETED: 'Завершена',
    CANCELLED_BY_CUSTOMER: 'Отменена вами',
    CANCELLED_BY_COMPANY: 'Отменена компанией',
    NO_SHOW: 'Клиент не пришёл',
  };
  return labels[status];
}

export function parseCallbackDate(value: string): string {
  if (!/^\d{8}$/.test(value)) {
    throw new BadRequestException('Invalid callback date');
  }
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  parseDateOnly(date);
  return date;
}

export function parseCallbackTime(value: string): string {
  if (!/^\d{4}$/.test(value)) {
    throw new BadRequestException('Invalid callback time');
  }
  const time = `${value.slice(0, 2)}:${value.slice(2)}`;
  parseTimeToMinutes(time);
  return time;
}
