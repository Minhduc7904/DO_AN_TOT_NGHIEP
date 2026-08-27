# Risk register v1

## 1. Thông tin và phạm vi áp dụng

| Trường | Nội dung |
| --- | --- |
| Phiên bản | `v1.0` |
| Ngày lập | 27/08/2026 |
| Người duy trì register | Bách |
| Phạm vi | MVP testbed, observability, telemetry/data, fault/experiment, anomaly/RCA, evaluation và tiến độ đồ án |
| Nhịp rà soát | Tối thiểu một lần mỗi tuần; rà soát ngay khi một tín hiệu sớm xuất hiện |
| Trạng thái tài liệu | Đang áp dụng; chưa có rủi ro nào đủ bằng chứng để đóng |

Risk register này cụ thể hóa, không thay thế, các quy tắc scope và rủi ro trong những nguồn canonical sau:

- [Plan v0.2 — 24 tuần](plan-v0.2-24-weeks.md), đặc biệt mục “Backlog tối thiểu phải bảo vệ” và “Quy tắc chống scope creep và rủi ro”.
- [Backend microservice testbed blueprint](../architecture/backend_microservice_testbed_blueprint.md), đặc biệt scope MVP/Target/Stretch, fault scope và experiment manifest.
- [Analysis/anomaly/RCA blueprint](../architecture/analysis-anomaly-rca-blueprint.md), đặc biệt data-quality, split chống leakage, service-level RCA, robustness và evaluation floor.
- [Research questions and metrics v1](../direction/research-questions-and-metrics-v1.md), đặc biệt RQ1–RQ5, biến kiểm soát và strict paired comparison cho RQ4.

Tại thời điểm lập v1, artifact `docs/processed/direction/project-scope-v1.md` của W3-T1 chưa tồn tại. Vì vậy register dùng plan v0.2 và hai blueprint làm scope baseline hiện hành. Khi scope v1 được tạo, owner `R-01` phải đối chiếu lại MVP floor/thứ tự cắt scope và ghi thay đổi trong lịch sử rà soát; scope v1 không được âm thầm ghi đè blueprint canonical.

Không dùng register này để bổ sung kiến trúc cạnh tranh. Thay đổi service boundary, contract, telemetry schema, experiment manifest hoặc RCA granularity phải theo governance/ADR của blueprint.

## 2. Quy ước quản lý

### 2.1. Mức độ ưu tiên

| Mức | Ý nghĩa | Thời điểm xử lý |
| --- | --- | --- |
| `P0` | Đe dọa tính hợp lệ của MVP, ground truth/evaluation hoặc milestone M3–M6 | Dừng phần mở rộng liên quan và xử lý ngay trong tuần hiện tại |
| `P1` | Có thể làm trượt một deliverable/milestone hoặc tăng đáng kể rework | Owner lập hành động trong tuần và kiểm tra ở lần rà soát kế tiếp |
| `P2` | Ảnh hưởng cục bộ, có workaround và chưa đe dọa critical path | Theo dõi; xử lý sau các mục `P0`/`P1` |

### 2.2. Trạng thái

- `Mở`: chưa có đủ bằng chứng kiểm soát hoặc tín hiệu sớm đã xuất hiện.
- `Đang giảm thiểu`: hành động đã có owner và đang được thực hiện.
- `Theo dõi`: mitigation đã chạy, nhưng cần thêm run/milestone để xác nhận ổn định.
- `Đã đóng`: chỉ dùng khi có artifact, test, run ledger hoặc review chứng minh trigger không còn hiệu lực; không đóng bằng nhận định miệng.

Mỗi lần rà soát phải ghi tối thiểu: risk ID, trạng thái mới, bằng chứng/link, quyết định, owner và hạn tiếp theo. Nếu một trigger `P0` xuất hiện, mọi Target/Stretch liên quan bị dừng cho tới khi risk owner đưa được bằng chứng kiểm soát.

