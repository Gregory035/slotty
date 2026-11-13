import type { Prisma } from '@prisma/client';

export const bookableAssignment: Prisma.EmployeeServiceWhereInput = {
  service: { isActive: true, deletedAt: null },
  employee: { isActive: true, deletedAt: null, scheduleRules: { some: { isWorking: true } } },
};

export const activationSteps = [
  { id: 'company', label: 'Создали компанию', where: {} },
  { id: 'schedule', label: 'Настроили услуги и расписание', where: { employeeServices: { some: bookableAssignment } } },
  { id: 'bot', label: 'Подключили Telegram', where: { employeeServices: { some: bookableAssignment }, bots: { some: { status: 'ACTIVE' } } } },
  { id: 'booking', label: 'Получили запись из Telegram', where: { employeeServices: { some: bookableAssignment }, bots: { some: { status: 'ACTIVE' } }, appointments: { some: { source: 'TELEGRAM' } } } },
] as const satisfies ReadonlyArray<{ id: string; label: string; where: Prisma.CompanyWhereInput }>;
