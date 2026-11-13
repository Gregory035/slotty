import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getAvailability } from '../api';
import { formatTime } from '../utils';

interface Preview {
  employeeId: string; serviceId: string;
  service: { name: string };
  employee: { firstName: string; lastName: string | null };
}

export function BookingReadiness({ companyId, timezone, preview, username, hasTelegramBooking }: {
  companyId: string; timezone: string; preview: Preview; username: string; hasTelegramBooking?: boolean;
}) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [date, setDate] = useState(today);
  const [copied, setCopied] = useState(false);
  const link = `https://t.me/${username}?start=book`;
  const check = useMutation({ mutationFn: (selectedDate: string) => getAvailability(companyId, { employeeId: preview.employeeId, serviceId: preview.serviceId, date: selectedDate }) });
  return <section className="setup-checklist panel" aria-label="Готовность к записи">
    <div><p className="eyebrow">Онлайн-запись</p><h2>{hasTelegramBooking ? 'Первая запись из Telegram получена' : 'Всё готово к проверке'}</h2>
      <p>Проверьте доступное время: запись не создаётся и слот не резервируется.</p>
      <p>{preview.service.name} · {[preview.employee.firstName, preview.employee.lastName].filter(Boolean).join(' ')}</p>
    </div>
    <div>
      <form onSubmit={(event) => { event.preventDefault(); check.mutate(date); }}>
        <label>Дата проверки <input type="date" required min={today} value={date} onChange={(event) => { setDate(event.target.value); check.reset(); }} /></label>
        <button type="submit" disabled={check.isPending}>{check.isPending ? 'Проверяем…' : 'Проверить запись'}</button>
      </form>
      <div role="status">
        {check.isError && 'Не удалось проверить слоты. Проверьте дату и попробуйте ещё раз.'}
        {check.data && (check.data.slots.length ? `Свободное время: ${check.data.slots.slice(0, 8).map((slot) => formatTime(slot.startsAt, timezone)).join(', ')}` : 'На эту дату свободного времени нет. Выберите другую дату.')}
      </div>
      <a className="secondary-button" href={link} target="_blank" rel="noreferrer">Открыть бота</a>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку для клиентов'}</button>
      <input aria-label="Ссылка для клиентов" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
    </div>
  </section>;
}
