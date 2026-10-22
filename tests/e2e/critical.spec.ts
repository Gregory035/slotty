import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('public landing opens the registration flow without browser errors', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/');

  const heroHeading = page.getByRole('heading', { level: 1 });
  await expect(heroHeading).toContainText('Онлайн-запись');
  await expect(heroHeading).toContainText('прямо в Telegram');
  await page.getByRole('link', { name: /Начать бесплатно/ }).first().click();
  await expect(page).toHaveURL(/\/app\?mode=register$/);
  await expect(page.getByRole('heading', { name: 'Создайте аккаунт' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('public company page shows services and remains usable on mobile', async ({ page }) => {
  const slug = `e2e-studio-${Date.now()}`;
  const company = await prisma.company.create({
    data: {
      name: 'Студия E2E',
      description: 'Тестовая публичная страница',
      publicSlug: slug,
      publicBookingEnabled: true,
      services: { create: { name: 'Консультация', durationMinutes: 45, price: 1800 } },
      employees: { create: { firstName: 'Елена', description: 'Специалист студии' } },
    },
    include: { services: true, employees: true },
  });
  await prisma.employeeService.create({
    data: { companyId: company.id, employeeId: company.employees[0]!.id, serviceId: company.services[0]!.id },
  });
  try {
    await page.goto(`/company/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Студия E2E' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Консультация' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Елена' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await prisma.company.delete({ where: { id: company.id } });
  }
});

test('owner can register, create a company and refresh the private dashboard', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const email = `playwright-${testInfo.project.name}-${Date.now()}@example.com`;

  try {
    await page.goto('/app?mode=register');
    await page.getByLabel('Имя').fill('Playwright');
    await page.getByLabel('Фамилия').fill('Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль').fill('playwright-password-123');
    await page.getByRole('checkbox', { name: /Я принимаю условия/ }).check();
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    await expect(page.getByRole('heading', { name: 'Расскажите о вашем бизнесе' })).toBeVisible();
    await page.getByLabel('Название компании').fill('Playwright Studio');
    await page.getByRole('checkbox', { name: /поручение на обработку данных/ }).check();
    await page.getByRole('button', { name: /Продолжить/ }).click();

    await expect(page).toHaveURL(/\/companies\/[0-9a-f-]+\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Добрый день' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const privateUrl = page.url();
    const companyUrl = new URL(page.url());
    await page.goto(`${companyUrl.origin}${companyUrl.pathname.replace(/\/dashboard$/, '/system')}`);
    await expect(page.getByRole('heading', { name: 'Состояние системы' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(privateUrl);
    await page.reload();
    await expect(page).toHaveURL(privateUrl);
    await expect(page.getByRole('heading', { name: 'Добрый день' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await removeTestAccount(email);
  }
});

test('Telegram Mini App books, lists, cancels and repeats a visit', async ({ page }, testInfo) => {
  const fixture = await createMiniAppFixture(testInfo.project.name);
  const initData = signedTelegramInitData(fixture.botToken, 9_000_000 + testInfo.retry);
  await page.route('https://telegram.org/js/telegram-web-app.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.addInitScript((data) => {
    window.Telegram = { WebApp: { initData: data, ready() {}, expand() {}, close() {}, HapticFeedback: { selectionChanged() {}, impactOccurred() {} } } };
  }, initData);

  try {
    await page.goto(`/miniapp/${fixture.companyId}`);
    await expect(page.getByRole('heading', { name: 'Выберите услугу' })).toBeVisible();
    await page.getByRole('button', { name: /Тестовая услуга/ }).click();
    await expect(page.getByRole('heading', { name: 'О специалисте' })).toBeVisible();
    await page.getByRole('button', { name: 'Выбрать время' }).click();
    const tomorrow = isoDate(new Date(Date.now() + 86_400_000));
    await page.locator('input[type="date"]').fill(tomorrow);
    const slot = page.locator('.miniapp-slots button').first();
    await expect(slot).toBeVisible();
    const occupiedTime = (await slot.textContent())!.trim().slice(0, 5);
    await slot.click();
    const occupiedStartsAt = new Date(`${tomorrow}T${occupiedTime}:00+03:00`);
    const blockingCustomer = await prisma.customer.create({ data: { companyId: fixture.companyId, firstName: 'Race' } });
    const blockingAppointment = await prisma.appointment.create({ data: { companyId: fixture.companyId, customerId: blockingCustomer.id, employeeId: fixture.employeeId, serviceId: fixture.serviceId, startsAt: occupiedStartsAt, endsAt: new Date(occupiedStartsAt.getTime() + 30 * 60_000), priceSnapshot: 1500, durationMinutesSnapshot: 30, source: 'DASHBOARD' } });
    await page.getByRole('button', { name: 'Добавить в визит' }).click();
    await page.getByRole('button', { name: 'Подтвердить визит' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await prisma.appointment.delete({ where: { id: blockingAppointment.id } });
    await prisma.customer.delete({ where: { id: blockingCustomer.id } });
    await page.getByRole('button', { name: 'Добавить ещё услугу' }).click();
    await page.getByRole('button', { name: /Вторая услуга/ }).click();
    await page.getByRole('button', { name: 'Выбрать время' }).click();
    await page.locator('input[type="date"]').fill(tomorrow);
    await page.locator('.miniapp-slots button').nth(2).click();
    await page.getByRole('button', { name: 'Добавить в визит' }).click();
    await page.getByRole('button', { name: 'Подтвердить визит' }).click();
    await expect(page.getByRole('heading', { name: 'До встречи!' })).toBeVisible();
    await expect(page.getByText('2 услуги в визите')).toBeVisible();
    await page.getByRole('button', { name: 'Мои записи' }).click();
    await expect(page.getByRole('heading', { name: 'Мои записи' })).toBeVisible();
    await expect(page.getByText('Тестовая услуга')).toBeVisible();
    await expect(page.getByText('Вторая услуга')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Перенести' }).first().click();
    const dayAfterTomorrow = isoDate(new Date(Date.now() + 2 * 86_400_000));
    await page.locator('input[type="date"]').fill(dayAfterTomorrow);
    await page.locator('.miniapp-slots button').first().click();
    await page.getByRole('button', { name: 'Перенести запись' }).click();
    await expect(page.getByRole('heading', { name: 'Запись перенесена' })).toBeVisible();
    await page.getByRole('button', { name: 'Мои записи' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Отменить' }).first().click();
    await page.getByRole('button', { name: 'История' }).click();
    await expect(page.getByText('Отменена вами')).toBeVisible();
    await page.getByRole('button', { name: 'Повторить' }).first().click();
    await expect(page.getByRole('heading', { name: 'Выберите время' })).toBeVisible();
  } finally {
    await prisma.company.deleteMany({ where: { id: fixture.companyId } });
  }
});

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    const isExpectedAnonymousRefresh =
      text === 'Failed to load resource: the server responded with a status of 401 (Unauthorized)';
    if (message.type() === 'error' && !isExpectedAnonymousRefresh) errors.push(text);
  });
  page.on('response', (response) => {
    const isExpectedAnonymousRefresh =
      response.status() === 401 && new URL(response.url()).pathname === '/api/auth/refresh';
    if (response.status() >= 400 && !isExpectedAnonymousRefresh) {
      errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  return errors;
}

async function removeTestAccount(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, memberships: { select: { companyId: true } } },
  });
  if (!user) return;
  const companyIds = user.memberships.map((membership) => membership.companyId);
  if (companyIds.length > 0) await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { id: user.id } });
}

async function createMiniAppFixture(suffix: string) {
  const botToken = `123456789:test-${suffix}-${Date.now()}`;
  const company = await prisma.company.create({
    data: {
      name: 'Mini App Test', timezone: 'Europe/Moscow', maxBookingHorizonDays: 14,
      subscriptions: { create: { plan: 'PRO', status: 'ACTIVE', currentPeriodEndsAt: new Date(Date.now() + 86_400_000) } },
      employees: { create: { firstName: 'Елена', color: '#4F46E5' } },
      services: { create: { name: 'Тестовая услуга', durationMinutes: 30, price: 1500 } },
    },
    include: { employees: true, services: true },
  });
  const employee = company.employees[0]!;
  const service = company.services[0]!;
  const secondEmployee = await prisma.employee.create({ data: { companyId: company.id, firstName: 'Мария', color: '#B45309' } });
  const secondService = await prisma.service.create({ data: { companyId: company.id, name: 'Вторая услуга', durationMinutes: 30, price: 900 } });
  await prisma.employeeService.create({ data: { companyId: company.id, employeeId: employee.id, serviceId: service.id } });
  await prisma.employeeService.create({ data: { companyId: company.id, employeeId: secondEmployee.id, serviceId: secondService.id } });
  await prisma.scheduleRule.createMany({ data: Array.from({ length: 7 }, (_, index) => ({ companyId: company.id, employeeId: employee.id, weekday: index + 1, startTime: '09:00', endTime: '21:00' })) });
  await prisma.scheduleRule.createMany({ data: Array.from({ length: 7 }, (_, index) => ({ companyId: company.id, employeeId: secondEmployee.id, weekday: index + 1, startTime: '09:00', endTime: '21:00' })) });
  await prisma.bot.create({ data: { companyId: company.id, telegramBotId: BigInt(`8${Date.now()}`), username: `test_${Date.now()}_bot`, tokenEncrypted: encryptBotToken(botToken), webhookSecret: randomBytes(24).toString('hex'), status: 'ACTIVE' } });
  return { companyId: company.id, employeeId: employee.id, serviceId: service.id, botToken };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

function encryptBotToken(token: string) {
  const secret = process.env.BOT_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('BOT_TOKEN_ENCRYPTION_KEY is required for Mini App E2E');
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

function signedTelegramInitData(token: string, userId: number) {
  const values = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: `e2e-${Date.now()}`, user: JSON.stringify({ id: userId, first_name: 'E2E', last_name: 'Client' }) });
  const dataCheckString = [...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  values.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return values.toString();
}

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
