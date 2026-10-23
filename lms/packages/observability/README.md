# OpenTelemetry bootstrap dùng chung

Package `@aiops-lms/observability` khởi tạo OpenTelemetry trước application code, gắn resource identity canonical và cung cấp HTTP middleware tạo server span với W3C Trace Context. Package chỉ chứa technical primitive; không chứa business model, fault label hoặc ground-truth field.

## Phiên bản đã pin

- OpenTelemetry API `1.9.0`.
- OpenTelemetry SDK/resource `2.11.0`.
- OpenTelemetry Node SDK, OTLP HTTP exporter và logs API/SDK/exporter `0.222.0`.

Các version trên được pin trong `package.json`; không dùng range để tránh semantic-convention thay đổi ngoài kiểm soát.

## Contract cấu hình

Caller truyền đủ `serviceName`, `serviceVersion`, `serviceInstanceId`, trạng thái bật/tắt và URL OTLP traces đầy đủ. `service.name` phải lấy từ catalogue canonical, không lấy từ hostname, tên container hoặc process.

HTTP instrumentation không capture request/response header tùy ý. Với response `5xx`, bootstrap đặt span status `ERROR` và `error.type` bằng status code; không thêm secret, PII, fault label hoặc ground-truth label.

Khi telemetry bị tắt, handle trả về là no-op. Khi bật nhưng OTLP backend chưa sẵn sàng, SDK vẫn khởi tạo và request application vẫn được phục vụ; lỗi export nằm ở diagnostic/export path và không được ném vào request path. Trace chưa export được có thể bị mất khi hết retry/buffer của SDK.

## Tracing baseline W10

Baseline dùng `AlwaysOnSampler` (100%), kể cả caller gửi sampled flag `00`, và W3C Trace Context. Caller cần truyền cùng synthetic parent nếu muốn liên kết nhiều HTTP action độc lập; ứng dụng không tự ghép các lần click/request không có chung context. Resource chỉ lấy ba field identity từ config, tắt auto-detection để không capture command-line/environment tùy ý. Tám runtime là Gateway, Auth, Course, Enrollment, Submission, Grading, Notification và Storage Mock có `service.name=submission-storage`; storage không trở thành RCA service candidate.

HTTP server span dùng route template hoặc `unmatched`, không raw path/query/header/payload. `finish` kết thúc với HTTP status thật; `close`/request `aborted` trước finish đặt `ERROR`, `error.type=client_aborted` và không giả status 200. Synchronous exception được rethrow nguyên trạng cho caller nhưng span chỉ giữ exception event đã làm sạch. Một span được kết thúc tối đa một lần và listener được tháo; metric status class cho request chưa hoàn tất là `client_aborted`/`exception`, không giả 5xx.

HTTP client manual span giữ `dependency_identity`, operation, method, HTTP response status khi đã nhận được và `peer.service` theo mapping topology cố định. Gateway client name là `<dependency_identity> <method>`; các wrapper còn lại dùng dependency/operation. Không ghi raw URL chứa object/course/user ID. PostgreSQL/Redis span có system/operation và dependency identity; không SQL statement/parameters. Auth PostgreSQL phân biệt timeout (`57014`/`ETIMEDOUT`) với unavailable ở span, không đổi lỗi trả business caller.

Timeout/unavailable có span `ERROR` và bounded `error.type`; HTTP 4xx nghiệp vụ không tự thành lỗi dependency. RabbitMQ giữ publish producer → receive consumer → process internal cùng trace, với message/event identity theo schema và không payload. Error exception event không chứa raw message/stack. Background retry không có context gốc tạo root publish trace mới, cùng event ID để fallback correlation; không bịa parent hay khẳng định nó vẫn nối trace request cũ.

