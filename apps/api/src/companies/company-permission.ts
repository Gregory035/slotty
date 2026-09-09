import { CompanyRole } from '@prisma/client';

export enum CompanyPermission {
  COMPANY_READ = 'company:read',
  COMPANY_UPDATE = 'company:update',
  COMPANY_DELETE = 'company:delete',
  MEMBERS_READ = 'members:read',
  MEMBERS_MANAGE = 'members:manage',
  SERVICES_READ = 'services:read',
  SERVICES_MANAGE = 'services:manage',
  EMPLOYEES_READ = 'employees:read',
  EMPLOYEES_MANAGE = 'employees:manage',
  SCHEDULE_READ = 'schedule:read',
  SCHEDULE_MANAGE = 'schedule:manage',
  APPOINTMENTS_READ = 'appointments:read',
  APPOINTMENTS_CREATE = 'appointments:create',
  APPOINTMENTS_STATUS = 'appointments:status',
  APPOINTMENT_HISTORY_READ = 'appointments:history:read',
  CUSTOMERS_READ = 'customers:read',
  CUSTOMERS_MANAGE = 'customers:manage',
  BOT_READ = 'bot:read',
  BOT_MANAGE = 'bot:manage',
  DASHBOARD_READ = 'dashboard:read',
  PAYMENTS_READ = 'payments:read',
  BILLING_MANAGE = 'billing:manage',
  AUDIT_READ = 'audit:read',
  NOTIFICATIONS_READ = 'notifications:read',
}

const ownerPermissions = Object.values(CompanyPermission);

export const ROLE_PERMISSIONS: Record<CompanyRole, ReadonlySet<CompanyPermission>> = {
  [CompanyRole.OWNER]: new Set(ownerPermissions),
  [CompanyRole.ADMIN]: new Set([
    CompanyPermission.COMPANY_READ,
    CompanyPermission.COMPANY_UPDATE,
    CompanyPermission.MEMBERS_READ,
    CompanyPermission.MEMBERS_MANAGE,
    CompanyPermission.SERVICES_READ,
    CompanyPermission.SERVICES_MANAGE,
    CompanyPermission.EMPLOYEES_READ,
    CompanyPermission.EMPLOYEES_MANAGE,
    CompanyPermission.SCHEDULE_READ,
    CompanyPermission.SCHEDULE_MANAGE,
    CompanyPermission.APPOINTMENTS_READ,
    CompanyPermission.APPOINTMENTS_CREATE,
    CompanyPermission.APPOINTMENTS_STATUS,
    CompanyPermission.CUSTOMERS_READ,
    CompanyPermission.CUSTOMERS_MANAGE,
    CompanyPermission.BOT_READ,
    CompanyPermission.BOT_MANAGE,
    CompanyPermission.DASHBOARD_READ,
    CompanyPermission.AUDIT_READ,
    CompanyPermission.NOTIFICATIONS_READ,
  ]),
  [CompanyRole.EMPLOYEE]: new Set([
    CompanyPermission.COMPANY_READ,
    CompanyPermission.SERVICES_READ,
    CompanyPermission.SCHEDULE_READ,
    CompanyPermission.SCHEDULE_MANAGE,
    CompanyPermission.APPOINTMENTS_READ,
    CompanyPermission.APPOINTMENTS_STATUS,
  ]),
};

export function roleHasPermissions(
  role: CompanyRole,
  permissions: readonly CompanyPermission[],
): boolean {
  const granted = ROLE_PERMISSIONS[role];
  return permissions.every((permission) => granted.has(permission));
}
