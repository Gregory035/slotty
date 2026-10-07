import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkExampleDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
