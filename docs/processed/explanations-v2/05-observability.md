# Hệ thống quan sát (observability) của testbed v2

> **File này giải thích gì:** testbed v2 phát ra dữ liệu quan sát nào (trace, metric, log), mỗi runtime tạo chúng ở đâu trong code, dữ liệu đi đường nào tới Prometheus/Tempo/Loki/Grafana, cách đọc chúng, các smoke test chứng minh điều gì, **dữ liệu còn thiếu gì** đối với RCA engine, và (mới) tuần 13 xuất telemetry của một run ra file như thế nào, kiểm chất lượng ra sao, phát hiện thêm điều gì.
>
> **Nguồn gốc (canonical):**
>
> - [`../../../lms/packages/observability/README.md`](../../../lms/packages/observability/README.md), [`../../../lms/packages/observability/src/`](../../../lms/packages/observability/src/)
> - [`../../../lms/packages/common/src/telemetry/observe-dependency.ts`](../../../lms/packages/common/src/telemetry/observe-dependency.ts), [`../../../lms/packages/common/src/clients/http-query-client.ts`](../../../lms/packages/common/src/clients/http-query-client.ts), [`../../../lms/packages/common/src/messaging/`](../../../lms/packages/common/src/messaging/)
> - [`../../../aiops-platform/observability/`](../../../aiops-platform/observability/) (README, compose, collector, datasource, dashboard)
> - [`../architecture/telemetry-and-ground-truth-schema-v1.md`](../architecture/telemetry-and-ground-truth-schema-v1.md) (mục 3–5, 13), [`../architecture/complex-case-catalogue-and-rca-result-v0.md`](../architecture/complex-case-catalogue-and-rca-result-v0.md) (mục 1, 2, 4)
> - [`../architecture/backend-microservice-testbed-blueprint-v2.md`](../architecture/backend-microservice-testbed-blueprint-v2.md) (mục 10), [`../architecture/dependency-resilience-policy-v2.md`](../architecture/dependency-resilience-policy-v2.md) (mục 3.2, 8, 9)
> - [`../../../lms/test/observability/`](../../../lms/test/observability/)
> - Tuần 13 (PR chưa merge, đọc trên nhánh PR): [`../architecture/telemetry-data-dictionary-v2.md`](../architecture/telemetry-data-dictionary-v2.md) (PR #79), `aiops-platform/training/README.md` (PR #77/#79), `aiops-platform/faults/README.md` (PR #75, mục "Giới hạn")
> - Cách nói tận dụng từ [`../weekly-explanations/progress-report-week-10/week-10-observability.md`](../weekly-explanations/progress-report-week-10/week-10-observability.md) (testbed v1, trước refactor).
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> **Trạng thái tại:** 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge).

---

## 1. Vì sao đề tài cần observability

**Ý chính: RCA engine là thám tử chỉ được xem băng camera.** Nó không đọc code, không vào máy, không hỏi lập trình viên. Mọi kết luận "service nào có khả năng là nguyên nhân" đều rút ra từ dữ liệu testbed phát ra. Camera nào không gắn thì thám tử mù ở đó.

- Dữ liệu **có** quyết định AI làm được gì: nhờ trace nối xuyên RabbitMQ, lỗi ở `ai-worker` vẫn nằm cùng trace với request của giảng viên.
- Dữ liệu **thiếu** quyết định AI chắc chắn không làm được gì: không có metric pool PostgreSQL thì không phân biệt được "DB chậm" với "hết chỗ kết nối" (mục 8).

Khái niệm trace, span, metric, label, log, OpenTelemetry, Collector, Prometheus, Tempo, Loki, Grafana đã có ở [khái niệm nền, nhóm 6](02-basic-concepts.md). Trước refactor (v1), stack quan sát dựng ở tuần 10 cho các service cũ; sau refactor nó tách sang `aiops-platform/observability/` và mọi tên service, tên cạnh đổi theo topology v2.

---

## 2. Ba loại tín hiệu, mỗi loại một ví dụ thật

**Ý chính: metric báo "có chuyện, từ lúc nào", trace chỉ "ở chặng nào", log kể "chuyện gì".** Ba loại nối nhau bằng `service.name`, thời gian và `trace_id`.

### 2.1. Metric

Cạnh `course` gọi PostgreSQL (tên thao tác lấy từ `prisma-lesson.repository.ts`), và RED (Rate = số request, Errors = số lỗi, Duration = thời gian) của `course` khi nhận request tạo job AI:

```text
lms_dependency_request_count_total{service_name="course", dependency_identity="course-postgres",
  operation_name="lesson.find-by-id", status="ok"}
http_server_request_count_total{service_name="course", http_method="POST",
  http_route_template="/api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs", http_status_class="2xx"}
```

Cả 11 runtime chỉ có **8 instrument** (8 "đồng hồ đo"): 3 cho HTTP server, 3 cho dependency, CPU, RAM (telemetry schema v1 mục 5.2). Cộng 4 gauge (đồng hồ đo giá trị hiện tại) hàng đợi do Collector thu từ broker RabbitMQ.

### 2.2. Trace

Tên span theo đúng bốn mẫu, do bốn chỗ trong code đặt. Testbed giữ **100% trace** (`AlwaysOnSampler`).

| Loại | Mẫu tên | Ví dụ | Nơi tạo |
| --- | --- | --- | --- |
| `SERVER` | `<METHOD> <route template>` hoặc `<METHOD> unmatched` | `POST /internal/v1/ai/jobs` | `createHttpTelemetryMiddleware` |
| `CLIENT` | `<dependency_identity> <operation>` | `ai-llm-provider POST chat/completions` | `observeDependency` |
| `PRODUCER` | `lms.commands publish <command_name>` | `lms.commands publish ai.job.run` | `RabbitMqCommandPublisher` |
| `CONSUMER` | `<queue> process` | `ai-worker--run-ai-job-v1 process` | `RabbitMqCommandConsumer` |

### 2.3. Log

Dòng dưới dựng đúng theo code `emitStructuredLog` + `logDependencyFailure` cho case C6 (`identity` bị treo, `gateway` không lấy được service token). `trace_id`/`span_id` để chỗ trống vì không chép từ lần chạy cụ thể; version và instance là mặc định trong `docker-compose/compose.yaml`:

