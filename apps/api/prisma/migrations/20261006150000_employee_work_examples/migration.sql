CREATE TYPE "WorkExampleSource" AS ENUM ('CUSTOMER', 'EMPLOYEE');

CREATE TABLE "WorkExample" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "appointmentId" UUID,
    "customerId" UUID,
    "source" "WorkExampleSource" NOT NULL,
    "caption" TEXT,
    "imageData" BYTEA,
    "mimeType" VARCHAR(64),
    "uploadRequestedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkExample_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkExample_appointmentId_companyId_key" ON "WorkExample"("appointmentId", "companyId");
CREATE INDEX "WorkExample_companyId_employeeId_publishedAt_idx" ON "WorkExample"("companyId", "employeeId", "publishedAt");
CREATE INDEX "WorkExample_customerId_uploadRequestedAt_idx" ON "WorkExample"("customerId", "uploadRequestedAt");
ALTER TABLE "WorkExample" ADD CONSTRAINT "WorkExample_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkExample" ADD CONSTRAINT "WorkExample_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkExample" ADD CONSTRAINT "WorkExample_appointmentId_companyId_fkey" FOREIGN KEY ("appointmentId", "companyId") REFERENCES "Appointment"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkExample" ADD CONSTRAINT "WorkExample_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
