# Plan v0.2 — Lộ trình đồ án 24 tuần

> **Trạng thái:** Sole canonical source of truth cho WHEN + WHO.
>
> **Implementation architecture:** [`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md)
>
> **Backend scope/topology:** [`../architecture/dinh_huong_backend_microservice_testbed_lms.md`](../architecture/dinh_huong_backend_microservice_testbed_lms.md)

> **Đề tài:** Xây dựng hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố trong kiến trúc microservice dựa trên dữ liệu observability và học máy  
> **Phiên bản:** 0.2 — 24-week plan  
> **Thời lượng chính thức:** 24 tuần  
> **Thời gian triển khai kỹ thuật thực tế:** 20 tuần, từ **tuần 3 đến tuần 22**  
> **Tuần 1–2:** thời gian chuẩn bị, không tính vào 20 tuần triển khai  
> **Tuần 23–24:** buffer/backup, không lên kế hoạch feature mới  
> **Nhân sự:** 2 thành viên (A và B)  
> **Mục tiêu cuối kỳ:** Một LMS microservice testbed có observability, workload/fault injection và pipeline anomaly detection + RCA được đánh giá định lượng bằng ground truth.

---

## 1. Quy ước về mốc thời gian

Kế hoạch chính thức có 24 tuần nhưng chỉ sử dụng 20 tuần giữa kỳ cho các hạng mục triển khai có deadline kỹ thuật.

```text
Tuần 1–2    : Preparation / readiness
Tuần 3–22   : 20 tuần triển khai chính
Tuần 23–24  : Buffer / contingency
```

Vì vậy:

- **Tuần 3 của lịch chính thức tương ứng Tuần 1 của `plan-v0.1-20-weeks.md` cũ.**
- **Tuần 22 của lịch chính thức tương ứng Tuần 20 của `plan-v0.1-20-weeks.md` cũ.**
- Tuần 1–2 và 23–24 không được dùng để hợp thức hóa việc tăng scope của 20 tuần triển khai chính.
- Mọi milestone kỹ thuật phải được lập kế hoạch để hoàn thành chậm nhất ở tuần 22.

---

## 2. Nguyên tắc phân công hai thành viên

### 2.1. Cùng sở hữu toàn bộ hệ thống

Không chia theo kiểu:

```text
A chỉ làm backend
B chỉ làm AI
```

Thay vào đó, nhóm sử dụng mô hình **primary + collaborator** theo workstream.

### Thành viên A — Backend / Platform primary

**Primary:**

- microservice testbed;
- database/cache/queue;
- service-to-service communication;
- observability instrumentation;
- Docker Compose và platform cục bộ;
- workload/fault infrastructure;
- experiment orchestration.

**Collaborator ở AI/RCA:**

- telemetry ingestion;
- feature pipeline;
- một số baseline;
- graph construction;
- evaluation harness;
- reproducibility và runtime validation.

### Thành viên B — AI / Diagnosis primary

**Primary:**

- telemetry/data schema phục vụ phân tích;
- feature engineering;
- anomaly/incident detection;
- multi-source fusion;
- dependency/temporal RCA;
- ranking/evidence;
- experimental evaluation và analysis.

**Collaborator ở Backend / Platform:**

- cùng thiết kế service boundary và contract;
- triển khai một số service hoặc integration có ranh giới rõ;
- telemetry instrumentation;
- E2E/integration tests;
- fault design;
- dashboard/query validation.

> Có thể đổi A/B tùy năng lực thực tế của hai thành viên. Điều quan trọng là vai trò primary được xác định rõ nhưng **primary không đồng nghĩa với sole owner**.

### 2.2. Yêu cầu bắt buộc đối với người phối hợp

Người phối hợp không chỉ review cuối cùng. Với mỗi hạng mục quan trọng, người phối hợp phải thực hiện tối thiểu các hoạt động sau:

1. Tham gia quyết định thiết kế trước khi code.
2. Có ít nhất một phần đóng góp kỹ thuật cụ thể: code, test, script, instrumentation, experiment hoặc tài liệu kỹ thuật có thể kiểm tra.
3. Chạy độc lập sản phẩm trên máy/môi trường của mình.
4. Review PR của người phụ trách chính.
5. Có khả năng giải thích và demo phần đã hoàn thành.

Nhờ đó, cả hai thành viên đều có kiến thức thực tế về backend, observability, dữ liệu, AI/RCA và evaluation.

---

## 3. Nhịp làm việc và Definition of Done

### 3.1. Nhịp làm việc mỗi tuần

| Thời điểm | Hoạt động                                                             | Kết quả                                        |
| --------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Đầu tuần  | Chốt mục tiêu, task, owner chính, collaborator và tiêu chí nghiệm thu | Task/issue có scope và DoD rõ                  |
| Giữa tuần | Pair session cho phần thiết kế hoặc rủi ro cao                        | Quyết định được ghi trong issue/ADR            |
| Cuối tuần | Review chéo, chạy độc lập, demo và retrospective                      | Artifact chạy được; backlog/risk được cập nhật |

### 3.2. Definition of Done chung

Một hạng mục chỉ hoàn thành khi:

1. Code/config/tài liệu đã được commit.
2. Test phù hợp đã chạy và kết quả được lưu.
3. README/runbook được cập nhật nếu cách chạy thay đổi.
4. Collaborator chạy lại được độc lập.
5. Có review chéo.
6. Nếu liên quan telemetry/experiment, artifact và metadata của run phải được lưu.
7. Nếu liên quan dữ liệu/model, phải ghi rõ input, version, config và metric đánh giá.

---

## 4. Các mốc bàn giao chính

| Mốc                            | Cuối tuần chính thức | Sản phẩm kiểm tra được                                                                        |
| ------------------------------ | -------------------: | --------------------------------------------------------------------------------------------- |
| **P0 — Readiness**             |                    2 | Hai thành viên sẵn sàng bắt đầu; không có deliverable kỹ thuật bắt buộc.                      |
| **M1 — Nền tảng tái lập**      |                    5 | Scope, architecture, contract, repository, Compose và CI đã có baseline.                      |
| **M2 — Testbed MVP**           |                    9 | LMS testbed chạy E2E, có HTTP + async dependency và test tự động.                             |
| **M3 — Observability & Fault** |                   13 | Metrics/traces/logs, workload, fault framework và dataset/ground truth mẫu chạy lặp lại được. |
| **M4 — AI/RCA Integrated MVP** |                   19 | Pipeline từ experiment telemetry đến incident + Top-K RCA candidates chạy end-to-end.         |
| **M5 — Evaluation Freeze**     |                   21 | Experimental campaign, baseline/ablation/robustness và kết quả chính hoàn tất.                |
| **M6 — Planned Final Release** |                   22 | Source, reproducibility package, báo cáo, slide và demo đã hoàn tất theo kế hoạch.            |
| **B1/B2 — Contingency**        |                23–24 | Buffer cho rủi ro; không có feature mới được lên lịch từ trước.                               |

---

# 5. Kế hoạch chi tiết 24 tuần

## Giai đoạn 0 — Preparation / readiness (Tuần 1–2)

Hai tuần này **không thuộc 20 tuần triển khai kỹ thuật** và không được dùng để tăng scope.

|  Tuần | Mục đích                  | Nội dung gợi ý                                                                                                                                                                  | Deliverable bắt buộc                                        |
| ----: | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **1** | Chuẩn bị                  | Rà soát yêu cầu học phần, lịch cá nhân, tài khoản/repository, công cụ làm việc, quy ước trao đổi và cách lưu tài liệu. Có thể đọc tài liệu nền để làm quen đề tài.              | Không có deliverable kỹ thuật bắt buộc.                     |
| **2** | Chuẩn bị trước triển khai | Kiểm tra điều kiện làm việc của hai thành viên, thống nhất lịch họp cố định, cách quản lý task/PR, chuẩn bị môi trường cá nhân và giải quyết các vấn đề hành chính còn tồn tại. | Readiness checklist nếu cần; không có milestone triển khai. |

> Nếu hai tuần này rảnh, nhóm có thể đọc tài liệu hoặc thử công cụ cá nhân, nhưng kết quả đó không được coi là điều kiện bắt buộc để kế hoạch tuần 3–22 chạy đúng.

---

## Giai đoạn 1 — Scope, architecture và nền tảng tái lập (Tuần 3–5)

### Tuần 3 — Scope, research questions và backlog

**Mục tiêu chung**

- chuyển định hướng tổng thể thành backlog triển khai;
- chốt MVP, out-of-scope và research questions;
- chốt các metric đánh giá chính;
- lập risk register;
- tạo literature matrix tối thiểu cho các baseline/phương pháp sẽ sử dụng.

**A — Backend/Platform primary**

- lập backlog cho testbed/platform;
- xác định các dependency cần thiết để phục vụ fault propagation;
- cùng B chốt tiêu chí nghiệm thu từng milestone.

**B — AI/RCA primary**

- chốt research questions;
- chốt anomaly, incident và RCA metrics;
- tổng hợp baseline/phương pháp liên quan vào literature matrix.

**Đóng góp chéo**

- B review scope backend và loại các LMS feature không phục vụ nghiên cứu;
- A review tính khả thi của telemetry/features/evaluation mà B đề xuất.

**Bàn giao**

- scope/out-of-scope v1;
- backlog tuần 3–22;
- research questions v1;
- risk register;
- literature matrix v0.

---

### Tuần 4 — Topology, contracts, telemetry requirement và evaluation protocol v0

**Mục tiêu chung**

- chốt service topology;
- chốt API/event contracts;
- chốt telemetry requirement trước khi implementation mở rộng;
- chốt fault matrix MVP;
- viết **evaluation protocol v0** trước khi phát triển detector/RCA để tránh thiết kế đánh giá theo kết quả model.

**A — Backend/Platform primary**

- service catalogue và dependency graph;
- OpenAPI/event contract v1;
- data ownership và DB/cache/queue strategy;
- thiết kế fault hook ở mức application/platform.

**B — AI/RCA primary**

- telemetry schema phục vụ feature/RCA;
- ground-truth schema;
- experiment metadata;
- draft dataset split và evaluation metric.

**Đóng góp chéo**

- B tham gia thiết kế ít nhất một HTTP flow và một async flow;
- A kiểm tra telemetry schema có thực sự instrument/export được.

**Bàn giao**

- architecture diagram v1;
- ADR/service catalogue;
- OpenAPI và event schema `grade.completed` v1;
- fault matrix MVP;
- telemetry schema v0;
- evaluation protocol v0.

---

### Tuần 5 — Repository, Compose, CI và service template

**Mục tiêu chung**

- dựng repository code chạy được từ máy sạch;
- tạo Docker Compose skeleton;
- dựng CI/lint/test baseline;
- đưa OpenTelemetry bootstrap vào service template ngay từ đầu.

**A — Backend/Platform primary**

- repository/module structure theo backend blueprint canonical;
- service template;
- Compose cho PostgreSQL/Redis/RabbitMQ và service mẫu;
- lint/unit test/CI.

**B — AI/RCA collaborator + telemetry owner**

- service/resource naming convention;
- OTel bootstrap/resource attributes;
- kiểm tra trace context/error attributes trên service mẫu;
- chạy fresh setup độc lập và sửa tài liệu Quick Start.

**Bàn giao**

- `docker compose up` chạy được;
- một service mẫu có `/health`;
- CI pass;
- OTel bootstrap hoạt động ở mức tối thiểu;
- Quick Start chạy lại được trên máy người còn lại.

**Gate M1:** Hai thành viên cùng clone từ đầu và dựng stack mà không cần thao tác thủ công ngoài tài liệu.

---

## Giai đoạn 2 — LMS microservice testbed + observability-by-design (Tuần 6–9)

### Tuần 6 — Gateway, Auth, Course

**A — Backend/Platform primary**

- Gateway/Auth;
- Auth phát JWT, Gateway kiểm tra JWT cục bộ và role cơ bản;
- PostgreSQL migration và seed;
- timeout/error handling cơ bản.

**B — Backend collaborator / AI-data owner**

- triển khai hoặc đồng sở hữu Course service;
- integration test `login → course`;
- instrument server/client spans và các RED metrics tối thiểu;
- kiểm tra telemetry có đủ field cho phân tích sau này.

**Bàn giao**

- luồng `login → xem course` qua gateway;
- migration/seed;
- integration tests;
- trace/metrics cơ bản cho luồng trên.

---

### Tuần 7 — Enrollment, Submission và propagation xuyên service

**A — Backend/Platform primary**

- Enrollment, service-to-service call tới Course và `enrollment_db`;
- resilience cơ bản cho dependency;
- trace-context propagation qua HTTP.

**B — Backend collaborator**

- Submission service ở mức MVP, gọi Course + Enrollment + storage mock;
- contract/integration tests cho HTTP và storage dependency;
- kiểm tra topology sinh ra từ trace có đúng dependency thiết kế.

**Bàn giao**

- luồng `enroll → nộp bài`;
- ít nhất một HTTP contract test;
- storage mock điều khiển được latency/error;
- trace xuyên Gateway, Submission và các dependency.

---

### Tuần 8 — Grading, Notification và async dependency

**A — Backend/Platform primary**

- Grading service và call tới Submission;
- RabbitMQ publisher cho `grade.completed`;
- publisher reliability/idempotency ở mức MVP.

**B — Backend collaborator / diagnosis owner**

- Notification consumer cho `grade.completed`;
- async trace propagation;
- integration/E2E tests;
- xác nhận các dependency async có thể quan sát và tạo fault được.

**Bàn giao**

- luồng `nộp bài → chấm điểm → thông báo` E2E;
- HTTP + queue cùng xuất hiện trong topology;
- trace async có correlation;
- event schema `grade.completed` được version hóa;
- test E2E đầu tiên.

---

### Tuần 9 — Hardening Testbed MVP

**A — Backend/Platform primary**

- kiểm tra publisher/consumer idempotency và failure handling ở mức MVP;
- timeout/retry/error handling thống nhất;
- reset/seed command.

**B — Backend collaborator**

- E2E regression suite;
- kiểm tra error/latency propagation;
- bổ sung telemetry assertions cho test quan trọng;
- chạy full flow từ máy độc lập.

**Bàn giao**

- **Testbed MVP v0.1**;
- 6 business service + Gateway theo topology MVP canonical;
- PostgreSQL + Redis + RabbitMQ;
- E2E suite;
- reset/seed command.

**Gate M2:** Cả hai đều tự vận hành và giải thích được ít nhất hai workflow xuyên nhiều service.

---

## Giai đoạn 3 — Observability, experiment infrastructure và ground truth (Tuần 10–13)

### Tuần 10 — Hoàn thiện observability stack

**A — Platform primary**

- OTel Collector;
- Prometheus;
- Tempo;
- Loki;
- Grafana;
- hoàn thiện inbound/outbound HTTP, PostgreSQL, Redis, storage và RabbitMQ spans;
- kiểm tra `service.name`, `service.version`, `service.instance.id` và 100% trace sampling cho controlled baseline.

**B — Data/Diagnosis primary**

- structured logs;
- `trace_id`/`span_id` correlation;
- Loki/query validation;
- xác minh error status, HTTP status, error type, dependency identity và timeout semantics;
- dashboard/query phục vụ anomaly/RCA.

**Bàn giao**

- một request có trace xuyên service;
- trace context xuyên RabbitMQ;
- metrics service-level;
- structured logs truy theo trace;
- timestamp UTC ISO-8601;
- dashboard service overview.

---

### Tuần 11 — Telemetry export/query layer và data contract

**A — Platform primary**

- exporter/query adapters cho metrics/traces/logs;
- script lấy dữ liệu theo experiment/time window;
- kiểm tra timestamp/timezone và resource identity.

**B — AI/Data primary**

- data dictionary;
- telemetry normalization schema;
- data-quality checks;
- prototype window alignment giữa metrics/traces/logs.

**Đóng góp chéo**

- A chạy data-quality test;
- B review query/export script và xác nhận không thiếu field cần cho feature/RCA.

**Bàn giao**

- `telemetry-schema.md`;
- query/export pipeline tối thiểu;
- dataset mẫu có metrics/traces/logs;
- data quality report mẫu.

---

### Tuần 12 — Workload generator và fault framework

**A — Platform/Experiment primary**

- workload profiles: normal, burst/high load;
- fault runner/manifest;
- start/stop/reset orchestration;
- hai pilot fault từ danh sách canonical.

**B — Diagnosis collaborator / ground-truth owner**

- ground-truth manifest;
- các trường identity, workload/seed, fault timing/intensity, root-cause service/component, commit/config version và artifact path;
- expected symptom/propagation cho từng fault;
- validation script đối chiếu injected interval với telemetry;
- độc lập chạy và phân tích hai fault đầu.

**Bàn giao**

- workload command;
- experiment manifest;
- 2 fault scenario;
- telemetry + ground truth tương ứng.

---

### Tuần 13 — Fault matrix MVP, repeatability và dataset v0

**A — Experiment primary**

- hoàn thiện 5 scenario canonical: Course/Redis latency, Submission/storage latency, Submission service error, Notification consumer slowdown/RabbitMQ backlog và Submission CPU pressure hoặc crash;
- automated reset;
- repeatability checks.

**B — Data/Evaluation primary**

- kiểm tra label/ground truth;
- kiểm tra `experiment_id`, `scenario_id`, `run_id`, `repeat_index`, workload seed, code/service/config version và artifact link;
- tạo dataset v0 từ healthy/fault runs;
- cập nhật evaluation protocol từ kinh nghiệm pilot nhưng chưa dùng test result để tune model.

**Bàn giao**

- tối thiểu 5 fault scenario tái lập được;
- healthy runs và fault runs mẫu;
- dataset v0;
- ground-truth schema ổn định;
- experiment runbook.

**Gate M3:** Hai thành viên đổi fault cho nhau và đều có thể chạy, reset, export telemetry và xác nhận ground truth độc lập.

---

## Giai đoạn 4 — Data, anomaly detection và RCA (Tuần 14–19)

### Tuần 14 — Data pipeline và feature engineering

**B — AI/Data primary**

- import/clean/windowing;
- metrics features;
- trace-derived features;
- log aggregation features;
- version hóa feature schema.

**A — AI collaborator / platform validation**

- triển khai một phần feature/adapter có ranh giới rõ;
- data-quality tests;
- pipeline CLI/script;
- kiểm tra performance và reproducibility.

**Quy tắc chống leakage**

- split theo **experiment run**, không random window của cùng một run vào nhiều split;
- fit normalization/detector bằng healthy training runs theo protocol;
- validation được dùng để tune threshold/weight;
- test runs không dùng để chọn hyperparameter.

**Bàn giao**

- dataset/feature v1;
- train/validation/test manifest;
- feature generation script;
- data dictionary.

---

### Tuần 15 — Anomaly baselines và incident detection

**B — AI primary**

- static/robust statistical baseline;
- robust z-score hoặc phương pháp thống kê tương đương;
- Isolation Forest;
- incident-window logic và `estimated_start_time`.

**A — AI collaborator**

- implement/reproduce ít nhất một baseline;
- evaluation harness cho Precision/Recall/F1/Detection Delay;
- visualization score theo thời gian;
- kiểm tra healthy high-load case.

**Bàn giao**

- detector benchmark v0;
- incident record schema;
- detection metrics trên validation set;
- error analysis ban đầu.

---

### Tuần 16 — Dynamic dependency graph và RCA baselines

**B — RCA primary**

- graph từ traces;
- anomaly-based ranking;
- earliest-anomaly ranking;
- simple graph-aware baseline.

**A — RCA collaborator**

- graph builder/export hoặc một baseline RCA cụ thể;
- graph validation với topology thực;
- Top-1/Top-3/MRR evaluation harness.

**Bàn giao**

- dynamic service graph;
- RCA baseline results;
- Top-K candidates cho các incident mẫu;
- graph/timeline artifact.

---

### Tuần 17 — Multi-source fusion và modality ablation

**B — AI/RCA primary**

- service anomaly profile;
- kết hợp metrics + traces + logs;
- modality fusion strategy;
- so sánh `M`, `M+T`, `M+T+L`.

**A — Collaborator**

- feature extraction/aggregation cho một modality;
- automation ablation runs;
- kiểm tra missing modality và fallback behavior.

**Bàn giao**

- multi-source pipeline v1;
- modality ablation v1;
- bảng so sánh detector/RCA theo nguồn dữ liệu.

---

### Tuần 18 — Graph/temporal RCA và evidence

**B — RCA primary**

- temporal precedence;
- propagation/dependency score;
- edge degradation;
- evidence aggregation;
- root-cause ranking score.

**A — RCA collaborator**

- implement một thành phần score hoặc validation module;
- parameter sensitivity harness;
- kiểm tra ranking với fault ground truth;
- runtime profiling.

**Bàn giao**

- proposed RCA method v1;
- `rca-result.json` hoặc schema tương đương;
- Top-K + evidence + timeline;
- parameter sensitivity sơ bộ.

---

### Tuần 19 — Tích hợp pipeline end-to-end và pilot

**A — Integration/Platform primary**

- CLI/API từ experiment ID → telemetry → incident → RCA result;
- artifact storage;
- error handling/missing telemetry;
- reproducible one-command pipeline.

**B — AI/RCA primary**

- tích hợp model/ranker;
- pilot trên nhiều fault target;
- xác định failure mode;
- chỉ sửa lỗi/phương pháp có bằng chứng, không thêm feature tùy hứng.

**Bàn giao**

- **AI/RCA Integrated MVP v0.3**;
- demo end-to-end trên tối thiểu 3–5 fault case;
- result có incident, Top-3 candidate và evidence;
- pilot report.

**Gate M4:** A chạy fault do B chọn và B chạy fault do A chọn; kết quả được so với ground truth và ghi rõ cả case thành công lẫn thất bại.

---

## Giai đoạn 5 — Experimental campaign, analysis và planned final release (Tuần 20–22)

### Tuần 20 — Freeze experimental protocol và chạy campaign đợt 1

**Công việc chung**

- freeze experiment protocol trước khi chạy test campaign chính;
- chốt workload, fault duration/intensity, repetitions, seeds và target services;
- chốt dataset split/test set;
- không thay detector/RCA theo kết quả test trừ bug implementation rõ ràng.

**A — Experiment primary**

- automation nhiều run;
- environment/resource monitoring;
- reproducibility checks;
- lưu đầy đủ manifest/config/artifact.

**B — Evaluation primary**

- metric calculation;
- sanity check ground truth;
- theo dõi data quality;
- kiểm tra không có leakage hoặc run bị lỗi.

**Bàn giao**

- protocol v1 frozen;
- campaign batch 1;
- experiment ledger;
- issue list cho run lỗi.

---

### Tuần 21 — Hoàn thành campaign, ablation, robustness và analysis

**A — Experiment/Systems primary**

- rerun các experiment lỗi;
- missing telemetry/sampling/robustness runs trong phạm vi đã chốt;
- runtime/resource benchmark;
- kiểm tra fresh reproduction.

**B — Evaluation/Analysis primary**

- anomaly metrics;
- service-level RCA Top-1/Top-3/MRR/Average Rank; component/dependency chỉ dùng làm evidence bổ sung;
- modality ablation;
- graph/temporal ablation;
- error analysis, findings và limitations.

**MVP evaluation floor**

```text
5 fault scenario × 3 repetitions
```

Target có thể tăng lên khoảng 30–60+ run nếu automation ổn và không làm ảnh hưởng deadline, nhưng không coi số run lớn là mục tiêu quan trọng hơn chất lượng ground truth và reproducibility.

**Bàn giao**

- evaluation dataset v1;
- bảng kết quả chính;
- plots/tables;
- ablation/robustness results;
- findings + limitations.

**Gate M5:** Kết quả chính đủ để trả lời research questions mà không cần thêm feature mới.

---

### Tuần 22 — Freeze hệ thống và planned final release

Báo cáo phải được viết **tích lũy từ các tuần trước**. Tuần 22 dùng để hợp nhất và hoàn thiện, không phải bắt đầu viết từ đầu.

**A — System/reproducibility lead**

- freeze code/config;
- clean-machine setup;
- demo script;
- architecture/observability/experiment documentation;
- backup demo recording nếu phù hợp.

**B — Evaluation/report lead**

- freeze figures/tables;
- AI/RCA methodology;
- experiment/result/limitation sections;
- kiểm tra citation và consistency số liệu.

**Công việc chung**

- review chéo toàn bộ report;
- slide;
- rehearsal;
- Q&A;
- tag final planned release.

**Bàn giao**

- **Planned Final Release v1.0**;
- source + Compose/config;
- dataset/experiment manifest;
- reproducibility/runbook;
- report;
- slide;
- demo script/recording;
- final results package.

**Gate M6:** Một thành viên thực hiện fresh setup/demo theo tài liệu; thành viên còn lại đóng vai hội đồng kiểm tra claim, số liệu và reproducibility.

---

## Giai đoạn 6 — Buffer / contingency (Tuần 23–24)

Hai tuần này **cố ý không có feature hoặc milestone kỹ thuật mới**.

### Tuần 23 — Buffer 1

Mục đích:

- hấp thụ chậm tiến độ từ tuần 3–22;
- sửa lỗi nghiêm trọng phát hiện muộn;
- chạy lại experiment bị invalid;
- xử lý vấn đề môi trường, dependency, máy móc hoặc lịch học;
- hoàn thiện thủ tục/bàn giao nếu có thay đổi từ giảng viên.

Nếu không có rủi ro cần xử lý, tuần này chỉ dùng cho review, backup artifact và rehearsal bổ sung.

### Tuần 24 — Buffer 2

Mục đích:

- contingency cuối cùng trước deadline/bảo vệ;
- xử lý sự cố demo hoặc packaging;
- backup report/data/source;
- điều chỉnh nhỏ theo phản hồi cuối nếu bắt buộc.

**Không lên kế hoạch trước cho:**

- service mới;
- model mới;
- fault category mới;
- refactor lớn;
- Kubernetes/Chaos Mesh hoặc extension khác.

> Nếu kế hoạch tuần 3–22 hoàn thành đúng hạn, tuần 23–24 được xem là thời gian an toàn chứ không phải “hai tuần trống cần lấp đầy bằng feature”.

---

# 6. Chiến lược viết báo cáo song song

Để tuần 22 không trở thành bottleneck, tài liệu được cập nhật xuyên suốt:

| Thời điểm  | Nội dung nên được viết/freeze dần                               |
| ---------- | --------------------------------------------------------------- |
| Tuần 3–5   | Scope, research questions, architecture, technology choices     |
| Tuần 6–13  | Testbed, observability, workload, fault injection, ground truth |
| Tuần 14–19 | Data pipeline, anomaly detection, RCA methodology               |
| Tuần 20–21 | Experimental protocol, results, ablation, limitations           |
| Tuần 22    | Hợp nhất, chỉnh sửa, kiểm tra consistency, slide và defense     |

---

# 7. Backlog tối thiểu phải bảo vệ

Các hạng mục sau là **MVP bắt buộc** trước khi xem xét extension:

- [ ] Testbed có 6 business service + Gateway theo topology MVP canonical; Assignment không phải điều kiện MVP.
- [ ] Có HTTP + async queue.
- [ ] Có PostgreSQL + Redis + RabbitMQ.
- [ ] Metrics, traces và structured logs có correlation.
- [ ] Có workload generator, reset script, fault manifest và ground truth.
- [ ] Có ít nhất 5 fault scenario tái lập được.
- [ ] Có statistical baseline và Isolation Forest hoặc detector unsupervised tương đương.
- [ ] Có incident detection với `estimated_start_time`.
- [ ] Có dynamic dependency graph từ traces.
- [ ] Có ít nhất một RCA baseline và một graph/temporal RCA method có evidence.
- [ ] Metric RCA chính dùng candidate set service-level; component/dependency chỉ là evidence trong MVP.
- [ ] Có evaluation lặp lại tối thiểu `5 fault × 3 run`.
- [ ] Có modality/graph/temporal ablation phù hợp với research questions.
- [ ] Có limitation, error analysis và hướng dẫn reproducibility.

Extension chỉ được xem xét khi **M4 đã qua gate** và không đe dọa M5/M6:

- Kubernetes/Chaos Mesh;
- causal discovery phức tạp;
- change-point model nâng cao;
- log-template model nâng cao;
- external benchmark quy mô lớn;
- nhiều fault đồng thời;
- Assignment hoặc business feature LMS khác.

---

# 8. Quy tắc chống scope creep và rủi ro

| Rủi ro                                 | Dấu hiệu sớm                                         | Quy tắc xử lý                                                                                |
| -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Testbed quá lớn                        | Cuối tuần 8 chưa có E2E ổn                           | Giữ 6 service cốt lõi; giản lược business logic nhưng giữ dependency.                        |
| Observability bị làm muộn              | Service chạy nhưng trace không xuyên                 | Instrument ngay khi tạo service; không đợi đến tuần 10 mới bắt đầu.                          |
| Telemetry không liên kết               | Tuần 11 không query được trace/log theo cùng request | Ưu tiên metrics + traces; structured log giữ schema tối thiểu có correlation.                |
| Fault không tái lập                    | Cùng manifest cho symptom khác biệt lớn              | Cố định workload/seed/config; tự động reset; lưu manifest từng run.                          |
| Data leakage                           | Window của cùng run xuất hiện ở train và test        | Split theo experiment run; test manifest được freeze trước final campaign.                   |
| ML không vượt baseline                 | Isolation Forest không tốt hơn thống kê              | Báo cáo trung thực; tập trung contribution ở fusion/RCA/evidence thay vì đổi model liên tục. |
| RCA tìm symptom thay vì root cause     | Downstream service thường đứng Top-1                 | Dùng onset time + dependency + propagation evidence; đánh giá theo injected target.          |
| Evaluation bị thiết kế theo model      | Protocol thay đổi sau khi xem test result            | Draft protocol từ tuần 4; freeze trước final campaign; test set không dùng để tune.          |
| Thiếu thời gian báo cáo                | Tuần 20 mới bắt đầu viết                             | Viết dần theo artifact từ tuần 3; tuần 22 chỉ hợp nhất/finalize.                             |
| Tuần buffer bị biến thành feature time | Tuần 22 vẫn còn danh sách extension                  | Cắt extension; tuần 23–24 chỉ contingency.                                                   |

---

# 9. Tham chiếu kiến trúc triển khai

Plan không định nghĩa một cây repository riêng. Cấu trúc source code, service template, contract, instrumentation, ranh giới `load/`, `faults/`, `experiments/` và `analysis/evaluation/` tuân theo:

[`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md)

