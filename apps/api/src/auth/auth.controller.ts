import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthResponseDto, AuthenticatedUserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body() input: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() input: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(input);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid or expired' })
  refresh(@Body() input: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.auth.refresh(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(@Body() input: RefreshTokenDto): Promise<void> {
    await this.auth.logout(input.refreshToken);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthenticatedUserDto })
  @ApiUnauthorizedResponse({ description: 'Access token is invalid or expired' })
  me(@CurrentUser() user: AuthenticatedUserDto): AuthenticatedUserDto {
    return user;
  }
}
