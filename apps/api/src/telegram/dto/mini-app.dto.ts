import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { BookingFunnelStep } from '@prisma/client';
import { DATE_PATTERN } from '../../scheduling/time-zone.util';

export class MiniAppSessionDto {
  @IsString()
  @MaxLength(4096)
  initData: string;
}

export class MiniAppAvailabilityDto extends MiniAppSessionDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @Matches(DATE_PATTERN)
  date: string;
}

export class MiniAppBookingDto extends MiniAppSessionDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  employeeId: string;

  @Matches(DATE_PATTERN)
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;
}

export class MiniAppVisitItemDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  employeeId: string;

  @Matches(DATE_PATTERN)
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;
}

export class MiniAppVisitBookingDto extends MiniAppSessionDto {
  @IsUUID()
  requestId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MiniAppVisitItemDto)
  items: MiniAppVisitItemDto[];
}

export class MiniAppAppointmentDto extends MiniAppSessionDto {
  @IsUUID()
  appointmentId: string;
}

export class MiniAppRescheduleDto extends MiniAppAppointmentDto {
  @Matches(DATE_PATTERN)
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;
}

export class MiniAppFunnelEventDto extends MiniAppSessionDto {
  @IsEnum(BookingFunnelStep)
  step: BookingFunnelStep;
}
