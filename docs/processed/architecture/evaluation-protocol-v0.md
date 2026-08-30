# Evaluation protocol v0

> **Task:** `task-05_define-evaluation-protocol`
>
> **Trạng thái:** Review-ready artifact cho W4-T5.
>
> **Vị trí canonical khi đưa vào repository:** `docs/processed/architecture/evaluation-protocol-v0.md`
>
> **Vai trò:** Canonicalize experiment/evaluation manifest, campaign identity, split theo experiment run, train/validation/test boundary, evaluation semantics, baseline/ablation/robustness protocol và artifact lineage cho MVP. Tài liệu này không thay đổi service topology, HTTP/event contract, fault catalogue, telemetry schema, ground-truth schema hoặc RQ/metric đã chốt.

## 1. Authority và phạm vi

Tài liệu này phải được đọc cùng các artifact canonical sau:

1. `../direction/research-questions-and-metrics-v1.md` — RQ1–RQ5, phép so sánh và metric canonical.
2. `analysis-anomaly-rca-blueprint.md` — Analysis pipeline, baseline detector/RCA, feature/windowing và evaluation direction.
3. `data-ownership-and-fault-matrix-v1.md` — F1–F5, root-cause service/component, workload/fault/reset semantics.
4. `telemetry-and-ground-truth-schema-v0.md` — normalized telemetry, `TelemetryArtifactManifest`, `TelemetryQualityReport`, immutable `RunGroundTruth` và lineage full/degraded.
5. `service-catalogue-and-topology-v1.md` — service identity và topology canonical.

Khi có khác biệt về concern đã thuộc ownership của artifact trước, artifact trước có authority. W4-T5 chỉ sở hữu concern evaluation được W4-T4 giao lại.

### 1.1. W4-T5 sở hữu

- `ExperimentEvaluationManifest` và campaign identity.
- Assignment `train | validation | test` theo `run_id`.
- Candidate set service-level cho RCA evaluation.
- Quy tắc chọn/freeze feature, detector, incident, RCA và evaluation configuration.
- Variant `M`, `M+T`, `M+T+L`, severity/graph/temporal và full/degraded.
- Eligibility của run/artifact đối với một evaluation variant.
- Matching semantics giữa predicted incident và controlled-fault truth.
- Metric aggregation/reporting và artifact chain của evaluation.
- Final-test freeze và rerun rule chống leakage/cherry-picking.

### 1.2. W4-T5 không sở hữu

- Không sửa F1–F5 hoặc root-cause mapping.
- Không sửa `RunGroundTruth` đã freeze.
- Không sửa/overwrite `TelemetryArtifactManifest` hoặc telemetry artifact đã freeze.
- Không thêm fault category/dataset ngoài critical path MVP.
- Không chọn threshold/weight/hyperparameter bằng final test result.
- Không triển khai runner, detector, RCA hoặc dashboard.
- Không biến component/dependency thành primary RCA candidate.
- Không tạo composite score thay cho detection, RCA, robustness và system metrics riêng.

---

## 2. Evaluation invariants

Mọi experiment/evaluation implementation phải giữ các invariant sau:

1. **Split theo `run_id`, không split theo time window.**
2. **Một `run_id` chỉ thuộc đúng một split** trong campaign canonical.
3. `RunGroundTruth` là immutable execution/fault truth; analysis variant chỉ tham chiếu truth record.
4. Một baseline run có thể sinh nhiều analysis variant và derived telemetry artifact mà không clone/mutate truth.
5. Training chỉ fit trên dữ liệu được phép bởi split; final test chỉ dùng để báo cáo final result.
6. Mọi threshold, weight, hyperparameter, window/persistence policy, degradation config và candidate set phải freeze trước final test.
7. Primary RCA granularity là **service-level**.
8. Primary detection granularity là **incident/fault-run level**; point/window metric chỉ là diagnostic.
9. Missing telemetry phải explicit; không biến missing thành observed zero.
10. Run/artifact bị loại khỏi primary metric vẫn phải được giữ trong ledger cùng lý do.
11. So sánh RQ phải thay đổi đúng biến đang kiểm tra và giữ cố định tối đa các yếu tố còn lại.
12. RQ4 là strict paired comparison trên **cùng baseline `run_id` và cùng `RunGroundTruth`**.
13. Từ một final metric phải truy ngược được tới prediction, analysis config, telemetry artifact, quality report, baseline run, code/config, workload và fault provenance.

---

## 3. Identity model và `ExperimentEvaluationManifest`

### 3.1. Identity

Ba identity không được trộn semantic:

```text
campaign_id   = một campaign có split/config/freeze policy chung
run_id        = một execution duy nhất của workload/fault/healthy run
experiment_id = một analysis/evaluation variant cụ thể chạy trên một run
```

Một `run_id` có thể được reuse bởi nhiều `experiment_id`, ví dụ:

```text
run-f2-r02
  -> exp-rq1-m-f2-r02
  -> exp-rq1-mt-f2-r02
  -> exp-rq1-mtl-f2-r02
  -> exp-rq2-severity-f2-r02
  -> exp-rq2-graph-f2-r02
  -> exp-rq4-full-f2-r02
  -> exp-rq4-trace50-f2-r02
```

Việc reuse trên không tạo execution truth mới.

### 3.2. Logical schema

`ExperimentEvaluationManifest` v0 dùng logical fields sau. Physical representation có thể là YAML/JSON nhưng semantics phải giữ nguyên.

