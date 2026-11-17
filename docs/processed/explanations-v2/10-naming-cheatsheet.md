# Bảng tra tên định danh testbed v2

> **File này giải thích gì:** bảng tra nhanh các tên cố định khi đọc metric, trace, log của testbed LMS v2: 11 `service.name`, `dependency_identity` theo runtime, quy tắc đặt tên, queue và command, `operation_name`, mã lỗi, biến môi trường quan trọng cho RCA, tên dễ nhầm, tên cũ v1 → v2.
>
> **Nguồn gốc (canonical):** [`../architecture/service-catalogue-and-topology-v2.md`](../architecture/service-catalogue-and-topology-v2.md) (mục 2, 6); [`../architecture/dependency-resilience-policy-v2.md`](../architecture/dependency-resilience-policy-v2.md) (mục 2, 8); [`../architecture/http-and-event-contracts-v2.md`](../architecture/http-and-event-contracts-v2.md) (mục 2, 6); [`../architecture/complex-case-catalogue-and-rca-result-v0.md`](../architecture/complex-case-catalogue-and-rca-result-v0.md) (mục 1, 2); [`../adr/adr-005-merge-auth-student-into-identity-v1.md`](../adr/adr-005-merge-auth-student-into-identity-v1.md); code [`../../../lms/test/observability/metrics-smoke.mjs`](../../../lms/test/observability/metrics-smoke.mjs), [`../../../lms/contracts/src/commands/`](../../../lms/contracts/src/commands/), [`../../../lms/packages/observability/src/http-client-span-attributes.ts`](../../../lms/packages/observability/src/http-client-span-attributes.ts), [`../../../docker-compose/compose.yaml`](../../../docker-compose/compose.yaml).
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> Trạng thái tại: 17/11/2026 (tuần 16 theo lịch)

Đi kèm [kiến trúc testbed v2](04-testbed-architecture.md); khái niệm trace/span/metric/label xem [khái niệm nền](02-basic-concepts.md).

## 1. Nhận diện loại tên trong 5 giây

Mẹo: **nhìn dấu phân cách trước, rồi nhìn vế sau.**

| Dấu hiệu | Loại tên | Ví dụ |
| --- | --- | --- |
| Một từ, hoặc `<x>-worker` | `service.name` | `course`, `media-worker` |
| Vế sau là `postgres`, `minio`, `smtp`, `llm-provider`, `rabbitmq` | Dependency hạ tầng | `course-postgres` |
| Vế sau là tên service | Cạnh HTTP (bên gọi trước) | `course-media` |
| Đuôi `-identity-token` / `-identity-jwks` | Cạnh xác thực | `gateway-identity-token` |
| Có **hai gạch nối** `--` | Queue RabbitMQ | `ai-worker--run-ai-job-v1` |
| Có **dấu chấm** | Command | `ai.job.run` |
| Đuôi `_db` / `_user` | Database / role PostgreSQL | `course_db`, `course_user` |
| `eNN` | Mã cạnh trong catalogue | `e27` |

## 2. Mười một `service.name`

Thuộc tính `service.name` của OpenTelemetry, thành nhãn `service_name` trong Prometheus/Loki. Không dùng tên container thay thế.

| `service.name` | Loại | Cổng network (host) | Database |
| --- | --- | --- | --- |
| `gateway` | service | 3000 (3000) | không |
| `identity` | service | 3001 (3001) | `identity_db` |
| `course` | service | 3003 (3003) | `course_db` |
| `media` / `media-worker` | service / worker | 3004 / 3005 | `media_db` + MinIO |
| `notification` / `notification-worker` | service / worker | 3006 / 3007 | `notification_db` |
| `scheduler` / `scheduler-worker` | service / worker | 3008 (**host 3018**) / 3010 | `scheduler_db` |
| `ai` / `ai-worker` | service / worker | 3009 / 3011 | `ai_db` |

