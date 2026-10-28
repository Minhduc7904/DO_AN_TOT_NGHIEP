-- CreateEnum
CREATE TYPE "ai_provider_kind" AS ENUM ('OPENAI', 'GEMINI', 'ANTHROPIC', 'MISTRAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ai_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ai_invocation_status" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ai_document_status" AS ENUM ('PENDING', 'PROCESSING', 'EXTRACTED', 'FAILED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "ai_job_type" AS ENUM ('SYNTHESIZE_LESSON', 'GENERATE_QUIZ');

-- CreateEnum
CREATE TYPE "ai_job_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider_type" "ai_provider_kind" NOT NULL,
    "base_url" VARCHAR(500) NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "api_key_hint" VARCHAR(16) NOT NULL,
    "status" "ai_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "status" "ai_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_service_bindings" (
    "id" UUID NOT NULL,
    "task_key" VARCHAR(50) NOT NULL,
    "model_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_service_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_invocations" (
    "id" UUID NOT NULL,
    "task_key" VARCHAR(50) NOT NULL,
    "model_id" UUID NOT NULL,
    "provider_type" "ai_provider_kind" NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "status" "ai_invocation_status" NOT NULL,
    "error_code" VARCHAR(60),
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_documents" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(255) NOT NULL,
    "media_type" VARCHAR(32) NOT NULL,
    "status" "ai_document_status" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(64),
    "error_message" VARCHAR(500),
    "extracted_text" TEXT,
    "lease_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "job_type" "ai_job_type" NOT NULL,
    "course_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "ai_job_status" NOT NULL DEFAULT 'PENDING',
    "media_ids" UUID[],
    "question_count" INTEGER,
    "overwrite_content" BOOLEAN NOT NULL DEFAULT false,
    "has_previous_content" BOOLEAN NOT NULL DEFAULT false,
    "previous_content_markdown" TEXT,
    "result_quiz_id" UUID,
    "step_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(64),
    "error_message" VARCHAR(500),
    "requested_by_id" UUID NOT NULL,
    "requested_by_role" VARCHAR(16) NOT NULL,
    "lease_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "ai_providers_status_created_at_idx" ON "ai_providers"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_models_status_created_at_idx" ON "ai_models"("status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_provider_id_model_name_key" ON "ai_models"("provider_id", "model_name");

-- CreateIndex
CREATE UNIQUE INDEX "ai_service_bindings_task_key_key" ON "ai_service_bindings"("task_key");

-- CreateIndex
CREATE INDEX "ai_service_bindings_model_id_idx" ON "ai_service_bindings"("model_id");

-- CreateIndex
CREATE INDEX "ai_invocations_task_key_created_at_idx" ON "ai_invocations"("task_key", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_invocations_created_at_idx" ON "ai_invocations"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_documents_media_id_key" ON "ai_documents"("media_id");

-- CreateIndex
CREATE INDEX "ai_documents_status_lease_expires_at_idx" ON "ai_documents"("status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "ai_jobs_lesson_id_created_at_idx" ON "ai_jobs"("lesson_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_jobs_status_lease_expires_at_idx" ON "ai_jobs"("status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "outbox_messages_published_at_available_at_idx" ON "outbox_messages"("published_at", "available_at");

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_service_bindings" ADD CONSTRAINT "ai_service_bindings_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tên provider duy nhất không phân biệt hoa thường (Prisma schema không biểu diễn được index trên biểu thức).
CREATE UNIQUE INDEX "ai_providers_name_lower_key" ON "ai_providers" (lower("name"));

-- Mỗi (bài học, loại job) chỉ có tối đa một job đang hoạt động (PENDING hoặc RUNNING); Prisma schema không biểu diễn được index này.
CREATE UNIQUE INDEX "ai_jobs_one_active" ON "ai_jobs"("lesson_id", "job_type") WHERE "status" IN ('PENDING', 'RUNNING');
