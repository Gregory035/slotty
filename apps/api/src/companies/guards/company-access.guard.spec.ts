import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyRole } from '@prisma/client';
import { CompaniesService } from '../companies.service';
import { CompanyAccessGuard } from './company-access.guard';

describe('CompanyAccessGuard', () => {
  const findMembership = jest.fn();
  const getAllAndOverride = jest.fn();
  const guard = new CompanyAccessGuard(
    { getAllAndOverride } as unknown as Reflector,
    { findMembership } as unknown as CompaniesService,
  );

  function createContext() {
    const request = {
      params: { companyId: '7d90bf09-b1c8-4e77-a94a-64203e9b310e' },
      user: {
        id: '68f80f20-5b6f-4132-9823-9c6f4f2f355c',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: null,
        emailVerified: false,
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as unknown as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    findMembership.mockReset();
    getAllAndOverride.mockReset();
  });

  it('attaches an allowed membership to the request', async () => {
    const { context, request } = createContext();
    findMembership.mockResolvedValue({
      id: 'd832873d-8b9e-4559-94ca-d98416f49dc2',
      companyId: request.params.companyId,
      userId: request.user.id,
      role: CompanyRole.OWNER,
      company: { deletedAt: null },
    });
    getAllAndOverride.mockReturnValue([CompanyRole.OWNER]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty(
      'companyMembership.role',
      CompanyRole.OWNER,
    );
  });

  it('rejects a non-member and an insufficient role', async () => {
    const first = createContext();
    findMembership.mockResolvedValueOnce(null);
    await expect(guard.canActivate(first.context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const second = createContext();
    findMembership.mockResolvedValueOnce({
      id: 'd832873d-8b9e-4559-94ca-d98416f49dc2',
      companyId: second.request.params.companyId,
      userId: second.request.user.id,
      role: CompanyRole.EMPLOYEE,
      company: { deletedAt: null },
    });
    getAllAndOverride.mockReturnValueOnce([CompanyRole.OWNER]);
    await expect(guard.canActivate(second.context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
