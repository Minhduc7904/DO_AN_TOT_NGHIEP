# Plan v0.3 — Lộ trình đồ án 24 tuần

> **Đã được thay thế** bởi [plan-v0.4-24-weeks.md](plan-v0.4-24-weeks.md) (17/11/2026, [ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md)). Khung 24 tuần, Gate R và các mốc giữ nguyên trong v0.4; nội dung tuần 13–21 theo v0.4. File này giữ làm lịch sử.

> **Trạng thái:** Sole canonical source of truth cho WHEN + WHO. Thay thế [plan-v0.2](plan-v0.2-24-weeks.md) (giữ làm lịch sử).
>
> **Backend scope, topology và implementation architecture:** tuần 3–10 theo [`backend_microservice_testbed_blueprint`](../architecture/backend_microservice_testbed_blueprint.md) (testbed v1); từ tuần 11 theo [`backend-microservice-testbed-blueprint-v2`](../architecture/backend-microservice-testbed-blueprint-v2.md) và [`service-catalogue-and-topology-v2`](../architecture/service-catalogue-and-topology-v2.md).
>
> **Phạm vi:** [`project-scope-v2`](../direction/project-scope-v2.md), các quyết định [ADR-001 → ADR-006](../adr/); khi mâu thuẫn, [ADR-006](../adr/adr-006-trim-project-scope-v1.md) được ưu tiên.

> **Đề tài:** Xây dựng hệ thống phát hiện bất thường và hỗ trợ phân tích nguyên nhân sự cố trong kiến trúc microservice dựa trên dữ liệu observability và học máy  
> **Phiên bản:** 0.3 — 24-week plan có giai đoạn tái cấu trúc  
> **Thời lượng chính thức:** 24 tuần  
> **Tuần 1–2:** chuẩn bị, không tính vào thời gian triển khai  
> **Tuần 3–10:** giữ nguyên plan v0.2 (testbed v1 và observability)  
> **Tuần 11–12:** tái cấu trúc testbed và phạm vi theo góp ý giữa kỳ (Gate R)  
> **Tuần 13–23:** workload, fault, dataset, RCA engine, đánh giá và bàn giao  
> **Tuần 24:** buffer/backup, không lên kế hoạch feature mới  
> **Nhân sự:** 2 thành viên (A và B); theo [implementation-backlog-v1](implementation-backlog-v1.md), A = Đức (Backend/Platform primary), B = Bách (AI/Diagnosis primary)  
> **Mục tiêu cuối kỳ:** Một LMS microservice testbed có observability, workload mô phỏng hành vi người dùng, fault injection có ground truth và RCA engine tự động phát hiện incident, xếp hạng ứng viên nguyên nhân kèm bằng chứng, được đánh giá định lượng và đối chứng với truy vết thủ công.

---

## 0. Ghi nhận cập nhật so với v0.2

Theo mục "Cách cập nhật kế hoạch" của v0.2:

| Mục                                     | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ngày cập nhật                           | 17/11/2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Lý do                                   | Báo cáo giữa kỳ (sau tuần 10). Giảng viên hướng dẫn yêu cầu: (1) chứng minh việc áp dụng ML/AI giúp chẩn đoán hiệu quả hơn hoặc nhanh hơn truy vết thủ công, vì truy vết thủ công vẫn có thể tìm ra nguyên nhân; (2) traffic giả lập phải gần hành vi người dùng thật thay vì k6 đơn thuần, gợi ý ba mức: mức 1 giả lập chuỗi request, mức 2 mô phỏng hành vi (User Profile → Goal → Behavior Model → Next Action → System Response → Update User State → Next Action), mức 3 AI agent đóng vai người dùng. Rà soát testbed v1 cho thấy chỉ có một chuỗi bất đồng bộ (`grade.completed`), storage là mock và không có dependency dùng chung, nên chưa đủ điều kiện tạo sự cố khiến truy vết thủ công tốn thời gian. |
| Tuần/milestone bị ảnh hưởng             | Tuần 11–12 thành giai đoạn tái cấu trúc, kết thúc bằng Gate R. M3 từ cuối tuần 13 sang cuối tuần 15; M4 từ cuối tuần 19 sang cuối tuần 18; M5 giữ cuối tuần 21; M6 từ cuối tuần 22 sang cuối tuần 23.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Scope thêm                              | Testbed v2 (7 service + 4 worker, command qua RabbitMQ, MinIO, SMTP, service token/JWKS); RQ6 đối chứng với truy vết thủ công và baseline `base-manual-auto`; workload mô phỏng hành vi người dùng mức 1 + 2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Scope bỏ hoặc hạ tầng                   | Topology v1 (`enrollment`, `submission`, `grading`, storage mock, Redis); MCP/agent ra Out-of-scope; ranker học có giám sát là Stretch; thử nghiệm người thật là Target; mức 3 (AI agent đóng vai người dùng) không làm vì không tái lập được và không tạo được tải. Floor đánh giá đổi từ `5 fault × 3 run` sang `4 case × 5 run` ([ADR-006](../adr/adr-006-trim-project-scope-v1.md)).                                                                                                                                                                                                                                                                                                                            |
| Tác động tới experiment/reproducibility | Telemetry thu trên topology v1 không dùng làm dataset chính thức; dataset chỉ thu trên testbed v2 sau Gate R. Hồ sơ tuần 2–10 giữ nguyên làm lịch sử.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Buffer                                  | Dùng tuần 23 (buffer 1 của v0.2) cho bàn giao; còn tuần 24 làm buffer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## 1. Quy ước về mốc thời gian

