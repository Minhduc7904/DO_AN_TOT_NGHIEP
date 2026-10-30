# Evaluation protocol v1

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review). Tài liệu thiết kế: chưa có dataset, RCA engine, fault injector hay workload k6 chạy theo protocol này; mọi con số đo ghi trong tài liệu đều lấy từ các artifact đã có (mục 1.3).
>
> **Thay thế:** [evaluation-protocol-v0](evaluation-protocol-v0.md) (giữ làm lịch sử, không dùng cho dataset mới). V0 gắn với topology v1 (6 business service, fault F1–F5); khung đánh giá (split theo `run_id`, freeze, Top-K/MRR, ablation, robustness, lineage) được giữ, phần gắn kiến trúc được viết lại theo topology v2.
>
> **Phụ thuộc:** [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) (AI là bên truy vết chính, đối chứng thủ công, thời gian chẩn đoán), [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) (11 `service.name`, dependency identity, workflow W1–W7), [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) (fault FA–FH), [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) (case C1–C7, tín hiệu có thật/chưa có, `RcaIncidentResult` ở mục 5), [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md) (`RunGroundTruth`, `TelemetryArtifactManifest`, `TelemetryQualityReport`; viết song song, tài liệu này chỉ tham chiếu tên artifact và không phụ thuộc vào tên trường chi tiết), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md) (cạnh xác thực).
>
> **Vai trò:** Canonicalize experiment/evaluation manifest, campaign identity, split theo experiment run, train/validation/test boundary, evaluation semantics, baseline/ablation/robustness protocol, đối chứng thủ công và artifact lineage cho RCA engine trên LMS testbed v2. Tài liệu này không thay đổi topology, contract, fault matrix, telemetry schema, ground-truth schema, schema `RcaIncidentResult` hoặc RQ/metric đã chốt.

## 1. Authority và phạm vi

Tài liệu này phải được đọc cùng các artifact sau:

1. [../direction/research-questions-and-metrics-v2.md](../direction/research-questions-and-metrics-v2.md) — RQ, phép so sánh và metric canonical (bản v2, đã căn theo topology v2 và tài liệu này).
2. [backend-microservice-testbed-blueprint-v2.md](backend-microservice-testbed-blueprint-v2.md) — execution/orchestration manifest, `experiment_id`, `run_id`, scenario, reproducibility (bản v2, theo topology v2).
3. [analysis-anomaly-rca-blueprint-v1.md](analysis-anomaly-rca-blueprint-v1.md) — pipeline Analysis, baseline detector/RCA, feature/windowing (bản v1, vai trò RCA engine là bên truy vết chính theo ADR-002).
4. [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) — fault FA–FH, root-cause service/component.
5. [complex-case-catalogue-and-rca-result-v0](complex-case-catalogue-and-rca-result-v0.md) — case C1–C7, ground truth theo case, tín hiệu, trạng thái kiểm chứng, `RcaIncidentResult`.
6. [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md) — normalized telemetry, `TelemetryArtifactManifest`, `TelemetryQualityReport`, immutable `RunGroundTruth`, lineage full/degraded.
7. [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) — service identity, dependency identity, edge, workflow.

Khi có khác biệt về concern đã thuộc ownership của artifact trước, artifact trước có authority. Backend blueprint sở hữu semantic execution/orchestration của `experiment_id`, `run_id`, `scenario_id` và `repeat_index`; tài liệu này chỉ reference/bổ sung các identity đó cho evaluation.

### 1.1. Tài liệu này sở hữu

- `EvaluationInstanceManifest`, campaign identity và provenance của evaluation instance.
- Assignment `train | validation | test` theo `run_id`.
- Candidate set service-level cho RCA evaluation.
- Điều kiện để một case C1–C7 được vào campaign và floor số run.
- Quy tắc chọn/freeze feature, detector, incident, RCA và evaluation configuration.
- Variant `M`, `M+T`, `M+T+L`, severity/graph/temporal và full/degraded.
- Đối chứng thủ công: baseline thủ công tự động, thử nghiệm người, đo thời gian chẩn đoán (ADR-002).
- Cách chấm `RcaIncidentResult` (mục 16).
- Eligibility của run/artifact đối với một evaluation variant.
- Matching semantics giữa predicted incident và controlled-fault truth.
- Metric aggregation/reporting và artifact chain của evaluation.
- Final-test freeze và rerun rule chống leakage/cherry-picking.

### 1.2. Tài liệu này không sở hữu

- Không sửa FA–FH, C1–C7 hoặc root-cause mapping.
- Không sửa `RunGroundTruth` đã freeze.
- Không sửa/overwrite `TelemetryArtifactManifest` hoặc telemetry artifact đã freeze.
- Không sửa schema `RcaIncidentResult` hoặc nơi lưu (thuộc catalogue mục 5); chỉ quy định cách chấm.
- Không thêm fault category/dataset ngoài critical path.
- Không chọn threshold/weight/hyperparameter bằng final test result.
- Không triển khai runner, fault injector, workload k6, detector, RCA engine, MCP hay dashboard.
- Không biến component/dependency thành primary RCA candidate.
- Không tạo composite score thay cho detection, RCA, robustness, thời gian chẩn đoán và system metrics riêng.

### 1.3. Hiện trạng: đã đo thật và dự kiến

Bảng này tách điều đã có bằng chứng khỏi điều mới là thiết kế. Bất kỳ con số nào ở các mục sau không nằm trong cột "Đã có" đều là giá trị đề xuất hoặc thừa kế từ v0 và phải được pilot/Đức xác nhận.

| Hạng mục | Đã có (bằng chứng) | Chưa có (dự kiến, chưa kiểm chứng) |
| --- | --- | --- |
| Topology | 11 runtime (7 service + 4 worker) chạy bằng `compose.full.yaml`; 11 `service.name` canonical ([catalogue mục 2.1](service-catalogue-and-topology-v2.md)) | — |
| Telemetry | 9/9 luồng xuyên service có trace đủ service; 11/11 runtime có RED, CPU, RSS và log; 38 cạnh dependency; 24 queue ([catalogue case mục 4.1](complex-case-catalogue-and-rca-result-v0.md)); lệnh lặp lại `pnpm run test:observability` | Pool kết nối PostgreSQL, tuổi message cũ nhất, metric publish/consume RabbitMQ ở runtime, độ trễ outbox, log consumer của worker, nối scheduler → scheduler-worker ([catalogue case mục 1.5](complex-case-catalogue-and-rca-result-v0.md)) |
| Độ trễ thu thập | Log vào Loki ≈ 2 giây, trace vào Tempo ≈ 2,5 giây, counter vào Prometheus ≈ 4–10 giây, backlog queue ≈ 9 giây (catalogue case mục 1.4) | — |
| Case C1–C7 | C6: **đã chạy** bởi [tracing-smoke](../../../lms/test/observability/tracing-smoke.mjs) (login 504 ngay, token còn hạn vẫn 200, lỗi `gateway-identity-token` sau **70–74 giây** với TTL 60 giây, phục hồi sau `unpause`). C1–C5, C7: **đã đo tín hiệu**, cơ chế gây lỗi **chưa chạy** | Fault injector (`aiops-platform/faults/`), workload k6 (`aiops-platform/load/`): thư mục chưa tồn tại. Chuỗi lan C1 sang `media-worker` là **giả thuyết** |
| Dữ liệu | Seeder R-10 ghi trực tiếp SQL, id bắt đầu bằng `5eed`, không tạo trace/log nghiệp vụ ([fault matrix mục 2.9](data-ownership-and-fault-matrix-v2.md)) | Dataset fault run, healthy run, split, ground truth theo run: chưa có |
| RCA engine, training, MCP | Schema `RcaIncidentResult` và nơi lưu đề xuất (catalogue case mục 5) | `aiops-platform/training/`, `aiops-platform/mcp/` chưa tồn tại; chưa có kết quả Top-K/MRR/Delay nào |
| Đối chứng thủ công | Quyết định ở ADR-002 mục 3–4 | Baseline thủ công tự động và thử nghiệm người chưa làm; chưa có thời gian chẩn đoán nào |
| Retention | Prometheus, Tempo, Loki giữ 24 giờ ([observability README](../../../aiops-platform/observability/README.md)) | Cách lưu/phát lại telemetry của một run ngoài 24 giờ: chưa kiểm chứng |

---

## 2. Evaluation invariants

Mọi experiment/evaluation implementation phải giữ các invariant sau:

1. **Split theo `run_id`, không split theo time window.**
2. **Một `run_id` chỉ thuộc đúng một split** trong campaign canonical.
3. `RunGroundTruth` là immutable execution/fault truth; analysis variant chỉ tham chiếu truth record.
4. Một baseline run có thể sinh nhiều analysis variant và derived telemetry artifact mà không clone/mutate truth.
5. Training chỉ fit trên dữ liệu được phép bởi split; final test chỉ dùng để báo cáo final result.
6. Mọi threshold, weight, hyperparameter, window/persistence policy, degradation config, candidate set và luật của baseline thủ công phải freeze trước final test.
7. Primary RCA granularity là **service-level** (`service.name`).
8. Primary detection granularity là **incident/fault-run level**; point/window metric chỉ là diagnostic.
9. Missing telemetry phải explicit; không biến missing thành observed zero. Đặc biệt với v2: thiếu gauge queue không có nghĩa là 0 message ([observability README](../../../aiops-platform/observability/README.md)).
10. Run/artifact bị loại khỏi primary metric vẫn phải được giữ trong ledger cùng lý do.
11. So sánh RQ phải thay đổi đúng biến đang kiểm tra và giữ cố định tối đa các yếu tố còn lại.
12. RQ4 là strict paired comparison trên **cùng baseline `run_id` và cùng `RunGroundTruth`**.
13. Từ một final metric phải truy ngược được tới prediction (`RcaIncidentResult`), analysis config, telemetry artifact, quality report, baseline run, code/config, workload và fault provenance.
14. **Đối chứng thủ công dùng đúng run, đúng candidate set và đúng ground truth như AI** (so sánh ghép cặp theo `run_id`); không so AI trên run này với thủ công trên run khác.
15. **Người tham gia và baseline thủ công không được đọc ground truth, `fault_type`, danh mục case hay cấu hình injector**; ground truth chỉ được evaluator mở sau khi đáp án đã nộp (ADR-002: công cụ đọc đáp án chỉ bật khi đánh giá offline).
16. Case chỉ **đã đo tín hiệu** hoặc **giả thuyết** không được báo cáo như case đã kiểm chứng; mọi báo cáo phải nêu rõ trạng thái kiểm chứng của từng case (mục 4.2).

---

## 3. Identity model và `EvaluationInstanceManifest`

### 3.1. Identity

Các identity sau không được trộn semantic:

```text
experiment_id          = experiment/execution family theo Backend blueprint
run_id                 = một concrete execution duy nhất của family đó
scenario_id            = scenario canonical từ RunGroundTruth; fault ID FA–FH hoặc healthy scenario ID
case_id                = C1–C7; projection của evaluation manifest từ bảng 4.2, null với healthy run và fault không có case (FF)
repeat_index           = repetition canonical từ RunGroundTruth trong scenario/workload tương ứng
analysis_variant_id    = điều kiện evaluation/ablation, ví dụ rq1-m, rq2-graph, rq4-trace50, base-manual-auto
evaluation_instance_id = một evaluation instance duy nhất của một analysis variant trên một run
campaign_id            = logical evaluation campaign có split/config/freeze policy chung
```

`experiment_id`, `run_id`, `scenario_id` và `repeat_index` giữ nguyên semantic canonical của Backend blueprint và `RunGroundTruth`. `case_id` không đòi hỏi trường mới trong `RunGroundTruth`: nó được suy ra từ `scenario_id` theo bảng 4.2. Một `run_id` có thể được reuse bởi nhiều `evaluation_instance_id`, ví dụ (tên `experiment_id`/`run_id` chỉ minh họa, định dạng thật do Backend blueprint và schema v1 quy định):

