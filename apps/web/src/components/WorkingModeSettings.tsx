import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeWorkingMode, getEmployees } from '../api';
import type { Company } from '../types';
import { errorMessage } from '../utils';
import { useToast } from './ToastProvider';

export function WorkingModeSettings({ company }: { company: Company }) {
  const [employeeId, setEmployeeId] = useState(company.employeeId ?? '');
  const client = useQueryClient();
  const { notify } = useToast();
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id), enabled: company.role === 'OWNER' });
  const mutation = useMutation({
    mutationFn: (mode: Company['workingMode']) => changeWorkingMode(company.id, mode, mode === 'SOLO' ? employeeId || undefined : undefined),
    onSuccess: async () => {
      notify('Режим работы изменён');
      await client.invalidateQueries({ queryKey: ['companies'] });
      await client.invalidateQueries({ queryKey: ['employees', company.id] });
      await client.invalidateQueries({ queryKey: ['employee-self', company.id] });
      await client.invalidateQueries({ queryKey: ['dashboard', company.id] });
    },
  });
  if (company.role !== 'OWNER') return null;
  const solo = company.workingMode === 'SOLO';
  return <section className="panel settings-form" aria-label="Режим работы"><section>
    <h2>{solo ? 'Работаю один' : 'У меня команда'}</h2>
    <p className="muted-text">{solo ? 'Вы управляете бизнесом и сами оказываете услуги. При расширении команды ваша карточка, расписание и отзывы сохранятся.' : 'Если услуги оказываете только вы, включите личный режим. Выберите свою карточку: её расписание, работы и отзывы сохранятся. Других активных специалистов быть не должно.'}</p>
    {!solo && (employees.isLoading ? <p>Загружаем профили…</p> : employees.error ? <p className="form-error">Не удалось загрузить профили. <button className="text-button" onClick={() => void employees.refetch()}>Повторить</button></p> : Boolean(employees.data?.length) && <label>Моя карточка специалиста<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Выберите свой профиль</option>{employees.data?.filter((employee) => employee.isActive).map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>)}
    {!solo && employees.data?.length === 0 && <p className="muted-text">Профиль мастера создастся из вашего имени в аккаунте. Все активные услуги будут назначены вам.</p>}
    {mutation.error && <p className="form-error" role="alert">{errorMessage(mutation.error)}</p>}
    <button type="button" className="secondary-button" disabled={mutation.isPending || (!solo && (employees.isLoading || Boolean(employees.error) || (Boolean(employees.data?.length) && !employeeId)))} onClick={() => mutation.mutate(solo ? 'TEAM' : 'SOLO')}>{mutation.isPending ? 'Сохраняем…' : solo ? 'Перейти к команде' : 'Работаю один'}</button>
  </section></section>;
}
