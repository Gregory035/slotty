import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { ManualCustomerDto } from './create-appointment.dto';

export class VisitServiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt: string;
}

export class VisitRecurrenceDto {
  @ApiProperty({ minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  intervalDays: number;

  @ApiProperty({ minimum: 2, maximum: 12 })
  @IsInt()
  @Min(2)
  @Max(12)
  count: number;
}

export class CreateVisitDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((input: CreateVisitDto) => !input.customer)
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ type: ManualCustomerDto })
  @ValidateIf((input: CreateVisitDto) => !input.customerId)
  @ValidateNested()
  @Type(() => ManualCustomerDto)
  customer?: ManualCustomerDto;

  @ApiProperty({ type: VisitServiceDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => VisitServiceDto)
  items: VisitServiceDto[];

  @ApiPropertyOptional({ type: VisitRecurrenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisitRecurrenceDto)
  recurrence?: VisitRecurrenceDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
