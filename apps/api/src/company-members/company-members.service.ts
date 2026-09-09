import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyRole, Prisma } from '@prisma/client';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { CursorPage, decodeCursor, pageFromRows } from '../common/pagination';
import { PrismaService } from '../database/prisma.service';
import { CompanyMemberResponseDto } from './dto/company-member-response.dto';
import {
  AddCompanyMemberDto,
  UpdateCompanyMemberDto,
} from './dto/manage-company-member.dto';

@Injectable()
export class CompanyMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId: string,
    limit = 25,
    cursorValue?: string,
  ): Promise<CursorPage<CompanyMemberResponseDto>> {
    const cursor = decodeCursor(cursorValue);
    const members = await this.prisma.companyMember.findMany({
      where: {
        companyId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: new Date(cursor.date) } },
                { createdAt: new Date(cursor.date), id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const mapped = members.map(({ user, ...member }) => ({
      id: member.id,
      companyId: member.companyId,
      userId: member.userId,
      employeeId: member.employeeId,
      role: member.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: member.createdAt,
    }));
    return pageFromRows(mapped, limit, (member) => ({
      date: member.createdAt.toISOString(),
      id: member.id,
    }));
  }

  async add(
    companyId: string,
    input: AddCompanyMemberDto,
    actor: CompanyMembershipContext,
  ): Promise<CompanyMemberResponseDto> {
    this.assertCanAssign(actor, input.role);
    await this.assertEmployeeLink(companyId, input.role, input.employeeId);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user) throw new NotFoundException('User with this email not found');
    try {
      const member = await this.prisma.$transaction(async (tx) => {
        const created = await tx.companyMember.create({
          data: {
            companyId,
            userId: user.id,
            role: input.role,
            employeeId:
              input.role === CompanyRole.EMPLOYEE ? input.employeeId : null,
          },
          include: { user: true },
        });
        await tx.auditLog.create({
          data: {
            companyId,
            actorId: actor.userId,
            action: 'member.created',
            entityType: 'CompanyMember',
            entityId: created.id,
            metadata: { role: created.role },
          },
        });
        return created;
      });
      return this.toResponse(member);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a company member');
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    memberId: string,
    input: UpdateCompanyMemberDto,
    actor: CompanyMembershipContext,
  ): Promise<CompanyMemberResponseDto> {
    const current = await this.requireMember(companyId, memberId);
    this.assertCanManage(actor, current.role);
    const role = input.role ?? current.role;
    this.assertCanAssign(actor, role);
    await this.assertEmployeeLink(
      companyId,
      role,
      input.employeeId === undefined ? current.employeeId : input.employeeId,
    );
    if (current.role === CompanyRole.OWNER && role !== CompanyRole.OWNER) {
      await this.assertAnotherOwner(companyId, memberId);
    }
    const member = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.companyMember.update({
        where: { id_companyId: { id: memberId, companyId } },
        data: {
          role,
          employeeId:
            role === CompanyRole.EMPLOYEE
              ? input.employeeId === undefined
                ? current.employeeId
                : input.employeeId
              : null,
        },
        include: { user: true },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actorId: actor.userId,
          action: 'member.updated',
          entityType: 'CompanyMember',
          entityId: memberId,
          metadata: { fromRole: current.role, toRole: changed.role },
        },
      });
      return changed;
    });
    return this.toResponse(member);
  }

  async remove(
    companyId: string,
    memberId: string,
    actor: CompanyMembershipContext,
  ): Promise<void> {
    const current = await this.requireMember(companyId, memberId);
    this.assertCanManage(actor, current.role);
    if (current.role === CompanyRole.OWNER) {
      await this.assertAnotherOwner(companyId, memberId);
    }
    await this.prisma.$transaction([
      this.prisma.companyMember.delete({
        where: { id_companyId: { id: memberId, companyId } },
      }),
      this.prisma.auditLog.create({
        data: {
          companyId,
          actorId: actor.userId,
          action: 'member.deleted',
          entityType: 'CompanyMember',
          entityId: memberId,
          metadata: { role: current.role },
        },
      }),
    ]);
  }

  private async requireMember(companyId: string, memberId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, companyId },
      include: { user: true },
    });
    if (!member) throw new NotFoundException('Company member not found');
    return member;
  }

  private async assertAnotherOwner(companyId: string, excludingId: string) {
    const another = await this.prisma.companyMember.findFirst({
      where: {
        companyId,
        role: CompanyRole.OWNER,
        id: { not: excludingId },
      },
      select: { id: true },
    });
    if (!another) throw new BadRequestException('Company must keep at least one owner');
  }

  private assertCanManage(actor: CompanyMembershipContext, target: CompanyRole) {
    if (actor.role === CompanyRole.ADMIN && target !== CompanyRole.EMPLOYEE) {
      throw new ForbiddenException('Administrator can manage employees only');
    }
  }

  private assertCanAssign(actor: CompanyMembershipContext, role: CompanyRole) {
    if (actor.role === CompanyRole.ADMIN && role !== CompanyRole.EMPLOYEE) {
      throw new ForbiddenException('Administrator can assign employee role only');
    }
  }

  private async assertEmployeeLink(
    companyId: string,
    role: CompanyRole,
    employeeId?: string | null,
  ) {
    if (role !== CompanyRole.EMPLOYEE) return;
    if (!employeeId) {
      throw new BadRequestException('Employee role requires an employee profile');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  private toResponse(member: Prisma.CompanyMemberGetPayload<{ include: { user: true } }>): CompanyMemberResponseDto {
    return {
      id: member.id,
      companyId: member.companyId,
      userId: member.userId,
      employeeId: member.employeeId,
      role: member.role,
      email: member.user.email,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      createdAt: member.createdAt,
    };
  }
}