Candidate set RCA mặc định: 10 tên, bỏ `gateway` (nơi triệu chứng hiện ra).

## 3. Quy tắc đặt `dependency_identity`

| Loại | Dạng | Ghi chú |
| --- | --- | --- |
| Database | `<service chủ>-postgres` | Worker **mượn tên chủ**: `media-worker` ghi `media-postgres` |
| Hạ tầng khác | `media-minio`, `notification-smtp`, `ai-llm-provider` | Cố định, dùng chung cho service và worker cùng chủ |
| HTTP | `<caller>-<callee>` | Bên gọi ghi metric |
| Xin service token | `<caller>-identity-token` | |
| Tải JWKS | `<service>-identity-jwks` | |
| RabbitMQ | `<process>-rabbitmq` | Worker **dùng tên mình**: `media-worker-rabbitmq` |

## 4. `dependency_identity` theo runtime

`✓` = có trong `EXPECTED_DEPENDENCIES` của `metrics-smoke.mjs` (bắt buộc thấy sau traffic regression). RabbitMQ chỉ có span, không có metric `lms_dependency_*`.

| Runtime | Hạ tầng | HTTP | Xác thực | RabbitMQ |
| --- | --- | --- | --- | --- |
| `gateway` | — | `gateway-{identity,course,media,notification,scheduler,ai}` ✓ | `gateway-identity-token` ✓, `gateway-identity-jwks` ✓ | — |
| `identity` | `identity-postgres` ✓ | — | — (verify bằng khóa cục bộ) | — |
| `course` | `course-postgres` ✓ | `course-media` ✓, `course-ai` ✓ | `course-identity-token`, `course-identity-jwks` | `course-rabbitmq` |
| `media` | `media-postgres` ✓, `media-minio` ✓ | `media-identity` | `media-identity-token`, `media-identity-jwks` | `media-rabbitmq` |
| `media-worker` | `media-postgres` ✓, `media-minio` ✓ | — | — | `media-worker-rabbitmq` |
| `notification` | `notification-postgres` ✓ | — | `notification-identity-jwks` | `notification-rabbitmq` |
| `notification-worker` | `notification-postgres` ✓, `notification-smtp` ✓ | `notification-worker-identity` ✓ | `notification-worker-identity-token` | `notification-worker-rabbitmq`, `notification-rabbitmq` (relay, mục 9) |
| `scheduler` | `scheduler-postgres` ✓ | — | `scheduler-identity-jwks` | — |
| `scheduler-worker` | `scheduler-postgres` ✓ | `scheduler-worker-media` ✓ | `scheduler-worker-identity-token` | — |
| `ai` | `ai-postgres` ✓, `ai-llm-provider` ✓ | — | `ai-identity-jwks` | `ai-rabbitmq` |
| `ai-worker` | `ai-postgres` ✓, `ai-llm-provider` ✓ | `ai-worker-course` ✓, `ai-worker-media` ✓ | `ai-worker-identity-token` | `ai-worker-rabbitmq` |

Đếm nhanh: 13 cạnh HTTP, 6 bên xin token (bên gọi HTTP), 6 bên tải JWKS (bên nhận request; worker không tải), 6 database, 7 tên RabbitMQ. Lần đo 30/10/2026 thấy 38 cặp (`service_name`, `dependency_identity`) trong metric.

## 5. Queue và command

Command `<miền>.<đối tượng>.<hành động>`; queue `<worker>--<hành động>-<đối tượng>-v<n>`. Exchange duy nhất `lms.commands` (direct). Mỗi queue có `<queue>.error`: tổng 12 + 12 = **24 queue**.