```text
experiment_id = exp-fb-notification-backlog
run_id        = exp-fb-notification-backlog-r03

run_id
  -> evaluation_instance_id cho analysis_variant_id=rq1-m
  -> evaluation_instance_id cho analysis_variant_id=rq1-mt
  -> evaluation_instance_id cho analysis_variant_id=rq1-mtl
  -> evaluation_instance_id cho analysis_variant_id=rq2-severity
  -> evaluation_instance_id cho analysis_variant_id=rq2-graph
  -> evaluation_instance_id cho analysis_variant_id=rq4-full
  -> evaluation_instance_id cho analysis_variant_id=rq4-trace50
  -> evaluation_instance_id cho analysis_variant_id=base-manual-auto
```

Việc reuse trên không tạo execution truth mới và không redefine execution/orchestration manifest. Thử nghiệm người (mục 15.3) không phải evaluation instance của pipeline; nó có bản ghi riêng nhưng tham chiếu cùng `run_id`.

### 3.2. Logical schema

`EvaluationInstanceManifest` v1 reference/bổ sung execution/orchestration manifest hiện có; nó không thay thế và không redefine semantic của `experiment_id`, `run_id`, `scenario_id` hoặc `repeat_index`. Physical representation có thể là YAML/JSON nhưng semantics phải giữ nguyên.

```text
EvaluationInstanceManifest
- manifest_schema_version          # evaluation-instance.v1
- protocol_version                 # evaluation-protocol.v1
- evaluation_instance_id
- experiment_id                    # reference execution family canonical
- campaign_id
- campaign_manifest_version
- created_at
- frozen_at                        # required với final-test evaluation instance

# run/split provenance
- run_id                           # reference concrete execution canonical
- scenario_id                      # required; projection từ RunGroundTruth: FA..FH hoặc healthy scenario ID
- case_id                          # nullable; C1..C7 theo bảng 4.2
- case_verification_status         # run | signals_measured | hypothesis; trạng thái của case tại thời điểm freeze
- repeat_index                     # required; projection từ RunGroundTruth
- run_kind                         # healthy | fault; derived/projection, không thay scenario_id
- split                            # train | validation | test
- run_ground_truth_ref             # ref tới immutable RunGroundTruth

# analysis condition
- rq_ids                           # một hoặc nhiều RQ được experiment hỗ trợ
- analysis_variant_id
- analyst_kind                     # rca_engine | manual_baseline_auto | constant_ranking_reference
- modality_variant                 # M | M+T | M+T+L
- telemetry_condition              # full | degraded
- candidate_set_version            # service-candidates.v1

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
- noise_filter_version             # luật lọc trace /ready, trace thăm dò scheduler-worker (mục 8.5)
- detector_config_version
- incident_config_version
- rca_config_version               # với manual_baseline_auto: phiên bản luật baseline
- evaluation_config_version
- rca_result_schema_version        # phiên bản RcaIncidentResult được chấm (hiện "0")
- random_seeds

# output lineage
- feature_artifact_ref
- detector_output_ref
- incident_artifact_ref
- rca_artifact_ref
- prediction_artifact_ref          # tham chiếu RcaIncidentResult (file JSON + sha256)
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

`EvaluationInstanceManifest` chỉ bổ sung evaluation provenance trên execution/orchestration manifest và immutable `RunGroundTruth`; nó không tạo identity execution thay thế. `run_ground_truth_ref`, `scenario_id`, `case_id` và `repeat_index` được phép dùng cho split/provenance/evaluation stratification. Detector/RCA feature input và baseline thủ công **không được nhận**:

```text
fault_type
fault_target
fault_start/fault_end như predictive feature
root_cause_service
root_cause_component
expected_symptom
expected_propagation_path
expected_evidence
scenario_id / case_id
```

`scenario_id` và `case_id` bị loại khỏi feature path vì chúng tiết lộ fault. Evaluator được resolve các truth field từ `run_ground_truth_ref` sau prediction để tính metric. Nếu implementation dựng `ExperimentContext` đầy đủ như Analysis blueprint, stage-specific input cho detector/RCA phải loại các truth/control field khỏi feature path. Trường `run_id` trong `RcaIncidentResult` được dùng để đối chiếu sau, không làm feature.

Hệ quả cho dữ liệu v2: tên service, route, queue có trong telemetry (ví dụ queue `notification-worker--*`) không phải truth field, nhưng **tên experiment/run id không được xuất hiện trong telemetry mà RCA engine hoặc người tham gia đọc** (ví dụ không đặt `run_id` hay tên fault vào header/baggage/label). Ground truth không đưa vào payload nghiệp vụ (fault matrix v2 mục 5).

---

## 4. Candidate set và evaluation granularity

### 4.1. Candidate set service-level v1

Candidate set được freeze cho toàn bộ final campaign, theo thứ tự canonical của [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md) mục 8:

```text
identity
course
media
media-worker
notification
notification-worker
scheduler
scheduler-worker
ai
ai-worker
```

`candidate_set_version = service-candidates.v1`.

Quy tắc:

- Đây là **10 trong 11 `service.name` canonical** của topology v2. `gateway` là điểm quan sát triệu chứng (symptom) mặc định và **không** nằm trong candidate set, vì không fault nào trong FA–FH có root cause ở `gateway` (catalogue mục 8: gateway chỉ là candidate khi evaluation protocol có gateway fault). Nếu về sau thêm gateway fault, phải bump `candidate_set_version` và thêm `gateway` cho cả campaign. **Đề xuất chờ Đức xác nhận:** brief ban đầu của task ghi "candidate = toàn bộ `service.name`"; tài liệu này dùng 10 (sau R-13: `auth` + `student` → `identity`) vì catalogue v2 mục 8 nói rõ gateway không phải candidate khi chưa có gateway fault. Nếu Đức muốn đưa gateway vào candidate universe, chỉ cần sửa tập này và tie-break ở mục 18.1.
- Worker là candidate **riêng** với service cùng owner (`media` khác `media-worker`, `notification` khác `notification-worker`, `ai` khác `ai-worker`, `scheduler` khác `scheduler-worker`) vì có `service.name` riêng để Analysis phân biệt nguồn triệu chứng (catalogue mục 4, ownership rule 7).
- PostgreSQL (6 identity `<service>-postgres`), RabbitMQ (`*-rabbitmq`), MinIO (`media-minio`), SMTP (`notification-smtp`), LLM provider (`ai-llm-provider`) và cạnh xác thực (`<caller>-identity-token`, `<caller>-identity-jwks`) là **evidence/component**, không nằm trong primary Top-K/MRR list.
- Candidate không được drop chỉ vì modality của candidate bị missing. Missingness phải được xử lý bằng fallback/score semantics đã version hóa.
- Mọi RCA variant (và baseline thủ công) phải trả cùng candidate universe để comparison không bị thay denominator.

Quy ước đọc telemetry ảnh hưởng tới việc chấm (catalogue case mục 2): span PRODUCER thuộc tiến trình relay chứ không nhất thiết thuộc service ghi command; queue thuộc worker tiêu thụ (`service_name` của metric broker là tiền tố trước `--`); triệu chứng lỗi xác thực nằm ở cạnh `<service>-identity-token` của bên gọi. Evaluator chấm theo `root_cause_service` của `RunGroundTruth`, **không** theo `service.name` của span nơi triệu chứng xuất hiện.

### 4.2. Fault, case và ground truth

Ground truth root cause của campaign chỉ theo fault matrix/catalogue canonical. Cột "Trạng thái" lấy nguyên từ [catalogue case mục 3](complex-case-catalogue-and-rca-result-v0.md); **không** đồng nghĩa case đã đủ điều kiện vào campaign (xem mục 5.2).

| Case | Fault | `fault_type` | `root_cause_service` | `root_cause_component` | Triệu chứng chính | Trạng thái kiểm chứng |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | FB | `queue_backlog` | `notification-worker` | `notification-worker-rabbitmq` | `upload-complete` của `media` chậm/timeout | **Đã đo tín hiệu**; chuỗi lan sang `media-worker` là **giả thuyết** |
| C2 | FC | `db_connection_hold` | `course` | `course-postgres` | enroll/quiz submit chậm, không span lỗi | **Đã đo tín hiệu**; metric pool chưa có |
| C3 | FD | `dependency_latency` | `ai` | `ai-llm-provider` | job AI mãi `RUNNING` rồi `WORKER_INTERRUPTED`, tài liệu `EXTRACTING` | **Đã đo tín hiệu**; stub chậm chưa chạy |
| C4 | FA | `dependency_latency` | `media` | `media-minio` | media `PENDING` kẹt, thumbnail mất, cleanup xóa media | **Đã đo tín hiệu**; cơ chế chèn trễ chưa chạy |
| C5 | FE | `dependency_latency` | `identity` | `identity-postgres` | batch `PARTIAL_FAILED`, số item lệch | **Đã đo tín hiệu**; chèn trễ chưa chạy |
| C6 | FG | `dependency_unavailable` | `identity` | `identity` | mọi route qua gateway lỗi 504 sau khoảng yên lặng | **Đã chạy** (tracing-smoke, 70–74 giây với TTL 60 giây) |
| C7 | FH | `config_drift` | `identity` | `identity-jwks` | 401 đồng loạt ở nhiều service | **Đã đo tín hiệu**; cơ chế đổi khóa chưa chạy |
| — | FF | quá tải tài nguyên | bất kỳ service | instance | latency/error lan theo dependency | Không có case riêng; CPU/RSS là bằng chứng phụ cho C1–C2 |

Ghi chú nguồn:

- Catalogue case (R-12) chốt chi tiết ma trận fault v0 ở fault matrix v2; hai tài liệu khác nhau ở: component của FB (`notification-worker-rabbitmq` ở catalogue, `notification-rabbitmq` ở fault matrix v2), triệu chứng của C6/FG (504 ngay tại gateway ở catalogue, đã đo; 503 và "≤ 10 phút" ở fault matrix v2, đề xuất ban đầu), và C7/FH chỉ có đầy đủ ở catalogue. Tài liệu này dùng catalogue (số đo thật). `RunGroundTruth` của schema v1 quyết định giá trị cuối cùng của `root_cause_component`; component không tham gia primary metric.
- FA (`media` / `media-worker`) và FD (`ai` / process `ai-worker`) có hai process cùng owner. Catalogue ghi `root_cause_service` là service owner. Primary metric chấm **đúng `root_cause_service` của `RunGroundTruth`**. Để không phạt oan khi engine chỉ ra worker thay vì service cùng owner, báo cáo thêm **owner-level Top-K** (gộp `X` và `X-worker` thành một owner) như diagnostic phụ, không thay primary metric. **Đề xuất chờ Đức xác nhận.**
- Phân bố root cause của bảy case: `notification-worker`, `course`, `ai`, `media`, `identity`, `identity`, `identity` — năm service khác nhau trên tổng 10 candidate, `identity` xuất hiện ba lần (C5, C6, C7; trước R-13 là `student` một lần và `auth` hai lần). Ba case này khác nhau ở `component` (`identity-postgres`, tiến trình `identity`, `identity-jwks`) nhưng cùng `root_cause_service`, nên primary metric service-level không phân biệt được chúng; phần phân biệt chỉ là diagnostic.
- FF không có case: không vào floor. Nếu Đức muốn thêm case quá tải tài nguyên làm case đánh giá thì cần bổ sung vào catalogue trước, rồi bump `campaign_manifest_version`.

### 4.3. Unit of evaluation

Primary unit:

```text
Detection: one controlled fault truth / fault run
RCA:       service ranking (RcaIncidentResult.ranking) associated với matched incident của fault run
```

Point/window results được phép lưu để debug, threshold analysis và timeline nhưng không thay primary incident/fault-run result.

### 4.4. Unseen scenario/target policy

Protocol v1 **không** làm unseen-fault-category hoặc unseen-root-cause-service holdout. Mọi case được vào campaign phải có mặt ở cả validation và final test bằng các execution run khác nhau (mục 5.3).

Do đó final test đo generalization sang **unseen executions/repetitions/seeds của cùng canonical case**, không tuyên bố generalization sang fault category/service chưa thấy. Unseen-scenario campaign thuộc Target/Stretch.

---

## 5. Dataset split và campaign floor

### 5.1. Split semantics

```text
train      -> fit scaler / healthy baseline / unsupervised detector parameters được phép
validation -> chọn threshold, window, persistence, weight, hyperparameter và config
              + chọn/freeze quality gate/degradation config trước final test
              + chọn/freeze luật baseline thủ công tự động trước final test
