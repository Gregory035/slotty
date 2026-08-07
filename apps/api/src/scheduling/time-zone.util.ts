import { BadRequestException } from '@nestjs/common';

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseTimeToMinutes(value: string): number {
  if (!TIME_PATTERN.test(value)) {
    throw new BadRequestException('Time must use HH:mm format');
  }

  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return hours * 60 + minutes;
}

export function parseDateOnly(value: string): DateParts {
  if (!DATE_PATTERN.test(value)) {
    throw new BadRequestException('Date must use YYYY-MM-DD format');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new BadRequestException('Date is not valid');
  }

  return { year, month, day };
}

export function dateOnlyToUtc(value: string): Date {
  const { year, month, day } = parseDateOnly(value);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = dateOnlyToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function isoWeekday(value: string): number {
  const weekday = dateOnlyToUtc(value).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const { year, month, day } = parseDateOnly(date);
  const minutesOfDay = parseTimeToMinutes(time);
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const nextCandidate = candidate + (targetAsUtc - representedAsUtc);
    if (nextCandidate === candidate) {
      break;
    }
    candidate = nextCandidate;
  }

  const result = new Date(candidate);
  const resultParts = zonedParts(result, timeZone);
  if (
    resultParts.year !== year ||
    resultParts.month !== month ||
    resultParts.day !== day ||
    resultParts.hour !== hour ||
    resultParts.minute !== minute
  ) {
    throw new BadRequestException(
      'Local time does not exist in the company timezone',
    );
  }

  return result;
}

function zonedParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: partValue }) => [type, Number(partValue)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  } as Required<Record<'year' | 'month' | 'day' | 'hour' | 'minute', number>>;
}
