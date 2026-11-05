interface CalendarAppointment {
  id: string; startsAt: Date; endsAt: Date;
  service: { name: string };
  company: { name: string; address: string | null };
  employee: { firstName: string; lastName: string | null };
}

export function appointmentCalendar(appointment: CalendarAppointment): string {
  const formatUtc = (value: Date) => value.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  const escapeText = (value: string) => value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/gu, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slotty//Booking Calendar//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appointment.id}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(appointment.startsAt)}`,
    `DTEND:${formatUtc(appointment.endsAt)}`,
    `SUMMARY:${escapeText(`${appointment.service.name} — ${appointment.company.name}`)}`,
    `DESCRIPTION:${escapeText(`Специалист: ${[appointment.employee.firstName, appointment.employee.lastName].filter(Boolean).join(' ')}`)}`,
    ...(appointment.company.address ? [`LOCATION:${escapeText(appointment.company.address)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const fold = (line: string) => {
    let current = '';
    const result: string[] = [];
    for (const character of line) {
      if (Buffer.byteLength(current + character, 'utf8') > 73) {
        result.push(current);
        current = ` ${character}`;
      } else current += character;
    }
    result.push(current);
    return result.join('\r\n');
  };
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
