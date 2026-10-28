#!/bin/sh
# Topology v2: mỗi service một database và một role riêng, role không đọc được DB khác.
# `auth_db` đã được script 00 tạo; `course_db` do script này tạo (POSTGRES_DB mặc định là `postgres`).
set -eu

for service in student course media notification scheduler ai; do
  user_var="$(echo "$service" | tr '[:lower:]' '[:upper:]')_POSTGRES_USER"
  password_var="$(echo "$service" | tr '[:lower:]' '[:upper:]')_POSTGRES_PASSWORD"
  db_user="$(printenv "$user_var" || true)"
  db_password="$(printenv "$password_var" || true)"
  db_user="${db_user:-${service}_user}"
  db_password="${db_password:-${service}-local-only}"

  psql --set=ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set=db_user="$db_user" \
    --set=db_password="$db_password" \
    --set=db_name="${service}_db" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name')
\gexec
SQL
done
