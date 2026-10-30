# Danh mục case phức tạp v0 và schema kết quả RCA

> **Task:** R-12 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** v0, đề xuất — chờ Đức tự xác nhận (không cần Bách review, theo chỉ thị trực tiếp của Đức). Số đo lấy từ lần chạy `pnpm run test:observability` ngày 29/10/2026, ghi ở board mục "Bằng chứng đã chạy (R-12)".
>
> **Cập nhật R-13:** `auth` và `student` đã gộp thành `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)). Tên service, identity và case đã đổi tại chỗ; các **con số đo** (số cặp, số runtime, độ trễ) được đo lại trên stack 11 runtime và ghi ở mục "Bằng chứng đã chạy (R-13)" của board.
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [data-ownership-and-fault-matrix-v2](data-ownership-and-fault-matrix-v2.md) (mục 5–6 là bản đề xuất ban đầu, tài liệu này chốt chi tiết), [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md).
>
> **Mục đích:** (1) liệt kê tín hiệu telemetry **có thật** của LMS testbed v2 để mỗi case đối chiếu được; (2) chốt danh mục case phức tạp v0, mỗi case có kịch bản gây lỗi, triệu chứng, ground truth và tín hiệu xác nhận; (3) ghi nhận schema kết quả RCA và nơi lưu cho MCP thứ yếu (ADR-002).
>
> **Ngoài phạm vi:** fault injector, workload k6, dataset, RCA engine và MCP server thuộc mảng AI (`aiops-platform/`), không làm trong R-12. Tài liệu này chỉ mô tả cách gây lỗi, không cài đặt.

---

# 1. Tín hiệu có thật của testbed v2

Đo ngày 29/10/2026 trên stack `compose.full.yaml` (12 runtime), sau khi chạy bảy workflow regression qua Gateway. Lệnh kiểm chứng lặp lại được: `pnpm run test:observability` (mục 5 của [observability README](../../../aiops-platform/observability/README.md)).

## 1.1. Metric (Prometheus)

| Họ metric | Nhãn chính | Phủ | Ghi chú |
| --- | --- | --- | --- |
| `http_server_request_count_total`, `http_server_request_error_count_total`, `http_server_request_duration_seconds_*` | `service_name`, `http_method`, `http_route_template`, `http_status_class` | 12/12 runtime | Worker chỉ có `/health`, `/ready` |
| `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, `lms_dependency_duration_seconds_*` | `service_name`, `dependency_identity`, `operation_name`, `status` | 42 cặp (service, identity) | `status`: `ok`, `timeout`, `unavailable`, `expected_failure` |
| `process_cpu_time_seconds_total`, `process_memory_usage_bytes` | `service_name` | 12/12 runtime | CPU và RSS theo process |
| `rabbitmq_detailed_queue_messages`, `_ready`, `_unacked`, `rabbitmq_detailed_queue_consumers` | `service_name` (worker tiêu thụ), `dependency_identity` (`<worker>-rabbitmq`), `queue` | 24 queue (12 canonical và 12 `.error`) | Nguồn: broker, không phải runtime; tên queue lấy từ `contracts` |

Cạnh dependency quan sát được (đủ cho dependency graph):

- Cơ sở dữ liệu: `identity-postgres`, `course-postgres`, `media-postgres` (cả `media` và `media-worker`), `notification-postgres` (cả `notification` và `notification-worker`), `scheduler-postgres` (cả `scheduler` và `scheduler-worker`), `ai-postgres` (cả `ai` và `ai-worker`).
- Hạ tầng khác: `media-minio` (`media`, `media-worker`), `notification-smtp`, `ai-llm-provider` (`ai`, `ai-worker`).
- HTTP đồng bộ giữa service: `gateway-{identity,course,media,notification,scheduler,ai}`, `course-media`, `course-ai`, `media-identity`, `notification-worker-identity`, `scheduler-worker-media`, `ai-worker-course`, `ai-worker-media`.
- Xác thực (ADR-004): `<service>-identity-token` (gateway và mọi worker, `course`, `media`) và `<service>-identity-jwks`.

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

12/12 runtime có log; chỉ `service_name` là index label. Mỗi request HTTP (trừ `/health`) có access log `http.server.request`; lỗi dependency có log `dependency.failure` kèm `dependency_identity`, `error_type`, `trace_id`, `span_id` (đã kiểm: `span_id` trỏ đúng span CLIENT lỗi). `trace_id`, `span_id`, `service_version`, `service_instance_id` là structured metadata.

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
| Trace gây nhiễu | `scheduler-worker` tạo trace gốc cho mỗi lần thăm dò DB (mỗi giây) và mọi runtime tạo trace cho `/ready` | RCA engine lọc theo `http_route_template`/`operation_name` |

---

# 2. Quy ước đọc telemetry (ảnh hưởng tới ground truth)

