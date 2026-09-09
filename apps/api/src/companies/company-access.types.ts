import { CompanyRole } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

export interface CompanyMembershipContext {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
  employeeId: string | null;
}

export function assertEmployeeScope(
  membership: CompanyMembershipContext,
  employeeId: string,
): void {
  if (
    membership.role === CompanyRole.EMPLOYEE &&
    membership.employeeId !== employeeId
  ) {
    throw new ForbiddenException('Employee can access only own data');
  }
}
