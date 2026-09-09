ALTER TABLE "TelegramUpdate"
  ADD COLUMN "payload" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "TelegramUpdate_status_availableAt_idx"
  ON "TelegramUpdate"("status", "availableAt");
