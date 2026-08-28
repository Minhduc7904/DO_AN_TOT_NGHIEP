# HTTP and event contracts v1

> **Task:** `task-02_define-http-and-event-contracts`
>
> **Status:** Review-ready — contract kỹ thuật v1 đã thiết kế; collaborator review vẫn `PENDING`.
>
> **Vị trí canonical khi đưa vào repository:** `docs/processed/architecture/http-and-event-contracts-v1.md`
>
> **Mục đích:** chốt HTTP contract tối thiểu cho W1–W5 và event `grade.completed` để tuần 5 có thể scaffold `contracts/http/` và `contracts/events/` mà không vi phạm service boundary, data ownership hoặc telemetry/RCA requirement.

## 1. Source of truth và dependency

Artifact này phụ thuộc:

1. `backend_microservice_testbed_blueprint.md`.
2. `service-catalogue-and-topology-v1.md`.
3. `analysis-anomaly-rca-blueprint.md`.
4. `../direction/project-scope-v1.md`.
5. `../direction/research-questions-and-metrics-v1.md`.
6. `../plan/implementation-backlog-v1.md`.

Telemetry/ground-truth schema từ `task-04` chưa được coi là approved tại thời điểm artifact này. Vì vậy contract v1 chỉ chốt các field correlation/identity **cần thiết ở application boundary**; field experiment/ground-truth không được nhét vào business payload nếu chưa có quyết định canonical.

### Không thuộc task này

- Không viết controller/DTO code.
- Không cấu hình RabbitMQ runtime.
- Không triển khai retry/DLQ.
- Không thiết kế event khác ngoài `grade.completed`.
- Không cho service import controller/entity/repository của service khác.
- Không biến contract thành full LMS API.

---

# 2. Contract principles v1

## 2.1. Versioning

Public/published HTTP contract dùng:

```text
/api/v1
```

Quy tắc:

- additive optional field: có thể giữ `/api/v1`;
- đổi semantics hoặc xóa/đổi required field: breaking change, cần version mới/ADR;
- service-to-service cũng dùng published contract, không dùng source import.

Event:

```text
event_name = grade.completed
schema_version = 1
folder = contracts/events/grade-completed/
```

`grade-completed` chỉ là tên folder `kebab-case`; tên event runtime luôn là `grade.completed`.

## 2.2. ID và timestamp

- ID trong contract v1 là `string` opaque; không khóa implementation vào UUID/int khi chưa có data-ownership schema chính thức.
- Timestamp ở boundary dùng **UTC ISO-8601**.
- JSON field dùng `snake_case` trong artifact contract v1 để đồng nhất với telemetry/experiment artifacts; implementation DTO có thể map nội bộ nhưng published JSON phải giữ contract.

## 2.3. Trace/correlation

HTTP phải propagate W3C trace context:

```text
traceparent
tracestate   # optional
```

Error response phải có:

```text
trace_id
timestamp
```

MVP không dùng `trace_id`, `span_id`, user ID hoặc request ID làm Prometheus label.

### Trust boundary và principal context HTTP

Luồng canonical yêu cầu Gateway validate JWT locally, không remote-introspect Auth cho mọi request. Contract v1 chọn:

```text
x-principal-id
x-principal-role
```

là **internal trusted headers** do Gateway tạo từ JWT claims sau khi validate.

Ba loại caller có trust boundary khác nhau:

1. **External client -> Gateway:** client gửi `Authorization: Bearer <JWT>` và không được quyết định `x-principal-id`/`x-principal-role`. Gateway validate JWT tại chỗ, strip/overwrite mọi `x-principal-*` từ external request và derive principal context tin cậy từ JWT claims.
2. **Gateway -> business service:** đây là internal request sau khi Gateway đã xác thực principal. Gateway propagate W3C trace context, cùng `x-principal-id`/`x-principal-role` khi downstream endpoint cần principal context. Business service không remote-introspect Auth.
3. **Service -> service:** call dùng published HTTP contract trên internal network, không mặc định phải propagate end-user Bearer JWT và không phụ thuộc Auth remote introspection. Chỉ propagate principal context khi downstream thực sự cần để xử lý contract; call không cần user/principal context không bắt buộc mang principal headers.

