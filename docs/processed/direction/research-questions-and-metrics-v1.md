# Research questions và metrics v1

> **Vai trò:** Operationalize RQ1–RQ5 và metric đánh giá cho MVP. Tài liệu này không thay thế source of truth về định hướng, backend hay Analysis/RCA.
>
> **Định hướng canonical:** [`khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](khung_dinh_huong_tong_the_lms_microservice_ai_rca.md)
>
> **Backend/testbed canonical:** [`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md)
>
> **Analysis/AI/RCA canonical:** [`../architecture/analysis-anomaly-rca-blueprint.md`](../architecture/analysis-anomaly-rca-blueprint.md)
>
> **Evaluation protocol chi tiết:** được chốt ở task tuần 4; tài liệu này chỉ xác định RQ, phép so sánh và metric v1.

## 1. Mục tiêu của tài liệu

Tài liệu này chuyển RQ1–RQ5 đã có trong định hướng tổng thể thành các phép so sánh có thể đánh giá trên testbed. Mỗi RQ được gắn với:

1. giả thuyết hoặc mục tiêu so sánh;
2. telemetry và ground truth tối thiểu cần có;
3. baseline/phương pháp hoặc ablation cần chạy;
4. metric chính và metric bổ sung;
5. điều kiện giữ cố định để tránh so sánh sai lệch.

Không chọn model cuối cùng tại đây. Các lựa chọn threshold, weight, hyperparameter, window size và cấu hình campaign phải được chọn trên training/validation rồi freeze trước final test campaign.

## 2. Quy ước đánh giá chung

### 2.1. Granularity và unit of evaluation

- Primary RCA evaluation: **service-level**.
- `root_cause_component` chỉ là evidence bổ sung trong MVP, không được trộn vào candidate list chính để tính Top-K/MRR.
- Unit đánh giá chính: **incident/fault-run level**; point/window-level chỉ dùng để chẩn đoán detector.
- Candidate set service-level phải được freeze trong evaluation protocol trước final campaign.

### 2.2. Split và chống leakage

Split theo **experiment run**, không random các time window:

```text
healthy training runs -> fit scaler/detector
validation runs        -> threshold, weight, hyperparameter, window/config selection
test runs              -> final metrics only
```

Không để window của cùng một `run_id` xuất hiện ở nhiều split. Không thay threshold, RCA weight, feature/window configuration hoặc lựa chọn model sau khi xem kết quả final test campaign.

### 2.3. Testbed, ground truth và provenance tối thiểu

MVP sử dụng năm fault category canonical:

1. Course / Redis latency — cache;
2. Submission -> storage latency — downstream dependency;
3. Submission service error — service error;
4. Notification consumer slowdown / RabbitMQ backlog — async queue;
5. Submission CPU pressure — resource.

Evaluation floor là `5 scenarios × 3 repetitions = 15 controlled fault runs`, cộng healthy runs gồm normal traffic và healthy high-load spike để đo false positive/workload shift.

Mỗi experiment run cần có provenance tối thiểu sau để tái lập và truy ngược kết quả:

```text
run_id
scenario_id
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
RCA artifact
evaluation artifact
degradation_type / degradation_config_version / degradation_seed / degradation_parameters (khi áp dụng RQ4)
```

Không dùng một `config_version` chung thay cho các version theo từng stage. Với RQ4, degraded telemetry là transformation có thể tái lập từ raw telemetry artifact của baseline run; mọi field degradation được lưu cùng lineage của pair so sánh. Từ một evaluation result phải truy ngược được theo chuỗi:

```text
evaluation → RCA → incident → detector → feature → telemetry/degradation → baseline run → code/config/fault/workload provenance
```

### 2.4. Telemetry modalities

Ký hiệu:

- `M` = metrics;
- `T` = distributed traces / trace-derived features;
- `L` = structured logs / log-derived features.

Missing telemetry phải được biểu diễn rõ; không mặc định điền `0` cho trường hợp trace/log/metric bị mất.

## 3. RQ1 — Giá trị của telemetry đa nguồn

### 3.1. Câu hỏi

**Metrics + traces + structured logs có cải thiện anomaly/incident detection và service-level RCA so với metrics-only không?**

### 3.2. Giả thuyết và phép so sánh

Giả thuyết H1: thêm trace-derived và log-derived evidence vào metrics sẽ cải thiện ít nhất một nhóm metric detection/RCA so với metrics-only, đặc biệt ở fault có propagation qua dependency, nhưng có thể làm tăng runtime/resource cost.

Ablation tối thiểu:

```text
M
M + T
M + T + L
```

`M + L` có thể báo cáo bổ sung nếu implementation tự nhiên, nhưng không phải điều kiện bắt buộc của RQ1 v1.

Để phép so sánh có ý nghĩa, các variant phải giữ cố định cùng run split, candidate set, incident definition và nguyên tắc tune trên validation. Khi một detector không thể dùng cùng feature dimension giữa các modality, configuration riêng được phép nhưng phải tune theo cùng protocol và không tune trên test.

