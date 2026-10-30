-- CreateEnum
CREATE TYPE "identity_role" AS ENUM ('student', 'instructor', 'admin');

-- CreateEnum
CREATE TYPE "identity_account_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "identity_student_status" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateTable
CREATE TABLE "identity_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "identity_role" NOT NULL,
    "status" "identity_account_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_student_profiles" (
    "user_id" UUID NOT NULL,
    "status" "identity_student_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "identity_refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_service_clients" (
    "client_id" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "allowed_audiences" TEXT[],
    "allowed_scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_service_clients_pkey" PRIMARY KEY ("client_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_users_email_key" ON "identity_users"("email");

-- CreateIndex
CREATE INDEX "identity_users_role_created_at_idx" ON "identity_users"("role", "created_at");

-- CreateIndex
CREATE INDEX "identity_student_profiles_status_created_at_idx" ON "identity_student_profiles"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "identity_refresh_tokens_token_hash_key" ON "identity_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "identity_refresh_tokens_user_id_idx" ON "identity_refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "identity_refresh_tokens_expires_at_idx" ON "identity_refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "identity_student_profiles" ADD CONSTRAINT "identity_student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_refresh_tokens" ADD CONSTRAINT "identity_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
