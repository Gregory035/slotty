import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BotStatus } from '@prisma/client';

export class BotResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ example: '123456789' })
  telegramBotId: string;

  @ApiProperty({ example: 'my_booking_bot' })
  username: string;

  @ApiProperty({ enum: BotStatus })
  status: BotStatus;

  @ApiProperty()
  webhookConfigured: boolean;

  @ApiPropertyOptional({ nullable: true })
  errorMessage: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
