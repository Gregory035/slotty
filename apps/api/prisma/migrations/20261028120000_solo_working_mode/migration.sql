CREATE TYPE "WorkingMode" AS ENUM ('SOLO', 'TEAM');
ALTER TABLE "Company" ADD COLUMN "workingMode" "WorkingMode" NOT NULL DEFAULT 'TEAM';
