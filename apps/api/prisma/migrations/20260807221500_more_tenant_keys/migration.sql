CREATE UNIQUE INDEX "CompanyMember_id_companyId_key" ON "CompanyMember"("id", "companyId");
CREATE UNIQUE INDEX "ScheduleRule_id_companyId_key" ON "ScheduleRule"("id", "companyId");
CREATE UNIQUE INDEX "ScheduleException_id_companyId_key" ON "ScheduleException"("id", "companyId");
CREATE UNIQUE INDEX "Notification_id_companyId_key" ON "Notification"("id", "companyId");
