import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { BookingFunnelStep } from '@prisma/client';
import { DATE_PATTERN } from '../../scheduling/time-zone.util';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/legal.constants';

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
  @IsBoolean()
  @Equals(true)
  legalAccepted: true;

  @IsString()
  @Equals(LEGAL_DOCUMENT_VERSION)
  legalVersion: string;

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
  @IsBoolean()
  @Equals(true)
  legalAccepted: true;

  @IsString()
  @Equals(LEGAL_DOCUMENT_VERSION)
  legalVersion: string;

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

export class MiniAppReviewDto extends MiniAppAppointmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class MiniAppWorkPhotoDto extends MiniAppAppointmentDto {
  @IsBoolean()
  @Equals(true)
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  publicationConsentConfirmed: true;

  @IsString()
  @Equals(LEGAL_DOCUMENT_VERSION)
  consentVersion: string;
}

export class MiniAppFunnelEventDto extends MiniAppSessionDto {
  @IsEnum(BookingFunnelStep)
  step: BookingFunnelStep;
}
