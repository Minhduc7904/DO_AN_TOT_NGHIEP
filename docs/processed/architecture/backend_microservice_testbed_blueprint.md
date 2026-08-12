# Blueprint Backend Microservice Testbed cho Đồ án Anomaly Detection & Root Cause Analysis

## 1. Mục tiêu kiến trúc

Backend trong đồ án này **không được xem như một LMS production thông thường**.

LMS chỉ đóng vai trò là **System Under Test (SUT)** để tạo:

- service dependency;
- synchronous call;
- asynchronous event;
- database/cache/queue dependency;
- workload;
- telemetry;
- fault propagation;
- ground truth cho anomaly detection và RCA.

Vì vậy kiến trúc backend phải tối ưu đồng thời cho:

1. **Microservice boundary rõ ràng**
2. **Code sạch, dễ bảo trì**
3. **Observability ngay từ đầu**
4. **Fault injection có kiểm soát**
5. **Experiment có thể lặp lại**
6. **Dễ triển khai bằng Docker Compose**
7. **Dễ mở rộng sang Kubernetes khi cần**
8. **Dễ cho AI/code agent đọc hiểu và tuân thủ kiến trúc**

Kiến trúc tổng quát được đề xuất:

> **Monorepo + Microservices + Clean/Hexagonal Architecture bên trong từng service + Contract-first + Observability-first + Experiment-first**

---

# 2. Kiến trúc hệ thống tổng thể

```text
                         Client / k6
                              │
                              ▼
                         API Gateway
                              │
       ┌──────────────────────┼───────────────────────┐
       │                      │                       │
       ▼                      ▼                       ▼
     Auth                   Course                Enrollment
       │                  DB + Redis              DB + Course
       │                                              │
       │                      ┌───────────────────────┘
       │                      │
       ▼                      ▼
   PostgreSQL             Assignment
                              │
                              ▼
                          Submission
                       ┌──────┼───────┐
                       │      │       │
                       ▼      ▼       ▼
                  Assignment Enrollment Storage
                              │
                              ▼
                           Grading
                         DB + RabbitMQ
                              │
                              ▼
                        Notification
```

Trong đó:

- `Auth Service` tạo shared dependency liên quan xác thực.
- `Course Service` sử dụng PostgreSQL + Redis để tạo cache dependency.
- `Enrollment Service` phụ thuộc `Course Service`.
- `Assignment Service` phụ thuộc `Course Service`.
- `Submission Service` là service quan trọng trong synchronous workflow vì có fan-out sang:
  - Assignment;
  - Enrollment;
  - Object Storage.
- `Grading Service` phụ thuộc Submission và publish event qua RabbitMQ.
- `Notification Service` consume event và tạo asynchronous failure scenario.

---

# 3. Observability architecture

Tất cả business service phải được instrument ngay từ đầu.

```text
Service
  │
  └── OpenTelemetry SDK
          │
          ▼
     OTel Collector
      /    |     \
     ▼     ▼      ▼
Prometheus Tempo Loki
```

Vai trò:

- **Prometheus**: metrics
- **Tempo**: distributed traces
- **Loki**: structured logs
- **Grafana**: quan sát telemetry
- **OpenTelemetry Collector**: nhận và forward telemetry

AI/RCA chạy ngoài business request path:

```text
Business Request
      │
      ▼
Microservices
      │
      │ telemetry
      ▼
Observability
      │
      ▼
AI / RCA Platform
```

Không thiết kế kiểu:

```text
Submission
    ↓
AI RCA
    ↓
Business Response
```

AI/RCA phải là hệ thống **out-of-band**.

---

# 4. Repository architecture

Khuyến nghị sử dụng **monorepo**.

