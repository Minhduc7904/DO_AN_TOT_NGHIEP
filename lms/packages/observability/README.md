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

## Tracing

Baseline dùng `AlwaysOnSampler` (100%), kể cả caller gửi sampled flag `00`, và W3C Trace Context. Caller cần truyền cùng synthetic parent nếu muốn liên kết nhiều HTTP action độc lập; ứng dụng không tự ghép các lần click/request không có chung context. Resource chỉ lấy ba field identity từ config, tắt auto-detection để không capture command-line/environment tùy ý. 11 runtime là `gateway`, `identity`, `course`, `media`, `media-worker`, `notification`, `notification-worker`, `scheduler`, `scheduler-worker`, `ai` và `ai-worker`; hạ tầng (PostgreSQL, RabbitMQ, MinIO, SMTP, provider LLM) không có `service.name` riêng và không là RCA service candidate.

HTTP server span dùng route template hoặc `unmatched`, không raw path/query/header/payload. `finish` kết thúc với HTTP status thật; `close`/request `aborted` trước finish đặt `ERROR`, `error.type=client_aborted` và không giả status 200. Synchronous exception được rethrow nguyên trạng cho caller nhưng span chỉ giữ exception event đã làm sạch. Một span được kết thúc tối đa một lần và listener được tháo; metric status class cho request chưa hoàn tất là `client_aborted`/`exception`, không giả 5xx.

Lời gọi dependency (HTTP nội bộ, PostgreSQL, MinIO, SMTP, provider LLM) đi qua `observeDependency` của `@aiops-lms/common`: span CLIENT tên `<dependency_identity> <operation>` mang `dependency_identity`, `operation_name`, `error.type` khi lỗi, và ba metric `lms.dependency.*`. Với HTTP, `peer.service` lấy từ bảng cạnh cố định `<service.name bên gọi>-<service.name bên nhận>` trong `http-client-span-attributes.ts` (topology v2). Không ghi raw URL chứa object/course/user ID, SQL statement hay payload.

Timeout/unavailable có span `ERROR` và bounded `error.type`; HTTP 4xx nghiệp vụ không tự thành lỗi dependency. Command bất đồng bộ giữ một trace với request gây ra nó: lúc enqueue outbox ghi `traceparent` vào envelope; span PRODUCER `lms.commands publish <command>` dùng `traceparent` đó làm parent khi relay chạy ngoài request (không có span hoạt động) và tiêm context vào header AMQP; span CONSUMER `<queue> process` lấy parent từ header. Span PRODUCER mang `dependency_identity=<service.name của process phát>-rabbitmq` nên có thể thuộc process khác với service ghi command (relay claim chung bảng outbox). Error exception event không chứa raw message/stack. Đây là hành vi đã kiểm bằng `tracing-smoke` (luồng thông báo hàng loạt, job AI, thumbnail).

`TelemetryStartOptions.traceExporter` là hook tùy chọn cho test/exporter; nếu không truyền `spanProcessor`, bootstrap bọc exporter bằng default `BatchSpanProcessor` và `forceFlush()` chờ processor thật hoàn tất. `spanProcessor` truyền tường minh giữ ưu tiên cũ. `shutdown()` chỉ chạy một lần. Đã có test pending batch chưa export, gọi flush rồi thấy span ở exporter trước shutdown; test lifecycle gồm socket HTTP thật bị ngắt.

