# Docker Compose baseline

Thư mục này chứa manifest orchestration root cho LMS testbed. Baseline hiện tại build Gateway, Auth, Student, Course, Media (+ worker), Notification (+ worker), Scheduler (+ worker) và AI từ `lms/`, đồng thời khởi động PostgreSQL, RabbitMQ, MinIO, Mailpit.

> **Tách `aiops-platform/` (R-02):** 5 backend observability (Collector, Prometheus, Tempo, Loki, Grafana) cùng cấu hình đã chuyển sang [`../aiops-platform/observability/`](../aiops-platform/observability/) với `compose.yaml` và `.env.example` riêng. Có ba cách chạy:
>
> - `compose.yaml`: chỉ LMS.
> - `../aiops-platform/observability/compose.yaml`: chỉ stack observability.
> - `compose.full.yaml`: ghép cả hai trong một project (dùng `include`), là file mặc định của script reset/seed, smoke observability và CI.
>
> Hai bên nối với nhau qua network `aiops-net` (biến `AIOPS_NETWORK_NAME`); service LMS chỉ gửi OTLP/HTTP tới `otel-collector:4318`. Các lệnh bên dưới dùng `compose.full.yaml` khi cần đủ 18 thành phần; mục observability ở dưới sẽ chuyển về `aiops-platform/` khi viết lại tài liệu ở R-12. Đường dẫn `observability/…` trong các mục đó nay là `../aiops-platform/observability/…`.

> **Hạ tầng topology v2 (R-03):** `compose.yaml` đã thêm `student` (service mẫu Prisma, cổng host `3012`), `minio` + `minio-init` (5 bucket `images`, `videos`, `documents`, `audios`, `other`; API `9000`, console `9001`), `mailpit` (SMTP `1025`, UI `8025`) và các DB `student_db`, `media_db`, `notification_db`, `scheduler_db`, `ai_db` kèm role riêng (`postgres-init/02-create-v2-databases.sh`). Từ R-05 `enrollment`, `submission`, `grading`, `submission-storage-mock` và Redis đã bị gỡ; từ R-07 `notification` là service v2 (cổng `3006`) kèm `notification-worker` (cổng `3007`, gửi email qua Mailpit); từ R-08 `ai` (cổng `3009`, gateway LLM, sở hữu trích xuất tài liệu và job AI soạn bài; API key provider mã hóa bằng `AI_ENCRYPTION_KEY`) kèm `ai-worker` (cổng `3011`, nhận command trích xuất/chạy job, gọi `course` và `media`), `course` chỉ là facade; từ R-09 `scheduler` (cổng `3008` trong network, publish ra host `3018` vì `3008` thuộc Grafana) kèm `scheduler-worker` (cổng `3010`, job `MEDIA_UNUSED_CLEANUP` gọi `media`). Volume Postgres cũ còn `course_db` của v1 phải tạo lại (`down --volumes`) vì `course` v2 dùng Prisma và role riêng `course_user`. Container v2 chạy `prisma migrate deploy` trước khi khởi động.

## Yêu cầu

- Docker Engine đang chạy.
- Docker Compose v2 hỗ trợ `docker compose up --wait`.
- Các port mặc định `3000`–`3006`, `3012`, `5432`, `5672`, `15672`, `9000`–`9001`, `1025` và `8025` chưa bị chiếm, hoặc đã được đổi trong file `.env` local.
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

Cả 5 application runtime gửi OTLP HTTP tới `http://otel-collector:4318/v1/traces` qua network nội bộ. Collector và các backend được bật mặc định, không cần profile. Lỗi export không làm service dừng hoặc làm `/health` thất bại. Đặt `OTEL_SDK_DISABLED=true` để tắt SDK; không dùng `localhost` làm endpoint container tới container. Nếu `.env` được sao chép trước W10, đổi `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` từ loopback cũ sang hostname Collector ở trên; giá trị trong env local ghi đè mặc định Compose.

