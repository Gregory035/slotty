import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class PushPreferenceDto {
  @ApiProperty()
  appointmentCreated: boolean;

  @ApiProperty()
  appointmentRescheduled: boolean;

  @ApiProperty()
  appointmentCancelled: boolean;
}

export class UpdatePushPreferenceDto {
  @IsBoolean()
  appointmentCreated: boolean;

  @IsBoolean()
  appointmentRescheduled: boolean;

  @IsBoolean()
  appointmentCancelled: boolean;
}
