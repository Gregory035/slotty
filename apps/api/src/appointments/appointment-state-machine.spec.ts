import { ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import {
  assertAppointmentTransition,
  canTransitionAppointment,
} from './appointment-state-machine';

describe('appointment state machine', () => {
  it.each([
    [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.PENDING, AppointmentStatus.CANCELLED_BY_CUSTOMER],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.NO_SHOW],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED_BY_COMPANY],
  ])('allows %s -> %s', (current, next) => {
    expect(canTransitionAppointment(current, next)).toBe(true);
  });

  it.each([
    [AppointmentStatus.COMPLETED, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.NO_SHOW, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.CANCELLED_BY_COMPANY, AppointmentStatus.CONFIRMED],
    [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
  ])('rejects %s -> %s', (current, next) => {
    expect(() => assertAppointmentTransition(current, next)).toThrow(
      ConflictException,
    );
  });
});
