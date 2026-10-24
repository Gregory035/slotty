import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUserDto } from '../auth/dto/auth-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { DeletePushSubscriptionDto, SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { PushService } from './push.service';
import { PushPreferenceDto, UpdatePushPreferenceDto } from './dto/push-preference.dto';

@UseGuards(AccessTokenGuard)
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('config')
  config(): { enabled: boolean; publicKey: string | null } {
    return this.push.config();
  }

  @Post('subscriptions')
  @HttpCode(204)
  async save(
    @CurrentUser() user: AuthenticatedUserDto,
    @Body() input: SavePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.push.save(user.id, input, userAgent);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUserDto,
    @Body() input: DeletePushSubscriptionDto,
  ): Promise<void> {
    await this.push.remove(user.id, input.endpoint);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthenticatedUserDto): Promise<PushPreferenceDto> {
    return this.push.preferences(user.id);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUserDto,
    @Body() input: UpdatePushPreferenceDto,
  ): Promise<PushPreferenceDto> {
    return this.push.updatePreferences(user.id, input);
  }

  @Post('test')
  @HttpCode(204)
  async test(@CurrentUser() user: AuthenticatedUserDto): Promise<void> {
    const delivered = await this.push.sendTest(user.id);
    if (!delivered) throw new BadRequestException('Сначала включите уведомления на этом устройстве');
  }
}
