-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "media_thumbnail_status" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "media_usage_owner_kind" AS ENUM ('COURSE', 'NOTIFICATION', 'STUDENT', 'MEDIA');

-- CreateEnum
CREATE TYPE "media_usage_type" AS ENUM ('COURSE_THUMBNAIL', 'COURSE_GALLERY', 'COURSE_DESCRIPTION', 'LESSON_CONTENT', 'LESSON_ATTACHMENT', 'QUIZ_CONTENT', 'NOTIFICATION_BODY', 'STUDENT_AVATAR', 'MEDIA_THUMBNAIL');

-- CreateEnum
CREATE TYPE "media_job_type" AS ENUM ('THUMBNAIL_DERIVATION', 'MARKDOWN_USAGE_SYNC', 'MEDIA_USAGE_DELETE', 'NOTIFICATION_USAGE');

-- CreateEnum
CREATE TYPE "media_job_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED');

-- CreateTable
CREATE TABLE "media_objects" (
    "id" UUID NOT NULL,
    "type" "media_type" NOT NULL,
    "status" "media_status" NOT NULL,
    "thumbnail_status" "media_thumbnail_status" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "tmp_object_key" TEXT,
    "upload_expires_at" TIMESTAMPTZ(6),
    "uploaded_by" UUID NOT NULL,
    "source_media_id" UUID,
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_usages" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "owner_kind" "media_usage_owner_kind" NOT NULL,
    "owner_id" UUID NOT NULL,
    "usage_type" "media_usage_type" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_background_jobs" (
    "id" UUID NOT NULL,
    "type" "media_job_type" NOT NULL,
    "status" "media_job_status" NOT NULL DEFAULT 'QUEUED',
    "deduplication_key" TEXT NOT NULL,
    "reference_id" TEXT,
    "expected_count" INTEGER,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_background_jobs_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "media_objects_source_media_id_key" ON "media_objects"("source_media_id");

-- CreateIndex
CREATE INDEX "media_objects_uploaded_by_created_at_idx" ON "media_objects"("uploaded_by", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_objects_type_status_idx" ON "media_objects"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_bucket_object_key_key" ON "media_objects"("bucket", "object_key");

-- CreateIndex
CREATE INDEX "media_usages_owner_kind_owner_id_usage_type_position_idx" ON "media_usages"("owner_kind", "owner_id", "usage_type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "media_usages_media_id_owner_kind_owner_id_usage_type_key" ON "media_usages"("media_id", "owner_kind", "owner_id", "usage_type");

-- CreateIndex
CREATE UNIQUE INDEX "media_background_jobs_deduplication_key_key" ON "media_background_jobs"("deduplication_key");

-- CreateIndex
CREATE INDEX "media_background_jobs_type_status_created_at_idx" ON "media_background_jobs"("type", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "outbox_messages_published_at_available_at_idx" ON "outbox_messages"("published_at", "available_at");

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_source_media_id_fkey" FOREIGN KEY ("source_media_id") REFERENCES "media_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ràng buộc partial mà Prisma không biểu diễn được: mỗi course một thumbnail, mỗi student một avatar.
CREATE UNIQUE INDEX "media_usages_one_course_thumbnail_key" ON "media_usages"("owner_id") WHERE "usage_type" = 'COURSE_THUMBNAIL';

CREATE UNIQUE INDEX "media_usages_one_student_avatar_key" ON "media_usages"("owner_id") WHERE "usage_type" = 'STUDENT_AVATAR';
