import { useQuery } from '@tanstack/react-query';
import { getApiHealth } from './api';
import { useUiStore } from './store';

const navigation = [
  ['Обзор', '⌂'],
  ['Календарь', '◫'],
  ['Записи', '◷'],
  ['Клиенты', '♙'],
  ['Услуги', '◇'],
  ['Сотрудники', '♧'],
  ['Telegram-бот', '✦'],
] as const;

const appointments = [
  { time: '10:00', client: 'Анна Смирнова', service: 'Маникюр', employee: 'Елена', color: 'bg-violet-500' },
  { time: '12:30', client: 'Мария Волкова', service: 'Окрашивание', employee: 'Кристина', color: 'bg-amber-500' },
  { time: '15:00', client: 'Олег Иванов', service: 'Стрижка', employee: 'Алексей', color: 'bg-cyan-500' },
];

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm text-emerald-600">{note}</p>
    </article>
  );
}

export function App() {
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const health = useQuery({ queryKey: ['health'], queryFn: getApiHealth });

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 bg-slate-950 px-4 py-5 text-white transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-black">TB</div>
          <div>
            <p className="font-semibold">Telegram Business</p>
            <p className="text-xs text-slate-400">Панель управления</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {navigation.map(([label, icon], index) => (
            <a
              key={label}
              href={index === 0 ? '/' : `/${label.toLowerCase()}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${index === 0 ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="w-5 text-center text-base">{icon}</span>
              {label}
            </a>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-xl bg-white/5 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Пробный период</span>
            <span>14 дней</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/4 rounded-full bg-primary" />
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden" onClick={toggleSidebar} aria-label="Закрыть меню" />}

      <main className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-slate-200 px-3 py-2 lg:hidden" onClick={toggleSidebar} aria-label="Открыть меню">☰</button>
            <div>
              <p className="text-sm font-semibold">Студия «Линия»</p>
              <p className="text-xs text-slate-500">Москва · Europe/Moscow</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sm:flex ${health.isSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <span className={`h-2 w-2 rounded-full ${health.isSuccess ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {health.isSuccess ? 'API подключён' : 'Демо-режим'}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-bold">АГ</div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-primary">Пятница, 7 августа</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Добрый день, Алексей</h1>
              <p className="mt-2 text-slate-500">Вот что происходит в вашем бизнесе сегодня.</p>
            </div>
            <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-500">+ Новая запись</button>
          </div>

          <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Записей сегодня" value="8" note="↑ 2 к прошлой пятнице" />
            <MetricCard label="Выручка сегодня" value="18 400 ₽" note="↑ 12% за неделю" />
            <MetricCard label="Новых клиентов" value="3" note="Всего 248 клиентов" />
            <MetricCard label="Загрузка" value="72%" note="6 свободных слотов" />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Ближайшие записи</h2>
                  <p className="text-sm text-slate-500">Сегодня, по московскому времени</p>
                </div>
                <button className="text-sm font-semibold text-primary">Весь календарь →</button>
              </div>
              <div className="mt-5 divide-y divide-slate-100">
                {appointments.map((item) => (
                  <div key={item.time} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 py-4">
                    <p className="font-bold">{item.time}</p>
                    <div className="flex items-center gap-3">
                      <span className={`h-10 w-1 rounded-full ${item.color}`} />
                      <div>
                        <p className="font-semibold">{item.client}</p>
                        <p className="text-sm text-slate-500">{item.service} · {item.employee}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Подтверждена</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl bg-slate-950 p-6 text-white shadow-card">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500 text-2xl">✈</div>
              <h2 className="mt-5 text-xl font-bold">Подключите Telegram-бота</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Клиенты смогут записываться круглосуточно, а вы получите уведомления о новых визитах.</p>
              <div className="mt-6 space-y-3 text-sm">
                <p>✓ Создайте бота через BotFather</p>
                <p>✓ Вставьте токен в настройках</p>
                <p>✓ Опубликуйте услуги и расписание</p>
              </div>
              <button className="mt-7 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">Настроить бота</button>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
