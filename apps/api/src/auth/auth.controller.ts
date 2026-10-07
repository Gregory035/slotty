import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  AuthCookieService,
  CookieResponse,
} from './auth-cookie.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, AuthenticatedUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RateLimits } from '../rate-limit/rate-limit.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('register')
  @RateLimits({
    name: 'register', identity: 'ip',
    limitEnv: 'RATE_LIMIT_REGISTER_MAX', windowEnv: 'RATE_LIMIT_REGISTER_WINDOW_SECONDS',
    defaultLimit: 3, defaultWindowSeconds: 3600,
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email is already registered' })
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.register(input);
    this.cookies.set(response, session.refreshToken);
    return session.response;
  }

  @Post('login')
  @RateLimits(
    {
      name: 'login-ip', identity: 'ip',
      limitEnv: 'RATE_LIMIT_LOGIN_MAX', windowEnv: 'RATE_LIMIT_LOGIN_WINDOW_SECONDS',
      defaultLimit: 5, defaultWindowSeconds: 60,
    },
    {
      name: 'login-email', identity: 'email',
      limitEnv: 'RATE_LIMIT_LOGIN_MAX', windowEnv: 'RATE_LIMIT_LOGIN_WINDOW_SECONDS',
      defaultLimit: 5, defaultWindowSeconds: 60,
    },
  )
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.login(input);
    this.cookies.set(response, session.refreshToken);
    return session.response;
  }

  @Post('password-reset/request')
  @RateLimits(
    { name: 'password-reset-ip', identity: 'ip', limitEnv: 'RATE_LIMIT_PASSWORD_RESET_MAX', windowEnv: 'RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS', defaultLimit: 3, defaultWindowSeconds: 3600 },
    { name: 'password-reset-email', identity: 'email', limitEnv: 'RATE_LIMIT_PASSWORD_RESET_MAX', windowEnv: 'RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS', defaultLimit: 3, defaultWindowSeconds: 3600 },
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'A recovery email is sent if the account exists' })
  async requestPasswordReset(@Body() input: RequestPasswordResetDto): Promise<void> {
    await this.auth.requestPasswordReset(input);
  }

  @Post('password-reset/confirm')
  @RateLimits({ name: 'password-reset-confirm', identity: 'ip', limitEnv: 'RATE_LIMIT_PASSWORD_RESET_MAX', windowEnv: 'RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS', defaultLimit: 3, defaultWindowSeconds: 3600 })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ description: 'Reset token is invalid or expired' })
  async resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(input);
  }

  @Post('refresh')
  @RateLimits({
    name: 'refresh', identity: 'session',
    limitEnv: 'RATE_LIMIT_REFRESH_MAX', windowEnv: 'RATE_LIMIT_REFRESH_WINDOW_SECONDS',
    defaultLimit: 20, defaultWindowSeconds: 60,
  })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid or expired' })
  async refresh(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthResponseDto> {
    this.cookies.assertTrustedOrigin(headers);
    const session = await this.auth.refresh(
      this.cookies.read(this.first(headers.cookie)) ?? '',
    );
    this.cookies.set(response, session.refreshToken);
    return session.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    this.cookies.assertTrustedOrigin(headers);
    const refreshToken = this.cookies.read(this.first(headers.cookie));
    if (refreshToken) await this.auth.logout(refreshToken);
    this.cookies.clear(response);
  }

  @Post('sessions/revoke-all')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentUser() user: AuthenticatedUserDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    this.cookies.assertTrustedOrigin(headers);
    await this.auth.logoutAll(user.id);
    this.cookies.clear(response);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthenticatedUserDto })
  @ApiUnauthorizedResponse({ description: 'Access token is invalid or expired' })
  me(@CurrentUser() user: AuthenticatedUserDto): AuthenticatedUserDto {
    return user;
  }

  private first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
