# Project scope v1 — MVP, Target, Stretch và Out-of-scope

> **Trạng thái:** Review-ready artifact cho `task-01_define-mvp-scope`.
>
> **Vai trò:** Chốt phạm vi triển khai để ngăn scope creep và giữ toàn bộ hệ thống phục vụ trực tiếp bài toán anomaly detection + root-cause candidate ranking.
>
> **Không thay thế các source of truth canonical:**
>
> - WHY/WHAT và research scope: [`khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](khung_dinh_huong_tong_the_lms_microservice_ai_rca.md)
> - Backend SUT scope/topology/implementation: [`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md)
> - Analysis/AI/RCA implementation: [`../architecture/analysis-anomaly-rca-blueprint.md`](../architecture/analysis-anomaly-rca-blueprint.md)
> - WHEN/WHO: [`../plan/plan-v0.2-24-weeks.md`](../plan/plan-v0.2-24-weeks.md)
> - RQ/metrics operationalization: [`research-questions-and-metrics-v1.md`](research-questions-and-metrics-v1.md)

## 1. Mục tiêu của scope v1

Đồ án xây dựng một **LMS microservice testbed có kiểm soát** để tạo workload, fault propagation và observability telemetry; sau đó dùng pipeline Analysis/AI/RCA để phát hiện incident, xếp hạng **root-cause candidates ở service-level** và đánh giá định lượng bằng ground truth từ controlled fault injection.

LMS là **System Under Test (SUT)**, không phải sản phẩm chính. Một hạng mục chỉ thuộc MVP khi nó đóng góp trực tiếp cho ít nhất một trong các mục tiêu sau:

1. tạo dependency có ý nghĩa;
2. tạo fault/fault propagation có thể kiểm soát;
3. tạo hoặc cải thiện telemetry cần cho anomaly/RCA;
4. tạo ground truth và provenance có thể tái lập;
5. phục vụ trực tiếp research question hoặc evaluation;
6. bảo đảm pipeline có thể chạy lại và kiểm chứng được.

Số lượng CRUD, độ đầy đủ nghiệp vụ LMS, mức độ production-grade hoặc độ phức tạp hạ tầng **không phải tiêu chí mở rộng MVP**.

---

## 2. Quy tắc phân tầng scope

| Tầng | Ý nghĩa | Quy tắc |
| --- | --- | --- |
| **MVP** | Bắt buộc để đạt mục tiêu nghiên cứu và các milestone M1–M6 | Nằm trên critical path tuần 3–22 |
| **Target** | Có giá trị nếu MVP đã ổn định và còn đủ nguồn lực | Không được làm chậm critical path |
| **Stretch** | Nâng cao, chỉ xem xét khi toàn bộ MVP/evaluation đã an toàn | Không lên lịch như điều kiện hoàn thành |
| **Out-of-scope** | Không phục vụ đủ trực tiếp cho mục tiêu hoặc có chi phí/rủi ro vượt phạm vi | Không triển khai trong MVP |

Thay đổi service boundary, telemetry schema, experiment manifest hoặc RCA granularity phải đi qua tài liệu canonical/ADR tương ứng; không tạo convention cạnh tranh trong scope này.

---

# 3. Phạm vi MVP bắt buộc

## 3.1. Testbed topology và workflow

MVP giữ nguyên topology canonical **6 business service + 1 API Gateway**:

```text
API Gateway
Auth
Course
Enrollment
Submission
Grading
Notification
```

Dependency canonical:

```text
Gateway
├── Auth
├── Course ──> Redis
│          └─> PostgreSQL: course_db
├── Enrollment ──> Course
│              └─> PostgreSQL: enrollment_db
├── Submission ──> Course
│              ├─> Enrollment
│              ├─> Storage mock
│              └─> PostgreSQL: submission_db
└── Grading ──> Submission
            ├─> PostgreSQL: grading_db
            └─> RabbitMQ ──> Notification

Auth ──> PostgreSQL: auth_db
```

Notification có thể không có database trong MVP.

### Workflow bắt buộc

