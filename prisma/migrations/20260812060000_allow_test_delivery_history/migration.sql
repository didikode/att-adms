-- DropIndex
DROP INDEX "report_deliveries_schedule_id_period_start_period_end_key";

-- AlterTable
ALTER TABLE "report_deliveries" ADD COLUMN "kind" VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED';

-- CreateIndex
CREATE UNIQUE INDEX "report_deliveries_schedule_id_period_start_period_end_kind_key" ON "report_deliveries"("schedule_id", "period_start", "period_end", "kind");
