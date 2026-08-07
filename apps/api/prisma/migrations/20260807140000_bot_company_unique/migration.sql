-- One Telegram bot per company for the MVP.
CREATE UNIQUE INDEX "Bot_companyId_key" ON "Bot"("companyId");
