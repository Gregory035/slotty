CREATE TYPE "LegalDocument" AS ENUM ('TERMS', 'PRIVACY', 'PERSONAL_DATA', 'DATA_PROCESSING', 'OFFER');
CREATE TYPE "LegalAcceptanceSource" AS ENUM ('WEB_REGISTRATION', 'COMPANY_ONBOARDING', 'TELEGRAM_MINI_APP', 'BILLING_CHECKOUT');

CREATE TABLE "LegalAcceptance" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "companyId" UUID,
    "customerId" UUID,
    "telegramId" BIGINT,
    "document" "LegalDocument" NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "source" "LegalAcceptanceSource" NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LegalAcceptance_subject_check" CHECK ("userId" IS NOT NULL OR "telegramId" IS NOT NULL)
);

CREATE INDEX "LegalAcceptance_userId_document_acceptedAt_idx" ON "LegalAcceptance"("userId", "document", "acceptedAt");
CREATE INDEX "LegalAcceptance_companyId_customerId_document_acceptedAt_idx" ON "LegalAcceptance"("companyId", "customerId", "document", "acceptedAt");
CREATE INDEX "LegalAcceptance_companyId_telegramId_document_acceptedAt_idx" ON "LegalAcceptance"("companyId", "telegramId", "document", "acceptedAt");

ALTER TABLE "WorkExample" ADD COLUMN "consentConfirmedAt" TIMESTAMP(3),
ADD COLUMN "consentVersion" VARCHAR(32),
ADD COLUMN "consentSource" VARCHAR(32),
ADD COLUMN "consentConfirmedBy" UUID;
