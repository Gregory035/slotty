import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyRole } from '@prisma/client';

export class CompanyMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ enum: CompanyRole })
  role: CompanyRole;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiPropertyOptional({ nullable: true })
  lastName: string | null;

  @ApiProperty()
  createdAt: Date;
}
