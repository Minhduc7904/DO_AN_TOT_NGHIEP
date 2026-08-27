# Implementation backlog v1 — Tuần 3–22

> **Trạng thái:** Review-ready artifact cho `task-02_create-implementation-backlog`.
>
> **Vai trò:** Backlog triển khai có thứ tự dependency cho 20 tuần kỹ thuật chính, từ tuần 3 đến tuần 22.
>
> **Nguồn canonical:**
>
> - WHEN/WHO + milestone: [`plan-v0.2-24-weeks.md`](plan-v0.2-24-weeks.md)
> - Scope v1: [`../direction/project-scope-v1.md`](../direction/project-scope-v1.md)
> - Backend SUT: [`../architecture/backend_microservice_testbed_blueprint.md`](../architecture/backend_microservice_testbed_blueprint.md)
> - Analysis/AI/RCA: [`../architecture/analysis-anomaly-rca-blueprint.md`](../architecture/analysis-anomaly-rca-blueprint.md)
> - RQ/metrics: [`../direction/research-questions-and-metrics-v1.md`](../direction/research-questions-and-metrics-v1.md)

## 1. Nguyên tắc backlog

1. Backlog **không thay timeline hoặc milestone canonical** của plan v0.2.
2. Critical path chỉ chứa **MVP**.
3. Target/Stretch không được dùng để chặn milestone M1–M6.
4. Dependency order ưu tiên:

```text
scope/contracts/schema
-> repository/runtime foundation
-> testbed services
-> observability
-> telemetry export/data quality
-> workload + faults + ground truth
-> features
-> anomaly + incident
-> dynamic graph + RCA
-> integration
-> frozen experiment campaign
-> evaluation
-> final reproducibility package
```

5. Ưu tiên **testbed + observability + experiment + data quality trước model phức tạp**.
6. Primary không phải sole owner; collaborator phải review/chạy độc lập/đóng góp kỹ thuật theo plan.
7. Mapping sử dụng trong backlog này theo phân công task hiện tại:
   - **Đức:** Backend/Platform primary.
   - **Bách:** AI/Diagnosis primary.
8. Mỗi item phải tạo artifact/test/result kiểm tra được; không nghiệm thu bằng mô tả hoặc screenshot đơn lẻ.

---

# 2. Milestone map

| Milestone | Deadline | Gate/deliverable chính |
| --- | ---: | --- |
| **M1 — Nền tảng tái lập** | Cuối tuần 5 | Scope + architecture/contracts + repository + Compose + CI baseline |
| **M2 — Testbed MVP** | Cuối tuần 9 | 6 business service + Gateway, HTTP + async dependency, E2E |
| **M3 — Observability & Fault** | Cuối tuần 13 | M/T/L + workload + fault framework + ground truth + dataset v0 |
| **M4 — AI/RCA Integrated MVP** | Cuối tuần 19 | Run ID -> telemetry -> incident -> Top-K RCA + evidence |
| **M5 — Evaluation Freeze** | Cuối tuần 21 | Campaign + ablation + robustness + result chính |
| **M6 — Planned Final Release** | Cuối tuần 22 | Source/config + reproducibility + report + slide + demo |

---

# 3. Ordered MVP backlog tuần 3–22

## B01 — Tuần 3 — Chốt scope, RQ và backlog

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 3 / M1** |
| Scope tier | **MVP** |
| Module | `docs/processed/direction/`, `docs/processed/plan/` |
| Primary | Đức — scope/backlog; Bách — RQ/metrics/risk/literature theo task tuần |
| Collaborator | Review chéo Đức ↔ Bách |
| Dependency | Overall direction + Backend blueprint + Analysis blueprint + plan v0.2 |
| Sản phẩm | `project-scope-v1.md`, `implementation-backlog-v1.md`, RQ/metrics v1, risk register, literature matrix v0 |
| Nghiệm thu | Scope phân tầng MVP/Target/Stretch/out-of-scope; backlog tuần 3–22 có owner/dependency/acceptance; RQ1–RQ5 và metric chính ánh xạ được tới telemetry/fault/ground truth |

**Không làm:** code scaffold, đổi topology, đưa Target/Stretch vào critical path.

---