`TelemetryStartOptions.traceExporter` là hook tùy chọn cho test/exporter; nếu không truyền `spanProcessor`, bootstrap bọc exporter bằng default `BatchSpanProcessor` và `forceFlush()` chờ processor thật hoàn tất. `spanProcessor` truyền tường minh giữ ưu tiên cũ. `shutdown()` chỉ chạy một lần. Đã có test pending batch chưa export, gọi flush rồi thấy span ở exporter trước shutdown; test lifecycle gồm socket HTTP thật bị ngắt.

Nghiệm thu trên **application container thật** đã build/healthy bằng Compose, không thay bằng nhiều app trong một test process:

```bash
cd lms
pnpm run test:observability:tracing -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script xác nhận đúng project test/host ports, tạo khóa học và dữ liệu test riêng, chạy login/course/enroll/submit/grade, query Tempo theo trace ID và từng service, kiểm tra parent chain tám runtime cùng DB/Redis/storage/RabbitMQ. Nó chạy hai lỗi storage timeout/unavailable và khôi phục fault state trong `finally`; không chạy đồng thời workload/fault test khác trên cùng project. Không reset volume hoặc tự restart service. Mỗi request tối đa 15 giây, mỗi poll backend tối đa 90 giây. CI chạy bước này sau regression khi stack project test vẫn sẵn sàng. Output chỉ chứa trace IDs, service names và số span, không token/password/payload.

Khi không bật metrics hoặc không truyền metric reader, bootstrap truyền `metricReaders: []` tường minh để NodeSDK không tự tạo OTLP reader từ môi trường. Regression test ghi counter và quan sát HTTP exporter endpoint mock, chứng minh shutdown không phát metrics ngoài opt-in; tránh shutdown chờ mạng trong process chỉ dùng tracing.

## Metrics baseline W10

Tám runtime bật metrics và gửi OTLP HTTP qua Collector mỗi 5 giây. `otlpMetricsEndpoint`/`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` là override tùy chọn; khi bỏ trống, đổi hậu tố `/v1/traces` sang `/v1/metrics` và giữ proxy path prefix. `metricExportIntervalMillis`/`OTEL_METRIC_EXPORT_INTERVAL` nhận 1000–60000 ms, mặc định 5000; SDK export timeout tối đa 3000 ms. Khi metrics disabled, danh sách reader rỗng tường minh, không export ngầm. Request path không await exporter/network; outage có thể mất dữ liệu nhưng không làm business request fail.

| Metric SDK                                                                                                    | Prometheus                                                                  | Ý nghĩa và label chính                                                           |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `http.server.request.count`                                                                                   | `http_server_request_count_total`                                           | RED throughput; `http_method`, `http_route_template`, `http_status_class`        |
| `http.server.request.error.count`                                                                             | `http_server_request_error_count_total`                                     | HTTP 5xx hoặc request interrupted/exception                                      |
| `http.server.request.duration`                                                                                | `http_server_request_duration_seconds_bucket/_sum/_count`                   | Latency seconds, route template và method/status                                 |
| `<service>.dependency.request/error.count`, `<service>.dependency.duration`                                   | Tên chuẩn hóa dấu chấm → gạch dưới, counter `_total`, duration `_seconds_*` | `dependency_identity`, `operation_name`, bounded `status`                        |
| `grading.messaging.publish.count/error.count/duration`                                                        | `grading_messaging_publish_*`                                               | Broker publish/confirm latency/error theo exchange/routing key cấu hình ổn định  |
| `grading.messaging.retry.count`                                                                               | `grading_messaging_retry_count_total`                                       | Số lần worker thử publish pending; không gồm lần publish request đầu             |
| `grading.messaging.pending.count`                                                                             | `grading_messaging_pending_count`                                           | Outbox pending được worker quan sát, không phải broker queue depth               |
| `notification.rabbitmq.consume.count/error.count/duration`, `notification.process.count/error.count/duration` | `notification_rabbitmq_consume_*`, `notification_process_*`                 | Consumer/process accepted/duplicate/rejected/unavailable                         |
| Broker detailed queue messages/ready/unacked                                                                  | `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked`                    | Backlog thật của queue Notification, `dependency_identity=notification-rabbitmq` |
| `process.cpu.time`                                                                                            | `process_cpu_time_seconds_total`                                            | CPU user+system cumulative seconds của từng application process                  |
| `process.memory.usage`                                                                                        | `process_memory_usage_bytes`                                                | RSS bytes của từng application process                                           |

SDK views áp allowlist attribute cho mọi loại instrument: HTTP method/template/status class, dependency/operation/status, exchange/routing key. Mỗi instrument giới hạn 512 combination; overflow không chứa ID gốc. Correlation/user/event/run/fault/truth/raw URL bị loại trước export; không chỉ kiểm source code. HTTP method không chuẩn → `_OTHER`, matched route dùng template, 404 không match → `unmatched`. Resource export chỉ ba identity thành `service_name`, `service_version`, `service_instance_id`; Prometheus thêm `job`, `instance`, `otel_scope_*` và histogram `le` bounded. Không dùng experiment/run ID làm label.

Mọi duration histogram hiện có unit seconds dùng 11 biên `[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10]` và `+Inf`. Biên phủ request nhanh đến dependency timeout 3 giây/Gateway 5 giây; bucket 10 giây giữ tail, đơn vị không đổi. Một view duy nhất cho mỗi instrument type tránh stream/histogram trùng. Process CPU là nguồn canonical ứng dụng; không cộng thêm container CPU tránh double count. CPU rate: `sum by(service_name)(rate(process_cpu_time_seconds_total[1m]))`; RSS: `process_memory_usage_bytes`.

Image RabbitMQ 4.1.4 management đã bật `rabbitmq_prometheus`; Collector scrape nội bộ port 15692 `/metrics/detailed?family=queue_coarse_metrics&vhost=/&queue=notification.grade-completed.v1`. Chỉ giữ ba gauge depth, exact queue/vhost canonical rồi bỏ label `queue`/`vhost`; map ownership về service Notification (`service_name=notification`), dependency `notification-rabbitmq`. Broker exporter không có version/instance của runtime Notification nên series broker **không** có `service_version`/`service_instance_id` (kể cả `service.instance.id` mà prometheus receiver tự gán) theo telemetry schema §5.1: hai field này nullable, không tạo dữ liệu giả. Phân biệt series broker với process ứng dụng bằng tên metric `rabbitmq_*` cùng `dependency_identity=notification-rabbitmq`. Pipeline broker lọc bỏ các series `up`/`scrape_*` mà prometheus receiver tự sinh, để `service_name="notification"` không mang tín hiệu sức khỏe scrape broker như của runtime Notification. Metrics smoke kiểm mọi series có `service_name` của business service: series ứng dụng phải khớp version/instance trong catalogue Compose, series broker phải để trống hai field này. Không thêm public port. Nếu đổi queue khỏi canonical, mapping này phải cập nhật trước nghiệm thu; thiếu series là unavailable, không mặc định queue 0. Consumer lag theo thời gian, broker retry count, network/disk I/O và connection pool usage chưa instrument; pending + retry attempt + processing duration + backlog là signal thực hiện có.

Query mẫu (không thêm `or vector(0)` để che missing):

```promql
sum by(service_name)(rate(http_server_request_count_total{http_status_class="2xx"}[1m]))
sum by(service_name)(increase(http_server_request_error_count_total{http_status_class="5xx"}[1m]))
histogram_quantile(0.95,sum by(service_name,le)(rate(http_server_request_duration_seconds_bucket[1m])))
sum by(service_name,dependency_identity,status)(increase(submission_dependency_error_count_total{status=~"timeout|unavailable"}[1m]))
rabbitmq_detailed_queue_messages{dependency_identity="notification-rabbitmq"}
grading_messaging_pending_count
```

Tên outbox đúng để query là `grading_messaging_pending_count` (khác broker backlog). Healthy không có error series cho tới lỗi đầu là absence/no error, không tự khẳng định exporter khỏe; dùng request series/CPU/target freshness để đánh giá coverage.

Nghiệm thu dữ liệu thật sau build/healthy trong project test cô lập:

```bash
cd lms
pnpm run test:observability:metrics -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script xác minh project/port ownership, chạy một tracing workflow warmup, đợi đủ chu kỳ export 5s + batch 1s + scrape 5s và kiểm timestamp sample mới, rồi ghi baseline counters trước tracing workflow thật để đo delta và đợi delta healthy/5xx/timeout/unavailable mới, kiểm metrics 8 service/resource/CPU/RSS/buckets/p95 và label privacy. Nó warmup 404 template rồi gọi 10 ID khác và so tập series không tăng. Sau đó stop Notification, publish 4 fixture event hợp lệ vào broker, chứng minh queue >= 4 rồi start consumer và đợi queue hiện tại = 0. Cuối cùng stop Collector, gửi business request thành công và start Collector/export recover; sau đó kiểm resource identity của mọi series business service (ứng dụng khớp catalogue, broker không có version/instance). Mọi stop có restore trong `finally`; test không chạy chung fault workload khác. Poll 90 giây mỗi điều kiện, request 15 giây; baseline queue phải có series thật và rỗng trước test. Script không log credential/token/payload.