Header này không được dùng làm Prometheus label. MVP không thêm mTLS, service IAM, OAuth service credential hoặc production-grade service authentication chỉ để mở rộng trust boundary này. Nếu tuần 5 chọn cơ chế truyền principal khác, phải cập nhật contract/ADR trước scaffold rộng; không được để mỗi service tự chọn convention riêng.

## 2.4. Authentication

- `POST /api/v1/auth/login` và `POST /api/v1/auth/refresh` không yêu cầu access JWT.
- Các public business API khác đi qua Gateway và yêu cầu Bearer JWT; service-to-service chỉ gọi published internal contract tương ứng.
- Gateway validate signature, expiry và claim cần thiết tại chỗ.
- Auth **không** là runtime dependency của mọi request đã có JWT hợp lệ.

## 2.5. Timeout/retry

Mọi outbound HTTP call:

- phải có timeout rõ trong config;
- phải emit timeout/error telemetry;
- **retry OFF mặc định trong MVP**;
- chỉ bật retry khi có scenario/test/ADR có chủ đích.

Contract không chốt số millisecond ở tuần 4; timeout value là runtime config cần freeze trước experiment campaign.

---

# 3. Common HTTP error contract

## 3.1. Error envelope

```json
{
  "code": "DEPENDENCY_TIMEOUT",
  "message": "Storage dependency timed out",
  "trace_id": "01HF...",
  "timestamp": "2026-08-27T10:15:30Z",
  "details": null
}
```

Schema:

| Field | Type | Required | Ý nghĩa |
| --- | --- | :---: | --- |
| `code` | string | ✓ | Stable machine-readable error code |
| `message` | string | ✓ | Human-readable summary, không chứa secret/PII |
| `trace_id` | string | ✓ | Correlation tới distributed trace |
| `timestamp` | string(date-time) | ✓ | UTC ISO-8601 |
| `details` | object/null | ✓ | Validation/detail có kiểm soát; không dump exception |

## 3.2. Error code tối thiểu

| HTTP | `code` | Khi dùng |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Request/body/query không hợp lệ |
| 401 | `UNAUTHORIZED` | JWT/login credential không hợp lệ hoặc thiếu |
| 403 | `FORBIDDEN` | Principal không có quyền cần thiết |
| 404 | `NOT_FOUND` | Resource thuộc service owner không tồn tại |
| 409 | `CONFLICT` | Enrollment/grade duplicate hoặc state conflict |
| 503 | `DEPENDENCY_UNAVAILABLE` | Dependency không sẵn sàng |
| 504 | `DEPENDENCY_TIMEOUT` | Outbound dependency timeout |
| 500 | `INTERNAL_ERROR` | Lỗi service không phân loại được |

Service không trả raw stack trace, password, JWT, secret hoặc internal DB detail.

---

# 4. Contract catalogue theo owner

| Contract owner | Endpoint/event | Consumer/caller chính | Workflow |
| --- | --- | --- | --- |
| Auth | `POST /api/v1/auth/login` | Client qua Gateway | W1 |
| Auth | `POST /api/v1/auth/refresh` | Client qua Gateway | W1/support |
| Course | `POST /api/v1/courses` | Seed/admin client qua Gateway | setup/W2 |
| Course | `GET /api/v1/courses` | Client qua Gateway | W2 |
| Course | `GET /api/v1/courses/{course_id}` | Client/Gateway; Enrollment; Submission | W2/W3/W4 |
| Enrollment | `POST /api/v1/enrollments` | Client qua Gateway | W3 |
| Enrollment | `GET /api/v1/enrollments/check` | Submission | W4 |
| Submission | `POST /api/v1/submissions` | Client qua Gateway | W4 |
| Submission | `GET /api/v1/submissions/{submission_id}` | Client/Gateway; Grading | W4/W5 |
| Storage Mock | `PUT /api/v1/objects/{object_key}` | Submission | W4 |
| Storage Mock | `GET /api/v1/objects/{object_key}` | Submission/test utility khi cần | W4/support |
| Grading | `POST /api/v1/grades` | Client qua Gateway | W5 |
| Grading | `GET /api/v1/grades/{grade_id}` | Client qua Gateway | W5/support |
| Grading | event `grade.completed` | Notification | W5 |

