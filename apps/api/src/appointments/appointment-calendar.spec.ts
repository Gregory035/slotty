import { appointmentCalendar } from './appointment-calendar';

describe('appointment calendar export', () => {
  it('escapes text and folds UTF-8 lines without splitting characters', () => {
    const result = appointmentCalendar({
      id: 'appointment', startsAt: new Date('2035-01-01T09:00:00Z'), endsAt: new Date('2035-01-01T10:00:00Z'),
      service: { name: 'Консультация;\nОписание' }, company: { name: 'Студия', address: 'Москва, ' + 'длинная улица '.repeat(12) },
      employee: { firstName: 'Анна', lastName: null },
    });
    expect(result).toContain('DTSTART:20350101T090000Z\r\n');
    expect(result.replace(/\r\n /g, '')).toContain('Консультация\\;\\nОписание');
    for (const line of result.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(73);
    expect(result).toContain('END:VCALENDAR\r\n');
  });
});
