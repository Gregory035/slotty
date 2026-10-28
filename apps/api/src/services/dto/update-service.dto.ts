import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

export class UpdateServiceDto extends PartialType(OmitType(CreateServiceDto, ['bufferAfterMinutes'] as const)) {}