Notification không cần business HTTP endpoint trong MVP ngoài health/readiness endpoint kỹ thuật của service template.

`GET /api/v1/courses/{course_id}` và `GET /api/v1/submissions/{submission_id}` có thể được gọi qua Gateway hoặc service-to-service. Published resource semantics giữ nguyên, còn authentication/trusted-caller context phụ thuộc loại caller theo mục 2.3.

---

# 5. W1 — Auth contracts

## 5.1. `POST /api/v1/auth/login`

**Owner:** Auth
**Caller:** Client -> Gateway -> Auth
**Authentication:** không cần access token.

### Request

```json
{
  "email": "student@example.test",
  "password": "example-password"
}
```

| Field | Type | Required | Rule |
| --- | --- | :---: | --- |
| `email` | string | ✓ | Login identity tối thiểu |
| `password` | string | ✓ | Không log/trace payload |

### Success `200`

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque-token>",
  "token_type": "Bearer",
  "expires_in_seconds": 3600,
  "principal": {
    "id": "student-001",
    "role": "student"
  }
}
```

Contract yêu cầu JWT có đủ claim để Gateway derive tối thiểu:

```text
sub  -> x-principal-id
role -> x-principal-role
exp
```

Không chốt thêm claim production-grade ngoài nhu cầu MVP.

### Errors

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `500 INTERNAL_ERROR`
- dependency DB timeout/unavailable theo common error contract nếu xảy ra.

---

## 5.2. `POST /api/v1/auth/refresh`

### Request

```json
{
  "refresh_token": "<opaque-token>"
}
```

### Success `200`

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque-token>",
  "token_type": "Bearer",
  "expires_in_seconds": 3600
}
```

### Errors

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `500 INTERNAL_ERROR`

---

# 6. W2 — Course contracts

## 6.1. Course representation

```json
{
  "id": "course-001",
  "title": "Distributed Systems Basics",
  "created_at": "2026-08-27T10:00:00Z"
}
```

Chỉ giữ field đủ cho testbed. Không mở rộng syllabus/media/instructor/category nếu chưa tạo giá trị experiment.

## 6.2. `POST /api/v1/courses`

**Owner:** Course
**Authentication:** Bearer JWT; role policy tối thiểu có thể giới hạn theo seed/admin role.

Request:

```json
{
  "title": "Distributed Systems Basics"
}
```

Success `201`: Course representation.

Errors:

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `500 INTERNAL_ERROR`

## 6.3. `GET /api/v1/courses`

Success `200`:

```json
{
  "items": [
    {
      "id": "course-001",
      "title": "Distributed Systems Basics",
      "created_at": "2026-08-27T10:00:00Z"
    }
  ]
}
```

Query tối thiểu:

```text
limit   optional
```

Pagination phức tạp không thuộc task này.

Course có thể phục vụ từ Redis hoặc PostgreSQL theo implementation nhưng contract response không được tiết lộ cache implementation.

## 6.4. `GET /api/v1/courses/{course_id}`

**Caller:** Client/Gateway, Enrollment, Submission.

Success `200`: Course representation.

Errors:

- `404 NOT_FOUND`
- `503 DEPENDENCY_UNAVAILABLE`
- `504 DEPENDENCY_TIMEOUT`
- `500 INTERNAL_ERROR`

---

# 7. W3 — Enrollment contracts

## 7.1. Enrollment representation

```json
{
  "id": "enrollment-001",
  "principal_id": "student-001",
  "course_id": "course-001",
  "created_at": "2026-08-27T10:05:00Z"
}
```

## 7.2. `POST /api/v1/enrollments`

**Owner:** Enrollment
**Caller:** Client -> Gateway -> Enrollment
**Principal:** lấy từ trusted `x-principal-id`, không tin `principal_id` trong external body.

Request:

```json
{
  "course_id": "course-001"
}
```

Flow nội bộ:

```text
Enrollment
-> GET Course /api/v1/courses/{course_id}
-> write enrollment_db
```

Success `201`: Enrollment representation.

Errors:

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 NOT_FOUND` nếu Course không tồn tại
- `409 CONFLICT` nếu đã enroll
- `503 DEPENDENCY_UNAVAILABLE`
- `504 DEPENDENCY_TIMEOUT`
- `500 INTERNAL_ERROR`

## 7.3. `GET /api/v1/enrollments/check`

**Owner:** Enrollment
**Caller chính:** Submission qua HTTP service-to-service.

Query:

```text
principal_id=<opaque-string>
course_id=<opaque-string>
```

Success `200`:

```json
{
  "principal_id": "student-001",
  "course_id": "course-001",
  "enrolled": true
}
```

Endpoint này là published service contract; Submission không được đọc `enrollment_db`.

`GET /api/v1/enrollments/check` là internal published service contract với caller chính là Submission; MVP không cần expose nó như public client route qua Gateway.

---

# 8. W4 — Submission contracts

## 8.1. Submission representation

```json
{
  "id": "submission-001",
  "principal_id": "student-001",
  "course_id": "course-001",
  "storage_object_key": "submissions/submission-001",
  "submitted_at": "2026-08-27T10:10:00Z"
}
```

`storage_object_key` là reference do Submission sở hữu. Nội dung object thuộc Storage Mock dependency.

## 8.2. `POST /api/v1/submissions`

**Owner:** Submission
**Caller:** Client -> Gateway -> Submission
**Principal:** trusted `x-principal-id`.

Request:

```json
{
  "course_id": "course-001",
  "content": "answer payload for controlled testbed"
}
```

`content` chỉ là testbed payload để tạo storage dependency. Nó không đại diện thiết kế upload/file production-grade.

Flow bắt buộc:

```text
Submission
-> GET Course /api/v1/courses/{course_id}
-> GET Enrollment /api/v1/enrollments/check?principal_id=...&course_id=...
-> PUT Storage Mock /api/v1/objects/{object_key}
-> write submission_db
```

Success `201`: Submission representation.

Errors:

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN` nếu chưa enrollment
- `404 NOT_FOUND` nếu Course không tồn tại
- `503 DEPENDENCY_UNAVAILABLE`
- `504 DEPENDENCY_TIMEOUT`
- `500 INTERNAL_ERROR`

F2 phải có khả năng làm endpoint này sinh `DEPENDENCY_TIMEOUT` hoặc latency tăng có kiểm soát khi Storage Mock fault được bật.

## 8.3. `GET /api/v1/submissions/{submission_id}`

**Caller:** Client/Gateway và Grading.

Success `200`:

```json
{
  "id": "submission-001",
  "principal_id": "student-001",
  "course_id": "course-001",
  "storage_object_key": "submissions/submission-001",
  "submitted_at": "2026-08-27T10:10:00Z"
}
```

Grading dùng published HTTP contract này; không đọc `submission_db`.

Errors:

- `404 NOT_FOUND`
- `503 DEPENDENCY_UNAVAILABLE`
- `504 DEPENDENCY_TIMEOUT`
- `500 INTERNAL_ERROR`

---

# 9. Storage Mock HTTP contract

Storage Mock là controllable external dependency, không phải in-process fake adapter và không phải public LMS API cho client. Endpoint của nó là internal/external-dependency contract cho Submission hoặc test utility khi cần.

## 9.1. `PUT /api/v1/objects/{object_key}`

Request:

```json
{
  "content": "answer payload for controlled testbed"
}
```

Success `200`:

```json
{
  "object_key": "submissions/submission-001",
  "stored": true,
  "stored_at": "2026-08-27T10:10:01Z"
}
```

Failure behavior phải hỗ trợ deterministic:

```text
latency injection
error injection
start/end control
```

để phục vụ F2.

## 9.2. `GET /api/v1/objects/{object_key}`

Success `200`:

```json
{
  "object_key": "submissions/submission-001",
  "content": "answer payload for controlled testbed"
}
```

Contract này phục vụ read path/test khi cần; MVP không xây object-storage API đầy đủ.

---

# 10. W5 — Grading contracts

