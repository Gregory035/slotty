import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/legal.constants';

export class RegisterDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

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