## B02 — Tuần 4 — Freeze topology, contracts, telemetry requirement và evaluation protocol v0

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 4 / M1** |
| Scope tier | **MVP** |
| Module | `contracts/`, `docs/processed/architecture/`, `docs/processed/adr/`, `experiments/protocols/` (spec only), `analysis/telemetry/` (schema/spec only) |
| Primary | Đức — topology/contracts/data ownership/fault matrix; Bách — telemetry/ground truth/evaluation protocol |
| Collaborator | Bách review HTTP/async flow; Đức review instrumentability |
| Dependency | B01 scope v1 + RQ/metrics v1 |
| Sản phẩm | Service catalogue/topology v1; HTTP/event contract v1; data ownership; fault matrix MVP; telemetry + ground-truth schema v0; evaluation protocol v0 |
| Nghiệm thu | 6 services + Gateway giữ nguyên; `grade.completed` canonical; candidate granularity service-level; fault F1–F5 mapping rõ; schema đủ provenance; protocol chốt unit/split/metric và nguyên tắc chống leakage |

**Gate:** không scaffold rộng trước khi boundary/schema quan trọng đủ rõ để tránh rework.

---

## B03 — Tuần 5 — Repository, Compose, CI và service template

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 5 / M1** |
| Scope tier | **MVP** |
| Module | `services/`, `packages/observability/`, `packages/testing/`, `contracts/`, `infrastructure/compose/`, `infrastructure/postgres/`, `infrastructure/redis/`, `infrastructure/rabbitmq/` |
| Primary | Đức |
| Collaborator | Bách — OTel/resource naming + fresh setup validation |
| Dependency | B02 topology/contracts/schema |
| Sản phẩm | Monorepo skeleton; NestJS service template; Compose skeleton; PostgreSQL/Redis/RabbitMQ; CI/lint/test baseline; OTel bootstrap; Quick Start |
| Nghiệm thu | `docker compose up` chạy; service mẫu `/health`; CI pass; `service.name/version/instance.id` đúng; collaborator clone sạch và chạy lại được |

**Gate M1:** fresh clone -> setup theo tài liệu -> stack chạy mà không cần thao tác ngầm.

---

## B04 — Tuần 6 — Gateway, Auth, Course

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 6 / M2** |
| Scope tier | **MVP** |
| Module | `services/gateway/`, `services/auth/`, `services/course/`, `contracts/http/`, `infrastructure/postgres/`, `infrastructure/redis/`, `packages/observability/` |
| Primary | Đức |
| Collaborator | Bách — Course/integration + telemetry validation |
| Dependency | B03 repository/runtime/template |
| Sản phẩm | Gateway/Auth/Course; migrations/seed; Redis cache; integration test `login -> course`; basic traces/metrics |
| Nghiệm thu | W1 + W2 chạy qua Gateway; JWT local validation; Course chỉ sở hữu DB của mình; HTTP server/client + Redis/PostgreSQL telemetry xuất hiện; tests pass |

---

## B05 — Tuần 7 — Enrollment, Submission và synchronous propagation

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 7 / M2** |
| Scope tier | **MVP** |
| Module | `services/enrollment/`, `services/submission/`, `infrastructure/storage/mock/`, `contracts/http/`, `packages/observability/` |
| Primary | Đức — Enrollment/platform |
| Collaborator | Bách — Submission/storage dependency + topology validation |
| Dependency | B04 Course/Auth/Gateway; B02 contracts |
| Sản phẩm | Enrollment; Submission MVP; external controllable Storage Mock; contract/integration tests; trace-context propagation |
| Nghiệm thu | W3 + W4 chạy; Submission gọi Course + Enrollment + Storage Mock; storage latency/error điều khiển được và mặc định tắt; outbound/dependency spans đúng; ít nhất một HTTP contract test pass |

---

## B06 — Tuần 8 — Grading, Notification và async dependency

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 8 / M2** |
| Scope tier | **MVP** |
| Module | `services/grading/`, `services/notification/`, `contracts/events/grade-completed/`, `infrastructure/rabbitmq/`, `packages/observability/` |
| Primary | Đức — Grading/publisher |
| Collaborator | Bách — Notification/async trace + E2E |
| Dependency | B05 Submission; RabbitMQ baseline từ B03 |
| Sản phẩm | Grading; `grade.completed` publisher; Notification consumer; async trace propagation; E2E test |
| Nghiệm thu | W5 chạy end-to-end; HTTP + queue xuất hiện trong topology; event schema versioned; event ID + trace context có trong envelope; publisher/consumer có duplicate-handling phù hợp MVP |

