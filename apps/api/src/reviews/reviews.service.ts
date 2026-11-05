import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { decodeCursor, pageFromRows } from '../common/pagination';
import { reviewRankings } from './review-rankings';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(companyId: string, cursor?: string) {
    const after = decodeCursor(cursor);
    const limit = 25;
    const [summary, rankings] = await Promise.all([
      this.prisma.review.aggregate({ where: { companyId }, _avg: { rating: true }, _count: true }),
      reviewRankings(this.prisma, companyId),
    ]);
    const reviews = await this.prisma.review.findMany({
      where: { companyId, ...(after ? { OR: [
        { createdAt: { lt: new Date(after.date) } },
        { createdAt: new Date(after.date), id: { lt: after.id } },
      ] } : {}) },
      include: {
        customer: true,
        appointment: { include: { employee: true, service: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = pageFromRows(reviews, limit, (review) => ({ date: review.createdAt.toISOString(), id: review.id }));
    return {
      summary: { average: Number((summary._avg.rating ?? 0).toFixed(1)), count: summary._count },
      byEmployee: rankings.byEmployee,
      byService: rankings.byService,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      items: page.items.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        appointmentId: review.appointmentId,
        customer: {
          id: review.customer.id,
          firstName: review.customer.firstName,
          lastName: review.customer.lastName,
          username: review.customer.username,
        },
        employee: {
          id: review.appointment.employee.id,
          name: [review.appointment.employee.firstName, review.appointment.employee.lastName].filter(Boolean).join(' '),
        },
        service: { id: review.appointment.service.id, name: review.appointment.service.name },
      })),
    };
  }
}
