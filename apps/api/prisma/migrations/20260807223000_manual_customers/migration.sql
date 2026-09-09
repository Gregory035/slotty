ALTER TABLE "Customer"
  ALTER COLUMN "telegramId" DROP NOT NULL,
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE INDEX "Customer_companyId_lastActivityAt_id_idx"
  ON "Customer"("companyId", "lastActivityAt", "id");

CREATE UNIQUE INDEX "CompanyMember_companyId_employeeId_key"
  ON "CompanyMember"("companyId", "employeeId");
