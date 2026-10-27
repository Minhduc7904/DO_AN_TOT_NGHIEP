# Data ownership and fault matrix v2

> **Task:** R-01 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận; ma trận fault và case phức tạp là **v0**, chốt chi tiết ở R-12.
>
> **Thay thế:** [data-ownership-and-fault-matrix-v1](data-ownership-and-fault-matrix-v1.md) (lịch sử).
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [http-and-event-contracts-v2](http-and-event-contracts-v2.md), [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md), [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md).
>
> **Mục đích:** chốt ai sở hữu dữ liệu nào, ràng buộc toàn vẹn quan trọng, và đặt nền cho fault/case demo "AI tìm được, truy vết thủ công không tìm ra".

Schema chi tiết (cột, kiểu, index) nằm trong `prisma/schema.prisma` của từng service. Tài liệu này chỉ chốt bảng, quan hệ sở hữu và ràng buộc có ý nghĩa nghiệp vụ hoặc phục vụ fault.

---

# 1. Nguyên tắc sở hữu

1. Mỗi service sở hữu đúng một logical DB (gateway không có DB). Worker dùng DB của service cùng owner.
2. Một instance PostgreSQL 17 chứa các DB `auth_db`, `student_db`, `course_db`, `media_db`, `notification_db`, `scheduler_db`, `ai_db`; mỗi DB có role riêng, không role nào đọc được DB khác.
3. Tham chiếu chéo service là ID logic (UUID), **không có foreign key** xuyên DB.
4. Dữ liệu bất đồng bộ đi qua outbox/inbox trong DB của chính service; consumer không đọc DB của producer.
5. Migration chỉ do service owner chạy bằng `prisma migrate deploy` khi khởi động; không sửa migration đã áp dụng.
6. Quy ước: cột UUID `@db.Uuid`, thời gian `timestamptz(6)` UTC, enum bằng Prisma enum, tên bảng `snake_case` số nhiều.

---

# 2. Ownership theo service

## 2.1. `auth_db` — auth

| Bảng                  | Nội dung                                                                               | Ghi chú                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `auth_users`          | Tài khoản: email duy nhất, mật khẩu băm, `role` (student/instructor/admin), trạng thái | Mở rộng role từ 2 lên 3; `id` dùng làm `sub` JWT và làm `id` hồ sơ student |
| `auth_refresh_tokens` | Refresh token băm, hạn, thu hồi                                                        | Giữ như hiện tại                                                           |

Seed: một admin cố định (qua `AUTH_BOOTSTRAP_ADMIN_*`), một instructor mẫu và một student mẫu (kèm hồ sơ ở `student`).

## 2.2. `student_db` — student

| Bảng       | Ràng buộc chính                      |
| ---------- | ------------------------------------ |
| `students` | `email` duy nhất; `status` ∈ `ACTIVE | INACTIVE | BLOCKED`; `id`bằng`auth_users.id` (logic) |

## 2.3. `course_db` — course

| Bảng                                        | Nội dung                                           | Ràng buộc chính                                                                                 |
| ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `courses`                                   | Khóa học; `instructor_id` (logic), `status` `DRAFT | PUBLISHED                                                                                       | ARCHIVED`                                                                                                                  | Tên 3–200 ký tự; mô tả markdown |
| `lessons`                                   | Bài học markdown                                   | Duy nhất `(course_id, display_order)`                                                           |
| `enrollments`                               | Ghi danh                                           | Duy nhất `(course_id, student_id)`                                                              |
| `lesson_progresses`                         | Tiến độ bài học                                    | Một dòng cho mỗi `(enrollment, lesson)`                                                         |
| `quizzes`, `quiz_questions`, `quiz_options` | Cây quiz; câu `SINGLE_CHOICE                       | MULTIPLE_CHOICE`, điểm 0–100                                                                    | Khóa sửa khi đã có attempt                                                                                                 |
| `quiz_attempts`                             | Lượt làm; `status` `IN_PROGRESS                    | SUBMITTED`, điểm và điểm tối đa                                                                 | **Partial unique index** `(quiz_id, student_id) WHERE status = 'IN_PROGRESS'` (thay cột generated `open_marker` của MySQL) |
| `quiz_attempt_answers`                      | Đáp án đã chọn                                     |                                                                                                 |
| `lesson_attachment_texts`                   | Văn bản trích từ tài liệu đính kèm                 | Trạng thái trích; lease `FOR UPDATE SKIP LOCKED`; tối đa 3 lần, lease 10 phút                   |
| `lesson_ai_jobs`                            | Job `SYNTHESIZE_LESSON`/`GENERATE_QUIZ`            | Một job active cho mỗi `(lesson, type)` (partial unique index); giữ `previous_content_markdown` |
| `outbox_messages`                           | Command chờ phát                                   | Relay trong process `course`                                                                    |