| ID | Workflow | Giá trị nghiên cứu |
| --- | --- | --- |
| W1 | `Client -> Gateway -> Auth -> auth_db -> JWT` | Tạo flow xác thực tối thiểu; Gateway là điểm quan sát symptom upstream nhưng Auth không trở thành dependency runtime cho mọi request |
| W2 | `Client -> Gateway -> Course -> Redis/PostgreSQL` | Tạo cache + database dependency; phục vụ fault F1 và dependency evidence |
| W3 | `Client -> Gateway -> Enrollment -> Course + enrollment_db` | Tạo synchronous service-to-service dependency và propagation |
| W4 | `Client -> Gateway -> Submission -> Course + Enrollment + Storage mock + submission_db` | Workflow synchronous nhiều dependency; trọng tâm cho downstream/service/resource fault |
| W5 | `Client -> Gateway -> Grading -> Submission + grading_db -> RabbitMQ -> Notification` | Tạo HTTP + async queue dependency và phục vụ fault F4 |

### Ranh giới nghiệp vụ

| Thành phần | Scope MVP tối thiểu | Không mở rộng thành |
| --- | --- | --- |
| Gateway | Routing, local JWT validation, error normalization, trace propagation | API management/enterprise gateway |
| Auth | Login/refresh, JWT, role/claim tối thiểu | IAM/SSO production-grade |
| Course | Create/get/list tối thiểu, Redis + PostgreSQL | Full course-management product |
| Enrollment | Enroll/check enrollment, gọi Course | Workflow học vụ đầy đủ |
| Submission | Submit/query tối thiểu, gọi Course + Enrollment + Storage mock | File platform/object-storage product |
| Grading | Grade tối thiểu, gọi Submission, publish `grade.completed` | Automatic/AI grading |
| Notification | Consume `grade.completed`, giả lập xử lý | Email/SMS/push production system |

**Lý do MVP:** topology này đủ tạo dependency HTTP, database, cache, storage và async queue để quan sát fault propagation và đánh giá RCA mà không tăng LMS scope không cần thiết.

---

## 3.2. Hạ tầng và dependency bắt buộc

| Hạng mục MVP | Vai trò trong nghiên cứu |
| --- | --- |
| PostgreSQL | Service-owned persistence và database/dependency telemetry |
| Redis | Cache dependency cho Course; fault F1 |
| RabbitMQ | Async dependency `grade.completed`; fault F4 |
| Controllable external Storage Mock | Downstream network dependency có deterministic latency/error; fault F2 |
| Docker Compose | Runtime tái lập cho MVP/Target |
| k6 | Automated workload và healthy/high-load controls |

Storage Mock phải là **external dependency qua HTTP/network**, có identity ổn định, bật/tắt latency/error có kiểm soát và tạo được dependency span. Fake adapter in-process không đạt mục tiêu fault propagation/RCA.

---

## 3.3. Observability bắt buộc

Stack MVP:

```text
OpenTelemetry
-> OTel Collector
-> Prometheus (metrics)
-> Tempo (traces)
-> Loki (structured logs)
-> Grafana (raw telemetry inspection)
```

Telemetry tối thiểu phải hỗ trợ:

- `service.name`, `service.version`, `service.instance.id`;
- timestamp UTC, ISO-8601 tại boundary/artifact;
- trace context qua HTTP và RabbitMQ;
- RED metrics cho HTTP;
- dependency metrics/spans cho PostgreSQL, Redis, Storage, outbound HTTP và RabbitMQ khi boundary tồn tại;
- structured logs có `trace_id`/`span_id` trong request/message context;
- error status, HTTP status/error type, dependency identity và timeout semantics;
- correlation từ metric symptom -> trace/span -> log evidence.

Controlled baseline dùng **100% trace sampling**. Robustness MVP được phép tạo degraded telemetry từ artifact baseline; không yêu cầu live low-sampling campaign.

**Lý do MVP:** RQ1–RQ4 cần telemetry đa nguồn, dependency graph, temporal evidence và missingness/coverage có thể kiểm soát.

