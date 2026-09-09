import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getAuditLogs } from '../api';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import type { Company } from '../types';

export function AuditView({ company }: { company: Company }) {
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cursor') ?? undefined;
  const logs = useQuery({ queryKey: ['audit', company.id, cursor], queryFn: () => getAuditLogs(company.id, cursor) });
  return (
    <>
      <SectionHeader eyebrow="Безопасность" title="Журнал действий" description="Изменения ролей, записей, клиентов, бота и подписки." />
      {logs.isLoading ? <LoadingBlock /> : logs.error ? <ErrorBlock message="Не удалось загрузить журнал" /> : !logs.data?.items.length ? <EmptyState title="Событий пока нет" description="Новые действия появятся здесь автоматически." /> : (
        <div className="panel data-list audit-list">
          {logs.data.items.map((log) => <div className="data-row" key={log.id}><div><strong>{log.action}</strong><span>{log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}</span></div><div><strong>{log.actor ? `${log.actor.firstName} ${log.actor.lastName ?? ''}` : 'Система'}</strong><span>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: company.timezone }).format(new Date(log.createdAt))}</span></div></div>)}
          {logs.data.hasMore && <button className="secondary-button page-next" onClick={() => setParams({ cursor: logs.data.nextCursor ?? '' })}>Следующая страница</button>}
        </div>
      )}
    </>
  );
}
