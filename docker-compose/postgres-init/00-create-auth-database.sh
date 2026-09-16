#!/bin/sh
set -eu

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=auth_user="$AUTH_POSTGRES_USER" \
  --set=auth_password="$AUTH_POSTGRES_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'auth_user', :'auth_password')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_catalog.pg_roles
  WHERE rolname = :'auth_user'
)
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', 'auth_db', :'auth_user')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = 'auth_db'
)
\gexec
SQL
