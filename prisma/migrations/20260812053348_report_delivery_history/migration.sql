-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "period_start" VARCHAR(10) NOT NULL,
    "period_end" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_deliveries_schedule_id_created_at_idx" ON "report_deliveries"("schedule_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_deliveries_schedule_id_period_start_period_end_key" ON "report_deliveries"("schedule_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
