import { BadRequestException } from '@nestjs/common';
import {
  isoWeekday,
  localDateTimeToUtc,
  parseDateOnly,
  parseTimeToMinutes,
} from './time-zone.util';

describe('time-zone utilities', () => {
  it('parses ISO weekdays and local times', () => {
    expect(isoWeekday('2026-08-10')).toBe(1);
    expect(parseTimeToMinutes('09:45')).toBe(585);
  });

  it('rejects impossible calendar dates', () => {
    expect(() => parseDateOnly('2026-02-30')).toThrow(BadRequestException);
  });

  it('converts company-local time to UTC', () => {
    expect(
      localDateTimeToUtc(
        '2026-08-10',
        '09:00',
        'Europe/Moscow',
      ).toISOString(),
    ).toBe('2026-08-10T06:00:00.000Z');
    expect(
      localDateTimeToUtc(
        '2026-01-15',
        '09:00',
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-01-15T14:00:00.000Z');
    expect(
      localDateTimeToUtc(
        '2026-07-15',
        '09:00',
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-07-15T13:00:00.000Z');
  });

  it('rejects a local time skipped by daylight saving time', () => {
    expect(() =>
      localDateTimeToUtc('2026-03-08', '02:30', 'America/New_York'),
    ).toThrow(BadRequestException);
  });
});
