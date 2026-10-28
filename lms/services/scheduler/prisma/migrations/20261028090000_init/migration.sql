-- CreateEnum
CREATE TYPE "background_job_type" AS ENUM ('MEDIA_UNUSED_CLEANUP');

-- CreateEnum
CREATE TYPE "background_job_schedule_type" AS ENUM ('MANUAL', 'CRON');

-- CreateEnum
CREATE TYPE "background_job_status" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "background_job_run_trigger_type" AS ENUM ('MANUAL', 'CRON');

-- CreateEnum
CREATE TYPE "background_job_run_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "background_job_type" NOT NULL,
    "schedule_type" "background_job_schedule_type" NOT NULL,
    "cron_expression" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "background_job_status" NOT NULL DEFAULT 'ACTIVE',
    "allow_concurrent" BOOLEAN NOT NULL DEFAULT false,
    "next_run_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_job_runs" (
    "id" UUID NOT NULL,
    "background_job_id" UUID NOT NULL,
    "trigger_type" "background_job_run_trigger_type" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_snapshot" JSONB NOT NULL DEFAULT '{}',
    "status" "background_job_run_status" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" UUID,
    "lease_expires_at" TIMESTAMPTZ(6),
    "worker_instance" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "output_json" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "background_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_name_key" ON "background_jobs"("name");

-- CreateIndex
CREATE INDEX "background_jobs_status_schedule_type_next_run_at_idx" ON "background_jobs"("status", "schedule_type", "next_run_at");

-- CreateIndex
CREATE INDEX "background_jobs_created_at_idx" ON "background_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "background_job_runs_background_job_id_scheduled_at_idx" ON "background_job_runs"("background_job_id", "scheduled_at" DESC);

-- CreateIndex
CREATE INDEX "background_job_runs_status_scheduled_at_idx" ON "background_job_runs"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "background_job_runs_background_job_id_idempotency_key_key" ON "background_job_runs"("background_job_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "background_job_runs" ADD CONSTRAINT "background_job_runs_background_job_id_fkey" FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ràng buộc nghiệp vụ mà Prisma không biểu diễn được.
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_cron_check"
  CHECK (("schedule_type" = 'CRON') = ("cron_expression" IS NOT NULL));
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_payload_object_check"
  CHECK (jsonb_typeof("payload") = 'object');
-- Nhận run: chỉ run còn việc phải làm nằm trong chỉ mục.
CREATE INDEX "background_job_runs_claimable_idx" ON "background_job_runs"("scheduled_at")
  WHERE "status" IN ('PENDING', 'RUNNING');
