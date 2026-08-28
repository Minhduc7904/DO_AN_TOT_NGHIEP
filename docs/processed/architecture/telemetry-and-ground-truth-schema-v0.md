# Telemetry và ground-truth schema v0

> **Task:** `task-04_define-telemetry-and-ground-truth-schema`
>
> **Vị trí canonical dự kiến:** `docs/processed/architecture/telemetry-and-ground-truth-schema-v0.md`
>
> **Mục đích:** chốt logical schema v0 cho metrics, traces, structured logs, telemetry artifact/data quality và ground truth của controlled experiment. Schema phải đủ để tái lập run, tạo service/edge feature, dựng incident timeline, xếp hạng RCA service-level và đánh giá RQ1–RQ5 mà không làm thay đổi topology, HTTP/event contract hoặc fault semantics đã freeze.

---

# 1. Source of truth và ranh giới artifact

Artifact này phải nhất quán với các tài liệu đã chốt trước:

1. `service-catalogue-and-topology-v1.md` — service/dependency identity, workflow và edge catalogue.
2. `http-and-event-contracts-v1.md` — HTTP boundary, error semantics, W3C trace propagation và event `grade.completed`.
3. `backend_microservice_testbed_blueprint.md` — testbed, observability stack, experiment/fault boundary và provenance tối thiểu.
4. `analysis-anomaly-rca-blueprint.md` — telemetry contract, feature schema, dynamic graph, incident/RCA/evaluation.
5. `data-ownership-and-fault-matrix-v1.md` — **W4-T3 draft input**, ownership và fault semantics F1–F5.
6. `../direction/project-scope-v1.md` — MVP/Target/Stretch đã freeze.
7. `../direction/research-questions-and-metrics-v1.md` — RQ1–RQ5, split, ablation, robustness và provenance.

Khi implementation backend phát ra tên field/library-specific khác logical schema này, ingestion/normalization phải map về vocabulary ở đây; không tạo một schema cạnh tranh trong từng service.

## 1.1. Không thuộc W4-T4

- Không viết OpenTelemetry SDK bootstrap, Collector/Prometheus/Tempo/Loki config hoặc instrumentation code.
- Không freeze metric threshold, detector/window size, RCA weight hoặc evaluation tolerance.
- Không freeze workload rate/duration, fault intensity cụ thể hoặc timeout milliseconds; các giá trị đó thuộc pilot/T5/protocol rồi được version hóa.
- Không thay đổi topology 6 business service + Gateway.
- Không thay đổi HTTP/event business payload đã chốt ở task-02.
- Không thêm business service/dependency mới.
- Không biến component/dependency thành primary RCA candidate; primary RCA vẫn là **service-level**.
- Không yêu cầu mọi runtime signal tồn tại ở mọi service; signal không instrument được phải được biểu diễn là unavailable/missing theo schema, không giả bằng `0`.

---

# 2. Quyết định schema v0

## 2.1. Logical schema, không khóa storage engine

Schema v0 định nghĩa **field logic và semantics**. Representation vật lý có thể là JSON/JSONL, Parquet, Prometheus export, OTLP-derived artifact hoặc Pydantic model miễn là giữ semantics này.

Các schema identifier canonical:

```text
telemetry_schema_version      = telemetry.v0
ground_truth_schema_version   = ground-truth.v0
telemetry_quality_version     = telemetry-quality.v0
artifact_manifest_version     = telemetry-artifact.v0
```

Version là string để tránh nhầm giữa schema generation và version của package/runtime.

## 2.2. Invariant bắt buộc

1. Service identity ổn định dùng `service.name`; không dùng container/pod/process name thay thế.
2. Tất cả time ở boundary/artifact dùng UTC; serialized time dùng ISO-8601 có timezone, ưu tiên dạng `...Z`.
3. Raw telemetry và ground truth là hai plane khác nhau; truth label không được leak vào model feature.
4. `trace_id`/`span_id`/`event_id` dùng correlation/lookup, **không dùng làm Prometheus label**.
5. Missing telemetry khác với giá trị `0` và khác với `no traffic`.
6. Baseline controlled runs dùng 100% trace sampling theo blueprint; RQ4 degraded telemetry được tạo **từ baseline telemetry artifact**, không thay ground truth.
7. Mỗi run/artifact phải truy ngược được về code/config/workload/fault provenance.
8. Dependency identity dùng đúng vocabulary topology v1; không để từng service tự đặt alias riêng.
9. HTTP/RabbitMQ runtime correlation giữ contract task-02; schema này không thêm business payload field mới.
10. Exact OpenTelemetry/library attribute có thể thay đổi theo instrumentation version; ingestion normalize về logical field ở artifact này thay vì để Analysis phụ thuộc trực tiếp vào tên attribute chưa ổn định.

