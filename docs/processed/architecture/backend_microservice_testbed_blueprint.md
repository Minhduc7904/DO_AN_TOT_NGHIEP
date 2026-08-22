# Blueprint triển khai Backend Microservice Testbed

> **Trạng thái:** Canonical source of truth cho định hướng và implementation architecture của backend testbed
>
> **Baseline:** Architecture baseline v1, frozen để bắt đầu implementation; thay đổi quyết định đáng kể phải đi qua ADR.
>
> **Phạm vi:** Vai trò, scope, topology, workload/fault/observability requirements, cấu trúc source code, kiến trúc nội bộ service, contract, instrumentation, integration, ranh giới experiment và Definition of Done kỹ thuật.
>
> **Định hướng WHY/WHAT:** [`../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md)
>
> **WHEN/WHO:** [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md)

Tài liệu này là **source of truth duy nhất cho backend testbed**, từ định hướng và phạm vi đến implementation architecture. Nếu một tài liệu khác mô tả topology, scope, cây source code, service template hoặc convention kỹ thuật khác, blueprint này được ưu tiên. Tài liệu không định nghĩa lịch triển khai theo tuần.

## 1. Mục tiêu và nguyên tắc

Backend LMS là System Under Test (SUT), không phải một sản phẩm LMS production-grade. Kiến trúc phải tạo được dependency, workload, telemetry, fault propagation và ground truth có kiểm soát mà không làm quá tải nhóm hai người.

Backend phải tạo được dependency đồng bộ và bất đồng bộ; database, cache, queue và storage dependency; workload bình thường, burst và tải cao nhưng khỏe; fault propagation quan sát được; telemetry đa nguồn có correlation; cùng ground truth và experiment có thể lặp lại. Một feature nghiệp vụ chỉ được thêm khi nó tạo dependency/fault có giá trị, cải thiện observability hoặc hỗ trợ trực tiếp research question/evaluation; số lượng CRUD không phải tiêu chí mở rộng scope.

Các nguyên tắc bắt buộc:

1. Monorepo theo module kỹ thuật, không theo thành viên.
2. Docker Compose là runtime của MVP; Kubernetes chỉ là Stretch và không thuộc critical path.
3. TypeScript + NestJS cho testbed; Python cho analysis/anomaly/RCA; k6 cho workload.
4. Lightweight hexagonal architecture, chỉ tạo abstraction khi có boundary thật.
5. Observability, faultability và reproducibility là yêu cầu thiết kế từ đầu.
6. Không có cross-service source import hoặc truy cập database chéo.
7. Analysis/RCA chạy out-of-band, không nằm trên business request path.
8. Không thêm service mesh, custom dashboard framework hoặc hạ tầng enterprise vào MVP.

## 2. Kiến trúc hệ thống và service topology

### 2.1. MVP

MVP gồm **6 business service và 1 API Gateway**:

```text
API Gateway
Auth
Course
Enrollment
Submission
Grading
Notification
```

Dependency canonical:

```text
Gateway
├── Auth
├── Course ──> Redis
│          └─> PostgreSQL: course_db
├── Enrollment ──> Course
│              └─> PostgreSQL: enrollment_db
├── Submission ──> Course
│              ├─> Enrollment
│              ├─> Storage mock
│              └─> PostgreSQL: submission_db
└── Grading ──> Submission
            ├─> PostgreSQL: grading_db
            └─> RabbitMQ ──> Notification

Auth ──> PostgreSQL: auth_db
```

Một PostgreSQL instance có thể chứa nhiều logical database. Mỗi service chỉ truy cập database do chính nó sở hữu. Notification có thể không cần database trong MVP nếu chỉ ghi nhận trạng thái xử lý giả lập.

### 2.2. Target

Target có thể thêm `Assignment`:

```text
Assignment ──> Course
Submission ──> Assignment + Enrollment + Storage
```

Khi đó có thể bổ sung `assignment_db`. `Assignment` không phải điều kiện để đạt MVP, không được làm chậm luồng `Submission` MVP và không được đưa vào critical path nếu nguồn lực không đủ.

### 2.3. Auth và JWT

Luồng xác thực canonical:

```text
login: Client -> Gateway -> Auth -> auth_db -> JWT
request sau login: Client -> Gateway validate JWT locally -> business service
```

- Auth phát JWT và quản lý dữ liệu xác thực tối thiểu.
- Gateway xác minh chữ ký, hạn dùng và claim cần thiết tại chỗ.
- Không gọi remote token introspection cho mọi request.
- Auth không được mô tả là shared runtime dependency của mọi API sau login.
- Fault ở Auth chủ yếu ảnh hưởng login/refresh, không mặc định làm hỏng mọi request đã có JWT hợp lệ.

### 2.4. Async workflow

MVP chỉ cần một workflow bất đồng bộ rõ ràng:

```text
Grading -> grade.completed -> RabbitMQ -> Notification
```

Không tạo thêm event chỉ để làm topology phức tạp. Event Target chỉ được thêm khi có consumer, failure mode và giá trị thực nghiệm cụ thể.

### 2.5. Trách nhiệm service và workflow cốt lõi

- **API Gateway:** route request, kiểm tra JWT cục bộ, chuẩn hóa error response, truyền trace context và tạo điểm quan sát symptom upstream.
- **Auth:** login/refresh, phát JWT, quản lý role/claim tối thiểu và sở hữu `auth_db`.
- **Course:** create/get/list ở mức tối thiểu, sở hữu `course_db`, dùng Redis và tạo cache/database failure mode có giá trị cho RCA.
- **Enrollment:** enroll/kiểm tra enrollment, gọi Course qua HTTP contract và sở hữu `enrollment_db`.
- **Submission:** nhận/truy vấn bài nộp, gọi Course + Enrollment + storage mock trong MVP, sở hữu `submission_db` và là trọng tâm của synchronous fault propagation.
- **Grading:** tạo/cập nhật grade tối thiểu, gọi Submission, sở hữu `grading_db` và publish `grade.completed`.
- **Notification:** consume `grade.completed`, giả lập gửi thông báo và tạo queue backlog/consumer slowdown scenario; không cần gửi email thật.

Các workflow phải chạy và quan sát được xuyên boundary:

```text
W1 Login              Client -> Gateway -> Auth -> auth_db -> JWT
W2 Browse Course      Client -> Gateway -> Course -> Redis/PostgreSQL
W3 Enroll Course      Client -> Gateway -> Enrollment -> Course + enrollment_db
W4 Submit Course Work Client -> Gateway -> Submission -> Course + Enrollment
                                                   -> Storage mock + submission_db
W5 Grade and Notify   Client -> Gateway -> Grading -> Submission + grading_db
                                                   -> RabbitMQ -> Notification
```

Khi `Assignment` được triển khai ở Target, workflow W4 chuyển nhánh Course/work-item thành `Submission -> Assignment -> Course`; workflow MVP không phụ thuộc vào thay đổi này.

### 2.6. Phân tầng scope và điều kiện freeze

MVP bắt buộc gồm topology 6 business service + Gateway, PostgreSQL/Redis/RabbitMQ/storage mock, HTTP + `grade.completed`, telemetry có correlation, workload tự động, năm fault scenario có ground truth, Docker Compose, service-level RCA evaluation và ít nhất một robustness evaluation focused bằng controlled trace dropping/sampling simulation trên telemetry artifact hoặc missing-modality evaluation. Robustness MVP tái sử dụng baseline thu với 100% trace sampling và không yêu cầu matrix lớn. Target gồm Assignment, MinIO, thêm workload/fault intensity và repetitions, expanded robustness với nhiều sampling level, nhiều missing-modality combination hoặc live sampling experiment, cùng component evidence phong phú hơn. Stretch gồm Kubernetes/Chaos Mesh, multi-fault, instance-level hoặc component-level RCA chính thức và các resilience scenario nâng cao.

Business scope được freeze khi topology MVP, observability và năm fault scenario đã tạo được experiment hợp lệ. Sau mốc này, ưu tiên data quality, reproducibility, anomaly/RCA và evaluation thay vì thêm LMS feature.

## 3. Công nghệ canonical

| Thành phần | Quyết định |
| --- | --- |
| Business services và Gateway | TypeScript + NestJS |
| Analysis, anomaly detection và RCA | Python |
| Workload | k6 |
| Messaging | RabbitMQ |
| Database | PostgreSQL |
| Cache | Redis |
| Storage MVP | Controllable mock |
| Storage Target | MinIO |
| Runtime MVP/Target | Docker Compose |
| Telemetry | OpenTelemetry |
| Metrics | Prometheus |
| Traces | Tempo |
| Logs | Loki |
| Quan sát telemetry gốc | Grafana |
| Kubernetes | Stretch only |

Không dùng polyglot business services trong MVP. Analysis có thể là modular monolith Python thay vì tách thành nhiều microservice vật lý.

### 3.1. Storage mock của MVP

Storage mock là một **controllable external dependency**, không phải fake adapter chạy in-process bên trong Submission Service:

```text
Submission Service
      |
      | HTTP hoặc network protocol đơn giản
      v
Storage Mock
```

Mock chỉ cần nhận request lưu/đọc object ở mức tối thiểu, inject deterministic latency/error, có dependency identity ổn định, tạo outbound/dependency span từ Submission và cho phép fault scenario có `start`/`end` rõ ràng. Mục tiêu là tạo downstream dependency observable và controllable phục vụ RCA, không phải xây object-storage product hoàn chỉnh. MinIO chỉ thuộc Target và chỉ được thêm khi có giá trị thực nghiệm rõ.

## 4. Cấu trúc repository canonical

Không cần scaffold toàn bộ cây ngay lập tức; chỉ tạo folder khi bắt đầu module tương ứng. Khi tạo, phải theo cấu trúc sau:

```text
DO_AN_TOT_NGHIEP/
├── README.md
├── AGENTS.md
├── CLAUDE.md
│
├── services/
├── packages/
│   ├── observability/
│   └── testing/
│
├── contracts/
│   ├── http/
│   └── events/
│
├── analysis/
│   ├── telemetry/
│   ├── features/
│   ├── anomaly/
│   ├── incident/
│   ├── graph/
│   ├── rca/
│   ├── evidence/
│   └── evaluation/
│
├── infrastructure/
│   ├── compose/
│   ├── postgres/
│   ├── redis/
│   ├── rabbitmq/
│   ├── storage/
│   │   ├── mock/
│   │   └── minio/
│   └── observability/
│       ├── otel-collector/
│       ├── prometheus/
│       ├── tempo/
│       ├── loki/
│       └── grafana/
│
├── load/
│   ├── scenarios/
│   ├── profiles/
│   └── data/
│
├── faults/
│   ├── catalog/
│   ├── injectors/
│   └── scripts/
│
├── experiments/
│   ├── protocols/
│   ├── scenarios/
│   ├── runner/
│   └── runs/
│
├── scripts/
│
├── docs/
│   ├── raw/
│   └── processed/
│       ├── architecture/
│       ├── direction/
│       ├── plan/
│       ├── description/
│       ├── adr/
│       └── ...
│
├── workspace/
├── meetings/
└── agent-resources/
```

### 4.1. Ý nghĩa các ranh giới quan trọng

`services/` chứa Gateway và LMS business services. Mỗi service deploy độc lập nhưng cùng dùng convention kỹ thuật của monorepo.

`packages/observability/` chứa shared application instrumentation như bootstrap OpenTelemetry, logger correlation và helper metric. Nó **không** chứa Collector, Prometheus, Tempo, Loki hoặc Grafana.

`infrastructure/observability/` chứa runtime/configuration của observability stack. Đây là vị trí duy nhất cho Collector, Prometheus, Tempo, Loki và Grafana.

`packages/testing/` chứa test utility kỹ thuật; không chứa business model dùng chung.

`contracts/http/` và `contracts/events/` chứa published contract. Service không import controller, repository hoặc entity của service khác.

`analysis/` chứa code Python có thể test và tái sử dụng. Notebook khám phá, nếu có, không được thay thế implementation chính trong các module này.

Không tạo các root cạnh tranh như `platform/`, `backend/`, `testbed/`, `dashboard/`, `agents/` hoặc `docs/architecture/`. Tài nguyên cho AI agent đặt dưới `agent-resources/`; tài liệu kiến trúc đã xử lý đặt dưới `docs/processed/architecture/`.

## 5. Trách nhiệm workload, fault, experiment và evaluation

### 5.1. `load/`

Chỉ tạo traffic:

```text
load/scenarios/   # k6 business flows
load/profiles/    # tỷ lệ request, rate, duration, stages
load/data/        # synthetic input data
```

Profile MVP/Target có thể gồm:

- normal mixed traffic;
- submission peak;
- grading burst;
- healthy high-load spike.

Mỗi profile phải ghi workload seed, tỷ lệ workflow, rate/stage và duration để chạy lại được. `healthy high-load spike` là negative control giúp kiểm tra detector có nhầm tăng tải hợp lệ thành incident hay không.

`load/` không inject fault và không tính evaluation metric.

### 5.2. `faults/`

Chỉ chứa cơ chế fault tái sử dụng:

```text
faults/catalog/    # loại fault, tham số, target hợp lệ
faults/injectors/  # application/dependency/resource injectors
faults/scripts/    # start, stop, cleanup, verification
```

Fault mechanism mặc định tắt và chỉ bật trong môi trường test/experiment. Business rule không được thay đổi chỉ để cài fault.

### 5.3. `experiments/`

Chỉ orchestration:

```text
experiments/protocols/  # quy tắc chạy, split, repetitions, metric
experiments/scenarios/  # tham chiếu workload + fault + timing + config
experiments/runner/     # orchestration, reset, artifact ledger
experiments/runs/       # manifest/artifact theo run hoặc link storage
```

Một scenario tham chiếu workload implementation trong `load/` và fault implementation trong `faults/`; không copy chúng vào `experiments/`.

### 5.4. `analysis/evaluation/`

Chỉ thực hiện:

```text
prediction + ground truth -> evaluation metrics
```

Module này không tạo workload, không inject fault và không điều khiển runtime testbed.

## 6. Experiment manifest và reproducibility

Mỗi run phải truy vết được từ scenario tới code, config, telemetry, prediction và evaluation. Các trường logic tối thiểu:

```yaml
experiment_id: exp-course-redis-latency
scenario_id: course-redis-latency
run_id: exp-course-redis-latency-r03
repeat_index: 3

workload_profile: normal-mixed-v1
workload_seed: 20260819

fault_type: dependency_latency
fault_target: course-redis
fault_intensity: 300ms
fault_start: 2026-08-19T03:10:00Z
fault_end: 2026-08-19T03:15:00Z

root_cause_service: course
root_cause_component: course-redis

code_commit: <git-sha>
service_versions:
  course: 0.1.0

telemetry_schema_version: 1
experiment_config_version: 1
feature_schema_version: 1
feature_config_version: 1
detector_config_version: 1
incident_config_version: 1
rca_config_version: 1
evaluation_config_version: 1

environment_profile: docker-compose-local-v1
environment_config_version: 1

telemetry_artifact: <path-or-uri>
prediction_artifact: <path-or-uri>
evaluation_artifact: <path-or-uri>
```

Quy ước:

- Timestamp dùng UTC và ISO-8601.
- `run_id` là duy nhất; `repeat_index` bắt đầu từ 1 trong cùng scenario.
- Artifact có thể nằm trong repository hoặc object storage, nhưng manifest phải chứa đường dẫn/URI mở được.
- Config version và commit phải được ghi trước khi chạy campaign chính.
- Các field có thể nằm trong nested object hoặc được tham chiếu qua config bundle/hash; không cần ép tất cả thành một JSON phẳng.
- Từ một `run_id` phải xác định được code, environment, workload/seed, fault/ground truth, telemetry schema, feature/detector/incident/RCA/evaluation config và vị trí artifact.
- Runner phải lưu trạng thái run lỗi; không âm thầm bỏ run khỏi ledger.

## 7. Kiến trúc nội bộ service

Template canonical:

```text
service/
├── src/
│   ├── domain/
│   ├── application/
│   │   ├── use-cases/
│   │   └── ports/
│   ├── adapters/
│   │   ├── http/
│   │   ├── persistence/
│   │   ├── clients/
│   │   └── messaging/
│   ├── config/
│   └── main.*
├── test/
├── Dockerfile
└── README.md
```

Không bắt buộc tạo mọi folder nếu service không dùng boundary tương ứng. Ví dụ Notification không có persistence thì không cần `adapters/persistence/`.

### 7.1. Dependency rule

```text
domain
  không phụ thuộc HTTP, database hoặc framework

application
  điều phối use case và định nghĩa boundary cần thiết

adapters
  triển khai HTTP, database, messaging, storage và external client
```

- Controller/consumer chỉ parse, validate, map transport và gọi use case.
- Outbound call qua port khi cần tách boundary để test hoặc thay implementation.
- Không tạo interface cho helper nội bộ không có boundary thật.
- Không bắt buộc cấu trúc `command/handler/result` cho mỗi use case.
- Không tạo value object, domain service hoặc folder rỗng chỉ để đúng mẫu.
- NestJS decorator/wiring được phép ở adapters và bootstrap/config, không đi vào domain.

### 7.2. Shared packages

Shared package chỉ chứa technical primitives. Không đặt `User`, `Course`, `Enrollment`, `Submission` hoặc business repository base class dùng chung trong `packages/`.

## 8. Contract và integration conventions

### 8.1. HTTP

- Public endpoint dùng prefix `/api/v1`.
- OpenAPI contract đặt trong `contracts/http/<service>/` khi được publish cho service khác hoặc client.
- Mọi outbound HTTP call có timeout rõ ràng.
- Retry tắt mặc định trong MVP; chỉ bật có chủ đích cho scenario được kiểm thử.
- Error response có code ổn định, timestamp UTC ISO-8601 và `trace_id`.

Ví dụ:

```json
{
  "code": "DEPENDENCY_TIMEOUT",
  "message": "Storage dependency timed out",
  "trace_id": "01HF...",
  "timestamp": "2026-08-19T03:15:30Z",
  "details": null
}
```

### 8.2. Event

Tên event dùng lowercase dot notation:

```text
<aggregate>.<past-tense-event>
```

Event MVP canonical:

```text
grade.completed
```

Contract đặt tại:

```text
contracts/events/grade-completed/
```

Envelope tối thiểu phải có event ID, event name, schema version, occurred time, producer, payload và trace context. Publisher/consumer phải có cơ chế chống xử lý lặp phù hợp với scope MVP.

Không dùng `grade-completed` làm event name song song với `grade.completed`; `grade-completed` chỉ là tên folder contract theo `kebab-case`. `assignment.created` hoặc event khác chỉ thuộc Target khi có consumer và experiment sử dụng thật.

## 9. Observability-by-design

### 9.1. Resource identity và thời gian

Mọi telemetry phải có:

```text
service.name
service.version
service.instance.id
```

Mọi timestamp dùng:

```text
UTC
ISO-8601
```

Không dùng `trace_id`, `span_id`, user ID hoặc request ID làm Prometheus label.

### 9.2. Tracing

Mỗi service cần quan sát được, khi boundary tương ứng tồn tại:

- inbound HTTP server span;
- outbound HTTP client span;
- PostgreSQL span;
- Redis span;
- storage dependency span;
- RabbitMQ publish span;
- RabbitMQ consume/process span;
- trace propagation qua HTTP;
- trace context propagation qua RabbitMQ message headers.

Span lỗi phải có error status và exception/error type. Dependency span phải thể hiện dependency identity, operation, timeout/error semantics và trạng thái HTTP hoặc messaging tương ứng. HTTP span ghi method, route và status theo semantic conventions hiện hành; tránh ghi URL/ID có cardinality cao vào metric label.

Controlled experiment baseline dùng:

```text
100% trace sampling
```

MVP robustness có thể mô phỏng trace dropping/sampling có kiểm soát trên telemetry artifact sau khi baseline ổn định. Việc giảm sampling trực tiếp khi chạy testbed và matrix nhiều sampling level chỉ thuộc Target khi thực sự cần.

### 9.3. Structured logs

Log machine-readable phải có tối thiểu:

```text
timestamp
level
service.name
service.version
service.instance.id
trace_id
span_id
event
```

Log dependency error bổ sung dependency identity, timeout, status/error type và latency khi có. Không log password, JWT, secret hoặc PII không cần thiết.

### 9.4. Metrics

Mọi HTTP service có RED metrics:

```text
request rate
error rate
request duration/latency
```

Dependency adapter có rate/error/duration phù hợp cho PostgreSQL, Redis, storage, outbound HTTP và RabbitMQ. Runtime metrics như CPU, memory, event-loop lag, connection pool hoặc queue depth được thêm khi có giá trị cho fault/evaluation.

### 9.5. Trace-log-metric correlation

Một fault test đạt yêu cầu khi có thể đi từ metric symptom tới trace/span liên quan và log evidence bằng service identity cùng khoảng thời gian; với log trong request context phải truy được bằng `trace_id`/`span_id`.

## 10. Fault scope canonical

MVP tập trung khoảng 5 scenario chất lượng:

| ID | Scenario | Category | Ground truth chính |
| --- | --- | --- | --- |
| F1 | Course / Redis latency | Cache | `course`, `course-redis` |
| F2 | Submission -> storage latency | Downstream dependency | `submission`, `submission-storage` |
| F3 | Submission service error | Service error | `submission`, `submission-service` |
| F4 | Notification consumer slowdown / RabbitMQ backlog | Async queue | `notification`, `notification-consumer` |
| F5 | Submission CPU pressure | Resource | `submission`, `submission-instance` |

Scenario có thể điều chỉnh sau pilot nếu fault không tạo symptom ổn định, nhưng phải giữ đủ năm category. Không cần inject fault trên mọi service.

Với F5, Submission vẫn còn sống trong khi CPU utilization tăng, latency/service behavior bị ảnh hưởng, resource signal rõ và propagation tới upstream/downstream quan sát được. `Submission crash/restart` thuộc fault catalog Target/Stretch, không phải một trong năm scenario bắt buộc của MVP.

MVP evaluation floor:

```text
5 scenarios × 3 repetitions = 15 controlled runs
```

Target có thể tăng lên khoảng 30–60+ run khi automation, thời gian và chất lượng ground truth cho phép. Số lượng run không quan trọng hơn tính hợp lệ và khả năng tái lập.

## 11. RCA và evaluation boundary

Primary RCA evaluation là **service-level**.

Ví dụ fault database của Submission:

```text
root_cause_service = submission
root_cause_component = submission-db
```

- Top-1, Top-3, MRR và Average Rank chính được tính trên candidate set service-level.
- Component/dependency là evidence bổ sung trong MVP.
- Không trộn service và component trong cùng metric chính.
- Component-level RCA chính thức là Target hoặc Stretch.
- Output nên dùng thuật ngữ root-cause candidate ranking, không tuyên bố causal proof chỉ từ telemetry quan sát.

`analysis/evaluation/` phải tính ít nhất Precision/Recall/F1/Detection Delay cho detection và Top-1/Top-3/MRR cho RCA. Split dữ liệu theo experiment run; không chia ngẫu nhiên các window của cùng run sang train và test.

## 12. Testing

Mỗi service chỉ tạo loại test có ý nghĩa:

- unit test cho domain/use case có logic;
- integration test cho PostgreSQL, Redis, RabbitMQ hoặc storage adapter;
- contract test cho published HTTP/event contract;
- E2E test cho workflow xuyên service;
- fault test cho target được đưa vào fault catalog;
- telemetry assertion cho propagation và attribute quan trọng.

Workflow E2E MVP tối thiểu:

```text
login
browse course
enroll course
submit course work
grade -> grade.completed -> notification
```

## 13. Definition of Done kỹ thuật

### 13.1. Một service

- [ ] Business/API hoặc consumer behavior chạy đúng theo contract.
- [ ] Không truy cập database hoặc source code của service khác.
- [ ] Health check, configuration và Docker image chạy được.
- [ ] Inbound/outbound/dependency span phù hợp xuất hiện.
- [ ] Trace context truyền qua mọi HTTP/RabbitMQ boundary liên quan.
- [ ] `service.name`, `service.version`, `service.instance.id` đúng.
- [ ] Structured logs có UTC ISO-8601, trace ID và span ID khi có context.
- [ ] RED metrics và dependency metrics cần thiết query được.
- [ ] Error status, HTTP status, error type, dependency identity và timeout semantics được ghi nhận.
- [ ] Test phù hợp pass và contract được cập nhật.
- [ ] Fault hook chỉ có khi service là target, mặc định tắt và có test xác minh symptom.

### 13.2. Toàn testbed

Testbed đạt DoD khi chạy lặp lại được:

```text
deploy
-> seed
-> start workload
-> collect telemetry
-> inject known fault
-> observe propagation
-> persist manifest + ground truth
-> run prediction + evaluation
-> reset
-> repeat
```

Mỗi bước phải có command/runbook và artifact kiểm chứng. Một demo thủ công không thay thế DoD tái lập.

## 14. Governance

- Thay đổi service boundary, contract, telemetry schema, experiment manifest hoặc RCA granularity cần ADR trong `docs/processed/adr/`.
- Không tạo cây tài liệu hoặc source code cạnh tranh với blueprint.
- Lịch triển khai, primary và collaborator chỉ được cập nhật trong [`plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md).
- Khi blueprint và code lệch nhau, phải cập nhật blueprint/ADR cùng PR hoặc ghi rõ migration đang diễn ra; không để hai convention cùng tồn tại vô thời hạn.
