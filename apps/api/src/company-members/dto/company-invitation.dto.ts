import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';
import { Equals, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/legal.constants';

export class CreateCompanyInvitationDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsEnum(CompanyRole)
  role: CompanyRole;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;
}

export class CompanyInvitationResponseDto {
  id: string;
  companyId: string;
  email: string;
  role: CompanyRole;
  employeeId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export class PublicCompanyInvitationDto {
  companyName: string;
  email: string;
  role: CompanyRole;
  expiresAt: Date;
  existingAccount: boolean;
}

export class RegisterCompanyInvitationDto {
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Алексей' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName: string;

  @ApiPropertyOptional({ example: 'Громов' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  legalAccepted: true;

  @ApiProperty({ example: LEGAL_DOCUMENT_VERSION })
  @IsString()
  @Equals(LEGAL_DOCUMENT_VERSION)
  legalVersion: string;
}
