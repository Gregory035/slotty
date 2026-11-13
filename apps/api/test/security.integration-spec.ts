import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CompanyRole, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { BillingService } from '../src/billing/billing.service';
import { OperatorController } from '../src/users/operator.controller';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { SchedulingService } from '../src/scheduling/scheduling.service';
import { dateInTimeZone } from '../src/scheduling/time-zone.util';

const prisma = new PrismaService();
const appointments = new AppointmentsService(prisma, {} as never, {} as never, {} as never, {} as never);
const billing = new BillingService(prisma, new ConfigService({ YOOKASSA_SHOP_ID: 'test', YOOKASSA_SECRET_KEY: 'test-only' }));
const companyIds: string[] = [];
const userIds: string[] = [];
const day = 86_400_000;

async function seed() {
  const company = await prisma.company.create({ data: { name: 'Security regression' } });
  companyIds.push(company.id);
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@security.test`, firstName: 'Test', passwordHash: 'test-only' } });
  userIds.push(user.id);
  const employee = await prisma.employee.create({ data: { companyId: company.id, firstName: 'Test' } });
  const membership = await prisma.companyMember.create({ data: { companyId: company.id, userId: user.id, role: CompanyRole.EMPLOYEE, employeeId: employee.id } });
  const service = await prisma.service.create({ data: { companyId: company.id, name: 'Test', durationMinutes: 60, price: 1000 } });
  const customer = await prisma.customer.create({ data: { companyId: company.id, firstName: 'Test', phone: '+70000000000', telegramId: BigInt(123456), username: 'test_private' } });
  const appointment = await prisma.appointment.create({ data: {
    companyId: company.id, employeeId: employee.id, customerId: customer.id, serviceId: service.id,
    startsAt: new Date('2035-01-01T09:00:00Z'), endsAt: new Date('2035-01-01T10:00:00Z'),
    status: 'CONFIRMED', priceSnapshot: 1000, durationMinutesSnapshot: 60, depositStatus: 'PENDING',
  } });
  return { company, user, employee, membership, appointment };
}

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await prisma.payment.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('operator reporting selects real company readiness and denies unlisted users', async () => {
  const { company, user, employee, membership, appointment } = await seed();
  const stranger = await seed();
  const controller = new OperatorController(new ConfigService({ SLOTTY_OPERATOR_USER_IDS: user.id }), prisma);
  const initial = await controller.activation(user);
  await expect(controller.users(stranger.user)).rejects.toThrow('Operator access required');
  await prisma.companyMember.update({ where: { id: membership.id }, data: { role: 'OWNER' } });
  await prisma.employeeService.create({ data: { companyId: company.id, employeeId: employee.id, serviceId: appointment.serviceId } });
  await prisma.scheduleRule.create({ data: { companyId: company.id, employeeId: employee.id, weekday: 1, startTime: '09:00', endTime: '18:00' } });
  await prisma.bot.create({ data: { companyId: company.id, telegramBotId: BigInt(Date.now()), username: 'test_slotty_bot', tokenEncrypted: 'test-only', webhookSecret: randomUUID() } });
  await prisma.appointment.update({ where: { id: appointment.id }, data: { source: 'DASHBOARD' } });
  const dashboard = await new DashboardService(prisma).get(company.id, {});
  expect(dashboard.bookingPreview).toMatchObject({ employeeId: employee.id, serviceId: appointment.serviceId });
  expect(dashboard.hasTelegramBooking).toBe(false);
  const before = await prisma.appointment.count({ where: { companyId: company.id } });
  await new SchedulingService(prisma).getAvailability(company.id, { employeeId: employee.id, serviceId: appointment.serviceId, date: dateInTimeZone(new Date(), company.timezone) });
  expect(await prisma.appointment.count({ where: { companyId: company.id } })).toBe(before);
  await prisma.appointment.update({ where: { id: appointment.id }, data: { source: 'TELEGRAM' } });
  const result = await controller.users(user, user.email);
  expect(result.users).toHaveLength(1);
  expect(result.users[0]).not.toHaveProperty('passwordHash');
  expect(result.users[0]?.companies[0]).toMatchObject({ scheduleReady: true, botReady: true, receivedBooking: true });
  const stages = await controller.activation(user);
  expect(stages.slice(1).map((stage, index) => stage.count - initial[index + 1]!.count)).toEqual([1, 1, 1, 1]);
});

test('employee cannot change another specialist deposit; own responses hide contacts', async () => {
  const { company, user, membership, appointment } = await seed();
  const other = await prisma.employee.create({ data: { companyId: company.id, firstName: 'Other' } });
  await expect(appointments.updateDepositStatus(company.id, appointment.id, 'PAID', user.id, { ...membership, employeeId: other.id })).rejects.toThrow('Appointment not found');
  expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).depositStatus).toBe('PENDING');
  expect(await prisma.auditLog.count({ where: { entityId: appointment.id } })).toBe(0);
  await expect(appointments.updateDepositStatus(company.id, appointment.id, 'PAID', user.id, { ...membership, employeeId: null })).rejects.toThrow('Company access denied');
  const result = await appointments.updateDepositStatus(company.id, appointment.id, 'PAID', user.id, membership);
  expect(result.customer).toEqual(expect.objectContaining({ phone: null, telegramId: null, username: null }));
  expect(result.depositStatus).toBe('PAID');
  const cancelled = await appointments.updateStatus(company.id, appointment.id, { status: 'CANCELLED_BY_COMPANY' }, membership, user.id);
  expect(cancelled.customer).toEqual(expect.objectContaining({ phone: null, telegramId: null, username: null }));
});

test.each([CompanyRole.OWNER, CompanyRole.ADMIN])('%s can manage deposits across specialists but not across companies', async (role) => {
  const { company, user, membership, appointment } = await seed();
  const context = { ...membership, role, employeeId: null };
  const result = await appointments.updateDepositStatus(company.id, appointment.id, 'WAIVED', user.id, context);
  expect(result.customer.phone).toBe('+70000000000');
  expect(result.depositStatus).toBe('WAIVED');
  const foreign = await seed();
  await expect(appointments.updateDepositStatus(company.id, foreign.appointment.id, 'PAID', user.id, context)).rejects.toThrow('Appointment not found');
  await expect(appointments.updateDepositStatus(foreign.company.id, foreign.appointment.id, 'PAID', user.id, context)).rejects.toThrow('Company access denied');
});

test('reassignment between status read and write does not bypass employee scope', async () => {
  const { company, user, membership, appointment } = await seed();
  const other = await prisma.employee.create({ data: { companyId: company.id, firstName: 'Other' } });
  const findFirst = prisma.appointment.findFirst.bind(prisma.appointment);
  const readThenReassign = async (args: Parameters<typeof findFirst>[0]) => {
    const result = await findFirst(args);
    await prisma.appointment.update({ where: { id: appointment.id }, data: { employeeId: other.id } });
    return result;
  };
  jest.spyOn(prisma.appointment, 'findFirst').mockImplementationOnce(readThenReassign as unknown as typeof findFirst);
  await expect(appointments.updateStatus(company.id, appointment.id, { status: 'NO_SHOW' }, membership, user.id)).rejects.toThrow('changed concurrently');
  const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
  expect(unchanged.status).toBe('CONFIRMED');
  expect(await prisma.appointmentHistory.count({ where: { appointmentId: appointment.id } })).toBe(0);
  expect(await prisma.outboxEvent.count({ where: { aggregateId: appointment.id } })).toBe(0);
});

async function failedPayment(companyId: string, subscriptionId: string, renewalForPeriodEndAt: Date | null = null) {
  const payment = await prisma.payment.create({ data: {
    companyId, subscriptionId, provider: 'yookassa', externalPaymentId: randomUUID(), amount: 990,
    currency: 'RUB', planSnapshot: 'STARTER', renewalForPeriodEndAt,
  } });
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
    id: payment.externalPaymentId, status: 'canceled', amount: { value: '990.00', currency: 'RUB' },
  }) } as Response);
  await billing.syncPayment(companyId, payment.id);
  return payment;
}

test('repeated failed purchases do not reopen an expired trial', async () => {
  const { company } = await seed();
  const subscription = await prisma.subscription.create({ data: { companyId: company.id, trialEndsAt: new Date(Date.now() - day) } });
  await failedPayment(company.id, subscription.id);
  await failedPayment(company.id, subscription.id);
  const actual = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  expect(actual.status).toBe('TRIALING');
  expect(actual.graceEndsAt).toBeNull();
  expect(actual.trialEndsAt).toEqual(subscription.trialEndsAt);
});

test('renewal grace is anchored to paid period and duplicate events cannot extend it', async () => {
  const { company } = await seed();
  const periodEnd = new Date(Date.now() - 2 * day);
  const subscription = await prisma.subscription.create({ data: { companyId: company.id, plan: 'STARTER', status: 'ACTIVE', currentPeriodEndsAt: periodEnd } });
  const payment = await failedPayment(company.id, subscription.id, periodEnd);
  await billing.syncPayment(company.id, payment.id);
  const actual = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  expect(actual.status).toBe('PAST_DUE');
  expect(actual.graceEndsAt).toEqual(new Date(periodEnd.getTime() + 7 * day));
  expect(await prisma.paymentEvent.count({ where: { companyId: company.id } })).toBe(1);
});

test.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED])('a late renewal failure cannot modify a newer or canceled %s subscription', async (status) => {
  const { company } = await seed();
  const currentPeriodEndsAt = new Date(Date.now() + 10 * day);
  const subscription = await prisma.subscription.create({ data: { companyId: company.id, plan: 'STARTER', status, currentPeriodEndsAt } });
  await failedPayment(company.id, subscription.id, status === 'ACTIVE' ? new Date(Date.now() - day) : currentPeriodEndsAt);
  const actual = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
  expect(actual.status).toBe(status);
  expect(actual.graceEndsAt).toBeNull();
  expect(actual.currentPeriodEndsAt).toEqual(currentPeriodEndsAt);
});
