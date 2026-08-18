# First Plan — Lộ trình hoàn thành đồ án trong 20 tuần

> **Trạng thái:** Tài liệu lịch sử / đã được thay thế.
>
> Không sử dụng file này làm kế hoạch triển khai hiện tại.
>
> Kế hoạch canonical hiện tại: [`plan-v0.2-24-weeks.md`](plan-v0.2-24-weeks.md).

> **Đề tài:** Xây dựng hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố trong kiến trúc microservice dựa trên dữ liệu observability và học máy  
> **Phiên bản:** 0.1 — First Plan  
> **Thời lượng:** 20 tuần  
> **Nhân sự:** 2 thành viên (A và B)  
> **Mục tiêu cuối kỳ:** Một LMS microservice testbed có observability, workload/fault injection và một pipeline anomaly detection + RCA được đánh giá định lượng bằng ground truth.

---

## 1. Nguyên tắc thực hiện

### 1.1. Cùng sở hữu toàn bộ hệ thống

Không chia đề tài thành “A làm backend, B làm AI”. Mỗi hạng mục luôn có:

- **Người phụ trách chính:** thiết kế chi tiết, triển khai phần lớn và mở pull request (PR).
- **Người phối hợp:** cùng thiết kế từ đầu, triển khai một phần có ranh giới rõ, chạy thử độc lập và review PR.
- **Cả hai:** thống nhất API/schema, cùng demo sản phẩm tuần và cùng hiểu cách vận hành phần đã hoàn thành.

Vai trò chính được luân phiên giữa A và B. Nhờ vậy, khi một người bận, người còn lại vẫn có thể sửa lỗi, chạy thí nghiệm hoặc tiếp tục hạng mục đó.

### 1.2. Nhịp làm việc mỗi tuần

| Thời điểm | Hoạt động bắt buộc | Kết quả |
| --- | --- | --- |
| Đầu tuần | Cùng chốt mục tiêu, issue và tiêu chí nghiệm thu | Board/issue có owner chính, owner phối hợp và deadline |
| Giữa tuần | Pair session 60–90 phút cho phần thiết kế/rủi ro | Quyết định được ghi vào issue hoặc ADR |
| Cuối tuần | PR review chéo, demo và retrospective 20 phút | Một demo chạy được; backlog/rủi ro được cập nhật |

### 1.3. Definition of Done áp dụng cho mọi tuần

Một sản phẩm tuần chỉ được coi là hoàn thành khi có đủ:

1. Mã nguồn/cấu hình hoặc tài liệu được commit vào repository.
2. README/hướng dẫn chạy được cập nhật nếu cách dùng thay đổi.
3. Người phối hợp chạy lại được trên máy/môi trường của mình.
4. Có review chéo qua PR hoặc checklist review ghi nhận trong issue.
5. Có demo ngắn, ảnh chụp màn hình hoặc log kết quả lưu trong `docs/`.

---

## 2. Các mốc bàn giao chính

| Mốc | Cuối tuần | Sản phẩm có thể kiểm tra |
| --- | ---: | --- |
| **M1 — Nền tảng tái lập** | 3 | Repository, Docker Compose, CI, kiến trúc và hợp đồng API đã chốt. |
| **M2 — Testbed MVP** | 7 | Luồng LMS xuyên service chạy được, có database/cache/queue và test tự động. |
| **M3 — Observability & fault** | 11 | Metrics, traces, logs, workload và ít nhất 5 fault scenario có ground truth. |
| **M4 — Pipeline AI/RCA MVP** | 15 | Phát hiện incident và xếp hạng root-cause candidates trên dữ liệu testbed. |
| **M5 — Đánh giá hoàn chỉnh** | 18 | Dataset thí nghiệm, baseline, ablation và bảng kết quả sơ bộ. |
| **M6 — Bàn giao đồ án** | 20 | Demo ổn định, báo cáo/slide hoàn chỉnh và gói tái lập. |

---

## 3. Kế hoạch chi tiết theo tuần

### Giai đoạn 1 — Chốt phạm vi và dựng nền tảng (Tuần 1–3)