```json
{
  "timestamp": "2026-11-17T07:30:12.345Z",
  "level": "ERROR",
  "message": "Dependency gateway-identity-token POST /internal/v1/auth/service-token lỗi timeout",
  "service.name": "gateway",
  "service.version": "0.1.0",
  "service.instance.id": "gateway-compose-1",
  "trace_id": "<32 ký tự hex>",
  "span_id": "<16 ký tự hex>",
  "dependency_identity": "gateway-identity-token",
  "error_type": "timeout",
  "event": "dependency.failure",
  "operation_name": "POST /internal/v1/auth/service-token"
}
```

Trường chẩn đoán chỉ được nằm trong allowlist (danh sách cho phép) 10 trường: `event`, `event_id`, `error_type`, `dependency_identity`, `operation_name`, `http_method`, `http_route`, `http_status_code`, `duration_ms`, `outcome`. Trường khác bị **bỏ hẳn** trước khi ghi.

### 2.4. Sợi chỉ nối ba loại

```text
Metric : lms_dependency_error_count_total{dependency_identity="gateway-identity-token"} tăng lúc 07:30
   │  lọc theo service_name + thời gian (metric KHÔNG mang trace_id)
   ▼
Trace  : span CLIENT lỗi "gateway-identity-token POST /internal/v1/auth/service-token"
   │  cùng trace_id + span_id
   ▼
Log    : event=dependency.failure, error_type=timeout
```

**Từ metric sang trace không có đường tắt**: metric chưa có exemplar (một `trace_id` mẫu đính kèm số liệu), nên phải lọc trace theo service, route và thời gian.

---

## 3. Bên trong mỗi runtime

**Ý chính: mọi telemetry do hai package dùng chung tạo ra.** `@aiops-lms/observability` lo khởi động, span SERVER, RED, log; `@aiops-lms/common` lo span CLIENT/PRODUCER/CONSUMER và metric dependency. Như một chung cư mà mọi căn hộ lắp cùng loại camera ở cùng vị trí: hình ở mọi tầng so sánh được với nhau.

### 3.1. Khởi động: gắn "thẻ căn cước" trước khi mở cửa

`main.ts` mỗi runtime gọi `startTelemetry(...)` **trước khi** import ứng dụng. Hàm này (`telemetry-bootstrap.ts`):

- bắt `service.name` thuộc đúng 11 giá trị `RUNTIME_SERVICE_NAMES` (`telemetry-config.ts`), sai thì runtime không khởi động;
- gắn đúng ba thông tin danh tính `service.name`, `service.version`, `service.instance.id`; tắt tự dò môi trường để không gửi hostname, biến môi trường;
- bật trace 100% và lan truyền (propagation, tức chuyển "số hồ sơ" `traceparent` sang bước sau) theo W3C Trace Context;
- gửi metric mỗi 5 giây (`OTEL_METRIC_EXPORT_INTERVAL`), span và log theo lô chạy nền; đăng ký `process.cpu.time` và `process.memory.usage` (RSS, RAM thật process chiếm).

Nguyên tắc: **telemetry hỏng không được làm hỏng nghiệp vụ.** Collector chết thì request vẫn chạy, chỉ mất dữ liệu.

### 3.2. Middleware HTTP: span SERVER + RED + access log

`createHttpTelemetryMiddleware` bọc **mọi** request HTTP. Khi response xong, nó:

1. **Kết thúc span `SERVER`**, đặt tên `<METHOD> <route template>` (đường dẫn mẫu `/api/v1/courses/:course_id`, không phải đường dẫn thật chứa ID); không khớp route thì `unmatched`. 5xx hoặc client bỏ ngang thì span `ERROR` kèm `error.type`.
2. **Cộng 3 metric RED** với nhãn `http_method` (method lạ thành `_OTHER`), `http_route_template`, `http_status_class` (`1xx`…`5xx`, `client_aborted`, `exception`). Metric lỗi **chỉ** đếm 5xx và request bị ngắt; 4xx nghiệp vụ (sai mật khẩu, thiếu quyền) không phải lỗi hệ thống.
3. **Ghi đúng một dòng log** trong context của span: `http.server.error` (`ERROR`) khi lỗi, `http.server.request` cho còn lại (`INFO`, 4xx là `WARN`). Access log bỏ qua `/health`.

### 3.3. `observeDependency`: span CLIENT + 3 metric + log lỗi

**Ý chính: mọi lời gọi ra ngoài đi qua một cổng soát vé duy nhất.** `observeDependency(dependencyIdentity, operation, run)`:

- mở span `CLIENT` `<dependency_identity> <operation>`;
- cộng `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, ghi `lms_dependency_duration_seconds`, nhãn `dependency_identity`, `operation_name`, `status`;
- khi lỗi: `error.type` = `timeout` hoặc `unavailable`, span `ERROR`, và ghi log `event=dependency.failure` **trong context của span lỗi**, nên `span_id` của log trỏ đúng span đó. Lỗi caller coi là kết quả nghiệp vụ thì `status=expected_failure`, không tính lỗi.

Nơi dùng (đã grep): repository Prisma của 6 service (`<service>-postgres`), MinIO (`media-minio`), SMTP (`notification-smtp smtp.send`), LLM (`ai-llm-provider`), tải JWKS (`<service>-identity-jwks GET jwks`), `HttpQueryClient` (mọi cạnh HTTP giữa service, kể cả lấy token `<caller>-identity-token`) và proxy gateway (`gateway-<service>`, operation chỉ là method). Span HTTP có thêm `peer.service` tra từ bảng 13 cạnh `HTTP_DEPENDENCY_PEERS`. Đo 30/10/2026: **38 cặp (service, dependency_identity)**.

### 3.4. RabbitMQ: span PRODUCER/CONSUMER giữ trace không đứt

**Ý chính: "số hồ sơ" được kẹp trong phong bì command**, như hồ sơ gửi bưu điện vẫn giữ số dù người nhận mở thư sau vài giây.

```text
span SERVER của ai: use case ghi command vào outbox, kèm traceparent đang chạy (outbox.ts)
   ▼
relay outbox chạy nền (KHÔNG có span hoạt động): lấy traceparent trong phong bì làm cha
   → span PRODUCER "lms.commands publish ai.job.run", tiêm context vào header AMQP
   ▼
