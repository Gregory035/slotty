import { Prisma } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';

type Ranking = { id: string; name: string; average: number; count: number };

export async function reviewRankings(prisma: PrismaService, companyId: string) {
  const [byEmployee, byService] = await Promise.all([
    prisma.$queryRaw<Ranking[]>(Prisma.sql`
      SELECT e.id, concat_ws(' ', e."firstName", e."lastName") AS name,
        round(avg(r.rating), 1)::float8 AS average, count(*)::int AS count
      FROM "Review" r JOIN "Appointment" a ON a.id = r."appointmentId" AND a."companyId" = r."companyId"
      JOIN "Employee" e ON e.id = a."employeeId" AND e."companyId" = a."companyId"
      WHERE r."companyId" = ${companyId}::uuid
      GROUP BY e.id ORDER BY average DESC, count DESC, e.id
    `),
    prisma.$queryRaw<Ranking[]>(Prisma.sql`
      SELECT s.id, s.name, round(avg(r.rating), 1)::float8 AS average, count(*)::int AS count
      FROM "Review" r JOIN "Appointment" a ON a.id = r."appointmentId" AND a."companyId" = r."companyId"
      JOIN "Service" s ON s.id = a."serviceId" AND s."companyId" = a."companyId"
      WHERE r."companyId" = ${companyId}::uuid
      GROUP BY s.id ORDER BY average DESC, count DESC, s.id
    `),
  ]);
  return { byEmployee, byService };
}
