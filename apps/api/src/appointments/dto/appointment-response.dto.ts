import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentSource, AppointmentStatus } from '@prisma/client';

export class AppointmentCustomerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  telegramId: string;

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

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