```text
graduation-project/
│
├── README.md
├── AGENTS.md
├── .gitignore
├── .editorconfig
├── Makefile
│
├── docs/
│   ├── architecture/
│   │   ├── 00-system-context.md
│   │   ├── 01-container-diagram.md
│   │   ├── 02-service-boundaries.md
│   │   ├── 03-dependency-graph.md
│   │   ├── 04-data-ownership.md
│   │   ├── 05-communication.md
│   │   ├── 06-observability.md
│   │   ├── 07-fault-model.md
│   │   └── 08-security.md
│   │
│   ├── adr/
│   │   ├── 0001-use-monorepo.md
│   │   ├── 0002-service-boundaries.md
│   │   ├── 0003-database-per-service-logical.md
│   │   ├── 0004-use-rest-for-mvp.md
│   │   ├── 0005-use-rabbitmq.md
│   │   ├── 0006-observability-first.md
│   │   └── README.md
│   │
│   ├── api/
│   ├── events/
│   ├── experiments/
│   └── runbooks/
│
├── rules/
│   ├── architecture.md
│   ├── backend.md
│   ├── api.md
│   ├── database.md
│   ├── observability.md
│   ├── testing.md
│   ├── security.md
│   └── git.md
│
├── agents/
│   └── skills/
│       └── backend/
│           ├── create-service/
│           ├── implement-use-case/
│           ├── create-api/
│           ├── database-change/
│           ├── service-client/
│           ├── event-publisher/
│           ├── event-consumer/
│           ├── observability/
│           ├── fault-injection/
│           ├── testing/
│           └── code-review/
│
├── contracts/
│   ├── http/
│   │   ├── auth/
│   │   ├── course/
│   │   ├── enrollment/
│   │   ├── assignment/
│   │   ├── submission/
│   │   └── grading/
│   │
│   ├── events/
│   │   ├── grade-completed/
│   │   ├── submission-received/
│   │   └── course-enrolled/
│   │
│   └── common/
│       └── event-envelope/
│
├── services/
│   ├── gateway/
│   ├── auth/
│   ├── course/
│   ├── enrollment/
│   ├── assignment/
│   ├── submission/
│   ├── grading/
│   └── notification/
│
├── packages/
│   ├── observability/
│   ├── logging/
│   ├── error-handling/
│   ├── messaging/
│   └── testing/
│
├── infrastructure/
│   ├── compose/
│   ├── postgres/
│   ├── redis/
│   ├── rabbitmq/
│   ├── minio/
│   ├── otel-collector/
│   ├── prometheus/
│   ├── tempo/
│   ├── loki/
│   ├── grafana/
│   └── kubernetes/
│
├── load/
│   ├── scenarios/
│   ├── profiles/
│   └── data/
│
├── faults/
│   ├── scenarios/
│   ├── scripts/
│   └── README.md
│
├── experiments/
│   ├── scenarios/
│   ├── runner/
│   ├── ground-truth/
│   └── results/
│
├── analysis/
│   └── ...
│
└── scripts/
    ├── dev/
    ├── seed/
    ├── reset/
    ├── experiment/
    └── ci/
```

---

# 5. Ý nghĩa các folder cấp cao

## `services/`

Chứa toàn bộ LMS Microservice Testbed.

```text
services/
├── gateway/
├── auth/
├── course/
├── enrollment/
├── assignment/
├── submission/
├── grading/
└── notification/
```

Đây chính là **System Under Test**.

---

## `analysis/`

Chứa backend/engine cho phần:

- telemetry adapter;
- feature engineering;
- anomaly detection;
- incident detection;
- dependency graph;
- RCA ranking;
- evidence extraction;
- evaluation.

```text
analysis/
├── telemetry/
├── features/
├── anomaly/
├── incident/
├── graph/
├── rca/
├── evidence/
└── evaluation/
```

---

## `infrastructure/`

Chứa cấu hình platform.

```text
infrastructure/
├── compose/
├── postgres/
├── redis/
├── rabbitmq/
├── minio/
├── otel-collector/
├── prometheus/
├── tempo/
├── loki/
├── grafana/
└── kubernetes/
```

---

## `experiments/`

Là cầu nối giữa backend và AI/RCA.

```text
experiments/
├── scenarios/
├── runner/
├── ground-truth/
└── results/
```

Một experiment phải biết tối thiểu:

```json
{
  "experimentId": "exp-001",
  "faultType": "network_delay",
  "targetService": "submission-service",
  "targetDependency": "object-storage",
  "startTime": "...",
  "endTime": "...",
  "intensity": "500ms",
  "workloadProfile": "submission-heavy"
}
```

---

# 6. Kiến trúc bên trong từng service

