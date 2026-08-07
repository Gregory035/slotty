import { createRequire } from 'node:module';
import {
  AppointmentStatus,
  PrismaClient,
  ScheduleExceptionType,
} from '@prisma/client';

const require = createRequire(import.meta.url);
const { SchedulingService } = require('../apps/api/dist/scheduling/scheduling.service.js');
const { AppointmentsService } = require('../apps/api/dist/appointments/appointments.service.js');

const prisma = new PrismaClient();
const scheduling = new SchedulingService(prisma);
const appointments = new AppointmentsService(prisma, scheduling);
const unique = Date.now();
const targetDate = '2030-01-07';
let companyId;

try {
  const company = await prisma.company.create({
    data: { name: `Booking smoke ${unique}`, timezone: 'Europe/Moscow' },
  });
  companyId = company.id;
  const employee = await prisma.employee.create({
    data: { companyId, firstName: 'Elena' },
  });
  const service = await prisma.service.create({
    data: {
      companyId,
      name: 'Consultation',
      durationMinutes: 60,
      price: 3000,
    },
  });
  await prisma.employeeService.create({
    data: { companyId, employeeId: employee.id, serviceId: service.id },
  });
  await prisma.scheduleRule.create({
    data: {
      companyId,
      employeeId: employee.id,
      weekday: 1,
      startTime: '09:00',
      endTime: '12:00',
    },
  });

  const customer = {
    telegramId: unique,
    username: `customer_${unique}`,
    firstName: 'Smoke',
    lastName: 'Customer',
  };
  const concurrent = await Promise.allSettled([
    appointments.createFromTelegram(
      companyId,
      customer,
      employee.id,
      service.id,
      targetDate,
      '09:00',
    ),
    appointments.createFromTelegram(
      companyId,
      customer,
      employee.id,
      service.id,
      targetDate,
      '09:00',
    ),
  ]);
  const successes = concurrent.filter((result) => result.status === 'fulfilled');
  const failures = concurrent.filter((result) => result.status === 'rejected');
  if (
    successes.length !== 1 ||
    failures.length !== 1 ||
    failures[0].reason?.getStatus?.() !== 409
  ) {
    throw new Error('Concurrent double booking was not rejected atomically');
  }
  const first = successes[0].value;
  if (first.price !== '3000.00') {
    throw new Error('Appointment price snapshot is incorrect');
  }

  const listed = await appointments.findAll(companyId, {});
  if (listed.length !== 1 || listed[0].customer.telegramId !== String(unique)) {
    throw new Error('Appointment list is incorrect');
  }
  const cancelled = await appointments.updateStatus(companyId, first.appointmentId, {
    status: AppointmentStatus.CANCELLED_BY_COMPANY,
    cancellationReason: 'Smoke cancellation',
  });
  if (cancelled.cancellationReason !== 'Smoke cancellation') {
    throw new Error('Appointment cancellation was not persisted');
  }
  let reopenStatus;
  try {
    await appointments.updateStatus(companyId, first.appointmentId, {
      status: AppointmentStatus.CONFIRMED,
    });
  } catch (error) {
    reopenStatus = typeof error?.getStatus === 'function' ? error.getStatus() : null;
  }
  if (reopenStatus !== 400) {
    throw new Error('Cancelled appointment was reopened');
  }

  await appointments.createFromTelegram(
    companyId,
    { ...customer, firstName: 'Updated smoke' },
    employee.id,
    service.id,
    targetDate,
    '09:00',
  );
  const customerCount = await prisma.customer.count({ where: { companyId } });
  if (customerCount !== 1) {
    throw new Error('Telegram customer was duplicated');
  }

  await prisma.scheduleException.create({
    data: {
      companyId,
      employeeId: employee.id,
      date: new Date(`${targetDate}T00:00:00.000Z`),
      type: ScheduleExceptionType.DAY_OFF,
    },
  });
  let dayOffStatus;
  try {
    await appointments.createFromTelegram(
      companyId,
      customer,
      employee.id,
      service.id,
      targetDate,
      '10:00',
    );
  } catch (error) {
    dayOffStatus = typeof error?.getStatus === 'function' ? error.getStatus() : null;
  }
  if (dayOffStatus !== 409) {
    throw new Error('Booking on a day off was not rejected');
  }

  console.log('Telegram appointment smoke test passed');
} finally {
  if (companyId) {
    await prisma.company.deleteMany({ where: { id: companyId } });
  }
  await prisma.$disconnect();
}