| `command_name` | Producer | Queue |
| --- | --- | --- |
| `media.thumbnail.generate` | media | `media-worker--generate-media-thumbnail-v1` |
| `media.markdown-usage.synchronize` | course | `media-worker--synchronize-markdown-media-usage-v1` |
| `media.usages.delete-by-ids` | course | `media-worker--delete-media-usages-by-ids-v1` |
| `media.notification-usage.register` | notification | `media-worker--register-notification-media-usage-v1` |
| `media.notification-usage.register-batch` | notification-worker | `media-worker--register-notification-media-usages-v1` |
| `media.notification-usage.start-job` | notification | `media-worker--start-notification-media-usage-job-v1` |
| `media.notification-usage.complete-job` | notification-worker | `media-worker--complete-notification-media-usage-job-v1` |
| `notification.batch.snapshot` | notification | `notification-worker--snapshot-notification-batch-v1` |
| `notification.batch.dispatch` | notification-worker (tự gửi) | `notification-worker--dispatch-notification-batch-v1` |
| `notification.single.dispatch` | notification | `notification-worker--dispatch-single-notification-v1` |
| `ai.document.extract` | ai, media | `ai-worker--extract-ai-document-v1` |
| `ai.job.run` | ai | `ai-worker--run-ai-job-v1` |

Span: PRODUCER `lms.commands publish <command_name>`, CONSUMER `<queue> process`. Metric broker có nhãn `queue`, `service_name` = worker tiêu thụ, `dependency_identity` = `<worker>-rabbitmq`.

## 6. Metric và `operation_name`

| Metric (Prometheus) | Nhãn chính |
| --- | --- |
| `http_server_request_count_total`, `…_error_count_total`, `…_duration_seconds_*` | `service_name`, `http_method`, `http_route_template`, `http_status_class` |
| `lms_dependency_request_count_total`, `…_error_count_total`, `…_duration_seconds_*` | `service_name`, `dependency_identity`, `operation_name`, `status` |
| `process_cpu_time_seconds_total`, `process_memory_usage_bytes` | `service_name` |
| `rabbitmq_detailed_queue_messages[_ready/_unacked]`, `rabbitmq_detailed_queue_consumers` | `queue`, `service_name`, `dependency_identity` |

`status` chỉ có `ok`, `timeout`, `unavailable`, `expected_failure` (provider LLM từ chối hoặc sai xác thực). Span CLIENT tên `<dependency_identity> <operation_name>`.

| `dependency_identity` | Ví dụ `operation_name` |
| --- | --- |
| `gateway-<service>` | `GET`, `POST` (chỉ HTTP method) |
| HTTP nội bộ | `GET /internal/v1/students/:studentId`, `GET /internal/v1/ai/jobs/:jobId`, `GET /internal/v1/media/:mediaId/content` (route template, từ 17/11/2026) |
| `<caller>-identity-token` / `<service>-identity-jwks` | `POST /internal/v1/auth/service-token` / `GET jwks` |
| `<service>-postgres` | `quiz-attempt.create`, `account.create`, `job.claim` |
| `media-minio` | `presign-upload`, `stat-object`, `get-object`, `remove-object`, `ping` |
| `notification-smtp` / `ai-llm-provider` | `smtp.send` / `POST chat/completions`, `GET models` |
| `*-rabbitmq` (span) | `publish`, `consume` |

## 7. Mã lỗi hay gặp

| HTTP | `error.code` | Đọc thế nào |
| ---: | --- | --- |
| 503 | `DEPENDENCY_UNAVAILABLE` | Bên dưới mất kết nối, trả 5xx, sai khuôn, hoặc cầu dao mở; xem `details.dependency` |
| 504 | `DEPENDENCY_TIMEOUT` | Bên dưới quá hạn; xem `details.dependency` |
| 401 | `SERVICE_TOKEN_INVALID` | Token sai chữ ký/`aud`/hạn; nghi khóa ký đổi (C7) |
| 401 | `SERVICE_TOKEN_MISSING`, `TOKEN_TYPE_MISMATCH` | Thiếu token / dùng nhầm loại |
| 401 | `SERVICE_CLIENT_INVALID` | Sai `client_id`/`client_secret`: cấu hình, **không** phải `identity` chết |
| 403 | `SERVICE_SCOPE_FORBIDDEN` | Thiếu scope / xin ngoài sổ đăng ký |
| 400, 401, 403, 404, 409 | `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` | Lỗi nghiệp vụ, **không phải sự cố** |
| 500 / 502 | `INTERNAL_ERROR` / `AI_PROVIDER_ERROR` | Lỗi không phân loại / provider LLM lỗi |