```text
ExperimentEvaluationManifest
- manifest_schema_version          # experiment-evaluation.v0
- protocol_version                 # evaluation-protocol.v0
- experiment_id
- campaign_id
- campaign_manifest_version
- created_at
- frozen_at                        # required với final-test experiment

# run/split provenance
- run_id
- scenario_id                      # F1..F5 hoặc null với healthy run
- repeat_index                     # theo RunGroundTruth khi có
- run_kind                         # healthy | fault
- split                            # train | validation | test
- run_ground_truth_ref             # ref tới immutable RunGroundTruth

# analysis condition
- rq_ids                           # một hoặc nhiều RQ được experiment hỗ trợ
- analysis_variant_id
- modality_variant                 # M | M+T | M+T+L
- telemetry_condition              # full | degraded
- candidate_set_version

# selected immutable telemetry
- telemetry_artifact_ids
- telemetry_quality_report_ids
- degradation_type                 # null với full
- degradation_config_version       # null với full
- degradation_seed                 # null khi không áp dụng
- degradation_parameters           # null với full

# frozen analysis config
- feature_schema_version
- feature_config_version
- detector_config_version
- incident_config_version
- rca_config_version
- evaluation_config_version
- random_seeds

# output lineage
- feature_artifact_ref
- detector_output_ref
- incident_artifact_ref
- rca_artifact_ref
- prediction_artifact_ref
- evaluation_artifact_ref

# eligibility/audit
- execution_status                 # projection từ RunGroundTruth.run_status
- telemetry_quality_status
- inclusion_status                 # eligible | excluded | diagnostic_only
- exclusion_reasons
- replacement_for_run_id           # nullable; manifest-only, không mutate truth

# implementation provenance
- analysis_code_commit
- environment_profile
- environment_config_version
```

### 3.3. Truth leakage boundary

`run_ground_truth_ref`, `scenario_id` và `repeat_index` được phép dùng cho split/provenance/evaluation stratification. Detector/RCA feature input **không được nhận**:

```text
fault_type
fault_target
fault_start/fault_end như predictive feature
root_cause_service
root_cause_component
expected_symptom
expected_propagation_path
expected_evidence
```

Evaluator được resolve các truth field từ `run_ground_truth_ref` sau prediction để tính metric. Nếu implementation dựng `ExperimentContext` đầy đủ như Analysis blueprint, stage-specific input cho detector/RCA phải loại các truth/control field khỏi feature path.

---

## 4. Candidate set và evaluation granularity

### 4.1. Candidate set service-level v0

Candidate set được freeze cho toàn bộ final campaign:

```text
auth
course
enrollment
submission
grading
notification
```

`candidate_set_version = service-candidates.v0`.

Quy tắc:

- Đây là **6 business services** của topology MVP.
- `gateway` không nằm trong candidate set vì F1–F5 không có Gateway fault; Gateway là symptom/observation point.
- Redis, PostgreSQL, Storage Mock, RabbitMQ và component như `course-redis`, `submission-storage`, `notification-consumer`, `submission-instance` là evidence/component, không nằm trong primary Top-K/MRR list.
- Candidate không được drop chỉ vì modality của candidate bị missing. Missingness phải được xử lý bằng fallback/score semantics đã version hóa.
- Mọi RCA variant phải trả cùng candidate universe để comparison không bị thay denominator.

Candidate set gồm cả business service không phải root cause trong F1–F5 hiện tại để tránh một ranking problem quá hẹp/trivial và giữ consistency với service catalogue. Ground-truth root cause của final MVP campaign vẫn chỉ theo fault matrix canonical:

```text
F1 -> course
F2 -> submission
F3 -> submission
F4 -> notification
F5 -> submission
```

### 4.2. Unit of evaluation

Primary unit:

```text
Detection: one controlled fault truth / fault run
RCA:       service ranking associated với matched incident của fault run
```

Point/window results được phép lưu để debug, threshold analysis và timeline nhưng không thay primary incident/fault-run result.

### 4.3. Unseen scenario/target policy

MVP v0 **không** làm unseen-fault-category hoặc unseen-root-cause-service holdout. F1–F5 đều được đại diện ở validation và final test bằng các execution run khác nhau.

Do đó final test đo generalization sang **unseen executions/repetitions/seeds của cùng canonical scenario family**, không tuyên bố generalization sang fault category/service chưa thấy. Unseen-scenario campaign thuộc Target/Stretch.

---

## 5. Dataset split và campaign floor

### 5.1. Split semantics

```text
train      -> fit scaler / healthy baseline / unsupervised detector parameters được phép
validation -> chọn threshold, window, persistence, weight, hyperparameter và config
              + chọn/freeze quality gate/degradation config trước final test
test       -> final metrics only
```

Không có time window của cùng `run_id` ở nhiều split.

### 5.2. Controlled fault runs

Giữ evaluation floor canonical:

```text
5 scenarios × 3 repetitions = 15 controlled fault runs
```

Assignment v0:

| Scenario | Validation | Final test |
| --- | --- | --- |
| F1 | `repeat_index=1` | `repeat_index=2,3` |
| F2 | `repeat_index=1` | `repeat_index=2,3` |
| F3 | `repeat_index=1` | `repeat_index=2,3` |
| F4 | `repeat_index=1` | `repeat_index=2,3` |
| F5 | `repeat_index=1` | `repeat_index=2,3` |