---

## 3.4. Workload, fault injection và ground truth

### Workload MVP

Tối thiểu phải có:

- normal mixed traffic;
- healthy high-load spike để đo false positive/workload shift;
- workflow traffic đủ kích hoạt W1–W5;
- workload profile, seed, rate/stage và duration có thể truy vết.

`load/` chỉ tạo traffic; không inject fault và không tính evaluation metric.

### Năm fault scenario canonical

| ID | Scenario | Category | `root_cause_service` | `root_cause_component`/evidence |
| --- | --- | --- | --- | --- |
| F1 | Course / Redis latency | Cache | `course` | `course-redis` |
| F2 | Submission -> Storage latency | Downstream dependency | `submission` | `submission-storage` |
| F3 | Submission service error | Service error | `submission` | `submission-service` |
| F4 | Notification consumer slowdown / RabbitMQ backlog | Async queue | `notification` | `notification-consumer` |
| F5 | Submission CPU pressure | Resource | `submission` | `submission-instance` |

MVP evaluation floor:

```text
5 scenarios × 3 repetitions = 15 controlled fault runs
```

Fault mechanism phải mặc định tắt, deterministic/reproducible khi có seed/config, có start/end rõ và không sửa business rule chỉ để tạo fault.

### Ground truth và provenance

Mỗi run phải truy ngược tối thiểu được:

```text
experiment_id / scenario_id / run_id / repeat_index
workload_profile / workload_seed
fault_type / fault_target / fault_intensity
fault_start / fault_end
root_cause_service / root_cause_component
code_commit / service_versions
telemetry_schema_version
experiment_config_version
feature_schema_version / feature_config_version
detector_config_version
incident_config_version
rca_config_version
evaluation_config_version
environment_profile / environment_config_version
telemetry_artifact / prediction_artifact / evaluation_artifact
```

Run lỗi hoặc vi phạm data-quality gate phải được ghi nhận `invalid`/`partial` hoặc rerun; không âm thầm loại khỏi ledger.

---

## 3.5. Analysis/AI/RCA bắt buộc

Analysis chạy **out-of-band** dưới dạng **modular monolith Python**, không nằm trên business request path.

Pipeline MVP:

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

Module canonical:

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

### Telemetry/data quality

Bắt buộc:

- metrics + traces + structured logs;
- service/time-window alignment;
- missing modality semantics rõ ràng;
- data-quality report;
- feature schema/config có version;
- split theo experiment run, không random window của cùng run;
- preprocessing/scaler chỉ fit trên training theo protocol.

Giá trị window khởi điểm `60s`, step `15s` chỉ là baseline để pilot; lựa chọn cuối phải được freeze trên validation trước campaign chính.

### Anomaly detection

Tối thiểu:

1. Static threshold.
2. Robust z-score hoặc statistical baseline tương đương.
3. Isolation Forest hoặc unsupervised detector tương đương.
4. Multi-source/fused anomaly score với missing-modality fallback có chủ đích.

Deep model không thuộc MVP.

### Incident detection

Bắt buộc:

- không mở incident từ một điểm bất thường đơn lẻ;
- persistence/correlation/recovery rule deterministic và có config;
- lưu `estimated_start_time`;
- lifecycle phù hợp như `NORMAL -> SUSPECTED -> OPEN -> RECOVERING -> RESOLVED`.

### Dynamic dependency graph

Graph được xây chủ yếu từ distributed traces theo hướng caller -> callee và theo run/window.

Infrastructure dependency như Redis/PostgreSQL/Storage/RabbitMQ có thể là evidence graph nhưng **không mặc định trở thành service-level RCA candidate**.

### RCA service-level

Primary candidate identity là service.

Baseline tối thiểu:

1. Max Anomaly.
2. Earliest Anomaly.
3. Graph-aware simple baseline.
4. Proposed graph-temporal-evidence ranker.

Proposed ranker kết hợp:

```text
anomaly severity
+ temporal precedence
+ propagation compatibility
+ edge degradation
+ evidence strength
```

