import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { addMember, deleteMember, getEmployees, getMembers, updateMember } from '../api';
import { useToast } from '../components/ToastProvider';
import { EmptyState, ErrorBlock, LoadingBlock, Modal, SectionHeader } from '../components/ui';
import type { Company } from '../types';
import { errorMessage } from '../utils';

const roleLabel = { OWNER: 'Владелец', ADMIN: 'Администратор', EMPLOYEE: 'Сотрудник' };

export function MembersView({ company }: { company: Company }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const members = useQuery({ queryKey: ['members', company.id], queryFn: () => getMembers(company.id) });
  const remove = useMutation({
    mutationFn: (id: string) => deleteMember(company.id, id),
    onSuccess: async () => { notify('Участник удалён'); await queryClient.invalidateQueries({ queryKey: ['members', company.id] }); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  const change = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Company['role'] }) => updateMember(company.id, id, { role }),
    onSuccess: async () => { notify('Роль изменена'); await queryClient.invalidateQueries({ queryKey: ['members', company.id] }); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  return (
    <>
      <SectionHeader eyebrow="Доступ" title="Участники и роли" description="Права проверяются сервером для каждого рабочего пространства." action={<button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} /> Добавить</button>} />
      {members.isLoading ? <LoadingBlock /> : members.error ? <ErrorBlock message="Не удалось загрузить участников" /> : !members.data?.items.length ? <EmptyState title="Нет участников" description="Добавьте пользователя по email." /> : (
        <div className="panel data-list">
          {members.data.items.map((member) => (
            <div className="data-row" key={member.id}>
              <span className="avatar">{member.firstName[0]}{member.lastName?.[0]}</span>
              <div><strong>{member.firstName} {member.lastName}</strong><span>{member.email}</span></div>
              <select value={member.role} disabled={company.role === 'ADMIN' && member.role !== 'EMPLOYEE'} onChange={(event) => change.mutate({ id: member.id, role: event.target.value as Company['role'] })}>
                {(company.role === 'OWNER' ? ['OWNER', 'ADMIN', 'EMPLOYEE'] : ['EMPLOYEE']).map((role) => <option value={role} key={role}>{roleLabel[role as Company['role']]}</option>)}
              </select>
              <button className="icon-button danger" aria-label="Удалить участника" onClick={() => { if (window.confirm('Удалить участника из компании?')) remove.mutate(member.id); }}><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
      )}
      <AddMemberModal company={company} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddMemberModal({ company, open, onClose }: { company: Company; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Company['role']>('EMPLOYEE');
  const [employeeId, setEmployeeId] = useState('');
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const employees = useQuery({ queryKey: ['employees', company.id], queryFn: () => getEmployees(company.id), enabled: open });
  const mutation = useMutation({
    mutationFn: () => addMember(company.id, { email, role, employeeId: role === 'EMPLOYEE' ? employeeId : null }),
    onSuccess: async () => { notify('Участник добавлен'); onClose(); await queryClient.invalidateQueries({ queryKey: ['members', company.id] }); },
    onError: (caught) => notify(errorMessage(caught), 'error'),
  });
  return (
    <Modal open={open} title="Добавить участника" description="Пользователь должен сначала зарегистрироваться в сервисе." onClose={onClose}>
      <form className="modal-form form-stack" onSubmit={(event) => { event.preventDefault(); if (email && (role !== 'EMPLOYEE' || employeeId)) mutation.mutate(); }}>
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Роль<select value={role} onChange={(event) => setRole(event.target.value as Company['role'])}>{(company.role === 'OWNER' ? ['EMPLOYEE', 'ADMIN', 'OWNER'] : ['EMPLOYEE']).map((item) => <option key={item} value={item}>{roleLabel[item as Company['role']]}</option>)}</select></label>
        {role === 'EMPLOYEE' && <label>Профиль сотрудника<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Выберите сотрудника</option>{employees.data?.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={mutation.isPending}>Добавить</button></div>
      </form>
    </Modal>
  );
}
