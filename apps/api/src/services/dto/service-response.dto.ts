import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ example: '2500.00', description: 'Decimal string' })
  price: string;

  @ApiPropertyOptional({ nullable: true })
  category: string | null;

  @ApiPropertyOptional({ nullable: true })
  photoUrl: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ minimum: 0, maximum: 100 })
  depositPercent: number;

  @ApiPropertyOptional({ nullable: true, example: '500.00' })
  depositFixedAmount: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
