import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { createHash } from 'node:crypto';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResponseDto> {
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

    return this.issueSession(user);
  }

  async login(input: LoginDto): Promise<AuthResponseDto> {
    const user = await this.users.findByEmail(this.normalizeEmail(input.email));
    const passwordIsValid = await this.passwords.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    if (!this.tokens.verifyRefreshToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const nextRefreshToken = this.tokens.createRefreshToken();
    const nextTokenHash = this.hashRefreshToken(nextRefreshToken);
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Refresh token has already been used');
      }

      await transaction.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: nextTokenHash,
          expiresAt: nextExpiresAt,
        },
      });
    });

    return this.buildResponse(storedToken.user, nextRefreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    if (!this.tokens.verifyRefreshToken(refreshToken)) {
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(user: User): Promise<AuthResponseDto> {
    const refreshToken = this.tokens.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return this.buildResponse(user, refreshToken);
  }

  private buildResponse(user: User, refreshToken: string): AuthResponseDto {
    return {
      accessToken: this.tokens.signAccessToken(user),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthenticatedUser(user),
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
}
