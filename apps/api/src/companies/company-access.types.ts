import { CompanyRole } from '@prisma/client';

export interface CompanyMembershipContext {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
}
