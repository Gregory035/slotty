import { IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
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

  // Standard browser toJSON() field; tolerate existing clients without storing it.
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  expirationTime?: number | null;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  endpoint: string;
}
