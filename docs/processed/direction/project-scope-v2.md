# Project scope v2 — MVP, Target, Stretch và Out-of-scope

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review). Các con số hoặc lựa chọn chưa có nguồn xác nhận được ghi rõ là "đề xuất chờ Đức xác nhận" và gom lại ở mục 10.
>
> **Thay thế:** [project-scope-v1](project-scope-v1.md) (giữ làm lịch sử, không dùng cho phạm vi và dataset mới). Bản v1 gắn với topology 6 business service + Gateway và vai trò "AI hỗ trợ".
>
> **Phụ thuộc:**
>
> - Quyết định nền: [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md) (bộ service mới), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md) (AI là bên truy vết chính; MCP thứ yếu), [ADR-003](../adr/adr-003-remove-admin-service-v1.md) (bỏ `admin`), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md) (service access token, tách `/api/v1` và `/internal/v1`).
> - Topology và dữ liệu: [service-catalogue-and-topology-v2](../architecture/service-catalogue-and-topology-v2.md), [data-ownership-and-fault-matrix-v2](../architecture/data-ownership-and-fault-matrix-v2.md), [complex-case-catalogue-and-rca-result-v0](../architecture/complex-case-catalogue-and-rca-result-v0.md), [`aiops-platform/README.md`](../../../aiops-platform/README.md).
> - Định hướng và đo lường: [khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1](khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1.md), [research-questions-and-metrics-v2](research-questions-and-metrics-v2.md).
> - Tài liệu đang được viết lại song song (link theo tên đích): [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md), [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md), [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md).
> - WHEN/WHO: [plan-v0.2-24-weeks](../plan/plan-v0.2-24-weeks.md). Plan này chưa được cập nhật theo refactor (ADR-002 yêu cầu sửa plan; chưa có bản mới tại thời điểm viết), nên mọi thứ liên quan lịch trong tài liệu này chỉ là tham chiếu.
> - Backend: [backend-microservice-testbed-blueprint-v2](../architecture/backend-microservice-testbed-blueprint-v2.md) (thay [backend_microservice_testbed_blueprint](../architecture/backend_microservice_testbed_blueprint.md) còn mô tả topology v1). Khi mâu thuẫn, ưu tiên theo thứ tự ADR → service-catalogue v2 → http-and-event-contracts v2 và data-ownership v2 → blueprint.

## 1. Mục tiêu của scope v2

Đồ án xây dựng một **LMS microservice testbed có kiểm soát** để tạo workload, fault propagation và observability telemetry; sau đó dùng **RCA engine** (pipeline Analysis/AI/RCA, phần chính của đề tài) để phát hiện incident, xếp hạng **root-cause candidates ở service-level** và đánh giá định lượng bằng ground truth từ controlled fault injection. Khác v1, đề tài còn phải chứng minh RCA engine tìm được nguyên nhân gốc của các **case phức tạp** mà truy vết thủ công khó tìm ra, và đo thời gian chẩn đoán của AI so với thủ công (ADR-002).

LMS là **System Under Test (SUT)**, không phải sản phẩm chính. Tên "RCA engine" dùng để chỉ hệ thống truy vết của đề tài, tránh nhầm với service `ai` của LMS (cổng LLM soạn bài và sinh quiz, chỉ là một thành phần của SUT).

Một hạng mục chỉ thuộc MVP khi nó đóng góp trực tiếp cho ít nhất một trong các mục tiêu sau:

1. tạo dependency có ý nghĩa, gồm dependency dùng chung và chuỗi bất đồng bộ để nguyên nhân gốc nằm ngoài đường request của triệu chứng;
2. tạo fault/fault propagation có thể kiểm soát;
3. tạo hoặc cải thiện telemetry cần cho anomaly/RCA;
4. tạo ground truth và provenance có thể tái lập;
5. phục vụ trực tiếp research question hoặc evaluation, gồm cả đối chứng thủ công;
6. bảo đảm pipeline có thể chạy lại và kiểm chứng được.

Số lượng CRUD, độ đầy đủ nghiệp vụ LMS, mức độ production-grade hoặc độ phức tạp hạ tầng **không phải tiêu chí mở rộng MVP**. Topology v2 lớn hơn v1 (ADR-001) vì cần đủ phức tạp để tồn tại case mà truy vết thủ công khó thấy; sau topology v2, không thêm service hoặc nghiệp vụ nếu không có ADR.

---

## 2. Quy tắc phân tầng scope

| Tầng | Ý nghĩa | Quy tắc |
| --- | --- | --- |
| **MVP** | Bắt buộc để đạt mục tiêu nghiên cứu và các milestone chính | Nằm trên critical path |
| **Thứ yếu (ADR-002)** | MCP server chỉ đọc và agent đọc kết quả RCA để viết báo cáo | Làm **sau** khi RCA engine và phần đánh giá đạt; không phải điều kiện hoàn thành đề tài |
| **Target** | Có giá trị nếu MVP đã ổn định và còn đủ nguồn lực | Không được làm chậm critical path |
| **Stretch** | Nâng cao, chỉ xem xét khi toàn bộ MVP/evaluation đã an toàn | Không lên lịch như điều kiện hoàn thành |
| **Out-of-scope** | Không phục vụ đủ trực tiếp cho mục tiêu hoặc có chi phí/rủi ro vượt phạm vi | Không triển khai trong MVP |

Thay đổi service boundary, `service.name`, dependency identity, telemetry schema, experiment manifest hoặc RCA granularity phải đi qua ADR và cập nhật tài liệu canonical tương ứng; không tạo convention cạnh tranh trong scope này (quy tắc thay đổi topology: mục 11 của service-catalogue v2).

---

# 3. Phạm vi MVP bắt buộc

## 3.1. Testbed topology và workflow

MVP dùng topology canonical **7 service + 4 worker** (11 `service.name`). Worker là process riêng, cùng image với service tương ứng, entrypoint `worker.ts`, có `service.name` riêng; Analysis nhờ đó phân biệt được nguồn triệu chứng.

