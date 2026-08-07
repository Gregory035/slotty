import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConnectBotDto {
  @ApiProperty({ description: 'Token issued by @BotFather', writeOnly: true })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token: string;
}