---

# 3. Identity vocabulary canonical

## 3.1. Service identity

```text
gateway
auth
course
enrollment
submission
grading
notification
```

Mỗi telemetry record thuộc service boundary phải truy được:

```text
service_name        <- resource `service.name`
service_version     <- resource `service.version`
service_instance_id <- resource `service.instance.id`
```

`service_instance_id` là identity instance runtime, **không** thay `service_name` trong RCA candidate set.

## 3.2. Dependency identity

```text
auth-postgres
course-postgres
course-redis
enrollment-postgres
submission-postgres
submission-storage
grading-postgres
grading-rabbitmq
notification-rabbitmq
```

Quy tắc:

- dependency signal phát sinh từ service/client boundary giữ `service_name` của service đang quan sát và thêm `dependency_identity` tương ứng;
- infrastructure metric chỉ có ở broker/exporter được ingestion enrich bằng ownership/topology mapping đã freeze; không đoán mapping từ hostname tùy ý;
- `submission-storage` là identity của external Storage Mock trong evidence, không thêm Storage Mock vào service-level candidate set;
- RabbitMQ publish evidence dùng `grading-rabbitmq`; consumer/backlog evidence phục vụ F4 dùng `notification-rabbitmq`.

---

# 4. Run identity và correlation strategy

## 4.1. Quyết định về `run_id`

`run_id` là **experiment identity**, không phải business identity và không phải root-cause label.

Schema v0 chốt:

- `run_id` **bắt buộc** trong ground-truth manifest, artifact manifest và mọi normalized telemetry row do Analysis ingestion tạo ra;
- `run_id` **không bắt buộc** phải tồn tại trong raw application metric/span/log;
- runner/export step gắn raw artifact với đúng `run_id`; ingestion kế thừa từ artifact provenance;
- implementation **không được thêm `run_id` vào HTTP/event business payload** chỉ để phục vụ Analysis;
- `run_id` **không được dùng làm Prometheus label** vì cardinality theo run;
- nếu sau này controlled environment chọn propagate experiment context qua W3C baggage/span/log attribute, đó là optimization/ADR và không thay thế artifact-level binding ở trên; field này vẫn bị cấm làm model feature nếu có nguy cơ leakage.

Cách này giữ nguyên HTTP/event contract task-02 và vẫn đảm bảo mỗi normalized record truy được về run.

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

Request ID riêng có thể tồn tại để debug nhưng không phải field bắt buộc của schema v0 và không thay trace identity.

## 4.3. RabbitMQ / `grade.completed` correlation

Primary async correlation giữ nguyên contract task-02:

1. Grading inject W3C trace context vào RabbitMQ headers/properties.
2. Notification extract context để nối publish/consume/process vào distributed trace khi telemetry đầy đủ.
3. `event_id` của `grade.completed` là fallback identity cho dedup/application correlation.
4. `event_id` + temporal relation được Analysis dùng fallback khi async trace bị missing/degraded; confidence phải thấp hơn trace-linked edge.
5. JSON envelope `correlation.traceparent/tracestate` là application-level traceability/fallback, không thay transport carrier.

Schema normalized cần giữ được:

```text
trace_id
span_id
parent_span_id
event_id
event_name = grade.completed
messaging_operation
service_name
dependency_identity
```

Không freeze exchange/queue name như identity nghiên cứu; tên transport có thể lưu làm optional diagnostic attribute.

---

# 5. Telemetry schema v0

## 5.1. Common normalized metadata

Mỗi normalized telemetry record dùng được cho Analysis phải có hoặc truy được các field chung sau:

