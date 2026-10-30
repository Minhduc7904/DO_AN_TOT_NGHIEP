# Telemetry và ground-truth schema v1

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** v1, đề xuất — chờ Đức tự xác nhận (không cần Bách review, theo chỉ thị trực tiếp của Đức). Phần "tín hiệu có thật" lấy từ [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 1 (đo ngày 29/10/2026) và từ code `lms/packages/observability/src`, `lms/packages/common/src/messaging`, `lms/packages/common/src/telemetry`; chỗ chưa đối chiếu được ghi "chưa kiểm chứng".
>
> **Thay thế:** [telemetry-and-ground-truth-schema-v0](telemetry-and-ground-truth-schema-v0.md) (giữ làm lịch sử, không dùng cho dataset mới).
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md), [http-and-event-contracts-v2](http-and-event-contracts-v2.md), [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
>
> **Vị trí canonical dự kiến:** `docs/processed/architecture/telemetry-and-ground-truth-schema-v1.md`
>
> **Mục đích:** chốt logical schema v1 cho metrics, traces, structured logs, telemetry artifact/data quality và ground truth của controlled experiment trên topology v2 (7 service + 4 worker). Schema phải đủ để tái lập run, tạo service/edge feature, dựng incident timeline, xếp hạng RCA service-level và đánh giá RQ1–RQ5 mà không làm thay đổi topology, HTTP/command contract hoặc fault semantics đã chốt ở bộ tài liệu v2.
>
> **Quy ước tên gọi lịch sử:** "T4" là phần schema telemetry và ground truth (tài liệu này); "T5" là experiment/evaluation manifest do mảng AI canonicalize sau; "T3" là fault matrix. Ba tên này giữ từ v0 để các mục ranh giới trách nhiệm không phải viết lại.

---

# 1. Source of truth và ranh giới artifact

Artifact này phải nhất quán với các tài liệu và code sau. Khi mâu thuẫn, ưu tiên theo thứ tự:

1. [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) và [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md) — vai trò RCA engine, telemetry phải đủ `service.name`/`trace_id`/`span_id`, hai loại cạnh xác thực `<caller>-identity-token` và `<caller>-identity-jwks`.
2. [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) — 11 `service.name`, 16 dependency identity hạ tầng, edge catalogue `e01–e29` (bỏ `e03`, `e09` ở R-13), workflow W1–W7.
3. [http-and-event-contracts-v2](http-and-event-contracts-v2.md) — HTTP boundary, error semantics, command envelope và quy ước queue (mục 6, 8).
4. [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) — ownership và ma trận fault FA–FH.
5. [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) — **nguồn sự thật về tín hiệu có thật** (mục 1), quy ước đọc telemetry (mục 2), case C1–C7 (mục 3) và schema `RcaIncidentResult` (mục 5). Khi catalogue và ma trận fault v2 mục 5 khác nhau ở component hoặc tín hiệu, tài liệu này theo catalogue (xem mục 17.1).
6. Code: `lms/packages/observability/src`, `lms/packages/common/src/messaging`, `lms/packages/common/src/telemetry/observe-dependency.ts`, `lms/contracts/src/commands/`; cấu hình thu thập `aiops-platform/observability/otel-collector.yaml`.
7. [analysis-anomaly-rca-blueprint-v1](analysis-anomaly-rca-blueprint-v1.md), [backend-microservice-testbed-blueprint-v2](backend-microservice-testbed-blueprint-v2.md) và [evaluation-protocol-v1](evaluation-protocol-v1.md) — telemetry contract, feature schema, dynamic graph, incident/RCA/evaluation ở mức blueprint và protocol; các tài liệu này tham chiếu ngược schema này cho truth và artifact.
8. [project-scope-v2](../direction/project-scope-v2.md) và [research-questions-and-metrics-v2](../direction/research-questions-and-metrics-v2.md) — MVP/Target/Stretch, RQ1–RQ5, split, ablation, robustness và provenance.

Khi implementation backend phát ra tên field/library-specific khác logical schema này, ingestion/normalization phải map về vocabulary ở đây; không tạo một schema cạnh tranh trong từng service. Bảng ánh xạ attribute thực tế sang field logic nằm ở mục 13.1.

## 1.1. Không thuộc tài liệu này

- Không viết OpenTelemetry SDK bootstrap, Collector/Prometheus/Tempo/Loki config hoặc instrumentation code (đã có ở `lms/packages/observability` và `aiops-platform/observability`).
- Không freeze metric threshold, detector/window size, RCA weight hoặc evaluation tolerance.
- Không freeze workload rate/duration, fault intensity cụ thể hoặc timeout milliseconds; các giá trị đó thuộc pilot/protocol rồi được version hóa.
- Không thay đổi topology 7 service + 4 worker (sau R-13: `auth` + `student` → `identity`, ADR-005).
- Không thay đổi HTTP/command business payload đã chốt ở contract v2.
- Không thêm business service/dependency mới.
- Không biến component/dependency thành primary RCA candidate; primary RCA vẫn là **service-level**.
- Không yêu cầu mọi runtime signal tồn tại ở mọi service; signal chưa có (catalogue mục 1.5) phải được biểu diễn là unavailable/missing theo schema, không giả bằng `0`.
- Không cài fault injector, workload k6, RCA engine hay MCP (thuộc mảng AI, xem catalogue mục 6).

---

# 2. Quyết định schema v1

## 2.1. Logical schema, không khóa storage engine

Schema v1 định nghĩa **field logic và semantics**. Representation vật lý có thể là JSON/JSONL, Parquet, Prometheus export, OTLP-derived artifact hoặc Pydantic model miễn là giữ semantics này.

Các schema identifier canonical:

```text
telemetry_schema_version      = telemetry.v1
ground_truth_schema_version   = ground-truth.v1
telemetry_quality_version     = telemetry-quality.v1
artifact_manifest_version     = telemetry-artifact.v0
```

Version là string để tránh nhầm giữa schema generation và version của package/runtime. `telemetry-artifact.v0` giữ nguyên vì cấu trúc manifest không đổi so với v0; ba identifier còn lại tăng lên v1 theo quy tắc ở mục 14 (xem mục 14.4).

## 2.2. Invariant bắt buộc

1. Service identity ổn định dùng `service.name`; không dùng container/pod/process name thay thế.
2. Tất cả time ở boundary/artifact dùng UTC; serialized time dùng ISO-8601 có timezone, ưu tiên dạng `...Z`.
3. Raw telemetry và ground truth là hai plane khác nhau; truth label không được leak vào model feature.
4. `trace_id`/`span_id`/`message_id` dùng correlation/lookup, **không dùng làm Prometheus label**.
5. Missing telemetry khác với giá trị `0` và khác với `no traffic`.
6. Baseline controlled runs dùng 100% trace sampling theo blueprint (SDK dùng `AlwaysOnSampler`); RQ4 degraded telemetry được tạo **từ baseline telemetry artifact**, không thay ground truth.
7. Mỗi run/artifact phải truy ngược được về code/config/workload/fault provenance.
8. Dependency identity dùng đúng vocabulary topology v2 (mục 3.2); không để từng service tự đặt alias riêng.
9. HTTP/command runtime correlation giữ [http-and-event-contracts-v2](http-and-event-contracts-v2.md); schema này không thêm business payload field mới.
10. Exact OpenTelemetry/library attribute có thể thay đổi theo instrumentation version; ingestion normalize về logical field ở artifact này thay vì để Analysis phụ thuộc trực tiếp vào tên attribute chưa ổn định.

---

# 3. Identity vocabulary canonical

## 3.1. Service identity

```text
gateway
identity
course
media
media-worker
notification
notification-worker
scheduler
scheduler-worker
ai
ai-worker
```

11 giá trị này là danh sách duy nhất mà `defineTelemetryConfig` (`lms/packages/observability/src/telemetry-config.ts`) chấp nhận; runtime khởi động với `service.name` ngoài danh sách sẽ báo lỗi. Worker là process riêng, cùng image và cùng owner dữ liệu với service tương ứng nhưng có `service.name` riêng để Analysis phân biệt được nguồn triệu chứng.

Mỗi telemetry record thuộc service boundary phải truy được:

```text
service_name        <- resource `service.name`
service_version     <- resource `service.version`
service_instance_id <- resource `service.instance.id`
```

`service_instance_id` là identity instance runtime, **không** thay `service_name` trong RCA candidate set.

Candidate set RCA mặc định theo catalogue mục 8: mọi `service_name` trên trừ `gateway`. `gateway` là symptom mặc định và chỉ là candidate khi protocol có gateway fault.

## 3.2. Dependency identity

### 3.2.1. 16 identity hạ tầng (catalogue mục 2.2)

```text
identity-postgres
course-postgres
media-postgres
notification-postgres
scheduler-postgres
ai-postgres
media-minio
notification-smtp
ai-llm-provider
course-rabbitmq
media-rabbitmq
media-worker-rabbitmq
notification-rabbitmq
notification-worker-rabbitmq
ai-rabbitmq
ai-worker-rabbitmq
```

Quy ước đặt tên: `<service.name của bên sử dụng>-<hạ tầng>`. Worker truy cập PostgreSQL của owner bằng identity của owner nên `media-worker` ghi `media-postgres`, `notification-worker` ghi `notification-postgres`, `scheduler-worker` ghi `scheduler-postgres`, `ai-worker` ghi `ai-postgres`. `gateway` không sở hữu hạ tầng.

### 3.2.2. Identity cạnh HTTP và xác thực

Cạnh HTTP đồng bộ giữa service và cạnh ADR-004 cũng mang `dependency_identity` theo mẫu `<service.name bên gọi>-<đích>`; metric `lms_dependency_*` của cạnh này do **bên gọi** ghi (catalogue mục 2, quy ước 4):

```text
gateway-identity  gateway-course  gateway-media
gateway-notification  gateway-scheduler  gateway-ai
course-media  course-ai  media-identity
notification-worker-identity  scheduler-worker-media
ai-worker-course  ai-worker-media
<caller>-identity-token      # lấy service token (ADR-004), caller = gateway và mọi worker, course, media
<caller>-identity-jwks       # tải JWKS (ADR-004), ở mọi runtime verify token
```

Nguồn: mapping `HTTP_DEPENDENCY_PEERS` trong `lms/packages/observability/src/http-client-span-attributes.ts` (13 cạnh HTTP, gắn `peer.service`) và catalogue mục 1.1 (cạnh `*-identity-token`, `*-identity-jwks`). `media-identity` có trong mapping và edge `e12` nhưng không nằm trong danh sách cạnh đo ở catalogue mục 1.1 (chưa kiểm chứng đã quan sát được trong lần đo).

### 3.2.3. Quy tắc

- dependency signal phát sinh từ service/client boundary giữ `service_name` của service đang quan sát và thêm `dependency_identity` tương ứng;
- infrastructure metric chỉ có ở broker được Collector enrich bằng quy tắc sở hữu queue (mục 3.2.4), không do ingestion đoán từ hostname;
- `media-minio`, `notification-smtp`, `ai-llm-provider` là component/dependency evidence, không thêm vào service-level candidate set; Storage Mock và `course-redis` của v1 không còn tồn tại;
- `scheduler-worker` không có queue RabbitMQ nên không có identity `scheduler-*-rabbitmq`.

### 3.2.4. Identity RabbitMQ

- Span PRODUCER và span CONSUMER của một process dùng chung `dependency_identity = <service.name của process>-rabbitmq` (`RabbitMqCommandPublisher.dependencyIdentity`, consumer dùng lại giá trị này). Ví dụ `notification` phát với `notification-rabbitmq`, `notification-worker` phát lại và tiêu thụ với `notification-worker-rabbitmq`.
- Metric broker `rabbitmq_detailed_queue_*` mang `service_name` là worker tiêu thụ (tiền tố trước `--` của tên queue) và `dependency_identity = <worker>-rabbitmq`, do `otel-collector.yaml` gắn sẵn. Queue thuộc worker tiêu thụ, **không** thuộc service phát command (catalogue mục 2, quy ước 2).
- `grading-rabbitmq` không còn. `notification-rabbitmq` vẫn tồn tại nhưng đổi nghĩa: ở v1 nó là identity phía consumer của F4; ở v2 nó là identity của process `notification` khi phát command, còn phía consumer là `notification-worker-rabbitmq`.

---

# 4. Run identity và correlation strategy

## 4.1. Quyết định về `run_id`

`run_id` là **experiment identity**, không phải business identity và không phải root-cause label.

Schema v1 chốt:

- `run_id` **bắt buộc** trong ground-truth manifest, artifact manifest và mọi normalized telemetry row do Analysis ingestion tạo ra;
- `run_id` **không bắt buộc** phải tồn tại trong raw application metric/span/log;
- runner/export step gắn raw artifact với đúng `run_id`; ingestion kế thừa từ artifact provenance;
- implementation **không được thêm `run_id` vào HTTP/command business payload** chỉ để phục vụ Analysis;
- `run_id` **không được dùng làm Prometheus label** vì cardinality theo run;
- nếu sau này controlled environment chọn propagate experiment context qua W3C baggage/span/log attribute, đó là optimization/ADR và không thay thế artifact-level binding ở trên; field này vẫn bị cấm làm model feature nếu có nguy cơ leakage.

Cách này giữ nguyên HTTP/command contract v2 và vẫn đảm bảo mỗi normalized record truy được về run.

## 4.2. HTTP correlation

Runtime correlation canonical:

```text
W3C Trace Context
traceparent
tracestate (khi có)
```

Normalized span/log dùng:

```text
trace_id
span_id
parent_span_id   # span only
```

Request ID riêng có thể tồn tại để debug nhưng không phải field bắt buộc của schema v1 và không thay trace identity.

## 4.3. Command RabbitMQ — correlation qua command envelope

v2 bỏ event `grade.completed`; mọi giao tiếp bất đồng bộ là **command** có đích rõ ([http-and-event-contracts-v2](http-and-event-contracts-v2.md) mục 6). Primary async correlation:

1. Use case ghi command vào bảng `outbox_messages` cùng transaction với dữ liệu nghiệp vụ. `PostgresOutbox.enqueue` inject trace context đang hoạt động vào `envelope.correlation.traceparent`/`tracestate` và ghi `correlation_id`.
2. Relay outbox chạy ngoài request nên không có span hoạt động. Khi đó `RabbitMqCommandPublisher` lấy `correlation.traceparent` trong envelope làm parent của span PRODUCER `lms.commands publish <command_name>`, nên chuỗi command **nối vào trace của request HTTP gây ra nó** (đã sửa và có unit test ở R-12, catalogue mục 4.2). Sau đó context của span PRODUCER được inject vào header AMQP cùng `x-attempt`.
3. Consumer extract context từ header AMQP, tạo span CONSUMER `<queue> process` (parent là span PRODUCER) và chạy handler trong span này. `message_id` của envelope được ghi vào span CONSUMER ở attribute `messaging.message.id`.
4. Retry là publish lại với `x-attempt` tăng dần; hết `maxAttempts` thì command vào `<queue>.error`.
5. **Fallback**: `message_id` (có ở envelope, AMQP `messageId` và span CONSUMER) cộng quan hệ thời gian. Analysis chỉ dùng khi trace async bị missing/degraded và confidence phải thấp hơn edge được nối bằng trace context. Span PRODUCER không mang `message_id`, và hiện chưa có log nào mang `message_id` (mục 5.4).
6. `correlation.correlation_id` và `producer.service_name` chỉ nằm trong envelope; `correlation_id` không xuất hiện trong span/metric/log. Vì vậy chủ sở hữu command (service ghi vào outbox) không đọc được từ span PRODUCER mà phải suy ra từ `producer.service_name` của envelope hoặc queue đích (catalogue mục 2, quy ước 1).

Lưu ý khi đọc:

- Span PRODUCER thuộc process relay, nên `service_name` của span `lms.commands publish …` chỉ cho biết tiến trình phát. Outbox của `notification` có thể được phát bởi process `notification` hoặc `notification-worker`.
- Luồng `scheduler → scheduler-worker` **không** nối bằng trace: `scheduler-worker` thăm dò DB, không nhận command (catalogue mục 1.5).

Schema normalized cần giữ được:

```text
trace_id
span_id
parent_span_id
message_id
command_name
messaging_operation      # publish | process (theo `messaging.operation.type`)
queue
service_name
dependency_identity
```

`command_name` hiện **không** là span attribute: nó chỉ có trong tên span PRODUCER (`lms.commands publish <command_name>`) và suy ra được từ tên queue (`<worker>--<command-kebab>-v<n>`). Contract v2 mục 8 yêu cầu attribute `command_name`, `queue` và attempt nhưng code hiện tại chưa phát đủ (`queue` có ở `messaging.destination.name`, attempt chỉ nằm trong header `x-attempt`); ingestion trích từ tên span/queue (chưa kiểm chứng đủ mọi command). Tên exchange/queue vẫn không phải identity nghiên cứu ngoài việc suy ra chủ sở hữu consumer; có thể lưu làm diagnostic attribute.

---

# 5. Telemetry schema v1

## 5.1. Common normalized metadata

Mỗi normalized telemetry record dùng được cho Analysis phải có hoặc truy được các field chung sau:

| Field | Type | Required | Semantics |
| --- | --- | :---: | --- |
| `run_id` | string | ✓ | Experiment run identity, gắn tại artifact/ingestion boundary |
| `timestamp` | UTC datetime | ✓ | Thời điểm signal; ISO-8601 ở artifact boundary |
| `service_name` | string | ✓ | Service logical identity; với dependency-only exporter signal có thể được deterministic enrichment từ topology |
| `service_version` | string/null | ✓ | Version service; null chỉ khi source thật sự không thể cung cấp và quality report ghi rõ |
| `service_instance_id` | string/null | ✓ | Runtime instance; null hợp lệ với artifact/exporter không có instance-level identity |
| `schema_version` | string | ✓ | `telemetry.v1` cho normalized record |
| `source` | string | ✓ | Nguồn logical, ví dụ `otel`, `prometheus`, `tempo`, `loki`, `rabbitmq-exporter` |
| `quality_flags` | array<string> | ✓ | Empty array khi không có issue; không dùng boolean mơ hồ |

`service_version`/`service_instance_id` được giữ nullable để không biến việc một exporter infrastructure không phát resource attribute thành dữ liệu giả. Data-quality report phải cho biết tỷ lệ missing.

---

## 5.2. Metrics — `MetricRecord`

Logical schema:

```text
MetricRecord
- run_id
- timestamp
- service_name
- service_version
- service_instance_id
- metric_name
- metric_kind              # counter | gauge | histogram
- unit
- value                    # scalar counter/gauge; null khi histogram payload được dùng
- histogram_count          # nullable
- histogram_sum            # nullable
- histogram_bucket_bounds  # nullable
- histogram_bucket_counts  # nullable
- dependency_identity      # nullable
- attributes               # low-cardinality dimensions only
- source
- schema_version
- quality_flags
```

### Metric attribute rules

Cho phép dimension có cardinality bounded và có ý nghĩa phân tích. Allowlist thực tế của SDK (`METRIC_ATTRIBUTE_KEYS` trong `service-metrics.ts`, giới hạn 512 tổ hợp mỗi instrument) là:

```text
http_method
http_route_template
http_status_class          # 1xx..5xx, client_aborted, exception
dependency_identity
operation_name
status                     # ok | timeout | unavailable | expected_failure (lms_dependency_*)
exchange                   # có trong allowlist, chưa instrument nào phát (grep như dưới)
routing_key                # như trên
```

Metric broker có thêm dimension `queue` (bounded, 24 giá trị: 12 queue canonical và 12 `.error`) do Collector gắn, không phải SDK.

Không dùng label:

```text
trace_id
span_id
message_id
correlation_id
request_id
principal_id
raw URL/path có ID động
run_id
fault_type
root_cause_service
```

### Metric vocabulary và ánh xạ sang metric thật

Schema không bắt buộc mỗi signal đều là raw metric riêng; một số value có thể là query/aggregation-derived trước feature stage. Vocabulary logic của v0 được giữ; bảng dưới cho biết metric Prometheus thực tế hiện có (catalogue mục 1.1) và signal nào **chưa có**. Signal chưa có được biểu diễn bằng trạng thái `not_instrumented` (mục 7.1), không bằng `0`.

#### Service RED

| Logic | Metric thật | Ghi chú |
| --- | --- | --- |
| `request_count` | `http_server_request_count_total` | Nhãn `service_name`, `http_method`, `http_route_template`, `http_status_class`; 11/11 runtime (worker chỉ có `/health`, `/ready`) |
| `request_error_count` | `http_server_request_error_count_total` | Chỉ tính HTTP 5xx và request bị ngắt (`client_aborted`/`exception`); 4xx nghiệp vụ **không** vào metric lỗi |
| `request_duration` | `http_server_request_duration_seconds_bucket/_sum/_count` | Đơn vị giây |
| `request_rate`, `error_rate`, `latency_p50/p95/p99` | derive bằng query | Provenance phải ghi query/aggregation |

#### Resource/runtime

| Logic | Metric thật | Ghi chú |
| --- | --- | --- |
| `cpu_usage` | `process_cpu_time_seconds_total` | CPU user+system tích lũy của process, 11/11 runtime; lấy `rate(...)`. Là nguồn canonical, không cộng thêm CPU container |
| `memory_usage` | `process_memory_usage_bytes` | RSS của process, 11/11 runtime |
| `network_rx`, `network_tx`, `disk_io`, `event_loop_lag` | chưa có | Không có trong catalogue mục 1.1; grep `createCounter\|createHistogram\|createObservable*` trong `lms/packages` và `lms/services` chỉ thấy 8 instrument (HTTP ×3, dependency ×3, CPU, RSS) |
| `connection_pool_usage` | chưa có | Catalogue mục 1.5: chưa có pool PostgreSQL và thời gian chờ pool |

Chỉ signal có instrumentation thực tế mới được dùng. Signal chưa có không làm run invalid nếu scenario/protocol không đánh dấu required.

#### Dependency

| Logic | Metric thật | Ghi chú |
| --- | --- | --- |
| `client_request_rate` | `lms_dependency_request_count_total` | Nhãn `service_name`, `dependency_identity`, `operation_name`, `status`; 38 cặp (service, identity) |
| `client_error_rate` | `lms_dependency_error_count_total` | Không tính `status=expected_failure` |
| `client_latency` | `lms_dependency_duration_seconds_bucket/_sum/_count` | Histogram, đơn vị giây |
| `db_latency`, `db_error_rate` | cùng họ, `dependency_identity=<service>-postgres` | 7 identity |
| `storage_latency` | cùng họ, `dependency_identity=media-minio` | `media` và `media-worker` |
| `smtp_latency` (mới ở v1) | cùng họ, `dependency_identity=notification-smtp` | `notification-worker` |
| `llm_provider_latency` (mới ở v1) | cùng họ, `dependency_identity=ai-llm-provider` | `ai` và `ai-worker` |
| `auth_edge_latency/error` (mới ở v1) | cùng họ, `dependency_identity=<caller>-identity-token`, `<caller>-identity-jwks` | ADR-004 |
| `queue_depth` | `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked` | Nhãn `service_name` (worker tiêu thụ), `dependency_identity`, `queue`; nguồn là broker, scrape 5 giây |
| `consumer_count` (mới ở v1) | `rabbitmq_detailed_queue_consumers` | Cùng nhãn |
| `consumer_lag` theo thời gian, tuổi message cũ nhất | chưa có | Catalogue mục 1.5: chỉ đo được theo độ sâu; suy từ span (thời điểm PRODUCER so với CONSUMER cùng trace) |
| `consumer_processing_duration` | chưa có metric riêng | Chỉ có span CONSUMER `<queue> process`; worker chưa có log xử lý command |
| Publish/consume RabbitMQ ở runtime | chưa có | Không có `lms_dependency_*` cho `*-rabbitmq`, chỉ có span |
| Độ trễ outbox (số `outbox_messages` chưa phát) | chưa có | Command kẹt trong DB không thấy ở broker |

Series broker không có `service_version`/`service_instance_id` (Collector xóa vì broker không có version/instance của runtime LMS); đây là trường hợp nullable hợp lệ ở mục 5.1. Thiếu một gauge broker nghĩa là unavailable, không phải queue rỗng.

Redis latency (`redis_latency`) của v0 bị bỏ vì topology v2 không còn Redis.

#### App-specific

v0 liệt kê `submission_*`, `notification_*` làm app metric tối thiểu. Ở v2 các họ metric thực tế chỉ gồm những họ ở các bảng trên; **chưa có** app metric nghiệp vụ (số job AI thành công/thất bại, số recipient của batch…). Kết quả nghiệp vụ như trạng thái job/batch nằm trong DB của service owner, không phải telemetry. App metric nào được thêm sau này không được encode `fault_id`, `fault_active` hoặc root-cause truth.


### Histogram/percentile rule

- Nếu backend giữ histogram, raw/normalized artifact nên giữ bucket/count/sum đủ để tái aggregate khi khả thi.
- `latency_p50/p95/p99` có thể là query-derived metric hoặc feature; provenance phải cho biết aggregation source/config.
- Không coi một percentile thiếu là `0`.
- Mọi duration histogram hiện có dùng đơn vị giây với 11 biên `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` và `+Inf` (`DURATION_BUCKETS_SECONDS` trong `service-metrics.ts`); bucket được giữ ở backend Prometheus nên có thể tái aggregate.

---

## 5.3. Traces — `TraceSpan`

Logical schema:

```text
TraceSpan
- run_id
- trace_id
- span_id
- parent_span_id           # nullable cho root span
- service_name
- service_version
- service_instance_id
- span_kind                # server | client | producer | consumer | internal
- operation_name
- start_time
- end_time
- duration_ms
- status                   # unset | ok | error
- error_type               # nullable
- http_method              # nullable
- http_route               # nullable, route template ưu tiên
- http_status              # nullable
- peer_service             # nullable, service callee logical nếu biết
- dependency_identity      # nullable
- message_id               # nullable, async fallback correlation (span CONSUMER `messaging.message.id`)
- command_name             # nullable, suy từ tên span/queue
- messaging_operation      # nullable, publish | process
- queue                    # nullable, tên queue của consumer
- transport_destination    # nullable diagnostic field (exchange/routing key); không dùng làm business identity
- attributes               # sanitized additional attributes
- source
- schema_version
- quality_flags
```

### Trace rules

1. `trace_id` và `span_id` phải giữ nguyên exact identity từ tracing backend; không hash/rewrite giữa modalities.
2. `duration_ms` có thể derive từ `end_time - start_time`; nếu cả ba cùng lưu phải validation consistency.
3. HTTP route dùng route template khi có; không bắt buộc raw dynamic path làm dimension.
4. `peer_service` chỉ dùng service identity canonical nếu biết chắc; dependency infrastructure dùng `dependency_identity`.
5. Error/timeout được biểu diễn bằng span status + error/error type/HTTP status theo instrumentation thực tế; ingestion normalize về logical field ở trên.
6. Baseline controlled run kỳ vọng 100% sampling; missing span vẫn có thể xảy ra vì instrumentation/export failure và phải được quality report phản ánh.

### Tên span thực tế

| Kind | Tên span | Nguồn |
| --- | --- | --- |
| SERVER | `<METHOD> <http_route_template>` (hoặc `<METHOD> unmatched`) | `createHttpTelemetryMiddleware` |
| CLIENT | `<dependency_identity> <operation>` | `observeDependency` |
| PRODUCER | `lms.commands publish <command_name>` | `RabbitMqCommandPublisher` |
| CONSUMER | `<queue> process` | `RabbitMqCommandConsumer` |

Span CLIENT/PRODUCER/CONSUMER mang `dependency_identity` và `operation_name` (`publish` hoặc `consume` cho messaging). Span HTTP CLIENT có thêm `peer.service` theo mapping cố định. Kind `internal` của v0 không còn dùng cho xử lý command: span xử lý command là CONSUMER.

### HTTP edge derivation

Dynamic service edge được derive từ client/server span relation, ví dụ:

```text
gateway -> course            # dependency_identity=gateway-course
gateway -> media
course -> media              # course-media
ai-worker -> course          # ai-worker-course (đóng vòng course -> ai -> course)
notification-worker -> identity
```

Static edge ID `e01...e29` của topology là validation/enrichment metadata, không bắt buộc phải được application emit vào span. Các edge `e25–e26` (JWKS và token) là cạnh nền tần suất thấp: token làm mới nền ở 50% TTL (khoảng 5 phút mỗi cặp caller/audience), JWKS chỉ tải khi khởi động, cache hết hạn (mặc định 5 phút) hoặc gặp `kid` lạ.

### Dependency span derivation

Ví dụ:

```text
service_name=media            dependency_identity=media-minio
service_name=notification-worker  dependency_identity=notification-smtp
service_name=ai-worker        dependency_identity=ai-llm-provider
```

biểu diễn outbound dependency evidence mà không biến MinIO, SMTP hay LLM provider thành primary service candidate.

### Async edge derivation

Async edge (`e15–e19`, `e29` của catalogue) được xây từ quan hệ parent giữa span PRODUCER và span CONSUMER của cùng command, ví dụ:

```text
media-worker  <- command media.thumbnail.generate   (queue media-worker--generate-media-thumbnail-v1)
ai-worker     <- command ai.job.run                  (queue ai-worker--run-ai-job-v1)
```

Bên nhận được xác định bằng `service_name` của span CONSUMER (cũng là tiền tố của tên queue); bên gửi không đọc từ `service_name` của span PRODUCER mà từ `producer.service_name` trong envelope hoặc từ span cha (mục 4.3). Khi trace context thiếu, Analysis có thể fallback:

```text
message_id + command_name + temporal relation
```

và đánh dấu correlation confidence thấp hơn.

Nhiễu cần lọc khi dựng edge/feature (catalogue mục 1.5): `scheduler-worker` tạo trace gốc cho mỗi lần thăm dò DB (mỗi giây) và mọi runtime tạo trace cho `/ready`. Lọc theo `http_route_template`/`operation_name`, không loại bằng cách bỏ cả service.

---

## 5.4. Structured logs — `LogRecord`

Logical schema:

```text
LogRecord
- run_id
- timestamp
- level
- service_name
- service_version
- service_instance_id
- trace_id                 # nullable
- span_id                  # nullable
- message_id               # nullable; hiện chưa log nào phát (allowlist của logger còn tên `event_id`, ingestion map về `message_id`)
- event                    # stable semantic event name khi có
- error_type               # nullable
- dependency_identity      # nullable
- message                  # nullable raw/sanitized message
- message_template         # nullable; có thể được tạo ở normalize/feature stage
- attributes               # sanitized structured fields
- source
- schema_version
- quality_flags
```

### Log correlation rules

- Log trong HTTP request context phải chứa `trace_id`/`span_id` khi instrumentation/logger context khả dụng.
- Log trong consumer chạy trong context của span CONSUMER nên mang `trace_id`/`span_id` khi có log; hiện worker chưa log khi xử lý command (catalogue mục 1.5) nên chưa có log async để đối chiếu, và log chưa mang `message_id`.
- Background/startup log không bắt buộc có trace ID.
- Không đưa password, token, secret hoặc PII không cần thiết vào artifact.
- `principal_id` nếu business operation buộc phải log vì debug thì phải được loại khỏi feature set; schema v1 không yêu cầu field đó.
- Không sinh log artificial kiểu `root_cause=media` hoặc `FA active` chỉ để làm RCA dễ hơn.

### Log feature preparation

Raw `message` không được đưa trực tiếp vào model MVP. Normalize thành template rồi aggregate theo service/window, ví dụ:

```text
"Dependency media-minio remove-object lỗi timeout"
"Dependency notification-smtp smtp.send lỗi timeout"
-> "Dependency <*> <*> lỗi timeout"
```

Message của log do code phát có dạng ổn định (`Dependency <identity> <operation> lỗi <error_type>`, `HTTP <method> <route> lỗi <error_type>`), nên template gần như trùng message; giá trị biến thiên như `duration_ms` nằm ở field riêng, không nằm trong message.

### Log thực tế của testbed v2

- 11/11 runtime có log; chỉ `service_name` là index label ở Loki, còn `trace_id`, `span_id`, `service_version`, `service_instance_id` là structured metadata.
- Field chẩn đoán qua allowlist (`structured-logger.ts`): `dependency_identity`, `duration_ms`, `error_type`, `event`, `event_id`, `http_method`, `http_route`, `http_status_code`, `operation_name`, `outcome`. Field ngoài allowlist bị bỏ để không lộ payload/PII; message đi qua bộ che credential/PII.
- Ba `event` có thật: `http.server.request` (access log của mọi request trừ `/health`; INFO, 4xx là WARN), `http.server.error` (5xx, `client_aborted`, exception) và `dependency.failure` (kèm `dependency_identity`, `error_type`, `trace_id`, `span_id` trỏ đúng span CLIENT lỗi).
- Worker chỉ có access log `/ready`; chưa có log khi xử lý command (catalogue mục 1.5). Log ngoài span context (startup, background) không có `trace_id`.

---

# 6. Telemetry artifact manifest và lineage

Mỗi telemetry artifact có identity riêng và được đăng ký bằng `TelemetryArtifactManifest`. `RunGroundTruth` không sở hữu artifact pointer; cùng một execution có thể có nhiều raw, normalized hoặc derived artifact mà vẫn dùng một truth record bất biến.

```text
TelemetryArtifactManifest
- artifact_manifest_version
- artifact_id
- run_id
- artifact_kind              # raw | normalized | derived
- modality                  # metrics | traces | logs | multimodal
- modality_availability     # trạng thái availability của từng modality
- telemetry_schema_version
- variant_kind              # full | degraded
- source_artifact_id        # null cho artifact gốc; required cho derived/degraded
- format                    # jsonl | parquet | prometheus-export | ...
- location                  # repo-relative path/URI do runner quản lý
- sha256                    # integrity/provenance khi artifact là file immutable
- generated_at
- time_start
- time_end
- record_count
- source_systems
- transformation_type       # nullable; normalize | trace-drop | missing-modality | ...
- transformation_config_version # nullable; required cho derived/degraded
- transformation_seed       # nullable; required khi transform stochastic/deterministic cần seed
- transformation_parameters # nullable; required cho derived/degraded
- quality_report_id         # nullable reference tới report đánh giá chính artifact này
```

## 6.1. RQ4 degraded telemetry rule

Degraded condition **không tạo ground truth mới và không thay đổi execution validity**. Nó là derived telemetry variant của cùng baseline run:

```text
same run_id
same immutable `RunGroundTruth`
same workload/fault interval
full artifact -> deterministic degradation transform -> degraded artifact
```

Khi `variant_kind=degraded`, bắt buộc có:

```text
source_artifact_id
transformation_type
transformation_config_version
transformation_seed
transformation_parameters
```

Ví dụ degradation hợp lệ:

```text
controlled trace dropping/sampling simulation
missing-modality transform
```

Không overwrite baseline artifact. Full/degraded pair phải giữ lineage để RQ4 làm strict paired comparison; mỗi artifact có `artifact_id`, `run_id` và `TelemetryQualityReport` riêng.

---

# 7. Coverage, missingness và data-quality schema

## 7.1. Nguyên tắc

Missingness được biểu diễn ở **artifact/quality report và feature flags**, không bằng cách tạo record giả có value `0`.

Các trạng thái semantic tối thiểu cần phân biệt:

```text
observed_zero
no_traffic
scrape_gap
sampled_or_dropped
source_unavailable
not_instrumented
filtered_by_degradation
unknown_missing
```

Signal ở catalogue mục 1.5 (pool PostgreSQL, tuổi message cũ nhất, metric publish/consume RabbitMQ ở runtime, độ trễ outbox, log xử lý command của worker) có trạng thái `not_instrumented`, khác với `scrape_gap` hay `no_traffic`. Series broker thiếu gauge là `source_unavailable`, không phải queue rỗng.

Raw artifact không cần tạo placeholder record cho mọi missing point. Quality report ghi segment/ratio; feature stage dùng flags như `missing_metrics`, `missing_traces`, `missing_logs` theo Analysis blueprint.

## 7.2. `TelemetryQualityReport`

```text
TelemetryQualityReport
- telemetry_quality_version
- quality_report_id
- run_id
- artifact_id
- artifact_manifest_version
- artifact_kind
- variant_kind
- generated_at
- overall_status            # pass | partial | fail
- reasons                   # array<string>
- expected_time_start
- expected_time_end
- observed_time_start
- observed_time_end
- phase_coverage
- identity_quality
- metrics_quality
- traces_quality
- logs_quality
- duplicate_quality
```

### `phase_coverage`

Phải kiểm tra artifact có bao phủ các phase mà manifest khai báo:

```text
warmup
healthy/pre-fault
fault
recovery
```

Mỗi phase giữ:

```text
expected_start
expected_end
observed_start
observed_end
coverage_ratio
missing_intervals
```

Exact threshold pass/fail thuộc T5/data-quality config, không hard-code trong schema.

### `identity_quality`

```text
total_records
missing_service_name_count
missing_service_version_count
missing_service_instance_id_count
unknown_service_name_count
unknown_dependency_identity_count
```

`missing_service_version`/`instance_id` có thể non-blocking với một số exporter; `missing_service_name` hoặc unknown business identity là lỗi nghiêm trọng với normalized service telemetry.

### `metrics_quality`

```text
required_signal_count
observed_required_signal_count
missing_required_signals
expected_scrape_interval_ms
observed_scrape_interval_summary
gap_count
max_gap_ms
coverage_ratio
invalid_value_count
```

`required_signal` được xác định theo scenario/protocol. Optional metric không được tính missing blocker chỉ vì schema biết field đó.

### `traces_quality`

```text
trace_count
span_count
missing_trace_id_count
missing_span_id_count
missing_parent_relation_count
workflow_attempt_count
workflow_trace_observed_count
workflow_trace_coverage_ratio
async_command_count
async_trace_correlated_count
async_message_id_fallback_correlated_count
async_unlinked_count
noise_trace_excluded_count
```

`workflow_trace_coverage_ratio` là coverage theo workload/workflow (W1–W7), không phải generic span count ratio. `noise_trace_excluded_count` đếm trace nhiễu bị loại khỏi mẫu số (trace `/ready` và trace thăm dò DB của `scheduler-worker`, catalogue mục 1.5) để chúng không làm sai coverage. Các luồng đã đo đủ service trong cùng trace nằm ở catalogue mục 1.2; luồng `scheduler → scheduler-worker` không kỳ vọng cùng trace và không tính vào `async_unlinked_count`.

### `logs_quality`

```text
log_count
request_or_message_context_log_count
trace_correlated_context_log_count
log_correlation_ratio
invalid_timestamp_count
```

Không yêu cầu mọi log có trace ID; denominator chỉ là log thuộc request/message context mà correlation được kỳ vọng. v0 có thêm `event_correlated_context_log_count`; v1 bỏ vì chưa có log nào mang `message_id` (mục 5.4). Nếu sau này log consumer mang `message_id`, field tương ứng được thêm lại và `telemetry-quality` tăng version.

Độ trễ thu thập khi đặt `expected_time_end` và kiểm coverage (đo 29/10/2026, catalogue mục 1.4): log vào Loki khoảng 2 giây, trace vào Tempo khoảng 2,5 giây, counter vào Prometheus khoảng 4–10 giây, backlog queue khoảng 9 giây. Cửa sổ ghép tín hiệu nên từ 15 giây trở lên; các con số này là đo trên testbed một node, chưa kiểm chứng ở cấu hình khác.

### `duplicate_quality`

```text
duplicate_metric_record_count
duplicate_span_id_count
duplicate_log_record_count
```

Duplicate definition phải dựa trên identity/timestamp/source phù hợp từng modality, không dedup bằng message text chung chung.

## 7.3. Tách execution validity khỏi telemetry quality

`TelemetryQualityReport` chỉ đánh giá **một artifact cụ thể** qua cặp `run_id` + `artifact_id`. `overall_status=pass | partial | fail` là trạng thái chất lượng/coverage của artifact đó, không phải mutation của `RunGroundTruth.run_status`.

- `pass`: artifact đạt data-quality gate được manifest/protocol áp dụng cho variant này.
- `partial`: artifact có thiếu hụt non-fatal; experiment/evaluation manifest T5 quyết định variant nào còn đủ điều kiện dùng.
- `fail`: artifact không đạt gate cho mục đích đã khai báo; artifact và quality report vẫn được giữ để audit hoặc rerun.

Ví dụ RQ4: baseline execution có thể giữ `run_status=valid`; artifact trace-drop derived có thể `overall_status=partial` hoặc `fail` theo quality rule mà không làm execution truth trở thành `invalid`. `run_status` chỉ thay đổi vì workload/fault/reset/verification hoặc execution infrastructure thực sự không hợp lệ.

Không âm thầm drop execution, artifact hoặc quality report khỏi ledger.

---

# 8. Ground-truth schema v1

`RunGroundTruth` là **immutable execution/control/fault truth** của một run, không phải telemetry feature stream và không phải experiment/evaluation manifest. Nó ghi những gì thực sự đã chạy; T5 có thể tạo nhiều analysis/evaluation variant cùng tham chiếu truth này mà không clone hoặc mutate record.

## 8.1. `RunGroundTruth`

```text
RunGroundTruth
- ground_truth_schema_version

# execution identity
- scenario_id
- run_id
- repeat_index
- run_status
- run_start
- run_end

# workload/execution
- workload_profile
- workload_seed
- workload_parameters
- workload_start
- workload_end

# fault truth
- fault_id
- fault_type
- fault_target
- fault_target_kind
- fault_intensity
- fault_parameters
- fault_start
- fault_end

# RCA truth and expected propagation
- root_cause_service
- root_cause_component
- expected_symptom
- expected_propagation_path
- expected_evidence
- expected_symptom_services   # tùy chọn; fault có triệu chứng ở service khác root cause (mục 9.1)
- expected_symptom_lag        # tùy chọn; độ trễ kỳ vọng tính từ cấu hình (mục 9.1)

# control-plane result
- activation_result
- activation_details
- deactivation_result
- deactivation_details
- reset_start
- reset_end
- reset_result
- verification_result
- verification_checks

# code/environment provenance needed to reproduce this execution
- code_commit
- service_versions
- environment_profile
- environment_config_version

# operational notes
- invalid_reasons
- notes
```

`RunGroundTruth` không chứa artifact pointer, telemetry schema version, split, feature configuration/output, detector/RCA configuration/output, evaluation configuration/output hoặc modality/full-degraded selection. Các concern này thuộc experiment/evaluation manifest của T5, manifest đó tham chiếu `run_id` và các `artifact_id` bất biến.

## 8.2. Field semantics và requiredness

### Execution identity

| Field | Required | Rule |
| --- | :---: | --- |
| `ground_truth_schema_version` | ✓ | `ground-truth.v1` |
| `scenario_id` | ✓ | Scenario execution identity; FA–FH hoặc healthy scenario |
| `run_id` | ✓ | Unique immutable identity cho một execution |
| `repeat_index` | ✓ | Repetition index trong cùng scenario/workload configuration |
| `run_status` | ✓ | `valid | invalid | failed`; chỉ phản ánh execution validity |
| `run_start`, `run_end` | ✓ | UTC actual execution boundary |

`run_id` không tái sử dụng cho rerun. Một rerun là run mới, có thể tham chiếu run cũ qua `notes`/runner ledger nếu cần. Campaign identity, split và evaluation variant không thuộc truth record này.

### Workload

| Field | Required | Rule |
| --- | :---: | --- |
| `workload_profile` | ✓ | Versioned profile name/config reference cần để tái lập execution |
| `workload_seed` | ✓ | Seed để tái lập data/order khi workload hỗ trợ |
| `workload_parameters` | ✓ | Object chứa rate/stage/duration/data-set ref cần tái lập |
| `workload_start`, `workload_end` | ✓ | UTC actual traffic interval |

Healthy run có các field workload giống fault run để matched comparison không lệch execution provenance.

### Fault truth

| Field | Fault run | Healthy run | Rule |
| --- | :---: | :---: | --- |
| `fault_id` | ✓ | null | `FA...FH` theo [fault matrix v2](data-ownership-and-fault-matrix-v2.md) |
| `fault_type` | ✓ | `none` | Category semantic, không phải detector output |
| `fault_target` | ✓ | null | Target canonical, ví dụ `media-minio` (bảng ở mục 9) |
| `fault_target_kind` | ✓ | null | `service | dependency | resource | consumer | config` |
| `fault_intensity` | ✓ | null | Compact configured intensity representation |
| `fault_parameters` | ✓ | `{}` | Full structured config cần tái lập |
| `fault_start`, `fault_end` | ✓ | null | **Actual** successful active interval từ control plane |

`fault_start` không được suy ra từ first anomaly. Nếu activation thất bại thì không giả lập `fault_start`; execution phải `invalid` hoặc `failed` theo runner semantics.

### RCA truth and expected propagation

| Field | Fault run | Healthy run | Rule |
| --- | :---: | :---: | --- |
| `root_cause_service` | ✓ | null | Primary service-level label |
| `root_cause_component` | ✓ | null | Evidence label; không trộn vào primary candidate list |
| `expected_symptom` | ✓ | healthy expectation | Human-readable summary ngắn |
| `expected_propagation_path` | ✓ | expected healthy path | Ordered service/edge/dependency expectation để audit propagation, không phải model input |
| `expected_evidence` | ✓ | expected healthy evidence | Structured expectation để verification/evidence audit, không phải model input |
| `expected_symptom_services` | tùy chọn | null | Chỉ cho fault tầng xác thực (FG/FH); xem mục 9.1; không phải model input |
| `expected_symptom_lag` | tùy chọn | null | Chỉ cho fault tầng xác thực (FG/FH); tính từ cấu hình, không từ quan sát; xem mục 9.1 |

`expected_evidence` item logical schema:

```text
- entity_type          # service | edge | dependency | resource | queue
- entity_id
- modality             # metrics | traces | logs | control
- signal
- expectation
- required             # true | false
```

Các expectation này dùng execution verification/evidence auditing, **không được join vào feature vector**.

### Activation/deactivation/reset

Result enum:

```text
succeeded
failed
partial
not_applicable
```

`verification_checks` item:

```text
- check_name
- entity_id
- result               # pass | fail
- observed_value       # nullable
- expected_condition
- checked_at
```

Exact baseline tolerance/check duration được version hóa ở experiment/evaluation manifest T5; truth record chỉ lưu actual result và observed evidence cần tái lập audit.

### Execution provenance

`service_versions` là map canonical:

```text
{
  "gateway": "...",
  "identity": "...",
  "course": "...",
  "media": "...",
  "media-worker": "...",
  "notification": "...",
  "notification-worker": "...",
  "scheduler": "...",
  "scheduler-worker": "...",
  "ai": "...",
  "ai-worker": "..."
}
```

`code_commit`, service/environment version là provenance của execution. Version/config của feature, detector, RCA, split, evaluation hoặc artifact transform không thuộc `RunGroundTruth`.

## 8.3. `run_status` semantics

```text
valid
  workload và fault/control/reset/verification của execution hoàn tất hợp lệ

invalid
  execution hoàn tất nhưng activation, deactivation, reset, verification hoặc execution ground truth bị vi phạm;
  không dùng làm primary execution sample

failed
  runner, workload hoặc infrastructure không hoàn tất run đủ để tạo execution truth hợp lệ
```

Telemetry coverage/quality của raw, normalized hoặc degraded artifact không đổi `run_status`. Quality của từng artifact được ghi riêng bằng `TelemetryQualityReport`; execution valid vẫn có thể có artifact quality `partial`/`fail` cho một variant.

## 8.4. Immutability và reuse

Một `RunGroundTruth` được freeze theo `run_id` sau khi execution ledger đóng. RQ1 có thể reuse nó cho M, M+T và M+T+L; RQ2 có thể reuse cho severity-only và graph-aware; RQ4 có thể reuse cho full/degraded artifact cùng run. Mọi selection artifact, split, feature/detector/RCA/evaluation config và output được owned bởi experiment/evaluation manifest T5, không được ghi ngược vào truth record.

Không xóa execution, artifact hoặc quality report của run `invalid`/`failed`; giữ ledger để audit và tránh survivorship bias.

---

# 9. Ground truth canonical cho FA–FH

Nguồn: ma trận fault FA–FH ở [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) mục 5 và [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 3 (C1–C7, chốt ground truth theo `RunGroundTruth`). Cột `fault_type`, `root_cause_service`, `root_cause_component` lấy từ catalogue; cột `fault_target` và `fault_target_kind` là cách ghi **do tài liệu này đề xuất** (catalogue mô tả kịch bản gây lỗi nhưng chưa đặt tên target canonical cho injector, vì injector thuộc mảng AI).

| Fault | Case | `fault_type` | `fault_target` | `fault_target_kind` | `root_cause_service` | `root_cause_component` | Ground-truth parameter tối thiểu | Trạng thái kiểm chứng (catalogue) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **FA** Chậm/ngắt MinIO | C4 | `dependency_latency` | `media-minio` | `dependency` | `media` | `media-minio` | kiểu tác động (chèn trễ hoặc ngắt kết nối), delay, phạm vi operation (upload/promote), interval | Đã đo tín hiệu; cơ chế chèn trễ chưa chạy |
| **FB** Backlog hàng đợi | C1 | `queue_backlog` | `notification-worker` | `consumer` | `notification-worker` | `notification-worker-rabbitmq` | cỡ batch (seed R-10: 100000 recipient), cách làm chậm worker (giới hạn CPU hoặc `docker pause` theo chu kỳ), interval | Đã đo tín hiệu; chuỗi lan sang `media-worker` là giả thuyết |
| **FC** Giữ kết nối DB | C2 | `db_connection_hold` | `course` | `service` | `course` | `course-postgres` | số và kích thước export CSV đồng thời, mức tải học chạy song song, interval | Đã đo tín hiệu; metric pool chưa có |
| **FD** Provider AI chậm | C3 | `dependency_latency` | `ai-llm-provider` | `dependency` | `ai` | `ai-llm-provider` | delay hoặc tỷ lệ lỗi ngắt quãng của stub LLM, interval | Đã đo tín hiệu; stub chậm chưa chạy |
| **FE** Identity chậm | C5 | `dependency_latency` | `identity-postgres` | `dependency` | `identity` | `identity-postgres` | delay chèn vào truy vấn snapshot recipient, interval | Đã đo tín hiệu; chèn trễ chưa chạy |
| **FF** Quá tải tài nguyên | không có case riêng | `resource_pressure` (đề xuất) | `<service>-instance` | `resource` | một service bất kỳ, ghi đúng một giá trị mỗi run | `<service>-instance` | tài nguyên (CPU hoặc bộ nhớ), giới hạn container, interval | CPU/RSS có thật, dùng làm bằng chứng phụ cho C1–C2 |
| **FG** Độ trễ/ngắt xác thực | C6 | `dependency_unavailable` | `identity` | `service` | `identity` | `identity` | kiểu tác động (`pause`/dừng), `IDENTITY_SERVICE_TOKEN_TTL_SECONDS`, TTL cache JWKS, interval | **Đã chạy** bởi `tracing-smoke` |
| **FH** Lệch khóa ký | C7 | `config_drift` | `identity-signing-key` | `config` | `identity` | `identity-jwks` | thay `IDENTITY_SIGNING_KEY_PEM`, có giữ khóa cũ (`IDENTITY_PREVIOUS_PUBLIC_KEY_PEM`) hay không, TTL cache JWKS, interval | Đã đo tín hiệu; cơ chế đổi khóa chưa chạy |

Ghi chú:

- `fault_type` của FF không có trong catalogue (không có case riêng); `resource_pressure` là giá trị đề xuất thay `cpu_pressure` của v0 vì ma trận v2 mục 5 ghi cả CPU lẫn bộ nhớ. Chưa kiểm chứng.
- FA: ma trận ghi root-cause `media` / `media-worker`, catalogue C4 chốt `media`. Mỗi run chỉ ghi một `root_cause_service`; nếu sau này có run nhắm riêng process `media-worker`, quy tắc chọn giá trị chưa được catalogue nêu.
- FD: chủ sở hữu root cause là `ai`; process chạm provider là `ai-worker` (catalogue C3). Evidence nằm ở span/metric của cả `ai` và `ai-worker`.
- FG: ma trận ghi component `identity` / `identity-postgres`; catalogue chỉ chốt `identity` và chỉ có kịch bản `docker pause`/dừng (`dependency_unavailable`). Biến thể chèn trễ (`dependency_latency`) và component `identity-postgres` chưa có kịch bản, chưa kiểm chứng (mục 17.1).
- FH: `identity-jwks` là nhãn component gom các identity `<caller>-identity-jwks` của mọi runtime verify token, không phải một `dependency_identity` đơn lẻ.
- `fault_target_kind` thêm giá trị `config` cho `config_drift` (v0 chỉ có `service | dependency | resource | consumer`).

Exact numeric intensity được pilot/freeze ngoài schema; sau freeze nó phải xuất hiện trong `fault_intensity`/`fault_parameters` và versioned experiment config.

Mỗi FA–FH dùng cùng `RunGroundTruth` shape: fault identity/target/kind, service-level root cause, component evidence, actual injection interval/parameters, workload identity, expected symptom/propagation, verification/reset và execution provenance. Không có field special-case chỉ dành cho một fault; khác biệt scenario nằm trong `fault_parameters`, `expected_propagation_path`, `expected_evidence` và hai field tùy chọn cho fault có triệu chứng trễ (mục 9.1).

## 9.1. Fault ở tầng xác thực (FG, FH): root cause cách xa triệu chứng và có độ trễ

FG và FH khác các fault còn lại ở ba điểm, và ground truth phải ghi được cả ba (ADR-004, catalogue C6/C7):

1. **Triệu chứng không nằm ở service gốc.** Với FG, triệu chứng nằm ở cạnh `<service>-identity-token` của bên gọi (đầu tiên là `gateway-identity-token`), kéo theo mọi route qua gateway lỗi 504 dù `course`, `media` khỏe; request không tới service đích. Với FH, nhiều service cùng trả 401 dù hạ tầng khỏe. `root_cause_service=identity` không xuất hiện ở span lỗi của service bị ảnh hưởng (catalogue mục 2, quy ước 3).
2. **Có khoảng yên lặng.** Token đã cache còn dùng đến khi hết hạn (stale-while-error), JWKS đã cache còn dùng đến khi hết hạn hoặc gặp `kid` lạ. Do đó `fault_start` (lúc dừng `identity`/đổi khóa) và thời điểm triệu chứng đầu tiên cách nhau. Đo ở `tracing-smoke` (catalogue C6): login lỗi ngay, request dùng token người dùng còn hạn vẫn thành công, lỗi `gateway-identity-token` xuất hiện sau 70–74 giây khi TTL đặt 60 giây (mặc định 600 giây). Số 70–74 giây là một lần đo, không phải giá trị freeze.
3. **Phạm vi triệu chứng rộng.** Nhiều service/worker lỗi cùng lúc khi token hoặc cache JWKS của chúng hết hạn; thời điểm lỗi của mỗi bên phụ thuộc thời điểm token của nó được cấp lần cuối.

Vì vậy với fault tầng xác thực, `RunGroundTruth` bổ sung (tùy chọn, null với fault có triệu chứng ngay):

| Field | Required | Rule |
| --- | :---: | --- |
| `expected_symptom_services` | tùy chọn | Mảng `service_name` nơi triệu chứng đầu tiên được kỳ vọng. FG: `gateway` (và `<worker>` khi token của worker hết hạn); FH: các service verify token. Không chứa `root_cause_service`. Chỉ phục vụ audit, không phải model input |
| `expected_symptom_lag` | tùy chọn | Object `{ min_seconds, max_seconds, basis }` mô tả độ trễ kỳ vọng từ `fault_start` đến triệu chứng đầu tiên, tính **từ cấu hình** (`basis` trỏ tới `IDENTITY_SERVICE_TOKEN_TTL_SECONDS` hoặc TTL cache JWKS đã version hóa), không tính từ quan sát. Giá trị số thuộc pilot/protocol |

Quy tắc đi kèm:

- `fault_parameters` của FG/FH ghi `IDENTITY_SERVICE_TOKEN_TTL_SECONDS` (mặc định 600, test rút còn 60), TTL cache JWKS (mặc định 5 phút), kiểu tác động; FH ghi thêm việc có giữ khóa cũ hay không. Cấu hình này là provenance của execution, bị cấm làm feature (mục 12).
- Interval `fault_start`–`fault_end` phải đủ dài hơn `expected_symptom_lag.max_seconds` cộng độ trễ thu thập (mục 7.2) thì mới có triệu chứng để đánh giá. `verification_checks` nên có một check kiểu `symptom_observed_within_lag_window`; nếu fault đã kích hoạt thành công mà triệu chứng không xuất hiện trong cửa sổ, run không được tính là mẫu RCA hợp lệ của fault đó (`run_status=invalid` theo protocol), thay vì bị gán nhầm thành "fault không tác dụng".
- Đánh giá detection onset/lag không được lấy `fault_start` làm mốc triệu chứng; `fault_start` chỉ dùng cho evaluation/overlay (mục 11.3).
- Tập `expected_evidence` của FG/FH dùng `entity_type=dependency` với `entity_id=<caller>-identity-token` hoặc `<caller>-identity-jwks`, không dùng `entity_id=identity` cho signal nằm ở service khác.

---

# 10. Fault-to-telemetry evidence requirement

Mỗi mục dưới đây là **evidence floor** của một fault, tức bằng chứng tối thiểu mà `expected_evidence` của run được phép kỳ vọng. Mọi tín hiệu được liệt kê đều có thật theo catalogue mục 1; tín hiệu matrix v2 mục 5 hoặc contract v2 mục 8 nhắc nhưng catalogue mục 1.5 ghi **chưa có** được đưa riêng vào dòng "Chưa có" và không được đặt `required=true`. Mỗi run phải ghi `modality_availability` của artifact để RQ1 biết modality nào thiếu.

Quy ước đọc áp dụng cho mọi fault (catalogue mục 2): span PRODUCER thuộc process relay; queue thuộc worker tiêu thụ; metric `lms_dependency_*` của cạnh HTTP do bên gọi ghi.

## 10.1. FA — MinIO chậm/ngắt (C4)

```text
dependency evidence:
  lms_dependency_*{dependency_identity="media-minio"}  # service_name = media và media-worker
trace:
  span CLIENT `media-minio *` chậm hoặc lỗi
  luồng "Upload media": gateway -> media -> media-worker (CONSUMER media-worker--generate-media-thumbnail-v1)
  luồng "Dọn media theo lịch": CLIENT `scheduler-worker-media POST`, CLIENT `media-minio remove-object`
    bất thường về số lượng
service metrics:
  http_server_request_duration_seconds của route upload-complete (media), latency gateway-media
ground truth:
  FA interval + kiểu tác động/delay + media/media-minio
```

Chưa có: nối `scheduler` → `scheduler-worker` bằng trace (không cùng trace, mục 1.5 catalogue), nên chuỗi "media kẹt PENDING → usage trống → scheduler-worker xóa" không thể dựng bằng một trace. Log xử lý command của `media-worker` chưa có.

## 10.2. FB — Backlog hàng đợi (C1)

```text
queue evidence (nguồn: broker):
  rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"} tăng
  rabbitmq_detailed_queue_consumers giảm hoặc không đổi
  command sai vào queue `.error`
trace:
  span CLIENT `notification-smtp smtp.send` dài
  CONSUMER của media-worker bắt đầu muộn so với PRODUCER cùng trace
resource (bằng chứng phụ):
  process_cpu_time_seconds_total, process_memory_usage_bytes của notification-worker
ground truth:
  FB interval + cỡ batch + cách làm chậm worker + notification-worker/notification-worker-rabbitmq
```

Schema phải cho phép tình huống: `upload-complete` của `media` chậm hoặc timeout ở `gateway-media`, thumbnail `PENDING` lâu, `media-worker` không lỗi, nguyên nhân ở `notification-worker`. Backlog ở queue `media-worker--*` mô tả `media-worker`, kể cả khi nguyên nhân là nơi khác (quy ước đọc 2), nên RCA không được gán symptom ở broker/consumer thành root cause sai.

Chưa có: tuổi message cũ nhất (chỉ theo độ sâu; suy từ span), `consumer_processing_duration` dạng metric, độ trễ outbox, log xử lý command của worker. Chuỗi lan từ `notification-worker` sang `media-worker` là **giả thuyết** (mỗi worker có queue riêng; chỉ xảy ra khi broker hoặc PostgreSQL dùng chung bị tranh chấp), cần chạy thật trước khi đặt `expected_propagation_path` dài hơn `notification-worker` → `notification-worker-rabbitmq`.

## 10.3. FC — Giữ kết nối DB (C2)

```text
dependency evidence:
  lms_dependency_duration_seconds{dependency_identity="course-postgres"} tăng đồng loạt theo mọi operation_name
service metrics:
  http_server_request_duration_seconds của course (route nhiều operation), latency gateway-course
resource (bằng chứng phụ):
  process_cpu_time_seconds_total hoặc process_memory_usage_bytes của course
trace:
  mọi span chậm thuộc course, không có span lỗi
ground truth:
  FC interval + tải export/học song song + course/course-postgres
```

Chưa có: độ sử dụng pool kết nối PostgreSQL và thời gian chờ pool. Hệ quả: không phân biệt được "pool cạn" với "DB chậm" (catalogue C2). Ma trận v2 mục 5 liệt kê pool utilization là tín hiệu quan sát, nhưng tín hiệu này chưa tồn tại nên không được đặt `required=true`.

## 10.4. FD — Provider AI chậm (C3)

```text
dependency evidence:
  span CLIENT `ai-llm-provider POST chat/completions` dài hoặc lỗi (service_name = ai-worker, ai)
  lms_dependency_duration_seconds{dependency_identity="ai-llm-provider"}
trace:
  luồng "Job AI soạn bài": gateway -> course -> ai -> ai-worker -> course
  CONSUMER ai-worker--run-ai-job-v1 kéo dài
  lỗi muộn ở cạnh ai-worker-course
ground truth:
  FD interval + delay/tỷ lệ lỗi của stub + ai/ai-llm-provider
```

Schema phải cho phép: triệu chứng ở hai service (job AI mãi `RUNNING` rồi `WORKER_INTERRUPTED`; tài liệu mãi `EXTRACTING`), nguyên nhân gián tiếp ở provider qua `ai-worker` giữ lease. Chưa có: telemetry riêng cho lease hết hạn hoặc job/tài liệu `FAILED` (trạng thái này ở DB `ai`), log xử lý command trong worker.

## 10.5. FE — Identity chậm khi snapshot (C5)

```text
dependency evidence:
  span CLIENT `notification-worker-identity GET /internal/v1/students` chậm
  span `identity-postgres student.list` chậm
  lms_dependency_duration_seconds{dependency_identity="notification-worker-identity"}
trace:
  luồng "Thông báo hàng loạt": notification-worker -> identity -> identity-postgres
ground truth:
  FE interval + delay truy vấn + identity/identity-postgres
```

Đặc điểm cần giữ: batch `PARTIAL_FAILED`, thiếu recipient, **log không có lỗi**; vì vậy không được đặt log lỗi làm required. Chưa có: telemetry cho số item lệch (dữ liệu nghiệp vụ).

## 10.6. FF — Quá tải tài nguyên

Không có case riêng. Evidence là `process_cpu_time_seconds_total` hoặc `process_memory_usage_bytes` của service bị tác động, kèm độ trễ/lỗi lan theo dependency. `event_loop_lag`, network và disk I/O chưa có nên không được dùng. Crash/restart ngoài dự kiến làm run không còn đúng FF canonical và phải invalid/failed theo protocol.

## 10.7. FG — Độ trễ/ngắt xác thực (C6)

```text
dependency evidence:
  span CLIENT lỗi `gateway-identity-token POST /internal/v1/auth/service-token`
  span `gateway-identity POST` ở span gốc của request lỗi
  lms_dependency_error_count_total{dependency_identity="gateway-identity-token"} tăng
  `<worker>-identity-token` của worker khi token của chúng hết hạn
trace:
  trace của request lỗi không có span của service đích
log:
  `dependency.failure` có span_id khớp span CLIENT lỗi
ground truth:
  FG interval + kiểu tác động + TTL + identity/identity ; expected_symptom_lag, expected_symptom_services (mục 9.1)
```

Trạng thái: đã chạy ở `tracing-smoke` (login 504 ngay; token người dùng còn hạn vẫn 200; lỗi `gateway-identity-token` sau 70–74 giây khi TTL 60 giây; phục hồi sau `unpause`). Chưa có trong catalogue mục 1: tín hiệu riêng cho trạng thái circuit breaker mở (ma trận v2 mục 5 có nhắc; chưa kiểm chứng ở code).

## 10.8. FH — Lệch khóa ký (C7)

```text
http evidence:
  http_server_request_count_total{http_status_class="4xx"} tăng đồng thời ở nhiều service
  access log `http.server.request` mức WARN với http_status_code=401 ở nhiều service
dependency evidence:
  span `<caller>-identity-jwks` có refetch
ground truth:
  FH interval + việc đổi/giữ khóa + TTL JWKS + identity/identity-jwks ; expected_symptom_lag, expected_symptom_services (mục 9.1)
```

Lưu ý khi đọc: mã lỗi `SERVICE_TOKEN_INVALID` nằm trong body phản hồi, không phải nhãn telemetry; metric chỉ phân biệt `http_status_class=4xx`, không phân biệt 401 với 404. Tín hiệu phân biệt được là `http_status_code=401` trong access log (Loki) xuất hiện đồng thời ở nhiều service. 4xx không vào `http_server_request_error_count_total`. Trạng thái: đã đo tín hiệu (cạnh `*-identity-jwks` có ở các runtime verify token); cơ chế đổi khóa chưa chạy.

---

# 11. Mapping sang Analysis feature schema

Analysis chỉ nhận observable telemetry artifact và tham chiếu `run_id` để join immutable truth khi cần evaluation. `ExperimentEvaluationManifest` của T5 sẽ chọn tập artifact, split, modality variant và analysis configuration; nó không thay đổi `RunGroundTruth` hay `TelemetryArtifactManifest` đã freeze.

## 11.1. `ServiceWindowFeature`

Telemetry v1 cung cấp trực tiếp/derive được:

```text
run_id
window_start/window_end
service_name
request_rate
error_rate
latency_p50/p95/p99
cpu_usage
memory_usage
trace_error_rate
downstream_latency_p95
log_error_rate
missing_metrics
missing_traces
missing_logs
```

Mapping:

| Feature family | Source |
| --- | --- |
| RED | MetricRecord service HTTP signals |
| Resource | MetricRecord resource/runtime signals |
| Trace service features | TraceSpan grouped by `service_name`/window |
| Log rate/template features | LogRecord grouped by `service_name`/window |
| Missing flags | TelemetryQualityReport + artifact/variant lineage |

## 11.2. `EdgeWindowFeature`

Derive từ `TraceSpan` relation + dependency identity:

```text
caller_service
callee_service / dependency_identity
call_count
error_ratio
timeout_ratio
duration_mean/p95/p99
first_degradation_time
missing_trace_ratio
```

Static topology chỉ dùng validation/enrichment; observed dynamic graph vẫn được build từ run/window telemetry.

## 11.3. Incident timeline

`TimelineEvent` có thể trỏ về:

```text
metric artifact + metric selector/time
trace_id/span_id
log artifact + record/template reference
message_id cho async fallback
```

Ground-truth `fault_start` chỉ dùng evaluation/overlay, không dùng để chọn first anomaly khi tính detection onset.

## 11.4. RCA evidence

Primary candidate identity:

```text
service_name
```

Component/dependency evidence:

```text
dependency_identity
root_cause_component  # ground-truth side only for evaluation
```

`root_cause_component` không được merge vào candidate list Top-K/MRR service-level.


## 11.5. Kết quả RCA (`RcaIncidentResult`)

Schema kết quả RCA và nơi lưu được chốt ở [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 5 (thuộc mảng AI, ADR-002); tài liệu này không chép lại. Ràng buộc nối với schema telemetry và ground truth ở đây:

- bằng chứng trong kết quả tham chiếu lại telemetry bằng `service_name` cùng `trace_id`/`span_id`, hoặc metric cùng nhãn và khoảng thời gian (catalogue mục 5.1), dùng đúng field logic ở mục 5;
- `candidate.service` dùng `service_name` canonical ở mục 3.1; `candidate.component` và `dependency_identity` dùng vocabulary ở mục 3.2;
- `run_id` trùng `RunGroundTruth.run_id`; `telemetry_quality` tham chiếu `TelemetryQualityReport` ở mục 7.2;
- `ground_truth` không nằm trong `RcaIncidentResult`; đánh giá offline đối chiếu theo `run_id` (mục 12);
- `mechanism` của kết quả dùng cùng tập `fault_type` ở mục 9 để so với truth.

---

# 12. Ground-truth leakage guard

**Ground-truth/control metadata MUST NOT be consumed as detection/RCA features unless một experiment oracle upper bound được thiết kế có chủ đích, version hóa và ghi rõ riêng trong experiment/evaluation manifest.** Observable evidence cho detector/RCA vẫn phải đến từ metrics, traces và logs thực tế.

Các field sau là **truth/control metadata** và bị cấm làm detector/RCA feature trực tiếp:

```text
fault_id
fault_type
fault_target
fault_target_kind
fault_intensity
fault_parameters
fault_start
fault_end
root_cause_service
root_cause_component
expected_symptom
expected_evidence
expected_symptom_services
expected_symptom_lag
activation_result
reset_result
verification_result
```

`run_id` được phép dùng để split, join artifact và provenance nhưng không dùng như predictive feature.

`scenario_id`, `repeat_index`, workload seed/config chỉ dùng split/provenance/evaluation stratification khi protocol cho phép; không làm signal dự đoán root cause.

Application telemetry chỉ phản ánh **hậu quả tự nhiên** của fault:

```text
latency
error
timeout
CPU
queue depth
consumer count
HTTP 401/5xx từ lỗi xác thực
span status
operational log
```

Không emit `fault_active=1`, `FA`, `root_cause=media` vào metric/log/span attribute dùng bởi model.

---

# 13. Instrument/export feasibility theo hiện trạng testbed v2

Bảng này ghi **hiện trạng đã đo và đã đối chiếu code**, không còn là capability expectation như v0. Nguồn: [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 1 (đo 30/10/2026 trên stack `docker-compose/compose.full.yaml`, 11 runtime, lặp lại bằng `pnpm run test:observability`) và code `lms/packages/observability/src`, `lms/packages/common/src`. Cột "Trạng thái" dùng ba giá trị: **Có** (đã đo/đã thấy ở code), **Chưa có** (catalogue mục 1.5 hoặc không có instrument trong code), **Có điều kiện**.

| Signal/field | Nguồn thực tế hiện có | Trạng thái | Ghi chú |
| --- | --- | :---: | --- |
| `service.name`, `service.version`, `service.instance.id` | `createTelemetryResource`; `defineTelemetryConfig` kiểm `service.name` thuộc 11 giá trị canonical | **Có** (11/11 runtime) | Series broker không có version/instance (nullable hợp lệ, mục 5.1) |
| UTC timestamp | log stdout `timestamp` ISO-8601 `...Z`; OTel | **Có** | Reject/quality-fail timestamp không timezone |
| HTTP server trace + RED metric | `createHttpTelemetryMiddleware`: `http_server_request_*`, span SERVER, access log | **Có** (11/11; worker chỉ có `/health`, `/ready`) | Route dùng template hoặc `unmatched`; method lạ thành `_OTHER` |
| W3C trace propagation HTTP | `W3CTraceContextPropagator`, `AlwaysOnSampler` (100% sampling) | **Có** | Contract v2 giữ nguyên |
| Command trace propagation | `traceparent` trong envelope + header AMQP; relay nối vào trace HTTP gây ra command | **Có** (9/9 luồng ở catalogue mục 1.2 đủ service trong cùng trace) | Đã sửa ở R-12 (catalogue mục 4.2) |
| `message_id` trong span/log | `messaging.message.id` trên span CONSUMER | **Có điều kiện** | Span PRODUCER không có; chưa log nào mang `message_id`; không dùng làm label |
| `command_name`, `queue` | tên span PRODUCER/CONSUMER, `messaging.destination.name` | **Có điều kiện** | `command_name` chưa là attribute riêng (mục 4.3) |
| Nối `scheduler` → `scheduler-worker` | không có | **Chưa có** | Hướng xử lý (thuộc mảng AI hoặc R sau): truyền `traceparent` qua bản ghi job |
| PostgreSQL, MinIO, SMTP, LLM provider dependency | `observeDependency`: span CLIENT và `lms_dependency_*`, 38 cặp (service, identity) | **Có** | Span MinIO có ở cả `media` và `media-worker` |
| HTTP edge và cạnh xác thực (`*-identity-token`, `*-identity-jwks`) | `observeDependency` ở caller; `peer.service` theo mapping | **Có** | Metric do bên gọi ghi |
| Queue depth, consumer count | broker `rabbitmq_detailed_queue_*`, Collector scrape 5 giây, 24 queue | **Có** | Hiện sau khoảng 9 giây; thiếu gauge là unavailable |
| Tuổi message cũ nhất, consumer lag theo thời gian | không có | **Chưa có** | Suy từ span (PRODUCER so với CONSUMER cùng trace) |
| Publish/consume RabbitMQ ở runtime dạng metric | không có `lms_dependency_*` cho `*-rabbitmq` | **Chưa có** | Chỉ có span; bọc bằng `observeDependency` cần đổi tên metric, cần ADR nhỏ |
| Độ trễ outbox (số command chưa phát) | không có | **Chưa có** | Metric đếm `outbox_messages` chưa phát |
| CPU, RSS | `process_cpu_time_seconds_total`, `process_memory_usage_bytes` | **Có** (11/11) | Một nguồn canonical, không cộng CPU container |
| Độ sử dụng pool PostgreSQL | không có | **Chưa có** | Thêm vào `lms/packages/common/src/prisma/` (catalogue mục 1.5) |
| event-loop lag, network, disk I/O | không có instrument | **Chưa có** | Không dùng làm signal; absence explicit |
| Structured logs + trace context | `emitStructuredLog`: access log `http.server.request`, `http.server.error`, `dependency.failure`; `trace_id`/`span_id` khớp span thật ở 11/11 runtime | **Có** | Loki chỉ index `service_name` |
| Log khi worker xử lý command | không có | **Chưa có** | Worker chỉ có access log `/ready`; lỗi xử lý chỉ thấy ở span và `dependency.failure` |
| `run_id` trên normalized records | experiment artifact manifest + ingestion | **Có** (theo thiết kế) | Không cần raw app emit, không là label |
| fault labels | control-plane manifest | **Có** ở ground truth | **Cấm** đưa vào feature telemetry |

## 13.1. Semantic-convention compatibility rule

`service.name`, `service.version`, `service.instance.id` là resource attribute ổn định. Với messaging/dependency attribute có thể thay đổi giữa instrumentation/semantic-convention version, ingestion normalize về field logic dưới đây, nên Analysis không phụ thuộc trực tiếp vào tên attribute của thư viện. Cột giữa là attribute **thực tế đang được code phát**:

| Field logic | Attribute/nhãn thực tế | Ghi chú |
| --- | --- | --- |
| `service_name` | resource `service.name`; nhãn Prometheus `service_name` | Metric broker: Collector gắn từ tiền tố queue |
| `dependency_identity` | attribute và nhãn `dependency_identity` | Cùng tên ở span, metric, log |
| `operation_name` | attribute và nhãn `operation_name` | `publish`/`consume` cho messaging |
| `peer_service` | span `peer.service` | Chỉ HTTP CLIENT, theo mapping cố định |
| `http_route` | span `http.route`; nhãn `http_route_template` | Template, không raw path |
| `http_method`, `http_status` | `http.request.method`, `http.response.status_code`; nhãn `http_method`, `http_status_class` | Metric chỉ có status class |
| `error_type` | span `error.type` (`timeout`, `unavailable`, status 5xx, `client_aborted`, `exception`); log `error_type` | Bounded |
| `message_id` | span CONSUMER `messaging.message.id`; envelope `message_id`; AMQP `messageId` | Không có ở PRODUCER và log |
| `command_name` | tên span PRODUCER; suy từ tên queue | Chưa là attribute riêng |
| `queue` | span `messaging.destination.name` (consumer); nhãn `queue` (metric broker) | Tên transport, chỉ diagnostic |
| `messaging_operation` | `messaging.operation.type` (`publish`, `process`) | |
| `transport_destination` | `messaging.destination.name`, `messaging.rabbitmq.destination.routing_key` | Diagnostic, không là business identity |

## 13.2. Ràng buộc khi export và đọc telemetry

- Backend retention 24 giờ và giới hạn RAM theo [observability README](../../../aiops-platform/observability/README.md); khi vượt, telemetry có thể mất dù request vẫn chạy. Mất này phải vào quality report (`scrape_gap`, `source_unavailable`), không bù bằng `0`.
- Tempo từng bị OOM-kill (giới hạn 512 MiB) khi truy vấn hàng nghìn trace song song (catalogue mục 4.2); ingestion không nên kéo trace hàng loạt từ Tempo của testbed, nên truy vấn tuần tự và giới hạn số trace.
- Trace nhiễu (thăm dò DB của `scheduler-worker`, `/ready`) phải lọc ở ingestion (mục 5.3).
- Runtime không tắt khi Collector không truy cập được; export chạy nền nên có thể mất dữ liệu khi buffer và retry hết.

---

# 14. Versioning và compatibility rules

## 14.1. Khi nào tăng `telemetry_schema_version`

Tăng version khi:

- đổi meaning/type của field;
- rename/remove field canonical;
- đổi requiredness làm artifact cũ không còn hợp lệ;
- đổi correlation semantics;
- đổi dependency/service identity vocabulary.

Không cần tăng schema version khi:

- thêm metric name vào registry mà representation không đổi và config/registry version đã ghi;
- thay Collector/exporter backend nhưng normalized logical fields giữ nguyên;
- thay histogram bucket/config nếu metric config/provenance đã version hóa.

## 14.2. Khi nào tăng `ground_truth_schema_version`

Tăng khi field manifest/semantics thay đổi không backward-compatible. Thay intensity/workload config của một scenario chỉ tăng experiment/scenario config version, không tự động tăng ground-truth schema.

## 14.3. Artifact immutability

- Một `artifact_id` đã dùng trong evaluation không được overwrite bằng nội dung khác.
- Derived/degraded artifact có ID mới và trỏ `source_artifact_id`.
- Nếu re-export vì bug normalization, tạo artifact/version mới và giữ lineage; không thay file cũ âm thầm.

## 14.4. Áp dụng ở v1

- `telemetry.v1`: đổi dependency/service identity vocabulary và đổi correlation semantics (từ `event_id` sang `message_id`/command envelope).
- `ground-truth.v1`: đổi fault vocabulary (FA–FH, `fault_type` mới, `fault_target_kind` thêm `config`) và thêm hai field tùy chọn `expected_symptom_services`, `expected_symptom_lag`.
- `telemetry-quality.v1`: đổi tên và bỏ field trong `traces_quality`, `logs_quality`.
- `telemetry-artifact.v0`: không đổi cấu trúc nên giữ.

---

# 15. Ranh giới trách nhiệm T4 và T5

## 15.1. T4 sở hữu

- Runtime telemetry schema và normalized metrics/traces/logs schema.
- Correlation fields, identity vocabulary và guard chống truth leakage.
- `TelemetryArtifactManifest`, artifact lineage, quality/coverage/missingness của từng artifact.
- Immutable `RunGroundTruth`, fault truth, execution validity, expected evidence/propagation và reset/verification.

## 15.2. T5 sẽ canonicalize

- Experiment/evaluation manifest, campaign identity và train/dev/test hoặc experiment split.
- Feature schema/config selection; detector và RCA algorithm configuration/version.
- Analysis variant M, M+T, M+T+L, severity-only, graph-aware, full/degraded.
- References tới selected telemetry artifact, feature artifact, detector/RCA output, prediction và evaluation output.
- Experiment-specific provenance cho các lựa chọn trên.

T5 chỉ tham chiếu `run_id`, `RunGroundTruth` và `artifact_id` bất biến; không có ownership overlap hoặc mutation ngược vào schema T4.

---

# 16. Example — FA và FG ground truth projection

Ví dụ minh họa semantics, **không freeze numeric intensity** và **không phải kết quả một lần chạy thật**: theo catalogue, FA mới ở mức "đã đo tín hiệu", cơ chế chèn trễ MinIO chưa chạy.

## 16.1. FA — MinIO chậm

```json
{
  "ground_truth_schema_version": "ground-truth.v1",
  "scenario_id": "FA",
  "run_id": "run-fa-r01",
  "repeat_index": 1,
  "run_status": "valid",
  "run_start": "2026-11-02T08:00:00Z",
  "run_end": "2026-11-02T08:08:00Z",

  "workload_profile": "media-upload-v1",
  "workload_seed": 101,
  "workload_parameters": {
    "config_ref": "experiment-config-version"
  },
  "workload_start": "2026-11-02T08:00:30Z",
  "workload_end": "2026-11-02T08:07:30Z",

  "fault_id": "FA",
  "fault_type": "dependency_latency",
  "fault_target": "media-minio",
  "fault_target_kind": "dependency",
  "fault_intensity": "configured-by-scenario",
  "fault_parameters": {
    "injection_mode": "delay",
    "operation_scope": "upload_and_promote",
    "injected_delay_ms": "FROM_VERSIONED_CONFIG"
  },
  "fault_start": "2026-11-02T08:03:00Z",
  "fault_end": "2026-11-02T08:05:00Z",

  "root_cause_service": "media",
  "root_cause_component": "media-minio",
  "expected_symptom": "Media PENDING kẹt, usage chưa gắn; scheduler-worker coi là không dùng và xóa; lỗi lộ muộn ở scheduler.",
  "expected_propagation_path": [
    "media-minio",
    "media",
    "media-worker",
    "scheduler-worker"
  ],
  "expected_evidence": [
    {
      "entity_type": "dependency",
      "entity_id": "media-minio",
      "modality": "traces",
      "signal": "dependency_duration_or_error",
      "expectation": "increase during fault interval",
      "required": true
    },
    {
      "entity_type": "dependency",
      "entity_id": "media-minio",
      "modality": "metrics",
      "signal": "lms_dependency_duration_seconds",
      "expectation": "increase during fault interval",
      "required": true
    },
    {
      "entity_type": "service",
      "entity_id": "media",
      "modality": "metrics",
      "signal": "latency_or_error",
      "expectation": "degrade during fault interval",
      "required": true
    }
  ],
  "expected_symptom_services": null,
  "expected_symptom_lag": null,

  "activation_result": "succeeded",
  "deactivation_result": "succeeded",
  "reset_result": "succeeded",
  "verification_result": "succeeded",

  "code_commit": "<git-sha>",
  "service_versions": {
    "gateway": "<version>",
    "identity": "<version>",
    "course": "<version>",
    "media": "<version>",
    "media-worker": "<version>",
    "notification": "<version>",
    "notification-worker": "<version>",
    "scheduler": "<version>",
    "scheduler-worker": "<version>",
    "ai": "<version>",
    "ai-worker": "<version>"
  },
  "environment_profile": "compose-full",
  "environment_config_version": "<version>",
  "invalid_reasons": [],
  "notes": null
}
```

## 16.2. FG — chỉ các field khác FA

```json
{
  "scenario_id": "FG",
  "fault_id": "FG",
  "fault_type": "dependency_unavailable",
  "fault_target": "identity",
  "fault_target_kind": "service",
  "fault_parameters": {
    "injection_mode": "pause",
    "identity_service_token_ttl_seconds": "FROM_VERSIONED_CONFIG",
    "jwks_cache_ttl_seconds": "FROM_VERSIONED_CONFIG"
  },

  "root_cause_service": "identity",
  "root_cause_component": "identity",
  "expected_symptom": "Sau khoảng yên lặng, token dịch vụ của gateway hết hạn và không làm mới được: mọi route qua gateway lỗi 504 dù service đích khỏe.",
  "expected_propagation_path": [
    "identity",
    "gateway-identity-token",
    "gateway"
  ],
  "expected_evidence": [
    {
      "entity_type": "dependency",
      "entity_id": "gateway-identity-token",
      "modality": "traces",
      "signal": "dependency_error",
      "expectation": "error spans after the quiet period",
      "required": true
    }
  ],
  "expected_symptom_services": ["gateway"],
  "expected_symptom_lag": {
    "min_seconds": "FROM_VERSIONED_CONFIG",
    "max_seconds": "FROM_VERSIONED_CONFIG",
    "basis": "IDENTITY_SERVICE_TOKEN_TTL_SECONDS"
  }
}
```

Timestamps ở ví dụ chỉ minh họa format/schema, không phải protocol duration canonical. `expected_propagation_path` của FG theo đường lan ở catalogue C6 (`identity` → `gateway-identity-token` → mọi upstream của gateway); FA theo catalogue C4 (MinIO → `media`/`media-worker` → usage trống → `scheduler-worker`).

---

# 17. Cross-check tương thích với fault matrix v2 và catalogue

T4 và fault matrix ([data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md)) cùng catalogue dùng chung compatibility contract sau:

```text
run identity:
  scenario_id / run_id / repeat_index

fault truth:
  fault_id / fault_type / fault_target / fault_target_kind
  fault_intensity / fault_parameters
  fault_start / fault_end
  root_cause_service / root_cause_component

control/reset:
  activation_result / deactivation_result
  reset_start / reset_end / reset_result
  verification_result / verification_checks

telemetry evidence:
  service_name / service_version / service_instance_id
  dependency_identity
  trace_id / span_id / parent_span_id
  message_id / command_name / messaging_operation / queue
  coverage/missingness through TelemetryQualityReport

artifact lineage:
  TelemetryArtifactManifest + immutable artifact_id + artifact-specific TelemetryQualityReport

result (không thuộc truth):
  RcaIncidentResult — xem mục 11.5
```

T4 không đổi tám fault category FA–FH, root-cause service/component mapping, topology, ownership hoặc reset semantics của fault matrix v2. Cross-check chỉ xác nhận mỗi FA–FH biểu diễn được bằng cùng vocabulary truth/evidence, không biến component/dependency thành primary RCA candidate.

## 17.1. Điểm lệch còn lại giữa các tài liệu v2 và cách tài liệu này xử lý

Catalogue (R-12, đo thực tế) mới hơn bản đề xuất ban đầu của ma trận fault v2 mục 5–7. Ma trận đã được cập nhật trong working tree để khớp catalogue ở component của FB (`notification-worker-rabbitmq`), triệu chứng FG (5xx, đo được 504) và danh sách FA–FH/C1–C7; tài liệu này theo bản đã cập nhật đó. Các chỗ còn lệch tại thời điểm viết:

| Chỗ lệch | Tài liệu v2 | Catalogue / code | Xử lý ở v1 |
| --- | --- | --- | --- |
| Component của FG | ma trận ghi `identity` / `identity-postgres` | catalogue chỉ chốt `identity` | Theo catalogue; `identity-postgres` chưa có kịch bản (mục 9) |
| Tín hiệu pool utilization (FC), tuổi message cũ nhất (FB), breaker mở (FG) | ma trận mục 5 liệt kê là tín hiệu quan sát | chưa có (catalogue mục 1.5) hoặc không có trong mục 1 | Không đặt `required=true` (mục 10) |
| Attribute `command_name`, attempt, metric retry count | contract v2 mục 8 yêu cầu | code chỉ phát một phần (mục 4.3) | Ingestion trích từ tên span/queue; phần chưa phát ghi "chưa có" |

---

# 18. Checkpoint — R-12

Khác với v0, các mục dưới đây không ghi "Đạt" chỉ dựa vào thiết kế: cột trạng thái phân biệt đã đối chiếu code/catalogue với chưa kiểm chứng. Đức xác nhận cuối cùng.

| Yêu cầu | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Identity (11 `service.name`, dependency identity), UTC time, trace/log/metric correlation, resource attributes và coverage/data-quality cho mỗi modality | Đề xuất; identity và resource đã đối chiếu code | Mục 3–7; `telemetry-config.ts`, `telemetry-resource.ts` |
| Ground truth có run ID, fault target/type, start/end, parameters, expected symptom, reset/verification metadata cho FA–FH | Đề xuất | Mục 8–10 |
| Fault tầng xác thực (FG/FH) biểu diễn được root cause cách xa triệu chứng và khoảng yên lặng | Đề xuất; FG đã chạy ở catalogue, FH mới đo tín hiệu | Mục 9.1, 10.7, 10.8, 16.2 |
| Schema map được tới service/edge feature và service-level RCA trong Analysis blueprint | Đề xuất; blueprint v1 đã tồn tại, chưa đối chiếu từng mục | Mục 11 |
| Missing telemetry explicit, không thay bằng `0` | Đề xuất; các signal chưa có đã liệt kê | Mục 5.2, 7, 13 |
| Async correlation bằng command envelope, `message_id` fallback | Đã đối chiếu code và catalogue (9/9 luồng cùng trace) | Mục 4.3, 5.3, 13 |
| Không leak truth label vào feature telemetry | Đề xuất | Mục 12 |
| Field/resource signal có đường instrument/export; signal chưa có được ghi rõ | Đã đối chiếu code và catalogue mục 1 | Mục 13 |
| Không phá topology/contract/fault semantics v2 | Đề xuất; điểm lệch còn lại ghi ở 17.1 | Mục 1–4, 17 |
| Chạy thật chuỗi nhân quả FA–FF, FH trước khi dùng làm case đánh giá | **Chưa làm** (thuộc mảng AI) | Catalogue mục 3, 6 |

## 18.1. RQ compatibility checklist

| Research question | Compatibility contract |
| --- | --- |
| RQ1 | Một `RunGroundTruth` immutable có thể được T5 reuse cho M, M+T và M+T+L; modality/feature selection nằm ngoài truth record. |
| RQ2 | Cùng telemetry artifact + ground truth pair có thể được severity-only và graph-aware RCA reuse; algorithm/config/output không mutate truth. |
| RQ3 | FA–FH có reproducible run/workload/fault truth, expected propagation/evidence và telemetry artifact lineage để so sánh detection/RCA. |
| RQ4 | Full và degraded giữ cùng `run_id` + `RunGroundTruth`; derived artifact trỏ `source_artifact_id`, lưu transform config/seed, có quality riêng và không đổi `run_status`. |

## 18.2. Những giá trị cố ý chưa freeze ở T4

Đây không phải thiếu schema; chúng thuộc T5/pilot/implementation config:

- exact scrape interval/data-quality thresholds (hiện Collector scrape broker 5 giây và SDK export 5 giây; đó là cấu hình testbed, chưa là ngưỡng chất lượng);
- exact workload rates/stages/durations;
- exact fault intensity/delay/CPU parameters;
- exact HTTP/dependency timeout milliseconds và số lần retry consumer (contract v2 mục 10 để mở);
- `IDENTITY_SERVICE_TOKEN_TTL_SECONDS`, TTL cache JWKS và `expected_symptom_lag` dùng trong các run FG/FH;
- exact experiment phase durations và reset baseline tolerance;
- exact metric histogram buckets (hiện 11 biên từ 0,005 đến 10 giây ở `service-metrics.ts`);
- exact instrumentation package/library version;
- exact feature window/threshold/detector/RCA config.

Mọi giá trị trên khi được chọn phải nằm trong versioned experiment/evaluation manifest hoặc execution configuration phù hợp; không cần sửa `RunGroundTruth` chỉ để thay một numeric config. Topology RabbitMQ (exchange `lms.commands`, queue `<worker>--<command>-v<n>`, `.error`) đã chốt ở contract v2 mục 6 nên không còn thuộc danh sách này như ở v0.

---

# 19. Xác nhận cần có

Đức tự xác nhận trước khi chuyển phần telemetry/ground-truth của R-12 sang hoàn thành (refactor do một mình Đức làm, không cần Bách review):

- [ ] Vocabulary identity ở mục 3 và ánh xạ metric ở mục 5.2 đúng với hệ thống đang chạy.
- [ ] Bảng ground truth FA–FH ở mục 9 (đặc biệt cột `fault_target`/`fault_target_kind` do tài liệu này đề xuất và `resource_pressure` cho FF).
- [ ] Hai field `expected_symptom_services`/`expected_symptom_lag` và quy tắc khoảng yên lặng ở mục 9.1.
- [ ] Cách xử lý các điểm lệch còn lại ở mục 17.1 (theo catalogue).

| Trường         | Giá trị   |
| -------------- | --------- |
| Người xác nhận | Đức       |
| Trạng thái     | `PENDING` |

---

# 20. Khác biệt so với v0

Chỉ liệt kê thay đổi thực chất; các phần logical schema (run identity, `MetricRecord`/`TraceSpan`/`LogRecord`, artifact manifest và lineage, quality report, `run_status`, immutability, leakage guard, versioning) giữ nguyên khung.

| Mục | v0 | v1 |
| --- | --- | --- |
| Topology | 6 business service + Gateway | 8 service + 4 worker, `service.name` canonical gồm cả worker |
| Dependency identity | 9 (`course-redis`, `submission-storage`, `grading-rabbitmq`, `notification-rabbitmq`…) | 16 identity hạ tầng + identity cạnh HTTP `<caller>-<callee>` + `<caller>-identity-token`/`<caller>-identity-jwks` (ADR-004); `<service>-rabbitmq` đổi nghĩa (mục 3.2.4) |
| Async correlation | event `grade.completed`, `event_id`, inject/extract header RabbitMQ | command envelope (`message_id`, `correlation.traceparent`), relay nối vào trace HTTP, `message_id` làm fallback, span PRODUCER/CONSUMER (mục 4.3) |
| Metric | vocabulary logic, tên metric chưa cố định, `redis_latency`, app metric `submission_*`/`notification_*` | ánh xạ sang metric thật (`http_server_request_*`, `lms_dependency_*`, `process_*`, `rabbitmq_detailed_queue_*`); bỏ Redis và app metric; liệt kê signal chưa có (mục 5.2) |
| Trace và log | `peer_service`, `event_id`, `event_name` | tên span thực tế, `message_id`/`command_name`/`queue`, bảng ánh xạ attribute (mục 13.1); log `http.server.request`, `http.server.error`, `dependency.failure` |
| Quality report | `async_event_*`, `event_correlated_context_log_count` | `async_command_*`, `async_message_id_fallback_*`, `noise_trace_excluded_count`; bỏ field log theo `event_id`; ghi độ trễ thu thập (mục 7.2) |
| Ground truth | F1–F5 | FA–FH theo fault matrix v2 và catalogue C1–C7; `fault_type` mới `queue_backlog`, `db_connection_hold`, `dependency_unavailable`, `config_drift`, `resource_pressure`; `fault_target_kind` thêm `config` (mục 9) |
| Fault tầng xác thực | không có | `expected_symptom_services`, `expected_symptom_lag` và quy tắc khoảng yên lặng cho FG/FH (mục 9.1) |
| Evidence requirement | F1–F5, ghi theo mong đợi | FA–FH theo tín hiệu có thật; tín hiệu chưa có ghi "Chưa có" và không đặt `required=true` (mục 10) |
| Feasibility | capability expectation | hiện trạng đã đo (mục 13) |
| Kết quả RCA | không có | link tới `RcaIncidentResult` ở catalogue mục 5, không chép lại (mục 11.5) |
| Schema version | `telemetry.v0`, `ground-truth.v0`, `telemetry-quality.v0`, `telemetry-artifact.v0` | `telemetry.v1`, `ground-truth.v1`, `telemetry-quality.v1`; `telemetry-artifact.v0` giữ (manifest không đổi cấu trúc) |
| Ví dụ | F2 (Storage) | FA (MinIO) và FG (identity) |
| Checkpoint | DoD W4-T4 "Đạt" | checkpoint R-12 phân biệt đã đối chiếu và chưa kiểm chứng |