```text
Tuần 1–2    : Preparation / readiness
Tuần 3–10   : Testbed v1 + observability (giữ nguyên v0.2)
Tuần 11–12  : Tái cấu trúc testbed và phạm vi (Gate R)
Tuần 13–23  : Workload, fault, dataset, RCA engine, đánh giá, bàn giao
Tuần 24     : Buffer / contingency
```

- **Gate R là cổng cứng.** Không bắt đầu task của tuần 13 khi Gate R chưa đạt, và không làm song song công việc từ tuần 13 trở đi với phần tái cấu trúc còn dở.
- Số tuần trong plan là thứ tự công việc. Nếu Gate R đạt muộn hơn lịch, các tuần sau dịch theo và áp dụng phương án nén lịch ở mục 9. Không cắt chất lượng ground truth hoặc phép đánh giá chính để giữ lịch.
- Mọi milestone kỹ thuật phải hoàn thành chậm nhất ở tuần 23. Tuần 24 không được dùng để hợp thức hóa việc tăng scope.

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

| Mốc                                    | Cuối tuần chính thức | Sản phẩm kiểm tra được                                                                                                        |
| -------------------------------------- | -------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| **P0 — Readiness**                     |                    2 | Hai thành viên sẵn sàng bắt đầu; không có deliverable kỹ thuật bắt buộc.                                                      |
| **M1 — Nền tảng tái lập**              |                    5 | Scope, architecture, contract, repository, Compose và CI đã có baseline.                                                      |
| **M2 — Testbed MVP**                   |                    9 | LMS testbed v1 chạy E2E, có HTTP + async dependency và test tự động.                                                          |
| **R — Testbed v2 đóng băng**           |                   12 | Testbed v2 theo ADR-001 → ADR-006 chạy được từ máy sạch, telemetry xuyên service đủ cho RCA, phạm vi đã thu gọn và đóng băng. |
| **M3 — Workload, fault và dataset v0** |                   15 | Workload mô phỏng hành vi người dùng, 4 case MVP tái lập được, ground truth và dataset v0.                                    |
| **M4 — AI/RCA Integrated MVP**         |                   18 | Một lệnh từ `run_id` ra incident + Top-3 ứng viên nguyên nhân + evidence, kèm các baseline và `base-manual-auto`.             |
| **M5 — Evaluation Freeze**             |                   21 | Campaign chính, RQ1–RQ6, ablation, robustness và error analysis hoàn tất.                                                     |
| **M6 — Planned Final Release**         |                   23 | Source, reproducibility package, báo cáo, slide và demo đã hoàn tất.                                                          |
| **B — Contingency**                    |                   24 | Buffer cho rủi ro; không có feature mới được lên lịch từ trước.                                                               |

---

# 5. Kế hoạch chi tiết 24 tuần

> Tuần 1–10 giữ nguyên nội dung của plan v0.2, mô tả testbed v1 và observability như đã triển khai. Từ tuần 11, topology và phạm vi theo testbed v2.

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

- Submission service ở mức MVP, gọi Course + Enrollment + controllable external storage mock qua HTTP/network;
- contract/integration tests cho HTTP và storage dependency;
- kiểm tra topology sinh ra từ trace có đúng dependency thiết kế.

**Bàn giao**

- luồng `enroll → nộp bài`;
- ít nhất một HTTP contract test;
- storage mock có dependency identity ổn định, điều khiển được latency/error và tạo outbound/dependency span;
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

## Giai đoạn 3 — Hoàn thiện observability (Tuần 10)

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

## Giai đoạn 4 — Tái cấu trúc testbed và phạm vi (Tuần 11–12)

Giai đoạn này đáp ứng góp ý giữa kỳ. Nguyên tắc: **quyết định trước, code sau**. Mọi thay đổi topology, contract, telemetry hoặc phạm vi phải có ADR được chốt trước khi triển khai, theo quy tắc thay đổi topology của service catalogue.

**Tiêu chí thiết kế testbed v2** (dùng để chọn và loại tính năng):

