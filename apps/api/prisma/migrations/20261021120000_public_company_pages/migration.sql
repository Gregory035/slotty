ALTER TABLE "Company"
  ADD COLUMN "publicSlug" VARCHAR(64),
  ADD COLUMN "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Company_publicSlug_key" ON "Company"("publicSlug");