Các task theo tuần phải link tới module canonical trong blueprint. Không gộp workload implementation hoặc fault injector vào `experiments/`; `experiments/` chỉ orchestration và lưu ledger/artifact theo run.

---

# 10. Quy tắc review để bảo đảm cross-ownership

- Không merge module quan trọng nếu chưa có review của thành viên còn lại.
- PR phải ghi: mục tiêu, cách chạy, test, telemetry/experiment impact và rollback nếu có.
- API/event/telemetry/ground-truth schema thay đổi phải cập nhật contract/data dictionary/ADR tương ứng.
- Backend-primary không được tự merge toàn bộ `services/` mà không có AI-primary chạy E2E và kiểm tra telemetry.
- AI-primary không được tự freeze detector/RCA mà không có backend-primary chạy evaluation harness và xác nhận reproducibility.
- Demo luân phiên người thực hiện; người demo không nhất thiết là người code chính.
- Mỗi thành viên phải có ít nhất một đóng góp implementation thực tế ở cả **backend/platform** và **AI/RCA** trước khi kết thúc M4.

---

# 11. Cách cập nhật kế hoạch

Không sửa lịch sử của baseline cũ. Lưu tài liệu này như một phiên bản mới, ví dụ:

```text
docs/processed/plan/
├── plan-v0.1-20-weeks.md
└── plan-v0.2-24-weeks.md
```

Mỗi lần điều chỉnh tiếp theo cần ghi:

- ngày cập nhật;
- lý do;
- tuần/milestone bị ảnh hưởng;
- scope thêm/bỏ;
- tác động tới experiment/reproducibility;
- liệu có tiêu tốn buffer tuần 23–24 hay không.

> Nguyên tắc cuối cùng: **20 tuần giữa kỳ phải đủ để hoàn thành đồ án ở trạng thái có thể bảo vệ. Tuần 1–2 giúp nhóm bắt đầu có tổ chức; tuần 23–24 giúp nhóm chịu được rủi ro, không phải để hợp thức hóa một kế hoạch vốn đã quá tải.**
