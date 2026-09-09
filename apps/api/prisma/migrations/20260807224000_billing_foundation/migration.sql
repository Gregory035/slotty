ALTER TABLE "Subscription" ADD COLUMN "graceEndsAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "planSnapshot" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER';

CREATE TABLE "PaymentEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentEvent_provider_externalEventId_key"
  ON "PaymentEvent"("provider", "externalEventId");
CREATE INDEX "PaymentEvent_companyId_createdAt_idx"
  ON "PaymentEvent"("companyId", "createdAt");
ALTER TABLE "PaymentEvent"
  ADD CONSTRAINT "PaymentEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