---

## B07 — Tuần 9 — Hardening Testbed MVP

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 9 / M2** |
| Scope tier | **MVP** |
| Module | `services/`, `packages/testing/`, `contracts/`, `scripts/` |
| Primary | Đức |
| Collaborator | Bách — E2E regression + telemetry assertions |
| Dependency | B04–B06 |
| Sản phẩm | Testbed MVP v0.1; E2E regression suite; reset/seed command; unified timeout/error handling |
| Nghiệm thu | 6 business service + Gateway chạy; PostgreSQL + Redis + RabbitMQ + Storage Mock; W1–W5 pass; không cross-service DB/source import; reset/seed tái lập; cả hai chạy độc lập được ≥2 multi-service workflow |

**Gate M2:** topology MVP và business scope đủ để freeze feature growth.

---

## B08 — Tuần 10 — Hoàn thiện observability stack

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 10 / M3** |
| Scope tier | **MVP** |
| Module | `infrastructure/observability/otel-collector/`, `prometheus/`, `tempo/`, `loki/`, `grafana/`, `packages/observability/`, `services/` |
| Primary | Đức — platform/instrumentation |
| Collaborator | Bách — logs/query/diagnosis validation |
| Dependency | B07 stable testbed |
| Sản phẩm | OTel Collector + Prometheus + Tempo + Loki + Grafana; correlated metrics/traces/logs |
| Nghiệm thu | Request trace xuyên service; RabbitMQ context xuyên producer/consumer; RED/dependency metrics query được; structured log truy theo trace; UTC/identity chuẩn; 100% trace sampling cho controlled baseline |

---

## B09 — Tuần 11 — Telemetry export/query layer và data contract

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 11 / M3** |
| Scope tier | **MVP** |
| Module | `analysis/telemetry/`, `scripts/`, `experiments/` artifact boundary, `infrastructure/observability/` |
| Primary | Bách — data contract/normalization |
| Collaborator | Đức — query/export adapters + data-quality execution |
| Dependency | B08 observability; B02 telemetry schema |
| Sản phẩm | Telemetry adapters/export; normalized schema; data dictionary; time-window alignment prototype; data-quality checks; sample M/T/L artifact |
| Nghiệm thu | Export theo run/time range; identity/timestamp hợp lệ; missing/coverage được kiểm tra; sample artifact có metrics+traces+logs; data-quality report mở được |

---

## B10 — Tuần 12 — Workload generator và fault framework

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 12 / M3** |
| Scope tier | **MVP** |
| Module | `load/`, `faults/`, `experiments/runner/`, `experiments/scenarios/`, `experiments/runs/` |
| Primary | Đức — workload/fault/orchestration |
| Collaborator | Bách — ground truth/expected propagation/validation |
| Dependency | B07 testbed + B08 observability + B09 telemetry export |
| Sản phẩm | k6 profiles; fault catalog/injectors; start/stop/reset runner; experiment manifest; 2 pilot faults; telemetry + ground truth |
| Nghiệm thu | Normal + healthy high-load profiles reproducible bằng seed; fault mặc định tắt; start/end/intensity rõ; runner lưu manifest/artifact; injected interval khớp telemetry; 2 pilot fault chạy lại được |

---

## B11 — Tuần 13 — Fault matrix MVP, repeatability và dataset v0

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 13 / M3** |
| Scope tier | **MVP** |
| Module | `faults/`, `load/`, `experiments/`, `analysis/telemetry/` |
| Primary | Đức — experiment/fault automation |
| Collaborator | Bách — labels/data quality/dataset |
| Dependency | B10 |
| Sản phẩm | F1–F5 canonical; automated reset; healthy/fault runs; dataset v0; stable ground-truth schema; experiment runbook |
| Nghiệm thu | 5 fault category tái lập; mỗi run có run/scenario/repeat/seed/version/artifact provenance; run invalid được ghi; healthy normal + healthy high-load có artifact; collaborator đổi fault và chạy độc lập được |

**Gate M3:** collect -> inject -> ground truth -> export -> reset chạy lặp lại.

---