| Field | Type | Required | Semantics |
| --- | --- | :---: | --- |
| `run_id` | string | ✓ | Experiment run identity, gắn tại artifact/ingestion boundary |
| `timestamp` | UTC datetime | ✓ | Thời điểm signal; ISO-8601 ở artifact boundary |
| `service_name` | string | ✓ | Service logical identity; với dependency-only exporter signal có thể được deterministic enrichment từ topology |
| `service_version` | string/null | ✓ | Version service; null chỉ khi source thật sự không thể cung cấp và quality report ghi rõ |
| `service_instance_id` | string/null | ✓ | Runtime instance; null hợp lệ với artifact/exporter không có instance-level identity |
| `schema_version` | string | ✓ | `telemetry.v0` cho normalized record |
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

Cho phép dimension có cardinality bounded và có ý nghĩa phân tích, ví dụ:

```text
http_method
http_route_template
http_status_class / status_code khi bounded
operation_name
dependency_identity
messaging_operation
```

Không dùng label:

```text
trace_id
span_id
event_id
request_id
principal_id
raw URL/path có ID động
run_id
fault_type
root_cause_service
```

### Metric vocabulary tối thiểu

Schema không bắt buộc mỗi signal đều là raw metric riêng; một số value có thể là query/aggregation-derived trước feature stage. Vocabulary Analysis phải biểu diễn được:

#### Service RED

```text
request_count
request_error_count
request_duration
request_rate
error_rate
latency_p50
latency_p95
latency_p99
```

#### Resource/runtime

```text
cpu_usage
memory_usage
network_rx
network_tx
disk_io
event_loop_lag
connection_pool_usage
```

Chỉ signal có instrumentation thực tế mới được dùng. `event_loop_lag`, `connection_pool_usage`, network/disk là optional capability; không được làm run invalid nếu scenario/protocol không đánh dấu chúng required.

#### Dependency

```text
client_request_rate
client_error_rate
client_latency
db_latency
db_error_rate
redis_latency
storage_latency
queue_depth
consumer_lag
consumer_processing_duration
```

#### App-specific tối thiểu khi có giá trị

```text
submission_success_total
submission_failure_total
submission_processing_duration
notification_processed_total
notification_failed_total
notification_processing_duration
```

App metric không được encode `fault_id`, `fault_active` hoặc root-cause truth.

### Histogram/percentile rule

- Nếu backend giữ histogram, raw/normalized artifact nên giữ bucket/count/sum đủ để tái aggregate khi khả thi.
- `latency_p50/p95/p99` có thể là query-derived metric hoặc feature; provenance phải cho biết aggregation source/config.
- Không coi một percentile thiếu là `0`.

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
- event_id                 # nullable, async fallback correlation
- event_name               # nullable
- messaging_operation      # nullable, publish/send/receive/process equivalent
- transport_destination    # nullable diagnostic field; không dùng làm business identity
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

### HTTP edge derivation

Dynamic service edge được derive từ client/server span relation, ví dụ:

```text
gateway -> submission
submission -> course
submission -> enrollment
grading -> submission
```

Static edge ID `e01...` của topology là validation/enrichment metadata, không bắt buộc phải được application emit vào span.

### Dependency span derivation

Ví dụ:

```text
service_name=submission
dependency_identity=submission-storage
```

biểu diễn outbound Storage dependency evidence mà không biến Storage Mock thành primary service candidate.

### Async edge derivation

`grading -> notification` được xây từ publish/consume/process context của `grade.completed`. Khi trace context thiếu, Analysis có thể fallback:

```text
event_id + event_name + temporal relation
```

và đánh dấu correlation confidence thấp hơn.

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
- event_id                 # nullable
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
- Log trong RabbitMQ message processing context phải giữ trace context khi available và nên giữ `event_id` để fallback/dedup evidence.
- Background/startup log không bắt buộc có trace ID.
- Không đưa password, token, secret hoặc PII không cần thiết vào artifact.
- `principal_id` nếu business operation buộc phải log vì debug thì phải được loại khỏi feature set; schema v0 không yêu cầu field đó.
- Không sinh log artificial kiểu `root_cause=submission` hoặc `F2 active` chỉ để làm RCA dễ hơn.

### Log feature preparation

Raw `message` không được đưa trực tiếp vào model MVP. Normalize thành template rồi aggregate theo service/window, ví dụ:

```text
"storage timeout after 5012 ms"
"storage timeout after 5028 ms"
-> "storage timeout after <*> ms"
```

---

# 6. Telemetry artifact manifest và lineage

Mỗi artifact export được đăng ký bằng `TelemetryArtifactManifest`:

```text
TelemetryArtifactManifest
- artifact_manifest_version
- artifact_id
- run_id
- modality                  # metrics | traces | logs | multimodal
- telemetry_schema_version
- variant_kind              # full | degraded
- source_artifact_id        # null cho full baseline; required cho degraded
- format                    # jsonl | parquet | prometheus-export | ...
- location                  # repo-relative path/URI do runner quản lý
- sha256                    # integrity/provenance khi artifact là file immutable
- generated_at
- time_start
- time_end
- record_count
- source_systems
- degradation_type          # nullable
- degradation_config_version# nullable
- degradation_seed          # nullable
- degradation_parameters    # nullable
```

## 6.1. RQ4 degraded telemetry rule

Degraded condition **không tạo một experiment ground truth mới**. Nó là derived telemetry variant của cùng baseline run:

```text
same run_id
same ground truth
same workload/fault interval
full artifact -> deterministic degradation transform -> degraded artifact
```

Khi `variant_kind=degraded`, bắt buộc có:

```text
source_artifact_id
degradation_type
degradation_config_version
degradation_seed
degradation_parameters
```

Ví dụ degradation hợp lệ:

```text
controlled trace dropping/sampling simulation
missing-modality transform
```

Không overwrite baseline artifact. Full/degraded pair phải giữ lineage để RQ4 làm strict paired comparison.

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

Raw artifact không cần tạo placeholder record cho mọi missing point. Quality report ghi segment/ratio; feature stage dùng flags như `missing_metrics`, `missing_traces`, `missing_logs` theo Analysis blueprint.

## 7.2. `TelemetryQualityReport`

```text
TelemetryQualityReport
- telemetry_quality_version
- run_id
- artifact_ids
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
async_event_count
async_trace_correlated_count
async_event_fallback_correlated_count
async_unlinked_count
```

`workflow_trace_coverage_ratio` là coverage theo workload/workflow, không phải generic span count ratio.

### `logs_quality`

```text
log_count
request_or_message_context_log_count
trace_correlated_context_log_count
event_correlated_context_log_count
log_correlation_ratio
invalid_timestamp_count
```

Không yêu cầu mọi log có trace ID; denominator chỉ là log thuộc request/message context mà correlation được kỳ vọng.

### `duplicate_quality`

```text
duplicate_metric_record_count
duplicate_span_id_count
duplicate_log_record_count
```

Duplicate definition phải dựa trên identity/timestamp/source phù hợp từng modality, không dedup bằng message text chung chung.

## 7.3. Run validity interaction

- `overall_status=pass`: telemetry đạt data-quality gate của protocol.
- `partial`: run hoàn tất nhưng một phần telemetry thiếu/không đạt non-fatal criterion; chỉ dùng evaluation nào protocol cho phép.
- `fail`: violation làm mất khả năng xác định run/fault/correlation chính; run phải thành `invalid` hoặc rerun cho primary evaluation.

Không âm thầm drop run khỏi ledger.

---

# 8. Ground-truth schema v0

Ground truth là **experiment/control-plane manifest**, không phải telemetry feature stream.

## 8.1. `RunGroundTruth`

```text
RunGroundTruth
- ground_truth_schema_version

# identity
- experiment_id
- scenario_id
- run_id
- repeat_index
- run_status
- run_start
- run_end

# workload
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

# RCA truth
- root_cause_service
- root_cause_component
- expected_symptom
- expected_evidence

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

# code/environment provenance
- code_commit
- service_versions
- environment_profile
- environment_config_version

# pipeline/config provenance
- telemetry_schema_version
- experiment_config_version
- feature_schema_version
- feature_config_version
- detector_config_version
- incident_config_version
- rca_config_version
- evaluation_config_version

# artifact lineage
- telemetry_artifact          # canonical ledger/manifest anchor compatible với ExperimentContext
- telemetry_artifacts         # optional per-modality/detail refs
- telemetry_quality_artifact
- feature_artifact
- detector_output_artifact
- incident_artifact
- rca_artifact
- prediction_artifact         # final prediction/RCA anchor khi pipeline đã chạy
- evaluation_artifact

# operational notes
- invalid_reasons
- notes
```

## 8.2. Field semantics và requiredness

### Identity/run

