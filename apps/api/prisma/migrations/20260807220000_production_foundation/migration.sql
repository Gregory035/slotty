CREATE TYPE "AppointmentHistoryAction" AS ENUM ('CREATED', 'STATUS_CHANGED', 'RESCHEDULED', 'NOTE_CHANGED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD');
CREATE TYPE "TelegramUpdateStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_customerId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_employeeId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_serviceId_fkey";
ALTER TABLE "EmployeeService" DROP CONSTRAINT "EmployeeService_employeeId_fkey";
ALTER TABLE "EmployeeService" DROP CONSTRAINT "EmployeeService_serviceId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_appointmentId_fkey";
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_customerId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subscriptionId_fkey";
ALTER TABLE "ScheduleException" DROP CONSTRAINT "ScheduleException_employeeId_fkey";
ALTER TABLE "ScheduleRule" DROP CONSTRAINT "ScheduleRule_employeeId_fkey";

ALTER TABLE "Appointment"
  ADD COLUMN "cancellationActor" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "durationMinutesSnapshot" INTEGER,
  ADD COLUMN "idempotencyKey" TEXT;
UPDATE "Appointment" AS appointment
SET "durationMinutesSnapshot" = service."durationMinutes"
FROM "Service" AS service
WHERE service."id" = appointment."serviceId";
UPDATE "Appointment"
SET "durationMinutesSnapshot" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 60)::INTEGER)
WHERE "durationMinutesSnapshot" IS NULL;
ALTER TABLE "Appointment" ALTER COLUMN "durationMinutesSnapshot" SET NOT NULL;

ALTER TABLE "AuditLog"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "userAgent" TEXT;

ALTER TABLE "Company"
  ADD COLUMN "allowAnyEmployee" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cancellationNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxBookingHorizonDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "minBookingNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "slotStepMinutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "CompanyMember" ADD COLUMN "employeeId" UUID;

ALTER TABLE "EmployeeService" DROP CONSTRAINT "EmployeeService_pkey";
ALTER TABLE "EmployeeService"
  ADD COLUMN "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "price" DECIMAL(12,2),
  ADD CONSTRAINT "EmployeeService_pkey" PRIMARY KEY ("companyId", "employeeId", "serviceId");

ALTER TABLE "Notification"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "lastError" TEXT;
UPDATE "Notification" SET "idempotencyKey" = 'legacy:' || "id"::TEXT;
ALTER TABLE "Notification" ALTER COLUMN "idempotencyKey" SET NOT NULL;

ALTER TABLE "RefreshToken"
  ADD COLUMN "familyId" UUID,
  ADD COLUMN "reuseDetectedAt" TIMESTAMP(3),
  ADD COLUMN "rotatedAt" TIMESTAMP(3);
UPDATE "RefreshToken" SET "familyId" = "id";
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

CREATE TABLE "AppointmentHistory" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "appointmentId" UUID NOT NULL,
  "actorId" UUID,
  "action" "AppointmentHistoryAction" NOT NULL,
  "fromStatus" "AppointmentStatus",
  "toStatus" "AppointmentStatus",
  "previousStartsAt" TIMESTAMP(3),
  "previousEndsAt" TIMESTAMP(3),
  "nextStartsAt" TIMESTAMP(3),
  "nextEndsAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboxEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramUpdate" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "botId" UUID NOT NULL,
  "updateId" BIGINT NOT NULL,
  "status" "TelegramUpdateStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentHistory_companyId_appointmentId_createdAt_idx" ON "AppointmentHistory"("companyId", "appointmentId", "createdAt");
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_companyId_createdAt_idx" ON "OutboxEvent"("companyId", "createdAt");
CREATE UNIQUE INDEX "OutboxEvent_companyId_idempotencyKey_key" ON "OutboxEvent"("companyId", "idempotencyKey");
CREATE INDEX "TelegramUpdate_companyId_status_createdAt_idx" ON "TelegramUpdate"("companyId", "status", "createdAt");
CREATE UNIQUE INDEX "TelegramUpdate_botId_updateId_key" ON "TelegramUpdate"("botId", "updateId");
CREATE UNIQUE INDEX "Appointment_id_companyId_key" ON "Appointment"("id", "companyId");
CREATE UNIQUE INDEX "Appointment_companyId_idempotencyKey_key" ON "Appointment"("companyId", "idempotencyKey");
CREATE UNIQUE INDEX "AuditLog_id_companyId_key" ON "AuditLog"("id", "companyId");
CREATE UNIQUE INDEX "Bot_id_companyId_key" ON "Bot"("id", "companyId");
CREATE UNIQUE INDEX "Customer_id_companyId_key" ON "Customer"("id", "companyId");
CREATE UNIQUE INDEX "Employee_id_companyId_key" ON "Employee"("id", "companyId");
CREATE UNIQUE INDEX "Notification_companyId_idempotencyKey_key" ON "Notification"("companyId", "idempotencyKey");
DROP INDEX "Payment_externalPaymentId_key";
CREATE UNIQUE INDEX "Payment_id_companyId_key" ON "Payment"("id", "companyId");
CREATE UNIQUE INDEX "Payment_provider_externalPaymentId_key" ON "Payment"("provider", "externalPaymentId");
CREATE INDEX "RefreshToken_familyId_expiresAt_idx" ON "RefreshToken"("familyId", "expiresAt");
CREATE UNIQUE INDEX "Service_id_companyId_key" ON "Service"("id", "companyId");
CREATE UNIQUE INDEX "Subscription_id_companyId_key" ON "Subscription"("id", "companyId");

ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_serviceId_companyId_fkey" FOREIGN KEY ("serviceId", "companyId") REFERENCES "Service"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleRule" ADD CONSTRAINT "ScheduleRule_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleException" ADD CONSTRAINT "ScheduleException_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "Employee"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_companyId_fkey" FOREIGN KEY ("serviceId", "companyId") REFERENCES "Service"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_companyId_fkey" FOREIGN KEY ("appointmentId", "companyId") REFERENCES "Appointment"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_companyId_fkey" FOREIGN KEY ("subscriptionId", "companyId") REFERENCES "Subscription"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_appointmentId_companyId_fkey" FOREIGN KEY ("appointmentId", "companyId") REFERENCES "Appointment"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentHistory" ADD CONSTRAINT "AppointmentHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramUpdate" ADD CONSTRAINT "TelegramUpdate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramUpdate" ADD CONSTRAINT "TelegramUpdate_botId_companyId_fkey" FOREIGN KEY ("botId", "companyId") REFERENCES "Bot"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Company" ADD CONSTRAINT "Company_booking_settings_check" CHECK (
  "minBookingNoticeMinutes" >= 0 AND
  "maxBookingHorizonDays" BETWEEN 1 AND 365 AND
  "slotStepMinutes" BETWEEN 5 AND 120 AND
  "cancellationNoticeMinutes" >= 0
);
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_overrides_check" CHECK (
  ("durationMinutes" IS NULL OR "durationMinutes" > 0) AND
  ("price" IS NULL OR "price" >= 0) AND
  "bufferBeforeMinutes" >= 0 AND
  "bufferAfterMinutes" >= 0
);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_time_range_check" CHECK ("endsAt" > "startsAt");

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_no_employee_overlap"
EXCLUDE USING gist (
  "companyId" WITH =,
  "employeeId" WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" NOT IN ('CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_COMPANY'));