ai-worker đọc header → span CONSUMER "ai-worker--run-ai-job-v1 process" → span CLIENT của worker
```

- PRODUCER/CONSUMER mang `dependency_identity=<service.name của process>-rabbitmq`, `operation_name` `publish`/`consume`. Chỉ CONSUMER có `messaging.message.id`.
- **Span PRODUCER thuộc process chạy relay**: outbox của `notification` có thể do `notification` hoặc `notification-worker` phát (catalogue mục 2).
- Consumer lỗi thì publish lại (`x-attempt` tăng), hết lượt vào `<queue>.error`.
- **Không có metric `lms_dependency_*` cho RabbitMQ**, chỉ có span; độ sâu queue do Collector thu từ broker (mục 4).

### 3.5. Log có cấu trúc

`StructuredLogger` thay logger NestJS ở 11 runtime. Mỗi lần ghi tạo một dòng JSON ra stdout và một bản ghi OTel gửi tới Loki. Hai lớp bảo vệ: allowlist trường (mục 2.3) và bộ che token `Bearer`/`Basic`, JWT, mật khẩu trong URL, `password=…`, email. Chỉ có ba `event`: `http.server.request`, `http.server.error`, `dependency.failure`. **Worker không ghi log khi xử lý command**: lỗi worker chỉ thấy qua span CONSUMER và `dependency.failure`. Tuần 13 đo lại: trong run khỏe, 4 worker không có dòng log nào ngoài access log của probe (mục 10.2).

### 3.6. Không có auto-instrumentation ("tự gắn camera")

Gói auto-instrumentation của OpenTelemetry tự sinh span cho thư viện HTTP, driver DB… Testbed **không dùng**: `@aiops-lms/observability` không phụ thuộc gói `instrumentation-*` nào, `NodeSDK` dựng không có instrumentation. Mọi span do bốn chỗ trên tạo bằng tay.

| Được | Mất |
| --- | --- |
| Tên span, tên thao tác hữu hạn, ổn định (`course-postgres lesson.find-by-id` thay vì câu SQL) | Chỗ không bọc thì **không có span**: lệnh ghi outbox, vòng relay, vòng lặp `scheduler-worker` |
| Không lộ SQL, URL chứa ID, header | Không có số liệu "miễn phí" như pool kết nối, event loop |
| Nhãn ít, khớp allowlist | Tín hiệu mới phải sửa code (ADR-006 cho phép loại thay đổi này) |

---

## 4. Đường đi của dữ liệu

**Ý chính: runtime chỉ biết một địa chỉ `otel-collector:4318`; Collector là bưu cục phân loại chia ba loại thư về ba kho.**

```text
11 runtime LMS (OTel SDK)                 RabbitMQ (không có SDK, cổng 15692)
   │ OTLP/HTTP /v1/traces,/v1/metrics,/v1/logs   │ Collector đi thu mỗi 5 giây
   ▼                                            ▼
OTel Collector (256 MiB): memory_limiter 192 MiB → batch (1 giây hoặc 512 bản ghi)
   ├─ traces           → Tempo :3200       (512 MiB, giữ 24 giờ)
   ├─ metrics          → exporter :8889 ─┐
   ├─ metrics/rabbitmq → exporter :8889 ─┴→ Prometheus :9090 thu mỗi 5 giây (512 MiB, 24 giờ/512 MB)
   └─ logs             → Loki :3100        (512 MiB, giữ 24 giờ)
