ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REBOOK_OFFER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WAITLIST_SLOT';

CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "DepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'WAIVED');

ALTER TABLE "Company"
  ADD COLUMN "rebookingDelayDays" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "Service"
  ADD COLUMN "depositPercent" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Appointment"
  ADD COLUMN "depositAmountSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

CREATE TABLE "WaitlistEntry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "desiredDate" DATE NOT NULL,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "offeredAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WaitlistEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitlistEntry_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitlistEntry_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WaitlistEntry_serviceId_companyId_fkey" FOREIGN KEY ("serviceId", "companyId") REFERENCES "Service"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WaitlistEntry_companyId_customerId_employeeId_serviceId_desiredDate_key"
  ON "WaitlistEntry"("companyId", "customerId", "employeeId", "serviceId", "desiredDate");
CREATE UNIQUE INDEX "WaitlistEntry_id_companyId_key" ON "WaitlistEntry"("id", "companyId");
CREATE INDEX "WaitlistEntry_companyId_status_desiredDate_idx" ON "WaitlistEntry"("companyId", "status", "desiredDate");
CREATE INDEX "WaitlistEntry_companyId_employeeId_serviceId_desiredDate_status_idx"
  ON "WaitlistEntry"("companyId", "employeeId", "serviceId", "desiredDate", "status");