test       -> final metrics only
```

Không có time window của cùng `run_id` ở nhiều split.

### 5.2. Điều kiện để một case vào campaign

V0 đặt floor theo năm fault đã có cơ chế. Ở v2 chỉ C6 đã chạy và mới ở mức smoke (một lần, không phải dataset run); sáu case còn lại mới đo tín hiệu. Vì vậy floor **không** được viết như một con số cố định cho bảy case. Một case C1–C7 chỉ được đưa vào campaign khi thỏa **đủ** các điều kiện sau, được ghi trong `campaign_manifest`:

1. **Fault injector chạy được và tái lập được:** bật/tắt được, có `fault_start`/`fault_end`/reset, không đổi code nghiệp vụ (fault matrix v2 mục 5). Hiện chưa có injector cho C1–C5, C7.
2. **Triệu chứng ngoài đường request của nguyên nhân quan sát được thật trong pilot** (ADR-002 mục 5, tiêu chí case phức tạp). Nếu pilot cho thấy triệu chứng không lan ra ngoài root cause (ví dụ chuỗi C1 sang `media-worker` không xảy ra do mỗi worker có queue riêng), case phải được mô tả lại thành đúng cái đo được, ghi `case_verification_status`, hoặc bị loại khỏi nhóm "case phức tạp"; không được giữ nguyên mô tả giả thuyết.
3. **Tín hiệu bắt buộc theo bảng 8.4 có mặt** trong telemetry của pilot, hoặc giới hạn đã được ghi là limitation của case (ví dụ C2 không phân biệt được "pool cạn" với "DB chậm").
4. **Có ground truth `RunGroundTruth` hợp lệ** theo schema v1.
5. **Pilot đã chạy** và phase duration, cường độ fault, độ trễ lan truyền đã được đo và freeze (mục 6.1, 7.3).

Case không đủ điều kiện ở thời điểm freeze được giữ trong ledger với lý do, không bị xóa, và báo cáo cuối nêu rõ tập case thực sự đã đánh giá.

### 5.3. Controlled fault runs

Cấu trúc split được giữ từ v0, tham số hóa theo số case thực sự vào campaign:

```text
K = số case đủ điều kiện ở mục 5.2
R = số repetition mỗi case
fault runs = K × R
```

Assignment (giữ rule v0: repetition đầu cho validation, phần còn lại cho final test):

| Case | Validation | Final test |
| --- | --- | --- |
| mỗi case trong K | `repeat_index=1` | `repeat_index=2..R` |

**Đề xuất chờ Đức xác nhận:** `R = 3`, thừa kế từ v0 (floor v0 là `5 × 3 = 15` với 1 validation + 2 test mỗi scenario); không có bằng chứng v2 nào cho một giá trị khác. Với `R = 3`:

```text
K = 7 (nếu cả bảy case đủ điều kiện) -> 21 fault runs: 7 validation, 14 final test
K = 1 (chỉ C6, hiện trạng) -> 3 fault runs: 1 validation, 2 final test
```

Hai dòng trên là số học từ đề xuất, không phải số đo. `K` tối thiểu để kết luận được về RQ/ADR-002 **chưa chốt** (Đức quyết định); mọi báo cáo phải ghi `K`, danh sách case và `R` thực tế. Mỗi case chỉ có `R − 1` run final test nên mọi per-case metric có denominator rất nhỏ; v1 không dùng kiểm định ý nghĩa thống kê và không suy diễn từ một run (mục 19.4).

Fault runs không dùng để fit healthy scaler/baseline. Nếu một future supervised model thực sự cần fault-labeled training data, đó là protocol extension riêng; không được silently reuse validation/test fault runs làm training. Các mô hình ML được dùng làm phần chính của đề tài (ADR-002 mục 1) nếu cần fault-labeled data thì thuộc extension này.

### 5.4. Healthy runs

Healthy dataset phải tách run/seed giữa ba split. Workload k6 chưa có; các profile dưới đây là **đề xuất** theo workflow W1–W7 ([catalogue mục 7](service-catalogue-and-topology-v2.md)), thay cho các profile v1 (submission peak, grading burst). Profile phải chạy cùng tập dữ liệu seed (mục 5.5).

| Profile healthy (đề xuất) | Luồng | Lý do |
| --- | --- | --- |
| normal mixed traffic | đăng nhập (W1), soạn khóa học (W2), ghi danh/học (W3), upload media (W4), thông báo (W5), soạn bài AI (W6), dọn media (W7) hỗn hợp | tải nền cho mọi case (ADR-002: mọi case chạy song song k6) |
| healthy high-load spike | tăng tải W1–W4 | đo false alarm khi tải tăng |
| notification batch lớn healthy | W5 với batch lớn không có fault | đối chứng cho C1: detector không được học "batch lớn = bất thường" |
| upload media peak healthy | W4 tải cao không có fault | đối chứng cho C4 |
| AI job healthy | W6 với LLM stub nhanh | đối chứng cho C3 |

**Train coverage tối thiểu:** mỗi profile có ít nhất một dedicated training run trong campaign manifest (thừa kế quy tắc v0); thêm repetition/seed khi tài nguyên cho phép.

**Validation healthy coverage tối thiểu:** `normal mixed traffic` và `healthy high-load spike`. Các profile còn lại có thể thêm nếu pilot cho thấy cần threshold tuning theo workload class, nhưng phải freeze trước final test.

**Final-test healthy coverage tối thiểu:** `normal mixed traffic` và `healthy high-load spike`.

Final-test healthy run phải dùng `run_id` và workload seed chưa xuất hiện ở train/validation. Mục tiêu là đo false alarm và workload-shift behavior. Số run healthy mỗi profile do Đức chốt sau pilot (chưa có số đề xuất ngoài "ít nhất một" của v0).

### 5.5. Seed rule và dữ liệu seed

- `run_id` không reuse.
- Workload seed của final test không reuse từ train/validation.
- Random seed của detector/degradation được lưu theo evaluation instance hoặc versioned config tham chiếu.
- Cùng comparison pair/ablation dùng cùng input run set và cùng seed khi randomness không phải biến đang kiểm tra.
- Dữ liệu seed R-10 (id bắt đầu bằng `5eed`, ghi bằng SQL, không có outbox/trace/log) phải **cùng một phiên bản seed** ở healthy và fault run của cùng split để khối lượng dữ liệu không là biến nhiễu. Run bắt đầu từ trạng thái reset-and-seed đã ghi lại (`lms/test/testbed-reset/`); phiên bản seed đi vào manifest của campaign. Chi tiết reset: chưa kiểm chứng trong tài liệu này.
- Media của dòng seed không có object trong MinIO ([board R-10](../plan/refactor/refactor-board-v1.md)), nên luồng đọc nội dung/thumbnail của dòng seed lỗi; healthy và fault run không được dùng media seed cho W4 trừ khi đã tạo tệp thật.

---

## 6. Pilot, validation và final-test freeze

### 6.1. Pilot

Pilot được phép dùng để chốt các numeric/config placeholder chưa freeze, ví dụ:

- phase duration;
- workload rate;
- fault intensity (ví dụ batch thông báo 100000 recipient của seed R-10 là cường độ gợi ý ở C1, chưa kiểm chứng đủ gây backlog; `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=60` của C6 đã dùng trong smoke);
- **thời gian fault active tối thiểu** để triệu chứng kịp xuất hiện (mục 7.3);
- timeout margin;
- window size/step (khởi đầu `60s/15s` thừa kế từ v0; cửa sổ ghép tín hiệu nên ≥ 15 giây theo độ trễ thu thập ở mục 1.3, chưa kiểm chứng trên v2);
- incident persistence;
- data-quality threshold;
- luật lọc nhiễu (mục 8.5);
- kiểm chứng điều kiện vào campaign của từng case (mục 5.2);
- trace-drop implementation sanity, lineage, missingness và reproducibility; không dùng pilot performance để đổi `drop_ratio` 50%.

Pilot run **không** được đưa vào final metric nếu đã dùng để chọn các giá trị trên.

### 6.2. Validation

Validation được phép dùng để:

- fit/chọn threshold không học được chỉ từ healthy training;
- chọn robust-z/Isolation-Forest threshold;
- chọn detector hyperparameter;
- chọn window/persistence config trong candidate đã định nghĩa;
- tune fusion weight hoặc dùng equal weight baseline;
- tune RCA weights;
- chọn/freeze luật của baseline thủ công tự động (mục 15.2);
- chọn deterministic tie/fallback behavior nếu chưa freeze;
- xác nhận implementation correctness, artifact lineage, missingness calculation, reproducibility và feasibility/quality gate của focused RQ4 degradation condition; không tune `drop_ratio` theo validation performance;
- xác nhận data-quality gate khả thi.

Mọi lựa chọn phải được ghi bằng versioned config; không chọn bằng cảm tính rồi chỉ lưu kết quả cuối.

### 6.3. Final-test freeze manifest

Trước khi chạy/đọc final test result, campaign phải freeze tối thiểu:

```text
protocol_version
campaign_id + campaign_manifest_version
run slot / split assignment
tập case thực sự vào campaign (K) + R + case_verification_status từng case
workload profile + seed policy + phiên bản dữ liệu seed
fault/scenario config versions
phase duration/config
candidate_set_version
feature schema/config
window + step
normalization/imputation policy
luật lọc nhiễu (noise_filter_version)
all detector configs + seeds
threshold selection result
incident config + persistence/merge/recovery rule
all RCA configs + tie-break rule
luật baseline thủ công tự động + phiên bản
modality variants
RQ4 degradation type/config/ratio/seed rule
data-quality/eligibility gates
metric definitions + tolerance rule
rca_result_schema_version
protocol thử nghiệm người (mục 15.3): số người, phân công case, time cap, câu hỏi, brief
aggregation/reporting rule
analysis code commit
output artifact schema/version
```

`frozen_at` phải có trước final evaluation output **và** trước khi người tham gia thấy bất kỳ run nào thuộc final test.

### 6.4. Sau khi đã xem final test

Không được thay threshold, weight, feature, candidate set, window, incident rule, degradation ratio, luật baseline thủ công hoặc model selection rồi tiếp tục gọi cùng campaign là final.

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

Exact duration được freeze trong versioned execution/campaign config sau pilot; tài liệu này không thay `RunGroundTruth` để chứa config selection.

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

Feature windows giữ `[window_start, window_end)` và cùng alignment policy của Analysis blueprint. Online/near-real-time detection không được dùng future data ngoài window đã đóng. Độ trễ thu thập khác nhau theo modality (log ≈ 2 giây, trace ≈ 2,5 giây, counter ≈ 4–10 giây) nên một window đã đóng chưa chắc đã có đủ tín hiệu của mọi modality ở thời điểm đóng; evaluation phải đọc telemetry sau một độ trễ thu thập đã freeze (không dùng future data của window kế tiếp để lấp).

### 7.3. Độ trễ lan truyền triệu chứng và khoảng yên lặng

Các case của v2 cố ý có triệu chứng xuất hiện **muộn và xa** nguyên nhân. Hệ quả cho evaluation interval:

- **C6 (FG):** khi dừng `identity`, lỗi `gateway-identity-token` chỉ xuất hiện sau khoảng yên lặng (đã đo 70–74 giây với TTL 60 giây; mặc định TTL 600 giây, giá trị tương ứng chưa đo). Request có token người dùng còn hạn vẫn thành công trong khoảng này. `fault_start` do đó **trước** triệu chứng đầu tiên một khoảng tối thiểu bằng khoảng yên lặng; Detection Delay của C6 chứa khoảng này và phải báo riêng theo case, không gộp vào delay trung bình mà không ghi chú.
- **C4 (FA):** lỗi lộ muộn ở `scheduler-worker` cách nguyên nhân nhiều bước và nhiều phút (fault matrix v2 mục 6); độ trễ thật chưa đo.
- **C1, C3, C5:** độ trễ từ chèn lỗi tới triệu chứng ở `media`/`course`/batch chưa đo (cơ chế chưa chạy).

Quy tắc: thời gian **fault active** được freeze sau pilot phải **lớn hơn độ trễ triệu chứng đo được của chính case đó** cộng window và persistence; nếu không, fault chưa kịp tạo triệu chứng trong `[fault_start, fault_end + late_tolerance]` và run bị tính FN do thiết kế chứ không do engine. Giá trị nào chưa có đo pilot ghi `chưa kiểm chứng` trong manifest; không nới interval theo kết quả sau khi đã xem validation/test (mục 6.4).

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
| `base-manual-auto` | metrics + traces + logs (cùng tập tín hiệu một người chẩn đoán thủ công có: dashboard, trace, log) |

### 8.3. `pass | partial | fail`

- `pass`: eligible nếu execution valid và đúng variant requirement.
- `partial`: chỉ eligible khi protocol/manifest đã khai báo rõ loại thiếu hụt là acceptable cho variant đó.
- `fail`: không vào primary metric của variant đó.

Đối với baseline/full `M`, `M+T`, `M+T+L`, unexpected missingness ở **modality required** không được silently chấp nhận chỉ vì pipeline vẫn chạy; experiment chuyển `excluded` hoặc `diagnostic_only`.

Đối với RQ4 degraded artifact, `partial` có thể là **expected** nếu lý do đúng là `filtered_by_degradation` theo transform đã freeze. Một `partial/fail` do scrape gap, unknown service identity, timestamp corruption hoặc source outage ngoài degradation vẫn không được coi là robustness condition hợp lệ.

Với v2, hai nguồn thiếu hụt có sẵn phải được phân loại rõ, không lẫn với degradation: (1) **broker metric thiếu gauge** (gauge không có không có nghĩa là 0 message); (2) **Tempo bị OOM-kill** (giới hạn 512 MiB) khi truy vấn hàng nghìn trace song song, nên export trace bằng truy vấn tuần tự, hạn chế số trace; một lần Tempo bị kill giữa run là source outage, không phải robustness condition.

### 8.4. Tín hiệu bắt buộc theo case

Required signal/evidence lấy từ [catalogue case mục 1 và 3](complex-case-catalogue-and-rca-result-v0.md). Optional signal không tự thành blocker nếu không được đánh dấu required. Cột "Thiếu" là giới hạn đã biết (catalogue mục 1.5); thiếu tín hiệu đó **không** làm run `fail` vì tín hiệu ấy chưa tồn tại trong testbed, nhưng phải ghi là limitation của case và không được báo cáo là engine "phân biệt được".

| Case | Tín hiệu cần (đã có) | Thiếu (limitation) |
| --- | --- | --- |
| C1 (FB) | `rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"}`, `consumers`, span CLIENT `notification-smtp smtp.send`, khoảng PRODUCER → CONSUMER của `media-worker` trong cùng trace | tuổi message cũ nhất (suy từ span), độ trễ outbox, log consumer |
| C2 (FC) | `lms_dependency_duration_seconds` của `course-postgres` theo mọi `operation_name`, `process_cpu_time_seconds_total`, RSS của `course` | độ sử dụng pool: không phân biệt "pool cạn" với "DB chậm" |
| C3 (FD) | span CLIENT `ai-llm-provider POST chat/completions`, `lms_dependency_duration_seconds{dependency_identity="ai-llm-provider"}`, CONSUMER `ai-worker--run-ai-job-v1` kéo dài | log consumer của worker |
| C4 (FA) | span `media-minio *`, `lms_dependency_*{dependency_identity="media-minio"}` ở cả `media` và `media-worker`, trace "Dọn media theo lịch" | `scheduler` và `scheduler-worker` không cùng trace |
| C5 (FE) | span `notification-worker-identity GET /internal/v1/students`, span `identity-postgres student.list`, `lms_dependency_duration_seconds{dependency_identity="notification-worker-identity"}` | log lỗi (log không có lỗi theo thiết kế của case) |
| C6 (FG) | span CLIENT lỗi `gateway-identity-token POST /internal/v1/auth/service-token`, `gateway-identity POST`, `lms_dependency_error_count_total{dependency_identity="gateway-identity-token"}`, log `dependency.failure` khớp `span_id` | giới hạn tốc độ `service-token` chưa làm (board) |
| C7 (FH) | tăng `SERVICE_TOKEN_INVALID`/401 nhiều service cùng lúc, span `*-identity-jwks` refetch, 4xx ở `http_server_request_count_total` | — |