## B12 — Tuần 14 — Feature pipeline và split chống leakage

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 14 / M4** |
| Scope tier | **MVP** |
| Module | `analysis/telemetry/`, `analysis/features/`, `analysis/evaluation/` (split manifest) |
| Primary | Bách |
| Collaborator | Đức — adapter/quality/performance/reproducibility |
| Dependency | B11 dataset v0; evaluation protocol v0 |
| Sản phẩm | Import/clean/windowing; service/edge/log features; feature registry/schema; train/validation/test manifest; feature CLI/script |
| Nghiệm thu | Split theo experiment run; scaler/preprocess fit training only; missing semantics rõ; schema/config versioned; deterministic window/alignment tests; feature generation tái lập |

---

## B13 — Tuần 15 — Anomaly baselines và incident detection

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 15 / M4** |
| Scope tier | **MVP** |
| Module | `analysis/anomaly/`, `analysis/incident/`, `analysis/evaluation/detection/` |
| Primary | Bách |
| Collaborator | Đức — ít nhất một baseline + evaluation harness |
| Dependency | B12 features/split |
| Sản phẩm | Static threshold; robust z-score; Isolation Forest/equivalent; fused score; incident lifecycle; detection benchmark v0 |
| Nghiệm thu | Model artifact ghi features/scaler/seed/training runs/config; threshold/hyperparameter chỉ tune validation; incident persistence/merge/recovery có test; `estimated_start_time` lưu được; Precision/Recall/F1/FPR/Detection Delay tính được; healthy high-load được kiểm tra |

---

## B14 — Tuần 16 — Dynamic dependency graph và RCA baselines

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 16 / M4** |
| Scope tier | **MVP** |
| Module | `analysis/graph/`, `analysis/rca/baselines/`, `analysis/evaluation/rca/` |
| Primary | Bách |
| Collaborator | Đức — graph builder/validation hoặc RCA baseline |
| Dependency | B09 trace data + B13 anomaly/incident |
| Sản phẩm | Dynamic service graph; Max Anomaly; Earliest Anomaly; Graph-aware simple baseline; Top-K evaluation harness |
| Nghiệm thu | Graph caller->callee đúng topology quan sát; async edge xử lý theo contract; infrastructure component không lẫn vào service candidate set; ranking deterministic; Top-1/Top-3/MRR tính được |

---

## B15 — Tuần 17 — Multi-source fusion và modality ablation

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 17 / M4** |
| Scope tier | **MVP** |
| Module | `analysis/features/`, `analysis/anomaly/fusion/`, `analysis/evaluation/ablation/` |
| Primary | Bách |
| Collaborator | Đức — modality feature/automation/missing fallback |
| Dependency | B12–B14 |
| Sản phẩm | Service anomaly profile; `M`, `M+T`, `M+T+L`; modality fusion config; ablation v1 |
| Nghiệm thu | Variant dùng cùng run split/candidate set/protocol; missing modality không silently impute thành 0; component + fused scores lưu được; detection và RCA metric báo cáo riêng theo modality |

---

## B16 — Tuần 18 — Graph/temporal RCA và evidence

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 18 / M4** |
| Scope tier | **MVP** |
| Module | `analysis/rca/`, `analysis/evidence/`, `analysis/incident/timeline/`, `analysis/evaluation/ablation/` |
| Primary | Bách |
| Collaborator | Đức — score component/validation/sensitivity/runtime |
| Dependency | B14 graph + B15 multi-source profile |
| Sản phẩm | Proposed graph-temporal-evidence ranker v1; evidence artifact; timeline; graph/temporal ablation harness |
| Nghiệm thu | Ranker xuất anomaly/temporal/propagation/edge/evidence component scores; weight tune validation và versioned; service-level candidate set giữ nguyên; evidence trỏ metric/trace/log artifact; timeline có timestamp; ranking deterministic |

---

## B17 — Tuần 19 — Tích hợp pipeline end-to-end

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 19 / M4** |
| Scope tier | **MVP** |
| Module | `analysis/`, `experiments/`, `scripts/` |
| Primary | Đức — integration/reproducibility |
| Collaborator | Bách — model/ranker/pilot/failure analysis |
| Dependency | B11–B16 |
| Sản phẩm | One-command pipeline từ `run_id`; artifact storage; AI/RCA Integrated MVP v0.3; pilot report |
| Nghiệm thu | `run_id -> validate -> features -> anomaly -> incident -> graph -> Top-3 RCA -> evidence -> evaluation` chạy; missing telemetry có error/fallback rõ; pilot 3–5 fault case; success/failure đều được ghi |

**Gate M4:** cả hai chạy fault do người kia chọn và so prediction với ground truth.

