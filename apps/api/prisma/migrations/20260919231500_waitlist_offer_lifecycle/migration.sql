ALTER TABLE "WaitlistEntry" ADD COLUMN "offeredAppointmentId" UUID;

CREATE INDEX "WaitlistEntry_status_expiresAt_idx"
ON "WaitlistEntry"("status", "expiresAt");

CREATE UNIQUE INDEX "WaitlistEntry_one_offer_per_appointment_idx"
ON "WaitlistEntry"("companyId", "offeredAppointmentId")
WHERE "status" = 'OFFERED' AND "offeredAppointmentId" IS NOT NULL;
