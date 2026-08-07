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
import { CompanyRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CompanyRoles } from '../companies/decorators/company-roles.decorator';
import { CompanyAccessGuard } from '../companies/guards/company-access.guard';
import { BotsService } from './bots.service';
import { BotResponseDto } from './dto/bot-response.dto';
import { ConnectBotDto } from './dto/connect-bot.dto';

@ApiTags('telegram bots')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, CompanyAccessGuard)
@Controller('companies/:companyId/bots')
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Post('connect')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiCreatedResponse({ type: BotResponseDto })
  connect(
    @Param('companyId') companyId: string,
    @Body() input: ConnectBotDto,
  ): Promise<BotResponseDto> {
    return this.bots.connect(companyId, input);
  }

  @Get()
  @ApiOkResponse({ type: BotResponseDto, nullable: true })
  find(@Param('companyId') companyId: string): Promise<BotResponseDto | null> {
    return this.bots.find(companyId);
  }

  @Post(':botId/activate')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: BotResponseDto })
  activate(
    @Param('companyId') companyId: string,
    @Param('botId', ParseUUIDPipe) botId: string,
  ): Promise<BotResponseDto> {
    return this.bots.activate(companyId, botId);
  }

  @Post(':botId/disable')
  @CompanyRoles(CompanyRole.OWNER, CompanyRole.ADMIN)
  @ApiOkResponse({ type: BotResponseDto })
  disable(
    @Param('companyId') companyId: string,
    @Param('botId', ParseUUIDPipe) botId: string,
  ): Promise<BotResponseDto> {
    return this.bots.disable(companyId, botId);
  }
}