Kết quả:

```text
validation fault runs = 5
final test fault runs = 10
```

Fault runs không dùng để fit healthy scaler/baseline. Nếu một future supervised model thực sự cần fault-labeled training data, đó là protocol extension riêng; không được silently reuse validation/test fault runs làm training.

### 5.3. Healthy runs

Healthy dataset phải tách run/seed giữa ba split.

**Train coverage tối thiểu:**

```text
normal mixed traffic
submission peak healthy
grading burst healthy
healthy high-load spike
```

Mỗi profile phải có ít nhất một dedicated training run trong campaign manifest; thêm repetition/seed khi tài nguyên cho phép.

**Validation healthy coverage tối thiểu:**

```text
normal mixed traffic
healthy high-load spike
```

Các profile submission peak/grading burst có thể thêm nếu pilot cho thấy cần threshold tuning theo workload class, nhưng phải freeze trước final test.

**Final-test healthy coverage tối thiểu:**

```text
normal mixed traffic
healthy high-load spike
```

Final-test healthy run phải dùng `run_id` và workload seed chưa xuất hiện ở train/validation. Mục tiêu là đo false alarm và workload-shift behavior, không chỉ detector fit trên traffic quen thuộc.

### 5.4. Seed rule

- `run_id` không reuse.
- Workload seed của final test không reuse từ train/validation.
- Random seed của detector/degradation được lưu theo experiment.
- Cùng comparison pair/ablation dùng cùng input run set và cùng seed khi randomness không phải biến đang kiểm tra.

---

## 6. Pilot, validation và final-test freeze

### 6.1. Pilot

Pilot được phép dùng để chốt các numeric/config placeholder mà W4-T3/T4 cố ý chưa freeze, ví dụ:

- phase duration;
- workload rate;
- fault intensity;
- timeout margin;
- window size/step;
- incident persistence;
- data-quality threshold;
- trace-drop implementation sanity.

Pilot run **không** được đưa vào final metric nếu đã dùng để chọn các giá trị trên.

### 6.2. Validation

Validation được phép dùng để:

- fit/chọn threshold không học được chỉ từ healthy training;
- chọn robust-z/Isolation-Forest threshold;
- chọn detector hyperparameter;
- chọn window/persistence config trong candidate đã định nghĩa;
- tune fusion weight hoặc dùng equal weight baseline;
- tune RCA weights;
- chọn deterministic tie/fallback behavior nếu chưa freeze;
- xác nhận focused degradation condition;
- xác nhận data-quality gate khả thi.

Mọi lựa chọn phải được ghi bằng versioned config; không chọn bằng cảm tính rồi chỉ lưu kết quả cuối.

### 6.3. Final-test freeze manifest

Trước khi chạy/đọc final test result, campaign phải freeze tối thiểu:

```text
protocol_version
campaign_id + campaign_manifest_version
run slot / split assignment
workload profile + seed policy
fault/scenario config versions
phase duration/config
candidate_set_version
feature schema/config
window + step
normalization/imputation policy
all detector configs + seeds
threshold selection result
incident config + persistence/merge/recovery rule
all RCA configs + tie-break rule
modality variants
RQ4 degradation type/config/ratio/seed rule
data-quality/eligibility gates
metric definitions + tolerance rule
aggregation/reporting rule
analysis code commit
output artifact schema/version
```

`frozen_at` phải có trước final evaluation output.

### 6.4. Sau khi đã xem final test

Không được thay threshold, weight, feature, candidate set, window, incident rule, degradation ratio hoặc model selection rồi tiếp tục gọi cùng campaign là final.

Nếu phát hiện implementation bug thật sự:

1. ghi bug và affected artifact/run;
2. bump config/code/campaign manifest version phù hợp;
3. không overwrite artifact cũ;
4. rerun **toàn bộ comparison/test subset bị ảnh hưởng theo cùng rule**, không rerun chỉ case kết quả xấu;
5. final report phải nói rõ campaign/version nào là kết quả cuối.

---

## 7. Run phase và evaluation interval

Fault run giữ phase semantic từ Analysis/fault matrix:

```text
warm-up
healthy/pre-fault baseline
fault active
recovery
```

Exact duration được freeze trong versioned execution/campaign config sau pilot; W4-T5 không thay `RunGroundTruth` để chứa config selection.

### 7.1. Evaluation interval

Mỗi experiment phải resolve:

```text
evaluation_start
evaluation_end
fault_start      # fault run only, từ RunGroundTruth
fault_end        # fault run only, từ RunGroundTruth
```

- `evaluation_start` phải nằm sau warm-up exclusion và trước/equal healthy pre-fault interval bắt đầu được chấm.
- `evaluation_end` phải bao phủ recovery interval đã freeze.
- Prediction ngoài `[evaluation_start, evaluation_end]` không tính metric của run đó nhưng vẫn có thể giữ trong artifact diagnostic.
- Healthy run dùng toàn bộ eligible post-warm-up evaluation interval.

### 7.2. Window boundary

Feature windows giữ `[window_start, window_end)` và cùng alignment policy của Analysis blueprint. Online/near-real-time detection không được dùng future data ngoài window đã đóng.

---

## 8. Run/artifact eligibility và data-quality gate

### 8.1. Execution gate

Primary evaluation chỉ dùng run có:

```text
RunGroundTruth.run_status = valid
```

`invalid`/`failed` run:

- không vào primary metric;
- không bị xóa;
- vẫn có manifest/ground truth/artifact reference và exclusion reason;
- được thống kê số lượng trong final report.

### 8.2. Variant-aware telemetry gate

Eligibility dựa trên **selected artifact + `TelemetryQualityReport` của chính artifact đó**, không mutate execution truth.

| Variant | Modality bắt buộc cho primary evaluation |
| --- | --- |
| `M` | metrics |
| `M+T` | metrics + traces |
| `M+T+L` | metrics + traces + logs |
| RQ2 graph-aware | traces đủ để dựng graph theo quality rule + modality nền của detector |
| RQ3 temporal | timestamp/onset evidence theo selected modality + modality nền |
| RQ4 full | full artifact đạt gate của baseline variant |
| RQ4 trace-degraded | intentional trace degradation đúng manifest; non-degraded required modality không có accidental blocker |

### 8.3. `pass | partial | fail`

- `pass`: eligible nếu execution valid và đúng variant requirement.
- `partial`: chỉ eligible khi protocol/manifest đã khai báo rõ loại thiếu hụt là acceptable cho variant đó.
- `fail`: không vào primary metric của variant đó.

Đối với baseline/full `M`, `M+T`, `M+T+L`, unexpected missingness ở **modality required** không được silently chấp nhận chỉ vì pipeline vẫn chạy; experiment chuyển `excluded` hoặc `diagnostic_only`.

Đối với RQ4 degraded artifact, `partial` có thể là **expected** nếu lý do đúng là `filtered_by_degradation` theo transform đã freeze. Một `partial/fail` do scrape gap, unknown service identity, timestamp corruption hoặc source outage ngoài degradation vẫn không được coi là robustness condition hợp lệ.

### 8.4. Scenario-required signal

Required signal/evidence dùng fault-to-telemetry requirement của W4-T4. Optional log/runtime signal không tự trở thành blocker nếu scenario/protocol không đánh dấu required.

### 8.5. Replacement/rerun vì validity

Rerun được phép **chỉ** khi predeclared execution/data-quality gate fail, không vì detector/RCA cho metric xấu.

- rerun tạo `run_id` mới;
- original run/artifact vẫn giữ;
- manifest có thể dùng `replacement_for_run_id` để audit slot replacement;
- replacement phải giữ cùng frozen scenario/workload/fault configuration của slot, trừ phần sửa infrastructure bug đã được version hóa;
- không inspect model outcome để quyết định slot nào cần replacement.

---

## 9. Preprocessing, fitting và anti-leakage

### 9.1. Training-only fit

Chỉ healthy `train` runs được dùng để fit:

- scaler/normalization statistics;
- healthy median/MAD;
- unsupervised detector fit khi detector design dùng healthy-only training;
- imputation statistics nếu có.

Không dùng fault window/validation/test để fit healthy distribution.

### 9.2. Validation-only selection

Các giá trị sau được chọn trên validation hoặc theo deterministic baseline đã predeclare:

- anomaly threshold;
- Isolation Forest decision threshold/hyperparameter;
- modality fusion weights;
- window size/step nếu có comparison pilot/validation;
- incident persistence/merge/recovery config;
- RCA weights;
- tie/fallback rule;
- data-quality threshold;
- RQ4 degradation config.

### 9.3. Test-only reporting

Test input không được dùng để:

- select model;
- select feature;
- change threshold;
- change candidate set;
- change weight;
- change tolerance;
- change exclusion gate;
- chọn subset run đẹp hơn để report.

---

## 10. RQ1 — Multi-source telemetry protocol

### 10.1. Required variants

```text
M
M + T
M + T + L
```

`M+L` là optional diagnostic, không phải DoD v0.

### 10.2. Controlled variables

Ba variant phải giữ:

- cùng split và run set nếu artifact eligibility cho phép;
- cùng candidate set;
- cùng incident semantic;
- cùng ground truth;
- cùng metric/evaluation config;
- cùng tuning rule.

Nếu feature dimension buộc detector config khác giữa modality variants, mỗi config được tune trên **cùng validation protocol** và freeze riêng; không tune một variant trên test để cân bằng kết quả.

### 10.3. Output

Mỗi modality variant báo:

- Detection Precision/Recall/F1/FPR/Delay.
- RCA Top-1/Top-3/MRR; Average Rank bổ sung.
- Feature extraction, detector, incident, RCA runtime và artifact size khi khác biệt đáng kể.
- Eligibility/coverage count để không che việc richer modality bị mất dữ liệu nhiều hơn.

---

## 11. RQ2 — Dependency graph protocol

So sánh tối thiểu:

```text
severity-only
vs
graph-aware
```

Để isolate graph contribution:

- cùng selected telemetry artifact;
- cùng feature/detector output;
- cùng incident artifact;
- cùng candidate set;
- cùng non-graph RCA score component/config khi comparison yêu cầu;
- chỉ graph contribution/rule thay đổi.

Dynamic graph được dựng từ observed traces/edge evidence của chính run/window. Static topology chỉ dùng validation/sanity check, không thay dynamic graph trong primary comparison.

Graph-aware experiment không được đưa Redis/PostgreSQL/Storage/RabbitMQ component vào service candidate list.

---

## 12. RQ3 — Temporal protocol

Required comparison:

```text
without temporal contribution
vs
with temporal contribution
```

Baseline temporal bổ sung phải có:

