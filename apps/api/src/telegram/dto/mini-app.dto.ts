import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { DATE_PATTERN } from '../../scheduling/time-zone.util';

export class MiniAppSessionDto {
  @IsString()
  @MaxLength(4096)
  initData: string;
}

export class MiniAppAvailabilityDto extends MiniAppSessionDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  employeeId: string;

  @Matches(DATE_PATTERN)
  date: string;
}

export class MiniAppBookingDto extends MiniAppAvailabilityDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;
}