1. **Span PRODUCER thuộc tiến trình relay**, không nhất thiết thuộc service ghi command. Outbox của `notification` có thể được phát bởi process `notification` hoặc `notification-worker` (cùng bảng, claim lần lượt), nên `service.name` của span `lms.commands publish …` chỉ cho biết tiến trình phát. Quy về chủ sở hữu bằng `producer.service_name` trong envelope (không có trong span) hoặc bằng queue đích.
2. **Queue thuộc worker tiêu thụ**: `service_name` của metric broker là tiền tố trước `--` của tên queue. Backlog ở queue `media-worker--*` mô tả `media-worker`, kể cả khi nguyên nhân là nơi khác.
3. **Triệu chứng của lỗi xác thực nằm ở cạnh `<service>-identity-token` của bên gọi**, không nằm ở service đích (mục C6).
4. Metric `lms_dependency_*` của cạnh HTTP do **bên gọi** ghi (`service_name` = bên gọi); span SERVER của bên nhận nằm cùng trace.

---

# 3. Danh mục case phức tạp v0

Tiêu chí (ADR-002): nguyên nhân gốc nằm **ngoài đường request của triệu chứng**; mỗi case có ground truth theo `RunGroundTruth` của [telemetry-and-ground-truth-schema-v1](telemetry-and-ground-truth-schema-v1.md). Trạng thái kiểm chứng ghi rõ: **Đã chạy** (kịch bản gây lỗi chạy thật, số đo ở board), **Đã đo tín hiệu** (các tín hiệu tồn tại, cơ chế gây lỗi chưa chạy), **Giả thuyết** (chuỗi nhân quả chưa kiểm chứng).

Mọi case chạy song song workload k6 để tạo nhiễu; đối chứng thủ công theo [evaluation-protocol-v1](evaluation-protocol-v1.md).

## C1 — Upload hoàn tất bị timeout vì batch thông báo (FB)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Tạo batch thông báo rất lớn (seed R-10: 100000 recipient) và làm chậm `notification-worker` (giới hạn CPU container hoặc `docker pause` theo chu kỳ). Song song student upload ảnh. |
| Triệu chứng | `upload-complete` của `media` chậm hoặc timeout ở `gateway-media`; thumbnail `PENDING` lâu; `media-worker` không lỗi. |
| Ground truth | `fault_type=queue_backlog`, `root_cause_service=notification-worker`, `root_cause_component=notification-worker-rabbitmq`, đường lan: `notification-worker` → broker/PostgreSQL dùng chung → `media-worker` → `media` → `gateway`. |
| Tín hiệu xác nhận | Độ sâu `rabbitmq_detailed_queue_messages_ready{service_name="notification-worker"}` tăng, `consumers` giảm hoặc không đổi, span `notification-smtp smtp.send` dài; `media-worker` CONSUMER bắt đầu muộn so với PRODUCER cùng trace. |
| Trạng thái | **Đã đo tín hiệu**: backlog tăng khi dừng worker và drain sau khi phục hồi (hiện sau ≈ 9 giây), command sai vào `.error`. Chuỗi lan sang `media-worker` là **giả thuyết**: mỗi worker có queue riêng, nên chỉ xảy ra khi broker hoặc PostgreSQL bị tranh chấp tài nguyên; cần chạy thật trước khi dùng làm case đánh giá. |

## C2 — Enroll/quiz submit chậm đột ngột vì export CSV giữ kết nối DB (FC)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Nhiều export CSV khối lượng lớn đồng thời với tải học (enroll, làm quiz). |
| Triệu chứng | Mọi truy vấn của `course` chậm, không có span lỗi; `gateway-course` p95 tăng. |
| Ground truth | `fault_type=db_connection_hold`, `root_cause_service=course`, `root_cause_component=course-postgres`, đường lan: export → `course-postgres` → mọi route `course` → `gateway`. |
| Tín hiệu xác nhận | `lms_dependency_duration_seconds` của `course-postgres` tăng đồng loạt theo mọi `operation_name`; `process_cpu_time_seconds_total` hoặc RSS của `course`; thiếu: độ sử dụng pool (mục 1.5). |
| Trạng thái | **Đã đo tín hiệu** (độ trễ DB, CPU, RSS có thật); metric pool **chưa có**, nên phân biệt "pool cạn" với "DB chậm" chưa làm được. |

## C3 — Job AI soạn bài kẹt `RUNNING` rồi `WORKER_INTERRUPTED` (FD)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Provider LLM giả (HTTP stub) trả chậm hoặc lỗi ngắt quãng; instructor tạo job AI và tài liệu `extract_text`. |
| Triệu chứng | Job AI mãi `RUNNING` rồi `WORKER_INTERRUPTED`; tài liệu mãi `EXTRACTING`; `course` thấy lỗi muộn ở `ai-worker → course`. |
| Ground truth | `fault_type=dependency_latency`, `root_cause_service=ai`, `root_cause_component=ai-llm-provider` (chủ sở hữu `ai`; process chạm provider là `ai-worker`), đường lan: provider → `ai-worker` (giữ lease) → `ai` job/tài liệu → `course`. |
| Tín hiệu xác nhận | Span CLIENT `ai-llm-provider POST chat/completions` dài hoặc lỗi trong trace của luồng "Job AI"; `lms_dependency_duration_seconds{dependency_identity="ai-llm-provider"}`; `ai-worker` CONSUMER `run-ai-job` kéo dài. |
| Trạng thái | **Đã đo tín hiệu**: trace luồng AI đủ `gateway → course → ai → ai-worker → course` kèm span provider. Stub chậm chưa chạy. |

