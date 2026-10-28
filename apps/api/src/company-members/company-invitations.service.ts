import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyRole, LegalAcceptanceSource, LegalDocument, Prisma, User } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService, IssuedSession } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { CompanyMembershipContext } from '../companies/company-access.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyInvitationMailerService } from './company-invitation-mailer.service';
import { CompanyInvitationResponseDto, CreateCompanyInvitationDto, PublicCompanyInvitationDto, RegisterCompanyInvitationDto } from './dto/company-invitation.dto';

@Injectable()
export class CompanyInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: CompanyInvitationMailerService,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
  ) {}

  async list(companyId: string): Promise<CompanyInvitationResponseDto[]> {
    return this.prisma.companyInvitation.findMany({
      where: { companyId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, companyId: true, email: true, role: true, employeeId: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, input: CreateCompanyInvitationDto, actor: CompanyMembershipContext): Promise<CompanyInvitationResponseDto> {
    this.assertCanAssign(actor, input.role);
    await this.assertEmployeeLink(companyId, input.role, input.employeeId);
    this.mailer.assertConfigured();
    const email = input.email.trim().toLowerCase();
    const existingMember = await this.prisma.companyMember.findFirst({ where: { companyId, user: { email } }, select: { id: true } });
    if (existingMember) throw new ConflictException('Пользователь уже состоит в компании');
    const token = randomBytes(32).toString('base64url');
    const ttlHours = this.config.get<number>('COMPANY_INVITATION_TTL_HOURS') ?? 72;
    const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.companyInvitation.updateMany({
        where: { companyId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const created = await tx.companyInvitation.create({
        data: {
          companyId,
          email,
          role: input.role,
          employeeId: input.role === CompanyRole.EMPLOYEE ? input.employeeId : null,
          invitedById: actor.userId,
          tokenHash: this.hash(token),
          expiresAt,
        },
        include: { company: { select: { name: true } } },
      });
      await tx.auditLog.create({ data: {
        companyId,
        actorId: actor.userId,
        action: 'member.invitation_created',
        entityType: 'CompanyInvitation',
        entityId: created.id,
        metadata: { email, role: created.role },
      } });
      return created;
    });
    const invitationUrl = new URL(this.config.getOrThrow<string>('WEB_URL'));
    invitationUrl.pathname = '/app';
    invitationUrl.search = new URLSearchParams({ invite: token }).toString();
    try {
      await this.mailer.send({ email, companyName: invitation.company.name, invitationUrl: invitationUrl.toString(), expiresInHours: ttlHours });
    } catch (error) {
      await this.prisma.companyInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
      throw error;
    }
    return this.response(invitation);
  }

  async revoke(companyId: string, invitationId: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.companyInvitation.updateMany({
        where: { id: invitationId, companyId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!result.count) throw new NotFoundException('Приглашение не найдено');
      await tx.auditLog.create({ data: { companyId, actorId, action: 'member.invitation_revoked', entityType: 'CompanyInvitation', entityId: invitationId } });
    });
  }

  async inspect(token: string): Promise<PublicCompanyInvitationDto> {
    const invitation = await this.requireActive(token);
    const existingAccount = Boolean(await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } }));
    return { companyName: invitation.company.name, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, existingAccount };
  }

  async accept(token: string, userId: string): Promise<{ companyId: string }> {
    const invitation = await this.requireActive(token);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) throw new ForbiddenException('Приглашение выдано для другого email');
    await this.acceptForUser(invitation.id, user);
    return { companyId: invitation.companyId };
  }

  async register(token: string, input: RegisterCompanyInvitationDto): Promise<IssuedSession & { companyId: string }> {
    const invitation = await this.requireActive(token);
    if (await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } })) {
      throw new ConflictException('Аккаунт уже существует. Войдите, чтобы принять приглашение');
    }
    const passwordHash = await this.passwords.hash(input.password);
    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { email: invitation.email, emailVerified: true, passwordHash, firstName: input.firstName.trim(), lastName: input.lastName?.trim() || null } });
        await tx.legalAcceptance.createMany({
          data: [LegalDocument.TERMS, LegalDocument.PRIVACY, LegalDocument.PERSONAL_DATA].map((document) => ({ userId: created.id, document, version: input.legalVersion, source: LegalAcceptanceSource.WEB_REGISTRATION })),
        });
        await this.acceptInTransaction(tx, invitation.id, created.id);
        return created;
      });
    } catch (error) {
      this.rethrowConstraint(error);
      throw error;
    }
    const session = await this.auth.issueSession(user);
    return { ...session, companyId: invitation.companyId };
  }

  private async acceptForUser(invitationId: string, user: User): Promise<void> {
    try {
      await this.prisma.$transaction((tx) => this.acceptInTransaction(tx, invitationId, user.id));
    } catch (error) {
      this.rethrowConstraint(error);
      throw error;
    }
  }

  private async acceptInTransaction(tx: Prisma.TransactionClient, invitationId: string, userId: string): Promise<void> {
    const invitation = await tx.companyInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw new UnauthorizedException('Приглашение недействительно или устарело');
    if (invitation.role === CompanyRole.OWNER) {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${invitation.companyId}::uuid FOR UPDATE`;
      await tx.company.updateMany({ where: { id: invitation.companyId, workingMode: 'SOLO' }, data: { workingMode: 'TEAM' } });
    }
    await tx.companyMember.create({ data: { companyId: invitation.companyId, userId, role: invitation.role, employeeId: invitation.role === CompanyRole.EMPLOYEE ? invitation.employeeId : null } });
    await tx.user.update({ where: { id: userId }, data: { emailVerified: true } });
    const accepted = await tx.companyInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (accepted.count !== 1) throw new UnauthorizedException('Приглашение уже использовано');
    await tx.auditLog.create({ data: { companyId: invitation.companyId, actorId: userId, action: 'member.invitation_accepted', entityType: 'CompanyInvitation', entityId: invitation.id, metadata: { role: invitation.role } } });
  }

  private async requireActive(token: string) {
    const invitation = await this.prisma.companyInvitation.findUnique({ where: { tokenHash: this.hash(token) }, include: { company: { select: { name: true } } } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw new UnauthorizedException('Приглашение недействительно или устарело');
    return invitation;
  }

  private async assertEmployeeLink(companyId: string, role: CompanyRole, employeeId?: string | null): Promise<void> {
    if (role !== CompanyRole.EMPLOYEE) return;
    if (!employeeId) throw new BadRequestException('Для сотрудника нужен профиль в команде');
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null }, select: { id: true } });
    if (!employee) throw new NotFoundException('Сотрудник не найден');
  }

  private assertCanAssign(actor: CompanyMembershipContext, role: CompanyRole): void {
    if (actor.role === CompanyRole.ADMIN && role !== CompanyRole.EMPLOYEE) throw new ForbiddenException('Администратор может приглашать только сотрудников');
  }

  private rethrowConstraint(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Пользователь уже состоит в компании или профиль сотрудника уже занят');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private response(invitation: { id: string; companyId: string; email: string; role: CompanyRole; employeeId: string | null; expiresAt: Date; createdAt: Date }): CompanyInvitationResponseDto {
    return { id: invitation.id, companyId: invitation.companyId, email: invitation.email, role: invitation.role, employeeId: invitation.employeeId, expiresAt: invitation.expiresAt, createdAt: invitation.createdAt };
  }
}
