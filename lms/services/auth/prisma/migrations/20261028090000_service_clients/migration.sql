-- CreateTable
CREATE TABLE "auth_service_clients" (
    "client_id" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "allowed_audiences" TEXT[],
    "allowed_scopes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_service_clients_pkey" PRIMARY KEY ("client_id")
);