1. Có chuỗi bất đồng bộ nhiều bước (HTTP → command → worker → HTTP) để nguyên nhân và triệu chứng nằm ở các service khác nhau.
2. Có dependency dùng chung giữa nhiều service (xác thực, cơ sở dữ liệu, broker) để một nguyên nhân tạo nhiều triệu chứng cùng lúc.
3. Có cơ chế làm lỗi lộ ra muộn (cache token, lease, poll định kỳ) để triệu chứng cách nguyên nhân về thời gian.
4. Telemetry bao phủ mọi cạnh: span CLIENT và metric `lms_dependency_*` cho mỗi dependency; trace nối được qua RabbitMQ.
5. Không thêm tính năng sản phẩm nào không tạo ra ít nhất một trong các điều kiện trên.

### Tuần 11 — Chốt kiến trúc v2 và dựng nền tảng

**Mục tiêu chung**

- phân tích góp ý giữa kỳ và đánh giá testbed v1 theo các tiêu chí trên;
- chốt ADR và tài liệu kiến trúc v2 trước khi code;
- dựng nền tảng dùng chung và các service đồng bộ lõi.

**Quyết định chốt trước khi code**

- [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md): bộ service mới, Prisma + PostgreSQL 17 (mỗi service một database), command qua RabbitMQ với outbox/inbox, MinIO, SMTP (Mailpit), bỏ Redis, tách observability sang `aiops-platform/`.
- [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md): RCA engine là phần chính của đề tài; đối chứng với truy vết thủ công (RQ6); danh mục case phức tạp có ground truth.
- [ADR-003](../adr/adr-003-remove-admin-service-v1.md): không có service `admin`; admin là tài khoản có role `admin`.
- [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md): service access token ký EdDSA + JWKS; tách bề mặt `/api/v1` và `/internal/v1`.
- Service catalogue v2, HTTP/command contracts v2, data ownership và fault matrix v2.

**A — Backend/Platform primary**

- tách stack observability sang `aiops-platform/observability/` với network `aiops-net`;
- `packages/common`, service template, eslint boundaries, Compose v2 (PostgreSQL 17, RabbitMQ, MinIO, Mailpit), Prisma;
- `gateway` v2 (chuyển tiếp stream, verify JWT cục bộ) và service xác thực với ba role;
- DTO dùng chung, envelope phản hồi và phân trang thống nhất;
- `course` v2 (khóa học, bài học, quiz, ghi danh, tiến độ, làm quiz, export CSV) với hai bề mặt API và service token.

**B — AI/Diagnosis primary**

- đối chiếu các ADR với thiết kế model ban đầu ([analysis blueprint v0](../architecture/analysis-anomaly-rca-blueprint.md), [evaluation protocol v0](../architecture/evaluation-protocol-v0.md)): xác định phần pipeline giữ nguyên và phần phải làm lại theo testbed mới (candidate set, fault, workload, split);
- review `service.name` và dependency identity v2 từ góc nhìn feature và graph;
- xác nhận các cạnh async, xác thực và dùng chung đều có tín hiệu quan sát được.

**Bàn giao**

- ADR-001 → ADR-004;
- service catalogue, contracts, data ownership và fault matrix v2;
- `aiops-platform/observability/` chạy độc lập với LMS;
- `gateway`, service xác thực và `course` v2 có test.

---

### Tuần 12 — Hoàn thiện service bất đồng bộ, thu gọn phạm vi và đóng băng testbed v2

**Mục tiêu chung**

- hoàn thiện các service tạo chuỗi bất đồng bộ;
- rà soát ranh giới service sau khi dựng, gộp chỗ tách không cần thiết;
- thu gọn phạm vi nghiên cứu cho vừa thời gian còn lại;
- kiểm chứng telemetry xuyên service và đóng băng testbed.

**A — Backend/Platform primary**

- `media` + `media-worker`: upload trực tiếp MinIO, thumbnail, usage, tự nhận MIME, avatar;
- `notification` + `notification-worker`: gửi đơn, gửi hàng loạt, email qua SMTP, inbox REST;
- `ai` + `ai-worker`: cổng LLM, tài liệu, job soạn bài và sinh quiz; luồng AI trong `course`;
- `scheduler` + `scheduler-worker`: job dọn media không dùng;
- hoàn thiện API `course` (tách chi tiết khóa học và danh sách bài học);
- seeder dữ liệu quy mô lớn;
- regression W1–W7, Postman v2 và CI theo topology v2;
- smoke telemetry v2 (trace, metric, log, queue), danh mục case phức tạp v0 và schema `RcaIncidentResult`;
- [ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md): gộp `auth` và `student` thành `identity`;
- sửa nhãn telemetry ảnh hưởng tới feature: `operation_name` của client HTTP theo route template thay vì path chứa ID; lỗi publish RabbitMQ dùng identity `<service>-rabbitmq`.

**B — AI/Diagnosis primary**

