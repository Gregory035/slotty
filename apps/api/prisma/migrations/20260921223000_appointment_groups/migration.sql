ALTER TABLE "Appointment"
  ADD COLUMN "visitId" UUID,
  ADD COLUMN "recurrenceId" UUID;

CREATE INDEX "Appointment_companyId_visitId_idx" ON "Appointment"("companyId", "visitId");
CREATE INDEX "Appointment_companyId_recurrenceId_startsAt_idx" ON "Appointment"("companyId", "recurrenceId", "startsAt");
