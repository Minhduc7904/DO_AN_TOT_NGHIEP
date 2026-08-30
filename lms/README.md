# LMS backend workspace

`lms/` là root canonical cho backend testbed, gồm business service, shared technical package, published contract và runtime infrastructure. Phần analysis/RCA, workload, fault và experiment vẫn nằm ngoài workspace này tại repository root.

## Toolchain

- Node.js `22.13.1`.
- pnpm `11.19.0` qua Corepack.
- NestJS `12.0.x` và TypeScript `6.0.3`.

## Cài đặt và kiểm tra

Chạy từ repository root:

```powershell
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm --dir lms install --frozen-lockfile
pnpm --dir lms lint
pnpm --dir lms format:check
pnpm --dir lms test
pnpm --dir lms test:e2e
pnpm --dir lms build
```

Khởi động Course service:

```powershell
pnpm --dir lms start:course
Invoke-RestMethod http://localhost:3002/health
```

## Docker

Docker build context là `lms/`:

```powershell
docker build -f lms/services/course/Dockerfile -t aiops-lms-course ./lms
docker run --name aiops-lms-course-check -d -e PORT=3102 -p 3102:3102 aiops-lms-course
docker exec aiops-lms-course-check id -u
Invoke-RestMethod http://localhost:3102/health
docker rm -f aiops-lms-course-check
```

Lệnh `id -u` phải trả về UID khác `0`; health endpoint phải trả `status=ok` trên port đã cấu hình.

Compose, OpenTelemetry và CI được triển khai trong các task tiếp theo.