## C4 — Khóa học `READY` nhưng thumbnail mất, job cleanup xóa media (FA)

| Mục | Nội dung |
| --- | --- |
| Kịch bản gây lỗi | Chèn trễ hoặc ngắt kết nối giữa `media` và MinIO trong lúc upload/promote. |
| Triệu chứng | Media `PENDING` kẹt, usage chưa gắn; `scheduler-worker` coi là không dùng và xóa; lỗi lộ muộn ở scheduler. |
| Ground truth | `fault_type=dependency_latency`, `root_cause_service=media`, `root_cause_component=media-minio`, đường lan: MinIO → `media`/`media-worker` → usage trống → `scheduler-worker` cleanup. |
| Tín hiệu xác nhận | Span `media-minio *` chậm hoặc lỗi; `lms_dependency_*{dependency_identity="media-minio"}`; trace "Dọn media theo lịch" có `media-minio remove-object` bất thường về số lượng. |
| Trạng thái | **Đã đo tín hiệu** (span và metric MinIO có ở cả `media` và `media-worker`; trace dọn media có thật). Cơ chế chèn trễ chưa chạy. Scheduler và worker không cùng trace (mục 1.5). |

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
| Tín hiệu xác nhận | Span CLIENT lỗi `gateway-identity-token POST /internal/v1/auth/service-token` và `gateway-identity POST` ở span gốc; trace không có span của service đích; `lms_dependency_error_count_total{dependency_identity="gateway-identity-token"}` tăng; log `dependency.failure` có `span_id` khớp span lỗi. |
| Trạng thái | **Đã chạy** bởi `tracing-smoke`: login 504 ngay; token người dùng còn hạn vẫn 200; lỗi `gateway-identity-token` xuất hiện **72 giây** sau khi dừng `identity` (TTL 60 giây); phục hồi sau `unpause`. Khác với bản đề xuất ban đầu: triệu chứng nằm ở gateway, không phải ở `course`/`media`. |

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
- Metric: 12/12 runtime có RED, CPU, RSS; 42 cạnh dependency đúng danh mục identity; 24 queue đúng chủ sở hữu và consumer.
- Log: 12/12 runtime; `trace_id`/`span_id` khớp span thật ở cả 12 runtime; log lỗi dependency khớp span lỗi; không rò secret.
- Dashboard: mọi query panel trả dữ liệu; data link metric → TraceQL → Loki dùng được.

## 4.2. Lỗi phát hiện và đã sửa

- **Trace bất đồng bộ bị đứt**: relay outbox publish trong context rỗng, nên chuỗi command là trace riêng không nối với request gây ra (ví dụ `[course, media-worker]` không có `gateway`). Sửa ở `RabbitMqCommandPublisher`: không có span hoạt động thì dùng `traceparent` trong envelope làm parent. Có unit test.
- **Identity RabbitMQ không khớp catalogue**: code ghi `rabbitmq` chung; đã đổi thành `<service.name>-rabbitmq`.
- **Metric broker thiếu**: collector chỉ scrape queue v1 đã xóa; đã scrape mọi queue canonical.
- **Danh sách service/cạnh của `packages/observability` còn v1** (kể cả `admin` đã bỏ); đã dọn.
- **Tempo bị OOM-kill** (giới hạn 512 MiB) khi truy vấn hàng nghìn trace song song; smoke truy vấn tuần tự và hạn chế số trace. RCA engine không nên kéo trace hàng loạt từ Tempo của testbed.

---

# 5. Schema kết quả RCA và nơi lưu

> Thuộc mảng AI (ADR-002). R-12 chỉ ghi nhận hợp đồng dữ liệu để RCA engine và MCP thứ yếu thống nhất; không cài đặt. Chưa có thư mục `aiops-platform/training/` hoặc `aiops-platform/mcp/`.

## 5.1. Yêu cầu bắt buộc từ telemetry

Bằng chứng trong kết quả RCA phải tham chiếu lại được telemetry gốc, nên mỗi bằng chứng chứa: `service.name`, `trace_id` và `span_id` (với trace/log), hoặc `metric` + nhãn + khoảng thời gian (với metric). Telemetry đã đáp ứng (mục 1): 12/12 runtime có `service_name`; log có `trace_id`/`span_id`; trace có đủ span. Không có ground truth trong payload nghiệp vụ hay telemetry.

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
| Cài fault injector (chèn trễ MinIO/PostgreSQL/SMTP/LLM stub, giới hạn CPU) và workload k6 | Mảng AI (`aiops-platform/faults/`, `load/`) |
| Chạy thật chuỗi nhân quả C1–C5, C7 (hiện mới đo tín hiệu) trước khi dùng làm case đánh giá | Mảng AI |
| Metric thiếu ở mục 1.5 (pool DB, outbox, publish/consume RabbitMQ, log worker, nối scheduler → worker) | Đức quyết định có làm trước khi thu dataset |
| RCA engine, MCP server, agent | Mảng AI, theo ADR-002 |
