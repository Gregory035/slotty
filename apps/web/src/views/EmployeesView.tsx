import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Mail, Phone, Plus, Trash2, UserRoundPlus } from 'lucide-react';
import {
  assignEmployeeService,
  createEmployee,
  createScheduleException,
  deleteEmployee,
  deleteScheduleException,
  getEmployees,
  getSchedule,
  getScheduleExceptions,
  getServices,
  replaceSchedule,
} from '../api';
import type { Company, Employee, ScheduleExceptionType } from '../types';
import { errorMessage } from '../utils';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, SectionHeader } from '../components/ui';

const days = [
  [1, 'Понедельник'], [2, 'Вторник'], [3, 'Среда'], [4, 'Четверг'], [5, 'Пятница'], [6, 'Суббота'], [7, 'Воскресенье'],
] as const;

type DayNumber = (typeof days)[number][0];
type DayRule = { enabled: boolean; startTime: string; endTime: string };
type WeekRules = { [day in DayNumber]: DayRule };

export function EmployeesView({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [scheduleEmployee, setScheduleEmployee] = useState<Employee | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id) });
  const services = useQuery({ queryKey: ['services', company.id], queryFn: () => getServices(company.id) });
  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createEmployee>[1]) => {
      const employee = await createEmployee(company.id, input);
      await Promise.all(selectedServices.map((serviceId) => assignEmployeeService(company.id, employee.id, serviceId)));
      return employee;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setSelectedServices([]);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['employees', company.id] });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => deleteEmployee(company.id, employeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees', company.id] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    createMutation.mutate({
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName') || '') || undefined,
      phone: String(form.get('phone') || '') || undefined,
      email: String(form.get('email') || '') || undefined,
      description: String(form.get('description') || '') || undefined,
      color: String(form.get('color')),
    });
  }

  return (
    <>
      <SectionHeader eyebrow="Команда" title="Сотрудники" description="Назначайте услуги и рабочие часы каждому специалисту." action={<button className="primary-button" onClick={() => setCreateOpen(true)}><UserRoundPlus size={17} /> Добавить сотрудника</button>} />
      {employees.isLoading ? <LoadingBlock /> : employees.error ? <ErrorBlock message="Не удалось загрузить сотрудников" /> : employees.data?.length === 0 ? (
        <EmptyState title="Добавьте первого сотрудника" description="После этого настройте его график и назначьте услуги." action={<button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16} /> Добавить сотрудника</button>} />
      ) : (
        <div className="employee-grid">
          {employees.data?.map((employee) => (
            <article className="employee-card" key={employee.id}>
              <div className="employee-head"><span className="avatar avatar-large" style={{ backgroundColor: `${employee.color}20`, color: employee.color }}>{employee.firstName[0]}{employee.lastName?.[0]}</span><div><h2>{employee.firstName} {employee.lastName}</h2><span className={`status-dot-label ${employee.isActive ? 'active' : ''}`}><i />{employee.isActive ? 'Работает' : 'Неактивен'}</span></div></div>
              <div className="employee-contacts">{employee.phone && <span><Phone size={15} />{employee.phone}</span>}{employee.email && <span><Mail size={15} />{employee.email}</span>}</div>
              <div className="employee-services"><p>Услуги</p><div>{employee.services.length ? employee.services.map((service) => <span key={service.id}>{service.name}</span>) : <em>Не назначены</em>}</div></div>
              <div className="employee-actions"><button className="secondary-button" onClick={() => setScheduleEmployee(employee)}><CalendarClock size={16} /> Расписание</button><button className="icon-button danger" title="Удалить" onClick={() => { if (window.confirm(`Удалить сотрудника ${employee.firstName}?`)) deleteMutation.mutate(employee.id); }}><Trash2 size={16} /></button></div>
            </article>
          ))}
        </div>
      )}

      <Modal open={createOpen} title="Новый сотрудник" description="Контакты видны только владельцу компании." onClose={() => setCreateOpen(false)}>
        <form className="form-stack modal-form" onSubmit={submit}>
          <div className="form-grid-2"><label>Имя<input name="firstName" required maxLength={50} placeholder="Елена" autoFocus /></label><label>Фамилия<input name="lastName" maxLength={50} placeholder="Соколова" /></label></div>
          <div className="form-grid-2"><label>Телефон<input name="phone" maxLength={32} placeholder="+7 999 123-45-67" /></label><label>Email<input name="email" type="email" maxLength={254} placeholder="elena@example.com" /></label></div>
          <label>Цвет в календаре<input name="color" type="color" defaultValue="#64748b" /></label>
          <fieldset className="service-checkboxes"><legend>Какие услуги выполняет</legend>{services.data?.length ? services.data.map((service) => <label key={service.id}><input type="checkbox" checked={selectedServices.includes(service.id)} onChange={(event) => setSelectedServices((current) => event.target.checked ? [...current, service.id] : current.filter((id) => id !== service.id))} /><span>{service.name}<small>{service.durationMinutes} мин</small></span></label>) : <p>Сначала добавьте услуги.</p>}</fieldset>
          <label>О сотруднике<textarea name="description" rows={2} maxLength={2000} placeholder="Опыт, специализация" /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setCreateOpen(false)}>Отмена</button><button className="primary-button" disabled={createMutation.isPending}>{createMutation.isPending ? 'Сохраняем…' : 'Добавить сотрудника'}</button></div>
        </form>
      </Modal>

      {scheduleEmployee && <ScheduleModal company={company} employee={scheduleEmployee} onClose={() => setScheduleEmployee(null)} />}
    </>
  );
}

