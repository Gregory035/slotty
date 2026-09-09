import { AppointmentSource, AppointmentStatus, CompanyRole, Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

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
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
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