## Validate và khởi động

Chạy từ repository root:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml config
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml up --build -d --wait
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml ps
```

Course tự chạy `prisma migrate deploy` trước khi mở HTTP (cổng `3003`, database `course_db` với role riêng `course_user`). Notification tự chạy `prisma migrate deploy` (cổng `3006`, `notification_db` với role `notification_user`); `notification-worker` dùng cùng image, chờ `notification` healthy, gửi email qua Mailpit (`mailpit:1025`, xem thư tại `http://localhost:8025`) và gọi `student` bằng service token `notification-worker`. `ai` (`ai_db`, role `ai_user`) tự migrate; `ai-worker` dùng cùng image, chờ `ai` healthy và gọi `course`, `media` bằng service token `ai-worker`; `AI_WORKER_LEASE_MS` phải lớn hơn `AI_COMPLETION_TIMEOUT_MS`. `scheduler` (`scheduler_db`, role `scheduler_user`) tự migrate; `scheduler-worker` dùng cùng image, chờ `scheduler` và `media` healthy rồi gọi `media` bằng service token `scheduler-worker` (scope `media:cleanup`).

Compose chỉ báo thành công sau khi Gateway, Auth, Student, Course, Media, Media Worker, Notification, Notification Worker, AI, AI Worker, Scheduler, Scheduler Worker, PostgreSQL, MinIO, `minio-init`, Mailpit, RabbitMQ, Collector, Prometheus, Tempo, Loki và Grafana (22 thành phần) đều healthy. PostgreSQL tạo `auth_db`, `student_db`, `course_db`, `media_db`, `notification_db`, `scheduler_db` và `ai_db` riêng, mỗi DB một role; các service có persistence tự chạy `prisma migrate deploy` trước khi mở HTTP. Script khởi tạo PostgreSQL chỉ chạy trên volume mới; với volume cũ (còn DB hoặc bảng v1), reset volume theo hướng dẫn bên dưới. Credential lấy từ `.env`, không đặt trực tiếp trong manifest Compose.

## Kiểm tra

Kiểm tra Course từ Bash:

```bash
curl --fail http://localhost:3003/ready
```

Kiểm tra Auth từ Bash:

```bash
curl --fail http://localhost:3001/health
```

Kiểm tra luồng Gateway → Course từ Bash (tài khoản mẫu trong `.env.example`):

```bash
login=$(curl --fail --silent --show-error -H 'content-type: application/json' -d '{"email":"instructor@example.test","password":"example-password"}' http://localhost:3000/api/v1/auth/instructor/login)
token=$(printf '%s' "$login" | node -e 'let text="";process.stdin.on("data",chunk=>text+=chunk);process.stdin.on("end",()=>process.stdout.write(JSON.parse(text).data.access_token))')
curl --fail -H "Authorization: Bearer $token" -H 'content-type: application/json' -d '{"name":"Khóa học thử"}' http://localhost:3000/api/v1/courses
curl --fail -H "Authorization: Bearer $token" http://localhost:3000/api/v1/courses
```

Stack mới không seed khóa học. Dữ liệu quy mô lớn do seeder tạo, chạy sau khi stack đã lên và các service đã migrate (từ thư mục `lms/`):

```bash
pnpm run seed:data -- --environment local --compose-env-file ../docker-compose/.env
```

Seeder hiện giao diện terminal để chọn database, nhập số dòng từng bảng và xem tiến độ; chạy lại sẽ dọn dữ liệu seed cũ (id bắt đầu bằng `5eed`) rồi nạp lại. Hướng dẫn từng bước: [`docs/processed/guides/seed-data-guide.md`](../docs/processed/guides/seed-data-guide.md); thiết kế: `lms/scripts/seed-data/README.md`.

Hoặc từ PowerShell:

```powershell
Invoke-RestMethod http://localhost:3003/ready
```