```text
service:  gateway  identity  course  media  notification  scheduler  ai
worker:   media-worker  notification-worker  scheduler-worker  ai-worker
```

Dependency canonical (rút gọn; bản đầy đủ và danh mục edge `e01–e29` ở [service-catalogue-and-topology-v2](../architecture/service-catalogue-and-topology-v2.md)):

```text
HTTP đồng bộ
gateway ──> identity | course | media | notification | scheduler | ai
course ──> media | ai               (usage/tệp đính kèm; tài liệu và job AI)
ai-worker ──> course | media        (đóng vòng course -> ai -> course, bất đồng bộ qua job)
media ──> identity                  (kiểm tra actor)
notification-worker ──> identity    (snapshot recipient)
scheduler-worker ──> media          (cleanup media không dùng)
mọi service ──> identity            (service token và JWKS, ADR-004)

Command bất đồng bộ qua RabbitMQ (outbox/inbox)
course | media | notification ──> media-worker
notification ──> notification-worker (và tự enqueue lại)
ai | media ──> ai-worker

Hạ tầng
<service> ──> <service>-postgres    (6 logical DB)
media, media-worker ──> media-minio
notification-worker ──> notification-smtp
ai, ai-worker ──> ai-llm-provider
```

Đặc điểm topology v2 phục vụ trực tiếp RCA:

- Worker dùng chung DB với service owner nhưng khác `service.name`; backlog queue thuộc worker tiêu thụ, không thuộc bên gửi.
- Có vòng phụ thuộc `course -> ai -> course` (bất đồng bộ qua job) và các chuỗi async dài; W5 chạm 5 service/worker.
- Mọi cạnh đều xác thực bằng service access token (ADR-004), nên `identity` là điểm lỗi chung có chủ đích: lỗi xuất hiện sau khoảng yên lặng (token còn hạn) và ở cạnh `<caller>-identity-token`, không ở service lỗi.
- Candidate set RCA mặc định gồm 10 service/worker (mọi `service.name` trừ `gateway`); `gateway` là symptom mặc định và chỉ là candidate khi evaluation protocol có gateway fault. Hạ tầng (PostgreSQL, RabbitMQ, MinIO, SMTP, LLM provider) là component/dependency evidence, không vào candidate set service-level.

### Workflow bắt buộc

| ID | Workflow | Giá trị nghiên cứu |
| --- | --- | --- |
| W1 | Đăng ký và đăng nhập: `Client -> gateway -> identity -> identity-postgres`; đăng ký: một transaction tạo tài khoản và hồ sơ | Flow xác thực tối thiểu; nền cho FG/FH vì mọi service phụ thuộc token do `identity` phát |
| W2 | Soạn nội dung khóa học: `gateway -> course -> course-postgres`; markdown có media: `course => media-worker` (command) | Database dependency và async usage sync |
| W3 | Ghi danh và học: `gateway -> course` (enroll, tiến độ, quiz attempt) | Tải DB chính của `course`; nền cho FC |
| W4 | Upload media: `gateway -> media -> media-minio`; `media => media-worker` tạo thumbnail | Storage dependency thật (MinIO) và async; nền cho FA |
| W5 | Thông báo batch và email: `gateway -> notification => notification-worker` (snapshot từ `identity`, dispatch, SMTP) `=> media-worker` (usage) | Chuỗi dài nhất; nền cho FB, FE |
| W6 | AI soạn bài và sinh quiz: `gateway -> course -> ai => ai-worker` (provider, `course`, `media`) | Vòng phụ thuộc và dependency provider; nền cho FD |
| W7 | Dọn media không dùng: `scheduler-worker -> media -> media-minio` | Tác động trễ nhiều bước; nền cho C4 |

### Ranh giới nghiệp vụ

| Thành phần | Scope MVP tối thiểu | Không mở rộng thành |
| --- | --- | --- |
| `gateway` | Route theo prefix, verify JWT người dùng bằng JWKS, gắn service token khi proxy, propagate trace, chuẩn hóa lỗi | API management/enterprise gateway |
| `identity` | Đăng ký/đăng nhập/refresh, token EdDSA (user và service), JWKS, 3 role (`student`, `instructor`, `admin`), registry client dịch vụ, hồ sơ và danh sách student | IAM/SSO production-grade, CRM/quản lý học viên đầy đủ |
| `course` | Course, lesson, quiz, enrollment, tiến độ, quiz attempt, export CSV, facade mỏng cho luồng AI | Sản phẩm quản lý khóa học đầy đủ |
| `media` (+ `media-worker`) | Upload, library, usage, thumbnail, jobs, thống kê; object trong MinIO | Sản phẩm object-storage/CDN |
| `notification` (+ `notification-worker`) | Thông báo đơn, batch, inbox student; gửi email qua SMTP (Mailpit khi dev/CI) | Hệ thống email/SMS/push production |
| `scheduler` (+ `scheduler-worker`) | Quản lý job và lịch sử run; job `MEDIA_UNUSED_CLEANUP` theo cron/tay | Nền tảng job tổng quát |
| `ai` (+ `ai-worker`) | Provider/model/binding, API key mã hóa, completion, trích văn bản tài liệu, job AI soạn bài/sinh quiz; chỉ là thành phần của SUT | AI tutor, recommendation, chấm điểm tự động; nhầm với RCA engine |

**Lý do MVP:** topology này đủ tạo dependency HTTP, database, object storage, SMTP, nhà cung cấp LLM, xác thực và nhiều kênh command bất đồng bộ dùng chung hạ tầng, để quan sát fault propagation "triệu chứng ở một nơi, nguyên nhân ở nơi khác" mà không tăng LMS scope ngoài ADR-001.

---

## 3.2. Hạ tầng và dependency bắt buộc

