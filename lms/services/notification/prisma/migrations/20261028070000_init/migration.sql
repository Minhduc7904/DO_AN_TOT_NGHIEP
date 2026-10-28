-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "notification_source_type" AS ENUM ('SINGLE', 'BULK');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "notification_email_status" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_batch_target_scope" AS ENUM ('ALL_STUDENTS', 'FAILED_RECIPIENTS');

-- CreateEnum
CREATE TYPE "notification_batch_status" AS ENUM ('PENDING', 'SNAPSHOTTING', 'SNAPSHOT_READY', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED');

-- CreateEnum
CREATE TYPE "notification_batch_item_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'RETRY', 'FAILED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "source_type" "notification_source_type" NOT NULL,
    "batch_id" UUID,
    "status" "notification_status" NOT NULL DEFAULT 'UNREAD',
    "email_status" "notification_email_status" NOT NULL DEFAULT 'NOT_REQUESTED',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_batches" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "target_scope" "notification_batch_target_scope" NOT NULL,
    "status" "notification_batch_status" NOT NULL DEFAULT 'PENDING',
    "batch_size" INTEGER NOT NULL DEFAULT 500,
    "requested_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "source_batch_id" UUID,
    "created_by" UUID NOT NULL,
    "media_usage_job_id" UUID,
    "media_usage_expected" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "status" "notification_batch_item_status" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" UUID,
    "lease_expires_at" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "notification_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "routing_key" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "last_error" TEXT,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_states" (
    "message_id" UUID NOT NULL,
    "consumer" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_states_pkey" PRIMARY KEY ("message_id","consumer")
);

-- CreateIndex
CREATE INDEX "notifications_student_id_status_created_at_idx" ON "notifications"("student_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_batch_id_student_id_key" ON "notifications"("batch_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_batches_source_batch_id_key" ON "notification_batches"("source_batch_id");

-- CreateIndex
CREATE INDEX "notification_batches_status_created_at_idx" ON "notification_batches"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_batch_items_batch_id_status_next_attempt_at_idx" ON "notification_batch_items"("batch_id", "status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_batch_items_batch_id_student_id_key" ON "notification_batch_items"("batch_id", "student_id");

-- CreateIndex
CREATE INDEX "outbox_messages_published_at_available_at_idx" ON "outbox_messages"("published_at", "available_at");

-- AddForeignKey
ALTER TABLE "notification_batch_items" ADD CONSTRAINT "notification_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "notification_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

