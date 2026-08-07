import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