Mã ghi trong bản ghi (không phải HTTP): `WORKER_INTERRUPTED` (job AI), `EXTRACTION_INTERRUPTED` (tài liệu AI), `RUN_LEASE_EXPIRED`, `MEDIA_CLEANUP_INCOMPLETE`, `MEDIA_CLEANUP_REJECTED` (run scheduler), `UPLOAD_ABANDONED` (media). `error.type` trên span: `timeout`, `unavailable`, `client_aborted`. Log lỗi dependency: `event=dependency.failure`.

## 8. Biến môi trường quan trọng cho RCA

Giá trị là mặc định code; ghi "Compose" khi Compose đặt khác.

| Biến | Giá trị | Liên quan |
| --- | --- | --- |
| `IDENTITY_SERVICE_TOKEN_TTL_SECONDS` | 600 | Khoảng yên lặng của C6 |
| `IDENTITY_JWKS_CACHE_TTL_MS`, `IDENTITY_JWKS_MIN_REFETCH_MS` | 300.000; 10.000 | Độ trễ lộ lỗi C7 |
| `IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY` | `false`, Compose `true` | Khởi động lại `identity` = đổi khóa |
| `GATEWAY_UPSTREAM_TIMEOUT_MS` | 30.000, Compose **5.000** | Hạn chờ cửa ngoài |
| `COURSE_MEDIA_TIMEOUT_MS`, `COURSE_AI_TIMEOUT_MS` | 3.000; 5.000 | |
| `MEDIA_IDENTITY_TIMEOUT_MS`, `NOTIFICATION_IDENTITY_TIMEOUT_MS` | 3.000 | C5 |
| `SCHEDULER_MEDIA_TIMEOUT_MS` | 60.000 | Dọn media |
| `AI_COURSE_TIMEOUT_MS`, `AI_MEDIA_CONTENT_TIMEOUT_MS` | 5.000; 30.000 | |
| `IDENTITY_TOKEN_TIMEOUT_MS`, `IDENTITY_JWKS_TIMEOUT_MS` | 3.000 | |
| `<TIỀN_TỐ>_BREAKER_THRESHOLD`, `_BREAKER_COOLDOWN_MS` | 3; 5.000 | Cầu dao |
| `AI_COMPLETION_TIMEOUT_MS`, `AI_WORKER_LEASE_MS` | 240.000; 600.000 | C3 |
| `<SVC>_OUTBOX_POLL_MS`, `_BATCH_SIZE`, `_LEASE_MS` | 500; 20; 30.000 | Độ trễ phát command |
| `<WORKER>_PREFETCH`, `_MAX_ATTEMPTS`, `_RETRY_DELAY_MS` | 4/4/2; 5; 1.000 | Khi nào vào `.error` |
| `NOTIFICATION_ITEM_MAX_ATTEMPTS`, `NOTIFICATION_ITEM_RETRY_DELAY_MS` | 3; 1.000 | `PARTIAL_FAILED` |
| `SCHEDULER_RUN_LEASE_MS`, `SCHEDULER_RUN_MAX_ATTEMPTS` | 120.000; 3 | `RUN_LEASE_EXPIRED` |
| `MEDIA_CLEANUP_DEFAULT_RETENTION_HOURS`, `MEDIA_CLEANUP_PENDING_GRACE_MINUTES` | 168; 15 | C4 |
| `OTEL_METRIC_EXPORT_INTERVAL` | Compose 5.000 | Metric trễ ~4–10 giây |