Mỗi service nên dùng **Clean Architecture / Hexagonal Architecture ở mức vừa đủ**.

Ví dụ:

```text
services/submission/
│
├── README.md
├── Dockerfile
│
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── events/
│   │   ├── errors/
│   │   └── services/
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── submit-assignment/
│   │   │   │   ├── submit-assignment.command.*
│   │   │   │   ├── submit-assignment.handler.*
│   │   │   │   └── submit-assignment.result.*
│   │   │   │
│   │   │   └── get-submission/
│   │   │
│   │   ├── ports/
│   │   │   ├── submission-repository.*
│   │   │   ├── assignment-client.*
│   │   │   ├── enrollment-client.*
│   │   │   └── object-storage.*
│   │   │
│   │   └── dto/
│   │
│   ├── infrastructure/
│   │   ├── persistence/
│   │   │   ├── postgres/
│   │   │   ├── repositories/
│   │   │   └── migrations/
│   │   │
│   │   ├── clients/
│   │   │   ├── assignment/
│   │   │   └── enrollment/
│   │   │
│   │   ├── storage/
│   │   ├── messaging/
│   │   └── config/
│   │
│   ├── presentation/
│   │   ├── http/
│   │   │   ├── controllers/
│   │   │   ├── requests/
│   │   │   └── responses/
│   │   │
│   │   └── consumers/
│   │
│   ├── observability/
│   │   ├── metrics/
│   │   ├── tracing/
│   │   └── logging/
│   │
│   ├── faults/
│   │   ├── fault-config.*
│   │   ├── delay-fault.*
│   │   ├── error-fault.*
│   │   └── cpu-fault.*
│   │
│   └── bootstrap/
│       └── main.*
│
└── tests/
    ├── unit/
    ├── integration/
    ├── contract/
    ├── e2e/
    └── fault/
```

---

# 7. Dependency rule trong một service

Luồng phụ thuộc:

```text
             Presentation
                   │
                   ▼
             Application
                   │
                   ▼
                Domain

Infrastructure ────┘
      ▲
      │
   adapters
```

## Domain

Domain:

- không biết HTTP;
- không biết PostgreSQL;
- không biết Redis;
- không biết RabbitMQ;
- không biết framework;
- không gọi service khác.

Domain chỉ chứa business concepts.

---

## Application

Application:

- sử dụng Domain;
- chứa use case;
- định nghĩa ports/interfaces;
- orchestration business flow;
- không phụ thuộc implementation của infrastructure.

Ví dụ:

```text
SubmitAssignmentUseCase
        │
        ├── ISubmissionRepository
        ├── IAssignmentClient
        ├── IEnrollmentClient
        └── IObjectStorage
```

---

## Infrastructure

Infrastructure implement các ports:

```text
ISubmissionRepository
        ▲
        │
PostgresSubmissionRepository
```

```text
IAssignmentClient
        ▲
        │
HttpAssignmentClient
```

Infrastructure chứa:

- PostgreSQL;
- Redis;
- RabbitMQ;
- HTTP client;
- gRPC client nếu có;
- MinIO;
- configuration.

---

## Presentation

Presentation chứa:

- REST Controller;
- request/response DTO;
- validation;
- RabbitMQ consumer;
- mapping transport → application.

Controller không chứa business logic.

---

## Bootstrap

Bootstrap chịu trách nhiệm:

- DI;
- application startup;
- middleware;
- health check;
- OpenTelemetry registration;
- infrastructure wiring.

---

# 8. Không tạo shared business library

Không nên tạo:

```text
packages/shared/
├── UserEntity
├── CourseEntity
├── EnrollmentEntity
├── SubmissionEntity
└── BaseRepository
```

Nếu các service chia sẻ business entity trực tiếp thì hệ thống dễ trở thành **distributed monolith**.

Shared package chỉ nên chứa technical primitives:

```text
packages/
├── observability/
├── logging/
├── error-handling/
├── messaging/
└── testing/
```

Không đặt business logic vào `packages/`.

---

# 9. Service isolation

Một service phải sở hữu:

- domain;
- database;
- migrations;
- repository;
- API;
- contract;
- observability;
- fault configuration.

Không được:

```text
Enrollment Service
      ↓
SELECT * FROM course_db.courses
```

