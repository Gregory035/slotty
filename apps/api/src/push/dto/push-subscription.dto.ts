import { IsString, IsUrl, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysDto {
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  p256dh: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  auth: string;
}

export class SavePushSubscriptionDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  endpoint: string;
}
