import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ScheduleExceptionType } from '@prisma/client';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { DATE_PATTERN, TIME_PATTERN } from '../time-zone.util';

export class CreateScheduleExceptionDto {
  @ApiProperty({ example: '2026-08-10' })
  @Matches(DATE_PATTERN)
  date: string;

  @ApiProperty({ enum: ScheduleExceptionType })
  @IsEnum(ScheduleExceptionType)
  type: ScheduleExceptionType;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({ example: '16:00' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  endTime?: string;
}

export class UpdateScheduleExceptionDto extends PartialType(
  CreateScheduleExceptionDto,
) {}

export class ScheduleExceptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ format: 'uuid' })
  employeeId: string;

  @ApiProperty({ example: '2026-08-10' })
  date: string;

  @ApiProperty({ enum: ScheduleExceptionType })
  type: ScheduleExceptionType;

  @ApiPropertyOptional({ nullable: true })
  startTime: string | null;

  @ApiPropertyOptional({ nullable: true })
  endTime: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ScheduleExceptionListQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @Matches(DATE_PATTERN)
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @Matches(DATE_PATTERN)
  to?: string;
}
