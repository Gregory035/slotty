import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiError, request } from '../api-client';
import { ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import { formatDateTime } from '../utils';
import './operator-view.css';

interface OperatorUsers {
  page: number;
  hasNext: boolean;
  users: Array<{
    id: string; email: string; firstName: string; lastName: string | null; createdAt: string;
    companies: Array<{ id: string; name: string; role: string; subscription: { plan: string; status: string } | null; scheduleReady: boolean; botReady: boolean; receivedBooking: boolean }>;
  }>;
}

export function OperatorView({ userId }: { userId: string }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const users = useQuery({
    queryKey: ['operator-users', userId, search, page],
    queryFn: ({ signal }) => request<OperatorUsers>(`/operator/users?${new URLSearchParams({ q: search, page: String(page) })}`, { signal }),
    retry: false, gcTime: 0,
  });
  const activation = useQuery({
    queryKey: ['operator-activation', userId],
    queryFn: ({ signal }) => request<Array<{ id: string; label: string; count: number }>>('/operator/activation', { signal }),
    retry: false, enabled: users.isSuccess, gcTime: 0,
  });
  if (users.error instanceof ApiError && users.error.status === 403) return <main className="fullscreen-state"><ErrorBlock message="Этот раздел доступен только оператору Slotty." /><Link to="/app">В рабочее пространство</Link></main>;
  return <main className="landing-page">
    <section className="marketing-section operator-view">
      <SectionHeader eyebrow="Slotty" title="Пользователи платформы" description="Закрытый раздел оператора. Только просмотр." action={<Link className="secondary-button" to="/app">В рабочее пространство</Link>} />
      <section className="panel" aria-label="Воронка запуска">
        <h2>Воронка запуска</h2>
        <p>По текущему состоянию компаний. Каждый владелец считается один раз на шаг; шаги одной цепочки относятся к одной компании.</p>
        {activation.isLoading && <LoadingBlock />}
        {activation.isError && <ErrorBlock message="Не удалось загрузить воронку." />}
        <ol>{activation.data?.map((step) => <li key={step.id}>{step.label}: {step.count}</li>)}</ol>
      </section>
      <form className="form-stack" onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); setPage(1); }}>
        <label>Имя, фамилия или email<input value={input} maxLength={100} onChange={(event) => setInput(event.target.value)} /></label>
        <button className="primary-button" type="submit">Найти</button>
      </form>
      {users.isLoading && <LoadingBlock />}
      {users.isError && <ErrorBlock message="Не удалось загрузить пользователей." />}
      {users.data?.users.length === 0 && <p>Пользователи не найдены.</p>}
      {users.data?.users.map((user) => <article className="panel" key={user.id}>
        <h2>{user.firstName} {user.lastName}</h2>
        <p>{user.email} · {formatDateTime(user.createdAt, 'Europe/Moscow')} (МСК)</p>
        {user.companies.length ? <ul>{user.companies.map((company) => <li key={company.id}>
          {company.name} · {company.role} · {company.subscription ? `${company.subscription.plan} / ${company.subscription.status}` : 'Без подписки'}
          <div>{company.scheduleReady ? 'Расписание готово' : 'Расписание не готово'} · {company.botReady ? 'Бот подключён' : 'Бот не подключён'} · {company.receivedBooking ? 'Есть запись из Telegram' : 'Нет записей из Telegram'}</div>
        </li>)}</ul> : <p>Нет компаний</p>}
      </article>)}
      {users.data && <div>
        <button className="secondary-button" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button>
        <span> Страница {page} </span>
        <button className="secondary-button" disabled={!users.data.hasNext} onClick={() => setPage(page + 1)}>Далее</button>
      </div>}
    </section>
  </main>;
}
