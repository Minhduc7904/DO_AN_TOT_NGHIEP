# OpenTelemetry bootstrap dùng chung

Package `@aiops-lms/observability` khởi tạo OpenTelemetry trước application code, gắn resource identity canonical và cung cấp HTTP middleware tạo server span với W3C Trace Context. Package chỉ chứa technical primitive; không chứa business model, fault label hoặc ground-truth field.

## Phiên bản đã pin

- OpenTelemetry API `1.9.0`.
- OpenTelemetry SDK/resource `2.11.0`.
- OpenTelemetry Node SDK và OTLP HTTP exporter `0.222.0`.

Các version trên được pin trong `package.json`; không dùng range để tránh semantic-convention thay đổi ngoài kiểm soát.

## Contract cấu hình

Caller truyền đủ `serviceName`, `serviceVersion`, `serviceInstanceId`, trạng thái bật/tắt và URL OTLP traces đầy đủ. `service.name` phải lấy từ catalogue canonical, không lấy từ hostname, tên container hoặc process.

HTTP instrumentation không capture request/response header tùy ý. Với response `5xx`, bootstrap đặt span status `ERROR` và `error.type` bằng status code; không thêm secret, PII, fault label hoặc ground-truth label.

Khi telemetry bị tắt, handle trả về là no-op. Khi bật nhưng OTLP backend chưa sẵn sàng, SDK vẫn khởi tạo và request application vẫn được phục vụ; lỗi export nằm ở diagnostic/export path và không được ném vào request path. Trace chưa export được có thể bị mất khi hết retry/buffer của SDK.

## Tracing baseline W10

Baseline dùng `AlwaysOnSampler` (100%), kể cả caller gửi sampled flag `00`, và W3C Trace Context. Caller cần truyền cùng synthetic parent nếu muốn liên kết nhiều HTTP action độc lập; ứng dụng không tự ghép các lần click/request không có chung context. Resource chỉ lấy ba field identity từ config, tắt auto-detection để không capture command-line/environment tùy ý. Tám runtime là Gateway, Auth, Course, Enrollment, Submission, Grading, Notification và Storage Mock có `service.name=submission-storage`; storage không trở thành RCA service candidate.

HTTP server span dùng route template hoặc `unmatched`, không raw path/query/header/payload. `finish` kết thúc với HTTP status thật; `close`/request `aborted` trước finish đặt `ERROR`, `error.type=client_aborted` và không giả status200. Synchronous exception được rethrow nguyên trạng cho caller nhưng span chỉ giữ exception event đã làm sạch. Một span được kết thúc tối đa một lần và listener được tháo; metric status class cho request chưa hoàn tất là `client_aborted`/`exception`, không giả5xx.

HTTP client manual span giữ `dependency_identity`, operation, method, HTTP response status khi đã nhận được và `peer.service` theo mapping topology cố định. Gateway client name là `<dependency_identity> <method>`; các wrapper còn lại dùng dependency/operation. Không ghi raw URL chứa object/course/user ID. PostgreSQL/Redis span có system/operation và dependency identity; không SQL statement/parameters. Auth PostgreSQL phân biệt timeout (`57014`/`ETIMEDOUT`) với unavailable ở span, không đổi lỗi trả business caller.

Timeout/unavailable có span `ERROR` và bounded `error.type`; HTTP4xx nghiệp vụ không tự thành lỗi dependency. RabbitMQ giữ publish producer → receive consumer → process internal cùng trace, với message/event identity theo schema và không payload. Error exception event không chứa raw message/stack. Background retry không có context gốc tạo root publish trace mới, cùng event ID để fallback correlation; không bịa parent hay khẳng định nó vẫn nối trace request cũ.

`TelemetryStartOptions.traceExporter` là hook tùy chọn cho test/exporter; nếu không truyền `spanProcessor`, bootstrap bọc exporter bằng default `BatchSpanProcessor` và `forceFlush()` chờ processor thật hoàn tất. `spanProcessor` truyền tường minh giữ ưu tiên cũ. `shutdown()` chỉ chạy một lần. Đã có test pending batch chưa export, gọi flush rồi thấy span ở exporter trước shutdown; test lifecycle gồm socket HTTP thật bị ngắt.