HTTP exporter traces/metrics dùng DNS c-ares riêng (A/AAAA, timeout 750 ms, một lần thử), tránh `dns.lookup` chiếm libuv thread pool khiến PostgreSQL không mở được kết nối khi Collector ngừng chạy. Mỗi exporter giới hạn một request/socket, timeout 1 giây; batch traces timeout 2 giây. Agent vẫn giữ TLS/SNI mặc định của endpoint HTTPS. Literal IPv4/IPv6 và localhost hoạt động trực tiếp; hostname khác phải có DNS record (bao gồm Docker DNS), alias chỉ khai báo trong hosts file không được hỗ trợ cho endpoint telemetry. Cách phân giải DNS của business dependency giữ nguyên.

Outage acceptance xóa đúng cache key `course:v1:item:course-001`, chờ 12 giây để kết nối PG idle 10 giây đóng, rồi ngừng Collector và yêu cầu GET course trả 200. Điều này kiểm cả kết nối DB mới, tránh cache/pool đã nóng che lỗi DNS exporter. Khi HTTP thất bại, diagnostic chỉ ghi status, elapsed và error code, không ghi token, body hay URL thô.

## Structured logs W10

Tám runtime ghi log qua `StructuredLogger`, logger tương thích `LoggerService` của NestJS được truyền vào `NestFactory.create`. Mọi log của Nest, kể cả `new Logger(context)`, và log chủ động của package đều đi qua `emitStructuredLog`. Mỗi lần gọi ghi một dòng JSON ra stdout và một OTel log record gửi qua Collector tới Loki.

