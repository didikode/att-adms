-- AlterEnum
ALTER TYPE "ReportFrequency" ADD VALUE 'MONTHLY';

-- CreateEnum
CREATE TYPE "EmployeeCandidateStatus" AS ENUM ('REQUESTED', 'READY', 'SAVED');

-- CreateTable
CREATE TABLE "employee_candidates" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "pin" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200),
    "status" "EmployeeCandidateStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3),
    "saved_at" TIMESTAMP(3),

    CONSTRAINT "employee_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_candidates_device_id_pin_key" ON "employee_candidates"("device_id", "pin");
CREATE INDEX "employee_candidates_status_requested_at_idx" ON "employee_candidates"("status", "requested_at");

-- AddForeignKey
ALTER TABLE "employee_candidates" ADD CONSTRAINT "employee_candidates_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