### 3.3. Input cần thiết

- Metrics: request rate, error rate, latency p50/p95/p99, CPU/memory/runtime signal và dependency metrics cần thiết.
- Traces: span count/error/duration, service/dependency edge, trace timing và error/timeout semantics.
- Structured logs: error-log rate, exception count, timeout count và identity/correlation cần thiết.
- Ground truth: `run_id`, fault interval, `root_cause_service`, scenario/fault category.

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

Giả thuyết H2: graph-aware ranking giúp phân biệt service gây lỗi với các symptom upstream tốt hơn anomaly-severity-only khi incident có fault propagation qua dependency.

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
- Trace-derived dynamic dependency graph hoặc edge evidence tương đương.
- Edge degradation: latency/error/timeout change khi có dữ liệu.
- Ground truth `root_cause_service` cho mỗi controlled run.

### 4.4. Baseline/phương pháp

- Baseline chính: rank by anomaly severity.
- Baseline/variant graph-aware đơn giản theo blueprint.
- Proposed graph-aware hoặc graph-temporal-evidence ranker chỉ được đánh giá bằng cùng candidate set và cùng test runs.

### 4.5. Metrics

**Primary:** service-level Top-1 Accuracy, Top-3 Accuracy, Mean Reciprocal Rank.

**Supplementary:** Average Rank và error analysis theo fault category, đặc biệt các case root cause có symptom mạnh ở upstream service.

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

### 5.3. Input cần thiết

- Timestamp UTC và correlation identity nhất quán.
- Fault `start/end` từ ground truth.
- Per-service anomaly/evidence timeline.
- `detected_at`, `estimated_start_time` và incident membership khi có.
- Trace span timing/dependency ordering khi có dữ liệu.

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

Đây là **strict paired comparison** bắt buộc: full và degraded condition của mỗi pair phải được tạo từ cùng một baseline experiment run/raw telemetry artifact và dùng cùng ground truth. Không được dùng hai workload/fault run độc lập làm hai nhánh của cùng comparison, vì sẽ làm lẫn tác động của telemetry degradation với workload variation, fault variation hoặc runtime noise.

Điều kiện degraded được chốt ở evaluation protocol tuần 4 theo một trong hai hướng canonical:

1. controlled trace dropping/sampling simulation trên telemetry artifact; hoặc
2. missing-modality evaluation.

Không mở rộng thành matrix nhiều sampling level × nhiều modality combination trong MVP v1 nếu chưa có nguồn lực.

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

RQ5 không giả định variant phức tạp hơn luôn tốt hơn. Mục tiêu là đặt các variant đã dùng ở RQ1–RQ4 lên cùng bảng trade-off để xác định lợi ích chất lượng có tương xứng với chi phí kỹ thuật hay không.

So sánh tối thiểu nên bao gồm các variant đại diện:

- metrics-only / baseline đơn giản;
- multi-source telemetry variant;
- RCA severity-only;
- graph-aware và/hoặc temporal-aware RCA variant;
- robustness fallback khi được chạy.

Không tạo một “accuracy tổng hợp” hoặc utility score duy nhất che mất trade-off.

### 7.3. Input cần thiết

- Prediction/evaluation result của RQ1–RQ4.
- Timing và resource measurements của analysis pipeline.
- Application throughput/p95 latency khi bật/tắt instrumentation theo protocol.
- Artifact/config metadata để biết variant nào dùng modality/component nào.
- Explainability evidence của Top-K result khi data cho phép.

### 7.4. Metrics và tiêu chí báo cáo

**Quality:**

- Detection: Precision, Recall, F1, FPR, Detection Delay.
- RCA: service-level Top-1, Top-3, MRR, Average Rank bổ sung.

**Runtime/resource:**

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size.

**Instrumentation overhead:**

- thay đổi application throughput;
- thay đổi application p95 latency.

**Interpretability/explainability:** kiểm tra mỗi Top-K result có component scores, evidence reference khi data cho phép, timeline position và config/version metadata. Báo cáo đạt/thiếu theo từng variant; không ép thành một accuracy score.

**Complexity:** báo cáo định tính theo số modality/component/pipeline stage cần vận hành, dependency cần thiết và failure mode bổ sung. Complexity được dùng để diễn giải trade-off, không được biến thành metric số tùy ý nếu chưa có protocol hợp lệ.

## 8. Bảng ánh xạ RQ → input → phương pháp → metric

