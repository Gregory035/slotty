import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanyRole,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';

export class CompanyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  language: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl: string | null;

  @ApiProperty()
  minBookingNoticeMinutes: number;

  @ApiProperty()
  maxBookingHorizonDays: number;

  @ApiProperty()
  slotStepMinutes: number;

  @ApiProperty()
  cancellationNoticeMinutes: number;

  @ApiProperty()
  allowAnyEmployee: boolean;

  @ApiProperty()
  rebookingDelayDays: number;

  @ApiProperty({ enum: CompanyRole })
  role: CompanyRole;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  employeeId: string | null;

  @ApiPropertyOptional({ enum: SubscriptionPlan, nullable: true })
  subscriptionPlan: SubscriptionPlan | null;

  @ApiPropertyOptional({ enum: SubscriptionStatus, nullable: true })
  subscriptionStatus: SubscriptionStatus | null;

  @ApiPropertyOptional({ nullable: true })
  trialEndsAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
