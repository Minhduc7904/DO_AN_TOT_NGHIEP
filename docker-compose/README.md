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

12 runtime LMS (8 service và 4 worker) gửi OTLP HTTP tới `http://otel-collector:4318` (`/v1/traces`, `/v1/metrics`, `/v1/logs`) qua network `aiops-net`. Collector và các backend nằm trong [aiops-platform/observability](../aiops-platform/observability/README.md) và chỉ có khi dựng bằng `compose.full.yaml`; `compose.yaml` chạy một mình không có Collector (chưa kiểm chứng hành vi exporter khi thiếu Collector). Đặt `OTEL_SDK_DISABLED=true` để tắt SDK; không dùng `localhost` làm endpoint container tới container.

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

Log của 12 runtime là JSON một dòng (timestamp UTC, level, message, resource identity, `trace_id`/`span_id` khi có span). Cùng nội dung được gửi OTLP qua Collector tới Loki, nên khi điều tra theo trace nên dùng Loki thay vì `docker compose logs`; xem [structured logs](../lms/packages/observability/README.md#structured-logs).

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

## Observability

Cấu hình Collector, Prometheus, Tempo, Loki, Grafana, cổng, mật khẩu Grafana, metric hàng đợi RabbitMQ và dashboard nằm ở [aiops-platform/observability/README.md](../aiops-platform/observability/README.md). Registry metric, nhãn và định dạng log của LMS nằm ở [lms/packages/observability/README.md](../lms/packages/observability/README.md).

Cổng host của observability chỉ bind loopback (`OTEL_HTTP_PORT`, `PROMETHEUS_PORT`, `TEMPO_PORT`, `LOKI_PORT`, `GRAFANA_PORT`). Nếu máy đã có container giữ cổng mặc định (ví dụ Loki 3100), đặt biến tương ứng trước mọi lệnh compose và trước các lệnh smoke, ví dụ `LOKI_PORT=13100`.

## Smoke observability

Smoke đo telemetry xuyên service trên stack `compose.full.yaml` với OTel bật. Chạy từ thư mục `lms/` sau khi dừng các project Compose đang dùng cùng cổng host:

```bash
cd lms
LOKI_PORT=13100 pnpm run test:observability
```

Lệnh dựng project `aiops-lms-test-observability` từ trạng thái sạch (`down --volumes`, rồi `up --build -d --wait`) với `AUTH_SERVICE_TOKEN_TTL_SECONDS=60`, dựng provider AI giả, chạy bảy workflow regression làm traffic, chờ một chu kỳ export rồi chạy tuần tự năm smoke và dọn stack. Thêm `--keep` để giữ stack. Chỉ project có tên `aiops-lms-test-*` được chấp nhận. Kỳ vọng và số đo của từng smoke ghi ở [danh mục case phức tạp](../docs/processed/architecture/complex-case-catalogue-and-rca-result-v0.md#1-tín-hiệu-có-thật-của-testbed-v2) và board R-12.

| Script (`pnpm run …`) | Khẳng định |
| --- | --- |
| `test:observability:stack` | OTLP tổng hợp qua Collector tới Tempo, Prometheus, Loki; Grafana có ba datasource. Không cần traffic LMS. |
| `test:observability:tracing` | Mỗi luồng trong ma trận ([flow-matrix.mjs](../lms/test/observability/support/flow-matrix.mjs)) có một trace chứa đủ service, đúng span gốc, không đứt parent, không span lỗi, `service.version`/`service.instance.id` khớp compose. Kịch bản lỗi: `auth` ngừng phản hồi, login lỗi tại `gateway-auth`; token còn hạn vẫn dùng được; token dịch vụ hết hạn thì request qua gateway lỗi tại `gateway-auth-token`; phục hồi sau `unpause`. |
| `test:observability:logs` | Loki chỉ index `service_name`; 12 runtime có log; `trace_id`/`span_id` khớp span thật trong Tempo; log `dependency.failure` khớp span lỗi; không lộ secret; độ trễ request → log. |
| `test:observability:acceptance` | Grafana: datasource healthy và liên kết trace ↔ log; dashboard provision đúng, không còn thuật ngữ v1; mọi query panel trả dữ liệu; data link metric → TraceQL → Loki; độ trễ thu thập của trace, log, metric. |
| `test:observability:metrics` | RED, CPU, RSS của 12 runtime; 42 cạnh dependency đúng danh mục identity; 24 queue đúng chủ sở hữu và consumer; dừng một worker làm backlog tăng, command sai vào `.error`, drain khi phục hồi; độ trễ request → metric. |
| `test:observability:queue-scrape` | Regex queue của Collector phủ mọi queue canonical trong `contracts`. Không cần Docker; có trong `pnpm test`. |

Bốn smoke giữa (`tracing`, `logs`, `acceptance`, `metrics`) gắn vào stack đã chạy và có traffic, nên chạy riêng được trên một stack đang dùng:

```bash
cd lms
LOKI_PORT=13100 node test/observability/tracing-smoke.mjs --environment test --project aiops-lms-test-<tên> --confirm aiops-lms-test-<tên> --compose-env-file ../docker-compose/.env.example
```

Thứ tự khuyến nghị là `tracing`, `logs`, `acceptance`, `metrics`: `tracing` tạo lỗi mà `logs` và `acceptance` cần, `metrics` dừng một worker nên chạy cuối. `tracing` chỉ chạy kịch bản lỗi khi `auth` có `AUTH_SERVICE_TOKEN_TTL_SECONDS` ≤ 120 (đặt 60 khi dựng stack); ngược lại bỏ qua phần này và in lý do. Biến `OBSERVABILITY_WINDOW_SECONDS` (mặc định 1800) giới hạn khoảng thời gian tìm trace/log.

Lưu ý khi tự truy vấn: Tempo bị giới hạn 512 MiB và đã bị OOM-kill khi kéo hàng nghìn trace song song, nên truy vấn tuần tự và giới hạn số trace. Khi RAM hoặc build cache hạn chế, đặt `COMPOSE_PARALLEL_LIMIT=1` và không dựng nhiều stack đồng thời.

## Reset/seed kiểm chứng phá hủy

Kiểm chứng phá hủy chỉ trong project test cô lập và không chạy cùng project khác chiếm host port:

```bash
cd lms
pnpm run test:testbed:reset:compose
```

Test reset hai lần trên `aiops-lms-test-reset-seed`, so fingerprint, xác nhận 22 thành phần healthy, chạy smoke sau mỗi reset và xác nhận trace cũ trả 404 sau reset. Test tự dọn đúng project test cùng volume trong `finally`. **`down --volumes` và reset/seed xóa cả dữ liệu nghiệp vụ lẫn telemetry của project đã xác nhận**; không chạy reset project phát triển nếu cần giữ bằng chứng.
