# Research questions và metrics v2

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Cập nhật R-13:** `auth` và `student` đã gộp thành service `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)); tài liệu được sửa tại chỗ theo topology 7 service + 4 worker (11 runtime). Các số đo chưa đo lại sau khi gộp được ghi rõ ở chỗ dùng.
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review). Chỗ nào là lựa chọn chưa có nguồn xác nhận được ghi "đề xuất chờ Đức xác nhận".
>
> **Thay thế:** [research-questions-and-metrics-v1](research-questions-and-metrics-v1.md) (giữ làm lịch sử, không dùng cho đánh giá trên topology v2). Bản v1 gắn với năm fault F1–F5, topology 6 business service + Gateway và vai trò "AI hỗ trợ".
>
> **Phụ thuộc:**
>
> - Quyết định nền: [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) (AI truy vết chính; đo thời gian chẩn đoán; MCP thứ yếu), [ADR-003](../adr/adr-003-remove-admin-service-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
> - Topology, fault và case: [service-catalogue-and-topology-v2](../architecture/service-catalogue-and-topology-v2.md), [data-ownership-and-fault-matrix-v2](../architecture/data-ownership-and-fault-matrix-v2.md) (FA–FH), [complex-case-catalogue-and-rca-result-v0](../architecture/complex-case-catalogue-and-rca-result-v0.md) (C1–C7, tín hiệu có thật và chưa có).
> - Định hướng và phạm vi: [khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1](khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md), [project-scope-v2](project-scope-v2.md).
> - Tài liệu đang được viết lại song song (link theo tên đích): [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md), [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md) (chốt protocol chi tiết, candidate set, split, đối chứng thủ công), [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md).
> - Backend: [backend-microservice-testbed-blueprint-v2](../architecture/backend-microservice-testbed-blueprint-v2.md) (thay [backend_microservice_testbed_blueprint](../architecture/backend_microservice_testbed_blueprint.md) còn mô tả topology v1); khi mâu thuẫn, ưu tiên service-catalogue v2.

## 1. Mục tiêu của tài liệu

Tài liệu này chuyển RQ1–RQ5 của định hướng tổng thể và RQ6 mới (AI so với truy vết thủ công, ADR-002) thành các phép so sánh có thể đánh giá trên testbed v2. Mỗi RQ được gắn với:

1. giả thuyết hoặc mục tiêu so sánh;
2. telemetry và ground truth tối thiểu cần có;
3. baseline/phương pháp hoặc ablation cần chạy;
4. metric chính và metric bổ sung;
5. điều kiện giữ cố định để tránh so sánh sai lệch.

Không chọn model cuối cùng tại đây. Các lựa chọn threshold, weight, hyperparameter, window size và cấu hình campaign phải được chọn trên training/validation rồi freeze trước final test campaign.

Thuật ngữ: **RCA engine** là hệ thống truy vết nguyên nhân của đề tài (ML + dependency graph), là bên truy vết chính; không nhầm với service `ai` của LMS (gateway LLM soạn bài, chỉ là thành phần của SUT). "AI" trong RQ6 chỉ RCA engine.

## 2. Quy ước đánh giá chung

### 2.1. Granularity và unit of evaluation

- Primary RCA evaluation: **service-level**.
- Candidate set mặc định: 10 `service.name` (`identity`, `course`, `media`, `media-worker`, `notification`, `notification-worker`, `scheduler`, `scheduler-worker`, `ai`, `ai-worker`); `gateway` là symptom mặc định và chỉ là candidate khi protocol có gateway fault (service-catalogue v2 mục 8). Candidate set phải được freeze trong evaluation protocol trước final campaign.
- `root_cause_component` (ví dụ `media-minio`, `course-postgres`, `ai-llm-provider`, `identity-jwks`) chỉ là evidence bổ sung, không được trộn vào candidate list chính để tính Top-K/MRR. Hạ tầng không là candidate service-level.
- **Owner và process (đề xuất chờ Đức xác nhận).** Với FA và FD, service sở hữu nguyên nhân (`media`, `ai`) có thể khác process nơi triệu chứng xuất hiện (`media-worker`, `ai-worker`). Theo evaluation-protocol-v1 mục 4.2, primary metric chấm đúng `root_cause_service` của `RunGroundTruth`; owner-level Top-K (gộp `X` và `X-worker`) chỉ là diagnostic phụ để không phạt oan khi engine chỉ ra worker.
- Unit đánh giá chính: **incident/fault-run level**; point/window-level chỉ dùng để chẩn đoán detector.

### 2.2. Split và chống leakage

Split theo **experiment run**, không random các time window:

```text
healthy training runs -> fit scaler/detector
validation runs        -> threshold, weight, hyperparameter, window/config selection
test runs              -> final metrics only
```

Không để window của cùng một `run_id` xuất hiện ở nhiều split. Không thay threshold, RCA weight, feature/window configuration hoặc lựa chọn model sau khi xem kết quả final test campaign. Run có nhãn fault chỉ dùng để huấn luyện ranker nếu evaluation protocol mở rộng cho phép (v0 coi là protocol extension riêng); khi đó phải tách khỏi run đánh giá và không tái dùng ngầm run validation/test.

Thử nghiệm người thật (RQ6) dùng run thuộc final test split (cùng run mà RCA engine và baseline được chấm để so ghép cặp); kết quả không được dùng để chỉnh engine hay baseline (evaluation-protocol-v1 mục 15.3).

### 2.3. Testbed, ground truth và provenance tối thiểu

MVP dùng tám fault canonical FA–FH và bảy case phức tạp C1–C7 (chi tiết kịch bản và tín hiệu ở complex-case-catalogue; tóm tắt ở [project-scope-v2 mục 3.4](project-scope-v2.md)):

| Fault | Case | Loại | `root_cause_service` | Component/evidence |
| --- | --- | --- | --- | --- |
| FA | C4 | Độ trễ dependency (MinIO) | `media` / `media-worker` | `media-minio` |
| FB | C1 | Backlog hàng đợi | `notification-worker` | queue của `notification-worker` |
| FC | C2 | Giữ kết nối DB | `course` | `course-postgres` |
| FD | C3 | Độ trễ nhà cung cấp LLM | `ai` (process chạm provider là `ai-worker`) | `ai-llm-provider` |
| FE | C5 | Độ trễ dependency nhỏ | `identity` | `identity-postgres` |
| FF | không có case riêng | Quá tải tài nguyên | bất kỳ service | instance (CPU/RSS); bằng chứng phụ cho C1–C2 |
| FG | C6 | Độ trễ/ngắt xác thực | `identity` | `identity` |
| FH | C7 | Lệch khóa ký | `identity` | `identity-jwks` |

Trạng thái kiểm chứng (29/10/2026, theo complex-case-catalogue): chỉ C6 đã chạy thật; C1–C5, C7 mới đo tín hiệu, chuỗi nhân quả của C1 sang `media-worker` là giả thuyết; C2 thiếu metric pool DB. Một case chỉ vào tập đánh giá khi chuỗi nhân quả đã chạy thật và có ground truth; case không tái lập được phải ghi lý do vào ledger, không âm thầm loại.

**Evaluation floor (đề xuất chờ Đức xác nhận).** v1 dùng `5 scenarios × 3 repetitions = 15`. Theo evaluation-protocol-v1 mục 5.3, v2 dùng `K × R` với `K` là số case đủ điều kiện vào campaign và `R` là số repetition mỗi case; đề xuất `R = 3` thừa kế v1, tức 21 controlled fault runs nếu đủ bảy case (hiện trạng chỉ C6 chạy thật nên chưa có con số cố định), cộng healthy runs gồm normal traffic và healthy high-load spike để đo false positive/workload shift. Split validation/test và số healthy run chốt ở evaluation-protocol-v1; mọi báo cáo ghi rõ `K`, danh sách case và `R` thực tế.

Mỗi experiment run cần có provenance tối thiểu sau để tái lập và truy ngược kết quả:

```text
run_id
scenario_id (fault FA–FH hoặc healthy)
case_id (C1–C7, nếu có)
repeat_index
fault_type
fault_target
fault_intensity
fault_parameters (nếu có)
fault_start
fault_end
root_cause_service
root_cause_component (nếu có)
workload_profile / workload_seed
code_commit
service_versions
experiment_config_version
feature_config_version
detector_config_version
incident_config_version
rca_config_version
evaluation_config_version
raw telemetry artifact + telemetry schema version
feature artifact
detector output
incident artifact
RCA artifact (RcaIncidentResult, link theo run_id)
evaluation artifact
degradation_type / degradation_config_version / degradation_seed / degradation_parameters (khi áp dụng RQ4)
diagnosis_method / diagnosis_start / diagnosis_end / participant_id (khi áp dụng RQ6; đề xuất, field cuối cùng thuộc telemetry-and-ground-truth-schema-v1 và evaluation-protocol-v1)
```

Không dùng một `config_version` chung thay cho các version theo từng stage. Ground truth không nằm trong payload nghiệp vụ hay telemetry và không được đưa vào đường feature/RCA. Với RQ4, degraded telemetry là transformation có thể tái lập từ raw telemetry artifact của baseline run; mọi field degradation được lưu cùng lineage của pair so sánh. Từ một evaluation result phải truy ngược được theo chuỗi:

```text
evaluation → RCA → incident → detector → feature → telemetry/degradation → baseline run → code/config/fault/workload provenance
```

### 2.4. Telemetry modalities

Ký hiệu:

- `M` = metrics (RED, CPU/RSS, `lms_dependency_*`, metric broker RabbitMQ);
- `T` = distributed traces / trace-derived features (gồm trace nối qua `traceparent` trong command RabbitMQ);
- `L` = structured logs / log-derived features.

Missing telemetry phải được biểu diễn rõ; không mặc định điền `0` cho trường hợp trace/log/metric bị mất. Cần phân biệt "không có tín hiệu vì chưa instrument" với "mất tín hiệu": các tín hiệu chưa có trong testbed (pool DB, tuổi message cũ nhất, metric publish/consume ở runtime, độ trễ outbox, log worker, nối trace scheduler → worker) ghi ở complex-case-catalogue mục 1.5 và phải xuất hiện trong coverage report, không bị coi là bình thường.

### 2.5. Điều kiện chung cho so sánh AI và thủ công

Mọi so sánh AI so với thủ công (RQ6) dùng cùng case, cùng `run_id`, cùng telemetry artifact và cùng thông tin triệu chứng khởi đầu; ground truth chỉ dùng chấm sau khi đã có kết luận.

## 3. RQ1 — Giá trị của telemetry đa nguồn

### 3.1. Câu hỏi

**Metrics + traces + structured logs có cải thiện anomaly/incident detection và service-level RCA so với metrics-only không?**

### 3.2. Giả thuyết và phép so sánh

Giả thuyết H1: thêm trace-derived và log-derived evidence vào metrics sẽ cải thiện ít nhất một nhóm metric detection/RCA so với metrics-only, đặc biệt ở case có propagation qua dependency dùng chung hoặc chuỗi async (C1, C3, C4, C6), nhưng có thể làm tăng runtime/resource cost.

Ablation tối thiểu:

```text
M
M + T
M + T + L
```

`M + L` có thể báo cáo bổ sung nếu implementation tự nhiên, nhưng không phải điều kiện bắt buộc.

Để phép so sánh có ý nghĩa, các variant phải giữ cố định cùng run split, candidate set, incident definition và nguyên tắc tune trên validation. Khi một detector không thể dùng cùng feature dimension giữa các modality, configuration riêng được phép nhưng phải tune theo cùng protocol và không tune trên test.

### 3.3. Input cần thiết

- Metrics: request rate, error rate, latency p50/p95/p99, CPU/RSS, `lms_dependency_*` theo `dependency_identity` và độ sâu queue/consumer của RabbitMQ.
- Traces: span count/error/duration, service/dependency edge, trace timing, span PRODUCER/CONSUMER của command và error/timeout semantics.
- Structured logs: access log `http.server.request`, log `dependency.failure` kèm `dependency_identity`, `trace_id`, `span_id`; error-log rate, exception count, timeout count. Worker chỉ có access log `/ready`, lỗi xử lý command chỉ thấy ở span và `dependency.failure` (giới hạn đã biết).
- Ground truth: `run_id`, fault interval, `root_cause_service`, fault/case.

### 3.4. Baseline/phương pháp

Detection candidates tối thiểu theo blueprint:

- static threshold;
- robust z-score hoặc statistical baseline tương đương;
- Isolation Forest hoặc unsupervised detector tương đương.

RCA sử dụng cùng candidate set và cùng logic ranking cho các variant modality; chỉ thay phần evidence khả dụng tương ứng `M`, `M+T`, `M+T+L` để tránh confound không cần thiết.

### 3.5. Metrics

**Detection/incident:** Precision, Recall, F1, False Positive Rate, Detection Delay.

**RCA service-level:** Top-1 Accuracy, Top-3 Accuracy, Mean Reciprocal Rank; Average Rank dùng bổ sung.

**System bổ sung cho trade-off:** feature extraction time, detector inference time, RCA runtime, peak CPU/memory và artifact size nếu khác biệt modality đáng kể.

## 4. RQ2 — Giá trị của dependency graph

### 4.1. Câu hỏi

**Dependency graph từ distributed traces có cải thiện service-level root-cause ranking so với ranking chỉ dựa trên anomaly severity không?**

### 4.2. Giả thuyết và phép so sánh

Giả thuyết H2: graph-aware ranking giúp phân biệt service gây lỗi với các symptom upstream tốt hơn anomaly-severity-only khi incident có fault propagation qua dependency. Topology v2 tạo nhiều trường hợp severity-only dễ nhầm: triệu chứng ở `media` hoặc `gateway` trong khi nguyên nhân ở `notification-worker` (C1), ở mọi cạnh `*-identity-token` trong khi nguyên nhân ở `auth` (C6), hoặc ở `course` khi `ai-worker` báo lỗi (vòng `course → ai → course`, C3).

So sánh chính:

```text
rank by anomaly severity
vs
graph-aware ranking
```

Ablation để cô lập graph:

```text
RCA score without graph contribution
vs
same RCA score with dependency-graph contribution
```

Các thành phần không liên quan đến graph phải giữ cố định trong ablation tương ứng.

### 4.3. Input cần thiết

- Service-level anomaly scores theo time window.
- Trace-derived dynamic dependency graph (gồm async edge nối bằng trace context RabbitMQ) hoặc edge evidence tương đương; graph thiết kế (service-catalogue v2) dùng để validate graph quan sát, không thay thế.
- Edge degradation: latency/error/timeout change theo `dependency_identity` khi có dữ liệu.
- Ground truth `root_cause_service` cho mỗi controlled run.

### 4.4. Baseline/phương pháp

- Baseline chính: rank by anomaly severity.
- Baseline/variant graph-aware đơn giản theo blueprint.
- Proposed graph-aware hoặc graph-temporal-evidence ranker chỉ được đánh giá bằng cùng candidate set và cùng test runs.

### 4.5. Metrics

**Primary:** service-level Top-1 Accuracy, Top-3 Accuracy, Mean Reciprocal Rank.

**Supplementary:** Average Rank và error analysis theo fault/case, đặc biệt các case root cause có symptom mạnh ở upstream service.

Detection metric không phải primary endpoint của RQ2 vì phép can thiệp nằm ở bước RCA ranking.

## 5. RQ3 — Giá trị của temporal information

### 5.1. Câu hỏi

**Temporal precedence và propagation order có giúp phân biệt root cause với symptom lan truyền không?**

### 5.2. Giả thuyết và phép so sánh

Giả thuyết H3: bổ sung onset/temporal precedence vào ranking sẽ cải thiện thứ hạng `root_cause_service` trong incident có propagation rõ, vì root cause thường có evidence bất thường xuất hiện trước symptom liên quan.

Ablation chính:

```text
without temporal precedence
vs
with temporal precedence
```

Graph/evidence/anomaly inputs còn lại phải giữ cố định để cô lập giá trị của temporal information.

Lưu ý riêng topology v2: ở FG/FH, triệu chứng chỉ xuất hiện sau một khoảng yên lặng vì token đã cache còn hạn (mặc định TTL 10 phút; trong test rút xuống 60 giây, lỗi hiện sau 70–74 giây theo C6) và sau khi cache JWKS hết hạn. Khoảng cách giữa `fault_start` và dấu hiệu quan sát đầu tiên không do detector gây ra. Theo evaluation-protocol-v1 mục 7.3, Detection Delay của C6 chứa khoảng yên lặng này và phải báo riêng theo case, không gộp vào delay trung bình mà không ghi chú; thời gian fault active phải lớn hơn độ trễ triệu chứng đo được của chính case đó. Chưa có số đo cho TTL mặc định 600 giây.

### 5.3. Input cần thiết

- Timestamp UTC và correlation identity nhất quán.
- Fault `start/end` từ ground truth.
- Per-service anomaly/evidence timeline.
- `detected_at`, `estimated_start_time` và incident membership khi có.
- Trace span timing/dependency ordering, gồm thời điểm PRODUCER so với CONSUMER cùng trace (thay cho tuổi message cũ nhất, chưa có metric).

### 5.4. Baseline/phương pháp

- RCA variant không có temporal contribution.
- RCA variant có temporal precedence/propagation-order contribution.
- `rank by earliest anomaly` được dùng như một baseline temporal đơn giản theo blueprint, không thay thế proposed ranking.

### 5.5. Metrics

**Primary RCA:** service-level Top-1, Top-3, MRR.

**Supplementary:** Average Rank và error analysis đối với case root cause bị symptom downstream/upstream có severity cao hơn.

Detection Delay vẫn được báo cáo ở campaign chung nhưng không phải metric để kết luận trực tiếp H3 trừ khi temporal method thay đổi cả incident onset logic.

## 6. RQ4 — Robustness khi telemetry suy giảm

### 6.1. Câu hỏi

**Detection/RCA suy giảm thế nào khi trace bị sampling/dropping hoặc một telemetry modality bị thiếu?**

### 6.2. Giả thuyết và phép so sánh

Giả thuyết H4: performance sẽ suy giảm khi telemetry bị thiếu, trong đó graph-dependent RCA nhạy với trace loss hơn metrics-only detection; pipeline vẫn cần fallback có kiểm soát thay vì coi missing telemetry là giá trị `0`.

MVP chỉ cần **một robustness comparison focused**:

```text
full/baseline telemetry
vs
one controlled degraded-telemetry condition
```

Đây là **strict paired comparison** bắt buộc: full và degraded condition của mỗi pair phải được tạo từ cùng một baseline experiment run/raw telemetry artifact và dùng cùng ground truth. Không được dùng hai workload/fault run độc lập làm hai nhánh của cùng comparison.

Điều kiện degraded được chốt ở evaluation-protocol-v1 theo một trong hai hướng canonical:

1. controlled trace dropping/sampling simulation trên telemetry artifact; hoặc
2. missing-modality evaluation.

Không mở rộng thành matrix nhiều sampling level × nhiều modality combination trong MVP nếu chưa có nguồn lực.

Với topology v2, khi trace bị drop thì các async edge (RabbitMQ) và cạnh xác thực phải dùng fallback theo `message_id`/thời gian với confidence giảm (service-catalogue v2 mục 8); không synthesize trace link giả.

### 6.3. Input cần thiết

- Baseline telemetry artifact thu theo campaign chuẩn, ưu tiên 100% trace sampling cho baseline.
- Cùng baseline `run_id`, scenario, `repeat_index`, workload, fault, fault timing và ground truth cho cả full/degraded condition của mỗi pair.
- Missingness flags/coverage metadata.
- Cùng prediction/evaluation config version cho từng pair so sánh, trừ phần cấu hình degradation được ghi rõ.
- `degradation_type`, `degradation_config_version`, `degradation_parameters` và `degradation_seed` nếu transformation có randomness.

### 6.4. Baseline/phương pháp

- Full condition giữ nguyên baseline telemetry artifact.
- Degraded condition được tạo có kiểm soát và reproducible bằng transformation trên chính baseline telemetry artifact; chỉ telemetry condition được thay đổi.
- Cả hai condition giữ nguyên baseline run identity, scenario, repetition, workload, fault, fault timing, ground truth và các configuration không thuộc degradation.
- Fallback metrics/log evidence được ghi nhận khi trace không đủ, thay vì silently impute như dữ liệu quan sát thật.

### 6.5. Metrics

**Detection degradation:** thay đổi Precision, Recall, F1, FPR và Detection Delay so với baseline.

**RCA degradation:** thay đổi Top-1, Top-3, MRR và Average Rank so với baseline.

**System bổ sung:** runtime/artifact size nếu degradation mode làm thay đổi chi phí xử lý đáng kể.

Kết quả cần báo cáo cả absolute metric của từng condition và mức suy giảm so với baseline; không tạo một robustness score tổng hợp duy nhất.

## 7. RQ5 — Trade-off kỹ thuật

### 7.1. Câu hỏi

**Trade-off giữa detection/RCA quality, runtime, complexity, interpretability và instrumentation overhead là gì?**

### 7.2. Mục tiêu và phép so sánh

RQ5 không giả định variant phức tạp hơn luôn tốt hơn. Mục tiêu là đặt các variant đã dùng ở RQ1–RQ4 (và RQ6) lên cùng bảng trade-off để xác định lợi ích chất lượng có tương xứng với chi phí kỹ thuật hay không.

So sánh tối thiểu nên bao gồm các variant đại diện:

- metrics-only / baseline đơn giản;
- multi-source telemetry variant;
- RCA severity-only;
- graph-aware và/hoặc temporal-aware RCA variant;
- baseline thủ công tự động (chi phí rất thấp, để làm mốc);
- robustness fallback khi được chạy.

Không tạo một "accuracy tổng hợp" hoặc utility score duy nhất che mất trade-off.

### 7.3. Input cần thiết

- Prediction/evaluation result của RQ1–RQ4 và RQ6.
- Timing và resource measurements của analysis pipeline.
- Application throughput/p95 latency khi bật/tắt instrumentation theo protocol (instrumentation đã có trong `lms/packages/observability`).
- Artifact/config metadata để biết variant nào dùng modality/component nào.
- Explainability evidence của Top-K result khi data cho phép.

### 7.4. Metrics và tiêu chí báo cáo

**Quality:**

- Detection: Precision, Recall, F1, FPR, Detection Delay.
- RCA: service-level Top-1, Top-3, MRR, Average Rank bổ sung.

**Runtime/resource:**

- telemetry query/export time (lưu ý Tempo của testbed từng bị OOM-kill khi truy vấn hàng nghìn trace song song; truy vấn có hạn chế, catalogue mục 4.2);
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size.

**Instrumentation overhead:**

- thay đổi application throughput;
- thay đổi application p95 latency.

**Interpretability/explainability:** kiểm tra mỗi Top-K result có component scores, evidence reference (`service.name`, `trace_id`/`span_id` hoặc metric + nhãn + khoảng thời gian), timeline position, `propagation_path` và config/version metadata. Báo cáo đạt/thiếu theo từng variant; không ép thành một accuracy score.

**Complexity:** báo cáo định tính theo số modality/component/pipeline stage cần vận hành, dependency cần thiết và failure mode bổ sung. Complexity dùng để diễn giải trade-off, không biến thành metric số tùy ý nếu chưa có protocol hợp lệ.

## 8. RQ6 — AI so với truy vết thủ công trên case phức tạp (mới)

Nguồn: ADR-002 (AI là bên truy vết chính; đối chứng thủ công; case phức tạp; đo thời gian chẩn đoán).

### 8.1. Câu hỏi

**Trên các case phức tạp có nguyên nhân gốc nằm ngoài đường request của triệu chứng, RCA engine có xếp đúng nguyên nhân gốc mà truy vết thủ công không tìm ra hoặc tìm chậm hơn không, và thời gian chẩn đoán của AI so với thủ công khác nhau thế nào?**

### 8.2. Giả thuyết và phép so sánh

Giả thuyết H6: ở case phức tạp, RCA engine đạt thứ hạng `root_cause_service` tốt hơn baseline thủ công tự động và cần thời gian chẩn đoán ngắn hơn người dùng công cụ quan sát thông thường. H6 là giả thuyết cần kiểm định; nếu số liệu không ủng hộ thì báo cáo trung thực kèm failure case, không điều chỉnh case hoặc cách đo để thắng.

Hai đối chứng thủ công (ADR-002):

1. **Baseline thủ công tự động**: ngưỡng + tìm trace lỗi/chậm nhất theo đường request của triệu chứng; đo lặp lại được trên cùng telemetry artifact.
2. **Thử nghiệm người thật nhỏ**: một vài người dùng Grafana/Tempo/Loki để chẩn đoán case và đo thời gian chẩn đoán.

Phép so sánh (đề xuất, chốt ở evaluation-protocol-v1):

```text
RCA engine
vs
baseline thủ công tự động (cùng case, cùng run, cùng telemetry artifact)
vs
người dùng Grafana/Tempo/Loki (cùng case, cùng thông tin triệu chứng khởi đầu)
```

Báo cáo **theo từng case C1–C7**, không gộp thành một con số, vì mục tiêu là chỉ ra case nào AI tìm được mà thủ công không tìm được. Case chưa chạy thật (mục 2.3) không đưa vào RQ6.

### 8.3. Input cần thiết

- Cùng telemetry artifact và cùng `run_id` cho cả ba nhánh; cùng thông tin triệu chứng khởi đầu (service, tín hiệu, thời điểm đầu tiên thấy).
- Ground truth `root_cause_service`, chỉ dùng chấm sau khi có kết luận; người tham gia không được tiếp cận ground truth hay mô tả kịch bản gây lỗi.
- Công cụ quan sát cho người: Grafana, Tempo, Loki như trong testbed; không cấp công cụ tự động phân tích.
- Kết quả `RcaIncidentResult` của RCA engine theo `run_id`.

### 8.4. Baseline/phương pháp

- RCA engine: proposed ranker đã freeze trên validation.
- Baseline thủ công tự động: logic cố định, version hóa, không tune trên test.
- Người: cấu trúc protocol ở [evaluation-protocol-v1 mục 15.3](../architecture/evaluation-protocol-v1.md) (người tham gia không biết danh mục case hay ground truth; brief chỉ nêu triệu chứng; mỗi người xem mỗi case tối đa một lần, đảo thứ tự case; được trả lời "không xác định"). Số người, time cap và cách nạp lại telemetry khi quá retention 24 giờ **chưa chốt/chưa kiểm chứng**; đề xuất chờ Đức xác nhận. Quy mô nhỏ nên chỉ báo cáo mô tả, không suy diễn thống kê vượt quá cỡ mẫu.

### 8.5. Metrics

- **Thời gian chẩn đoán** (định nghĩa ở mục 10.4): AI, baseline thủ công tự động và người; báo cáo theo case.
- **Độ đúng của chẩn đoán**: với AI và baseline tự động dùng Top-1/Top-3/rank của `root_cause_service`; với người, kết luận có trùng `root_cause_service` hay không.
- **Số case (và số run) mà AI đúng còn baseline thủ công hoặc người sai** (đếm trực tiếp, không quy về điểm tổng hợp).
- Với kết luận `insufficient_evidence` của RCA engine: báo cáo riêng, không tính là đúng.

Không tạo composite score kết hợp độ đúng và thời gian.

## 9. Bảng ánh xạ RQ → input → phương pháp → metric

| RQ | Phép so sánh/ablation | Telemetry/ground truth chính | Baseline/phương pháp | Metric chính |
| --- | --- | --- | --- | --- |
| RQ1 — Multi-source telemetry | `M` vs `M+T` vs `M+T+L` | Metrics, traces, logs; run/fault interval; `root_cause_service` | Static threshold, robust z-score, Isolation Forest/equivalent; cùng RCA logic theo modality | Detection Precision/Recall/F1/FPR/Delay; RCA Top-1/Top-3/MRR |
| RQ2 — Dependency graph | severity-only vs graph-aware; without graph vs with graph | Anomaly score, trace dependency graph, edge degradation, `root_cause_service` | Rank by anomaly severity; graph-aware baseline/ranker | RCA Top-1/Top-3/MRR; Average Rank bổ sung |
| RQ3 — Temporal information | without temporal vs with temporal | UTC timeline, fault start/end, per-service anomaly/evidence onset, trace timing | No-temporal variant; earliest-anomaly baseline; temporal-aware ranker | RCA Top-1/Top-3/MRR; Average Rank bổ sung |
| RQ4 — Robustness | full telemetry vs một degraded condition, strict paired trên cùng baseline run/artifact | Baseline artifact, coverage/missingness, cùng ground truth; degradation config/parameters/seed | Controlled trace dropping/sampling **hoặc** missing-modality evaluation từ baseline artifact | Delta + absolute Detection metrics; delta + absolute RCA metrics |
| RQ5 — Engineering trade-off | representative simple vs richer variants | Kết quả RQ1–RQ4, RQ6 + timing/resource + app overhead + evidence | Bảng trade-off, không composite score | Quality metrics + runtime/CPU/memory/artifact size + throughput/p95 overhead + explainability checks |
| RQ6 — AI so với thủ công | RCA engine vs baseline thủ công tự động vs người, theo từng case C1–C7 | Cùng telemetry artifact và thông tin triệu chứng khởi đầu; `root_cause_service` chỉ dùng chấm | Baseline ngưỡng + trace lỗi/chậm nhất; thử nghiệm người dùng Grafana/Tempo/Loki | Thời gian chẩn đoán; Top-1/Top-3/rank; số case AI đúng mà thủ công sai |

## 10. Metric definitions v2

### 10.1. Detection/incident

```text
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * Precision * Recall / (Precision + Recall)
Detection Delay = detected_at - fault_start
```

False Positive Rate được đo trên healthy runs/healthy intervals. Evaluation protocol phải chốt cách xử lý detection trước `fault_start`, sau `fault_end`, nhiều incident trong một run và tolerance do windowing; riêng C6 (FG) báo Detection Delay riêng theo case vì có khoảng yên lặng (mục 5.2).

### 10.2. RCA service-level

- **Top-1 Accuracy:** `root_cause_service` ở rank 1.
- **Top-3 Accuracy:** `root_cause_service` nằm trong ba candidate đầu.
- **MRR:** `mean(1 / rank(root_cause_service))`.
- **Average Rank:** metric bổ sung để diễn giải ranking failure.

Không dùng `root_cause_component` để tính primary Top-K/MRR của MVP. Run không có kết luận (`insufficient_evidence` hoặc không có matched incident) ở lại denominator như miss, theo quy ước của evaluation protocol.

### 10.3. System

Các metric system canonical:

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size;
- instrumentation overhead trên application throughput/p95 latency.

### 10.4. Thời gian chẩn đoán (mới; đề xuất chờ Đức xác nhận)

Theo [evaluation-protocol-v1 mục 15.4](../architecture/evaluation-protocol-v1.md); thời gian chẩn đoán là metric riêng, không gộp vào Top-K/MRR hay score tổng hợp:

```text
Người:      T_human  = từ lúc brief (triệu chứng) được trình tới lúc nộp đáp án; hết time cap là timed_out (bị chặn, không ghi đè bằng time cap)
Engine:     T_engine = RCA runtime per incident (đo thật)
Baseline:   T_base   = thời gian chạy của luật baseline trên incident
```

- Mốc bắt đầu chung là lúc incident được khai báo (`detected_at` của incident matched): người nhận brief ở mốc đó, engine và baseline bắt đầu phân tích ở mốc đó. `detection_delay_seconds` và độ trễ thu thập của stack (log ≈ 2 giây, trace ≈ 2,5 giây, counter ≈ 4–10 giây) được báo riêng, không cộng ngầm vào `T_engine`.
- Run được phân tích offline từ artifact nên `created_at` của `RcaIncidentResult` không dùng làm thời gian chẩn đoán.
- `T_human` và `T_engine` khác bản chất (người đọc dashboard so với pipeline chạy), nên chỉ mô tả cạnh nhau, không kết luận định lượng "nhanh hơn bao nhiêu lần" khi chưa có cách chuẩn hóa; cách chuẩn hóa là câu hỏi mở chờ Đức.
- Báo cáo theo từng case: count, trung vị, min, max và số `timed_out` của người; không dùng trung bình duy nhất.

## 11. Metric thứ yếu — báo cáo của agent (chỉ khi làm MCP/agent)

Theo ADR-002, chất lượng báo cáo của agent chỉ đánh giá khi phần MCP/agent được làm; **không phải tiêu chí hoàn thành đề tài và không là metric của RQ1–RQ6**. Khi làm, đánh giá tối thiểu: độ đúng (kết luận trong báo cáo khớp với `RcaIncidentResult` và, offline, với ground truth), dẫn chứng (mỗi khẳng định có evidence tham chiếu được) và độ phủ. Định nghĩa đo cụ thể và quy trình chấm chưa có; chốt khi bắt đầu phần này. Agent không thay mô hình ML xếp hạng, nên Top-K/MRR của agent không được báo thay cho RCA engine.

## 12. Các biến phải được kiểm soát khi so sánh

Để tránh kết luận sai do confound, các comparison/ablation phải giữ cố định tối đa các yếu tố không phải biến đang kiểm tra:

- cùng experiment-run split;
- cùng controlled-fault case/repetition set;
- cùng service-level candidate set;
- cùng ground-truth definition;
- cùng unit incident/fault-run level;
- cùng feature/window policy sau khi đã freeze;
- cùng nguyên tắc tune trên validation;
- cùng test campaign không dùng để chọn threshold/weight/model;
- cùng version metadata đủ để tái lập;
- cùng workload nền chạy song song cho các nhánh của cùng so sánh.

Riêng RQ4 phải giữ cùng baseline run/artifact và ground truth giữa full/degraded condition; chỉ transformation telemetry có kiểm soát được phép khác. Riêng RQ6 phải giữ cùng telemetry artifact và thông tin triệu chứng khởi đầu giữa AI, baseline và người.

Nếu một comparison bắt buộc phải thay configuration vì feature/input khác nhau, thay đổi phải được ghi rõ và tune chỉ trên training/validation.

## 13. Feasibility review cần Đức xác nhận

Trước khi task được chuyển `Hoàn thành`, Đức xác nhận tối thiểu các điểm sau (theo bằng chứng telemetry đã đo ở complex-case-catalogue mục 1 và 4):

| RQ | Điểm cần xác nhận tính khả thi từ backend/testbed |
| --- | --- |
| RQ1 | Metrics/traces/logs có correlation (đã đo: `trace_id`/`span_id` khớp ở 11/11 runtime; 9/9 luồng trace đủ service); fault tạo được symptom quan sát được ở nhiều modality. Cần chạy thật các fault chưa chạy (C1–C5, C7). |
| RQ2 | Distributed traces dựng được dependency edge ổn định ở các flow HTTP/RabbitMQ (command nối qua `traceparent` trong envelope, đã sửa ở R-12); case severity-only dễ nhầm root cause tồn tại (C1, C3, C6) nhưng chưa chạy thật hết. |
| RQ3 | Timestamp/trace timing và fault `start/end` đủ nhất quán; khoảng yên lặng của C6 được báo riêng trong Detection Delay (evaluation-protocol-v1 mục 7.3). |
| RQ4 | Tạo được degraded telemetry reproducible từ artifact của cùng baseline run; coverage/missingness lưu rõ; async edge có fallback không synthesize trace link giả. |
| RQ5 | Runner/testbed đo được timing/resource và application throughput/p95 overhead đủ lặp lại; truy vấn Tempo hàng loạt phải được hạn chế. |
| RQ6 | Có ít nhất một số case chạy thật; có người sẵn sàng tham gia thử nghiệm; định nghĩa `diagnosis_time` và cách tránh hiệu ứng học đã chốt; baseline thủ công tự động cài được. |

Nếu một điểm không khả thi, cần chỉnh **phép đo hoặc scope evaluation**, không tự thay đổi RQ canonical trong file này. Thay đổi RQ canonical phải cập nhật tài liệu định hướng tương ứng.

| Trường | Giá trị |
| --- | --- |
| Người xác nhận | Đức |
| Trạng thái | `PENDING` |

## 14. Quyết định scope v2

- Giữ **RQ1–RQ5** và thêm **RQ6** (AI so với thủ công trên case phức tạp) làm RQ chính của MVP. RQ "fault category" của khung v0 đổi thành RQ7 tùy chọn, không vào MVP; fault/case vẫn dùng để stratify/error-analysis cho RQ1–RQ6.
- RCA engine là bên truy vết chính; MCP/agent thứ yếu, làm sau, không phải tiêu chí hoàn thành.
- Không chọn model cuối cùng trong tài liệu này.
- Không định nghĩa telemetry schema field-level hoặc campaign protocol chi tiết trong tài liệu này; hai phần đó thuộc telemetry-and-ground-truth-schema-v1 và evaluation-protocol-v1.
- Không dùng component-level RCA làm primary metric.
- Không tune trên final test campaign.
- Không tạo một metric tổng hợp duy nhất thay cho các metric detection, RCA, system, robustness và thời gian chẩn đoán riêng biệt.
- Các con số mới (`R`, `K` tối thiểu, số người thử nghiệm, time cap của người) chỉ là đề xuất chờ Đức xác nhận; chưa có ngưỡng thành công định lượng nào được đặt cho H1–H6.

---

# Khác biệt so với bản trước

| Mục | v1 | v2 |
| --- | --- | --- |
| Vai trò AI | Pipeline hỗ trợ; kết quả cho người đọc | RCA engine là bên truy vết chính (ADR-002); có RQ6 so với thủ công |
| Số RQ chính | RQ1–RQ5; RQ6 (fault category) không vào v1 | RQ1–RQ6 (RQ6 mới: AI so với thủ công); fault category thành RQ7 tùy chọn |
| Fault/case | Năm category F1–F5 (Redis, Storage, service error, consumer backlog, CPU) | Tám fault FA–FH và bảy case C1–C7; FF không có case riêng |
| Candidate set | Service của topology v1 | 11 `service.name` (gồm 4 worker), `gateway` là symptom; owner so với process (`ai` và `ai-worker`, `media` và `media-worker`) xử lý bằng owner-level Top-K phụ |
| Evaluation floor | 5 × 3 = 15 run | Đề xuất chờ Đức xác nhận: `K × R` với `R = 3` (21 run nếu đủ bảy case); chốt ở evaluation-protocol-v1 |
| Metric mới | Không có | Thời gian chẩn đoán (AI, baseline thủ công tự động, người) theo từng case; số case AI đúng mà thủ công sai |
| Đối chứng | Baseline RCA nội bộ | Thêm baseline thủ công tự động và thử nghiệm người thật nhỏ |
| Detection Delay | Tính từ `fault_start` | Giữ định nghĩa; C6 (FG) báo riêng vì có khoảng yên lặng (token còn hạn; mặc định tới 10 phút) |
| Telemetry input | Giả định đủ | Ghi rõ tín hiệu có thật (RED, `lms_dependency_*`, metric broker, trace nối qua `traceparent`) và tín hiệu chưa có phải vào coverage |
| RQ4 | Fallback F4 theo event | Async edge và cạnh xác thực dùng fallback `message_id`/thời gian, không synthesize trace link |
| MCP/agent | Chưa có | Metric thứ yếu (độ đúng, dẫn chứng, độ phủ), chỉ khi làm; không là tiêu chí hoàn thành |
| Xác nhận | Feasibility review "cần Đức xác nhận" (collaborator review) | Đức tự xác nhận (không cần Bách review); bảng feasibility cập nhật theo bằng chứng R-12 |
