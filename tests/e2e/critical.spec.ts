import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('public landing opens the registration flow without browser errors', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Онлайн-запись прямо в Telegram');
  await page.getByRole('link', { name: /Начать бесплатно/ }).first().click();
  await expect(page).toHaveURL(/\/app\?mode=register$/);
  await expect(page.getByRole('heading', { name: 'Создайте аккаунт' })).toBeVisible();
  expect(errors).toEqual([]);
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
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    await expect(page.getByRole('heading', { name: 'Расскажите о вашем бизнесе' })).toBeVisible();
    await page.getByLabel('Название компании').fill('Playwright Studio');
    await page.getByRole('button', { name: /Продолжить/ }).click();

    await expect(page).toHaveURL(/\/companies\/[0-9a-f-]+\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Добрый день' })).toBeVisible();
    const privateUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(privateUrl);
    await expect(page.getByRole('heading', { name: 'Добрый день' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await removeTestAccount(email);
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
