import { randomUUID } from 'node:crypto';
import { CompanyRole, WorkingMode } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { CompaniesService } from '../src/companies/companies.service';
import { ServicesService } from '../src/services/services.service';
import { EmployeesService } from '../src/employees/employees.service';
import { EntitlementsService } from '../src/billing/entitlements.service';
import { WorkImageStorageService } from '../src/employees/work-image-storage.service';
import { LEGAL_DOCUMENT_VERSION } from '../src/legal/legal.constants';
import { CompanyMembersService } from '../src/company-members/company-members.service';

const prisma = new PrismaService();
const companies = new CompaniesService(prisma);
const entitlements = new EntitlementsService(prisma);
const services = new ServicesService(prisma, entitlements);
const employees = new EmployeesService(prisma, services, entitlements, {} as WorkImageStorageService);
const companyIds: string[] = [];
const userIds: string[] = [];

async function create(mode: WorkingMode = 'TEAM') {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@solo.test`, firstName: 'Анна', lastName: 'Мастер', passwordHash: 'test-only' } });
  userIds.push(user.id);
  const company = await companies.create(user.id, { name: 'Solo integration', workingMode: mode, dataProcessingAccepted: true, legalVersion: LEGAL_DOCUMENT_VERSION });
  companyIds.push(company.id);
  return { user, company };
}

afterAll(async () => {
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test('solo owner has one login, a linked profile and automatically assigned services', async () => {
  const { user, company } = await create('SOLO');
  expect(company.role).toBe('OWNER');
  expect(company.employeeId).toBeTruthy();
  expect(await prisma.companyMember.count({ where: { companyId: company.id } })).toBe(1);
  const profile = await employees.findOwnProfile(company.id, user.id);
  expect(profile.firstName).toBe('Анна');
  const service = await services.create(company.id, { name: 'Консультация', durationMinutes: 60, price: 1000, bufferAfterMinutes: 15 }, user.id);
  const assignment = await prisma.employeeService.findFirst({ where: { companyId: company.id, serviceId: service.id } });
  expect(assignment?.employeeId).toBe(company.employeeId);
  expect(assignment?.bufferAfterMinutes).toBe(15);
  expect((await companies.findAllForUser(user.id))[0]?.workingMode).toBe('SOLO');
});

test('team setup keeps the previous behavior', async () => {
  const { company } = await create();
  expect(company.workingMode).toBe('TEAM');
  expect(company.employeeId).toBeNull();
  expect(await prisma.employee.count({ where: { companyId: company.id } })).toBe(0);
});

test('adopting an existing profile preserves its assignments and schedule', async () => {
  const { user, company } = await create();
  const profile = await employees.create(company.id, { firstName: 'Анна' }, user.id);
  const service = await services.create(company.id, { name: 'Услуга', durationMinutes: 60, price: 1000 }, user.id);
  await employees.assignService(company.id, profile.id, service.id, { bufferAfterMinutes: 30 });
  const rule = await prisma.scheduleRule.create({ data: { companyId: company.id, employeeId: profile.id, weekday: 1, startTime: '09:00', endTime: '18:00' } });
  const changed = await companies.changeWorkingMode(company.id, user.id, { workingMode: 'SOLO', employeeId: profile.id });
  expect(changed.employeeId).toBe(profile.id);
  expect(await prisma.employee.count({ where: { companyId: company.id } })).toBe(1);
  expect(await prisma.scheduleRule.findUnique({ where: { id: rule.id } })).toBeTruthy();
  expect((await prisma.employeeService.findFirstOrThrow({ where: { employeeId: profile.id, serviceId: service.id } })).bufferAfterMinutes).toBe(30);
});

test('only owner can change mode; foreign profiles and other active colleagues are rejected', async () => {
  const { user, company } = await create();
  const foreign = await create('SOLO');
  await expect(companies.changeWorkingMode(company.id, foreign.user.id, { workingMode: 'SOLO' })).rejects.toThrow('Только владелец');
  await expect(companies.changeWorkingMode(company.id, user.id, { workingMode: 'SOLO', employeeId: foreign.company.employeeId! })).rejects.toThrow('в этой компании');
  const first = await employees.create(company.id, { firstName: 'Анна' });
  await employees.create(company.id, { firstName: 'Коллега' });
  await expect(companies.changeWorkingMode(company.id, user.id, { workingMode: 'SOLO', employeeId: first.id })).rejects.toThrow('другие активные');
  const admin = await prisma.user.create({ data: { email: `${randomUUID()}@solo.test`, firstName: 'Admin', passwordHash: 'test-only' } });
  userIds.push(admin.id);
  await prisma.companyMember.create({ data: { companyId: company.id, userId: admin.id, role: CompanyRole.ADMIN } });
  await expect(companies.changeWorkingMode(company.id, admin.id, { workingMode: 'SOLO' })).rejects.toThrow('Только владелец');
});

test('adding a colleague expands the workspace without changing the owner profile', async () => {
  const { user, company } = await create('SOLO');
  await employees.create(company.id, { firstName: 'Коллега' }, user.id);
  const changed = (await companies.findAllForUser(user.id))[0];
  expect(changed?.workingMode).toBe('TEAM');
  expect(changed?.employeeId).toBe(company.employeeId);
  expect(await prisma.employee.count({ where: { companyId: company.id } })).toBe(2);
  const service = await services.create(company.id, { name: 'Командная услуга', durationMinutes: 60, price: 1000 });
  expect(await prisma.employeeService.count({ where: { serviceId: service.id } })).toBe(0);
});

test('concurrent solo activation is idempotent and own profile cannot be deleted', async () => {
  const { user, company } = await create();
  await Promise.all([1, 2].map(() => companies.changeWorkingMode(company.id, user.id, { workingMode: 'SOLO' })));
  const profiles = await employees.findAll(company.id);
  expect(profiles).toHaveLength(1);
  await expect(employees.softDelete(company.id, profiles[0]!.id, user.id)).rejects.toThrow('нельзя удалить');
  await expect(employees.update(company.id, profiles[0]!.id, { isActive: false }, user.id)).rejects.toThrow('нельзя отключить');
});

test('owner profile link survives member updates and adding another owner enables team mode', async () => {
  const { user, company } = await create('SOLO');
  const members = new CompanyMembersService(prisma);
  const membership = await prisma.companyMember.findFirstOrThrow({ where: { companyId: company.id, userId: user.id } });
  const actor = { id: membership.id, userId: user.id, companyId: company.id, role: CompanyRole.OWNER, employeeId: company.employeeId };
  await members.update(company.id, membership.id, { role: 'OWNER' }, actor);
  expect((await companies.findAllForUser(user.id))[0]?.employeeId).toBe(company.employeeId);
  const colleague = await prisma.user.create({ data: { email: `${randomUUID()}@solo.test`, firstName: 'Partner', passwordHash: 'test-only' } });
  userIds.push(colleague.id);
  await members.add(company.id, { email: colleague.email, role: 'OWNER' }, actor);
  expect((await companies.findAllForUser(user.id))[0]?.workingMode).toBe('TEAM');
  expect((await companies.findAllForUser(user.id))[0]?.employeeId).toBe(company.employeeId);
});
