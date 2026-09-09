import { Injectable } from '@nestjs/common';
import { CompanyRole, Prisma } from '@prisma/client';
import { CursorPage, decodeCursor, pageFromRows } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';

interface AuditQuery {
  limit: number;
  cursor?: string;
  action?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    query: AuditQuery,
    role: CompanyRole,
  ): Promise<CursorPage<unknown>> {
    const cursor = decodeCursor(query.cursor);
    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (cursor) {
      conditions.push({
        OR: [
          { createdAt: { lt: new Date(cursor.date) } },
          { createdAt: new Date(cursor.date), id: { lt: cursor.id } },
        ],
      });
    }
    const rows = await this.prisma.auditLog.findMany({
      where: {
        companyId,
        ...(role === CompanyRole.ADMIN
          ? {
              NOT: [
                { action: { startsWith: 'auth.' } },
                { action: { startsWith: 'billing.' } },
                { action: { startsWith: 'member.' } },
                { action: { startsWith: 'company.deleted' } },
              ],
            }
          : {}),
        ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(conditions.length ? { AND: conditions } : {}),
      },
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    return pageFromRows(rows, query.limit, (row) => ({
      date: row.createdAt.toISOString(),
      id: row.id,
    }));
  }
}
