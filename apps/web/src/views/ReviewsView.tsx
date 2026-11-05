import { useInfiniteQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { getReviews } from '../api';
import { EmptyState, ErrorBlock, LoadingBlock, SectionHeader } from '../components/ui';
import type { Company } from '../types';
import { customerDisplayName } from '../utils';

export function ReviewsView({ company }: { company: Company }) {
  const reviews = useInfiniteQuery({
    queryKey: ['reviews', company.id], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getReviews(company.id, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (reviews.isLoading) return <LoadingBlock />;
  if (!reviews.data && reviews.error) return <ErrorBlock message="Не удалось загрузить отзывы" />;
  const data = reviews.data!.pages[0]!;
  const items = reviews.data!.pages.flatMap((page) => page.items);
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
            {items.map((review) => <article className="panel review-card" key={review.id}>
              <div className="review-card-head"><strong>{customerDisplayName(review.customer)}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
              {review.comment && <p>{review.comment}</p>}
              <small>{review.service.name} · {review.employee.name} · {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</small>
            </article>)}
          </div>
          {reviews.isFetchNextPageError && <p role="alert">Не удалось загрузить следующую страницу. Попробуйте ещё раз.</p>}
          {reviews.hasNextPage && <button type="button" className="secondary-button" disabled={reviews.isFetchingNextPage} onClick={() => void reviews.fetchNextPage()}>{reviews.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}</button>}
        </section>
      </>}
    </>
  );
}

function Ranking({ title, items }: { title: string; items: Array<{ id: string; name: string; average: number; count: number }> }) {
  return <section className="panel review-ranking"><h2>{title}</h2>{items.length ? items.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.average} ★ · {item.count}</span></div>) : <p>Пока нет данных</p>}</section>;
}