## 10.1. Grade representation

```json
{
  "id": "grade-001",
  "submission_id": "submission-001",
  "score": 8.5,
  "completed_at": "2026-08-27T10:15:00Z"
}
```

## 10.2. `POST /api/v1/grades`

**Owner:** Grading
**Caller:** Client -> Gateway -> Grading

Request:

```json
{
  "submission_id": "submission-001",
  "score": 8.5
}
```

Flow:

```text
Grading
-> GET Submission /api/v1/submissions/{submission_id}
-> write grading_db
-> publish grade.completed
```

Success `201`:

```json
{
  "id": "grade-001",
  "submission_id": "submission-001",
  "score": 8.5,
  "completed_at": "2026-08-27T10:15:00Z"
}
```

Errors:

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 NOT_FOUND` nếu Submission không tồn tại
- `409 CONFLICT` nếu grade completed đã tồn tại cho submission theo rule MVP
- `503 DEPENDENCY_UNAVAILABLE`
- `504 DEPENDENCY_TIMEOUT`
- `500 INTERNAL_ERROR`

### Event publication semantics

`grade.completed` chỉ được publish sau khi grade đã được persist thành công.

Contract v1 không tự tuyên bố distributed transaction/Outbox là bắt buộc. Nếu implementation chọn Outbox sau này, đó là implementation/ADR; published event schema không đổi.

## 10.3. `GET /api/v1/grades/{grade_id}`

Success `200`: Grade representation.

Errors:

- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

# 11. Event contract — `grade.completed`

## 11.1. Ownership

```text
Producer: grading
Transport: RabbitMQ
Consumer: notification
Logical service edge: grading -> notification
Contract folder: contracts/events/grade-completed/
Runtime event name: grade.completed
Schema version: 1
```

Không tạo thêm event MVP nếu chưa có consumer, failure mode và experiment value cụ thể.

## 11.2. Envelope v1

```json
{
  "event_id": "evt-grade-001",
  "event_name": "grade.completed",
  "schema_version": 1,
  "occurred_at": "2026-08-27T10:15:00Z",
  "producer": {
    "service_name": "grading",
    "service_version": "0.1.0"
  },
  "correlation": {
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "tracestate": null
  },
  "payload": {
    "grade_id": "grade-001",
    "submission_id": "submission-001",
    "principal_id": "student-001",
    "course_id": "course-001",
    "score": 8.5,
    "completed_at": "2026-08-27T10:15:00Z"
  }
}
```

## 11.3. Field definition

### Transport carrier RabbitMQ cho trace context

RabbitMQ message headers/properties là **canonical transport carrier** cho W3C trace context. Producer Grading phải inject `traceparent` và `tracestate` (khi có) vào headers/properties theo convention tương thích OpenTelemetry; Consumer Notification phải extract context đó để nối producer/business span, publish span và consume/process span vào cùng distributed trace khi telemetry đầy đủ.

`correlation.traceparent` và `correlation.tracestate` trong JSON envelope vẫn giữ cho application-level traceability, artifact/debug correlation và fallback correlation khi cần. Chúng **không** thay thế transport-level propagation qua RabbitMQ headers. Khi envelope và transport headers cùng có trace context, chúng phải phản ánh cùng context/convention, không cố ý tạo hai trace độc lập.

### Envelope

| Field | Type | Required | Ý nghĩa |
| --- | --- | :---: | --- |
| `event_id` | string | ✓ | Unique event identity; idempotency/dedup key |
| `event_name` | string | ✓ | Luôn `grade.completed` |
| `schema_version` | integer | ✓ | `1` cho schema này |
| `occurred_at` | string(date-time) | ✓ | Thời điểm domain event xảy ra, UTC |
| `producer.service_name` | string | ✓ | `grading` |
| `producer.service_version` | string | ✓ | Version service phát event |
| `correlation.traceparent` | string | ✓ | Application-level traceability/fallback; không thay transport carrier RabbitMQ |
| `correlation.tracestate` | string/null | ✓ | Application-level trace state/fallback; không thay transport carrier RabbitMQ |
| `payload` | object | ✓ | Snapshot đủ để Notification xử lý mà không đọc DB service khác |

### Payload

| Field | Type | Required | Ownership/source |
| --- | --- | :---: | --- |
| `grade_id` | string | ✓ | Grading |
| `submission_id` | string | ✓ | Lấy từ grade/Submission contract |
| `principal_id` | string | ✓ | Snapshot từ Submission response |
| `course_id` | string | ✓ | Snapshot từ Submission response |
| `score` | number | ✓ | Grading |
| `completed_at` | string(date-time) | ✓ | Grading |

Notification **không** query `grading_db`/`submission_db` để bổ sung các field trên.

## 11.4. Vì sao payload có snapshot

Event cần đủ cho consumer xử lý mô phỏng:

```text
ai được thông báo
về course/submission nào
grade nào
score bao nhiêu
khi nào hoàn thành
```

Việc copy identity cần thiết vào event là published snapshot, không chuyển ownership của Course/Submission/User sang Notification.

---

# 12. Event delivery, duplicate và failure expectation

MVP contract giả định message delivery có thể bị redelivery. Vì vậy:

1. Consumer phải xem `event_id` là idempotency key.
2. Cùng `event_id` được xử lý lặp không được tạo nhiều **logical notification result**.
3. Consumer chỉ coi message thành công sau khi simulated notification processing hoàn tất.
4. Handler failure phải được observable bằng span/log/metric và không được giả thành success.
5. Số retry, delay và DLQ topology **không phải business schema** và chưa freeze trong contract này.
6. Nếu implementation thêm bounded retry/DLQ, config đó phải versioned/observable và không được che mất F4 RabbitMQ backlog/consumer slowdown.
7. Event payload/schema không thay đổi chỉ vì transport retry config thay đổi.
8. Primary async correlation là W3C trace context qua RabbitMQ message headers/properties. Khi trace context thiếu hoặc telemetry degraded, dùng `event_id` và temporal correlation làm fallback, đồng thời Analysis giảm confidence theo blueprint. `event_id` vẫn là event identity/idempotency key, không thay trace identity.
9. Không freeze exchange name, queue name, retry count, DLQ topology hoặc broker implementation detail trong task này.

### MVP duplicate handling

Notification có thể chọn implementation duplicate-safe tối thiểu phù hợp testbed, nhưng phải có test chứng minh:

```text
same event_id delivered twice
-> one logical notification outcome
-> duplicate observable
```

Không bắt buộc production-grade exactly-once semantics.

---

# 13. Event compatibility rules

Schema `1` giữ tương thích khi:

- thêm field optional;
- consumer cũ có thể bỏ qua field chưa biết;
- semantics field cũ không đổi.

Breaking khi:

- đổi tên/xóa required field;
- đổi type;
- đổi semantics;
- đổi `event_name`;
- đổi ownership/producer/consumer làm thay đổi workflow canonical.

Breaking change cần schema version mới + ADR + cập nhật producer/consumer contract test.

Không phát song song:

```text
grade.completed
grade-completed
```

như hai runtime event name.

---

# 14. HTTP compatibility rules

## Backward-compatible

- thêm optional response field;
- thêm optional request field có default rõ;
- thêm error detail optional mà `code` cũ vẫn giữ semantics.

## Breaking

- đổi route/method;
- đổi required field;
- đổi field type;
- đổi meaning của status/error code;
- đổi resource owner;
- đổi service-to-service dependency tạo topology mới.

Breaking change phải update OpenAPI/contract tests và xem xét ADR.

---

# 15. Cross-service boundary rules

Published contracts dự kiến:

```text
contracts/
├── http/
│   ├── auth/
│   ├── course/
│   ├── enrollment/
│   ├── submission/
│   ├── grading/
│   └── storage-mock/
└── events/
    └── grade-completed/