function ScheduleModal({ company, employee, onClose }: { company: Company; employee: Employee; onClose: () => void }) {
  const queryClient = useQueryClient();
  const schedule = useQuery({ queryKey: ['schedule', company.id, employee.id], queryFn: () => getSchedule(company.id, employee.id) });
  const exceptions = useQuery({ queryKey: ['schedule-exceptions', company.id, employee.id], queryFn: () => getScheduleExceptions(company.id, employee.id) });
  const [rules, setRules] = useState<WeekRules>(() => createDefaultRules());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!schedule.data) return;
    setRules(Object.fromEntries(days.map(([number]) => {
      const found = schedule.data.find((item) => item.weekday === number);
      return [number, { enabled: Boolean(found), startTime: found?.startTime ?? '09:00', endTime: found?.endTime ?? '18:00' }];
    })) as WeekRules);
  }, [schedule.data]);
  const saveMutation = useMutation({
    mutationFn: () => replaceSchedule(company.id, employee.id, days.filter(([number]) => rules[number].enabled).map(([number]) => ({ weekday: number, startTime: rules[number].startTime, endTime: rules[number].endTime }))),
    onSuccess: async () => { setError(null); await queryClient.invalidateQueries({ queryKey: ['schedule', company.id, employee.id] }); },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const exceptionMutation = useMutation({
    mutationFn: (input: { date: string; type: ScheduleExceptionType }) => createScheduleException(company.id, employee.id, input),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['schedule-exceptions', company.id, employee.id] }); },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const deleteExceptionMutation = useMutation({
    mutationFn: (id: string) => deleteScheduleException(company.id, employee.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedule-exceptions', company.id, employee.id] }),
  });

  function addException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    exceptionMutation.mutate({ date: String(form.get('date')), type: String(form.get('type')) as ScheduleExceptionType });
    event.currentTarget.reset();
  }

  return (
    <Modal open title={`Расписание · ${employee.firstName}`} description={`Часовой пояс: ${company.timezone}`} onClose={onClose}>
      <div className="schedule-content">
        {schedule.isLoading ? <LoadingBlock /> : <div className="week-schedule">{days.map(([number, label]) => <div className={`schedule-row ${rules[number].enabled ? 'enabled' : ''}`} key={number}><label className="day-toggle"><input type="checkbox" checked={rules[number].enabled} onChange={(event) => setRules((current) => ({ ...current, [number]: { ...current[number], enabled: event.target.checked } }))} /><span>{label}</span></label><div className="time-range"><input type="time" value={rules[number].startTime} disabled={!rules[number].enabled} onChange={(event) => setRules((current) => ({ ...current, [number]: { ...current[number], startTime: event.target.value } }))} /><span>—</span><input type="time" value={rules[number].endTime} disabled={!rules[number].enabled} onChange={(event) => setRules((current) => ({ ...current, [number]: { ...current[number], endTime: event.target.value } }))} /></div></div>)}</div>}
        <div className="schedule-save-row"><span>{saveMutation.isSuccess ? 'График сохранён' : 'Можно настроить отдельный график на каждый день.'}</span><button className="primary-button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Сохраняем…' : 'Сохранить график'}</button></div>
        <div className="exceptions-section"><div><p className="eyebrow">Особые дни</p><h3>Выходные и отпуск</h3></div><form className="exception-form" onSubmit={addException}><input name="date" type="date" required /><select name="type" defaultValue="DAY_OFF"><option value="DAY_OFF">Выходной</option><option value="VACATION">Отпуск</option><option value="SICK_LEAVE">Больничный</option></select><button className="secondary-button" disabled={exceptionMutation.isPending}><Plus size={15} /> Добавить</button></form>{exceptions.data?.length ? <div className="exception-list">{exceptions.data.map((item) => <div key={item.id}><span>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${item.date}T12:00:00Z`))}</span><strong>{exceptionLabel(item.type)}</strong><button className="icon-button danger" onClick={() => deleteExceptionMutation.mutate(item.id)}><Trash2 size={15} /></button></div>)}</div> : <p className="muted-text">Особых дней пока нет.</p>}</div>
        {error && <p className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}

function exceptionLabel(type: ScheduleExceptionType) {
  return { DAY_OFF: 'Выходной', VACATION: 'Отпуск', SICK_LEAVE: 'Больничный', CUSTOM_HOURS: 'Особые часы' }[type];
}

function createDefaultRules(): WeekRules {
  return Object.fromEntries(days.map(([number]) => [
    number,
    { enabled: number <= 5, startTime: '09:00', endTime: '18:00' },
  ])) as WeekRules;
}
