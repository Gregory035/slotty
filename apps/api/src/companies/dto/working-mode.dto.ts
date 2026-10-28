import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkingMode } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class WorkingModeDto {
  @ApiProperty({ enum: WorkingMode })
  @IsEnum(WorkingMode)
  workingMode: WorkingMode;

  @ApiPropertyOptional({ description: 'Existing profile belonging to the owner', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