Nghiệm thu trên **application container thật** đã build/healthy bằng Compose, không thay bằng nhiều app trong một test process:

```bash
cd lms
pnpm run test:observability:tracing -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script xác nhận đúng project test/host ports, tạo khóa học và dữ liệu test riêng, chạy login/course/enroll/submit/grade, query Tempo theo trace ID và từng service, kiểm tra parent chain tám runtime cùng DB/Redis/storage/RabbitMQ. Nó chạy hai lỗi storage timeout/unavailable và khôi phục fault state trong `finally`; không chạy đồng thời workload/fault test khác trên cùng project. Không reset volume hoặc tự restart service. Mỗi request tối đa15 giây, mỗi poll backend tối đa90 giây. CI chạy bước này sau regression khi stack project test vẫn sẵn sàng. Output chỉ chứa trace IDs, service names và số span, không token/password/payload.

Khi không bật metrics hoặc không truyền metric reader, bootstrap truyền `metricReaders: []` tường minh để NodeSDK không tự tạo OTLP reader từ môi trường. Regression test ghi counter và quan sát HTTP exporter endpoint mock, chứng minh shutdown không phát metrics ngoài opt-in; tránh shutdown chờ mạng trong process chỉ dùng tracing.

## Metrics baseline W10

Tám runtime bật metrics và gửi OTLP HTTP qua Collector mỗi5giây. `otlpMetricsEndpoint`/`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` là override tùy chọn; khi bỏ trống, đổi hậu tố `/v1/traces` sang `/v1/metrics` và giữ proxy path prefix. `metricExportIntervalMillis`/`OTEL_METRIC_EXPORT_INTERVAL` nhận1000–60000ms, mặc định5000; SDK export timeout tối đa3000ms. Khi metricsdisabled, danh sách reader rỗng tường minh, không export ngầm. Request path không await exporter/network; outage có thể mất dữ liệu nhưng không làm business request fail.

| Metric SDK                                                                                                    | Prometheus                                                              | Ý nghĩa và label chính                                                           |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `http.server.request.count`                                                                                   | `http_server_request_count_total`                                       | RED throughput; `http_method`, `http_route_template`, `http_status_class`        |
| `http.server.request.error.count`                                                                             | `http_server_request_error_count_total`                                 | HTTP5xx hoặc request interrupted/exception                                       |
| `http.server.request.duration`                                                                                | `http_server_request_duration_seconds_bucket/_sum/_count`               | Latency seconds, route template và method/status                                 |
| `<service>.dependency.request/error.count`, `<service>.dependency.duration`                                   | Tên chuẩn hóa dấuchấm→gạchdưới, counter `_total`, duration `_seconds_*` | `dependency_identity`, `operation_name`, bounded `status`                        |
| `grading.messaging.publish.count/error.count/duration`                                                        | `grading_messaging_publish_*`                                           | Broker publish/confirm latency/error theo exchange/routingkey cấu hình ổn định   |
| `grading.messaging.retry.count`                                                                               | `grading_messaging_retry_count_total`                                   | Số lần worker thử publish pending; không gồm lần publish request đầu             |
| `grading.messaging.pending.count`                                                                             | `grading_messaging_pending_count`                                       | Outbox pending được worker quan sát, không phải broker queue depth               |
| `notification.rabbitmq.consume.count/error.count/duration`, `notification.process.count/error.count/duration` | `notification_rabbitmq_consume_*`, `notification_process_*`             | Consumer/process accepted/duplicate/rejected/unavailable                         |
| Broker detailed queue messages/ready/unacked                                                                  | `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked`                | Backlog thật của queue Notification, `dependency_identity=notification-rabbitmq` |
| `process.cpu.time`                                                                                            | `process_cpu_time_seconds_total`                                        | CPU user+system cumulative seconds của từng application process                  |
| `process.memory.usage`                                                                                        | `process_memory_usage_bytes`                                            | RSS bytes của từng application process                                           |

SDK views áp allowlist attribute cho mọi loại instrument: HTTP method/template/statusclass, dependency/operation/status, exchange/routingkey. Mỗi instrument giới hạn512combination; overflow không chứa ID gốc. Correlation/user/event/run/fault/truth/rawURL bị loại trước export; không chỉ kiểm sourcecode. HTTPmethod không chuẩn→`_OTHER`, matched route dùng template,404khôngmatch→`unmatched`. Resourceexport chỉ ba identity thành `service_name`, `service_version`, `service_instance_id`; Prometheus thêm `job`, `instance`, `otel_scope_*` và histogram `le` bounded. Không dùng experiment/runID làm label.

Mọi durationhistogram hiện có unitseconds dùng11biên `[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2.5,5,10]` và `+Inf`. Biên phủ request nhanh đến dependencytimeout3giây/Gateway5giây; bucket10giây giữ tail, đơn vị không đổi. Một view duy nhất cho mỗi instrumenttype tránh stream/histogramtrùng. ProcessCPU là nguồn canonical ứng dụng; không cộng thêm containerCPU tránh doublecount. CPUrate: `sum by(service_name)(rate(process_cpu_time_seconds_total[1m]))`; RSS: `process_memory_usage_bytes`.

RabbitMQ4.1.4management image đã bật `rabbitmq_prometheus`; Collector scrape nội bộ15692 `/metrics/detailed?family=queue_coarse_metrics&vhost=/&queue=notification.grade-completed.v1`. Chỉ giữ ba gauge depth, exactqueue/vhostcanonical rồi bỏ labelqueue/vhost; map ownership về service Notification, dependency `notification-rabbitmq`. Broker-observed series có `service_version=rabbitmq-4.1.4`, `service_instance_id=rabbitmq-compose-1` để phân biệt process ứng dụng. Không thêm publicport. Nếu đổi queue khỏi canonical, mapping này phải cập nhật trước nghiệm thu; thiếu series là unavailable, không mặc định queue0. Consumer lag theo thời gian, brokerretrycount, network/diskIO và connectionpoolusage chưa instrument; pending+retryattempt+processingduration+backlog là signal thực hiện có.

Query mẫu (không thêm `or vector(0)` để che missing):

```promql
sum by(service_name)(rate(http_server_request_count_total{http_status_class="2xx"}[1m]))
sum by(service_name)(increase(http_server_request_error_count_total{http_status_class="5xx"}[1m]))
histogram_quantile(0.95,sum by(service_name,le)(rate(http_server_request_duration_seconds_bucket[1m])))
sum by(service_name,dependency_identity,status)(increase(submission_dependency_error_count_total{status=~"timeout|unavailable"}[1m]))
rabbitmq_detailed_queue_messages{dependency_identity="notification-rabbitmq"}
grading_messaging_pending_count
```

Tên outbox đúng để query là `grading_messaging_pending_count` (khác brokerbacklog). Healthy không có errseries cho tới lỗi đầu là absence/noerror, không tự khẳng định exporter khỏe; dùng requestseries/CPU/targetfreshness để đánh giá coverage.

Nghiệm thu dữ liệu thật sau build/healthy trong project test cô lập:

```bash
cd lms
pnpm run test:observability:metrics -- --environment test --project aiops-lms-test-regression --confirm aiops-lms-test-regression --compose-env-file ../docker-compose/.env.example
```

Script xác minh project/port ownership, chạy một tracingworkflowwarmup, đợi đủ chu kỳ export5s+batch1s+scrape5s và kiểm timestamp sample mới, rồi ghi baselinecounters trước actual tracingworkflow đo delta rồi đợi delta healthy/5xx/timeout/unavailable mới, kiểm metrics8service/resource/CPU/RSS/buckets/p95 và label privacy. Nó warmup404template rồi gọi10IDkhác và so tậpseries không tăng. Sau đó stopNotification, publish4fixtureevents valid vào broker, chứng minh queue>=4 rồi startconsumer và đợi currentqueue=0. Cuối cùng stopCollector, gửi businessrequest thành công và startCollector/exportrecover. Mọi stop có restorefinally; test không chạy chung faultworkload khác. Poll90giây mỗi điều kiện, request15giây; baseline queue phải có series thật và rỗng trước test. Script không log credential/token/payload.
