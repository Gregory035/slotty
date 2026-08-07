import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CompanyMemberResponseDto } from './dto/company-member-response.dto';

@Injectable()
export class CompanyMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string): Promise<CompanyMemberResponseDto[]> {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map(({ user, ...member }) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: member.createdAt,
    }));
  }
}