Course không sở hữu file hay URL media; chỉ lưu `media_id` trong markdown và gọi media để lấy URL.

## 2.4. `media_db` — media, media-worker

| Bảng                              | Nội dung                                                                                                                                                                                                                                                             | Ràng buộc chính                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `media_objects`                   | Metadata object MinIO; `status` `PENDING                                                                                                                                                                                                                             | READY                                                                                                                               | FAILED`; `source_media_id` cho thumbnail; xóa mềm | Không lộ bucket/key cho client          |
| `media_usages`                    | Liên kết media ↔ owner (`COURSE`, `NOTIFICATION`, `STUDENT`, `MEDIA`) với `owner_type` (`COURSE_THUMBNAIL`, `COURSE_GALLERY`, `COURSE_DESCRIPTION`, `LESSON_CONTENT`, `LESSON_ATTACHMENT`, `QUIZ_CONTENT`, `NOTIFICATION_BODY`, `STUDENT_AVATAR`, `MEDIA_THUMBNAIL`) | Partial unique index: một thumbnail active mỗi course, một avatar mỗi student; chỉ ảnh gốc `READY` mới làm thumbnail/gallery/avatar |
| `media_background_jobs`           | Job `THUMBNAIL_DERIVATION                                                                                                                                                                                                                                            | MARKDOWN_USAGE_SYNC                                                                                                                 | MEDIA_USAGE_DELETE                                | NOTIFICATION_USAGE`; trạng thái `QUEUED | PROCESSING | COMPLETED | PARTIAL_FAILED | FAILED` | `deduplication_key` duy nhất; có bộ đếm |
| `outbox_messages`, `inbox_states` | Outbox của `media`; inbox của `media-worker`                                                                                                                                                                                                                         |                                                                                                                                     |

MinIO: bucket `images`, `videos`, `documents`, `audios`, `other` do `media` sở hữu; không service khác truy cập MinIO.

## 2.5. `notification_db` — notification, notification-worker

| Bảng                              | Nội dung                                                                         | Ràng buộc chính         |
| --------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| `notifications`                   | Hộp thư student: `source_type` `SINGLE                                           | BULK`, `status` `UNREAD | READ`, kênh gửi                       | Chỉ tạo khi gửi thành công (batch) hoặc tạo đơn                                      |
| `notification_batches`            | Trạng thái `PENDING → SNAPSHOTTING → SNAPSHOT_READY → PROCESSING → COMPLETED     | PARTIAL_FAILED          | FAILED`; `target_scope` `ALL_STUDENTS | FAILED_RECIPIENTS`; `batch_size`mặc định 500, tối đa 1000;`requested_count` ≤ 100000 | `source_batch_id` duy nhất: một batch nguồn chỉ có một batch retry |
| `notification_batch_items`        | Từng recipient: `PENDING                                                         | PROCESSING              | SUCCESS                               | RETRY                                                                                | FAILED`, `lease_token`, `lease_expires_at`, email người nhận       | Chèn idempotent (`ON CONFLICT DO NOTHING`) khi snapshot; claim bằng lease |
| `outbox_messages`, `inbox_states` | Outbox của `notification`/`notification-worker`; inbox của `notification-worker` |                         |

SMTP (`notification-smtp`) thuộc `notification-worker`; email người nhận được snapshot vào item để worker không gọi lại student khi gửi/retry.

## 2.6. `scheduler_db` — scheduler, scheduler-worker

| Bảng                  | Ràng buộc chính                         |
| --------------------- | --------------------------------------- |
| `background_jobs`     | `schedule_type` `MANUAL                 | CRON`, `cron_expression`, `status` `ACTIVE     | PAUSED | DISABLED`, `allow_concurrent`, `max_retry_count`, `timeout_seconds`, `next_run_at` |
| `background_job_runs` | `trigger_type`, `status` (có `TIMED_OUT | SKIPPED`), `idempotency_key` duy nhất theo job |

## 2.7. `ai_db` — ai

