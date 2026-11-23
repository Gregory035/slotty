ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'SOLO';
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
UPDATE "Subscription" SET "status"='ACTIVE', "trialEndsAt"=NULL,
  "currentPeriodEndsAt"=NULL, "graceEndsAt"=NULL, "autoRenewEnabled"=false,
  "cancelAtPeriodEnd"=false WHERE "plan"='TRIAL';
