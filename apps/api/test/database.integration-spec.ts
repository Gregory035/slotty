import { AppointmentSource, AppointmentStatus, CompanyRole, Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ReviewsService } from '../src/reviews/reviews.service';
import type { PrismaService } from '../src/database/prisma.service';

process.env.DATABASE_URL ??= 'postgresql://telegram_business:telegram_business@localhost:5432/telegram_business?schema=public';

const prisma = new PrismaClient();

describe('database tenant and booking constraints', () => {
  const companyIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function seedCompany(name: string) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@integration.test`,
        passwordHash: 'not-used',
        firstName: 'Integration',
      },
    });
    const company = await prisma.company.create({ data: { name } });
    await prisma.companyMember.create({
      data: { companyId: company.id, userId: user.id, role: CompanyRole.OWNER },
    });
    const service = await prisma.service.create({
      data: { companyId: company.id, name: 'Service', durationMinutes: 60, price: new Prisma.Decimal(1000) },
    });
    const employee = await prisma.employee.create({
      data: { companyId: company.id, firstName: 'Employee' },
    });
    const customer = await prisma.customer.create({
      data: { companyId: company.id, firstName: 'Customer' },
    });
    await prisma.employeeService.create({
      data: { companyId: company.id, employeeId: employee.id, serviceId: service.id },
    });
    companyIds.push(company.id);
    userIds.push(user.id);
    return { company, service, employee, customer };
  }

  it('counts more than 100 reviews and paginates without duplicates or tenant leakage', async () => {
    const { company, employee, customer, service } = await seedCompany('Review pagination');
    const appointments = Array.from({ length: 105 }, (_, index) => ({
      id: randomUUID(), companyId: company.id, employeeId: employee.id,
      customerId: customer.id, serviceId: service.id,
      startsAt: new Date(Date.UTC(2035, 0, index + 1, 9)),
      endsAt: new Date(Date.UTC(2035, 0, index + 1, 10)),
      status: AppointmentStatus.COMPLETED, source: AppointmentSource.DASHBOARD,
      priceSnapshot: service.price, durationMinutesSnapshot: 60,
    }));
    await prisma.appointment.createMany({ data: appointments });
    await prisma.review.createMany({ data: appointments.map((appointment) => ({
      companyId: company.id, customerId: customer.id, appointmentId: appointment.id,
      rating: 5, createdAt: new Date('2035-01-01T00:00:00Z'),
    })) });
    const reviews = new ReviewsService(prisma as PrismaService);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await reviews.dashboard(company.id, cursor);
      expect(page.summary).toEqual({ average: 5, count: 105 });
      expect(page.byEmployee).toEqual([expect.objectContaining({ id: employee.id, count: 105, average: 5 })]);
      expect(page.byService[0]?.count).toBe(105);
      expect(page.items.length).toBeLessThanOrEqual(25);
      ids.push(...page.items.map((review) => review.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(ids).size).toBe(105);
    expect(ids).toHaveLength(105);
    const other = await seedCompany('No reviews');
    expect((await reviews.dashboard(other.company.id)).summary.count).toBe(0);
  });

  it('rejects a cross-tenant employee-service relation', async () => {
    const left = await seedCompany('Tenant left');
    const right = await seedCompany('Tenant right');
    await expect(
      prisma.employeeService.create({
        data: {
          companyId: left.company.id,
          employeeId: left.employee.id,
          serviceId: right.service.id,
        },
      }),
    ).rejects.toBeDefined();
  });

  it('allows only one concurrent booking for an employee slot', async () => {
    const seeded = await seedCompany('Concurrent tenant');
    const startsAt = new Date('2035-01-01T09:00:00.000Z');
    const endsAt = new Date('2035-01-01T10:00:00.000Z');
    const create = () => prisma.appointment.create({
      data: {
        companyId: seeded.company.id,
        customerId: seeded.customer.id,
        employeeId: seeded.employee.id,
        serviceId: seeded.service.id,
        startsAt,
        endsAt,
        status: AppointmentStatus.CONFIRMED,
        source: AppointmentSource.DASHBOARD,
        priceSnapshot: seeded.service.price,
        durationMinutesSnapshot: 60,
        idempotencyKey: randomUUID(),
      },
    });
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => create()));
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(24);
  });

  it('rolls back appointment and outbox together', async () => {
    const seeded = await seedCompany('Outbox tenant');
    const appointmentId = randomUUID();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.appointment.create({
          data: {
            id: appointmentId,
            companyId: seeded.company.id,
            customerId: seeded.customer.id,
            employeeId: seeded.employee.id,
            serviceId: seeded.service.id,
            startsAt: new Date('2035-02-01T09:00:00.000Z'),
            endsAt: new Date('2035-02-01T10:00:00.000Z'),
            priceSnapshot: seeded.service.price,
            durationMinutesSnapshot: 60,
          },
        });
        await tx.outboxEvent.create({
          data: {
            companyId: seeded.company.id,
            type: 'appointment.created',
            aggregateType: 'Appointment',
            aggregateId: appointmentId,
            payload: { appointmentId },
            idempotencyKey: `test:${appointmentId}`,
          },
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');
    expect(await prisma.appointment.findUnique({ where: { id: appointmentId } })).toBeNull();
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: appointmentId } })).toBeNull();
  });
});
