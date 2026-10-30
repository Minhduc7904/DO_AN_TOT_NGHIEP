#!/bin/sh
set -eu

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=identity_user="$IDENTITY_POSTGRES_USER" \
  --set=identity_password="$IDENTITY_POSTGRES_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'identity_user', :'identity_password')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = :'identity_user'
)
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', 'identity_db', :'identity_user')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = 'identity_db'
)
\gexec
SQL
