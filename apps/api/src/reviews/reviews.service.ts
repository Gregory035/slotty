import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(companyId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { companyId },
      include: {
        customer: true,
        appointment: { include: { employee: true, service: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    const employeeGroups = new Map<string, { id: string; name: string; total: number; count: number }>();
    const serviceGroups = new Map<string, { id: string; name: string; total: number; count: number }>();
    for (const review of reviews) {
      const employee = review.appointment.employee;
      const employeeName = [employee.firstName, employee.lastName].filter(Boolean).join(' ');
      const employeeGroup = employeeGroups.get(employee.id) ?? { id: employee.id, name: employeeName, total: 0, count: 0 };
      employeeGroup.total += review.rating;
      employeeGroup.count += 1;
      employeeGroups.set(employee.id, employeeGroup);
      const service = review.appointment.service;
      const serviceGroup = serviceGroups.get(service.id) ?? { id: service.id, name: service.name, total: 0, count: 0 };
      serviceGroup.total += review.rating;
      serviceGroup.count += 1;
      serviceGroups.set(service.id, serviceGroup);
    }
    const rank = (groups: Map<string, { id: string; name: string; total: number; count: number }>) =>
      [...groups.values()]
        .map(({ total, ...item }) => ({ ...item, average: Number((total / item.count).toFixed(1)) }))
        .sort((left, right) => right.average - left.average || right.count - left.count);
    const average = reviews.length
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
      : 0;
    return {
      summary: { average, count: reviews.length },
      byEmployee: rank(employeeGroups),
      byService: rank(serviceGroups),
      items: reviews.map((review) => ({
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