Component/dependency chỉ là evidence bổ sung trong MVP. Output phải dùng thuật ngữ **root-cause candidate ranking**, không tuyên bố causal proof tuyệt đối từ telemetry quan sát.

---

## 3.6. Evaluation bắt buộc

Research scope MVP giữ **RQ1–RQ5**. RQ6 không phải RQ chính v1; fault category có thể dùng để stratify/error-analysis.

### Detection/incident metrics

- Precision;
- Recall;
- F1;
- False Positive Rate;
- Detection Delay;
- incident/fault-run level là unit đánh giá chính.

### RCA metrics

- service-level Top-1 Accuracy;
- service-level Top-3 Accuracy;
- service-level Mean Reciprocal Rank;
- Average Rank bổ sung.

Không dùng `root_cause_component` trong primary Top-K/MRR của MVP.

### Ablation bắt buộc

```text
M vs M+T vs M+T+L
without graph vs with graph
without temporal vs with temporal
```

### Robustness MVP

Phải có **ít nhất một focused robustness comparison**:

```text
full/baseline telemetry
vs
one controlled degraded-telemetry condition
```

Chọn một trong hai:

1. controlled trace dropping/sampling simulation trên **cùng baseline telemetry artifact**; hoặc
2. missing-modality evaluation.

Full/degraded condition phải là strict paired comparison trên cùng baseline run/artifact và cùng ground truth.

### System/trade-off metrics

Khi phù hợp phải đo:

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime;
- peak CPU/memory;
- artifact size;
- instrumentation overhead trên throughput/p95 latency.

Không tạo một “accuracy tổng hợp” duy nhất che mất trade-off.

---

## 3.7. Reproducibility và interface tối thiểu

MVP phải có one-command/reproducible flow từ `run_id` tới prediction/evaluation.

CLI là interface bắt buộc cho reproducibility. API/FastAPI hoặc HTML/report view chỉ triển khai khi cần tích hợp/demo và **không được làm chậm pipeline/evaluation**.

DoD end-to-end mục tiêu:

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

Notebook, screenshot hoặc demo thủ công không thay thế artifact có thể chạy lại.

---

# 4. Target — chỉ triển khai sau khi MVP tương ứng ổn định

| Target | Điều kiện xem xét | Giá trị |
| --- | --- | --- |
| Assignment service | W1–W5 MVP ổn định; không làm chậm Submission | Tăng business dependency nếu thực nghiệm cần |
| MinIO | Storage Mock đã chứng minh flow/fault; có giá trị thực nghiệm rõ | Storage dependency thực tế hơn |
| Submission crash/restart fault | 5 fault MVP ổn định | Mở rộng availability fault category |
| Richer log-template features | Structured-log baseline ổn | Tăng evidence/log signal |
| Change-point detection | Baseline detector + incident pipeline ổn | Ước lượng onset tốt hơn |
| Thêm fault intensity/target/repetition | Automation và ground truth ổn | Mở rộng coverage |
| Expanded robustness | Focused MVP robustness đã chạy | Nhiều sampling level/missing-modality combination/live sampling |
| External benchmark subset | Evaluation trên testbed chính không bị chậm | Validation bổ sung |
| Component-level evidence chi tiết hơn | Service-level RCA ổn định | Tăng explainability, không đổi primary metric |

Các Target trên **không nằm trong critical path** và có thể bỏ hoàn toàn mà MVP vẫn hợp lệ.

---

# 5. Stretch — không phải điều kiện hoàn thành

- Kubernetes / Chaos Mesh;
- component-level RCA như primary metric;
- instance-level RCA;
- full causal discovery trên toàn telemetry;
- deep sequence model;
- multi-fault incident;
- service mesh;
- multi-cluster;
- custom Kubernetes operator;
- automatic remediation / self-healing;
- full LMS frontend;
- LLM root-cause reasoning;
- code-level bug localization;
- resilience/enterprise infrastructure nâng cao không cần cho controlled experiments.

---

# 6. Out-of-scope và lý do