---

## B18 — Tuần 20 — Freeze protocol và campaign batch 1

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 20 / M5** |
| Scope tier | **MVP** |
| Module | `experiments/protocols/`, `experiments/runner/`, `experiments/runs/`, `analysis/evaluation/` |
| Primary | Đức — campaign automation |
| Collaborator | Bách — evaluation/data quality |
| Dependency | B17 integrated pipeline + validation-selected configs |
| Sản phẩm | Frozen protocol v1; fixed run split/candidate set/workload/fault duration/intensity/repetition/seeds; campaign batch 1; experiment ledger |
| Nghiệm thu | Không tune detector/RCA theo final test result; config/version/commit ghi trước run; run lỗi vẫn có ledger entry; data quality gate áp dụng; artifact truy ngược được |

---

## B19 — Tuần 21 — Hoàn thành campaign, ablation, robustness và analysis

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 21 / M5** |
| Scope tier | **MVP** |
| Module | `experiments/`, `analysis/evaluation/detection/`, `analysis/evaluation/rca/`, `analysis/evaluation/ablation/`, `analysis/evaluation/robustness/`, `analysis/evaluation/reports/` |
| Primary | Bách — evaluation/analysis |
| Collaborator | Đức — rerun/robustness/runtime/reproduction |
| Dependency | B18 frozen campaign |
| Sản phẩm | Evaluation dataset v1; main tables/plots; modality + graph + temporal ablation; focused robustness; runtime/resource result; findings/limitations |
| Nghiệm thu | Tối thiểu `5 scenarios × 3 repetitions` hợp lệ hoặc run invalid/rerun có lý do; service-level Top-1/Top-3/MRR + detection metrics; robustness strict paired trên cùng baseline artifact; RQ1–RQ5 có đủ dữ liệu trả lời; failure cases/trade-off được báo cáo |

**Gate M5:** kết quả chính đủ trả lời RQ mà không cần thêm feature mới.

---

## B20 — Tuần 22 — Freeze hệ thống và Planned Final Release

| Trường | Nội dung |
| --- | --- |
| Tuần / Milestone | **Tuần 22 / M6** |
| Scope tier | **MVP** |
| Module | Toàn repo; trọng tâm `docs/`, `scripts/`, `experiments/`, `analysis/`, `infrastructure/`, `services/` |
| Primary | Đức — system/reproducibility |
| Collaborator | Bách — evaluation/report |
| Dependency | B19 main results |
| Sản phẩm | Planned Final Release v1.0; frozen source/config; clean-machine setup; reproducibility/runbook; dataset/manifest; report; slide; demo script/recording nếu phù hợp |
| Nghiệm thu | Fresh setup chạy; one-command experiment/analysis path được tài liệu hóa; figures/tables nhất quán với artifact; report có methodology/results/limitations; slide/demo dùng đúng frozen result; không thêm feature mới |

**Gate M6:** source + artifact + report + demo cùng trỏ về một frozen configuration/result set.

---

# 4. Dependency chain theo module canonical

Backlog bảo đảm các module xuất hiện theo dependency order sau:

```text
docs/spec + contracts/
        ↓
services/
        ↓
infrastructure/compose + postgres + redis + rabbitmq + storage
        ↓
packages/observability
        ↓
infrastructure/observability
        ↓
analysis/telemetry
        ↓
load/ + faults/
        ↓
experiments/
        ↓
analysis/features
        ↓
analysis/anomaly
        ↓
analysis/incident
        ↓
analysis/graph
        ↓
analysis/rca
        ↓
analysis/evidence
        ↓
analysis/evaluation
        ↓
experiments final campaign + reproducibility package
```

Giải thích ranh giới:

- `services/`: business SUT.
- `infrastructure/`: runtime/config PostgreSQL, Redis, RabbitMQ, Storage Mock và observability stack.
- `load/`: chỉ tạo traffic.
- `faults/`: chỉ cơ chế fault tái sử dụng.
- `experiments/`: orchestration + manifest/run ledger.
- `analysis/`: telemetry -> feature -> anomaly -> incident -> graph -> RCA -> evidence -> evaluation.

Không copy workload vào `experiments/`, không inject fault trong `load/`, không để `analysis/evaluation/` điều khiển runtime.

---

# 5. Critical-path map

