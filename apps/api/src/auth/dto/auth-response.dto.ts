import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthenticatedUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional()
  lastName: string | null;

  @ApiProperty()
  emailVerified: boolean;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;

  @ApiProperty({ type: AuthenticatedUserDto })
  user: AuthenticatedUserDto;
}