### 8.5. Nhiễu telemetry và luật lọc

Catalogue case mục 1.5 ghi nhận **trace gây nhiễu**: `scheduler-worker` tạo trace gốc cho mỗi lần thăm dò DB (mỗi giây) và mọi runtime tạo trace cho `/ready`. Luật lọc theo `http_route_template`/`operation_name` là một phần của feature/analysis config, **version hóa (`noise_filter_version`) và áp dụng như nhau** cho mọi RCA variant, baseline thủ công tự động và tập trace trình cho người tham gia. Không được lọc riêng cho một variant để có lợi.

### 8.6. Replacement/rerun vì validity

Rerun được phép **chỉ** khi predeclared execution/data-quality gate fail, không vì detector/RCA cho metric xấu.

- rerun tạo `run_id` mới;
- original run/artifact vẫn giữ;
- manifest có thể dùng `replacement_for_run_id` để audit slot replacement;
- replacement phải giữ cùng frozen scenario/workload/fault configuration của slot, trừ phần sửa infrastructure bug đã được version hóa;
- không inspect model outcome (hoặc kết quả người tham gia) để quyết định slot nào cần replacement.

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
- ngưỡng và luật của baseline thủ công tự động;
- tie/fallback rule;
- data-quality threshold;
- luật lọc nhiễu;
- RQ4 degradation implementation/lineage/quality-gate behavior; `drop_ratio=0.50` không phải hyperparameter để chọn theo validation performance.

### 9.3. Test-only reporting

Test input không được dùng để:

- select model;
- select feature;
- change threshold;
- change candidate set;
- change weight;
- change tolerance;
- change exclusion gate;
- chỉnh luật baseline thủ công hoặc brief của thử nghiệm người;
- chọn subset run đẹp hơn để report.

---

## 10. RQ1 — Multi-source telemetry protocol

### 10.1. Required variants

```text
M
M + T
M + T + L
```

`M+L` là optional diagnostic, không phải DoD.

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
- RCA conditional Top-1/Top-3/MRR; Average Rank và `rca_coverage`.
- RCA end-to-end Top-1/Top-3/MRR trên toàn bộ eligible fault runs của mỗi variant; đây là reporting bắt buộc cho RQ1 cross-condition comparison.
- Feature extraction, detector, incident, RCA runtime và artifact size khi khác biệt đáng kể.
- Eligibility/coverage count để không che việc richer modality bị mất dữ liệu nhiều hơn.

Giới hạn riêng của v2 cần ghi cùng kết quả RQ1: log của worker chỉ có access log `/ready`, lỗi xử lý command chỉ thấy ở span và log `dependency.failure` (catalogue case mục 1.5). Với case có root cause ở worker (C1) hoặc triệu chứng ở worker (C3, C5), giá trị của `L` bị giới hạn bởi tín hiệu log chưa tồn tại, không phải bởi engine; báo cáo phải đọc RQ1 theo từng case, không chỉ trung bình.

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

Dynamic graph được dựng từ observed traces/edge evidence của chính run/window. Graph thiết kế v2 ([catalogue mục 5–6](service-catalogue-and-topology-v2.md): cạnh `e01–e29`, async command nối qua RabbitMQ) chỉ dùng validation/sanity check, không thay dynamic graph trong primary comparison; `RcaIncidentResult.model.graph_ref` ghi graph đã dùng.

Điều kiện riêng của v2 phải ghi cùng kết quả:

- **Async edge nối trace:** command ghi `traceparent` vào envelope lúc enqueue và relay phát lại đúng context, nên chuỗi async nằm trong trace của request gây ra (đã sửa và kiểm ở R-12, catalogue case mục 4.2). Cạnh `scheduler → scheduler-worker` **không** cùng trace, nên graph dynamic của C4 thiếu cạnh này; đây là coverage gap, không phải graph-aware thất bại.
- **Vòng phụ thuộc `course → ai → course`** (cạnh `e11`, `e27`; identity `ai-worker-course`): graph-aware RCA phải xử lý chu trình mà không tính hai chiều là một.
- **Quy ước đọc span (mục 4.1):** span PRODUCER thuộc tiến trình relay và queue thuộc worker tiêu thụ; graph-aware attribution theo queue owner, không theo `service.name` của span PRODUCER.
- Graph-aware experiment không được đưa PostgreSQL/MinIO/RabbitMQ/SMTP/LLM provider hay cạnh `*-identity-token`/`*-identity-jwks` vào service candidate list; chúng là evidence, ví dụ `gateway-identity-token` là bằng chứng cho C6 với candidate `identity`.

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

Điều kiện riêng của v2: onset ước lượng từ các modality bị lệch bởi độ trễ thu thập khác nhau (log ≈ 2 giây, trace ≈ 2,5 giây, counter ≈ 4–10 giây); so sánh onset giữa modality phải hiệu chỉnh hoặc dùng cửa sổ đủ lớn (≥ 15 giây). Với C6, "earliest anomaly" ở `gateway` chỉ xuất hiện sau khoảng yên lặng, còn nguyên nhân (`identity`) đã có từ `fault_start`; precedence đúng là root cause trước symptom nhưng root cause chỉ quan sát gián tiếp qua cạnh `gateway-identity-token`.

---

## 13. RQ4 — Robustness protocol v1

### 13.1. Focused degraded condition được chọn

Giữ nguyên thiết kế freeze của v0:

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

Đây là **một focused condition** cho RQ4, không mở rộng thành nhiều sampling level × modality matrix. Baseline trace collection là 100% sampling (đã đúng ở testbed v2: mọi runtime xuất span với 100% sampling).

`drop_ratio=0.50` là phần đã freeze của comparison design thừa kế từ v0, không phải tham số được tune theo detection/RCA performance. **Khả thi của whole-trace drop trên trace v2 (trace chứa cả chuỗi async và nhiều service) chưa kiểm chứng**; validation chỉ kiểm tra implementation correctness, source/derived artifact lineage, missingness calculation, reproducibility và feasibility/quality gate. Nếu pilot chứng minh 50% không khả thi hoặc không qua quality gate, phải bump protocol/config version, ghi rationale và freeze lại trước final test; không silently đổi ratio theo metric.

### 13.2. Transformation semantics

- Source phải là full/baseline telemetry artifact của cùng `run_id`.
- Drop ở **whole-trace granularity**, không drop random individual span làm gãy trace.
- Selection keep/drop phải deterministic theo `trace_id` + frozen `degradation_seed` hoặc thuật toán tương đương có reproducibility rõ.
- Metrics và logs không bị biến đổi bởi trace-drop condition. Log vẫn mang `trace_id`/`span_id` của trace đã drop; evaluation phải ghi nhận log tham chiếu tới trace không còn để RCA không dùng được `trace_id` đó làm bằng chứng tham chiếu mở.
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

### 13.4. Async fallback