```text
earliest anomaly / earliest reliable evidence
```

Để isolate temporal contribution:

- cùng run/artifact;
- cùng detector/incident result;
- cùng candidate set;
- cùng graph/evidence component khi chúng không phải biến đang kiểm tra;
- chỉ temporal contribution/tie semantics thay đổi.

`fault_start`/`fault_end` chỉ dùng sau prediction để evaluation; không dùng làm onset feature của candidate.

---

## 13. RQ4 — Robustness protocol v0

### 13.1. Focused degraded condition được chọn

MVP v0 chọn:

```text
full telemetry
vs
50% controlled trace dropping simulation
```

Canonical ID gợi ý:

```text
degradation_type: trace_drop
degradation_config_version: trace-drop.v0
drop_ratio: 0.50
granularity: whole_trace
```

Đây là **một focused condition** cho RQ4, không mở rộng thành nhiều sampling level × modality matrix.

### 13.2. Transformation semantics

- Source phải là full/baseline telemetry artifact của cùng `run_id`.
- Baseline trace collection ưu tiên 100% sampling như Analysis/T4.
- Drop ở **whole-trace granularity**, không drop random individual span làm gãy trace một cách không kiểm soát.
- Selection keep/drop phải deterministic theo `trace_id` + frozen `degradation_seed` hoặc thuật toán tương đương có reproducibility rõ.
- Metrics và logs không bị biến đổi bởi trace-drop condition.
- Derived artifact có `artifact_id` mới và bắt buộc giữ `source_artifact_id`.
- `TelemetryQualityReport` mới được sinh cho degraded artifact.
- Missingness do transform phải được ghi `filtered_by_degradation`/semantic tương đương, không giả thành source outage.
- `RunGroundTruth`, workload, fault timing, root-cause truth và execution validity giữ nguyên.

### 13.3. Pairing rule

Một RQ4 pair hợp lệ khi:

```text
same run_id
same RunGroundTruth ref
same split
same feature/window policy
same detector/incident/RCA/evaluation config
same candidate set
only telemetry trace condition differs
```

Degradation metadata/seed là khác biệt được phép.

### 13.4. F4 async fallback

Khi trace bị drop, F4 được phép dùng `event_id` + temporal relation theo W4-T4 fallback semantics. Confidence/edge evidence phải phản ánh missing trace; không synthesize trace link giả.

### 13.5. Metrics

Báo cáo cả absolute và paired delta:

```text
Detection: Precision, Recall, F1, FPR, Detection Delay
RCA:       Top-1, Top-3, MRR, Average Rank
System:    runtime/artifact size khi khác đáng kể
```

Với metric `higher is better`:

```text
delta = degraded - full
```

Với Detection Delay/Average Rank/runtime khi `lower is better`, vẫn giữ cùng phép trừ `degraded - full` nhưng report phải ghi hướng tốt/xấu để tránh đảo dấu tùy metric.

Không tạo robustness composite score.

---

## 14. RQ5 — Engineering trade-off protocol

RQ5 reuse output của RQ1–RQ4; không tạo model/metric quality mới.

Bảng trade-off tối thiểu gồm representative variants:

- metrics-only/simple detector baseline;
- multi-source telemetry variant;
- severity-only RCA;
- graph-aware và temporal-aware RCA variant;
- full vs RQ4 degraded/fallback.

Báo cáo riêng:

### Quality

- Detection Precision/Recall/F1/FPR/Delay.
- RCA Top-1/Top-3/MRR; Average Rank bổ sung.

### Analysis runtime/resource

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size.

### Instrumentation overhead

Đo trên healthy workload đã freeze bằng paired configuration phù hợp:

```text
application throughput: instrumented vs reference/no-analysis-instrumentation baseline
application p95 latency: instrumented vs reference baseline
```

Reference và instrumented condition phải giữ workload profile/seed, code/business behavior và environment tương đương; nếu instrumentation-off làm thay code path ngoài telemetry concern, limitation phải ghi rõ.

Report:

```text
throughput_change_pct = (instrumented - reference) / reference * 100
p95_latency_change_pct = (instrumented - reference) / reference * 100
```

Không gộp quality + runtime + complexity thành một utility score.

### Explainability/complexity

Explainability là checklist theo variant:

- component scores có mặt;
- evidence reference có mặt khi data cho phép;
- timeline position có mặt;
- config/version traceable;
- output machine-readable.

Complexity báo cáo định tính theo modality/component/pipeline stage/dependency/failure mode bổ sung; không tự phát minh numeric complexity score.

---

## 15. Incident matching và detection metric semantics

### 15.1. Ground-truth event

Mỗi valid F1–F5 fault run v0 có **một controlled fault truth** với:

```text
fault_start
fault_end
```

Một predicted incident chỉ được match tối đa một ground-truth fault; mỗi ground-truth fault chỉ match tối đa một predicted incident.

### 15.2. Early detection rule

V0 không cho credit detection trước fault:

```text
early_tolerance_seconds = 0
```

Predicted incident có `detected_at < fault_start` là false positive, kể cả incident đó còn open khi fault bắt đầu. Rule này tránh biến pre-fault false alarm thành TP sau khi nhìn ground truth.

### 15.3. Late tolerance do window/persistence

Late tolerance được **derive từ frozen feature/incident config**, không hand-tune trên test:

```text
late_tolerance_seconds =
    window_size_seconds
  + max(0, persistence_windows - 1) * step_seconds
```