Phải:

```text
Enrollment Service
      ↓
Course Service API
```

Hoặc asynchronous:

```text
Course Service
      ↓
RabbitMQ
      ↓
Consumer
```

---

# 10. Database strategy

Không cần tạo một PostgreSQL container cho từng service.

Có thể sử dụng:

```text
1 PostgreSQL instance

├── auth_db
├── course_db
├── enrollment_db
├── assignment_db
├── submission_db
└── grading_db
```

Database ownership logic vẫn phải độc lập.

Ví dụ:

```text
Course Service
      │
      └── course_db

Enrollment Service
      │
      └── enrollment_db
```

Rule bắt buộc:

> Một service không được query trực tiếp database/schema của service khác.

---

# 11. Contracts

Nên tách contract khỏi implementation.

```text
contracts/
├── http/
│   └── course/
│       └── openapi.yaml
│
└── events/
    └── grade-completed/
        ├── v1.schema.json
        └── README.md
```

Service khác chỉ biết published contract.

Không:

```text
Enrollment
   import CourseController
```

Không:

```text
Enrollment
   import CourseRepository
```

Nên:

```text
Enrollment
   ↓
Course Client
   ↓
Course API
```

---

# 12. Rule system

Tạo riêng:

```text
rules/
├── architecture.md
├── backend.md
├── api.md
├── database.md
├── observability.md
├── testing.md
├── security.md
└── git.md
```

Rules nên có mã để review dễ hơn.

Ví dụ:

```text
ARCH-001
A service MUST NOT directly access another service's database.

ARCH-002
Business services MUST communicate synchronously through published APIs.

ARCH-003
Cross-service asynchronous communication MUST use published event contracts.

ARCH-004
Domain layer MUST NOT depend on infrastructure/framework code.

ARCH-005
Business entities MUST NOT be placed in shared packages.

ARCH-006
Fault injection MUST NOT modify domain rules.

ARCH-007
RCA/ML MUST NOT execute inside the LMS request path.
```

Khi review có thể comment:

```text
Violation: ARCH-005
```

---

# 13. Backend code rules

Ví dụ `rules/backend.md`:

```text
BE-001
Controller chỉ validate/parse request và gọi use case.

BE-002
Không đặt business logic trong Controller.

BE-003
Không gọi database trực tiếp từ Controller.

BE-004
Outbound dependency phải đi qua application port.

BE-005
Mọi outbound HTTP call phải có timeout.

BE-006
Retry không được bật mặc định.

BE-007
Không catch exception rồi bỏ qua.

BE-008
Không throw generic exception cho expected domain error.

BE-009
API phải trả error envelope chuẩn.

BE-010
Mọi public use case phải có test.
```

---

# 14. API rules

Các endpoint nên version:

```text
/api/v1/...
```

Ví dụ:

```text
POST /api/v1/auth/login

GET  /api/v1/courses
GET  /api/v1/courses/{id}

POST /api/v1/enrollments
GET  /api/v1/enrollments/me

POST /api/v1/assignments
GET  /api/v1/assignments/{id}

POST /api/v1/submissions
GET  /api/v1/submissions/{id}

POST /api/v1/grades
GET  /api/v1/grades/{submissionId}
```

Không cần mở rộng API quá nhiều nếu không tạo giá trị cho experiment.

---

# 15. Error schema

Chuẩn hóa lỗi ngay từ đầu.

```json
{
  "code": "DEPENDENCY_TIMEOUT",
  "message": "Assignment service timeout",
  "traceId": "01HF...",
  "timestamp": "2026-08-12T02:00:00Z",
  "details": null
}
```

Không nên trả:

```json
{
  "error": "Something went wrong"
}
```

Error code phải có ý nghĩa để:

- parse log;
- correlate trace;
- extract evidence;
- xây incident timeline;
- hỗ trợ RCA.

---

# 16. Observability rules

Observability là requirement kiến trúc, không phải phần thêm sau.

Một service chỉ được coi là hoàn thành khi:

- inbound HTTP có span;
- outbound HTTP có client span;
- trace context propagate đúng;
- RabbitMQ message propagate trace context;
- error được ghi vào span;
- structured log có trace ID;
- có metrics;
- `service.name` chuẩn.

