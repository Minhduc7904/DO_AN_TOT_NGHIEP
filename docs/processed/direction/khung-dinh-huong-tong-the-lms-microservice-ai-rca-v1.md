# Khung định hướng tổng thể đồ án tốt nghiệp

## Xây dựng hệ thống AI truy vết nguyên nhân sự cố trong kiến trúc microservice

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review).
>
> **Thay thế:** [khung_dinh_huong_tong_the_lms_microservice_ai_rca](khung_dinh_huong_tong_the_lms_microservice_ai_rca.md) (giữ làm lịch sử, không dùng cho phạm vi mới). Tên file đổi sang `kebab-case` và có hậu tố version theo quy ước đặt tên; nội dung gắn với topology 6 business service + Gateway và vai trò "AI hỗ trợ" ở bản cũ không còn áp dụng.
>
> **Phụ thuộc:**
>
> - Quyết định nền: [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md) (bộ service mới), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) (AI truy vết chính; MCP thứ yếu), [ADR-003](../adr/adr-003-remove-admin-service-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
> - Topology và fault: [service-catalogue-and-topology-v2](../architecture/service-catalogue-and-topology-v2.md), [data-ownership-and-fault-matrix-v2](../architecture/data-ownership-and-fault-matrix-v2.md), [complex-case-catalogue-and-rca-result-v0](../architecture/complex-case-catalogue-and-rca-result-v0.md).
> - Phạm vi và đo lường: [project-scope-v2](project-scope-v2.md), [research-questions-and-metrics-v2](research-questions-and-metrics-v2.md).
> - Tài liệu đang được viết lại song song (link theo tên đích): [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md), [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md), [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md).
> - WHEN/WHO: [plan-v0.2-24-weeks](../plan/plan-v0.2-24-weeks.md); plan chưa được cập nhật theo refactor (chưa có bản mới tại thời điểm viết).
> - Backend: [backend-microservice-testbed-blueprint-v2](../architecture/backend-microservice-testbed-blueprint-v2.md) (thay [backend_microservice_testbed_blueprint](../architecture/backend_microservice_testbed_blueprint.md) còn mô tả topology v1); khi mâu thuẫn ưu tiên service-catalogue v2.
>
> **Vai trò canonical:** Source of truth cho WHY, WHAT, vấn đề nghiên cứu, research questions, research scope, high-level architecture, hướng anomaly detection/RCA và triết lý đánh giá. Khi mâu thuẫn, ưu tiên: ADR → service-catalogue v2 → tài liệu này.

Tài liệu này không định nghĩa cây source code, cấu trúc nội bộ service hoặc roadmap theo tuần. Các nội dung đó chỉ được duy trì trong các tài liệu canonical được liên kết ở trên.

## 1. Bối cảnh và bài toán

Trong hệ thống microservice, một request có thể đi qua nhiều service, database, object storage, nhà cung cấp bên ngoài và message queue. Khi một thành phần suy giảm, symptom thường lan ngược lên các service gọi nó, và còn có thể xuất hiện **ở nơi không nằm trên đường request** của người dùng khi nguyên nhân đi qua dependency dùng chung (RabbitMQ, PostgreSQL, MinIO), tầng bất đồng bộ hoặc cơ chế xác thực:

```text
Root cause
-> dependency/service trực tiếp bị ảnh hưởng
-> dependency dùng chung hoặc hàng đợi bất đồng bộ
-> service/worker khác
-> service upstream, API Gateway
-> người dùng thấy timeout/error (có thể sau nhiều phút)
```

Metrics, distributed traces và logs giúp quan sát từng phần nhưng không tự động trả lời đầy đủ:

1. Khi nào hệ thống bắt đầu bất thường?
2. Các signal rời rạc có thuộc cùng một incident không?
3. Service nào có khả năng là nguyên nhân ban đầu thay vì symptom lan truyền?
4. Bằng chứng nào hỗ trợ thứ hạng đó?
5. Với case mà người vận hành theo dõi đường request của triệu chứng không thấy nguyên nhân, một hệ thống tự động có tìm được nguyên nhân, và nhanh hơn thủ công không?

Đồ án giải quyết bài toán AIOps ở quy mô phù hợp nhóm hai người: xây một testbed có kiểm soát, thu thập telemetry đa nguồn, huấn luyện và đánh giá hệ thống tự động phát hiện incident và xếp hạng root-cause candidates, đánh giá bằng fault injection có ground truth và đối chứng với truy vết thủ công.

## 2. Định vị đề tài

### 2.1. LMS là testbed, không phải sản phẩm chính

LMS thu gọn là System Under Test (SUT) giúp tạo workflow dễ hiểu và dependency đủ đa dạng. Đồ án không nhằm xây LMS đầy đủ và không lấy số lượng CRUD làm đóng góp. Topology v2 (8 service + 4 worker) lớn hơn bản cũ có chủ đích (ADR-001): cần đủ chuỗi nhân quả để tồn tại case mà truy vết thủ công khó thấy.

Service `ai` của LMS (cổng LLM soạn bài và sinh quiz, kèm `ai-worker`) chỉ là một thành phần của SUT và là nguồn dependency/fault (nhà cung cấp LLM), không phải hệ thống AI của đề tài. Không đưa AI tutor, recommendation hoặc chấm điểm tự động vào core.

### 2.2. AI là bên truy vết nguyên nhân chính

Phần chính của đề tài là **huấn luyện và đánh giá mô hình (ML + dependency graph)** để truy vết nguyên nhân sự cố; dùng thuật ngữ **RCA engine** cho hệ thống này (ADR-002). Bước kết luận (xếp hạng nguyên nhân) không cần người can thiệp:

```text
telemetry
-> feature engineering
-> anomaly detection
-> incident detection
-> dependency/temporal analysis
-> root-cause candidate ranking (kèm evidence)
```

RCA engine nằm ngoài business request path và không phải một lời gọi LLM để sinh kết luận. Developer/SRE vẫn là người dùng cuối của kết quả, nhưng không còn là bên thực hiện truy vết.

**Thành phần thứ yếu (làm sau).** Một MCP server chỉ đọc và một agent LLM có thể đọc **kết quả của RCA engine** (incident, xếp hạng, điểm, bằng chứng đã chọn sẵn) để viết báo cáo có dẫn chứng. MCP không cấp truy vết tùy ý vào Prometheus/Tempo/Loki; agent không thay mô hình ML xếp hạng và báo "không đủ chứng cứ" khi chứng cứ thiếu. Phần này chỉ làm sau khi RCA engine và phần đánh giá đạt; không phải tiêu chí hoàn thành đề tài.

### 2.3. Đối chứng thủ công

AI được đối chứng với truy vết thủ công bằng hai cách: baseline "thủ công" tự động (ngưỡng + tìm trace lỗi/chậm nhất, chạy lặp được) và thử nghiệm nhỏ với một vài người dùng Grafana/Tempo/Loki để đo thời gian chẩn đoán (ADR-002). Mục tiêu demo: các case phức tạp mà thủ công không tìm ra nguyên nhân hoặc tìm chậm, trong khi RCA engine xếp đúng nguyên nhân gốc. Đây là giả thuyết cần kiểm định, không phải kết luận định trước.

### 2.4. Không chỉ là monitoring

Prometheus, Tempo, Loki và Grafana cung cấp lưu trữ, query và quan sát telemetry gốc. Phần nhóm tự xây gồm feature pipeline, detector, incident correlation, dependency graph, mô hình RCA ranking, evidence và evaluation.

## 3. Mục tiêu

### 3.1. Mục tiêu tổng quát

Xây dựng và đánh giá một hệ thống có khả năng thu thập observability telemetry từ backend microservice, phát hiện incident và tự xác định, xếp hạng nguyên nhân sự cố ở mức service bằng danh sách candidate có bằng chứng, kể cả các case phức tạp mà truy vết thủ công khó tìm ra.

### 3.2. Mục tiêu kỹ thuật

1. Xây LMS microservice testbed có dependency đồng bộ/bất đồng bộ, hạ tầng dùng chung và fault propagation có ý nghĩa.
2. Instrument metrics, distributed traces và structured logs bằng OpenTelemetry; tách phần thu thập sang `aiops-platform/`.
3. Tự động sinh workload, inject fault, reset môi trường và lưu ground truth.
4. Chuẩn hóa telemetry theo service/time window và xây feature schema có version.
5. So sánh statistical baseline với ít nhất một unsupervised detector.
6. Xây incident detection có `estimated_start_time`.
7. Xây dynamic dependency graph từ traces.
8. Huấn luyện/hiệu chỉnh và đánh giá mô hình xếp hạng root-cause candidates bằng anomaly, topology, temporal propagation và evidence.
9. Xây danh mục case phức tạp có ground truth và đối chứng thủ công (baseline tự động và thử nghiệm người), đo thời gian chẩn đoán.
10. Đánh giá định lượng bằng repeated controlled experiments, baseline, ablation và robustness test.
11. Cung cấp artifact/runbook đủ để tái lập kết quả.

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

### RQ6 — AI so với truy vết thủ công trên case phức tạp (mới)

Trên các case có nguyên nhân gốc nằm ngoài đường request của triệu chứng, RCA engine có xếp đúng nguyên nhân gốc mà truy vết thủ công không tìm ra hoặc tìm chậm hơn không, và thời gian chẩn đoán của AI so với thủ công khác nhau thế nào? (Operationalization ở [research-questions-and-metrics-v2](research-questions-and-metrics-v2.md).)

### RQ7 — Tùy chọn

Các fault category (độ trễ dependency, backlog hàng đợi, giữ kết nối DB, độ trễ nhà cung cấp, quá tải tài nguyên, xác thực) ảnh hưởng thế nào đến khả năng detection/RCA? Không thuộc MVP; dùng để stratify/error-analysis. Đây là RQ6 ở bản cũ, đổi số khi thêm RQ6 mới.

## 5. Phạm vi nghiên cứu

### 5.1. Trong phạm vi MVP

- LMS testbed 8 service + 4 worker (12 `service.name`): `gateway`, `auth`, `student`, `course`, `media`, `notification`, `scheduler`, `ai` và `media-worker`, `notification-worker`, `scheduler-worker`, `ai-worker`;
- PostgreSQL 17 (7 logical DB), RabbitMQ (command, outbox/inbox), MinIO, SMTP (Mailpit khi dev/CI), nhà cung cấp LLM (HTTP stub khi test);
- Docker Compose;
- OpenTelemetry, Prometheus, Tempo, Loki và Grafana (trong `aiops-platform/observability/`);
- automated workload bằng k6 (chưa triển khai);
- tám fault canonical FA–FH và bảy case phức tạp C1–C7 (case nào chạy thật mới vào đánh giá);
- metrics, traces và structured logs có correlation;
- statistical baselines và Isolation Forest hoặc detector unsupervised tương đương;
- incident detection;
- dynamic service dependency graph;
- mô hình RCA service-level root-cause candidate ranking (ML + dependency graph), huấn luyện và đánh giá;
- đối chứng thủ công (baseline tự động và thử nghiệm người nhỏ) và thời gian chẩn đoán;
- dependency/component evidence;
- baseline, ablation, repeated evaluation và ít nhất một robustness evaluation focused bằng controlled trace dropping/sampling simulation trên telemetry artifact hoặc missing-modality evaluation; không yêu cầu robustness matrix lớn.

### 5.2. Thứ yếu (làm sau, không phải điều kiện hoàn thành)

- MCP server chỉ đọc (`aiops-platform/mcp/`) và agent (`aiops-platform/agent/`) đọc kết quả RCA engine để viết báo cáo có dẫn chứng;
- đánh giá chất lượng báo cáo của agent (độ đúng, dẫn chứng, độ phủ) chỉ khi phần này được làm.

### 5.3. Target

- fault crash/restart/pause service hoặc worker như category availability riêng;
- bổ sung tín hiệu telemetry còn thiếu (pool DB, tuổi message, metric publish/consume, độ trễ outbox, log worker, nối trace scheduler) nếu không làm trước dataset;
- log-template feature phong phú hơn;
- change-point detection;
- thêm intensity/target/repetition khi automation ổn;
- expanded robustness evaluation với nhiều sampling level, nhiều missing-modality combination, thêm workload/fault intensity hoặc live sampling experiment khi thực sự cần;
- mở rộng thử nghiệm người thật;
- external benchmark subset;
- component-level evidence chi tiết hơn.

### 5.4. Stretch hoặc ngoài core

- Kubernetes/Chaos Mesh;
- component-level RCA như metric chính;
- instance-level RCA;
- full causal discovery trên toàn telemetry;
- deep sequence model;
- multi-fault incident;
- service mesh, mTLS, multi-cluster hoặc custom operator;
- automatic remediation/self-healing;
- full LMS frontend;
- LLM thay RCA engine để xếp hạng nguyên nhân;
- code-level bug localization.

Kubernetes không thuộc critical path. Không thêm service mesh.

## 6. High-level architecture

```text
                         k6 workload (nhiễu nền + case)
                              |
                              v
+---------------------------------------------------------------------+
| LMS MICROSERVICE TESTBED v2                                         |
|                                                                     |
| gateway -> auth -> student                                          |
|         -> course -> media, ai (facade)                             |
|         -> media -> student                                         |
|         -> notification, scheduler, ai, student                     |
|                                                                     |
| worker: media-worker, notification-worker, scheduler-worker,        |
|         ai-worker (consume command qua RabbitMQ)                    |
|   notification-worker -> student; scheduler-worker -> media;        |
|   ai-worker -> course, media, nhà cung cấp LLM                      |
|                                                                     |
| PostgreSQL (7 logical DB) + RabbitMQ + MinIO + SMTP + LLM provider  |
| mọi cạnh xác thực bằng service token do auth cấp (JWKS)             |
+------------------------------+--------------------------------------+
                               |
                        OpenTelemetry (OTLP/HTTP)
                               |
                               v
   aiops-platform: Collector -> Prometheus + Tempo + Loki -> Grafana
                               |
                               v
+---------------------------------------------------------------------+
| RCA ENGINE (aiops-platform/training)                                |
| Telemetry -> Features -> Anomaly -> Incident                        |
|           -> Dynamic Graph -> RCA model -> Evidence                 |
|           -> RcaIncidentResult -> Evaluation                        |
|                          |                                          |
|                          +--> (thứ yếu) MCP -> Agent -> Báo cáo     |
+---------------------------------------------------------------------+
```

Sơ đồ rút gọn; dependency graph đầy đủ (edge `e01–e29`, 17 dependency identity cộng cạnh `*-auth-token`/`*-auth-jwks`) và catalogue ở [service-catalogue-and-topology-v2](../architecture/service-catalogue-and-topology-v2.md). Chi tiết topology và source code thuộc các tài liệu canonical tương ứng.

## 7. Hướng observability và dữ liệu

### 7.1. Identity và thời gian

Mọi telemetry dùng identity tối thiểu:

```text
service.name
service.version
service.instance.id
```

`service.name` là một trong 12 giá trị canonical; container/pod/process name không dùng thay `service.name`. Dependency dùng `dependency_identity` dạng `<service.name bên dùng>-<hạ tầng>` (ví dụ `media-minio`, `ai-llm-provider`, `gateway-auth-token`). Timestamp dùng UTC, ISO-8601. `trace_id` và `span_id` dùng cho correlation, không dùng làm Prometheus label.

### 7.2. Metrics

Feature ưu tiên:

- request rate, error rate, latency p50/p95/p99;
- CPU, memory và runtime signal có giá trị;
- downstream request/error/latency theo `dependency_identity`;
- PostgreSQL, MinIO, SMTP, LLM provider, RabbitMQ signal;
- độ sâu queue và số consumer cho async scenario (lấy từ metric broker).

Tín hiệu chưa có và được ghi nhận như giới hạn (complex-case-catalogue mục 1.5): độ sử dụng pool PostgreSQL, tuổi message cũ nhất, metric publish/consume ở runtime, độ trễ outbox.

### 7.3. Traces

Traces cung cấp:

- caller-callee relationship;
- span duration/error/timeout;
- dynamic service graph, gồm async edge nối bằng `traceparent` trong envelope command RabbitMQ;
- propagation path;
- abnormal dependency evidence.

Baseline controlled experiment dùng 100% trace sampling. MVP robustness có thể mô phỏng trace dropping/sampling có kiểm soát trên telemetry artifact đã thu; live sampling experiment và nhiều sampling level thuộc Target.

### 7.4. Logs

Structured logs có service identity, trace ID, span ID, event/error type và dependency identity. MVP ưu tiên aggregate feature như error-log rate, exception count và timeout count; không đưa raw log string trực tiếp vào model. Worker hiện không có log khi xử lý command (lỗi chỉ thấy ở span và `dependency.failure`).

### 7.5. Time window

Telemetry được chuẩn hóa theo service/time window. Window size và step phải được pilot, version hóa và giữ cố định trong campaign chính. Có thể thử 30/60/120 giây trên validation; không tune trên test campaign. Độ trễ thu thập đã đo (log ≈ 2 giây, trace ≈ 2,5 giây, metric ≈ 4–10 giây) nên cửa sổ ghép tín hiệu nên ≥ 15 giây.

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
root_cause_service = course
root_cause_component = course-postgres
```

Trong MVP, `course-postgres` là component evidence; candidate chính để tính Top-K/MRR là `course`. Candidate set mặc định gồm 11 service/worker (mọi `service.name` trừ `gateway`); `gateway` là symptom mặc định. Không trộn service-level và component-level trong cùng metric chính. Khi owner khác process (ví dụ `ai` và `ai-worker`), primary metric vẫn chấm theo `root_cause_service` của ground truth; owner-level Top-K chỉ là diagnostic phụ (evaluation-protocol-v1 mục 4.2, đề xuất chờ Đức xác nhận).

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

Weight được chọn trên validation hoặc kiểm tra bằng sensitivity analysis. Không chọn weight sau khi xem kết quả test campaign. Chưa chốt ranker chỉ hiệu chỉnh trên validation hay còn huấn luyện có giám sát bằng run có nhãn; nếu có thì phải tách khỏi run đánh giá (xem project-scope-v2 mục 3.5).

### 9.3. Baseline RCA

So sánh tối thiểu:

1. rank by anomaly severity;
2. rank by earliest anomaly;
3. graph-aware simple baseline;
4. proposed graph-temporal-evidence ranker;
5. baseline thủ công tự động (ngưỡng + trace lỗi/chậm nhất) cho RQ6.

Thuật ngữ phù hợp là **root-cause candidate localization/ranking**. Telemetry quan sát không tự chứng minh quan hệ nhân quả tuyệt đối; ground truth từ controlled fault mới cho phép đánh giá candidate có đúng hay không.

### 9.4. Kết quả RCA

Kết quả mỗi incident là `RcaIncidentResult` (schema logical ở complex-case-catalogue mục 5): `ranking[]` kèm score, `mechanism`, `propagation_path` và `evidence[]` tham chiếu lại telemetry gốc. Chứng cứ không đủ thì `verdict = "insufficient_evidence"` và `ranking` rỗng. Ground truth không nằm trong kết quả; đánh giá offline đối chiếu theo `run_id`.

## 10. Ground truth và reproducibility

Mỗi experiment run phải truy được:

- experiment/scenario/run ID và repeat index (kèm case C1–C7 nếu có);
- workload profile và seed;
- fault type, target, intensity, start/end;
- `root_cause_service` và `root_cause_component`;
- code commit và service versions;
- telemetry schema và experiment/feature/detector/incident/RCA/evaluation config versions;
- telemetry, prediction và evaluation artifacts.

Chi tiết schema và module ownership được định nghĩa trong [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md) và các tài liệu canonical liên quan.

Split dữ liệu theo **experiment run**. Không đưa các window của cùng run vào cả train và test. Healthy training data dùng fit unsupervised model; validation dùng chọn threshold/weight; test campaign không dùng để tune.

## 11. Fault scope và quy mô thực nghiệm

MVP có tám fault canonical và bảy case phức tạp (chi tiết ở data-ownership-and-fault-matrix-v2 mục 5 và complex-case-catalogue):

| Fault | Case | Mô tả | Root-cause service |
| --- | --- | --- | --- |
| FA | C4 | Chậm/ngắt MinIO; thumbnail kẹt, job cleanup xóa nhầm media | `media` / `media-worker` |
| FB | C1 | Batch thông báo lớn làm chậm `notification-worker`; upload-complete timeout | `notification-worker` |
| FC | C2 | Export CSV giữ kết nối DB; enroll/quiz submit chậm không có span lỗi | `course` |
| FD | C3 | Provider LLM chậm; job AI kẹt rồi `WORKER_INTERRUPTED` | `ai` (process `ai-worker`) |
| FE | C5 | `student-postgres` chậm; batch thông báo `PARTIAL_FAILED`, log không lỗi | `student` |
| FF | không có case riêng | Quá tải CPU/bộ nhớ một service; bằng chứng phụ | bất kỳ service |
| FG | C6 | `auth` chậm/chết; 5xx hàng loạt sau khoảng yên lặng (≤ 10 phút) | `auth` |
| FH | C7 | Lệch khóa ký; 401 đồng loạt khi cache JWKS hết hạn | `auth` |

Trạng thái kiểm chứng (29/10/2026): chỉ C6 đã chạy thật; các case còn lại mới đo tín hiệu, và chuỗi nhân quả của C1 sang `media-worker` là giả thuyết. Case chỉ vào tập đánh giá khi chuỗi nhân quả đã chạy thật và có ground truth; fault injector và workload k6 thuộc mảng AI, chưa triển khai.

Evaluation floor (đề xuất chờ Đức xác nhận; chốt ở evaluation-protocol-v1 mục 5.3):

```text
K × R controlled runs
K = số case đủ điều kiện vào campaign (tối đa 7)
R = 3 repetitions mỗi case (đề xuất, thừa kế v1)
```

v1 dùng `5 × 3 = 15`; nếu đủ bảy case thì `7 × 3 = 21`, nhưng hiện trạng chỉ C6 chạy thật nên chưa có con số cố định. Target có thể mở rộng nếu automation, thời gian và chất lượng ground truth cho phép; không coi số lượng lớn là điều kiện bắt buộc và không mở fault matrix trên mọi service.

Healthy runs cần bao gồm normal traffic và healthy high-load spike để đo false positive/workload shift. Mỗi case chạy song song workload nhiễu nền.

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

### 12.3. AI so với thủ công

- thời gian chẩn đoán của RCA engine, baseline thủ công tự động và người, theo từng case (định nghĩa ở research-questions-and-metrics-v2 mục 10.4 và evaluation-protocol-v1 mục 15.4, đề xuất chờ Đức xác nhận);
- độ đúng của chẩn đoán và số case AI đúng còn thủ công sai;
- báo cáo theo case, không gộp thành điểm tổng hợp.

### 12.4. System

- feature extraction time;
- RCA runtime;
- CPU/memory;
- query latency;
- instrumentation overhead trên throughput/p95 latency.

### 12.5. Ablation và robustness

Ưu tiên:

```text
M vs M+T vs M+T+L
without graph vs with graph
without temporal vs with temporal
full telemetry vs missing modality/sampled trace
normal load vs healthy high-load spike
```

MVP phải thực hiện ít nhất một robustness comparison focused để trả lời RQ4, nhưng có thể chọn trace dropping/sampling simulation **hoặc** missing-modality evaluation và tái sử dụng baseline artifact 100% trace sampling. Matrix gồm nhiều sampling level, nhiều tổ hợp modality, thêm intensity/repetition hoặc live sampling thuộc Target.

Không cần một "accuracy tổng hợp" duy nhất. Báo cáo phải nêu case/fault category nào tốt/xấu, failure cases, runtime, trade-off và threats to validity. Proposed method không thắng mọi baseline, hoặc AI không thắng thủ công ở một số case, không đồng nghĩa đồ án thất bại nếu phân tích có bằng chứng.

Chất lượng báo cáo của agent (độ đúng, dẫn chứng, độ phủ) chỉ đánh giá khi phần MCP/agent được làm; không thuộc tiêu chí hoàn thành.

## 13. Giá trị nghiên cứu và tính khả thi

Đóng góp phù hợp với đồ án không nhất thiết là neural architecture mới. Giá trị nằm ở tổ hợp:

- testbed có kiểm soát, topology có ý nghĩa và danh mục case phức tạp có ground truth;
- observability-by-design;
- dataset/ground truth có thể tái lập;
- multi-source feature pipeline;
- mô hình graph/temporal RCA có thể giải thích, truy vết nguyên nhân không cần người can thiệp;
- đối chứng với truy vết thủ công, gồm thời gian chẩn đoán;
- baseline, ablation và robustness evaluation;
- phân tích trung thực về giới hạn.

Phương châm:

> **SOTA-inspired, engineering-feasible, quantitatively evaluated.**

## 14. Sản phẩm đầu ra dự kiến

1. LMS microservice testbed v2 và Docker Compose runtime.
2. OpenTelemetry/Prometheus/Tempo/Loki/Grafana observability stack (`aiops-platform/observability/`).
3. Workload, fault catalog/injectors và experiment runner.
4. Dataset từ fault injection, module huấn luyện và telemetry/feature/anomaly/incident/graph/RCA/evidence/evaluation modules.
5. Dataset manifest, ground truth, `RcaIncidentResult` và evaluation artifacts.
6. Kết quả đối chứng thủ công và thời gian chẩn đoán.
7. API hoặc giao diện tối thiểu để xem incident, candidates, timeline và evidence.
8. (Thứ yếu) MCP server chỉ đọc và agent viết báo cáo từ kết quả RCA.
9. Báo cáo thực nghiệm, runbook và gói tái lập.

## 15. Rủi ro và nguyên tắc giảm scope

| Rủi ro | Quy tắc xử lý |
| --- | --- |
| LMS chiếm hết thời gian | Topology v2 đã freeze theo ADR-001; thêm service/nghiệp vụ phải có ADR |
| Observability làm muộn | Instrument ngay trong service template và test propagation (đã có smoke trace/metrics/logs ở R-12) |
| Fault không tái lập | Cố định seed/config, tự động reset và lưu manifest mỗi run |
| Case phức tạp không tái lập chuỗi nhân quả như mô tả | Chỉ dùng case đã chạy thật; sửa hoặc loại case và ghi lý do vào ledger |
| Tín hiệu telemetry thiếu (pool DB, tuổi message, outbox, publish/consume, log worker) | Ghi vào coverage; Đức quyết định có bổ sung trước khi thu dataset |
| Data leakage | Split theo run; freeze protocol trước campaign chính |
| Detector/RCA engine không vượt baseline | Báo cáo trung thực; tập trung vào fusion/RCA/evidence và failure case |
| RCA tìm symptom | Dùng onset, dependency, propagation và edge evidence |
| Owner khác process (`ai` và `ai-worker`, `media` và `media-worker`) làm sai lệch Top-K | Chấm theo `root_cause_service` của ground truth, kèm owner-level Top-K phụ (evaluation-protocol-v1 mục 4.2; chờ Đức xác nhận) |
| Thử nghiệm người nhỏ, dễ thiên lệch | Báo cáo mô tả, chỉ rõ cỡ mẫu và hiệu ứng học; không suy diễn thống kê quá mức |
| Prompt injection từ nội dung log/trace (khi làm MCP/agent) | Coi nội dung log/trace là dữ liệu không tin cậy; MCP chỉ đọc; `get_ground_truth` chỉ bật offline |
| Kubernetes làm chậm | Giữ Docker Compose; Kubernetes chỉ Stretch |
| Missing trace | Đánh giá robustness và fallback metrics/log evidence |

## 16. Decision summary

- LMS thu gọn là testbed; RCA engine (ML + dependency graph) là bên truy vết chính, developer/SRE là người dùng kết quả (ADR-002).
- MVP topology là 8 service + 4 worker (12 `service.name`); hạ tầng PostgreSQL 17, RabbitMQ, MinIO, SMTP, nhà cung cấp LLM; Redis và Storage Mock đã bỏ (ADR-001, ADR-003).
- Xác thực bằng token EdDSA + JWKS và service access token; `auth` là điểm lỗi chung có chủ đích (ADR-004).
- OpenTelemetry là chuẩn telemetry; Docker Compose là runtime chính.
- Analysis là Python/CLI; backend testbed dùng TypeScript + NestJS.
- Controlled fault injection (FA–FH, case C1–C7) là nguồn ground truth chính; chỉ case đã chạy thật vào đánh giá.
- Dynamic dependency graph lấy chủ yếu từ traces.
- Primary RCA evaluation là service-level; component/dependency là evidence bổ sung.
- Đối chứng thủ công và thời gian chẩn đoán là một phần của đánh giá chính (RQ6).
- MCP/agent là thứ yếu, làm sau, không phải tiêu chí hoàn thành.
- Evaluation floor đề xuất `K × R` với `R = 3` (21 run nếu đủ bảy case), chờ Đức xác nhận; quy mô lớn hơn là Target.
- LLM xếp hạng nguyên nhân, Kubernetes, service mesh và component-level RCA không thuộc core MVP.
- Plan v0.2 vẫn là tài liệu 24 tuần hiện có nhưng chưa cập nhật theo refactor.

Implementation backend phải tham chiếu service-catalogue v2 và các contract v2; implementation Analysis/AI/RCA phải tham chiếu [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md). Không tạo một cây source code hoặc roadmap khác trong tài liệu này.

---

# Khác biệt so với bản trước

| Mục | Bản cũ | v1 mới |
| --- | --- | --- |
| Tên file | `khung_dinh_huong_tong_the_lms_microservice_ai_rca.md` (gạch dưới, không version) | `khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md` (`kebab-case`, có hậu tố version) |
| Tiêu đề | Hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân | Hệ thống AI truy vết nguyên nhân sự cố |
| Vai trò AI | AI phục vụ developer/SRE trong pipeline phân tích; kết quả là danh sách candidate cho người | RCA engine (ML + dependency graph) là bên truy vết chính, kết luận không cần người can thiệp; MCP/agent thứ yếu (ADR-002) |
| Bài toán | Symptom lan ngược lên service gọi | Thêm symptom ở nơi không nằm trên đường request (dependency dùng chung, async, xác thực) và so sánh với truy vết thủ công |
| Topology | 6 business service + Gateway; Redis, storage mock | 8 service + 4 worker (12 `service.name`); PostgreSQL 17, RabbitMQ, MinIO, SMTP, nhà cung cấp LLM (ADR-001/003/004) |
| RQ | RQ1–RQ5 chính; RQ6 tùy chọn (fault category) | RQ1–RQ6 chính (RQ6 mới: AI so với thủ công); fault category thành RQ7 tùy chọn |
| Fault | 5 scenario F1–F5 | 8 fault FA–FH, bảy case phức tạp C1–C7 |
| Quy mô | 5 × 3 = 15 run | Đề xuất chờ Đức xác nhận: `K × R` với `R = 3` (21 run nếu đủ bảy case) |
| Đánh giá | Detection, RCA, system | Thêm thời gian chẩn đoán và đối chứng thủ công; báo cáo theo case |
| Ví dụ granularity | `submission` / `submission-db` | `course` / `course-postgres` |
| Thành phần thứ yếu | Không có | Mục 5.2: MCP server và agent |
| Target/Stretch | Assignment, MinIO, Submission crash/restart là Target | MinIO vào MVP; Assignment bỏ; Target: crash/restart worker, bổ sung tín hiệu thiếu, mở rộng thử nghiệm người |
| Rủi ro | Tám dòng gắn v1 | Thêm case không tái lập, tín hiệu thiếu, owner khác process, thử nghiệm người nhỏ, prompt injection |
| Tham chiếu | Backend blueprint, analysis blueprint, plan v0.2 | Thêm ADR, catalogue v2, fault matrix v2, complex-case catalogue, backend blueprint v2, telemetry/evaluation/analysis v1; plan chưa được cập nhật |
