# Blueprint triển khai Backend Microservice Testbed v2

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Cập nhật R-13:** `auth` và `student` đã gộp thành service `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)); tài liệu được sửa tại chỗ theo topology 7 service + 4 worker (11 runtime). Các số đo chưa đo lại sau khi gộp được ghi rõ ở chỗ dùng.
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review). Nội dung đối chiếu với code và Compose ngày 29/10/2026; chỗ chưa kiểm ghi rõ "chưa kiểm chứng".
>
> **Thay thế:** [backend_microservice_testbed_blueprint](backend_microservice_testbed_blueprint.md) (giữ làm lịch sử, không dùng cho dataset mới).
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [http-and-event-contracts-v2](http-and-event-contracts-v2.md), [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md), [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md), [dependency-resilience-policy-v2](dependency-resilience-policy-v2.md), [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md), [ADR-003](../adr/adr-003-remove-admin-service-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
>
> **Phạm vi:** vai trò, scope, topology, công nghệ, cấu trúc source code, kiến trúc nội bộ service, contract, instrumentation, runtime, kiểm thử/CI, ranh giới experiment và Definition of Done kỹ thuật của backend testbed.
>
> **Định hướng WHY/WHAT:** [`../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md`](../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md)
>
> **WHEN/WHO:** [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md)

Tài liệu này là tổng quan kiến trúc backend testbed: nó chỉ nêu quyết định và quy ước, còn danh mục chi tiết (service, edge, route, command, bảng dữ liệu, fault) nằm ở các tài liệu v2 ở phần Phụ thuộc và được link tại chỗ, không chép lại. Thứ tự ưu tiên khi mâu thuẫn: ADR-001..004 → catalogue/contract/data-ownership v2 → tài liệu này → các tài liệu còn ở v0/v1. Khi tài liệu và code lệch nhau, **code là chuẩn**: phải sửa tài liệu cùng PR hoặc ghi rõ migration đang diễn ra. Tài liệu không định nghĩa lịch triển khai theo tuần.

## 1. Mục tiêu và nguyên tắc

Backend LMS là System Under Test (SUT), không phải sản phẩm LMS production-grade. Kiến trúc phải tạo được dependency, workload, telemetry, fault propagation và ground truth có kiểm soát mà không làm quá tải một người làm.

Theo [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md), mục tiêu của testbed là tạo ra các case nghiệp vụ phức tạp mà **nguyên nhân gốc nằm ngoài đường request của triệu chứng** (qua dependency dùng chung như RabbitMQ, PostgreSQL, MinIO hoặc qua chuỗi bất đồng bộ), để RCA engine (AI) truy vết còn truy vết thủ công thì khó. Một feature nghiệp vụ chỉ có mặt khi nó tạo dependency/fault có giá trị, cải thiện observability hoặc phục vụ trực tiếp research question; số lượng CRUD không phải tiêu chí mở rộng scope.

Các nguyên tắc bắt buộc:

1. Monorepo theo module kỹ thuật, không theo thành viên.
2. Docker Compose là runtime duy nhất; Kubernetes không thuộc phạm vi.
3. TypeScript + NestJS + Prisma/PostgreSQL cho testbed; phần huấn luyện/RCA, workload và fault nằm trong `aiops-platform/` (xem mục 5).
4. Lightweight hexagonal architecture; mỗi use case là một class riêng (ADR-001).
5. Observability, faultability và reproducibility là yêu cầu thiết kế từ đầu.
6. Không import mã chéo service và không truy cập database chéo service; ranh giới được ESLint (`no-cross-service-imports`) và test kiến trúc ép.
7. Mọi request vào service đều mang service access token; danh tính user chỉ được tin khi request đến từ Gateway (ADR-004).
8. `lms/` không import mã từ `aiops-platform/`; hai bên chỉ nối bằng OTLP/HTTP tới Collector.
9. Analysis/RCA chạy out-of-band, không nằm trên business request path.
10. Không thêm service mesh, framework dashboard riêng hoặc hạ tầng enterprise.

## 2. Kiến trúc hệ thống và service topology

### 2.1. Topology v2

**7 service và 4 worker**; worker là process riêng, cùng image với service tương ứng (`command: ["node", "dist/worker.js"]`), có `service.name` riêng.

```text
gateway  identity  course  media  notification  scheduler  ai
                          media-worker  notification-worker  scheduler-worker  ai-worker
```

Hạ tầng bắt buộc (Compose): PostgreSQL 17 (một instance, **6 logical DB** `identity_db`, `course_db`, `media_db`, `notification_db`, `scheduler_db`, `ai_db`, mỗi DB một role riêng), RabbitMQ, MinIO, Mailpit làm SMTP cho dev/CI, và nhà cung cấp LLM bên ngoài (OpenAI-compatible; test dùng HTTP stub). Không còn Redis, Storage Mock, service `enrollment`/`submission`/`grading`, service `admin` ([ADR-003](../adr/adr-003-remove-admin-service-v1.md)) hay event `grade.completed`.

Dependency graph đầy đủ (HTTP đồng bộ, command qua RabbitMQ, component/dependency, cạnh xác thực) và `service.name`, dependency identity canonical nằm ở [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) mục 2, 5 và 6; blueprint không nhân bản lại. Ba điểm kiến trúc cần nhớ:

- HTTP đồng bộ giữa service đi thẳng tới service owner qua `/internal/v1`, không qua Gateway.
- Quan hệ giữa service và worker là **async logical edge**: transport thật là command qua RabbitMQ.
- Có một vòng phụ thuộc được chấp nhận `course → ai → course` (hai chiều bất đồng bộ qua job, `ai-worker` có `service.name` riêng); xem catalogue mục 6.

Mỗi service chỉ truy cập database do chính nó sở hữu (worker dùng DB của service cùng owner). Tham chiếu chéo service là ID logic, không có foreign key chéo DB. Object trong MinIO thuộc `media`.

### 2.2. Xác thực và hai bề mặt API

Theo [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md):

```text
login:           Client -> Gateway -> identity -> identity_db -> user access token (EdDSA)
request sau login: Client -> Gateway verify user token cục bộ (JWKS)
                   -> Gateway gắn service token của chính nó -> service đích
