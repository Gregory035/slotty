ALTER TABLE "Subscription"
  ADD COLUMN "providerPaymentMethodId" TEXT,
  ADD COLUMN "autoRenewEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment"
  ADD COLUMN "renewalForPeriodEndAt" TIMESTAMP(3),
  ADD COLUMN "receiptStatus" VARCHAR(32);

CREATE UNIQUE INDEX "Payment_subscriptionId_renewalForPeriodEndAt_key"
  ON "Payment"("subscriptionId", "renewalForPeriodEndAt");