| Field stdout                                             | Ý nghĩa                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp`                                              | UTC ISO-8601 (`...Z`)                                                                                                                             |
| `level`                                                  | `TRACE`/`DEBUG`/`INFO`/`WARN`/`ERROR`/`FATAL`, map sang OTel `severity_number`                                                                    |
| `message`                                                | Message đã che credential/PII, tối đa 2000 ký tự                                                                                                  |
| `service.name`, `service.version`, `service.instance.id` | Resource identity từ config của `startTelemetry`                                                                                                  |
| `trace_id`, `span_id`                                    | Chỉ có khi đang trong span hợp lệ; ngoài context (startup, background) bỏ trống, không tạo ID giả                                                 |
| `logger`                                                 | Context của Nest logger, ví dụ `RoutesResolver`                                                                                                   |
| `exception.stacktrace`                                   | Stack đã che dữ liệu nhạy cảm, khi log lỗi có stack                                                                                               |
| Field chẩn đoán                                          | Allowlist: `event`, `event_id`, `error_type`, `dependency_identity`, `operation_name`, `http_method`, `http_route`, `http_status_code`, `outcome` |

Field ngoài allowlist bị bỏ trước khi ghi, nên payload, user/principal ID hoặc object tùy ý không lọt vào log. Message và stack đi qua bộ che: `Bearer`/`Basic` token, JWT, credential trong URL, `password|secret|token|api_key|authorization = ...` và email. Bộ che chỉ là lớp bảo vệ thêm; code không được đưa payload vào message. Mức mặc định là `log`/`warn`/`error`/`fatal`; `debug`/`verbose` chỉ bật qua `setLogLevels`.

Log chẩn đoán được ghi ở các điểm dùng chung, không rải theo từng handler:

- `createHttpTelemetryMiddleware` ghi `ERROR` `event=http.server.error` cho HTTP 5xx, `client_aborted` và exception, kèm `http_method`, `http_route` (template hoặc `unmatched`), `http_status_code` và `error_type`, trong context của server span. HTTP 4xx nghiệp vụ không ghi lỗi.
- `logDependencyFailure(span, ...)` ghi `ERROR` `event=dependency.failure` với `dependency_identity`, `operation_name`, `error_type` (`timeout`/`unavailable`) trong context của client span lỗi. Hàm này được gọi từ `dependency-telemetry.ts` của Course/Enrollment/Submission/Grading, publish RabbitMQ của Grading, Gateway proxy và repository PostgreSQL của Auth. Conflict nghiệp vụ không ghi lỗi.
- Notification ghi kết quả xử lý `grade.completed` (`outcome`, `event_id`) và lỗi consume/connect qua cùng logger.

`startTelemetry(config, { logsEnabled: true })` dựng `BatchLogRecordProcessor` với OTLP HTTP exporter dùng chung transport (DNS c-ares, timeout 1 giây, một socket), export timeout 2 giây, và đưa processor vào `forceFlush()`/`shutdown()`. Endpoint là `otlpLogsEndpoint`/`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`; khi bỏ trống thì đổi hậu tố `/v1/traces` sang `/v1/logs`, giữ proxy prefix. Khi không bật logs, bootstrap truyền `logRecordProcessors: []` để NodeSDK không tự dựng OTLP log exporter tới `localhost:4318`. Export chạy nền, queue tối đa 2048 record rồi bỏ; Collector ngừng chạy có thể làm mất log nhưng không làm hỏng request. Shutdown đóng app trước rồi mới flush telemetry.

Loki chỉ index `service_name`; `service_version`, `service_instance_id`, `trace_id`, `span_id`, `severity_text` và các field chẩn đoán là structured metadata. Query mẫu:

```logql
{service_name="gateway"} | trace_id="<trace-id>"
{service_name=~"gateway|submission"} | event="dependency.failure" | error_type="timeout"
{service_name="notification"} | event="grade.completed" | outcome!="accepted"
sum by (service_name) (count_over_time({service_name=~".+"} | severity_text="ERROR" [1m]))
```

Nghiệm thu dữ liệu thật sau khi Compose healthy trong project test cô lập:

```bash
cd lms
pnpm run test:observability:logs -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script chạy tracing smoke để có một workflow healthy và hai lỗi storage timeout/unavailable. Với mỗi trace lỗi, script query `{service_name="gateway"}` và `{service_name="submission"}` rồi lọc `trace_id`, yêu cầu có `dependency.failure` (`gateway-submission`/`submission-storage`, đúng `error_type`) và `http.server.error` (504/503). Với trace healthy, script yêu cầu Notification có `grade.completed` `outcome=accepted`. Mọi log trả về phải có `trace_id` khớp và `span_id` thuộc chính trace đó trong Tempo. Script cũng kiểm:

- Loki chỉ có label `service_name`.
- Toàn bộ log trong cửa sổ test và stdout không chứa token, password hoặc email test.
- Mọi dòng stdout của Gateway, Submission và Notification là JSON hợp lệ, có timestamp UTC và identity khớp Compose.
- Log startup ngoài trace context không có `trace_id`.
