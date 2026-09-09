import { SetMetadata } from '@nestjs/common';
import { CompanyPermission } from '../company-permission';

export const COMPANY_PERMISSIONS_KEY = 'companyPermissions';

export const RequirePermissions = (...permissions: CompanyPermission[]) =>
  SetMetadata(COMPANY_PERMISSIONS_KEY, permissions);
