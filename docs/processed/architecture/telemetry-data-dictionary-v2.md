# Telemetry data dictionary v2 — artifact export và schema chuẩn hóa

> **Task:** `task-05_define-data-dictionary-and-quality-check` (tuần 13) — [card task](../plan/weekly/week-13_2026-10-25_to_2026-10-31/task-05_define-data-dictionary-and-quality-check.md)
>
> **Trạng thái:** v2, 17/11/2026, khớp code ở `aiops-platform/training/src/aiops_training/telemetry/` (`schema.py`, `adapters/`, `validation/quality.py`).
>
> **Quan hệ với tài liệu khác:** [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md) là **logical schema** (field nào phải có, ý nghĩa, invariant). Tài liệu này là **schema vật lý** của artifact export cho topology v2: tên cột, kiểu, đơn vị, nguồn gốc, giá trị hợp lệ, cách quy bản ghi về service và cạnh, và data-quality report. Khi hai tài liệu khác nhau ở tên cột, tài liệu này theo code; ý nghĩa logic vẫn theo v1. Định danh canonical: [service catalogue v2](service-catalogue-and-topology-v2.md), schema v1 mục 3.

## 0. Đọc nhanh

- Mỗi run export ra một thư mục `artifacts/<run_id>/` gồm ba bảng Parquet (`metrics`, `spans`, `logs`), một `manifest.json` và (sau khi kiểm) một `quality-report.json`.
- Mỗi dòng là **một quan sát thô**: một điểm của một series metric, một span, một dòng log. Chưa tính rate, percentile hay cửa sổ — đó là việc của feature pipeline (tuần 14).
- Mọi bảng có `run_id`, thời gian UTC, `service_name` (một trong 11 runtime), `source`, `schema_version = telemetry.v2`, `quality_flags`.
- Data-quality check trả `pass`/`partial`/`fail`, kèm trạng thái từng runtime theo từng modality và cờ `telemetry_silent` khi runtime ngừng hoạt động.
- **Bẫy lớn nhất:** khi một runtime ngừng (chết, bị pause), Prometheus **vẫn có mẫu** của nó thêm khoảng 5 phút với giá trị đứng yên. Muốn biết runtime còn sống phải xem bộ đếm có tăng không (mục 8.2).

---

## 1. Bố cục artifact

```text
artifacts/<run_id>/
├── metrics.parquet        # mục 3
├── spans.parquet          # mục 4
├── logs.parquet           # mục 5
├── manifest.json          # mục 6 (TelemetryArtifactManifest)
└── quality-report.json    # mục 8 (TelemetryQualityReport), do `aiops-training quality` ghi
```

Lệnh tạo: `uv run aiops-training export …` rồi `uv run aiops-training quality artifacts/<run_id>` (xem [README của training](../../../aiops-platform/training/README.md)). Parquet nén zstd. Artifact không commit vào Git.

## 2. Quy ước chung

| Quy ước | Nội dung |
| --- | --- |
| Thời gian | Kiểu `timestamp[ns, tz=UTC]`. Trong JSON (manifest, report) là ISO-8601 có hậu tố `Z` |
| `run_id` | Ký tự `[A-Za-z0-9._-]`, tối đa 128, bắt đầu bằng chữ hoặc số; gắn ở bước export, **không** có trong telemetry gốc (schema v1 mục 4.1) |
| `schema_version` | `telemetry.v2` cho mọi dòng |
| `source` | `prometheus`, `tempo` hoặc `loki` |
| `quality_flags` | Danh sách chuỗi; rỗng khi không có vấn đề. Giá trị hiện có: `invalid_value` (metric NaN/Inf), `missing_service_name`, `negative_duration` (span), `invalid_http_status`, `invalid_duration_ms` (log) |
| `attributes` | Chuỗi JSON (khóa sắp xếp) gồm các thuộc tính **không** có cột riêng; `null` khi không còn gì. Dùng để chẩn đoán, không dùng làm feature trực tiếp |
| `null` | Nghĩa là nguồn không cung cấp giá trị đó cho bản ghi này. **Không bao giờ** thay thiếu bằng `0` (schema v1 mục 7.1) |
| Định danh | `service_name` ∈ 11 runtime (mục 7.1); `dependency_identity` theo schema v1 mục 3.2 |