Grafana :3008 đọc cả ba kho, nhảy log ↔ trace
```

- **Chỉ ba danh tính** thành nhãn metric (`service_name`, `service_version`, `service_instance_id`). Loki chỉ đánh chỉ mục `service_name`; `trace_id`, `span_id`, mức log, trường chẩn đoán là structured metadata (đính kèm từng dòng, lọc được nhưng không làm chỉ mục).
- **Metric broker** `rabbitmq_detailed_queue_messages` (và hậu tố `_ready`, `_unacked`), `rabbitmq_detailed_queue_consumers`: Collector chỉ giữ queue mẫu `<worker>--<command>-v<n>` (và `.error`) của `media-worker`, `notification-worker`, `ai-worker`, gắn `service_name` = worker tiêu thụ và `dependency_identity=<worker>-rabbitmq`. Có 24 queue (12 chính, 12 `.error`). Queue thuộc **bên nhận**.
- Exporter trace/log của Collector thử lại tối đa 30 giây, hàng đợi 256 lô **trong RAM**: Collector khởi động lại là mất phần đang chờ. Bản một máy, không HA, không lưu trữ dài hạn.

---

## 5. Quy tắc nhãn

**Ý chính: nhãn chỉ mang giá trị hữu hạn.** Prometheus như tủ hồ sơ: mỗi tổ hợp nhãn là **một ngăn kéo**. Nhãn chứa mã học viên thì mỗi học viên một ngăn, tủ nổ tung. Đó là high cardinality, "nhãn có quá nhiều giá trị khác nhau" ([khái niệm nền 6.4](02-basic-concepts.md)).

Ba lớp chặn (`service-metrics.ts`, `metrics-smoke.mjs`):

1. **Allowlist 8 khóa** `METRIC_ATTRIBUTE_KEYS`: `http_method`, `http_route_template`, `http_status_class`, `dependency_identity`, `operation_name`, `status`, `exchange`, `routing_key` (hai khóa cuối chưa instrument nào dùng). Nhãn khác bị xóa trước khi gửi.
2. **Tối đa 512 tổ hợp** mỗi instrument; vượt thì dồn vào dãy "tràn", không giữ ID gốc.
3. **Danh sách cấm** trong smoke: `trace_id`, `span_id`, `request_id`, `user_id`, `principal_id`, `event_id`, `run_id`, `fault_type`, `fault_id`, `root_cause_service`, `url`, `path`… Cấm `fault_type`, `root_cause_service` còn vì **ground truth không được rò vào telemetry**, nếu không AI "nhìn đáp án".

Mọi histogram thời gian dùng 11 biên (giây) `0.005 … 10` cộng `+Inf`, phủ từ request rất nhanh tới timeout 3 giây của dependency, 5 giây của gateway.

### 5.1. Bản sửa 17/11/2026 (Gate R)

Commit `047050f` sửa hai lỗi nhãn ảnh hưởng trực tiếp feature của AI; đây là điều kiện 4 của Gate R (plan-v0.3).

|  | Trước | Sau |
| --- | --- | --- |
| `operation_name` của `HttpQueryClient` | Đường dẫn thật chứa ID (`GET /internal/v1/courses/<uuid>/lessons/<uuid>/ai-context`): mỗi bài học một dãy số liệu | Route template `GET /internal/v1/courses/:courseId/lessons/:lessonId/ai-context`. Caller truyền `path` mẫu + `params`; `resolveRoutePath` thay giá trị và URL-encode khi gửi; thiếu tham số là lỗi lập trình, không gửi |
| Identity khi publish RabbitMQ lỗi | Chuỗi chung `rabbitmq`, không có trong danh mục | `<service>-rabbitmq` của process phát; span PRODUCER ghi lỗi gốc (`recordException`), `error.type` và log `dependency.failure` |

`metrics-smoke` thêm bước: mọi `operation_name` của `lms_dependency_*` không chứa UUID hay số ID, và phải có ít nhất một template `/:tham_so`. Lần chạy 17/11/2026: **186 tổ hợp, đạt** (resilience policy mục 9).

Lưu ý khi đọc code: tên tham số phía gọi và phía nhận khác nhau. Span CLIENT của `ai-worker` ghi `…/:courseId/lessons/:lessonId/ai-context`, span SERVER của `course` ghi `…/:course_id/lessons/:lesson_id/ai-context`. Ghép hai đầu một cạnh bằng quan hệ cha–con của span, không so chuỗi.

---

## 6. Đọc trace mẫu W6 và đi một vòng trong Grafana

### 6.1. Cây span W6 "AI soạn bài"

**Ý chính: một trace W6 đi qua 6 runtime và một quãng chờ hàng đợi.** Cây dưới **chụp từ Tempo** ngày 17/11/2026 trên stack dựng mới theo README (job sinh quiz, provider AI giả, 37 span); lược bớt vài span PostgreSQL và phần `media-worker`. Bản đầy đủ ở [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md) mục F6.

```text
POST /api/v1/*path                                              [gateway]   SERVER 26.2ms  ← span gốc
  gateway-course POST                                           [gateway]   CLIENT 24.7ms
    POST /api/v1/courses/:course_id/lessons/:lesson_id/ai-jobs  [course]    SERVER 23.1ms
      course-postgres course.find-by-id / lesson.find-in-course [course]    CLIENT
      course-media GET /internal/v1/media/usages/by-owner       [course]    CLIENT  6.5ms
        GET /internal/v1/media/usages/by-owner                  [media]     SERVER  4.5ms
      course-ai POST /internal/v1/ai/jobs                       [course]    CLIENT 11.3ms
        POST /internal/v1/ai/jobs                               [ai]        SERVER  9.3ms  ← ghi job + outbox
          ai-postgres document.get-texts / job.create           [ai]        CLIENT
          lms.commands publish ai.job.run                       [ai]        PRODUCER 0.8ms ← relay gửi sau
            ai-worker--run-ai-job-v1 process                    [ai-worker] CONSUMER 45.4ms
              ai-postgres job.claim                             [ai-worker] CLIENT  2.1ms
              ai-worker-course GET /internal/v1/courses/:courseId/lessons/:lessonId/ai-context   [ai-worker] CLIENT
                GET /internal/v1/courses/:course_id/lessons/:lesson_id/ai-context              [course]    SERVER
              ai-llm-provider POST chat/completions             [ai-worker] CLIENT  2.2ms
              ai-postgres invocation.record                     [ai-worker] CLIENT  1.3ms
              ai-worker-course POST /internal/v1/courses/:courseId/lessons/:lessonId/ai-quizzes  [ai-worker] CLIENT 29.0ms
                POST /internal/v1/courses/:course_id/lessons/:lesson_id/ai-quizzes             [course]    SERVER 27.4ms
                  course-postgres quiz.create                   [course]    CLIENT 22.4ms
                    lms.commands publish media.markdown-usage.synchronize   [course] PRODUCER → [media-worker] CONSUMER
              ai-postgres job.complete                          [ai-worker] CLIENT  1.8ms
```

Cách đọc:

1. **Tìm span gốc.** `tracing-smoke` đòi đúng một span gốc thuộc `gateway`; hai span gốc nghĩa là trace bị đứt.
2. **Đi xuống theo chiều sâu, tìm span đỏ** (`ERROR`, có `error.type`). Đây cũng là cách `base-manual-auto` (baseline "SRE máy" của ADR-006) làm: theo span `CLIENT` lỗi hoặc chậm **sâu nhất**, kết luận service sở hữu nó.
3. **Khoảng hở PRODUCER → CONSUMER là thời gian chờ trong queue.** Không có metric "tuổi message cũ nhất", nên catalogue mục 1.5 đề xuất suy thời gian chờ từ chính khoảng hở này.
4. **Trace dài hơn request.** Gateway trả 202 ngay; phần `ai-worker` chạy sau.
5. **Span PRODUCER thuộc process relay** (ở W6 là `ai`).

Span SERVER của gateway mang route bắt-tất-cả của proxy (`@All('*path')` dưới tiền tố `api/v1`); trên Tempo tên span là `POST /api/v1/*path` (đã kiểm ngày 17/11/2026). Hệ quả: RED theo route của gateway không tách từng API, phải xem span SERVER của service phía sau.

### 6.2. Metric → trace → log trong Grafana (sau khi chạy C6)

1. Mở `http://127.0.0.1:3008`, đăng nhập bằng `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` (mẫu local `admin`/`grafana-local-only`).
2. **Dashboards → "AIOps LMS" → "AIOps LMS — Service overview"** (giờ UTC), chọn biến `service`.
3. Panel **Error ratio** của `gateway` tăng. Bấm vào đường, chọn **"Trace lỗi của gateway"**: Grafana mở TraceQL (ngôn ngữ truy vấn trace) `{ resource.service.name = "gateway" && kind = server && status = error }`.
4. Mở một trace: span đỏ sâu nhất là `gateway-identity-token POST /internal/v1/auth/service-token`; **không có span nào của `course`** vì request chưa tới đích (G7, mục 8).
5. Trên span chọn **"Logs for this span"**: LogQL `{service_name="gateway"} | trace_id="<trace>"`, ±5 phút → thấy dòng `dependency.failure` như mục 2.3.
6. Đối chiếu số: panel **"Dependency lỗi"** có dãy `gateway / gateway-identity-token / timeout` (hoặc `unavailable`).

### 6.3. Đi ngược: log → trace → metric

Trong **Explore → Loki**: `{service_name=~".+"} | event="dependency.failure" | error_type="timeout"`. Bấm trường `trace_id` (link "Xem trace") để mở Tempo. Lấy `dependency_identity` và thời điểm sang **Explore → Prometheus**:

```promql
sum by(service_name,dependency_identity,status)(increase(lms_dependency_request_count_total{status=~"timeout|unavailable"}[1m]))
```

Không thêm `or vector(0)`: lúc khỏe, dãy lỗi **không tồn tại** chứ không bằng 0, và README dặn không che chỗ thiếu bằng số 0.

---

## 7. Smoke observability: mỗi bài chứng minh điều gì

**Ý chính: "camera có quay" phải chứng minh trên container thật.** `pnpm run test:observability` (từ `lms/`) dựng `docker-compose/compose.full.yaml` sạch với telemetry bật, TTL service token 60 giây, chạy 7 workflow regression làm traffic, chờ 15 giây, rồi chạy năm smoke theo thứ tự cố định (tracing tạo lỗi cho logs/acceptance; metrics dừng worker nên chạy cuối).

| Smoke | Chứng minh |
| --- | --- |
| `stack-smoke` | Ống dẫn thông, không cần LMS: gửi thẳng vào Collector một span, metric, log giả có mã đánh dấu, tìm thấy ở Tempo, Prometheus, Loki; Grafana có 3 datasource |
| `tracing-smoke` | (a) 9 luồng (đăng nhập, đăng ký, soạn khóa học, upload media, usage markdown, thông báo hàng loạt, job AI, trích văn bản, dọn media): mỗi luồng một trace đủ service, đúng một span gốc đúng chủ, đủ span bắt buộc, không span lỗi. (b) C6: pause `identity` → login 5xx tại `gateway-identity`, không span `identity`; token người dùng còn hạn vẫn 200; sau TTL + 5 giây lỗi tại `gateway-identity-token`, không span `course`; `unpause` thì phục hồi |
| `logs-smoke` | Loki chỉ có nhãn `service_name`; 11 runtime có log; `trace_id`/`span_id` của log trỏ tới span thật đúng service; `dependency.failure` trỏ tới span **lỗi**; không lộ token/mật khẩu; đo độ trễ request → log |
| `acceptance-smoke` | Qua Grafana: datasource khỏe, liên kết trace ↔ log; dashboard provision, UTC, ≥ 10 panel; biến `service` đúng 11 runtime; mọi panel có dữ liệu; link "Dependency lỗi" → TraceQL → Loki chạy được; độ trễ ba tín hiệu ≤ 60 giây |
| `metrics-smoke` | RED, CPU, RSS 11 runtime; không nhãn cấm; đủ cạnh dependency của từng service, có histogram; `operation_name` không chứa ID; 24 queue đúng chủ, mỗi queue chính 1 consumer; dừng `notification-worker` → consumer 0, command sai làm backlog tăng, bật lại → drain và command sai vào `.error`; đo độ trễ request → metric |
| `queue-scrape.test.mjs` | Không cần Docker: regex giữ queue trong `otel-collector.yaml` khớp mọi queue của `contracts` và `.error`, loại queue lạ |

---

## 8. Giới hạn và khoảng trống

**Ý chính: camera có góc chết, và RCA engine phải được thiết kế biết trước chúng.** Mỗi dòng đã đối chiếu tài liệu và code.

| # | Giới hạn | Bằng chứng | Ảnh hưởng tới RCA |
| --- | --- | --- | --- |
| G1 | **Chưa có metric pool PostgreSQL** (kết nối đang dùng, thời gian chờ pool) và **không có `postgres-exporter`** (repo không nhắc tới; Collector chỉ thu RabbitMQ): không thấy phía máy chủ DB | catalogue 1.5; resilience 7; `otel-collector.yaml` | C2 (MVP, chèn trễ `course` → `course-postgres`) chỉ thấy qua `lms_dependency_duration_seconds{dependency_identity="course-postgres"}` tăng mọi `operation_name`; không phân biệt "DB chậm" với "hết chỗ trong pool". ADR-006 cho phép thêm, **chưa làm** |
| G2 | **`scheduler-worker` không có span gốc mỗi lần chạy job.** `PollingLoop`, `ExecuteNextRunUseCase` không mở span, nên `run.fail-exhausted`, `run.claim-next`, `job.find-by-id`, `run.finish` và lời gọi `scheduler-worker-media POST` là **các trace riêng**. `scheduler` → `scheduler-worker` cũng không nối (worker thăm dò DB) | `execute-next-run.use-case.ts`, `polling-loop.ts`; catalogue 1.5 | C4 (MVP): không có trace "một lần dọn media"; luồng dọn media trong `tracing-smoke` lấy chính span CLIENT `scheduler-worker-media POST` làm gốc. RCA phải ghép bằng thời gian. ADR-006 cho phép thêm root span, **chưa làm** |
| G3 | **Trace nhiễu.** (a) Docker thăm dò `/ready` mỗi 5 giây ở 10/11 runtime (gateway thăm dò `/health`): mỗi lần một trace SERVER và một access log `INFO` (access log chỉ bỏ `/health`). (b) `scheduler-worker` mặc định 2 vòng, mỗi vòng 1 giây, mỗi lượt ≥ 2 truy vấn → ước ≥ 4 trace gốc/giây lúc rảnh (**suy từ code, chưa đo**) | `docker-compose/compose.yaml`; `scheduler/src/config/env.schema.ts`; catalogue 1.5 | Số trace, tốc độ request bị thổi phồng; panel RED chỉ loại `/health`. Phải lọc theo `http_route_template`/`operation_name`, **không** bỏ cả service. Tuần 13: export lọc trace probe và trace thăm dò DB của `scheduler-worker` theo tên span gốc (data dictionary v2 ghi khoảng 3 trace/giây cho phần thăm dò); metric của route probe vẫn giữ, feature tự lọc |
| G4 | **Độ trễ thu thập**: log ≈ 2 giây, trace ≈ 2,5 giây, counter 4–10 giây (export 5 + thu 5), backlog ≈ 9 giây | catalogue 1.4 (testbed một máy) | Cửa sổ ghép tín hiệu ≥ 15 giây; phát hiện từ metric trễ tới ~10 giây; export sau run phải chờ đủ |
| G5 | **Tempo 512 MiB từng bị giết vì hết RAM (OOM)** khi truy vấn hàng nghìn trace song song; mọi kho giữ 24 giờ | catalogue 4.2; schema 13.2 | Truy vấn trace **tuần tự, giới hạn số lượng**, export ngay sau run. Đã làm ở tuần 13 (PR #77), xem mục 10.4 |
| G6 | **Container bị `docker pause` mất lô span cuối của chính nó.** Đo 17/11/2026: mọi span của `identity` ~2 giây trước pause không tới Tempo, dù log cùng lúc đã vào Loki. Cơ chế **chưa kiểm chứng** | catalogue mục 2, quy ước 5; chú thích `logs-smoke.mjs` | C6 (MVP) dùng chính `docker pause identity`: không dùng "span cuối của `identity`" để suy lúc lỗi, `fault_start` lấy từ injector. RCA phải chịu được **service gốc im lặng**. Cờ `telemetry_silent` (đề xuất của analysis blueprint v1) đã cài trong kiểm chất lượng tuần 13 (PR #79), dựa vào bộ đếm CPU chứ không dựa vào "có mẫu hay không" (mục 10.1); đã thử với `scheduler`, chưa thử với `identity` |
| G7 | **Circuit breaker làm đích biến mất khỏi trace.** Sau 3 lỗi liên tiếp (cooldown 5 giây, mặc định) `HttpQueryClient` từ chối ngay, không gọi mạng: span CLIENT có `circuit_breaker_open=true`, `status=unavailable`, **không có span SERVER của đích**. Lỗi lấy token (C6) cũng vậy | `http-query-client.ts`; resilience 3.2; `tracing-smoke` (b) | Triệu chứng nằm ở cạnh **bên gọi**: phải dịch `dependency_identity`/`peer.service` sang service đích (`gateway-identity-token` → `identity`), không kết luận "service cuối có span" là thủ phạm. Gateway → upstream không có breaker |
| G8 | **Runtime ngừng mà metric vẫn "còn".** Collector giữ giá trị cuối của mọi series thêm ~5 phút, Prometheus vẫn có mẫu mỗi 5 giây với giá trị đứng yên | data dictionary v2 mục 8.2 (đo 17/11/2026, PR #79) | C6 và feature: không dùng "thiếu mẫu" để nhận ra service chết; xem bộ đếm có tăng không, mục 10.1 |

Khoảng trống phụ (catalogue 1.5, schema 5.2): không có metric publish/consume RabbitMQ ở runtime, độ trễ outbox, tuổi message cũ nhất; worker không log khi xử lý command; `message_id` chỉ trên span CONSUMER; không có metric nghiệp vụ, network, disk, event loop; ghi outbox không có span.

---

## 9. RCA engine sẽ đọc gì

**Ý chính: chỉ dùng tín hiệu có thật ở mục 2–4, gắn `run_id` và cửa sổ thời gian; tín hiệu chưa có ghi `not_instrumented`, không điền 0.** Từ tuần 13, engine không đọc thẳng Prometheus/Tempo/Loki mà đọc **artifact** đã export của từng run (ba file Parquet, mục 10.5). Thiết kế chi tiết ở [thiết kế AI/RCA](08-ai-rca-design.md).

| Nguyên liệu | Lấy từ | Dùng làm |
| --- | --- | --- |
| RED, CPU, RAM theo service và cửa sổ | `http_server_request_*` (lọc `/health`, `/ready`), `process_*` | Feature của detector không giám sát (fit trên run khỏe) |
| Cạnh dependency | `lms_dependency_*`, span CLIENT (`dependency_identity`, `peer.service`) | Đồ thị phụ thuộc động, feature theo cạnh |
| Cạnh bất đồng bộ, backlog | PRODUCER → CONSUMER, `rabbitmq_detailed_queue_*` | Nối triệu chứng ở worker về nơi phát command |
| Tỉ lệ log lỗi | Loki theo `service_name`, `event` | Feature log (message đã ổn định, gần như template sẵn) |
| Bằng chứng | `service.name` + `trace_id`/`span_id`, hoặc metric + nhãn + thời gian | Evidence trong `RcaIncidentResult` |

Ba quy ước đọc (catalogue mục 2): span PRODUCER thuộc process relay; queue thuộc worker tiêu thụ; lỗi xác thực hiện ở cạnh `<caller>-identity-token` của bên gọi. Candidate set là 10 `service.name` (bỏ `gateway`); `dependency_identity` như `course-postgres` chỉ là bằng chứng thành phần.

---

## 10. Tuần 13: export, kiểm chất lượng và các phát hiện mới

**Ý chính: tuần 13 (PR #77 và #79, chưa merge) "đóng gói đoạn phim camera" của mỗi run thành file, kiểm xem đoạn phim có đủ không, và trong lúc làm phát hiện thêm vài góc chết.** Lệnh chạy ở [`06-stack-and-workflows-guide.md`](06-stack-and-workflows-guide.md) phần J; định nghĩa từng cột ở [telemetry-data-dictionary-v2](../architecture/telemetry-data-dictionary-v2.md).

### 10.1. Runtime ngừng mà metric vẫn còn ~5 phút

Khi một runtime ngừng (chết hoặc bị `docker pause`), OTel Collector vẫn xuất **giá trị cuối** của mọi series của nó thêm khoảng 5 phút. Prometheus vì vậy vẫn có mẫu mỗi 5 giây, chỉ là giá trị **đứng yên**. Đo ngày 17/11/2026: pause `scheduler` 70 giây, bộ đếm `process_cpu_time_seconds_total` của nó đứng yên ở `7.484935` suốt lúc pause rồi tăng lại sau `unpause`.

Hình dung: camera hỏng nhưng màn hình vẫn hiện **khung hình cuối cùng** thêm 5 phút. Nhìn màn hình thấy "vẫn có hình" thì tưởng mọi thứ ổn.

- **Cách nhận ra runtime còn sống:** xem bộ đếm CPU có **tăng** không. Process Node đang sống luôn tốn một chút CPU mỗi 5 giây (khoảng 0,004 giây CPU), nên bộ đếm đứng yên là dấu hiệu tin cậy. Kiểm chất lượng gắn cờ `telemetry_silent` khi bộ đếm không tăng lâu hơn 30 giây (6 chu kỳ) ở giữa cửa sổ.
- **Kết quả thử:** cửa sổ có pause `scheduler` cho `partial`, lý do duy nhất `telemetry_silent:scheduler`, khoảng im lặng đo được 75 giây; 10 runtime còn lại không bị gắn cờ.
- **Hệ quả cho feature (C6):** độ trễ, số request của runtime đã ngừng sẽ "phẳng" chứ không biến mất. Feature phải dựa vào **mức tăng** của counter (tốc độ = 0) và cờ `telemetry_silent`, không dựa vào việc thiếu mẫu. Chưa thử trên `identity` (case C6); pilot tuần 15 phải xác nhận.

### 10.2. Log của worker là `not_instrumented`

4 worker (`media-worker`, `notification-worker`, `scheduler-worker`, `ai-worker`) không có log nào ngoài access log của probe `/ready`, `/health`. Export bỏ access log probe, nên sau đó log của worker **trống**. Kiểm chất lượng ghi trạng thái `not_instrumented` (chưa gắn "camera log"), khác với `no_traffic` (có camera nhưng không có ai đi qua) và không làm báo cáo xấu đi. Nghĩa là: ở phía worker, nguồn log không giúp được gì; lỗi worker chỉ thấy qua span và metric.

### 10.3. Bộ đếm lỗi "mới sinh" giữa cửa sổ

Lúc khỏe, series lỗi (ví dụ `lms_dependency_request_count_total{status="unavailable"}`) **chưa tồn tại**. Lỗi đầu tiên tạo ra một series mới; hàm `increase()`/`rate()` của Prometheus không tính mẫu đầu của series mới, nên có thể trả **0 cho đợt lỗi đầu**. Vì vậy artifact giữ **giá trị thô**, và feature pipeline coi giá trị trước khi series xuất hiện là 0 rồi tự tính mức tăng. (Ghi ở README của `faults/` và `training/`.)

### 10.4. Tải trace từ Tempo: chậm và thỉnh thoảng khựng

Tải một trace mất khoảng **0,1 giây**; run 30 phút với tải mức 1 cần khoảng 15–20 phút export. Tempo thỉnh thoảng "khựng" vài giây gây `ReadTimeout` (lần chạy trước đó 4/721 trace bị lỗi này, gọi lại tay chỉ mất 0,1 giây). Để bảo vệ Tempo (512 MiB, từng bị OOM), export:

1. tìm trace theo lát 30 giây, chia đôi lát khi chạm giới hạn 1 000 kết quả;
2. bỏ trace nhiễu ngay ở bước tìm theo tên span gốc (`GET /ready`, `GET /health`, và `scheduler-postgres run.claim-next`, `run.fail-exhausted`, `job.lock-due-cron`);
3. tải từng trace **tuần tự**, nghỉ 20 ms giữa hai lần, giới hạn số trace (mặc định 20 000);
4. dời trace lỗi xuống cuối và tải lại một lượt sau 10 giây; 5 lỗi liên tiếp thì dừng hẳn;
5. ghi mọi chỗ bị cắt bớt vào `manifest.json`, không bỏ âm thầm.

### 10.5. Artifact của một run

```text
aiops-platform/training/artifacts/<run_id>/
├── metrics.parquet      mỗi dòng một điểm của một series, bước 5 giây, giá trị thô
├── spans.parquet        mỗi dòng một span (trừ trace nhiễu)
├── logs.parquet         mỗi dòng một log (trừ access log của probe)
├── manifest.json        cửa sổ UTC, sha256 + số dòng từng file, truy vấn đã dùng, thống kê cắt bớt
└── quality-report.json  do lệnh quality ghi
```

Mọi dòng có `run_id`, thời gian UTC, `service_name` (một trong 11 runtime), `source`, `schema_version = telemetry.v2`, `quality_flags`. Chưa tính tốc độ, phân vị hay cửa sổ: đó là việc của feature pipeline (tuần 14). Artifact không commit vào Git.

Run thử `k6-level1-evidence-20261117` (k6 mức 1, 2 phút): **152 608** điểm metric (16 họ metric, 4 769 series, 11/11 runtime); **8 943** span của 721 trace (1 004 trace nhiễu bị loại; 11/11 runtime); **1 649** log (307 access log probe bị loại; 7 runtime có log, 4 worker không); export mất 82 giây.

### 10.6. Phiếu kiểm chất lượng

Lệnh `quality` trả một trong ba kết quả:

| Kết quả | Khi nào |
| --- | --- |
| `fail` | Một nguồn lỗi hoặc thiếu file; runtime không có metric nào; `service_name` thiếu hoặc lạ |
| `partial` | Có `telemetry_silent`, nguồn bị cắt bớt, mất quan hệ cha–con của span, tỉ lệ log khớp trace < 95%, bản ghi trùng |
| `pass` | Không có lý do nào ở trên |

`partial` **không** làm run mất hiệu lực: run C6 **phải** có `telemetry_silent` ở `identity`. Run thử ở mục 10.5 ra `pass` (nhịp tim 11/11 runtime 100%, 0 span mất cha, 1 649/1 649 log ngữ cảnh có `trace_id`).

### 10.7. Lỗi telemetry còn mở: identity của relay `notification-worker`

Khi `notification-worker` phát lại command từ outbox, span PRODUCER mang `dependency_identity=notification-rabbitmq` thay vì `notification-worker-rabbitmq` (`lms/services/notification/src/adapters/messaging/outbox-relay.service.ts`). Data dictionary v2 mục 9 ghi lại lỗi này; chưa sửa. LMS đóng băng nhưng đây là sửa telemetry nên được phép. Khi dựng cạnh bất đồng bộ phải biết điều này (xem [`10-naming-cheatsheet.md`](10-naming-cheatsheet.md) mục 9).

---

## Tóm tắt

- RCA engine chỉ "nhìn" testbed qua telemetry; tín hiệu thiếu là góc chết AI không bù được.
- 11 runtime phát telemetry qua hai package dùng chung, không auto-instrumentation: middleware HTTP (SERVER, RED, access log), `observeDependency` (CLIENT, `lms_dependency_*`, `dependency.failure`), publisher/consumer RabbitMQ (PRODUCER/CONSUMER).
- Trace bất đồng bộ không đứt nhờ `traceparent` trong phong bì command; span PRODUCER thuộc process relay.
- Đường dữ liệu: runtime → OTel Collector → Prometheus/Tempo/Loki → Grafana; metric queue do Collector thu từ broker, gán cho worker tiêu thụ.
- Nhãn: allowlist 8 khóa, ≤ 512 tổ hợp, cấm ID và ground truth; Loki chỉ index `service_name`.
- Gate R 17/11/2026: `operation_name` của client HTTP là route template (186 tổ hợp không ID); lỗi publish mang `<service>-rabbitmq`.
- Metric → trace phải lọc theo service/thời gian (chưa có exemplar); trace ↔ log nhảy thẳng bằng `trace_id`.
- Năm smoke trên container thật chứng minh ống dẫn, trace 9 luồng + C6, log khớp span, dashboard, metric và backlog.
- Góc chết: thiếu pool PostgreSQL/`postgres-exporter`, `scheduler-worker` không có span gốc mỗi lần chạy, trace nhiễu, trễ thu thập tới ~10 giây, Tempo dễ OOM, `docker pause` nuốt lô span cuối, circuit breaker giấu đích, runtime ngừng mà metric vẫn "đứng yên" thêm ~5 phút.
- Tuần 13 (PR #77, #79): mỗi run export thành ba file Parquet + `manifest.json` (`telemetry.v2`), kiểm chất lượng ra `pass`/`partial`/`fail`; cờ `telemetry_silent` dựa vào bộ đếm CPU; log worker là `not_instrumented`; bộ đếm lỗi mới sinh phải tự tính mức tăng.

## Câu hỏi tự kiểm tra

1. Vì sao `http_server_request_error_count_total` không tăng khi học viên nhập sai mật khẩu?

<details><summary>Đáp án</summary>

Metric lỗi chỉ đếm 5xx, `client_aborted`, `exception`. Sai mật khẩu là 4xx nghiệp vụ, chỉ sinh access log mức `WARN`.

</details>

2. Span `lms.commands publish notification.batch.snapshot` có `service.name="notification-worker"`. Có kết luận được `notification-worker` đã ghi command này không?

<details><summary>Đáp án</summary>

Không. Span PRODUCER thuộc process chạy relay; outbox của `notification` có thể do `notification` hoặc `notification-worker` phát. Chủ command suy từ `producer.service_name` trong phong bì hoặc queue đích.

</details>

3. Trước 17/11/2026 `operation_name` của `HttpQueryClient` sai ở đâu, hậu quả gì?

<details><summary>Đáp án</summary>

Dùng đường dẫn thật chứa ID, mỗi ID một dãy số liệu (high cardinality) và feature theo thao tác không gộp được. Nay là route template như `GET /internal/v1/students/:studentId`.

</details>

4. Từ panel "Error ratio" có nhảy thẳng tới đúng trace gây ra điểm số liệu đó không?

<details><summary>Đáp án</summary>

Không. Metric chưa có exemplar; data link chỉ mở TraceQL lọc theo service và trạng thái trong khoảng thời gian. Trace sang log thì nhảy thẳng bằng `trace_id`.

</details>

5. Vì sao cửa sổ ghép tín hiệu nên ≥ 15 giây?

<details><summary>Đáp án</summary>

Counter vào Prometheus chậm 4–10 giây, backlog ≈ 9 giây, trong khi log ≈ 2 giây, trace ≈ 2,5 giây. Cửa sổ ngắn hơn ghép các tín hiệu lệch nhau.

</details>

6. Trong C6, vì sao không dùng "span cuối của `identity`" để xác định lúc lỗi bắt đầu?

<details><summary>Đáp án</summary>

Container bị `docker pause` mất lô span cuối (~2 giây trước pause). `fault_start` lấy từ injector; RCA phải chịu được service gốc im lặng.

</details>

7. Trace có span CLIENT `course-media …` lỗi với `circuit_breaker_open=true`, không có span nào của `media`. `media` có vô can không?

<details><summary>Đáp án</summary>

Không suy ra vậy được. Cầu dao đã ngắt sau các lỗi trước nên request không được gửi. Phải dịch `dependency_identity`/`peer.service` sang `media` và xem các trace trước lúc ngắt.

</details>

9. `identity` bị pause 2 phút, nhưng Prometheus vẫn có mẫu `process_cpu_time_seconds_total{service_name="identity"}` mỗi 5 giây. Có kết luận `identity` còn sống không?

<details><summary>Đáp án</summary>

Không. Collector giữ giá trị cuối của mọi series thêm khoảng 5 phút, nên "có mẫu" không chứng minh gì. Phải xem giá trị có **tăng** không: process còn sống luôn tốn một ít CPU; giá trị đứng yên hơn 30 giây thì kiểm chất lượng gắn cờ `telemetry_silent`.

</details>

10. Vì sao log của 4 worker được ghi là `not_instrumented` chứ không phải `no_traffic`?

<details><summary>Đáp án</summary>

Worker không ghi log khi xử lý command; log duy nhất của chúng là access log probe, mà export đã bỏ. Không có log không phải do không có việc (`no_traffic`), mà do chưa có "camera log" ở đó (`not_instrumented`). Thiếu log này không làm phiếu chất lượng xấu đi.

</details>

8. Vì sao testbed không dùng auto-instrumentation, và đổi lại mất gì?

<details><summary>Đáp án</summary>

Để tên span/thao tác hữu hạn, ổn định, không lộ SQL/URL/ID. Đổi lại, chỗ không bọc bằng tay thì không có span (vòng lặp `scheduler-worker`, ghi outbox) và không có số liệu sẵn như pool kết nối.

</details>