```text
W3  Scope/RQ/backlog
 ↓
W4  Topology/contracts/schema/protocol
 ↓
W5  Repo/Compose/CI/OTel template              [M1]
 ↓
W6  Gateway/Auth/Course
 ↓
W7  Enrollment/Submission/Storage Mock
 ↓
W8  Grading/RabbitMQ/Notification
 ↓
W9  Testbed hardening                           [M2]
 ↓
W10 Observability stack
 ↓
W11 Telemetry export + data quality
 ↓
W12 Workload + fault runner + pilot
 ↓
W13 5 fault + dataset v0                        [M3]
 ↓
W14 Feature pipeline + split
 ↓
W15 Anomaly + incident
 ↓
W16 Graph + RCA baselines
 ↓
W17 Multi-source + modality ablation
 ↓
W18 Proposed RCA + evidence
 ↓
W19 Integrated pipeline                         [M4]
 ↓
W20 Freeze protocol + campaign
 ↓
W21 Evaluation + ablation + robustness          [M5]
 ↓
W22 Reproducibility + final release              [M6]
```

Điểm cố ý: **model phức tạp không xuất hiện trước data quality, ground truth và baseline**.

---

# 6. Target/Stretch backlog — không thuộc critical path

Các item dưới đây **không có tuần bắt buộc** trong backlog MVP. Chỉ tạo task riêng khi gate tương ứng đạt và không ảnh hưởng M1–M6.

| ID | Tier | Hạng mục | Gate trước khi xem xét | Module dự kiến | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| X01 | Target | Assignment service | Testbed W1–W5 ổn định, Submission MVP không bị chậm | `services/assignment/` | Không lên lịch |
| X02 | Target | MinIO | Storage Mock + F2 ổn định | `infrastructure/storage/minio/` | Không lên lịch |
| X03 | Target | Submission crash/restart | F1–F5 MVP ổn định | `faults/` | Không lên lịch |
| X04 | Target | Change-point detection | B13 detector/incident baseline ổn | `analysis/anomaly/`, `analysis/incident/` | Không lên lịch |
| X05 | Target | Richer log-template feature | Structured-log baseline ổn | `analysis/features/logs/` | Không lên lịch |
| X06 | Target | Expanded robustness matrix | B19 focused robustness hoàn tất | `analysis/evaluation/robustness/` | Không lên lịch |
| X07 | Target | External benchmark subset | Testbed evaluation chính an toàn | `analysis/telemetry/`, `analysis/evaluation/` | Không lên lịch |
| X08 | Target | Richer component evidence | Service-level RCA ổn định | `analysis/evidence/` | Không lên lịch |
| X09 | Stretch | Kubernetes/Chaos Mesh | M5/M6 không rủi ro | Infrastructure riêng qua ADR | Không lên lịch |
| X10 | Stretch | Deep sequence model | Baseline có failure mode rõ + đủ data/budget | `analysis/anomaly/` | Không lên lịch |
| X11 | Stretch | Component/instance RCA primary | Service-level evaluation hoàn tất | `analysis/rca/` | Không lên lịch |
| X12 | Stretch | Multi-fault/full causal/LLM RCA | Không thuộc core | Analysis extension | Không lên lịch |

---

# 7. Milestone coverage check

| Milestone | Backlog item bao phủ | Trạng thái coverage |
| --- | --- | --- |
| M1 | B01–B03 | Đủ |
| M2 | B04–B07 | Đủ |
| M3 | B08–B11 | Đủ |
| M4 | B12–B17 | Đủ |
| M5 | B18–B19 | Đủ |
| M6 | B20 | Đủ |

---

# 8. Module coverage check theo DoD task-02

| Module bắt buộc | Backlog item đầu tiên | Vai trò |
| --- | --- | --- |
| `services/` | B03/B04 | Scaffold + business testbed |
| `infrastructure/` | B03 | Runtime dependencies; observability mở rộng ở B08 |
| `analysis/` | B09 | Telemetry/data trước features/model |
| `load/` | B10 | Workload reproducible |
| `faults/` | B10 | Controlled fault mechanism |
| `experiments/` | B10 | Runner/manifest/ground truth/ledger |

Thứ tự đáp ứng blueprint: testbed/runtime -> observability -> telemetry/data quality -> workload/fault/experiments -> feature/model/RCA -> evaluation.

---

# 9. Scope-control rules trong backlog