## 3. Bảng `metrics.parquet`

Mỗi dòng là một điểm của một series Prometheus tại một thời điểm, lấy bằng `query_range` bước 5 giây (bằng chu kỳ scrape và chu kỳ xuất metric của SDK).

| Cột | Kiểu | Nguồn | Ý nghĩa và giá trị hợp lệ |
| --- | --- | --- | --- |
| `run_id` | string | export | Run |
| `timestamp` | timestamp UTC | Prometheus | Thời điểm của điểm, cách nhau đúng `step` (5 s) tính từ đầu cửa sổ |
| `metric_name` | string | `__name__` | Một trong 16 họ ở bảng dưới |
| `metric_kind` | string | export | `counter`, `gauge`, `histogram_bucket`, `histogram_sum`, `histogram_count` |
| `service_name` | string | nhãn `service_name` | Runtime phát; với metric broker là **worker tiêu thụ queue** |
| `service_version` | string/null | nhãn | `null` với metric broker (hợp lệ, schema v1 mục 5.2) |
| `service_instance_id` | string/null | nhãn | `null` với metric broker |
| `dependency_identity` | string/null | nhãn | Có ở `lms_dependency_*` và metric broker (`<worker>-rabbitmq`) |
| `operation_name` | string/null | nhãn | Thao tác của dependency; với HTTP client là `<METHOD> <route mẫu>` (không chứa ID) |
| `status` | string/null | nhãn | `lms_dependency_*`: `ok`, `timeout`, `unavailable`, `expected_failure` |
| `http_method` | string/null | nhãn | Metric HTTP server |
| `http_route_template` | string/null | nhãn | Route mẫu, ví dụ `/api/v1/courses/:course_id` |
| `http_status_class` | string/null | nhãn | `1xx`…`5xx`, `client_aborted`, `exception` |
| `queue` | string/null | nhãn | Metric broker: 12 queue canonical và 12 queue `.error` |
| `le` | string/null | nhãn | Biên trên của bucket histogram (`0.005`…`10`, `+Inf`) |
| `value` | float64/null | Prometheus | Giá trị thô: counter **tích lũy** từ khi process khởi động, gauge tức thời, bucket tích lũy. `null` kèm cờ `invalid_value` khi nguồn trả NaN/Inf |
| `attributes` | string/null | nhãn còn lại | Nhãn không có cột riêng (trừ nhãn kỹ thuật bị bỏ: `instance`, `job`, `exported_instance`, `exported_job`, `otel_scope_name`, `otel_scope_version`) |

### 3.1. 16 họ metric

| Họ | Kind | Đơn vị | Nhãn chính | Ghi chú |
| --- | --- | --- | --- | --- |
| `http_server_request_count_total` | counter | request | `http_method`, `http_route_template`, `http_status_class` | 11/11 runtime; worker chỉ có `/health`, `/ready` |
| `http_server_request_error_count_total` | counter | request | như trên | Chỉ 5xx, `client_aborted`, `exception`; 4xx nghiệp vụ không tính |
| `http_server_request_duration_seconds_{bucket,sum,count}` | histogram | giây | như trên (+`le`) | 11 biên `[0.005 … 10]` + `+Inf` |
| `lms_dependency_request_count_total` | counter | lời gọi | `dependency_identity`, `operation_name`, `status` | Bên **gọi** ghi |
| `lms_dependency_error_count_total` | counter | lời gọi | như trên | Không tính `expected_failure` |
| `lms_dependency_duration_seconds_{bucket,sum,count}` | histogram | giây | như trên (+`le`) | |
| `process_cpu_time_seconds_total` | counter | giây CPU | — | Dùng làm **nhịp tim** (mục 8.2) |
| `process_memory_usage_bytes` | gauge | byte | — | RSS |
| `rabbitmq_detailed_queue_messages{,_ready,_unacked}` | gauge | message | `queue`, `dependency_identity` | Nguồn broker; `service_name` = worker tiêu thụ |
| `rabbitmq_detailed_queue_consumers` | gauge | consumer | như trên | |