Metadata tối thiểu:

```text
service.name
service.version
service.instance.id
```

Khi Kubernetes:

```text
k8s.pod.name
k8s.namespace.name
```

---

# 17. Metrics tối thiểu

Mỗi service nên có:

```text
request_count
request_error_count
request_duration
CPU
memory
```

Derived metrics:

```text
request_rate
error_rate
p50 latency
p95 latency
p99 latency
```

Nếu framework hỗ trợ:

```text
GC
thread pool
event loop lag
connection pool
```

---

# 18. Structured logging

Log nên là JSON.

Ví dụ:

```json
{
  "timestamp": "...",
  "level": "ERROR",
  "service": "submission-service",
  "traceId": "...",
  "spanId": "...",
  "event": "dependency_timeout",
  "dependency": "assignment-service",
  "latencyMs": 1532
}
```

Không dùng kiểu:

```text
console.log("error here");
```

cho các lỗi quan trọng.

---

# 19. Distributed tracing

Phải trace được toàn workflow.

Ví dụ:

```text
POST /submissions
  ↓
Gateway
  ↓
Submission
  ├── Assignment
  │      └── Course
  │
  ├── Enrollment
  │
  └── Object Storage
```

Nếu `Object Storage` delay thì phải nhìn được:

```text
storage span ↑ latency
        ↓
submission span ↑ latency
        ↓
gateway span ↑ latency
```

Đây là dữ liệu quan trọng cho RCA.

---

# 20. Fault injection architecture

Fault injection phải là **first-class module**.

Không nên rải:

```text
if (FAULT_ENABLED)
   ...
```

khắp business code.

Nên tạo abstraction:

```text
FaultInjector
│
├── delay(point)
├── error(point)
├── cpuStress(point)
└── databaseDelay(point)
```

Ví dụ:

```text
SubmitAssignmentUseCase

1. faultInjector.apply("submission.before-validation")
2. validate
3. assignmentClient.get(...)
4. enrollmentClient.check(...)
5. storage.upload(...)
6. repository.save(...)
```

Configuration:

```yaml
faults:
  enabled: true

  rules:
    - point: submission.assignment-client
      type: delay
      value: 500ms
```

Default:

```text
faults.enabled=false
```

Fault injection chỉ bật trong test/experiment environment.

---

# 21. Fault scenarios

MVP nên có tối thiểu:

1. CPU saturation
2. Dependency/network delay
3. Service error
4. Database latency
5. Service crash

Target có thể thêm:

6. Redis slowdown
7. DB connection pool exhaustion
8. RabbitMQ consumer slowdown
9. Queue backlog
10. Object storage latency

---

# 22. Backend skills cho AI/code agent

Không tạo một file quá chung chung như:

```text
backend-expert.md
```

Nên chia skill theo loại task.

```text
agents/
└── skills/
    └── backend/
        ├── create-service/
        │   └── SKILL.md
        │
        ├── implement-use-case/
        │   └── SKILL.md
        │
        ├── create-api/
        │   └── SKILL.md
        │
        ├── database-change/
        │   └── SKILL.md
        │
        ├── service-client/
        │   └── SKILL.md
        │
        ├── event-publisher/
        │   └── SKILL.md
        │
        ├── event-consumer/
        │   └── SKILL.md
        │
        ├── observability/
        │   └── SKILL.md
        │
        ├── fault-injection/
        │   └── SKILL.md
        │
        ├── testing/
        │   └── SKILL.md
        │
        └── code-review/
            └── SKILL.md
```

---

# 23. Cấu trúc một skill

Ví dụ:

```text
agents/skills/backend/create-api/SKILL.md
```

```markdown
# Create Backend API

## Goal

Implement a REST endpoint without violating service boundaries.

## Before coding

Read:

- /rules/architecture.md
- /rules/backend.md
- /rules/api.md
- /rules/observability.md
- /docs/architecture/02-service-boundaries.md

## Required flow

Controller
    ↓
Application Use Case
    ↓
Domain / Ports
    ↓
Infrastructure

## Must

- Validate request.
- Use application use case.
- Return standardized error envelope.
- Preserve trace context.
- Add API test.
- Update OpenAPI contract.

## Must not

- Put business logic in controller.
- Access repository directly from controller.
- Access another service database.
- Import another service source code.

## Definition of Done

- lint
- unit tests
- integration tests if persistence affected
- API contract updated
- telemetry visible
```