| Bảng                  | Ràng buộc chính                                                        |
| --------------------- | ---------------------------------------------------------------------- |
| `ai_providers`        | `type` `OPENAI                                                         | GEMINI | ANTHROPIC | MISTRAL | CUSTOM`, `base_url`, `api_key_encrypted`(AES-256-GCM),`api_key_hint` |
| `ai_models`           | Model thuộc provider                                                   |
| `ai_service_bindings` | `task_key` duy nhất → model                                            |
| `ai_invocations`      | Nhật ký gọi: task, token, độ trễ, mã lỗi (không lưu nội dung nhạy cảm) |

## 2.8. Không có DB

`gateway` không sở hữu dữ liệu.

---

# 3. Tham chiếu logic chéo service

| Từ           | Trường                                                            | Tới                         | Ghi chú                                   |
| ------------ | ----------------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| course       | `courses.instructor_id`                                           | auth (`auth_users.id`)      | Không xác thực tồn tại lúc ghi; tin JWT   |
| course       | `enrollments.student_id`                                          | student                     | Tin JWT                                   |
| course       | `media_id` trong markdown                                         | media                       | Đồng bộ qua command, không ràng buộc cứng |
| media        | `media_usages.owner_id`                                           | course/student/notification | Theo `owner_service` + `owner_type`       |
| notification | `notifications.student_id`, `notification_batch_items.student_id` | student                     | Snapshot email tại thời điểm tạo item     |
| student      | `students.id`                                                     | auth                        | Cùng `id` với tài khoản                   |
| scheduler    | job `MEDIA_UNUSED_CLEANUP`                                        | media                       | Qua `/internal/v1/media/cleanup`          |

Mất đồng bộ giữa các ID này (ví dụ student bị xóa nhưng còn enrollment) là hành vi có thể quan sát được và phục vụ fault, không sửa bằng ràng buộc xuyên DB.

---

# 4. Hạ tầng chung

| Thành phần       | Chủ sở hữu            | Quy tắc                                                                                                                                           |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL 17    | Compose LMS           | 7 logical DB + 7 role; `POSTGRES_DB` mặc định không dùng cho nghiệp vụ                                                                            |
| RabbitMQ         | Compose LMS           | Exchange `lms.commands`; queue theo `<consumer>--<command>-v<n>`; vhost riêng cho LMS; metric broker được collector trong `aiops-platform` scrape |
| MinIO            | `media`               | Bucket do `minio-init` tạo; access key riêng cho `media`/`media-worker`                                                                           |
| Mailpit / SMTP   | `notification-worker` | Dev/CI dùng Mailpit; production đổi biến môi trường SMTP                                                                                          |
| Nhà cung cấp LLM | `ai`                  | Test dùng HTTP stub OpenAI-compatible                                                                                                             |

---

# 5. Ma trận fault v0

Mục tiêu v2: các fault phải tạo triệu chứng **không nằm ở nơi nguyên nhân gốc**, thông qua dependency dùng chung (RabbitMQ, PostgreSQL pool, MinIO) và chuỗi async. Cơ chế inject chi tiết (hook bằng biến môi trường/endpoint nội bộ, hay proxy chèn trễ cho MinIO/PostgreSQL/SMTP/LLM stub) do R-12 chốt; yêu cầu bắt buộc là bật/tắt được, tái lập được, có ground truth, và không đổi code nghiệp vụ.

| Fault  | Loại                  | Root-cause service       | Component               | Cách tạo (đề xuất)                                        | Tín hiệu quan sát                           | Triệu chứng dự kiến                                      |
| ------ | --------------------- | ------------------------ | ----------------------- | --------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| **FA** | Độ trễ phụ thuộc      | `media` / `media-worker` | `media-minio`           | Chèn trễ/ngắt kết nối MinIO                               | Span MinIO chậm, thumbnail `PROCESSING` kẹt | upload-complete timeout ở gateway, usage sync trễ        |
| **FB** | Backlog hàng đợi      | `notification-worker`    | `notification-rabbitmq` | Chạy batch lớn kèm làm chậm dispatch                      | Độ sâu queue, tuổi message cũ nhất          | thumbnail của `media-worker` chậm, command `course` trễ  |
| **FC** | Giữ kết nối DB        | `course`                 | `course-postgres`       | Export CSV streaming khối lượng lớn đồng thời với tải học | Pool utilization, độ trễ truy vấn           | enroll/quiz submit chậm, không có span lỗi               |
| **FD** | Độ trễ nhà cung cấp   | `ai`                     | `ai-llm-provider`       | Stub LLM chậm hoặc trả lỗi ngắt quãng                     | Span provider, lease hết hạn, retry job     | job AI retry chồng, outbox backlog                       |
| **FE** | Độ trễ dependency nhỏ | `student`                | `student-postgres`      | Chèn trễ truy vấn                                         | Span student chậm ở snapshot                | batch `PARTIAL_FAILED`, số liệu lệch, log không có error |
| **FF** | Quá tải tài nguyên    | bất kỳ service           | instance                | Giới hạn CPU/bộ nhớ container                             | CPU/RSS, độ trễ, tỉ lệ lỗi                  | latency/error lan theo dependency                        |