Nếu incident implementation dùng persistence semantic khác số window liên tiếp, `evaluation_config_version` phải định nghĩa công thức tương đương trước final test.

Eligible matching interval:

```text
[fault_start, fault_end + late_tolerance_seconds]
```

Detection sau interval này không được tính TP cho fault đó.

### 15.4. Matching rule khi có nhiều incident

Trong một fault run:

1. Lọc predicted incident có `detected_at` trong eligible matching interval.
2. Sort theo `detected_at`, sau đó `incident_id` làm deterministic tie-break.
3. **Incident sớm nhất** được match với ground-truth fault và tính TP.
4. Mọi predicted incident khác trong evaluation interval không được match là FP.
5. Nếu không có incident eligible: ground-truth fault là FN.

Incident trước `fault_start`, sau late tolerance hoặc duplicate incident sau matched incident đều là FP nếu nằm trong evaluation interval.

### 15.5. Detection delay

Chỉ tính cho matched TP:

```text
Detection Delay = matched_incident.detected_at - fault_start
```

Vì early tolerance v0 = 0, delay primary không âm. FN không được gán delay giả; report `null` và denominator riêng.

### 15.6. Precision/Recall/F1

Trên final-test evaluation interval:

```text
TP = số matched predicted incidents
FP = số predicted incidents không match
FN = số valid eligible fault truths không có match

Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * Precision * Recall / (Precision + Recall)
```

Khi denominator bằng 0, artifact phải lưu `null`/undefined theo evaluation config thay vì tự quy ước `0` hoặc `1` không ghi rõ.

### 15.7. False Positive Rate

Vì primary unit là incident/run chứ không có natural TN cho từng arbitrary timestamp, **primary FPR v0 dùng healthy-run level**:

```text
healthy_run_false_positive = 1 nếu healthy run có >= 1 predicted incident trong evaluation interval
healthy_run_false_positive = 0 nếu không có predicted incident

FPR = số healthy test runs có >=1 FP incident
      / tổng số eligible healthy test runs
```

Báo cáo bổ sung để thể hiện alert volume:

```text
FP incidents per healthy hour
```

Window-level FPR có thể lưu diagnostic nhưng không thay primary healthy-run FPR.

---

## 16. RCA metric semantics

### 16.1. Ranking input

RCA metric chỉ dùng candidate list đúng `service-candidates.v0`. Ranking phải deterministic và chứa tối đa một entry cho mỗi candidate service.

Nếu score bằng nhau, dùng tie-break order canonical:

```text
auth < course < enrollment < submission < grading < notification
```

Tie-break order chỉ bảo đảm determinism, không mang semantic ưu tiên root cause.

### 16.2. Missing candidate score

Candidate không được xóa khỏi list do missing modality. Nếu variant không tính được score cho candidate, fallback/missing-score policy phải được freeze trong `rca_config_version`; missing candidate không được tự nhiên biến candidate universe nhỏ hơn.

### 16.3. Canonical RCA metrics

Trên RCA-evaluable matched incidents:

```text
Top-1 Accuracy = mean(root_cause_service ở rank 1)
Top-3 Accuracy = mean(root_cause_service ở rank <= 3)
MRR            = mean(1 / rank(root_cause_service))
Average Rank   = mean(rank(root_cause_service))
```

`root_cause_component` không tham gia primary Top-K/MRR.

### 16.4. RCA evaluability/coverage

Final report bắt buộc báo:

```text
valid_fault_runs
matched_detected_runs
rca_output_runs
rca_evaluable_runs
rca_coverage = rca_evaluable_runs / valid_fault_runs
```

Điều này tránh một RCA variant trông tốt chỉ vì bỏ các incident khó.

### 16.5. End-to-end diagnostic

Ngoài canonical RCA ranking metric, được phép báo **end-to-end diagnostic** trên toàn bộ valid fault runs:

- no matched incident/no RCA output -> Top-1 miss, Top-3 miss, reciprocal rank = 0;
- không gán fake finite rank cho Average Rank.

Diagnostic này không thay canonical Top-K/MRR; nó giúp phân biệt ranking quality với end-to-end pipeline failure.

---

## 17. System metric measurement boundaries

### 17.1. Timing

Mỗi stage timing phải dùng monotonic clock trong cùng process/job khi khả thi và ghi rõ boundary:

```text
telemetry_query_export_time
feature_extraction_time
detector_inference_time
incident_correlation_time
rca_runtime_per_incident
```

Không cộng/trừ ngầm network/storage time giữa variant; nếu một timing gồm artifact I/O, config phải ghi `includes_io=true`.

### 17.2. Peak CPU/memory

Peak CPU/memory của analysis được đo trên cùng execution environment/profile cho các variant so sánh. Measurement source/version được lưu trong evaluation/system artifact.

### 17.3. Artifact size

Artifact size tính trên immutable artifact thực tế hoặc content payload được URI trỏ tới; không chỉ tính kích thước metadata stub trong Git.

### 17.4. Runtime aggregation

Báo per-run/per-incident raw values và summary tối thiểu:

```text
count
mean
median
min
max
```

Không cần statistical significance test trong MVP v0 nếu repetition chưa đủ; raw values phải được giữ để audit.

---

## 18. Aggregation và reporting

### 18.1. Final metric source

Final headline metrics chỉ lấy từ:

```text
split = test
inclusion_status = eligible
frozen campaign/config version
```

