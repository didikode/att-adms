-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HR');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEWED', 'COMMITTED', 'FAILED');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "alias_name" VARCHAR(100),
ADD COLUMN     "ip_address" VARCHAR(45),
ADD COLUMN     "last_activity_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_code" VARCHAR(100) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "display_name" VARCHAR(200) NOT NULL,
    "gender" VARCHAR(20),
    "division_code" VARCHAR(100),
    "division_name" VARCHAR(200),
    "position" VARCHAR(200),
    "email" VARCHAR(320),
    "hire_date" DATE,
    "active_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_enrollments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "pin" VARCHAR(50) NOT NULL,
    "fingerprint_count" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" TEXT NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEWED',
    "summary" JSONB NOT NULL,
    "row_results" JSONB NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "employees_active_display_name_idx" ON "employees"("active", "display_name");

-- CreateIndex
CREATE INDEX "device_enrollments_employee_id_active_idx" ON "device_enrollments"("employee_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "device_enrollments_device_id_pin_key" ON "device_enrollments"("device_id", "pin");

-- CreateIndex
CREATE INDEX "import_runs_checksum_idx" ON "import_runs"("checksum");

-- CreateIndex
CREATE INDEX "audit_events_target_type_target_id_created_at_idx" ON "audit_events"("target_type", "target_id", "created_at");

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_enrollments" ADD CONSTRAINT "device_enrollments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