Mỗi lần chạy phải ghi ground truth theo [telemetry-and-ground-truth-schema](telemetry-and-ground-truth-schema-v0.md) (sẽ cập nhật ở R-12): `root_cause_service`, `component`, `fault_type`, thời điểm bắt đầu/kết thúc, `run_id`, cường độ. Ground truth không đưa vào payload nghiệp vụ.

---

# 6. Danh mục case phức tạp v0 (cho demo AI vs thủ công)

Tiêu chí: một người đọc dashboard/trace thông thường theo đường request của triệu chứng sẽ không thấy nguyên nhân; chuỗi nhân quả đi qua dependency dùng chung hoặc tầng async.

| Case   | Triệu chứng người dùng                                      | Nguyên nhân gốc                            | Chuỗi nhân quả                                                                                                | Vì sao khó truy vết thủ công                                                       |
| ------ | ----------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **C1** | `upload-complete` timeout                                   | FB: batch notification làm đầy RabbitMQ    | `notification-worker` chiếm queue/DB → command thumbnail của `media-worker` đứng chờ → `media` đợi trạng thái | Span lỗi ở `media`, nguyên nhân ở service khác không có trên đường request         |
| **C2** | Enroll/quiz submit chậm đột ngột                            | FC: export CSV của `course` giữ kết nối DB | Pool cạn → mọi truy vấn xếp hàng                                                                              | Trace không có span lỗi, mọi span chậm đều thuộc `course`, không rõ do request nào |
| **C3** | Job AI soạn bài mãi `RUNNING`, usage media trễ              | FD: provider AI chậm                       | Lease hết hạn → retry chồng → outbox backlog → `media-worker` trễ                                             | Hai triệu chứng ở hai service, chung nguyên nhân gián tiếp                         |
| **C4** | Khóa học `READY` nhưng thumbnail mất, job cleanup xóa media | FA: MinIO promote chậm                     | Media `PENDING` kẹt → usage chưa gắn → `scheduler-worker` coi là không dùng và xóa                            | Lỗi lộ ở scheduler muộn, cách nguyên nhân gốc nhiều bước và nhiều phút             |
| **C5** | Batch notification `PARTIAL_FAILED`, số item lệch           | FE: `student` chậm khi snapshot            | Snapshot timeout từng trang → thiếu recipient                                                                 | Log không có lỗi, chỉ lệch số liệu so với kỳ vọng                                  |

Mỗi case dùng workload chạy song song (k6) để tạo nhiễu. Đối chứng thủ công: baseline tự động (ngưỡng + trace lỗi/chậm nhất) và thử nghiệm người nhỏ theo [ADR-002](../adr/adr-002-ai-primary-root-cause-analysis-v1.md).

---

# 7. Khác biệt v1 → v2

| Mục            | v1                                                | v2                                                |
| -------------- | ------------------------------------------------- | ------------------------------------------------- |
| Database       | 5 DB, SQL tay `pg`, `migrate.ts`                  | 7 DB, Prisma migration                            |
| Outbox         | Cột publish trong `grades`                        | Bảng `outbox_messages`/`inbox_states` mỗi service |
| Cache          | Redis của Course                                  | Bỏ                                                |
| Object storage | Storage Mock in-memory                            | MinIO thuộc `media`                               |
| Fault          | F1–F5 (Redis, Storage Mock, error, consumer, CPU) | FA–FF + case C1–C5                                |
| Ground truth   | theo F1–F5                                        | theo FA–FF, cập nhật schema ở R-12                |

---

# 8. Xác nhận cần có

- [ ] Đức xác nhận ownership và danh sách bảng mục 2–4.
- [ ] Đức xem lại ma trận fault v0 (mục 5) và case C1–C5 (mục 6) trước R-12.

| Trường         | Giá trị                                                                           |
| -------------- | --------------------------------------------------------------------------------- |
| Người xác nhận | Đức (theo chỉ thị trực tiếp: refactor do một mình Đức làm, không cần Bách review) |
| Trạng thái     | `PENDING`                                                                         |