Train/validation metric chỉ được trình bày như tuning/pilot evidence, không trộn vào final score.

### 18.2. Detection aggregation

Báo:

- pooled TP/FP/FN và Precision/Recall/F1 trên eligible final-test runs;
- healthy-run FPR;
- Detection Delay count/mean/median và per-scenario values;
- per-scenario F1/Recall/Delay khi denominator hợp lệ;
- số run excluded/invalid/partial theo reason.

### 18.3. RCA aggregation

Báo:

- Top-1, Top-3, MRR và Average Rank trên eligible RCA-evaluable final-test runs;
- per-scenario result F1–F5;
- `rca_coverage`;
- end-to-end diagnostic nếu dùng;
- candidate rank raw per run.

### 18.4. RQ4 paired aggregation

Mỗi row pair phải giữ:

```text
run_id
full_experiment_id
degraded_experiment_id
full_artifact_id
degraded_artifact_id
metric_full
metric_degraded
delta
```

Aggregate delta chỉ sau khi pair-level lineage hợp lệ. Không ghép full run A với degraded run B.

### 18.5. No hidden denominator

Mọi summary table phải ghi ít nhất:

```text
n_runs
n_incidents hoặc n_pairs phù hợp
excluded_count
config/campaign version
```

Không report một percentage mà không thể biết denominator.

---

## 19. Artifact chain và storage contract

### 19.1. Required lineage

Logical chain:

```text
RunGroundTruth (immutable execution truth)
        +
TelemetryArtifactManifest + TelemetryQualityReport
        |
        v
ExperimentEvaluationManifest
        |
        v
Feature artifact
        |
        v
Detector output
        |
        v
Incident artifact
        |
        v
RCA / prediction artifact
        |
        v
Evaluation artifact
```

Mỗi stage output phải reference upstream artifact/config đủ để reverse lookup.

### 19.2. Logical run layout compatibility

Giữ compatibility với Analysis blueprint:

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

Vì một run có nhiều variant, implementation được phép dùng variant-specific subpath/filename hoặc artifact registry, nhưng **không được overwrite** artifact đã được một `experiment_id`/evaluation tham chiếu. Physical layout là implementation detail; logical identity/lineage trong manifest là bắt buộc.

### 19.3. Large artifact

Raw telemetry/Parquet lớn có thể nằm ngoài Git. Metadata file trong repo/ledger phải giữ tối thiểu:

```text
artifact_id
run_id
format
location/URI
sha256
schema/config version
generated_at
source artifact refs
```

### 19.4. Immutability

- Không overwrite artifact ID đã dùng trong evaluation.
- Re-export/recompute vì bug tạo artifact ID/version mới.
- Derived degraded artifact luôn có source lineage.
- Final evaluation artifact phải reference exact prediction/config/artifact IDs, không reference “latest”.

---

## 20. Evaluation artifact v0

Một evaluation output tối thiểu phải biểu diễn được:

```text
EvaluationArtifact
- evaluation_artifact_id
- evaluation_schema_version
- protocol_version
- campaign_id
- campaign_manifest_version
- experiment_id
- run_id
- split
- scenario_id
- analysis_variant_id
- evaluation_config_version
- generated_at

# eligibility
- inclusion_status
- exclusion_reasons
- execution_status
- telemetry_quality_status

# detection
- matched_incident_id
- detected
- tp
- fp_incident_count
- fn
- detection_delay_seconds
- healthy_run_false_positive

# RCA
- ground_truth_service          # evaluator output only
- predicted_rank
- top1_hit
- top3_hit
- reciprocal_rank
- rca_evaluable
- rca_candidate_list_ref

# system
- timing_metrics
- resource_metrics
- artifact_size_metrics

# lineage
- run_ground_truth_ref
- telemetry_artifact_ids
- telemetry_quality_report_ids
- feature_artifact_ref
- detector_output_ref
- incident_artifact_ref
- rca_artifact_ref
- prediction_artifact_ref
- feature_config_version
- detector_config_version
- incident_config_version
- rca_config_version
- analysis_code_commit
```

`ground_truth_service` xuất hiện trong **evaluation artifact**, không trong detector/RCA feature artifact.

Campaign-level summary artifact phải reference các per-experiment evaluation artifact thay vì copy metric không có provenance.

---

## 21. Reproducibility contract

Một experiment được coi reproducible ở protocol level khi có đủ:

```text
run_id + immutable RunGroundTruth
selected telemetry artifact ID(s) + checksum/URI
TelemetryQualityReport
campaign/split assignment
feature schema/config
model/detector config + seed
incident config
RCA config + seed/tie rule
evaluation config
candidate set version
analysis code commit
environment profile/config
for degraded: source artifact + transform config + seed + parameters
```

Cùng immutable input + cùng config/seed phải tạo output tương đương deterministic trong tolerance của runtime/library. Nếu library có nondeterminism không loại bỏ được, phải ghi rõ và không giả tuyên bố bit-for-bit reproducibility.

---

## 22. Minimal campaign execution order

Đây là **protocol dependency order**, không phải implementation backlog priority:

```text
1. Pilot execution/config sanity
2. Freeze execution/scenario parameters đủ để tạo clean dataset
3. Collect healthy training runs
4. Fit training-only preprocessing/detector state
5. Run validation set và chọn/freeze analysis configs
6. Freeze final-test campaign manifest
7. Execute/select eligible final-test runs theo predeclared gate
8. Run frozen analysis variants
9. Produce immutable per-experiment evaluation artifacts
10. Aggregate RQ1–RQ5 từ final-test artifacts
11. Preserve excluded/invalid run ledger và failure analysis
```