| Field | Required | Rule |
| --- | :---: | --- |
| `ground_truth_schema_version` | ✓ | `ground-truth.v0` |
| `experiment_id` | ✓ | Nhóm experiment/campaign logical |
| `scenario_id` | ✓ | Scenario config identity; F1–F5 hoặc healthy scenario |
| `run_id` | ✓ | Unique immutable identity cho một execution |
| `repeat_index` | ✓ | Repetition index trong cùng scenario/config |
| `run_status` | ✓ | `valid | partial | invalid | failed` |
| `run_start`, `run_end` | ✓ | UTC actual execution boundary |

`run_id` không tái sử dụng cho rerun. Một rerun là run mới, có thể tham chiếu run cũ qua `notes`/runner ledger nếu cần.

### Workload

| Field | Required | Rule |
| --- | :---: | --- |
| `workload_profile` | ✓ | Versioned profile name/config reference |
| `workload_seed` | ✓ | Seed để tái lập data/order khi workload hỗ trợ |
| `workload_parameters` | ✓ | Object chứa rate/stage/duration/data-set ref cần tái lập |
| `workload_start`, `workload_end` | ✓ | UTC actual traffic interval |

Healthy run có các field workload giống fault run để matched comparison không lệch provenance.

### Fault truth

| Field | Fault run | Healthy run | Rule |
| --- | :---: | :---: | --- |
| `fault_id` | ✓ | null | `F1...F5` theo matrix v1 |
| `fault_type` | ✓ | `none` | Category semantic, không phải detector output |
| `fault_target` | ✓ | null | Target canonical, ví dụ `submission-storage` |
| `fault_target_kind` | ✓ | null | `service | dependency | resource | consumer` |
| `fault_intensity` | ✓ | null | Compact configured intensity representation |
| `fault_parameters` | ✓ | `{}` | Full structured config cần tái lập |
| `fault_start`, `fault_end` | ✓ | null | **Actual** successful active interval từ control plane |

`fault_start` không được suy ra từ first anomaly. Nếu activation thất bại thì không giả lập `fault_start`; run phải invalid/failed theo runner semantics.

### RCA truth

| Field | Fault run | Healthy run | Rule |
| --- | :---: | :---: | --- |
| `root_cause_service` | ✓ | null | Primary service-level label |
| `root_cause_component` | ✓ | null | Evidence label; không trộn vào primary candidate list |
| `expected_symptom` | ✓ | healthy expectation | Human-readable summary ngắn |
| `expected_evidence` | ✓ | expected healthy evidence | Structured expectation để validation, không phải model input |

`expected_evidence` item logical schema:

```text
- entity_type          # service | edge | dependency | resource | queue
- entity_id
- modality             # metrics | traces | logs | control
- signal
- expectation
- required             # true | false
```

Các expectation này dùng experiment verification/evidence auditing, **không được join vào feature vector**.

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

Exact baseline tolerance/check duration được lấy từ versioned experiment/evaluation config; manifest chỉ lưu result + observed evidence cần tái lập audit.

### Provenance

Các version field theo từng stage là **độc lập**; không thay bằng một `config_version` chung.

`service_versions` là map canonical:

```text
{
  "gateway": "...",
  "auth": "...",
  "course": "...",
  "enrollment": "...",
  "submission": "...",
  "grading": "...",
  "notification": "..."
}
```

Nếu cùng commit/version dùng cho nhiều service vẫn lưu mapping rõ để artifact không phụ thuộc giả định monorepo mãi mãi.

## 8.3. `run_status` semantics

```text
valid
  run hoàn tất; fault/control/reset hợp lệ; telemetry quality đạt primary gate

partial
  run hoàn tất và ground truth hợp lệ nhưng telemetry thiếu một phần;
  chỉ dùng evaluation được protocol cho phép

invalid
  execution hoàn tất nhưng activation/reset/ground truth/data-quality gate bị vi phạm;
  không dùng primary final metric

failed
  runner/workload/system không hoàn tất run đủ để tạo experiment hợp lệ
```

Không xóa artifact của invalid/failed run; giữ ledger để audit và tránh survivorship bias.

---

# 9. Ground truth canonical cho F1–F5