| Hạng mục MVP | Vai trò trong nghiên cứu |
| --- | --- |
| PostgreSQL 17 (6 logical DB, mỗi service một DB và role riêng) | Persistence theo service và database dependency telemetry; nền cho FC, FE, FG |
| RabbitMQ (command qua exchange `lms.commands`, outbox/inbox) | Async dependency dùng chung giữa nhiều worker; nền cho FB |
| MinIO (S3 tương thích, thuộc `media`) | Object storage thật thay Storage Mock; nền cho FA |
| SMTP (Mailpit khi dev/CI) | Dependency của `notification-worker`; làm chậm dispatch trong FB |
| Nhà cung cấp LLM (OpenAI-compatible; HTTP stub khi test) | Dependency ngoài của `ai`/`ai-worker`; nền cho FD |
| Docker Compose | Runtime tái lập (`compose.full.yaml` ghép LMS và `aiops-platform`) |
| k6 | Workload tự động và healthy/high-load controls. **Chưa triển khai**: thư mục `load/` chưa tạo (mảng AI) |

Không còn Redis, Storage Mock in-process/mock HTTP, event `grade.completed`. Hạ tầng phải có identity ổn định (`<service.name bên dùng>-<hạ tầng>`) và tạo được dependency span để làm evidence; fake adapter in-process không đạt mục tiêu fault propagation/RCA.

---

## 3.3. Observability bắt buộc

Stack MVP (nằm ở `aiops-platform/observability/`, tách khỏi LMS; LMS chỉ gửi OTLP/HTTP tới Collector):

```text
OpenTelemetry
-> OTel Collector
-> Prometheus (metrics)
-> Tempo (traces)
-> Loki (structured logs)
-> Grafana (raw telemetry inspection)
```

Telemetry tối thiểu phải hỗ trợ:

- `service.name` (12 giá trị canonical), `service.version`, `service.instance.id`;
- timestamp UTC, ISO-8601 tại boundary/artifact;
- trace context qua HTTP và qua RabbitMQ (`traceparent` trong envelope command, relay outbox phát lại đúng context);
- RED metrics cho HTTP; CPU/RSS theo process;
- dependency metrics/spans theo `dependency_identity` cho PostgreSQL, MinIO, SMTP, nhà cung cấp LLM, outbound HTTP (gồm cạnh `<caller>-identity-token` và `<caller>-identity-jwks`) và RabbitMQ khi boundary tồn tại; metric broker (độ sâu queue, consumer) lấy từ RabbitMQ;
- structured logs có `trace_id`/`span_id` trong request/message context và log lỗi dependency (`dependency.failure`);
- error status, HTTP status/error type, dependency identity và timeout semantics;
- correlation từ metric symptom -> trace/span -> log evidence.

Controlled baseline dùng **100% trace sampling**. Robustness MVP được phép tạo degraded telemetry từ artifact baseline; không yêu cầu live low-sampling campaign.

**Tín hiệu chưa có (giới hạn trung thực).** Theo [complex-case-catalogue mục 1.5](../architecture/complex-case-catalogue-and-rca-result-v0.md), testbed hiện thiếu: độ sử dụng pool kết nối PostgreSQL; tuổi message cũ nhất trong queue; metric publish/consume RabbitMQ ở runtime (chỉ có span và metric broker); độ trễ outbox; log khi worker xử lý command; nối trace `scheduler -> scheduler-worker`. Hệ quả: một số case chỉ phân biệt được gián tiếp (ví dụ C2 không tách "pool cạn" khỏi "DB chậm"). Việc có bổ sung các tín hiệu này trước khi thu dataset hay không do Đức quyết định (mục 10); mỗi tín hiệu bổ sung là thay đổi telemetry cần cập nhật schema. Telemetry thiếu phải được biểu diễn rõ (coverage, missingness), không điền `0`.

**Lý do MVP:** RQ1–RQ4 cần telemetry đa nguồn, dependency graph, temporal evidence và missingness/coverage có thể kiểm soát; RQ6 cần bằng chứng đủ để so sánh với truy vết thủ công trên cùng dữ liệu.

---

## 3.4. Workload, fault injection, case phức tạp và ground truth

### Workload MVP

Tối thiểu phải có:

- normal mixed traffic;
- healthy high-load spike để đo false positive/workload shift;
- workflow traffic đủ kích hoạt W1–W7;
- workload chạy song song với mọi case phức tạp để tạo nhiễu nền (ma trận fault v2, mục 6);
- workload profile, seed, rate/stage và duration có thể truy vết.

`load/` chỉ tạo traffic; không inject fault và không tính evaluation metric. Tên profile cụ thể chốt ở [evaluation-protocol-v1](../architecture/evaluation-protocol-v1.md). Dữ liệu seed quy mô lớn (R-10) ghi trực tiếp bằng SQL nên không có trace, log hay outbox cho các dòng seed; seed có kiểm soát là điều kiện nền cho case C1 (batch thông báo lớn).

### Tám fault canonical và bảy case phức tạp

Fault là **cơ chế gây lỗi** (bật/tắt được, tái lập được, không sửa code nghiệp vụ); case là **kịch bản + chuỗi nhân quả + ground truth** dùng để đánh giá. Nguồn: [data-ownership-and-fault-matrix-v2 mục 5–6](../architecture/data-ownership-and-fault-matrix-v2.md) và [complex-case-catalogue](../architecture/complex-case-catalogue-and-rca-result-v0.md) (chi tiết kịch bản, tín hiệu xác nhận).

| Fault | Loại | `root_cause_service` | Component/evidence | Case | Trạng thái kiểm chứng (29/10/2026) |
| --- | --- | --- | --- | --- | --- |
| FA | Độ trễ dependency | `media` / `media-worker` | `media-minio` | C4 | Đã đo tín hiệu; cơ chế chèn trễ chưa chạy |
| FB | Backlog hàng đợi | `notification-worker` | `notification-worker-rabbitmq` (queue) | C1 | Đã đo tín hiệu (backlog tăng/drain); chuỗi lan sang `media-worker` là **giả thuyết** |
| FC | Giữ kết nối DB | `course` | `course-postgres` | C2 | Đã đo tín hiệu; metric pool chưa có |
| FD | Độ trễ nhà cung cấp | `ai` (process chạm provider là `ai-worker`) | `ai-llm-provider` | C3 | Đã đo tín hiệu; stub chậm chưa chạy |
| FE | Độ trễ dependency nhỏ | `identity` | `identity-postgres` | C5 | Đã đo tín hiệu; chèn trễ chưa chạy |
| FF | Quá tải tài nguyên | bất kỳ service | instance | không có case riêng | Tín hiệu CPU/RSS có thật; dùng làm bằng chứng phụ cho C1–C2 |
| FG | Độ trễ/ngắt xác thực (ADR-004) | `identity` | `identity` | C6 | **Đã chạy** (`tracing-smoke`): lỗi `gateway-identity-token` xuất hiện 72 giây sau khi dừng `identity` (TTL 60 giây) |
| FH | Lệch khóa ký (ADR-004) | `identity` | `identity-jwks` | C7 | Đã đo tín hiệu; cơ chế đổi khóa chưa chạy |

