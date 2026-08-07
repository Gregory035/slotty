import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TIME_PATTERN } from '../time-zone.util';

export class WeeklyScheduleRuleDto {
  @ApiProperty({ example: 1, description: 'ISO weekday: Monday=1, Sunday=7' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday: number;

  @ApiProperty({ example: '09:00' })
  @Matches(TIME_PATTERN)
  startTime: string;

  @ApiProperty({ example: '18:00' })
  @Matches(TIME_PATTERN)
  endTime: string;
}

export class ReplaceScheduleDto {
  @ApiProperty({ type: WeeklyScheduleRuleDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(35)
  @ValidateNested({ each: true })
  @Type(() => WeeklyScheduleRuleDto)
  rules: WeeklyScheduleRuleDto[];
}

export class ScheduleRuleResponseDto extends WeeklyScheduleRuleDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ format: 'uuid' })
  employeeId: string;
}
