import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { decodeCursor, pageFromRows } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';

class NotificationQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

@Controller('companies/:companyId/notifications')
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(CompanyPermission.NOTIFICATIONS_READ)
  async findAll(@Param('companyId') companyId: string, @Query() query: NotificationQueryDto) {
    const cursor = decodeCursor(query.cursor);
    const conditions: Prisma.NotificationWhereInput[] = cursor
      ? [{ OR: [
          { createdAt: { lt: new Date(cursor.date) } },
          { createdAt: new Date(cursor.date), id: { lt: cursor.id } },
        ] }]
      : [];
    const rows = await this.prisma.notification.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(conditions.length ? { AND: conditions } : {}),
      },
      include: { customer: true, appointment: { include: { service: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const safeRows = rows.map((row) => ({
      ...row,
      customer: { ...row.customer, telegramId: row.customer.telegramId?.toString() ?? null },
    }));
    return pageFromRows(safeRows, query.limit, (row) => ({ date: row.createdAt.toISOString(), id: row.id }));
  }
}