Ở v0 fallback áp dụng cho F4. Ở v2, trace của luồng async nằm cùng trace của request (nối bằng `traceparent`), nên dropping whole-trace bỏ **cả** phía request và phía worker của cùng luồng (W2, W4, W5, W6). Khi trace bị drop, edge async được phép dùng `message_id` + temporal relation theo [catalogue mục 8](service-catalogue-and-topology-v2.md). Theo mã, consumer ghi thuộc tính `messaging.message.id`; span PRODUCER có `message_id` hay không **chưa kiểm chứng**, nên khả năng nối bằng `message_id` phải được xác nhận ở pilot trước khi coi fallback là khả thi. Confidence/edge evidence phải phản ánh missing trace; không synthesize trace link giả.

### 13.5. Metrics

Báo cáo cả absolute và paired delta:

```text
Detection: Precision, Recall, F1, FPR, Detection Delay
RCA:       Top-1, Top-3, MRR, Average Rank
System:    runtime/artifact size khi khác đáng kể
```

Với RQ4, Top-1, Top-3 và MRR phải có paired **end-to-end** outcome trên mọi eligible same-run pair. Nếu full hoặc degraded không tạo matched incident/RCA output (kể cả `verdict = "insufficient_evidence"`), pair vẫn ở denominator với Top-1/Top-3 là miss và reciprocal rank bằng 0; Average Rank giữ là conditional metric trên ranking đã tạo và báo `rca_coverage` riêng.

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
- full vs RQ4 degraded/fallback;
- baseline thủ công tự động (`base-manual-auto`) làm điểm tham chiếu chi phí/chất lượng.

Báo cáo riêng:

### Quality

- Detection Precision/Recall/F1/FPR/Delay.
- RCA Top-1/Top-3/MRR; Average Rank bổ sung.
- Thời gian chẩn đoán (mục 15.4) như một trục riêng bên cạnh quality.

### Analysis runtime/resource

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime per incident;
- peak CPU/memory của analysis;
- artifact size.

Hạn chế đã biết: Prometheus, Tempo, Loki chạy một node với giới hạn RAM 256–512 MiB mỗi thành phần, retention 24 giờ; Tempo từng bị OOM-kill khi truy vấn hàng nghìn trace song song. `telemetry_query_export_time` đo trên stack này phải ghi giới hạn đó, và RCA engine không kéo trace hàng loạt từ Tempo của testbed (catalogue case mục 4.2).

### Instrumentation overhead

Đo trên healthy workload đã freeze bằng paired configuration phù hợp:

```text
application throughput: instrumented vs reference/no-analysis-instrumentation baseline
application p95 latency: instrumented vs reference baseline
```

Reference và instrumented condition phải giữ workload profile/seed, code/business behavior và environment tương đương; nếu instrumentation-off làm thay code path ngoài telemetry concern, limitation phải ghi rõ. Workload k6 chưa có và **chưa kiểm chứng** là testbed v2 có cấu hình tắt export telemetry mà không đổi code path; đo overhead chỉ được làm sau khi hai điều đó có.

Report:

```text
throughput_change_pct = (instrumented - reference) / reference * 100
p95_latency_change_pct = (instrumented - reference) / reference * 100
```

Không gộp quality + runtime + complexity thành một utility score.

### Explainability/complexity

Explainability là checklist theo variant, chấm trên `RcaIncidentResult` (mục 16):

- component/`mechanism` và score có mặt;
- `evidence[]` có mặt khi data cho phép và mỗi evidence **truy ngược được** (`trace_id`/`span_id` hoặc `metric` + nhãn + window tồn tại trong telemetry artifact đã chọn);
- timeline position (`symptom.first_seen`, `window`) có mặt;
- config/version traceable (`model`);
- output machine-readable.

Complexity báo cáo định tính theo modality/component/pipeline stage/dependency/failure mode bổ sung; không tự phát minh numeric complexity score.

---

## 15. Đối chứng thủ công và thời gian chẩn đoán (ADR-002)

ADR-002 mục 3–4 quyết định: đối chứng là **baseline thủ công tự động** (đo lặp được) cộng **thử nghiệm vài người thật** dùng Grafana/Tempo/Loki, và đánh giá **thời gian chẩn đoán** bên cạnh Top-1/Top-3/MRR và ablation. Mục này là phần v0 chưa có. Chưa có baseline, người tham gia hay thời gian chẩn đoán nào được đo.

### 15.1. Mục đích và phạm vi của đối chứng

Mục đích là kiểm chứng tuyên bố của đề tài rằng với các case phức tạp (nguyên nhân gốc ngoài đường request của triệu chứng), AI tìm được nguyên nhân mà truy vết thủ công không tìm ra hoặc tìm chậm hơn. Đối chứng không nhằm chứng minh AI tốt hơn bằng mọi giá: kết quả phải được báo cáo đúng, kể cả khi baseline thủ công tìm đúng ở một số case. Kết luận chỉ nói về tập case thực sự đã đánh giá (mục 5.2), kể cả case chỉ ở mức **đã đo tín hiệu**.

### 15.2. Baseline thủ công tự động (`base-manual-auto`)

Baseline mô phỏng cách người chẩn đoán đọc dashboard và trace theo đường request của triệu chứng, theo ADR-002: **ngưỡng + tìm trace lỗi/chậm nhất**. Ràng buộc protocol (độc lập với thuật toán chi tiết):

- Chạy lặp được, deterministic, trên cùng eligible run, cùng candidate set `service-candidates.v1` và cùng ground truth như RCA engine; `analyst_kind = manual_baseline_auto`.
- Chỉ dùng tín hiệu mà người thủ công có: RED metric theo service, trace lỗi/chậm nhất của route triệu chứng, log theo `trace_id`. Không dùng mô hình đã học, graph model, điểm bất thường học từ healthy train hay ground truth.
- Đầu ra theo cùng schema `RcaIncidentResult` (`model.name` là tên baseline), ranking đủ 10 candidate, để cùng harness chấm Top-1/Top-3/MRR.
- Luật chi tiết (ngưỡng nào, tìm trace thế nào, cách chuyển trace tìm được thành ranking service) là **đề xuất chưa viết**; phải được thiết kế bởi người không tối ưu theo kết quả test, version hóa (`rca_config_version`), chọn trên validation và freeze trước final test (mục 6.3).
- Đây là baseline chặt: nó không phải "người thật" và không đại diện cho mọi cách chẩn đoán thủ công; thử nghiệm người (15.3) bổ sung cho giới hạn này.

Một baseline đối chiếu tham chiếu thêm (diagnostic, không phải core baseline mới): **constant ranking** theo thứ tự tie-break và **random ranking** (mục 18.4), để biết một kết quả Top-K cao có cần telemetry hay không.

### 15.3. Thử nghiệm người

Thử nghiệm người dùng Grafana/Tempo/Loki thật để đo thời gian chẩn đoán. Số người, số case mỗi người, time cap và brief **chưa chốt**; các mục dưới là cấu trúc protocol, giá trị cụ thể thuộc đề xuất chờ Đức.

Quy tắc:

- **Người tham gia:** vài người (số do Đức quyết định); không bao gồm Đức hay bất kỳ ai đã biết danh mục case, ground truth hoặc cấu hình injector (điều đó phá invariant 15). Mô tả mức quen thuộc với Grafana/Tempo/Loki của từng người trong bản ghi (tự khai).
- **Tài nguyên được dùng:** Grafana (dashboard `service-overview`), Tempo, Loki và Prometheus của stack observability, cho đúng cửa sổ thời gian của run. Không có quyền đọc repo tài liệu `docs/`, catalogue, mã nguồn LMS, cấu hình injector hay ground truth.
- **Brief:** chỉ trình triệu chứng người dùng thấy (route/hành vi lỗi, thời điểm) và tên run slot, **không** `fault_type`, `scenario_id`, `case_id`, root cause hay hint nhân quả.
- **Câu hỏi:** "service nào là nguyên nhân gốc?" trả lời bằng một `service.name` trong 10 candidate (kèm component nếu biết, không tính vào primary metric). Cho phép trả lời `không xác định`.
- **Time cap:** có giới hạn thời gian tối đa mỗi case, giá trị chưa chốt; hết cap tính `timed_out`.
- **Phân công:** mỗi người xem mỗi case tối đa một lần; thứ tự case đảo vị trí giữa người để hạn chế hiệu ứng học và mệt; mỗi người không thấy hai run của cùng một case.
- **Dữ liệu dùng:** run thuộc **final test split**, cùng run mà RCA engine và baseline được chấm, để so ghép cặp. Kết quả thử nghiệm người không được dùng để chỉnh engine hay baseline (mục 9.3).
- **Phát lại:** telemetry của run phải còn truy vấn được khi người tham gia làm; retention của stack là 24 giờ nên thử nghiệm phải chạy trong cửa sổ đó hoặc telemetry phải được nạp lại. **Cách nạp lại/phát lại chưa kiểm chứng.**

Bản ghi mỗi lượt (logical, đề xuất):

```text
HumanDiagnosisRecord
- record_id
- participant_id                   # ẩn danh
- participant_experience           # tự khai, mô tả ngắn
- run_id                           # tham chiếu run final test
- presentation_order               # thứ tự case của người này
- brief_shown_at
- answer_submitted_at
- duration_seconds                 # answer_submitted_at - brief_shown_at, đồng hồ monotonic của harness
- timed_out                        # true nếu hết time cap
- answer_service                   # một service.name hoặc "unknown"
- answer_component                 # nullable
- tools_used                       # tự khai: grafana | tempo | loki | prometheus
- run_ground_truth_ref             # evaluator resolve sau khi nộp đáp án
- correct                          # evaluator tính sau: answer_service == root_cause_service
```

### 15.4. Thời gian chẩn đoán

Thời gian chẩn đoán là metric riêng, không gộp vào Top-K/MRR hay score tổng hợp:

```text
Người:      T_human  = duration_seconds (từ lúc brief được trình tới lúc nộp đáp án), timed_out là bị chặn (censored)
Engine:     T_engine = rca_runtime_per_incident (đo thật, mục 19.1)
Baseline:   T_base   = thời gian chạy của luật baseline trên incident
```

Mốc bắt đầu chung là **lúc incident được khai báo** (incident `detected_at` của incident matched): người nhận brief ở mốc đó, engine/baseline bắt đầu phân tích ở mốc đó. Bổ sung hai giá trị báo riêng, không cộng ngầm:

- `detection_delay_seconds` (mục 17.5), chung cho engine và baseline, tính theo thời gian telemetry;
- độ trễ thu thập của stack (log ≈ 2 giây, trace ≈ 2,5 giây, counter ≈ 4–10 giây, backlog queue ≈ 9 giây) để người đọc biết thời gian engine không gồm.

Giới hạn trung thực: run được phân tích offline từ artifact, nên `created_at` của `RcaIncidentResult` là giờ thực lúc phát lại và **không** dùng làm thời gian chẩn đoán; thời gian chẩn đoán của engine là thời gian chạy đo được. So `T_human` với `T_engine` là so hai đại lượng khác bản chất (người đọc dashboard so với engine chạy pipeline), nên chỉ mô tả, không kết luận định lượng về "nhanh hơn bao nhiêu lần" khi chưa có cách chuẩn hóa. Cách chuẩn hóa này là **câu hỏi mở chờ Đức**.

### 15.5. So sánh ghép cặp và báo cáo

Trên mỗi run final test eligible, ghép các đầu ra cùng `run_id`:

```text
RCA engine         -> end-to-end hit/rank, T_engine
base-manual-auto   -> end-to-end hit/rank, T_base
người tham gia     -> correct, duration_seconds, timed_out (khi có thử nghiệm người)
```

Báo cáo:

- Top-1/Top-3/MRR end-to-end của engine và `base-manual-auto` trên cùng denominator (mục 20.3); `verdict = "insufficient_evidence"` là miss.
- **Số run AI tìm đúng mà baseline thủ công và người tham gia không tìm ra** (và ngược lại), kèm denominator, theo từng case. Đây là số đếm mô tả, không có ngưỡng thành công đặt trước trong v1.
- Phân phối `duration_seconds` của người theo case (count, mean, median, min, max, số `timed_out`), cộng `T_engine`. Số người nhỏ nên không kiểm định ý nghĩa thống kê.
- Trạng thái kiểm chứng của từng case (mục 4.2) đặt cạnh kết quả: kết quả trên case chỉ đã đo tín hiệu hoặc giả thuyết không được trình bày như kết quả trên case đã chạy.
- Không tạo composite score kết hợp chính xác và thời gian.

### 15.6. Đánh giá agent MCP (tùy chọn)

Chất lượng báo cáo của agent (độ đúng, dẫn chứng, độ phủ) **chỉ** được đánh giá khi phần MCP/agent được làm (ADR-002 mục 4); **không** phải tiêu chí hoàn thành đề tài, và `aiops-platform/mcp/` hiện chưa tồn tại. Khi làm, áp dụng các ràng buộc:

- Agent đọc `RcaIncidentResult` đã có (không phải telemetry thô), không thay mô hình ML xếp hạng.
- Công cụ `get_ground_truth` chỉ bật khi đánh giá offline và tắt khi chạy thật (ADR-002 ràng buộc); báo cáo agent được sinh khi tắt công cụ này, sau đó evaluator mới đối chiếu.
- Chấm tối thiểu: (1) nguyên nhân agent nêu có trùng `root_cause_service`; (2) mỗi dẫn chứng agent trích có nằm trong `evidence[]` và truy ngược được; (3) khi `verdict = "insufficient_evidence"` agent báo "không đủ chứng cứ" thay vì bịa; (4) `summary` và chuỗi từ log/trace là dữ liệu không tin cậy, không được làm agent đổi hành vi (kiểm bằng một số case có nội dung cố ý chứa chỉ thị, nếu làm).
- Đây là phần bổ sung riêng, không thay Top-K/MRR của engine và không đi vào final headline metrics nếu chưa có protocol chấm đã freeze.

---

## 16. Đầu ra được chấm: `RcaIncidentResult`

Prediction artifact của evaluation là `RcaIncidentResult` ([catalogue case mục 5.2](complex-case-catalogue-and-rca-result-v0.md), `rca_result_schema_version = "0"`), mỗi incident một file JSON bất biến cùng `manifest.json` (`incident_id`, `run_id`, `created_at`, `sha256`) ở `aiops-platform/training/results/<run_id hoặc ngày>/<incident_id>.json` (thư mục chưa tồn tại; nơi lưu chỉ là đề xuất của catalogue mục 5.3). Evaluation pin phiên bản schema; đổi schema hoặc nơi lưu phải cập nhật catalogue và bump `evaluation_config_version`. `base-manual-auto` cũng xuất đúng schema này.

### 16.1. Trường được chấm

| Trường `RcaIncidentResult` | Dùng trong evaluation |
| --- | --- |
| `run_id` | khóa ghép với `RunGroundTruth`; `null` (giám sát thật) thì không thuộc evaluation |
| `incident_id` | khóa với incident artifact để matching (mục 17); bảo đảm một prediction ↔ một incident |
| `verdict` | `ranked` → có ranking; `insufficient_evidence` → không có ranking, tính end-to-end miss (Top-1/Top-3 miss, reciprocal rank 0) và đếm riêng `insufficient_evidence_count` để lộ việc engine từ chối; không vào conditional metric |
| `ranking[].rank`, `ranking[].candidate.service` | Top-1, Top-3, MRR, Average Rank so với `root_cause_service`; chỉ `candidate.service` thuộc `service-candidates.v1` |
| `ranking[].candidate.component`, `.dependency_identity` | chỉ diagnostic, **không** tham gia primary Top-K/MRR |
| `ranking[].score` | tie-break và kiểm tra thứ hạng deterministic; không dùng làm metric |
| `ranking[].mechanism` | diagnostic phụ: đối chiếu `fault_type` của `RunGroundTruth` trên run có ranking; không là metric canonical |
| `ranking[].propagation_path[]` | diagnostic phụ so với đường lan trong ground truth (chỉ báo cáo mô tả, không thêm metric mới) |
| `ranking[].evidence[]` | explainability checklist: mỗi evidence phải truy ngược được trong telemetry artifact đã chọn (mục 14) |
| `symptom` | diagnostic: `symptom.service`/`first_seen` đối chiếu triệu chứng kỳ vọng của run; **không** ảnh hưởng primary metric |
| `window`, `telemetry_quality`, `model.graph_ref`, `model.config_ref` | lineage, kiểm tra cửa sổ nằm trong evaluation interval, và nối tới `TelemetryQualityReport` |
| `created_at` | audit; **không** dùng đo thời gian chẩn đoán (mục 15.4) |

### 16.2. Quy tắc

- `ground_truth` không nằm trong `RcaIncidentResult` (catalogue mục 5.2); `ground_truth_service` chỉ xuất hiện trong evaluation artifact do evaluator ghi (mục 22).
- Ranking phải có tối đa một entry cho mỗi candidate service; một entry có `candidate.service` ngoài candidate set là vi phạm schema và run đó bị `diagnostic_only` kèm lý do.
- Nếu engine có nhiều incident cho một fault run, matching ở mục 17.4 chọn incident match; chỉ `RcaIncidentResult` của incident match được chấm RCA, các incident khác là FP của detection và vẫn được lưu.
- Phần `summary` và chuỗi trích từ log/trace là dữ liệu không tin cậy; harness chấm không thực thi hay diễn giải chúng như chỉ thị.

---

## 17. Incident matching và detection metric semantics

### 17.1. Ground-truth event

Mỗi valid fault run có **một controlled fault truth** với:

```text
fault_start
fault_end
```

Một predicted incident chỉ được match tối đa một ground-truth fault; mỗi ground-truth fault chỉ match tối đa một predicted incident.

### 17.2. Early detection rule

Không cho credit detection trước fault:

```text
early_tolerance_seconds = 0
```

Predicted incident có `detected_at < fault_start` là false positive, kể cả incident đó còn open khi fault bắt đầu. Rule này tránh biến pre-fault false alarm thành TP sau khi nhìn ground truth.

### 17.3. Late tolerance do window/persistence

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

Detection sau interval này không được tính TP cho fault đó. Công thức này **không** bù độ trễ lan truyền của triệu chứng (mục 7.3): độ trễ đó được xử lý bằng cách freeze thời gian fault active đủ dài sau pilot, không bằng cách nới `late_tolerance`.

### 17.4. Matching rule khi có nhiều incident

Trong một fault run:

1. Lọc predicted incident có `detected_at` trong eligible matching interval.
2. Sort theo `detected_at`, sau đó `incident_id` làm deterministic tie-break.
3. **Incident sớm nhất** được match với ground-truth fault và tính TP.
4. Mọi predicted incident khác trong evaluation interval không được match là FP.
5. Nếu không có incident eligible: ground-truth fault là FN.

Incident trước `fault_start`, sau late tolerance hoặc duplicate incident sau matched incident đều là FP nếu nằm trong evaluation interval. Incident sinh từ nhiễu đã biết (trace `/ready`, thăm dò scheduler-worker) nếu không bị `noise_filter_version` loại thì là FP, không được bỏ qua theo ý chủ quan.

### 17.5. Detection delay

Chỉ tính cho matched TP:

```text
Detection Delay = matched_incident.detected_at - fault_start
```

Vì early tolerance = 0, delay primary không âm. FN không được gán delay giả; report `null` và denominator riêng. Delay báo kèm theo case vì khoảng yên lặng/độ trễ lan truyền khác nhau (C6: tối thiểu bằng khoảng yên lặng đã đo 70–74 giây ở TTL 60 giây).

### 17.6. Precision/Recall/F1

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

### 17.7. False Positive Rate

Vì primary unit là incident/run chứ không có natural TN cho từng arbitrary timestamp, **primary FPR dùng healthy-run level**:

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

Window-level FPR có thể lưu diagnostic nhưng không thay primary healthy-run FPR. Các profile healthy chuyên biệt (batch lớn, upload peak, AI job; mục 5.4) được báo cáo FP theo profile để thấy detector có nhầm tải hợp lệ là fault hay không.

---

## 18. RCA metric semantics

### 18.1. Ranking input

RCA metric chỉ dùng candidate list đúng `service-candidates.v1`. Ranking phải deterministic và chứa tối đa một entry cho mỗi candidate service.

Nếu score bằng nhau, dùng tie-break order canonical (thứ tự của catalogue v2 mục 8):

```text
identity < course < media < media-worker < notification < notification-worker < scheduler < scheduler-worker < ai < ai-worker
```

Tie-break order chỉ bảo đảm determinism, không mang semantic ưu tiên root cause.

### 18.2. Missing candidate score

Candidate không được xóa khỏi list do missing modality. Nếu variant không tính được score cho candidate, fallback/missing-score policy phải được freeze trong `rca_config_version`; missing candidate không được tự nhiên biến candidate universe nhỏ hơn.

### 18.3. Conditional RCA quality

Trên incident đã được detect/matched **và** có RCA ranking output (`verdict = "ranked"`), báo conditional RCA quality:

```text
Top-1 Accuracy = mean(root_cause_service ở rank 1)
Top-3 Accuracy = mean(root_cause_service ở rank <= 3)
MRR            = mean(1 / rank(root_cause_service))
Average Rank   = mean(rank(root_cause_service))
```

`root_cause_component` không tham gia primary Top-K/MRR. Owner-level Top-K (mục 4.2) là diagnostic phụ.

### 18.4. Giới hạn của Top-3 và mốc tham chiếu với danh mục v2

V0 có rủi ro structural saturation: F1–F5 chỉ có 3 root cause khác nhau nên một ranking hằng đặt ba service đó ở Top-3 có thể đạt 100%. Danh mục v2 giảm rủi ro này nhưng không loại bỏ. Số liệu dưới đây là **tính số học từ catalogue và đề xuất `R`**, không phải số đo:

- 7 case C1–C7 có 5 `root_cause_service` khác nhau trên 10 candidate; `identity` chiếm ba case (C5, C6, C7).
- Nếu cả bảy case vào campaign với số run bằng nhau: một ranking hằng **tốt nhất có thể** đặt `identity` cộng hai service khác ở Top-3 thì đúng 5/7 case (≈ 71%) ở Top-3 và 3/7 (≈ 43%) ở Top-1 (chọn `identity`).
- Ranking ngẫu nhiên đều: kỳ vọng Top-1 = 1/11 ≈ 9,1%, Top-3 = 3/11 ≈ 27,3%.
- Nếu chỉ một vài case vào campaign (hiện trạng: chỉ C6 đã chạy), con số trên đổi: với đúng một case, ranking hằng đặt đúng service đó đạt 100% Top-1. Vì vậy Top-K phải luôn được đọc cùng `K` và danh sách case.

Top-3 vẫn là metric canonical và phải được báo cáo, nhưng không được dùng độc lập để kết luận một method RCA tốt hơn. Mọi kết luận RCA phải đọc cùng Top-1, Top-3, MRR, Average Rank, kết quả theo từng case và so với hai mốc tham chiếu (constant ranking theo thứ tự tie-break, random ranking) như diagnostic, không phải core baseline mới và không thay metric/RQ/fault catalogue canonical.

### 18.5. RCA evaluability/coverage

Final report bắt buộc báo:

```text
eligible_fault_runs
matched_detected_runs
rca_output_runs                  # verdict = "ranked"
insufficient_evidence_runs       # verdict = "insufficient_evidence"
rca_evaluable_runs
rca_coverage = rca_evaluable_runs / eligible_fault_runs
```

`rca_coverage` phân biệt conditional ranking quality với số eligible fault run thật sự đi tới RCA output; nó không được dùng để drop silent các incident khó. `insufficient_evidence_runs` lộ ra việc engine từ chối trả lời, không được che bằng conditional metric.

