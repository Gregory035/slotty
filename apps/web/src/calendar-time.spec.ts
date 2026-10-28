import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarDate, calendarMinutes, calendarMonday, calendarQueryRange, formatCalendarDay } from './calendar-time';

describe('company calendar dates', () => {
  it('places a Moscow visit independently of the device timezone', () => {
    const date = '2026-10-27T09:00:00Z';
    expect(calendarDate(date, 'Europe/Moscow')).toBe('2026-10-27');
    expect(calendarMinutes(date, 'Europe/Moscow')).toBe(12 * 60);
  });
  it('uses the company date around midnight', () => {
    expect(calendarDate('2026-10-27T22:30:00Z', 'Europe/Moscow')).toBe('2026-10-28');
    expect(calendarMinutes('2026-10-27T22:30:00Z', 'Europe/Moscow')).toBe(90);
    expect(calendarDate('2026-10-28T01:00:00Z', 'America/New_York')).toBe('2026-10-27');
  });
  it('keeps date arithmetic stable across DST and month boundaries', () => {
    expect(addCalendarDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(calendarMonday('2026-11-01')).toBe('2026-10-26');
    expect(formatCalendarDay('2026-10-28', { day: 'numeric' })).toBe('28');
  });
  it('honours changing company UTC offset across DST', () => {
    expect(calendarMinutes('2026-03-29T00:30:00Z', 'Europe/Berlin')).toBe(90);
    expect(calendarMinutes('2026-03-29T01:30:00Z', 'Europe/Berlin')).toBe(210);
  });
  it('covers both extremes of timezone offsets in the query envelope', () => {
    const range = calendarQueryRange('2026-10-28', '2026-10-28');
    expect(Date.parse(range.from)).toBeLessThanOrEqual(Date.parse('2026-10-27T10:00:00Z'));
    expect(Date.parse(range.to)).toBeGreaterThanOrEqual(Date.parse('2026-10-29T11:59:59Z'));
  });
});
