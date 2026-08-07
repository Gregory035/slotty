import { describe, expect, it } from 'vitest';
import { errorMessage, formatMoney, formatTime, statusLabel, statusTone } from './utils';

describe('dashboard formatters', () => {
  it('formats prices in the company currency', () => {
    expect(formatMoney(2500, 'RUB').replace(/\s/g, ' ')).toContain('2 500');
  });

  it('formats appointment time in the company timezone', () => {
    expect(formatTime('2026-08-07T09:30:00.000Z', 'Europe/Moscow')).toBe('12:30');
  });

  it('maps appointment statuses to visible labels and tones', () => {
    expect(statusLabel.CONFIRMED).toBe('Подтверждена');
    expect(statusTone.NO_SHOW).toBe('badge-red');
  });

  it('turns unknown failures into a safe message', () => {
    expect(errorMessage(new Error('API недоступен'))).toBe('API недоступен');
    expect(errorMessage(null)).toBe('Что-то пошло не так');
  });
});