- Không thêm LMS feature mới sau Gate M2 trừ khi có bằng chứng topology/fault canonical không đủ.
- Không đưa Assignment/MinIO/Kubernetes/deep learning/LLM vào critical path.
- Không mở rộng fault matrix trên mọi service.
- Không coi 30–60+ run là bắt buộc; MVP floor là `5 × 3`.
- Không tune threshold/window/weight/model trên final test campaign.
- Không chia window của cùng run sang nhiều split.
- Không đổi service-level RCA thành component-level primary metric giữa campaign.
- Không bắt đầu custom UI trước khi one-command pipeline + evaluation artifact chạy.
- Tuần 23–24 chỉ là contingency; không dùng để lên kế hoạch feature mới.

---

# 10. Acceptance evidence tối thiểu theo phase

| Phase | Evidence tối thiểu |
| --- | --- |
| M1 | Scope/contracts/schema docs; CI result; fresh Compose setup |
| M2 | E2E test W1–W5; service/dependency telemetry assertions; reset/seed |
| M3 | M/T/L artifact; data-quality report; fault manifest; ground truth; repeatable run |
| M4 | Feature/model/config artifact; incident; graph; Top-K candidates; evidence; evaluation fixture |
| M5 | Frozen protocol; experiment ledger; main metrics; ablation; robustness; failure analysis |
| M6 | Frozen commit/config; clean-machine runbook; final result package; report/slide/demo |

---

# 11. Kiểm tra Definition of Done của task-02

| DoD task | Bằng chứng trong artifact | Trạng thái |
| --- | --- | --- |
| Bao phủ tuần 3–22 và M1–M6; mỗi item có tuần/milestone, owner, collaborator, dependency, sản phẩm kiểm tra được | B01–B20 + mục 7 | **Đạt về nội dung** |
| `services/`, `analysis/`, `load/`, `faults/`, `experiments/`, `infrastructure/` xuất hiện theo dependency blueprint | Mục 3, 4, 8 | **Đạt về nội dung** |
| Phân biệt MVP với Target/Stretch; extension không nằm critical path | Mục 1, 5, 6, 9 | **Đạt về nội dung** |
| Bách review dependency data/telemetry/feature/evaluation; bất đồng được ghi rõ | Mục 12 bên dưới | **PENDING — cần collaborator review thật** |

---

# 12. Collaborator review record — Bách

> Không tự đánh dấu `APPROVED` trước khi Bách thực sự review.

**Trạng thái:** `PENDING`

Bách cần review tối thiểu các dependency sau:

- [ ] Telemetry schema/provenance được chốt trước telemetry export và feature pipeline.
- [ ] Data-quality gate có trước model benchmark.
- [ ] Workload/fault/ground truth ổn trước dataset/final evaluation.
- [ ] Split chống leakage và evaluation protocol có trước tuning.
- [ ] `M`, `M+T`, `M+T+L` có data dependency rõ trước RQ1 ablation.
- [ ] Dynamic graph có trace/edge data đủ trước graph-aware RCA.
- [ ] Incident onset/timeline có trước temporal RCA.
- [ ] Candidate set service-level được freeze trước campaign.
- [ ] Focused robustness dùng paired baseline/degraded artifact, không dùng hai run độc lập.
- [ ] B18 freeze protocol xảy ra trước B19 final metric/analysis.
- [ ] Không có Target/Stretch nào chặn M1–M6.
- [ ] B20 chỉ freeze/hợp nhất, không bắt đầu report từ đầu hoặc thêm feature mới.

| Trường | Giá trị |
| --- | --- |
| Reviewer | Bách |
| Verdict | `PENDING` |
| Ngày review | Chưa có |
| Dependency issue blocking | Chưa có |
| Dependency issue non-blocking | Chưa có |
| Cách xử lý | Chưa có |
| Điểm chưa thống nhất | Chưa có |

---

# 13. Kết luận backlog v1

Critical path của đồ án được cố ý tối ưu cho **research validity trước model complexity**:

```text
controlled SUT
+ observability
+ reproducible workload/fault
+ trustworthy ground truth
+ clean telemetry/data quality
+ simple baselines
+ graph/temporal RCA
+ frozen evaluation
= đồ án có thể chứng minh bằng thực nghiệm
```

Nếu tiến độ xấu, cắt Target/Stretch trước; không cắt telemetry quality, ground truth, baseline, ablation hoặc reproducibility để đổi lấy thêm LMS feature.