| Fault | `fault_type` | `fault_target` | `fault_target_kind` | `root_cause_service` | `root_cause_component` | Ground-truth parameter tối thiểu |
| --- | --- | --- | --- | --- | --- | --- |
| **F1** Course/Redis latency | `dependency_latency` | `course-redis` | `dependency` | `course` | `course-redis` | operation scope, injected delay, activation interval |
| **F2** Submission/Storage latency | `dependency_latency` | `submission-storage` | `dependency` | `submission` | `submission-storage` | operation=`PUT`, injected delay, timeout config reference, interval |
| **F3** Submission service error | `service_error` | `submission-service` | `service` | `submission` | `submission-service` | hook/operation scope, configured error mode/rate nếu có, interval |
| **F4** Notification slowdown/backlog | `consumer_slowdown` | `notification-consumer` | `consumer` | `notification` | `notification-consumer` | processing delay, consumer config needed to reproduce, interval |
| **F5** Submission CPU pressure | `cpu_pressure` | `submission-instance` | `resource` | `submission` | `submission-instance` | injector mode, worker/duty-cycle/target CPU config, interval |

Exact numeric intensity được pilot/freeze ngoài schema; sau freeze nó phải xuất hiện trong `fault_intensity`/`fault_parameters` và versioned experiment config.

---

# 10. Fault-to-telemetry evidence requirement

## 10.1. F1 — Course / Redis latency

Required evidence floor:

```text
service metrics:
  course RED latency

dependency evidence:
  service_name=course
  dependency_identity=course-redis
  redis/client latency

trace:
  slow Course -> Redis dependency span
  caller path W2/W3/W4 khi workload tạo edge

logs:
  correlation-capable operational timeout/slow dependency log nếu implementation phát tự nhiên

ground truth:
  F1 interval + delay config + course/course-redis
```

Optional log không làm run invalid nếu metrics/traces đủ và scenario config không đánh dấu log signal required; nhưng modality availability vẫn phải được quality report ghi rõ cho RQ1.

## 10.2. F2 — Submission -> Storage latency

Required floor:

```text
submission RED latency/error
submission-storage dependency duration/timeout/error
submission -> storage trace span
Gateway affected latency/error evidence
structured timeout/error log ở Submission khi runtime sinh log hợp lý
fault delay + timeout provenance
```

Schema phải phân biệt:

```text
configured injected_delay
configured timeout
observed span duration
observed HTTP/dependency error
```

không dùng observed latency thay configured fault intensity.

## 10.3. F3 — Submission service error

Required floor:

```text
Submission request_error_count/error_rate
Submission server span status/error
Gateway affected status/error
structured application error log có trace correlation nếu request context
controlled hook config + actual interval
```

Downstream dependency span **có thể không xuất hiện** nếu hook canonical nằm trước irreversible side effect; absence này là expected path behavior, không tự động bị coi trace missing.

## 10.4. F4 — Notification consumer slowdown / RabbitMQ backlog

Required floor:

```text
queue_depth and/or consumer_lag/backlog evidence
Notification processing duration/throughput
Grading publish evidence
Notification consume/process span evidence
trace context across RabbitMQ when available
event_id for fallback correlation
fault processing delay + actual interval
```

F4 schema phải cho phép tình huống:

```text
Grading HTTP healthy
publish succeeds
queue/backlog grows
Notification processing degrades
```

để RCA không gán symptom broker/upstream thành service root cause sai.

## 10.5. F5 — Submission CPU pressure

Required floor:

```text
Submission cpu_usage
Submission RED latency/error
caller propagation at gateway and/or grading according to workload
slow Submission spans
injector config + actual interval
```

`event_loop_lag` là **recommended when instrumentable**, không phải required universal signal. Crash/restart ngoài dự kiến làm run không còn đúng F5 canonical và phải invalid/failed theo protocol.

---

# 11. Mapping sang Analysis feature schema

## 11.1. `ServiceWindowFeature`

Telemetry v0 cung cấp trực tiếp/derive được:

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
event_id cho async fallback
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

---