Quy tắc dùng case làm dữ liệu đánh giá:

- Một case chỉ vào tập đánh giá khi chuỗi nhân quả đã **chạy thật** và có ground truth theo `RunGroundTruth`. Trạng thái "đã đo tín hiệu" chưa đủ; việc chạy thật C1–C5, C7 thuộc mảng AI (`aiops-platform/faults/`, `load/`, chưa tạo).
- Case không tái lập được chuỗi nhân quả mô tả thì phải sửa mô tả hoặc loại và ghi lý do vào ledger, không âm thầm bỏ.
- Fault mechanism phải mặc định tắt, deterministic/reproducible khi có seed/config, có start/end rõ và không sửa business rule chỉ để tạo fault.
- Tiêu chí case phức tạp (ADR-002): nguyên nhân gốc nằm ngoài đường request của triệu chứng, đi qua dependency dùng chung hoặc tầng async; một người đọc dashboard/trace theo đường request không thấy nguyên nhân.

**Evaluation floor (đề xuất chờ Đức xác nhận).** v1 dùng `5 scenarios × 3 repetitions = 15 controlled fault runs`. Theo [evaluation-protocol-v1 mục 5.3](../architecture/evaluation-protocol-v1.md), floor v2 là `K × R` với `K` là số case đủ điều kiện vào campaign (C1–C7; FF không có case riêng) và `R` là số repetition mỗi case; đề xuất `R = 3` thừa kế v1 (1 run cho validation, phần còn lại cho final test). Nếu đủ bảy case thì `7 × 3 = 21` controlled fault runs; hiện trạng chỉ có C6 chạy thật nên chưa có con số cố định. Các số này là hệ quả số học của đề xuất, chưa phải quyết định, và `K` tối thiểu để kết luận chưa chốt. Healthy runs (normal traffic và healthy high-load spike) vẫn bắt buộc để đo false positive/workload shift; split và số healthy run chốt ở evaluation-protocol-v1. Mọi báo cáo phải ghi `K`, danh sách case và `R` thực tế.

**Owner và process.** Với FA và FD, service sở hữu nguyên nhân (`media`, `ai`) có thể khác process quan sát thấy triệu chứng (`media-worker`, `ai-worker`). Theo evaluation-protocol-v1 mục 4.2, primary metric chấm đúng `root_cause_service` của `RunGroundTruth`, kèm owner-level Top-K (gộp `X` và `X-worker`) làm diagnostic phụ; đề xuất chờ Đức xác nhận.

### Ground truth và provenance

Mỗi run phải truy ngược tối thiểu được (định nghĩa field ở [telemetry-and-ground-truth-schema-v1](../architecture/telemetry-and-ground-truth-schema-v1.md)):

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

`fault_type` dùng các nhãn của catalogue (ví dụ `queue_backlog`, `db_connection_hold`, `dependency_latency`, `dependency_unavailable`, `config_drift`). Ground truth không nằm trong payload nghiệp vụ hay telemetry; kết quả RCA liên kết với ground truth theo `run_id` khi đánh giá offline. Run lỗi hoặc vi phạm data-quality gate phải được ghi nhận `invalid`/`partial` hoặc rerun; không âm thầm loại khỏi ledger.

---

## 3.5. RCA engine (Analysis/AI/RCA) bắt buộc

**Vai trò (thay đổi so với v1).** RCA engine là bên **truy vết chính**, không phải công cụ hỗ trợ: bước kết luận (xếp hạng nguyên nhân) không cần người can thiệp. Phần chính của đề tài là **huấn luyện và đánh giá mô hình (ML + dependency graph)** trên dataset từ fault injection (ADR-002). Mã module huấn luyện đặt ở `aiops-platform/training/` (chưa tạo); LMS không import mã từ đây.

Pipeline chạy **out-of-band** bằng Python (CLI), không nằm trên business request path:

```text
telemetry ingestion
-> validation + time alignment
-> feature engineering
-> anomaly scoring
-> incident detection
-> dynamic dependency graph
-> service-level RCA ranking
-> evidence + timeline
-> RcaIncidentResult
-> quantitative evaluation
```

Cấu trúc module và mô hình cụ thể thuộc [analysis-anomaly-rca-blueprint-v1](../architecture/analysis-anomaly-rca-blueprint-v1.md); scope này chỉ yêu cầu những điều sau.

### Telemetry/data quality

Bắt buộc:

- metrics + traces + structured logs;
- service/time-window alignment trên 11 `service.name`;
- missing modality semantics rõ ràng; data-quality report; telemetry quan sát được nhưng chưa có (mục 3.3) phải thể hiện trong coverage;
- feature schema/config có version;
- split theo experiment run, không random window của cùng run;
- preprocessing/scaler chỉ fit trên training theo protocol.

Giá trị window khởi điểm `60s`, step `15s` chỉ là baseline để pilot; lựa chọn cuối phải được freeze trên validation trước campaign chính. Độ trễ thu thập đã đo (log ≈ 2 giây, trace ≈ 2,5 giây, metric ≈ 4–10 giây) nên cửa sổ ghép tín hiệu nên ≥ 15 giây (catalogue mục 1.4).

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