Kiểm tra readiness trực tiếp của từng dependency:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml exec -T rabbitmq rabbitmq-diagnostics -q ping
```

## Logs, dừng và reset

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml logs --no-color
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml down
```

Log của tám application runtime là JSON một dòng (timestamp UTC, level, message, resource identity, `trace_id`/`span_id` khi có span). Cùng nội dung được gửi OTLP qua Collector tới Loki, nên khi điều tra theo trace nên dùng Loki thay vì `docker compose logs`; xem [structured logs](../lms/packages/observability/README.md#structured-logs-w10).

Xóa cả dữ liệu local để kiểm chứng fresh setup hoặc bắt đầu lại từ trạng thái sạch:

```bash
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml down --volumes --remove-orphans
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml up --build -d --wait
```

Không dùng lệnh reset volume với dữ liệu cần giữ lại.

### Build lại image không dùng cache

Khi Docker chỉ có khoảng 4 GB RAM, build từng image có Dockerfile theo thứ tự rồi khởi động bằng image vừa build:

```bash
for service in gateway auth student course media notification ai scheduler; do
  docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml build --no-cache "$service"
done
docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml up -d --wait
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

Project `aiops-lms-local` dùng cùng host port trong `.env` với stack ở các mục trên. Dừng stack đó (`docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml down`) trước khi reset. Tương tự, dừng project `aiops-lms-local` từ repository root trước khi chạy regression bên dưới:

```bash
docker compose --project-name aiops-lms-local --env-file docker-compose/.env -f docker-compose/compose.full.yaml down
```

Option canonical là `--compose-env-file` để không xung đột với option runtime `--env-file` của Node/Corepack khi PowerShell resolve `pnpm.ps1`. CLI vẫn nhận `--env-file` cho direct Node invocation hoặc automation cũ, nhưng sẽ in cảnh báo deprecated; không truyền đồng thời hai option.

Lệnh chỉ chấp nhận `local`, hoặc `test` với project `aiops-lms-test-*`; project local phải là `aiops-lms-local`. `--confirm` phải khớp chính xác project, còn env file và Compose file phải nằm trong repository. `production`, target rộng, file ngoài repository hoặc tham số thiếu đều bị từ chối trước khi gọi Docker.

Quy trình chỉ tác động project đã xác nhận: `down --volumes --remove-orphans`, sau đó `up --build -d --wait`, kiểm tra toàn bộ service healthy và tạo fingerprint seed. Fingerprint gồm dữ liệu `auth_db`, `student_db`, `course_db` (khóa học, ghi danh) nhưng loại `password_hash`, và RabbitMQ phải có queue snapshot của `notification-worker` (`notification-worker--snapshot-notification-batch-v1`) durable/rỗng. Student và instructor dùng UUID cố định (bootstrap của `auth`).

Nếu một bước lỗi, lệnh dừng với exit code khác `0` và không in thông báo thành công. Xem log bằng đúng project đã xác nhận, sửa nguyên nhân rồi chạy lại toàn bộ lệnh; không bỏ `--confirm` và không đổi sang project dùng chung khác.

## Regression LMS

Regression dựng stack LMS từ dữ liệu sạch (chỉ `docker-compose/compose.yaml`, không observability) rồi chạy bảy workflow qua Gateway, mỗi workflow một file trong `lms/test/regression/`:

| Workflow | File | Nội dung chính |
| --- | --- | --- |
| Đăng ký, đăng nhập | `auth-register-login.regression.mjs` | Ba cửa đăng nhập, refresh xoay vòng, phân quyền, từ chối danh tính tự khai |
| Soạn khóa học | `course-authoring.regression.mjs` | Khóa học, bài học (thứ tự), quiz, xuất bản, tìm kiếm, export CSV |
| Ghi danh và học | `enroll-and-learn.regression.mjs` | Ghi danh, tiến độ, làm quiz và chấm điểm |
| Upload media | `media-upload.regression.mjs` | Upload trực tiếp MinIO, thumbnail, Range, usage và đồng bộ markdown |
| Thông báo hàng loạt | `notification-batch-email.regression.mjs` | Thông báo đơn, đợt gửi, email trong Mailpit, inbox |
| AI soạn bài | `ai-lesson.regression.mjs` | Cấu hình provider (provider AI giả trong container), trích xuất, soạn bài, sinh quiz |
| Dọn media | `media-cleanup-scheduler.regression.mjs` | Scheduler gọi media dọn media không dùng, chạy lặp cùng khóa không trùng |

Chạy từ thư mục `lms/` sau khi đã dừng các project Compose đang dùng cùng host port:

```bash
cd lms
pnpm run test:regression
```

Lệnh build `contracts` (schema dùng kiểm mọi response), `down --volumes` rồi `up --build -d --wait` project `aiops-lms-test-regression` với `docker-compose/.env.example` (đổi bằng `--compose-env-file`), dựng container provider AI giả cùng network, chạy bảy workflow tuần tự (`node --test`) và dọn stack. Thêm `--keep` để giữ stack sau khi chạy. Thành công khi exit code là `0` và log kết thúc bằng `[regression] Regression LMS hoàn tất.`; khi lỗi, thông báo của test nêu bước và response gây lỗi. Regression chỉ kiểm chức năng; telemetry xuyên service do smoke observability đảm nhận.

Có thể chạy riêng từng workflow trên một stack đã có: đặt `REGRESSION_GATEWAY_URL` và `REGRESSION_MAILPIT_URL` (mặc định `http://127.0.0.1:3000` và `http://127.0.0.1:8025`) rồi `node --test lms/test/regression/<workflow>.regression.mjs`. Workflow AI chỉ chạy khi có `REGRESSION_AI_PROVIDER_URL` (URL provider mà container `ai` gọi tới được).

Bộ request tương đương cho Postman và newman nằm ở [postman/README.md](../postman/README.md).

## Observability baseline W10

| Backend           | Image gốc đã pin                               | Endpoint host mặc định                            | Readiness trong container |
| ----------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------- |
| Collector Contrib | `otel/opentelemetry-collector-contrib:0.163.1` | OTLP HTTP `127.0.0.1:4318`, gRPC `127.0.0.1:4317` | `http://127.0.0.1:13133/` |
| Prometheus        | `prom/prometheus:v3.15.0`                      | [Prometheus](http://127.0.0.1:9090)               | `/-/ready`                |
| Tempo             | `grafana/tempo:3.1.0`                          | [Tempo API](http://127.0.0.1:3200/ready)          | `/ready`                  |
| Loki              | `grafana/loki:3.7.9`                           | [Loki API](http://127.0.0.1:3100/ready)           | `/ready`                  |
| Grafana           | `grafana/grafana:13.2.4`                       | [Grafana](http://127.0.0.1:3008)                  | `/api/health`             |

Năm image dẫn xuất chỉ thêm executable `/health-probe` (Go static, builder `golang:1.25.8-alpine`) và thư mục dữ liệu được gán quyền cho user gốc. Probe yêu cầu HTTP 200, timeout 2 giây và exit khác 0 khi endpoint lỗi; không cần shell/curl/wget. Entrypoint và user runtime gốc được giữ. Các image ứng dụng và dữ liệu nghiệp vụ không đổi.

Các port observability chỉ bind loopback, đổi bằng biến môi trường shell hoặc `../aiops-platform/observability/.env`: `OTEL_HTTP_PORT`, `OTEL_GRPC_PORT`, `PROMETHEUS_PORT`, `TEMPO_PORT`, `LOKI_PORT`, `GRAFANA_PORT`; các hostname/port nội bộ giữ nguyên. Gateway đang dùng 3000 nên Grafana dùng 3008. Đăng nhập Grafana bằng `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` trong env local (mẫu `admin`/`grafana-local-only`, tuyệt đối không dùng production). Compose bắt buộc có `GRAFANA_ADMIN_PASSWORD`, khai báo trong `../aiops-platform/observability/.env.example` (ghi đè bằng biến môi trường shell khi cần) và không có giá trị mặc định trong compose; giá trị mẫu chỉ là credential local, Grafana chỉ bind loopback. Grafana tự provision datasource Prometheus/Tempo/Loki và dashboard service overview, xem [dashboard W10](#dashboard-và-nghiệm-thu-w10).

Collector nhận OTLP HTTP/gRPC, batch tối đa 1024 record (gửi sau 1 giây hoặc 512 record), memory limiter 192 MiB/spike 48 MiB. Trace/log exporter retry tối đa 30 giây, hàng đợi 256 batch với 2 worker, không bền qua restart. Traces chuyển tới Tempo HTTP 4318; metrics chuyển tới Prometheus exporter 8889, Prometheus scrape mỗi 5 giây; logs chuyển tới Loki native OTLP `/otlp/v1/logs`. Chỉ promote ba resource identity vào metric labels; Loki chỉ index `service.name`, version/instance là structured metadata. Telemetry mẫu không chứa secret/PII hoặc fault truth.

| Thành phần | Giới hạn RAM | CPU | Lưu trữ                                                              |
| ---------- | ------------ | --- | -------------------------------------------------------------------- |
| Collector  | 256 MiB      | 0.5 | Hàng đợi trong RAM                                                   |
| Prometheus | 512 MiB      | 0.5 | `prometheus-data`, retention 24 giờ hoặc 512 MB tùy ngưỡng đến trước |
| Tempo      | 512 MiB      | 0.5 | `tempo-data`, WAL/blocks local, retention 24 giờ                     |
| Loki       | 512 MiB      | 0.5 | `loki-data`, filesystem/TSDB v13, retention 24 giờ                   |
| Grafana    | 512 MiB      | 0.5 | `grafana-data`, cấu hình/UI state local                              |

Retention là chính sách xóa bất đồng bộ, không phải hard disk quota; khi đầy disk hoặc vượt RAM, telemetry có thể mất dù request nghiệp vụ vẫn chạy. Đây là MVP một node, chưa có HA/TLS/SSO/long-term storage. Tempo 3 dùng `backend_worker.compaction`, không dùng cấu hình `compactor` của Tempo 2. Cấu hình Loki native OTLP theo [tài liệu chính thức](https://grafana.com/docs/loki/latest/send-data/otel/); cấu hình Tempo theo [ví dụ v3.1.0](https://github.com/grafana/tempo/blob/v3.1.0/example/docker-compose/single-binary/tempo.yaml).

Sau `up --build -d --wait`, kiểm chứng dữ liệu thật từ thư mục `lms/`:

```bash
pnpm run test:observability:stack
```

Smoke gửi ba payload OTLP JSON qua Collector; dùng trace ID/marker ngẫu nhiên để query Tempo và Loki, dùng timestamp value mới để query Prometheus (không dùng marker làm metric label). Mỗi backend được poll tối đa 90 giây; mỗi HTTP request timeout 5 giây; thất bại trả exit code khác 0. Với port host tùy biến, truyền các biến port tương ứng vào môi trường tiến trình Node (script không tự đọc Compose env file).

Ví dụ query: PromQL `{service_name="observability-smoke",__name__=~"observability_smoke_timestamp.*"}`; Tempo `/api/traces/<trace-id>` từ output smoke; LogQL `{service_name="observability-smoke"} |= "<marker>"` trong khoảng thời gian smoke. Marker chỉ ở span/log body, không phải metric/Loki index label. Application trace coverage và metrics đầy đủ được nghiệm thu tại task-02/03.

Tắt riêng backend và giữ dữ liệu bằng `docker compose --env-file docker-compose/.env -f docker-compose/compose.full.yaml stop otel-collector prometheus tempo loki grafana`; application có thể tiếp tục chạy nhưng mất export. Dùng `up -d --wait` để bật lại. `down` xóa container/network nhưng giữ named volume. **`down --volumes` và reset/seed xóa cả dữ liệu nghiệp vụ lẫn telemetry của project đã xác nhận**, không giữ lịch sử observability qua reset. Không chạy reset project phát triển nếu cần giữ bằng chứng.

Kiểm chứng phá hủy chỉ trong project test cô lập và không chạy cùng project khác chiếm host port:

```bash
cd lms
pnpm run test:testbed:reset:compose
```

Test reset hai lần trên `aiops-lms-test-reset-seed`, so fingerprint, xác nhận 22 thành phần healthy, chạy smoke sau mỗi reset và xác nhận trace cũ trả 404 sau reset. Test tự dọn đúng project test cùng volume trong `finally`. Khi RAM/build cache hạn chế, đặt `COMPOSE_PARALLEL_LIMIT=1` trước các lệnh Compose/reset/regression để tránh build đồng thời.

## Metrics runtime và broker W10

Cả 8 application runtime bật metrics với `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4318/v1/metrics`, `OTEL_METRIC_EXPORT_INTERVAL=5000`. Nếu env local cũ chưa có biến, Compose dùng mặc định; endpoint traces riêng vẫn giữ tương thích. Không tắt metrics tự động khi Collector unavailable; SDK export ngoài request path và có thể mất dữ liệu khi buffer/retry hết.

Collector có thêm pipeline broker scrape nội bộ port 15692 từ plugin RabbitMQ đã bật; chỉ queue canonical `notification.grade-completed.v1` và ba depth gauge. Nếu thay tên queue, phải cập nhật mapping exact queue trước khi dùng số liệu; không coi missing là 0. CPU/RSS của tám application đo từ process; broker gauge chỉ enrich ownership Notification (`service_name=notification`, `dependency_identity=notification-rabbitmq`) và xóa `service_version`/`service_instance_id`, không giả resource identity của application process. Các series `up`/`scrape_*` do receiver tự sinh bị lọc bỏ khỏi pipeline broker.

Registry/labels/buckets/query và giới hạn nằm tại [metrics baseline](../lms/packages/observability/README.md#metrics-baseline-w10). `test:observability:metrics` chỉ chấp nhận project test đã xác nhận, tạm stop Notification/Collector và restore trong `finally`, không chạy cùng test fault khác. CI chạy sau regression/tracing khi Compose đã sẵn sàng.

## Structured logs W10

Cả 8 application runtime bật logs với `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://otel-collector:4318/v1/logs`. Nếu env local cũ chưa có biến, Compose dùng mặc định. Collector chuyển logs qua pipeline `logs` có sẵn tới Loki native OTLP; Loki chỉ index `service_name`, còn `trace_id`, `span_id`, severity và field chẩn đoán là structured metadata. Mỗi request HTTP (trừ `/health`) có một access log `http.server.request`; đặt `HTTP_ACCESS_LOG_ENABLED=false` để tắt access log, log lỗi vẫn giữ. Contract field, redaction, query mẫu và `test:observability:logs` nằm tại [structured logs](../lms/packages/observability/README.md#structured-logs-w10). CI chạy bước này sau metrics khi Compose đã sẵn sàng.

## Dashboard và nghiệm thu W10

Grafana provision từ file trong repo, không lưu thay đổi trên UI (`allowUiUpdates: false`):

- `../aiops-platform/observability/grafana-datasources.yaml`: ba datasource uid `prometheus`/`tempo`/`loki`. Tempo có `tracesToLogsV2` mở log Loki của span theo `{service_name="<service.name>"} | trace_id="<trace>"`, khoảng thời gian span ±5 phút. Loki có derived field `trace_id` (structured metadata) mở trace trong Tempo. Biến Grafana viết `$${...}` vì provisioning tự thay `${...}` bằng biến môi trường.
- `../aiops-platform/observability/grafana-dashboards.yaml`: provider đọc mọi JSON trong `../aiops-platform/observability/dashboards/` vào folder "AIOps LMS". Thêm dashboard mới chỉ cần thêm file JSON có `uid` cố định.
- `../aiops-platform/observability/dashboards/service-overview.json`: dashboard [AIOps LMS — Service overview](http://127.0.0.1:3008/d/aiops-lms-service-overview), timezone UTC, biến `service` chỉ gồm business service (bỏ `submission-storage`).

| Nhóm                 | Panel                                                                                                          | Nguồn                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| RED theo service     | Request rate, error ratio (5xx + `client_aborted`), latency p95                                                | `http_server_request_*`, bỏ `/health`                                                                    |
| RED theo route       | Request rate theo route/status class, latency p95 theo route                                                   | `http_route_template` bounded                                                                            |
| Dependency và broker | Dependency lỗi theo `dependency_identity`/`status`, dependency latency p95, backlog RabbitMQ và outbox Grading | `*_dependency_*`, `grading_messaging_*`, `notification_rabbitmq_*`, `rabbitmq_detailed_queue_messages_*` |
| Trace và log         | Trace lỗi gần đây (TraceQL), log `ERROR`/`FATAL`, log volume theo severity                                     | Tempo, Loki                                                                                              |

Điều tra một lỗi: click series trên panel RED/dependency → data link mở TraceQL cùng service (server span lỗi, span chậm hoặc theo route) → mở trace → "Logs for this span" chạy query Loki theo `trace_id` → trong log, link `trace_id` quay lại Tempo. Metric chưa có exemplar nên bước metric → trace lọc theo service/route/thời gian, không nhảy thẳng tới một trace.

Nghiệm thu trên dữ liệu thật, sau khi Compose healthy trong project test cô lập:

```bash
cd lms
pnpm run test:observability:acceptance -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script gọi Grafana bằng credential trong env file và kiểm:

1. Ba datasource healthy; `tracesToLogsV2` và derived field đúng cấu hình; dashboard đã provision, timezone UTC; query không dùng `/health` hay field định danh (`user_id`, `email`, `event_id`...).
2. Chạy tracing smoke để sinh workflow healthy và lỗi storage timeout/unavailable. Lấy giá trị biến `service` bằng chính label query của dashboard (phải đúng 7 business service), rồi chạy mọi query panel qua Grafana: panel nào không có dữ liệu thì fail. Biến được thay như Grafana làm trên UI với `service` = All và khoảng 30 phút: regex `(a|b)` cho Prometheus/Loki, `a|b` cho Tempo (format `Pipe` của plugin Tempo), `$__rate_interval` 20s, `$__auto` 2s. Smoke không mở trình duyệt, nên đây là mô phỏng theo mã nguồn Grafana 13.2.4 chứ không phải ảnh chụp UI.
3. Với mỗi lỗi: panel Error ratio thấy lỗi Gateway, panel Dependency lỗi thấy `submission-storage` đúng `status`; TraceQL từ data link của cả hai panel (lọc theo `span.dependency_identity` với panel dependency) trả đúng trace; query `tracesToLogsV2` trả `http.server.error` (503/504) và `dependency.failure` có `span_id` khớp server/client span, `error_type` khớp `error.type` của span, thời điểm log nằm trong span.
4. `grade.completed`: consumer Notification là con của producer Grading trong cùng trace; log `outcome=accepted` thuộc span phía consumer; Gateway có access log trong trace healthy.
5. Resource identity trong Tempo, Loki và Prometheus khớp `OTEL_SERVICE_VERSION`/`OTEL_SERVICE_INSTANCE_ID` của Compose, không phải container name.

Output cuối là JSON gồm commit, thời điểm UTC, số điểm dữ liệu từng panel, trace ID, TraceQL và LogQL đã chạy; dùng làm bằng chứng nghiệm thu. CI chạy bước này sau logs smoke.