### 18.6. End-to-end RCA effectiveness cho RQ1, RQ4 và đối chứng thủ công

Đối với RQ1, RQ4 và so sánh với baseline thủ công (mục 15.5), end-to-end RCA reporting là **bắt buộc** trên toàn bộ `eligible_fault_runs` của split/campaign tương ứng, không chỉ trên matched/evaluable incidents:

- no matched incident/no RCA output/`insufficient_evidence` -> Top-1 miss, Top-3 miss, reciprocal rank = 0;
- Average Rank là `null`/not available khi không có ranking; nếu aggregate Average Rank chỉ tính trên ranking đã tạo thì phải ghi rõ conditional denominator;
- báo `rca_coverage` riêng, cùng denominator `eligible_fault_runs`.

Với RQ4, full/degraded giữ same-run pairing. Mỗi eligible pair có một paired end-to-end outcome; pair không bị drop khi một condition không detect incident hoặc không tạo RCA output. Paired delta cho Top-1, Top-3 và MRR dùng semantic miss/0 ở trên; chỉ validity rule đã canonicalize mới được exclude pair.

---

## 19. System metric measurement boundaries

### 19.1. Timing

Mỗi stage timing phải dùng monotonic clock trong cùng process/job khi khả thi và ghi rõ boundary:

```text
telemetry_query_export_time
feature_extraction_time
detector_inference_time
incident_correlation_time
rca_runtime_per_incident
```

Không cộng/trừ ngầm network/storage time giữa variant; nếu một timing gồm artifact I/O, config phải ghi `includes_io=true`. Timing không được trộn với độ trễ thu thập của stack (mục 7.2) hay Detection Delay.

### 19.2. Peak CPU/memory

Peak CPU/memory của analysis được đo trên cùng execution environment/profile cho các variant so sánh. Measurement source/version được lưu trong evaluation/system artifact.

### 19.3. Artifact size

Artifact size tính trên immutable artifact thực tế hoặc content payload được URI trỏ tới; không chỉ tính kích thước metadata stub trong Git.

### 19.4. Runtime aggregation

Báo per-run/per-incident raw values và summary tối thiểu:

```text
count
mean
median
min
max
```

Không cần statistical significance test nếu repetition chưa đủ (mỗi case chỉ có `R − 1` run final test; thử nghiệm người chỉ vài người); raw values phải được giữ để audit.

---

## 20. Aggregation và reporting

### 20.1. Final metric source

Final headline metrics chỉ lấy từ:

```text
split = test
inclusion_status = eligible
frozen campaign/config version
```

Train/validation metric chỉ được trình bày như tuning/pilot evidence, không trộn vào final score. Số đo của thử nghiệm người (mục 15) cũng chỉ được báo cáo trên run final test và tách khỏi metric engine.

### 20.2. Detection aggregation

Báo:

- pooled TP/FP/FN và Precision/Recall/F1 trên eligible final-test runs;
- healthy-run FPR (và theo profile healthy);
- Detection Delay count/mean/median và per-case values;
- per-case F1/Recall/Delay khi denominator hợp lệ;
- số run excluded/invalid/partial theo reason.

### 20.3. RCA aggregation

Báo:

- conditional Top-1, Top-3, MRR và Average Rank trên eligible matched/evaluable final-test runs, kèm conditional denominator;
- end-to-end Top-1, Top-3 và MRR trên toàn bộ eligible fault runs khi so sánh RQ1/RQ4/đối chứng thủ công;
- per-case result (C1–C7 đã vào campaign) với cả coverage, denominator, và `case_verification_status`;
- `rca_coverage`, `insufficient_evidence_runs`;
- owner-level Top-K như diagnostic phụ;
- candidate rank raw per run.

### 20.4. Đối chứng thủ công và thời gian chẩn đoán

Theo mục 15.5, kèm denominator, `K`, `R`, số người, số lượt, số `timed_out`.

### 20.5. RQ4 paired aggregation

Mỗi row pair phải giữ:

```text
run_id
scenario_id
case_id
repeat_index
full_evaluation_instance_id
degraded_evaluation_instance_id
full_artifact_id
degraded_artifact_id
metric_full
metric_degraded
delta
```

Aggregate delta chỉ sau khi pair-level lineage hợp lệ. Không ghép full run A với degraded run B. Top-1, Top-3 và MRR bắt buộc aggregate paired end-to-end outcome trên mọi eligible pair; khi một bên không tạo incident/RCA ranking, pair vẫn dùng miss/0. Average Rank chỉ aggregate trên ranking produced và phải kèm conditional denominator cùng `rca_coverage`.

### 20.6. No hidden denominator

Mọi summary table phải ghi ít nhất:

```text
n_runs
n_incidents hoặc n_pairs phù hợp
excluded_count
config/campaign version
K (số case) và R (repetition)
```

Không report một percentage mà không thể biết denominator.

---

## 21. Artifact chain và storage contract

### 21.1. Required lineage

Logical chain:

```text
RunGroundTruth (immutable execution truth)
        +
TelemetryArtifactManifest + TelemetryQualityReport
        |
        v
EvaluationInstanceManifest
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
RCA artifact = RcaIncidentResult (prediction)
        |
        v
Evaluation artifact
```

Mỗi stage output phải reference upstream artifact/config đủ để reverse lookup. `HumanDiagnosisRecord` (mục 15.3) tham chiếu `run_ground_truth_ref` và `run_id`, nằm ngoài chain pipeline nhưng cùng ledger campaign.

### 21.2. Logical run layout compatibility

Giữ compatibility với Analysis blueprint v1:

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
├── prediction.json            # tham chiếu/thay bằng RcaIncidentResult theo catalogue mục 5.3
└── evaluation.json
```

Vì một run có nhiều variant, implementation được phép dùng variant-specific subpath/filename hoặc artifact registry, nhưng **không được overwrite** artifact đã được một `evaluation_instance_id` tham chiếu. Physical layout là implementation detail; logical identity/lineage trong manifest là bắt buộc. Nơi lưu `RcaIncidentResult` theo catalogue mục 5.3 vẫn là đề xuất; nếu đổi, cập nhật catalogue và `rca_result_schema_version` trước.

### 21.3. Large artifact

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

### 21.4. Immutability

- Không overwrite artifact ID đã dùng trong evaluation.
- Re-export/recompute vì bug tạo artifact ID/version mới.
- `RcaIncidentResult` đã ghi không sửa; kết quả mới là file mới (catalogue mục 5.3).
- Derived degraded artifact luôn có source lineage.
- Final evaluation artifact phải reference exact prediction/config/artifact IDs, không reference "latest".

---

## 22. Evaluation artifact v1

Một evaluation output tối thiểu phải biểu diễn được:

```text
EvaluationArtifact
- evaluation_artifact_id
- evaluation_schema_version
- protocol_version
- campaign_id
- campaign_manifest_version
- evaluation_instance_id
- experiment_id                    # execution family reference
- run_id
- split
- scenario_id
- case_id
- case_verification_status
- repeat_index
- analysis_variant_id
- analyst_kind
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
- ground_truth_owner            # evaluator output only; phục vụ owner-level Top-K
- verdict                       # ranked | insufficient_evidence, từ RcaIncidentResult
- predicted_rank
- ranking_produced
- conditional_top1_hit
- conditional_top3_hit
- conditional_reciprocal_rank
- end_to_end_top1_hit           # false khi không có matched incident/RCA output/insufficient_evidence
- end_to_end_top3_hit           # false khi không có matched incident/RCA output/insufficient_evidence
- end_to_end_reciprocal_rank    # 0 khi không có matched incident/RCA output/insufficient_evidence
- owner_level_top1_hit          # diagnostic phụ
- owner_level_top3_hit          # diagnostic phụ
- rca_evaluable
- rca_candidate_list_ref
- evidence_traceable_count      # số evidence truy ngược được / tổng, cho explainability checklist
- mechanism_match               # diagnostic phụ: ranking[0].mechanism == fault_type

