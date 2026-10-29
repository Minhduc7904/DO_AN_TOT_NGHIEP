# LMS backend workspace

`lms/` là root canonical cho backend testbed, gồm business service, shared technical package, published contract và runtime infrastructure. Phần analysis/RCA, workload, fault và experiment vẫn nằm ngoài workspace này tại repository root.

## Toolchain

- Node.js `22.13.1`.
- pnpm `11.19.0` qua Corepack.
- NestJS `12.0.x` và TypeScript `6.0.3`.

## Cài đặt và kiểm tra

Chạy từ repository root:

```powershell
node --version # phải là v22.13.1

Push-Location lms
$corepackPnpm = @('exec', '--yes', '--package=corepack@0.34.0', '--', 'corepack', 'pnpm')
npm @corepackPnpm --version # phải là 11.19.0
npm @corepackPnpm install --frozen-lockfile
npm @corepackPnpm run lint
npm @corepackPnpm run format:check
npm @corepackPnpm run test
npm @corepackPnpm run test:e2e
npm @corepackPnpm run test:telemetry
npm @corepackPnpm run test:course:postgres # cần PostgreSQL test và hai database URL
npm @corepackPnpm run test:auth:e2e # cần PostgreSQL đã `prisma migrate deploy` và AUTH_DATABASE_URL
npm @corepackPnpm run build
npm @corepackPnpm run ci:verify
Pop-Location
```

Bash trên Linux/macOS (đã kiểm chứng với nvm và Corepack đi kèm Node `22.13.1`):

```bash
cd lms
nvm use # đọc lms/.nvmrc; hoặc cài Node.js 22.13.1 bằng cách khác
node --version # phải là v22.13.1
corepack enable
pnpm --version # phải là 11.19.0 khi chạy trong lms/
pnpm install --frozen-lockfile
```

Chạy các lệnh `pnpm` từ trong `lms/`. Corepack chọn phiên bản pnpm theo `packageManager` của thư mục
hiện tại; repository root không có `package.json` nên `pnpm --dir lms ...` gọi từ root có thể dùng pnpm
mặc định khác và bị chặn bởi `ERR_PNPM_UNSUPPORTED_ENGINE`.

Các lệnh PowerShell ở trên dùng trực tiếp Corepack `0.34.0`, không gọi `corepack` hoặc `pnpm`
qua shim đã có trong `PATH`. Cách này tránh trường hợp Windows vẫn resolve
`corepack.cmd` cũ từ thư mục cài Node. Corepack đọc `packageManager` của `lms/`
để chạy đúng pnpm `11.19.0`; hãy xác minh phiên bản trước khi cài dependency.

Khởi động Course service:

```powershell
Push-Location lms
$corepackPnpm = @('exec', '--yes', '--package=corepack@0.34.0', '--', 'corepack', 'pnpm')
npm @corepackPnpm run start:course
Pop-Location
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

Docker Compose baseline được hướng dẫn tại [`../docker-compose/README.md`](../docker-compose/README.md).
E2E của từng service (`pnpm run test:<service>:e2e`) chạy với PostgreSQL, RabbitMQ, MinIO và Mailpit thật qua biến `<SERVICE>_DATABASE_URL`, `<SERVICE>_RABBITMQ_URL`, `MINIO_*`, `NOTIFICATION_SMTP_*`; mỗi service đã `prisma migrate deploy` trước. Chỉ dùng database dành riêng cho test. Regression xuyên service chạy trên stack Compose: `pnpm run test:regression` (xem [`../docker-compose/README.md`](../docker-compose/README.md#regression-lms)), Postman/newman: `pnpm run test:postman` (xem [`../postman/README.md`](../postman/README.md)).
OpenTelemetry bootstrap và assertion được mô tả tại [`packages/observability/README.md`](packages/observability/README.md). CI ([`../.github/workflows/ci.yml`](../.github/workflows/ci.yml)) chạy trên mọi PR: `static` (format, lint, build), `unit`, `e2e` theo từng service trên PostgreSQL/RabbitMQ/MinIO/Mailpit thật, `integration-db` (outbox qua RabbitMQ thật và seeder), `compose-config` (kiểm Compose bằng [`../docker-compose/.env.example`](../docker-compose/.env.example), không dùng `.env` local hoặc secret thật) và `compose-reset` (reset hai lần, fingerprint ổn định). Regression và Postman dựng cả stack compose nên nằm ở [`../.github/workflows/regression.yml`](../.github/workflows/regression.yml): chạy khi PR gắn label `run-regression`, khi merge vào `main`, hằng đêm hoặc chạy tay.
