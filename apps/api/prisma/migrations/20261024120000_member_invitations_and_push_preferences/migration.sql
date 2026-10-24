CREATE TABLE "PushPreference" (
  "userId" UUID NOT NULL,
  "appointmentCreated" BOOLEAN NOT NULL DEFAULT true,
  "appointmentRescheduled" BOOLEAN NOT NULL DEFAULT true,
  "appointmentCancelled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "CompanyInvitation" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "role" "CompanyRole" NOT NULL,
  "employeeId" UUID,
  "invitedById" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyInvitation_tokenHash_key" ON "CompanyInvitation"("tokenHash");
CREATE INDEX "CompanyInvitation_companyId_createdAt_idx" ON "CompanyInvitation"("companyId", "createdAt");
CREATE INDEX "CompanyInvitation_email_expiresAt_idx" ON "CompanyInvitation"("email", "expiresAt");

ALTER TABLE "PushPreference" ADD CONSTRAINT "PushPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