| Tuần | Mục tiêu và công việc | A phụ trách chính | B phụ trách chính | Sản phẩm bàn giao cuối tuần |
| ---: | --- | --- | --- | --- |
| **1** | Chuyển định hướng thành backlog triển khai; chốt MVP, câu hỏi nghiên cứu, tiêu chí đánh giá, luồng dữ liệu và rủi ro. | Dựng product backlog, ưu tiên MVP và tiêu chí nghiệm thu. | Viết sơ đồ kiến trúc tổng thể, data flow và danh sách metric/RCA metric cần đo. | `docs/plan/FirstPlan.md`, backlog 20 tuần, architecture diagram v0, scope/out-of-scope và risk register. |
| **2** | Chốt topology testbed, service contract, event contract, dữ liệu mẫu và fault matrix. | Thiết kế API Gateway/Auth/Course/Enrollment cùng OpenAPI sơ bộ. | Thiết kế Assignment/Submission/Grading/Notification, RabbitMQ events và fault matrix. | ADR v1, service catalogue, OpenAPI/event schema v1, seed-data model, fault matrix tối thiểu 8 case. |
| **3** | Dựng repository chạy được từ đầu: monorepo hoặc đa service, Docker Compose, biến môi trường, lint/test/CI. | Bootstrap service template, code convention, lint/unit-test setup. | Docker Compose, PostgreSQL/Redis/RabbitMQ, health check và GitHub Actions/CI tương đương. | `docker compose up` chạy được; một service mẫu có `/health`; CI pass; Quick Start trong README. |

**Gate M1:** Cả A và B tự clone, chạy stack và gọi được health check mà không cần hỗ trợ trực tiếp.

### Giai đoạn 2 — Hoàn thành LMS microservice testbed (Tuần 4–7)

| Tuần | Mục tiêu và công việc | A phụ trách chính | B phụ trách chính | Sản phẩm bàn giao cuối tuần |
| ---: | --- | --- | --- | --- |
| **4** | Xây nền tảng request xuyên service: Gateway, Auth, Course, schema database, xác thực và propagation header. | Gateway/Auth, JWT/role cơ bản, integration test login. | Course service, PostgreSQL migration, Redis cache và integration test. | Luồng `login → xem course` qua gateway; migration/seed; test và Postman/Bruno collection. |
| **5** | Bổ sung Enrollment và Assignment; thiết lập nguyên tắc trace context cho HTTP/event ngay trong code. | Enrollment gọi Course, kiểm tra quyền và test lỗi dependency. | Assignment CRUD, event `assignment.created`, consumer mẫu. | Luồng `enroll → tạo/xem assignment` chạy được; contract test tối thiểu cho một HTTP call và một event. |
| **6** | Bổ sung Submission, object storage mock và Grading; hoàn thiện luồng học tập chính. | Submission upload metadata/file mock, gọi Assignment và lưu DB. | Grading consumer/endpoint, cập nhật trạng thái submission và test. | Luồng `nộp bài → chấm điểm` end-to-end, seed script và test E2E đầu tiên. |
| **7** | Bổ sung Notification; hardening MVP: timeout/retry, error response, idempotency ở event quan trọng và test regression. | Notification consumer và cơ chế retry/dead-letter ở mức MVP. | Chuẩn hóa error handling, test E2E toàn luồng và test data reset. | **Testbed MVP release v0.1**: 6–8 service, database/cache/queue, một lệnh reset + E2E suite pass. |

**Gate M2:** Một người có thể khởi động stack; người kia chạy bộ E2E, xác nhận ít nhất hai luồng nghiệp vụ xuyên 3 service trở lên.

### Giai đoạn 3 — Observability, workload và fault injection (Tuần 8–11)

| Tuần | Mục tiêu và công việc | A phụ trách chính | B phụ trách chính | Sản phẩm bàn giao cuối tuần |
| ---: | --- | --- | --- | --- |
| **8** | Instrument metrics và traces bằng OpenTelemetry; dựng telemetry backend cục bộ. | Instrument HTTP/client/database, trace propagation và service/resource attributes. | OTel Collector, Prometheus, Tempo, Grafana và dashboard service overview. | Một request hiển thị trace xuyên service; dashboard có request rate, error rate, p95 latency, CPU/memory. |
| **9** | Thêm structured logs có `trace_id`/`span_id`; định nghĩa schema telemetry và cơ chế xuất dữ liệu phân tích. | Chuẩn hóa logger, log correlation và lỗi có cấu trúc. | Loki ingestion, truy vấn log theo trace; exporter/job lưu telemetry theo time window. | Trace ↔ log truy vết hai chiều; `telemetry-schema.md`; mẫu dữ liệu metrics/traces/logs được export. |
| **10** | Tạo workload generator có profile bình thường và load cao; tạo fault-injection framework có manifest. | Kịch bản workload (login, enrollment, submission) và chỉ số throughput/error. | Fault runner/manifest, metadata ground truth và hai fault đầu: service delay, DB latency. | Lệnh chạy workload; `experiments/<run-id>/manifest`; 2 thí nghiệm có telemetry + ground truth. |
| **11** | Mở rộng và kiểm chứng fault scenarios; hoàn thiện khả năng reset/tái lập experiment. | CPU saturation, service error/crash, Redis slowdown. | Queue backlog, network/dependency delay, script reset và data validation. | **Observability & Fault release v0.2**: tối thiểu 5 fault scenario chạy lặp lại được, dashboard và dataset mẫu. |

