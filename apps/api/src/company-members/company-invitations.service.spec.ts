import { ConfigService } from '@nestjs/config';
import { CompanyRole } from '@prisma/client';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CompanyInvitationsService } from './company-invitations.service';

describe('CompanyInvitationsService', () => {
  const invitationFindUnique = jest.fn();
  const userFindUnique = jest.fn();
  const prisma = {
    companyInvitation: { findUnique: invitationFindUnique },
    user: { findUnique: userFindUnique },
  };
  const mailer = { assertConfigured: jest.fn(), send: jest.fn() };
  const passwords = { hash: jest.fn() };
  const auth = { issueSession: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  function service() {
    return new CompanyInvitationsService(
      prisma as never,
      new ConfigService({ WEB_URL: 'http://localhost:5173' }),
      mailer as never,
      passwords as never,
      auth as never,
    );
  }

  it('shows only safe invitation metadata for an active token', async () => {
    invitationFindUnique.mockResolvedValue({
      email: 'employee@example.com', role: CompanyRole.EMPLOYEE,
      expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, revokedAt: null,
      company: { name: 'Салон' },
    });
    userFindUnique.mockResolvedValue({ id: 'user-id' });
    await expect(service().inspect('secret')).resolves.toEqual(expect.objectContaining({
      companyName: 'Салон', email: 'employee@example.com', existingAccount: true,
    }));
  });

  it('rejects expired or already used tokens', async () => {
    invitationFindUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1), acceptedAt: null, revokedAt: null,
      company: { name: 'Салон' },
    });
    await expect(service().inspect('expired')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not let an administrator invite another administrator', async () => {
    await expect(service().create('company-id', {
      email: 'admin@example.com', role: CompanyRole.ADMIN,
    }, { id: 'member-id', userId: 'actor', companyId: 'company-id', role: CompanyRole.ADMIN, employeeId: null }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
