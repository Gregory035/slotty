import { CustomersService } from './customers.service';

describe('CustomersService export', () => {
  it('exports only tenant customers and neutralizes spreadsheet formulas', async () => {
    const companyId = '6b89a7b4-4ac8-4424-922a-5d4fc44322a0';
    const prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue([{
          firstName: '=HYPERLINK("bad")',
          lastName: 'Соколова',
          phone: '+79990000000',
          username: 'sokolova',
          notes: 'Новая строка\nи "кавычки"',
          createdAt: new Date('2030-01-01T00:00:00.000Z'),
          lastActivityAt: new Date('2030-01-02T00:00:00.000Z'),
        }]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new CustomersService(prisma as never);

    const csv = await service.exportCsv(companyId, 'actor');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"\'+79990000000"');
    expect(csv).toContain('"Новая строка\nи ""кавычки"""');
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId, anonymizedAt: null } }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'customer.exported' }) }),
    );
  });
});

describe('CustomersService import', () => {
  it('skips duplicates, invalid rows and records an audit event', async () => {
    const tx = {
      customer: {
        findMany: jest.fn().mockResolvedValue([{ phone: '+7 999 000 00 00', username: 'existing' }]),
        create: jest.fn().mockResolvedValue({ id: 'new-id' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn().mockImplementation((callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    const service = new CustomersService(prisma as never);

    const result = await service.importRows('company', [
      { firstName: 'Новый', phone: '+79991112233' },
      { firstName: 'Повтор', phone: '8 999 111 22 33' },
      { firstName: 'Старый', username: '@EXISTING' },
      { firstName: '', phone: '+79993334455' },
    ], 'actor');

    expect(result).toEqual({ created: 1, skippedDuplicates: 2, skippedInvalid: 1 });
    expect(tx.customer.create).toHaveBeenCalledTimes(1);
    expect(tx.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { companyId: 'company', anonymizedAt: null } }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'customer.imported' }) }));
  });
});