# 12. Ground-truth leakage guard

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
consumer lag
span status
operational log
```

Không emit `fault_active=1`, `F2`, `root_cause=submission` vào metric/log/span attribute dùng bởi model.

---

# 13. Instrument/export feasibility theo testbed hiện tại

Bảng này chốt **capability expectation**, không bắt implementation dùng một package cụ thể.

| Signal/field | Nguồn khả thi trong MVP | Required? | Fallback/ghi chú |
| --- | --- | :---: | --- |
| `service.name`, `service.version`, `service.instance.id` | OTel Resource/bootstrap của mỗi NestJS service | **Có** cho service telemetry | Exporter infrastructure thiếu instance/version được ghi quality missing; không giả giá trị |
| UTC timestamp | OTel/logging backend + artifact serializer | **Có** | Reject/quality-fail timestamp không timezone |
| HTTP server/client trace | OpenTelemetry HTTP/Nest/Node instrumentation | **Có** cho W1–W5 edges relevant | Route template được enrichment nếu auto instrumentation không có đủ |
| W3C trace propagation HTTP | OTel propagator | **Có** | Contract task-02 giữ nguyên |
| RabbitMQ trace propagation | Producer inject + consumer extract W3C context | **Có** cho baseline F4 | Khi trace degraded dùng `event_id` fallback và quality flag |
| `event_id` trong async spans/logs | Application event envelope đã có | **Có** cho F4 fallback | Không dùng Prom label |
| PostgreSQL/Redis dependency spans | DB/Redis client instrumentation | Có khi dependency được dùng trong scenario | `dependency_identity` có thể thêm bằng shared instrumentation/enrichment |
| Storage dependency span | Submission outbound HTTP instrumentation | **Có** cho F2 | Tag/enrich `submission-storage` |
| Service RED metrics | HTTP instrumentation/Prometheus metrics | **Có** cho evaluated service paths | p95/p99 có thể derive từ histogram/query |
| CPU/memory | process/runtime/container metrics | CPU **Có** cho F5; memory recommended | Chọn một nguồn canonical trong implementation config để tránh double count |
| event-loop lag | Node runtime/custom metric | Không universal | Recommended cho F5 nếu instrument ổn; absence explicit |
| queue depth/consumer lag | RabbitMQ Prometheus/management metrics hoặc equivalent exporter | **Có** cho F4 ít nhất một backlog signal | Ingestion map consumer-side evidence về `notification-rabbitmq` |
| Notification processing duration/throughput | consumer span/app metric | **Có** cho F4 | Không cần production notification provider |
| Structured logs + trace context | structured logger + OTel context bridge | **Có** ở request/message error paths | Không yêu cầu mọi background log có trace ID |
| `run_id` trên normalized records | experiment artifact manifest + ingestion | **Có** | Không cần raw app emit, không Prom label |
| fault labels | control-plane manifest | **Có** ở ground truth | **Cấm** đưa vào feature telemetry |

### 13.1. Semantic-convention compatibility rule

HTTP service resource identity dùng các OpenTelemetry field ổn định đã có trong blueprint (`service.name`, `service.version`, `service.instance.id`). Với messaging/dependency attribute có thể thay đổi giữa instrumentation/semantic-convention version, code ingestion phải normalize về:

```text
service_name
dependency_identity
event_id
event_name
messaging_operation
peer_service
```

Do đó Analysis không phụ thuộc trực tiếp vào một RabbitMQ attribute name/library version cụ thể.

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

---

# 15. Example — F2 ground truth projection

Ví dụ minh họa semantics, **không freeze numeric intensity**:

```json
{
  "ground_truth_schema_version": "ground-truth.v0",
  "experiment_id": "exp-w4-storage-latency",
  "scenario_id": "F2",
  "run_id": "run-f2-r01",
  "repeat_index": 1,
  "run_status": "valid",
  "run_start": "2026-08-28T08:00:00Z",
  "run_end": "2026-08-28T08:08:00Z",

  "workload_profile": "submission-peak-v1",
  "workload_seed": 101,
  "workload_parameters": {
    "config_ref": "experiment-config-version"
  },
  "workload_start": "2026-08-28T08:00:30Z",
  "workload_end": "2026-08-28T08:07:30Z",

  "fault_id": "F2",
  "fault_type": "dependency_latency",
  "fault_target": "submission-storage",
  "fault_target_kind": "dependency",
  "fault_intensity": "configured-by-scenario",
  "fault_parameters": {
    "operation": "PUT",
    "injected_delay_ms": "FROM_VERSIONED_CONFIG",
    "timeout_ms": "FROM_VERSIONED_CONFIG"
  },
  "fault_start": "2026-08-28T08:03:00Z",
  "fault_end": "2026-08-28T08:05:00Z",

  "root_cause_service": "submission",
  "root_cause_component": "submission-storage",
  "expected_symptom": "Storage latency/timeout degrades Submission and propagates to Gateway.",
  "expected_evidence": [
    {
      "entity_type": "dependency",
      "entity_id": "submission-storage",
      "modality": "traces",
      "signal": "dependency_duration_or_timeout",
      "expectation": "increase during fault interval",
      "required": true
    },
    {
      "entity_type": "service",
      "entity_id": "submission",
      "modality": "metrics",
      "signal": "latency_or_error",
      "expectation": "degrade during fault interval",
      "required": true
    }
  ],

  "activation_result": "succeeded",
  "deactivation_result": "succeeded",
  "reset_result": "succeeded",
  "verification_result": "succeeded",

  "code_commit": "<git-sha>",
  "service_versions": {
    "gateway": "<version>",
    "auth": "<version>",
    "course": "<version>",
    "enrollment": "<version>",
    "submission": "<version>",
    "grading": "<version>",
    "notification": "<version>"
  },
  "environment_profile": "compose-mvp",
  "environment_config_version": "<version>",
  "telemetry_schema_version": "telemetry.v0",
  "experiment_config_version": "<version>",
  "feature_schema_version": "<version>",
  "feature_config_version": "<version>",
  "detector_config_version": "<version>",
  "incident_config_version": "<version>",
  "rca_config_version": "<version>",
  "evaluation_config_version": "<version>",

  "telemetry_artifact": "<multimodal-or-ledger-artifact-id>",
  "telemetry_artifacts": ["<metrics-artifact-id>", "<traces-artifact-id>", "<logs-artifact-id>"],
  "telemetry_quality_artifact": "<artifact-id>",
  "feature_artifact": null,
  "detector_output_artifact": null,
  "incident_artifact": null,
  "rca_artifact": null,
  "prediction_artifact": null,
  "evaluation_artifact": null,
  "invalid_reasons": [],
  "notes": null
}
```

Timestamps ở ví dụ chỉ minh họa format/schema, không phải protocol duration canonical.

---

# 16. Handoff để finalize W4-T3

W4-T3 có thể quay lại finalization với các field/semantics đã canonicalize sau:

```text
run identity:
  experiment_id / scenario_id / run_id / repeat_index

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
  event_id / event_name / messaging_operation
  coverage/missingness through TelemetryQualityReport