---

# 24. Vai trò của `AGENTS.md`

Root file:

```text
AGENTS.md
```

chỉ đóng vai trò router.

Ví dụ:

```markdown
# Repository Instructions

Architecture rules:
→ rules/architecture.md

Backend rules:
→ rules/backend.md

API rules:
→ rules/api.md

Database:
→ rules/database.md

Observability:
→ rules/observability.md

Testing:
→ rules/testing.md

Backend skills:
→ agents/skills/backend/
```

Không nhét toàn bộ rule vào một file `AGENTS.md` khổng lồ.

---

# 25. Architecture documentation

Tạo:

```text
docs/architecture/
```

Nó mô tả:

> Hệ thống hiện tại được thiết kế như thế nào?

Nên có:

```text
00-system-context.md
01-container-diagram.md
02-service-boundaries.md
03-dependency-graph.md
04-data-ownership.md
05-communication.md
06-observability.md
07-fault-model.md
08-security.md
```

---

# 26. ADR

Tạo:

```text
docs/adr/
```

ADR trả lời:

> Vì sao chúng ta lại chọn kiến trúc này?

Ví dụ:

```text
0001-use-monorepo.md
0002-service-boundaries.md
0003-database-per-service-logical.md
0004-use-rest-for-mvp.md
0005-use-rabbitmq.md
0006-observability-first.md
```

Template:

```markdown
# ADR-0001: Use Monorepo

## Status

Accepted

## Context

...

## Decision

...

## Consequences

...

## Alternatives Considered

...
```

Mọi thay đổi kiến trúc lớn nên tạo ADR mới.

---

# 27. Testing architecture

Mỗi service:

```text
tests/
├── unit/
├── integration/
├── contract/
├── e2e/
└── fault/
```

## Unit Test

Test:

- Domain;
- application use case;
- helper;
- business rules.

---

## Integration Test

Test integration với:

- PostgreSQL;
- Redis;
- RabbitMQ;
- MinIO nếu có.

---

## Contract Test

Test:

```text
Service A
      ↕
published contract
      ↕
Service B
```

---

## E2E Test

Các workflow:

```text
login
enroll
submit
grade → notification
```

---

## Fault Test

Ví dụ:

```text
inject DB latency
      ↓
service latency increase
      ↓
trace shows slow DB span
      ↓
metrics show increased p95
      ↓
logs contain DB latency evidence
```

---

# 28. Definition of Done cho một service

Một service không được coi là hoàn thành chỉ vì API trả `200 OK`.

Checklist:

## Business

- [ ] API chạy
- [ ] Persistence chạy
- [ ] Validation
- [ ] Error handling

## Runtime

- [ ] Health endpoint
- [ ] Docker image
- [ ] Configuration tách khỏi source code

## Observability

- [ ] Inbound trace
- [ ] Outbound trace
- [ ] Trace propagation
- [ ] Metrics
- [ ] Structured logs
- [ ] Trace-log correlation
- [ ] `service.name`

## Test

- [ ] Unit test
- [ ] Integration test nếu cần
- [ ] Contract test nếu gọi service khác
- [ ] Fault test nếu service là fault target

---

# 29. Definition of Done cho toàn testbed

Testbed hoàn thành khi lặp được quy trình:

```text
deploy
  ↓
seed
  ↓
run workload
  ↓
collect telemetry
  ↓
inject fault
  ↓
observe propagated symptoms
  ↓
store ground truth
  ↓
reset
  ↓
repeat experiment
```

Nếu chưa tự động hoặc tái lập được quy trình này thì backend chưa hoàn thành vai trò **System Under Test**.

---

# 30. Docker Compose trước, Kubernetes sau

Phase 1:

```text
Docker Compose
```

Mục tiêu:

```bash
docker compose up
```

có thể khởi động toàn bộ:

- microservices;
- PostgreSQL;
- Redis;
- RabbitMQ;
- MinIO/storage mock;
- OpenTelemetry Collector;
- Prometheus;
- Tempo;
- Loki;
- Grafana.