Graph được xây chủ yếu từ distributed traces theo hướng caller -> callee và theo run/window, và được **đối chiếu** với graph thiết kế (service-catalogue v2 mục 8); edge thiếu trong trace là vấn đề coverage. Async edge nối bằng trace context trong header RabbitMQ; fallback `message_id`/thời gian chỉ khi cần và phải giảm confidence. Quy ước đọc telemetry ảnh hưởng ground truth (span PRODUCER thuộc process relay, queue thuộc worker tiêu thụ, triệu chứng lỗi xác thực nằm ở cạnh `<service>-identity-token` của bên gọi) ghi ở catalogue mục 2.

Infrastructure dependency (PostgreSQL, RabbitMQ, MinIO, SMTP, LLM provider) là evidence graph nhưng **không mặc định trở thành service-level RCA candidate**.

### Mô hình RCA service-level

Primary candidate identity là service (candidate set mặc định: 10 service/worker, mục 3.1).

Baseline tối thiểu:

1. Max Anomaly.
2. Earliest Anomaly.
3. Graph-aware simple baseline.
4. Proposed ranker (graph-temporal-evidence) là mô hình huấn luyện/hiệu chỉnh trên dataset từ fault injection.

Proposed ranker kết hợp:

```text
anomaly severity
+ temporal precedence
+ propagation compatibility
+ edge degradation
+ evidence strength
```

Chưa chốt: ranker chỉ hiệu chỉnh trọng số trên validation hay còn huấn luyện có giám sát bằng run có nhãn fault. Nếu dùng run có nhãn để huấn luyện, phải tách run huấn luyện khỏi run đánh giá theo evaluation-protocol-v1 (v0 coi đây là protocol extension riêng, không được tái dùng ngầm run validation/test). Quyết định này thuộc analysis blueprint v1 và evaluation protocol v1.

Output là `RcaIncidentResult` ([schema ở complex-case-catalogue mục 5](../architecture/complex-case-catalogue-and-rca-result-v0.md)): `ranking[]` kèm `score`, `mechanism`, `propagation_path` và `evidence[]` tham chiếu lại telemetry gốc (`service.name`, `trace_id`/`span_id` hoặc metric + nhãn + khoảng thời gian). Chứng cứ không đủ thì `verdict = "insufficient_evidence"` và `ranking` rỗng. Dùng thuật ngữ **root-cause candidate ranking**, không tuyên bố causal proof tuyệt đối từ telemetry quan sát.

### Đối chứng thủ công

Để trả lời RQ6, MVP phải có hai đối chứng (ADR-002):

1. **Baseline "thủ công" tự động**: ngưỡng + tìm trace lỗi/chậm nhất theo đường request của triệu chứng; chạy lặp được trên cùng telemetry và cùng case.
2. **Thử nghiệm người thật nhỏ**: vài người dùng Grafana/Tempo/Loki để chẩn đoán case, đo thời gian chẩn đoán. Cấu trúc protocol (người tham gia không biết ground truth, brief chỉ nêu triệu chứng, dùng run của final test split) ở [evaluation-protocol-v1 mục 15](../architecture/evaluation-protocol-v1.md); số người và time cap chưa chốt, chờ Đức xác nhận.

---

## 3.6. Evaluation bắt buộc

Research scope MVP gồm **RQ1–RQ6** (RQ6 mới: AI so với thủ công trên case phức tạp). RQ cũ "fault category" (RQ6 ở khung v0) trở thành RQ7 tùy chọn, không thuộc MVP; fault category vẫn dùng để stratify/error-analysis. Operationalization ở [research-questions-and-metrics-v2](research-questions-and-metrics-v2.md).

### Detection/incident metrics

- Precision; Recall; F1; False Positive Rate; Detection Delay;
- incident/fault-run level là unit đánh giá chính.

### RCA metrics

- service-level Top-1 Accuracy; Top-3 Accuracy; Mean Reciprocal Rank; Average Rank bổ sung.

Không dùng `root_cause_component` trong primary Top-K/MRR của MVP.

### Thời gian chẩn đoán (mới)

Đo thời gian chẩn đoán của AI (RCA engine) so với thủ công trên từng case C1–C7, báo cáo riêng theo case, không gộp thành một con số. Định nghĩa điểm bắt đầu và kết thúc đo ở research-questions-and-metrics-v2 mục 10.4 (đề xuất chờ Đức xác nhận).

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

Chọn một trong hai: controlled trace dropping/sampling simulation trên **cùng baseline telemetry artifact**, hoặc missing-modality evaluation. Full/degraded condition là strict paired comparison trên cùng baseline run/artifact và cùng ground truth. Điều kiện cụ thể chốt ở evaluation-protocol-v1 (v0 chọn trace dropping 50% theo whole-trace).

### System/trade-off metrics

RQ5 xem xét trade-off giữa các dimension báo cáo riêng: **quality/effectiveness**, runtime/resource cost, complexity, interpretability/explainability và instrumentation overhead. Khi phù hợp phải đo:

- telemetry query/export time;
- feature extraction time;
- detector inference time;
- incident correlation time;
- RCA runtime;
- peak CPU/memory;
- artifact size;
- instrumentation overhead trên throughput/p95 latency.

**Complexity** báo cáo định tính (số modality cần dùng; số component/pipeline stage cần phối hợp; dependency/failure mode cần xử lý; mức phức tạp vận hành/cấu hình); không tạo metric định lượng hay scoring framework mới.

**Interpretability/explainability** yêu cầu RCA output, khi dữ liệu cho phép, giải thích được vì sao một service được xếp hạng qua sub-score/contribution của tín hiệu, evidence reference, vị trí/timing trong incident timeline, dependency/graph evidence và config/version metadata. Đây là traceability của ranking service-level, không thêm yêu cầu LLM reasoning hay causal proof.

Không tạo composite score hoặc một "accuracy tổng hợp" che mất trade-off; các dimension báo cáo riêng.

---

## 3.7. Reproducibility và interface tối thiểu