Họ histogram được lưu dạng **dài**: mỗi bucket một dòng với cột `le`, thay cho mảng `histogram_bucket_bounds/counts` của logical schema v1; tái aggregate percentile bằng cách cộng bucket cùng `le`.

## 4. Bảng `spans.parquet`

Mỗi dòng là một span của một trace có điểm thời gian nằm trong cửa sổ, trừ trace nhiễu (mục 7.4). Mọi span của trace được giữ, kể cả phần chạy quá cuối cửa sổ (luồng bất đồng bộ).

| Cột | Kiểu | Nguồn (OTLP) | Ý nghĩa và giá trị hợp lệ |
| --- | --- | --- | --- |
| `run_id` | string | export | Run |
| `trace_id` | string | `traceId` | 32 ký tự hex chữ thường (Tempo trả base64, export đổi sang hex; giữ đúng identity, không băm lại) |
| `span_id` | string | `spanId` | 16 ký tự hex |
| `parent_span_id` | string/null | `parentSpanId` | `null` với span gốc |
| `service_name`, `service_version`, `service_instance_id` | string | resource | Runtime chạy span |
| `span_kind` | string | `kind` | `server`, `client`, `producer`, `consumer`, `internal` |
| `span_name` | string | `name` | SERVER `<METHOD> <route mẫu>`; CLIENT `<dependency_identity> <thao tác>`; PRODUCER `lms.commands publish <command>`; CONSUMER `<queue> process` (schema v1 mục 5.3) |
| `operation_name` | string/null | attr `operation_name` | Thao tác dependency (CLIENT, PRODUCER `publish`, CONSUMER `consume`) |
| `start_time`, `end_time` | timestamp UTC | `startTimeUnixNano`, `endTimeUnixNano` | Độ chính xác micro giây |
| `duration_ms` | float64 | tính | `end - start`, mili giây; cờ `negative_duration` nếu âm |
| `status` | string | `status.code` | `unset`, `ok`, `error` |
| `error_type` | string/null | attr `error.type` | Ví dụ `timeout`, `unavailable` |
| `http_method` | string/null | attr `http.request.method` | |
| `http_route` | string/null | attr `http.route` | Route mẫu |
| `http_status` | int32/null | attr `http.response.status_code` | |
| `peer_service` | string/null | attr `peer.service` | Service đích của cạnh HTTP nội bộ (13 cạnh, schema v1 mục 3.2.2) |
| `dependency_identity` | string/null | attr `dependency_identity` | CLIENT/PRODUCER/CONSUMER |
| `message_id` | string/null | attr `messaging.message.id` | CONSUMER |
| `command_name` | string/null | tính từ `span_name` | Chỉ với PRODUCER `lms.commands publish <command>` |
| `messaging_operation` | string/null | attr `messaging.operation.type` | `publish`, `process` |
| `queue` | string/null | attr `messaging.destination.name` | |
| `trace_root_name` | string/null | kết quả tìm kiếm Tempo | Tên span gốc của trace (để lọc nhiễu ở bước sau) |
| `attributes` | string/null | attr còn lại | |

**Chú ý.** Span SERVER của `gateway` luôn có tên `<METHOD> /api/v1/*path` (proxy catch-all), không cho biết route thật; route thật nằm ở span SERVER của service đích cùng trace.

## 5. Bảng `logs.parquet`

Mỗi dòng là một log trong cửa sổ, trừ access log của probe `/ready`, `/health` (mặc định; số bị loại ghi ở manifest). Loki chỉ đánh index `service_name`; các trường khác là structured metadata.

