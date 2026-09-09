import { IsIn } from 'class-validator';

export class UpdateDepositStatusDto {
  @IsIn(['PAID', 'WAIVED'])
  status: 'PAID' | 'WAIVED';
}