MVP phải có one-command/reproducible flow từ `run_id` tới prediction/evaluation. Testbed đã có reset/seed có kiểm soát (`lms/scripts/reset-and-seed.mjs`, R-10).

CLI là interface bắt buộc cho reproducibility. API hoặc HTML/report view chỉ triển khai khi cần tích hợp/demo và **không được làm chậm pipeline/evaluation**.

DoD end-to-end mục tiêu:

```text
experiment manifest
-> telemetry artifact
-> data-quality validation
-> features
-> anomaly scores
-> incident
-> service graph
-> service-level RCA candidates (RcaIncidentResult)
-> evidence/timeline
-> evaluation against ground truth
-> so sánh với đối chứng thủ công
```

Notebook, screenshot hoặc demo thủ công không thay thế artifact có thể chạy lại.

---

# 4. Thứ yếu — MCP server và agent (ADR-002)

Làm **sau** khi RCA engine và phần đánh giá đạt; không phải tiêu chí hoàn thành đề tài và không nằm trên critical path.

| Thành phần | Vị trí | Vai trò và ràng buộc |
| --- | --- | --- |
| MCP server chỉ đọc | `aiops-platform/mcp/` (chưa tạo) | Chỉ phục vụ suy luận/giám sát: cho LLM đọc **kết quả của RCA engine** (incident, xếp hạng, điểm, bằng chứng đã chọn sẵn, graph đã dùng). Không cấp truy vấn tùy ý vào Prometheus/Tempo/Loki; giới hạn khoảng thời gian và số dòng; có xác thực; không dùng cho huấn luyện |
| Agent LLM | `aiops-platform/agent/` (chưa tạo) | Đọc kết quả qua MCP và viết báo cáo có dẫn chứng. Không thay mô hình ML xếp hạng; chứng cứ không đủ thì báo "không đủ chứng cứ" |

Ràng buộc an toàn: nội dung log/trace là dữ liệu không tin cậy (có thể chứa prompt injection) nên prompt agent coi là dữ liệu; tool `get_ground_truth` chỉ bật khi đánh giá offline và tắt khi chạy thật. Service `ai` của LMS chưa nói MCP; agent loop và MCP client nằm ở runtime trong `aiops-platform/agent/`. Chất lượng báo cáo của agent (độ đúng, dẫn chứng, độ phủ) chỉ đánh giá khi phần này được làm.

---

# 5. Target — chỉ triển khai sau khi MVP tương ứng ổn định

| Target | Điều kiện xem xét | Giá trị |
| --- | --- | --- |
| Fault crash/restart/pause cho service hoặc worker (ví dụ `media-worker`, `ai-worker`) như category availability riêng | Các fault MVP chạy thật ổn định; thao tác dừng container đã được dùng ở C1/C6 | Mở rộng availability fault category |
| Bổ sung tín hiệu còn thiếu (pool DB, tuổi message, metric publish/consume, độ trễ outbox, log worker, nối trace scheduler) | Đức quyết định không làm trước dataset (mục 10); phải cập nhật telemetry schema | Phân biệt được C2 và các case dựa vào backlog/outbox rõ hơn |
| Richer log-template features | Structured-log baseline ổn | Tăng evidence/log signal |
| Change-point detection | Baseline detector + incident pipeline ổn | Ước lượng onset tốt hơn |
| Thêm fault intensity/target/repetition | Automation và ground truth ổn | Mở rộng coverage |
| Expanded robustness | Focused MVP robustness đã chạy | Nhiều sampling level/missing-modality combination/live sampling |
| External benchmark subset | Evaluation trên testbed chính không bị chậm | Validation bổ sung |
| Component-level evidence chi tiết hơn | Service-level RCA ổn định | Tăng explainability, không đổi primary metric |
| Mở rộng thử nghiệm người thật (thêm người, thêm case) | Thử nghiệm MVP đã chạy | Tăng độ tin cậy so sánh AI và thủ công |

Các Target trên **không nằm trong critical path** và có thể bỏ hoàn toàn mà MVP vẫn hợp lệ. MinIO, `identity` (đã gồm hồ sơ student), `media`, `notification`, `scheduler`, `ai` không còn là Target vì đã thuộc topology v2 (ADR-001). Assignment (Target của v1) không còn nghĩa trong topology v2 vì `submission` đã bị bỏ; thêm service mới phải có ADR.

---

# 6. Stretch — không phải điều kiện hoàn thành

- Kubernetes / Chaos Mesh;
- component-level RCA như primary metric;
- instance-level RCA;
- full causal discovery trên toàn telemetry;
- deep sequence model;
- multi-fault incident;
- service mesh, mTLS giữa service (ADR-004 đã loại);
- multi-cluster;
- custom Kubernetes operator;
- automatic remediation / self-healing;
- full LMS frontend;
- LLM thay RCA engine để xếp hạng nguyên nhân (LLM chỉ được viết báo cáo từ kết quả RCA ở mục 4);
- code-level bug localization;
- resilience/enterprise infrastructure nâng cao không cần cho controlled experiments.

---

# 7. Out-of-scope và lý do