| Cột | Kiểu | Nguồn | Ý nghĩa và giá trị hợp lệ |
| --- | --- | --- | --- |
| `run_id` | string | export | Run |
| `timestamp` | timestamp UTC | thời điểm của entry | |
| `level` | string/null | `severity_text` (hoặc `detected_level`), chữ thường | `debug`, `info`, `warn`, `error` |
| `service_name`, `service_version`, `service_instance_id` | string | metadata | |
| `trace_id`, `span_id` | string/null | metadata | Có khi log nằm trong ngữ cảnh span |
| `message_id` | string/null | metadata `event_id` | Hiện chưa log nào phát (schema v1 mục 5.4) |
| `event` | string/null | metadata | `http.server.request`, `http.server.error`, `dependency.failure` |
| `error_type` | string/null | metadata | |
| `dependency_identity` | string/null | metadata | Log `dependency.failure` |
| `operation_name` | string/null | metadata | |
| `http_method`, `http_route` | string/null | metadata | |
| `http_status` | int32/null | metadata `http_status_code` | Cờ `invalid_http_status` nếu không đọc được |
| `duration_ms` | float64/null | metadata | Cờ `invalid_duration_ms` nếu không đọc được |
| `message` | string | dòng log | Đã qua bộ che credential/PII của logger; dạng ổn định (`HTTP <method> <route> <status>`, `Dependency <identity> <operation> lỗi <error_type>`) |
| `attributes` | string/null | metadata còn lại | Ví dụ `flags`, `scope_name`, `severity_number`, `observed_timestamp` |

## 6. `manifest.json`

Theo `TelemetryArtifactManifest` (schema v1 mục 6), cụ thể:

| Trường | Ý nghĩa |
| --- | --- |
| `artifact_manifest_version` | `telemetry-artifact.v1` |
| `artifact_id` | `<run_id>--raw--<generated_at>` |
| `run_id`, `artifact_kind` (`raw`), `modality` (`multimodal`), `variant_kind` (`full`), `source_artifact_id` (`null`) | |
| `modality_availability` | Mỗi modality: `available`, `empty`, `truncated` (bị cắt theo giới hạn), `partial` (export trace bị dừng), `error` |
| `telemetry_schema_version` | `telemetry.v2` |
| `format` | `parquet` |
| `files.<modality>` | `path`, `sha256`, `record_count` |
| `generated_at`, `time_start`, `time_end` | Cửa sổ export (đã cộng 30 s cuối khi lấy từ k6 summary) |
| `source_systems` | URL backend |
| `export_config` | Bước metric, có loại probe log không, route probe, tên span gốc nhiễu, tùy chọn Tempo |
| `queries` | Truy vấn đã dùng cho từng nguồn |
| `stats` | Metric: số series mỗi họ, số mẫu, giá trị lỗi. Trace: số lần tìm, ứng viên, nhiễu bị loại, được chọn, bị bỏ do giới hạn, chạm giới hạn tìm, tải được, không thấy, lỗi tải, lỗi đọc, tải lại, `error_samples`. Log: số dòng, số trang, log probe bị loại |
| `errors` | Lỗi gốc của nguồn bị `error` |
| `quality_report_id` | `null` trong manifest (artifact bất biến); report tự tham chiếu `artifact_id` |

## 7. Schema chuẩn hóa v2 — quy bản ghi về service và cạnh

### 7.1. Service và candidate set

- 11 `service_name`: `gateway`, `identity`, `course`, `media`, `media-worker`, `notification`, `notification-worker`, `scheduler`, `scheduler-worker`, `ai`, `ai-worker` (`identity.py` → `RUNTIMES`). Giá trị khác là lỗi định danh (report `fail`).
- Candidate set RCA: 10 runtime, trừ `gateway` (ADR-006; `CANDIDATE_SET`).
- `media-minio`, `notification-smtp`, `ai-llm-provider`, `*-postgres`, `*-rabbitmq` là **component** (dependency evidence), không phải service ứng viên; ground truth ghi chúng ở `root_cause_component`.

### 7.2. Quy về service

| Modality | Service của bản ghi |
| --- | --- |
| Metric HTTP server, process | `service_name` = runtime phát |
| Metric `lms_dependency_*` | `service_name` = **bên gọi**; bên được gọi ở `dependency_identity` |
| Metric broker | `service_name` = worker tiêu thụ queue (không phải service phát command) |
| Span | `service_name` từ resource = runtime chạy span |
| Log | `service_name` = runtime ghi log; nối sang span bằng `trace_id` + `span_id` |