## 9. Tên dễ nhầm

- **`identity` và `dependency_identity`:** service và tên nhãn; `dependency_identity="identity-postgres"` là DB của service `identity`.
- **`gateway-identity` và `gateway-identity-token`/`-jwks`:** thứ nhất là Gateway chuyển request đăng nhập/hồ sơ; hai cái sau là Gateway xin thẻ, tải khóa cho chính nó.
- **`notification-rabbitmq` trong span của `notification-worker`:** relay outbox của worker dùng chung lớp `OutboxRelayService` ghi cứng `notification-rabbitmq` (`lms/services/notification/src/adapters/messaging/outbox-relay.service.ts` dòng 34). Span PRODUCER do worker relay có `service_name=notification-worker` nhưng `dependency_identity=notification-rabbitmq`; phần consume/retry dùng `notification-worker-rabbitmq`.
- **`…register-notification-media-usage-v1` và `…usages-v1`:** số ít là thông báo đơn, số nhiều là theo lô.
- **`/api/v1/student/...` và `/api/v1/students/...`:** không "s" là route học (`course`); có "s" là hồ sơ (`identity`).
- **`EXTRACTING` và `PROCESSING`:** cùng trạng thái tài liệu AI; `course` hiển thị cái trước, `ai` lưu cái sau.
- **`http_route_template`, `operation_name`, `http_route`:** route phía server (metric), thao tác phía bên gọi (dependency), field trong log.
- **`e03`, `e09`:** đã bỏ ở R-13, giữ số.

## 9b. Tên mới của tuần 13 (PR #75–#79, chưa merge lúc viết)

| Tên | Là gì | Ở đâu |
| --- | --- | --- |
| `toxiproxy` | Proxy TCP chèn trễ/cắt kết nối lúc đang chạy (API cổng 8474 trên máy) | `aiops-platform/faults/compose.faults.yaml` |
| `course-to-postgres` | Proxy `course` → PostgreSQL (C2), ảnh hưởng `course-postgres` | `toxiproxy.json` |
| `media-to-minio`, `media-worker-to-minio` | Proxy tới MinIO của `media` và `media-worker` (C4), ảnh hưởng `media-minio` | `toxiproxy.json` |
| `llm-stub` | Provider LLM giả chỉnh được trễ/lỗi (C3); trong network là `http://llm-stub:8080/v1`, trên máy cổng 18081 | `aiops-platform/faults/llm-stub/` |
| `fault-control.mjs` | CLI bật/tắt fault, in một dòng JSON có thời điểm | `aiops-platform/faults/` |
| `run-k6.sh level-1` | Chạy workload k6 mức 1 bằng image `grafana/k6:1.3.0` | `aiops-platform/load/` |
| `aiops-training export` / `quality` | Export telemetry ra Parquet; kiểm chất lượng (`quality-report.json`) | `aiops-platform/training/` |
| `telemetry.v2` | Phiên bản schema cột của artifact export | `telemetry-data-dictionary-v2.md` |
| `telemetry_silent` | Cờ: bộ đếm CPU của runtime không tăng quá 30 s (runtime chết/bị pause) | quality report |
| `not_instrumented` | Trạng thái: tín hiệu chưa được code phát (ví dụ log của 4 worker) | quality report |
| mức 2+ | Phát lại phiên thật của học viên từ log Moodle (ADR-007) | `workload-design-v1.md` mục 13 |
| E1–E8 | Tám nhóm bằng chứng đóng góp của RCA engine (ADR-007) | `research-defense/03-proving-ai-contribution.md` |
| SimpleRCA, BARO | Hai baseline đã công bố sẽ cài ở tuần 17 | `[L-Fang2025]`, `[L-BARO]` trong literature-matrix-v1 |

## 10. Tên cũ v1 (trước refactor) → v2

