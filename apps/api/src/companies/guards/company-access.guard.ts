import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { AuthenticatedUserDto } from '../../auth/dto/auth-response.dto';
import { CompanyMembershipContext } from '../company-access.types';
import { CompaniesService } from '../companies.service';
import { roleHasPermissions } from '../company-permission';
import { COMPANY_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { CompanyPermission } from '../company-permission';

interface CompanyRequest {
  params: { companyId?: string };
  user?: AuthenticatedUserDto;
  companyMembership?: CompanyMembershipContext;
}

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly companies: CompaniesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CompanyRequest>();
    const companyId = request.params.companyId;
    const userId = request.user?.id;

    if (!companyId || !isUUID(companyId)) {
      throw new BadRequestException('companyId must be a UUID');
    }
    if (!userId) {
      throw new ForbiddenException('Authenticated user is required');
    }

    const membership = await this.companies.findMembership(userId, companyId);
    if (!membership || membership.company.deletedAt) {
      throw new ForbiddenException('Company access denied');
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<CompanyPermission[]>(COMPANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredPermissions?.length) {
      throw new ForbiddenException('Company permission is not declared');
    }
    if (!roleHasPermissions(membership.role, requiredPermissions)) {
      throw new ForbiddenException('Insufficient company permission');
    }

    request.companyMembership = {
      id: membership.id,
      companyId: membership.companyId,
      userId: membership.userId,
      role: membership.role,
      employeeId: membership.employeeId,
    };

    return true;
  }
}