```

Allowed:

```text
Enrollment -> import published Course contract type/schema
Submission -> import published Course/Enrollment/Storage contract type/schema
Grading -> import published Submission contract type/schema
Notification -> import grade.completed contract
```

Forbidden:

```text
Enrollment -> CourseController
Enrollment -> CourseRepository
Submission -> EnrollmentEntity
Grading -> SubmissionRepository
Notification -> GradingEntity
Notification -> grading_db
```

Contract package không chứa business repository base class hoặc shared domain entity.

---

# 16. Contract-to-topology traceability

| Workflow | Public edge | Internal edge | Component edge | Contract |
| --- | --- | --- | --- | --- |
| W1 | Client -> Gateway -> Auth | — | Auth -> `auth_db` | login/refresh |
| W2 | Client -> Gateway -> Course | — | Course -> Redis/PostgreSQL | Course list/get |
| W3 | Client -> Gateway -> Enrollment | Enrollment -> Course | Enrollment -> PostgreSQL | create enrollment + Course get |
| W4 | Client -> Gateway -> Submission | Submission -> Course; Submission -> Enrollment | Submission -> Storage Mock/PostgreSQL | create submission + dependency contracts |
| W5 | Client -> Gateway -> Grading | Grading -> Submission; async Grading -> Notification | Grading -> PostgreSQL/RabbitMQ | create grade + `grade.completed` |

---

# 17. Telemetry/evaluation requirements reflected in contract

## HTTP

Mỗi HTTP boundary phải cho phép tạo:

```text
inbound server span
outbound client span
method
route
status
duration
error_type
timeout semantics
caller/callee identity
trace relation
```

Error contract trả `trace_id` để người dùng/dev map request lỗi sang trace.

## Async

`grade.completed` cung cấp:

```text
event_id
event_name
schema_version
occurred_at
producer identity
trace context
payload identity
```

đủ để:

- nối publish -> consume bằng RabbitMQ transport headers/properties;
- hỗ trợ application-level traceability/debug bằng `correlation.traceparent`/`correlation.tracestate`, không thay transport propagation;
- fallback correlation bằng `event_id`/time nếu trace thiếu hoặc telemetry degraded;
- kiểm tra async edge `grading -> notification`;
- đo F4 queue/consumer symptom;
- giữ provenance của event schema.

### Không đưa experiment ground-truth vào business payload mặc định

Các field như:

```text
run_id
fault_type
root_cause_service
fault_start
fault_end
```

thuộc experiment/ground-truth artifact, không phải `grade.completed` business payload.

Nếu experiment runner cần propagate `run_id` cho telemetry correlation, convention đó phải được task telemetry/ground-truth chốt riêng và không được làm consumer business phụ thuộc ground truth.

---

# 18. Minimal contract tests phải có khi scaffold

## HTTP contract tests

Tối thiểu:

- [ ] Gateway/Auth login success + unauthorized.
- [ ] Enrollment gọi Course bằng published contract.
- [ ] Submission gọi Course + Enrollment + Storage Mock bằng published contracts.
- [ ] Storage timeout map thành stable `DEPENDENCY_TIMEOUT`.
- [ ] Grading gọi Submission bằng published contract.
- [ ] Error envelope luôn có `code`, `trace_id`, UTC `timestamp`.
- [ ] External client không thể spoof `x-principal-id`/`x-principal-role`; Gateway strip/overwrite trusted headers.
- [ ] Internal service call không cần remote Auth introspection; chỉ mang principal headers khi contract cần.
- [ ] `GET /api/v1/enrollments/check` hoạt động như internal service contract của Submission.

## Event contract tests

- [ ] Producer emit đúng `event_name=grade.completed`.
- [ ] `schema_version=1`.
- [ ] Required envelope/payload fields có đủ.
- [ ] Producer inject W3C trace context vào RabbitMQ transport headers/properties và Consumer extract đúng context.
- [ ] Publish -> consume/process nối được thành cùng trace khi telemetry không degraded.
- [ ] Envelope correlation không được dùng thay transport propagation và không tạo trace độc lập khi cả hai carrier có context.
- [ ] Notification parse event mà không import Grading entity.
- [ ] Duplicate `event_id` tạo một logical outcome.
- [ ] Consumer failure observable và không ack giả success.

---

# 19. Open questions được cố ý không freeze trong task-02

Các điểm sau thuộc implementation/task khác, chưa nên biến thành pseudo-requirement:

| Open point | Owner/task phù hợp |
| --- | --- |
| Exact PostgreSQL table/column/index | task-03 + implementation tuần 6–8 |
| Exact Redis key/TTL | task-03 / Course implementation |
| RabbitMQ exchange/queue name, retry count, DLQ | infrastructure/async implementation; phải giữ event semantic v1 |
| Exact timeout milliseconds | service runtime config; freeze trước experiment |
| Fault toggle endpoint/config chi tiết | task-03 + tuần 12 |
| `run_id` propagation convention | task-04 telemetry/ground-truth + experiment design |
| OpenAPI codegen/tooling | tuần 5 scaffold |
| Production auth/refresh security hardening | ngoài MVP core |

Không để open point trên làm thay đổi topology/service ownership đã freeze.

---

# 20. Definition of Done check — task-02

| DoD | Bằng chứng | Trạng thái |
| --- | --- | --- |
| Contract cho workflow MVP, request/response/error tối thiểu và service ownership | Mục 3–10, 16 | **Đạt về nội dung** |
| `grade.completed` có producer, consumer, payload/schema version, correlation identity và failure/retry expectation | Mục 11–13 | **Đạt về nội dung** |
| Không vi phạm cross-service source import/data ownership | Mục 15 | **Đạt về nội dung** |
| Bách review một HTTP flow + async event; telemetry/evaluation requirement được phản ánh/tồn đọng | Mục 21 | **PENDING — cần review thật** |

---

# 21. Collaborator review record — Bách

> Task card yêu cầu Bách tham gia review ít nhất một HTTP flow và event `grade.completed`. Không tự ghi `APPROVED`.

**Review status:** `PENDING`

## HTTP flow đề nghị Bách review: W4 Submit

- [ ] `Submission -> Course` tạo edge service-level cần cho graph.
- [ ] `Submission -> Enrollment` tạo edge service-level cần cho graph.
- [ ] `Submission -> Storage Mock` có stable dependency identity cho F2.
- [ ] Timeout/error contract đủ map metric/trace/log evidence.
- [ ] `principal_id`, `course_id`, `submission_id` đủ cho downstream RCA/evidence nhưng không đưa PII không cần thiết.
- [ ] Không có cross-service DB access.
- [ ] External principal headers không spoof được; internal calls chỉ propagate principal context khi contract cần.
- [ ] `GET /api/v1/enrollments/check` vẫn là internal contract của Submission, không thành public client route trong MVP.

## Async flow đề nghị Bách review: W5 `grade.completed`

- [ ] Envelope có đủ `event_id`, name, schema version, occurred time, producer.
- [ ] RabbitMQ transport headers/properties là carrier primary để nối publish/consume; envelope correlation không thay carrier này.
- [ ] Payload đủ để Notification không query DB service khác.
- [ ] `event_id` hỗ trợ fallback correlation/dedup.
- [ ] Retry/DLQ chưa freeze không làm sai semantics hoặc che F4.
- [ ] Async edge có thể biểu diễn thành `grading -> notification` trong dynamic graph.
- [ ] Contract không nhét `root_cause_service`/fault ground truth vào business event.

| Trường | Giá trị |
| --- | --- |
| Reviewer | Bách |
| HTTP flow reviewed | `PENDING` — đề nghị W4 |
| Async event reviewed | `PENDING` — `grade.completed` |
| Verdict | `PENDING` |
| Blocking feedback | Chưa có |
| Non-blocking feedback | Chưa có |
| Resolution | Chưa có |
| Tồn đọng | Chưa có |

---

# 22. Kết luận contract v1

Contract v1 cố ý nhỏ nhưng đủ chạy toàn bộ topology MVP:

```text
login/refresh
course create/list/get
enroll/check enrollment
submit/get submission
storage mock put/get
grade/create/get
grade.completed
```

Nó giữ được bốn nguyên tắc cốt lõi của project:

```text
published contract thay vì source import
service-owned data
trace/correlation xuyên HTTP + RabbitMQ
contract đủ cho controlled fault + service-level RCA
```

Không thêm API/event nếu nó không phục vụ trực tiếp W1–W5, observability, fault propagation hoặc evaluation.
