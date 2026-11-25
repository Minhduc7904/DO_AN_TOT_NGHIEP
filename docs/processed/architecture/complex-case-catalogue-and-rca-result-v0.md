# Danh mục case phức tạp v0 và schema kết quả RCA

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Cập nhật 23/11/2026 (pilot tuần 15):** pilot 4 case MVP đã chạy; mô tả đã đo nằm ở [fault-pilot-report-v1](fault-pilot-report-v1.md) và evaluation-protocol-v1 mục 6.1.1, ưu tiên hơn mô tả trong file này. Hai điểm khác: C3 với trễ provider 30–35 s (nhỏ hơn `AI_COMPLETION_TIMEOUT_MS` 240 s) chỉ làm job chậm, không có `WORKER_INTERRUPTED` hay lỗi muộn ở `ai-worker → course`; chuỗi "media `PENDING` kẹt → job dọn xóa media" của C4 không lộ được trong run 48 phút, triệu chứng ngoài đường request của C4 là `media-worker` tạo thumbnail chậm.
>
> **Cập nhật 17/11/2026 ([ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md)):** cơ chế gây lỗi của C2, C3, C4 nay đã có ở lớp fault `aiops-platform/faults/` ([PR #75](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/75), chưa merge): proxy toxiproxy `course-to-postgres` (C2), `media-to-minio` và `media-worker-to-minio` (C4), `llm-stub` (C3); các cơ chế đã chạy ở mức smoke, chưa pilot đầy đủ (số đo ở từng case). Mọi case chạy trên **workload bán thực** và mỗi case MVP có ít nhất một run test đặt fault trùng cao điểm tải (mục 3). Mục 1.5 thêm hành vi "series đứng yên khoảng 5 phút" khi runtime ngừng; mục 2 thêm lệch identity của relay `notification-worker`.
>
> **Cập nhật 17/11/2026 ([ADR-006](../adr/adr-006-trim-project-scope-v1.md)):** bộ case MVP còn C2, C3, C4, C6; C1, C5, C7 là Target. Cơ chế FC của C2 ("export CSV giữ kết nối DB") không khớp code vì export đọc từng khối 500 dòng; C2 viết lại thành chèn trễ có kiểm soát trên `course` → `course-postgres`. Phần "nơi lưu để MCP đọc" (mục 5.3) không còn là yêu cầu vì MCP ra Out-of-scope. Khi đoạn chi tiết mâu thuẫn, ADR-006 được ưu tiên.
>
> **Trạng thái:** v0, đề xuất — chờ Đức tự xác nhận (không cần Bách review, theo chỉ thị trực tiếp của Đức). Số đo lấy từ lần chạy `pnpm run test:observability` ngày 29/10/2026, ghi ở board mục "Bằng chứng đã chạy (R-12)".
>
> **Cập nhật R-13:** `auth` và `student` đã gộp thành `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)). Tên service, identity và case đã đổi tại chỗ; các **con số đo** (11 runtime, 38 cặp dependency, 70–74 giây ở C6) đo lại ngày 30/10/2026 trên stack 11 runtime, ghi ở mục "R-13" của board.
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) (mục 5–6 là bản đề xuất ban đầu, tài liệu này chốt chi tiết), [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
>
> **Mục đích:** (1) liệt kê tín hiệu telemetry **có thật** của LMS testbed v2 để mỗi case đối chiếu được; (2) chốt danh mục case phức tạp v0, mỗi case có kịch bản gây lỗi, triệu chứng, ground truth và tín hiệu xác nhận; (3) ghi nhận schema kết quả RCA và nơi lưu cho MCP thứ yếu (ADR-002).
>
> **Ngoài phạm vi:** fault injector, workload k6, dataset, RCA engine và MCP server thuộc mảng AI (`aiops-platform/`), không làm trong R-12; tài liệu này chỉ mô tả cách gây lỗi, không cài đặt. Hiện trạng ở mảng AI (17/11/2026, PR tuần 13 chưa merge): lớp fault cho C2, C3, C4 (PR #75), k6 mức 1 (PR #76), export telemetry và data-quality (PR #77, #79); workload bán thực, fault manifest, runner và dataset chưa có (tuần 14–15 của [plan-v0.4](../plan/plan-v0.4-24-weeks.md)); MCP server ra Out-of-scope (ADR-006).

---

# 1. Tín hiệu có thật của testbed v2

Đo ngày 30/10/2026 (sau R-13) trên stack `compose.full.yaml` (11 runtime), sau khi chạy bảy workflow regression qua Gateway. Lệnh kiểm chứng lặp lại được: `pnpm run test:observability` (mục 5 của [observability README](../../../aiops-platform/observability/README.md)).

## 1.1. Metric (Prometheus)

| Họ metric | Nhãn chính | Phủ | Ghi chú |
| --- | --- | --- | --- |
| `http_server_request_count_total`, `http_server_request_error_count_total`, `http_server_request_duration_seconds_*` | `service_name`, `http_method`, `http_route_template`, `http_status_class` | 11/11 runtime | Worker chỉ có `/health`, `/ready` |
| `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, `lms_dependency_duration_seconds_*` | `service_name`, `dependency_identity`, `operation_name`, `status` | 38 cặp (service, identity) | `status`: `ok`, `timeout`, `unavailable`, `expected_failure` |
| `process_cpu_time_seconds_total`, `process_memory_usage_bytes` | `service_name` | 11/11 runtime | CPU và RSS theo process |
| `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked`, `rabbitmq_detailed_queue_consumers` | `service_name` (worker tiêu thụ), `dependency_identity` (`<worker>-rabbitmq`), `queue` | 24 queue (12 canonical và 12 `.error`) | Nguồn: broker, không phải runtime; tên queue lấy từ `contracts` |

Cạnh dependency quan sát được (đủ cho dependency graph):

- Cơ sở dữ liệu: `identity-postgres`, `course-postgres`, `media-postgres` (cả `media` và `media-worker`), `notification-postgres` (cả `notification` và `notification-worker`), `scheduler-postgres` (cả `scheduler` và `scheduler-worker`), `ai-postgres` (cả `ai` và `ai-worker`).
- Hạ tầng khác: `media-minio` (`media`, `media-worker`), `notification-smtp`, `ai-llm-provider` (`ai`, `ai-worker`).
- HTTP đồng bộ giữa service: `gateway-{identity,course,media,notification,scheduler,ai}`, `course-media`, `course-ai`, `media-identity`, `notification-worker-identity`, `scheduler-worker-media`, `ai-worker-course`, `ai-worker-media`.
- Xác thực (ADR-004): `<service>-identity-token` (gateway, `course`, `media`, `notification-worker`, `scheduler-worker`, `ai-worker`; `media-worker` không lấy token) và `<service>-identity-jwks`.

## 1.2. Trace (Tempo)

Mọi runtime xuất span OTLP, 100% sampling. Luồng bất đồng bộ qua outbox **nối vào trace của request HTTP gây ra nó**: command ghi `traceparent` vào envelope lúc enqueue, relay phát lại với đúng context đó (đã sửa ở R-12, xem mục 4.2).

Ma trận luồng ↔ tập service trong một trace (đã đo, kiểm tự động bởi `tracing-smoke`):

| Luồng | Service phải có trong cùng trace | Span chủ chốt |
| --- | --- | --- |
| Đăng nhập | `gateway`, `identity` | `identity-postgres *` |
| Đăng ký | `gateway`, `identity` | SERVER `POST /api/v1/auth/register`, `identity-postgres *` (một transaction) |
| Soạn khóa học | `gateway`, `course` | `course-postgres *` |
| Upload media | `gateway`, `media`, `media-worker` | `media-minio *`, CONSUMER `media-worker--generate-media-thumbnail-v1` |
| Đồng bộ usage markdown | `gateway`, `course`, `media-worker` | CONSUMER `media-worker--synchronize-markdown-media-usage-v1` |
| Thông báo hàng loạt | `gateway`, `notification`, `notification-worker`, `identity` | CONSUMER `…snapshot…`, `…dispatch-notification-batch…`, CLIENT `notification-smtp *` |
| Job AI soạn bài | `gateway`, `course`, `ai`, `ai-worker` | CONSUMER `ai-worker--run-ai-job-v1`, CLIENT `ai-llm-provider *`, SERVER `…/ai-context` của `course` |
| Trích văn bản tài liệu | `gateway`, `media`, `ai-worker` | CONSUMER `ai-worker--extract-ai-document-v1` |
| Dọn media theo lịch | `scheduler-worker`, `media` | CLIENT `scheduler-worker-media POST`, CLIENT `media-minio remove-object` |

## 1.3. Log (Loki)

11/11 runtime có log; chỉ `service_name` là index label. Mỗi request HTTP (trừ `/health`) có access log `http.server.request`; lỗi dependency có log `dependency.failure` kèm `dependency_identity`, `error_type`, `trace_id`, `span_id` (đã kiểm: `span_id` trỏ đúng span CLIENT lỗi). `trace_id`, `span_id`, `service_version`, `service_instance_id` là structured metadata.

## 1.4. Độ trễ thu thập

Đo từ lúc gửi request tới lúc tín hiệu truy vấn được: log vào Loki ≈ 2 giây, trace vào Tempo ≈ 2,5 giây, counter vào Prometheus ≈ 4–10 giây (chu kỳ export 5 giây cộng scrape 5 giây). Backlog queue hiện ở Prometheus sau ≈ 9 giây. Cửa sổ ghép tín hiệu của RCA engine nên ≥ 15 giây.

## 1.5. Tín hiệu chưa có (giới hạn trung thực)

| Thiếu | Hệ quả cho RCA | Hướng xử lý (thuộc mảng AI hoặc R sau) |
| --- | --- | --- |
| Độ sử dụng pool kết nối PostgreSQL, thời gian chờ pool | Case giữ kết nối DB (C2) chỉ thấy gián tiếp qua độ trễ `course-postgres` | Thêm metric pool vào `lms/packages/common/src/prisma/` |
| Tuổi message cũ nhất trong queue | Không đo được backlog theo thời gian chờ, chỉ theo độ sâu | Suy từ span: thời điểm PRODUCER so với CONSUMER cùng trace |
| Metric publish/consume của RabbitMQ ở runtime | `rabbitmq_*` chỉ từ broker; không có `lms_dependency_*` cho `*-rabbitmq`, chỉ có span | Bọc publish/consume bằng `observeDependency` (đổi tên metric, cần ADR nhỏ) |
| Độ trễ outbox (dòng chờ phát) | Command kẹt trong DB không thấy ở broker | Metric đếm `outbox_messages` chưa phát |
| Log khi worker xử lý command | Worker chỉ có access log `/ready`; lỗi xử lý chỉ thấy ở span và `dependency.failure` | Log có cấu trúc trong consumer |
| Nối scheduler → scheduler-worker | `scheduler` ghi run, `scheduler-worker` thăm dò DB nên không cùng trace | Truyền `traceparent` qua bản ghi job |
| Trace gây nhiễu | `scheduler-worker` tạo trace gốc cho mỗi lần thăm dò DB (mỗi giây) và mọi runtime tạo trace cho `/ready` | RCA engine lọc theo `http_route_template`/`operation_name` (đã cài ở adapter export PR #77) |
| Tín hiệu "runtime còn sống" theo sự có mặt của mẫu | Đo 17/11/2026: khi runtime ngừng (chết, `docker pause`), OTel Collector vẫn xuất giá trị cuối của mọi series thêm **khoảng 5 phút**, nên Prometheus vẫn có mẫu mỗi 5 giây với giá trị đứng yên (pause `scheduler` 70 giây). Latency, request count của runtime đã ngừng "phẳng" chứ không biến mất | Xem bộ đếm `process_cpu_time_seconds_total` có tăng hay không; cờ `telemetry_silent` của quality check (PR #79, [telemetry-data-dictionary-v2](telemetry-data-dictionary-v2.md) mục 8.2) và feature dựa trên mức tăng của counter |
| Mẫu đầu của bộ đếm lỗi mới | Bộ đếm lỗi xuất hiện lần đầu giữa cửa sổ (ví dụ `status="unavailable"`) là series mới; `increase()`/`rate()` bỏ mẫu đầu nên có thể trả 0 cho đợt lỗi đầu | Artifact giữ giá trị thô; feature coi giá trị trước đó là 0 |

---

# 2. Quy ước đọc telemetry (ảnh hưởng tới ground truth)

1. **Span PRODUCER thuộc tiến trình relay**, không nhất thiết thuộc service ghi command. Outbox của `notification` có thể được phát bởi process `notification` hoặc `notification-worker` (cùng bảng, claim lần lượt), nên `service.name` của span `lms.commands publish …` chỉ cho biết tiến trình phát. Quy về chủ sở hữu bằng `producer.service_name` trong envelope (không có trong span) hoặc bằng queue đích. Lệch đã biết (17/11/2026): relay chạy trong `notification-worker` dùng chung `OutboxRelayService` với `notification` nên span PRODUCER của nó mang `dependency_identity = notification-rabbitmq`, không phải `notification-worker-rabbitmq` như [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md) mục 3.2.4 (`lms/services/notification/src/adapters/messaging/outbox-relay.service.ts`); chưa sửa vì LMS đóng băng (sửa được vì là telemetry).
2. **Queue thuộc worker tiêu thụ**: `service_name` của metric broker là tiền tố trước `--` của tên queue. Backlog ở queue `media-worker--*` mô tả `media-worker`, kể cả khi nguyên nhân là nơi khác.
3. **Triệu chứng của lỗi xác thực nằm ở cạnh `<service>-identity-token` của bên gọi**, không nằm ở service đích (mục C6).
4. Metric `lms_dependency_*` của cạnh HTTP do **bên gọi** ghi (`service_name` = bên gọi); span SERVER của bên nhận nằm cùng trace.
5. **Service bị `docker pause` mất lô span cuối của chính nó.** Đo ngày 17/11/2026 trong `tracing-smoke`: mọi span của `identity` trong khoảng 2 giây trước lúc pause không tới Tempo, dù log cùng thời điểm đã vào Loki. Hệ quả cho C6: không dùng "span cuối cùng của `identity`" để suy ra thời điểm fault; `fault_start` lấy từ execution truth của injector, và RCA engine phải chịu được việc service gốc im lặng (không có span) thay vì phát span lỗi.

---

# 3. Danh mục case phức tạp v0

Tiêu chí (ADR-002): nguyên nhân gốc nằm **ngoài đường request của triệu chứng**; mỗi case có ground truth theo `RunGroundTruth` của [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md). Trạng thái kiểm chứng ghi rõ: **Đã chạy** (kịch bản gây lỗi chạy thật trọn chuỗi, số đo ở board), **Cơ chế đã chạy ở mức smoke** (cơ chế gây lỗi bật/tắt được và làm đổi tín hiệu như dự kiến, chưa chạy trọn chuỗi nhân quả dưới workload, chưa pilot), **Đã đo tín hiệu** (các tín hiệu tồn tại, cơ chế gây lỗi chưa chạy), **Giả thuyết** (chuỗi nhân quả chưa kiểm chứng).

Mọi case chạy trên **workload bán thực** ([ADR-007](../adr/adr-007-semi-real-workload-and-ai-evidence-v1.md) mục 1: học viên phát lại phiên thật từ log Moodle, giảng viên/admin/job lịch dùng mức 2) để triệu chứng lẫn trong tải hợp lệ; mỗi case MVP có ít nhất một run test đặt fault **trùng cao điểm tải** (ADR-007 mục 3). k6 mức 1 (PR #76) chỉ dùng cho smoke. Đối chứng thủ công theo [evaluation-protocol-v1](evaluation-protocol-v1.md) và ADR-007 (E2, E4, E7). Fault bật/tắt bằng CLI `aiops-platform/faults/fault-control.mjs`; mỗi lệnh in một dòng JSON có `ts` (UTC) dùng làm dấu vết thời điểm fault thật cho `RunGroundTruth`.

## C1 — Upload hoàn tất bị timeout vì batch thông báo (FB)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Tạo batch thông báo rất lớn (seed R-10: 100000 recipient) và làm chậm `notification-worker` (giới hạn CPU container hoặc `docker pause` theo chu kỳ). Song song student upload ảnh. |
| Triệu chứng | `upload-complete` của `media` chậm hoặc timeout ở `gateway-media`; thumbnail `PENDING` lâu; `media-worker` không lỗi. |
| Ground truth | `fault_type=queue_backlog`, `root_cause_service=notification-worker`, `root_cause_component=notification-worker-rabbitmq`, đường lan: `notification-worker` → broker/PostgreSQL dùng chung → `media-worker` → `media` → `gateway`. |
| Tín hiệu xác nhận | Độ sâu `rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"}` tăng, `consumers` giảm hoặc không đổi, span `notification-smtp smtp.send` dài; `media-worker` CONSUMER bắt đầu muộn so với PRODUCER cùng trace. |
| Trạng thái | **Đã đo tín hiệu**: backlog tăng khi dừng worker và drain sau khi phục hồi (hiện sau ≈ 9 giây), command sai vào `.error`. Chuỗi lan sang `media-worker` là **giả thuyết**: mỗi worker có queue riêng, nên chỉ xảy ra khi broker hoặc PostgreSQL bị tranh chấp tài nguyên; cần chạy thật trước khi dùng làm case đánh giá. |

## C2 — Enroll/quiz submit chậm đột ngột vì kết nối `course` → PostgreSQL chậm (FC, viết lại theo ADR-006)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Bản đầu ("nhiều export CSV khối lượng lớn đồng thời với tải học") không khớp code vì export đọc từng khối 500 dòng (ADR-006). Kịch bản hiện hành: chèn trễ có kiểm soát trên kết nối `course` → `course-postgres` bằng proxy toxiproxy `course-to-postgres` (chỉ `course_db`; service khác vẫn nối thẳng `postgres`): `node aiops-platform/faults/fault-control.mjs latency course-to-postgres <ms> [--jitter <ms>]`, gỡ bằng `clear`. Toxic `latency` áp chiều trả lời của PostgreSQL, nên truy vấn nhiều lượt hỏi-đáp chậm gấp nhiều lần. Chạy cùng tải học (enroll, làm quiz). Theo ADR-006, C2 là **case đối chứng dễ**: baseline thủ công được kỳ vọng tìm ra. |
| Triệu chứng | Mọi truy vấn của `course` chậm, không có span lỗi; `gateway-course` p95 tăng. |
| Ground truth | `fault_type=dependency_latency` (ADR-006; bản trước ghi `db_connection_hold`), `root_cause_service=course`, `root_cause_component=course-postgres`, đường lan: kết nối `course` → `course-postgres` chậm → mọi route `course` → `gateway`. |
| Tín hiệu xác nhận | `lms_dependency_duration_seconds` của `course-postgres` tăng đồng loạt theo mọi `operation_name`; `process_cpu_time_seconds_total` hoặc RSS của `course`; thiếu: độ sử dụng pool (mục 1.5). |
| Trạng thái | **Cơ chế đã chạy ở mức smoke** (PR #75, 17/11/2026, mỗi giai đoạn 40 giây, request lặp `GET /api/v1/courses`): trước khi bật client p50 2 ms, `course-postgres` p50 0,0025 s; `latency course-to-postgres 200` → client p50 204 ms, `course-postgres` p50 0,175 s (đọc bằng `histogram_quantile`, nội suy theo bucket); sau `clear` về 3 ms / 0,0025 s. Proxy trên đường đi khi không bật toxic chỉ thêm khoảng 0,02 ms mỗi truy vấn (`pgbench SELECT 1`). Chưa chạy dưới workload, chưa pilot. Metric pool **chưa có**, nên phân biệt "pool cạn" với "DB chậm" chưa làm được. |

## C3 — Job AI soạn bài kẹt `RUNNING` rồi `WORKER_INTERRUPTED` (FD)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Provider LLM giả trả chậm hoặc lỗi ngắt quãng; instructor tạo job AI và tài liệu `extract_text`. Cơ chế: `llm-stub` của lớp fault (OpenAI-compatible, `ai`/`ai-worker` gọi tại `http://llm-stub:8080/v1`; provider tạo bằng API admin với `base_url` này): `fault-control.mjs llm set --latency-ms <ms> --jitter-ms <ms>` (chậm), `--error-rate <0..1> --error-status <mã>` hoặc `--error-mode disconnect` (lỗi ngắt quãng, chuỗi lỗi theo seed `LLM_STUB_SEED`), `llm reset`. Trễ và lỗi chỉ áp vào `POST /v1/chat/completions`. |
| Triệu chứng | Job AI `RUNNING` lâu; tài liệu mãi `EXTRACTING`; `course` thấy lỗi muộn ở `ai-worker → course`. Trạng thái cuối phụ thuộc tham số stub (đối chiếu code 17/11/2026, `run-job.use-case.ts`): provider lỗi hoặc một lượt gọi vượt `AI_COMPLETION_TIMEOUT_MS` (240 giây) thì job `FAILED` với mã lỗi của lời gọi; `WORKER_INTERRUPTED` chỉ xuất hiện khi command được giao lại lúc job đã quá lease (lease 600 giây, gia hạn trước mỗi lượt), không có tiến trình quét định kỳ. |
| Ground truth | `fault_type=dependency_latency`, `root_cause_service=ai`, `root_cause_component=ai-llm-provider` (chủ sở hữu `ai`; process chạm provider là `ai-worker`), đường lan: provider → `ai-worker` (giữ lease) → `ai` job/tài liệu → `course`. |
| Tín hiệu xác nhận | Span CLIENT `ai-llm-provider POST chat/completions` dài hoặc lỗi trong trace của luồng "Job AI"; `lms_dependency_duration_seconds{dependency_identity="ai-llm-provider"}`; `ai-worker` CONSUMER `run-ai-job` kéo dài. |
| Trạng thái | **Cơ chế đã chạy ở mức smoke** (PR #75, 17/11/2026): trace luồng AI đủ `gateway → course → ai → ai-worker → course` kèm span provider; `llm set --latency-ms 2000 --jitter-ms 500` → job vẫn `COMPLETED`, `ai-llm-provider POST chat/completions` trung bình 2,36 s; `--error-rate 1` → job `FAILED` với `AI_PROVIDER_ERROR`, `lms_dependency_request_count_total{service_name="ai-worker",dependency_identity="ai-llm-provider",status="unavailable"}` = 2; `llm reset` đưa về bình thường. Chưa chạy trễ vượt `AI_COMPLETION_TIMEOUT_MS` hay nhánh `WORKER_INTERRUPTED`, chưa pilot. |

## C4 — Khóa học `READY` nhưng thumbnail mất, job cleanup xóa media (FA)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Chèn trễ hoặc ngắt kết nối giữa `media` và MinIO trong lúc upload/promote. Cơ chế: hai proxy toxiproxy `media-to-minio` (phía `media`) và `media-worker-to-minio` (phía `media-worker`), cùng tới `minio:9000`: `fault-control.mjs latency <proxy> <ms> [--jitter <ms>]`, `disconnect <proxy>`, `reconnect`/`clear`. Giới hạn: upload trực tiếp từ client lên MinIO (presigned POST tới `MINIO_PUBLIC_URL`) **không đi qua proxy**; proxy chỉ chặn kết nối phía server (kiểm tra object, promote, đọc nội dung, thumbnail, xóa). |
| Triệu chứng | Media `PENDING` kẹt, usage chưa gắn (đồng bộ usage markdown chỉ gắn media `READY`, job đồng bộ ghi `PARTIAL_FAILED` không có span lỗi). Khi job dọn chạy, media `PENDING` quá hạn upload (`MEDIA_UPLOAD_EXPIRES_SECONDS` 900) cộng ân hạn (`MEDIA_CLEANUP_PENDING_GRACE_MINUTES` 15) bị coi là upload bỏ dở: `FAILED` `UPLOAD_ABANDONED`, object bị xóa (nhánh `media.list-stale-pending`, `cleanup-media.use-case.ts`). Nhánh "`READY` không có usage" là nhánh khác, giữ mặc định 168 giờ. Lỗi lộ muộn ở scheduler/media. |
| Ground truth | `fault_type=dependency_latency`, `root_cause_service=media`, `root_cause_component=media-minio`, đường lan: MinIO → `media`/`media-worker` → usage trống → `scheduler-worker` cleanup. |
| Tín hiệu xác nhận | Span `media-minio *` chậm hoặc lỗi; `lms_dependency_*{dependency_identity="media-minio"}`; trace "Dọn media theo lịch" có `media-minio remove-object` bất thường về số lượng. |
| Trạng thái | **Cơ chế đã chạy ở mức smoke** (PR #75, 17/11/2026, `GET /api/v1/media/:id/content`): trước khi bật client p50 5 ms, `media-minio` p50 0,0025 s; `latency media-to-minio 300` → client p50 607 ms (đọc nội dung cần hai lượt tới MinIO), `media-minio` p50 0,689 s; sau `clear` về 3 ms / 0,0025 s. Span và metric MinIO có ở cả `media` và `media-worker`; trace dọn media có thật. Chưa chạy chuỗi "media `PENDING` kẹt → cleanup xóa" (cần giữ fault lâu hơn hạn upload 900 giây cộng ân hạn 15 phút, hoặc rút ngắn hai tham số này), chưa pilot. Scheduler và worker không cùng trace (mục 1.5). |

## C5 — Batch thông báo `PARTIAL_FAILED`, số item lệch (FE)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Chèn trễ truy vấn của `identity-postgres` khi `notification-worker` snapshot recipient. |
| Triệu chứng | Batch `PARTIAL_FAILED`, thiếu recipient, log không có lỗi. |
| Ground truth | `fault_type=dependency_latency`, `root_cause_service=identity`, `root_cause_component=identity-postgres`, đường lan: `identity-postgres` → `identity` → `notification-worker-identity` → batch. |
| Tín hiệu xác nhận | Span `notification-worker-identity GET /internal/v1/students` chậm, span `identity-postgres student.list` chậm; `lms_dependency_duration_seconds{dependency_identity="notification-worker-identity"}`. |
| Trạng thái | **Đã đo tín hiệu**: trace luồng "Thông báo hàng loạt" chứa đủ `notification-worker → identity → identity-postgres`. Chèn trễ chưa chạy. |

## C6 — Mọi request qua gateway lỗi 5xx hàng loạt sau khoảng yên lặng (FG, ADR-004)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | `docker pause` container `identity` (hoặc dừng). Đặt `IDENTITY_SERVICE_TOKEN_TTL_SECONDS=60` để rút ngắn khoảng yên lặng trong test (mặc định 600). |
| Triệu chứng | Đăng nhập lỗi ngay (504). Request có token người dùng còn hạn vẫn thành công trong khoảng yên lặng. Hết hạn token dịch vụ của `gateway` thì **mọi** route qua gateway lỗi 504 dù `course`, `media` khỏe; request không tới service đích. |
| Ground truth | `fault_type=dependency_unavailable`, `root_cause_service=identity`, `root_cause_component=identity`, đường lan: `identity` → `gateway-identity-token` → mọi upstream của gateway (và `<worker>-identity-token` của các worker khi token của chúng hết hạn). |
| Tín hiệu xác nhận | Span CLIENT lỗi `gateway-identity-token POST /internal/v1/auth/service-token` và `gateway-identity POST` ở span gốc; trace không có span của service đích; `lms_dependency_error_count_total{dependency_identity="gateway-identity-token"}` tăng; log `dependency.failure` có `span_id` khớp span lỗi. Về `identity`: metric của nó vẫn có mẫu với giá trị đứng yên khoảng 5 phút sau khi pause (mục 1.5), nên dấu hiệu đúng là `process_cpu_time_seconds_total` của `identity` ngừng tăng và cờ `telemetry_silent` (run fault C6 **phải** có cờ này, [telemetry-data-dictionary-v2](telemetry-data-dictionary-v2.md) mục 8.4). |
| Trạng thái | **Đã chạy** bởi `tracing-smoke`: login 504 ngay; token người dùng còn hạn vẫn 200; lỗi `gateway-identity-token` xuất hiện **70–74 giây** sau khi dừng `identity` (TTL 60 giây); phục hồi sau `unpause`. Khác với bản đề xuất ban đầu: triệu chứng nằm ở gateway, không phải ở `course`/`media`. |

## C7 — Lệch khóa ký làm 401 đồng loạt (FH)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Đổi `IDENTITY_SIGNING_KEY_PEM` rồi khởi động lại `identity` mà không giữ khóa cũ. |
| Triệu chứng | Sau khi cache JWKS hết hạn, nhiều service trả 401 cùng lúc, hạ tầng đều khỏe. |
| Ground truth | `fault_type=config_drift`, `root_cause_service=identity`, `root_cause_component=identity-jwks`, đường lan: JWKS mới → verify thất bại ở mọi service. |
| Tín hiệu xác nhận | Tăng lỗi `SERVICE_TOKEN_INVALID`/401 ở nhiều service cùng thời điểm; span `*-identity-jwks` có refetch; tỉ lệ 4xx tăng ở `http_server_request_count_total`. |
| Trạng thái | **Đã đo tín hiệu** (cạnh `*-identity-jwks` có ở các runtime verify token). Cơ chế đổi khóa chưa chạy. |

Ma trận fault FF (quá tải tài nguyên bất kỳ) không có case riêng: tín hiệu `process_cpu_time_seconds_total` và `process_memory_usage_bytes` có thật và dùng làm bằng chứng phụ cho C1–C2.

---

# 4. Kết quả kiểm chứng telemetry xuyên service

## 4.1. Đã đạt

- 9/9 luồng ở mục 1.2 có trace chứa đủ service, đúng span gốc, không đứt parent, không span lỗi, `service.version`/`service.instance.id` khớp compose.
- Metric: 11/11 runtime có RED, CPU, RSS; 38 cạnh dependency đúng danh mục identity; 24 queue đúng chủ sở hữu và consumer.
- Log: 11/11 runtime; `trace_id`/`span_id` khớp span thật ở cả 11 runtime; log lỗi dependency khớp span lỗi; không rò secret.
- Dashboard: mọi query panel trả dữ liệu; data link metric → TraceQL → Loki dùng được.

## 4.2. Lỗi phát hiện và đã sửa

- **Trace bất đồng bộ bị đứt**: relay outbox publish trong context rỗng, nên chuỗi command là trace riêng không nối với request gây ra (ví dụ `[course, media-worker]` không có `gateway`). Sửa ở `RabbitMqCommandPublisher`: không có span hoạt động thì dùng `traceparent` trong envelope làm parent. Có unit test.
- **Identity RabbitMQ không khớp catalogue**: code ghi `rabbitmq` chung; đã đổi thành `<service.name>-rabbitmq`.
- **Metric broker thiếu**: collector chỉ scrape queue v1 đã xóa; đã scrape mọi queue canonical.
- **Danh sách service/cạnh của `packages/observability` còn v1** (kể cả `admin` đã bỏ); đã dọn.
- **Tempo bị OOM-kill** (giới hạn 512 MiB) khi truy vấn hàng nghìn trace song song; smoke truy vấn tuần tự và hạn chế số trace. RCA engine không nên kéo trace hàng loạt từ Tempo của testbed.

---

# 5. Schema kết quả RCA và nơi lưu

> Thuộc mảng AI (ADR-002). R-12 chỉ ghi nhận hợp đồng dữ liệu để RCA engine và MCP thứ yếu thống nhất; không cài đặt. `aiops-platform/training/` đã có ở PR #77 (chưa merge) nhưng mới gồm export telemetry và data-quality, chưa có `results/`; `aiops-platform/mcp/` không tạo (MCP ra Out-of-scope theo ADR-006).

## 5.1. Yêu cầu bắt buộc từ telemetry

Bằng chứng trong kết quả RCA phải tham chiếu lại được telemetry gốc, nên mỗi bằng chứng chứa: `service.name`, `trace_id` và `span_id` (với trace/log), hoặc `metric` + nhãn + khoảng thời gian (với metric). Telemetry đã đáp ứng (mục 1): 11/11 runtime có `service_name`; log có `trace_id`/`span_id`; trace có đủ span. Không có ground truth trong payload nghiệp vụ hay telemetry.

## 5.2. `RcaIncidentResult` (logical schema, JSON)

```text
RcaIncidentResult
- rca_result_schema_version        # "0"
- incident_id                      # UUID
- run_id                           # trùng RunGroundTruth.run_id khi chạy thí nghiệm; null khi giám sát thật
- created_at                       # UTC
- window: { start, end }           # khoảng thời gian phân tích (UTC)
- telemetry_quality                # tham chiếu TelemetryQualityReport (độ phủ, thiếu tín hiệu)
- verdict                          # "ranked" | "insufficient_evidence"
- model: { name, version, graph_ref, config_ref }   # graph_ref: dependency graph v2 đã dùng
- symptom: { service, signal, first_seen }          # triệu chứng khởi đầu
- ranking[]                        # rỗng khi verdict = insufficient_evidence
    - rank
    - candidate: { service, component, dependency_identity }
    - score
    - mechanism                    # fault_type dự đoán (queue_backlog, dependency_latency, …)
    - propagation_path[]           # chuỗi service.name từ nguồn tới triệu chứng
    - evidence[]
        - kind                     # "trace" | "log" | "metric"
        - service                  # service.name
        - trace_id, span_id        # trace/log
        - metric, labels, window   # metric
        - summary                  # mô tả ngắn, do engine chọn sẵn, không phải log thô
```

Nguyên tắc:

- Bằng chứng do engine chọn và nén sẵn; MCP **không** cấp truy vấn tùy ý vào Prometheus/Tempo/Loki (ADR-002).
- `summary` và mọi chuỗi trích từ log/trace là **dữ liệu không tin cậy** (có thể chứa prompt injection); agent coi là dữ liệu.
- `ground_truth` **không** nằm trong `RcaIncidentResult`; đánh giá offline đối chiếu `RunGroundTruth` với kết quả theo `run_id`. Công cụ đọc đáp án chỉ bật khi đánh giá offline.
- Chứng cứ không đủ: `verdict = "insufficient_evidence"`, `ranking` rỗng.

## 5.3. Nơi lưu (đề xuất)

| Mục | Quyết định đề xuất |
| --- | --- |
| Định dạng | Một file JSON bất biến cho mỗi incident, kèm `manifest.json` liệt kê (`incident_id`, `run_id`, `created_at`, `sha256`). Không sửa file đã ghi; kết quả mới là file mới. |
| Vị trí | `aiops-platform/training/results/<run_id hoặc ngày>/<incident_id>.json` (thư mục tạo khi mảng AI bắt đầu); MCP chỉ đọc thư mục này. |
| Truy cập MCP | Chỉ đọc, giới hạn khoảng thời gian và số bản ghi, có xác thực (ADR-002). |
| Vòng đời | Lưu kèm `telemetry artifact` và `RunGroundTruth` cùng `run_id` để tái lập đánh giá; theo quy tắc immutability của [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md). |

Đây là đề xuất để mảng AI xác nhận; đổi định dạng hoặc nơi lưu chỉ cần cập nhật mục này và `rca_result_schema_version`.

---

# 6. Việc chuyển chủ

| Việc | Chủ |
| --- | --- |
| Cài fault injector (chèn trễ MinIO/PostgreSQL/SMTP/LLM stub, giới hạn CPU) và workload k6 | Mảng AI (`aiops-platform/faults/`, `load/`). Đã có ở PR tuần 13 (chưa merge): trễ/ngắt PostgreSQL của `course` và MinIO, `llm-stub` (PR #75), k6 mức 1 (PR #76). Còn: fault manifest và tùy chọn fault trùng cao điểm tải, workload bán thực mức 2+ và mức 2 (tuần 14 của plan-v0.4); trễ SMTP và giới hạn CPU chỉ cần cho C1/FF (Target) |
| Chạy thật chuỗi nhân quả C2, C3, C4 (cơ chế đã chạy ở smoke) ở pilot tuần 15 trước khi dùng làm case đánh giá; C1, C5, C7 (Target, mới đo tín hiệu) chỉ khi còn thời gian | Mảng AI |
| Sửa identity của relay outbox trong `notification-worker` (`notification-rabbitmq` → `notification-worker-rabbitmq`, mục 2) hoặc ghi chú khi dựng cạnh async | Mảng AI; được phép dù LMS đóng băng vì là thay đổi phục vụ telemetry (ADR-006); chưa quyết sửa hay ghi chú |
| Metric thiếu ở mục 1.5 (pool DB, outbox, publish/consume RabbitMQ, log worker, nối scheduler → worker) | Đức quyết định có làm trước khi thu dataset |
| RCA engine, MCP server, agent | Mảng AI, theo ADR-002 |