| Hạng mục | Trạng thái | Lý do không đưa vào MVP |
| --- | --- | --- |
| Full LMS feature set | Out-of-scope | Không tăng giá trị nghiên cứu tương xứng; dễ chiếm toàn bộ thời gian |
| Chat/forum/video streaming | Out-of-scope | Không cần cho topology/fault canonical |
| AI tutor/recommendation/chấm điểm tự động | Out-of-scope | Service `ai` của LMS chỉ là gateway LLM soạn bài/sinh quiz làm thành phần SUT; các tính năng trên không thuộc AIOps anomaly/RCA |
| Full production frontend | Stretch/out-of-scope core | UI không phải đóng góp chính; API/report/Grafana tối thiểu đủ |
| Production IAM/SSO, mTLS | Out-of-scope | Auth chỉ cần đủ token người dùng và service (ADR-004); mTLS thêm hạ tầng chứng chỉ mà không tạo tín hiệu RCA |
| Email/SMS/push production | Out-of-scope | SMTP qua Mailpit đã đủ tạo dependency và backlog; không cần nhà cung cấp email thật |
| Sản phẩm object-storage hoàn chỉnh | Out-of-scope | MinIO thuộc MVP chỉ ở mức dependency của `media` |
| Thêm command/workflow async ngoài catalogue | Out-of-scope MVP | Thêm/đổi command hoặc producer/consumer là thay đổi kiến trúc cần ADR; catalogue v2 đã có đủ chuỗi async |
| Retry phức tạp/resilience framework diện rộng | Out-of-scope MVP | Retry HTTP mặc định tắt để không che hoặc khuếch đại lỗi; stale-while-error và circuit breaker của ADR-004 là ngoại lệ có chủ đích |
| Service mesh | Stretch/out-of-scope | Tăng hạ tầng nhưng không cần cho research core |
| Kubernetes/Chaos Mesh | Stretch | Docker Compose là runtime canonical của MVP |
| Deep learning/LSTM/Transformer | Stretch | Chỉ đáng xét khi classical baseline có failure mode rõ và đủ data/budget |
| LLM xếp hạng nguyên nhân thay mô hình ML | Out-of-scope core | Giảm reproducibility/explainability; ADR-002 chỉ cho LLM đọc kết quả RCA và viết báo cáo (mục 4) |
| Full causal discovery | Stretch | Vượt scope nhóm hai người và telemetry quan sát không đủ để mặc định causal proof |
| Component/instance RCA làm metric chính | Stretch | Primary evaluation đã freeze ở service-level |
| Multi-fault incident | Stretch | Tăng mạnh độ khó ground truth và evaluation |
| Automatic remediation/self-healing | Stretch | Không cần để trả lời RQ |
| Custom dashboard framework | Out-of-scope MVP | Grafana + artifact/API tối thiểu đủ |
| Distributed analysis architecture/Celery/Kafka | Out-of-scope MVP | Python/CLI đủ cho quy mô hiện tại |
| Fault injection đổi code nghiệp vụ | Out-of-scope | Fault phải bật/tắt được mà không sửa business rule |

---

# 8. Scope freeze và quy tắc chống scope creep

Business scope được **freeze** khi:

1. topology v2 (7 service + 4 worker) chạy được;
2. W1–W7 quan sát được;
3. metrics/traces/logs có correlation;
4. các fault/case canonical tạo được experiment hợp lệ;
5. ground truth và artifact ledger truy ngược được.

Trạng thái theo bằng chứng hiện có (không nhằm đánh dấu hoàn thành):

| Điều kiện | Bằng chứng | Trạng thái |
| --- | --- | --- |
| 1. Topology v2 chạy được | `docker-compose/README.md` (compose.full.yaml, 21 thành phần); catalogue mục 1 đo trên 11 runtime ngày 29/10/2026 | Có bằng chứng đo; chưa tự kiểm lại khi viết tài liệu này |
| 2. W1–W7 quan sát được | Catalogue mục 4.1: 9/9 luồng trace đủ service | Có bằng chứng đo |
| 3. Correlation M/T/L | Catalogue mục 4.1: `trace_id`/`span_id` khớp ở 11/11 runtime | Có bằng chứng đo |
| 4. Fault/case tạo experiment hợp lệ | Chỉ C6 đã chạy; C1–C5, C7 mới đo tín hiệu | **Chưa đạt**; thuộc mảng AI |
| 5. Ground truth và ledger | Schema đang viết ở telemetry-and-ground-truth-schema-v1 | **Chưa kiểm chứng** |

Sau điểm freeze, ưu tiên bắt buộc là:

```text
data quality
-> reproducibility
-> feature pipeline
-> anomaly/incident
-> graph/RCA (huấn luyện và đánh giá mô hình)
-> evaluation và đối chứng thủ công
-> (sau cùng, thứ yếu) MCP/agent
```

không phải thêm feature LMS.

Một Target chỉ được bật khi:

- không làm trễ milestone đang chạy;
- không thay đổi research question canonical;
- không phá candidate granularity service-level;
- có owner + acceptance criteria;
- có lý do trực tiếp liên quan experiment/evaluation;
- MVP tương ứng đã có artifact kiểm chứng.

Giai đoạn buffer/contingency của plan là buffer, **không dùng để hợp thức hóa feature mới**; lịch cụ thể theo plan, hiện chưa cập nhật theo refactor (xem phần Phụ thuộc).

---

# 9. Ma trận truy vết MVP -> giá trị nghiên cứu

| Thành phần | Dependency | Fault propagation | Telemetry | Ground truth | Evaluation/RQ |
| --- | :---: | :---: | :---: | :---: | :---: |
| Gateway + 7 service + 4 worker | ✓ | ✓ | ✓ |  | RQ2/RQ3/RQ6 |
| PostgreSQL | ✓ | ✓ | ✓ | ✓ | FC, FE, RCA evidence |
| RabbitMQ + outbox/inbox | ✓ | ✓ | ✓ | ✓ | FB, async RCA |
| MinIO | ✓ | ✓ | ✓ | ✓ | FA |
| SMTP (Mailpit) | ✓ | ✓ | ✓ |  | FB (dispatch chậm) |
| Nhà cung cấp LLM (stub) | ✓ | ✓ | ✓ | ✓ | FD |
| Service token và JWKS (`identity`) | ✓ | ✓ | ✓ | ✓ | FG, FH, C6/C7 |
| OTel + M/T/L stack |  | ✓ | ✓ |  | RQ1–RQ6 |
| k6 workload (chưa triển khai) |  |  | ✓ | ✓ | healthy/fault controls, nhiễu nền |
| Fault framework (chưa triển khai) |  | ✓ | ✓ | ✓ | mọi controlled experiment |
| Experiment manifest |  |  |  | ✓ | reproducibility |
| Feature/anomaly/incident |  |  | ✓ | ✓ | RQ1/RQ3/RQ4/RQ5/RQ6 |
| Dynamic graph | ✓ | ✓ | ✓ | ✓ | RQ2/RQ3 |
| Service-level RCA (ML + graph) | ✓ | ✓ | ✓ | ✓ | Top-K/MRR, RQ6 |
| Đối chứng thủ công (baseline tự động + thử nghiệm người) |  |  | ✓ | ✓ | RQ6, thời gian chẩn đoán |
| Ablation/robustness |  |  | ✓ | ✓ | RQ1–RQ5 |
| MCP/agent (thứ yếu) |  |  |  |  | không thuộc RQ; chỉ khi làm |

