import { ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';

const transitions: Readonly<Record<AppointmentStatus, ReadonlySet<AppointmentStatus>>> = {
  [AppointmentStatus.PENDING]: new Set([
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED_BY_CUSTOMER,
    AppointmentStatus.CANCELLED_BY_COMPANY,
  ]),
  [AppointmentStatus.CONFIRMED]: new Set([
    AppointmentStatus.COMPLETED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.CANCELLED_BY_CUSTOMER,
    AppointmentStatus.CANCELLED_BY_COMPANY,
  ]),
  [AppointmentStatus.COMPLETED]: new Set(),
  [AppointmentStatus.NO_SHOW]: new Set(),
  [AppointmentStatus.CANCELLED_BY_CUSTOMER]: new Set(),
  [AppointmentStatus.CANCELLED_BY_COMPANY]: new Set(),
};

export function canTransitionAppointment(
  current: AppointmentStatus,
  next: AppointmentStatus,
): boolean {
  return transitions[current].has(next);
}

export function assertAppointmentTransition(
  current: AppointmentStatus,
  next: AppointmentStatus,
): void {
  if (!canTransitionAppointment(current, next)) {
    throw new ConflictException(
      `Appointment cannot transition from ${current} to ${next}`,
    );
  }
}
