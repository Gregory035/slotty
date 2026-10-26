import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { CompanyPermission } from '../companies/company-permission';
import { RequirePermissions } from '../companies/decorators/require-permissions.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { BotsService } from './bots.service';
import { BotResponseDto } from './dto/bot-response.dto';
import { ConnectBotDto } from './dto/connect-bot.dto';
import { RateLimits } from '../rate-limit/rate-limit.decorator';

@ApiTags('telegram bots')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/bots')
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Post('connect')
  @RequirePermissions(CompanyPermission.BOT_MANAGE)
  @RateLimits({
    name: 'connect-bot', identity: 'company',
    limitEnv: 'RATE_LIMIT_CONNECT_BOT_MAX', windowEnv: 'RATE_LIMIT_CONNECT_BOT_WINDOW_SECONDS',
    defaultLimit: 5, defaultWindowSeconds: 3600,
  })
  @ApiCreatedResponse({ type: BotResponseDto })
  connect(
    @Param('companyId') companyId: string,
    @Body() input: ConnectBotDto,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<BotResponseDto> {
    return this.bots.connect(companyId, input, user.id);
  }

  @Get()
  @RequirePermissions(CompanyPermission.BOT_READ)
  @ApiOkResponse({ type: BotResponseDto, nullable: true })
  find(@Param('companyId') companyId: string): Promise<BotResponseDto | null> {
    return this.bots.find(companyId);
  }

  @Post(':botId/profile-photo')
  @HttpCode(200)
  @RequirePermissions(CompanyPermission.BOT_MANAGE)
  @RateLimits({ name: 'bot-profile-photo', identity: 'user_company', limitEnv: 'RATE_LIMIT_BOT_PHOTO_MAX', windowEnv: 'RATE_LIMIT_BOT_PHOTO_WINDOW_SECONDS', defaultLimit: 10, defaultWindowSeconds: 3600 })
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @ApiOkResponse({ type: BotResponseDto })
  profilePhoto(
    @Param('companyId') companyId: string,
    @Param('botId', ParseUUIDPipe) botId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<BotResponseDto> {
    return this.bots.setProfilePhoto(companyId, botId, file, user.id);
  }

  @Post(':botId/activate')
  @RequirePermissions(CompanyPermission.BOT_MANAGE)
  @ApiOkResponse({ type: BotResponseDto })
  activate(
    @Param('companyId') companyId: string,
    @Param('botId', ParseUUIDPipe) botId: string,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<BotResponseDto> {
    return this.bots.activate(companyId, botId, user.id);
  }

  @Post(':botId/disable')
  @RequirePermissions(CompanyPermission.BOT_MANAGE)
  @ApiOkResponse({ type: BotResponseDto })
  disable(
    @Param('companyId') companyId: string,
    @Param('botId', ParseUUIDPipe) botId: string,
    @CurrentUser() user: AuthenticatedUserDto,
  ): Promise<BotResponseDto> {
    return this.bots.disable(companyId, botId, user.id);
  }
}

// Avatars are intentionally public, just like a bot profile photo in Telegram.
@Controller('bot-avatars')
export class BotAvatarsController {
  constructor(private readonly bots: BotsService) {}

  @Get(':botId/image')
  async image(
    @Param('botId', ParseUUIDPipe) botId: string,
    @Res() response: { setHeader(name: string, value: string): void; send(body: Buffer): void },
  ): Promise<void> {
    const photo = await this.bots.getProfilePhoto(botId);
    response.setHeader('Content-Type', 'image/jpeg');
    response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(photo);
  }
}