| Hạng mục | Trạng thái | Lý do không đưa vào MVP |
| --- | --- | --- |
| Full LMS feature set | Out-of-scope | Không tăng giá trị nghiên cứu tương xứng; dễ chiếm toàn bộ thời gian |
| Chat/forum/video streaming | Out-of-scope | Không cần cho topology/fault canonical |
| AI tutor/recommendation/automatic grading | Out-of-scope | Không thuộc AIOps anomaly/RCA |
| Full production frontend | Stretch/out-of-scope core | UI không phải đóng góp chính; API/report/Grafana tối thiểu đủ |
| Production IAM/SSO | Out-of-scope | Auth chỉ cần đủ tạo login/JWT flow |
| Email/SMS/push thật | Out-of-scope | Notification chỉ cần async consumer + backlog/slowdown fault |
| Object-storage product hoàn chỉnh | Out-of-scope MVP | Storage Mock đủ tạo dependency observable/controllable |
| MinIO | Target | Chỉ thêm khi Storage Mock đã ổn và có giá trị thực nghiệm |
| Assignment | Target | Không cần để đạt topology MVP |
| Thêm nhiều event/workflow async | Out-of-scope MVP | `grade.completed` đã đủ một async boundary có ý nghĩa |
| Retry phức tạp/resilience framework diện rộng | Out-of-scope MVP | Có thể làm thay đổi fault propagation và tăng confound; retry mặc định tắt |
| Service mesh | Stretch/out-of-scope | Tăng hạ tầng nhưng không cần cho research core |
| Kubernetes/Chaos Mesh | Stretch | Docker Compose là runtime canonical của MVP |
| Deep learning/LSTM/Transformer | Stretch | Chỉ đáng xét khi classical baseline có failure mode rõ và có đủ data/budget |
| LLM RCA | Out-of-scope core | Không phải hướng AI canonical; giảm reproducibility/explainability |
| Full causal discovery | Stretch | Vượt scope nhóm hai người và telemetry quan sát không đủ để mặc định causal proof |
| Component/instance RCA làm metric chính | Stretch | Primary evaluation đã freeze ở service-level |
| Multi-fault incident | Stretch | Tăng mạnh độ khó ground truth và evaluation |
| Automatic remediation/self-healing | Stretch | Không cần để trả lời RQ1–RQ5 |
| Custom dashboard framework | Out-of-scope MVP | Grafana + artifact/API tối thiểu đủ; không được chiếm thời gian analysis/evaluation |
| Distributed analysis architecture/Celery/Kafka | Out-of-scope MVP | Modular monolith Python/CLI đủ cho quy mô hiện tại |

---

# 7. Scope freeze và quy tắc chống scope creep

Business scope được **freeze** khi:

1. topology 6 business service + Gateway chạy được;
2. W1–W5 quan sát được;
3. metrics/traces/logs có correlation;
4. năm fault scenario canonical tạo được experiment hợp lệ;
5. ground truth và artifact ledger truy ngược được.

Sau điểm freeze, ưu tiên bắt buộc là:

```text
data quality
-> reproducibility
-> feature pipeline
-> anomaly/incident
-> graph/RCA
-> evaluation
```

không phải thêm feature LMS.

Một Target chỉ được bật khi:

- không làm trễ milestone đang chạy;
- không thay đổi research question canonical;
- không phá candidate granularity service-level;
- có owner + acceptance criteria;
- có lý do trực tiếp liên quan experiment/evaluation;
- MVP tương ứng đã có artifact kiểm chứng.

Tuần 23–24 là buffer/contingency, **không dùng để hợp thức hóa feature mới**.

---

# 8. Ma trận truy vết MVP -> giá trị nghiên cứu

