CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");
CREATE UNIQUE INDEX "Review_id_companyId_key" ON "Review"("id", "companyId");
CREATE UNIQUE INDEX "Review_appointmentId_companyId_key" ON "Review"("appointmentId", "companyId");
CREATE INDEX "Review_companyId_createdAt_idx" ON "Review"("companyId", "createdAt");
CREATE INDEX "Review_customerId_createdAt_idx" ON "Review"("customerId", "createdAt");

ALTER TABLE "Review" ADD CONSTRAINT "Review_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_companyId_fkey"
FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_companyId_fkey"
FOREIGN KEY ("appointmentId", "companyId") REFERENCES "Appointment"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