# diagnosis time
- engine_diagnosis_seconds      # rca_runtime_per_incident (analyst_kind khác human)
- human_record_refs             # danh sách HumanDiagnosisRecord cùng run_id (nullable)

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
- prediction_artifact_ref        # RcaIncidentResult (path + sha256)
- feature_config_version
- noise_filter_version
- detector_config_version
- incident_config_version
- rca_config_version
- rca_result_schema_version
- analysis_code_commit
```

`ground_truth_service` và `ground_truth_owner` xuất hiện trong **evaluation artifact**, không trong detector/RCA feature artifact, không trong `RcaIncidentResult`, không trong brief của người tham gia.

Campaign-level summary artifact phải reference các per-evaluation-instance artifact thay vì copy metric không có provenance.

---

## 23. Reproducibility contract

Một evaluation instance được coi reproducible ở protocol level khi có đủ:

```text
experiment_id + run_id + scenario_id + repeat_index theo canonical execution identity
immutable RunGroundTruth reference
selected telemetry artifact ID(s) + checksum/URI
TelemetryQualityReport
campaign/split assignment
phiên bản dữ liệu seed và trạng thái reset
feature schema/config + noise_filter_version
model/detector config + seed
incident config
RCA config + seed/tie rule (hoặc luật baseline thủ công)
evaluation config
rca_result_schema_version
candidate set version
analysis code commit
environment profile/config
for degraded: source artifact + transform config + seed + parameters
```

Cùng immutable input + cùng config/seed phải tạo output tương đương deterministic trong tolerance của runtime/library. Nếu library có nondeterminism không loại bỏ được, phải ghi rõ và không giả tuyên bố bit-for-bit reproducibility. Thử nghiệm người **không** reproducible theo nghĩa này (người khác nhau, thời điểm khác nhau); chỉ giữ được bản ghi, brief và cấu hình để audit.

---

## 24. Minimal campaign execution order

Đây là **protocol dependency order**, không phải implementation backlog priority:

```text
1. Cài fault injector và workload k6 (thuộc mảng AI; chưa có)
2. Pilot theo từng case: kiểm chứng điều kiện vào campaign (mục 5.2), đo độ trễ lan truyền, chốt phase duration/cường độ
3. Freeze execution/scenario parameters đủ để tạo clean dataset; chốt K, R
4. Collect healthy training runs
5. Fit training-only preprocessing/detector state
6. Run validation set; chọn/freeze analysis configs và luật baseline thủ công tự động
7. Freeze final-test campaign manifest và protocol thử nghiệm người
8. Execute/select eligible final-test runs theo predeclared gate
9. Run frozen analysis variants và base-manual-auto
10. Produce immutable per-evaluation-instance artifacts (gồm RcaIncidentResult)
11. Chạy thử nghiệm người trên run final test đã freeze (mục 15.3)
12. Aggregate RQ1–RQ5 và đối chứng thủ công từ final-test artifacts
13. Preserve excluded/invalid run ledger và failure analysis
```

Không được quay từ bước 9/10 về bước 6 chỉ vì final metric thấp mà vẫn giữ cùng final campaign identity.

---

## 25. Feasibility checklist cho collaborator review

Artifact này không tự coi review là hoàn tất. Đức cần xác nhận tối thiểu (refactor một người, người xác nhận là Đức):

| Concern | Điều cần xác nhận |
| --- | --- |
| Run identity/split | Runner giữ semantic canonical của `experiment_id`, sinh unique `run_id`, lấy `scenario_id` (kể cả healthy scenario) và `repeat_index` từ execution truth, rồi giữ assignment validation/test ổn định được. |
| Ground truth | `fault_start/end`, activation/deactivation/reset/verification và root-cause truth được lưu trước evaluation, không phụ thuộc model output; `root_cause_service` khớp bảng 4.2. |
| Candidate set | Đồng ý `service-candidates.v1` 10 service (gateway là symptom, không phải candidate) hoặc yêu cầu đưa gateway vào. |
| Điều kiện vào campaign | Fault injector cho C1–C5, C7 sẽ có; pilot đo được độ trễ lan truyền; chuỗi C1 sang `media-worker` được xác nhận hoặc mô tả lại. |
| Floor | Chấp nhận `R = 3` (1 validation + 2 test mỗi case) thừa kế từ v0, và quyết định `K` tối thiểu. |
| Healthy runs | Có thể chạy dedicated healthy train/validation/test với seed tách biệt, gồm normal mixed, healthy high-load và các profile chuyên biệt (batch lớn, upload peak, AI job). |
| Artifact lineage | Mỗi telemetry/derived artifact có immutable ID/location/checksum và quality report; một run có thể reference nhiều variant không overwrite nhau. |
| Quality gate | Runner/exporter có đủ phase coverage/required signal metadata để classify pass/partial/fail theo variant, gồm phân loại Tempo OOM/gauge thiếu là source outage chứ không phải degradation. |
| Nhiễu | Luật lọc trace `/ready` và thăm dò scheduler-worker được version hóa và dùng chung. |
| RQ1 | Có thể materialize/select `M`, `M+T`, `M+T+L` từ cùng run lineage. |
| RQ2 | Trace artifact đủ dựng dynamic service graph (kể cả async edge qua `traceparent`); chấp nhận cạnh scheduler → scheduler-worker thiếu. |
| RQ3 | UTC timestamp/onset đủ ổn định, chấp nhận độ trễ thu thập khác nhau theo modality. |
| RQ4 | Có thể tạo whole-trace 50% drop derived artifact reproducibly trên trace v2, giữ source lineage/seed; xác nhận fallback `message_id` có đủ dữ liệu ở span PRODUCER. |
| System metrics | Analysis timing/CPU/memory/artifact size và application throughput/p95 có đường đo khả thi; testbed có cấu hình tắt export telemetry không đổi code path (chưa kiểm chứng). |
| Đối chứng thủ công | Luật `base-manual-auto` được thiết kế và freeze; số người, time cap, brief, cách nạp lại telemetry (retention 24 giờ) được chốt; Đức không là người tham gia. |
| `RcaIncidentResult` | Schema `"0"` và nơi lưu đề xuất ở catalogue đủ để chấm; owner-level Top-K có được chấp nhận. |
| Rerun | Invalid/quality-failed run có thể rerun bằng run ID mới trong khi original ledger vẫn giữ. |

Nếu một requirement không khả thi trong Compose/runner dự kiến, cần ghi finding và điều chỉnh **evaluation implementation/config trong boundary của tài liệu này**. Không tự sửa RQ, fault catalogue, topology, `RcaIncidentResult` hoặc truth/telemetry schema để né limitation.

---

## 26. Checkpoint

Bảng này chỉ ghi điều đã viết trong protocol và điều đã có bằng chứng chạy; không đánh dấu hoàn thành khi chưa có output.

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Protocol viết lại theo topology v2 (candidate, fault/case, workflow, floor) | Đã viết, **chưa Đức xác nhận** | Mục 4–5, 8 |
| Manifest, split theo run, freeze test campaign | Đã viết | Mục 3, 5–6, 21–24 |
| Detection, RCA service-level, system metrics, `RcaIncidentResult` làm đầu ra | Đã viết | Mục 14, 16–22 |
| Baseline/ablation/robustness | Đã viết; chưa chạy | Mục 10–13 |
| Đối chứng thủ công và thời gian chẩn đoán (ADR-002) | Đã viết; chưa có luật baseline, chưa có người tham gia, chưa có số đo | Mục 15 |
| Telemetry đủ để chấm | **Đã đo** cho 9 luồng, 11 runtime, 38 cạnh, 24 queue; thiếu các tín hiệu ở mục 1.3 | [Catalogue case mục 1 và 4](complex-case-catalogue-and-rca-result-v0.md) |
| Case chạy thật | **Chỉ C6** (smoke, một lần); C1–C5, C7 mới đo tín hiệu | Mục 4.2 |
| Fault injector, workload k6, dataset, RCA engine, MCP | **Chưa có** | Mục 1.3 |
| Đức review orchestration/lưu artifact | **Chưa xác nhận** | Mục 25 |

---

## 27. Giá trị còn nằm ở pilot/versioned config và đề xuất chờ Đức

Protocol đã chốt **cách chọn, nơi lưu và freeze** nhưng không hard-code các numeric execution value chưa có bằng chứng pilot:

- exact phase duration và thời gian fault active theo từng case;
- exact workload rate/stage duration;
- exact fault intensity/delay/CPU parameter (cường độ gợi ý ở catalogue: batch 100000 recipient cho C1, TTL token 60 giây cho C6);
- exact dependency timeout millisecond;
- exact scrape interval/data-quality numeric threshold;
- exact window size nếu validation chọn khác initial `60s/15s` (thừa kế v0, chưa kiểm chứng trên v2);
- exact persistence window count;
- exact detector threshold/hyperparameter;
- exact fusion/RCA weight;
- luật chi tiết của `base-manual-auto`;
- time cap, số lượt và brief của thử nghiệm người.

Các giá trị này phải được chọn đúng train/validation rule, lưu trong versioned config và xuất hiện trong frozen final campaign manifest. Việc chưa hard-code numeric trước pilot **không** cho phép thay chúng sau khi đã xem final test.

RQ4 là ngoại lệ đã được protocol v0 freeze ở mức comparison design và v1 giữ: **whole-trace 50% controlled drop**, với exact deterministic seed/value được ghi trong campaign/degradation config trước final test; khả thi trên trace v2 chưa kiểm chứng (mục 13.1).

**Danh sách đề xuất/quyết định chờ Đức xác nhận** (không phải số đo, không có bằng chứng v2):

1. Candidate set 10 service, loại `gateway` (mục 4.1), thay vì 11.
2. `R = 3` repetition mỗi case, thừa kế v0 (mục 5.3); `K` tối thiểu để kết luận.
3. Owner-level Top-K như diagnostic phụ (mục 4.2).
4. Các profile healthy v2 (mục 5.4) và số run healthy mỗi profile.
5. Số người, time cap, brief và cách nạp lại telemetry của thử nghiệm người (mục 15.3); cách chuẩn hóa so sánh `T_human` với `T_engine` (mục 15.4).
6. Có đưa FF thành case đánh giá riêng hay không (mục 4.2).
7. Các điều chỉnh tài liệu nguồn còn lệch: component FB (`notification-worker-rabbitmq` hay `notification-rabbitmq`), triệu chứng FG (504 đã đo hay 503 ở fault matrix v2), và các tài liệu direction/blueprint còn v1 (mục 1).

---

## 28. Kết luận v1

Evaluation protocol v1 giữ nguyên khung đánh giá của v0 và gắn lại với kiến trúc v2 thật:

- split theo experiment run; healthy training / validation / final-test boundary chống leakage;
- fault FA–FH và case C1–C7 (kèm trạng thái kiểm chứng từng case) thay F1–F5;
- điều kiện vào campaign theo từng case và floor dựa trên `K × R` thay vì con số cố định `5 × 3`;
- candidate set 10 service v2 (worker là candidate riêng, hạ tầng là evidence);
- incident matching/tolerance, healthy-run FPR semantics và RCA metric denominator/coverage giữ nguyên, bổ sung khoảng yên lặng/độ trễ lan truyền;
- RQ1–RQ3 ablation controls và RQ4 strict paired whole-trace 50% degradation, kèm các điều kiện của trace v2 (async qua `traceparent`, cạnh thiếu, nhiễu);
- đối chứng thủ công (baseline tự động + thử nghiệm người) và thời gian chẩn đoán theo ADR-002;
- `RcaIncidentResult` là đầu ra được chấm;
- immutable experiment/evaluation artifact lineage, test campaign freeze và validity-only rerun rule.

Không có requirement nào trong protocol này yêu cầu đổi service topology, ownership, HTTP/event contract, fault semantics, telemetry schema, `RunGroundTruth` hoặc `RcaIncidentResult`. Số đo thật hiện có chỉ là số đo telemetry (catalogue case mục 1, 4) và kết quả smoke của C6; chưa có số đo detection, RCA, thời gian chẩn đoán hay đối chứng thủ công nào.

---

## 29. Khác biệt so với v0

| Mục | v0 | v1 |
| --- | --- | --- |
| Topology | v1: 6 business service + gateway | v2: 7 service + 4 worker, 11 `service.name`, 16 dependency identity |
| Fault | F1–F5 (Redis, Storage Mock, error, consumer, CPU) | FA–FH ([fault matrix v2](data-ownership-and-fault-matrix-v2.md)) và case C1–C7 ([catalogue](complex-case-catalogue-and-rca-result-v0.md)); FF không có case |
| Trạng thái case | không có (mọi fault đều có cơ chế) | mỗi case ghi **đã chạy / đã đo tín hiệu / giả thuyết**; chỉ C6 đã chạy; điều kiện vào campaign theo từng case (mục 5.2) |
| Candidate set | `service-candidates.v0`: 6 business service | `service-candidates.v1`: 10 service (worker riêng, hạ tầng là evidence, gateway là symptom); đề xuất chờ Đức |
| Tie-break | `auth < course < enrollment < submission < grading < notification` | thứ tự catalogue v2 mục 8 cho 10 service |
| Floor | `5 × 3 = 15` fault run (5 validation, 10 test) | `K × R` với `R = 3` đề xuất; `K` là số case đủ điều kiện; ví dụ 21 chỉ khi đủ bảy case |
| Top-3 saturation | 3 root cause trên 6 candidate, Top-3 có thể 100% | 5 root cause trên 10 candidate; ranking hằng tốt nhất ≈ 71% Top-3 nếu đủ bảy case (số học, không đo); phải đọc cùng `K` |
| Workload | normal mixed, submission peak, grading burst, healthy spike | profile theo W1–W7: normal mixed, high-load spike, batch thông báo lớn, upload peak, AI job (đề xuất; k6 chưa có) |
| Fault ở RQ4 fallback | F4 async fallback | async qua `traceparent` (cùng trace); fallback `message_id` + temporal; khả thi chưa kiểm chứng |
| Đối chứng thủ công | không có | mục 15: baseline thủ công tự động, thử nghiệm người, thời gian chẩn đoán, agent MCP tùy chọn |
| Prediction artifact | `prediction.json` không có schema cụ thể | `RcaIncidentResult` (`rca_result_schema_version = "0"`), mục 16 |
| `insufficient_evidence` | không có | tính end-to-end miss, đếm riêng, không vào conditional metric |
| Độ trễ lan truyền | không có | mục 7.3: khoảng yên lặng C6 (đã đo 70–74 giây ở TTL 60 giây), fault active phải dài hơn độ trễ triệu chứng |
| Tín hiệu theo case | fault-to-telemetry requirement của W4-T4 | bảng 8.4 từ catalogue: tín hiệu có thật và tín hiệu chưa có |
| Nhiễu telemetry | không có | mục 8.5: lọc trace `/ready` và thăm dò scheduler-worker, `noise_filter_version` |
| Identity | `scenario_id` F1–F5 | `scenario_id` FA–FH + `case_id` C1–C7 + `analyst_kind`, `case_verification_status` |
| Manifest/protocol version | `evaluation-instance.v0`, `evaluation-protocol.v0` | `evaluation-instance.v1`, `evaluation-protocol.v1` |
| Owner-level Top-K | không có | diagnostic phụ cho cặp service/worker cùng owner |
| DoD/checkpoint | DoD W4-T5 "Đạt trong protocol" | checkpoint tách điều đã đo khỏi điều chưa làm (mục 26); chưa Đức xác nhận |
| Giữ nguyên | split theo `run_id`, freeze, anti-leakage, incident matching, healthy-run FPR, end-to-end RCA denominator, RQ1–RQ5, RQ4 whole-trace 50%, lineage/immutability, rerun chỉ vì validity | — |
