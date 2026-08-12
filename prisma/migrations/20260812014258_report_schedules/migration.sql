-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ReportScope" AS ENUM ('ALL', 'EMPLOYEE', 'DIVISION');

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "weekday" INTEGER,
    "time" VARCHAR(5) NOT NULL,
    "recipients" JSONB NOT NULL,
    "scope" "ReportScope" NOT NULL DEFAULT 'ALL',
    "employee_id" TEXT,
    "division_name" VARCHAR(200),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_schedules_active_frequency_weekday_time_idx" ON "report_schedules"("active", "frequency", "weekday", "time");

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