service-to-service: bên gọi lấy service token từ identity (cache, làm mới nền) -> /internal/v1
```

- `identity` là bên duy nhất giữ khóa riêng Ed25519 (`IDENTITY_SIGNING_KEY_PEM`) và công bố khóa công khai tại `GET /.well-known/jwks.json`; mọi bên khác verify cục bộ bằng JWKS (cache, tải lại khi hết hạn hoặc gặp `kid` lạ). Không có remote introspection cho mỗi request.
- Hai loại token cùng ký EdDSA, phân biệt bằng claim `typ`: user token (TTL mặc định 1 giờ, kèm refresh token 24 giờ) và service token (TTL mặc định 10 phút, không refresh, `aud` = service đích, có `scope`). Client dịch vụ đăng ký trong `auth_service_clients` (secret băm scrypt), đồng bộ lúc khởi động từ `SERVICE_CLIENTS_BOOTSTRAP`.
- Mỗi service có hai bề mặt HTTP tách thư mục: public `/api/v1` (chỉ Gateway gọi, cần service token `gateway:proxy`) và internal `/internal/v1` (service khác gọi, cần scope của route). `/health`, `/ready`, JWKS và `POST /internal/v1/auth/service-token` không cần bearer.
- `identity` không phải dependency của từng request sau login, nhưng là điểm lỗi chung của lớp xác thực: khi `identity` chậm/chết, token và JWKS đã cache vẫn dùng đến hết hạn (stale-while-error), sau đó lỗi lan sang mọi service ([dependency-resilience-policy-v2](dependency-resilience-policy-v2.md) mục 6). Đây là nguồn của case FG/FH (mục 10).
- Gateway xóa `Authorization` và mọi `x-principal-*` do client gửi, đặt lại `x-principal-id`/`x-principal-role` từ claim, không bao giờ chuyển tiếp credential của client.

### 2.3. Async workflow

Mọi giao tiếp bất đồng bộ là **command** có đích rõ (không còn event pub/sub):

```text
Exchange: lms.commands (direct)
Queue:    <worker service.name>--<command-kebab>-v<schema_version>
Phát:     transactional outbox trong DB của producer + relay
Nhận:     consumer at-least-once, idempotent theo message_id (inbox)
Lỗi:      retry trong tiến trình có giới hạn, hết thì vào <queue>.error
```

Danh mục command, producer/consumer và envelope: [http-and-event-contracts-v2](http-and-event-contracts-v2.md) mục 6. Hành vi retry/outbox/inbox đúng như code làm: [dependency-resilience-policy-v2](dependency-resilience-policy-v2.md) mục 4. Không tạo thêm command chỉ để làm topology phức tạp; command mới cần producer, consumer, failure mode và giá trị thực nghiệm cụ thể (thay đổi producer/consumer cần ADR, xem mục 14).

### 2.4. Trách nhiệm service và workflow cốt lõi

Bảng trách nhiệm đầy đủ ở catalogue v2 mục 4. Tóm tắt:

| Component | Vai trò chính |
| --- | --- |
| `gateway` | Entry point duy nhất; route theo prefix; verify user JWT; kiểm role; gắn service token; chuẩn hóa lỗi proxy; không có DB |
| `identity` | Đăng ký student (một transaction tài khoản + hồ sơ), ba cửa đăng nhập (student/instructor/admin), refresh, phát user/service token, JWKS, registry client dịch vụ, hồ sơ và danh sách student; `identity_db` |
| `course` | Course, lesson, quiz, enrollment, tiến độ, quiz attempt, export CSV, facade mỏng cho luồng AI soạn bài; `course_db` |
| `media` / `media-worker` | Upload (multipart/trực tiếp lên MinIO), library, content stream, usage, thumbnail; worker xử lý thumbnail và đồng bộ usage; `media_db` + MinIO |
| `notification` / `notification-worker` | Thông báo đơn, batch, inbox; worker snapshot recipient, dispatch, gửi email SMTP; `notification_db` |
| `scheduler` / `scheduler-worker` | Quản lý job và run; worker nhận run bằng lease, chạy job `MEDIA_UNUSED_CLEANUP`; `scheduler_db` |
| `ai` / `ai-worker` | Provider/model/binding, API key mã hóa, completion, tài liệu và job AI; worker trích văn bản và chạy job; `ai_db` |

Bảy workflow phải chạy và quan sát được xuyên boundary (chi tiết đường đi: catalogue mục 7):

```text
W1 Đăng ký và đăng nhập    W5 Thông báo batch + email
W2 Soạn nội dung khóa học   W6 AI soạn bài / sinh quiz
W3 Ghi danh và học          W7 Dọn media không dùng (scheduler)
W4 Upload media
```

W1–W7 được tái hiện tự động bởi bảy file regression (mục 12).

### 2.5. Phân tầng scope

- **Đã có trong code:** topology 7 service + 4 worker, PostgreSQL/RabbitMQ/MinIO/Mailpit, hai bề mặt API và token EdDSA, outbox/inbox, seeder quy mô lớn, reset/seed có kiểm soát, regression, Postman, CI, telemetry đa nguồn có correlation (smoke observability).
- **Chưa có (mảng AI, `aiops-platform/`):** dataset, huấn luyện và đánh giá RCA engine, workload k6, fault injector, experiment runner, MCP server và agent. README của `aiops-platform` ghi các thư mục này "Chưa tạo". Tài liệu này mô tả ranh giới và hợp đồng, không khẳng định chúng đã tồn tại.
- **Ngoài scope:** Redis, frontend, kênh real-time, notification tự động theo sự kiện, Kubernetes/service mesh, multi-fault, RCA mức instance/component làm primary.

Business scope được freeze khi topology, observability và các fault ở mục 10 đã tạo được experiment hợp lệ; sau mốc này ưu tiên chất lượng dữ liệu, tái lập, anomaly/RCA và đánh giá thay vì thêm LMS feature.

## 3. Công nghệ canonical

| Thành phần | Quyết định (đối chiếu `lms/package.json`, Dockerfile, Compose) |
| --- | --- |
| Runtime và toolchain | Node.js `22.13.1`, pnpm `11.19.0` (Corepack), TypeScript `6.0.3`, image `node:22.13.1-alpine`, chạy bằng user `node` |
| Service và Gateway | NestJS `12.0.x`; cấu hình bằng zod (`parseEnvironment`) |
| Truy cập dữ liệu | Prisma `7.10.1` với `@prisma/adapter-pg`; migration bằng `prisma migrate deploy` khi `service` khởi động (xem 3.1) |
| Contract | zod schema trong `@aiops-lms/contracts` (`http/`, `commands/`) |
| Database | PostgreSQL `17.6-alpine`, một instance, 6 logical DB |
| Messaging | RabbitMQ `4.1.4-management-alpine` (`amqplib`); exchange `lms.commands` |
| Object storage | MinIO (client `minio` `8.0.7`; 5 bucket `images`, `videos`, `documents`, `audios`, `other` do `minio-init` tạo) |
| Email | `nodemailer`; Mailpit `v1.31.6` cho dev/CI, SMTP thật khi production (đổi biến môi trường) |
| LLM | Nhà cung cấp OpenAI-compatible bên ngoài; test dùng HTTP stub |
| Telemetry SDK | OpenTelemetry (`@aiops-lms/observability`, version pin trong package) |
| Backend telemetry | Collector Contrib `0.163.1`, Prometheus `v3.15.0`, Tempo `3.1.0`, Loki `3.7.9`, Grafana `13.2.4` (trong `aiops-platform/observability/`) |
| Analysis/RCA, workload | Python (analysis) và k6 (workload) là định hướng, **chưa có code** trong repo |
| Kubernetes | Không thuộc phạm vi |

Không dùng polyglot business service. Analysis có thể là modular monolith Python thay vì nhiều microservice vật lý.

### 3.1. Hạ tầng vận hành

- **PostgreSQL:** mỗi DB có role riêng (`postgres-init/*.sh`), không role nào đọc được DB khác. Service (không phải worker) chạy `prisma migrate deploy` rồi mới mở HTTP; worker chờ `service_healthy` của service để schema đã sẵn sàng. Pool kết nối dùng mặc định của driver `pg` (chưa kiểm chứng giá trị pool và timeout mặc định); metric pool chưa có.
- **MinIO:** thuộc `media`; service khác chỉ nhận `media_id` và gọi `media`. Mất MinIO làm upload, thumbnail, cleanup lỗi (FA).
- **Mailpit/SMTP:** thuộc `notification-worker`; `notification-smtp` là dependency identity riêng.
- **LLM provider:** thuộc `ai`; process chạm provider là `ai`/`ai-worker`, không có retry và không có circuit breaker ở lời gọi này.
- **RabbitMQ:** vhost mặc định `/`; metric hàng đợi do Collector scrape từ broker (`rabbitmq_prometheus`), không phải từ runtime LMS.

## 4. Cấu trúc repository thực tế

```text
DO_AN_TOT_NGHIEP/
├── README.md, AGENTS.md, CLAUDE.md
├── lms/                        # backend workspace (pnpm workspace)
│   ├── services/               # gateway, identity, course, media,
│   │                           # notification, scheduler, ai  (+ worker.ts trong service có worker)
│   ├── packages/
│   │   ├── common/             # @aiops-lms/common: auth, clients, config, errors, http,
│   │   │                       #   messaging, ports, prisma, telemetry
│   │   └── observability/      # @aiops-lms/observability: bootstrap OTel, logger, metric views
│   ├── contracts/              # @aiops-lms/contracts: src/http (common|public|internal), src/commands
│   ├── templates/service/      # template cho `pnpm new-service`
│   ├── scripts/                # reset-and-seed.mjs, seed-data.mjs (+ seed-data/), new-service.mjs
│   ├── test/                   # architecture, regression, observability, postman runner,
│   │                           #   seed-data, testbed-reset, support
│   └── infrastructure/         # hiện chỉ có README
├── docker-compose/             # compose.yaml (LMS), compose.full.yaml (LMS + aiops-platform),
│                               #   postgres-init/, .env.example, README.md
├── aiops-platform/             # tách khỏi LMS
│   ├── observability/          # Collector, Prometheus, Tempo, Loki, Grafana, dashboards, compose.yaml riêng
│   └── README.md               # liệt kê training/, mcp/, agent/, load/, faults/, evaluation/ (chưa tạo)
├── postman/                    # lms-v2 collection + environment + fixtures
├── .github/workflows/          # ci.yml, regression.yml; actions/setup-lms
├── docs/{raw,processed}/       # processed: architecture, adr, direction, plan, rules, guides, ...
├── workspace/, meetings/, agent-resources/, tools/
```

### 4.1. Ý nghĩa các ranh giới

- `lms/` là backend workspace canonical: toolchain, service, shared package và contract của LMS. Orchestration dùng chung đặt ở `docker-compose/`.
- `lms/services/` chứa Gateway và 7 business service. Mỗi service deploy độc lập (Dockerfile riêng, build context là `lms/`); worker dùng chung image.
- `lms/packages/common/` chỉ chứa technical primitive (HTTP envelope, guard, client có breaker, token provider, outbox/inbox, RabbitMQ, `observeDependency`). Không đặt entity hoặc repository nghiệp vụ dùng chung ở đây.
- `lms/packages/observability/` chứa **application instrumentation** (bootstrap OpenTelemetry, structured logger, metric view, middleware). Không chứa Collector, Prometheus, Tempo, Loki hay Grafana.
- `aiops-platform/observability/` là runtime/config duy nhất cho Collector, Prometheus, Tempo, Loki, Grafana. LMS không import mã từ `aiops-platform/`.
- `lms/contracts/` chứa published contract dạng zod; service không import controller, repository hoặc entity của service khác, mà dùng contract.
- `lms/infrastructure/` hiện chỉ có README, và README đó còn mô tả hạ tầng v1 (Redis, storage mock) nên đã lệch code; cấu hình hạ tầng thực tế nằm trong `docker-compose/` (kể cả `postgres-init/`).
- Không tạo root cạnh tranh với `lms/` như `platform/`, `backend/`, `testbed/` hay `dashboard/`; không tạo `agents/` hay `docs/architecture/`.

## 5. Runtime và triển khai

`docker-compose/` có ba cách chạy:

| File | Nội dung | Dùng cho |
| --- | --- | --- |
| `docker-compose/compose.yaml` | Chỉ LMS (11 runtime + PostgreSQL, MinIO, `minio-init`, Mailpit, RabbitMQ) | Regression, Postman, phát triển. Không có Collector nên không có telemetry (chưa kiểm chứng hành vi exporter khi thiếu Collector) |
| `aiops-platform/observability/compose.yaml` | Chỉ Collector, Prometheus, Tempo, Loki, Grafana | Dựng riêng stack quan sát |
| `docker-compose/compose.full.yaml` | Ghép hai bên bằng `include` trong một project: 21 thành phần | Reset/seed, smoke observability, CI |

Hai bên nối bằng network `aiops-net` (biến `AIOPS_NETWORK_NAME`); LMS chỉ gửi OTLP/HTTP tới `otel-collector:4318`, Collector scrape `rabbitmq:15692`. Cổng host mặc định: `gateway` 3000, `identity` 3001, `course` 3003, `media` 3004, `media-worker` 3005, `notification` 3006, `notification-worker` 3007, `scheduler` 3018 (host 3008 thuộc Grafana; trong network là `scheduler:3008`), `scheduler-worker` 3010, `ai` 3009, `ai-worker` 3011. Chi tiết lệnh: [docker-compose/README.md](../../../docker-compose/README.md).

Dữ liệu và trạng thái sạch:

- `pnpm run testbed:reset` (reset/seed có kiểm soát, chỉ nhận project `aiops-lms-local` hoặc `aiops-lms-test-*`, bắt buộc `--confirm`): `down --volumes`, `up --build -d --wait`, kiểm tra healthy, tạo fingerprint seed.
- `pnpm run seed:data` nạp dữ liệu quy mô lớn trực tiếp bằng SQL (id bắt đầu bằng `5eed`); dữ liệu seed không đi qua API/outbox/command nên không có trace, log nghiệp vụ hay media usage đồng bộ cho các dòng đó ([data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) mục 2.9, [guide](../guides/seed-data-guide.md)).

## 6. Trách nhiệm workload, fault, experiment và evaluation

Các module dưới đây là **ranh giới trách nhiệm** cho phần AI; theo `aiops-platform/README.md` hiện chưa có thư mục nào được tạo (`load/`, `faults/`, `evaluation/`, `training/`, `mcp/`, `agent/`). Vị trí cụ thể sẽ chốt khi mảng AI bắt đầu từng module; không tạo thư mục rỗng trước.

| Module | Chỉ làm | Không làm |
| --- | --- | --- |
| Workload | Tạo traffic (k6), profile ghi seed, tỷ lệ workflow, rate/stage, duration; có profile "tăng tải hợp lệ" làm negative control | Không inject fault, không tính metric đánh giá |
| Fault | Cơ chế fault tái sử dụng: catalog, injector (chèn trễ MinIO/PostgreSQL/SMTP/LLM stub, giới hạn CPU), script start/stop/cleanup/verify; mặc định tắt, chỉ bật khi thí nghiệm | Không đổi business rule chỉ để cài fault |
| Experiment | Orchestration: protocol, scenario tham chiếu workload + fault + timing, runner (reset, ledger), manifest/artifact theo run | Không copy workload/fault vào đây |
| Evaluation | `prediction + ground truth -> evaluation metrics` | Không tạo workload, không inject fault, không điều khiển runtime |

Quy ước của testbed đối với phần này:

- Fault không được thêm vào code nghiệp vụ dưới dạng hook ngầm; cơ chế inject chi tiết do mảng AI chốt, yêu cầu bắt buộc là bật/tắt được, tái lập được, có ground truth và không đổi code nghiệp vụ ([data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) mục 5).
- Ground truth không đi vào payload nghiệp vụ hay telemetry.
- Thí nghiệm chạy workload song song (k6) để tạo nhiễu; đối chứng gồm baseline "thủ công" tự động (ngưỡng + trace lỗi/chậm nhất) và thử nghiệm người nhỏ (ADR-002).

## 7. Experiment manifest và reproducibility

Mỗi run phải truy vết được từ scenario tới code, config, telemetry, prediction và evaluation. Schema chính thức của `RunGroundTruth` và artifact nằm ở [telemetry-and-ground-truth-schema-v0](telemetry-and-ground-truth-schema-v1.md); tài liệu đó vẫn viết theo topology v1 và đang chờ cập nhật, nên ví dụ dưới đây chỉ **minh họa logic** bằng identity v2, không phải schema đã chốt:

```yaml
experiment_id: exp-media-minio-latency
scenario_id: media-minio-latency
run_id: exp-media-minio-latency-r03
repeat_index: 3

workload_profile: <tên profile>
workload_seed: <seed>

fault_type: dependency_latency
fault_target: media-minio
fault_intensity: <độ trễ chèn>
fault_start: 2026-11-02T03:10:00Z
fault_end: 2026-11-02T03:15:00Z

root_cause_service: media
root_cause_component: media-minio

code_commit: <git-sha>
service_versions:
  media: 0.1.0

environment_profile: docker-compose-full
telemetry_artifact: <path-or-uri>
prediction_artifact: <path-or-uri>
evaluation_artifact: <path-or-uri>
```

Quy ước: timestamp UTC ISO-8601; `run_id` duy nhất, `repeat_index` bắt đầu từ 1; manifest chứa đường dẫn/URI mở được; config version và commit được ghi trước khi chạy campaign chính; từ một `run_id` xác định được code, môi trường, workload/seed, fault/ground truth, schema telemetry và vị trí artifact; runner lưu cả run lỗi, không âm thầm bỏ run khỏi ledger. Trạng thái xử lý run thuộc phạm vi mảng AI (chưa có code).

## 8. Kiến trúc nội bộ service

Template canonical (`lms/templates/service`, tạo bằng `pnpm new-service <name> --port <port>`):

```text
service/
├── src/
│   ├── domain/
│   ├── application/
│   │   ├── ports/
│   │   └── use-cases/<area>/<verb-noun>.use-case.ts
│   ├── adapters/
│   │   ├── http/{public,internal,open,shared}
│   │   ├── persistence/        # Prisma + raw SQL cho outbox/inbox
│   │   ├── clients/            # HttpQueryClient gọi service khác
│   │   ├── messaging/          # outbox relay, worker runner
│   │   └── storage/ mail/ ...  # chỉ khi service có boundary đó
│   ├── config/                 # env.schema.ts (zod)
│   ├── main.ts, bootstrap.ts
│   └── worker.ts, worker.module.ts   # chỉ service có worker
├── prisma/{schema.prisma, migrations/}
├── prisma.config.ts, test/, Dockerfile, README.md
```

Không bắt buộc tạo mọi folder (ví dụ `gateway` không có persistence).

### 8.1. Dependency rule

```text
domain       không phụ thuộc HTTP, database hay framework
application  điều phối use case; định nghĩa port cần thiết
adapters     triển khai HTTP, database, messaging, storage, mail, client gọi service khác
```

- Mỗi use case là **một class có method `execute`** (ADR-001); controller chỉ parse input bằng zod schema, gọi đúng một use case và map kết quả sang DTO.
- Outbound call đi qua port ở `application/ports/` và adapter ở `adapters/clients/` (dùng `HttpQueryClient`); không tạo interface cho helper nội bộ không có boundary thật.
- Không tạo value object, domain service hoặc folder rỗng chỉ để đúng mẫu.
- Decorator/wiring của NestJS được phép ở adapters và bootstrap/config, không vào domain.
- `adapters/http/public/` và `adapters/http/internal/` không import nhau (ESLint); `lms/test/http-surface.test.mjs` kiểm thư mục, prefix và decorator (`@Roles`/`@Anonymous`, `@InternalApi({ scopes })`, `@SkipAuth`).

### 8.2. Shared packages

Shared package chỉ chứa technical primitive. Không đặt `User`, `Course`, `Student`, `Media`, `Notification` hoặc business repository base class dùng chung trong `lms/packages/`. Dockerfile của service (ví dụ `course`) chỉ đóng gói các package nội bộ cần thiết: `contracts`, `observability`, `common`.

## 9. Contract và integration conventions

### 9.1. HTTP

- Public endpoint dùng prefix `/api/v1` (chỉ Gateway gọi); nội bộ dùng `/internal/v1`. JSON `snake_case`, ID là UUID, timestamp UTC ISO-8601.
- Mọi response JSON (thành công hay lỗi) có đúng bốn khóa `success`, `data`, `error`, `meta` (`meta.trace_id`, `meta.timestamp`, `meta.pagination`); ngoại lệ là route trả byte/stream. Phân trang `?page&page_size`. Chi tiết và danh mục mã lỗi: [http-and-event-contracts-v2](http-and-event-contracts-v2.md) mục 1–2.
- DTO là zod schema trong `lms/contracts/src/http/`; bên gọi đọc phản hồi bằng cùng schema.
- Mọi outbound HTTP có timeout rõ ràng và circuit breaker; **retry tắt** cho mọi HTTP; ánh xạ lỗi dependency sang `DEPENDENCY_TIMEOUT` (504) / `DEPENDENCY_UNAVAILABLE` (503). Giá trị, ngưỡng và ngoại lệ: [dependency-resilience-policy-v2](dependency-resilience-policy-v2.md).
- Gateway trả nguyên vẹn mọi phản hồi của service phía sau (kể cả 4xx/5xx và mã nghiệp vụ); chỉ tự sinh envelope cho `404`, `401`, `403`, `503` (không kết nối được) và `504` (không có header phản hồi trong timeout).

Ví dụ lỗi (envelope thực tế):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "DEPENDENCY_TIMEOUT",
    "message": "Dịch vụ phụ thuộc phản hồi quá hạn",
    "details": { "dependency": "gateway-media" }
  },
  "meta": { "trace_id": "…", "timestamp": "2026-11-02T03:15:30.000Z", "pagination": null }
}
```

### 9.2. Command

- Tên command dạng `<domain>.<đối tượng>.<hành động>` (ví dụ `media.thumbnail.generate`, `ai.job.run`); tên queue `<worker>--<command-kebab>-v<n>`, nguồn duy nhất ở `lms/contracts/src/commands/` cho cả producer lẫn consumer.
- Envelope gồm `message_id`, `command_name`, `schema_version`, `occurred_at`, `producer`, `correlation` (`traceparent`, `tracestate`, `correlation_id`) và `payload`; trace context đồng thời đi trong header RabbitMQ.
- Thêm field tùy chọn giữ `schema_version`; đổi/xóa field bắt buộc thì tăng version và tên queue đổi theo.
- Mỗi command có fixture và contract test; consumer không đọc DB của producer để bù dữ liệu.

## 10. Observability-by-design

### 10.1. Resource identity và thời gian

Mọi telemetry có `service.name`, `service.version`, `service.instance.id` (lấy từ cấu hình, không từ hostname/container); `service.name` là một trong 11 giá trị canonical, gồm cả worker. Timestamp UTC ISO-8601. Không dùng `trace_id`, `span_id`, user ID, request ID hoặc `message_id` làm Prometheus label; view của SDK chỉ cho phép allowlist thuộc tính và giới hạn 512 tổ hợp mỗi instrument.

### 10.2. Tracing

100% sampling (`AlwaysOnSampler`). Mỗi runtime phát: server span HTTP (route template, không raw path), client span cho mọi dependency qua `observeDependency` (HTTP nội bộ, PostgreSQL, MinIO, SMTP, LLM provider, JWKS, token), span PRODUCER (`lms.commands publish …`) và CONSUMER (`<queue> process`). Trace context đi qua HTTP (`traceparent`) và header RabbitMQ; relay outbox nối span PRODUCER vào trace của request đã ghi command bằng `traceparent` trong envelope. Span lỗi có status `ERROR` và `error.type` hữu hạn (`timeout`, `unavailable`). Ma trận luồng ↔ service phải có trong một trace: [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 1.2.

### 10.3. Structured logs

JSON một dòng ra stdout và đồng thời gửi OTLP tới Loki: `timestamp`, `level`, `message`, `service.name`, `service.version`, `service.instance.id`, `trace_id`/`span_id` khi có span active, cùng field chẩn đoán trong allowlist (`event`, `error_type`, `dependency_identity`, `operation_name`, `http_route`, `http_status_code`, `duration_ms`, …). Log lỗi dependency (`event=dependency.failure`) khớp `span_id` của span CLIENT lỗi. Message được che credential/PII. Worker chưa có log riêng khi xử lý command (chỉ thấy ở span CONSUMER và `dependency.failure`).

### 10.4. Metrics

| Họ metric | Nguồn |
| --- | --- |
| `http_server_request_count_total`, `http_server_request_error_count_total`, `http_server_request_duration_seconds_*` (RED) | runtime, 12/12 |
| `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, `lms_dependency_duration_seconds_*` (nhãn `dependency_identity`, `operation_name`, `status` ∈ `ok`/`timeout`/`unavailable`/`expected_failure`) | runtime, qua `observeDependency` |
| `process_cpu_time_seconds_total`, `process_memory_usage_bytes` | runtime |
| `rabbitmq_detailed_queue_messages[_ready/_unacked]`, `rabbitmq_detailed_queue_consumers` | **broker** (Collector scrape), `service_name` là worker tiêu thụ |

### 10.5. Tín hiệu chưa có (giới hạn đã biết)

Pool kết nối PostgreSQL, tuổi message cũ nhất trong queue, độ trễ outbox, metric publish/consume RabbitMQ ở runtime (chỉ có span), log khi worker xử lý command, nối trace `scheduler → scheduler-worker` (worker thăm dò DB nên không cùng trace). Danh sách và hệ quả cho RCA: complex-case catalogue mục 1.5. Hệ quả thiết kế: các case cần tín hiệu này chỉ quan sát gián tiếp cho đến khi Đức quyết định bổ sung.

### 10.6. Correlation

Một fault test đạt yêu cầu khi đi được từ metric symptom tới trace/span liên quan và log evidence bằng `service.name` cùng khoảng thời gian; với log trong request context truy được bằng `trace_id`/`span_id`. Lưu ý đọc telemetry: span PRODUCER thuộc process relay, queue thuộc worker tiêu thụ, triệu chứng lỗi xác thực nằm ở cạnh `<caller>-identity-token` (complex-case catalogue mục 2).

## 11. Fault scope và RCA boundary

### 11.1. Fault

Ma trận fault v0 (FA–FH) và case phức tạp C1–C7 nằm ở [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) mục 5–6 và được chốt chi tiết, kèm trạng thái kiểm chứng từng case, ở [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 3:

| Fault | Loại | Root-cause service | Component |
| --- | --- | --- | --- |
| FA | Độ trễ phụ thuộc | `media` / `media-worker` | `media-minio` |
| FB | Backlog hàng đợi | `notification-worker` | `notification-rabbitmq` |
| FC | Giữ kết nối DB | `course` | `course-postgres` |
| FD | Độ trễ nhà cung cấp AI | `ai` | `ai-llm-provider` |
| FE | Độ trễ dependency nhỏ | `identity` | `identity-postgres` |
| FF | Quá tải tài nguyên | service bất kỳ | instance |
| FG | Độ trễ/ngắt xác thực | `identity` | `identity` / `identity-postgres` |
| FH | Lệch khóa ký | `identity` | JWKS / khóa ký |

Trạng thái trung thực: tại thời điểm viết, chỉ case C6 (FG) đã được chạy thật (bởi `tracing-smoke`); các case còn lại mới ở mức "đã đo tín hiệu" hoặc giả thuyết và cần chạy thật trước khi dùng làm case đánh giá. Chưa có fault injector; không cần inject fault trên mọi service.

### 11.2. RCA và evaluation

- RCA engine (ML + dependency graph) là phần chính của đề tài; MCP và agent là thứ yếu, chỉ đọc kết quả của RCA engine ([ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md)).
- Primary evaluation là **service-level**. Candidate set mặc định: `identity`, `course`, `media`, `media-worker`, `notification`, `notification-worker`, `scheduler`, `scheduler-worker`, `ai`, `ai-worker`; `gateway` là symptom mặc định, chỉ là candidate khi protocol có gateway fault. Hạ tầng (PostgreSQL, RabbitMQ, MinIO, SMTP, LLM provider) là component/evidence, không trộn vào candidate set.
- Component/dependency là evidence bổ sung; không trộn service và component trong cùng metric chính. Output dùng thuật ngữ root-cause candidate ranking, không tuyên bố causal proof chỉ từ telemetry quan sát.
- Metric tối thiểu (Precision/Recall/F1/Detection Delay cho detection; Top-1/Top-3/MRR cho RCA; thời gian chẩn đoán thủ công so với AI) và quy tắc split theo run: [evaluation-protocol-v0](evaluation-protocol-v1.md), tài liệu này vẫn ở v0 và chưa cập nhật theo topology v2.
- Schema kết quả RCA (`RcaIncidentResult`) và nơi lưu đề xuất: complex-case catalogue mục 5.

## 12. Testing và CI

Kiểm thử đang có (chạy từ `lms/`):

| Loại | Lệnh | Phạm vi |
| --- | --- | --- |
| Kiến trúc | `pnpm run test:architecture` | ESLint boundary (cấm import chéo service, `public` ↔ `internal`), `new-service`, `http-surface` |
| Unit | `pnpm run test` | Jest cho `common`, `observability` và từng service; kèm test reset, seeder, queue-scrape, `test:telemetry` của Gateway |
| e2e theo service | `pnpm run test:<service>:e2e` | `identity`, `course`, `media`, `notification`, `ai`, `scheduler`, chạy với PostgreSQL, RabbitMQ, MinIO, Mailpit thật (đã `prisma migrate deploy`); Gateway có unit + e2e với upstream HTTP giả |
| Integration | `@aiops-lms/common` `test:integration`, `test:seed-data:db` | Outbox qua RabbitMQ thật; seeder trên PostgreSQL thật |
| Regression xuyên service | `pnpm run test:regression` | Dựng stack `compose.yaml` sạch, chạy bảy workflow W1–W7 qua Gateway (`lms/test/regression/*.regression.mjs`); workflow AI dùng provider giả |
| Postman/newman | `pnpm run test:postman` | `postman/lms-v2.postman_collection.json` (90 request, 224 assertion theo README của Postman), bảy workflow tương ứng |
| Smoke observability | `pnpm run test:observability` | Dựng `compose.full.yaml`, chạy regression làm traffic rồi `stack`, `tracing`, `logs`, `acceptance`, `metrics` (và `queue-scrape` không cần Docker) |
| Reset/seed | `pnpm run test:testbed:reset[:compose]` | Guard của lệnh reset; reset hai lần và so fingerprint trên stack thật |

CI ([`ci.yml`](../../../.github/workflows/ci.yml), chạy trên mọi PR và merge vào `main`): `static` (format, lint, build), `unit`, `e2e` (ma trận 7 service), `integration-db`, `compose-config` (validate ba file Compose bằng `.env.example`, bảo đảm không có `docker-compose/.env`), `compose-reset` (reset hai lần, fingerprint ổn định). [`regression.yml`](../../../.github/workflows/regression.yml) chạy regression và Postman (dựng cả 21 thành phần, 10–25 phút) khi PR gắn label `run-regression`, khi merge vào `main`, hằng đêm hoặc chạy tay. `pnpm run ci:verify` = `format:check` + `build` + `lint` + `test`.

Mỗi service chỉ tạo loại test có ý nghĩa: unit cho domain/use case có logic; e2e cho HTTP + persistence thật; contract test cho command/route đã publish; telemetry assertion cho propagation và attribute quan trọng. Danh sách contract test tối thiểu: [http-and-event-contracts-v2](http-and-event-contracts-v2.md) mục 9. Chưa có fault test (chưa có injector).

## 13. Definition of Done kỹ thuật

### 13.1. Một service

- [ ] Business/API hoặc consumer behavior chạy đúng theo contract; mỗi route ánh xạ tới đúng một use case.
- [ ] Không truy cập database hoặc source code của service khác; qua được ESLint boundary và `http-surface.test.mjs`.
- [ ] Mọi route khai báo xác thực (`@Roles`/`@Anonymous`, `@InternalApi({ scopes })`, hoặc `@SkipAuth`); `/health` và `/ready` hoạt động.
- [ ] Prisma migration chạy được bằng `prisma migrate deploy`; Dockerfile chạy bằng user không phải root.
- [ ] Inbound/outbound/dependency span phù hợp xuất hiện; trace context đi qua mọi HTTP và RabbitMQ boundary liên quan.
- [ ] `service.name`, `service.version`, `service.instance.id` đúng; log có `trace_id`/`span_id` khi có span.
- [ ] RED metric và `lms_dependency_*` của mọi dependency query được; timeout, error type và dependency identity ghi nhận đúng.
- [ ] Mọi outbound HTTP dùng `HttpQueryClient` (timeout, breaker, không retry); command đi qua outbox, consumer idempotent theo `message_id`.
- [ ] Test phù hợp pass; contract và tài liệu v2 cập nhật cùng PR.

### 13.2. Toàn testbed

Phần hạ tầng đã đạt: dựng được từ trạng thái sạch và lặp lại được, có runbook và artifact kiểm chứng.

```text
reset (down --volumes) -> up --build --wait (21 thành phần healthy)
-> seed -> chạy workflow (regression) -> thu telemetry (Collector -> Tempo/Prometheus/Loki)
-> smoke observability xác nhận tín hiệu -> reset -> lặp lại
```

Phần còn thiếu để testbed đạt DoD đầy đủ, thuộc mảng AI: start workload tự động có profile/seed, inject fault đã biết, quan sát lan truyền, lưu manifest + ground truth, chạy prediction + evaluation. Một demo thủ công không thay thế DoD tái lập.

## 14. Governance

- Thay đổi service boundary, ownership dữ liệu, command hoặc producer/consumer, đồng bộ ↔ bất đồng bộ, `service.name`, telemetry schema, experiment manifest hoặc granularity của RCA cần ADR trong `docs/processed/adr/` và cập nhật catalogue, contract, ground truth, evaluation protocol, fault matrix ([catalogue v2](service-catalogue-and-topology-v2.md) mục 11).
- Không tạo cây tài liệu hoặc source code cạnh tranh với blueprint.
- Lịch triển khai, primary và collaborator chỉ cập nhật trong [`plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md) và [bảng task refactor](../plan/refactor/refactor-board-v1.md).

## 15. Điểm chưa kiểm chứng

- Hành vi OTel exporter khi chạy `compose.yaml` mà không có Collector.
- Timeout và kích thước pool mặc định của driver PostgreSQL (`pg`/Prisma adapter) và của client MinIO; code không đặt giá trị riêng.
- Cơ chế chèn lỗi (fault injector) và chuỗi nhân quả của các case C1–C5, C7: chưa chạy thật.
- Idempotency của mọi handler command: các handler dùng `runOnce` (inbox) đã đối chiếu (media, ai, `snapshot-batch` của notification); handler còn lại dựa vào lease/unique key và chưa rà đầy đủ.

## Khác biệt so với bản trước

| Mục | Bản trước (blueprint, baseline v1) | Bản v2 (theo code) |
| --- | --- | --- |
| Topology | 6 business service + Gateway; `Assignment` là Target | 7 service + 4 worker (Gateway là một trong 7); không còn `enrollment`/`submission`/`grading`/`admin` |
| Cache và storage | Redis; Storage Mock điều khiển được; MinIO chỉ ở Target | Bỏ Redis và Storage Mock; MinIO thật thuộc `media` |
| Database | PostgreSQL, 5 DB, SQL tay | PostgreSQL 17 với 6 logical DB và role riêng, Prisma `7.10.1` + migration |
| Async | Event `grade.completed` pub/sub duy nhất | Command qua exchange `lms.commands`, queue `<worker>--<command>-v<n>`, outbox/inbox, retry rồi `<queue>.error` |
| Xác thực | JWT do Gateway verify cục bộ (thuật toán không nêu); service tin header | EdDSA/JWKS, hai loại token, service token cho mọi request, hai bề mặt `/api/v1` và `/internal/v1` (ADR-004) |
| Contract | OpenAPI trong `lms/contracts/http/<service>/`, event ở `contracts/events/grade-completed/` | zod trong `lms/contracts/src/http` và `src/commands`; envelope phản hồi bốn khóa; contract `grade.completed` bỏ |
| Notification | Giả lập gửi, không email thật | SMTP thật (Mailpit khi dev/CI) và inbox REST |
| Kiến trúc service | Không bắt buộc cấu trúc use case riêng; template có `config/main.*` | Mỗi use case một class `execute` (ADR-001); template có hai bề mặt HTTP, Prisma, `worker.ts`; `pnpm new-service` |
| Cấu trúc repo | Cây có `analysis/`, `load/`, `faults/`, `experiments/` ở root, `lms/packages/testing/`, `lms/infrastructure/{postgres,redis,rabbitmq,storage}`, observability ở `docker-compose/observability/` | Cây thực tế: không có các root trên (phần AI chuyển vào `aiops-platform/`, chưa tạo); không có `packages/testing`; observability ở `aiops-platform/observability/`; thêm `postman/`, `templates/`, `scripts/`, `test/` |
| Tách `aiops-platform` | Không có | LMS không import mã từ đó; nối bằng OTLP/HTTP và network `aiops-net` |
| Runtime | Một `compose.yaml` | `compose.yaml` (LMS), `aiops-platform/observability/compose.yaml`, `compose.full.yaml` (21 thành phần) |
| Fault scope | 5 scenario F1–F5 (Redis, storage, service error, consumer, CPU); floor 5 × 3 = 15 run | FA–FH và case C1–C7, mỗi case ghi trạng thái kiểm chứng; chưa có injector; bỏ ngưỡng số run (thuộc evaluation protocol) |
| RCA | AI hỗ trợ, service-level là primary | AI là bên truy vết chính, MCP/agent thứ yếu (ADR-002); service-level vẫn là primary; thêm đo thời gian chẩn đoán thủ công so với AI |
| Metric/identity | Metric dependency cho Redis, storage; resource identity 3 field | `lms_dependency_*` với `dependency_identity`/`operation_name`/`status`; broker metric từ Collector; chỉ nêu tín hiệu có thật và liệt kê tín hiệu chưa có |
| Testing | Danh sách loại test chung; E2E gồm `grade -> notification` | Kiến trúc, unit, e2e 7 service, integration, regression 7 workflow, Postman, smoke observability, reset/seed; mô tả CI thực tế (`ci.yml`, `regression.yml`) |
| DoD testbed | `deploy -> seed -> workload -> inject fault -> ... -> reset -> repeat` coi như đạt được | Tách phần hạ tầng đã đạt khỏi phần workload/fault/evaluation còn thiếu (mảng AI) |
| Cách ưu tiên khi lệch | Blueprint ưu tiên hơn tài liệu khác | Thứ tự ADR → v2 → blueprint; khi lệch code thì code là chuẩn |