## 3. Baseline không được cắt và thứ tự giảm scope

### 3.1. MVP floor phải bảo vệ

Không dùng áp lực tiến độ để cắt các điều kiện sau:

1. Testbed gồm 6 business service + API Gateway, chạy trên Docker Compose; có HTTP và một async flow `grade.completed` qua RabbitMQ.
2. Có PostgreSQL, Redis, RabbitMQ và controllable storage mock; không truy cập database/source code chéo service.
3. Metrics, traces và structured logs có service identity/correlation đủ để nối symptom với evidence; controlled baseline dùng 100% trace sampling.
4. Workload, reset, fault manifest, ground truth và artifact lineage cho phép chạy lại từ `run_id`.
5. Năm fault category/scenario canonical và evaluation floor `5 scenarios × 3 repetitions = 15 controlled runs` hợp lệ; scenario không ổn định có thể thay trong cùng category, không giảm số category.
6. Detection có baseline kiểm chứng; RCA chính ở service-level với Top-1/Top-3/MRR, component/dependency chỉ là evidence.
7. Split theo experiment run, preprocessing chỉ fit trên training, validation dùng để tune và final test campaign không dùng để chọn model/threshold/weight.
8. Có ít nhất một robustness evaluation focused: controlled trace dropping/sampling trên telemetry artifact **hoặc** missing-modality evaluation, tái sử dụng baseline 100% sampling.
9. Có error analysis, limitations và hướng dẫn reproducibility; artifact/manifest phải mở được, demo hoặc screenshot không thay thế bằng chứng.

### 3.2. Thứ tự cắt scope bắt buộc

Khi một risk trigger đe dọa milestone, cắt theo thứ tự sau và không được cắt ngược vào MVP floor:

1. **Cắt ngay Stretch:** Kubernetes/Chaos Mesh, service mesh, multi-fault, instance/component-level RCA chính thức, causal discovery phức tạp, deep model và resilience scenario nâng cao.
2. **Cắt Target không nằm trên critical path:** Assignment, MinIO, event/workflow bổ sung, external benchmark, change-point/log-template model nâng cao, custom dashboard/UI.
3. **Thu hẹp expansion:** bỏ matrix nhiều sampling level/missing-modality combination, workload/fault intensity bổ sung, repetition vượt floor, evidence/ablation tùy chọn và mục tiêu 30–60+ run.
4. **Giản lược implementation nhưng giữ failure semantics:** business logic/CRUD tối thiểu, controllable storage mock thay MinIO, analysis modular monolith + CLI/report artifact, chỉ một async workflow; metrics + traces được ưu tiên và structured logs giữ schema/correlation tối thiểu.
5. **Không được giản lược:** ground truth, reset/repeatability, run-level split, candidate set service-level, test campaign freeze, 15 controlled runs hợp lệ và một focused robustness evaluation.

Extension chỉ được xem xét sau khi qua Gate M4 và không đe dọa M5/M6. Tuần 23–24 là contingency, không phải feature time.

## 4. Risk register