### 7.3. Quy về cạnh

| Loại cạnh | Cách dựng từ artifact |
| --- | --- |
| HTTP đồng bộ giữa service | Span `client` của bên gọi có `peer_service`; con `server` của nó (cùng `trace_id`, `parent_span_id` = `span_id` của client) thuộc bên nhận |
| Dependency hạ tầng | Span `client` có `dependency_identity` (`<service>-postgres`, `media-minio`, `notification-smtp`, `ai-llm-provider`); metric `lms_dependency_*` cùng identity |
| Xác thực (ADR-004) | `dependency_identity` dạng `<caller>-identity-token`, `<caller>-identity-jwks`; tần suất thấp (token làm mới ở 50% TTL, JWKS khi cache hết hạn) |
| Bất đồng bộ (command) | Span `producer` (bên phát, `command_name`) là cha của span `consumer` (`<queue> process`) ở worker; worker = `service_name` của consumer = tiền tố trước `--` của `queue` |
| `scheduler` → `scheduler-worker` | Không cùng trace (worker đọc run từ DB); chỉ suy được theo thời gian |

### 7.4. Nhiễu

| Nhiễu | Cách xử lý ở export | Ghi chú |
| --- | --- | --- |
| Trace probe `GET /ready`, `GET /health` (mỗi 5 s × 11 runtime) | Loại theo tên span gốc | Đếm ở `stats.traces.noise_excluded` |
| Trace thăm dò DB của `scheduler-worker` (`scheduler-postgres run.claim-next`, `run.fail-exhausted`, `job.lock-due-cron`, ~3 trace/s) | Loại theo tên span gốc | Độ trễ `scheduler-postgres` vẫn có ở metric |
| Access log probe | Loại bằng LogQL `http_route !~ "/ready\|/health"` | Đếm ở `stats.logs.probe_logs_excluded` |
| Metric HTTP của route probe | **Giữ** trong bảng metric | Feature pipeline lọc theo `http_route_template` |

Tùy chọn `--include-noise-traces`, `--include-probe-logs` giữ lại toàn bộ.

### 7.5. Khác biệt so với logical schema v1

| v1 (logical) | v2 (artifact) | Lý do |
| --- | --- | --- |
| `operation_name` của span | Tách `span_name` (tên span) và `operation_name` (thuộc tính) | Hai giá trị khác nhau trong code (`observeDependency`) |
| `histogram_bucket_bounds/counts` | Một dòng mỗi bucket, cột `le` | Giữ nguyên dạng Prometheus, dễ tái aggregate |
| `transport_destination` | Không có cột riêng | Chưa instrument nào phát exchange/routing key |
| — | `trace_root_name` | Lọc nhiễu và nhóm theo luồng |
| `attributes` (map) | Chuỗi JSON | Parquet đơn giản, đọc được ở mọi công cụ |

## 8. Data-quality report (`quality-report.json`)

Theo `TelemetryQualityReport` (schema v1 mục 7.2), version `telemetry-quality.v1`. Lệnh: `uv run aiops-training quality artifacts/<run_id>`.

### 8.1. Trạng thái từng runtime

`runtimes.<service_name>` có:

| Trường | Ý nghĩa |
| --- | --- |
| `metrics_records` | Số dòng metric của runtime |
| `heartbeat_coverage_ratio` | Tỉ lệ bước 5 s mà runtime "còn sống" (mục 8.2) |
| `max_heartbeat_gap_s`, `silent_intervals` | Khoảng không sống dài nhất và các khoảng vượt ngưỡng |
| `spans`, `traces_state` | `observed` hoặc `no_traffic` |
| `logs`, `logs_state` | `observed`, `no_traffic` hoặc `not_instrumented` |
| `flags` | `missing_metrics`, `telemetry_silent`, `missing_traces`, `missing_logs` (cờ cho feature, theo blueprint) |

