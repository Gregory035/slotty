CREATE TYPE "BookingFunnelStep" AS ENUM ('STARTED', 'SERVICE_SELECTED', 'DATE_SELECTED', 'TIME_SELECTED', 'BOOKED');
CREATE TYPE "BookingFunnelSource" AS ENUM ('MINI_APP');

CREATE TABLE "BookingFunnelEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "visitorKey" VARCHAR(64) NOT NULL,
  "step" "BookingFunnelStep" NOT NULL,
  "source" "BookingFunnelSource" NOT NULL DEFAULT 'MINI_APP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingFunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingFunnelEvent_companyId_createdAt_step_idx" ON "BookingFunnelEvent"("companyId", "createdAt", "step");
CREATE INDEX "BookingFunnelEvent_companyId_visitorKey_createdAt_idx" ON "BookingFunnelEvent"("companyId", "visitorKey", "createdAt");

ALTER TABLE "BookingFunnelEvent"
  ADD CONSTRAINT "BookingFunnelEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkExample" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "WorkExample" ADD COLUMN "thumbnailKey" TEXT;