artifact lineage:
  TelemetryArtifactManifest + immutable artifact_id
```

W4-T3 **không cần đổi** năm fault category, root-cause service/component mapping, topology, ownership hoặc reset semantics để phù hợp T4. Chỉ cần thay các tên ground-truth/evidence provisional bằng vocabulary/schema v0 này và rà từng F1–F5 có đủ required evidence.

---

# 17. DoD checkpoint — W4-T4

| Definition of Done | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Identity, UTC time, trace/log/metric correlation, resource attributes và coverage/data-quality cho mỗi modality | **Đạt** | Mục 3–7 |
| Ground truth có run ID, fault target/type, start/end, parameters, expected symptom, reset/verification metadata | **Đạt** | Mục 8–10 |
| Schema map được tới service/edge feature và service-level RCA trong Analysis blueprint | **Đạt** | Mục 11 |
| Missing telemetry explicit, không thay bằng `0` | **Đạt** | Mục 7 |
| Async F4 có trace context + `event_id` fallback | **Đạt** | Mục 4.3, 5.3, 10.4 |
| Không leak truth label vào feature telemetry | **Đạt** | Mục 12 |
| Field/resource signal có đường instrument/export khả thi; signal optional được ghi rõ | **Đạt ở mức kiến trúc/schema** | Mục 13 |
| Không phá topology/HTTP/event/fault semantics đã merge | **Đạt** | Mục 1–4, 16 |

## 17.1. Những giá trị cố ý chưa freeze ở T4

Đây không phải thiếu schema; chúng thuộc T5/pilot/implementation config:

- exact scrape interval/data-quality thresholds;
- exact workload rates/stages/durations;
- exact fault intensity/delay/CPU parameters;
- exact HTTP/dependency timeout milliseconds;
- exact experiment phase durations và reset baseline tolerance;
- exact RabbitMQ exchange/queue/retry/DLQ topology;
- exact metric histogram buckets;
- exact instrumentation package/library version;
- exact feature window/threshold/detector/RCA config.

Mọi giá trị trên khi được chọn phải nằm trong versioned config/provenance đã có field tham chiếu trong `RunGroundTruth`; không cần sửa schema chỉ để thay một numeric config.
