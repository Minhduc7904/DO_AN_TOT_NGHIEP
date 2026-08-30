# Literature matrix v0 — baseline và phương pháp cho anomaly detection / RCA

> **Trạng thái:** Review-ready artifact cho `task-05_create-literature-matrix`.
>
> **Vai trò:** Tổng hợp evidence từ literature cho các baseline/phương pháp đã có hướng trong artifact canonical của anomaly detection, incident detection, service-level RCA và evaluation. Matrix này **không phải** literature review hoàn chỉnh, không chốt implementation priority và không tạo source of truth cạnh tranh với các tài liệu canonical hiện có.
>
> **Nguồn canonical phải tuân thủ:**
>
> - WHY/WHAT và research scope: [`../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md`](../direction/khung_dinh_huong_tong_the_lms_microservice_ai_rca.md)
> - MVP scope: [`../direction/project-scope-v1.md`](../direction/project-scope-v1.md)
> - RQ/metrics v1: [`../direction/research-questions-and-metrics-v1.md`](../direction/research-questions-and-metrics-v1.md)
> - Analysis/AI/RCA implementation: [`../architecture/analysis-anomaly-rca-blueprint.md`](../architecture/analysis-anomaly-rca-blueprint.md)
> - Service topology: [`../architecture/service-catalogue-and-topology-v1.md`](../architecture/service-catalogue-and-topology-v1.md)
> - Fault/data ownership matrix: [`../architecture/data-ownership-and-fault-matrix-v1.md`](../architecture/data-ownership-and-fault-matrix-v1.md)
> - Telemetry + ground truth schema: [`../architecture/telemetry-and-ground-truth-schema-v0.md`](../architecture/telemetry-and-ground-truth-schema-v0.md)

---

## 1. Mục tiêu và nguyên tắc chọn literature

Matrix này phục vụ một câu hỏi thực dụng: **baseline/phương pháp nào đủ đơn giản, tái lập, giải thích được và có thể đánh giá công bằng trên testbed hiện tại?**

Nguyên tắc lựa chọn:

1. Ưu tiên baseline đơn giản trước model phức tạp.
2. Primary RCA giữ ở **service-level**; dependency/component chỉ là evidence bổ sung.
3. Baseline phải chạy được từ telemetry canonical: metrics, traces, logs và metadata/ground truth của controlled experiment.
4. Không dùng deep learning, LLM hoặc causal discovery làm core MVP chỉ vì mới hơn.
5. Nguồn phức tạp vẫn có thể được giữ trong matrix để làm bằng chứng cho hướng thiết kế, ablation hoặc future work, nhưng không tự động trở thành implementation target.
6. Metric cuối cùng phải theo RQ/metrics v1 và evaluation protocol của dự án; không sao chép nguyên scoring protocol của paper nếu granularity khác.

---

## 2. Literature matrix