**Gate M3:** Cả hai cùng chạy một fault từ manifest và cùng xác nhận được thời điểm/symptom của nó trên metrics, trace và log.

### Giai đoạn 4 — Anomaly detection và RCA MVP (Tuần 12–15)

| Tuần | Mục tiêu và công việc | A phụ trách chính | B phụ trách chính | Sản phẩm bàn giao cuối tuần |
| ---: | --- | --- | --- | --- |
| **12** | Xây data pipeline: import, làm sạch, windowing, feature engineering; version hóa dataset và feature schema. | Pipeline metrics features: rate, error rate, latency, CPU/memory. | Trace/log features: downstream latency, trace error rate, log error rate; data quality checks. | Dataset v0 có train/validation/test split theo experiment; notebook/script sinh feature; data dictionary. |
| **13** | Cài đặt baseline detection và xác định incident window: threshold/robust z-score, rồi Isolation Forest. | Statistical baseline, tuning config và visualisation score theo thời gian. | Isolation Forest pipeline, đánh giá theo Precision/Recall/F1/Detection Delay. | Bảng benchmark detector v0 trên ít nhất 3 fault case; incident record chứa `estimated_start_time`. |
| **14** | Tạo dynamic dependency graph từ traces và thiết kế RCA score có thể giải thích. | Graph builder: caller-callee, edge weight/error/latency, export graph. | Temporal propagation + ranking score: anomaly severity, onset time, upstream/downstream evidence. | `rca-result.json` Top-K cho một incident, kèm graph/timeline và giải thích score. |
| **15** | Tích hợp detector + RCA thành pipeline end-to-end/API; kiểm tra các failure mode và tinh chỉnh có bằng chứng. | API/CLI chạy từ experiment ID tới incident/RCA result. | Regression/evaluation harness, kiểm thử missing telemetry và error cases. | **AI/RCA MVP release v0.3**: chạy một lệnh từ telemetry đến Top-3 candidates + evidence; demo 3 fault case. |

**Gate M4:** A chạy thử fault do B chọn và B chạy thử fault do A chọn; hai người so sánh kết quả với ground truth, ghi rõ thành công/thất bại.

### Giai đoạn 5 — Thực nghiệm, hoàn thiện và bàn giao (Tuần 16–20)

| Tuần | Mục tiêu và công việc | A phụ trách chính | B phụ trách chính | Sản phẩm bàn giao cuối tuần |
| ---: | --- | --- | --- | --- |
| **16** | Chốt experimental protocol: workload profile, cường độ/thời lượng fault, số lần lặp, seed và tiêu chí phân tích. Chạy pilot. | Thiết kế experiment matrix và automation nhiều lượt chạy. | Kiểm tra ground truth, data quality, công thức metric và mẫu bảng kết quả. | Protocol v1, experiment matrix (tối thiểu 5 fault × 3 lần lặp), pilot dataset và báo cáo pilot. |
| **17** | Chạy thực nghiệm chính và baseline/ablation có ưu tiên; theo dõi lỗi tái lập, không thêm feature ngoài scope. | Chạy metrics-only và full multi-source detection/RCA; lưu artifact. | Chạy ablation graph/temporal, robustness với missing telemetry/sampling; kiểm tra result. | Dataset thực nghiệm v1, artifact đầy đủ, bảng kết quả thô và issue cho các run bất thường. |
| **18** | Phân tích kết quả, lặp lại các run bất thường; chốt claim có bằng chứng và freeze phiên bản hệ thống. | Phân tích anomaly/incident metrics, biểu đồ và bảng so sánh. | Phân tích RCA Top-1/Top-3/MRR, runtime/robustness và error analysis. | **Evaluation release v1.0**: bảng/biểu đồ cuối, findings + limitations, tag commit tái lập. |
| **19** | Hoàn thiện sản phẩm trình diễn và viết báo cáo kỹ thuật. | Dashboard/demo script, kiến trúc testbed/observability và hướng dẫn tái lập. | Chương AI/RCA, thiết kế thí nghiệm, kết quả và threats to validity. | Demo 10–15 phút chạy ổn định; draft báo cáo hoàn chỉnh v1; checklist tái lập. |
| **20** | Review chéo toàn diện, rehearsal bảo vệ và chốt gói bàn giao. | Review báo cáo của B, kiểm tra demo/deployment từ máy sạch, chuẩn bị phần trình bày hệ thống. | Review báo cáo của A, kiểm tra kết quả/figure/citation, chuẩn bị phần trình bày AI và đánh giá. | **Final release**: source + compose + docs + dataset manifest + report + slide + demo video/kịch bản; rehearsal Q&A. |

