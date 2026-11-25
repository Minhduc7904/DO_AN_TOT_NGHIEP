# Evaluation protocol v1

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Cập nhật 17/11/2026 ([ADR-006](../adr/adr-006-trim-project-scope-v1.md)):** bộ case MVP còn C2 (viết lại bằng chèn trễ `course-postgres`), C3, C4, C6 với đề xuất `R = 5` (1 run validation, 4 run final test, 20 fault run) thay cho 7 × 3; C1, C5, C7 là Target; thử nghiệm người thật (mục 15) xuống Target, 2–3 người; `base-manual-auto` định nghĩa lại; đánh giá chất lượng báo cáo agent/MCP không còn áp dụng. Khi đoạn chi tiết mâu thuẫn, ADR-006 được ưu tiên.
>
> **Cập nhật 17/11/2026 ([ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md)):** traffic học viên là **bán thực** (mức 2+, phát lại phiên thật từ log Moodle Unistudium 2022), giảng viên/admin/job lịch dùng mức 2; healthy profile nối với workload này (mục 5.4). Bộ bằng chứng E1–E8 thay cách đọc RQ cũ (bảng ánh xạ ở mục 1.4): E1 phát hiện dưới tải bán thực so với ngưỡng cố định (mục 17.8); E2 bảng chính thêm **SimpleRCA** và **BARO** (mục 15.2.1), chỉ số chính Top-1 và MRR kèm random/xếp hạng hằng, bootstrap CI 95% và McNemar exact (mục 20.7); E3 thay RQ4 "bỏ 50% trace" bằng quan sát suy giảm gồm giữ 50% và 10% trace, log mất `trace_id`, mất một modality (mục 13); E4 chi phí chẩn đoán (mục 15.4); E6 đối chứng ngoài RCAEval RE2 (mục 15.7, Target); E7 thử nghiệm người (mục 15.3, Target, chốt người tham gia trước tuần 15 của [plan-v0.4](../plan/plan-v0.4-24-weeks.md)); mỗi case MVP có ít nhất một run test đặt fault trùng cao điểm tải (mục 5.3); đăng ký trước ở mốc freeze tuần 19 (mục 6.3). Nguồn tham khảo dùng mã khóa của [literature-matrix-v1](../plan/literature-matrix-v1.md). Khi đoạn chi tiết mâu thuẫn, ADR-007 được ưu tiên, sau đó tới ADR-006.
>
> **Cập nhật 23/11/2026 (task-06 tuần 15, sau pilot):** giá trị chốt bằng số đo pilot của task-02 và task-03 ở mục 6.1.1, mỗi giá trị trỏ về `run_id` hoặc file nguồn; tập ứng viên window, persistence, ngưỡng robust z và luật chọn cho validation khai báo ở mục 6.1.2, trước khi chấm bất kỳ detector nào trên validation. E7 ra khỏi kế hoạch (mục 15.3). Các mục 1.3, 4.2, 5.2, 5.4, 6.3, 7.2, 7.3, 8.3, 8.4, 8.5, 15.3, 17.5, 20.7, 25, 26, 27, 28, 29 sửa theo số đo này.
>
> **Trạng thái:** Đề xuất. Ban đầu ghi "chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review)"; từ 17/11/2026 Bách tự quyết các điểm còn mở trong giai đoạn bắt kịp tiến độ (ADR-006, ADR-007), Đức xác nhận khi repo ổn định tới phase RCA. Đã có ở tuần 13 (PR đang mở, chưa merge): cơ chế gây lỗi cho C2, C3, C4 ([PR #75](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/75)), workload k6 mức 1 ([PR #76](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/76)), export telemetry theo run ([PR #77](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/77)), kiểm chất lượng telemetry ([PR #79](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/79)). Bản đầu viết khi chưa có run nào chạy theo protocol này. Từ tuần 15 có 9 run pilot của task-03 và 2 run tìm điểm gãy của task-02 (mục 6.1.1); chưa có RCA engine. Mọi con số đo ghi trong tài liệu đều lấy từ các artifact đã có (mục 1.3, 6.1.1).
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
- Đối chứng thủ công: baseline thủ công tự động, đo thời gian chẩn đoán (ADR-002). Thử nghiệm người (E7) đã ra khỏi kế hoạch ngày 19/11/2026 (mục 15.3).
- Baseline RCA bên ngoài (SimpleRCA, BARO), đối chứng ngoài RCAEval và cách đọc bộ bằng chứng E1–E8 (ADR-007).
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

Bảng giữ trạng thái ngày 16/11/2026. Sau pilot tuần 15 (23/11/2026): workload mức 2+ và mức 2 đã có (mục 6.1.1 bảng B), dataset v0 đang chạy ([dataset-v0](dataset-v0.md)), feature pipeline v1 và baseline robust z fit trên train ở task-05 (mục 6.1.1 bảng F, G); trạng thái tổng hợp ở mục 26.

| Hạng mục | Đã có (bằng chứng) | Chưa có (dự kiến, chưa kiểm chứng) |
| --- | --- | --- |
| Topology | 11 runtime (7 service + 4 worker) chạy bằng `compose.full.yaml`; 11 `service.name` canonical ([catalogue mục 2.1](service-catalogue-and-topology-v2.md)) | — |
| Telemetry | 9/9 luồng xuyên service có trace đủ service; 11/11 runtime có RED, CPU, RSS và log; 38 cạnh dependency; 24 queue ([catalogue case mục 4.1](complex-case-catalogue-and-rca-result-v0.md)); lệnh lặp lại `pnpm run test:observability`. Đo thêm ở tuần 13 (PR #77, #79): khi runtime bị `docker pause`, OTel Collector vẫn xuất giá trị cuối của mọi series thêm khoảng 5 phút (Prometheus vẫn có mẫu mỗi 5 giây, giá trị đứng yên; đo khi pause `scheduler` 70 giây), nên phải xem `process_cpu_time_seconds_total` có tăng không để biết runtime còn sống; sau khi lọc access log của probe, 4 worker không còn log nào (`not_instrumented`); `notification-worker` khi phát lại command từ outbox dùng identity `notification-rabbitmq` thay vì `notification-worker-rabbitmq` (lệch schema v1 mục 3.2.4, chưa sửa) | Pool kết nối PostgreSQL, tuổi message cũ nhất, metric publish/consume RabbitMQ ở runtime, độ trễ outbox, log consumer của worker, nối scheduler → scheduler-worker ([catalogue case mục 1.5](complex-case-catalogue-and-rca-result-v0.md)) |
| Độ trễ thu thập | Log vào Loki ≈ 2 giây, trace vào Tempo ≈ 2,5 giây, counter vào Prometheus ≈ 4–10 giây, backlog queue ≈ 9 giây (catalogue case mục 1.4); tải trace từ Tempo khoảng 0,1 giây/trace, Tempo thỉnh thoảng khựng gây `ReadTimeout` (PR #77) | — |
| Case C1–C7 | C6: **đã chạy** bởi [tracing-smoke](../../../lms/test/observability/tracing-smoke.mjs) (login 504 ngay, token còn hạn vẫn 200, lỗi `gateway-identity-token` sau **70–74 giây** với TTL 60 giây, phục hồi sau `unpause`). C2, C3, C4: **cơ chế gây lỗi đã cài** ở PR #75 (overlay `aiops-platform/faults/compose.faults.yaml` ghép sau `compose.full.yaml`, stack 23 container): toxiproxy 2.12.0 với proxy `course-to-postgres` (C2), `media-to-minio` và `media-worker-to-minio` (C4), `llm-stub` OpenAI-compatible chỉnh độ trễ/jitter/tỉ lệ lỗi lúc chạy (C3), CLI `fault-control.mjs` in một dòng JSON có `ts`. Đã đo đáp ứng: proxy thêm ~0,02 ms/truy vấn; trễ 200 ms ở `course-to-postgres` → p50 `course-postgres` ~0,175–0,204 giây; MinIO 300 ms → ~0,6 giây (2 lượt); LLM 2000 ± 500 ms → 2,36 giây; `error_rate = 1` → job AI `FAILED` (`AI_PROVIDER_ERROR`). C1, C5, C7 (Target): **đã đo tín hiệu**, cơ chế **chưa chạy** | Pilot tuần 15 đã chạy C2, C3, C4, C6 (9 run, mục 6.1.1); dataset v0 đang chạy. Upload trực tiếp client → MinIO **không** đi qua proxy nên C4 chỉ tác động phía `media`/`media-worker`. C6 vẫn dùng `docker pause identity`. Chuỗi lan C1 sang `media-worker` là **giả thuyết** |
| Workload | k6 mức 1 (PR #76, `grafana/k6:1.3.0`, `run-k6.sh level-1`, mỗi hành trình W1–W7 một scenario `constant-vus`, tóm tắt `results/<RUN_ID>/k6-summary.json` có `started_at`/`finished_at`); run 2 phút: 7/7 hành trình, 737 request, 0 lỗi ngoài mong đợi. Thiết kế mức 1 + 2 ở [workload-design-v1](workload-design-v1.md) (PR #78, đang bổ sung mức 2+ và mức 3 offline) | Mức 2+ (phát lại phiên học viên từ log Moodle), mức 2 cho giảng viên/admin/job lịch, kiểm chứng độ thực bằng hold-out (ADR-007 mục 1–2, tuần 14 của plan-v0.4) |
| Dữ liệu | Seeder R-10 ghi trực tiếp SQL, id bắt đầu bằng `5eed`, không tạo trace/log nghiệp vụ ([fault matrix mục 2.9](data-ownership-and-fault-matrix-v2.md)) | Dataset fault run, healthy run, split, ground truth theo run: chưa có |
| RCA engine, training | Schema `RcaIncidentResult` và nơi lưu đề xuất (catalogue case mục 5). `aiops-platform/training/` (PR #77, #79): `uv run aiops-training export` → `artifacts/<run_id>/{metrics,spans,logs}.parquet` + `manifest.json` (schema `telemetry.v2`), lọc trace nhiễu (`GET /ready`, `GET /health`, thăm dò `scheduler-postgres`); `uv run aiops-training quality` → `quality-report.json` (`pass`/`partial`/`fail`, `telemetry_silent`, `not_instrumented`). Run thử: 152 608 điểm metric, 8 943 span (721 trace), 1 649 log, 82 giây | RCA engine, baseline SimpleRCA/BARO, `base-manual-auto`: chưa có; chưa có kết quả Top-K/MRR/Delay nào. MCP/agent: Out-of-scope (ADR-006) |
| Đối chứng thủ công | Quyết định ở ADR-002 mục 3–4 | Baseline thủ công tự động chưa làm; thử nghiệm người (E7) đã ra khỏi kế hoạch (mục 15.3); chưa có thời gian chẩn đoán nào |
| Retention | Prometheus, Tempo, Loki giữ 24 giờ ([observability README](../../../aiops-platform/observability/README.md)) | Cách lưu/phát lại telemetry của một run ngoài 24 giờ: chưa kiểm chứng (export Parquet ở PR #77 giữ được dữ liệu cho phân tích offline, chưa nạp lại được vào Grafana cho người dùng) |

### 1.4. Bộ bằng chứng E1–E8 (ADR-007) và mục tương ứng

Lập luận trung tâm của ADR-007: khi quan sát đầy đủ và tải đơn giản, luật đơn giản hoặc người đã đủ tìm ra nguyên nhân, và nhóm báo cáo trung thực điều này. Nghiên cứu gần đây ủng hộ cách đặt vấn đề đó: đánh giá 21 phương pháp RCA cho thấy không phương pháp nào nổi trội ở mọi tình huống và nhiều phương pháp causal cho kết quả gần như chọn ngẫu nhiên (Pham et al., ASE 2024, [arXiv 2408.13729](https://arxiv.org/abs/2408.13729), `[L-Pham2024ASE]`); SimpleRCA (đếm cảnh báo theo service) "ngang hoặc vượt" các phương pháp SOTA trên nhiều bộ dữ liệu công khai, và workload đơn giản làm đánh giá RCA bị thổi phồng: trên bộ dữ liệu mới có lan truyền lỗi, Top-1 trung bình của 11 phương pháp chỉ còn 0,21 (Fang et al. 2025, FSE 2026, [arXiv 2510.04711](https://arxiv.org/abs/2510.04711), `[L-Fang2025]`). Vì vậy giá trị của RCA engine được đo ở bốn chỗ: phát hiện trong nhiễu của tải thật, giữ độ chính xác khi quan sát thiếu, giảm công sức chẩn đoán, chạy tự động và ổn định.

| # | Bằng chứng | Mức | RQ liên quan | Mục trong protocol |
| --- | --- | --- | --- | --- |
| E1 | Phát hiện dưới tải bán thực: detector học máy so với ngưỡng cố định (báo động giả/giờ, độ trễ phát hiện, recall) | MVP | RQ1, RQ5 | 5.4, 17.7, 17.8 |
| E2 | Bảng chính: engine so với random, xếp hạng hằng, ngưỡng tĩnh, `base-manual-auto`, SimpleRCA, BARO; Top-1 và MRR chính, kèm Top-3; theo case; bootstrap CI 95%; McNemar exact | MVP | RQ2, RQ3, RQ6 | 15.2, 15.2.1, 15.5, 18, 20.7 |
| E3 | Quan sát suy giảm: giữ 50% và 10% trace, log mất `trace_id`, mất một modality | MVP | RQ4 | 13 |
| E4 | Chi phí chẩn đoán: số artifact `base-manual-auto` phải mở và thời gian, so với bằng chứng engine trả sẵn | MVP | RQ6, RQ5 | 15.4 |
| E5 | Ablation: bỏ từng modality, bỏ graph, bỏ temporal, thay detector học máy bằng z-score | MVP | RQ1, RQ2, RQ3 | 10, 11, 12 |
| E6 | Đối chứng ngoài trên RCAEval RE2 (Online Boutique, Train Ticket) | Target | RQ6 (tính tổng quát) | 15.7 |
| E7 | Thử nghiệm người within-subject | Target, **ra khỏi kế hoạch** (19/11/2026, mục 15.3) | RQ6 | 15.3 |
| E8 | Case study C6: chuỗi bằng chứng của engine đặt cạnh đường truy vết thủ công | MVP | RQ6 (tính diễn giải) | 15.8 |

Bộ case vẫn là bốn case MVP của ADR-006 với `R = 5` làm sàn (mục 5.3); điều kiện tiên quyết về độ thực của workload (hold-out, so ba nguồn tải) thuộc [workload-design-v1](workload-design-v1.md) và ADR-007 mục 2, protocol này chỉ dùng kết quả của bước đó (mục 5.4, 6.3).

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
analysis_variant_id    = điều kiện evaluation/ablation, ví dụ rq1-m, rq2-graph, rq4-trace-keep50, base-manual-auto, simplerca, baro
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
  -> evaluation_instance_id cho analysis_variant_id=rq4-trace-keep50
  -> evaluation_instance_id cho analysis_variant_id=rq4-trace-keep10
  -> evaluation_instance_id cho analysis_variant_id=rq4-log-no-trace-id
  -> evaluation_instance_id cho analysis_variant_id=base-manual-auto
  -> evaluation_instance_id cho analysis_variant_id=simplerca
  -> evaluation_instance_id cho analysis_variant_id=baro
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
- analyst_kind                     # rca_engine | manual_baseline_auto | simplerca_baseline | baro_baseline | static_threshold_baseline | constant_ranking_reference | random_ranking_reference (ADR-007 thêm SimpleRCA, BARO, random)
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

- Đây là **10 trong 11 `service.name` canonical** của topology v2. `gateway` là điểm quan sát triệu chứng (symptom) mặc định và **không** nằm trong candidate set, vì không fault nào trong FA–FH có root cause ở `gateway` (catalogue mục 8: gateway chỉ là candidate khi evaluation protocol có gateway fault). Nếu về sau thêm gateway fault, phải bump `candidate_set_version` và thêm `gateway` cho cả campaign. **Đã chốt** ở Gate R ([plan-v0.3](../plan/plan-v0.3-24-weeks.md)): candidate set 10 service/worker. Brief ban đầu của task ghi "candidate = toàn bộ `service.name`"; tài liệu này dùng 10 (sau R-13: `auth` + `student` → `identity`) vì catalogue v2 mục 8 nói rõ gateway không phải candidate khi chưa có gateway fault. Nếu sau này cần đưa gateway vào candidate universe, chỉ cần sửa tập này và tie-break ở mục 18.1.
- Worker là candidate **riêng** với service cùng owner (`media` khác `media-worker`, `notification` khác `notification-worker`, `ai` khác `ai-worker`, `scheduler` khác `scheduler-worker`) vì có `service.name` riêng để Analysis phân biệt nguồn triệu chứng (catalogue mục 4, ownership rule 7).
- PostgreSQL (6 identity `<service>-postgres`), RabbitMQ (`*-rabbitmq`), MinIO (`media-minio`), SMTP (`notification-smtp`), LLM provider (`ai-llm-provider`) và cạnh xác thực (`<caller>-identity-token`, `<caller>-identity-jwks`) là **evidence/component**, không nằm trong primary Top-K/MRR list.
- Candidate không được drop chỉ vì modality của candidate bị missing. Missingness phải được xử lý bằng fallback/score semantics đã version hóa.
- Mọi RCA variant (và baseline thủ công) phải trả cùng candidate universe để comparison không bị thay denominator.

Quy ước đọc telemetry ảnh hưởng tới việc chấm (catalogue case mục 2): span PRODUCER thuộc tiến trình relay chứ không nhất thiết thuộc service ghi command; queue thuộc worker tiêu thụ (`service_name` của metric broker là tiền tố trước `--`); triệu chứng lỗi xác thực nằm ở cạnh `<service>-identity-token` của bên gọi. Evaluator chấm theo `root_cause_service` của `RunGroundTruth`, **không** theo `service.name` của span nơi triệu chứng xuất hiện.

### 4.2. Fault, case và ground truth

Ground truth root cause của campaign chỉ theo fault matrix/catalogue canonical. Cột "Trạng thái" lấy từ [catalogue case mục 3](complex-case-catalogue-and-rca-result-v0.md), cập nhật ngày 17/11/2026 theo ADR-006 (C2 viết lại, mức MVP/Target) và PR #75 (cơ chế gây lỗi đã cài), rồi theo pilot tuần 15 cho C2, C3, C4, C6 ([fault-pilot-report-v1](fault-pilot-report-v1.md) mục 3). Trạng thái **không** đồng nghĩa case đã đủ điều kiện vào campaign (xem mục 5.2); kết luận điều kiện vào campaign ở mục 6.1.1 bảng I.

| Case | Fault | `fault_type` | `root_cause_service` | `root_cause_component` | Triệu chứng chính | Trạng thái kiểm chứng |
| --- | --- | --- | --- | --- | --- | --- |
| C1 (Target) | FB | `queue_backlog` | `notification-worker` | `notification-worker-rabbitmq` | `upload-complete` của `media` chậm/timeout | **Đã đo tín hiệu**; chuỗi lan sang `media-worker` là **giả thuyết** |
| C2 (MVP) | FC | `dependency_latency` (viết lại theo ADR-006; bản cũ `db_connection_hold`) | `course` | `course-postgres` | enroll/quiz submit chậm; span `course-postgres` chậm, không span lỗi | **Đã pilot** tuần 15, `case_verification_status = run` (mục 6.1.1). Vai trò case đối chứng dễ (ADR-006); ở profile `healthy-spike` cùng cường độ thành cạn pool và 504 tại gateway |
| C3 (MVP) | FD | `dependency_latency` | `ai` | `ai-llm-provider` | lời gọi provider chậm 30–35 s, job AI chậm và dồn (chưa ack) ở `ai-worker`; job vẫn hoàn tất. Chỉ khi trễ vượt `AI_COMPLETION_TIMEOUT_MS` (240 s) mới thành `WORKER_INTERRUPTED`; với `error_rate = 1`: job `FAILED` (`AI_PROVIDER_ERROR`) | **Đã pilot** tuần 15, `case_verification_status = run` (mục 6.1.1). Cường độ đã chốt không vượt timeout |
| C4 (MVP) | FA | `dependency_latency` | `media` | `media-minio` | upload chậm (`media → MinIO`, `gateway → media`), `media-worker` tạo thumbnail chậm | **Đã pilot** tuần 15, `case_verification_status = run` (mục 6.1.1). Chuỗi "media `PENDING` kẹt → cleanup xóa media" của bản trước không lộ trong run 48 phút và bị bỏ; upload client → MinIO không qua proxy |
| C5 (Target) | FE | `dependency_latency` | `identity` | `identity-postgres` | batch `PARTIAL_FAILED`, số item lệch | **Đã đo tín hiệu**; chèn trễ chưa chạy |
| C6 (MVP) | FG | `dependency_unavailable` | `identity` | `identity` | mọi route qua gateway lỗi 504 sau khoảng yên lặng | **Đã chạy** (tracing-smoke, 70–74 giây với TTL 60 giây) và **đã pilot** tuần 15 (khoảng yên lặng 1,2–20 giây), `case_verification_status = run` (mục 6.1.1); cơ chế `docker pause identity` |
| C7 (Target) | FH | `config_drift` | `identity` | `identity-jwks` | 401 đồng loạt ở nhiều service | **Đã đo tín hiệu**; cơ chế đổi khóa chưa chạy |
| — | FF | quá tải tài nguyên | bất kỳ service | instance | latency/error lan theo dependency | Không có case riêng; CPU/RSS là bằng chứng phụ cho C1–C2 |

Ghi chú nguồn:

- (Cập nhật 17/11/2026: fault matrix v2, catalogue v2 và blueprint v2 nay đều ghi component FB là `notification-worker-rabbitmq`, FG đo được 504; ghi chú dưới đây giữ làm lịch sử.) Catalogue case (R-12) chốt chi tiết ma trận fault v0 ở fault matrix v2; hai tài liệu khác nhau ở: component của FB (`notification-worker-rabbitmq` ở catalogue, `notification-rabbitmq` ở fault matrix v2), triệu chứng của C6/FG (504 ngay tại gateway ở catalogue, đã đo; 503 và "≤ 10 phút" ở fault matrix v2, đề xuất ban đầu), và C7/FH chỉ có đầy đủ ở catalogue. Tài liệu này dùng catalogue (số đo thật). `RunGroundTruth` của schema v1 quyết định giá trị cuối cùng của `root_cause_component`; component không tham gia primary metric.
- FA (`media` / `media-worker`) và FD (`ai` / process `ai-worker`) có hai process cùng owner. Catalogue ghi `root_cause_service` là service owner. Primary metric chấm **đúng `root_cause_service` của `RunGroundTruth`**. Để không phạt oan khi engine chỉ ra worker thay vì service cùng owner, báo cáo thêm **owner-level Top-K** (gộp `X` và `X-worker` thành một owner) như diagnostic phụ, không thay primary metric. Đề xuất (ban đầu ghi "chờ Đức xác nhận"); trong giai đoạn tự bắt kịp, Bách chốt ở bản đăng ký trước (mục 6.3).
- Phân bố root cause của bảy case: `notification-worker`, `course`, `ai`, `media`, `identity`, `identity`, `identity` — năm service khác nhau trên tổng 10 candidate, `identity` xuất hiện ba lần (C5, C6, C7; trước R-13 là `student` một lần và `auth` hai lần). Ba case này khác nhau ở `component` (`identity-postgres`, tiến trình `identity`, `identity-jwks`) nhưng cùng `root_cause_service`, nên primary metric service-level không phân biệt được chúng; phần phân biệt chỉ là diagnostic.
- Bộ case MVP của ADR-006 (C2, C3, C4, C6) có bốn `root_cause_service` khác nhau (`course`, `ai`, `media`, `identity`), mỗi service một case.
- FF không có case: không vào floor. Nếu muốn thêm case quá tải tài nguyên làm case đánh giá thì cần bổ sung vào catalogue trước, rồi bump `campaign_manifest_version`.

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

V0 đặt floor theo năm fault đã có cơ chế. Khi viết bản đầu, ở v2 chỉ C6 đã chạy và mới ở mức smoke (một lần, không phải dataset run); C2, C3, C4 đã có cơ chế gây lỗi (PR #75) nhưng chưa pilot; C1, C5, C7 (Target) mới đo tín hiệu. Sau pilot tuần 15, C2, C3, C4, C6 đủ năm điều kiện dưới đây (`K = 4`, mục 6.1.1). Vì vậy floor **không** được viết như một con số cố định cho bảy case. Một case C1–C7 chỉ được đưa vào campaign khi thỏa **đủ** các điều kiện sau, được ghi trong `campaign_manifest`:

1. **Fault injector chạy được và tái lập được:** bật/tắt được, có `fault_start`/`fault_end`/reset, không đổi code nghiệp vụ (fault matrix v2 mục 5). Đã có ở PR #75 cho C2, C3, C4 (CLI `fault-control.mjs` in mỗi thao tác một dòng JSON có `ts`, dùng làm nguồn `fault_start`/`fault_end`); C6 dùng `docker pause`/`unpause identity`; chưa có cho C1, C5, C7.
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

**Đã chốt theo ADR-006 (17/11/2026):** `R = 5` cho bốn case MVP C2, C3, C4, C6 (1 validation + 4 final test mỗi case). Đề xuất ban đầu của bản này là `R = 3` thừa kế v0 (floor v0 `5 × 3 = 15`; với bảy case là `7 × 3 = 21`), giữ làm lịch sử. Với `R = 5`:

```text
K = 4 (bốn case MVP) -> 20 fault runs: 4 validation, 16 final test
K = 7 (nếu thêm C1, C5, C7 Target) -> 35 fault runs: 7 validation, 28 final test
```

Hai dòng trên là số học, không phải số đo. `R = 5` là **sàn** (ADR-007 mục 3); mọi báo cáo phải ghi `K`, danh sách case và `R` thực tế.

**Bổ sung theo ADR-007:**

- **Fault trùng cao điểm tải (MVP).** Trong 4 run final test của mỗi case MVP, ít nhất **một run** đặt `fault_start` trùng cao điểm của workload bán thực (ví dụ đỉnh trước hạn quiz lấy từ log Moodle, mục 5.4): nhiều triệu chứng cùng lúc, tải cao hợp lệ lẫn với sự cố, là nơi ngưỡng tĩnh và truy vết theo trace đầu tiên dễ sai. Slot nào trùng cao điểm được ghi trong campaign manifest **trước** khi chạy (mục 6.3), không chọn sau khi xem kết quả. Validation có ít nhất một run trùng cao điểm cho cả campaign để chọn ngưỡng không bị lệch về tải thấp.
- **Biến thể cường độ/thời điểm (Target).** Thêm run test với mức trễ và thời điểm khác nhau để tăng số incident test lên khoảng 32–40 (8–10 mỗi case MVP), cho CI hẹp hơn. Biến thể là slot mới có `run_id` riêng, cường độ đã ghi trong manifest; không thay `R = 5` sàn.
- Mỗi case có `R − 1` run final test nên per-case metric có denominator nhỏ. Protocol báo **bootstrap CI 95%** và kiểm định ghép cặp **McNemar exact** (mục 20.7) nhưng không tuyên bố có ý nghĩa thống kê khi không đạt và không suy diễn từ một run (mục 19.4). Bản trước ghi "v1 không dùng kiểm định ý nghĩa thống kê"; ADR-007 thay quy tắc đó.

Fault runs không dùng để fit healthy scaler/baseline. Nếu một future supervised model thực sự cần fault-labeled training data, đó là protocol extension riêng; không được silently reuse validation/test fault runs làm training. Các mô hình ML được dùng làm phần chính của đề tài (ADR-002 mục 1) nếu cần fault-labeled data thì thuộc extension này.

### 5.4. Healthy runs

Healthy dataset phải tách run/seed giữa ba split. Các profile dưới đây là **đề xuất** theo workflow W1–W7 ([catalogue mục 7](service-catalogue-and-topology-v2.md)), thay cho các profile v1 (submission peak, grading burst). Profile phải chạy cùng tập dữ liệu seed (mục 5.5).

**Nguồn tải theo ADR-007** (thiết kế chi tiết ở [workload-design-v1](workload-design-v1.md)):

- **Học viên (W1, W3, W4 phía học viên): mức 2+**, phát lại phiên thật từ log Moodle Unistudium 2022 (Milani, Biondi, Franzoni, [Zenodo 13763175](https://zenodo.org/records/13763175), CC BY 4.0, `[L-Unistudium]`): giữ thứ tự thao tác và think time trong phiên, tốc độ bắt đầu phiên theo giờ và đỉnh trước hạn quiz lấy từ cùng log, chỉ nén lịch bắt đầu phiên (một ngày → 48 phút). Thời điểm bắt đầu phiên theo Poisson không thuần nhất, vì Paxson & Floyd cho thấy Poisson chỉ hợp với thời điểm bắt đầu phiên người dùng, còn bên trong phiên thì burst hơn (ToN 1995, [PDF](https://www.icir.org/vern/papers/poisson.TON.pdf), `[L-PaxsonFloyd]`).
- **Giảng viên (W2, W4 phía giảng viên, W6), admin (W5), job lịch (W7): mức 2** (máy trạng thái theo profile/goal; W7 là lịch cố định).
- **Mức 1** (k6 chuỗi request cố định, PR #76) chỉ dùng cho smoke test và làm **mốc giả lập đơn giản** khi kiểm chứng độ thực; không dùng làm tải nền của run dataset.
- Run dataset chỉ dùng workload đã qua kiểm chứng độ thực (ADR-007 mục 2: hold-out, so ba nguồn tải, ngưỡng JSD < 0,05, KS D < 0,1, trung vị lệch < ±10%). Nếu không đạt ngưỡng, vẫn chạy nhưng báo cáo đúng số đo và ghi limitation; không đổi ngưỡng sau khi xem kết quả.
- Khi quy mô một ngày log chưa đủ tải, chồng nhiều ngày/khóa (đổi id) và ghi hệ số khuếch đại vào manifest.

| Profile healthy (đề xuất) | Luồng và nguồn tải | Lý do |
| --- | --- | --- |
| bán thực ngày thường (thay "normal mixed traffic") | học viên mức 2+ (W1, W3, W4) theo nhịp giờ của một ngày thường trong log; giảng viên/admin/job lịch mức 2 (W2, W4, W5, W6, W7) | tải nền cho mọi case (ADR-002: mọi case chạy song song workload) |
| bán thực cao điểm trước hạn quiz (thay "healthy high-load spike") | như trên, lấy đoạn ngày cao điểm trước hạn quiz trong log (tính sơ bộ khoảng 7 lần trung bình ngày, cần tính lại bằng script) | đầu vào chính của **E1**: báo động giả/giờ khi tải cao hợp lệ (mục 17.8) |
| notification batch lớn healthy | W5 (mức 2) với batch lớn không có fault, trên nền bán thực ngày thường | đối chứng cho C1: detector không được học "batch lớn = bất thường" |
| upload media peak healthy | W4 tải cao không có fault | đối chứng cho C4 |
| AI job healthy | W6 với LLM stub nhanh (`llm-stub`, PR #75, trễ thấp, `error_rate = 0`) | đối chứng cho C3 |

**Train coverage tối thiểu:** mỗi profile có ít nhất một dedicated training run trong campaign manifest (thừa kế quy tắc v0); thêm repetition/seed khi tài nguyên cho phép.

**Validation healthy coverage tối thiểu:** `bán thực ngày thường` và `bán thực cao điểm trước hạn quiz`. Các profile còn lại có thể thêm nếu pilot cho thấy cần threshold tuning theo workload class, nhưng phải freeze trước final test.

**Final-test healthy coverage tối thiểu:** `bán thực ngày thường` và `bán thực cao điểm trước hạn quiz`. Để có đủ "giờ khỏe" cho chỉ số báo động giả/giờ của E1, tổng thời lượng healthy final test được ghi trong manifest trước khi chạy.

Final-test healthy run phải dùng `run_id` và workload seed chưa xuất hiện ở train/validation. Mục tiêu là đo false alarm và workload-shift behavior. Số run healthy mỗi profile chốt sau pilot (bản trước ghi "do Đức chốt"; giai đoạn hiện tại Bách chốt và ghi vào bản đăng ký trước, mục 6.3); dataset v0 chốt train 2, validation 1, test 1 mỗi profile (mục 6.1.1 bảng B); số run healthy của test cuối chốt trong bản đăng ký trước. Phiên Moodle dùng cho train, validation và test lấy từ các đoạn log khác nhau, và không trùng phần hold-out dùng kiểm chứng độ thực.

### 5.5. Seed rule và dữ liệu seed

- `run_id` không reuse.
- Workload seed của final test không reuse từ train/validation. Với mức 2+, "seed" gồm cả đoạn log Moodle được phát lại (ngày/khóa), phiên bản file phiên (sha256) và bảng ánh xạ sự kiện → endpoint.
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
- trace-drop implementation sanity, lineage, missingness và reproducibility; không dùng pilot performance để đổi tỉ lệ giữ trace 50% và 10% (mục 13.1);
- thời điểm cao điểm của workload bán thực để đặt slot fault trùng cao điểm (mục 5.3);
- adapter SimpleRCA/BARO đọc được telemetry export (mục 15.2.1).

Pilot run **không** được đưa vào final metric nếu đã dùng để chọn các giá trị trên.

Kết quả pilot tuần 15: giá trị đã chốt ở mục 6.1.1, tập ứng viên cho validation ở mục 6.1.2.

### 6.1.1. Giá trị đã chốt sau pilot (tuần 15)

Chốt ngày 23/11/2026 (task-06 tuần 15), trước khi chấm bất kỳ detector, RCA hay baseline nào trên validation. Trước thời điểm chốt cuối (21:20 +07, tức 14:20Z), hai run healthy validation của dataset v0 đã chạy xong: `validation-healthy-normal-mixed-s2002-20261123t091816z` (bắt đầu 09:18Z, dùng để kiểm tiêu chí khỏe, bảng B) và `validation-healthy-healthy-spike-s2003-20261123t123352z` (bắt đầu 12:33Z). Thống kê export trace của run thứ hai (giữ 52,5% vì ngân sách) dẫn tới việc nâng ngân sách và đặt luật (2) của dòng "Run `partial` được nhận" ở bảng F. Trước đó còn hai lần chạy validation hỏng ở bước dữ liệu seed lúc 09:14Z và 09:16Z, chưa có workload (dataset-v0 mục 6.2). Tại thời điểm chốt (14:20Z), chưa có feature, detector hay RCA engine chạy trên run validation nào. Chưa có detector hay RCA engine, nên không giá trị nào được chọn bằng kết quả phát hiện hoặc khoanh vùng. Nguồn là số đo pilot ([fault-pilot-report-v1](fault-pilot-report-v1.md)) và file cấu hình, mã đã dùng khi chạy pilot. Giá trị còn mở ghi lý do. Thay đổi sau mốc này phải ghi thành phiên bản mới (mục 6.3).

**Phụ thuộc thứ tự merge:** các tham chiếu tới `features/pipeline.py`, `features/baseline.py` và `PROBE_OPERATIONS`, `IDENTITY_ALIASES` trong `telemetry/identity.py` là code của task-05 (nhánh `feat/week-15/task-05-build-feature-pipeline-v1`); ngân sách export trace 60.000 là commit `ebbae7f` của task-04. PR task-04 và task-05 merge trước PR này.

Run pilot dùng trong các bảng (không thuộc dataset, không vào final metric, mục 6.1):

| Ký hiệu | `run_id` | Nội dung |
| --- | --- | --- |
| `c6` | `pilot-c6-normal-mixed-s22-20261120t065500z` | C6, `normal-mixed`, lịch mặc định |
| `c2` | `pilot-c2-normal-mixed-s23-20261120t075709z` | C2, `normal-mixed`, lịch mặc định |
| `c3` | `pilot-c3-normal-mixed-s24-20261120t090256z` | C3, `normal-mixed`, lịch mặc định, fault 600 s (manifest v1) |
| `c4` | `pilot-c4-normal-mixed-s25-20261120t095927z` | C4, `normal-mixed`, lịch mặc định |
| `healthy` | `pilot-healthy-normal-mixed-s21-20261123t025936z` | Không fault, `normal-mixed` |
| `c2-spike` | `pilot-c2-healthy-spike-s26-20261123t040552z` | C2, `healthy-spike`, trùng cao điểm |
| `c3-peak` | `pilot-c3-normal-mixed-s27-20261123t052639z` | C3, `normal-mixed`, trùng cao điểm |
| `c4-peak` | `pilot-c4-normal-mixed-s28-20261123t063033z` | C4, `normal-mixed`, trùng cao điểm |
| `c6-peak` | `pilot-c6-normal-mixed-s29-20261123t073605z` | C6, `normal-mixed`, trùng cao điểm |
| `knee-r1`, `knee-r2` | `w15-t02-knee-r1`, `w15-t02-knee-r2` | Tìm điểm gãy tải của task-02 ([load/README](../../../aiops-platform/load/README.md#kết-quả-tìm-điểm-gãy-19112026)) |

Run pilot của task-03 ghim fault manifest v1 (cùng cường độ với v2, C3 600 s). Độ trễ triệu chứng đo bằng `aiops-training symptoms`: cửa sổ 15 s trên metric 5 s, so với 300 s trước fault, persistence 2 cửa sổ không chồng nhau. Mọi độ trễ là **cận trên** (báo cáo pilot mục 1).

**A. Phase và lịch fault**

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| Độ dài run | 2.880 s (48 phút) | [`fault-manifest-v2.json`](../../../aiops-platform/faults/manifests/fault-manifest-v2.json) `timeline.run_seconds`; [workload-design-v1](workload-design-v1.md) mục 7.2 | 9 run pilot chạy đủ, gate thực thi `pass` |
| Warm-up | 360 s (phút 0–6) | manifest v2 `warmup_s` | Feature v1 gắn cờ `warmup` cho cửa sổ bắt đầu trước giây 360; bước fit baseline bỏ các cửa sổ này (`features/pipeline.py`, `features/baseline.py`, task-05) |
| Pre-fault, lịch mặc định | 720 s (giây 360–1.080) | manifest v2 `default_start_s` = 1.080 | Dài hơn đoạn mốc 300 s của kiểm chứng ground truth (`baseline_s` trong `ground_truth/validate.py`) và đoạn tham chiếu dài nhất 10 phút của SimpleRCA/BARO (mục 15.2.1) |
| Pre-fault, slot trùng cao điểm | Theo kế hoạch phát lại. Slot validation C2: 900 s (fault ở giây 1.260–1.860, 582 phiên bắt đầu trong cửa sổ) | `fault-schedule.mjs plan --case C2 --align-peak` trên `moodle-normal-mixed-k4-validation-v1.json` (sha256 `29b39b72…`, khớp [`dataset-v0.json`](../../../aiops-platform/experiments/datasets/dataset-v0.json)) | `--align-peak` quét từ hết warm-up nên không bảo đảm pre-fault tối thiểu. Slot test kiểm lại khi freeze (mục 27) |
| Fault active | C2 600 s · C3 900 s · C4 600 s · C6 300 s | manifest v2 `fault_duration_s`; báo cáo pilot mục 5 | C3 tăng từ 600 s vì triệu chứng chờ job AI đến. Đối chiếu quy tắc mục 7.3 ở bảng D |
| Recovery | ≥ 600 s. Lịch mặc định: C2 1.200 s · C3 900 s · C4 1.200 s · C6 1.500 s | manifest v2 `min_recovery_s`; `fault-schedule.mjs validate` | `c2-spike`: phút đầu sau `fault_end` còn 15% request lỗi, từ phút thứ 2 về 0–0,2% |
| `evaluation_start` / `evaluation_end` | Giây 360 / giây 2.880 tính từ đầu run | Suy từ các dòng trên theo mục 7.1 | Healthy run dùng toàn bộ đoạn sau warm-up |

**B. Workload**

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| Profile healthy | `normal-mixed@v1`, `healthy-spike@v1`: học viên mức 2+ chồng `k` = 4 ngày log Moodle; giảng viên, admin, job lịch mức 2 theo `params/staff-assumed-v1.json` | `knee-r1`, `knee-r2`; workload-design-v1 mục 8.1–8.4 | Pilot dùng kế hoạch `moodle-normal-mixed-k4-v1`, `moodle-healthy-spike-k4-v1`. Dataset v0 dùng kế hoạch theo split, cùng luật chọn ngày ([dataset-v0](dataset-v0.md) mục 2). `RunGroundTruth.workload_profile` ghi `plan_id` (`ground_truth/build.py`) |
| `λ_knee` | ≥ 5,6 phiên học viên/s (cận dưới) | `knee-r1`, `knee-r2` | p95 Gateway 37–40 ms ở mọi bậc. Giới hạn của phép đo là RAM của k6, không phải stack |
| Giới hạn đỉnh (ô 60 s) | `normal-mixed` ≤ 0,35 × `λ_knee` = 1,96 phiên/s; `healthy-spike` ≤ 0,8 × `λ_knee` = 4,48 phiên/s | workload-design-v1 mục 8.4 | Kế hoạch pilot: 1,18 và 4,3 phiên/s, đạt |
| Đỉnh kế hoạch dataset v0 (`normal-mixed` / `healthy-spike`) | Train 1,63 / 3,83 · validation 2,43 / 3,53 · test 1,22 / 4,02 phiên/s | [load/README](../../../aiops-platform/load/README.md#kế-hoạch-phiên-theo-split-cho-dataset); sha256 trong `dataset-v0.json` | Validation `normal-mixed` vượt 1,96. Kế hoạch được giữ với điều kiện run healthy validation đạt tiêu chí khỏe (dataset-v0 mục 2). Kết quả: `validation-healthy-normal-mixed-s2002-20261123t091816z` đạt tiêu chí khỏe (gateway p95 0,091 s, phản hồi ngoài mong đợi 0,16%, phiên bỏ dở 0,47%, không iteration bị bỏ, không container vượt CPU/bộ nhớ), nên giữ k = 4 và `moodle-normal-mixed-k4-validation-v1`. *(Kết quả ghi ngày 24/11/2026, sau ngày chốt.)* |
| Tải nền của fault run | `normal-mixed` cho mọi fault run của dataset v0 | Slot trong `dataset-v0.json` | Cùng cường độ, C2 trên `healthy-spike` thành cạn pool: 75–81% request lỗi 504 (`c2-spike`). Manifest v2 ghi triệu chứng kỳ vọng theo profile |
| Số run healthy mỗi profile | Train 2 · validation 1 · test 1 (test chỉ khai báo, chốt khi freeze) | dataset-v0 mục 4 | Trả lời câu "số run healthy mỗi profile chốt sau pilot" của mục 5.4, cho dataset v0 |
| Profile healthy đối chứng | Không thêm `upload media peak healthy` và `AI job healthy` | `healthy`; báo cáo pilot mục 6; `decisions` trong `dataset-v0.json` | Trên các cửa sổ fault giả, `healthy` có 16–31 lượt upload và 7–11 lời gọi provider; bộ đo triệu chứng không báo nhầm. `notification batch lớn healthy` chỉ cần khi C1 (Target) vào campaign |
| Độ thực của workload | Tiêu chí v2, đăng ký 19/11/2026, trước khi chấm run dataset | `workload-realism-criteria-v2.md` (task-07, nhánh `feat/week-15/task-07-validate-workload-realism-v2`) | Kết luận (workload-realism-report-v1 mục 11–12): 10/10 run train/validation của dataset v0 đạt v2 (`normal-mixed` 7/7 run và 2/2 nhóm ngày; `healthy-spike` 3/3 run và 2/2 nhóm ngày); 0/10 đạt v1. Được viết "traffic học viên bán thực `normal-mixed` giống thật theo v2" (giảng viên và admin là mức 2, không thuộc kết luận này), kèm bốn giới hạn của report mục 12: với bán thực, v2 chỉ kiểm bộ phát và nhóm ngày; dáng theo giờ của nhóm validation nằm ngoài dải; 1/4 ngày của mỗi nhóm đã nằm trong kế hoạch `r2`; chỉ có 2 nhóm ngày độc lập, và phép so với nguồn đơn giản là chấm sau khi xem dữ liệu. `healthy-spike` cũng được viết sau khi so với mức 1 và mức 2 thuần đăng ký trước (25/11/2026, workload-realism-report-v1 mục 11–12) |

**C. Cường độ fault**

| Case | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| C2 | Toxic `latency` 200 ms, jitter 20 ms trên `course-to-postgres` | manifest v2; `c2`, `c2-spike` | Truy vấn của `course` trung bình 1,3 ms → 289 ms, không span lỗi ở `normal-mixed`. Không chỉnh theo profile |
| C3 | `llm-stub` trễ 30.000 ms cộng ngẫu nhiên 0–5.000 ms, `error_rate` 0 | manifest v2; `c3`, `c3-peak`; [faults README](../../../aiops-platform/faults/README.md) mục "Ý nghĩa tham số" | Lời gọi provider trung bình 32,4 s (`c3`) và 32,1 s (`c3-peak`). Job chậm, không `FAILED` |
| C4 | Toxic `latency` 300 ms, jitter 30 ms trên `media-to-minio` và `media-worker-to-minio` | manifest v2; `c4`, `c4-peak` | Mỗi lời gọi tới MinIO chậm khoảng 300 ms (`get-object` khoảng 600 ms vì đọc hai lượt). Không span lỗi |
| C6 | `docker pause identity`; `IDENTITY_SERVICE_TOKEN_TTL_SECONDS` = 60 cho mọi run | manifest v2 `requires`; `compose.faults.yaml`; `c6`, `c6-peak` | Healthy và fault run cùng TTL |

**D. Độ trễ triệu chứng, khoảng yên lặng và quy tắc mục 7.3**

Cột "Cần tối thiểu" = độ trễ lớn nhất đo được + 10 s độ trễ thu thập metric + `late_tolerance` lớn nhất trong tập ứng viên ở mục 6.1.2 (135 s). Fault active phải lớn hơn giá trị này (mục 7.3).

| Case | Lịch mặc định | Trùng cao điểm | Nguồn | Fault active | Cần tối thiểu |
| --- | --- | --- | --- | --- | --- |
| C2 | 10 s (`course-postgres`, `gateway → course`). Ngoài đường request: `ai-worker → course` 300 s, chỉ khi có job AI | 10 s; `ai-worker → course` 15 s | `c2`, `c2-spike` | 600 s | 300 + 10 + 135 = 445 s: đạt |
| C3 | 275 s (job chưa ack ở `ai-worker`), 305 s (lời gọi provider) | 70 s, 100 s | `c3`, `c3-peak`. Job AI đầu tiên sau phút 18 đến ở giây 14–329 trên 7 run `normal-mixed` không bị chặn đăng nhập (báo cáo pilot mục 5) | 900 s | 329 + 35 (lời gọi LLM tối đa) + 10 + 135 = 509 s: đạt |
| C4 | 100 s (`media → MinIO`), 110 s (`gateway → media`), 155 s (`media-worker → MinIO`) | 25 s, 35 s, 25 s | `c4`, `c4-peak` | 600 s | 155 + 10 + 135 = 300 s: đạt |
| C6 | 15 s (đăng nhập qua gateway), 20 s (token dịch vụ của gateway; span lỗi đầu tiên ở 10 s) | 10 s (token dịch vụ; span lỗi đầu tiên ở 1,2 s), 15 s (gateway trả 5xx, CPU `identity` đứng yên) | `c6`, `c6-peak` | 300 s | 20 + 10 + 135 = 165 s: đạt |

- **C3** còn đạt khi job AI đầu tiên đến trước giây 720 của cửa sổ fault (900 − 35 − 10 − 135). Run có job đến muộn hơn thì triệu chứng không kịp lộ; ghi trong ledger, không nới interval (mục 7.3).
- **Khoảng yên lặng C6:** `c6` đo 10 s theo span lỗi token đầu tiên, 20 s theo bộ đo metric; `c6-peak` đo 1,2 s theo span, 10 s theo metric (gateway trả 5xx ở 15 s). Smoke trước đó đo 70–74 s. Lý do: token dịch vụ của gateway (TTL 60 s) làm mới theo chu kỳ, nên lúc token hết hạn sau `pause` rơi vào khoảng 0–60 s tùy pha. Cận kỳ vọng `expected_symptom_lag` = [0, TTL + 30] = [0, 90] s (`ground_truth/cases.py`); cả hai run nằm trong cận, giữ biên 30 s. Detection Delay của C6 vẫn báo riêng (mục 7.3).
- **Nhánh worker mất token của C6** chưa xác nhận ở cả hai run (`ai-worker` lỗi đúng một lần ở `c6-peak`); không thuộc đường lan truyền kỳ vọng.

**E. Timeout và biên so với cường độ fault**

LMS đóng băng (ADR-006) nên timeout không chỉnh theo pilot. Bảng ghi giá trị đang chạy và biên so với cường độ fault.

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| Gateway → service | `GATEWAY_UPSTREAM_TIMEOUT_MS` = 5.000 ms | `docker-compose/compose.yaml`; [dependency-resilience-policy-v2](dependency-resilience-policy-v2.md) mục 2.1; `c6` (span `gateway-identity` p50 5.000 ms), `c2-spike` (504 `DEPENDENCY_TIMEOUT`, p50 phía k6 5.001 ms) | Mặc định trong code là 30.000 ms; Compose đặt 5.000 ms |
| Lấy service token | `IDENTITY_TOKEN_TIMEOUT_MS` = 3.000 ms | dependency-resilience-policy-v2 mục 2.2; `c6` (lần làm mới token timeout 3 s) | |
| Một lời gọi provider LLM | `AI_COMPLETION_TIMEOUT_MS` = 240.000 ms | `docker-compose/compose.yaml`; dependency-resilience-policy-v2 mục 2.3 | Trễ C3 tối đa 35 s, biên 205 s: fault là "chậm", không thành lỗi. `c3`, `c3-peak`: job hoàn tất, không `WORKER_INTERRUPTED` |
| PostgreSQL, MinIO | Không có timeout ứng dụng | dependency-resilience-policy-v2 mục 7 | C2, C4 chậm mà không lỗi ở `normal-mixed`. Lỗi 504 ở `c2-spike` đến từ timeout của gateway |
| Biên `expected_symptom_lag` của FG | TTL + 30 s = 90 s | `ground_truth/cases.py`; `c6`, `c6-peak` | Khoảng yên lặng đo được nằm trong cận (bảng D) |
| Timeout request phía k6 | 15 s | workload-design-v1 mục 9 (P22) | Lớn hơn timeout gateway 5 s |

**F. Thu thập và chất lượng dữ liệu**

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| Bước export metric | 5 s | `--step-seconds` của `aiops-training export` (mặc định 5, `cli.py`); `QualityConfig.expected_scrape_interval_s` | |
| Độ trễ thu thập (`available_after_s`) | Metric 10 s · trace 3 s · log 2 s | `AVAILABLE_AFTER_S` trong `features/pipeline.py` (task-05, nhánh `feat/week-15/task-05-build-feature-pipeline-v1`); số đo ở catalogue case mục 1.4: log ≈ 2 s, trace ≈ 2,5 s, counter 4–10 s, backlog queue ≈ 9 s | Pilot không đo lại; giá trị là cận trên của số đo ngày 29/10/2026. Cửa sổ chỉ được dùng sau `window_end` + 10 s (mục 7.2) |
| Ngân sách export trace | 60.000 trace mỗi run (`--max-traces`, `TempoExportOptions.max_traces`) từ commit `ebbae7f` (23/11/2026, task-04); trước đó 20.000. Giá trị đã dùng ghi ở `export_config.tempo.max_traces` của manifest export | `cli.py`, `telemetry/adapters/tempo.py`; báo cáo pilot mục 4 | Pilot (20.000): 8 run `normal-mixed` có 16/129 truy vấn tìm kiếm chạm giới hạn kết quả, không trace nào bị bỏ vì ngân sách; `c2-spike` bỏ 14.828/34.828 trace ứng viên vì ngân sách và còn 291 lần chạm giới hạn tìm kiếm, nên mất **≥ 43%** trace. Dataset v0: `validation-healthy-healthy-spike-s2003-20261123t123352z` (20.000) bỏ 18.099/38.099 trace (giữ 52,5%) nên ngân sách được nâng; run sau dùng 60.000. **Độ phủ ứng viên** (trace ứng viên không nhiễu ÷ request k6 của run) là 0,990–0,996 ở mọi run pilot `normal-mixed` và các run dataset v0 trước fault run validation (`c2-spike`: 0,687), nên 16 lần chạm giới hạn tìm kiếm cố định ở mọi run không làm mất trace đáng kể. Cả 10 run giữ slot của dataset v0: `dropped_by_budget` = 0 ở 9 run (trừ run trên), độ phủ ứng viên 0,989–0,996 (dataset-v0 mục 6). |
| Ngưỡng `telemetry_silent` | Nhịp tim `process_cpu_time_seconds_total` không tăng quá 30 s; khoảng chạm mép cửa sổ ≤ 35 s không tính | `silent_threshold_s`, `edge_tolerance_s` của `QualityConfig` (`telemetry/validation/quality.py`) | Trong 9 run pilot, chỉ `c6`, `c6-peak` gắn `telemetry_silent:identity`, đúng runtime bị pause; 7 run còn lại không gắn nhầm |
| Ngưỡng tương quan log–trace | ≥ 0,95 | `QualityConfig.min_log_correlation_ratio` | Không run pilot nào có lý do `low_log_trace_correlation`. Log `dependency.failure` của C6 khớp `span_id` 892/892 (`c6`) và 1.163/1.163 (`c6-peak`) |
| `overall_status` | `fail`: modality lỗi hoặc không có file, `service_name` lạ hoặc thiếu, runtime không có metric. `partial`: có lý do khác. Còn lại `pass`. Modality `empty` (có file, 0 dòng) không tự làm `fail` và không thành lý do; luật nhận run ở dòng dưới loại trường hợp này | `quality.py` | 9/9 run pilot `partial`: trace bị cắt ở mọi run (`c3` còn bị Tempo OOM giữa export), cộng `telemetry_silent` ở hai run C6 và log trùng ở 3 run |
| Run `partial` được nhận cho primary evaluation (mục 8.3) | Luật đọc **`stats.traces` của manifest export** và `quality-report.json`, không chỉ danh sách `reasons` (lỗi tải lẻ tẻ không `aborted` không sinh lý do nào). Mọi run phải có metric và log không `empty`. Điều kiện riêng của trace (không đạt thì chỉ loại variant có trace, variant chỉ metric vẫn dùng được, mục 8.3): trace không `empty`; `stats.traces`: `aborted` = false, `fetch_errors` = `not_found` = `parse_errors` = 0; độ phủ ứng viên ≥ 0,98. Nhận các lý do: (1) `truncated_modality:traces` với `dropped_by_budget` = 0; (2) `truncated_modality:traces` với `dropped_by_budget` > 0 **chỉ ở run healthy** (không chấm RCA trên run khỏe), trace là mẫu hệ thống đều theo thời gian (`_evenly_spaced`), tỉ lệ giữ ghi vào dataset. Luật (2) được đặt **sau khi** xem thống kê export của `validation-healthy-healthy-spike-s2003-20261123t123352z`, và chính luật này cho run đó được nhận. Đây là luật chất lượng dữ liệu, không chọn theo kết quả phát hiện; nó được đặt trước mọi feature hay detector trên validation; (3) `duplicates` khi `duplicate_metric_record_count` = 0, `duplicate_span_id_count` = 0 và log trùng ≤ 0,1% số log; (4) `telemetry_silent:identity` trong run C6 khi mọi khoảng im lặng nằm trong `[fault_start − 5 s, fault_end + 30 s]` (5 s là một chu kỳ scrape: mẫu tăng cuối cùng có thể ngay trước `pause`). Lý do khác: run không được nhận. Cài ở `aiops-platform/experiments/lib/eligibility.mjs`, chạy trong `check-dataset.mjs` (task-04, commit `2eb1241`): vi phạm là lỗi, loại variant có trace là cảnh báo. Không nhận: `partial_modality:traces` (export trace bị ngắt, ví dụ Tempo OOM), vì là source outage (mục 8.3); fault run có `dropped_by_budget` > 0 (export lại trong hạn retention 24 giờ, hoặc `diagnostic_only` cho variant có trace) | `quality.py`; `stats.traces` trong manifest export (`telemetry/export.py`, `telemetry/adapters/tempo.py`); `lib/eligibility.mjs`; báo cáo pilot mục 4, 7 | Không nhận (1) thì không run nào đủ điều kiện, vì mọi run đều chạm giới hạn tìm kiếm. Chạy trên 9 run pilot: 7 run nhận đủ; `c2-spike` (độ phủ 0,687, bỏ trace vì ngân sách) và `c3` (Tempo OOM, 5 lỗi tải) chỉ dùng được variant metric. Pilot: mọi run C6 có khoảng im lặng 305–310 s bắt đầu khoảng 5 s sau `fault_start`; mọi run có đúng 1 log trùng. Hệ quả của (2): (a) báo động giả trên `healthy-spike` của validation cho detector dùng trace đo trên mẫu 52,5%, ghi thành giới hạn; (b) điều kiện "full" của E3 chỉ dùng run `dropped_by_budget` = 0; (c) không detector nào dùng số đếm tuyệt đối từ trace (`span_count`, số span lỗi, số cạnh đếm từ trace); đặc trưng trace chỉ là tỉ lệ (`trace_error_rate`, null khi cửa sổ có ít hơn 5 span) và `span_count` không vào baseline (`FEATURE_COLUMNS` của `features/baseline.py`) |
| Ngưỡng kiểm chứng `RunGroundTruth` | Đoạn mốc 300 s trước fault; bỏ 15 s đầu fault; latency trung bình ≥ 2 × mốc và ≥ 3 lời gọi; bỏ `ping`. C6: CPU `identity` đứng yên và `lms_dependency_error_count_total{gateway-identity-token}` tăng trong `[fault_start, fault_start + TTL + 30 s]` | `ValidationConfig` trong `ground_truth/validate.py`; [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md) mục 9.2 | 9/9 run pilot `valid` |

**G. Luật lọc nhiễu**

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| `noise_filter_version` | `noise.v1`, áp như nhau cho mọi run, variant và baseline | `NOISE_FILTER_VERSION` trong `features/pipeline.py` (task-05) | Mục 8.5 |
| Lọc ở bước export | Bỏ trace gốc `GET /ready`, `GET /health`, `scheduler-postgres run.claim-next`, `run.fail-exhausted`, `job.lock-due-cron`; bỏ access log của probe | `NOISE_TRACE_ROOT_NAMES` trong `telemetry/identity.py`; `exclude_probe_logs` của export | Có từ PR #77; ghi lại trong `features-manifest.json` |
| Lọc ở bước feature | Bỏ route `/ready`, `/health` khỏi metric HTTP; bỏ thao tác `ping` khỏi metric dependency | `PROBE_ROUTES`, `PROBE_OPERATIONS` trong `telemetry/identity.py` (task-05) | Ở `c4`, `ping` của probe tới MinIO chậm 294–299 ms ngay từ đầu fault. Không lọc thì C4 có "triệu chứng" dù không có traffic người dùng |
| Ánh xạ identity lệch | `notification-rabbitmq` → `notification-worker-rabbitmq` khi dựng cạnh | `IDENTITY_ALIASES` trong `telemetry/identity.py` (task-05) | Code `notification` chưa sửa (mục 1.3) |

**H. Slot trùng cao điểm**

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| Cách đặt slot | Cửa sổ fault có nhiều lần bắt đầu phiên nhất trong kế hoạch phát lại, quét bước 30 s trong [giây 360, 2.880 − 600 − thời lượng fault] | `peakAlignedStart` trong `aiops-platform/faults/fault-schedule.mjs` | C3 (900 s) chỉ bắt đầu muộn nhất ở giây 1.380, nên slot giây 1.620 của `c3-peak` (fault 600 s, manifest v1) không đặt lại được với v2. Độ trễ "trùng cao điểm" 70/100 s của C3 ở bảng D lấy từ slot đó; slot cao điểm test của C3 là cửa sổ tốt nhất trong [360, 1.380] (mục 27) |
| Validation | `validation-c2-normal-mixed-r1` (`align_peak` = true), fault ở giây 1.260–1.860; C3, C4, C6 theo lịch mặc định | `decisions` trong `dataset-v0.json`; `fault-schedule.mjs plan` (bảng A) | Run `validation-c2-normal-mixed-s2001-20261123t182901z`: fault bắt đầu ở giây 1.260,0 sau `run_start` (theo kế hoạch, 582 phiên bắt đầu trong cửa sổ), gate thực thi `pass`, `RunGroundTruth` `valid`, chất lượng `partial` (trace truncated, được nhận) |
| Test | Mỗi case MVP ít nhất 1 run trùng cao điểm (mục 5.3) | — | Slot cụ thể chưa chốt; chốt khi freeze tuần 19, trước khi chạy test (mục 6.3) |
| Pilot đã chạy trùng cao điểm | `c6-peak` (281 phiên bắt đầu trong cửa sổ 300 s); `c3-peak`, `c4-peak` (538 phiên); `c2-spike` (1.877 phiên) | Báo cáo pilot mục 2 | C3, C4 lộ sớm hơn lịch mặc định vì có nhiều job AI và upload hơn |

**I. Case vào campaign (mục 5.2)**

| Giá trị | Chốt | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| `K` | 4: C2, C3, C4, C6, cả bốn `case_verification_status = run` | Báo cáo pilot mục 3; `c2`, `c3-peak`, `c4`, `c6` và các run cao điểm | `R = 5` (mục 5.3). Tín hiệu bảng 8.4 của C3 lấy từ `c3-peak`, vì `c3` mất span do Tempo OOM |
| Giới hạn ghi kèm | C2: case đối chứng dễ (ADR-006), lan ra ngoài đường request chỉ khi có job AI; không phân biệt pool cạn với DB chậm. C3: độ trễ phụ thuộc lúc job AI đến; đường lan truyền kỳ vọng chỉ còn `ai-llm-provider → ai-worker`. C4: bỏ chuỗi "media `PENDING` kẹt → job dọn xóa media"; lan ra ngoài đường request là `media-worker` tạo thumbnail chậm. C6: nhánh `<worker>-identity-token` chưa xác nhận | Báo cáo pilot mục 3 | Ghi vào `campaign_manifest` cùng `case_verification_status` |
| Không vào | C1, C5, C7 (Target): chưa có injector (điều kiện 1 của mục 5.2) | Mục 5.2 | |
| Run dataset v0 đạt gate | *(Kết quả ghi ngày 24/11/2026, sau ngày chốt.)* 10/10 slot train/validation có run đạt gate thực thi `pass`, `RunGroundTruth` `valid`, chất lượng `partial` (lý do được nhận theo bảng F); `check-dataset --require-complete` không báo lỗi. Sáu run không giữ slot: năm run hỏng trước khi workload bắt đầu vì worktree thiếu dependency `lms/` (4 run `failed` ở bước dữ liệu seed, 1 run `aborted` ở reset; luật "hỏng trước workload thì không tính là run bị thay" được đặt sau khi chạy, dataset-v0 mục 6.2), và một run `healthy-spike` bị ngắt có chủ đích để dùng ngân sách trace mới (thay bằng run cùng seed, `replacement_for_run_id`) | dataset-v0 mục 6 | |

### 6.1.2. Giá trị để validation chọn và tập ứng viên

Khai báo ngày 23/11/2026, trước khi chấm bất kỳ detector nào trên validation; phiên bản `detection-candidates.v1`, file [`detection-candidates-v1.json`](../../../aiops-platform/training/configs/detection-candidates-v1.json). Validation của dataset v0 chỉ có 4 fault run (một mỗi case) và 2 healthy run (`normal-mixed` seed 2002, `healthy-spike` seed 2003; dataset-v0 mục 4). Run `healthy-spike` validation có trace là mẫu 52,5% (bảng F). Recall trên validation chỉ nhận 5 giá trị (0/4 tới 4/4), báo động giả đo trên khoảng 2 × 42 phút sau warm-up. Vì vậy tập ứng viên giữ nhỏ: càng nhiều tổ hợp càng dễ chọn trúng nhiễu của 6 run.

| Tham số | Ứng viên | Lý do (từ số đo) |
| --- | --- | --- |
| Bước cửa sổ | **Cố định 15 s**, không chọn | Bằng `align_s` của feature v1 và bằng 3 mẫu metric 5 s. Bước nhỏ hơn không làm phát hiện sớm hơn vì metric chỉ đủ sau 10 s (bảng F). Giữ công thức `late_tolerance` mục 17.3 như v0 |
| Độ dài cửa sổ | {30 s, 60 s} | 60 s thừa kế v0, là mặc định của feature v1 (`FeatureConfig.window_s`). 30 s là cửa sổ ngắn nhất còn gồm hai bước: C2 và C6 lộ sau 10–20 s, cửa sổ ngắn bớt pha loãng triệu chứng sớm và giảm `late_tolerance`. Không dưới 30 s vì cạnh thưa: C3 chỉ có 11–15 lời gọi provider trong cả cửa sổ fault (`c3`, `c3-peak`), C4 có 27–42 lượt upload trong 600 s (`c4`, `c4-peak`), cửa sổ 15 s phần lớn không có lời gọi nào. Không trên 60 s vì độ trễ dài của C3 (275–305 s) do job đến muộn; cửa sổ dài không rút ngắn được độ trễ này mà chỉ tăng `late_tolerance` |
| Persistence | Cửa sổ 30 s: {3, 4}; cửa sổ 60 s: {5, 6} cửa sổ liên tiếp | Cửa sổ chồng nhau (bước 15 s), nên một sự kiện đơn lẻ nằm trong `window / 15` cửa sổ liên tiếp (2 với 30 s, 4 với 60 s). Persistence nhỏ nhất lọc được sự kiện đơn lẻ là `window / 15 + 1`, tức bất thường kéo dài ít nhất một bước (15 s); ứng viên thứ hai đòi kéo dài hai bước (30 s). Pilot có ví dụ sự kiện đơn lẻ phải lọc: `ai-worker` lỗi lấy token đúng một lần ở `c6-peak`. Bản nháp trước dùng {2, 3}, không lọc được sự kiện đơn lẻ ở cửa sổ nào (review task-06) |
| Ngưỡng robust z | {3, 4, 5} | 3 bằng mặc định `k_sigma` của SimpleRCA (mục 15.2.1), để detector thống kê và baseline xuất phát cùng mức. 4 và 5 vì tải bán thực có nhịp giờ và cao điểm, dao động trên train lớn hơn tải hằng. Đây là lý do thiết kế: bộ đo triệu chứng của pilot ghép ngưỡng tương đối với ngưỡng tuyệt đối (latency ≥ 2 × trước fault **và** tăng ≥ 50 ms) và không báo nhầm trên `healthy` (36/38 tín hiệu `not_observed`, 2 `no_traffic`), nhưng pilot không thử ngưỡng tương đối đơn lẻ nên không chứng minh ngưỡng 3 sẽ báo nhầm |

Tổng 4 cặp (window, persistence) × 3 ngưỡng = 12 tổ hợp. `late_tolerance` theo mục 17.3 (`window + (persistence − 1) × 15 s`): 60 s (30 s, 3), 75 s (30 s, 4), 120 s (60 s, 5), 135 s (60 s, 6). Giá trị lớn nhất 135 s đã dùng khi kiểm thời lượng fault ở bảng D: với độ trễ triệu chứng đo ở pilot, không tổ hợp nào làm fault run thành FN do thiết kế. Điều này có điều kiện: C3 chỉ đạt khi job AI đầu tiên đến trước giây 720 của cửa sổ fault, và độ trễ đo bằng bộ đo triệu chứng chứ không bằng chính detector.

**Định nghĩa dùng chung cho mọi tổ hợp** (khai báo cùng tập ứng viên):

- **Cửa sổ không có dữ liệu:** đặc trưng null (không có lời gọi, modality thiếu, runtime `telemetry_silent`) không tính là vượt ngưỡng và **không làm đứt** chuỗi persistence; chuỗi tính trên các cửa sổ có dữ liệu liên tiếp nhau. Nhờ vậy cạnh thưa (C3: 11–15 lời gọi provider trong 900 s) vẫn tích lũy được persistence. `telemetry_silent` là tín hiệu riêng của detector, không đi qua robust z.
- **Thang đo khi MAD = 0:** robust z = (x − median) / scale, với scale = 1,4826 × MAD; nếu MAD = 0 thì scale = 1,2533 × MeanAD (modified z-score của Iglewicz và Hoaglin); nếu MeanAD cũng bằng 0 (đặc trưng hằng trên train) thì scale bằng sàn theo đơn vị: tỉ lệ 0,01; giây (latency, duration) 0,01 s; request/s và dòng log/s 0,05; số lời gọi và số message 1; consumer 0,2; CPU 0,01 giây CPU/s; bộ nhớ 1 MiB. Sàn là thay đổi nhỏ nhất coi là có nghĩa với từng đơn vị (ví dụ z = 3 trên tỉ lệ lỗi hằng 0 là tăng 3 điểm phần trăm; mất một consumer là z = 5). Cài ở `features/baseline.py` (task-05).
- **`detected_at`** = `window_end` của cửa sổ hoàn tất chuỗi persistence + độ trễ thu thập của modality chậm nhất mà detector dùng (metric 10 s, bảng F). Bảng D đã cộng 10 s này.

**Luật chọn** (ghi cùng tập ứng viên để không chọn sau khi xem kết quả):

1. Window và persistence chọn **bằng detector robust z** trên lưới 12 tổ hợp ở trên, rồi cố định cho mọi detector của E1, kể cả Isolation Forest, điểm hợp nhất (fused) và ngưỡng tĩnh (mục 17.8: chỉ detector đổi). Ngưỡng của từng detector khác chọn sau đó với window/persistence đã cố định, trong tập ứng viên khai báo trước (danh sách dưới).
2. Báo động giả đếm theo incident (mục 17.4, 17.7): incident trên 2 healthy run cộng incident có `detected_at` ngoài `[fault_start, fault_end + late_tolerance]` trên 4 fault run, chia cho tổng thời gian đánh giá không có fault (sau warm-up). **Điều kiện:** báo động giả ≤ 1 incident/giờ. Trong các tổ hợp đạt điều kiện: nhiều fault run có incident khớp nhất; hòa thì ít báo động giả hơn; hòa tiếp thì `late_tolerance` nhỏ hơn; cuối cùng là ngưỡng lớn hơn. Không tổ hợp nào đạt điều kiện thì chọn tổ hợp ít báo động giả nhất (hòa theo thứ tự trên) và ghi là không đạt điều kiện.

Lưu ý khi đọc kết quả (không đổi pipeline): với recall chỉ có 5 mức (0/4 tới 4/4) và báo động giả đo trên khoảng 2 giờ, chênh lệch giữa các tổ hợp gần nhau không có ý nghĩa thống kê; validation chỉ dùng để chọn, kết luận lấy ở test (mục 6.3).

**Còn lại cho validation, khai báo trong versioned config trước khi dùng.** Các giá trị dưới đây vẫn do validation chọn (mục 6.2, 9.2) nhưng chưa có tập ứng viên, vì detector, RCA engine và baseline chưa cài. Không gian ứng viên của từng giá trị phải được commit trong versioned config **trước** lần chạy validation đầu tiên dùng nó (tuần 16–18 của [plan-v0.4](../plan/plan-v0.4-24-weeks.md)):

- ngưỡng và hyperparameter của Isolation Forest; ngưỡng của điểm hợp nhất (fused);
- fusion weight (hoặc equal weight làm baseline) và RCA weight;
- merge gap, recovery rule, `correlation_window_seconds` của incident (analysis blueprint mục 17.4);
- ngưỡng cố định của baseline ngưỡng tĩnh cho E1 (mục 17.8);
- luật `base-manual-auto` và cách đếm artifact (mục 15.2, 15.4);
- tham số SimpleRCA và BARO trong không gian đã khai báo ở mục 15.2.1 (`k_sigma` ∈ {2, 3}, `m` ∈ {2, 3}, đoạn tham chiếu ∈ {5, 10} phút; BARO ∈ {5, 10} phút). Đoạn 10 phút vừa trong pre-fault 720 s của lịch mặc định và 900 s của slot validation C2;
- tie/fallback rule.

Ngưỡng data-quality và luật lọc nhiễu đã chốt ở mục 6.1.1. Validation chỉ xác nhận chúng khả thi (mục 6.2), không chọn lại.

### 6.2. Validation

Validation được phép dùng để:

- fit/chọn threshold không học được chỉ từ healthy training;
- chọn robust-z/Isolation-Forest threshold;
- chọn detector hyperparameter;
- chọn window/persistence config trong candidate đã định nghĩa;
- tune fusion weight hoặc dùng equal weight baseline;
- tune RCA weights;
- chọn/freeze luật của baseline thủ công tự động (mục 15.2);
- chọn/freeze tham số của SimpleRCA và BARO trong không gian đã khai báo (mục 15.2.1);
- chọn ngưỡng cố định của baseline ngưỡng tĩnh cho E1 (mục 17.8);
- chọn deterministic tie/fallback behavior nếu chưa freeze;
- xác nhận implementation correctness, artifact lineage, missingness calculation, reproducibility và feasibility/quality gate của các điều kiện suy giảm E3 (mục 13); không tune tỉ lệ giữ trace theo validation performance;
- xác nhận data-quality gate khả thi.

Mọi lựa chọn phải được ghi bằng versioned config; không chọn bằng cảm tính rồi chỉ lưu kết quả cuối.

### 6.3. Final-test freeze manifest

Trước khi chạy/đọc final test result, campaign phải freeze tối thiểu:

```text
protocol_version
campaign_id + campaign_manifest_version
run slot / split assignment
tập case thực sự vào campaign (K) + R + case_verification_status từng case
slot run test đặt fault trùng cao điểm tải (mục 5.3) + biến thể cường độ/thời điểm nếu có
workload profile + seed policy + phiên bản dữ liệu seed
nguồn tải từng vai (mức 2+ / mức 2) + file phiên Moodle (sha256) + bảng ánh xạ sự kiện + hệ số khuếch đại
kết quả kiểm chứng độ thực của workload (ADR-007 mục 2) đã đo trên bản workload được freeze
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
luật baseline thủ công tự động + phiên bản + cách đếm artifact (E4)
cấu hình SimpleRCA, BARO, ngưỡng tĩnh (đã chọn trên validation)
modality variants
E3 degradation types/config/tỉ lệ giữ trace/seed rule
data-quality/eligibility gates
metric definitions + tolerance rule
rca_result_schema_version
protocol thử nghiệm người (mục 15.3): không áp dụng, E7 ra khỏi kế hoạch
giả thuyết E1–E5 (hướng kỳ vọng, chỉ số chính)
cách tính CI (bootstrap) và kiểm định (McNemar exact; Wilcoxon chỉ cho E7, không áp dụng), hiệu chỉnh đa so sánh (mục 20.7)
aggregation/reporting rule
analysis code commit
output artifact schema/version
```

`frozen_at` phải có trước final evaluation output. Vế "trước khi người tham gia thấy run final test" của bản trước không còn áp dụng vì E7 ra khỏi kế hoạch (mục 15.3).

**Đăng ký trước (pre-registration, ADR-007 mục 4).** Ở mốc freeze protocol (tuần 19 của [plan-v0.4](../plan/plan-v0.4-24-weeks.md)), manifest trên cùng giả thuyết E1–E5, cấu hình engine và baseline (đã chọn trên validation), ngưỡng độ thực của workload (JSD < 0,05; KS D < 0,1; trung vị lệch < ±10%), cách tính CI và kiểm định được **commit vào repo trước khi chạy run test**. Commit này là mốc `frozen_at`. Không đổi sau khi xem kết quả test; mọi thay đổi bắt buộc ghi thành phiên bản mới kèm lý do và được báo cáo như sai lệch so với bản đăng ký. Các điểm còn mở trong tài liệu này (trước đây ghi "chờ Đức xác nhận") được chốt trong chính bản đăng ký này. Mục đích là chống nghi ngờ "tự ra đề tự chấm" khi nhóm vừa thiết kế case vừa thiết kế engine.

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

Feature windows giữ `[window_start, window_end)` và cùng alignment policy của Analysis blueprint. Online/near-real-time detection không được dùng future data ngoài window đã đóng. Độ trễ thu thập khác nhau theo modality (log ≈ 2 giây, trace ≈ 2,5 giây, counter ≈ 4–10 giây) nên một window đã đóng chưa chắc đã có đủ tín hiệu của mọi modality ở thời điểm đóng; evaluation phải đọc telemetry sau một độ trễ thu thập đã freeze (không dùng future data của window kế tiếp để lấp). Giá trị đã chốt: metric 10 s, trace 3 s, log 2 s (mục 6.1.1 bảng F).

### 7.3. Độ trễ lan truyền triệu chứng và khoảng yên lặng

Các case của v2 cố ý có triệu chứng xuất hiện **muộn và xa** nguyên nhân. Hệ quả cho evaluation interval:

- **C6 (FG):** khi dừng `identity`, lỗi `gateway-identity-token` chỉ xuất hiện sau khoảng yên lặng (smoke đo 70–74 giây với TTL 60 giây; pilot tuần 15 đo 10–20 giây ở lịch mặc định và 1,2–15 giây khi trùng cao điểm, vì lúc token hết hạn sau `pause` rơi vào 0–60 giây tùy pha làm mới; mặc định TTL 600 giây, giá trị tương ứng chưa đo; mục 6.1.1 bảng D). Request có token người dùng còn hạn vẫn thành công trong khoảng này. `fault_start` do đó **trước** triệu chứng đầu tiên một khoảng tối thiểu bằng khoảng yên lặng; Detection Delay của C6 chứa khoảng này và phải báo riêng theo case, không gộp vào delay trung bình mà không ghi chú.
- **C4 (FA):** fault matrix v2 mục 6 dự kiến lỗi lộ muộn ở `scheduler-worker`, cách nguyên nhân nhiều bước và nhiều phút. Pilot tuần 15 không thấy chuỗi này trong run 48 phút; triệu chứng đo được: `media → MinIO` 100 giây, `gateway → media` 110 giây, `media-worker` 155 giây theo lịch mặc định, 25–35 giây khi trùng cao điểm. Độ trễ do lượt upload đầu tiên trong fault đến muộn, không do fault (mục 6.1.1 bảng D).
- **C3:** pilot tuần 15 đo job dồn ở `ai-worker` sau 275 giây và lời gọi provider chậm sau 305 giây theo lịch mặc định (70 và 100 giây khi trùng cao điểm). Độ trễ do lúc job AI đến quyết định; `ai`, `course` không có triệu chứng ở cường độ 30 giây. **C2:** `course-postgres` và `gateway → course` lộ sau 10 giây; `ai-worker → course` sau 300 giây, chỉ khi có job AI.
- **C1, C5 (Target):** độ trễ từ chèn lỗi tới triệu chứng ở `media`/batch chưa đo (cơ chế chưa chạy).

Quy tắc: thời gian **fault active** được freeze sau pilot phải **lớn hơn độ trễ triệu chứng đo được của chính case đó** cộng window và persistence; nếu không, fault chưa kịp tạo triệu chứng trong `[fault_start, fault_end + late_tolerance]` và run bị tính FN do thiết kế chứ không do engine. Giá trị nào chưa có đo pilot ghi `chưa kiểm chứng` trong manifest; không nới interval theo kết quả sau khi đã xem validation/test (mục 6.4). Với bốn case MVP, quy tắc này đã được kiểm bằng số đo pilot ở mục 6.1.1 bảng D: cả bốn đạt với `late_tolerance` lớn nhất của tập ứng viên.

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
| RQ4/E3 trace-degraded (giữ 50%, giữ 10%) | intentional trace degradation đúng manifest; non-degraded required modality không có accidental blocker |
| RQ4/E3 log mất `trace_id` | log đã bỏ trường `trace_id`/`span_id` đúng manifest; metrics và traces đạt gate của full |
| RQ4/E3 mất một modality | modality bị bỏ đúng manifest (`M`, `T` hoặc `L`); hai modality còn lại đạt gate của full |
| `base-manual-auto` | metrics + traces + logs (cùng tập tín hiệu một người chẩn đoán thủ công có: dashboard, trace, log) |
| SimpleRCA | metrics + traces + logs (như bài gốc); thiếu modality thì luật của modality đó không phát cảnh báo và ghi `rca_coverage` |
| BARO | metrics (bản gốc chỉ dùng metric; bản đa nguồn của RCAEval là diagnostic) |

### 8.3. `pass | partial | fail`

- `pass`: eligible nếu execution valid và đúng variant requirement.
- `partial`: chỉ eligible khi protocol/manifest đã khai báo rõ loại thiếu hụt là acceptable cho variant đó.
- `fail`: không vào primary metric của variant đó.

Đối với baseline/full `M`, `M+T`, `M+T+L`, unexpected missingness ở **modality required** không được silently chấp nhận chỉ vì pipeline vẫn chạy; experiment chuyển `excluded` hoặc `diagnostic_only`.

Đối với RQ4 degraded artifact, `partial` có thể là **expected** nếu lý do đúng là `filtered_by_degradation` theo transform đã freeze. Một `partial/fail` do scrape gap, unknown service identity, timestamp corruption hoặc source outage ngoài degradation vẫn không được coi là robustness condition hợp lệ.

Với v2, các nguồn thiếu hụt có sẵn phải được phân loại rõ, không lẫn với degradation: (1) **broker metric thiếu gauge** (gauge không có không có nghĩa là 0 message); (2) **Tempo bị OOM-kill** (giới hạn 512 MiB ở tuần 13; pilot tuần 15 còn bị kill ở 1.024 MiB và nâng lên 1,5 GiB, báo cáo pilot mục 4) khi truy vấn hàng nghìn trace song song, nên export trace bằng truy vấn tuần tự, hạn chế số trace (đã làm ở PR #77, kèm tải lại trace lỗi ở cuối); một lần Tempo bị kill hoặc `ReadTimeout` giữa run là source outage, không phải robustness condition; (3) **log của 4 worker là `not_instrumented`** sau khi lọc probe (PR #79): thiếu log worker là giới hạn đã biết, không phải mất dữ liệu; (4) **series đứng yên sau khi runtime ngừng** (Collector giữ giá trị cuối khoảng 5 phút): quality report đánh dấu `telemetry_silent` thay vì coi là quan sát bình thường; (5) **bộ đếm lỗi xuất hiện lần đầu giữa cửa sổ** là series mới, `increase()` bỏ mẫu đầu, nên feature phải xử lý series mới (ví dụ coi giá trị trước đó là 0 khi biết series là counter) và ghi trong `feature_config_version`.

### 8.4. Tín hiệu bắt buộc theo case

Required signal/evidence lấy từ [catalogue case mục 1 và 3](complex-case-catalogue-and-rca-result-v0.md). Optional signal không tự thành blocker nếu không được đánh dấu required. Cột "Thiếu" là giới hạn đã biết (catalogue mục 1.5); thiếu tín hiệu đó **không** làm run `fail` vì tín hiệu ấy chưa tồn tại trong testbed, nhưng phải ghi là limitation của case và không được báo cáo là engine "phân biệt được".

| Case | Tín hiệu cần (đã có) | Thiếu (limitation) |
| --- | --- | --- |
| C1 (FB) | `rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"}`, `consumers`, span CLIENT `notification-smtp smtp.send`, khoảng PRODUCER → CONSUMER của `media-worker` trong cùng trace | tuổi message cũ nhất (suy từ span), độ trễ outbox, log consumer |
| C2 (FC) | `lms_dependency_duration_seconds` của `course-postgres` theo mọi `operation_name`, `process_cpu_time_seconds_total`, RSS của `course` | độ sử dụng pool: không phân biệt "pool cạn" với "DB chậm" |
| C3 (FD) | span CLIENT `ai-llm-provider POST chat/completions`, `lms_dependency_duration_seconds{dependency_identity="ai-llm-provider"}`, CONSUMER `ai-worker--run-ai-job-v1` kéo dài | log consumer của worker |
| C4 (FA) | span `media-minio *`, `lms_dependency_*{dependency_identity="media-minio"}` ở cả `media` và `media-worker` | chuỗi "Dọn media theo lịch" bỏ sau pilot (mục 6.1.1 bảng I); `scheduler` và `scheduler-worker` không cùng trace |
| C5 (FE) | span `notification-worker-identity GET /internal/v1/students`, span `identity-postgres student.list`, `lms_dependency_duration_seconds{dependency_identity="notification-worker-identity"}` | log lỗi (log không có lỗi theo thiết kế của case) |
| C6 (FG) | span CLIENT lỗi `gateway-identity-token POST /internal/v1/auth/service-token`, `gateway-identity POST`, `lms_dependency_error_count_total{dependency_identity="gateway-identity-token"}`, log `dependency.failure` khớp `span_id`; `process_cpu_time_seconds_total` của `identity` ngừng tăng (dấu hiệu runtime ngừng, vì Collector vẫn xuất giá trị cuối của mọi series thêm khoảng 5 phút sau `docker pause`) | giới hạn tốc độ `service-token` chưa làm (board); metric RED của `identity` trông "còn sống" trong khoảng 5 phút đầu, cờ `telemetry_silent` của quality report (PR #79) là nguồn bằng chứng chính |
| C7 (FH) | tăng `SERVICE_TOKEN_INVALID`/401 nhiều service cùng lúc, span `*-identity-jwks` refetch, 4xx ở `http_server_request_count_total` | — |

### 8.5. Nhiễu telemetry và luật lọc

Catalogue case mục 1.5 ghi nhận **trace gây nhiễu**: `scheduler-worker` tạo trace gốc cho mỗi lần thăm dò DB (mỗi giây) và mọi runtime tạo trace cho `/ready`. Luật lọc theo `http_route_template`/`operation_name` là một phần của feature/analysis config, **version hóa (`noise_filter_version`) và áp dụng như nhau** cho mọi RCA variant, baseline thủ công tự động và tập trace trình cho người tham gia. Không được lọc riêng cho một variant để có lợi. Bản lọc đầu tiên đã cài trong export (PR #77): bỏ trace `GET /ready`, `GET /health` và các thao tác thăm dò `scheduler-postgres` (`run.claim-next`, `run.fail-exhausted`, `job.lock-due-cron`); SimpleRCA và BARO cũng đọc từ cùng artifact đã lọc. Bản chốt sau pilot là `noise.v1` (mục 6.1.1 bảng G): thêm bỏ route probe khỏi metric HTTP và thao tác `ping` khỏi metric dependency. Lệch identity đã biết: khi `notification-worker` phát lại command từ outbox, dependency identity là `notification-rabbitmq` thay vì `notification-worker-rabbitmq`; nếu chưa sửa ở telemetry trước khi thu dataset, luật ánh xạ identity → service phải ghi rõ trong `feature_config_version` và áp dụng như nhau cho mọi variant.

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
- tham số SimpleRCA (hệ số sigma, percentile, bội số so với baseline, danh sách từ khóa lỗi) và BARO (độ dài đoạn trước/sau điểm đổi) trong không gian khai báo ở mục 15.2.1;
- ngưỡng cố định của baseline ngưỡng tĩnh cho E1;
- tie/fallback rule;
- data-quality threshold;
- luật lọc nhiễu;
- E3 degradation implementation/lineage/quality-gate behavior; tỉ lệ giữ trace 0,50 và 0,10 không phải hyperparameter để chọn theo validation performance.

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

Theo ADR-007, ablation **E5** gồm: bỏ từng modality khỏi engine đầy đủ (`M+T+L` → bỏ `T`, bỏ `L`; `M` là mốc), bỏ graph (mục 11), bỏ temporal (mục 12) và **thay detector học máy bằng z-score** (cùng feature, cùng incident rule; chỉ detector đổi) để biết phần học máy đóng góp gì ở bước phát hiện. Ablation bỏ modality ở đây là **cấu hình engine** trên artifact đầy đủ; mất modality do quan sát (E3, mục 13) là **điều kiện dữ liệu** trên engine cố định, hai bảng báo riêng. Mẫu bỏ từng modality theo Nezha (Yu et al., ESEC/FSE 2023, [GitHub](https://github.com/IntelligentDDS/Nezha), `[L-Nezha]`) và Eadro (Lee et al., ICSE 2023, [arXiv 2302.05092](https://arxiv.org/abs/2302.05092), `[L-Eadro]`).

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

## 13. RQ4 — Robustness protocol v1 (E3 — quan sát suy giảm, ADR-007)

### 13.1. Các điều kiện suy giảm

**Thay đổi theo ADR-007.** Bản trước giữ nguyên thiết kế freeze của v0: một focused condition `full telemetry vs 50% controlled trace dropping simulation` (`degradation_type: trace_drop`, `trace-drop.v0`, `drop_ratio: 0.50`, `granularity: whole_trace`) và không mở rộng thành nhiều sampling level × modality. ADR-007 thay bằng bộ **E3** dưới đây vì một điều kiện duy nhất không cho thấy baseline dựa trace sụp ở đâu khi quan sát thiếu, trong khi production thường lấy mẫu trace (Dapper mô tả lấy mẫu là thiết kế chuẩn để giữ overhead thấp: Sigelman et al. 2010, [Google TR](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/), `[L-Dapper2010]`). Đây là chỗ RCA engine đa nguồn được kỳ vọng giữ độ chính xác còn `base-manual-auto` (đi theo trace) thì không; đó là giả thuyết đăng ký trước, không phải kết luận.

Mọi điều kiện đều **offline, trên cùng run** (transform artifact đầy đủ, không chạy lại workload/fault):

| `analysis_variant_id` | `degradation_type` | Tham số | Ý nghĩa |
| --- | --- | --- | --- |
| `rq4-full` | — | — | Artifact đầy đủ, 100% trace sampling (mốc) |
| `rq4-trace-keep50` | `trace_keep` | `keep_ratio: 0.50`, `granularity: whole_trace` | Giữ 50% trace (tương đương bỏ 50% của thiết kế cũ) |
| `rq4-trace-keep10` | `trace_keep` | `keep_ratio: 0.10`, `granularity: whole_trace` | Giữ 10% trace, gần mức lấy mẫu thường gặp ở production |
| `rq4-log-no-trace-id` | `log_trace_context_drop` | bỏ `trace_id`, `span_id` khỏi mọi bản ghi log | Log không còn nối được sang trace; metrics và traces giữ nguyên |
| `rq4-drop-m` / `rq4-drop-t` / `rq4-drop-l` | `modality_drop` | bỏ toàn bộ một modality | Mất một nguồn quan sát (ví dụ backend trace hoặc log ngừng); hai modality còn lại giữ nguyên |

Baseline trace collection là 100% sampling (đã đúng ở testbed v2: mọi runtime xuất span với 100% sampling). Các tỉ lệ 0,50 và 0,10 được chốt theo thiết kế, **không** tune theo detection/RCA performance. Khả thi của whole-trace sampling trên trace v2 (trace chứa cả chuỗi async và nhiều service) **chưa kiểm chứng**; validation chỉ kiểm tra implementation correctness, source/derived artifact lineage, missingness calculation, reproducibility và feasibility/quality gate. Nếu pilot cho thấy một điều kiện không khả thi hoặc không qua quality gate, phải bump config version, ghi rationale và freeze lại trước final test; không silently đổi tỉ lệ theo metric.

Mỗi điều kiện được chạy cho RCA engine **và** các baseline của bảng chính (`base-manual-auto`, SimpleRCA, BARO) trên cùng pair, để so mức suy giảm giữa các phương pháp. BARO chỉ dùng metric nên chỉ đổi kết quả ở `rq4-drop-m`; điều đó được báo cáo đúng như vậy.

Canonical config gợi ý:

```text
degradation_config_version: degradation.v1   # thay trace-drop.v0
trace_keep:   keep_ratio ∈ {0.50, 0.10}, granularity = whole_trace, seed cố định
log_trace_context_drop: fields = [trace_id, span_id]
modality_drop: modality ∈ {M, T, L}
```

### 13.2. Transformation semantics

- Source phải là full/baseline telemetry artifact của cùng `run_id`.
- `trace_keep`: lấy mẫu ở **whole-trace granularity** (giữ hoặc bỏ cả trace), không drop random individual span làm gãy trace. Selection phải deterministic theo `trace_id` + frozen `degradation_seed` (ví dụ giữ trace khi `hash(trace_id, seed)` rơi vào phần `keep_ratio` đầu), để tập giữ 10% là tập con của tập giữ 50% cùng seed.
- `trace_keep`: metrics và logs không bị biến đổi. Log vẫn mang `trace_id`/`span_id` của trace đã bỏ; evaluation phải ghi nhận log tham chiếu tới trace không còn để RCA không dùng được `trace_id` đó làm bằng chứng tham chiếu mở.
- `log_trace_context_drop`: chỉ xóa trường liên kết trace của log; nội dung log, thời điểm, `service.name` giữ nguyên; metrics và traces không đổi.
- `modality_drop`: modality bị bỏ được ghi là missing (`filtered_by_degradation`), **không** điền 0; candidate không bị xóa khỏi ranking (mục 18.2).
- Derived artifact có `artifact_id` mới và bắt buộc giữ `source_artifact_id`.
- `TelemetryQualityReport` mới được sinh cho degraded artifact.
- Missingness do transform phải được ghi `filtered_by_degradation`/semantic tương đương, không giả thành source outage.
- `RunGroundTruth`, workload, fault timing, root-cause truth và execution validity giữ nguyên.

### 13.3. Pairing rule

Một RQ4/E3 pair (full, một điều kiện suy giảm) hợp lệ khi:

```text
same run_id
same RunGroundTruth ref
same split
same feature/window policy
same detector/incident/RCA/evaluation config
same candidate set
only telemetry condition differs (đúng một degradation_type)
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

Báo cáo theo từng điều kiện của mục 13.1 và theo từng phương pháp (engine, `base-manual-auto`, SimpleRCA, BARO), kèm bootstrap CI 95% của delta (mục 20.7). Với RQ4, Top-1, Top-3 và MRR phải có paired **end-to-end** outcome trên mọi eligible same-run pair. Nếu full hoặc degraded không tạo matched incident/RCA output (kể cả `verdict = "insufficient_evidence"`), pair vẫn ở denominator với Top-1/Top-3 là miss và reciprocal rank bằng 0; Average Rank giữ là conditional metric trên ranking đã tạo và báo `rca_coverage` riêng.

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
- baseline thủ công tự động (`base-manual-auto`) làm điểm tham chiếu chi phí/chất lượng;
- SimpleRCA và BARO (chi phí chạy rất thấp; Pham et al. ghi nhận BARO và NSigma chỉ khoảng 0,01 giây mỗi case mà vẫn cạnh tranh, ASE 2024, [arXiv 2408.13729](https://arxiv.org/abs/2408.13729), `[L-Pham2024ASE]`).

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

Reference và instrumented condition phải giữ workload profile/seed, code/business behavior và environment tương đương; nếu instrumentation-off làm thay code path ngoài telemetry concern, limitation phải ghi rõ. Workload k6 mức 1 đã có (PR #76) và đủ cho phép đo overhead vì chỉ cần tải lặp lại được; testbed có biến `OTEL_SDK_DISABLED=true` để tắt SDK ([docker-compose README](../../../docker-compose/README.md)) nhưng **chưa kiểm chứng** việc tắt này không đổi code path nghiệp vụ; đo overhead chỉ được làm sau khi kiểm chứng điều đó.

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

## 15. Đối chứng thủ công, baseline đã công bố và thời gian chẩn đoán (ADR-002, ADR-006, ADR-007)

ADR-002 mục 3–4 quyết định: đối chứng là **baseline thủ công tự động** (đo lặp được) cộng **thử nghiệm vài người thật** dùng Grafana/Tempo/Loki, và đánh giá **thời gian chẩn đoán** bên cạnh Top-1/Top-3/MRR và ablation. ADR-006 định nghĩa lại `base-manual-auto` và đưa thử nghiệm người xuống Target; ADR-007 thêm hai baseline đã công bố (SimpleRCA, BARO), chi phí chẩn đoán (E4), đối chứng ngoài (E6) và case study (E8). Mục này là phần v0 chưa có. Chưa có baseline, người tham gia hay thời gian chẩn đoán nào được đo.

### 15.1. Mục đích và phạm vi của đối chứng

Bản đầu ghi mục đích là kiểm chứng rằng với case phức tạp "AI tìm được nguyên nhân mà truy vết thủ công không tìm ra hoặc tìm chậm hơn". Theo ADR-006 mục 3 và ADR-007 mục 3, giá trị của RCA engine được chứng minh bằng **chi phí, độ ổn định và độ bền của chẩn đoán**, không bằng lập luận "người không tìm ra": trace đã nối xuyên RabbitMQ nên ở C2–C4 span lỗi/chậm của nguyên nhân nằm ngay trong trace, và nghiên cứu cho thấy baseline đơn giản thường ngang SOTA (Pham et al., ASE 2024, `[L-Pham2024ASE]`; Fang et al. 2025, `[L-Fang2025]`). Vì vậy đối chứng đo: độ chính xác Top-1/MRR trên cùng run (E2), độ chính xác khi quan sát thiếu (E3, mục 13), số artifact phải mở và thời gian (E4, mục 15.4), và với người thật (E7, Target). Kết quả phải được báo cáo đúng, kể cả khi baseline tìm đúng ở mọi case của C2 (case đối chứng dễ theo ADR-006). Kết luận chỉ nói về tập case thực sự đã đánh giá (mục 5.2).

### 15.2. Baseline thủ công tự động (`base-manual-auto`)

Bản đầu (ADR-002) mô tả baseline đọc dashboard và trace "theo đường request của triệu chứng": **ngưỡng + tìm trace lỗi/chậm nhất**. **ADR-006 mục 3.2 định nghĩa lại** để mô phỏng cách một SRE làm thật và không bị cấm nhìn ra ngoài đường request: từ triệu chứng, lấy các trace lỗi/chậm nhất trong cửa sổ incident, đi theo span CLIENT lỗi hoặc chậm **sâu nhất** (kể cả qua cạnh async/auth sang service khác) và kết luận service sở hữu span đó. Về bản chất baseline này gần TraceRCA (Li et al., IWQoS 2021, [GitHub](https://github.com/NetManAIOps/TraceRCA), `[L-TraceRCA]`), một baseline mạnh. Ràng buộc protocol (độc lập với thuật toán chi tiết):

- Chạy lặp được, deterministic, trên cùng eligible run, cùng candidate set `service-candidates.v1` và cùng ground truth như RCA engine; `analyst_kind = manual_baseline_auto`.
- Chỉ dùng tín hiệu mà người thủ công có: RED metric theo service, trace lỗi/chậm nhất trong cửa sổ incident, log theo `trace_id`. Không dùng mô hình đã học, graph model, điểm bất thường học từ healthy train hay ground truth.
- Bắt đầu từ cùng cửa sổ incident do detector khai báo (mục 15.4), không từ `fault_start`.
- **Ghi nhật ký thao tác** cho E4: mỗi trace tải từ Tempo, mỗi truy vấn PromQL (tương đương một panel), mỗi truy vấn LogQL là một artifact; đếm theo loại cho tới khi baseline ra kết luận (mục 15.4).
- Đầu ra theo cùng schema `RcaIncidentResult` (`model.name` là tên baseline), ranking đủ 10 candidate (service không chạm trace nào xếp sau theo tie-break mục 18.1), để cùng harness chấm Top-1/Top-3/MRR.
- Ngưỡng chọn trace "chậm", số trace xem tối đa, cách chuyển span tìm được thành ranking là tham số; chọn trên validation, version hóa (`rca_config_version`) và freeze trước final test (mục 6.3).
- Đây là baseline chặt: nó không phải "người thật" và không đại diện cho mọi cách chẩn đoán thủ công; thử nghiệm người (15.3) từng được dự kiến bù giới hạn này nhưng đã ra khỏi kế hoạch, nên giới hạn được ghi thẳng trong báo cáo.

Hai mốc tham chiếu bắt buộc (ADR-006, ADR-007 mục 5): **constant ranking** theo thứ tự tie-break và **random ranking** (kỳ vọng Top-1 = 1/10, mục 18.4), để biết một kết quả Top-K cao có cần telemetry hay không. Thêm baseline **ngưỡng tĩnh** của blueprint (xếp service theo số tín hiệu vượt ngưỡng cố định) vào bảng chính E2.

### 15.2.1. Baseline đã công bố: SimpleRCA và BARO (ADR-007, E2)

Hai baseline đã công bố được thêm vào bảng chính để engine không chỉ so với baseline do nhóm tự đặt. Cả hai:

- chạy trên **cùng artifact đã lọc nhiễu** (mục 8.5), cùng cửa sổ incident do detector của engine khai báo (dùng `estimated_start_time`/`detected_at`, **không** dùng `fault_start` vì đó là truth), cùng candidate set 10 service;
- ánh xạ tín hiệu về service bằng `service.name` của metric/span/log (metric broker theo tiền tố queue như mục 4.1); thành phần hạ tầng không là candidate;
- xuất `RcaIncidentResult` ranking đủ 10 candidate (`analyst_kind = simplerca_baseline` / `baro_baseline`);
- có tham số mặc định theo bài gốc; chỉ được chọn trong không gian nhỏ khai báo dưới đây trên **validation**, ghi version và freeze; giá trị lệch mặc định phải nêu lý do trong báo cáo.

**SimpleRCA** (Fang et al. 2025, FSE 2026, [arXiv 2510.04711](https://arxiv.org/abs/2510.04711), `[L-Fang2025]`): luật mô phỏng trực giác của chuyên gia. Theo mô tả trong bài: trên metric, cảnh báo khi giá trị vượt ngưỡng 3-sigma hoặc P95 của đoạn tham chiếu; trên trace, cảnh báo khi độ trễ P95 của service ≥ 3 lần mức tham chiếu; trên log, đếm bản ghi chứa từ khóa lỗi; service có **nhiều cảnh báo nhất** xếp đầu. Áp vào testbed:

```text
đoạn tham chiếu  = cửa sổ khỏe ngay trước incident trong cùng run (độ dài chọn trên validation)
metric alert     = |x - mean_ref| > k_sigma * std_ref  hoặc  x > P95_ref        (k_sigma mặc định 3)
trace alert      = P95 latency(service, cửa sổ incident) >= m * P95_ref          (m mặc định 3)
log alert        = số log của service khớp danh sách từ khóa lỗi (error, exception, timeout, failed, ...)
score(service)   = tổng số cảnh báo; hòa thì theo tie-break mục 18.1
không gian chọn  = k_sigma ∈ {2, 3}; m ∈ {2, 3}; độ dài đoạn tham chiếu ∈ {5, 10} phút; danh sách từ khóa cố định
```

Chi tiết luật nào trong bài gốc (ví dụ ngưỡng 3-sigma hay P95 cho từng loại metric) chưa đối chiếu từng dòng với mã của tác giả; bản cài đặt phải ghi rõ chỗ khác bài gốc.

**BARO** (Pham, Ha, Zhang, FSE 2024, [arXiv 2405.09330](https://arxiv.org/abs/2405.09330), `[L-BARO]`): (1) phát hiện thời điểm bất thường bằng Bayesian online change point detection đa biến trên ma trận metric; (2) xếp hạng nguyên nhân bằng kiểm định phi tham số dựa trên median và IQR (RobustScaler) của từng metric sau điểm đổi so với trước điểm đổi; điểm của service là điểm lớn nhất trong các metric của service đó. Dùng mã trong RCAEval (MIT, [GitHub](https://github.com/phamquiluan/RCAEval), `[L-RCAEval]`) qua adapter đọc `metrics.parquet` của export (PR #77) thành ma trận chuỗi thời gian theo service. Chỉ dùng metric như bản gốc; "multi-source BARO" của RCAEval là diagnostic. Tham số giữ mặc định của RCAEval; chỉ chọn trên validation độ dài dữ liệu trước/sau đưa vào (∈ {5, 10} phút). Pham et al. ghi nhận BARO bền hơn các phương pháp khác khi thời điểm lỗi ước lượng lệch khoảng 1 phút (ASE 2024, `[L-Pham2024ASE]`), nên dùng cửa sổ do detector khai báo là công bằng với BARO.

Trước khi dùng trên testbed, chạy lại BARO của RCAEval trên một phần RE2 để kiểm tra adapter cho kết quả gần số đã công bố (bước này trùng bước đầu của E6, mục 15.7).

### 15.3. Thử nghiệm người (E7, Target)

**Quyết định 19/11/2026: E7 ra khỏi kế hoạch.** Bách xác nhận không có người tham gia nào ngoài hai thành viên nhóm. Hai thành viên đã xây testbed, biết danh mục case, ground truth và cấu hình injector, nên không là người tham gia hợp lệ (mục *Người tham gia* bên dưới, invariant 15): kết quả sẽ thiên lệch. Theo điều kiện của plan-v0.4 tuần 15 ("chưa có người thì E7 ra khỏi kế hoạch"), E7 không chạy. RQ6 dựa trên E1 (phát hiện), E2 (khoanh vùng) và E4 (chi phí chẩn đoán) với `base-manual-auto` (mục 15.2, 15.4, 15.5). Thiết kế bên dưới giữ lại làm tài liệu tham khảo, không thuộc campaign; muốn khôi phục phải có người tham gia hợp lệ và ghi lại quyết định mới trước freeze (mục 6.3).

**Mức và quyết định.** ADR-006 đưa thử nghiệm người xuống **Target** (2–3 người, minh họa định tính); ADR-007 (E7) giữ Target nhưng nâng thiết kế thành **within-subject** để đo được hiệu quả khi người có báo cáo engine. Số người: **6–10** nếu tìm được (bạn cùng khóa, kỹ sư quen Grafana); nếu không thì **2–3** người và chỉ trình bày định tính như ADR-006. Bản trước ghi số người, time cap và brief là "đề xuất chờ Đức"; trong giai đoạn tự bắt kịp, **Bách quyết định danh sách người tham gia trước tuần 15** của [plan-v0.4](../plan/plan-v0.4-24-weeks.md) và chốt các giá trị còn lại trong bản đăng ký trước (mục 6.3). Không có người tham gia thì E7 bị bỏ và báo cáo nêu rõ; MVP không phụ thuộc E7.

**Cơ sở tham khảo.** Chưa tìm thấy nghiên cứu có kiểm soát nào đo kỹ sư làm RCA microservice có/không có công cụ (kết quả tra cứu ở [realism-and-ai-contribution-strategy-v1](../direction/realism-and-ai-contribution-strategy-v1.md) mục 2.1). Mẫu gần nhất là user study của LogAssist: 19 người, mỗi người 6 task (3 có công cụ, 3 không, cân bằng), tổng thời gian giảm 42,49%, nhưng hai task dễ nhất lại chậm hơn khi có công cụ và chỉ 2/6 task có ý nghĩa thống kê (Locke et al., IEEE TSE 48(9), 2022, bản early access 2021, [PDF](https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf), `[L-LogAssist]`). Ahmed et al. cho 25 incident owner chấm gợi ý root cause của LLM trên thang 5 điểm (ICSE 2023, [arXiv 2301.03797](https://arxiv.org/abs/2301.03797), `[L-Ahmed2023]`). Hai nghiên cứu này cho thấy với mẫu nhỏ chỉ nên kỳ vọng hiệu ứng mô tả và phải báo cả task mà công cụ làm chậm.

**Thiết kế.**

- **Within-subject:** mỗi người làm **4 incident** (một incident mỗi case MVP C2, C3, C4, C6, lấy từ run final test), **2 incident ở điều kiện A** (chỉ Grafana/Tempo/Loki/Prometheus) và **2 incident ở điều kiện B** (Grafana + báo cáo engine: `RcaIncidentResult` đã render, gồm ranking, evidence, timeline). Gán case × điều kiện và thứ tự theo **Latin square** để mỗi case xuất hiện ở cả A và B qua các người, và thứ tự A/B cân bằng.
- **Làm quen:** 10 phút trên một incident mẫu không thuộc test (ví dụ run validation), cả hai điều kiện.
- **Người tham gia:** không bao gồm Bách, Đức hay bất kỳ ai đã biết danh mục case, ground truth hoặc cấu hình injector (điều đó phá invariant 15). Mô tả mức quen thuộc với Grafana/Tempo/Loki của từng người trong bản ghi (tự khai).
- **Tài nguyên được dùng:** Grafana (dashboard `service-overview`), Tempo, Loki và Prometheus của stack observability, cho đúng cửa sổ thời gian của run. Không có quyền đọc repo tài liệu `docs/`, catalogue, mã nguồn LMS, cấu hình injector hay ground truth.
- **Brief:** chỉ trình triệu chứng người dùng thấy (route/hành vi lỗi, thời điểm) và tên run slot, **không** `fault_type`, `scenario_id`, `case_id`, root cause hay hint nhân quả. Ở điều kiện B, báo cáo engine được nói rõ là "gợi ý, có thể sai" (Meta ghi nhận gợi ý sai có thể đánh lừa kỹ sư: Hsu et al., Engineering at Meta 2024, [blog](https://engineering.fb.com/2024/06/24/data-infrastructure/leveraging-ai-for-efficient-incident-response/), `[L-MetaRCA]`).
- **Câu hỏi:** "service nào là nguyên nhân gốc?" trả lời bằng một `service.name` trong 10 candidate (kèm component nếu biết, không tính vào primary metric). Cho phép trả lời `không xác định`.
- **Time cap:** đề xuất **15 phút** mỗi incident; hết cap tính `timed_out`.
- **Đo:** thời gian, đúng/sai, **số artifact đã mở** (panel, trace, truy vấn log; lấy từ log truy cập Grafana/Tempo/Loki hoặc ghi màn hình), **NASA-TLX rút gọn** (Raw TLX, 6 thang, không có bước so sánh cặp trọng số: Hart & Staveland 1988, Hart 2006, `[L-NASA-TLX]`) sau mỗi incident, **SUS** (10 câu, điểm 0–100, trung bình tham khảo khoảng 68: Brooke 1996, [MeasuringU](https://measuringu.com/sus/), `[L-SUS]`) một lần cho điều kiện B ở cuối buổi.
- **Dữ liệu dùng:** run thuộc **final test split**, cùng run mà RCA engine và baseline được chấm, để so ghép cặp. Kết quả thử nghiệm người không được dùng để chỉnh engine hay baseline (mục 9.3).
- **Phát lại:** telemetry của run phải còn truy vấn được khi người tham gia làm; retention của stack là 24 giờ nên thử nghiệm phải chạy trong cửa sổ đó (ví dụ chạy run test rồi làm thử nghiệm ngay trong ngày) hoặc telemetry phải được nạp lại. **Cách nạp lại/phát lại chưa kiểm chứng.**
- **Phân tích:** với n ≥ 6, so A và B ghép cặp theo người bằng Wilcoxon signed-rank cho thời gian và số artifact, kèm effect size và bootstrap CI 95% (mục 20.7); tỉ lệ đúng báo mô tả. Với n = 2–3: chỉ bảng mô tả từng lượt và nhận xét định tính, không kiểm định.

Bản ghi mỗi lượt (logical, đề xuất):

```text
HumanDiagnosisRecord
- record_id
- participant_id                   # ẩn danh
- participant_experience           # tự khai, mô tả ngắn
- run_id                           # tham chiếu run final test
- condition                        # A_manual | B_engine_report (ADR-007, E7)
- presentation_order               # thứ tự incident của người này
- brief_shown_at
- answer_submitted_at
- duration_seconds                 # answer_submitted_at - brief_shown_at, đồng hồ monotonic của harness
- timed_out                        # true nếu hết time cap
- answer_service                   # một service.name hoặc "unknown"
- answer_component                 # nullable
- tools_used                       # tự khai: grafana | tempo | loki | prometheus
- artifacts_opened                 # đếm theo loại: panel | trace | log_query
- raw_tlx                          # 6 thang 0–100 và trung bình
- sus_score                        # chỉ ở bản ghi cuối buổi, điều kiện B
- run_ground_truth_ref             # evaluator resolve sau khi nộp đáp án
- correct                          # evaluator tính sau: answer_service == root_cause_service
```

### 15.4. Thời gian và chi phí chẩn đoán (E4)

Thời gian chẩn đoán là metric riêng, không gộp vào Top-K/MRR hay score tổng hợp:

```text
Người:      T_human  = duration_seconds (từ lúc brief được trình tới lúc nộp đáp án), timed_out là bị chặn (censored)
Engine:     T_engine = rca_runtime_per_incident (đo thật, mục 19.1)
Baseline:   T_base   = thời gian chạy của luật baseline trên incident
```

Mốc bắt đầu chung là **lúc incident được khai báo** (incident `detected_at` của incident matched): người nhận brief ở mốc đó, engine/baseline bắt đầu phân tích ở mốc đó. Bổ sung hai giá trị báo riêng, không cộng ngầm:

- `detection_delay_seconds` (mục 17.5), chung cho engine và baseline, tính theo thời gian telemetry;
- độ trễ thu thập của stack (log ≈ 2 giây, trace ≈ 2,5 giây, counter ≈ 4–10 giây, backlog queue ≈ 9 giây) để người đọc biết thời gian engine không gồm.

**Chi phí chẩn đoán (E4, ADR-007, MVP).** Đại lượng so sánh chung giữa `base-manual-auto` và engine là **số artifact phải mở** cho tới khi có kết luận, vì nó cùng bản chất cho máy và người:

```text
base-manual-auto: N_trace (trace tải từ Tempo) + N_metric_query (truy vấn PromQL / panel) + N_log_query (truy vấn LogQL)
                  cho tới khi luật ra kết luận; kèm "kết luận đúng ở artifact thứ mấy" nếu đúng
engine:           số evidence trong ranking[0].evidence[] (bằng chứng đã chọn sẵn mà người cần đọc để kiểm lại)
người (E7):       artifacts_opened của HumanDiagnosisRecord theo điều kiện A/B
```

Báo theo case: trung vị, min, max số artifact và thời gian tới kết luận **đúng** (run kết luận sai báo riêng). Cách đếm (artifact nào tính là một) được freeze trong `rca_config_version` của baseline trước final test.

Giới hạn trung thực: run được phân tích offline từ artifact, nên `created_at` của `RcaIncidentResult` là giờ thực lúc phát lại và **không** dùng làm thời gian chẩn đoán; thời gian chẩn đoán của engine là thời gian chạy đo được. So `T_human` với `T_engine` là so hai đại lượng khác bản chất (người đọc dashboard so với engine chạy pipeline), nên chỉ mô tả cạnh nhau, không kết luận định lượng về "nhanh hơn bao nhiêu lần". Bản trước để cách chuẩn hóa là "câu hỏi mở chờ Đức"; theo ADR-007, protocol **không** chuẩn hóa hai đại lượng này mà dùng số artifact (E4) và so sánh A/B trong cùng người (E7) làm phép đo hiệu quả.

### 15.5. So sánh ghép cặp và báo cáo (E2)

Trên mỗi run final test eligible, ghép các đầu ra cùng `run_id`:

```text
RCA engine         -> end-to-end hit/rank, T_engine, số evidence
base-manual-auto   -> end-to-end hit/rank, T_base, số artifact đã mở
SimpleRCA          -> end-to-end hit/rank
BARO               -> end-to-end hit/rank
ngưỡng tĩnh        -> end-to-end hit/rank
random, constant   -> kỳ vọng/thứ hạng tham chiếu
người tham gia     -> correct, duration_seconds, timed_out, condition (khi có E7)
```

Báo cáo:

- Bảng chính E2: **Top-1 và MRR là chỉ số chính**, kèm Top-3, end-to-end trên cùng denominator (mục 20.3), cho engine và mọi baseline, **luôn kèm** random và xếp hạng hằng (ADR-006, ADR-007 mục 5); theo từng case và gộp; bootstrap CI 95%; McNemar exact cho Top-1 của engine so với từng baseline trên cùng incident (mục 20.7). `verdict = "insufficient_evidence"` là miss.
- **Số run engine tìm đúng mà baseline/người không tìm ra** (và ngược lại), kèm denominator, theo từng case. Đây là số đếm mô tả, không có ngưỡng thành công đặt trước.
- Case engine hòa hoặc thua baseline được báo cáo đầy đủ; dự kiến C2 (case đối chứng dễ) baseline cũng đúng.
- Phân phối `duration_seconds` của người theo case và điều kiện (count, median, min, max, số `timed_out`), cộng `T_engine`; phân tích A/B theo mục 15.3.
- Trạng thái kiểm chứng của từng case (mục 4.2) đặt cạnh kết quả: kết quả trên case chỉ đã đo tín hiệu hoặc giả thuyết không được trình bày như kết quả trên case đã chạy.
- Không tạo composite score kết hợp chính xác và thời gian.

### 15.6. Đánh giá agent MCP (không còn áp dụng)

**Out-of-scope theo ADR-006** (MCP server và agent không làm); nội dung dưới giữ làm lịch sử thiết kế. Chất lượng báo cáo của agent (độ đúng, dẫn chứng, độ phủ) **chỉ** được đánh giá khi phần MCP/agent được làm (ADR-002 mục 4); **không** phải tiêu chí hoàn thành đề tài, và `aiops-platform/mcp/` không tồn tại. Khi làm, áp dụng các ràng buộc:

- Agent đọc `RcaIncidentResult` đã có (không phải telemetry thô), không thay mô hình ML xếp hạng.
- Công cụ `get_ground_truth` chỉ bật khi đánh giá offline và tắt khi chạy thật (ADR-002 ràng buộc); báo cáo agent được sinh khi tắt công cụ này, sau đó evaluator mới đối chiếu.
- Chấm tối thiểu: (1) nguyên nhân agent nêu có trùng `root_cause_service`; (2) mỗi dẫn chứng agent trích có nằm trong `evidence[]` và truy ngược được; (3) khi `verdict = "insufficient_evidence"` agent báo "không đủ chứng cứ" thay vì bịa; (4) `summary` và chuỗi từ log/trace là dữ liệu không tin cậy, không được làm agent đổi hành vi (kiểm bằng một số case có nội dung cố ý chứa chỉ thị, nếu làm).
- Đây là phần bổ sung riêng, không thay Top-K/MRR của engine và không đi vào final headline metrics nếu chưa có protocol chấm đã freeze.

### 15.7. Đối chứng ngoài trên RCAEval RE2 (E6, Target)

**Mục đích.** Kiểm tra engine không chỉ khớp với lỗi do chính nhóm thiết kế. Đây là kiểm tra **khả năng tổng quát**, không phải bảng xếp hạng (ADR-007 mục 5).

**Dữ liệu.** RCAEval (Pham, Zhang, Ha, Salim, Zhang, WWW 2025 Companion, DOI [10.1145/3701716.3715290](https://doi.org/10.1145/3701716.3715290), [arXiv 2412.17015](https://arxiv.org/abs/2412.17015), `[L-RCAEval]`): 735 case trên Online Boutique, Sock Shop, Train Ticket; giấy phép MIT. Suite **RE2** (270 case, 90 mỗi hệ thống) có đủ metric, log và trace thu bằng Prometheus, Loki, Jaeger, gần stack của đề tài. E6 dùng **RE2-OB** và **RE2-TT** (Sock Shop của RE2 không có trace). Tải theo từng suite/case (bản zip đầy đủ RE2 khoảng 4,2 GB; máy nhóm có khoảng 15 GB RAM nên chạy từng case, không nạp cả suite).

**Các bước.**

1. **Tái lập BARO trước** bằng mã của RCAEval trên RE2-TT, so với số đã công bố (bảng RE2-TT trong bài: BARO AC@1 0,67; AC@3 0,82; Avg@5 0,80). Lệch lớn thì dừng và sửa môi trường/adapter, không chạy engine.
2. **Adapter** (không đổi engine): `metrics` → ma trận chuỗi thời gian theo service; `traces.csv` → span (dựng graph động); `logs.csv` → đếm log lỗi theo service; đoạn trước `inject_time` là dữ liệu khỏe để fit detector của chính case đó; tắt các thành phần đặc thù testbed (cạnh `*-identity-token`, quy ước queue owner) khi không có tương ứng. Tên cột và ánh xạ ghi trong `adapter_config_version`.
3. **Chạy engine** với cấu hình **đã freeze trên validation của testbed**. RCAEval **không** dùng để tune; chỉ tham số adapter (ánh xạ tên cột, đơn vị) được chỉnh và ghi lại.
4. **Báo cáo** AC@1, AC@3, Avg@5 theo cách tính của RCAEval cạnh số đã công bố của BARO, TraceRCA, CIRCA, MicroRank, RCD; thêm Top-1/MRR theo mục 18 và mốc random 1/N (N = số service của hệ thống). Engine thua BARO/TraceRCA trên RCAEval được ghi rõ; Fang et al. cũng ghi nhận SOTA thua baseline đơn giản ở nhiều bộ dữ liệu (`[L-Fang2025]`).

**Lưu ý.** Fang et al. chỉ ra workload của benchmark cũ là tốc độ thấp (RE2-TT khoảng 4,35 QPS) và phủ ít service, nên kết quả trên RCAEval dễ cao hơn trên tải thật (`[L-Fang2025]`); báo cáo nêu giới hạn này. Bộ dữ liệu mới của Fang et al. (Zenodo, CC BY 4.0) là lựa chọn thay thế nếu còn thời gian, không thuộc E6.

### 15.8. Case study C6 (E8, MVP)

Trình bày một run final test của C6 dưới dạng hai chuỗi đặt cạnh nhau: (1) chuỗi bằng chứng engine trả (`RcaIncidentResult.ranking[0]`: lỗi hiện ở `gateway` qua cạnh `gateway-identity-token`, nguyên nhân ở `identity` im lặng, cờ `telemetry_silent` từ quality report vì Collector vẫn xuất giá trị cuối khoảng 5 phút sau khi runtime ngừng, `process_cpu_time_seconds_total` của `identity` không tăng); (2) đường truy vết thủ công của `base-manual-auto` (và người, nếu có E7) với số artifact đã mở. Mục tiêu là tính **diễn giải**: mỗi evidence truy ngược được tới telemetry gốc (mục 14). Case study chọn run trước khi xem kết quả (run đầu tiên của C6 trong final test), không chọn run đẹp nhất.

---

## 16. Đầu ra được chấm: `RcaIncidentResult`

Prediction artifact của evaluation là `RcaIncidentResult` ([catalogue case mục 5.2](complex-case-catalogue-and-rca-result-v0.md), `rca_result_schema_version = "0"`), mỗi incident một file JSON bất biến cùng `manifest.json` (`incident_id`, `run_id`, `created_at`, `sha256`) ở `aiops-platform/training/results/<run_id hoặc ngày>/<incident_id>.json` (gói `aiops-platform/training/` đã có từ PR #77 nhưng thư mục `results/` cho kết quả RCA chưa có; nơi lưu chỉ là đề xuất của catalogue mục 5.3). Evaluation pin phiên bản schema; đổi schema hoặc nơi lưu phải cập nhật catalogue và bump `evaluation_config_version`. `base-manual-auto`, SimpleRCA, BARO và ngưỡng tĩnh cũng xuất đúng schema này.

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

Vì early tolerance = 0, delay primary không âm. FN không được gán delay giả; report `null` và denominator riêng. Delay báo kèm theo case vì khoảng yên lặng/độ trễ lan truyền khác nhau (C6: Delay chứa khoảng yên lặng; ở TTL 60 giây, pilot tuần 15 đo 1,2–20 giây, smoke trước đó 70–74 giây; mục 6.1.1 bảng D).

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

### 17.8. E1 — Phát hiện dưới tải bán thực so với ngưỡng cố định (ADR-007, MVP)

**Câu hỏi.** Khi tải là bán thực (nhịp theo giờ, cao điểm trước hạn quiz), detector học máy fit trên run khỏe có ít báo động giả hơn ngưỡng cố định mà vẫn bắt được sự cố không? Đây là chỗ nối trực tiếp hai góp ý của giảng viên: dữ liệu thật làm ngưỡng tĩnh dễ hỏng, nên giá trị của phần học máy mới đo được.

**So sánh** (cùng feature, cùng incident rule/persistence, chỉ detector đổi):

```text
static threshold   : ngưỡng cố định trên error rate / latency p95 / tín hiệu dependency; chọn trên validation
robust z-score     : median/MAD fit trên healthy train (Rousseeuw & Croux 1993, [L-Rousseeuw1993])
Isolation Forest   : fit trên healthy train (Liu, Ting, Zhou 2008, [L-IForest2008])
fused (engine)     : điểm hợp nhất đa nguồn của engine
```

**Chỉ số** (final test, theo từng profile healthy và từng case):

- **Báo động giả/giờ** (`FP incidents per healthy hour`, mục 17.7) trên run khỏe `bán thực ngày thường` và `bán thực cao điểm trước hạn quiz`; báo riêng trong đoạn cao điểm.
- **Độ trễ phát hiện** (mục 17.5) trên run có lỗi, báo riêng run có fault trùng cao điểm (mục 5.3).
- **Recall** trên run có lỗi (mục 17.6), kèm Precision/F1 và healthy-run FPR như mọi detector.

Kết quả kèm bootstrap CI 95% (mục 20.7). Đánh giá theo incident chứ không theo điểm, có báo độ trễ, theo khuyến nghị của Tatbul et al. (NeurIPS 2018, [arXiv 1803.03639](https://arxiv.org/abs/1803.03639), `[L-Tatbul2018]`) và NAB (Lavin & Ahmad, ICMLA 2015, `[L-NAB2015]`).

**Diagnostic (không bắt buộc).** Chạy cùng cặp detector trên run khỏe tải mức 1 (tốc độ hằng) để cho thấy tải đơn giản che mất khác biệt giữa ngưỡng cố định và detector học máy; Fang et al. ghi nhận hiện tượng tương tự ở bước RCA (`[L-Fang2025]`). Không dùng để chọn ngưỡng.

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
- Ranking ngẫu nhiên đều trên candidate set 10: kỳ vọng Top-1 = 1/10 = 10%, Top-3 = 3/10 = 30%.
- Với bộ case MVP của ADR-006 (C2, C3, C4, C6, bốn `root_cause_service` khác nhau: `course`, `ai`, `media`, `identity`) và số run bằng nhau: một ranking hằng đặt ba trong bốn service đó ở Top-3 đạt 3/4 = 75% Top-3 và 1/4 = 25% Top-1. Top-3 vẫn bão hòa; báo cáo Top-1 và MRR làm chỉ số chính và luôn kèm mốc ranking hằng.
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

Runtime/resource chỉ báo mô tả, không kiểm định ý nghĩa thống kê (mỗi case chỉ có `R − 1` run final test); raw values phải được giữ để audit. Khoảng tin cậy và kiểm định cho chỉ số chất lượng theo mục 20.7 (ADR-007).

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

Theo mục 15.4–15.5, kèm denominator, `K`, `R`, số người, số lượt theo điều kiện A/B, số `timed_out`.

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

### 20.7. Khoảng tin cậy và kiểm định (ADR-007)

Mẫu nhỏ (16 incident test ở sàn `4 × 4`) nên mọi chỉ số chính đi kèm khoảng tin cậy; kiểm định chỉ dùng cho so sánh ghép cặp đã đăng ký trước (mục 6.3). Không tuyên bố "có ý nghĩa thống kê" khi không đạt; không chọn kiểm định sau khi xem kết quả.

| Đại lượng | Cách tính |
| --- | --- |
| CI 95% của Top-1, Top-3, MRR (E2, E3) và Recall, báo động giả/giờ (E1) | Bootstrap percentile, lấy mẫu lại theo **incident/run** (phân tầng theo case), 10 000 lần, seed cố định ghi trong config |
| So sánh Top-1 của engine với từng baseline trên cùng incident (E2, E3) | **McNemar exact** (kiểm định nhị thức trên các cặp bất đồng: engine đúng/baseline sai và ngược lại); báo số cặp bất đồng, p-value thô và p-value hiệu chỉnh Holm cho họ so sánh engine với các baseline của bảng chính |
| Chênh lệch MRR ghép cặp (E2) và delta suy giảm (E3) | Bootstrap ghép cặp CI 95% của trung bình chênh lệch |
| E7 (n ≥ 6; E7 đã ra khỏi kế hoạch, mục 15.3) | Wilcoxon signed-rank ghép cặp theo người cho thời gian và số artifact giữa A và B, kèm effect size (rank-biserial) và bootstrap CI 95%; n < 6 chỉ mô tả |

Random và xếp hạng hằng luôn được báo cạnh kết quả (mục 18.4). Với 16 cặp, McNemar exact chỉ phát hiện được khác biệt lớn; điều này được nêu như giới hạn của mẫu, không phải lý do để bỏ kiểm định.

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
1. Cài fault injector và workload (đã có một phần ở tuần 13: cơ chế C2/C3/C4 ở PR #75, k6 mức 1 ở PR #76, export ở PR #77; còn mức 2+, mức 2 và fault manifest ở tuần 14 của plan-v0.4)
2. Kiểm chứng độ thực của workload (hold-out, so ba nguồn tải; ADR-007 mục 2) và freeze bản workload
3. Pilot theo từng case: kiểm chứng điều kiện vào campaign (mục 5.2), đo độ trễ lan truyền, chốt phase duration/cường độ, xác định cao điểm tải cho slot fault trùng cao điểm
4. Freeze execution/scenario parameters đủ để tạo clean dataset; chốt K, R (sàn 4 × 5)
5. Collect healthy training runs
6. Fit training-only preprocessing/detector state
7. Run validation set; chọn/freeze analysis configs, luật baseline thủ công tự động, tham số SimpleRCA/BARO/ngưỡng tĩnh
8. Đăng ký trước: commit final-test campaign manifest, giả thuyết E1–E5 (mục 6.3; tuần 19 của plan-v0.4); protocol thử nghiệm người không còn, vì E7 đã ra khỏi kế hoạch (mục 15.3)
9. Execute/select eligible final-test runs theo predeclared gate
10. Run frozen analysis variants, base-manual-auto, SimpleRCA, BARO, ngưỡng tĩnh, random/constant; tạo artifact suy giảm E3
11. Produce immutable per-evaluation-instance artifacts (gồm RcaIncidentResult)
12. ~~Chạy thử nghiệm người trên run final test đã freeze~~ (E7 đã ra khỏi kế hoạch ngày 19/11/2026, mục 15.3)
13. Aggregate E1–E5, E8 và đối chứng thủ công từ final-test artifacts; E6 trên RCAEval nếu làm (mục 15.7, Target)
14. Preserve excluded/invalid run ledger và failure analysis
```

Không được quay từ bước 10/11 về bước 7 chỉ vì final metric thấp mà vẫn giữ cùng final campaign identity.

---

## 25. Feasibility checklist cho collaborator review

Artifact này không tự coi review là hoàn tất. Bản đầu ghi "Đức cần xác nhận tối thiểu (refactor một người, người xác nhận là Đức)"; trong giai đoạn tự bắt kịp (ADR-006, ADR-007), Bách tự rà các điểm dưới đây và chốt trong bản đăng ký trước (mục 6.3), Đức xác nhận khi repo ổn định tới phase RCA:

| Concern | Điều cần xác nhận |
| --- | --- |
| Run identity/split | Runner giữ semantic canonical của `experiment_id`, sinh unique `run_id`, lấy `scenario_id` (kể cả healthy scenario) và `repeat_index` từ execution truth, rồi giữ assignment validation/test ổn định được. |
| Ground truth | `fault_start/end`, activation/deactivation/reset/verification và root-cause truth được lưu trước evaluation, không phụ thuộc model output; `root_cause_service` khớp bảng 4.2. |
| Candidate set | Đồng ý `service-candidates.v1` 10 service (gateway là symptom, không phải candidate) hoặc yêu cầu đưa gateway vào. |
| Điều kiện vào campaign | Cơ chế C2, C3, C4 (PR #75) và C6 chạy được trong pilot; pilot đo được độ trễ lan truyền. C1, C5, C7 là Target; chuỗi C1 sang `media-worker` được xác nhận hoặc mô tả lại nếu làm. |
| Floor | `R = 5` cho bốn case MVP (ADR-006); mỗi case ít nhất một run test trùng cao điểm tải (ADR-007). |
| Healthy runs | Có thể chạy dedicated healthy train/validation/test với seed (đoạn log) tách biệt, gồm bán thực ngày thường, bán thực cao điểm trước hạn quiz và các profile chuyên biệt (batch lớn, upload peak, AI job). |
| Workload | Mức 2+ và mức 2 chạy được trên stack, kiểm chứng độ thực đã đo và freeze (ADR-007 mục 2). |
| Artifact lineage | Mỗi telemetry/derived artifact có immutable ID/location/checksum và quality report; một run có thể reference nhiều variant không overwrite nhau. |
| Quality gate | Runner/exporter có đủ phase coverage/required signal metadata để classify pass/partial/fail theo variant, gồm phân loại Tempo OOM/gauge thiếu là source outage chứ không phải degradation. |
| Nhiễu | Luật lọc trace `/ready` và thăm dò scheduler-worker được version hóa và dùng chung. |
| RQ1 | Có thể materialize/select `M`, `M+T`, `M+T+L` từ cùng run lineage. |
| RQ2 | Trace artifact đủ dựng dynamic service graph (kể cả async edge qua `traceparent`); chấp nhận cạnh scheduler → scheduler-worker thiếu. |
| RQ3 | UTC timestamp/onset đủ ổn định, chấp nhận độ trễ thu thập khác nhau theo modality. |
| RQ4/E3 | Có thể tạo derived artifact giữ 50% và 10% trace (whole-trace), log mất `trace_id`, mất một modality reproducibly trên trace v2, giữ source lineage/seed; xác nhận fallback `message_id` có đủ dữ liệu ở span PRODUCER. |
| Baseline đã công bố | Adapter SimpleRCA/BARO đọc được export (PR #77); BARO của RCAEval tái lập được trên RE2 trước khi dùng. |
| System metrics | Analysis timing/CPU/memory/artifact size và application throughput/p95 có đường đo khả thi; `OTEL_SDK_DISABLED=true` tắt export mà không đổi code path (chưa kiểm chứng). |
| Đối chứng thủ công | Luật `base-manual-auto` và cách đếm artifact được thiết kế và freeze; E7 đã ra khỏi kế hoạch vì không có người tham gia hợp lệ (mục 15.3), nên time cap, brief và cách nạp lại telemetry cho người tham gia không còn áp dụng. |
| `RcaIncidentResult` | Schema `"0"` và nơi lưu đề xuất ở catalogue đủ để chấm; owner-level Top-K có được chấp nhận. |
| Rerun | Invalid/quality-failed run có thể rerun bằng run ID mới trong khi original ledger vẫn giữ. |

Nếu một requirement không khả thi trong Compose/runner dự kiến, cần ghi finding và điều chỉnh **evaluation implementation/config trong boundary của tài liệu này**. Không tự sửa RQ, fault catalogue, topology, `RcaIncidentResult` hoặc truth/telemetry schema để né limitation.

---

## 26. Checkpoint

Bảng này chỉ ghi điều đã viết trong protocol và điều đã có bằng chứng chạy; không đánh dấu hoàn thành khi chưa có output.

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| Protocol viết lại theo topology v2 (candidate, fault/case, workflow, floor) | Đã viết; cập nhật theo ADR-006 và ADR-007 ngày 17/11/2026; **chưa Đức xác nhận** | Mục 4–5, 8 |
| Manifest, split theo run, freeze test campaign | Đã viết | Mục 3, 5–6, 21–24 |
| Detection, RCA service-level, system metrics, `RcaIncidentResult` làm đầu ra | Đã viết | Mục 14, 16–22 |
| Baseline/ablation/robustness (E2, E3, E5) | Đã viết; chưa chạy | Mục 10–13, 15.2.1 |
| E1 phát hiện dưới tải bán thực | Đã viết; profile bán thực `normal-mixed@v1`, `healthy-spike@v1` đã chốt; độ thực v2: traffic học viên `normal-mixed` giống thật theo v2 (kèm bốn giới hạn), `healthy-spike` cũng giống thật theo v2 sau khi so với nguồn đơn giản đăng ký trước ngày 25/11/2026 (workload-realism-report-v1 mục 11–12); chưa chạy detector | Mục 5.4, 6.1.1, 17.8 |
| Đối chứng thủ công, chi phí chẩn đoán, E6, E7, E8 | Đã viết; chưa có luật baseline, chưa có số đo; E7 ra khỏi kế hoạch (19/11/2026, không có người tham gia hợp lệ) | Mục 15 |
| Khoảng tin cậy, kiểm định, đăng ký trước | Đã viết | Mục 6.3, 20.7 |
| Telemetry đủ để chấm | **Đã đo** cho 9 luồng, 11 runtime, 38 cạnh, 24 queue; thiếu các tín hiệu ở mục 1.3 | [Catalogue case mục 1 và 4](complex-case-catalogue-and-rca-result-v0.md) |
| Case chạy thật | **C2, C3, C4, C6 đã pilot** (9 run ngày 20 và 23/11/2026), cả bốn `case_verification_status = run`; C1, C5, C7 mới đo tín hiệu | Mục 6.1.1; [fault-pilot-report-v1](fault-pilot-report-v1.md) |
| Fault injector, workload, export telemetry | **Có**: fault manifest v2, profile `normal-mixed@v1`/`healthy-spike@v1` (mức 2+ cho học viên, mức 2 cho giảng viên/admin), export, quality report, feature v1 (task-05) | Mục 6.1.1 |
| Giá trị pilot và tập ứng viên cho validation | **Đã chốt** 23/11/2026 (commit cuối 21:20 +07). Thời điểm này trước mọi fault run validation (bắt đầu 01:29 +07 ngày 24/11) và trước khi tính feature hay chạy detector trên bất kỳ run validation nào. Hai run healthy validation đã chạy trước đó nhưng mới chỉ được kiểm gate, tiêu chí khỏe và thống kê export trace. Luật (2) của bảng F được đặt sau khi xem thống kê export của run `healthy-spike`. Giá trị còn mở ghi ở mục 27 | Mục 6.1.1, 6.1.2 |
| Dataset, RCA engine | Dataset v0: 10/10 run train/validation đạt gate (24/11/2026), test chỉ khai báo; RCA engine **chưa có** (MCP/agent: Out-of-scope theo ADR-006) | [dataset-v0](dataset-v0.md) |
| Đức review orchestration/lưu artifact | **Chưa xác nhận** | Mục 25 |

---

## 27. Giá trị còn nằm ở pilot/versioned config và đề xuất còn mở

Protocol chốt **cách chọn, nơi lưu và freeze**, không hard-code numeric execution value khi chưa có bằng chứng pilot. Trạng thái sau pilot tuần 15 (23/11/2026):

| Giá trị | Trạng thái | Ở đâu |
| --- | --- | --- |
| Phase duration, thời gian fault active từng case | **Đã chốt** (fault manifest v2) | Mục 6.1.1 bảng A, D |
| Workload rate, phiên bản profile | **Đã chốt** (`normal-mixed@v1`, `healthy-spike@v1`, `λ_knee` ≥ 5,6 phiên/s) | Mục 6.1.1 bảng B |
| Fault intensity (C2, C3, C4, C6) | **Đã chốt** (fault manifest v2). C1 (batch 100000 recipient) vẫn là gợi ý, C1 không vào campaign | Mục 6.1.1 bảng C |
| Dependency timeout | **Giữ cấu hình Compose** (LMS đóng băng); biên so với cường độ fault đã kiểm | Mục 6.1.1 bảng E |
| Scrape interval, ngưỡng data-quality, độ trễ thu thập | **Đã chốt** | Mục 6.1.1 bảng F |
| Run `partial` được nhận, trace bị bỏ vì ngân sách export | **Đã chốt**: ngân sách 60.000; trace lấy mẫu chỉ nhận ở run healthy, kèm điều kiện độ phủ và lỗi tải; kiểm tự động bằng `check-dataset.mjs` | Mục 6.1.1 bảng F |
| Luật lọc nhiễu | **Đã chốt** `noise.v1` | Mục 6.1.1 bảng G |
| Window size/step | **Tập ứng viên** {30 s, 60 s}, bước cố định 15 s; validation chọn | Mục 6.1.2 |
| Persistence | **Tập ứng viên** {3, 4} (cửa sổ 30 s), {5, 6} (cửa sổ 60 s); validation chọn bằng detector robust z | Mục 6.1.2 |
| Ngưỡng robust z | **Tập ứng viên** {3, 4, 5}; validation chọn | Mục 6.1.2 |
| Ngưỡng/hyperparameter Isolation Forest, fused; fusion/RCA weight; merge gap, recovery | **Còn mở**: chưa có detector, engine; không gian ứng viên commit trước validation (tuần 16–18) | Mục 6.1.2 |
| Luật `base-manual-auto`, cách đếm artifact | **Còn mở**: chưa cài baseline; chốt trước validation | Mục 6.1.2, 15.2 |
| Tham số SimpleRCA/BARO | **Không gian đã khai báo**; validation chọn | Mục 15.2.1 |
| Slot trùng cao điểm | **Validation đã chốt** (C2, giây 1.260–1.860). **Test còn mở**: chốt khi freeze tuần 19 | Mục 6.1.1 bảng H |
| Slot cao điểm test của C3 | **Còn mở**: fault 900 s chỉ bắt đầu được trong [360, 1.380]; chọn cửa sổ nhiều phiên nhất trong khoảng đó và ghi số phiên khi freeze tuần 19 | Mục 6.1.1 bảng H |
| Pre-fault tối thiểu của slot trùng cao điểm | **Còn mở**: `--align-peak` không ép giá trị tối thiểu. Khi freeze tuần 19, slot test phải đủ cho đoạn tham chiếu đã chọn của SimpleRCA/BARO (tối đa 10 phút) hoặc ghi giới hạn | Mục 6.1.1 bảng A |
| Time cap, số lượt, brief của thử nghiệm người | **Không còn áp dụng**: E7 ra khỏi kế hoạch | Mục 15.3 |

Các giá trị này phải được chọn đúng train/validation rule, lưu trong versioned config và xuất hiện trong frozen final campaign manifest. Việc chưa hard-code numeric trước pilot **không** cho phép thay chúng sau khi đã xem final test.

RQ4/E3 là ngoại lệ đã freeze ở mức comparison design: bản v0/v1 cũ là **whole-trace 50% controlled drop**; theo ADR-007 là **giữ 50% và 10% trace (whole-trace), log mất `trace_id`, mất một modality**, với seed được ghi trong campaign/degradation config trước final test; khả thi trên trace v2 chưa kiểm chứng (mục 13.1).

**Danh sách đề xuất/quyết định** (bản đầu ghi "chờ Đức xác nhận"; trạng thái cập nhật 17/11/2026, giai đoạn Bách tự quyết theo ADR-006/007; không phải số đo):

1. Candidate set 10 service, loại `gateway` (mục 4.1), thay vì 11 — **đã chốt** ở Gate R.
2. ~~`R = 3` repetition mỗi case~~ — **đã chốt** `R = 5` cho bốn case MVP (ADR-006), là sàn (ADR-007); `K = 4`.
3. Owner-level Top-K như diagnostic phụ (mục 4.2) — chốt trong bản đăng ký trước.
4. Các profile healthy v2 (mục 5.4) và số run healthy mỗi profile — profile đã nối với workload bán thực (ADR-007). **Đã chốt cho dataset v0** (mục 6.1.1 bảng B): train 2, validation 1 mỗi profile; không thêm profile đối chứng upload/AI job. Số run healthy test chốt trong bản đăng ký trước.
5. Thử nghiệm người (mục 15.3) — **ra khỏi kế hoạch ngày 19/11/2026** (không có người tham gia hợp lệ). Hướng cũ theo ADR-007, giữ làm lịch sử: within-subject, 6–10 người hoặc 2–3 người định tính, Bách chốt người tham gia trước tuần 15 của plan-v0.4; time cap đề xuất 15 phút; cách nạp lại telemetry chưa kiểm chứng. Không chuẩn hóa `T_human` với `T_engine`; dùng số artifact (E4) và so A/B (mục 15.4).
6. Có đưa FF thành case đánh giá riêng hay không (mục 4.2).
7. Các điều chỉnh tài liệu nguồn còn lệch: ~~component FB~~ và ~~triệu chứng FG~~ (đã thống nhất ngày 17/11/2026: `notification-worker-rabbitmq`, 504), và các tài liệu direction/blueprint còn v1 (mục 1).

---

## 28. Kết luận v1

Evaluation protocol v1 giữ nguyên khung đánh giá của v0 và gắn lại với kiến trúc v2 thật:

- split theo experiment run; healthy training / validation / final-test boundary chống leakage;
- fault FA–FH và case C1–C7 (kèm trạng thái kiểm chứng từng case) thay F1–F5;
- điều kiện vào campaign theo từng case và floor dựa trên `K × R` thay vì con số cố định `5 × 3`;
- candidate set 10 service v2 (worker là candidate riêng, hạ tầng là evidence);
- incident matching/tolerance, healthy-run FPR semantics và RCA metric denominator/coverage giữ nguyên, bổ sung khoảng yên lặng/độ trễ lan truyền;
- RQ1–RQ3 ablation controls và RQ4 strict paired degradation (từ ADR-007: giữ 50%/10% trace, log mất `trace_id`, mất một modality), kèm các điều kiện của trace v2 (async qua `traceparent`, cạnh thiếu, nhiễu);
- đối chứng thủ công (baseline tự động + thử nghiệm người) và thời gian chẩn đoán theo ADR-002, định nghĩa lại theo ADR-006 (thử nghiệm người E7 sau đó ra khỏi kế hoạch ngày 19/11/2026, mục 15.3);
- theo ADR-007: workload bán thực cho healthy run, bộ bằng chứng E1–E8, baseline đã công bố SimpleRCA và BARO, chi phí chẩn đoán, đối chứng ngoài RCAEval (Target), thử nghiệm người within-subject (Target, đã ra khỏi kế hoạch ngày 19/11/2026), fault trùng cao điểm tải, bootstrap CI và McNemar exact, đăng ký trước;
- `RcaIncidentResult` là đầu ra được chấm;
- immutable experiment/evaluation artifact lineage, test campaign freeze và validity-only rerun rule.

Không có requirement nào trong protocol này yêu cầu đổi service topology, ownership, HTTP/event contract, fault semantics, telemetry schema, `RunGroundTruth` hoặc `RcaIncidentResult`. Số đo thật hiện có chỉ là số đo telemetry (catalogue case mục 1, 4), kết quả smoke của C6 và số đo đáp ứng của cơ chế gây lỗi, k6 mức 1, export ở tuần 13 (mục 1.3), cùng số đo pilot tuần 15 của bốn case MVP và mức tải (mục 6.1.1); chưa có số đo detection, RCA, thời gian chẩn đoán hay đối chứng thủ công nào.

---

## 29. Khác biệt so với v0

| Mục | v0 | v1 |
| --- | --- | --- |
| Topology | v1: 6 business service + gateway | v2: 7 service + 4 worker, 11 `service.name`, 16 dependency identity |
| Fault | F1–F5 (Redis, Storage Mock, error, consumer, CPU) | FA–FH ([fault matrix v2](data-ownership-and-fault-matrix-v2.md)) và case C1–C7 ([catalogue](complex-case-catalogue-and-rca-result-v0.md)); FF không có case |
| Trạng thái case | không có (mọi fault đều có cơ chế) | mỗi case ghi **đã chạy / đã đo tín hiệu / giả thuyết**; chỉ C6 đã chạy; điều kiện vào campaign theo từng case (mục 5.2) |
| Candidate set | `service-candidates.v0`: 6 business service | `service-candidates.v1`: 10 service (worker riêng, hạ tầng là evidence, gateway là symptom); đã chốt ở Gate R |
| Tie-break | `auth < course < enrollment < submission < grading < notification` | thứ tự catalogue v2 mục 8 cho 10 service |
| Floor | `5 × 3 = 15` fault run (5 validation, 10 test) | `K × R`; ban đầu đề xuất `R = 3`, nay `4 × 5 = 20` (ADR-006), mỗi case ít nhất một run test trùng cao điểm tải (ADR-007) |
| Top-3 saturation | 3 root cause trên 6 candidate, Top-3 có thể 100% | 5 root cause trên 10 candidate; ranking hằng tốt nhất ≈ 71% Top-3 nếu đủ bảy case (số học, không đo); phải đọc cùng `K` |
| Workload | normal mixed, submission peak, grading burst, healthy spike | profile theo W1–W7: bán thực ngày thường, bán thực cao điểm trước hạn quiz (ADR-007; học viên mức 2+, các vai khác mức 2), batch thông báo lớn, upload peak, AI job (đề xuất; k6 mức 1 đã có ở PR #76) |
| Fault ở RQ4 fallback | F4 async fallback | async qua `traceparent` (cùng trace); fallback `message_id` + temporal; khả thi chưa kiểm chứng |
| Đối chứng thủ công | không có | mục 15: baseline thủ công tự động (định nghĩa lại theo ADR-006), SimpleRCA, BARO, thử nghiệm người within-subject (Target, đã ra khỏi kế hoạch ngày 19/11/2026), thời gian và chi phí chẩn đoán, RCAEval (Target), case study C6; agent MCP Out-of-scope |
| Prediction artifact | `prediction.json` không có schema cụ thể | `RcaIncidentResult` (`rca_result_schema_version = "0"`), mục 16 |
| `insufficient_evidence` | không có | tính end-to-end miss, đếm riêng, không vào conditional metric |
| Độ trễ lan truyền | không có | mục 7.3: khoảng yên lặng C6 (ở TTL 60 giây: smoke 70–74 giây, pilot tuần 15 1,2–20 giây), fault active phải dài hơn độ trễ triệu chứng |
| Tín hiệu theo case | fault-to-telemetry requirement của W4-T4 | bảng 8.4 từ catalogue: tín hiệu có thật và tín hiệu chưa có |
| Nhiễu telemetry | không có | mục 8.5: lọc trace `/ready` và thăm dò scheduler-worker, `noise_filter_version` |
| Identity | `scenario_id` F1–F5 | `scenario_id` FA–FH + `case_id` C1–C7 + `analyst_kind`, `case_verification_status` |
| Manifest/protocol version | `evaluation-instance.v0`, `evaluation-protocol.v0` | `evaluation-instance.v1`, `evaluation-protocol.v1` |
| Owner-level Top-K | không có | diagnostic phụ cho cặp service/worker cùng owner |
| DoD/checkpoint | DoD W4-T5 "Đạt trong protocol" | checkpoint tách điều đã đo khỏi điều chưa làm (mục 26); chưa Đức xác nhận |
| Kiểm định | không có | bootstrap CI 95%, McNemar exact (Wilcoxon cho E7 không còn dùng, vì E7 đã ra khỏi kế hoạch); đăng ký trước ở mốc freeze (mục 6.3, 20.7; ADR-007) |
| Giữ nguyên | split theo `run_id`, freeze, anti-leakage, incident matching, healthy-run FPR, end-to-end RCA denominator, RQ1–RQ5, lineage/immutability, rerun chỉ vì validity (RQ4 whole-trace 50% giữ đến ADR-007, nay là một trong các điều kiện E3) | — |

---

## 30. Tài liệu tham khảo dùng trong protocol

Trích dẫn đầy đủ, giấy phép và vai trò ở [literature-matrix-v1](../plan/literature-matrix-v1.md); dưới đây chỉ là mã khóa và liên kết dùng trong tài liệu này.

| Khóa | Nguồn | Dùng ở mục |
| --- | --- | --- |
| `[L-Pham2024ASE]` | Pham, Ha, Zhang — RCA for Microservice System based on Causal Inference: How Far Are We?, ASE 2024 — https://arxiv.org/abs/2408.13729 | 1.4, 14, 15.1, 15.2.1 |
| `[L-Fang2025]` | Fang et al. — Rethinking the Evaluation of Microservice RCA with a Fault Propagation-Aware Benchmark, FSE 2026 — https://arxiv.org/abs/2510.04711 | 1.4, 15.1, 15.2.1, 15.7, 17.8 |
| `[L-BARO]` | Pham, Ha, Zhang — BARO, FSE 2024 — https://arxiv.org/abs/2405.09330 | 15.2.1 |
| `[L-RCAEval]` | Pham et al. — RCAEval, WWW 2025 Companion — https://arxiv.org/abs/2412.17015 , https://github.com/phamquiluan/RCAEval | 15.2.1, 15.7 |
| `[L-TraceRCA]` | Li et al. — Practical Root Cause Localization for Microservice Systems via Trace Analysis, IWQoS 2021 — https://github.com/NetManAIOps/TraceRCA | 15.2 |
| `[L-Nezha]`, `[L-Eadro]` | Yu et al., ESEC/FSE 2023 — https://github.com/IntelligentDDS/Nezha ; Lee et al., ICSE 2023 — https://arxiv.org/abs/2302.05092 | 10.1 |
| `[L-Dapper2010]` | Sigelman et al. — Dapper, Google TR 2010 — https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/ | 13.1 |
| `[L-Unistudium]` | Milani, Biondi, Franzoni — Unistudium 2022: students groups logs on moodle, Zenodo — https://zenodo.org/records/13763175 | 5.4 |
| `[L-PaxsonFloyd]` | Paxson, Floyd — Wide-Area Traffic: The Failure of Poisson Modeling, IEEE/ACM ToN 1995 — https://www.icir.org/vern/papers/poisson.TON.pdf | 5.4 |
| `[L-LogAssist]` | Locke et al. — LogAssist, IEEE TSE 2022 (early access 2021) — https://ece.uwaterloo.ca/~wshang/pubs/TSE2021_LogAssist.pdf | 15.3 |
| `[L-Ahmed2023]` | Ahmed et al. — Recommending Root-Cause and Mitigation Steps for Cloud Incidents using LLMs, ICSE 2023 — https://arxiv.org/abs/2301.03797 | 15.3 |
| `[L-MetaRCA]` | Hsu et al. — Leveraging AI for efficient incident response, Engineering at Meta 2024 — https://engineering.fb.com/2024/06/24/data-infrastructure/leveraging-ai-for-efficient-incident-response/ | 15.3 |
| `[L-NASA-TLX]`, `[L-SUS]` | Hart & Staveland 1988 / Hart 2006 — https://en.wikipedia.org/wiki/NASA-TLX ; Brooke 1996 — https://measuringu.com/sus/ | 15.3 |
| `[L-Rousseeuw1993]`, `[L-IForest2008]`, `[L-Tatbul2018]`, `[L-NAB2015]` | kế thừa literature-matrix-v0 (L2, L3, L9, L10) | 17.8 |