| ID | Nhóm | Rủi ro và hậu quả | Tín hiệu sớm / trigger | Ưu tiên | Owner | Mitigation và bằng chứng cần có | Quy tắc giảm/cắt scope khi trigger | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R-01` | Scope | Testbed/LMS phình thành sản phẩm nghiệp vụ, làm chậm observability và evaluation. | Backlog có feature không ánh xạ RQ/fault/evidence; cuối tuần 8 chưa có E2E ổn; xuất hiện Assignment/MinIO/UI trên critical path. | `P0` | Đức | Gắn mọi hạng mục với MVP/Target/Stretch và giá trị dependency/fault; review scope hằng tuần; chỉ mở extension sau Gate M4. Bằng chứng: backlog, task card và E2E artifact. | Cắt Stretch rồi Assignment, MinIO, UI/dashboard và CRUD không cần thiết; giữ 6 service + Gateway, dependency và năm fault category. | Mở |
| `R-02` | Testbed | E2E/Compose không ổn định khiến workload, fault và telemetry không có nền chạy chung. | Workflow login/browse/enroll/submit/grade-notify không chạy lặp lại; seed/reset thủ công; cuối tuần 8 chưa có E2E ổn. | `P0` | Đức | Gate từng workflow, health check, seed/reset script, contract/integration/E2E test và Compose profile cố định. Bằng chứng: lệnh chạy sạch và test artifact. | Giản lược business rule/CRUD, chỉ giữ một async flow và storage mock; không thêm service, event hay hạ tầng mới. | Mở |
| `R-03` | Observability | Instrumentation làm muộn hoặc không xuyên boundary, khiến fault có symptom nhưng thiếu evidence. | Service chạy nhưng thiếu inbound/outbound/dependency span; trace không xuyên HTTP/RabbitMQ; telemetry assertion chưa có khi scaffold service. | `P0` | Đức | Instrument từ service template; kiểm tra `service.name`, `service.version`, `service.instance.id`, RED/dependency metrics, error semantics và trace propagation trong test. | Dừng feature/UI; ưu tiên metrics + traces, structured logs giữ schema tối thiểu có correlation; bỏ custom dashboard, không bỏ instrumentation bắt buộc. | Mở |
| `R-04` | Telemetry/data quality | Metrics, traces và logs không liên kết hoặc missingness bị mã hóa sai, làm feature/evidence sai lệch. | Tuần 11 không query được trace/log theo cùng request; thiếu schema/version; missing bị điền `0`; timestamp/identity không nhất quán. | `P0` | Bách | Data-quality gate, UTC/schema version, cùng window ID, missing flags phân biệt no-traffic/scrape-loss/sampling/source-unavailable; pilot query metric → trace → log. | Freeze feature/model mới; giảm log feature về event/template có cardinality kiểm soát; giữ service identity, correlation và metrics/traces. | Mở |
| `R-05` | Async contract | `grade.completed` mất event identity/trace context hoặc consumer xử lý lặp, làm đứt graph và ground truth async. | Publish/consume không nối trace; thiếu event ID/schema version/occurred time; cùng message tạo nhiều xử lý ngoài dự kiến. | `P1` | Đức | Chốt envelope/headers, publish-consume spans, idempotency tối thiểu và contract test; lưu event ID/timeline trong evidence. | Chỉ giữ `grade.completed`; cắt event bổ sung. Nếu async trace thiếu ở pilot, dùng event ID/time correlation có đánh dấu confidence thấp và phải ghi limitation. | Mở |
| `R-06` | Fault/ground truth | Fault không tái lập hoặc ground truth sai khiến run không dùng được cho detection/RCA. | Cùng manifest/seed cho symptom khác biệt lớn; fault start/end hoặc target không rõ; reset còn state; run lỗi bị bỏ khỏi ledger. | `P0` | Đức | Pilot từng fault, cố định workload/seed/config/intensity, tự động reset, verify pre/post condition, lưu invalid-run ledger và manifest đầy đủ. | Thay scenario không ổn định bằng scenario cùng category; giảm intensity matrix và repetition dư về 3; không giảm dưới 5 category × 3 run hợp lệ. | Mở |
| `R-07` | Reproducibility | Không truy vết được từ `run_id` tới code/config/telemetry/prediction/evaluation, hoặc thành viên còn lại không chạy lại được. | Manifest thiếu commit/version/seed/artifact URI; script phụ thuộc thao tác tay; fresh run cho kết quả không giải thích được. | `P0` | Đức | Một command/runbook cho deploy→seed→workload→fault→collect→evaluate→reset; version config/schema; artifact path mở được; cross-run độc lập. | Cắt API/UI, notebook-only flow và automation không cần thiết; giữ CLI, manifest, artifact lineage và fresh reproduction. | Mở |
| `R-08` | Data leakage | Window/run hoặc preprocessing làm rò dữ liệu fault/test vào training, khiến metric lạc quan giả. | Window của cùng run xuất hiện ở nhiều split; scaler fit trên fault/test; test manifest thay sau khi xem kết quả. | `P0` | Bách | Split theo experiment run; fit preprocessing/detector trên healthy training; validation tune; freeze test manifest/protocol trước campaign. | Giảm số model/ablation để giữ split hợp lệ; không random-window split và không hạ quy tắc chống leakage dù thiếu dữ liệu. | Mở |
| `R-09` | Model/detection | Model phức tạp không hơn statistical baseline hoặc nhầm healthy high-load là anomaly, gây model churn. | Isolation Forest/equivalent không hơn robust z-score; FPR cao ở healthy burst/high-load; liên tục đổi model sau validation. | `P1` | Bách | Giữ statistical baseline + Isolation Forest/equivalent, workload-shift test, báo cáo quality/runtime/complexity và kết quả âm trung thực. | Cắt deep/change-point/log-template model và external benchmark; tập trung contribution vào fusion, incident, RCA/evidence thay vì thêm model. | Mở |
| `R-10` | RCA | RCA xếp symptom downstream/upstream severity cao hơn injected root-cause service. | Gateway/downstream thường Top-1; severity-only thắng do propagation; onset/evidence không nhất quán. | `P0` | Bách | Freeze service candidate set; dùng temporal precedence, dependency direction, reverse propagation và edge evidence; đánh giá theo `root_cause_service`. | Giữ service-level ranking; cắt component-level metric, causal discovery và graph phức tạp; component chỉ là evidence/limitation. | Mở |
| `R-11` | Robustness/missing telemetry | Trace sampling hoặc missing modality làm graph thiếu và pipeline âm thầm coi missing là zero. | Edge coverage giảm mạnh; score NaN/zero không phân biệt missing; full/degraded condition không cùng baseline/ground truth. | `P1` | Bách | Baseline 100% sampling; một controlled degradation trên cùng artifact/run, cố định seed, ghi coverage/missingness và fallback metrics/logs. | Chọn đúng một focused test: một mức trace dropping **hoặc** một missing modality; cắt expanded matrix và live low-sampling experiment. | Mở |
| `R-12` | Evaluation | Protocol/metric bị thiết kế theo kết quả model, candidate set thay đổi hoặc test dùng để tune. | Protocol đổi sau khi xem test result; thêm/bỏ scenario theo performance; trộn service/component trong metric chính. | `P0` | Bách | Draft protocol tuần 4, freeze trước final campaign; unit incident/run; metric detection và service-level RCA tách biệt; mọi bug-fix sau freeze có ledger. | Cắt metric/ablation tùy chọn và external dataset; giữ metric canonical, candidate set, test freeze và RQ1–RQ5. | Mở |
| `R-13` | Campaign/resource | Automation hoặc tài nguyên không đủ cho expansion, dẫn tới nhiều run lỗi hay artifact kém chất lượng. | Tỷ lệ invalid run tăng; reset/collector nghẽn; 30–60+ run đe dọa deadline; artifact thiếu do storage/resource pressure. | `P1` | Đức | Pilot capacity, theo dõi CPU/memory/disk/queue, rerun có ledger, ưu tiên run hợp lệ và ground truth hơn số lượng. | Giảm về floor 15 controlled runs; bỏ intensity/repetition bổ sung, evidence ablation và expanded robustness trước khi giảm chất lượng run. | Mở |
| `R-14` | Tiến độ/báo cáo | Báo cáo dồn cuối kỳ hoặc tuần buffer bị dùng để thêm feature, đe dọa M6. | Tuần 20 mới bắt đầu viết; tuần 22 còn extension; artifact/limitation chưa được tổng hợp theo tuần. | `P0` | Bách | Cập nhật tài liệu theo artifact từ tuần 3; review risk/backlog mỗi tuần; tuần 20 freeze protocol, tuần 22 chỉ hợp nhất/finalize. | Cắt toàn bộ Target/Stretch chưa xong; tuần 23–24 chỉ xử lý contingency, backup, fresh reproduction và rehearsal. | Mở |

## 5. Hành động bắt buộc trong tuần 4

Các mục dưới đây là control action để giảm rủi ro sớm. Tại thời điểm lập v1, tất cả vẫn là **tồn đọng**; link chỉ định nơi phải tạo bằng chứng và không có nghĩa task đã hoàn thành.

| Hành động tuần 4 | Risk liên quan | Owner chính | Bằng chứng mong đợi | Trạng thái |
| --- | --- | --- | --- | --- |
| [W4-T1 — Chốt service topology](weekly/week-04_2026-08-23_to_2026-08-29/task-01_define-service-topology.md) | `R-01`, `R-02` | Đức | Catalogue/diagram giữ 6 service + Gateway và phân tầng MVP/Target/Stretch | Tồn đọng |
| [W4-T2 — Chốt HTTP/event contracts](weekly/week-04_2026-08-23_to_2026-08-29/task-02_define-http-and-event-contracts.md) | `R-03`, `R-05` | Đức | Correlation/identity qua HTTP và `grade.completed`, ownership/version/error tối thiểu | Tồn đọng |
| [W4-T3 — Chốt data ownership và fault matrix](weekly/week-04_2026-08-23_to_2026-08-29/task-03_define-data-ownership-and-fault-matrix.md) | `R-02`, `R-06`, `R-10` | Đức | Năm fault category có target, injector, workload, symptom, ground truth và reset/verification | Tồn đọng |
| [W4-T4 — Chốt telemetry và ground-truth schema](weekly/week-04_2026-08-23_to_2026-08-29/task-04_define-telemetry-and-ground-truth-schema.md) | `R-03`, `R-04`, `R-06`, `R-07`, `R-11` | Bách | Schema/version, identity/correlation, missingness, run/fault interval và provenance tối thiểu | Tồn đọng |
| [W4-T5 — Chốt evaluation protocol v0](weekly/week-04_2026-08-23_to_2026-08-29/task-05_define-evaluation-protocol.md) | `R-08`–`R-13` | Bách | Run-level split, candidate set, metric, baseline/ablation/robustness và freeze rule | Tồn đọng |

Ngoài các task trên, Đức cần review riêng các risk `R-02`, `R-03`, `R-05`, `R-06`, `R-07` và `R-13` về Compose, instrumentation, workload/fault, experiment runner và fresh reproducibility. Kết quả review phải được ghi vào hồ sơ W3-T4 trước khi task đủ điều kiện chuyển sang `Chờ review`.

## 6. Checklist rà soát hằng tuần

- [ ] Có trigger mới nào xuất hiện hoặc đổi mức ưu tiên không?
- [ ] Mỗi risk `P0`/`P1` đang mở có đúng một owner, hành động và hạn kế tiếp không?
- [ ] Mitigation đã có link artifact/test/run ledger hay mới chỉ là kế hoạch?
- [ ] Có hạng mục Target/Stretch nào đi vào critical path trước Gate M4 không?
- [ ] Có thay đổi nào xâm phạm MVP floor, evaluation freeze hoặc run-level split không?
- [ ] Run invalid, missing telemetry và thay đổi protocol có được ghi lại thay vì âm thầm bỏ qua không?
- [ ] Risk chỉ được chuyển `Đã đóng` khi bằng chứng mở được và collaborator đã review chưa?

## 7. Lịch sử rà soát

| Ngày | Người rà soát | Thay đổi | Bằng chứng / quyết định tiếp theo |
| --- | --- | --- | --- |
| 27/08/2026 | Bách | Khởi tạo risk register v1; giữ toàn bộ risk ở trạng thái `Mở` | Chờ Đức review nhóm platform/experiment; thực hiện các control action W4-T1 đến W4-T5 |
