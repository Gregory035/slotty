import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto, AuthenticatedUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { ACCESS_TOKEN_TTL_SECONDS, TokenService } from './token.service';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA$HfrUe6rycPIFqZxD1xFJMVljivEdVIZMerV_HA9C872vjdI7RLkcNW0_KQMjnXWGBrn700GxeayOUzv7lOsLPw';

export interface IssuedSession {
  response: AuthResponseDto;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterDto): Promise<IssuedSession> {
    const email = this.normalizeEmail(input.email);
    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwords.hash(input.password);
    let user: User;
    try {
      user = await this.users.create({
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        ...(input.lastName ? { lastName: input.lastName.trim() } : {}),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }

    const session = await this.issueSession(user);
    await this.auditUserCompanies(user.id, 'auth.register');
    return session;
  }

  async login(input: LoginDto): Promise<IssuedSession> {
    const user = await this.users.findByEmail(this.normalizeEmail(input.email));
    const passwordIsValid = await this.passwords.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = await this.issueSession(user);
    await this.auditUserCompanies(user.id, 'auth.login');
    return session;
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    if (!this.tokens.verifyRefreshToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (storedToken.revokedAt) {
      const detectedAt = new Date();
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId },
        data: { revokedAt: detectedAt, reuseDetectedAt: detectedAt },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const nextRefreshToken = this.tokens.createRefreshToken();
    const nextTokenHash = this.hashRefreshToken(nextRefreshToken);
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const rotated = await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date(), rotatedAt: new Date() },
      });
      if (revoked.count !== 1) return false;
      await transaction.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: nextTokenHash,
          familyId: storedToken.familyId,
          expiresAt: nextExpiresAt,
        },
      });
      return true;
    });
    if (!rotated) {
      const detectedAt = new Date();
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId },
        data: { revokedAt: detectedAt, reuseDetectedAt: detectedAt },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    return this.buildResponse(storedToken.user, nextRefreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    if (!this.tokens.verifyRefreshToken(refreshToken)) {
      return;
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(refreshToken) },
      select: { userId: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (stored) await this.auditUserCompanies(stored.userId, 'auth.logout');
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditUserCompanies(userId, 'auth.logout_all');
  }

  private async issueSession(user: User): Promise<IssuedSession> {
    const refreshToken = this.tokens.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return this.buildResponse(user, refreshToken);
  }

  private buildResponse(user: User, refreshToken: string): IssuedSession {
    return {
      refreshToken,
      response: {
        accessToken: this.tokens.signAccessToken(user),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: this.toAuthenticatedUser(user),
      },
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async auditUserCompanies(userId: string, action: string): Promise<void> {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId },
      select: { companyId: true },
    });
    if (!memberships.length) return;
    await this.prisma.auditLog.createMany({
      data: memberships.map(({ companyId }) => ({
        companyId,
        actorId: userId,
        action,
        entityType: 'Session',
      })),
    });
  }
}
