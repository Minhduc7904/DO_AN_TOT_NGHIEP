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
npm @corepackPnpm run build
npm @corepackPnpm run ci:verify
Pop-Location
```

Các lệnh dùng trực tiếp Corepack `0.34.0`, không gọi `corepack` hoặc `pnpm`
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
OpenTelemetry bootstrap và assertion được mô tả tại [`packages/observability/README.md`](packages/observability/README.md). CI baseline chạy clean install, format check, build, lint và test qua `pnpm --dir lms ci:verify`; workflow cũng kiểm tra Compose bằng [`../docker-compose/.env.example`](../docker-compose/.env.example), không dùng `.env` local hoặc secret thật.