- [ADR-006](../adr/adr-006-trim-project-scope-v1.md): thu gọn phạm vi và đóng băng LMS (vai trò "hỗ trợ" theo tên đề tài, MCP/agent ngoài phạm vi, ranker học có giám sát là Stretch, thử nghiệm người thật là Target, bộ case MVP C2/C3/C4/C6 với `R = 5`, định nghĩa `base-manual-auto`, loại các tính năng không phục vụ RCA như URL ký cho media);
- plan v0.3;
- rà soát tài liệu v2 cho nhất quán (tên service sau ADR-005, candidate set 10 service/worker, 6 logical DB);
- nghiệm thu Gate R độc lập.

**Bàn giao**

- testbed v2: 7 service + 4 worker, 11 `service.name`;
- ADR-005, ADR-006;
- regression, Postman và smoke observability đạt trên stack sạch;
- tài liệu v2 nhất quán;
- plan v0.3.

**Gate R — Testbed v2 đóng băng.** Chỉ đạt khi đủ cả sáu điều kiện:

1. ADR-001 → ADR-006 có hiệu lực; tài liệu canonical v2 khớp với nhau và với code: không còn tên `auth`/`student` cũ ngoài phần lịch sử; candidate set 10 service/worker; 6 logical DB.
2. LMS đóng băng theo ADR-006; không còn tính năng dở dang trên `main`.
3. CI xanh; regression W1–W7, Postman v2 và smoke tracing/metrics/logs đạt trên stack dựng từ volume sạch.
4. Telemetry: 11/11 runtime có trace, metric, log; trace nối qua RabbitMQ; `operation_name` không chứa ID; lỗi publish RabbitMQ dùng identity `<service>-rabbitmq`.
5. B tự dựng stack từ máy sạch theo README và giải thích được W1–W7; điều kiện này đồng thời đóng phần còn treo của Gate M2.
6. Issue thuộc topology v1 (#44, #50) đã được phân loại hoặc đóng; bảng task refactor đã đóng.

**Đối chiếu với bảng task refactor.** Việc thực hiện tuần 11–12 được theo dõi chi tiết ở [refactor-board-v1](refactor/refactor-board-v1.md):

| Hạng mục trong plan                                      | Mã trên bảng refactor |
| -------------------------------------------------------- | --------------------- |
| Tuần 11: ADR và tài liệu kiến trúc v2                    | R-01                  |
| Tuần 11: tách observability                              | R-02                  |
| Tuần 11: nền tảng dùng chung và Compose v2               | R-03                  |
| Tuần 11: `gateway` và service xác thực                   | R-04                  |
| Tuần 11: DTO, envelope, phân trang                       | R-04b                 |
| Tuần 11: `course` v2, hai bề mặt API, service token      | R-05, R-05b           |
| Tuần 12: `media` + worker                                | R-06 (và PR #71)      |
| Tuần 12: `notification` + worker                         | R-07                  |
| Tuần 12: `ai` + worker                                   | R-08                  |
| Tuần 12: `scheduler` + worker                            | R-09                  |
| Tuần 12: seeder                                          | R-10                  |
| Tuần 12: regression, Postman, CI                         | R-11                  |
| Tuần 12: smoke telemetry, case catalogue, schema kết quả | R-12                  |
| Tuần 12: gộp `identity`                                  | R-13                  |
| Tuần 12: hoàn thiện API `course`                         | PR #70                |
| Tuần 12: thu gọn phạm vi, đóng băng                      | ADR-006 (hủy R-18)    |

---

## Giai đoạn 5 — Workload, fault injection và dataset (Tuần 13–15)

### Tuần 13 — Thiết kế workload theo hành vi người dùng và lớp export telemetry

**Mục tiêu chung**

- thiết kế workload mức 1 + 2 theo gợi ý của giảng viên, có nguồn cho tham số;
- dựng lớp lấy telemetry theo run và cửa sổ thời gian;
- chuẩn bị cơ chế gây lỗi cho 4 case MVP.

**A — Platform/Experiment primary**

- tài liệu thiết kế workload:
  - **User Profile:** student (chăm chỉ, nước rút trước hạn, xem lướt rồi bỏ dở), instructor (soạn bài, upload, dùng AI soạn bài), admin (gửi thông báo hàng loạt); tỉ lệ trong quần thể, mức kiên nhẫn, thời gian có sẵn;
  - **Goal:** ví dụ hoàn thành bài trước hạn, ôn quiz, xem lướt khóa học;
  - **Behavior Model:** máy trạng thái trên các thao tác W1–W7, xác suất chuyển phụ thuộc mục tiêu và trạng thái, thời gian nghỉ theo phân phối log-normal;
  - **System Response → Update User State:** retry có backoff khi 5xx, bỏ ngang khi chờ quá mức kiên nhẫn, đăng nhập lại khi 401;
  - **Nhịp tải:** số phiên bắt đầu theo đường cong trong ngày (nén một ngày còn 30–60 phút chạy), có cao điểm trước hạn quiz;
  - bảng tham số kèm nguồn (tài liệu, dữ liệu hành vi học trực tuyến công khai);
- k6 mức 1: các hành trình W1–W7 làm thao tác cơ bản trên dữ liệu seed;
- LLM stub chỉnh được độ trễ/lỗi chạy trong Compose; proxy chèn trễ trước MinIO và `course-postgres`.

**B — AI/Data primary**

- adapter query/export cho Prometheus, Tempo, Loki theo run và cửa sổ thời gian; truy vấn trace tuần tự và giới hạn số trace vì Tempo bị giới hạn bộ nhớ; export ngay sau run vì retention 24 giờ;
- data dictionary và normalization schema v2;
- data-quality check: coverage 11 runtime, missing modality, cờ `telemetry_silent`.

**Đóng góp chéo**

- B review mô hình hành vi: đủ đa dạng và đủ nhiễu nền cho detector;
- A chạy data-quality check trên một run thử.

**Bàn giao**

- tài liệu thiết kế workload v1;
- k6 mức 1;
- export pipeline và data-quality report trên một run thử;
- LLM stub và proxy chèn trễ trong Compose.

---

### Tuần 14 — Workload mức 2, fault manifest và ground truth

**A — Platform/Experiment primary**

- k6 mức 2: mỗi người dùng ảo giữ trạng thái (profile, goal, token, tiến độ, độ kiên nhẫn, số lỗi) và chọn thao tác tiếp theo theo behavior model; bộ sinh số ngẫu nhiên có seed; ghi nhật ký thao tác thực tế của mỗi run;
- hai profile healthy bắt buộc: normal mixed traffic và healthy high-load spike;
- kiểm chứng traffic sinh ra so với phân phối mục tiêu: tỉ lệ thao tác, độ dài phiên, thời gian nghỉ, đường cong tải;
- fault manifest và cơ chế bật/tắt cho C2 (trễ `course-postgres`), C3 (LLM stub chậm/lỗi), C4 (trễ MinIO), C6 (dừng `identity`, rút ngắn TTL service token).

**B — Diagnosis primary / ground-truth owner**

- `RunGroundTruth` tối thiểu và validation script đối chiếu khoảng fault với telemetry;
- triệu chứng và đường lan dự kiến cho 4 case;
- feature pipeline v0 (cửa sổ 60s, bước 15s, đặc trưng service và edge) trên run thử.

**Bàn giao**

- k6 mức 2 và báo cáo kiểm chứng traffic;
- fault manifest cho 4 case;
- ground-truth schema ổn định;
- feature pipeline v0.

---

### Tuần 15 — Experiment runner, pilot và dataset v0

**A — Experiment primary**

- runner: reset-and-seed → workload → inject → ghi ground truth → export artifact; ledger theo run;
- pilot mỗi case một run cùng run healthy; sửa đến khi chuỗi nhân quả của cả 4 case chạy thật;
- thu tập train healthy (mỗi profile ít nhất một run) và tập validation (lần lặp thứ nhất của mỗi case).

**B — Data/Evaluation primary**

- kiểm label và ground truth; manifest train/validation/test theo run;
- feature pipeline v1 trên dữ liệu pilot, có kiểm tra chống leakage;
- cập nhật evaluation protocol từ kinh nghiệm pilot, chưa đụng tới test.

**Bàn giao**

- 4 case MVP tái lập được;
- healthy runs và fault runs mẫu;
- dataset v0;
- experiment runbook.

**Gate M3:** Hai thành viên đổi case cho nhau và đều chạy, reset, export telemetry và xác nhận ground truth độc lập.

---

## Giai đoạn 6 — Anomaly detection và RCA (Tuần 16–18)

### Tuần 16 — Anomaly baselines và incident detection

**B — AI primary**

- static threshold, robust z-score, Isolation Forest fit trên healthy train;
- fused anomaly score M/T/L, có fallback khi thiếu modality;
- incident lifecycle và `estimated_start_time`.

**A — AI collaborator**

- evaluation harness cho Precision/Recall/F1/FPR/Detection Delay;
- baseline cảnh báo theo ngưỡng cố định, mô phỏng cách vận hành thủ công, làm đối chứng phát hiện cho RQ6;
- kiểm tra báo động giả trên healthy high-load spike.

**Bàn giao**

- detector benchmark trên validation;
- incident record;
- error analysis ban đầu.

---

### Tuần 17 — Dependency graph và RCA baselines

**B — RCA primary**

- dynamic graph từ trace với cạnh sync, async và xác thực;
- Max anomaly, Earliest anomaly, Graph-aware simple.

**A — RCA collaborator**

- `base-manual-auto` theo định nghĩa của ADR-006, kèm đếm số trace/panel phải mở;
- Top-1/Top-3/MRR harness;
- graph validation với service catalogue.

**Bàn giao**

- graph artifact;
- kết quả RCA baseline trên validation;
- Top-K harness.

---

### Tuần 18 — Proposed ranker, evidence và pipeline một lệnh

**B — AI/RCA primary**

- proposed ranker "Hướng 1" (A/T/P/E/V), hiệu chỉnh trọng số và ngưỡng trên validation;
- evidence aggregation, output `RcaIncidentResult`, verdict `insufficient_evidence`.

**A — Integration/Platform primary**

- CLI một lệnh từ `run_id` → telemetry → incident → Top-3 + evidence;
- lưu artifact; xử lý thiếu telemetry;
- demo script.

**Bàn giao**

- **AI/RCA Integrated MVP**;
- demo end-to-end trên 4 case;
- pilot report ghi cả case thành công lẫn thất bại.

**Gate M4:** A chạy case do B chọn và B chạy case do A chọn; kết quả được so với ground truth, ghi rõ case thành công và thất bại.

---

## Giai đoạn 7 — Campaign và đánh giá (Tuần 19–21)

### Tuần 19 — Freeze protocol và campaign chính

**Công việc chung**

- freeze protocol, config detector/RCA, seed workload, cường độ và thời lượng fault;
- test set không dùng để tune; chỉ sửa bug implementation rõ ràng.

**A — Experiment primary**

- final test: 4 case × 4 run (lần lặp 2–5) cùng healthy final (normal mixed, high-load spike) với seed chưa dùng;
- ledger; rerun run invalid và ghi lý do.

**B — Evaluation primary**

- chạy pipeline trên toàn bộ run; tính metric;
- sanity check ground truth, data quality và leakage.

**Bàn giao**

- protocol frozen;
- campaign chính;
- experiment ledger.

---

### Tuần 20 — Đánh giá RQ1–RQ6, ablation và robustness

**B — Evaluation/Analysis primary**

- RQ1: modality M, M+T, M+T+L;
- RQ2: có/không graph; RQ3: có/không temporal;
- RQ4: drop 50% trace theo nguyên trace, seed cố định;
- RQ5: trade-off chất lượng, runtime, độ phức tạp, khả năng giải thích.

**A — Experiment/Systems primary**

- RQ6, mỗi phép so sánh báo cáo theo từng case:
  - phát hiện: detector ML so với cảnh báo ngưỡng cố định (độ trễ phát hiện, báo động giả mỗi giờ);
  - khoanh vùng: RCA engine so với `base-manual-auto` và Max anomaly (Top-1, Top-3, MRR);
  - chi phí chẩn đoán: thời gian tới kết luận đúng, số trace/panel phải mở;
  - độ ổn định giữa các lần lặp;
- runtime/resource benchmark.

**Bàn giao**

- bảng kết quả chính, plots;
- ablation và robustness result.

---

### Tuần 21 — Error analysis, kết luận và đóng băng kết quả

**Công việc chung**

- error analysis theo case; findings và limitations;
- Target nếu còn thời gian: thử nghiệm người thật 2–3 người (minh họa định tính); thêm case C1, C5, C7.

**Gate M5:** Kết quả đủ trả lời RQ1–RQ6 mà không cần thêm tính năng mới.

---

## Giai đoạn 8 — Freeze và planned final release (Tuần 22–23)

Báo cáo phải được viết **tích lũy từ các tuần trước**. Tuần 22–23 dùng để hợp nhất và hoàn thiện, không phải bắt đầu viết từ đầu.

### Tuần 22 — Freeze hệ thống và hợp nhất báo cáo

**A — System/reproducibility lead**

- freeze code/config;
- clean-machine setup;
- demo script;
- tài liệu kiến trúc, observability, workload, experiment;
- recording demo dự phòng.

**B — Evaluation/report lead**

- freeze figures/tables;
- chương phương pháp AI/RCA;
- chương thực nghiệm, kết quả, limitation;
- kiểm tra citation và tính nhất quán số liệu.

### Tuần 23 — Planned Final Release

**Công việc chung**

- review chéo toàn bộ báo cáo;
- slide, rehearsal, Q&A;
- tag final planned release.

**Bàn giao**

- **Planned Final Release v1.0**;
- source + Compose/config;
- dataset/experiment manifest;
- reproducibility/runbook;
- báo cáo, slide, demo script/recording;
- final results package.

**Gate M6:** Một thành viên thực hiện fresh setup và demo theo tài liệu; thành viên còn lại đóng vai hội đồng kiểm tra claim, số liệu và reproducibility.

---

## Giai đoạn 9 — Buffer / contingency (Tuần 24)

Tuần này **cố ý không có feature hoặc milestone kỹ thuật mới**.

Mục đích:

- hấp thụ chậm tiến độ;
- sửa lỗi nghiêm trọng phát hiện muộn;
- chạy lại experiment invalid;
- xử lý sự cố demo hoặc packaging;
- backup báo cáo, dữ liệu, source;
- điều chỉnh nhỏ theo phản hồi cuối nếu bắt buộc.

**Không lên kế hoạch trước cho:** service mới, model mới, case/fault mới, refactor lớn, Kubernetes/Chaos Mesh hoặc extension khác.

---

# 6. Chiến lược viết báo cáo song song

| Thời điểm  | Nội dung nên được viết/freeze dần                                        |
| ---------- | ------------------------------------------------------------------------ |
| Tuần 3–5   | Scope, research questions, architecture, technology choices              |
| Tuần 6–12  | Testbed (lý do chuyển từ v1 sang v2), observability                      |
| Tuần 13–15 | Workload theo hành vi người dùng, fault injection, ground truth, dataset |
| Tuần 16–18 | Data pipeline, anomaly detection, RCA methodology, đối chứng thủ công    |
| Tuần 19–21 | Experimental protocol, results, ablation, limitations                    |
| Tuần 22–23 | Hợp nhất, chỉnh sửa, kiểm tra consistency, slide và defense              |

---

# 7. Backlog tối thiểu phải bảo vệ

Các hạng mục sau là **MVP bắt buộc** trước khi xem xét extension:

- [ ] Testbed v2 gồm 7 service + 4 worker theo service catalogue v2, đã đóng băng (Gate R).
- [ ] Có HTTP đồng bộ, command qua RabbitMQ, dependency dùng chung (xác thực, PostgreSQL, broker).
- [ ] Metrics, traces và structured logs có correlation; trace nối qua RabbitMQ.
- [ ] Workload mô phỏng hành vi người dùng mức 1 + 2, có nguồn tham số và kiểm chứng phân phối.
- [ ] Có reset script, fault manifest và ground truth cho 4 case MVP (C2, C3, C4, C6).
- [ ] Có statistical baseline và Isolation Forest hoặc detector unsupervised tương đương.
- [ ] Có incident detection với `estimated_start_time`.
- [ ] Có dynamic dependency graph từ traces, gồm cạnh async và cạnh xác thực.
- [ ] Có các RCA baseline, `base-manual-auto` và proposed ranker có evidence.
- [ ] Metric RCA chính dùng candidate set service-level (10 service/worker); component/dependency chỉ là evidence.
- [ ] Có evaluation lặp lại tối thiểu `4 case × 5 run` cùng healthy runs.
- [ ] Có modality/graph/temporal ablation và đối chứng thủ công (RQ6).
- [ ] Có ít nhất một robustness evaluation (trace drop hoặc thiếu modality).
- [ ] Có limitation, error analysis và hướng dẫn reproducibility.

Extension chỉ được xem xét khi **M4 đã qua gate** và không đe dọa M5/M6:

- thử nghiệm người thật quy mô lớn hơn;
- case C1, C5, C7; cạnh shared-resource;
- ranker học có giám sát;
- change-point hoặc log-template model nâng cao;
- expanded robustness matrix;
- Kubernetes/Chaos Mesh, causal discovery, nhiều fault đồng thời;
- MCP/agent hoặc tính năng LMS mới (ngoài phạm vi theo ADR-006).

---

# 8. Quy tắc chống scope creep và rủi ro

| Rủi ro                                 | Dấu hiệu sớm                                                   | Quy tắc xử lý                                                                                           |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tái cấu trúc kéo dài                   | Hết tuần 12 vẫn còn tính năng LMS dở dang                      | Đóng băng theo ADR-006; revert phần dở thay vì làm tiếp; Gate R là cổng cứng.                           |
| Workload không giống người dùng thật   | Tham số không có nguồn; phân phối sinh ra lệch mục tiêu        | Mọi tham số phải có nguồn; báo cáo độ khớp phân phối; không dùng mức 3 làm phần chính.                  |
| Fault không tái lập                    | Cùng manifest cho triệu chứng khác biệt lớn                    | Cố định seed workload và config; reset từ volume sạch; lưu manifest từng run.                           |
| Chuỗi nhân quả của case không xảy ra   | Pilot không thấy triệu chứng dự kiến                           | Sửa mô tả case hoặc loại và ghi lý do vào ledger; không âm thầm bỏ.                                     |
| Telemetry mất vì giới hạn stack        | Tempo OOM khi truy vấn hàng loạt; dữ liệu quá retention 24 giờ | Export ngay sau run; truy vấn tuần tự; lưu artifact ngoài stack.                                        |
| Máy không đủ tài nguyên                | Stack 11 runtime + observability chiếm 3,5–5 GB RAM            | Chạy từng run; không chạy test/build song song với campaign; đặt giới hạn bộ nhớ container nếu cần.     |
| AI không vượt baseline thủ công        | `base-manual-auto` gần ngang RCA engine                        | Báo cáo trung thực theo từng case; tập trung vào phát hiện, chi phí chẩn đoán và độ ổn định dưới nhiễu. |
| Data leakage                           | Window của cùng run xuất hiện ở train và test                  | Split theo run; test manifest freeze trước campaign chính.                                              |
| Evaluation bị thiết kế theo model      | Protocol thay đổi sau khi xem test result                      | Freeze protocol ở tuần 19; test set không dùng để tune.                                                 |
| Thiếu thời gian báo cáo                | Tuần 21 mới bắt đầu viết                                       | Viết dần theo mục 6; tuần 22–23 chỉ hợp nhất.                                                           |
| Tuần buffer bị biến thành feature time | Tuần 23 vẫn còn danh sách extension                            | Cắt extension; tuần 24 chỉ contingency.                                                                 |

---

# 9. Phương án nén lịch khi Gate R đạt muộn

Nếu Gate R đạt muộn và thời gian còn lại không đủ 11 tuần cho tuần 13–23, áp dụng theo thứ tự, dừng ngay khi đủ:

1. Bỏ toàn bộ Target (thử nghiệm người thật, case C1/C5/C7).
2. Gộp tuần 13 và 14 của mảng workload: làm mức 1 và mức 2 trong một tuần, chỉ giữ hai profile healthy bắt buộc.
3. Giảm `R` từ 5 xuống 4 (1 validation + 3 test); ghi rõ trong báo cáo.
4. Gộp tuần 20 và 21: chỉ giữ RQ1, RQ2, RQ6 và một robustness result; RQ3–RQ5 báo cáo ở mức tối thiểu.
5. Bỏ C3 nếu LLM stub chưa ổn định sau tuần 14; còn 3 case MVP.
6. Dùng tuần 24.

Không được cắt: Gate R, ground truth, split chống leakage, đối chứng với `base-manual-auto`.

---

# 10. Tham chiếu kiến trúc triển khai

- Testbed v2: [`backend-microservice-testbed-blueprint-v2`](../architecture/backend-microservice-testbed-blueprint-v2.md), [`service-catalogue-and-topology-v2`](../architecture/service-catalogue-and-topology-v2.md), [`http-and-event-contracts-v2`](../architecture/http-and-event-contracts-v2.md), [`data-ownership-and-fault-matrix-v2`](../architecture/data-ownership-and-fault-matrix-v2.md).
- RCA engine: [`analysis-anomaly-rca-blueprint-v1`](../architecture/analysis-anomaly-rca-blueprint-v1.md).
- Đánh giá: [`evaluation-protocol-v1`](../architecture/evaluation-protocol-v1.md), [`research-questions-and-metrics-v2`](../direction/research-questions-and-metrics-v2.md), [`complex-case-catalogue-and-rca-result-v0`](../architecture/complex-case-catalogue-and-rca-result-v0.md).
- Workload, fault, runner, RCA engine và evaluation đặt trong `aiops-platform/` (`load/`, `faults/`, `training/`, `evaluation/`); LMS không import mã từ đây.

---

# 11. Quy tắc review để bảo đảm cross-ownership

- Không merge module quan trọng nếu chưa có review của thành viên còn lại.
- PR phải ghi: mục tiêu, cách chạy, test, telemetry/experiment impact và rollback nếu có.
- API/command/telemetry/ground-truth schema thay đổi phải cập nhật contract/data dictionary/ADR tương ứng.
- Backend-primary không được tự merge toàn bộ `services/` mà không có AI-primary chạy E2E và kiểm tra telemetry.
- AI-primary không được tự freeze detector/RCA mà không có backend-primary chạy evaluation harness và xác nhận reproducibility.
- Demo luân phiên người thực hiện; người demo không nhất thiết là người code chính.
- Mỗi thành viên phải có ít nhất một đóng góp implementation thực tế ở cả **backend/platform** và **AI/RCA** trước khi kết thúc M4.

---

# 12. Cách cập nhật kế hoạch

Không sửa lịch sử của baseline cũ. Lưu mỗi lần điều chỉnh như một phiên bản mới:

```text
docs/processed/plan/
├── plan-v0.1-20-weeks.md
├── plan-v0.2-24-weeks.md
└── plan-v0.3-24-weeks.md
```

Mỗi lần điều chỉnh tiếp theo cần ghi: ngày cập nhật; lý do; tuần/milestone bị ảnh hưởng; scope thêm/bỏ; tác động tới experiment/reproducibility; có tiêu tốn buffer tuần 24 hay không.

> Nguyên tắc cuối cùng: **Gate R phải đạt trước khi làm tiếp. Tuần 13–23 phải đủ để hoàn thành đồ án ở trạng thái có thể bảo vệ; tuần 24 giúp nhóm chịu được rủi ro, không phải để hợp thức hóa một kế hoạch vốn đã quá tải.**
