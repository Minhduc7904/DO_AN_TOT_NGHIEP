# Docker Compose baseline

Thư mục này chứa manifest orchestration root cho LMS testbed. Baseline hiện tại build Gateway, Auth, Course, Enrollment, Submission, Grading, Notification và Storage Mock từ `lms/`, đồng thời khởi động PostgreSQL, Redis và RabbitMQ bằng image đã pin.

## Yêu cầu

- Docker Engine đang chạy.
- Docker Compose v2 hỗ trợ `docker compose up --wait`.
- Các port mặc định `3000`–`3007`, `5432`, `6379`, `5672` và `15672` chưa bị chiếm, hoặc đã được đổi trong file `.env` local.
- Docker được cấp tối thiểu khoảng 4 GB RAM. Với mức này, build lại toàn bộ image không dùng cache bằng một lệnh `build --no-cache` có thể lỗi `cannot allocate memory` vì các image build song song; khi đó build tuần tự theo mục [Build lại image không dùng cache](#build-lại-image-không-dùng-cache).
- Reset/seed và regression cần toolchain của `lms/` (Node.js `22.13.1`, pnpm `11.19.0`) và dependency đã cài theo [`../lms/README.md`](../lms/README.md#cài-đặt-và-kiểm-tra).

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

`COMPOSE_PROJECT_NAME=aiops-lms` trong `.env.example` quyết định tên container, network và volume. Nếu máy đã có stack hoặc volume `aiops-lms_*` cần giữ, đổi `COMPOSE_PROJECT_NAME` trong `.env` (ví dụ `aiops-lms-fresh-setup`) trước khi kiểm chứng fresh setup; nếu không, `up` dùng lại volume cũ và lệnh reset `down --volumes` bên dưới xóa dữ liệu đó.

Gateway và các business service bật OpenTelemetry mặc định và gửi trace tới `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. Baseline này chưa dựng Collector nên endpoint có thể chưa sẵn sàng; lỗi export không làm service dừng hoặc làm `/health` thất bại. Đặt `OTEL_SDK_DISABLED=true` để tắt bootstrap, hoặc đổi endpoint khi có OTLP backend cục bộ.

## Validate và khởi động

Chạy từ repository root:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml config
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml up --build -d --wait
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml ps
```

Grading nhận RabbitMQ URL (kèm credential từ `.env`) và publish `grade.completed` lên exchange `lms.events`; Grading phụ thuộc RabbitMQ healthy khi khởi động nhưng vẫn tự phục hồi nếu broker dừng rồi bật lại. Notification có thể mở HTTP khi RabbitMQ tạm unavailable, sau đó tự reconnect với một loop duy nhất. Service khai báo queue durable `notification.grade-completed.v1`, bind routing key `grade.completed`, deduplicate in-memory theo `event_id` với TTL 24 giờ/tối đa 10.000 ID và chỉ ack sau khi xử lý mô phỏng thành công. Cache không bền qua restart và không cung cấp exactly-once; fault slowdown mặc định tắt.

Compose chỉ báo thành công sau khi Gateway, Auth, Course, Enrollment, Submission, Grading, Notification, Storage Mock, PostgreSQL, Redis và RabbitMQ đều healthy. PostgreSQL tạo `auth_db`, `course_db`, `enrollment_db`, `submission_db` và `grading_db` riêng; các service có persistence tự chạy migration/seed trước khi mở HTTP. Script khởi tạo PostgreSQL chỉ chạy trên volume mới; với volume cũ chưa có `grading_db`, reset volume theo hướng dẫn bên dưới. Credential lấy từ `.env`, không đặt trực tiếp trong manifest Compose.

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

### Build lại image không dùng cache

Khi Docker chỉ có khoảng 4 GB RAM, build từng image có Dockerfile theo thứ tự rồi khởi động bằng image vừa build:

```bash
for service in gateway auth course enrollment submission submission-storage-mock grading notification; do
  docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml build --no-cache "$service"
done
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml up -d --wait
```

## Reset/seed Testbed có kiểm soát

Entrypoint canonical chạy từ repository root:

```powershell
pnpm --dir lms run testbed:reset -- --environment local --project aiops-lms-local --confirm aiops-lms-local --compose-env-file ../docker-compose/.env
```

Bash trên Linux/macOS: chạy từ thư mục `lms/` để Corepack dùng đúng pnpm `11.19.0` (xem [`../lms/README.md`](../lms/README.md#cài-đặt-và-kiểm-tra)):

```bash
cd lms
pnpm run testbed:reset -- --environment local --project aiops-lms-local --confirm aiops-lms-local --compose-env-file ../docker-compose/.env
```

Project `aiops-lms-local` dùng cùng host port trong `.env` với stack ở các mục trên. Dừng stack đó (`docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml down`) trước khi reset. Tương tự, dừng project `aiops-lms-local` từ repository root trước khi chạy regression bên dưới:

```bash
docker compose --project-name aiops-lms-local --env-file docker-compose/.env -f docker-compose/compose.yaml down
```

Option canonical là `--compose-env-file` để không xung đột với option runtime `--env-file` của Node/Corepack khi PowerShell resolve `pnpm.ps1`. CLI vẫn nhận `--env-file` cho direct Node invocation hoặc automation cũ, nhưng sẽ in cảnh báo deprecated; không truyền đồng thời hai option.

Lệnh chỉ chấp nhận `local`, hoặc `test` với project `aiops-lms-test-*`; project local phải là `aiops-lms-local`. `--confirm` phải khớp chính xác project, còn env file và Compose file phải nằm trong repository. `production`, target rộng, file ngoài repository hoặc tham số thiếu đều bị từ chối trước khi gọi Docker.

Quy trình chỉ tác động project đã xác nhận: `down --volumes --remove-orphans`, sau đó `up --build -d --wait`, kiểm tra toàn bộ service healthy và tạo fingerprint seed. Fingerprint gồm dữ liệu năm database nhưng loại `password_hash`, Redis phải có `DBSIZE=0`, RabbitMQ phải có queue Notification durable/rỗng và Storage Mock phải có `object_count=0`. Student và instructor dùng UUID cố định; các seed Enrollment, Submission và Grading dùng cùng UUID student.

Nếu một bước lỗi, lệnh dừng với exit code khác `0` và không in thông báo thành công. Xem log bằng đúng project đã xác nhận, sửa nguyên nhân rồi chạy lại toàn bộ lệnh; không bỏ `--confirm` và không đổi sang project dùng chung khác.

## Regression Testbed MVP

Regression chạy từ dữ liệu sạch và kiểm chứng hai workflow xuyên service, topology, lỗi dependency và telemetry. Chạy từ thư mục `lms/` sau khi đã dừng các project Compose đang dùng cùng host port:

```bash
cd lms
pnpm run test:regression -- --compose-env-file ../docker-compose/.env
```

Lệnh lần lượt build workspace, reset/seed project cô lập `aiops-lms-test-regression` (in `TESTBED_FINGERPRINT_SHA256`), chạy năm test E2E (`login → course → enroll → submit`, `submit → grade → grade.completed → notification`, topology, timeout HTTP và dependency unavailable) rồi chạy messaging failure/recovery ba vòng. Thành công khi exit code là `0` và log kết thúc bằng `[regression] Testbed MVP regression hoàn tất.`; khi lỗi, thông báo nêu workflow, bước và service gây lỗi.

Stack regression vẫn chạy sau khi lệnh kết thúc. Dọn project từ repository root:

```bash
docker compose --project-name aiops-lms-test-regression --env-file docker-compose/.env -f docker-compose/compose.yaml down --volumes --remove-orphans
```