| ID | Nguồn | Bài toán | Telemetry / input | Phương pháp chính | Metric / cách đánh giá trong nguồn | Giới hạn / lưu ý khi áp dụng | Liên hệ với đồ án |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **L1** | **Chandola, Banerjee, Kumar (2009)** — *Anomaly Detection: A Survey*. ACM Computing Surveys. DOI: [10.1145/1541880.1541882](https://doi.org/10.1145/1541880.1541882) | Tổng quan anomaly/outlier detection và giả định của các nhóm phương pháp | Dữ liệu point/contextual/collective anomaly tùy domain | Phân loại statistical, proximity, clustering, classification và information-theoretic approaches | Survey tổng hợp nhiều cách đánh giá; không đưa một benchmark/metric duy nhất | Không chuyên biệt microservice/time-series incident; không phải recipe triển khai | Dùng làm nền cho việc giữ nhiều baseline khác giả định thay vì chọn một detector duy nhất. Hỗ trợ **RQ1, RQ5** và quyết định so sánh statistical baseline với Isolation Forest. |
| **L2** | **Rousseeuw, Croux (1993)** — *Alternatives to the Median Absolute Deviation*. Journal of the American Statistical Association. DOI: [10.1080/01621459.1993.10476408](https://doi.org/10.1080/01621459.1993.10476408) | Robust estimation của location/scale khi dữ liệu có outlier | Mẫu số đơn biến | Median Absolute Deviation (MAD) và các robust scale estimators | Breakdown point, influence/robustness và statistical efficiency | Không phải anomaly detector hoàn chỉnh; threshold vẫn phải tune/validate theo dữ liệu ứng dụng | Là cơ sở thống kê cho **robust z-score** đang được blueprint ưu tiên. Phù hợp metrics/RED/resource series có spike và distribution lệch. Hỗ trợ **RQ1, RQ4, RQ5**. |
| **L3** | **Liu, Ting, Zhou (2008)** — *Isolation Forest*. IEEE ICDM. DOI: [10.1109/ICDM.2008.17](https://doi.org/10.1109/ICDM.2008.17) | Unsupervised anomaly detection trên dữ liệu nhiều chiều | Feature vectors/tabular numeric data | Random isolation trees; anomaly có expected path length ngắn hơn | AUC và processing/runtime comparisons trên benchmark datasets | Không tự mô hình temporal/dependency semantics; score threshold và contamination phụ thuộc validation; input feature quality quyết định mạnh kết quả | **Core ML baseline** cho vector `service-window` đã định nghĩa trong AI/RCA blueprint. Dùng cho **RQ1**, robustness ở **RQ4** và trade-off ở **RQ5**. |
| **L4** | **Sigelman et al. (2010)** — *Dapper, a Large-Scale Distributed Systems Tracing Infrastructure*. Google Technical Report. [Google Research](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) | Quan sát execution path xuyên nhiều service/machine trong distributed system | Trace ID, span, timestamp, RPC/message relationships | Distributed tracing với propagation context, span tree và sampling | Production coverage/overhead và các troubleshooting use case; không phải RCA accuracy benchmark | Tracing không tự suy ra root cause; sampling có thể làm mất edge/evidence | Cơ sở cho việc dựng **dynamic dependency graph**, temporal ordering và trace evidence. Trực tiếp liên quan **RQ1–RQ4**; đặc biệt hỗ trợ strict trace-degradation comparison của **RQ4**. |
| **L5** | **Mace, Roelke, Fonseca (2015)** — *Pivot Tracing: Dynamic Causal Monitoring for Distributed Systems*. SOSP. DOI: [10.1145/2815400.2815415](https://doi.org/10.1145/2815400.2815415) | Correlate evidence xuyên component/machine để troubleshoot distributed systems | Distributed events + propagated request context + timestamps | Happened-before join và dynamic causal monitoring queries | Root-cause troubleshooting case studies và monitoring overhead | Không cung cấp service-level ranking baseline trực tiếp; dynamic instrumentation/query model vượt nhu cầu MVP | Củng cố nguyên tắc **temporal/causal-order evidence** và correlation xuyên boundary. Không triển khai Pivot Tracing; chỉ dùng ý tưởng `happened-before` để diễn giải **RQ3** và evidence timeline. |
| **L6** | **Wu, Tordsson, Elmroth, Kao (2020)** — *MicroRCA: Root Cause Localization of Performance Issues in Microservices*. IEEE/IFIP NOMS. DOI: [10.1109/NOMS47738.2020.9110353](https://doi.org/10.1109/NOMS47738.2020.9110353) | Root-cause localization cho performance issues trong microservices | Service response-time symptoms + system resource utilization + service/host relations | Attributed graph mô hình anomaly propagation và ranking root-cause candidates | Precision và mean average precision; paper báo cáo 89% precision và 97% MAP trên benchmark của họ | Tập trung performance/resource faults; topology/host assumptions và granularity không khớp hoàn toàn testbed; không nên sao chép implementation nguyên xi | Reference chính cho **graph-aware RCA**. Hỗ trợ baseline `graph-aware simple` và propagation reasoning ở **RQ2**, đồng thời làm reference cho **RQ5**. |
| **L7** | **Liu et al. (2021)** — *MicroHECL: High-Efficient Root Cause Localization in Large-Scale Microservice Systems*. ICSE-SEIP. DOI: [10.1109/ICSE-SEIP52600.2021.00043](https://doi.org/10.1109/ICSE-SEIP52600.2021.00043) | Root-cause localization khi anomaly lan truyền qua service dependency | Dynamic service call graph; response time, error count, QPS theo thời gian | Detect anomaly theo loại + traverse/prune anomaly propagation chains + correlation-based ranking | HR@1/3/5, MRR và localization time; paper báo cáo HR@3 ≈ 0.67 trong controlled study | Industrial system rất lớn, logic anomaly-type-specific; external validity sang LMS testbed nhỏ cần thận trọng | Rất phù hợp để biện minh cho **dependency + propagation + temporal direction**. Hỗ trợ **RQ2, RQ3, RQ5**; metric HR@k/MRR tương thích về ý nghĩa với Top-K/MRR canonical của dự án. |
| **L8** | **Lee, Yang, Chen, Su, Lyu (2023)** — *Eadro: An End-to-End Troubleshooting Framework for Microservices on Multi-source Data*. ICSE. DOI: [10.1109/ICSE48619.2023.00150](https://doi.org/10.1109/ICSE48619.2023.00150) | Joint anomaly detection + root-cause localization từ nhiều telemetry modality | Logs + KPIs/metrics + traces + service dependencies | Modality-specific representation + multi-source fusion + dependency-aware neural model + joint learning | Detection Precision/Recall/F1; RCA HR@1/3/5 và NDCG@k; có ablation theo modality/dependency | Deep/multi-task architecture, training cost và complexity vượt MVP; evaluation theo observation window khác incident/fault-run canonical | **Không chọn làm core method.** Dùng làm evidence rằng modality ablation có giá trị và để biện minh comparison `M` vs `M+T` vs `M+T+L` của **RQ1**. Có thể làm future-work reference cho richer fusion sau MVP. |
| **L9** | **Tatbul, Lee, Zdonik, Alam, Gottschlich (2018)** — *Precision and Recall for Time Series*. NeurIPS. [arXiv:1803.03639](https://arxiv.org/abs/1803.03639) | Đánh giá anomaly xảy ra theo **range/interval**, không chỉ independent points | Ground-truth anomaly ranges + predicted anomaly ranges | Range-based precision/recall có positional/cardinality/domain preferences | Range-based Precision/Recall và các biến thể | Metric framework linh hoạt nhưng nhiều option có thể gây subjective configuration; không trực tiếp giải quyết RCA | Reference để tránh đánh giá detector chỉ ở point level. Dự án vẫn giữ **incident/fault-run level Precision/Recall/F1/FPR/Delay** theo RQ v1; nguồn này hỗ trợ lý do thiết kế tolerance/windowing của evaluation. |
| **L10** | **Lavin, Ahmad (2015)** — *Evaluating Real-Time Anomaly Detection Algorithms — The Numenta Anomaly Benchmark*. IEEE ICMLA. DOI: [10.1109/ICMLA.2015.141](https://doi.org/10.1109/ICMLA.2015.141) | Đánh giá real-time/streaming anomaly detector có xét thời điểm phát hiện và false alarms | Labeled time-series streams + anomaly windows | Reproducible benchmark và time-sensitive anomaly scoring | NAB score cân nhắc detection timeliness, FP/FN | NAB score là domain-specific composite score; không phù hợp để thay metric canonical của đồ án | Hỗ trợ quyết định phải báo **Detection Delay** bên cạnh Precision/Recall/F1/FPR. Không dùng NAB composite score làm primary metric. Liên quan **RQ1, RQ4, RQ5**. |
| **L11** | **Schmidl, Wenig, Papenbrock (2022)** — *Anomaly Detection in Time Series: A Comprehensive Evaluation*. PVLDB. DOI: [10.14778/3538598.3538602](https://doi.org/10.14778/3538598.3538602) | So sánh rộng nhiều thuật toán và metric time-series anomaly detection | Nhiều benchmark time series và anomaly labels | Reproducible benchmarking across algorithms/datasets/metrics | AUC-ROC, AUC-PR và range-aware metrics cùng nhiều case analysis | Kết quả phụ thuộc dataset/metric; threshold-agnostic AUC không phản ánh đầy đủ incident operation của project | Reference cho **evaluation hygiene**, sensitivity theo metric và reproducibility. Project vẫn dùng metric canonical RQ v1 thay vì đổi sang AUC làm primary. Hỗ trợ **RQ5** và protocol design. |
| **L12** | **Yu, Zhao, Li, Li, Wang, Zhang, Sui, Pei (2024)** — *A Survey on Intelligent Management of Alerts and Incidents in IT Services*. Journal of Network and Computer Applications, 224, 103842. DOI: [10.1016/j.jnca.2024.103842](https://doi.org/10.1016/j.jnca.2024.103842) | Alert và incident management trong IT services, đặc biệt correlation, lifecycle và xử lý failure | Alert/incident records và observability data của IT service; survey định vị metrics/logs/traces là dữ liệu vận hành liên quan | Taxonomy và integrated architecture cho alert management, incident management và các kỹ thuật AIM | Survey/taxonomy, không đề xuất một benchmark hoặc metric đánh giá chung duy nhất | Phạm vi ITSM rộng; nhiều kỹ thuật AIM và automation được khảo sát vượt scope MVP, không phải hướng dẫn xây một alert-management subsystem | Bổ sung bằng chứng học thuật cho việc diễn giải anomaly signal ở mức incident và lifecycle/correlation hiện có. Hỗ trợ **RQ1, RQ5**; không thêm component hay subsystem mới cho MVP. |

---

## 3. Phân loại baseline/reference có hỗ trợ từ literature

Bảng dưới đây chỉ phân loại evidence từ literature theo authority đã có. Nhãn **Canonical requirement** chỉ mô tả requirement đã tồn tại trong tài liệu canonical; matrix không tự tạo requirement, không chốt implementation order và không thay đổi baseline trong AI/RCA blueprint.

> Đánh giá tính khả thi trong bảng là đánh giá sơ bộ của artifact để hỗ trợ lựa chọn baseline/reference. Collaborator review vẫn là bước xác nhận riêng theo workflow của task.

| Nhóm | Variant / baseline | Phân loại theo authority | RQ chính | Input canonical | Metric canonical | Tính khả thi trên testbed hiện tại |
| --- | --- | --- | --- | --- | --- | --- |
| Anomaly detection | **Static threshold** trên error rate / latency / resource signal | **Canonical requirement; literature-supported baseline** | RQ1, RQ5 | Service metrics theo `service-window`; threshold versioned/tune ngoài final test | Precision, Recall, F1, FPR, Detection Delay | **Đánh giá sơ bộ: Cao.** RED/resource metrics đã nằm trong telemetry requirement; dễ giải thích và tái lập. |
| Anomaly detection | **Classical z-score** | **Recommended baseline/reference** | RQ1, RQ5 | Một hoặc vài feature đã normalize theo healthy baseline | Cùng detection metrics | **Đánh giá sơ bộ: Cao**, nhưng nhạy outlier/distribution lệch nên không phải statistical baseline ưu tiên. |
| Anomaly detection | **Robust z-score (median + MAD)** | **Canonical requirement; literature-supported baseline** | RQ1, RQ4, RQ5 | Healthy baseline + service-window feature series | Cùng detection metrics | **Đánh giá sơ bộ: Cao.** Hợp với telemetry có spike; implementation nhỏ, deterministic, explainable. |
| Anomaly detection | **Isolation Forest** | **Canonical requirement; literature-supported baseline** | RQ1, RQ4, RQ5 | Vector `service-window` gồm RED/resource + trace/log features theo selected modality | Cùng detection metrics + inference/runtime | **Đánh giá sơ bộ: Cao**, nếu split/tuning được freeze đúng. Không cần label fault khi fit trên healthy data nhưng threshold phải chọn trên validation. |
| Multi-source fusion | **Normalized score + equal-weight fusion** | **Literature-supported baseline/reference; cấu hình weight theo canonical** | RQ1, RQ4, RQ5 | `A_metrics`, `A_traces`, `A_logs` + missing-modality flags | Detection metrics + RCA metrics khi dùng chung downstream logic | **Đánh giá sơ bộ: Cao.** Equal-weight fusion là baseline đơn giản, reproducible và phù hợp để so sánh trước khi cân nhắc weight tuning trên validation. Không cần neural fusion. |
| Incident detection | **Threshold + persistence + merge/recovery rule** | **Canonical requirement; literature-supported implementation reference** | RQ1, RQ4, RQ5 | Fused/service anomaly scores theo time window | Incident-level Precision/Recall/F1/FPR + Detection Delay | **Đánh giá sơ bộ: Cao.** Fault có `fault_start/fault_end`; rule/config phải versioned. Không mở incident từ một isolated high score. |
| RCA | **Max anomaly** | **Canonical requirement; literature-supported baseline** | RQ2, RQ5 | Per-service anomaly score trong incident | Top-1, Top-3, MRR, Average Rank | **Đánh giá sơ bộ: Rất cao.** Không cần graph; giúp định lượng failure mode “symptom upstream có severity lớn hơn root cause”. |
| RCA temporal | **Earliest anomaly / earliest reliable evidence** | **Canonical requirement; literature-supported baseline** | RQ3, RQ5 | UTC-aligned service/evidence onset + fault interval chỉ dùng cho evaluation | Top-1, Top-3, MRR, Average Rank | **Đánh giá sơ bộ: Cao.** Trace timestamp, telemetry timestamp và control-plane `fault_start/end` đã có schema; cần tolerance do windowing. |
| RCA dependency | **Graph-aware simple**: anomaly + dependency relation / simple propagation rule | **Canonical requirement; literature-supported baseline** | RQ2, RQ5 | Dynamic service graph từ spans + anomaly score; component edge evidence khi có | Top-1, Top-3, MRR, Average Rank + runtime | **Đánh giá sơ bộ: Cao.** Service topology/traces đã chốt; F1/F2/F5 có propagation synchronous rõ, F4 cần async semantics riêng. |
| RCA proposed | **Anomaly + temporal + propagation + edge + evidence score** theo blueprint | **Canonical method direction; literature contextualizes, không tạo priority mới** | RQ2, RQ3, RQ5 | Multi-source service evidence + dynamic graph + timestamps | Top-1, Top-3, MRR, Average Rank + explainability/runtime | **Đánh giá sơ bộ: Khả thi có điều kiện.** Weight tune trên validation hoặc sensitivity analysis, không tune trên final test. |
| Robustness | **Full telemetry vs một controlled degraded condition trên cùng baseline artifact** | **Canonical requirement; literature-supported evaluation reference** | RQ4 | Cùng `run_id`, immutable ground truth; derived trace-drop **hoặc** missing-modality artifact | Absolute + delta detection/RCA metrics | **Đánh giá sơ bộ: Cao theo schema W4-T4.** Derived artifact có lineage/config/seed riêng; không chạy hai workload/fault execution độc lập cho một pair. |

---

## 4. Ánh xạ literature → RQ/metric v1

| RQ | Literature hỗ trợ | Kết luận sử dụng cho MVP | Metric giữ theo canonical |
| --- | --- | --- | --- |
| **RQ1 — Multi-source telemetry** | L1, L2, L3, L4, L8, L12 | So sánh detector đơn giản trên `M`, `M+T`, `M+T+L`; dùng score-level fusion dễ giải thích. Eadro chỉ chứng minh hướng multi-source/ablation có ý nghĩa, **không** kéo neural fusion vào MVP. L12 hỗ trợ framing alert/incident correlation và incident-level interpretation đã có, không thêm subsystem mới. | Detection Precision/Recall/F1/FPR/Delay; RCA Top-1/Top-3/MRR khi cùng downstream RCA logic. |
| **RQ2 — Dependency graph** | L4, L6, L7 | So sánh severity-only với graph-aware simple; graph lấy từ observed traces theo run/window, topology static chỉ dùng validation. | Top-1, Top-3, MRR; Average Rank bổ sung. |
| **RQ3 — Temporal information** | L4, L5, L7 | So sánh no-temporal với earliest-anomaly rồi temporal-aware ranking. `fault_start` là truth để đánh giá, không được dùng làm feature dự đoán. | Top-1, Top-3, MRR; Average Rank bổ sung. |
| **RQ4 — Robustness** | L2, L3, L4, L9, L10 | So sánh full với **một** degraded telemetry condition derived từ cùng baseline artifact; robust z-score là baseline đáng giữ do robustness với outlier, nhưng robustness RQ4 chủ yếu đo missing/degraded telemetry chứ không phải outlier robustness. | Absolute + delta detection metrics; absolute + delta RCA metrics. |
| **RQ5 — Engineering trade-off** | L1, L3, L6, L7, L8, L10, L11 | Đặt simple vs richer variants lên cùng bảng quality/runtime/complexity/interpretability. Không dùng composite utility score. | Quality + runtime/resource + application overhead + explainability checks + qualitative complexity. |

---

## 5. Feasibility đối với fault/telemetry canonical hiện tại

### 5.1. Mapping fault scenario → baseline có thể kiểm tra

| Fault | Signal/evidence chính đã chốt | Baseline phù hợp để kiểm tra | Giá trị cho RCA |
| --- | --- | --- | --- |
| **F1 — Course / Redis latency** | `course-redis` latency, Course RED latency, caller/Gateway propagation, slow dependency span | Threshold/robust z/Isolation Forest; earliest anomaly; graph-aware simple | Case tốt để kiểm tra root cause `course` có bị symptom ở caller/Gateway lấn severity hay không. |
| **F2 — Submission -> Storage latency** | Storage dependency span timeout/latency, Submission error/latency, Gateway symptom | Threshold/robust z/Isolation Forest; earliest anomaly; graph-aware + edge evidence | Dependency evidence rất rõ cho `submission`; phù hợp RQ2/RQ3. |
| **F3 — Submission service error** | Submission controlled error + Gateway error; path ngắn | Threshold/robust z/Isolation Forest; max anomaly và earliest anomaly | Baseline “dễ” để sanity-check detector/RCA trước các propagation case phức tạp. |
| **F4 — Notification consumer slowdown / RabbitMQ backlog** | queue depth/lag, consumer processing latency, async trace/event correlation khi có | Threshold/robust z/Isolation Forest; temporal baseline; graph-aware với async rule riêng | Kiểm tra graph/temporal logic không giả định mọi propagation là synchronous caller->callee latency. |
| **F5 — Submission CPU pressure** | CPU/resource + Submission latency/error + Gateway/Grading symptom tùy workload | Threshold/robust z/Isolation Forest; max anomaly; graph-aware | Kiểm tra multi-source/resource evidence và khả năng phân biệt service root cause với upstream symptom. |

### 5.2. Data/telemetry feasibility

| Requirement của baseline | Nguồn dữ liệu hiện tại | Đánh giá |
| --- | --- | --- |
| Healthy baseline cho threshold/z/MAD/Isolation Forest | Controlled healthy runs + `run_id`, workload metadata và telemetry artifact | **Có thiết kế hỗ trợ.** Exact campaign/split do W4-T5 freeze. |
| Service-window RED/resource feature | `MetricRecord` + feature pipeline trong AI/RCA blueprint | **Có thiết kế hỗ trợ.** |
| Trace-derived service graph | `TraceSpan`, caller/callee/dependency identity, async context khi có | **Có thiết kế hỗ trợ.** Cần quality gate khi sampling/missing edge. |
| Temporal onset | UTC timestamps trên telemetry + `fault_start/fault_end` từ control plane | **Có thiết kế hỗ trợ.** `fault_start` chỉ dùng truth/evaluation. |
| Log modality cho RQ1 | Structured/correlated logs khi runtime phát sinh hợp lý | **Có thiết kế hỗ trợ nhưng có thể sparse.** Missing logs phải là explicit missingness, không impute thành 0. |
| RCA service-level truth | `RunGroundTruth.root_cause_service` | **Có.** Component truth giữ riêng làm evidence. |
| Full/degraded pair cho RQ4 | `TelemetryArtifactManifest` lineage + `TelemetryQualityReport` + immutable ground truth | **Có thiết kế hỗ trợ.** Phải derive degraded artifact từ cùng baseline run. |
| Runtime/trade-off | Timing/resource measurement trong analysis pipeline + app throughput/p95 instrumentation overhead | **Có trong RQ/blueprint**, exact protocol còn phải freeze ở W4-T5. |

---

## 6. Hướng dẫn mức độ sẵn sàng từ literature

Các nhóm dưới đây chỉ phản ánh mức độ đơn giản, reproducibility và giá trị so sánh theo literature. Chúng không thay thế implementation order, task priority hoặc bất kỳ quyết định nào trong plan/blueprint canonical.

### 6.1. Minimum reproducible baselines

- Static threshold và robust z-score là baseline đơn giản, tái lập và giải thích được.
- Incident persistence/merge/recovery rule diễn giải anomaly ở mức incident theo contract canonical.
- Max-anomaly và earliest-anomaly là baseline RCA đơn giản để so sánh với contribution graph/temporal.

### 6.2. Comparative baselines/references

- Isolation Forest và graph-aware simple là các baseline/variant so sánh có hỗ trợ từ literature và đã có hướng canonical.
- Equal-weight multi-source score fusion là baseline đơn giản, reproducible để so sánh trước khi cân nhắc tune weight trên validation; equal weight không phải requirement riêng của matrix.

### 6.3. Candidate methods sau khi baseline ổn định

- Anomaly + temporal + propagation + edge + evidence ranker là hướng phương pháp đã nêu trong blueprint; literature chỉ cung cấp ngữ cảnh/evidence, không tạo thứ tự triển khai mới.

### 6.4. Optional/non-core references và future research

- Neural/deep multi-source fusion kiểu Eadro, LLM-based RCA, causal discovery, component-level primary RCA và broad external benchmark campaign là reference/future direction, không phải core MVP từ matrix này.

---

## 7. Quy tắc evaluation rút ra từ literature nhưng không vượt scope W3-T5

Matrix chỉ ghi các invariant cần giữ; chi tiết experiment/evaluation manifest, split, tolerance và campaign protocol thuộc W4-T5.

1. **Không đánh giá detector chỉ bằng point accuracy.** Primary unit vẫn là incident/fault-run theo RQ v1.
2. **Timeliness phải được giữ riêng.** Detection Delay không được che trong một composite anomaly score.
3. **RCA phải là ranked-list evaluation.** Top-1/Top-3/MRR là primary; Average Rank dùng diễn giải failure.
4. **Không tune trên final test.** Threshold, weights và hyperparameters chỉ dựa training/validation.
5. **Giữ comparison paired khi cần.** RQ4 full/degraded phải cùng baseline `run_id`/artifact lineage/ground truth.
6. **Metric paper không tự động thành metric dự án.** NAB score, NDCG hay AUC có thể là reference/secondary analysis nếu protocol cần, nhưng không thay Precision/Recall/F1/FPR/Delay và Top-K/MRR canonical.
7. **Báo runtime/complexity cùng quality.** Literature về MicroHECL/MicroRCA cho thấy ranking quality không nên tách khỏi localization cost; điều này phù hợp RQ5.

---

## 8. Kết luận v0

Literature hiện tại đủ cơ sở để giữ architecture/phương pháp đã chốt, **không yêu cầu sửa các artifact canonical trước đó**.

Literature hỗ trợ các hướng baseline/phương pháp đã được canonical docs định nghĩa:

- anomaly: **static threshold + robust z-score + Isolation Forest**;
- fusion: **normalized score-level fusion**; equal-weight có thể dùng làm baseline trước khi cân nhắc tune weight trên validation;
- incident: threshold/persistence/merge/recovery rule có version;
- RCA: **max anomaly + earliest anomaly + graph-aware simple**, sau đó mới đánh giá ranker kết hợp anomaly/temporal/propagation/edge/evidence;
- evaluation: incident/fault-run detection metrics + service-level Top-K/MRR + runtime/overhead, có strict paired robustness comparison cho RQ4.

Các nguồn deep/multi-task như Eadro được giữ để hỗ trợ luận điểm multi-source và ablation, nhưng **không trở thành core implementation requirement**. Không có literature nào trong matrix này tạo nhu cầu đổi service topology, fault catalogue F1–F5, telemetry schema, ground-truth granularity hoặc RQ/metric đã chốt.

---

## 9. Điểm cần collaborator review trước khi task được hoàn thành

Artifact này **chưa tự coi collaborator review là hoàn tất**. Đức cần xác nhận các điểm sau trên PR/task workflow hiện hành:

- [ ] Threshold/robust z-score/Isolation Forest đều nhận được feature từ telemetry hiện tại mà không cần thêm truth-leaking signal.
- [ ] F1–F5 tạo đủ case để đánh giá `max anomaly`, `earliest anomaly` và `graph-aware simple`, bao gồm ít nhất một propagation case và async F4.
- [ ] Trace/service graph có thể dựng từ instrumentation canonical; missing/sampling được quality gate thay vì silently coi edge absent là ground truth.
- [ ] RQ4 có thể tạo degraded artifact từ **cùng baseline run/artifact lineage** mà không chạy lại fault/workload như một comparison độc lập.
- [ ] Runtime/throughput/p95 overhead cần cho RQ5 có thể đo lặp lại theo evaluation protocol W4-T5 mà không yêu cầu đổi topology hoặc fault semantics.

Khi các điểm trên được collaborator xác nhận, literature matrix đủ điều kiện về **data/fault/telemetry feasibility** theo Definition of Done của W3-T5; metadata PR/review/completion tiếp tục theo workflow của repo, không được ghi giả trong artifact này.
