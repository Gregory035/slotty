import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CompanyMembershipContext } from '../company-access.types';

export const CurrentCompanyMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CompanyMembershipContext => {
    const request = context
      .switchToHttp()
      .getRequest<{ companyMembership: CompanyMembershipContext }>();

    return request.companyMembership;
  },
);
