import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
