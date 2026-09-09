import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { getEmployees, getSchedule, replaceSchedule } from '../api';
import { useToast } from '../components/ToastProvider';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import type { Company } from '../types';
import { errorMessage } from '../utils';

const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
type DraftRule = { key: string; weekday: number; startTime: string; endTime: string };

export function ScheduleView({ company }: { company: Company }) {
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id) });
  const availableEmployees = company.role === 'EMPLOYEE'
    ? employees.data?.filter((item) => item.id === company.employeeId) ?? []
    : employees.data ?? [];
  const [employeeId, setEmployeeId] = useState(company.employeeId ?? '');
  useEffect(() => { if (!employeeId && availableEmployees[0]) setEmployeeId(availableEmployees[0].id); }, [availableEmployees, employeeId]);
  const schedule = useQuery({ queryKey: ['schedule', company.id, employeeId], queryFn: () => getSchedule(company.id, employeeId), enabled: Boolean(employeeId) });
  if (employees.isLoading) return <LoadingBlock />;
  if (employees.error) return <ErrorBlock message="Не удалось загрузить сотрудников" />;
  return (
    <>
      <SectionHeader eyebrow="Рабочее время" title="Расписание" description="Несколько интервалов в день, перерывы, отпуск и исключения." />
      {!availableEmployees.length ? <EmptyState title="Нет сотрудников" description="Сначала создайте профиль сотрудника." /> : <><div className="toolbar"><label className="inline-field">Сотрудник<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{availableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label></div>{schedule.isLoading ? <LoadingBlock /> : schedule.error ? <ErrorBlock message="Не удалось загрузить расписание" /> : <ScheduleEditor company={company} employeeId={employeeId} rules={schedule.data ?? []} />}</>}
    </>
  );
}

function ScheduleEditor({ company, employeeId, rules }: { company: Company; employeeId: string; rules: Array<{ id: string; weekday: number; startTime: string; endTime: string }> }) {
  const [draft, setDraft] = useState<DraftRule[]>([]);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  useEffect(() => setDraft(rules.map((rule) => ({ ...rule, key: rule.id }))), [rules, employeeId]);
  const mutation = useMutation({
    mutationFn: () => replaceSchedule(company.id, employeeId, draft.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))),
    onSuccess: async () => { notify('Расписание сохранено'); await queryClient.invalidateQueries({ queryKey: ['schedule', company.id, employeeId] }); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  function update(key: string, field: 'startTime' | 'endTime', value: string) {
    setDraft((current) => current.map((rule) => rule.key === key ? { ...rule, [field]: value } : rule));
  }
  return <div className="panel schedule-page"><div className="schedule-week-grid">{days.map((day, index) => { const weekday = index + 1; const own = draft.filter((rule) => rule.weekday === weekday); return <section key={day}><header><strong>{day}</strong><button className="icon-button" aria-label={`Добавить интервал ${day}`} onClick={() => setDraft((current) => [...current, { key: crypto.randomUUID(), weekday, startTime: '09:00', endTime: '18:00' }])}><Plus size={16} /></button></header>{own.length ? own.map((rule) => <div className="schedule-interval" key={rule.key}><input type="time" value={rule.startTime} onChange={(event) => update(rule.key, 'startTime', event.target.value)} /><span>—</span><input type="time" value={rule.endTime} onChange={(event) => update(rule.key, 'endTime', event.target.value)} /><button className="icon-button danger" onClick={() => setDraft((current) => current.filter((item) => item.key !== rule.key))}><Trash2 size={15} /></button></div>) : <p>Выходной</p>}</section>; })}</div><div className="settings-actions"><button className="primary-button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Сохранить расписание</button></div></div>;
}
