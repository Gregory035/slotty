import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmployeeServiceSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ example: '2500.00' })
  price: string;

  @ApiProperty()
  bufferBeforeMinutes: number;

  @ApiProperty()
  bufferAfterMinutes: number;
}

export class EmployeeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional({ nullable: true })
  lastName: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  color: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: EmployeeServiceSummaryDto, isArray: true })
  services: EmployeeServiceSummaryDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