Trạng thái thiếu theo schema v1 mục 7.1: `no_traffic` khi runtime sống nhưng không có request trong cửa sổ; `not_instrumented` cho log của 4 worker (`media-worker`, `notification-worker`, `scheduler-worker`, `ai-worker`), vì worker chưa ghi log khi xử lý command và log duy nhất của chúng là access log probe đã bị loại. Thiếu log của worker **không** làm report xấu đi.

### 8.2. `telemetry_silent`

Runtime bị gắn `telemetry_silent` khi bộ đếm `process_cpu_time_seconds_total` của nó **không tăng** lâu hơn `silent_threshold_s` (mặc định 30 s = 6 chu kỳ) ở giữa cửa sổ. Khoảng trống chạm mép cửa sổ ngắn hơn 35 s không tính (telemetry tới trễ).

Vì sao không dùng "có mẫu hay không": Collector giữ giá trị cuối của mỗi series thêm khoảng 5 phút sau khi service ngừng gửi. Đo ngày 17/11/2026, `docker pause` container `scheduler` 70 giây: Prometheus vẫn trả mẫu mỗi 5 giây, giá trị đứng yên ở `7.484935` suốt lúc pause rồi tăng lại sau `unpause`. Process Node đang sống luôn tiêu một ít CPU mỗi 5 giây (khoảng 0,004 s), nên bộ đếm đứng yên là dấu hiệu tin cậy.

Hệ quả cho feature pipeline: **mọi metric của runtime đã ngừng vẫn còn trong Prometheus khoảng 5 phút**; latency, request count sẽ "phẳng" chứ không biến mất. Feature phải dựa vào mức tăng của counter (rate = 0) và cờ `telemetry_silent`, không dựa vào việc thiếu mẫu.

### 8.3. Các nhóm kiểm khác

| Nhóm | Trường | Ghi chú |
| --- | --- | --- |
| `identity_quality` | `total_records`, `missing_service_name_count`, `missing_service_version_count`, `missing_service_instance_id_count`, `unknown_service_name_count`, `unknown_service_names` | Thiếu version/instance ở metric broker là hợp lệ |
| `metrics_quality` | `expected_scrape_interval_ms`, `gap_count`, `max_gap_ms`, `invalid_value_count`, `covered_runtimes` | Gap tính trên nhịp tim |
| `traces_quality` | `trace_count`, `span_count`, `missing_trace_id_count`, `missing_span_id_count`, `missing_parent_relation_count`, `noise_trace_excluded_count`, `dropped_by_budget`, `fetch_errors` | Span có cha không nằm trong trace = mất span (ví dụ lô span cuối khi `docker pause`, case catalogue quy ước 5) |
| `logs_quality` | `log_count`, `request_or_message_context_log_count`, `trace_correlated_context_log_count`, `log_correlation_ratio`, `invalid_timestamp_count`, `probe_logs_excluded` | Mẫu số là log có `event` thuộc ngữ cảnh request/dependency |
| `duplicate_quality` | `duplicate_metric_record_count`, `duplicate_span_id_count`, `duplicate_log_record_count` | Trùng theo identity + thời điểm, không theo nội dung chung chung |

`phase_coverage` của schema v1 chưa có: cần fault manifest và lịch phase của run (tuần 14–15).

### 8.4. `overall_status`

| Trạng thái | Khi nào |
| --- | --- |
| `fail` | Modality `error` hoặc không có tệp; runtime không có metric nào; `service_name` thiếu hoặc lạ |
| `partial` | Không `fail` nhưng có ít nhất một lý do: `telemetry_silent`, modality `truncated`/`partial`, mất quan hệ cha-con span, tương quan log-trace < 95%, bản ghi trùng |
| `pass` | Không có lý do nào |

`partial` không làm run không hợp lệ (schema v1 mục 7.3): run fault của C6 **phải** có `telemetry_silent` ở `identity`; protocol quyết định variant nào còn dùng được. Lệnh `quality` trả mã 1 chỉ khi `fail`.

### 8.5. Kết quả trên run thử (17/11/2026)