| Thành phần | Dependency | Fault propagation | Telemetry | Ground truth | Evaluation/RQ |
| --- | :---: | :---: | :---: | :---: | :---: |
| Gateway + 6 services | ✓ | ✓ | ✓ |  | RQ2/RQ3 |
| PostgreSQL | ✓ | ✓ | ✓ | ✓ | RCA evidence |
| Redis | ✓ | ✓ | ✓ | ✓ | F1, RQ2/RQ3 |
| RabbitMQ | ✓ | ✓ | ✓ | ✓ | F4, async RCA |
| Storage Mock | ✓ | ✓ | ✓ | ✓ | F2 |
| OTel + M/T/L stack |  | ✓ | ✓ |  | RQ1–RQ5 |
| k6 workload |  |  | ✓ | ✓ | healthy/fault controls |
| Fault framework |  | ✓ | ✓ | ✓ | all controlled experiments |
| Experiment manifest |  |  |  | ✓ | reproducibility |
| Feature/anomaly/incident |  |  | ✓ | ✓ | RQ1/RQ3/RQ4/RQ5 |
| Dynamic graph | ✓ | ✓ | ✓ | ✓ | RQ2/RQ3 |
| Service-level RCA | ✓ | ✓ | ✓ | ✓ | Top-K/MRR |
| Ablation/robustness |  |  | ✓ | ✓ | RQ1–RQ5 |

---

# 9. Kiểm tra Definition of Done của task-01

| DoD task | Bằng chứng trong artifact | Trạng thái |
| --- | --- | --- |
| Phân biệt rõ MVP, Target, Stretch và ngoài phạm vi; dẫn chiếu blueprint canonical | Mục 2–6 + phần source of truth đầu file | **Đạt về nội dung** |
| MVP nêu rõ 6 business service + Gateway, dependency observability/fault và không có production-grade ngoài scope | Mục 3.1–3.7 | **Đạt về nội dung** |
| Có bảng out-of-scope và lý do hoãn/loại các hạng mục dễ scope creep | Mục 6 | **Đạt về nội dung** |
| Bách review tác động tới telemetry, feature, anomaly/RCA và evaluation; feedback được xử lý/ghi tồn đọng | Mục 10 bên dưới | **PENDING — cần collaborator review thật** |

---

# 10. Collaborator review record — Bách

> Không tự đánh dấu `APPROVED` trước khi Bách thực sự review.

**Trạng thái:** `PENDING`

Bách cần xác nhận tối thiểu:

- [ ] Scope telemetry đủ tạo `M`, `M+T`, `M+T+L` cho RQ1.
- [ ] Topology/fault scope tạo đủ dependency edge và propagation cho RQ2.
- [ ] Timestamp, trace timing, fault start/end và incident onset đủ cho RQ3.
- [ ] Robustness scope giữ strict paired comparison trên cùng baseline artifact cho RQ4.
- [ ] Runtime/resource/instrumentation measurement đủ cho RQ5.
- [ ] Không có hạng mục Backend MVP làm thiếu feature/data bắt buộc của `analysis/`.
- [ ] Service-level RCA vẫn là primary granularity; component/dependency chỉ evidence.
- [ ] Không có Target/Stretch nào bị đưa vào critical path.
- [ ] Năm fault scenario và evaluation floor `5 × 3` vẫn giữ nguyên canonical.

| Trường | Giá trị |
| --- | --- |
| Reviewer | Bách |
| Verdict | `PENDING` |
| Ngày review | Chưa có |
| Feedback blocking | Chưa có |
| Feedback non-blocking | Chưa có |
| Cách xử lý | Chưa có |
| Tồn đọng sau review | Chưa có |

---

# 11. Kết luận scope v1

MVP được coi là thành công khi nhóm có thể chạy lặp lại chuỗi:

```text
deploy testbed
-> seed
-> start controlled workload
-> collect correlated metrics/traces/logs
-> inject known fault
-> observe propagation
-> persist ground truth + provenance
-> build features
-> detect incident
-> build dynamic service graph
-> rank service-level root-cause candidates
-> produce evidence/timeline
-> evaluate against ground truth
-> reset
-> repeat
```

Mọi hạng mục không trực tiếp giúp chuỗi trên hoặc RQ1–RQ5 đều phải mặc định **hoãn hoặc loại khỏi MVP**.
