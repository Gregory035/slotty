import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { getReviews } from '../api';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import type { Company } from '../types';
import { customerDisplayName } from '../utils';

export function ReviewsView({ company }: { company: Company }) {
  const reviews = useQuery({ queryKey: ['reviews', company.id], queryFn: () => getReviews(company.id) });
  if (reviews.isLoading) return <LoadingBlock />;
  if (reviews.error) return <ErrorBlock message="Не удалось загрузить отзывы" />;
  const data = reviews.data!;
  return (
    <>
      <SectionHeader eyebrow="Качество" title="Отзывы" description="Оценки клиентов после завершённых записей." />
      {!data.summary.count ? <EmptyState title="Отзывов пока нет" description="После завершения услуги бот предложит клиенту поставить оценку и оставить комментарий." /> : <>
        <div className="review-summary panel">
          <div><Star size={24} fill="currentColor" /><strong>{data.summary.average}</strong><span>средняя оценка</span></div>
          <div><strong>{data.summary.count}</strong><span>всего отзывов</span></div>
        </div>
        <div className="review-rankings">
          <Ranking title="Сотрудники" items={data.byEmployee} />
          <Ranking title="Услуги" items={data.byService} />
        </div>
        <section className="review-feed">
          <h2>Последние отзывы</h2>
          <div className="review-list">
            {data.items.map((review) => <article className="panel review-card" key={review.id}>
              <div className="review-card-head"><strong>{customerDisplayName(review.customer)}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
              {review.comment && <p>{review.comment}</p>}
              <small>{review.service.name} · {review.employee.name} · {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</small>
            </article>)}
          </div>
        </section>
      </>}
    </>
  );
}

function Ranking({ title, items }: { title: string; items: Array<{ id: string; name: string; average: number; count: number }> }) {
  return <section className="panel review-ranking"><h2>{title}</h2>{items.length ? items.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.average} ★ · {item.count}</span></div>) : <p>Пока нет данных</p>}</section>;
}