**Run healthy `k6-level1-evidence-20261117`** (k6 mức 1, 2 phút): `pass`. 11/11 runtime có metric và nhịp tim 100%, gap lớn nhất 5 s; 11/11 có span; 7 runtime có log, 4 worker `not_instrumented`; 721 trace, 0 span mất cha; 1 649/1 649 log ngữ cảnh có `trace_id`; 0 bản ghi trùng; 3 072 dòng metric broker thiếu version/instance (hợp lệ).

**Cửa sổ `pause-scheduler-check`** (10:12:56–10:17:06 UTC, `docker pause` `scheduler` 10:14:26–10:15:36, không có workload): `partial`, lý do duy nhất `telemetry_silent:scheduler`, khoảng im lặng 10:14:31–10:15:46 (75 s), nhịp tim `scheduler` 74%; 10 runtime còn lại không bị gắn cờ. Không có span hay log nghiệp vụ vì không có workload (`no_traffic`).

## 9. Bảng đặc trưng v0 (`features/`, task-07 tuần 14)

`uv run aiops-training features <artifact_dir>` ghi `features/service_windows.parquet`, `features/edge_windows.parquet` và `features/features-manifest.json` (`feature_version = feature.v0`, cấu hình cửa sổ, file đầu vào). Cửa sổ `[window_start, window_end)` dài 60 s, bước 15 s, mốc chia hết cho 15 s; theo [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md) mục 11.1–11.2. Đặc trưng chỉ đọc telemetry, không đọc ground truth, fault manifest hay nhật ký workload.

Quy tắc chung: mức tăng counter/histogram trong cửa sổ = tổng hiệu dương liên tiếp của từng series (mẫu gần nhất trước cửa sổ làm mốc; series xuất hiện giữa artifact coi giá trị trước là 0; series đã có từ đầu artifact — mẫu đầu trong vòng một bước scrape từ `time_start` — lấy mẫu đầu làm mốc để không đếm giá trị tích lũy từ lúc process khởi động; counter reset đếm lại từ 0). Percentile tính từ hiệu bucket, nội suy như `histogram_quantile`.

### 9.1. `service_windows.parquet` — một dòng cho mỗi (cửa sổ, runtime trong 11 `service.name`)

| Cột | Kiểu | Đơn vị | Nguồn / cách tính |
| --- | --- | --- | --- |
| `run_id`, `window_start`, `window_end`, `service_name` | string, timestamp UTC | — | Khóa |
| `request_rate` | float | request/s | Mức tăng `http_server_request_count_total` ÷ 60 |
| `error_rate` | float | tỉ lệ | Mức tăng `http_server_request_error_count_total` ÷ mức tăng request; null khi không có request |
| `latency_p50`, `latency_p95`, `latency_p99` | float | s | Từ hiệu bucket `http_server_request_duration_seconds_bucket` của service |
| `cpu_usage` | float | giây CPU/s | Mức tăng `process_cpu_time_seconds_total` ÷ 60 |
| `memory_usage` | float | byte | Giá trị cuối trong cửa sổ của `process_memory_usage_bytes` (lớn nhất theo instance) |
| `trace_error_rate` | float | tỉ lệ | Span có `status = error` ÷ số span của service bắt đầu trong cửa sổ (trace export có giới hạn số trace nên là ước lượng) |
| `span_count` | int | span | Số span của service bắt đầu trong cửa sổ |
| `downstream_latency_p95` | float | s | p95 từ hiệu bucket `lms_dependency_duration_seconds_bucket` với service là bên gọi |
| `log_error_rate`, `log_count` | float, int | dòng/s, dòng | Log `level ∈ {error, fatal}` ÷ 60; tổng số dòng log |
| `missing_metrics` | bool | — | Chưa có mẫu nhịp tim nào của runtime tới cuối cửa sổ |
| `missing_traces`, `missing_logs` | bool | — | Modality `missing` trong manifest artifact |
| `telemetry_silent` | bool | — | Runtime đã có mẫu nhịp tim trước đó nhưng `process_cpu_time_seconds_total` không tăng trong cửa sổ (mục 8.2). Khi `true`, các đặc trưng tốc độ/độ trễ/CPU/bộ nhớ là null, không phải 0. Khác cờ cùng tên của `quality-report` (mục 8.2: khoảng không tăng > 30 s ở bất kỳ đâu trong run): ở mức cửa sổ chỉ gắn khi **cả 60 s** không tăng, nên lần dừng ngắn hơn một cửa sổ hoặc vắt qua mép cửa sổ chỉ làm `cpu_usage` giảm chứ không gắn cờ |