**Gate M5/M6:** Một thành viên thực hiện fresh setup và demo theo tài liệu, thành viên còn lại đóng vai hội đồng kiểm tra claim, số liệu và khả năng tái lập.

---

## 4. Backlog tối thiểu phải bảo vệ

Để không trượt scope, các hạng mục dưới đây là bắt buộc trước khi thực hiện extension:

- [ ] Testbed có ít nhất 6 service, HTTP + queue, PostgreSQL + Redis + RabbitMQ.
- [ ] Metrics, traces, logs có correlation và dashboard/truy vấn được.
- [ ] Workload generator, reset script, fault manifest và ground truth.
- [ ] Ít nhất một baseline thống kê và Isolation Forest cho detection.
- [ ] Dependency graph từ traces và RCA Top-K có evidence.
- [ ] Đánh giá lặp lại: ít nhất 5 fault scenario × 3 lượt chạy.
- [ ] Baseline/ablation, báo cáo limitation và hướng dẫn tái lập.

Các extension như Kubernetes, Chaos Mesh, change-point detection nâng cao, log-template model hoặc causal analysis chỉ được bắt đầu khi checklist trên hoàn tất và M4 đã qua gate.

---

## 5. Phân chia mã nguồn để dễ hỗ trợ chéo

Nên chia repository theo **module kỹ thuật**, không theo người sở hữu cố định:

```text
services/             # LMS testbed; cả A và B đều có quyền sửa
platform/observability/ # OTel Collector, dashboards, storage config
platform/experiments/   # workload, fault manifests, reset/run scripts
analysis/               # ingestion, features, detectors, RCA, evaluation
docs/                   # ADR, protocol, report assets, runbook
```

Quy ước review:

- Không merge thay đổi vào `services/`, `platform/` hoặc `analysis/` nếu chưa có review của người còn lại.
- Mỗi PR có mô tả: mục tiêu, cách chạy, kết quả test và ảnh hưởng telemetry/experiment.
- Thay đổi schema API, event, telemetry hoặc metric phải có ADR ngắn và cập nhật data dictionary.
- Mỗi tuần đổi người chạy demo: tuần lẻ A demo, tuần chẵn B demo. Người demo không nhất thiết là người viết nhiều code nhất.

---

## 6. Quản lý rủi ro và quy tắc giảm scope

| Rủi ro | Dấu hiệu sớm | Cách xử lý đã định trước |
| --- | --- | --- |
| Testbed quá lớn | Sau tuần 6 chưa có luồng E2E | Giữ 6 service cốt lõi; Notification/Grading có thể giản lược nhưng vẫn giữ queue. |
| Telemetry khó liên kết | Cuối tuần 9 không truy được log từ trace | Ưu tiên trace + metrics; chỉ giữ structured log tối thiểu có correlation ID. |
| Fault không tái lập | Cùng manifest cho kết quả khác biệt lớn | Chạy Compose cục bộ, cố định workload/seed và lưu cấu hình mỗi run. |
| ML không tốt hơn baseline | Sau tuần 13 F1 không cải thiện | Báo cáo trung thực baseline; tập trung đóng góp vào feature fusion/RCA, không đổi model tùy tiện. |
| RCA chưa chính xác | Top-3 thấp ở pilot | Giảm graph/ranking về rule-based, giải thích được; thêm temporal/dependency evidence trước khi dùng thuật toán phức tạp. |
| Thiếu thời gian báo cáo | Tuần 18 chưa có bảng kết quả ổn định | Freeze feature, chỉ sửa reproducibility và chạy thí nghiệm thiết yếu. |

---

## 7. Cách cập nhật các phiên bản kế hoạch sau

Tài liệu này là baseline và **không xóa lịch sử** khi thay đổi. Các lần điều chỉnh tiếp theo tạo file mới, ví dụ:

```text
docs/plan/
├── FirstPlan.md              # baseline 20 tuần này
├── Plan-v0.2.md               # điều chỉnh sau gate M1/M2
└── Plan-v0.3-experiments.md   # điều chỉnh protocol thực nghiệm
```

Mỗi phiên bản mới cần ghi ở đầu tài liệu: ngày cập nhật, lý do thay đổi, các tuần bị ảnh hưởng, hạng mục bị thêm/bỏ và tác động đến các mốc M1–M6.

> Nguyên tắc khi thay đổi plan: thay đổi **phương pháp hoặc scope extension** trước; không được đánh đổi khả năng tái lập, ground truth và đánh giá định lượng của đề tài.