---

# 10. Xác nhận cần có

Đức tự xác nhận (refactor do một mình Đức làm, không cần Bách review):

- [ ] Topology v2 ở mục 3.1 (11 `service.name`, candidate set 10 service/worker) là phạm vi MVP.
- [ ] Bộ fault FA–FH và bảy case C1–C7 ở mục 3.4; FF không có case riêng.
- [ ] Evaluation floor đề xuất `K × R` với `R = 3` (21 run nếu đủ bảy case) và `K` tối thiểu để kết luận.
- [ ] Quy tắc owner/process: chấm theo `root_cause_service` của ground truth kèm owner-level Top-K phụ (evaluation-protocol-v1 mục 4.2).
- [ ] Hai đối chứng thủ công và cách đo thời gian chẩn đoán; số người tham gia thử nghiệm.
- [ ] Có bổ sung các tín hiệu telemetry còn thiếu (mục 3.3) trước khi thu dataset hay không.
- [ ] MCP/agent là thứ yếu và không phải tiêu chí hoàn thành.
- [ ] Ranker có dùng run có nhãn để huấn luyện có giám sát hay chỉ hiệu chỉnh trên validation.

| Trường | Giá trị |
| --- | --- |
| Người xác nhận | Đức |
| Trạng thái | `PENDING` |

---

# 11. Kết luận scope v2

MVP được coi là thành công khi nhóm có thể chạy lặp lại chuỗi:

```text
deploy testbed v2
-> seed
-> start controlled workload (kèm nhiễu nền)
-> collect correlated metrics/traces/logs
-> inject known fault (case phức tạp)
-> observe propagation
-> persist ground truth + provenance
-> build features
-> detect incident
-> build dynamic service graph
-> RCA engine xếp hạng service-level root-cause candidates (không cần người can thiệp)
-> produce evidence/timeline
-> evaluate against ground truth
-> so sánh với đối chứng thủ công (độ chính xác và thời gian chẩn đoán)
-> reset
-> repeat
```

Mọi hạng mục không trực tiếp giúp chuỗi trên hoặc RQ1–RQ6 đều phải mặc định **hoãn hoặc loại khỏi MVP**. Kết luận về việc AI tốt hơn thủ công chỉ được nêu khi số liệu thực nghiệm cho thấy; nếu không, báo cáo trung thực kèm phân tích failure case.

---

# Khác biệt so với bản trước

| Mục | v1 | v2 |
| --- | --- | --- |
| Vai trò AI | AI/pipeline hỗ trợ developer/SRE; kết quả là Top-K cho người đọc | RCA engine là bên truy vết chính; phần chính là huấn luyện và đánh giá mô hình ML + dependency graph; kết luận không cần người can thiệp (ADR-002) |
| Topology | 6 business service + Gateway (Auth, Course, Enrollment, Submission, Grading, Notification) | 7 service + 4 worker (11 `service.name`); bỏ `enrollment`/`submission`/`grading`; thêm `identity` (R-13 gộp `auth` và `student`), `media`, `scheduler`, `ai`; `admin` bị bỏ (ADR-001, ADR-003) |
| Hạ tầng | PostgreSQL (5 DB), Redis, RabbitMQ, Storage Mock; MinIO là Target | PostgreSQL 17 (6 DB), RabbitMQ (command, outbox/inbox), MinIO, SMTP (Mailpit), nhà cung cấp LLM; bỏ Redis và Storage Mock |
| Workflow | W1–W5 | W1–W7 |
| Xác thực | JWT HS256 tối thiểu | Token EdDSA (user và service), JWKS, tách `/api/v1` và `/internal/v1`; `identity` (trước R-13 là `auth`) thành điểm lỗi chung có chủ đích (ADR-004) |
| Fault | F1–F5 (Redis, Storage latency, service error, consumer backlog, CPU) | FA–FH (8 fault) và case phức tạp C1–C7 |
| Evaluation floor | 5 × 3 = 15 run | Đề xuất chờ Đức xác nhận: `K × R` với `R = 3` (21 run nếu đủ bảy case); chốt ở evaluation-protocol-v1 |
| Research questions | RQ1–RQ5; RQ6 không vào MVP | RQ1–RQ6 (RQ6 mới: AI so với thủ công); RQ "fault category" thành RQ7 tùy chọn |
| Metric | Detection, RCA, system | Thêm thời gian chẩn đoán AI so với thủ công; kết quả báo cáo theo từng case |
| Đối chứng | Baseline RCA nội bộ (Max Anomaly, Earliest, graph-aware) | Thêm baseline thủ công tự động và thử nghiệm người thật nhỏ |
| MCP/agent | Chưa có; "LLM RCA" ngoài core | Thành phần thứ yếu, làm sau, không phải tiêu chí hoàn thành; LLM chỉ đọc kết quả RCA và viết báo cáo |
| Target/Stretch | Assignment, MinIO, Submission crash/restart là Target | MinIO vào MVP; Assignment bỏ (không còn `submission`); Target mới: fault crash/restart worker, bổ sung tín hiệu telemetry còn thiếu, mở rộng thử nghiệm người |
| Tín hiệu telemetry | Giả định đủ | Ghi rõ tín hiệu có thật và chưa có (pool DB, tuổi message, outbox, publish/consume, log worker, nối trace scheduler) |
| Review | Bách `APPROVED` ngày 28/08/2026 | Chưa xác nhận; Đức tự xác nhận (mục 10). Review của Bách ở v1 không áp dụng cho v2 |
| DoD của task-01 | Mục 9 và 10 của v1 | Bỏ; thay bằng mục 10 (xác nhận cần có) |
