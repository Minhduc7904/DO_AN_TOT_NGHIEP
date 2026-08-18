# Khung định hướng tổng thể đồ án tốt nghiệp

## Xây dựng hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố trong kiến trúc microservice

> **Vai trò canonical:** Source of truth cho WHY, WHAT, vấn đề nghiên cứu, research questions, research scope, high-level architecture, hướng anomaly detection/RCA và triết lý đánh giá.
>
> **Backend scope/topology:** [`../architecture/dinh_huong_backend_microservice_testbed_lms.md`](../architecture/dinh_huong_backend_microservice_testbed_lms.md)
>
> **Implementation architecture:** [`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md)
>
> **Kế hoạch WHEN/WHO:** [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md)

Tài liệu này không định nghĩa cây source code, cấu trúc nội bộ service hoặc roadmap theo tuần. Các nội dung đó chỉ được duy trì trong blueprint và plan canonical được liên kết ở trên.

## 1. Bối cảnh và bài toán

Trong hệ thống microservice, một request có thể đi qua nhiều service, database, cache, storage và message queue. Khi một thành phần suy giảm, symptom thường lan ngược lên các service gọi nó:

```text
Root cause
-> dependency/service trực tiếp bị ảnh hưởng
-> service upstream
-> API Gateway
-> người dùng thấy timeout/error
```

Metrics, distributed traces và logs giúp quan sát từng phần nhưng không tự động trả lời đầy đủ:

1. Khi nào hệ thống bắt đầu bất thường?
2. Các signal rời rạc có thuộc cùng một incident không?
3. Service nào có khả năng là nguyên nhân ban đầu thay vì symptom lan truyền?
4. Bằng chứng nào hỗ trợ thứ hạng đó?

Đồ án giải quyết bài toán AIOps ở quy mô phù hợp nhóm hai người: xây một testbed có kiểm soát, thu thập telemetry đa nguồn, phát hiện incident, xếp hạng root-cause candidates và đánh giá bằng fault injection có ground truth.

## 2. Định vị đề tài

### 2.1. LMS là testbed, không phải sản phẩm chính

LMS thu gọn là System Under Test (SUT) giúp tạo workflow dễ hiểu và dependency đủ đa dạng. Đồ án không nhằm xây LMS đầy đủ, không lấy số lượng CRUD làm đóng góp và không đưa chatbot, AI tutor, recommendation hoặc automatic grading vào core.

### 2.2. AI phục vụ developer/SRE

AI nằm trong pipeline phân tích vận hành:

```text
telemetry
-> feature engineering
-> anomaly detection
-> incident detection
-> dependency/temporal analysis
-> root-cause candidate ranking
```

AI không nằm trên business request path và không phải một lời gọi LLM để sinh kết luận.

### 2.3. Không chỉ là monitoring

Prometheus, Tempo, Loki và Grafana cung cấp lưu trữ, query và quan sát telemetry gốc. Phần nhóm tự xây gồm feature pipeline, detector, incident correlation, dependency graph, RCA ranking, evidence và evaluation.

## 3. Mục tiêu

### 3.1. Mục tiêu tổng quát

Xây dựng và đánh giá một hệ thống có khả năng thu thập observability telemetry từ backend microservice, phát hiện incident và hỗ trợ developer/SRE khoanh vùng nguyên nhân sự cố bằng danh sách candidate có bằng chứng.

### 3.2. Mục tiêu kỹ thuật

1. Xây LMS microservice testbed có dependency đồng bộ/bất đồng bộ và fault propagation có ý nghĩa.
2. Instrument metrics, distributed traces và structured logs bằng OpenTelemetry.
3. Tự động sinh workload, inject fault, reset môi trường và lưu ground truth.
4. Chuẩn hóa telemetry theo service/time window và xây feature schema có version.
5. So sánh statistical baseline với ít nhất một unsupervised detector.
6. Xây incident detection có `estimated_start_time`.
7. Xây dynamic dependency graph từ traces.
8. Xếp hạng root-cause candidates bằng anomaly, topology, temporal propagation và evidence.
9. Đánh giá định lượng bằng repeated controlled experiments, baseline, ablation và robustness test.
10. Cung cấp artifact/runbook đủ để tái lập kết quả.

## 4. Câu hỏi nghiên cứu

### RQ1 — Giá trị của telemetry đa nguồn

Metrics + traces + structured logs có cải thiện anomaly detection và RCA so với metrics-only không?

So sánh tối thiểu:

```text
M
M + T
M + T + L
```

### RQ2 — Giá trị của dependency graph

Dependency graph từ distributed traces có cải thiện service-level root-cause ranking so với chỉ xếp theo anomaly severity không?

### RQ3 — Giá trị của temporal information

Temporal precedence và propagation order có giúp phân biệt root cause với symptom lan truyền không?

### RQ4 — Robustness

Kết quả suy giảm thế nào khi trace bị sampling hoặc một modality bị thiếu?

### RQ5 — Trade-off kỹ thuật

Trade-off giữa detection/RCA quality, runtime, complexity, interpretability và instrumentation overhead là gì?

### RQ6 — Tùy chọn

Các fault category như cache, downstream dependency, service error, async queue và resource/availability ảnh hưởng thế nào đến khả năng detection/RCA?

## 5. Phạm vi nghiên cứu

### 5.1. Trong phạm vi MVP

- LMS testbed với 6 business service + API Gateway;
- PostgreSQL, Redis, RabbitMQ và controllable storage mock;
- Docker Compose;
- OpenTelemetry, Prometheus, Tempo, Loki và Grafana;
- automated workload bằng k6;
- khoảng 5 controlled fault scenarios;
- metrics, traces và structured logs có correlation;
- statistical baselines và Isolation Forest hoặc detector unsupervised tương đương;
- incident detection;
- dynamic service dependency graph;
- service-level root-cause candidate ranking;
- dependency/component evidence;
- baseline, ablation, robustness và repeated evaluation.

### 5.2. Target

- Assignment service;
- MinIO;
- log-template feature phong phú hơn;
- change-point detection;
- thêm intensity/target/repetition khi automation ổn;
- external benchmark subset;
- component-level evidence chi tiết hơn.

### 5.3. Stretch hoặc ngoài core

- Kubernetes/Chaos Mesh;
- component-level RCA như metric chính;
- instance-level RCA;
- full causal discovery trên toàn telemetry;
- deep sequence model;
- multi-fault incident;
- service mesh, multi-cluster hoặc custom operator;
- automatic remediation/self-healing;
- full LMS frontend;
- LLM root-cause reasoning;
- code-level bug localization.

Kubernetes không thuộc critical path. Không thêm service mesh.

## 6. High-level architecture

```text
                         k6 workload
                              |
                              v
+-----------------------------------------------------------+
| LMS MICROSERVICE TESTBED                                  |
|                                                           |
| Gateway -> Auth                                           |
|        -> Course -> Redis                                 |
|        -> Enrollment -> Course                            |
|        -> Submission -> Course + Enrollment + Storage     |
|        -> Grading -> Submission                           |
|                     -> grade.completed -> Notification    |
|                                                           |
| PostgreSQL logical databases + RabbitMQ                   |
+-----------------------------+-----------------------------+
                              |
                       OpenTelemetry
                              |
                              v
        Collector -> Prometheus + Tempo + Loki -> Grafana
                              |
                              v
+-----------------------------------------------------------+
| INCIDENT DIAGNOSIS                                        |
| Telemetry -> Features -> Anomaly -> Incident              |
|           -> Dynamic Graph -> RCA Ranker -> Evidence      |
|           -> Evaluation                                   |
+-----------------------------------------------------------+
```

Target có thể chèn `Assignment -> Course` và đổi Submission thành `Submission -> Assignment + Enrollment + Storage`. Chi tiết topology thuộc tài liệu định hướng backend; chi tiết source code thuộc blueprint.

## 7. Hướng observability và dữ liệu

### 7.1. Identity và thời gian

Mọi telemetry dùng identity tối thiểu:

```text
service.name
service.version
service.instance.id
```

Timestamp dùng UTC, ISO-8601. `trace_id` và `span_id` dùng cho correlation, không dùng làm Prometheus label.

### 7.2. Metrics

Feature ưu tiên:

- request rate, error rate, latency p50/p95/p99;
- CPU, memory và runtime signal có giá trị;
- downstream request/error/latency;
- PostgreSQL, Redis, storage và RabbitMQ signal;
- queue depth/consumer lag cho async scenario.

### 7.3. Traces

Traces cung cấp:

- caller-callee relationship;
- span duration/error/timeout;
- dynamic service graph;
- propagation path;
- abnormal dependency evidence.

Baseline controlled experiment dùng 100% trace sampling. Sampling reduction là robustness experiment sau khi baseline ổn định.

### 7.4. Logs

Structured logs có service identity, trace ID, span ID, event/error type và dependency identity. MVP ưu tiên aggregate feature như error-log rate, exception count và timeout count; không đưa raw log string trực tiếp vào model.

### 7.5. Time window

Telemetry được chuẩn hóa theo service/time window. Window size và step phải được pilot, version hóa và giữ cố định trong campaign chính. Có thể thử 30/60/120 giây trên validation; không tune trên test campaign.

## 8. Hướng anomaly và incident detection

### 8.1. Baseline

Tối thiểu gồm:

1. Static threshold.
2. Robust z-score hoặc statistical baseline tương đương.
3. Isolation Forest hoặc unsupervised detector tương đương.

Change-point detection là Target để ước lượng incident onset tốt hơn. Không bắt đầu bằng LSTM/Transformer khi chưa chứng minh classical baseline không đủ.

### 8.2. Incident

Không tạo incident từ một điểm bất thường đơn lẻ. Incident engine có thể dùng persistence qua nhiều step và topology/time proximity để gom signal liên quan.

Incident tối thiểu lưu:

```text
incident_id
detected_at
estimated_start_time
estimated_end_time
affected_services
state
detector_config_version
```

## 9. Hướng RCA

### 9.1. Granularity canonical

Primary RCA evaluation là **service-level**.

```text
root_cause_service = submission
root_cause_component = submission-db
```

Trong MVP, `submission-db` là component evidence; candidate chính để tính Top-K/MRR là `submission`. Không trộn service-level và component-level trong cùng metric chính.

### 9.2. Candidate ranking

RCA nên kết hợp:

- anomaly severity;
- temporal precedence;
- propagation compatibility;
- edge degradation;
- evidence strength.

Một công thức khởi điểm có thể là:

```text
R(s) = w1*A(s) + w2*T(s) + w3*P(s) + w4*E(s) + w5*V(s)
```

Weight được chọn trên validation hoặc kiểm tra bằng sensitivity analysis. Không chọn weight sau khi xem kết quả test campaign.

### 9.3. Baseline RCA

So sánh tối thiểu:

1. rank by anomaly severity;
2. rank by earliest anomaly;
3. graph-aware simple baseline;
4. proposed graph-temporal-evidence ranker.

Thuật ngữ phù hợp là **root-cause candidate localization/ranking**. Telemetry quan sát không tự chứng minh quan hệ nhân quả tuyệt đối; ground truth từ controlled fault mới cho phép đánh giá candidate có đúng hay không.

## 10. Ground truth và reproducibility

Mỗi experiment run phải truy được:

- experiment/scenario/run ID và repeat index;
- workload profile và seed;
- fault type, target, intensity, start/end;
- `root_cause_service` và `root_cause_component`;
- code commit và service versions;
- experiment/detector/RCA config versions;
- telemetry, prediction và evaluation artifacts.

Chi tiết schema và module ownership được định nghĩa trong backend blueprint.

Split dữ liệu theo **experiment run**. Không đưa các window của cùng run vào cả train và test. Healthy training data dùng fit unsupervised model; validation dùng chọn threshold/weight; test campaign không dùng để tune.

## 11. Fault scope và quy mô thực nghiệm

MVP ưu tiên năm scenario đại diện cho năm category:

1. Course / Redis latency — cache.
2. Submission -> storage latency — downstream dependency.
3. Submission service error — service error.
4. Notification consumer slowdown / RabbitMQ backlog — async queue.
5. Submission CPU pressure hoặc crash — resource/availability.

MVP evaluation floor:

```text
5 scenarios × 3 repetitions = 15 controlled runs
```

Target có thể mở rộng khoảng 30–60+ run nếu automation, thời gian và chất lượng ground truth cho phép. Không coi 60–100 run là điều kiện bắt buộc và không mở fault matrix trên mọi service.

Healthy runs cần bao gồm normal traffic và healthy high-load spike để đo false positive/workload shift.

## 12. Triết lý đánh giá

### 12.1. Detection

- Precision;
- Recall;
- F1;
- False Positive Rate;
- Detection Delay;
- incident-level detection.

### 12.2. RCA

- service-level Top-1;
- service-level Top-3;
- service-level Mean Reciprocal Rank;
- Average Rank và error analysis khi hữu ích.

### 12.3. System

- feature extraction time;
- RCA runtime;
- CPU/memory;
- query latency;
- instrumentation overhead trên throughput/p95 latency.

### 12.4. Ablation và robustness

Ưu tiên:

```text
M vs M+T vs M+T+L
without graph vs with graph
without temporal vs with temporal
full telemetry vs missing modality/sampled trace
normal load vs healthy high-load spike
```

Không cần một “accuracy tổng hợp” duy nhất. Báo cáo phải nêu fault category nào tốt/xấu, failure cases, runtime, trade-off và threats to validity. Proposed method không thắng mọi baseline không đồng nghĩa đồ án thất bại nếu phân tích có bằng chứng.

## 13. Giá trị nghiên cứu và tính khả thi

Đóng góp phù hợp với đồ án không nhất thiết là neural architecture mới. Giá trị nằm ở tổ hợp:

- testbed có kiểm soát và topology có ý nghĩa;
- observability-by-design;
- dataset/ground truth có thể tái lập;
- multi-source feature pipeline;
- graph/temporal RCA có thể giải thích;
- baseline, ablation và robustness evaluation;
- phân tích trung thực về giới hạn.

Phương châm:

> **SOTA-inspired, engineering-feasible, quantitatively evaluated.**

## 14. Sản phẩm đầu ra dự kiến

1. LMS microservice testbed và Docker Compose runtime.
2. OpenTelemetry/Prometheus/Tempo/Loki/Grafana observability stack.
3. Workload, fault catalog/injectors và experiment runner.
4. Telemetry/feature/anomaly/incident/graph/RCA/evidence/evaluation modules.
5. Dataset manifest, ground truth, prediction và evaluation artifacts.
6. API hoặc giao diện tối thiểu để xem incident, candidates, timeline và evidence.
7. Báo cáo thực nghiệm, runbook và gói tái lập.

## 15. Rủi ro và nguyên tắc giảm scope

| Rủi ro | Quy tắc xử lý |
| --- | --- |
| LMS chiếm hết thời gian | Freeze business feature khi đủ topology/fault diversity. |
| Observability làm muộn | Instrument ngay trong service template và test propagation. |
| Fault không tái lập | Cố định seed/config, tự động reset và lưu manifest mỗi run. |
| Data leakage | Split theo run; freeze protocol trước campaign chính. |
| Detector không vượt baseline | Báo cáo trung thực; tập trung vào fusion/RCA/evidence. |
| RCA tìm symptom | Dùng onset, dependency, propagation và edge evidence. |
| Kubernetes làm chậm | Giữ Docker Compose; Kubernetes chỉ Stretch. |
| Missing trace | Đánh giá robustness và fallback metrics/log evidence. |

## 16. Decision summary

- LMS thu gọn là testbed, developer/SRE là người dùng của hệ thống AI.
- MVP topology là 6 business service + Gateway; Assignment thuộc Target.
- OpenTelemetry là chuẩn telemetry; Docker Compose là runtime chính.
- Analysis là modular monolith Python; backend testbed dùng TypeScript + NestJS.
- Controlled fault injection là nguồn ground truth chính.
- Dynamic dependency graph lấy chủ yếu từ traces.
- Primary RCA evaluation là service-level; component/dependency là evidence bổ sung.
- MVP evaluation floor là 15 controlled runs; quy mô lớn hơn là Target.
- LLM, Kubernetes, service mesh và component-level RCA không thuộc core MVP.
- Plan v0.2 là tài liệu duy nhất định nghĩa 24 tuần và phân công.

Mọi quyết định implementation chi tiết phải tham chiếu [`backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md); không tạo một cây source code hoặc roadmap khác trong tài liệu này.
