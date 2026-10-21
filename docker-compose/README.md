# Docker Compose baseline

Thư mục này chứa manifest orchestration root cho LMS testbed. Baseline hiện tại build Gateway, Auth, Course, Enrollment, Submission, Grading, Notification và Storage Mock từ `lms/`, đồng thời khởi động PostgreSQL, Redis, RabbitMQ và 5 backend observability bằng image đã pin.

## Yêu cầu

- Docker Engine đang chạy.
- Docker Compose v2 hỗ trợ `docker compose up --wait`.
- Các port mặc định `3000`–`3007`, `5432`, `6379`, `5672` và `15672` chưa bị chiếm, hoặc đã được đổi trong file `.env` local.
- Docker được cấp khoảng 8 GB RAM khi bật cả observability. Với bộ nhớ hạn chế, build lại toàn bộ image không dùng cache bằng một lệnh `build --no-cache` có thể lỗi `cannot allocate memory` vì các image build song song; khi đó build tuần tự theo mục [Build lại image không dùng cache](#build-lại-image-không-dùng-cache).
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

Cả 8 application runtime gửi OTLP HTTP tới `http://otel-collector:4318/v1/traces` qua network nội bộ. Collector và các backend được bật mặc định, không cần profile. Lỗi export không làm service dừng hoặc làm `/health` thất bại. Đặt `OTEL_SDK_DISABLED=true` để tắt SDK; không dùng `localhost` làm endpoint container tới container. Nếu `.env` được sao chép trước W10, đổi `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` từ loopback cũ sang hostname Collector ở trên; giá trị trong env local ghi đè mặc định Compose.

## Validate và khởi động

Chạy từ repository root:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml config
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml up --build -d --wait
docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml ps
```

Grading nhận RabbitMQ URL (kèm credential từ `.env`) và publish `grade.completed` lên exchange `lms.events`; Grading phụ thuộc RabbitMQ healthy khi khởi động nhưng vẫn tự phục hồi nếu broker dừng rồi bật lại. Notification có thể mở HTTP khi RabbitMQ tạm unavailable, sau đó tự reconnect với một loop duy nhất. Service khai báo queue durable `notification.grade-completed.v1`, bind routing key `grade.completed`, deduplicate in-memory theo `event_id` với TTL 24 giờ/tối đa 10.000 ID và chỉ ack sau khi xử lý mô phỏng thành công. Cache không bền qua restart và không cung cấp exactly-once; fault slowdown mặc định tắt.

Compose chỉ báo thành công sau khi Gateway, Auth, Course, Enrollment, Submission, Grading, Notification, Storage Mock, PostgreSQL, Redis, RabbitMQ, Collector, Prometheus, Tempo, Loki và Grafana (16 thành phần) đều healthy. PostgreSQL tạo `auth_db`, `course_db`, `enrollment_db`, `submission_db` và `grading_db` riêng; các service có persistence tự chạy migration/seed trước khi mở HTTP. Script khởi tạo PostgreSQL chỉ chạy trên volume mới; với volume cũ chưa có `grading_db`, reset volume theo hướng dẫn bên dưới. Credential lấy từ `.env`, không đặt trực tiếp trong manifest Compose.

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


## Observability baseline W10

| Backend | Image gốc đã pin | Endpoint host mặc định | Readiness trong container |
| --- | --- | --- | --- |
| Collector Contrib | `otel/opentelemetry-collector-contrib:0.163.1` | OTLP HTTP `127.0.0.1:4318`, gRPC `127.0.0.1:4317` | `http://127.0.0.1:13133/` |
| Prometheus | `prom/prometheus:v3.15.0` | [Prometheus](http://127.0.0.1:9090) | `/-/ready` |
| Tempo | `grafana/tempo:3.1.0` | [Tempo API](http://127.0.0.1:3200/ready) | `/ready` |
| Loki | `grafana/loki:3.7.9` | [Loki API](http://127.0.0.1:3100/ready) | `/ready` |
| Grafana | `grafana/grafana:13.2.4` | [Grafana](http://127.0.0.1:3008) | `/api/health` |

Năm image dẫn xuất chỉ thêm executable `/health-probe` (Go static, builder `golang:1.25.8-alpine`) và thư mục dữ liệu được gán quyền cho user gốc. Probe yêu cầu HTTP 200, timeout 2 giây và exit khác 0 khi endpoint lỗi; không cần shell/curl/wget. Entrypoint và user runtime gốc được giữ. Các image ứng dụng và dữ liệu nghiệp vụ không đổi.

Các port observability chỉ bind loopback, đổi bằng `OTEL_HTTP_PORT`, `OTEL_GRPC_PORT`, `PROMETHEUS_PORT`, `TEMPO_PORT`, `LOKI_PORT`, `GRAFANA_PORT`; các hostname/port nội bộ giữ nguyên. Gateway đang dùng 3000 nên Grafana dùng 3008. Đăng nhập Grafana bằng `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` trong env local (mẫu `admin`/`grafana-local-only`, tuyệt đối không dùng production). Grafana tự provision datasource Prometheus/Tempo/Loki; dashboard và structured application logs thuộc task khác, chưa được nghiệm thu tại đây.

Collector nhận OTLP HTTP/gRPC, batch tối đa 1024 record (gửi sau 1 giây hoặc 512 record), memory limiter 192 MiB/spike 48 MiB. Trace/log exporter retry tối đa 30 giây, hàng đợi 256 batch với 2 worker, không bền qua restart. Traces chuyển tới Tempo HTTP4318; metrics chuyển tới Prometheus exporter8889, Prometheus scrape mỗi 5 giây; logs chuyển tới Loki native OTLP `/otlp/v1/logs`. Chỉ promote ba resource identity vào metric labels; Loki chỉ index `service.name`, version/instance là structured metadata. Telemetry mẫu không chứa secret/PII hoặc fault truth.

| Thành phần | Giới hạn RAM | CPU | Lưu trữ |
| --- | --- | --- | --- |
| Collector | 256 MiB | 0.5 | Hàng đợi trong RAM |
| Prometheus | 512 MiB | 0.5 | `prometheus-data`, retention 24 giờ hoặc 512 MB tùy ngưỡng đến trước |
| Tempo | 512 MiB | 0.5 | `tempo-data`, WAL/blocks local, retention 24 giờ |
| Loki | 512 MiB | 0.5 | `loki-data`, filesystem/TSDB v13, retention 24 giờ |
| Grafana | 512 MiB | 0.5 | `grafana-data`, cấu hình/UI state local |

Retention là chính sách xóa bất đồng bộ, không phải hard disk quota; khi đầy disk hoặc vượt RAM, telemetry có thể mất dù request nghiệp vụ vẫn chạy. Đây là MVP một node, chưa có HA/TLS/SSO/long-term storage. Tempo 3 dùng `backend_worker.compaction`, không dùng cấu hình `compactor` của Tempo 2. Cấu hình Loki native OTLP theo [tài liệu chính thức](https://grafana.com/docs/loki/latest/send-data/otel/); cấu hình Tempo theo [ví dụ v3.1.0](https://github.com/grafana/tempo/blob/v3.1.0/example/docker-compose/single-binary/tempo.yaml).

Sau `up --build -d --wait`, kiểm chứng dữ liệu thật từ thư mục `lms/`:

```bash
pnpm run test:observability:stack
```

Smoke gửi ba payload OTLP JSON qua Collector; dùng trace ID/marker ngẫu nhiên để query Tempo và Loki, dùng timestamp value mới để query Prometheus (không dùng marker làm metric label). Mỗi backend được poll tối đa 90 giây; mỗi HTTP request timeout 5 giây; thất bại trả exit code khác 0. Với port host tùy biến, truyền các biến port tương ứng vào môi trường tiến trình Node (script không tự đọc Compose env file).

Ví dụ query: PromQL `{service_name="observability-smoke",__name__=~"observability_smoke_timestamp.*"}`; Tempo `/api/traces/<trace-id>` từ output smoke; LogQL `{service_name="observability-smoke"} |= "<marker>"` trong khoảng thời gian smoke. Marker chỉ ở span/log body, không phải metric/Loki index label. Application trace coverage và metrics đầy đủ được nghiệm thu tại task-02/03.

Tắt riêng backend và giữ dữ liệu bằng `docker compose --env-file docker-compose/.env -f docker-compose/compose.yaml stop otel-collector prometheus tempo loki grafana`; application có thể tiếp tục chạy nhưng mất export. Dùng `up -d --wait` để bật lại. `down` xóa container/network nhưng giữ named volume. **`down --volumes` và reset/seed xóa cả dữ liệu nghiệp vụ lẫn telemetry của project đã xác nhận**, không giữ lịch sử observability qua reset. Không chạy reset project phát triển nếu cần giữ bằng chứng.

Kiểm chứng phá hủy chỉ trong project test cô lập và không chạy cùng project khác chiếm host port:

```bash
cd lms
pnpm run test:testbed:reset:compose
```

Test reset hai lần trên `aiops-lms-test-reset-seed`, so fingerprint, xác nhận 16 thành phần healthy, chạy smoke sau mỗi reset và xác nhận trace cũ trả 404 sau reset. Test tự dọn đúng project test cùng volume trong `finally`. Khi RAM/build cache hạn chế, đặt `COMPOSE_PARALLEL_LIMIT=1` trước các lệnh Compose/reset/regression để tránh build đồng thời.


## Metrics runtime và broker W10

Cả8application runtime bật metrics với `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4318/v1/metrics`, `OTEL_METRIC_EXPORT_INTERVAL=5000`. Nếu envlocal cũ chưa có biến, Compose dùng mặc định; endpoint traces riêng vẫn giữ tương thích. Không tắt metrics tự động khi Collectorunavailable; SDK export ngoài requestpath và có thể mất dữ liệu khi buffer/retry hết.

Collector có thêm pipeline broker scrape nội bộ15692 từ plugin RabbitMQ đã bật; chỉ queuecanonical `notification.grade-completed.v1` và ba depthgauges. Nếu thay tên queue, phải cập nhật mappingexactqueue trước dùng sốliệu; không coi missing là0. TámapplicationCPU/RSS đo từ process; broker gauge enrich ownership Notification, không giả resourceidentity của applicationprocess.

Registry/labels/buckets/query và giới hạn nằm tại [metrics baseline](../lms/packages/observability/README.md#metrics-baseline-w10). `test:observability:metrics` chỉ chấp nhận projecttest đã xác nhận, tạm stopNotification/Collector và restorefinally, không chạy cùng testfault khác. CI chạy sau regression/tracing khi Compose đã sẵn sàng.
