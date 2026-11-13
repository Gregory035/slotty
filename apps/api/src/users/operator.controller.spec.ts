import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperatorController } from './operator.controller';

const actor = { id: 'operator-id', email: 'operator@example.test', firstName: 'Operator', lastName: null, emailVerified: true };

describe('operator reporting', () => {
  function setup(ids?: string) {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    return { findMany, count, controller: new OperatorController(new ConfigService({ SLOTTY_OPERATOR_USER_IDS: ids }), { user: { findMany, count } } as never) };
  }

  it('denies access by default, before touching the database', async () => {
    const { controller, findMany, count } = setup();
    await expect(controller.users(actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.activation(actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('does not authorize partial user IDs', async () => {
    const { controller } = setup('another-operator-id');
    await expect(controller.users(actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('limits listing to 25 rows and selects no credential fields', async () => {
    const { controller, findMany } = setup('another-id, operator-id');
    expect(await controller.users(actor, ' Иван ', '2')).toEqual({ users: [], page: 2, hasNext: false });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 26, select: expect.objectContaining({ email: true }) }));
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('passwordHash');
    await expect(controller.users(actor, undefined, '0')).rejects.toThrow('Invalid page');
  });

  it('requires ownership and progression within one company for the last step', async () => {
    const { controller, count } = setup(actor.id);
    const stages = await controller.activation(actor);
    expect(stages.map((stage) => stage.id)).toEqual(['registered', 'company', 'schedule', 'bot', 'booking']);
    expect(count).toHaveBeenLastCalledWith({ where: { memberships: { some: { role: 'OWNER', company: expect.objectContaining({
      deletedAt: null, employeeServices: expect.any(Object), bots: { some: { status: 'ACTIVE' } }, appointments: { some: { source: 'TELEGRAM' } },
    }) } } } });
  });
});
