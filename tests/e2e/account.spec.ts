import { expect, test } from '@playwright/test';
import { PrismaClient, CompanyRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PasswordService } from '../../apps/api/src/auth/password.service';

const prisma = new PrismaClient();
const api = 'http://localhost:3000/api';
test.afterAll(async () => { await prisma.$disconnect(); });

test('password reset form replaces password, revokes sessions and rejects reused token', async ({ page }) => {
  const password = 'reset-test-password-123';
  const email = `${randomUUID()}@e2e.test`;
  const user = await prisma.user.create({ data: {
    email, firstName: 'Recovery', passwordHash: await new PasswordService().hash(password),
  } });
  try {
    const login = await page.request.post(`${api}/auth/login`, { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    await page.context().clearCookies();
    const token = randomUUID();
    await prisma.passwordResetToken.create({ data: {
      userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
    } });
    await page.goto(`/app?mode=reset-password#token=${token}`);
    await page.getByLabel('Пароль', { exact: true }).fill('changed-password-456');
    await page.getByLabel('Повторите пароль', { exact: true }).fill('changed-password-456');
    await page.getByRole('button', { name: 'Сохранить пароль' }).click();
    await expect(page.getByText('Пароль обновлён. Теперь войдите с новым паролем.')).toBeVisible();
    expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    const reuse = await page.request.post(`${api}/auth/password-reset/confirm`, { data: { token, password } });
    expect(reuse.status()).toBe(401);
    const changedLogin = await page.request.post(`${api}/auth/login`, { data: { email, password: 'changed-password-456' } });
    expect(changedLogin.ok()).toBeTruthy();
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

for (const role of [CompanyRole.OWNER, CompanyRole.ADMIN, CompanyRole.EMPLOYEE]) {
  test(`${role} permissions are enforced by the real API`, async ({ request }) => {
    const password = 'role-test-password-123';
    const user = await prisma.user.create({ data: {
      email: `${randomUUID()}@e2e.test`, firstName: role, passwordHash: await new PasswordService().hash(password),
    } });
    const company = await prisma.company.create({ data: { name: `Role ${role}` } });
    try {
      await prisma.subscription.create({ data: { companyId: company.id, plan: 'TRIAL', status: 'TRIALING', trialEndsAt: new Date(Date.now() + 86400000) } });
      const employee = await prisma.employee.create({ data: { companyId: company.id, firstName: role } });
      await prisma.companyMember.create({ data: { userId: user.id, companyId: company.id, role, employeeId: role === CompanyRole.EMPLOYEE ? employee.id : null } });
      const login = await request.post(`${api}/auth/login`, { data: { email: user.email, password } });
      expect(login.ok()).toBeTruthy();
      const session = await login.json() as { accessToken: string };
      const headers = { authorization: `Bearer ${session.accessToken}` };
      expect((await request.get(`${api}/companies`, { headers })).status()).toBe(200);
      expect((await request.get(`${api}/companies/${company.id}/billing`, { headers })).status()).toBe(role === CompanyRole.OWNER ? 200 : 403);
      expect((await request.get(`${api}/companies/${company.id}/reviews`, { headers })).status()).toBe(role === CompanyRole.EMPLOYEE ? 403 : 200);
      const stranger = randomUUID();
      expect((await request.get(`${api}/companies/${stranger}/reviews`, { headers })).status()).toBe(403);
    } finally {
      await prisma.company.delete({ where: { id: company.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
}
