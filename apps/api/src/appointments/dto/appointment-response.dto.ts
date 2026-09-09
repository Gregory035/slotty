import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentSource, AppointmentStatus, DepositStatus } from '@prisma/client';

export class AppointmentCustomerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ nullable: true })
  telegramId: string | null;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional({ nullable: true })
  lastName: string | null;

  @ApiPropertyOptional({ nullable: true })
  username: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;
}

export class AppointmentEmployeeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional({ nullable: true })
  lastName: string | null;
}

export class AppointmentServiceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  durationMinutes: number;
}

export class AppointmentReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  comment: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class AppointmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  companyId: string;

  @ApiProperty({ format: 'date-time' })
  startsAt: Date;

  @ApiProperty({ format: 'date-time' })
  endsAt: Date;

  @ApiProperty({ enum: AppointmentStatus })
  status: AppointmentStatus;

  @ApiProperty({ enum: AppointmentSource })
  source: AppointmentSource;

  @ApiProperty({ example: '3000.00' })
  price: string;

  @ApiProperty({ example: '600.00' })
  depositAmount: string;

  @ApiProperty({ enum: DepositStatus })
  depositStatus: DepositStatus;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  cancellationReason: string | null;

  @ApiProperty({ type: AppointmentCustomerDto })
  customer: AppointmentCustomerDto;

  @ApiProperty({ type: AppointmentEmployeeDto })
  employee: AppointmentEmployeeDto;

  @ApiProperty({ type: AppointmentServiceDto })
  service: AppointmentServiceDto;

  @ApiPropertyOptional({ type: AppointmentReviewDto, nullable: true })
  review: AppointmentReviewDto | null;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
