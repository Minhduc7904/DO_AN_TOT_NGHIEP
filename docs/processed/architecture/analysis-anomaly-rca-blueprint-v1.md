# Analysis, anomaly detection và RCA blueprint v1

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Cập nhật R-13:** `auth` và `student` đã gộp thành service `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)); tài liệu được sửa tại chỗ theo topology 7 service + 4 worker (11 runtime). Các số đo chưa đo lại sau khi gộp được ghi rõ ở chỗ dùng.
>
> **Trạng thái:** v1, đề xuất — chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review). Mọi thuật toán, ngưỡng, trọng số và tên thư mục trong tài liệu này là **đề xuất chờ xác nhận hoặc chưa kiểm chứng** trừ chỗ ghi rõ là số đo hoặc quyết định đã chốt ở tài liệu nguồn.
>
> **Thay thế:** [analysis-anomaly-rca-blueprint](analysis-anomaly-rca-blueprint.md) (giữ làm lịch sử, không dùng cho dataset và triển khai mới). Bản trước gắn kiến trúc v1 (Enrollment, Submission, Grading, Storage Mock, Redis, `grade.completed`) và coi AI là công cụ hỗ trợ.
>
> **Phụ thuộc:**
>
> - [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md): AI là bên truy vết nguyên nhân lỗi chính (quyết định nền của tài liệu này).
> - [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md): service access token, nguồn của các cạnh xác thực.
> - [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md): 11 `service.name`, dependency graph, edge `e01–e29`, candidate set.
> - [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md): ownership dữ liệu, fault FA–FH.
> - [http-and-event-contracts-v2](http-and-event-contracts-v2.md): command qua RabbitMQ, envelope, yêu cầu telemetry ở boundary.
> - [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md): tín hiệu telemetry có thật và chưa có, quy ước đọc telemetry, case C1–C7, schema `RcaIncidentResult` và nơi lưu.
> - [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md): schema telemetry đã chuẩn hóa, `RunGroundTruth`, `TelemetryQualityReport` (tài liệu này chỉ link, không chép lại).
> - [evaluation-protocol-v1](evaluation-protocol-v1.md): protocol đánh giá theo topology v2 (candidate set `service-candidates.v1`, split theo `run_id`, đối chứng thủ công, thời gian chẩn đoán, chấm `RcaIncidentResult`); bản v1 là đề xuất chờ Đức xác nhận, thay [evaluation-protocol-v0](evaluation-protocol-v0.md) (lịch sử).
>
> **Định hướng WHY/WHAT:** [`../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md`](../direction/khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md) (bản theo vai trò AI chính; bản cũ [`khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md) giữ làm lịch sử).
>
> **Backend SUT scope, topology và implementation architecture:** [`backend-microservice-testbed-blueprint-v2.md`](backend-microservice-testbed-blueprint-v2.md) cùng [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) (bản cũ [`backend_microservice_testbed_blueprint.md`](backend_microservice_testbed_blueprint.md) còn nội dung v1).
>
> **WHEN/WHO:** [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md) (ADR-002 nhắc plan v0.3 chưa có trong repository).

Tài liệu này mô tả **mục tiêu, phạm vi và cách triển khai RCA engine**: ranh giới module, telemetry contract theo tín hiệu có thật của LMS testbed v2, data model, feature pipeline, phát hiện bất thường, incident, dependency graph v2, xếp hạng nguyên nhân gốc, bằng chứng, đầu ra `RcaIncidentResult`, xử lý case phức tạp, đánh giá, kiểm thử và Definition of Done. Phần MCP và agent là thành phần thứ yếu, mô tả ở mục 16.

Thuật ngữ: **RCA engine** là hệ thống ML + dependency graph trong tài liệu này. Không nhầm với service `ai` của LMS (cổng LLM soạn bài, sinh quiz) và `ai-worker`; hai bên không có quan hệ kỹ thuật ngoài việc `ai-llm-provider` là một dependency của LMS có thể bị gây lỗi.

Tài liệu không định nghĩa lại backend topology, fault mechanism hay timeline. Khi có mâu thuẫn:

1. ADR-002 và khung định hướng quyết định vai trò AI, phạm vi nghiên cứu.
2. Service catalogue v2, contract v2 và fault matrix v2 quyết định topology, identity và fault.
3. Tài liệu này quyết định implementation bên trong RCA engine; `complex-case-catalogue-and-rca-result-v0` quyết định schema `RcaIncidentResult`.
4. Plan quyết định WHEN/WHO.

## 1. Mục tiêu và nguyên tắc

### 1.1. Mục tiêu

RCA engine nhận telemetry của LMS testbed v2 và, khi huấn luyện hoặc đánh giá offline, ground truth từ fault injection. Engine thực hiện:

```text
telemetry ingestion
-> validation + time alignment
-> feature engineering
-> anomaly detection (ML)
-> incident detection
-> dependency graph v2
-> xếp hạng nguyên nhân (ML + dependency graph)
-> kết luận tự động: RcaIncidentResult (ranked | insufficient_evidence)
-> đánh giá định lượng (offline)
```

Vai trò AI là **chính** (ADR-002): từ phát hiện bất thường tới kết luận, không bước nào cần người can thiệp. Người đọc (developer/SRE, người chấm đồ án) nhận kết quả đã có xếp hạng và bằng chứng, không phải bên chọn nguyên nhân. Hai khẳng định đi kèm:

- Mục tiêu đo được là engine tìm được nguyên nhân gốc ở những case mà truy vết thủ công theo đường request không tìm ra (mục 15), không chỉ ở case dễ.
- Đầu ra vẫn là xếp hạng ứng viên có bằng chứng, không tuyên bố causal proof chỉ từ telemetry quan sát.

RCA engine chạy ngoài luồng (out-of-band), không tham gia business request path của LMS.

### 1.2. Nguyên tắc bắt buộc

1. RCA engine là **modular monolith Python** trong MVP.
2. Phần chính của đề tài là huấn luyện và đánh giá mô hình; thuật toán nằm trong package có test, không nằm độc quyền trong notebook.
3. Mọi input/output có schema và version.
4. Fit/tune chỉ dùng training/validation theo protocol; không tune trên test campaign.
5. Primary RCA evaluation là **service-level**; candidate set là 10 service/worker theo catalogue v2 (mục 12.1).
6. Dependency và hạ tầng (PostgreSQL, RabbitMQ, MinIO, SMTP, LLM provider) là **evidence**, không phải candidate service-level.
7. Mọi prediction phải truy ngược được tới run, config, code commit, telemetry artifact và graph đã dùng.
8. Baseline, ablation, failure analysis và **đối chứng thủ công** là bắt buộc; model phức tạp không tự động có giá trị hơn.
9. Missing telemetry phải được xử lý có chủ đích, không âm thầm điền dữ liệu làm sai nghĩa. Tín hiệu **chưa có** ở testbed (mục 5.5) phải được ghi vào kết quả (`telemetry_quality`), không được giả định là bình thường.
10. Chứng cứ không đủ thì engine kết luận `insufficient_evidence` thay vì ép ra một xếp hạng.
11. Ground truth không bao giờ là input của bước suy luận (mục 2.1, 23.2).
12. Output dùng thuật ngữ xếp hạng nguyên nhân (root-cause candidate ranking).

## 2. Ranh giới hệ thống

### 2.1. Input

RCA engine nhận các input logic sau:

- metric từ Prometheus hoặc telemetry artifact đã export;
- trace/span từ Tempo hoặc artifact tương đương;
- structured log từ Loki hoặc artifact tương đương;
- service catalogue v2 và dependency graph thiết kế (để validate graph quan sát, mục 11);
- config của feature, detector, incident, graph, RCA và evaluation;
- **chỉ khi huấn luyện hoặc đánh giá offline:** `RunGroundTruth` và manifest thí nghiệm (xem [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md)).

Khi chạy suy luận hoặc giám sát, engine không có quyền đọc ground truth. Ground truth cũng không nằm trong payload nghiệp vụ hay telemetry (contract v2, mục 8).

### 2.2. Output

- bảng telemetry đã chuẩn hóa;
- feature theo service/window và theo cạnh;
- anomaly score;
- bản ghi incident và timeline;
- graph snapshot đã dùng (có version, tham chiếu bằng `graph_ref`);
- **`RcaIncidentResult`** (mục 14): kết luận, xếp hạng, bằng chứng đã chọn sẵn;
- artifact đánh giá, bảng và biểu đồ phục vụ báo cáo.

### 2.3. Ngoài phạm vi module

- Workload k6 (`aiops-platform/load/`) và fault injector (`aiops-platform/faults/`): thuộc mảng AI nhưng là module riêng, không nằm trong RCA engine; chưa có trong repository.
- Orchestration thí nghiệm và lưu run ledger.
- Bộ đánh giá chỉ nhận prediction + ground truth để tính metric, không tham gia suy luận.
- Grafana quan sát telemetry gốc, không thay thế pipeline.
- MCP server và agent (mục 16): thành phần thứ yếu, làm sau khi RCA engine và đánh giá đạt.
- RCA engine không điều khiển trực tiếp service LMS.

## 3. Cấu trúc source code

Repository hiện chỉ có `aiops-platform/observability/`. ADR-002 đặt mã huấn luyện, MCP và agent trong `aiops-platform/`; catalogue v0 dùng `aiops-platform/training/` cho nơi lưu kết quả và `aiops-platform/mcp/`, `aiops-platform/agent/` cho phần thứ yếu. Cấu trúc dưới đây là **đề xuất chờ xác nhận**; chỉ tạo thư mục khi có implementation thật.

```text
aiops-platform/
├── observability/          # đã có: Collector, Prometheus, Tempo, Loki, Grafana
├── faults/                 # chưa có: fault injector (mảng AI)
├── load/                   # chưa có: workload k6 (mảng AI)
├── training/               # chưa có: RCA engine, huấn luyện, đánh giá; tên thư mục chờ xác nhận
│   ├── telemetry/
│   ├── features/
│   ├── anomaly/
│   ├── incident/
│   ├── graph/
│   ├── rca/
│   ├── evidence/
│   ├── results/            # RcaIncidentResult, theo catalogue v0 mục 5.3
│   └── evaluation/
├── mcp/                    # chưa có: MCP server chỉ đọc (thứ yếu)
└── agent/                  # chưa có: agent loop và MCP client (thứ yếu)
```

Gói `training/` dùng chung cho huấn luyện và suy luận (cùng code feature, graph, rca). Việc huấn luyện đọc dataset trực tiếp, không qua MCP (ADR-002).

Mỗi module có thể tổ chức nội bộ như sau:

```text
training/
├── telemetry/
│   ├── adapters/          # Prometheus, Tempo, Loki, artifact
│   ├── schemas/
│   ├── validation/        # data-quality, lọc trace nhiễu
│   └── alignment/
├── features/
│   ├── service/
│   ├── edge/
│   ├── queue/
│   ├── logs/
│   ├── normalization/
│   └── schemas/
├── anomaly/
│   ├── baselines/
│   ├── detectors/
│   ├── fusion/
│   └── configs/
├── incident/
│   ├── detection/
│   ├── correlation/
│   └── timeline/
├── graph/
│   ├── builders/          # sync, async, dependency, shared-resource, auth
│   ├── validation/
│   └── schemas/
├── rca/
│   ├── baselines/         # gồm baseline "thủ công" tự động
│   ├── ranking/
│   ├── verdict/
│   └── configs/
├── evidence/
│   ├── metrics/
│   ├── traces/
│   ├── logs/
│   └── aggregation/
└── evaluation/
    ├── detection/
    ├── rca/
    ├── manual-baseline/
    ├── ablation/
    ├── robustness/
    └── reports/
```

Không tạo root `backend/`, `models/`, `notebooks/` hoặc `dashboard/` cạnh tranh. Notebook khám phá có thể đặt ở vị trí được thống nhất sau, nhưng implementation được nghiệm thu phải nằm trong các module trên.

## 4. Technology stack

### 4.1. MVP

| Nhu cầu | Công nghệ định hướng |
| --- | --- |
| Ngôn ngữ | Python |
| Tabular/dataframe | pandas hoặc Polars; chốt một lựa chọn sau pilot |
| Numerical/statistics | NumPy, SciPy |
| Machine learning | scikit-learn |
| Graph | NetworkX hoặc cấu trúc graph nội bộ tương đương |
| Schema/validation | Pydantic hoặc dataclass + validator |
| Artifact table | Parquet ưu tiên; CSV chỉ cho export đơn giản |
| Kết quả RCA | JSON bất biến theo schema catalogue v0 mục 5 |
| Prediction/config | JSON hoặc YAML có version |
| CLI | Python CLI tối giản |
| API | FastAPI khi cần tích hợp/giao diện |
| Runtime | Docker Compose |

Không thêm Celery, Kafka hoặc distributed compute nếu CLI/background worker đơn giản đã đủ. Không tách RCA engine thành nhiều microservice vật lý trong MVP.

### 4.2. Target/Stretch

- online change-point detector;
- log-template parser nâng cao;
- external benchmark adapter;
- causal/statistical analysis trên top-N candidate;
- job queue bất đồng bộ nếu thời lượng xử lý thực tế chứng minh cần thiết;
- RCA mức component hoặc instance chỉ sau service-level MVP;
- MCP server và agent đọc kết quả (mục 16).

Deep learning và full causal discovery không thuộc core. **LLM không nằm trong RCA engine**: xếp hạng do mô hình ML + graph tạo ra; LLM chỉ xuất hiện ở agent thứ yếu để viết báo cáo từ kết quả đã có (mục 16).

## 5. Telemetry contract