### 9.2. `edge_windows.parquet` — một dòng cho mỗi (cửa sổ, cạnh `caller_service → dependency_identity` có trong metric)

| Cột | Kiểu | Đơn vị | Nguồn / cách tính |
| --- | --- | --- | --- |
| `caller_service`, `dependency_identity` | string | — | Nhãn `service_name`, `dependency_identity` của `lms_dependency_*` (bên gọi ghi) |
| `call_count` | float | lời gọi | Mức tăng `lms_dependency_request_count_total` |
| `error_ratio` | float | tỉ lệ | Mức tăng `lms_dependency_error_count_total` ÷ `call_count` |
| `timeout_ratio` | float | tỉ lệ | Mức tăng `lms_dependency_request_count_total{status="timeout"}` ÷ `call_count` |
| `duration_mean` | float | s | Mức tăng `_sum` ÷ mức tăng `_count` của `lms_dependency_duration_seconds` |
| `duration_p95`, `duration_p99` | float | s | Từ hiệu bucket `lms_dependency_duration_seconds_bucket` |
| `caller_silent` | bool | — | `telemetry_silent` của bên gọi trong cùng cửa sổ |

Khác logical schema v1 mục 11.2: đặc trưng cạnh v0 lấy từ **metric** dependency (đếm đủ mọi lời gọi) thay vì từ `TraceSpan` (bị giới hạn số trace khi export); `first_degradation_time` và `missing_trace_ratio` chưa làm (cần detector và đối chiếu span–metric, tuần 15–16).

### 9.3. Kết quả trên run thử có fault (18/11/2026)

Artifact `w14-t05-fault-trial` (15 phút, tải nền k6 mức 1, bốn case bật lần lượt): 59 cửa sổ, 649 dòng service, 2.360 dòng cạnh (40 cạnh), chạy trong ~47 s, bộ nhớ đỉnh ~1,2 GB (đọc từng metric theo cột; artifact 48 phút dự kiến gấp ~3 lần, kiểm `free -h` trước khi chạy). Trung vị đặc trưng của thành phần gốc trước → trong cửa sổ fault: C2 `course→course-postgres` `duration_mean` 1,3 ms → 377 ms; C4 `media→media-minio` 1,2 ms → 365 ms; C3 `ai-worker→ai-llm-provider` 1,2 ms → 31,7 s; C6 `gateway→gateway-identity-token` `error_ratio` 0 → 1,0 và `identity` có `telemetry_silent = true` ở 6 cửa sổ trong lúc bị pause (bắt đầu 05:18:00–05:19:15 UTC).

## 10. Giới hạn và việc tiếp theo

- Chưa có `phase_coverage`, `workflow_trace_coverage_ratio` và các trường async của schema v1 mục 7.2 (cần nhật ký thao tác k6 mức 2 và fault manifest, tuần 14).
- Ngưỡng (`silent_threshold_s` 30 s, mép 35 s, tương quan log 95%) là giá trị khởi đầu, chốt sau pilot.
- `notification-worker` khi phát lại command từ outbox đang dùng identity `notification-rabbitmq` thay vì `notification-worker-rabbitmq` (lệch so với schema v1 mục 3.2.4; `lms/services/notification/src/adapters/messaging/outbox-relay.service.ts`). Ảnh hưởng cột `dependency_identity` của span PRODUCER trong artifact; cần sửa code hoặc ghi chú khi dựng cạnh async.
- Bộ đếm lỗi xuất hiện lần đầu giữa cửa sổ là series mới; `increase()` của Prometheus bỏ mẫu đầu. Artifact giữ giá trị thô nên feature pipeline coi giá trị trước đó là 0 (đã làm ở mục 9).
