import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';

export class UpdateCompanyDto extends PartialType(OmitType(CreateCompanyDto, ['workingMode'] as const)) {
  @ApiPropertyOptional({ description: 'Публичный адрес компании', example: 'studio-liniya', nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() || null : value)
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, { message: 'Адрес страницы должен содержать 3–64 латинских символа, цифры или дефисы' })
  publicSlug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publicBookingEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 43200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(43200)
  minBookingNoticeMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  maxBookingHorizonDays?: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  slotStepMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10080)
  cancellationNoticeMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowAnyEmployee?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, description: 'Через сколько дней после визита предложить повторную запись' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  rebookingDelayDays?: number;
}
