import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { DATE_PATTERN } from '../time-zone.util';

export class AvailabilityQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ example: '2026-08-10' })
  @Matches(DATE_PATTERN)
  date: string;

  @ApiPropertyOptional({ default: 15, minimum: 5, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  stepMinutes?: number;
}

export class AvailabilitySlotDto {
  @ApiProperty({ format: 'date-time' })
  startsAt: string;

  @ApiProperty({ format: 'date-time' })
  endsAt: string;
}

export class AvailabilityResponseDto {
  @ApiProperty({ example: '2026-08-10' })
  date: string;

  @ApiProperty({ example: 'Europe/Moscow' })
  timezone: string;

  @ApiProperty({ format: 'uuid' })
  employeeId: string;

  @ApiProperty({ format: 'uuid' })
  serviceId: string;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ type: AvailabilitySlotDto, isArray: true })
  slots: AvailabilitySlotDto[];
}