| RQ | Phép so sánh/ablation v1 | Telemetry/ground truth chính | Baseline/phương pháp | Metric chính |
| --- | --- | --- | --- | --- |
| RQ1 — Multi-source telemetry | `M` vs `M+T` vs `M+T+L` | Metrics, traces, logs; run/fault interval; `root_cause_service` | Static threshold, robust z-score, Isolation Forest/equivalent; cùng RCA logic theo modality | Detection Precision/Recall/F1/FPR/Delay; RCA Top-1/Top-3/MRR |
| RQ2 — Dependency graph | severity-only vs graph-aware; without graph vs with graph | Anomaly score, trace dependency graph, edge degradation, `root_cause_service` | Rank by anomaly severity; graph-aware baseline/ranker | RCA Top-1/Top-3/MRR; Average Rank bổ sung |
| RQ3 — Temporal information | without temporal vs with temporal | UTC timeline, fault start/end, per-service anomaly/evidence onset, trace timing | No-temporal variant; earliest-anomaly baseline; temporal-aware ranker | RCA Top-1/Top-3/MRR; Average Rank bổ sung |
| RQ4 — Robustness | full telemetry vs một degraded condition, strict paired trên cùng baseline run/artifact | Baseline artifact, coverage/missingness, cùng ground truth; degradation config/parameters/seed | Controlled trace dropping/sampling **hoặc** missing-modality evaluation từ baseline artifact | Delta + absolute Detection metrics; delta + absolute RCA metrics |
| RQ5 — Engineering trade-off | representative simple vs richer variants | Kết quả RQ1–RQ4 + timing/resource + app overhead + evidence | Bảng trade-off, không composite score | Quality metrics + runtime/CPU/memory/artifact size + throughput/p95 overhead + explainability checks |

## 9. Metric definitions v1

### 9.1. Detection/incident

```text
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * Precision * Recall / (Precision + Recall)
Detection Delay = detected_at - fault_start
```

False Positive Rate được đo trên healthy runs/healthy intervals. Evaluation protocol tuần 4 phải chốt cách xử lý detection trước `fault_start`, sau `fault_end`, nhiều incident trong một run và tolerance do windowing.

### 9.2. RCA service-level

- **Top-1 Accuracy:** `root_cause_service` ở rank 1.
- **Top-3 Accuracy:** `root_cause_service` nằm trong ba candidate đầu.
- **MRR:** `mean(1 / rank(root_cause_service))`.
- **Average Rank:** metric bổ sung để diễn giải ranking failure.

Không dùng `root_cause_component` để tính primary Top-K/MRR của MVP.

### 9.3. System

Các metric system canonical:

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size;
- instrumentation overhead trên application throughput/p95 latency.

## 10. Các biến phải được kiểm soát khi so sánh

Để tránh kết luận sai do confound, các comparison/ablation phải giữ cố định tối đa các yếu tố không phải biến đang kiểm tra:

- cùng experiment-run split;
- cùng controlled-fault scenario/repetition set;
- cùng service-level candidate set;
- cùng ground-truth definition;
- cùng unit incident/fault-run level;
- cùng feature/window policy sau khi đã freeze;
- cùng nguyên tắc tune trên validation;
- cùng test campaign không dùng để chọn threshold/weight/model;
- cùng version metadata đủ để tái lập.

Riêng RQ4 phải giữ cùng baseline run/artifact và ground truth giữa full/degraded condition; chỉ transformation telemetry có kiểm soát được phép khác.

Nếu một comparison bắt buộc phải thay configuration vì feature/input khác nhau, thay đổi phải được ghi rõ và tune chỉ trên training/validation.

## 11. Feasibility review cần Đức xác nhận

Trước khi task được chuyển `Hoàn thành`, collaborator cần review tối thiểu các điểm sau:

| RQ | Điểm cần xác nhận tính khả thi từ backend/testbed |
| --- | --- |
| RQ1 | Metrics/traces/logs có correlation và đủ signal để tạo `M`, `M+T`, `M+T+L`; workload/fault tạo được symptom quan sát được ở nhiều modality. |
| RQ2 | Distributed traces cho phép dựng dependency edge ổn định ở các flow HTTP/RabbitMQ cần đánh giá; fault propagation tạo được case severity-only dễ nhầm root cause với symptom. |
| RQ3 | Timestamp/trace timing và fault `start/end` đủ nhất quán để ước lượng onset/precedence; propagation không bị che bởi clock/config inconsistency. |
| RQ4 | Có thể tạo degraded telemetry condition reproducible từ telemetry artifact của cùng baseline run, lưu type/config/parameters/seed và giữ nguyên ground truth; coverage/missingness được lưu rõ. |
| RQ5 | Runner/testbed có thể đo timing/resource và application throughput/p95 overhead đủ lặp lại để so sánh variant. |

Nếu một điểm không khả thi, cần chỉnh **phép đo hoặc scope evaluation**, không tự thay đổi RQ canonical trong file này. Thay đổi RQ canonical phải cập nhật tài liệu định hướng tương ứng.

## 12. Quyết định scope v1

- Giữ **RQ1–RQ5** làm RQ chính của MVP.
- **Không đưa RQ6 vào v1**; fault category vẫn được dùng để stratify/error-analysis cho RQ1–RQ5.
- Không chọn model cuối cùng trong task này.
- Không định nghĩa telemetry schema field-level hoặc campaign protocol chi tiết trong task này; hai phần đó thuộc task tuần 4.
- Không dùng component-level RCA làm primary metric.
- Không tune trên final test campaign.
- Không tạo một metric tổng hợp duy nhất thay cho các metric detection, RCA, system và robustness riêng biệt.
