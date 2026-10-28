import { describe, expect, it } from 'vitest';
import { userErrorMessage } from './user-errors';

describe('safe user-facing errors', () => {
  it('translates an invalid login', () => expect(userErrorMessage('Invalid email or password', 401)).toBe('Неверный email или пароль.'));
  it('explains a broken reset link without exposing token validation', () => {
    expect(userErrorMessage('token must be longer than or equal to 32 characters', 400, '/auth/reset-password')).toContain('Запросите новую ссылку');
  });
  it('keeps useful product messages in Russian', () => {
    expect(userErrorMessage('Это время уже заняли. Выберите другой слот.', 409)).toBe('Это время уже заняли. Выберите другой слот.');
  });
  it.each([500, 502, 503])('does not expose internal errors for HTTP %s', (status) => {
    const message = userErrorMessage('PrismaClientKnownRequestError: SQLSTATE 23505', status);
    expect(message).toContain('временно недоступен');
    expect(message).not.toContain('Prisma');
  });
  it('provides a next step for throttling and denied access', () => {
    expect(userErrorMessage('Too many requests', 429)).toContain('Подождите');
    expect(userErrorMessage('Forbidden', 403)).toContain('владельцу');
    expect(userErrorMessage('email must be an email', 400)).toBe('Укажите корректный email.');
  });
});
