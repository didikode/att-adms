-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_punches" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "user_id" VARCHAR(50) NOT NULL,
    "occurred_at_local" VARCHAR(19) NOT NULL,
    "status" INTEGER,
    "verify" INTEGER,
    "work_code" INTEGER,
    "raw_data" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "attendance_punches_device_id_occurred_at_local_idx" ON "attendance_punches"("device_id", "occurred_at_local");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_punches_device_id_user_id_occurred_at_local_key" ON "attendance_punches"("device_id", "user_id", "occurred_at_local");

-- AddForeignKey
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
