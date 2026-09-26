# Docker Compose baseline

Thư mục này chứa manifest orchestration root cho LMS testbed. Baseline hiện tại build Gateway, Auth, Course, Enrollment, Submission và Storage Mock từ `lms/`, đồng thời khởi động PostgreSQL, Redis và RabbitMQ bằng image đã pin.

## Yêu cầu

- Docker Engine đang chạy.
- Docker Compose v2 hỗ trợ `docker compose up --wait`.
- Các port mặc định `3001`, `3002`, `5432`, `6379`, `5672` và `15672` chưa bị chiếm, hoặc đã được đổi trong file `.env` local.

## Chuẩn bị cấu hình local

Bash:

```bash
cp docker-compose/.env.example docker-compose/.env
```

PowerShell:

```powershell
Copy-Item docker-compose/.env.example docker-compose/.env
```

Các credential trong `.env.example` chỉ dùng cho local development, không phải secret production. File `.env` được Git ignore.

Course bật OpenTelemetry mặc định và gửi trace tới `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. Baseline này chưa dựng Collector nên endpoint có thể chưa sẵn sàng; lỗi export không làm Course dừng hoặc làm `/health` thất bại. Đặt `OTEL_SDK_DISABLED=true` để tắt bootstrap, hoặc đổi endpoint khi có OTLP backend cục bộ.

## Validate và khởi động

Chạy từ repository root:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml config
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml up --build -d --wait
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml ps
```

Compose chỉ báo thành công sau khi Gateway, Auth, Course, Enrollment, Submission, Storage Mock, PostgreSQL, Redis và RabbitMQ đều healthy. PostgreSQL tạo `auth_db`, `course_db`, `enrollment_db` và `submission_db` riêng; các service có persistence tự chạy migration/seed trước khi mở HTTP. Credential lấy từ `.env`, không đặt trực tiếp trong manifest Compose.

## Kiểm tra

Kiểm tra Course từ Bash:

```bash
curl --fail http://localhost:3002/health
```

Kiểm tra Auth từ Bash:

```bash
curl --fail http://localhost:3001/health
```

Kiểm tra W1–W2 qua Gateway từ Bash:

```bash
login=$(curl --fail --silent --show-error -H 'content-type: application/json' -d '{"email":"student@example.test","password":"example-password"}' http://localhost:3000/api/v1/auth/login)
token=$(printf '%s' "$login" | node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk);process.stdin.on("end",()=>process.stdout.write(JSON.parse(text).access_token))')
curl --fail -H "Authorization: Bearer $token" http://localhost:3000/api/v1/courses/course-001
```

`course-001` là dữ liệu seed. Redis chỉ là cache; nếu Redis tạm không sẵn sàng, Course đọc từ `course_db`.

Hoặc từ PowerShell:

```powershell
Invoke-RestMethod http://localhost:3002/health
```

Kiểm tra readiness trực tiếp của từng dependency:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml exec -T redis redis-cli ping
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml exec -T rabbitmq rabbitmq-diagnostics -q ping
```

## Logs, dừng và reset

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml logs --no-color
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml down
```

Xóa cả dữ liệu local để kiểm chứng fresh setup hoặc bắt đầu lại từ trạng thái sạch:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml down --volumes --remove-orphans
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml up --build -d --wait
```

Không dùng lệnh reset volume với dữ liệu cần giữ lại.
