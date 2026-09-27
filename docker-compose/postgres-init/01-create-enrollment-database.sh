#!/bin/sh
set -eu

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
SELECT 'CREATE DATABASE enrollment_db'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = 'enrollment_db'
)
\gexec

SELECT 'CREATE DATABASE submission_db'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = 'submission_db'
)
\gexec
SQL
