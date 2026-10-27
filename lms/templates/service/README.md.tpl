# `@aiops-lms/__NAME__`

## Trách nhiệm

Mô tả ngắn trách nhiệm service (xem `docs/processed/architecture/service-catalogue-and-topology-v2.md`).

## Cấu trúc

```text
src/domain/                      entity/value object thuần
src/application/ports/           interface repository và client
src/application/use-cases/       mỗi use case một class: <verb-noun>.use-case.ts, method execute
src/adapters/{http,persistence}  controller mỏng, Prisma repository
prisma/                          schema.prisma và migrations (`pnpm prisma:migrate:dev`)
```

`domain/` và `application/` không import `@nestjs/*`, `@prisma/client` hay `@aiops-lms/common/{http,clients,...}`; ESLint chặn các import này.

## Chạy

```bash
export __UPPER___DATABASE_URL=postgresql://user:pw@localhost:5432/__NAME___db
pnpm prisma:migrate:dev --name init   # lần đầu
pnpm build && pnpm start
```

Container tự chạy `prisma migrate deploy` trước khi khởi động.
