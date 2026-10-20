CREATE TABLE "WebVitalSample" (
  "id" UUID NOT NULL,
  "name" VARCHAR(8) NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "rating" VARCHAR(24) NOT NULL,
  "path" VARCHAR(128) NOT NULL,
  "navigationType" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebVitalSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebVitalSample_name_createdAt_idx" ON "WebVitalSample"("name", "createdAt");
CREATE INDEX "WebVitalSample_createdAt_idx" ON "WebVitalSample"("createdAt");