| Trước refactor | v2 |
| --- | --- |
| `auth`, `student`; `auth_db`, `student_db`; `auth-postgres`; `gateway-auth` | `identity`; `identity_db`; `identity-postgres`; `gateway-identity` (ADR-005) |
| `<caller>-auth-token`, `<caller>-auth-jwks` (bản đầu ADR-004); biến `AUTH_*`, `MEDIA_STUDENT_*`, `NOTIFICATION_STUDENT_*` | `<caller>-identity-token`, `<caller>-identity-jwks`; `IDENTITY_*`, `MEDIA_IDENTITY_*`, `NOTIFICATION_IDENTITY_*` |
| `enrollment`, `submission`, `grading`; `admin` (đề xuất ADR-001) | Ghi danh, quiz attempt vào `course`; admin chỉ là role (ADR-003) |
| `course-redis`; `submission-storage` (Storage Mock) | Bỏ Redis; `media-minio` (MinIO thật) |
| Event `grade.completed`, `event_id`; `grading-rabbitmq` | Command qua `lms.commands`, `message_id`; 7 tên `<process>-rabbitmq` |
| `operation_name` `exists`, `check`, `put`, `get` | `<METHOD> <route template>` |
| Mã cạnh `e01–e20`; fault F1–F5 | `e01–e29` (bỏ `e03`, `e09`); FA–FH, case C1–C7. **Cùng số, khác nghĩa**: v1 `e10` là submission → storage, v2 `e10` là course → media |

## Tóm tắt

- 11 `service.name`; candidate set RCA 10 (bỏ `gateway`).
- Dấu phân cách: `--` là queue, `.` là command, `_db` là database, `-` là tên telemetry.
- Sáu quy tắc `dependency_identity`: `<chủ>-postgres`, ba tên hạ tầng cố định, `<caller>-<callee>`, `<caller>-identity-token`, `<service>-identity-jwks`, `<process>-rabbitmq`.
- 13 cạnh HTTP, 6 bên xin token, 6 bên tải JWKS, 24 queue.
- `operation_name` là route template, không chứa ID; Gateway chỉ ghi HTTP method.
- `DEPENDENCY_*` luôn kèm `details.dependency`; 4xx nghiệp vụ không phải sự cố.
- Mã cạnh v1 và v2 trùng số khác nghĩa: luôn ghi phiên bản khi trích.

## Câu hỏi tự kiểm tra

1. `media-worker` truy cập PostgreSQL và RabbitMQ ghi `dependency_identity` gì?
<details><summary>Đáp án</summary>

`media-postgres` (mượn tên chủ) và `media-worker-rabbitmq` (tên của process).

</details>

2. `ai-worker` gọi LLM thì tên dependency là gì?
<details><summary>Đáp án</summary>

`ai-llm-provider`, giống `ai`; phân biệt bằng `service_name`.

</details>

3. Từ queue `notification-worker--dispatch-notification-batch-v1` đọc được gì?
<details><summary>Đáp án</summary>

Consumer `notification-worker`, command `notification.batch.dispatch`, schema phiên bản 1; queue lỗi là `…-v1.error`.

</details>

4. Runtime nào có `<service>-identity-jwks`, runtime nào có `<caller>-identity-token`?
<details><summary>Đáp án</summary>

JWKS: `gateway`, `course`, `media`, `notification`, `scheduler`, `ai`. Token: `gateway`, `course`, `media`, `notification-worker`, `scheduler-worker`, `ai-worker`.

</details>

5. Thấy `401 SERVICE_CLIENT_INVALID` có nghĩa `identity` chết không?
<details><summary>Đáp án</summary>

Không, đó là cấu hình client sai. `identity` chết thì thấy `DEPENDENCY_TIMEOUT`/`DEPENDENCY_UNAVAILABLE` với `details.dependency=<caller>-identity-token`.

</details>