Mục này mô tả tín hiệu RCA engine được phép dựa vào. Số đo và danh sách lấy từ [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 1–2 (đo ngày 29/10/2026, lệnh lặp lại `pnpm run test:observability`); tài liệu này không đo lại. Schema chuẩn hóa chi tiết ở [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md).

### 5.1. Identity và thời gian

Mọi telemetry record phải truy được tối thiểu:

```text
service.name        # 1 trong 12 giá trị canonical (catalogue v2 mục 2.1)
service.version
service.instance.id
timestamp
```

Quy ước thời gian:

```text
UTC
ISO-8601 tại boundary/artifact
timezone-aware datetime trong code
```

`service.name` canonical gồm: `gateway`, `identity`, `course`, `media`, `media-worker`, `notification`, `notification-worker`, `scheduler`, `scheduler-worker`, `ai`, `ai-worker`. Engine không dùng container, pod hay process name thay `service.name`. `trace_id`, `span_id`, user ID hoặc request ID không được dùng làm Prometheus label; chúng chỉ dùng để correlation hoặc lookup.

Ở Prometheus, định danh là nhãn `service_name`; ở Loki, chỉ `service_name` là index label, còn `trace_id`, `span_id`, `service_version`, `service_instance_id` là structured metadata.

### 5.2. Metric có thật (Prometheus)

| Họ metric | Nhãn chính | Dùng cho |
| --- | --- | --- |
| `http_server_request_count_total`, `http_server_request_error_count_total`, `http_server_request_duration_seconds_*` | `service_name`, `http_method`, `http_route_template`, `http_status_class` | RED của service (rate, error, latency) |
| `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, `lms_dependency_duration_seconds_*` | `service_name`, `dependency_identity`, `operation_name`, `status` | Cạnh sync, DB, MinIO, SMTP, LLM provider, token và JWKS |
| `process_cpu_time_seconds_total`, `process_memory_usage_bytes` | `service_name` | CPU và RSS theo process |
| `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked`, `rabbitmq_detailed_queue_consumers` | `service_name` (worker tiêu thụ), `dependency_identity`, `queue` | Backlog và consumer của 24 queue (12 canonical, 12 `.error`) |

Ghi chú sử dụng:

- Metric HTTP phủ 11/11 runtime, nhưng **worker chỉ có `/health` và `/ready`**: feature HTTP của worker là "không áp dụng", không phải 0 (mục 7.3).
- `status` của `lms_dependency_*` nhận `ok`, `timeout`, `unavailable`, `expected_failure`. Việc `expected_failure` có tính vào error rate hay không cần xác nhận trước khi cài đặt feature (chưa kiểm chứng).
- Metric `lms_dependency_*` của cạnh HTTP do **bên gọi** ghi (`service_name` = bên gọi); span SERVER của bên nhận nằm cùng trace.
- Metric `rabbitmq_*` đến từ broker, không phải runtime. `service_name` là tiền tố trước `--` của tên queue, tức worker tiêu thụ. Backlog ở `media-worker--*` mô tả `media-worker`, kể cả khi nguyên nhân ở nơi khác.
- Cách tính percentile từ histogram `http_server_request_duration_seconds_*` và `lms_dependency_duration_seconds_*` xác nhận khi viết adapter.

### 5.3. Trace có thật (Tempo)

Mọi runtime xuất span OTLP, 100% sampling. Span có các kind `SERVER`, `CLIENT`, `PRODUCER`, `CONSUMER`:

- Luồng bất đồng bộ qua outbox **nối vào trace của request gây ra nó**: command ghi `traceparent` vào envelope lúc enqueue, relay phát lại với đúng context đó. Span `PRODUCER` và `CONSUMER` cùng `trace_id` với span HTTP gốc. Ma trận 9 luồng và tập service trong mỗi trace nằm ở catalogue v0 mục 1.2 và được kiểm tự động bởi `tracing-smoke`.
- Span `PRODUCER` thuộc **tiến trình relay**, không nhất thiết thuộc service sở hữu command (ví dụ outbox của `notification` có thể được phát bởi `notification` hoặc `notification-worker`). Quy về chủ sở hữu bằng queue đích hoặc command catalogue ([contract v2 mục 6.3](http-and-event-contracts-v2.md)), không bằng `service.name` của span PRODUCER.
- Các span chủ chốt có tên theo `dependency_identity` (ví dụ `identity-postgres *`, `ai-llm-provider POST chat/completions`, `media-minio *`) và CONSUMER theo tên queue (ví dụ `media-worker--generate-media-thumbnail-v1`).
- Trace gây nhiễu cần lọc: `scheduler-worker` tạo trace gốc cho mỗi lần thăm dò DB (mỗi giây) và mọi runtime tạo trace cho `/ready`. Engine lọc theo `http_route_template`/`operation_name` ở tầng adapter.
- Tempo của testbed bị OOM-kill khi truy vấn hàng nghìn trace song song (giới hạn 512 MiB). Adapter phải truy vấn tuần tự, giới hạn khoảng thời gian và số trace; không kéo trace hàng loạt.

Mỗi span cần các field logic:

```text
trace_id
span_id
parent_span_id
service_name
service_instance_id
span_kind
operation_name
start_time
end_time
duration
status
error_type
http_status
dependency_identity
command_name, queue, attempt   # span PRODUCER/CONSUMER
```

Controlled baseline dùng 100% trace sampling. MVP robustness có thể mô phỏng trace dropping/sampling trên telemetry artifact; live sampling thấp hơn baseline chỉ thuộc expanded Target.

### 5.4. Log có thật (Loki)

11/11 runtime có log. Hai loại log hiện hữu:

- access log `http.server.request` cho mỗi request HTTP (trừ `/health`);
- log lỗi dependency `dependency.failure` kèm `dependency_identity`, `error_type`, `trace_id`, `span_id` (đã kiểm `span_id` trỏ đúng span CLIENT lỗi).

Worker chỉ có access log `/ready`; **không có log khi xử lý command** (mục 5.5). Do đó log là modality yếu hơn metric và trace ở phía worker; feature log chỉ nên dựa vào `dependency.failure` và access log.

Log tối thiểu:

```text
timestamp
level
service_name
service_version
service_instance_id
trace_id
span_id
event
error_type
dependency_identity
message_template hoặc message có thể normalize
```

Không xử lý password, token, secret hoặc PII không cần thiết (catalogue v0 mục 4.1 ghi nhận không rò secret).

### 5.5. Tín hiệu chưa có và hệ quả cho feature

Nguồn: catalogue v0 mục 1.5. Đây là giới hạn trung thực của testbed hiện tại; RCA engine không được giả định các tín hiệu này tồn tại, và `telemetry_quality` của kết quả phải ghi lại khi thiếu.

| Tín hiệu chưa có | Hệ quả cho feature và engine |
| --- | --- |
| Độ sử dụng pool kết nối PostgreSQL, thời gian chờ pool | Không có feature `connection_pool_usage`. Case C2 chỉ nhận ra gián tiếp qua độ trễ `lms_dependency_duration_seconds{dependency_identity="course-postgres"}` tăng đồng loạt, CPU và RSS; không phân biệt được "pool cạn" với "DB chậm". |
| Tuổi message cũ nhất trong queue | Không có feature `consumer_lag` theo thời gian chờ; chỉ có độ sâu (`_ready`, `_unacked`). Thay bằng feature suy từ span: độ trễ giữa `start_time` của PRODUCER và CONSUMER cùng trace (mục 8.3). |
| Metric publish/consume RabbitMQ ở runtime | Không có `lms_dependency_*` cho `*-rabbitmq`. Feature async chỉ từ span và metric broker. |
| Độ trễ outbox (dòng chờ phát) | Command kẹt trong DB của producer không thấy ở broker; chỉ phát hiện gián tiếp qua CONSUMER bắt đầu muộn. |
| Log khi worker xử lý command | Lỗi xử lý ở worker chỉ thấy ở span và `dependency.failure`; feature log của worker rất thưa. |
| Nối `scheduler` → `scheduler-worker` | Hai bên không cùng trace; cạnh này chỉ có trong graph thiết kế (mục 11.5), không suy được từ trace. |
| `network_rx`, `network_tx`, `disk_io`, `event_loop_lag` | Bản trước liệt kê là resource metric; catalogue v0 không đo thấy các metric này, nên không dùng. |

Hạng mục thêm metric ở testbed (pool DB, outbox, publish/consume RabbitMQ, log worker, nối scheduler → worker) thuộc quyết định của Đức trước khi thu dataset (catalogue v0 mục 6).

### 5.6. Độ trễ thu thập

Đo từ lúc gửi request tới lúc tín hiệu truy vấn được: log vào Loki ≈ 2 giây, trace vào Tempo ≈ 2,5 giây, counter vào Prometheus ≈ 4–10 giây, backlog queue hiện ở Prometheus sau ≈ 9 giây. Cửa sổ ghép tín hiệu của engine nên ≥ 15 giây (catalogue v0 mục 1.4). Hệ quả: khi ghép ba modality theo cùng window, ranh giới window phải chừa độ trễ này để tránh tạo "thiếu tín hiệu" giả (mục 7.2).

### 5.7. Quy ước đọc telemetry

Bốn quy ước ảnh hưởng trực tiếp tới feature và ground truth (catalogue v0 mục 2):

1. Span PRODUCER thuộc tiến trình relay (mục 5.3).
2. Queue thuộc worker tiêu thụ: `service_name` của metric broker là tiền tố trước `--` của tên queue.
3. Triệu chứng của lỗi xác thực nằm ở cạnh `<service>-identity-token` của **bên gọi**, không nằm ở service đích (case C6).
4. Metric `lms_dependency_*` của cạnh HTTP do bên gọi ghi.

### 5.8. Data-quality contract

Mỗi run (và mỗi cửa sổ giám sát thật) có báo cáo kiểm tra theo `TelemetryQualityReport` của [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md); báo cáo này được tham chiếu trong `RcaIncidentResult.telemetry_quality`. Các kiểm tra tối thiểu:

- timestamp hợp lệ và không lẫn timezone;
- tỷ lệ record thiếu `service.name` hoặc `service.name` ngoài 12 giá trị canonical;
- tỷ lệ span thiếu parent hoặc trace relation, riêng cặp PRODUCER/CONSUMER không nối được;
- độ phủ trace theo luồng (9 luồng ở catalogue v0 mục 1.2);
- độ phủ metric theo họ (RED 12/12, `lms_dependency_*` theo cặp service/identity, queue 24) và khoảng trống scrape;
- độ phủ log correlation (`trace_id`/`span_id` trong `dependency.failure`);
- duplicate record;
- artifact có bao phủ warm-up, healthy, fault, recovery (khi huấn luyện/đánh giá);
- manifest time có nằm trong telemetry range.

Run vi phạm ngưỡng data quality phải được đánh dấu `invalid` hoặc `partial`, không âm thầm đưa vào evaluation chính. Cổng chất lượng theo run/artifact (`pass | partial | fail`) và luật lọc nhiễu được protocol quy định ở [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 8.

## 6. Mô hình dữ liệu phân tích

Schema thực tế có thể dùng Pydantic/Parquet/JSON nhưng phải giữ các field logic dưới đây. Schema của telemetry chuẩn hóa, `RunGroundTruth` và `TelemetryQualityReport` nằm ở [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md); schema `RcaIncidentResult` nằm ở catalogue v0 mục 5 (xem mục 14).

### 6.1. Ngữ cảnh thí nghiệm

Bản trước định nghĩa `ExperimentContext` gồm cả ground truth. Ở v1, engine chỉ giữ phần **cấu hình và lineage**; ground truth tách riêng vì không được vào bước suy luận:

```text
AnalysisContext
- run_id                          # null khi giám sát thật
- window: { start, end }
- code_commit
- service_versions
- telemetry_schema_version
- telemetry_artifact              # tham chiếu TelemetryArtifactManifest
- feature_schema_version
- feature_config_version
- detector_config_version
- incident_config_version
- graph_config_version
- rca_config_version
- evaluation_config_version
- environment_profile
```

`RunGroundTruth` (fault_type, root_cause_service, root_cause_component, fault_start, fault_end, cường độ) chỉ được nạp ở bước dựng nhãn huấn luyện và bước đánh giá offline. Các giá trị `fault_type` đang dùng trong catalogue v0 gồm `queue_backlog`, `dependency_latency`, `db_connection_hold`, `dependency_unavailable`, `config_drift`.

### 6.2. ServiceWindowFeature

```text
ServiceWindowFeature
- run_id
- window_start
- window_end
- service_name                    # 1 trong 11 service.name
- service_version
- http_request_rate               # không áp dụng cho worker
- http_error_rate
- http_latency_p50 / p95 / p99
- cpu_usage                       # tốc độ tăng process_cpu_time_seconds_total
- memory_rss                      # process_memory_usage_bytes
- dep_error_rate_max              # lớn nhất theo dependency_identity
- dep_latency_p95_max
- queue_ready, queue_unacked, queue_consumers   # chỉ worker tiêu thụ
- trace_error_rate
- span_duration_p95
- consumer_start_delay_p95        # từ cặp PRODUCER/CONSUMER (mục 8.3)
- log_error_rate
- dependency_failure_log_count
- telemetry_silent                # không có telemetry trong window (mục 7.3)
- missing_metrics
- missing_traces
- missing_logs
- not_applicable                  # danh sách feature không áp dụng cho service này
- feature_schema_version
```

### 6.3. EdgeWindowFeature

Edge dùng hướng caller → callee. Có bốn loại cạnh (mục 11.1): `sync`, `async`, `dependency`, `shared-resource`; feature quan sát chỉ có cho ba loại đầu.

```text
EdgeWindowFeature
- run_id
- window_start
- window_end
- edge_type                       # sync | async | dependency
- caller_service
- callee                          # service.name hoặc dependency_identity
- dependency_identity             # nếu có (ví dụ gateway-course, ai-worker-course)
- call_count
- error_rate
- timeout_rate
- latency_mean
- latency_p95
- latency_p99
- queue_delay_p95                 # chỉ cạnh async: CONSUMER.start - PRODUCER.start cùng trace
- first_error_time
- missing_trace_ratio
- feature_schema_version
```

Dependency hạ tầng (PostgreSQL, MinIO, SMTP, LLM provider, RabbitMQ) có edge evidence riêng nhưng không trở thành candidate service-level.

### 6.4. AnomalyRecord

```text
AnomalyRecord
- run_id
- window_start
- window_end
- service_name
- metrics_score
- traces_score
- logs_score
- fused_score
- is_anomalous
- threshold
- detector_name
- detector_config_version
- missing_modalities
```

### 6.5. Incident

```text
Incident
- incident_id                     # trùng RcaIncidentResult.incident_id
- run_id
- detected_at
- estimated_start_time
- estimated_end_time
- state
- severity
- affected_services
- first_symptom: { service, signal, first_seen }
- trigger_reason
- detector_config_version
- incident_config_version
```

### 6.6. TimelineEvent

```text
TimelineEvent
- incident_id
- timestamp
- service_name
- component
- event_type
- severity
- summary
- evidence_refs
```

### 6.7. RCACandidate

```text
RCACandidate
- incident_id
- service_name
- component                       # dependency_identity hoặc thành phần nghi ngờ
- rank
- score
- anomaly_score
- temporal_score
- propagation_score
- edge_score
- evidence_score
- mechanism                       # fault_type dự đoán
- propagation_path                # chuỗi service.name
- explanation_refs
- rca_config_version
```

`service_name` là candidate identity của metric chính. `component` đi kèm để báo cáo cơ chế nhưng không thành mục riêng trong danh sách xếp hạng khi protocol đánh giá service-level. `RCACandidate` là biểu diễn nội bộ của engine; biểu diễn lưu trữ và trao đổi là `ranking[]` của `RcaIncidentResult`.

### 6.8. Evidence

```text
Evidence
- evidence_id
- incident_id
- candidate_service
- component
- kind                            # trace | log | metric
- service                         # service.name nơi quan sát
- trace_id, span_id               # trace/log
- metric, labels, window          # metric
- baseline_value
- incident_value
- change_ratio
- statistical_score
- first_observed_at
- summary                         # ngắn, do engine chọn sẵn, không phải log thô
```

Các field `kind`, `service`, `trace_id`, `span_id`, `metric`, `labels`, `window`, `summary` trùng với `evidence[]` trong `RcaIncidentResult`; các field còn lại là bổ sung nội bộ phục vụ giải thích và ablation.

### 6.9. EvaluationRecord

```text
EvaluationRecord
- run_id
- incident_id
- ground_truth_service
- ground_truth_component
- detected
- detection_delay
- verdict                         # ranked | insufficient_evidence
- predicted_rank
- top1_hit
- top3_hit
- reciprocal_rank
- manual_baseline_rank            # baseline thủ công tự động (mục 12.6)
- diagnosis_time_ai
- diagnosis_time_manual           # baseline tự động hoặc thử nghiệm người
- detector_config_version
- rca_config_version
- evaluation_config_version
```

## 7. Windowing, alignment và preprocessing

### 7.1. Window mặc định

Giá trị khởi điểm (đề xuất, chờ pilot):

```text
window_size = 60 seconds
step = 15 seconds
```

Các window có overlap:

```text
00:00–01:00
00:15–01:15
00:30–01:30
```

Cửa sổ ≥ 15 giây theo độ trễ thu thập ở mục 5.6. Sau pilot có thể so sánh 30/60/120 giây trên validation. Window được freeze trước test campaign và ghi trong feature config. Case có độ trễ nhân quả dài (C4: nhiều phút; C6: tới chu kỳ TTL token) cần cửa sổ **tương quan incident** dài hơn cửa sổ feature; giá trị chưa kiểm chứng (mục 10.3).

### 7.2. Alignment

- metric aggregate theo `[window_start, window_end)`;
- span được gán theo start time hoặc contribution rule được ghi rõ; span CONSUMER gán theo start time của chính nó, không theo PRODUCER;
- log được gán theo timestamp;
- mọi modality dùng cùng window ID, chừa độ trễ thu thập (mục 5.6) khi quyết định "thiếu tín hiệu";
- boundary ở fault start/end phải được xử lý nhất quán;
- không dùng future window để tính online score nếu tuyên bố near-real-time.

### 7.3. Missing data

Phân biệt:

```text
0 thực sự
không có traffic
không áp dụng (ví dụ metric HTTP nghiệp vụ của worker)
tín hiệu chưa được testbed đo (mục 5.5)
không scrape được metric / service im lặng
trace bị sampling/mất
log source không khả dụng
```

Mỗi feature cần cờ missing tương ứng. Imputation phải fit từ training data và được version hóa. Không điền `0` máy móc.

Service **im lặng** (không có metric lẫn span trong window dù trước đó có) là một trạng thái riêng, cờ `telemetry_silent`. Trường hợp điển hình là C6: `docker pause` `identity` làm `identity` ngừng xuất telemetry, nên bằng chứng trực tiếp về `identity` là sự vắng mặt. Việc dùng `telemetry_silent` làm feature là **đề xuất chưa kiểm chứng**; cần phân biệt với service ít traffic bình thường (ví dụ `scheduler`, `scheduler-worker`).

### 7.4. Normalization

- fit scaler chỉ trên healthy training runs;
- có thể normalize per service để giảm khác biệt scale;
- không dùng fault window để fit mean/median/scaler;
- lưu scaler parameters cùng model artifact;
- service/version mới phải có fallback hoặc báo chưa đủ baseline.

### 7.5. Split chống leakage

Split theo **experiment run**, không random window:

```text
healthy training runs -> fit scaler/detector
validation runs        -> threshold, weight, hyperparameter
test runs              -> final metric only
```

Nếu cùng scenario có nhiều repetition, không để window của cùng run xuất hiện ở nhiều split. Nếu ranker học có giám sát từ run fault (Hướng 2, mục 12.4), evaluation-protocol-v1 mục 5.3 xếp đây là **protocol extension riêng**: không được dùng lại run fault của validation/test làm dữ liệu huấn luyện. Việc giữ **case/target chưa thấy** cho test (leave-one-case-out) là đề xuất, cần extension đó quyết định.

## 8. Feature engineering

### 8.1. Feature từ metric của service

- request rate và delta so với baseline (chỉ service có API; bỏ route `/health`, `/ready`);
- error rate và error burst, tách theo `http_status_class` (4xx đồng thời nhiều service là tín hiệu của C7);
- latency p50/p95/p99;
- CPU (`process_cpu_time_seconds_total`) và RSS (`process_memory_usage_bytes`);
- rolling median/MAD;
- slope/trend;
- ratio current/baseline;
- change so với previous window.

### 8.2. Feature từ dependency metric

Từ `lms_dependency_*`, tính theo từng `dependency_identity` rồi tổng hợp:

```text
dep_request_rate
dep_error_rate
dep_timeout_rate
dep_latency_p95
dep_latency_change_ratio
dep_latency_dispersion_over_operations   # độ lệch giữa các operation_name của cùng identity
dep_error_breadth_across_services        # số service cùng lỗi trên cùng loại identity
```

Hai feature cuối là đề xuất chưa kiểm chứng: chúng nhắm vào C2 (độ trễ `course-postgres` tăng đồng loạt theo mọi `operation_name`) và C6/C7 (lỗi `*-identity-token`/`*-identity-jwks` hoặc 401 xuất hiện ở nhiều service cùng lúc).

### 8.3. Feature từ trace

```text
span_count
span_error_ratio
span_duration_mean
span_duration_p95
timeout_count
critical_path_frequency
downstream_dependency_count
abnormal_edge_count
consumer_start_delay_p95      # CONSUMER.start - PRODUCER.start cùng trace, theo queue
consumer_duration_p95         # thời gian xử lý CONSUMER
span_missing_downstream       # trace gốc lỗi nhưng không có span của service đích (dấu hiệu của C6)
```

`consumer_start_delay_p95` thay cho "tuổi message cũ nhất" mà testbed chưa đo (mục 5.5); nó chỉ có khi trace PRODUCER/CONSUMER nối được. `span_missing_downstream` là đề xuất chưa kiểm chứng, dựa trên quan sát ở C6: trace lỗi không có span của service đích.

### 8.4. Feature queue

Từ `rabbitmq_detailed_queue_*`, theo `service_name` (worker tiêu thụ):

```text
queue_ready, queue_unacked, queue_consumers
queue_ready_slope
queue_error_depth            # queue .error
consumers_drop
```

Backlog hiện sau ≈ 9 giây (mục 5.6). Feature queue mô tả worker tiêu thụ chứ không mô tả nguyên nhân gốc (quy ước 2).

### 8.5. Feature từ log

MVP không đưa raw log string trực tiếp vào model. Pipeline:

```text
raw structured log (access log, dependency.failure)
-> normalize dynamic values
-> message/event template
-> aggregate per service/window
```

Feature:

```text
error_log_rate
dependency_failure_count by dependency_identity, error_type
exception_count
timeout_count
unique_template_count
new_template_count
template_frequency
template_delta
template_first_seen
```

Do log của worker rất thưa (mục 5.4), phần lớn giá trị của log nằm ở service API và ở việc nối `dependency.failure` với span lỗi qua `trace_id`/`span_id`. Drain-style parsing, embedding và semantic clustering là Target/Stretch.

### 8.6. Feature registry

Mỗi feature cần metadata:

```text
name
description
modality
entity_level
data_type
unit
aggregation
missing_semantics
normalization
introduced_in_version
```

Feature schema thay đổi phải tăng version; model/config phải ghi feature schema version tương thích.

## 9. Anomaly detection

Bước này là phần đầu của chuỗi kết luận tự động: không có người lọc cảnh báo trước khi incident được mở. Vì vậy đo false positive trên healthy (kể cả tải cao khỏe) là bắt buộc.

### 9.1. Baseline A — Static threshold

Ví dụ ban đầu:

```text
http_error_rate > configured_threshold
http_latency_p95 > configured_threshold
dep_latency_p95 > configured_threshold
cpu_usage > configured_threshold
queue_ready > configured_threshold
```

Threshold phải dựa trên benchmark/config, không hard-code vào logic. Baseline này dễ giải thích, là mốc tối thiểu và là một nửa của baseline "thủ công" tự động (mục 12.6).

### 9.2. Baseline B — Z-score

```text
z = (x - mean) / standard_deviation
```

Z-score có thể dùng làm baseline phụ nhưng nhạy với outlier và distribution lệch.

### 9.3. Baseline C — Robust z-score

```text
robust_z = 0.6745 * (x - median) / MAD
```

Robust z-score là statistical baseline ưu tiên vì dễ triển khai, giải thích và ít nhạy outlier hơn.

### 9.4. Model D — Isolation Forest

Input là vector service-window, ví dụ (rút từ feature mục 8):

```text
[
  http_request_rate,
  http_error_rate,
  http_latency_p95,
  cpu_usage,
  memory_rss,
  dep_error_rate_max,
  dep_latency_p95_max,
  trace_error_rate,
  queue_ready,
  consumer_start_delay_p95,
  log_error_rate
]
```

Worker không có feature HTTP; dùng vector con của các feature áp dụng được (cờ `not_applicable`), hoặc một detector riêng cho nhóm worker. Lựa chọn giữa hai cách chờ pilot.

Output là anomaly score được chuẩn hóa sao cho score cao hơn thể hiện bất thường mạnh hơn. Model phải lưu:

- feature list/order;
- scaler artifact;
- hyperparameters;
- training run IDs;
- code commit;
- detector config version.

### 9.5. Model E — Change-point detection (Target)

Mục tiêu là ước lượng onset:

```text
estimated_start_time
```

có thể dùng Bayesian Online Change Point Detection hoặc detector online đơn giản hơn. Onset là input quan trọng của thành phần thời gian trong xếp hạng (mục 12.3), nên đây là ứng viên ưu tiên đầu tiên của Target nếu `estimated_start_time` từ window đầu tiên quá thô. Không đưa vào MVP nếu chưa có baseline và incident pipeline ổn định.

### 9.6. Deep model (Stretch)

Autoencoder, TCN hoặc LSTM autoencoder chỉ được xem xét khi:

- baseline có failure mode rõ;
- đủ healthy training data;
- có budget đánh giá công bằng;
- accuracy gain hợp lý so với complexity, runtime và khả năng giải thích.

### 9.7. Multi-source fusion

Một chiến lược ban đầu:

```text
A_service = w_m*A_metrics + w_t*A_traces + w_l*A_logs
w_m + w_t + w_l = 1
```

Yêu cầu:

- từng modality score nằm trên scale so sánh được;
- weight thuộc detector config;
- weight tune trên validation hoặc dùng equal weight làm baseline;
- missing modality có fallback được định nghĩa; với worker, `A_logs` thường thiếu (mục 5.4), nên fallback này là trường hợp thường chứ không phải ngoại lệ;
- lưu cả component scores và fused score để giải thích.

Không bắt buộc dùng neural fusion.

## 10. Incident detection và timeline

### 10.1. Lifecycle

```text
NORMAL
-> SUSPECTED
-> OPEN
-> RECOVERING
-> RESOLVED
```

State transition phải deterministic theo config và có test. Khi incident chuyển sang `OPEN`, engine tự khởi chạy bước xếp hạng nguyên nhân và ghi `RcaIncidentResult`; không chờ người xác nhận.

### 10.2. Trigger

Không mở incident từ một điểm score cao đơn lẻ. Baseline trigger có thể là:

```text
fused_score > threshold
for >= 3 consecutive steps
```

hoặc rule đa service/modality:

```text
ít nhất N signal liên quan theo topology/time cùng bất thường
```

Config phải ghi persistence steps, threshold, merge gap và recovery rule. Trace nhiễu (`/ready`, thăm dò DB của `scheduler-worker`) bị loại trước khi tính score, không được tự mở incident.

### 10.3. Correlation

Các anomaly được gộp nếu:

- nằm trong time gap cho phép;
- thuộc cùng connected subgraph của graph v2 (kể cả cạnh async, cạnh xác thực và cạnh dùng chung hạ tầng, mục 11) hoặc cùng workflow;
- không có evidence cho hai fault interval tách biệt.

Mục tiêu là tránh một fault tạo nhiều incident độc lập không cần thiết. Hai rủi ro riêng của v2:

- **Lỗi lộ muộn:** ở C6 lỗi `gateway-identity-token` xuất hiện 72 giây sau khi dừng `identity` với TTL 60 giây (số đo của catalogue v0), và có thể tới khoảng 10 phút với cấu hình mặc định (fault FG ở data-ownership v2 mục 5); C4 cách nguyên nhân gốc nhiều phút. Merge gap và cửa sổ tương quan phải cho phép khoảng cách này mà không gộp nhầm incident độc lập; giá trị chưa kiểm chứng, chốt sau pilot.
- **Triệu chứng nhiều service cùng lúc** (C6, C7): nên thành một incident có nhiều `affected_services`, không phải nhiều incident.

### 10.4. Estimated start

`estimated_start_time` có thể lấy từ:

- window anomaly đầu tiên sau persistence;
- change point;
- timestamp evidence sớm nhất có độ tin cậy đủ.

Evaluation phải ghi rõ tolerance khi so với `fault_start`. Với case có độ trễ nhân quả dài, onset của triệu chứng khác xa `fault_start`; tolerance cho nhóm case này tách riêng theo evaluation-protocol-v1 mục 7.3 và 17 (fault active phải dài hơn độ trễ triệu chứng đo được của chính case; giá trị chưa đo ghi `chưa kiểm chứng`).

### 10.5. Timeline

Ví dụ minh họa cho C3 (job AI chậm vì provider LLM; chuỗi thời gian là minh họa, không phải số đo):

```text
t+00s span CLIENT ai-llm-provider chậm bất thường (ai-worker)
t+20s CONSUMER ai-worker--run-ai-job-v1 kéo dài
t+75s dependency.failure ở ai-worker-course, lỗi muộn phía course
t+90s incident được mở (affected: ai-worker, ai, course)
```

Timeline event phải trỏ tới evidence (metric + nhãn + khoảng thời gian, hoặc `trace_id`/`span_id`), không chỉ chứa câu mô tả thủ công.

## 11. Dynamic dependency graph v2

### 11.1. Graph definition

```text
G(W) = (V, E)
V = service nodes (11 service.name) quan sát trong window W
E = các cạnh caller -> callee thuộc bốn loại dưới đây
```

Bốn loại cạnh:

| Loại | Nguồn | Ý nghĩa |
| --- | --- | --- |
| `sync` | Span CLIENT/SERVER cùng trace và `lms_dependency_*` với `dependency_identity` dạng `<caller>-<callee>` | HTTP đồng bộ giữa service |
| `async` | Span PRODUCER → CONSUMER cùng `trace_id`, nối theo queue đích | Command qua RabbitMQ (async logical edge) |
| `dependency` | `lms_dependency_*` và span CLIENT tới identity hạ tầng | Service → PostgreSQL, MinIO, SMTP, LLM provider (evidence, không phải node candidate) |
| `shared-resource` | Topology tĩnh (catalogue v2 mục 4, hạ tầng chung) | Hai service cùng dùng một tài nguyên vật lý (broker, instance PostgreSQL) hoặc cùng một nguồn xác thực; **không có trong trace**, là prior cho case tranh chấp tài nguyên |

Cạnh `sync` theo catalogue v2 mục 5.1:

```text
gateway -> identity | course | media | notification | scheduler | ai
course -> media
course -> ai
ai-worker -> course
ai-worker -> media
media -> identity
notification-worker -> identity
scheduler-worker -> media
```

Cạnh `async` theo catalogue v2 mục 5.2 (transport thật qua RabbitMQ):

```text
course -> media-worker
ai -> ai-worker
media -> ai-worker
media -> media-worker
notification -> media-worker
notification-worker -> media-worker
notification -> notification-worker
notification-worker -> notification-worker
```

Hai đặc điểm của graph v2 mà bản trước không có:

- **Có vòng.** `course → ai` (HTTP) và `ai-worker → course` (HTTP) tạo vòng `course → ai → course` (edge `e11`, `e27`); `notification-worker → notification-worker` là cạnh tự lặp hợp lệ (dispatch tự enqueue lại). Thuật toán lan truyền không được giả định DAG và phải giới hạn độ dài đường đi.
- **Cạnh `media → identity` (`e12`) không có trong danh sách cạnh đo được** ở catalogue v0 mục 1.1; có thể workflow regression chưa kích hoạt (chưa kiểm chứng). Validation (mục 11.6) phải xem đây là coverage, không phải lỗi.

Hạ tầng là evidence graph: `<service>-postgres`, `media-minio`, `notification-smtp`, `ai-llm-provider`, `<service>-rabbitmq`, `<service>-identity-token`, `<service>-identity-jwks` có thể nằm trong evidence graph nhưng không vào candidate set chính.

### 11.2. Dynamic thay vì static

Graph được xây theo run/window vì route, traffic và service version có thể thay đổi. Graph thiết kế ở [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) mục 5–6 (edge `e01–e29`) dùng để **validate** graph quan sát, không thay thế. Riêng cạnh `shared-resource` chỉ lấy từ topology thiết kế vì trace không biểu diễn được tranh chấp tài nguyên.

Tempo service graph có thể dùng đối chiếu, nhưng representation phục vụ thuật toán do `training/graph/` quản lý và version hóa; kết quả tham chiếu bằng `graph_ref`.

### 11.3. Quy tắc quy về chủ sở hữu (identity → candidate)

Candidate là service, còn nhiều tín hiệu gắn với `dependency_identity`. Engine cần một bảng quy đổi xác định. Đề xuất, suy từ catalogue v2 mục 2.2, 4, 5 và data-ownership v2 mục 4 (chờ xác nhận):

| Identity | Quy về candidate |
| --- | --- |
| `<service>-postgres`, `<service>-rabbitmq` | `<service>` (kể cả khi bên dùng là worker cùng owner) |
| `media-minio` | `media` (thao tác bởi `media`, `media-worker`) |
| `notification-smtp` | `notification-worker` (SMTP thuộc `notification-worker`) |
| `ai-llm-provider` | `ai` (chủ sở hữu); process chạm provider là `ai-worker` |
| `<caller>-<callee>` (HTTP) | `<callee>` |
| `<caller>-identity-token`, `<caller>-identity-jwks` | `identity` |

Worker và API cùng owner dùng chung schema DB nhưng khác `service.name` (catalogue v2, quy tắc 7), nên cùng một nguyên nhân có thể có bằng chứng ở `ai-worker` trong khi ground truth ghi `ai` (C3) hoặc ở `media-worker` trong khi ground truth ghi `media` (C4). Engine xuất candidate theo `service.name` quan sát được; chỉ số chính chấm đúng `root_cause_service` của `RunGroundTruth`; evaluation-protocol-v1 mục 4.2 đề xuất thêm **owner-level Top-K** (gộp `X` và `X-worker`) làm diagnostic phụ, không thay chỉ số chính (đề xuất chờ Đức xác nhận).

### 11.4. Edge weight

Baseline:

```text
weight(u, v) = normalized_call_count
```

Target:

```text
weight(u, v) =
    alpha * normalized_call_count
  + beta  * normalized_latency_change
  + gamma * normalized_error_change
```

Weight formula và alpha/beta/gamma thuộc graph/RCA config. Mỗi loại cạnh có thêm một prior riêng (`sync`, `async`, `shared-resource`, `auth`); giá trị prior chưa có, học hoặc tune trên validation.

### 11.5. Async edge, cạnh xác thực và cạnh dùng chung

**Async edge.** Quan hệ producer → consumer được xây từ cặp span PRODUCER/CONSUMER cùng `trace_id`, rồi quy PRODUCER về chủ sở hữu command bằng queue đích hoặc command catalogue (mục 5.3), không bằng `service.name` của span. Ví dụ `notification → media-worker` cho command `media.notification-usage.start-job`. Nếu trace async thiếu, có thể fallback bằng queue đích và tương quan thời gian nhưng phải đánh dấu confidence thấp hơn; fallback bằng `message_id` chỉ khả thi nếu `message_id` được ghi vào span (chưa kiểm chứng; contract v2 mục 8 chỉ yêu cầu `command_name`, `queue`, `attempt`).

**Cạnh xác thực (ADR-004).** `gateway` và mọi service verify token đều phụ thuộc `identity` qua `<caller>-identity-token` và `<caller>-identity-jwks`. Đây là cạnh tần suất thấp (token làm mới nền khoảng 5 phút mỗi cặp, JWKS khi khởi động hoặc cache hết hạn) nên **đa số window không có call nào trên cạnh này**. Hệ quả: `identity` hỏng không biểu hiện ngay; token đã có vẫn dùng đến khi hết hạn (stale-while-error). Graph phải mang cạnh này như cạnh thiết kế luôn tồn tại (đưa vào candidate khi có bằng chứng lỗi), không chỉ cạnh quan sát được trong window.

**Cạnh dùng chung (`shared-resource`).** Mỗi worker có queue riêng nhưng chung một broker RabbitMQ và một instance PostgreSQL 17 chứa 6 logical DB (data-ownership v2 mục 4). Cạnh này cho phép đường nhân quả "A chiếm tài nguyên chung → B chậm" mà không có cạnh gọi nào giữa A và B (C1, C2). Vì cơ chế này (broker hoặc PostgreSQL bị tranh chấp) **chưa được chạy thật** (catalogue v0, C1), cạnh dùng chung chỉ là prior yếu; ablation (mục 20.2) phải đo giá trị của nó.

**Cạnh `scheduler → scheduler-worker`.** Không cùng trace; hai bên chỉ gặp nhau qua bảng job/run trong `scheduler_db`. Đưa vào graph như cạnh thiết kế "cùng owner, bàn giao qua DB", không suy từ trace.

### 11.6. Graph validation

Kiểm tra:

- edge ngoài service catalogue v2 (so với `e01–e29`);
- self-loop: chỉ hợp lệ với `notification-worker → notification-worker` (`e19`); self-loop khác là lỗi;
- caller/callee đảo chiều;
- trace sampling làm mất edge;
- graph disconnected bất thường;
- async edge không nối được PRODUCER/CONSUMER, hoặc quy PRODUCER về sai owner;
- cạnh nhiễu từ trace `/ready` và thăm dò của `scheduler-worker`;
- dependency edge xuất hiện trong workflow đúng;
- cạnh chỉ có trong thiết kế (xác thực, dùng chung, scheduler → worker): ghi nhận là "thiết kế", không tính vào chỉ số coverage trace.

## 12. RCA candidate ranking

### 12.1. Granularity và candidate set

Primary candidate là service. Candidate set mặc định theo catalogue v2 mục 8 (10 service/worker):

```text
identity, course, media, media-worker, notification, notification-worker,
scheduler, scheduler-worker, ai, ai-worker
```

`gateway` là symptom mặc định, chỉ là candidate khi evaluation protocol có gateway fault. Hạ tầng (PostgreSQL, RabbitMQ, MinIO, SMTP, LLM provider) không nằm trong Top-K chính; chúng xuất hiện ở trường `component` và `dependency_identity` của candidate và trong `evidence`. Candidate set được freeze trong evaluation protocol (`service-candidates.v1`, [evaluation-protocol-v1](evaluation-protocol-v1.md) mục 4.1, khớp danh sách trên); đưa `gateway` vào candidate chỉ khi có gateway fault và phải tăng `candidate_set_version`.

Ví dụ:

```text
root_cause_service   = ai
root_cause_component = ai-llm-provider
```

### 12.2. Vì sao không dùng “highest anomaly wins”

Symptom ở service upstream có thể có anomaly score lớn hơn nguyên nhân gốc, và ở v2 nguyên nhân gốc có thể không nằm trên đường request của symptom. Hai ví dụ:

- **C6:** khi `gateway` không lấy lại được service token, mọi route qua `gateway` lỗi 504 dù `course`, `media` khỏe. `gateway` có anomaly lớn nhất; nguyên nhân gốc là `identity`, chỉ thấy qua cạnh `gateway-identity-token` lỗi (và có thể chỉ qua sự im lặng của `identity`).
- **C1:** `upload-complete` của `media` timeout; nguyên nhân gốc `notification-worker` (chiếm broker/PostgreSQL dùng chung), không có cạnh gọi nào giữa hai bên.

Nếu chỉ rank severity, `gateway` hoặc `media` đứng đầu. "Earliest anomaly" cũng sai khi nguyên nhân là tranh chấp tài nguyên không có onset riêng. Chính các case này là lý do engine phải dùng đồ thị, thứ tự thời gian và bằng chứng kết hợp.

### 12.3. Score components

#### Anomaly severity — `A(s)`

Fused anomaly magnitude của service trong incident window.

#### Temporal precedence — `T(s)`

Service/evidence xuất hiện sớm hơn symptom liên quan được score cao hơn. Cần robust với window overlap, sampling noise và độ trễ nhân quả dài (C4, C6). Với service **im lặng** (mục 7.3), thời điểm im lặng là mốc thời gian của candidate.

#### Propagation compatibility — `P(s)`

Đánh giá thứ tự và hướng symptom có tương thích với một **đường lan ngược** từ candidate tới các service có triệu chứng, trên evidence graph v2 (mục 11), cho cả bốn loại cạnh:

- `sync`: lỗi ở callee hoặc dependency của callee lan ngược tới caller;
- `async`: producer chậm làm consumer đói việc, consumer chậm tạo backlog ở queue của consumer và làm bên chờ kết quả timeout; triệu chứng nằm ở queue của worker tiêu thụ (quy ước 2, mục 5.7) chứ không ở producer;
- `auth` (cạnh xác thực): lỗi `identity` biểu hiện ở **mọi** service verify token cùng lúc, sau một khoảng yên lặng;
- `shared-resource`: tranh chấp tài nguyên chung biểu hiện ở service không có cạnh gọi tới candidate; prior yếu.

Mỗi loại cạnh có semantics và prior riêng; công thức lan truyền cho cạnh async, auth và shared không dùng nguyên văn công thức sync.

#### Edge degradation — `E(s)`

Đánh giá outgoing dependency của service (và của worker cùng owner) có latency/error/timeout tăng và component evidence có thuộc service đó hay không, theo bảng quy đổi mục 11.3.

#### Evidence strength — `V(s)`

Tổng hợp mức thay đổi metric, span bất thường, `dependency.failure` log và độ ý nghĩa thống kê, có chiết khấu khi telemetry của candidate thiếu (mục 5.5).

### 12.4. Hai hướng xếp hạng (chọn sau pilot)

Phần chính của đề tài là mô hình ML + dependency graph (ADR-002). Hai hướng dưới đây cùng dùng các component ở 12.3; **cả hai chưa kiểm chứng trên v2**.

**Hướng 1 — điểm tuyến tính có giải thích** (kế thừa bản trước):

```text
R(s) =
    w1 * A(s)
  + w2 * T(s)
  + w3 * P(s)
  + w4 * E(s)
  + w5 * V(s)
```

Weight khởi tạo tham khảo, kế thừa từ bản trước và chưa được kiểm chứng trên topology v2:

```text
w1 = 0.30
w2 = 0.20
w3 = 0.20
w4 = 0.20
w5 = 0.10
```

Đây không phải weight cuối cùng. Weight phải tune trên validation hoặc đánh giá bằng sensitivity analysis; không thay sau khi xem final test result.

**Hướng 2 — ranker học từ dữ liệu fault injection** (đề xuất chờ xác nhận): mỗi cặp (incident, candidate) là một dòng đặc trưng gồm năm component score, đặc trưng đồ thị (khoảng cách tới symptom theo từng loại cạnh, có hay không cạnh async/auth/shared tới symptom, số service symptom ở hạ lưu, độ rộng của bằng chứng) và nhãn "trùng ground truth". Mô hình xếp theo xác suất (ví dụ hồi quy logistic hoặc gradient boosting của scikit-learn) hoặc learning-to-rank; loại mô hình chưa chọn. Ràng buộc:

- cần dữ liệu fault có nhãn dành cho huấn luyện: evaluation-protocol-v1 mục 5.3 coi đây là protocol extension riêng và cấm dùng lại run fault của validation/test; với số run `K × R` ở hiện trạng (chỉ C6 đã chạy), dữ liệu có thể không đủ để học, nên Hướng 1 là phương án thực tế;
- đo khái quát hóa theo case/target chưa thấy nếu đủ số case (leave-one-case-out là đề xuất);
- số run fault có thể quá ít để học ổn định; nếu ranker học không vượt Hướng 1 và các baseline, báo cáo trung thực thay vì giữ ranker phức tạp;
- đặc trưng không được chứa trực tiếp tên fault hoặc nhãn.

Hướng 1 vừa là phương án chính khi dữ liệu ít, vừa là baseline cho Hướng 2, vừa cung cấp component score cho phần giải thích.

### 12.5. Propagation score

Một dạng triển khai cho cạnh sync:

```text
P(s) = sum over affected upstream u:
       path_weight(u -> ... -> s)
       * anomaly(u)
       * temporal_consistency(s, u)
```

Trong đó:

```text
temporal_consistency(s, u) cao
nếu evidence của s xuất hiện trước hoặc không muộn hơn symptom ở u
```

Cho cạnh async, auth và shared, đề xuất (chưa kiểm chứng):

- **async:** dùng `consumer_start_delay_p95` và độ sâu queue của worker tiêu thụ làm "symptom của cạnh"; candidate là producer hoặc là tài nguyên mà consumer dùng; phân biệt bằng việc dependency của chính consumer (ví dụ `media-minio`, `media-postgres` của `media-worker`) bình thường hay không (nếu bình thường mà backlog vẫn tăng, nguyên nhân nhiều khả năng ở chỗ khác);
- **auth:** `temporal_consistency` chấp nhận độ trễ tới khoảng TTL token; độ rộng (nhiều service cùng lỗi trên `*-identity-token` hoặc 4xx) là bằng chứng chính; candidate `identity` được cộng điểm khi `identity` im lặng hoặc khi `*-identity-jwks` refetch;
- **shared:** chỉ cộng khi không có đường `sync`/`async` giải thích được symptom.

Đường đi có vòng (`course → ai → course`) cần giới hạn độ dài và tránh đếm một symptom hai lần.

### 12.6. Baseline RCA

Phải có tối thiểu:

1. **Max anomaly:** rank theo anomaly score.
2. **Earliest anomaly:** rank theo estimated onset.
3. **Graph-aware simple:** anomaly + graph relation/centrality hoặc propagation rule đơn giản (chỉ cạnh sync).
4. **Baseline thủ công tự động** (đối chứng theo ADR-002): ngưỡng + tìm trace lỗi/chậm nhất, kết luận service gây lỗi/chậm trên đường request của symptom; đo lặp được. Baseline này mô phỏng cách truy vết thủ công nên không thấy nguyên nhân nằm ngoài đường request; tên `base-manual-auto`, chạy trên cùng run, cùng candidate set và xuất cùng schema `RcaIncidentResult` (evaluation-protocol-v1 mục 15.2). Luật chi tiết (ngưỡng nào, tìm trace thế nào, đổi trace thành ranking ra sao) là đề xuất chưa viết; version hóa, chọn trên validation, freeze trước final test. Protocol còn đưa constant ranking và random ranking làm mốc diagnostic.
5. **Proposed method:** Hướng 1 hoặc Hướng 2 (mục 12.4).

PageRank-like ranking có thể là baseline bổ sung. Causal/statistical analysis trên top-N là Stretch. Thử nghiệm với người thật dùng Grafana/Tempo/Loki để đo thời gian chẩn đoán (ADR-002) bổ sung cho baseline tự động, không thay thế.

### 12.7. Tie-breaking và determinism

- tie-break rule phải cố định;
- sort cuối cùng không phụ thuộc iteration order của dictionary/graph;
- cùng input/config phải tạo cùng candidate order;
- random algorithm phải lưu seed;
- score NaN/missing phải có fallback rõ.

### 12.8. Kết luận tự động và `insufficient_evidence`

Bước kết luận không cần người can thiệp, nên engine phải tự quyết định khi nào **không** kết luận. Engine trả `verdict = "insufficient_evidence"` và `ranking` rỗng (schema catalogue v0 mục 5.2) khi, ví dụ:

- `telemetry_quality` cho thấy thiếu tín hiệu cần cho cơ chế đang nghi (mục 5.5);
- không candidate nào vượt ngưỡng điểm hoặc khoảng cách giữa hạng 1 và hạng 2 dưới ngưỡng;
- incident chỉ có triệu chứng ở `gateway` mà không thấy bằng chứng nào ở service/dependency khác.

Ngưỡng cụ thể chưa có; chốt trên validation. Đánh giá phải đo tỷ lệ `insufficient_evidence` và độ đúng khi `verdict = "ranked"`, để engine không "tránh" case khó bằng cách từ chối.

## 13. Evidence extraction

### 13.1. Mục tiêu

Mỗi candidate phải có evidence máy đọc được, **do engine chọn và nén sẵn**, trả lời:

- tín hiệu nào bất thường;
- baseline và incident value là gì;
- thay đổi bắt đầu khi nào;
- dependency/span/log nào liên quan;
- evidence ủng hộ hoặc phản bác candidate thế nào.

Mỗi evidence tham chiếu lại được telemetry gốc: `service.name` cùng `trace_id`/`span_id` (trace, log) hoặc `metric` + nhãn + khoảng thời gian (metric) (catalogue v0 mục 5.1).

### 13.2. Metric evidence

```text
metric (tên) + labels + window
baseline_median/MAD
incident_value
change_ratio
statistical_score
first_observed_at
```

Ví dụ họ metric dùng làm evidence: `lms_dependency_duration_seconds` theo `dependency_identity`; `rabbitmq_detailed_queue_messages_ready` theo worker; `http_server_request_error_count_total` theo `http_status_class`; `process_cpu_time_seconds_total`.

### 13.3. Trace evidence

- span có duration/error bất thường;
- `dependency_identity` và `operation_name`;
- đường chứa candidate và service có triệu chứng (cả cạnh async: PRODUCER → CONSUMER cùng trace);
- `trace_id`/`span_id`;
- critical path contribution;
- first degraded edge time.

### 13.4. Log evidence

- `dependency.failure` burst theo `dependency_identity` và `error_type`;
- log nối với span lỗi qua `trace_id`/`span_id`;
- access log `http.server.request` theo status;
- mẫu log mới xuất hiện lần đầu.

### 13.5. Evidence aggregation và dữ liệu không tin cậy

Không cộng số lượng evidence thô vì modality nhiều record có thể áp đảo. Cần normalize theo modality và giới hạn duplicate evidence cùng template/trace. Tập evidence trong kết quả là tập đã **chọn và nén**, không phải log hoặc trace thô.

Mọi chuỗi trích từ log hoặc trace (kể cả `summary`) là **dữ liệu không tin cậy**: có thể chứa prompt injection khi sau này được đọc bởi agent (mục 16). Engine không diễn giải chuỗi đó như chỉ dẫn và giới hạn độ dài `summary`.

Ví dụ minh họa dạng một phần tử `ranking[]` cho C6 (giá trị là chỗ giữ chỗ, không phải kết quả đo; cấu trúc chuẩn ở catalogue v0 mục 5.2):

```json
{
  "rank": 1,
  "candidate": {
    "service": "identity",
    "component": "identity",
    "dependency_identity": "gateway-identity-token"
  },
  "score": "<score>",
  "mechanism": "dependency_unavailable",
  "propagation_path": ["identity", "gateway"],
  "evidence": [
    {
      "kind": "trace",
      "service": "gateway",
      "trace_id": "<trace_id>",
      "span_id": "<span_id>",
      "summary": "CLIENT gateway-identity-token lỗi, trace không có span của service đích"
    },
    {
      "kind": "metric",
      "service": "gateway",
      "metric": "lms_dependency_error_count_total",
      "labels": { "dependency_identity": "gateway-identity-token" },
      "window": { "start": "<utc>", "end": "<utc>" },
      "summary": "tăng sau khoảng yên lặng"
    }
  ]
}
```

## 14. Đầu ra: RcaIncidentResult

Kết quả cuối của engine là một `RcaIncidentResult` cho mỗi incident. **Schema và nơi lưu nằm ở một chỗ duy nhất:** [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 5.2 (schema) và 5.3 (nơi lưu, đề xuất). Tài liệu này không chép lại; đổi schema chỉ sửa ở đó và tăng `rca_result_schema_version`.

Ánh xạ từ các thành phần của engine sang trường kết quả:

| Trường `RcaIncidentResult` | Do thành phần nào sinh ra |
| --- | --- |
| `incident_id`, `window`, `symptom` | Incident (mục 6.5, 10) |
| `run_id` | Có khi chạy thí nghiệm, `null` khi giám sát thật |
| `telemetry_quality` | `TelemetryQualityReport` của artifact (mục 5.8) |
| `verdict` | Bước kết luận (mục 12.8): `ranked` hoặc `insufficient_evidence` |
| `model` (`name`, `version`, `graph_ref`, `config_ref`) | Detector + ranker + graph snapshot đã dùng (mục 11, 17) |
| `ranking[].candidate`, `score`, `mechanism` | Ranker (mục 12) |
| `ranking[].propagation_path` | Đường lan ngược trên graph v2 (mục 11, 12.5) |
| `ranking[].evidence[]` | Evidence extraction (mục 13) |

Yêu cầu đối với engine:

- mỗi evidence tham chiếu lại được telemetry gốc (mục 13.1);
- không có `ground_truth` trong kết quả; đánh giá offline đối chiếu `RunGroundTruth` với kết quả theo `run_id`;
- `verdict = "insufficient_evidence"` thì `ranking` rỗng;
- kết quả là file JSON bất biến cho mỗi incident, kèm `manifest.json` (đề xuất lưu tại `aiops-platform/training/results/<run_id hoặc ngày>/<incident_id>.json`; chưa có thư mục này); kết quả mới là file mới;
- `graph_ref` trỏ được tới graph snapshot đã dùng để xác minh sau này.

Đây là đầu vào duy nhất của MCP/agent thứ yếu (mục 16): MCP đọc kết quả, không tính lại.

## 15. Case phức tạp và cách engine xử lý

Danh mục đầy đủ (kịch bản gây lỗi, triệu chứng, ground truth, tín hiệu xác nhận, trạng thái kiểm chứng) ở [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) mục 3; mỗi case có ground truth theo `RunGroundTruth`. Tiêu chí của ADR-002: nguyên nhân gốc nằm **ngoài đường request của triệu chứng**, thường cách hai bước trở lên qua dependency dùng chung, tầng async hoặc xác thực. Bảng dưới chỉ ghi điều engine phải làm được; trạng thái lấy từ catalogue, không đánh giá lại.

| Case | Gốc → triệu chứng | Cạnh/cơ chế engine cần | Tín hiệu chính và giới hạn | Trạng thái (catalogue v0) |
| --- | --- | --- | --- | --- |
| C1 | `notification-worker` → `media` (`upload-complete` timeout) | `async` + `shared-resource` (broker, PostgreSQL); queue của worker tiêu thụ | `rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"}` tăng; CONSUMER của `media-worker` bắt đầu muộn so với PRODUCER. Không có cạnh gọi giữa hai bên | Đã đo tín hiệu; chuỗi lan sang `media-worker` là **giả thuyết**, cần chạy thật |
| C2 | `course` (export CSV giữ kết nối DB) → `gateway-course` p95 tăng | `dependency` (`course-postgres`) | `lms_dependency_duration_seconds` của `course-postgres` tăng đồng loạt theo mọi `operation_name`; CPU/RSS của `course`. Thiếu metric pool, không phân biệt "pool cạn" và "DB chậm" | Đã đo tín hiệu |
| C3 | `ai` (`ai-llm-provider` chậm) → job AI kẹt, `course` lỗi muộn | `dependency` + vòng `course → ai → course`; quy về owner `ai` cho process `ai-worker` | Span CLIENT `ai-llm-provider POST chat/completions` dài hoặc lỗi; CONSUMER `run-ai-job` kéo dài; lỗi muộn ở `ai-worker-course` | Đã đo tín hiệu; stub chậm chưa chạy |
| C4 | `media` (`media-minio` chậm) → thumbnail kẹt → `scheduler-worker` xóa media | `dependency` (`media-minio`) + `async` + bàn giao qua DB tới `scheduler-worker` | Span `media-minio *` chậm/lỗi; trace "Dọn media theo lịch" có số `remove-object` bất thường. `scheduler` và `scheduler-worker` không cùng trace; lỗi lộ muộn nhiều phút | Đã đo tín hiệu; cơ chế chèn trễ chưa chạy |
| C5 | `identity` (`identity-postgres` chậm) → batch notification `PARTIAL_FAILED` | `sync` (`notification-worker-identity`) + `dependency` (`identity-postgres`) | Span `notification-worker-identity GET /internal/v1/students` và `identity-postgres student.list` chậm; **log không có lỗi**, triệu chứng nghiệp vụ không có trong telemetry | Đã đo tín hiệu; chèn trễ chưa chạy |
| C6 | `identity` dừng → `gateway` lỗi 504 hàng loạt sau khoảng yên lặng | `identity` (cạnh `gateway-identity-token`); `identity` im lặng | Span CLIENT lỗi `gateway-identity-token`; trace gốc không có span của service đích; `lms_dependency_error_count_total{dependency_identity="gateway-identity-token"}` tăng | **Đã chạy** bởi `tracing-smoke`: login 504 ngay, lỗi token xuất hiện 72 giây sau khi dừng (TTL 60 giây), phục hồi sau `unpause` |
| C7 | `identity` đổi khóa ký → 401 đồng loạt | `identity` (cạnh `*-identity-jwks`), độ rộng nhiều service | Tăng 4xx/`SERVICE_TOKEN_INVALID` ở nhiều service cùng lúc; span `*-identity-jwks` refetch; `identity` vẫn chạy nên không im lặng | Đã đo tín hiệu; cơ chế đổi khóa chưa chạy |

Ba điểm rút ra cho thiết kế engine:

1. **Triệu chứng và nguyên nhân khác service, khác đường request** (C1, C4, C6): hạng 1 không được là service có anomaly cao nhất; cần cạnh async, auth và shared (mục 11.5).
2. **Bằng chứng gián tiếp** (C2 thiếu metric pool, C5 không có log lỗi, C6 `identity` im lặng): engine ghi rõ tín hiệu thiếu trong `telemetry_quality` và có thể trả `insufficient_evidence` thay vì ép đáp án (mục 12.8).
3. **Chỉ C6 đã được chạy thật.** Các case còn lại chỉ mới đo được sự tồn tại của tín hiệu; chúng không được dùng làm case đánh giá cho tới khi chuỗi nhân quả được chạy thật (việc của mảng AI, catalogue v0 mục 6). Kết quả đánh giá phải ghi riêng trạng thái này.

Fault FF (quá tải tài nguyên bất kỳ) không có case riêng; `process_cpu_time_seconds_total` và `process_memory_usage_bytes` là bằng chứng phụ cho C1–C2.

## 16. MCP và agent (thành phần thứ yếu)

Phần này **thứ yếu** và chỉ làm sau khi RCA engine và phần đánh giá đạt (ADR-002). Không có mục nào trong DoD của RCA engine (mục 25.1–25.6) phụ thuộc vào nó; DoD riêng ở mục 25.7. Chưa có `aiops-platform/mcp/` hay `aiops-platform/agent/`.

### 16.1. Vai trò

MCP server chỉ đọc (`aiops-platform/mcp/`) phục vụ giai đoạn suy luận và giám sát: để LLM đọc **kết quả của RCA engine** (incident, xếp hạng, điểm, bằng chứng đã chọn sẵn, graph mô hình đã dùng) rồi viết báo cáo có dẫn chứng. Dữ liệu nguồn là các `RcaIncidentResult` (mục 14). MCP không dùng cho huấn luyện; huấn luyện đọc dataset trực tiếp.

Agent loop và MCP client nằm ở runtime trong `aiops-platform/agent/`. Service `ai` của LMS chưa nói MCP, nên không dùng làm agent runtime.

### 16.2. Ràng buộc bắt buộc

- **Chỉ đọc kết quả, không truy vấn tùy ý.** MCP không cấp truy vấn tùy ý vào Prometheus, Tempo hoặc Loki. Bằng chứng gốc chỉ đi kèm trong kết quả.
- **Agent không thay mô hình ML.** Xếp hạng do RCA engine quyết định; agent không tự xếp hạng lại hay phản bác bằng suy đoán. Chứng cứ không đủ (`verdict = "insufficient_evidence"`) thì báo cáo ghi "không đủ chứng cứ".
- **Giới hạn và xác thực:** chỉ đọc, giới hạn khoảng thời gian và số bản ghi trả về, có xác thực.
- **Log và trace là dữ liệu không tin cậy.** `summary` và mọi chuỗi trích từ log/trace có thể chứa prompt injection; prompt của agent phải coi chúng là dữ liệu, không phải chỉ dẫn.
- **Tool đọc ground truth** (`get_ground_truth`) chỉ bật khi đánh giá offline, tắt khi chạy thật để agent không đọc đáp án.
- Nhóm tool cụ thể (liệt kê incident, đọc một kết quả, đọc graph đã dùng) là **đề xuất chờ xác nhận**; chỉ `get_ground_truth` được ADR-002 nêu tên.

### 16.3. Đánh giá

Chất lượng báo cáo của agent (độ đúng, dẫn chứng, độ phủ) chỉ được đánh giá khi phần MCP/agent được làm; không phải tiêu chí hoàn thành đề tài (ADR-002).

## 17. Artifact và configuration

### 17.1. Artifact layout

Vị trí và tên thư mục dưới đây là **đề xuất chờ xác nhận**; repository chưa có `training/` hay `experiments/`. Manifest và lineage của telemetry artifact theo [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md); `RunGroundTruth` bất biến, không nằm trong artifact của engine. `RcaIncidentResult` lưu theo catalogue v0 mục 5.3.

```text
aiops-platform/training/
├── results/<run_id hoặc ngày>/
│   ├── <incident_id>.json          # RcaIncidentResult (bất biến)
│   └── manifest.json               # incident_id, run_id, created_at, sha256
└── runs/<run_id>/                  # artifact trung gian của engine (đề xuất)
    ├── data-quality.json           # TelemetryQualityReport
    ├── service-features.parquet
    ├── edge-features.parquet
    ├── anomaly-scores.parquet
    ├── incidents.json
    ├── graph-snapshot.json         # đích của graph_ref
    └── evaluation.json
```

File lớn có thể nằm ngoài Git; các JSON được phép chỉ chứa URI, checksum và metadata. Không commit raw telemetry lớn nếu repository policy không cho phép. Kết quả đã ghi không sửa; kết quả mới là file mới.

### 17.2. Feature config

```yaml
feature_config_version: 1
feature_schema_version: 1
window_size_seconds: 60
step_seconds: 15
modalities: [metrics, traces, logs]
exclude_routes: [/health, /ready]
exclude_noise_traces: [scheduler-worker-poll, ready]
normalization: robust_per_service
missing_policy: explicit_flags
```

Các giá trị là minh họa, chờ pilot.

### 17.3. Detector config

```yaml
detector_config_version: 1
detector: isolation_forest
feature_schema_version: 1
random_seed: 20260819
threshold: <validation-selected>
modality_weights:
  metrics: 0.4
  traces: 0.4
  logs: 0.2
```

Trọng số modality là giá trị khởi điểm minh họa, không phải kết quả tune.

### 17.4. Incident config

```yaml
incident_config_version: 1
persistence_steps: 3
merge_gap_seconds: 60
recovery_steps: 3
minimum_related_services: 1
correlation_window_seconds: <validation-selected>   # cho case trễ nhân quả dài
```

### 17.5. Graph config

```yaml
graph_config_version: 1
edge_types: [sync, async, dependency, shared-resource, auth]
catalogue_ref: service-catalogue-and-topology-v2
edge_type_prior:
  sync: <validation-selected>
  async: <validation-selected>
  auth: <validation-selected>
  shared-resource: <validation-selected>
max_path_length: <validation-selected>
```

### 17.6. RCA config

```yaml
rca_config_version: 1
candidate_level: service
candidate_set: service-candidates.v1   # 10 service/worker theo catalogue v2 mục 8
ranker: linear_score                   # hoặc learned_ranker (mục 12.4)
weights:
  anomaly: 0.30
  temporal: 0.20
  propagation: 0.20
  edge: 0.20
  evidence: 0.10
tie_breaker: service_name
verdict:
  min_score: <validation-selected>
  min_gap_top1_top2: <validation-selected>
```

Trọng số là giá trị tham khảo kế thừa từ bản trước, chưa được tune trên v2. `candidate_set` khớp `service-candidates.v1` của evaluation-protocol-v1 mục 4.1 (khác `service-candidates.v0` của v1 cũ).

### 17.7. Evaluation config

```yaml
evaluation_config_version: 1
unit: incident_run
rca_level: service
top_k: [1, 3]
detection_tolerance_seconds: <protocol-value>
exclude_invalid_runs: true
manual_baseline: automatic_threshold_plus_slowest_trace
```

Mọi placeholder phải được chốt trong protocol trước campaign chính.

## 18. Dataset strategy

### 18.1. Healthy baseline dataset

Workload k6 (`aiops-platform/load/`, chưa có) tạo traffic qua Gateway theo các workflow W1–W7 của catalogue v2 mục 7. Bao gồm:

- normal mixed traffic;
- đợt upload media khỏe (W4);
- batch thông báo lớn nhưng khỏe (W5), vì batch lớn tự nó làm tăng backlog queue và có thể bị nhầm là fault (cơ sở của C1);
- job AI soạn bài khỏe (W6);
- healthy high-load spike;
- nhiều seed/repetition khi tài nguyên cho phép.

Mục đích: fit normal distribution/scaler/detector, đo false positive, kiểm tra workload shift, tránh model học rằng "tải cao = fault".

Dữ liệu seed quy mô lớn (R-10) ghi trực tiếp bằng SQL nên **không tạo trace, log hay command** cho các dòng đó (data-ownership v2 mục 2.9). Seed dùng để có quy mô dữ liệu; telemetry healthy phải đến từ workload gọi API thật.

Thời lượng run được chốt sau pilot, không hard-code 30–60 phút nếu hạ tầng không cần.

### 18.2. Fault-injected dataset

Mỗi run có các phase logic:

```text
warm-up
healthy baseline
fault active
recovery
```

Thời lượng từng phase phải đủ cho window/persistence rule và đủ cho độ trễ nhân quả của từng case (ví dụ C6 cần vượt TTL token), nhưng được rút gọn sau pilot nếu vẫn tạo telemetry ổn định. Mọi run fault chạy song song workload k6 để tạo nhiễu (catalogue v0 mục 3).

### 18.3. Tập scenario và mức tối thiểu

Bản trước dùng 5 scenario × 3 repetition = 15 run cho fault F1–F5 của v1; **không còn áp dụng nguyên văn** vì tập fault đã đổi sang FA–FH và case C1–C7. Tập scenario ứng viên:

| Nhóm | Scenario | Ghi chú |
| --- | --- | --- |
| Case phức tạp | C1–C7 (fault FB, FC, FD, FA, FE, FG, FH) | Chỉ C6 đã chạy thật; còn lại phải chạy thật trước khi vào evaluation (mục 15) |
| Fault đơn | FF (quá tải CPU/bộ nhớ) | Bằng chứng phụ; có thể dùng làm scenario đơn giản đối chiếu |
| Healthy | Các workload ở mục 18.1 | Đo false positive và workload shift |

Theo evaluation-protocol-v1 mục 5.2–5.3, một case C1–C7 chỉ vào campaign khi injector chạy tái lập được, triệu chứng ngoài đường request quan sát được thật trong pilot, có tín hiệu bắt buộc và có ground truth; số repetition `R = 3` (thừa kế v0) là đề xuất chờ Đức xác nhận, repetition đầu cho validation, còn lại cho final test; số case `K` tối thiểu chưa chốt. Hiện trạng chỉ C6 đã chạy (mức smoke). Cơ chế gây lỗi (chèn trễ MinIO/PostgreSQL/SMTP/LLM stub, giới hạn CPU, dừng `auth`) thuộc fault injector của mảng AI.

Ground truth mỗi run theo `RunGroundTruth` ([telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md)). Target có thể mở rộng nếu automation và thời gian đủ; không coi một số lượng run lớn là điều kiện thành công.

### 18.4. External dataset

RCAEval hoặc AnoMod subset là validation bổ sung, không được làm chậm evaluation trên testbed chính. Adapter external dataset phải map rõ service/entity/metric semantics; không trộn kết quả nếu granularity khác mà không giải thích.

## 19. Evaluation protocol

Chi tiết protocol (identity, split, freeze, eligibility, matching, đối chứng thủ công) ở [evaluation-protocol-v1](evaluation-protocol-v1.md) (đề xuất chờ Đức xác nhận); mục này chỉ nêu những gì engine phải xuất để được đánh giá và không chép lại protocol.

### 19.1. Unit of evaluation

Đánh giá chính ở incident/fault-run level, không chỉ point/window level. Một run cần xác định:

- có incident được detect hay không;
- detection time so với fault start;
- `verdict` (`ranked` hay `insufficient_evidence`);
- candidate rank của `root_cause_service` (kèm quy tắc tương đương owner–worker, mục 11.3);
- evidence có đủ và đúng reference hay không;
- run có hợp lệ theo data quality không.

Point-level metric dùng chẩn đoán detector nhưng không thay incident-level result.

### 19.2. Detection metrics

#### Precision

```text
TP / (TP + FP)
```

#### Recall

```text
TP / (TP + FN)
```

#### F1

```text
2 * Precision * Recall / (Precision + Recall)
```

#### False Positive Rate

Đo trên healthy runs/healthy intervals để phản ánh alert fatigue; vì kết luận không có người lọc, đây là metric quan trọng.

#### Detection Delay

```text
detected_at - fault_start
```

Protocol phải quy định cách xử lý detection trước fault, sau fault end, nhiều incident trong một run và tolerance do windowing và do độ trễ nhân quả dài của một số case.

### 19.3. RCA metrics — service-level

#### Top-1 Accuracy

`root_cause_service` đứng rank 1.

#### Top-3 Accuracy

`root_cause_service` nằm trong ba candidate đầu.

#### Mean Reciprocal Rank

```text
MRR = mean(1 / rank(root_cause_service))
```

#### Average Rank

Dùng bổ sung để diễn giải lỗi xếp hạng.

#### Tỉ lệ `insufficient_evidence` và độ đúng khi `ranked`

Báo cáo riêng hai số này, tránh một "accuracy tổng hợp" che mất trade-off. Theo evaluation-protocol-v1 mục 16 và 18, `insufficient_evidence` là miss ở chỉ số end-to-end (Top-1/Top-3 miss, reciprocal rank 0), được đếm riêng và không vào chỉ số có điều kiện.

Không tính `root_cause_component` trong metric chính. Component evidence được đánh giá định tính hoặc bằng metric phụ tách biệt khi protocol định nghĩa.

### 19.4. Thời gian chẩn đoán và đối chứng thủ công

ADR-002 thêm thời gian chẩn đoán (thủ công so với AI) bên cạnh Top-1/Top-3/MRR và ablation:

- **Baseline thủ công tự động** (ngưỡng + trace lỗi/chậm nhất): đo lặp được, so sánh Top-K và thời gian trên cùng run (mục 12.6).
- **Thử nghiệm vài người thật** dùng Grafana/Tempo/Loki: đo thời gian chẩn đoán. Thiết kế thử nghiệm người ở evaluation-protocol-v1 mục 15.3; chưa có lần chạy nào, chưa có thời gian chẩn đoán đo được.

Kết quả báo cáo tách theo nhóm: case có nguyên nhân trên đường request và case nguyên nhân ngoài đường request (mục 15). Luận điểm của đề tài chỉ được khẳng định ở nhóm sau nếu engine vượt baseline thủ công ở đó trên các case đã chạy thật.

### 19.5. System metrics

- telemetry query/export time (kể cả số truy vấn Tempo, vì Tempo testbed dễ OOM);
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của engine;
- artifact size;
- instrumentation overhead trên application throughput/p95 latency.

### 19.6. Explainability checks

Mỗi Top-K result phải có:

- component scores;
- ít nhất một evidence reference khi data cho phép (`trace_id`/`span_id` hoặc metric + nhãn + window);
- `propagation_path`;
- vị trí trên timeline;
- machine-readable artifact (`RcaIncidentResult`);
- config/version metadata và `graph_ref`.

Chất lượng báo cáo của agent không thuộc mục này (mục 16.3).

## 20. Ablation và robustness

MVP phải có ít nhất một robustness evaluation focused để trả lời RQ4: controlled trace dropping/sampling simulation trên telemetry artifact **hoặc** missing-modality evaluation. Kiểm tra này tái sử dụng baseline experiment thu với 100% trace sampling và không yêu cầu mở rộng controlled-fault campaign. Expanded matrix thuộc Target.

### 20.1. Modality ablation

```text
M
M + T
M + L (nếu phù hợp)
M + T + L
```

Trong đó M = metrics, T = traces, L = logs. Với v2, phần lớn evidence async đến từ trace; kỳ vọng bỏ T làm giảm khả năng của các case async (chưa kiểm chứng, cần đo).

### 20.2. Graph ablation

```text
RCA không graph
vs
RCA với graph chỉ cạnh sync
vs
RCA với graph đầy đủ (sync + async + auth + shared-resource)
```

Tách từng loại cạnh (bỏ async, bỏ auth, bỏ shared-resource) để đo giá trị riêng của chúng ở case C1–C7. Cạnh `shared-resource` chỉ là prior chưa kiểm chứng nên kết quả có thể không dương; báo cáo trung thực.

### 20.3. Temporal ablation

```text
không có temporal precedence
vs
có temporal precedence
```

### 20.4. Evidence ablation

```text
không có evidence score
vs
có evidence score
```

Evidence ablation là Target nếu budget MVP chỉ đủ ba ablation chính.

### 20.5. Ranker ablation

Nếu dùng Hướng 2 (mục 12.4): so sánh ranker học với điểm tuyến tính (Hướng 1) và với baseline Max/Earliest anomaly trên cùng split.

### 20.6. Missing trace

MVP có thể chọn một mức trace dropping/sampling simulation có kiểm soát trên telemetry artifact. Expanded Target có thể so sánh nhiều mức, ví dụ:

```text
20%
50%
80%
```

traces/spans sau khi đã có 100% sampling baseline. Cần cố định random seed và không thay ground truth; ba mức trên không phải matrix bắt buộc của MVP. Với v2, mất span PRODUCER/CONSUMER làm đứt cạnh async, nên đánh giá cần có fallback theo queue đích (mục 11.5).

Đánh giá:

- graph edge coverage (riêng async);
- detection metric;
- service-level RCA Top-K/MRR;
- fallback từ metrics/logs;
- failure threshold của phương pháp.

### 20.7. Missing modality

MVP có thể chọn một missing-modality evaluation thay cho trace dropping/sampling simulation. Pipeline phải ghi rõ modality bị thiếu thay vì coi score bằng 0 không điều kiện. Worker đã thiếu log trong thực tế (mục 5.4), nên đây là kịch bản gần thực tế. Nhiều tổ hợp thuộc expanded Target.

### 20.8. Workload shift

Fit healthy baseline ở profile/rate A và test healthy profile/rate B. Mục tiêu là kiểm tra detector có nhầm traffic increase hợp lệ (kể cả batch thông báo lớn khỏe) thành fault hay không.

### 20.9. Sensitivity

Nếu thời gian cho phép: window size, incident persistence, fusion weights, RCA weights, edge-type prior, fault intensity. Sensitivity chỉ dùng validation hoặc protocol đã freeze.

## 21. API và interface

CLI là interface bắt buộc cho reproducibility. API là lớp tích hợp khi cần giao diện/demo. MCP (mục 16) đọc thư mục kết quả, không phụ thuộc API này.

### 21.1. CLI tối thiểu

Tên command là đề xuất:

```text
analysis validate-run <run-id>
analysis build-features <run-id> --config <path>
analysis detect <run-id> --config <path>
analysis rank-rca <run-id> --config <path>
analysis evaluate <run-id> --config <path>
analysis run-pipeline <run-id> --config-dir <path>
analysis monitor --window <duration> --config-dir <path>   # suy luận/giám sát, không đọc ground truth
```

Phải có one-command pipeline và exit code rõ. Lệnh suy luận/giám sát không nhận tham số ground truth.

### 21.2. API gợi ý

#### Health

```http
GET /api/v1/system/health
```

#### Services và anomaly

```http
GET /api/v1/services
GET /api/v1/services/{name}
GET /api/v1/services/{name}/anomalies
```

#### Incidents và kết quả RCA

```http
GET /api/v1/incidents
GET /api/v1/incidents/{id}
GET /api/v1/incidents/{id}/result
GET /api/v1/incidents/{id}/evidence
```

`/result` trả đúng `RcaIncidentResult` (mục 14). Không có endpoint truy vấn tùy ý vào Prometheus/Tempo/Loki.

#### Experiments và evaluation (offline)

```http
GET  /api/v1/experiments/{run-id}
POST /api/v1/evaluations
GET  /api/v1/evaluations/{id}
```

API không trực tiếp inject fault; việc đó thuộc fault injector.

## 22. Giao diện và visualization tối thiểu

Không cần custom dashboard framework trong MVP. Grafana (đã có ở `aiops-platform/observability/`) quan sát telemetry gốc; kết quả RCA có thể xem qua API/HTML đơn giản hoặc report artifact.

Các view hữu ích:

### System overview

- 11 service và trạng thái;
- anomaly summary hiện tại;
- incident đang mở;
- request/error/latency summary.

### Service graph

- node là service (11 `service.name`);
- màu thể hiện normal/anomalous/candidate;
- edge phân biệt sync, async, auth, shared-resource; cạnh chỉ có trong thiết kế vẽ nét khác;
- component evidence hiển thị tách khỏi service candidate.

### Incident detail

```text
Incident summary
Timeline
Service graph
Kết luận RCA (verdict, ranking, mechanism, propagation_path)
Metric/trace/log evidence
Ground truth và evaluation (chỉ trong experiment view offline)
```

UI không được tính là core contribution và không làm chậm pipeline/evaluation.

## 23. Testing strategy

### 23.1. Unit tests

- window boundary và overlap;
- feature aggregation (kể cả `not_applicable` của worker và `telemetry_silent`);
- missing-data semantics;
- normalization không leakage;
- robust z-score;
- detector score direction;
- incident state transition;
- graph direction/edge aggregation, self-loop hợp lệ chỉ ở `e19`, graph có vòng;
- bảng quy đổi identity → candidate (mục 11.3), quy PRODUCER về chủ sở hữu command;
- RCA component scores và tie-break;
- quyết định `verdict`;
- metric calculation.

### 23.2. Contract/schema tests

- projection manifest thí nghiệm;
- schema telemetry đầu vào (theo telemetry schema v1);
- feature schema version;
- `RcaIncidentResult` hợp lệ theo schema catalogue v0 (kể cả `ranking` rỗng khi `insufficient_evidence`);
- **leakage guard:** input của bước suy luận không chứa trường ground truth; `RcaIncidentResult` không có `ground_truth`;
- API response schema;
- backward compatibility hoặc migration error rõ.

### 23.3. Integration tests

Ví dụ:

```text
fixture metrics/traces/logs
-> telemetry adapters
-> feature builder
-> detector
-> incident
-> graph
-> RCA
-> RcaIncidentResult
```

Adapter test không cần gọi hệ thống external thật trong mọi unit run; có fixture và một số integration test thật với Prometheus/Tempo/Loki khi stack khả dụng. Test với Tempo thật phải truy vấn tuần tự, giới hạn số trace.

### 23.4. End-to-end test

```text
known experiment artifact
-> validate
-> build features
-> detect incident
-> rank service-level candidates
-> produce RcaIncidentResult
-> evaluate against ground truth
```

E2E fixture phải chứa ít nhất một healthy run và một fault run canonical. Fault run đã có thật hiện chỉ là C6; fixture khác phải chờ case được chạy thật.

### 23.5. Regression tests

Khi đổi feature/detector/RCA:

- chạy lại golden/small fixture;
- so artifact schema;
- so metric trong tolerance;
- ghi thay đổi dự kiến;
- không chỉ nhìn một demo.

### 23.6. Determinism/reproducibility tests

Cùng input, code, seed và config phải tạo:

- cùng feature rows;
- cùng incident boundary trong tolerance;
- cùng candidate order;
- cùng evaluation metric.

## 24. Implementation sequence

Đây là dependency order, không phải roadmap theo tuần:

1. Chốt telemetry, ground-truth và feature schema ([telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md)); quyết định bổ sung metric thiếu ở mục 5.5 trước khi thu dataset.
2. Tạo telemetry adapters + data-quality report (gồm lọc trace nhiễu, truy vấn Tempo có giới hạn).
3. Implement windowing/alignment + service/edge/queue feature.
4. Implement static threshold và robust z-score.
5. Implement Isolation Forest + artifact/versioning.
6. Implement incident lifecycle/correlation.
7. Implement dynamic graph v2 (sync, async, dependency, auth, shared-resource) + validation.
8. Implement RCA baselines, gồm baseline thủ công tự động.
9. Implement proposed ranker (Hướng 1, rồi Hướng 2 nếu dữ liệu đủ).
10. Implement evidence, verdict và ghi `RcaIncidentResult`.
11. Implement evaluation harness (Top-K/MRR, thời gian chẩn đoán).
12. Chạy thật các case C1–C5, C7 bằng fault injector; chạy pilot, freeze protocol/config.
13. Chạy ablation, robustness và final campaign.
14. Chỉ sau khi 1–13 đạt: MCP server chỉ đọc và agent (mục 16).
15. Implement API/visualization tối thiểu nếu cần (có thể làm song song từ bước 10).

Không bắt đầu deep model, Kubernetes hoặc component-level RCA trước khi các bước MVP trên có artifact kiểm chứng.

## 25. Definition of Done

### 25.1. Telemetry và features

- [ ] Đọc được metrics, traces và structured logs từ artifact hoặc adapter canonical, dùng đúng 11 `service.name`.
- [ ] Kiểm tra UTC/identity/coverage và tạo data-quality report; lọc được trace nhiễu.
- [ ] Windowing/alignment deterministic và có test.
- [ ] Service/edge/queue feature schema có version.
- [ ] Missing semantics (gồm "không áp dụng", "chưa đo", "im lặng") và normalization được ghi rõ.
- [ ] Không có train/test leakage theo run.

### 25.2. Anomaly và incident

- [ ] Có static threshold, robust z-score và Isolation Forest hoặc detector tương đương.
- [ ] Model artifact ghi training runs, features, scaler, seed và config version.
- [ ] Có fused score và fallback cho missing modality.
- [ ] Incident lifecycle, persistence, merge và recovery có test.
- [ ] Incident lưu `estimated_start_time`.
- [ ] Đo được false positive trên healthy, kể cả tải cao khỏe.

### 25.3. Graph và RCA

- [ ] Graph v2 được xây từ trace (sync, async) và validate với `e01–e29`, gồm cạnh async nối PRODUCER/CONSUMER.
- [ ] Graph mang cạnh xác thực, shared-resource và `scheduler → scheduler-worker` như cạnh thiết kế.
- [ ] Có Max Anomaly, Earliest Anomaly, Graph-aware và baseline thủ công tự động.
- [ ] Proposed ranker xuất component scores và `propagation_path`.
- [ ] Candidate set và metric chính ở service-level theo catalogue v2 mục 8.
- [ ] Dependency/hạ tầng được giữ dưới dạng evidence riêng.
- [ ] Ranking deterministic và config có version.
- [ ] Engine tự quyết `ranked` hoặc `insufficient_evidence` không cần người can thiệp.

### 25.4. Evidence và đầu ra

- [ ] Mỗi candidate có machine-readable evidence khi telemetry hỗ trợ, tham chiếu được `trace_id`/`span_id` hoặc metric + nhãn + window.
- [ ] Mỗi incident có `RcaIncidentResult` đúng schema catalogue v0, bất biến, kèm manifest.
- [ ] Kết quả không chứa ground truth; `telemetry_quality` ghi tín hiệu thiếu.
- [ ] Timeline được sinh từ evidence có timestamp.
- [ ] Có one-command CLI từ run ID tới kết quả.
- [ ] API response, nếu triển khai, có schema test.

### 25.5. Evaluation

- [ ] Tính được Precision, Recall, F1, FPR và Detection Delay.
- [ ] Tính service-level Top-1, Top-3 và MRR; báo cáo riêng tỉ lệ `insufficient_evidence`.
- [ ] Đo thời gian chẩn đoán thủ công so với AI (baseline tự động; thử nghiệm người nếu protocol chốt).
- [ ] Báo cáo tách case nguyên nhân trên và ngoài đường request, ghi rõ case nào đã chạy thật.
- [ ] Có modality, graph (theo loại cạnh) và temporal ablation theo protocol.
- [ ] Có ít nhất một robustness evaluation focused (trace dropping/sampling simulation hoặc missing-modality); expanded matrix chỉ thuộc Target.
- [ ] Mức tối thiểu campaign theo evaluation-protocol-v1 (`K` case đủ điều kiện × `R` repetition), hoặc ghi rõ run invalid/rerun.
- [ ] Prediction và evaluation artifact link ngược được tới manifest/config/commit.
- [ ] Báo cáo có failure cases, limitations và trade-off.

### 25.6. DoD end-to-end

```text
telemetry artifact (+ manifest, ground truth chỉ ở offline)
-> data-quality validation
-> features
-> anomaly scores
-> incident
-> dependency graph v2
-> service-level RCA ranking
-> RcaIncidentResult (verdict, ranking, evidence)
-> evaluation against ground truth
```

Chỉ coi phần AI/RCA đạt MVP khi chuỗi này chạy lại được từ một run ID và tạo artifact mở được. Notebook, screenshot hoặc demo thủ công không thay thế DoD.

### 25.7. MCP và agent (thứ yếu, chỉ khi được làm)

- [ ] MCP server chỉ đọc kết quả RCA, giới hạn khoảng thời gian và số bản ghi, có xác thực.
- [ ] Không có tool truy vấn tùy ý vào Prometheus/Tempo/Loki.
- [ ] `get_ground_truth` tắt khi chạy thật, chỉ bật offline.
- [ ] Prompt agent coi nội dung log/trace là dữ liệu không tin cậy.
- [ ] Agent báo "không đủ chứng cứ" khi `verdict = "insufficient_evidence"`.

Mục này không phải tiêu chí hoàn thành đề tài (ADR-002).

## 26. Rủi ro và mitigation

| Rủi ro | Mitigation |
| --- | --- |
| Telemetry không sạch hoặc thiếu tín hiệu (pool DB, tuổi message, log worker, outbox) | Data-quality gate, ghi `telemetry_quality` vào kết quả, `insufficient_evidence`; quyết định bổ sung metric trước khi thu dataset. |
| Case C1–C5, C7 mới đo tín hiệu, chưa chạy chuỗi nhân quả | Chỉ dùng làm case đánh giá sau khi chạy thật; ghi trạng thái từng case trong báo cáo. |
| Chuỗi lan qua tài nguyên dùng chung (C1) chỉ là giả thuyết | Cạnh `shared-resource` là prior yếu, có ablation riêng; không tuyên bố cơ chế khi chưa kiểm chứng. |
| Windowing tạo leakage | Split theo run (và theo case nếu dùng ranker học), fit preprocessing chỉ trên training. |
| Detector nhầm tải cao hoặc batch lớn khỏe | Healthy high-load và batch lớn khỏe trong healthy dataset, workload-shift test. |
| RCA rank symptom thay vì nguyên nhân | Temporal precedence, reverse propagation, cạnh async/auth/shared, baseline thủ công để so sánh. |
| Độ trễ nhân quả dài (C4, C6) làm window và merge gap gộp sai | Cửa sổ tương quan riêng, tolerance tách theo nhóm case; chốt sau pilot. |
| `identity` im lặng không có telemetry | Cờ `telemetry_silent` (chưa kiểm chứng), cạnh xác thực thiết kế luôn tồn tại. |
| Quy tắc owner–worker chưa chốt (`ai` và `ai-worker`, `media` và `media-worker`) | Engine xuất `service.name` quan sát được; chỉ số chính chấm `root_cause_service`, owner-level Top-K là diagnostic phụ (evaluation-protocol-v1 mục 4.2, chờ Đức xác nhận). |
| Trace sampling hoặc đứt PRODUCER/CONSUMER làm graph thiếu cạnh async | 100% baseline trước, robustness + fallback theo queue đích. |
| Trace nhiễu (`/ready`, thăm dò `scheduler-worker`) tạo incident giả | Lọc ở adapter theo `http_route_template`/`operation_name`, test riêng. |
| Tempo OOM khi truy vấn nhiều trace | Truy vấn tuần tự, giới hạn khoảng thời gian và số trace. |
| Log feature cardinality cao | Template aggregation, không đưa raw string trực tiếp vào model. |
| Ranker học overfit vì ít run fault | Điểm tuyến tính có giải thích làm baseline, leave-one-case-out, báo cáo trung thực nếu không vượt baseline. |
| Model phức tạp nhưng không hơn baseline | Ưu tiên statistical/Isolation Forest và điểm tuyến tính, báo cáo trade-off trung thực. |
| Weight overfit | Tune trên validation, freeze trước test, sensitivity analysis. |
| Prompt injection qua log/trace khi agent đọc `summary` | Evidence nén sẵn, giới hạn độ dài, prompt coi là dữ liệu; MCP không truy vấn tùy ý (mục 16). |
| Agent đọc đáp án | `get_ground_truth` chỉ bật offline; leakage guard ở test. |
| Run không tái lập | Manifest/config/commit/seed/artifact đầy đủ, invalid-run ledger. |
| API/UI/MCP chiếm thời gian | CLI và artifact là bắt buộc; UI tối thiểu; MCP làm sau cùng. |

## 27. Các quyết định kỹ thuật giữ ổn định

- AI/ML (ML + dependency graph) là bên truy vết chính; bước kết luận không cần người can thiệp (ADR-002).
- "RCA engine" chỉ hệ thống này, không phải service `ai` của LMS.
- Developer/SRE là người đọc kết quả; đối chứng thủ công đo lặp được.
- OpenTelemetry là nguồn telemetry chuẩn.
- RCA engine là modular monolith Python trong MVP.
- Detector học trên healthy (không nhãn); ranker là điểm tuyến tính có giải thích hoặc ranker học từ fault injection (chờ xác nhận).
- Dynamic dependency graph lấy chủ yếu từ trace, bổ sung cạnh thiết kế cho xác thực, dùng chung hạ tầng và `scheduler → scheduler-worker`.
- Incident onset là input quan trọng của RCA.
- Primary RCA granularity là service-level; candidate set 10 service/worker.
- Dependency và hạ tầng là evidence, không phải candidate.
- Controlled fault injection là nguồn ground truth chính; ground truth không vào bước suy luận.
- `RcaIncidentResult` là hợp đồng đầu ra duy nhất; MCP chỉ đọc kết quả này.
- Docker Compose là runtime chính; Kubernetes chỉ Stretch.
- External benchmark là validation bổ sung.
- LLM không nằm trong RCA engine; chỉ ở agent thứ yếu.

## 28. Tài liệu nghiên cứu kế thừa từ bản cũ

Danh mục dưới đây được giữ như reading list; metadata/citation phải được kiểm tra lại trước khi đưa vào báo cáo chính thức:

1. Eadro — multi-source troubleshooting cho microservices.
2. PyRCA — thư viện/baseline metric-based RCA.
3. BARO — change-point detection kết hợp RCA.
4. Đánh giá causal inference-based RCA cho microservices.
5. RCAEval — benchmark và reproducible baselines.
6. Fault propagation-aware RCA benchmark.
7. TORAI — multi-source RCA khi service call graph có blind spots.
8. AnoMod — dataset anomaly detection và RCA đa modality.

Các công trình này định hướng baseline, multi-source fusion, onset estimation, graph/temporal reasoning và robustness; không yêu cầu nhóm reproduce toàn bộ mô hình hoặc dataset. Với vai trò AI chính, cần bổ sung reading list về RCA dựa trên học máy và learning-to-rank (chưa có trong danh mục; việc của literature matrix).

## 29. Checklist trước implementation lớn

- [ ] Telemetry schema, identity và ground-truth schema v1 đã chốt.
- [ ] Quyết định có bổ sung metric thiếu ở mục 5.5 trước khi thu dataset hay không.
- [ ] Feature window và split protocol đã chốt.
- [ ] Candidate set `service-candidates.v1` (10 service/worker) và cách xử lý owner–worker (owner-level Top-K) được Đức xác nhận trong evaluation-protocol-v1.
- [ ] Detection và RCA baselines, gồm baseline thủ công, đã chốt.
- [ ] Metric và tolerance (gồm nhóm case trễ nhân quả dài) đã chốt.
- [ ] Missing-data policy đã chốt.
- [ ] Schema `RcaIncidentResult` và nơi lưu đã được mảng AI xác nhận.
- [ ] Config/artifact layout đã chốt.
- [ ] Fault injector và workload k6 chạy được ít nhất cho C6 và một case khác.
- [ ] Pilot run có data-quality report.
- [ ] Implementation task có DoD và output path theo workspace standard.

Nếu một quyết định làm thay đổi research question, backend topology, schema kết quả RCA hoặc plan, phải cập nhật tài liệu canonical tương ứng thay vì tạo convention thứ hai trong file này.

## 30. Khác biệt so với bản trước

Bản trước: [analysis-anomaly-rca-blueprint](analysis-anomaly-rca-blueprint.md) (giữ làm lịch sử).

| Mục | Bản trước | v1 |
| --- | --- | --- |
| Vai trò AI | Công cụ hỗ trợ: phát hiện bất thường, trả Top-K cho người đọc | Bên truy vết chính: phát hiện, incident, xếp hạng và kết luận tự động không cần người (ADR-002); gọi là "RCA engine" |
| Kiến trúc đích | Topology v1: Enrollment, Submission, Grading, Notification, Course, Auth; Storage Mock, Redis, `grade.completed` | Topology v2: 7 service + 4 worker (11 `service.name`), PostgreSQL/RabbitMQ/MinIO/SMTP/LLM provider, command qua RabbitMQ |
| Dependency graph | Ví dụ MVP 5 cạnh (`gateway → submission`, `grading → notification` qua `grade.completed`…) | Bốn loại cạnh: sync, async (PRODUCER/CONSUMER cùng trace), dependency, shared-resource; cạnh xác thực; có vòng `course → ai → course` và self-loop `e19`; validate với `e01–e29` |
| Hạ tầng | Redis, PostgreSQL, storage, RabbitMQ là evidence | PostgreSQL, RabbitMQ, MinIO, SMTP, LLM provider là evidence; bảng quy đổi identity → candidate |
| Candidate set | Business service của v1; `gateway` là symptom | 10 service/worker (catalogue v2 mục 8, `service-candidates.v1`); `gateway` là symptom mặc định; owner-level Top-K là diagnostic phụ (chờ xác nhận) |
| Metric đầu vào | Danh sách chung (RED, resource, `redis_latency`, `storage_latency`, `consumer_lag`, `network_*`, `event_loop_lag`, `connection_pool_usage`) | Metric có thật: `http_server_*`, `lms_dependency_*`, `process_*`, `rabbitmq_detailed_queue_*`; bỏ các metric chưa có |
| Tín hiệu chưa có | Không nêu | Mục 5.5: pool DB, tuổi message, publish/consume RabbitMQ ở runtime, outbox, log worker, nối scheduler → worker, trace nhiễu, kèm hệ quả cho feature |
| Trace/log | Yêu cầu chung | Span PRODUCER/CONSUMER nối cùng trace; quy ước PRODUCER thuộc relay; log có `trace_id`/`span_id`; độ trễ thu thập và giới hạn truy vấn Tempo |
| Feature | Service/edge/log/trace | Thêm feature queue, độ trễ CONSUMER so với PRODUCER, độ rộng lỗi theo identity, im lặng; "không áp dụng" cho worker |
| Xếp hạng | Điểm tuyến tính 5 thành phần; propagation theo cạnh sync | Giữ điểm tuyến tính làm Hướng 1; thêm ranker học từ fault injection (Hướng 2, chờ xác nhận); propagation theo bốn loại cạnh; `insufficient_evidence` |
| Đầu ra | Prediction artifact và JSON incident mẫu | `RcaIncidentResult` theo catalogue v0 (link, không chép); ánh xạ thành phần engine → trường kết quả |
| Case phức tạp | Không có; 5 scenario F1–F5 | Mục 15: C1–C7 với cạnh/tín hiệu engine cần; chỉ C6 đã chạy thật |
| MCP/agent | "LLM không thuộc core" | Mục 16: thứ yếu, chỉ đọc kết quả, không truy vấn tùy ý, log/trace không tin cậy, `get_ground_truth` chỉ offline; LLM vẫn ngoài RCA engine |
| Đánh giá | Top-1/Top-3/MRR, ablation | Thêm thời gian chẩn đoán (thủ công vs AI), baseline thủ công tự động, tỉ lệ `insufficient_evidence`, tách case trong/ngoài đường request, ablation theo loại cạnh |
| Dataset | MVP floor 5 × 3 = 15 run | Không giữ nguyên; tập scenario theo C1–C7/FA–FH, mức tối thiểu theo evaluation-protocol-v1 (`K` case đủ điều kiện × `R`); lưu ý seed SQL không tạo telemetry |
| Vị trí mã | `analysis/` (và `experiments/runs/`) | Trong `aiops-platform/` (đề xuất `training/`, `mcp/`, `agent/`); chưa có thư mục nào ngoài `observability/` |
| Ví dụ Submission/storage, timeline Submission | Dùng `submission-storage`, `submission` | Thay bằng ví dụ v2 (C1, C3, C6); ví dụ chỉ minh họa |

Phần giữ nguyên về ý nghĩa: nguyên tắc split theo run, fit chỉ trên healthy, missing có chủ đích; detector baseline A–E và fusion; lifecycle incident; thành phần điểm A/T/P/E/V; yêu cầu determinism; ablation modality/temporal/evidence; robustness MVP; reading list; cấu trúc DoD.

### Giả định và điểm chờ xác nhận còn lại

- `telemetry-and-ground-truth-schema-v1` đang được viết song song; tài liệu này chỉ link, chưa đối chiếu nội dung chi tiết.
- [evaluation-protocol-v1](evaluation-protocol-v1.md) đã có nhưng cũng là đề xuất chờ Đức xác nhận: `R = 3`, `K` tối thiểu, owner-level Top-K, luật `base-manual-auto`, thử nghiệm người đều chưa chốt.
- Tên thư mục `aiops-platform/training/` (và vị trí kết quả) là đề xuất; mọi weight, ngưỡng, window, prior cạnh và ngưỡng `verdict` là giá trị khởi điểm hoặc `<validation-selected>`, chưa kiểm chứng trên v2.
- Cạnh `shared-resource`, feature `telemetry_silent`, `span_missing_downstream`, `dep_latency_dispersion_over_operations`, `dep_error_breadth_across_services`, bảng quy đổi identity → candidate và ranker Hướng 2 là đề xuất chưa kiểm chứng.
- Ngữ nghĩa `status="expected_failure"` của `lms_dependency_*` và cách tính percentile từ histogram cần xác nhận khi viết adapter.
- Việc bổ sung metric thiếu ở testbed (mục 5.5) do Đức quyết định, chưa quyết.
- Cạnh `media → identity` (`e12`) chưa thấy trong danh sách cạnh đo được; cần kiểm khi chạy workflow tương ứng.