Nghiệm thu trên **application container thật** bằng `pnpm run test:observability` (xem [docker-compose/README.md](../../../docker-compose/README.md#smoke-observability)): `tracing-smoke` kiểm mỗi luồng v2 có một trace chứa đủ service, đúng span gốc, không đứt parent, cùng kịch bản lỗi nhiều bước khi `identity` ngừng phản hồi.

Khi không bật metrics hoặc không truyền metric reader, bootstrap truyền `metricReaders: []` tường minh để NodeSDK không tự tạo OTLP reader từ môi trường. Regression test ghi counter và quan sát HTTP exporter endpoint mock, chứng minh shutdown không phát metrics ngoài opt-in; tránh shutdown chờ mạng trong process chỉ dùng tracing.

## Metrics

11 runtime bật metrics và gửi OTLP HTTP qua Collector mỗi 5 giây. `otlpMetricsEndpoint`/`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` là override tùy chọn; khi bỏ trống, đổi hậu tố `/v1/traces` sang `/v1/metrics` và giữ proxy path prefix. `metricExportIntervalMillis`/`OTEL_METRIC_EXPORT_INTERVAL` nhận 1000–60000 ms, mặc định 5000; SDK export timeout tối đa 3000 ms. Khi metrics disabled, danh sách reader rỗng tường minh, không export ngầm. Request path không await exporter/network; outage có thể mất dữ liệu nhưng không làm business request fail.

| Metric SDK                                                                                 | Prometheus                                                                                                    | Ý nghĩa và label chính                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `http.server.request.count`                                                                | `http_server_request_count_total`                                                                             | RED throughput; `http_method`, `http_route_template`, `http_status_class`                                                                                                                                                                               |
| `http.server.request.error.count`                                                          | `http_server_request_error_count_total`                                                                       | HTTP 5xx hoặc request interrupted/exception                                                                                                                                                                                                             |
| `http.server.request.duration`                                                             | `http_server_request_duration_seconds_bucket/_sum/_count`                                                     | Latency seconds, route template và method/status                                                                                                                                                                                                        |
| `lms.dependency.request.count`, `lms.dependency.error.count`, `lms.dependency.duration`    | `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, `lms_dependency_duration_seconds_*` | Lời gọi dependency; `dependency_identity`, `operation_name`, bounded `status` (`ok`, `timeout`, `unavailable`, `expected_failure`)                                                                                                                      |
| Broker detailed queue messages/ready/unacked, consumers (từ Collector, không phải runtime) | `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked`, `rabbitmq_detailed_queue_consumers`                 | Backlog và consumer của mọi queue canonical v2; `service_name` là worker tiêu thụ, `dependency_identity=<worker>-rabbitmq`, nhãn `queue`; chi tiết ở [observability README](../../../aiops-platform/observability/README.md#metric-hàng-đợi-của-broker) |
| `process.cpu.time`                                                                         | `process_cpu_time_seconds_total`                                                                              | CPU user+system cumulative seconds của từng application process                                                                                                                                                                                         |
| `process.memory.usage`                                                                     | `process_memory_usage_bytes`                                                                                  | RSS bytes của từng application process                                                                                                                                                                                                                  |

SDK views áp allowlist attribute cho mọi loại instrument: HTTP method/template/status class, dependency/operation/status, exchange/routing key. Mỗi instrument giới hạn 512 combination; overflow không chứa ID gốc. Correlation/user/event/run/fault/truth/raw URL bị loại trước export; không chỉ kiểm source code. HTTP method không chuẩn → `_OTHER`, matched route dùng template, 404 không match → `unmatched`. Resource export chỉ ba identity thành `service_name`, `service_version`, `service_instance_id`; Prometheus thêm `job`, `instance`, `otel_scope_*` và histogram `le` bounded. Không dùng experiment/run ID làm label.

Mọi duration histogram hiện có unit seconds dùng 11 biên `[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10]` và `+Inf`. Biên phủ request nhanh đến dependency timeout 3 giây/Gateway 5 giây; bucket 10 giây giữ tail, đơn vị không đổi. Một view duy nhất cho mỗi instrument type tránh stream/histogram trùng. Process CPU là nguồn canonical ứng dụng; không cộng thêm container CPU tránh double count. CPU rate: `sum by(service_name)(rate(process_cpu_time_seconds_total[1m]))`; RSS: `process_memory_usage_bytes`.

Image RabbitMQ 4.1.4 management đã bật `rabbitmq_prometheus`; Collector scrape metric hàng đợi, cấu hình và quy tắc nhãn ở [aiops-platform/observability/README.md](../../../aiops-platform/observability/README.md#metric-hàng-đợi-của-broker). Runtime LMS chưa có metric publish/consume RabbitMQ hay độ trễ outbox: chỉ có span PRODUCER/CONSUMER và metric broker.

Query mẫu (không thêm `or vector(0)` để che missing):

```promql
sum by(service_name)(rate(http_server_request_count_total{http_status_class="2xx"}[1m]))
sum by(service_name)(increase(http_server_request_error_count_total{http_status_class="5xx"}[1m]))
histogram_quantile(0.95,sum by(service_name,le)(rate(http_server_request_duration_seconds_bucket[1m])))
sum by(service_name,dependency_identity,status)(increase(lms_dependency_request_count_total{status=~"timeout|unavailable"}[1m]))
rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"}
```

Healthy không có error series cho tới lỗi đầu là absence/no error, không tự khẳng định exporter khỏe; dùng request series/CPU/target freshness để đánh giá coverage.

Nghiệm thu: `metrics-smoke` (trong `pnpm run test:observability`) kiểm RED, CPU, RSS của 11 runtime, 42 cạnh dependency đúng danh mục identity, 24 queue broker đúng chủ sở hữu và consumer, cùng kịch bản dừng một worker (backlog tăng, command lỗi vào `.error`, drain), và label không chứa ID.

HTTP exporter traces/metrics dùng DNS c-ares riêng (A/AAAA, timeout 750 ms, một lần thử), tránh `dns.lookup` chiếm libuv thread pool khiến PostgreSQL không mở được kết nối khi Collector ngừng chạy. Mỗi exporter giới hạn một request/socket, timeout 1 giây; batch traces timeout 2 giây. Agent vẫn giữ TLS/SNI mặc định của endpoint HTTPS. Literal IPv4/IPv6 và localhost hoạt động trực tiếp; hostname khác phải có DNS record (bao gồm Docker DNS), alias chỉ khai báo trong hosts file không được hỗ trợ cho endpoint telemetry. Cách phân giải DNS của business dependency giữ nguyên.

## Structured logs

11 runtime ghi log qua `StructuredLogger`, logger tương thích `LoggerService` của NestJS được truyền vào `NestFactory.create`. Mọi log của Nest, kể cả `new Logger(context)`, và log chủ động của package đều đi qua `emitStructuredLog`. Mỗi lần gọi ghi một dòng JSON ra stdout và một OTel log record gửi qua Collector tới Loki.

| Field stdout                                             | Ý nghĩa                                                                                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp`                                              | UTC ISO-8601 (`...Z`)                                                                                                                                            |
| `level`                                                  | `TRACE`/`DEBUG`/`INFO`/`WARN`/`ERROR`/`FATAL`, map sang OTel `severity_number`                                                                                   |
| `message`                                                | Message đã che credential/PII, tối đa 2000 ký tự                                                                                                                 |
| `service.name`, `service.version`, `service.instance.id` | Resource identity từ config của `startTelemetry`                                                                                                                 |
| `trace_id`, `span_id`                                    | Chỉ có khi đang trong span hợp lệ; ngoài context (startup, background) bỏ trống, không tạo ID giả                                                                |
| `logger`                                                 | Context của Nest logger, ví dụ `RoutesResolver`                                                                                                                  |
| `exception.stacktrace`                                   | Stack đã che dữ liệu nhạy cảm, khi log lỗi có stack                                                                                                              |
| Field chẩn đoán                                          | Allowlist: `event`, `event_id`, `error_type`, `dependency_identity`, `operation_name`, `http_method`, `http_route`, `http_status_code`, `duration_ms`, `outcome` |

Field ngoài allowlist bị bỏ trước khi ghi, nên payload, user/principal ID hoặc object tùy ý không lọt vào log. Message và stack đi qua bộ che: `Bearer`/`Basic` token, JWT, credential trong URL, `password|secret|token|api_key|authorization = ...` và email. Bộ che chỉ là lớp bảo vệ thêm; code không được đưa payload vào message. Mức mặc định là `log`/`warn`/`error`/`fatal`; `debug`/`verbose` chỉ bật qua `setLogLevels`.

Giới hạn đã biết:

- Resource identity trên stdout chỉ có sau khi `startTelemetry` gọi `configureStructuredLogging`. Runtime gọi `startTelemetry` trước khi import app nên mọi log đều có identity; test chạy nhiều app trong một process hoặc import bản build khác instance module có thể thấy log thiếu `service.*`.
- Khi bootstrap lỗi, `main.ts` gọi `telemetry.shutdown()` rồi ném lại lỗi; Node in stack thô ra stderr, không phải JSON và không qua Loki. Container exit code và `docker compose logs` là nguồn chẩn đoán cho lỗi startup.

Log chẩn đoán được ghi ở các điểm dùng chung, không rải theo từng handler:

- `createHttpTelemetryMiddleware` ghi đúng một log cho mỗi request, trong context của server span, kèm `http_method`, `http_route` (template hoặc `unmatched`), `http_status_code` và `duration_ms`:
  - `ERROR` `event=http.server.error` cho HTTP 5xx, `client_aborted` và exception, thêm `error_type`.
  - Access log `event=http.server.request` cho request còn lại: `INFO` với 1xx–3xx, `WARN` với 4xx. HTTP 4xx nghiệp vụ không bị coi là lỗi.
  - Access log bỏ qua route `/health` để probe của Docker (5 giây/lần) không làm nhiễu log; lỗi 5xx của `/health` vẫn được ghi. Option `accessLog: { enabled, ignoreRoutes }` đổi hành vi này; các runtime HTTP đọc `HTTP_ACCESS_LOG_ENABLED` (mặc định `true`) để tắt access log khi cần giảm volume mà không mất log lỗi.
- `logDependencyFailure(span, ...)` ghi `ERROR` `event=dependency.failure` với `dependency_identity`, `operation_name`, `error_type` (`timeout`/`unavailable`) trong context của client span lỗi. Hàm này được gọi từ `observeDependency` (mọi dependency v2) và Gateway proxy. Conflict nghiệp vụ không ghi log này.
- Worker xử lý command chưa có log riêng (chỉ access log `/ready`); lỗi xử lý thấy ở span CONSUMER và `dependency.failure`.

`startTelemetry(config, { logsEnabled: true })` dựng `BatchLogRecordProcessor` với OTLP HTTP exporter dùng chung transport (DNS c-ares, timeout 1 giây, một socket), export timeout 2 giây, và đưa processor vào `forceFlush()`/`shutdown()`. Endpoint là `otlpLogsEndpoint`/`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`; khi bỏ trống thì đổi hậu tố `/v1/traces` sang `/v1/logs`, giữ proxy prefix. Khi không bật logs, bootstrap truyền `logRecordProcessors: []` để NodeSDK không tự dựng OTLP log exporter tới `localhost:4318`. Export chạy nền, queue tối đa 2048 record rồi bỏ; Collector ngừng chạy có thể làm mất log nhưng không làm hỏng request. Shutdown đóng app trước rồi mới flush telemetry.

Loki chỉ index `service_name`; `service_version`, `service_instance_id`, `trace_id`, `span_id`, `severity_text` và các field chẩn đoán là structured metadata. Query mẫu:

```logql
{service_name="gateway"} | trace_id="<trace-id>"
{service_name=~"gateway|course|media"} | event="dependency.failure" | error_type="timeout"
{service_name="gateway"} | event="http.server.request" | duration_ms > 500
sum by (service_name) (count_over_time({service_name=~".+"} | severity_text="ERROR" [1m]))
```

Nghiệm thu: `logs-smoke` (trong `pnpm run test:observability`) kiểm Loki chỉ có label `service_name`, 11 runtime có log, `trace_id`/`span_id` khớp span thật trong Tempo, log `dependency.failure` khớp span lỗi cùng service, không lộ secret trong log và đo độ trễ request → log.
