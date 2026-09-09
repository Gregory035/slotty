import { CompanyRole } from '@prisma/client';
import { CompanyPermission, roleHasPermissions } from './company-permission';

describe('company permission matrix', () => {
  it('allows owners to perform every declared action', () => {
    expect(
      roleHasPermissions(
        CompanyRole.OWNER,
        Object.values(CompanyPermission),
      ),
    ).toBe(true);
  });

  it('does not allow admins to delete companies or view payments', () => {
    expect(
      roleHasPermissions(CompanyRole.ADMIN, [CompanyPermission.COMPANY_DELETE]),
    ).toBe(false);
    expect(
      roleHasPermissions(CompanyRole.ADMIN, [CompanyPermission.PAYMENTS_READ]),
    ).toBe(false);
  });

  it('limits employees to own operational resources', () => {
    expect(
      roleHasPermissions(CompanyRole.EMPLOYEE, [
        CompanyPermission.SCHEDULE_MANAGE,
        CompanyPermission.APPOINTMENTS_STATUS,
      ]),
    ).toBe(true);
    expect(
      roleHasPermissions(CompanyRole.EMPLOYEE, [
        CompanyPermission.SERVICES_MANAGE,
      ]),
    ).toBe(false);
  });
});