Không được quay từ bước 8/9 về bước 5 chỉ vì final metric thấp mà vẫn giữ cùng final campaign identity.

---

## 23. Feasibility checklist cho collaborator review

Artifact này không tự coi collaborator review là hoàn tất. Đức cần xác nhận tối thiểu:

| Concern | Điều cần xác nhận |
| --- | --- |
| Run identity/split | Runner sinh unique `run_id`, `repeat_index`, workload seed và giữ assignment validation/test ổn định được. |
| Ground truth | `fault_start/end`, activation/deactivation/reset/verification và root-cause truth được lưu trước evaluation, không phụ thuộc model output. |
| Artifact lineage | Mỗi telemetry/derived artifact có immutable ID/location/checksum và quality report; một run có thể reference nhiều variant không overwrite nhau. |
| Healthy runs | Có thể chạy dedicated healthy training/validation/test với seed tách biệt, gồm normal và healthy high-load tối thiểu. |
| Fault floor | F1–F5 × 3 repetitions có thể orchestration với repeat 1 validation, repeat 2–3 final test. |
| Quality gate | Runner/exporter có đủ phase coverage/required signal metadata để classify pass/partial/fail theo variant. |
| RQ1 | Có thể materialize/select `M`, `M+T`, `M+T+L` từ cùng run lineage. |
| RQ2 | Trace artifact đủ dựng dynamic service graph; same incident output có thể reuse cho severity/graph comparison. |
| RQ3 | UTC timestamp/onset đủ ổn định để temporal comparison và delay calculation. |
| RQ4 | Có thể tạo whole-trace 50% drop derived artifact reproducibly, giữ source lineage/seed và không mutate truth. |
| System metrics | Analysis timing/CPU/memory/artifact size và application throughput/p95 có đường đo khả thi. |
| Rerun | Invalid/quality-failed run có thể rerun bằng run ID mới trong khi original ledger vẫn giữ. |

Nếu một requirement không khả thi trong Compose/runner dự kiến, cần ghi finding và điều chỉnh **evaluation implementation/config trong boundary của T5**. Không tự sửa RQ, fault catalogue, topology hoặc T4 truth/telemetry schema để né limitation.

---

## 24. DoD checkpoint — W4-T5

| Definition of Done | Trạng thái substantive | Bằng chứng |
| --- | --- | --- |
| Experiment manifest/metadata, run artifact, split theo run và freeze test campaign | **Đạt trong protocol** | Mục 3, 5, 6, 19–22 |
| Detection, RCA service-level và system metrics phù hợp RQ/AI-RCA blueprint | **Đạt trong protocol** | Mục 10–18, 20 |
| Baseline/ablation/robustness MVP | **Đạt trong protocol** | Mục 10–14 |
| Ground-truth input, missing data/modality và reproducibility | **Đạt trong protocol** | Mục 3, 8, 9, 13, 19–21 |
| Không train/tune trên final test | **Đạt trong protocol** | Mục 5–6, 9, 18 |
| Không mutation ngược W4-T4 | **Đạt trong protocol** | Mục 1–3, 8, 19 |
| Đức review orchestration/lưu artifact | **Chưa xác nhận** | Mục 23 — collaborator review theo workflow task |

---

## 25. Những giá trị còn nằm ở pilot/versioned config, không phải schema gap

Protocol đã chốt **cách chọn, nơi lưu và freeze** nhưng không hard-code các numeric execution value chưa có bằng chứng pilot:

- exact phase duration;
- exact workload rate/stage duration;
- exact fault intensity/delay/CPU parameter;
- exact dependency timeout millisecond;
- exact scrape interval/data-quality numeric threshold;
- exact window size nếu validation chọn khác initial `60s/15s`;
- exact persistence window count;
- exact detector threshold/hyperparameter;
- exact fusion/RCA weight.

Các giá trị này phải được chọn đúng train/validation rule, lưu trong versioned config và xuất hiện trong frozen final campaign manifest. Việc chưa hard-code numeric trước pilot **không** cho phép thay chúng sau khi đã xem final test.

RQ4 là ngoại lệ đã được protocol v0 freeze ở mức comparison design: **whole-trace 50% controlled drop**, với exact deterministic seed/value được ghi trong campaign/degradation config trước final test.

---

## 26. Kết luận v0

Evaluation protocol v0 giữ nguyên các quyết định đã merge và đóng các boundary còn để lại cho W4-T5:

- split theo experiment run;
- healthy training / validation / final-test boundary chống leakage;
- F1–F5 repetition assignment;
- service-level candidate set cố định;
- incident matching/tolerance và healthy-run FPR semantics;
- canonical RCA metric denominator/coverage;
- RQ1–RQ3 ablation controls;
- RQ4 strict paired whole-trace 50% degradation từ cùng baseline artifact;
- RQ5 system/trade-off reporting;
- immutable experiment/evaluation artifact lineage;
- test campaign freeze và validity-only rerun rule.

Không có requirement nào trong protocol này yêu cầu đổi service topology, ownership, HTTP/event contract, fault semantics, telemetry schema hoặc `RunGroundTruth` của W4-T1–W4-T4.
