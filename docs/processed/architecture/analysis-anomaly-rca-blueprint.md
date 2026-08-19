# Blueprint triển khai Analysis, Anomaly Detection và RCA

> **Trạng thái:** Canonical implementation blueprint cho phần Analysis/AI/RCA.
>
> **Nguồn khôi phục:** Phần Observability, dữ liệu và AI/RCA trong bản cũ của `docs/processed/direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md` tại nhánh `main`, commit `a3ff193`.
>
> **Định hướng WHY/WHAT:** [`../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md)
>
> **Backend implementation architecture:** [`backend_microservice_testbed_blueprint.md`](backend_microservice_testbed_blueprint.md)
>
> **Backend SUT topology và fault scope:** [`dinh_huong_backend_microservice_testbed_lms.md`](dinh_huong_backend_microservice_testbed_lms.md)
>
> **WHEN/WHO:** [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md)

Tài liệu này mô tả **cách triển khai phần Analysis/AI/RCA**: ranh giới module, telemetry contract, data model, feature pipeline, anomaly/incident detection, dynamic dependency graph, root-cause candidate ranking, evidence, API, evaluation, testing và Definition of Done.

Tài liệu không định nghĩa lại backend topology, fault mechanism, repository tree cấp cao hoặc timeline. Khi có mâu thuẫn:

1. Overall direction quyết định WHY/WHAT và research scope.
2. Backend blueprint quyết định repository structure, experiment manifest và integration convention.
3. Tài liệu này quyết định implementation bên trong `analysis/`.
4. Plan v0.2 quyết định WHEN/WHO.

## 1. Mục tiêu và nguyên tắc

### 1.1. Mục tiêu

Phần Analysis/AI/RCA nhận telemetry và ground truth từ controlled experiments, sau đó thực hiện:

```text
telemetry ingestion
-> validation + time alignment
-> feature engineering
-> anomaly scoring
-> incident detection
-> dynamic dependency graph
-> service-level RCA ranking
-> evidence + timeline
-> quantitative evaluation
```

Output phục vụ developer/SRE và báo cáo nghiên cứu, không tham gia trực tiếp vào business request path của LMS.

### 1.2. Nguyên tắc bắt buộc

1. Analysis là **modular monolith Python** trong MVP.
2. Algorithm chính nằm trong package có test, không nằm độc quyền trong notebook.
3. Mọi input/output có schema và version.
4. Fit/tune chỉ dùng training/validation theo protocol; không tune trên test campaign.
5. Primary RCA evaluation là **service-level**.
6. Dependency/component chỉ là evidence bổ sung trong MVP.
7. Mọi prediction phải truy ngược được tới run, config, code commit và telemetry artifact.
8. Baseline, ablation và failure analysis là bắt buộc; model phức tạp không tự động có giá trị hơn.
9. Missing telemetry phải được xử lý có chủ đích, không âm thầm điền dữ liệu làm sai nghĩa.
10. Output dùng thuật ngữ root-cause candidate ranking, không tuyên bố causal proof chỉ từ telemetry quan sát.

## 2. Ranh giới hệ thống

### 2.1. Input

Analysis nhận các input logic sau:

- metrics từ Prometheus hoặc telemetry artifact đã export;
- traces/spans từ Tempo hoặc artifact tương đương;
- structured logs từ Loki hoặc artifact tương đương;
- experiment manifest;
- ground truth;
- feature, detector, RCA và evaluation config;
- service catalogue và ownership mapping.

### 2.2. Output

- normalized telemetry tables;
- service/edge window features;
- anomaly scores;
- incident records và timeline;
- dynamic service graph;
- service-level RCA candidates;
- component/dependency evidence;
- prediction artifact;
- evaluation artifact;
- plots/tables phục vụ phân tích và báo cáo.

### 2.3. Ngoài phạm vi module

- `load/` tạo workload;
- `faults/` triển khai fault mechanism;
- `experiments/` orchestration và lưu run ledger;
- `analysis/evaluation/` chỉ nhận prediction + ground truth để tính metric;
- Grafana quan sát telemetry gốc, không thay thế analysis pipeline;
- Analysis không điều khiển trực tiếp business service ngoài interface của experiment runner.

## 3. Cấu trúc source code trong `analysis/`

Cấu trúc canonical cấp cao đã được định nghĩa trong backend blueprint:

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

Mỗi module có thể tổ chức nội bộ như sau, chỉ tạo folder khi có implementation thật:

```text
analysis/
├── telemetry/
│   ├── adapters/
│   ├── schemas/
│   ├── validation/
│   └── alignment/
├── features/
│   ├── service/
│   ├── edge/
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
│   ├── builders/
│   ├── validation/
│   └── schemas/
├── rca/
│   ├── baselines/
│   ├── ranking/
│   └── configs/
├── evidence/
│   ├── metrics/
│   ├── traces/
│   ├── logs/
│   └── aggregation/
└── evaluation/
    ├── detection/
    ├── rca/
    ├── ablation/
    ├── robustness/
    └── reports/
```

Không tạo root `backend/`, `models/`, `notebooks/` hoặc `dashboard/` cạnh tranh. Notebook khám phá có thể đặt dưới một vị trí được thống nhất sau, nhưng implementation được nghiệm thu phải nằm trong các module trên.

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
| Prediction/config | JSON hoặc YAML có version |
| CLI | Python CLI tối giản |
| API | FastAPI khi cần tích hợp/giao diện |
| Metadata | PostgreSQL hoặc manifest/file cho MVP |
| Runtime | Docker Compose |

Không thêm Celery, Kafka hoặc distributed compute nếu CLI/background worker đơn giản đã đủ. Không tách analysis thành nhiều microservice vật lý trong MVP.

### 4.2. Target/Stretch

- online change-point detector;
- log-template parser nâng cao;
- external benchmark adapter;
- causal/statistical analysis trên top-N candidates;
- asynchronous job queue nếu thời lượng xử lý thực tế chứng minh cần thiết;
- component-level RCA hoặc instance-level RCA chỉ sau service-level MVP.

Deep learning, LLM reasoning và full causal discovery không thuộc core.

## 5. Telemetry contract

### 5.1. Identity và thời gian

Mọi telemetry record phải truy được tối thiểu:

```text
service.name
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

Analysis không dùng pod/container name thay cho `service.name`. `trace_id`, `span_id`, user ID hoặc request ID không được dùng làm Prometheus label; chúng chỉ dùng để correlation hoặc lookup artifact.

### 5.2. Metrics đầu vào

#### RED metrics

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

#### Resource metrics

```text
cpu_usage
memory_usage
network_rx
network_tx
disk_io
event_loop_lag
connection_pool_usage
```

Chỉ dùng signal runtime thực sự có instrumentation và giá trị cho fault/evaluation; không bắt buộc mọi service có mọi field.

#### Dependency metrics

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
```

#### App-specific metrics

Ví dụ Submission:

```text
submission_success_total
submission_failure_total
submission_processing_duration
```

App-specific metric chỉ thêm khi giúp phân biệt symptom hoặc tạo evidence; không dùng để encode trực tiếp fault label.

### 5.3. Trace/span đầu vào

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
peer_service/dependency_identity
```

RabbitMQ publish/consume spans phải bảo toàn trace context. Controlled baseline dùng 100% trace sampling; sampling thấp hơn chỉ xuất hiện trong robustness experiment.

### 5.4. Structured logs đầu vào

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

Không yêu cầu mọi log có trace ID, nhưng log nằm trong request/message context phải có correlation. Không xử lý password, token, secret hoặc PII không cần thiết.

### 5.5. Data-quality contract

Mỗi run phải có report kiểm tra:

- timestamp hợp lệ và không lẫn timezone;
- tỷ lệ record thiếu service identity;
- tỷ lệ span thiếu parent/trace relation;
- trace coverage theo workflow;
- metric gap và scrape interval;
- log correlation coverage;
- duplicate record;
- artifact time range có bao phủ warm-up, healthy, fault và recovery;
- manifest time có nằm trong telemetry range;
- service name có thuộc service catalogue.

Run vi phạm ngưỡng data quality phải được đánh dấu `invalid` hoặc `partial`, không âm thầm đưa vào evaluation chính.

## 6. Mô hình dữ liệu phân tích

Schema thực tế có thể dùng Pydantic/Parquet/JSON, nhưng phải giữ các field logic dưới đây.

### 6.1. ExperimentContext

```text
ExperimentContext
- experiment_id
- scenario_id
- run_id
- repeat_index
- workload_profile
- workload_seed
- fault_type
- fault_target
- fault_intensity
- fault_start
- fault_end
- root_cause_service
- root_cause_component
- code_commit
- service_versions
- experiment_config_version
- detector_config_version
- rca_config_version
- telemetry_artifact
- prediction_artifact
- evaluation_artifact
```

Đây là projection từ experiment manifest canonical; Analysis không tự phát minh một manifest thứ hai.

### 6.2. ServiceWindowFeature

```text
ServiceWindowFeature
- run_id
- window_start
- window_end
- service_name
- service_version
- request_rate
- error_rate
- latency_p50
- latency_p95
- latency_p99
- cpu_usage
- memory_usage
- downstream_error_rate
- downstream_latency_p95
- trace_error_rate
- span_duration_p95
- log_error_rate
- exception_count
- timeout_count
- missing_metrics
- missing_traces
- missing_logs
- feature_schema_version
```

### 6.3. EdgeWindowFeature

Edge service graph dùng hướng caller -> callee:

```text
EdgeWindowFeature
- run_id
- window_start
- window_end
- caller_service
- callee_service
- call_count
- error_rate
- timeout_rate
- latency_mean
- latency_p95
- latency_p99
- first_error_time
- missing_trace_ratio
- feature_schema_version
```

Dependency hạ tầng như Redis, PostgreSQL hoặc storage có thể có edge evidence riêng, nhưng không mặc định trở thành service-level candidate.

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
- incident_id
- run_id
- detected_at
- estimated_start_time
- estimated_end_time
- state
- severity
- affected_services
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
- rank
- score
- anomaly_score
- temporal_score
- propagation_score
- edge_score
- evidence_score
- explanation_refs
- rca_config_version
```

`service_name` là candidate identity của metric chính. Component/dependency không được chèn vào cùng ranking list nếu protocol đang đánh giá service-level.

### 6.8. Evidence

```text
Evidence
- evidence_id
- incident_id
- candidate_service
- component
- modality
- evidence_type
- metric_or_template
- baseline_value
- incident_value
- change_ratio
- statistical_score
- first_observed_at
- trace_ids
- span_ids
- artifact_ref
```

### 6.9. EvaluationRecord

```text
EvaluationRecord
- run_id
- incident_id
- ground_truth_service
- ground_truth_component
- detected
- detection_delay
- predicted_rank
- top1_hit
- top3_hit
- reciprocal_rank
- detector_config_version
- rca_config_version
- evaluation_config_version
```

## 7. Windowing, alignment và preprocessing

### 7.1. Window mặc định

Giá trị khởi điểm:

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

Sau pilot có thể so sánh 30/60/120 giây trên validation. Window được freeze trước test campaign và ghi trong feature config.

### 7.2. Alignment

- metrics aggregate theo `[window_start, window_end)`;
- span được gán theo start time hoặc contribution rule được ghi rõ;
- log được gán theo timestamp;
- mọi modality dùng cùng window ID;
- boundary ở fault start/end phải được xử lý nhất quán;
- không dùng future window để tính online score nếu tuyên bố near-real-time.

### 7.3. Missing data

Phân biệt:

```text
0 thực sự
không có traffic
không scrape được metric
trace bị sampling/mất
log source không khả dụng
```

Mỗi feature cần cờ missing tương ứng. Imputation phải fit từ training data và được version hóa. Không điền `0` máy móc cho missing telemetry.

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

Nếu cùng scenario có nhiều repetition, không để window của cùng run xuất hiện ở nhiều split. Protocol phải nói rõ có giữ scenario/target chưa thấy cho test hay không.

## 8. Feature engineering

### 8.1. Service metrics features

- request rate và delta so với baseline;
- error rate và error burst;
- latency p50/p95/p99;
- CPU, memory và runtime signal;
- rolling median/MAD;
- slope/trend;
- ratio current/baseline;
- change so với previous window.

### 8.2. Trace-derived service features

```text
span_count
span_error_ratio
span_duration_mean
span_duration_p95
timeout_count
critical_path_frequency
downstream_dependency_count
abnormal_edge_count
```

### 8.3. Edge features

```text
call_count
error_ratio
timeout_ratio
duration_mean
duration_p95
duration_p99
latency_change_ratio
error_change_ratio
first_degradation_time
```

### 8.4. Log features

MVP không đưa raw log string trực tiếp vào model. Pipeline:

```text
raw structured log
-> normalize dynamic values
-> message/event template
-> aggregate per service/window
```

Feature:

```text
error_log_rate
warn_log_rate
exception_count
timeout_count
unique_template_count
new_template_count
error_template_count
template_frequency
template_delta
template_first_seen
```

Ví dụ:

```text
"storage timeout after 5012 ms"
"storage timeout after 5028 ms"
-> "storage timeout after <*> ms"
```

Drain-style parsing, embedding và semantic clustering là Target/Stretch.

### 8.5. Feature registry

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

### 9.1. Baseline A — Static threshold

Ví dụ ban đầu:

```text
error_rate > configured_threshold
latency_p95 > configured_threshold
cpu_usage > configured_threshold
```

Threshold phải dựa trên benchmark/config, không hard-code vào logic. Baseline này dễ giải thích và là mốc tối thiểu.

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

Input là vector service-window, ví dụ:

```text
[
  request_rate,
  error_rate,
  latency_p95,
  cpu_usage,
  memory_usage,
  trace_error_rate,
  downstream_latency_p95,
  log_error_rate
]
```

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

có thể dùng Bayesian Online Change Point Detection hoặc detector online đơn giản hơn. Không đưa vào MVP nếu chưa có baseline và incident pipeline ổn định.

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
- missing modality có fallback được định nghĩa;
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

State transition phải deterministic theo config và có test.

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

Config phải ghi persistence steps, threshold, merge gap và recovery rule.

### 10.3. Correlation

Các anomaly được gộp nếu:

- nằm trong time gap cho phép;
- thuộc cùng connected subgraph hoặc workflow;
- không có evidence cho hai fault interval tách biệt.

Mục tiêu là tránh một fault tạo nhiều incident độc lập không cần thiết.

### 10.4. Estimated start

`estimated_start_time` có thể lấy từ:

- window anomaly đầu tiên sau persistence;
- change point;
- timestamp evidence sớm nhất có độ tin cậy đủ.

Evaluation phải ghi rõ tolerance khi so với `fault_start`.

### 10.5. Timeline

Ví dụ LMS canonical:

```text
10:00:10 submission-storage latency tăng
10:00:18 submission outbound span bất thường
10:00:23 submission timeout log burst
10:00:30 gateway p95 latency tăng
10:00:35 incident được mở
```

Timeline event phải trỏ tới evidence artifact, không chỉ chứa câu mô tả thủ công.

## 11. Dynamic dependency graph

### 11.1. Graph definition

```text
G(W) = (V, E)
V = service nodes quan sát trong window W
E = caller -> callee từ spans
```

Ví dụ MVP:

```text
gateway -> submission
submission -> course
submission -> enrollment
grading -> submission
grading -> notification (qua grade.completed, biểu diễn async edge)
```

Redis, PostgreSQL, storage và RabbitMQ là component/dependency evidence. Chúng có thể nằm trong evidence graph nhưng không được trộn vào service-level candidate set chính.

### 11.2. Dynamic thay vì static

Graph được xây theo run/window vì route, traffic và service version có thể thay đổi. Service catalogue/topology thiết kế dùng để validation, không thay thế graph quan sát.

### 11.3. Edge weight

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

Weight formula và alpha/beta/gamma thuộc graph/RCA config.

### 11.4. Async edge

RabbitMQ publish/consume trace context được dùng để xây quan hệ:

```text
grading -> notification
event = grade.completed
```

Nếu trace async thiếu, có thể fallback bằng event ID/time correlation nhưng phải đánh dấu confidence thấp hơn.

### 11.5. Graph validation

Kiểm tra:

- edge ngoài service catalogue;
- self-loop không có nghĩa;
- caller/callee đảo chiều;
- trace sampling làm mất edge;
- graph disconnected bất thường;
- async edge không nối được producer/consumer;
- dependency edge xuất hiện trong workflow đúng.

Tempo service graph có thể dùng đối chiếu, nhưng representation phục vụ thuật toán phải do `analysis/graph/` quản lý và version hóa.

## 12. RCA candidate ranking

### 12.1. Granularity và candidate set

Primary candidate là service:

```text
root_cause_service = submission
```

Component evidence:

```text
root_cause_component = submission-storage
```

Candidate set phải được freeze trong evaluation protocol. Mặc định gồm các business services có thể là fault target. Gateway chỉ tham gia candidate set nếu protocol có gateway fault; nếu không, Gateway là affected symptom. Infrastructure component không nằm trong metric Top-K chính của MVP.

### 12.2. Vì sao không dùng “highest anomaly wins”

Symptom upstream có thể có anomaly score lớn hơn root cause. Ví dụ:

```text
submission-storage evidence bắt đầu 10:00:10
submission anomaly bắt đầu         10:00:18
gateway anomaly bắt đầu            10:00:30
```

Nếu chỉ rank severity, Gateway có thể đứng đầu dù root-cause service ground truth là Submission.

### 12.3. Score components

#### Anomaly severity — `A(s)`

Fused anomaly magnitude của service trong incident window.

#### Temporal precedence — `T(s)`

Service/evidence xuất hiện sớm hơn symptom liên quan được score cao hơn. Cần robust với window overlap và sampling noise.

#### Propagation compatibility — `P(s)`

Với edge caller -> callee, failure ở callee hoặc dependency do service sở hữu thường lan tới callers/upstream. Score đánh giá xem thứ tự symptom có tương thích với reverse propagation path từ candidate hay không.

#### Edge degradation — `E(s)`

Đánh giá outgoing dependency của service có latency/error/timeout tăng và component evidence có thuộc service đó hay không.

#### Evidence strength — `V(s)`

Tổng hợp mức thay đổi metric, abnormal spans, log burst và statistical significance.

### 12.4. Proposed score

```text
R(s) =
    w1 * A(s)
  + w2 * T(s)
  + w3 * P(s)
  + w4 * E(s)
  + w5 * V(s)
```

Weight khởi tạo tham khảo:

```text
w1 = 0.30
w2 = 0.20
w3 = 0.20
w4 = 0.20
w5 = 0.10
```

Đây không phải weight cuối cùng. Weight phải tune trên validation hoặc đánh giá bằng sensitivity analysis; không thay sau khi xem final test result.

Mọi component score được chuẩn hóa về cùng scale và xuất ra cùng candidate để giải thích.

### 12.5. Propagation score

Một dạng triển khai:

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

Không áp dụng công thức máy móc cho async edge; queue delay và consumer slowdown cần semantics riêng.

### 12.6. Baseline RCA

Phải có tối thiểu:

1. **Max anomaly:** rank theo anomaly score.
2. **Earliest anomaly:** rank theo estimated onset.
3. **Graph-aware simple:** anomaly + graph relation/centrality hoặc propagation rule đơn giản.
4. **Proposed method:** anomaly + temporal + propagation + edge + evidence.

PageRank-like ranking có thể là baseline bổ sung. Causal/statistical analysis trên top-N là Stretch, không thay thế các baseline dễ giải thích.

### 12.7. Tie-breaking và determinism

- tie-break rule phải cố định;
- sort cuối cùng không phụ thuộc iteration order của dictionary/graph;
- cùng input/config phải tạo cùng candidate order;
- random algorithm phải lưu seed;
- score NaN/missing phải có fallback rõ.

## 13. Evidence extraction

### 13.1. Mục tiêu

Mỗi candidate phải có machine-readable evidence trả lời:

- signal nào bất thường;
- baseline và incident value là gì;
- thay đổi bắt đầu khi nào;
- dependency/span/log nào liên quan;
- evidence ủng hộ hoặc phản bác candidate thế nào.

### 13.2. Metric evidence

```text
metric_name
baseline_median/MAD
incident_value
change_ratio
statistical_score
first_observed_at
```

### 13.3. Trace evidence

- abnormal span duration/error;
- dependency identity;
- path chứa candidate và affected service;
- trace ID/span ID;
- critical path contribution;
- first degraded edge time.

### 13.4. Log evidence

- error/timeout template burst;
- exception type;
- new template first seen;
- trace-correlated log;
- dependency identity;
- log artifact reference.

### 13.5. Evidence aggregation

Không cộng số lượng evidence thô vì modality nhiều record có thể áp đảo. Cần normalize theo modality và giới hạn duplicate evidence cùng template/trace.

Output candidate có thể trình bày:

```json
{
  "service_name": "submission",
  "rank": 1,
  "score": 0.91,
  "components": {
    "anomaly": 0.82,
    "temporal": 0.94,
    "propagation": 0.88,
    "edge": 0.97,
    "evidence": 0.84
  },
  "evidence_refs": [
    "ev-storage-latency",
    "ev-submission-timeout-log",
    "ev-gateway-propagation"
  ]
}
```

## 14. Artifact và configuration

### 14.1. Run artifact layout

`experiments/runs/` là ledger/artifact boundary. Một run có thể dùng layout logic:

```text
experiments/runs/<run-id>/
├── manifest.yaml
├── data-quality.json
├── telemetry-artifact.json
├── service-features.parquet
├── edge-features.parquet
├── anomaly-scores.parquet
├── incidents.json
├── service-graph.json
├── prediction.json
└── evaluation.json
```

File lớn có thể nằm ngoài Git; các JSON trên được phép chỉ chứa URI, checksum và metadata. Không commit raw telemetry lớn nếu repository policy không cho phép.

### 14.2. Feature config

```yaml
feature_schema_version: 1
window_size_seconds: 60
step_seconds: 15
modalities: [metrics, traces, logs]
normalization: robust_per_service
missing_policy: explicit_flags
```

### 14.3. Detector config

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

### 14.4. Incident config

```yaml
incident_config_version: 1
persistence_steps: 3
merge_gap_seconds: 60
recovery_steps: 3
minimum_related_services: 1
```

### 14.5. RCA config

```yaml
rca_config_version: 1
candidate_level: service
weights:
  anomaly: 0.30
  temporal: 0.20
  propagation: 0.20
  edge: 0.20
  evidence: 0.10
tie_breaker: service_name
```

### 14.6. Evaluation config

```yaml
evaluation_config_version: 1
unit: incident_run
rca_level: service
top_k: [1, 3]
detection_tolerance_seconds: <protocol-value>
exclude_invalid_runs: true
```

Mọi placeholder phải được chốt trong protocol trước campaign chính.

## 15. Dataset strategy

### 15.1. Healthy baseline dataset

Bao gồm:

- normal mixed traffic;
- submission peak khỏe mạnh;
- grading burst khỏe mạnh;
- healthy high-load spike;
- nhiều seed/repetition khi tài nguyên cho phép.

Mục đích:

- fit normal distribution/scaler/detector;
- đo false positive;
- kiểm tra workload shift;
- tránh model học rằng “tải cao = fault”.

Thời lượng run được chốt sau pilot, không hard-code 30–60 phút nếu hạ tầng không cần.

### 15.2. Fault-injected dataset

Mỗi run có các phase logic:

```text
warm-up
healthy baseline
fault active
recovery
```

Thời lượng từng phase phải đủ cho window/persistence rule nhưng được rút gọn sau pilot nếu vẫn tạo telemetry ổn định.

### 15.3. MVP evaluation floor

```text
5 scenarios × 3 repetitions = 15 controlled runs
```

Năm scenario canonical:

1. Course / Redis latency.
2. Submission -> storage latency.
3. Submission service error.
4. Notification consumer slowdown / RabbitMQ backlog.
5. Submission CPU pressure hoặc crash.

Target có thể mở rộng khoảng 30–60+ run nếu automation, thời gian và ground truth đủ tốt. Không coi 60–100 run là điều kiện thành công.

### 15.4. External dataset

RCAEval hoặc AnoMod subset là validation bổ sung, không được làm chậm evaluation trên testbed chính. Adapter external dataset phải map rõ service/entity/metric semantics; không trộn kết quả nếu granularity khác mà không giải thích.

## 16. Evaluation protocol

### 16.1. Unit of evaluation

Đánh giá chính ở incident/fault-run level, không chỉ point/window level.

Một run cần xác định:

- có incident được detect hay không;
- detection time so với fault start;
- candidate rank của `root_cause_service`;
- evidence có đủ và đúng reference hay không;
- run có hợp lệ theo data quality không.

Point-level metric có thể dùng chẩn đoán detector nhưng không thay thế incident-level result.

### 16.2. Detection metrics

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

Đo trên healthy runs/healthy intervals để phản ánh alert fatigue.

#### Detection Delay

```text
detected_at - fault_start
```

Protocol phải quy định cách xử lý detection trước fault, sau fault end, nhiều incident trong một run và tolerance do windowing.

### 16.3. RCA metrics — service-level

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

Không tính `root_cause_component` trong metric chính của MVP. Component evidence được đánh giá định tính hoặc bằng metric phụ tách biệt khi protocol Target được định nghĩa.

### 16.4. System metrics

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size;
- instrumentation overhead trên application throughput/p95 latency.

### 16.5. Explainability checks

Mỗi Top-K result phải có:

- component scores;
- ít nhất một evidence reference khi data cho phép;
- timeline position;
- machine-readable artifact;
- config/version metadata.

Không tạo một “accuracy tổng hợp” duy nhất che mất trade-off.

## 17. Ablation và robustness

### 17.1. Modality ablation

```text
M
M + T
M + L (nếu phù hợp)
M + T + L
```

Trong đó M = metrics, T = traces, L = logs.

### 17.2. Graph ablation

```text
RCA without graph
vs
RCA with dependency graph
```

### 17.3. Temporal ablation

```text
without temporal precedence
vs
with temporal precedence
```

### 17.4. Evidence ablation

```text
without evidence score
vs
with evidence score
```

Evidence ablation là Target nếu MVP budget chỉ đủ ba ablation chính.

### 17.5. Missing trace

Có thể drop có kiểm soát:

```text
20%
50%
80%
```

traces/spans sau khi đã có 100% sampling baseline. Cần cố định random seed và không thay ground truth.

Đánh giá:

- graph edge coverage;
- detection metric;
- service-level RCA Top-K/MRR;
- fallback từ metrics/logs;
- failure threshold của phương pháp.

### 17.6. Missing modality

So sánh khi metrics/traces/logs không khả dụng theo config. Pipeline phải ghi rõ modality bị thiếu thay vì coi score bằng 0 không điều kiện.

### 17.7. Workload shift

Fit healthy baseline ở profile/rate A và test healthy profile/rate B. Mục tiêu là kiểm tra detector có nhầm traffic increase hợp lệ thành fault hay không.

### 17.8. Sensitivity

Nếu thời gian cho phép:

- window size;
- incident persistence;
- fusion weights;
- RCA weights;
- fault intensity.

Sensitivity chỉ dùng validation hoặc protocol đã freeze.

## 18. API và interface

CLI là interface bắt buộc cho reproducibility. API là lớp tích hợp khi cần giao diện/demo.

### 18.1. CLI tối thiểu

```text
analysis validate-run <run-id>
analysis build-features <run-id> --config <path>
analysis detect <run-id> --config <path>
analysis rank-rca <run-id> --config <path>
analysis evaluate <run-id> --config <path>
analysis run-pipeline <run-id> --config-dir <path>
```

Tên command thực tế có thể thay đổi, nhưng phải có one-command pipeline và exit code rõ.

### 18.2. API gợi ý

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

#### Incidents

```http
GET /api/v1/incidents
GET /api/v1/incidents/{id}
```

#### RCA và evidence

```http
POST /api/v1/incidents/{id}/analyze
GET  /api/v1/incidents/{id}/candidates
GET  /api/v1/incidents/{id}/evidence
GET  /api/v1/incidents/{id}/traces
```

#### Experiments và evaluation

```http
GET  /api/v1/experiments/{run-id}
POST /api/v1/evaluations
GET  /api/v1/evaluations/{id}
```

API không trực tiếp inject fault; việc đó thuộc experiment runner.

### 18.3. Incident response mẫu

```json
{
  "id": "inc-submission-storage-r03",
  "run_id": "exp-submission-storage-r03",
  "state": "resolved",
  "estimated_start_time": "2026-08-19T03:10:15Z",
  "detected_at": "2026-08-19T03:10:45Z",
  "affected_services": ["submission", "gateway"],
  "candidates": [
    {
      "service_name": "submission",
      "score": 0.91,
      "rank": 1,
      "evidence_refs": ["ev-storage-latency", "ev-timeout-log"]
    }
  ],
  "versions": {
    "detector_config": 1,
    "rca_config": 1
  }
}
```

## 19. Giao diện và visualization tối thiểu

Không cần custom dashboard framework trong MVP. Có thể dùng Grafana cho raw telemetry và API/HTML đơn giản hoặc report artifact cho kết quả AI/RCA.

Các view hữu ích:

### System overview

- service count;
- current anomaly summary;
- open incidents;
- request/error/latency summary.

### Service graph

- node là service;
- màu thể hiện normal/anomalous/candidate;
- edge thể hiện calls và latency/error change;
- component evidence hiển thị tách khỏi service candidate.

### Incident detail

```text
Incident summary
Timeline
Service graph
Root-cause candidates
Metric/trace/log evidence
Ground truth và evaluation (chỉ trong experiment view)
```

UI không được tính là core contribution và không làm chậm pipeline/evaluation.

## 20. Testing strategy

### 20.1. Unit tests

- window boundary và overlap;
- feature aggregation;
- missing-data semantics;
- normalization không leakage;
- robust z-score;
- detector score direction;
- incident state transition;
- graph direction/edge aggregation;
- RCA component scores và tie-break;
- metric calculation.

### 20.2. Contract/schema tests

- experiment manifest projection;
- telemetry input schema;
- feature schema version;
- prediction/evidence/evaluation JSON;
- API response schema;
- backward compatibility hoặc migration error rõ.

### 20.3. Integration tests

Ví dụ:

```text
fixture metrics/traces/logs
-> telemetry adapters
-> feature builder
-> detector
-> incident
-> graph
-> RCA
```

Adapter test không cần gọi hệ thống external thật trong mọi unit run; có fixture và một số integration test thật với Prometheus/Tempo/Loki khi stack khả dụng.

### 20.4. End-to-end test

```text
known experiment artifact
-> validate
-> build features
-> detect incident
-> rank service-level candidates
-> produce evidence
-> evaluate against ground truth
```

E2E fixture phải chứa ít nhất một healthy run và một fault run canonical.

### 20.5. Regression tests

Khi đổi feature/detector/RCA:

- chạy lại golden/small fixture;
- so artifact schema;
- so metric trong tolerance;
- ghi thay đổi dự kiến;
- không chỉ nhìn một demo.

### 20.6. Determinism/reproducibility tests

Cùng input, code, seed và config phải tạo:

- cùng feature rows;
- cùng incident boundary trong tolerance;
- cùng candidate order;
- cùng evaluation metric.

## 21. Implementation sequence

Đây là dependency order, không phải roadmap theo tuần:

1. Chốt telemetry, manifest và feature schemas.
2. Tạo telemetry adapters + data-quality report.
3. Implement windowing/alignment + service/edge features.
4. Implement static threshold và robust z-score.
5. Implement Isolation Forest + artifact/versioning.
6. Implement incident lifecycle/correlation.
7. Implement dynamic graph + validation.
8. Implement RCA baselines.
9. Implement proposed graph-temporal-evidence ranker.
10. Implement evidence/timeline artifact.
11. Implement evaluation harness.
12. Chạy pilot, freeze protocol/config.
13. Implement API/visualization tối thiểu nếu cần.
14. Chạy ablation, robustness và final campaign theo plan v0.2.

Không bắt đầu deep model, Kubernetes hoặc component-level RCA trước khi các bước MVP trên có artifact kiểm chứng.

## 22. Definition of Done

### 22.1. Telemetry và features

- [ ] Đọc được metrics, traces và structured logs từ artifact hoặc adapter canonical.
- [ ] Kiểm tra UTC/identity/coverage và tạo data-quality report.
- [ ] Windowing/alignment deterministic và có test.
- [ ] Service/edge feature schema có version.
- [ ] Missing semantics và normalization được ghi rõ.
- [ ] Không có train/test leakage theo run.

### 22.2. Anomaly và incident

- [ ] Có static threshold, robust z-score và Isolation Forest hoặc detector tương đương.
- [ ] Model artifact ghi training runs, features, scaler, seed và config version.
- [ ] Có fused score và fallback cho missing modality.
- [ ] Incident lifecycle, persistence, merge và recovery có test.
- [ ] Incident lưu `estimated_start_time`.

### 22.3. Graph và RCA

- [ ] Dynamic graph được xây từ traces và validation với topology.
- [ ] Có Max Anomaly, Earliest Anomaly và Graph-aware baseline.
- [ ] Proposed ranker xuất component scores.
- [ ] Candidate set và metric chính ở service-level.
- [ ] Component/dependency được giữ dưới dạng evidence riêng.
- [ ] Ranking deterministic và config có version.

### 22.4. Evidence và API

- [ ] Mỗi candidate có machine-readable evidence khi telemetry hỗ trợ.
- [ ] Evidence trỏ được tới metric/trace/log artifact.
- [ ] Timeline được sinh từ evidence có timestamp.
- [ ] Có one-command CLI từ run ID tới prediction.
- [ ] API response, nếu triển khai, có schema test.

### 22.5. Evaluation

- [ ] Tính được Precision, Recall, F1, FPR và Detection Delay.
- [ ] Tính service-level Top-1, Top-3 và MRR.
- [ ] Có modality, graph và temporal ablation theo protocol.
- [ ] Có robustness test được ưu tiên theo plan.
- [ ] MVP floor có 5 scenario × 3 repetitions hợp lệ hoặc ghi rõ run invalid/rerun.
- [ ] Prediction và evaluation artifact link ngược được tới manifest/config/commit.
- [ ] Báo cáo có failure cases, limitations và trade-off.

### 22.6. DoD end-to-end

```text
experiment manifest
-> telemetry artifact
-> data-quality validation
-> features
-> anomaly scores
-> incident
-> service graph
-> service-level RCA candidates
-> evidence/timeline
-> evaluation against ground truth
```

Chỉ coi phần AI/RCA đạt MVP khi chuỗi này chạy lại được từ một run ID và tạo artifact mở được. Notebook, screenshot hoặc demo thủ công không thay thế DoD.

## 23. Rủi ro và mitigation

| Rủi ro | Mitigation |
| --- | --- |
| Telemetry không sạch | Data-quality gate, schema/version và pilot sớm. |
| Windowing tạo leakage | Split theo run, fit preprocessing chỉ trên training. |
| Detector nhầm tải cao | Healthy high-load runs và workload-shift test. |
| RCA rank symptom | Temporal precedence, reverse propagation và edge evidence. |
| Trace sampling làm graph thiếu | 100% baseline trước, robustness + fallback metrics/logs sau. |
| Log feature cardinality cao | Template aggregation, không đưa raw string trực tiếp vào model. |
| Model phức tạp nhưng không hơn baseline | Ưu tiên statistical/Isolation Forest, báo cáo trade-off trung thực. |
| Weight overfit | Tune trên validation, freeze trước test, sensitivity analysis. |
| Run không tái lập | Manifest/config/commit/seed/artifact đầy đủ, invalid-run ledger. |
| API/UI chiếm thời gian | CLI và artifact là bắt buộc; UI chỉ tối thiểu. |

## 24. Các quyết định kỹ thuật giữ ổn định

- Developer/SRE là người dùng của output AI/RCA.
- OpenTelemetry là nguồn telemetry chuẩn.
- Analysis là modular monolith Python trong MVP.
- Unsupervised/weakly supervised là learning paradigm mặc định.
- Dynamic dependency graph lấy chủ yếu từ traces.
- Incident onset là input quan trọng của RCA.
- Primary RCA granularity là service-level.
- Component/dependency là evidence bổ sung trong MVP.
- Controlled fault injection là nguồn ground truth chính.
- Docker Compose là runtime chính; Kubernetes chỉ Stretch.
- External benchmark là validation bổ sung.
- LLM không thuộc core AI/RCA.

## 25. Tài liệu nghiên cứu kế thừa từ bản cũ

Danh mục dưới đây được giữ như reading list; metadata/citation phải được kiểm tra lại trước khi đưa vào báo cáo chính thức:

1. Eadro — multi-source troubleshooting cho microservices.
2. PyRCA — thư viện/baseline metric-based RCA.
3. BARO — change-point detection kết hợp RCA.
4. Đánh giá causal inference-based RCA cho microservices.
5. RCAEval — benchmark và reproducible baselines.
6. Fault propagation-aware RCA benchmark.
7. TORAI — multi-source RCA khi service call graph có blind spots.
8. AnoMod — dataset anomaly detection và RCA đa modality.

Các công trình này định hướng baseline, multi-source fusion, onset estimation, graph/temporal reasoning và robustness; không yêu cầu nhóm reproduce toàn bộ mô hình hoặc dataset.

## 26. Checklist trước implementation lớn

- [ ] Telemetry schema và identity đã chốt.
- [ ] Experiment manifest có đủ ground truth/version/artifact field.
- [ ] Feature window và split protocol đã chốt.
- [ ] Candidate set service-level đã chốt.
- [ ] Detection và RCA baselines đã chốt.
- [ ] Metric và tolerance đã chốt.
- [ ] Missing-data policy đã chốt.
- [ ] Config/artifact layout đã chốt.
- [ ] Pilot run có data-quality report.
- [ ] Implementation task có DoD và output path theo workspace standard.

Nếu một quyết định làm thay đổi research question, backend topology, experiment manifest hoặc plan, phải cập nhật tài liệu canonical tương ứng thay vì tạo convention thứ hai trong file này.
