# HTTP and command contracts v2

> **Task:** R-01 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận.
>
> **Thay thế:** [http-and-event-contracts-v1](http-and-event-contracts-v1.md) (lịch sử).
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md).
>
> **Mục đích:** chốt quy ước chung, danh mục route, ma trận role và danh mục command để các service được scaffold và ghép mà không vỡ ranh giới. Request/response chi tiết từng endpoint không nằm ở đây mà được viết bằng zod trong `lms/contracts/` cùng từng service; tài liệu này là danh mục và luật chung mà schema đó phải tuân theo.

Nguồn đặc tả nghiệp vụ: repo mẫu .NET (`ApiRoutes.cs` và `Application/UseCases/` mỗi service). Route được đổi sang quy ước của đồ án (`/api/v1`, `snake_case`).

---

# 1. Nguyên tắc chung v2

Giữ nguyên từ v1, chỉ nêu phần thay đổi:

| Mục              | Quy tắc v2                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Version          | Public: `/api/v1`. Nội bộ giữa service: `/internal/v1`. Command: `schema_version` trong envelope                          |
| JSON             | `snake_case`; timestamp UTC ISO-8601; ID là chuỗi UUID (v1 để opaque, v2 khóa UUID vì dùng `@db.Uuid`)                    |
| Trace            | W3C `traceparent`/`tracestate` trên HTTP và trong header RabbitMQ; lỗi có `trace_id`, `timestamp`                         |
| Correlation      | `x-correlation-id` được forward ở mọi HTTP nội bộ và đặt vào envelope command                                             |
| Retry HTTP       | **OFF mặc định** (giữ v1 để retry không che hoặc khuếch đại lỗi khi đo RCA). Chỉ bật theo từng client khi có scenario/ADR |
| Timeout          | Mọi outbound HTTP có timeout cấu hình, phát telemetry khi timeout                                                         |
| Prometheus label | Không dùng `trace_id`, `span_id`, user ID, request ID, `message_id`                                                       |

## 1.1. Danh tính và role

JWT do `auth` phát (access + refresh) mang `sub` và `role` ∈ `student` | `instructor` | `admin`. Gateway validate cục bộ, xóa mọi `x-principal-*` do client gửi, rồi đặt:

```text
x-principal-id     = sub
x-principal-role   = student | instructor | admin
```

Service downstream tin hai header này (mạng nội bộ). Quyền được kiểm bằng decorator role ở controller; điều kiện sở hữu (ví dụ instructor chỉ sửa khóa học của mình) kiểm trong use case.

Route `/internal/v1/*` **không được Gateway proxy**; chỉ service gọi nhau trên mạng nội bộ và không cần JWT.

Route đọc nội dung media công khai (không cần JWT) vì trình duyệt nhúng ảnh/video không gửi được token: `GET /api/v1/media/{media_id}/content`, `.../thumbnail`, `/api/v1/media/usages/{usage_id}/url`. Bảo vệ bằng UUID khó đoán, `Cache-Control: no-store`; đây là giới hạn được chấp nhận và ghi nhận ở R-12.

## 1.2. Envelope phản hồi thống nhất