Chỉ chuyển sang Kubernetes khi:

- service ổn;
- tracing ổn;
- workload chạy được;
- fault automation chạy được;
- experiment runner chạy được;
- AI/RCA MVP đã có dữ liệu.

Kubernetes chỉ dùng để tăng realism và hỗ trợ Chaos Mesh nếu cần.

Không biến Kubernetes thành trọng tâm của đồ án.

---

# 31. Thứ tự triển khai đề xuất

## Phase 1 — Architecture

1. Tạo monorepo.
2. Tạo `docs/architecture`.
3. Viết service boundaries.
4. Viết dependency graph.
5. Chốt database ownership.
6. Chốt REST/event contract.
7. Chốt fault map.
8. Chốt observability requirement.
9. Tạo ADR.
10. Tạo rules.

---

## Phase 2 — Platform skeleton

11. Docker Compose.
12. PostgreSQL.
13. Redis.
14. RabbitMQ.
15. OpenTelemetry Collector.
16. Prometheus.
17. Tempo.
18. Loki.
19. Grafana.

---

## Phase 3 — Core services

20. Gateway.
21. Auth.
22. Course.
23. Enrollment.
24. Assignment.
25. Submission.
26. Grading.
27. Notification.

---

## Phase 4 — Experiment support

28. k6 workload generator.
29. Fault framework.
30. Experiment metadata.
31. Ground truth storage.
32. Automated reset.
33. Experiment runner.

---

## Phase 5 — Scope freeze

Khi đã có:

```text
7–8 services
PostgreSQL
Redis
RabbitMQ
5 workflows
5 fault types
OpenTelemetry
automated workload
```

thì **freeze business feature**.

Sau đó chỉ tập trung:

- bug fixing;
- observability;
- fault scenarios;
- experiments;
- AI/RCA integration;
- evaluation.

---

# 32. Những phần nên cắt trước nếu thiếu thời gian

Cắt theo thứ tự:

1. LMS frontend
2. MinIO → dùng storage mock
3. gRPC
4. Kubernetes
5. Advanced authentication
6. Circuit breaker
7. Service mesh

Không được cắt:

- distributed tracing;
- metrics;
- structured logs;
- load generator;
- fault injection;
- ground truth;
- dependency graph đủ phong phú.

---

# 33. Blueprint tổng thể cuối cùng

```text
                    graduation-project
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
       services        analysis      infrastructure
          │                │
      LMS Testbed        AI/RCA
          │                ▲
          │ telemetry      │
          └────────────────┘
                 │
                 ▼
             experiments
          workload + faults
          + ground truth
```

Code governance:

```text
AGENTS.md
    │
    ├── rules/
    │     ├── architecture
    │     ├── backend
    │     ├── API
    │     ├── DB
    │     ├── observability
    │     └── testing
    │
    └── agents/skills/backend/
```

Architecture governance:

```text
docs/architecture/
        +
docs/adr/
```

Runtime:

```text
Docker Compose
      ↓
optional Kubernetes
```

Service architecture:

```text
presentation
     ↓
application
     ↓
domain

infrastructure → application ports
```

Service isolation:

```text
NO cross-service source imports
NO cross-service DB access
NO shared business entity

REST / Event contracts only
```

---

# 34. Nguyên tắc quan trọng nhất

Backend này không được đánh giá bằng số lượng CRUD hoặc số lượng chức năng LMS.

Giá trị thực sự của backend nằm ở khả năng tạo ra:

```text
realistic topology
        +
sync dependency
        +
async dependency
        +
database/cache/queue
        +
controlled workload
        +
controlled faults
        +
observability telemetry
        +
known ground truth
```

Từ đó hệ thống AI/RCA mới có thể thực hiện:

```text
anomaly detection
        +
incident detection
        +
root-cause candidate ranking
        +
evidence extraction
        +
quantitative evaluation
```

Quan hệ cốt lõi:

```text
Backend tạo failure có kiểm soát
             ↓
Telemetry ghi nhận failure propagation
             ↓
AI/RCA phân tích telemetry
             ↓
Ground truth đánh giá AI/RCA
```

Đây là nguyên tắc cần giữ xuyên suốt toàn bộ đồ án.
