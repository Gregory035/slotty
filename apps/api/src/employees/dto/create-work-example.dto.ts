import { Equals, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { LEGAL_DOCUMENT_VERSION } from '../../legal/legal.constants';

export class CreateWorkExampleDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsBoolean()
  @Equals(true)
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  publicationConsentConfirmed: true;

  @IsString()
  @Equals(LEGAL_DOCUMENT_VERSION)
  consentVersion: string;
}