Mọi response JSON của mọi service (thành công hay lỗi, kể cả `/health`, `/ready` và lỗi do Gateway sinh) có đúng bốn khóa `success`, `data`, `error`, `meta`:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "trace_id": "…",
    "timestamp": "2026-11-02T10:00:00.000Z",
    "pagination": null
  }
}
```

```json
{
  "success": false,
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [] },
  "meta": { "trace_id": "…", "timestamp": "…", "pagination": null }
}
```

- `data` là tài nguyên, kết quả hoặc mảng (danh sách); `null` khi lỗi hoặc không có nội dung.
- `error.details` là `null` hoặc dữ liệu có cấu trúc (ví dụ danh sách `{ path, message }` khi validate).
- Ngoại lệ duy nhất: route trả byte/stream (media content, export CSV) dùng `@RawResponse()`; lỗi của chúng vẫn dùng envelope.

## 1.3. Phân trang

|          | Quy ước                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đầu vào  | `?page=1&page_size=20`: `page` ≥ 1 (mặc định 1), `page_size` 1–100 (mặc định 20); sai thì `400 VALIDATION_ERROR`. Bộ lọc riêng của endpoint thêm query khác, không đổi hai tham số này |
| Đầu ra   | `data` là mảng; `meta.pagination = { page, page_size, total, total_pages }`. `total_pages` = `ceil(total / page_size)`, bằng 0 khi rỗng                                                |
| Quét lớn | Export CSV dùng keyset và stream, không dùng `page`                                                                                                                                    |

## 1.4. DTO

Request/response DTO là zod schema trong `lms/contracts/src/http/` (`@aiops-lms/contracts/http`), kiểu TypeScript suy ra bằng `z.infer`. Controller parse input bằng `parseInput(schema, …)` và trả DTO qua presenter có kiểu trả về `…Dto`; danh sách trả `Page<…Dto>` (`toPage`). Envelope được dựng một chỗ duy nhất (`ResponseEnvelopeInterceptor`, `AppExceptionFilter` trong `@aiops-lms/common/http`). Service gọi nhau đọc phản hồi bằng cùng schema, lấy dữ liệu từ `data`.

---

# 2. Error contract

Lỗi dùng envelope ở mục 1.2 với `success: false`; `error.code` lấy từ bảng dưới. Trước R-04b dùng body phẳng `{ code, message, trace_id, timestamp, details }` (đã bỏ).

| HTTP | `code`                   | Khi dùng                            |
| ---: | ------------------------ | ----------------------------------- |
|  400 | `VALIDATION_ERROR`       | Request/body/query không hợp lệ     |
|  401 | `UNAUTHORIZED`           | JWT/credential thiếu hoặc sai       |
|  403 | `FORBIDDEN`              | Sai role hoặc không sở hữu resource |
|  404 | `NOT_FOUND`              | Resource không tồn tại              |
|  409 | `CONFLICT`               | Trùng hoặc sai trạng thái           |
|  500 | `INTERNAL_ERROR`         | Lỗi không phân loại                 |
|  503 | `DEPENDENCY_UNAVAILABLE` | Dependency không sẵn sàng           |
|  504 | `DEPENDENCY_TIMEOUT`     | Outbound timeout                    |

Mã nghiệp vụ bổ sung (giữ từ repo mẫu, cùng envelope):

| HTTP | `code`                         | Service | Ý nghĩa                                 |
| ---: | ------------------------------ | ------- | --------------------------------------- |
|  403 | `COURSE_NOT_ENROLLABLE`        | course  | Khóa học chưa `PUBLISHED`               |
|  409 | `ENROLLMENT_ALREADY_EXISTS`    | course  | Đã ghi danh                             |
|  403 | `STUDENT_NOT_ENROLLED`         | course  | Chưa ghi danh mà học/làm quiz           |
|  409 | `QUIZ_HAS_ATTEMPTS`            | course  | Quiz đã có attempt, không sửa được      |
|  409 | `AI_JOB_ALREADY_ACTIVE`        | course  | Đã có job active cùng lesson và loại    |
|  422 | `AI_DOCUMENTS_NOT_EXTRACTED`   | course  | Tài liệu chưa `EXTRACTED`               |
|  409 | `AI_TASK_NOT_CONFIGURED`       | ai      | Task chưa có binding model              |
|  502 | `AI_PROVIDER_ERROR`            | ai      | Provider lỗi hoặc không phản hồi hợp lệ |
|  422 | `AI_PROVIDER_REJECTED_REQUEST` | ai      | Provider từ chối request                |
|  400 | `MEDIA_CHECKSUM_MISMATCH`      | media   | Checksum upload không khớp              |
|  409 | `MEDIA_NOT_READY`              | media   | Media chưa `READY` cho usage này        |

Không trả stack trace, password, JWT, API key, hoặc chi tiết DB nội bộ. Thông báo lỗi AI phải loại bỏ API key và host của provider.

---

# 3. Bảng route Gateway

Gateway chọn service theo prefix dài nhất; không có route `/internal/*`.

| Prefix công khai                                        | Service      | Ghi chú                                      |
| ------------------------------------------------------- | ------------ | -------------------------------------------- |
| `/api/v1/auth`                                          | auth         | Public: `register`, `login`, `refresh`       |
| `/api/v1/students`                                      | student      |                                              |
| `/api/v1/courses`, `/api/v1/student`                    | course       | `/api/v1/student/*` là route học của student |
| `/api/v1/media`                                         | media        |                                              |
| `/api/v1/notifications`, `/api/v1/notification-batches` | notification |                                              |
| `/api/v1/scheduler`                                     | scheduler    |                                              |
| `/api/v1/ai`                                            | ai           |                                              |
| `/health`                                               | gateway      | Mỗi service còn `/health` và `/ready` nội bộ |

---

# 4. Danh mục contract theo owner

Quy ước cột Role: `A`=admin, `I`=instructor, `S`=student, `*`=bất kỳ role đã xác thực, `–`=công khai. `I*` nghĩa là instructor chỉ trên resource của mình, admin luôn được.

## 4.1. auth

| Method | Path                    | Role | Use case                                                  |
| ------ | ----------------------- | :--: | --------------------------------------------------------- |
| POST   | `/api/v1/auth/register` |  –   | `register-student` (tạo tài khoản, gọi student tạo hồ sơ) |
| POST   | `/api/v1/auth/login`    |  –   | `login`                                                   |
| POST   | `/api/v1/auth/refresh`  |  –   | `refresh-token`                                           |
| GET    | `/api/v1/auth/me`       |  *   | `get-current-account`                                     |
| POST   | `/api/v1/auth/accounts` |  A   | `create-account` (instructor/admin)                       |
| GET    | `/api/v1/auth/accounts` |  A   | `list-accounts`                                           |

## 4.2. student

| Method | Path                            | Role | Use case               |
| ------ | ------------------------------- | :--: | ---------------------- |
| GET    | `/api/v1/students/me`           |  S   | `get-current-student`  |
| GET    | `/api/v1/students`              | A, I | `list-students`        |
| GET    | `/api/v1/students/{student_id}` | A, I | `get-student`          |
| GET    | `/api/v1/students/summary`      |  A   | `get-students-summary` |

## 4.3. course

| Method | Path                                                                  | Role  | Use case                                                                    |
| ------ | --------------------------------------------------------------------- | :---: | --------------------------------------------------------------------------- |
| GET    | `/api/v1/courses`                                                     |   *   | `list-courses`                                                              |
| GET    | `/api/v1/courses/{course_id}`                                         |   *   | `get-course-detail`                                                         |
| POST   | `/api/v1/courses`                                                     | A, I  | `create-course`                                                             |
| PUT    | `/api/v1/courses/{course_id}`                                         | A, I* | `update-course`                                                             |
| DELETE | `/api/v1/courses/{course_id}`                                         | A, I* | `delete-course`                                                             |
| GET    | `/api/v1/courses/summary`                                             |   A   | `get-courses-summary`                                                       |
| GET    | `/api/v1/courses/export`                                              |   A   | `export-courses` (CSV stream, keyset, BOM UTF-8)                            |
| GET    | `/api/v1/courses/{course_id}/lessons/{lesson_id}`                     |   *   | `get-lesson-detail`                                                         |
| POST   | `/api/v1/courses/{course_id}/lessons`                                 | A, I* | `create-lesson`                                                             |
| PUT    | `/api/v1/courses/{course_id}/lessons/{lesson_id}`                     | A, I* | `update-lesson`                                                             |
| DELETE | `/api/v1/courses/{course_id}/lessons/{lesson_id}`                     | A, I* | `delete-lesson`                                                             |
| PUT    | `/api/v1/courses/{course_id}/lessons/reorder`                         | A, I* | `reorder-lessons`                                                           |
| GET    | `/api/v1/courses/{course_id}/lessons/{lesson_id}/quizzes`             | A, I* | `list-quizzes`                                                              |
| POST   | `/api/v1/courses/{course_id}/lessons/{lesson_id}/quizzes`             | A, I* | `create-quiz`                                                               |
| GET    | `/api/v1/courses/{course_id}/lessons/{lesson_id}/quizzes/{quiz_id}`   | A, I* | `get-quiz-detail`                                                           |
| PUT    | `…/quizzes/{quiz_id}`                                                 | A, I* | `update-quiz` (409 `QUIZ_HAS_ATTEMPTS`)                                     |
| DELETE | `…/quizzes/{quiz_id}`                                                 | A, I* | `delete-quiz`                                                               |
| GET    | `…/lessons/{lesson_id}/ai-documents`                                  | A, I* | `get-lesson-ai-documents`                                                   |
| POST   | `…/lessons/{lesson_id}/ai-documents/sync`                             | A, I* | `sync-lesson-ai-documents`                                                  |
| GET    | `…/lessons/{lesson_id}/ai-jobs`                                       | A, I* | `get-lesson-ai-jobs`                                                        |
| POST   | `…/lessons/{lesson_id}/ai-jobs`                                       | A, I* | `create-lesson-ai-job`                                                      |
| GET    | `…/lessons/{lesson_id}/ai-jobs/{job_id}`                              | A, I* | `get-lesson-ai-job`                                                         |
| GET    | `/api/v1/student/courses`                                             |   S   | `get-student-course-catalog`                                                |
| GET    | `/api/v1/student/enrollments`                                         |   S   | `get-student-enrollments`                                                   |
| GET    | `/api/v1/student/enrollments/{course_id}`                             |   S   | `get-student-enrollment-detail`                                             |
| POST   | `/api/v1/courses/{course_id}/enrollments`                             |   S   | `enroll-course`                                                             |
| GET    | `/api/v1/student/enrollments/{course_id}/lessons/{lesson_id}`         |   S   | `get-student-lesson-detail`                                                 |
| GET    | `/api/v1/courses/{course_id}/my-progress`                             |   S   | `get-my-course-progress`                                                    |
| POST   | `/api/v1/courses/{course_id}/lessons/{lesson_id}/progress/complete`   |   S   | `complete-lesson-progress`                                                  |
| GET    | `/api/v1/student/enrollments/{course_id}/lessons/{lesson_id}/quizzes` |   S   | `get-student-quizzes`                                                       |
| GET    | `…/quizzes/{quiz_id}`                                                 |   S   | `get-student-quiz-detail`                                                   |
| POST   | `…/quizzes/{quiz_id}/attempts`                                        |   S   | `start-quiz-attempt` (mở hoặc tiếp tục attempt đang mở)                     |
| GET    | `…/quizzes/{quiz_id}/attempts`                                        |   S   | `get-quiz-attempts`                                                         |
| GET    | `…/quizzes/{quiz_id}/attempts/{attempt_id}`                           |   S   | `get-quiz-attempt-detail`                                                   |
| PUT    | `…/attempts/{attempt_id}/answers`                                     |   S   | `save-quiz-answers`                                                         |
| POST   | `…/attempts/{attempt_id}/submit`                                      |   S   | `submit-quiz-attempt` (chấm: đúng khi tập đáp án chọn bằng tập đáp án đúng) |

Quy tắc: course `DRAFT|PUBLISHED|ARCHIVED`; quiz `DRAFT|PUBLISHED`; student chỉ thấy quiz `PUBLISHED`; mỗi (quiz, student) có tối đa một attempt `IN_PROGRESS`; khóa học thuộc `instructor_id` tạo ra nó (trường mới so với repo mẫu).

## 4.4. media

| Method | Path                                       | Role | Use case                                                                                             |
| ------ | ------------------------------------------ | :--: | ---------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/media`                            |  *   | `upload-media` (multipart)                                                                           |
| POST   | `/api/v1/media/upload-intents`             |  *   | `create-upload-intent` (presigned POST MinIO, hết hạn 900 giây, ghim key/content-type/size/checksum) |
| POST   | `/api/v1/media/{media_id}/upload-complete` |  *   | `complete-direct-upload` (kiểm tra metadata + checksum, promote object, `READY`)                     |
| GET    | `/api/v1/media/library`                    |  *   | `get-media-library`                                                                                  |
| GET    | `/api/v1/media/{media_id}/content`         |  –   | `get-media-content` (stream, Range)                                                                  |
| GET    | `/api/v1/media/{media_id}/thumbnail`       |  –   | `get-media-thumbnail-status`                                                                         |
| POST   | `/api/v1/media/{media_id}/thumbnail/retry` |  *   | `retry-media-thumbnail`                                                                              |
| POST   | `/api/v1/media/usages`                     |  *   | `create-media-usage`                                                                                 |
| POST   | `/api/v1/media/usages/batch`               |  *   | `create-media-usages`                                                                                |
| POST   | `/api/v1/media/usages/reorder`             |  *   | `reorder-media-usages`                                                                               |
| DELETE | `/api/v1/media/usages/{usage_id}`          |  *   | `delete-media-usage`                                                                                 |
| GET    | `/api/v1/media/usages/{usage_id}/url`      |  –   | `get-media-usage-url`                                                                                |
| GET    | `/api/v1/media/usages/urls`                |  –   | `get-media-usage-urls`                                                                               |
| GET    | `/api/v1/media/usage-jobs/{job_id}/status` |  –   | `get-notification-media-usage-job-status`                                                            |
| GET    | `/api/v1/media/summary`                    |  A   | `get-media-summary`                                                                                  |
| GET    | `/api/v1/media/jobs`                       |  A   | `get-media-background-jobs`                                                                          |

Bucket MinIO: `images`, `videos`, `documents`, `audios`, `other`; object key `yyyy/MM/dd/{uuid}.{ext}`; client không bao giờ thấy bucket hay key. Giới hạn kích thước theo loại là cấu hình (ảnh 10 MB, video 500 MB, tài liệu 50 MB, audio 100 MB, khác 25 MB).

## 4.5. notification

| Method | Path                                           | Role | Use case                                                                   |
| ------ | ---------------------------------------------- | :--: | -------------------------------------------------------------------------- |
| POST   | `/api/v1/notifications`                        |  A   | `create-notification` (đơn; gửi email + ghi inbox)                         |
| GET    | `/api/v1/notifications/{notification_id}`      |  A   | `get-notification`                                                         |
| GET    | `/api/v1/notifications/me`                     |  S   | `list-my-notifications` (inbox, phân trang, lọc `UNREAD`)                  |
| PATCH  | `/api/v1/notifications/{notification_id}/read` |  S   | `mark-notification-read`                                                   |
| POST   | `/api/v1/notifications/read-all`               |  S   | `mark-all-notifications-read`                                              |
| POST   | `/api/v1/notification-batches`                 |  A   | `create-notification-batch` (`target_scope=ALL_STUDENTS`)                  |
| GET    | `/api/v1/notification-batches`                 |  A   | `list-notification-batches`                                                |
| GET    | `/api/v1/notification-batches/{batch_id}`      |  A   | `get-notification-batch`                                                   |
| GET    | `…/{batch_id}/snapshot-status`                 |  A   | `get-batch-snapshot-status`                                                |
| GET    | `…/{batch_id}/delivery-status`                 |  A   | `get-batch-delivery-status`                                                |
| GET    | `…/{batch_id}/failed-items`                    |  A   | `get-batch-failed-items`                                                   |
| POST   | `…/{batch_id}/retry-failed`                    |  A   | `retry-failed-notification-batch` (một batch nguồn chỉ có một batch retry) |

Phần inbox là mới so với repo mẫu. Email đi qua SMTP; lỗi gửi ghi vào item `RETRY`/`FAILED`, không làm hỏng response tạo batch (xử lý bất đồng bộ).

## 4.6. scheduler

| Method | Path                                   | Role | Use case                                 |
| ------ | -------------------------------------- | :--: | ---------------------------------------- |
| GET    | `/api/v1/scheduler/jobs`               |  A   | `list-jobs`                              |
| POST   | `/api/v1/scheduler/jobs`               |  A   | `create-job` (`MANUAL` hoặc `CRON`)      |
| GET    | `/api/v1/scheduler/jobs/{job_id}`      |  A   | `get-job`                                |
| PATCH  | `/api/v1/scheduler/jobs/{job_id}`      |  A   | `update-job-status` (`ACTIVE             | PAUSED | DISABLED`) |
| POST   | `/api/v1/scheduler/jobs/{job_id}/runs` |  A   | `trigger-job-run` (có `idempotency_key`) |
| GET    | `/api/v1/scheduler/jobs/{job_id}/runs` |  A   | `list-job-runs`                          |

Job loại `MEDIA_UNUSED_CLEANUP` là job tích hợp sẵn; thiết kế theo tài liệu repo mẫu `docs/business-flows/scheduler/media-cleanup.md` (còn là bản thiết kế, sẽ chi tiết ở R-09).

## 4.7. ai

| Method           | Path                                              | Role | Use case                                             |
| ---------------- | ------------------------------------------------- | :--: | ---------------------------------------------------- |
| GET, POST        | `/api/v1/ai/providers`                            |  A   | `list-providers`, `create-provider`                  |
| GET, PUT, DELETE | `/api/v1/ai/providers/{provider_id}`              |  A   | `get-provider`, `update-provider`, `delete-provider` |
| POST             | `/api/v1/ai/providers/health-checks`              |  A   | `check-all-providers-health`                         |
| POST             | `/api/v1/ai/providers/{provider_id}/health-check` |  A   | `check-provider-health`                              |
| GET, POST        | `/api/v1/ai/models`                               |  A   | `list-models`, `create-model`                        |
| GET, PUT, DELETE | `/api/v1/ai/models/{model_id}`                    |  A   | `get-model`, `update-model`, `delete-model`          |
| GET              | `/api/v1/ai/service-bindings`                     |  A   | `list-bindings`                                      |
| GET, PUT, DELETE | `/api/v1/ai/service-bindings/{task_key}`          |  A   | `get-binding`, `upsert-binding`, `delete-binding`    |
| GET              | `/api/v1/ai/options`                              |  A   | `get-ai-options`                                     |

Task key hợp lệ: `document-extraction`, `lesson-synthesis`, `quiz-authoring`. API key lưu mã hóa AES-256-GCM (khóa từ `AI_ENCRYPTION_KEY`), API chỉ trả `api_key_hint`.

---

# 5. Contract nội bộ `/internal/v1` (không qua Gateway)

| Owner   | Method | Path                                    | Caller              | Mục đích                                                                                                             |
| ------- | ------ | --------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| student | POST   | `/internal/v1/students`                 | auth                | Tạo hồ sơ student cùng `id` với tài khoản                                                                            |
| student | GET    | `/internal/v1/students`                 | notification-worker | Danh sách `ACTIVE` theo trang (`page_size` ≤ 100) để snapshot recipient                                              |
| student | GET    | `/internal/v1/students/{student_id}`    | auth, media         | auth: kiểm tra hồ sơ tồn tại và `ACTIVE` khi student đăng nhập (404 → 403, student lỗi → 503); media: kiểm tra actor |
| media   | POST   | `/internal/v1/media/usages/ids:query`   | course              | Lấy usage ID theo owner (xóa khóa học)                                                                               |
| media   | GET    | `/internal/v1/media/usages/urls`        | course              | URL các usage                                                                                                        |
| media   | GET    | `/internal/v1/media/{media_id}/content` | course              | Byte tài liệu cho trích văn bản AI                                                                                   |
| media   | POST   | `/internal/v1/media/cleanup`            | scheduler-worker    | Dọn media không dùng (job R-09)                                                                                      |
| ai      | POST   | `/internal/v1/ai/completions`           | course              | Hoàn thành hội thoại; body `{task, messages, tools}`, hỗ trợ phần ảnh/PDF; timeout 240 giây                          |

Endpoint `/internal/v1/*` trả lỗi cùng envelope; header `x-principal-*` chỉ được truyền khi downstream thật sự cần (course → ai truyền actor admin hệ thống).

---

# 6. Command contract (RabbitMQ)

v2 bỏ event `grade.completed`; mọi giao tiếp bất đồng bộ là **command** có đích rõ.

## 6.1. Quy ước

```text
Exchange: lms.commands (direct)
Queue:    <worker service.name>--<command-name-kebab>-v<schema_version>
          ví dụ media-worker--synchronize-markdown-media-usage-v1
Retry:    consumer retry có giới hạn → queue lỗi `<queue>.error`
Giao:     at-least-once; consumer idempotent theo message_id (bảng inbox)
Phát:     transactional outbox trong DB của producer (outbox_messages) + relay
```

## 6.2. Envelope v2

```json
{
  "message_id": "…",
  "command_name": "media.markdown-usage.synchronize",
  "schema_version": 1,
  "occurred_at": "2026-11-02T10:15:00Z",
  "producer": { "service_name": "course", "service_version": "0.1.0" },
  "correlation": {
    "traceparent": "…",
    "tracestate": null,
    "correlation_id": "…"
  },
  "payload": {}
}
```

Trace context được inject vào header/properties RabbitMQ làm carrier chính (giữ quy ước v1); `correlation` trong body chỉ để truy vết và fallback.

## 6.3. Danh mục command

| `command_name`                            | Producer                          | Consumer (queue)    | Mục đích                                                                |
| ----------------------------------------- | --------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| `media.markdown-usage.synchronize`        | course                            | media-worker        | Diff media tham chiếu trong markdown course/lesson/quiz, thêm/xóa usage |
| `media.usages.delete-by-ids`              | course                            | media-worker        | Xóa usage khi xóa course/lesson/quiz                                    |
| `media.thumbnail.generate`                | media                             | media-worker        | Tạo thumbnail WebP (ảnh, khung hình video)                              |
| `media.notification-usage.register`       | notification                      | media-worker        | Đăng ký usage đơn                                                       |
| `media.notification-usage.register-batch` | notification                      | media-worker        | Đăng ký usage theo batch                                                |
| `media.notification-usage.start-job`      | notification                      | media-worker        | Mở job usage cho batch                                                  |
| `media.notification-usage.complete-job`   | notification-worker               | media-worker        | Hoàn tất job usage (kèm số usage kỳ vọng)                               |
| `notification.batch.snapshot`             | notification                      | notification-worker | Chụp danh sách recipient theo trang, chèn item idempotent               |
| `notification.batch.dispatch`             | notification, notification-worker | notification-worker | Nhận một lô item bằng lease, gửi email, tự enqueue lại tới khi hết      |

Payload từng command là zod schema trong `lms/contracts/src/commands/`, mỗi command có fixture và contract test.

## 6.4. Ngữ nghĩa giao nhận

- Thêm field tùy chọn: giữ `schema_version`; đổi/xóa field bắt buộc: tăng version, tên queue đổi theo.
- Trùng `message_id`: consumer bỏ qua và ack, ghi `deduplicated`.
- Lỗi sau hết retry: vào `<queue>.error`, handler `Fault` cập nhật job/batch sang `FAILED`.
- Consumer không đọc DB của producer để bù dữ liệu; payload phải đủ dùng.

---

# 7. Luật ranh giới giữa service

1. Service chỉ gọi nhau qua `/internal/v1` hoặc command, không import code của nhau (eslint `no-cross-service-imports`).
2. Controller không chứa logic; mỗi route ánh xạ tới đúng một use case ở bảng mục 4.
3. Không chia sẻ DTO; mỗi caller dùng schema trong `@aiops-lms/contracts`.
4. Thay đổi phá vỡ contract (xóa/đổi field bắt buộc, đổi ngữ nghĩa, đổi role) cần version mới hoặc ADR.

---

# 8. Yêu cầu telemetry ở boundary

**HTTP:** span client/server có `peer.service` hoặc `dependency_identity`; `http.route` đã chuẩn hóa (không chứa UUID); timeout phân biệt với lỗi kết nối.

**Command:** span publish (producer), consume/process (consumer) nối cùng trace qua header RabbitMQ; thuộc tính `command_name`, `queue`, attempt; metric: độ sâu queue, tuổi message cũ nhất, số lần retry, kích thước `.error`.

**Dependency:** MinIO, SMTP, LLM provider có span và metric riêng theo `dependency_identity` ở catalogue v2 mục 2.2.

**Log:** JSON có `service.name`, severity, `trace_id`, `span_id` khi có span active (để MCP/Loki truy vấn theo trace).

Ground truth thí nghiệm không được đưa vào payload nghiệp vụ.

---

# 9. Contract tests tối thiểu khi scaffold

- Mỗi route trong mục 4 có test: đúng role (200/201/204), sai role (403), thiếu JWT (401), body sai (400).
- Mỗi command có fixture hợp lệ/không hợp lệ và test idempotent theo `message_id`.
- Test eslint boundary xác nhận cấm import chéo service.
- Gateway test: route table mục 3, không proxy `/internal/*`, xóa `x-principal-*` giả của client.

---

# 10. Điểm mở được cố ý chưa chốt

- Giá trị timeout/số lần retry consumer: freeze trước campaign thí nghiệm.
- Giới hạn kích thước/ràng buộc nội dung upload thực tế khi chạy tải.
- Cách instructor xem kết quả quiz của student (repo mẫu chưa có): ngoài phạm vi refactor này.
- Tính công khai của `GET /media/*/content`: xem lại nếu cần bảo mật cao hơn (ví dụ presigned GET).

---

# 11. Xác nhận cần có

| Trường          | Giá trị                                           |
| --------------- | ------------------------------------------------- |
| Người xác nhận  | Đức (không cần Bách review)                       |
| Trạng thái      | `PENDING`                                         |
| Phạm vi xem xét | Mục 3 (route), mục 6 (command), mục 8 (telemetry) |
