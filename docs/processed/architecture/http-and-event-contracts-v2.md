# HTTP and command contracts v2

> **Task:** R-01 — [bảng task refactor](../plan/refactor/refactor-board-v1.md)
>
> **Trạng thái:** Đề xuất — chờ Đức tự xác nhận.
>
> **Thay thế:** [http-and-event-contracts-v1](http-and-event-contracts-v1.md) (lịch sử).
>
> **Cập nhật R-13:** `auth` và `student` đã gộp thành service `identity` ([ADR-005](../adr/adr-005-merge-auth-student-into-identity-v1.md)); URL public `/api/v1/auth/*`, `/api/v1/students/*` và `/internal/v1/auth/service-token` không đổi, các route ghi nội bộ của student (`POST /internal/v1/students`, scope `student:profile:write`) đã bỏ.
>
> **Phụ thuộc:** [service-catalogue-and-topology-v2](service-catalogue-and-topology-v2.md), [ADR-001](../adr/adr-001-restructure-lms-testbed-v1.md), [ADR-004](../adr/adr-004-service-access-token-and-api-surfaces-v1.md) (xác thực và hai bề mặt API).
>
> **Mục đích:** chốt quy ước chung, danh mục route, ma trận role và danh mục command để các service được scaffold và ghép mà không vỡ ranh giới. Request/response chi tiết từng endpoint không nằm ở đây mà được viết bằng zod trong `lms/contracts/` cùng từng service; tài liệu này là danh mục và luật chung mà schema đó phải tuân theo.

Nguồn đặc tả nghiệp vụ: repo mẫu .NET (`ApiRoutes.cs` và `Application/UseCases/` mỗi service). Route được đổi sang quy ước của đồ án (`/api/v1`, `snake_case`).

---

# 1. Nguyên tắc chung v2

Giữ nguyên từ v1, chỉ nêu phần thay đổi:

| Mục              | Quy tắc v2                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Version          | Public: `/api/v1` (chỉ Gateway gọi). Nội bộ giữa service: `/internal/v1`. Command: `schema_version` trong envelope        |
| JSON             | `snake_case`; timestamp UTC ISO-8601; ID là chuỗi UUID (v1 để opaque, v2 khóa UUID vì dùng `@db.Uuid`)                    |
| Trace            | W3C `traceparent`/`tracestate` trên HTTP và trong header RabbitMQ; lỗi có `trace_id`, `timestamp`                         |
| Correlation      | `x-correlation-id` được forward ở mọi HTTP nội bộ và đặt vào envelope command                                             |
| Retry HTTP       | **OFF mặc định** (giữ v1 để retry không che hoặc khuếch đại lỗi khi đo RCA). Chỉ bật theo từng client khi có scenario/ADR |
| Timeout          | Mọi outbound HTTP có timeout cấu hình, phát telemetry khi timeout                                                         |
| Prometheus label | Không dùng `trace_id`, `span_id`, user ID, request ID, `message_id`                                                       |

## 1.1. Danh tính, hai bề mặt API và hai loại token

Mỗi service có **hai bề mặt HTTP tách thư mục** (`adapters/http/public/`, `adapters/http/internal/`), dùng chung use case:

| Bề mặt   | Prefix                                        | Ai gọi               | Xác thực                                                             | Decorator                         |
| -------- | --------------------------------------------- | -------------------- | -------------------------------------------------------------------- | --------------------------------- |
| Public   | `/api/v1`                                     | Chỉ Gateway          | Service token của `gateway` (scope `gateway:proxy`) + danh tính user | `@Roles(...)` hoặc `@Anonymous()` |
| Internal | `/internal/v1`                                | Service khác         | Service token có đủ scope của route                                  | `@InternalApi({ scopes })`        |
| Mở       | `/health`, `/ready`, `/.well-known/jwks.json` | Hạ tầng, mọi service | Không cần token                                                      | `@SkipAuth()`                     |

`POST /internal/v1/auth/service-token` cũng không dùng bearer (`@SkipAuth()`): danh tính chứng minh bằng `client_id`/`client_secret` trong body.

`identity` phát **hai loại token**, ký EdDSA (Ed25519), verify cục bộ bằng JWKS:

| Loại                 | Cấp bởi                                                         | Claim chính                                                                             | TTL                    |
| -------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| User access token    | `POST /api/v1/auth/{student,instructor,admin}/login`, `refresh` | `iss=aiops-lms-identity`, `typ=user`, `sub`=user id, `role`, `aud=aiops-lms`                | 1 giờ                  |
| Service access token | `POST /internal/v1/auth/service-token` (client-credentials)     | `typ=service`, `sub`=tên service, `aud`=service đích, `scope` (cách nhau bằng dấu cách) | 10 phút, không refresh |

Header JWT có `kid` (thumbprint khóa công khai); mọi token có `jti`, `iat`, `exp`. Token sai loại bị `TOKEN_TYPE_MISMATCH`.

Luồng một request người dùng:

1. Client gửi user token cho Gateway. Gateway verify (JWKS), kiểm role theo bảng route, **xóa** `Authorization` và mọi `x-principal-*` do client gửi.
2. Gateway gọi service đích với `Authorization: Bearer <service token của gateway, aud=service đích>` và đặt `x-principal-id = sub`, `x-principal-role = student | instructor | admin`.
3. Service verify service token (`typ=service`, `aud` = tên mình, `sub=gateway`, scope `gateway:proxy`); **chỉ khi đó** mới tin `x-principal-*`. Quyền được kiểm bằng `@Roles`; điều kiện sở hữu (ví dụ instructor chỉ sửa khóa học của mình) kiểm trong use case.

Luồng service-to-service: bên gọi lấy service token cho đúng `audience` (cache, làm mới nền ở 50% TTL, single-flight, stale-while-error), gọi `/internal/v1/*`. Service đích kiểm `aud` và scope của route. Header `x-principal-*` không có hiệu lực ở route internal.

Route `/internal/v1/*`, `/.well-known/*` **không được Gateway proxy**.

Route đọc nội dung media công khai với người dùng (không cần JWT) vì trình duyệt nhúng ảnh/video không gửi được token: `GET /api/v1/media/{media_id}/content`, `.../thumbnail`, `/api/v1/media/usages/{usage_id}/url`, `/api/v1/media/avatars/{user_id}`. Gateway vẫn gắn service token của mình khi gọi `media`. Bảo vệ bằng UUID khó đoán, `Cache-Control: no-store`; đây là giới hạn được chấp nhận và ghi nhận ở R-12.

### Catalogue scope (đã dùng và dự kiến)

| Scope                   | Cấp cho client                   | Dùng ở                                | Trạng thái                                                |
| ----------------------- | -------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `gateway:proxy`         | gateway                          | Mọi route public của mọi service      | Đã có                                                     |
| `student:profile:read`  | media, notification-worker       | `GET /internal/v1/students[/{id}]`    | Đã có (client media ở R-06, notification-worker ở R-07); `identity` là audience |
| `media:usage:read`      | course                           | `ids:query`, `usages/urls`, `usages/by-owner` | Đã có (R-06; `by-owner` ở R-08)                    |
| `media:content:read`    | ai-worker                        | `GET /internal/v1/media/{id}/content` | Đã có (R-06 cấp cho course; **R-08 chuyển sang `ai-worker`**, course không còn cần)  |
| `media:cleanup`         | scheduler-worker                 | `POST /internal/v1/media/cleanup`     | Đã có (R-09)                                              |
| `ai:completion`         | ai-worker (trong process) và client ngoài | `POST /internal/v1/ai/completions` | Đã có (R-08); `course` không còn gọi route này           |
| `ai:document:read`      | course                           | `POST /internal/v1/ai/documents/query` | Đã có (R-08) |
| `ai:document:write`     | course                           | `POST /internal/v1/ai/documents/sync`  | Đã có (R-08) |
| `ai:job:read`           | course                           | `GET /internal/v1/ai/jobs[/{job_id}]`  | Đã có (R-08) |
| `ai:job:write`          | course                           | `POST /internal/v1/ai/jobs`            | Đã có (R-08) |
| `course:lesson-ai:read` | ai-worker                        | `GET /internal/v1/courses/{c}/lessons/{l}/ai-context` | Đã có (R-08) |
| `course:lesson-ai:write`| ai-worker                        | `PUT …/ai-content`, `POST …/ai-quizzes` | Đã có (R-08) |

Các scope `ai:document:*`, `ai:job:*` và `course:lesson-ai:*` đã được cấp trong registry của `identity` (client `course` và `ai-worker`, xem `SERVICE_CLIENTS_BOOTSTRAP` ở compose).

Một client chỉ được xin token cho các `audience` và `scope` trong registry (`identity_service_clients`); xin ngoài phạm vi → `SERVICE_SCOPE_FORBIDDEN`.

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

| HTTP | `code`                    | Khi dùng                                                                                                      |
| ---: | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
|  400 | `VALIDATION_ERROR`        | Request/body/query không hợp lệ                                                                               |
|  401 | `UNAUTHORIZED`            | User JWT/credential thiếu hoặc sai                                                                            |
|  403 | `FORBIDDEN`               | Sai role hoặc không sở hữu resource                                                                           |
|  404 | `NOT_FOUND`               | Resource không tồn tại                                                                                        |
|  409 | `CONFLICT`                | Trùng hoặc sai trạng thái                                                                                     |
|  401 | `SERVICE_TOKEN_MISSING`   | Thiếu service access token                                                                                    |
|  401 | `SERVICE_TOKEN_INVALID`   | Service token sai chữ ký/`aud`/hạn                                                                            |
|  401 | `TOKEN_TYPE_MISMATCH`     | Dùng user token ở nơi cần service token (hoặc ngược lại)                                                      |
|  401 | `SERVICE_CLIENT_INVALID`  | `client_id`/`client_secret` sai hoặc client bị khóa                                                           |
|  403 | `SERVICE_SCOPE_FORBIDDEN` | Service token thiếu scope/không phải của gateway ở route public; xin token ngoài `audience`/`scope` được phép |
|  500 | `INTERNAL_ERROR`          | Lỗi không phân loại                                                                                           |
|  503 | `DEPENDENCY_UNAVAILABLE`  | Dependency không sẵn sàng                                                                                     |
|  504 | `DEPENDENCY_TIMEOUT`      | Outbound timeout                                                                                              |

Mã nghiệp vụ bổ sung (giữ từ repo mẫu, cùng envelope):

| HTTP | `code`                           | Service | Ý nghĩa                                                    |
| ---: | -------------------------------- | ------- | ---------------------------------------------------------- |
|  403 | `COURSE_NOT_ENROLLABLE`          | course  | Khóa học chưa `PUBLISHED`                                  |
|  409 | `ENROLLMENT_ALREADY_EXISTS`      | course  | Đã ghi danh                                                |
|  403 | `STUDENT_NOT_ENROLLED`           | course  | Chưa ghi danh mà học/làm quiz                              |
|  409 | `QUIZ_HAS_ATTEMPTS`              | course  | Quiz đã có attempt, không sửa được                         |
|  409 | `LESSON_ORDER_CONFLICT`          | course  | `display_order` trùng, hoặc reorder không khớp tập bài học |
|  409 | `QUIZ_ATTEMPT_ALREADY_SUBMITTED` | course  | Attempt đã nộp, không lưu/nộp lại                          |
|  409 | `AI_JOB_ALREADY_ACTIVE`          | course  | Đã có job active cùng lesson và loại                       |
|  422 | `AI_DOCUMENTS_NOT_EXTRACTED`     | course  | Tài liệu chưa `EXTRACTED`                                  |
|  409 | `AI_TASK_NOT_CONFIGURED`         | ai      | Task chưa có binding model                                 |
|  502 | `AI_PROVIDER_ERROR`              | ai      | Provider lỗi hoặc không phản hồi hợp lệ                    |
|  422 | `AI_PROVIDER_REJECTED_REQUEST`   | ai      | Provider từ chối request                                   |
|  409 | `AI_PROVIDER_KEY_UNREADABLE`     | ai      | API key đã lưu không giải mã được (ciphertext hỏng hoặc đổi `AI_ENCRYPTION_KEY`); nhập lại key |
|  409 | `AI_REFERENCE_INACTIVE`          | ai      | Gán binding cho model `INACTIVE` hoặc tạo model cho provider `INACTIVE` |
|  409 | `AI_PROVIDER_NAME_CONFLICT`      | ai      | Tên provider đã tồn tại (không phân biệt hoa thường)       |
|  409 | `AI_PROVIDER_IN_USE`             | ai      | Xóa provider còn model                                     |
|  409 | `AI_MODEL_CONFLICT`              | ai      | Provider đã có model cùng `model_name`                     |
|  409 | `AI_MODEL_IN_USE`                | ai      | Xóa model còn được gán cho một task                        |
|  409 | `LESSON_CONTENT_EXISTS`          | course  | `SYNTHESIZE_LESSON` trên bài học đã có nội dung mà `overwrite_content=false` |
|  400 | `MEDIA_CHECKSUM_MISMATCH`        | media   | Checksum upload không khớp                                 |
|  415 | `MEDIA_MIME_MISMATCH`            | media   | `upload-complete`: nội dung thuộc loại khác loại đã khai báo ở `upload-intents` |
|  409 | `MEDIA_NOT_READY`                | media   | Media (hoặc thumbnail) chưa `READY` cho thao tác này       |
|  413 | `MEDIA_TOO_LARGE`                | media   | Vượt giới hạn kích thước theo loại media                   |
|  409 | `MEDIA_UPLOAD_NOT_COMPLETED`     | media   | `upload-complete` nhưng object chưa được tải lên           |
|  409 | `MEDIA_USAGE_CONFLICT`           | media   | Usage vi phạm quy tắc (trùng, singleton, sai loại owner)   |
|  409 | `NOTIFICATION_BATCH_NOT_RETRYABLE` | notification | Batch chưa kết thúc hoặc không có recipient `FAILED`  |
|  409 | `NOTIFICATION_BATCH_RETRY_EXISTS`  | notification | Batch nguồn đã có batch retry (`details.retry_batch_id`) |
|  409 | `SCHEDULER_JOB_NOT_ACTIVE`         | scheduler | Tạo run cho job `PAUSED`/`DISABLED` (`details.status`) |

Không trả stack trace, password, JWT, API key, hoặc chi tiết DB nội bộ. Thông báo lỗi AI phải loại bỏ API key và host của provider.

---

# 3. Bảng route Gateway

Gateway chọn service theo prefix dài nhất; chỉ proxy `/api/v1/*`, không có route `/internal/*` hay `/.well-known/*`.

| Prefix công khai                                        | Service      | Ghi chú                                                           |
| ------------------------------------------------------- | ------------ | ----------------------------------------------------------------- |
| `/api/v1/auth`                                          | identity     | Public: `register`, `{student,instructor,admin}/login`, `refresh` |
| `/api/v1/students`                                      | identity     | Cùng upstream với `/api/v1/auth` (một `GATEWAY_IDENTITY_BASE_URL`) |
| `/api/v1/courses`, `/api/v1/student`                    | course       | `/api/v1/student/*` là route học của student                      |
| `/api/v1/media`                                         | media        |                                                                   |
| `/api/v1/notifications`, `/api/v1/notification-batches` | notification |                                                                   |
| `/api/v1/scheduler`                                     | scheduler    |                                                                   |
| `/api/v1/ai`                                            | ai           |                                                                   |
| `/health`                                               | gateway      | Mỗi service còn `/health` và `/ready` nội bộ                      |

Quy tắc Gateway (chi tiết: [`lms/services/gateway/README.md`](../../../lms/services/gateway/README.md)):

- Role ở mức Gateway: `/api/v1/scheduler`, `/api/v1/ai`, `/api/v1/notification-batches` chỉ `admin`; còn lại mọi role đã xác thực và service kiểm quyền chi tiết.
- Mọi phản hồi của service phía sau (kể cả 4xx/5xx và mã nghiệp vụ ở mục 2) được trả **nguyên vẹn**; Gateway chỉ tự sinh envelope cho `404`, `401`, `403`, `503 DEPENDENCY_UNAVAILABLE` (không kết nối được) và `504 DEPENDENCY_TIMEOUT` (không có header phản hồi trong `GATEWAY_UPSTREAM_TIMEOUT_MS`).
- Body và phản hồi được stream (multipart, byte lớn, `Range`); Gateway không parse body.

---

# 4. Danh mục contract theo owner

Quy ước cột Role: `A`=admin, `I`=instructor, `S`=student, `*`=bất kỳ role đã xác thực, `–`=công khai. `I*` nghĩa là instructor chỉ trên resource của mình, admin luôn được.

## 4.1. identity: tài khoản và đăng nhập

Ba cửa đăng nhập riêng theo role dùng chung bảng `identity_users` và cùng body `{ email, password }`. Chỉ tài khoản đúng role đăng nhập được qua cửa tương ứng; sai email, sai mật khẩu, tài khoản bị khóa và đúng mật khẩu nhưng sai cửa đều trả cùng một `401 UNAUTHORIZED` ("Thông tin đăng nhập không hợp lệ") để không lộ tài khoản tồn tại hay thuộc role nào. `refresh` dùng chung vì refresh token đã gắn với tài khoản.

| Method | Path                            | Role | Use case                                                      |
| ------ | ------------------------------- | :--: | ------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`         |  –   | `register-student` (một transaction tạo tài khoản và hồ sơ)   |
| POST   | `/api/v1/auth/student/login`    |  –   | `login-student` (cần hồ sơ `ACTIVE`; sai cửa → 401)           |
| POST   | `/api/v1/auth/instructor/login` |  –   | `login-instructor`                                            |
| POST   | `/api/v1/auth/admin/login`      |  –   | `login-admin`                                                 |
| POST   | `/api/v1/auth/refresh`          |  –   | `refresh-token`                                               |
| GET    | `/api/v1/auth/me`               |  *   | `get-current-account`                                         |
| POST   | `/api/v1/auth/accounts`         |  A   | `create-account` (instructor/admin)                           |
| GET    | `/api/v1/auth/accounts`         |  A   | `list-accounts`                                               |

## 4.2. identity: hồ sơ student

| Method | Path                            | Role | Use case               |
| ------ | ------------------------------- | :--: | ---------------------- |
| GET    | `/api/v1/students/me`           |  S   | `get-current-student`  |
| GET    | `/api/v1/students`              | A, I | `list-students`        |
| GET    | `/api/v1/students/{student_id}` | A, I | `get-student`          |
| GET    | `/api/v1/students/summary`      |  A   | `get-students-summary` |

## 4.3. course

Ký hiệu role: `A` admin, `I` instructor, `I*` instructor sở hữu khóa học (`courses.instructor_id`), `S` student, `*` mọi role đã xác thực. Mọi path dưới đây đã triển khai (đối chiếu `lms/services/course/src/adapters/http/`): phần học liệu/quiz ở R-05, phần AI ở cuối bảng ở R-08.

| Method | Path                                                      | Role  | Use case                                                                                                                     |
| ------ | --------------------------------------------------------- | :---: | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/courses`                                         |   *   | `list-courses` (admin: tất cả; instructor: của mình; student: chỉ `PUBLISHED`)                                               |
| GET    | `/api/v1/courses/summary`                                 | A, I* | `get-course-summary` (đếm theo trạng thái)                                                                                   |
| GET    | `/api/v1/courses/export`                                  | A, I* | `export-courses-csv` (stream, keyset theo `id`, khối 500, BOM UTF-8, CRLF)                                                   |
| GET    | `/api/v1/courses/{course_id}`                             |   *   | `get-course` (kèm dàn bài; student chỉ thấy khóa `PUBLISHED`, không có nội dung)                                             |
| POST   | `/api/v1/courses`                                         | A, I  | `create-course` (luôn `DRAFT`)                                                                                               |
| PATCH  | `/api/v1/courses/{course_id}`                             | A, I* | `update-course` (đổi `status` để xuất bản/lưu trữ)                                                                           |
| DELETE | `/api/v1/courses/{course_id}`                             | A, I* | `delete-course` (204; kéo theo bài học, quiz, ghi danh, tiến độ)                                                             |
| POST   | `/api/v1/courses/{course_id}/lessons`                     | A, I* | `create-lesson` (bỏ `display_order` = thêm cuối; trùng = 409 `LESSON_ORDER_CONFLICT`)                                        |
| PUT    | `/api/v1/courses/{course_id}/lessons/reorder`             | A, I* | `reorder-lessons` (`lesson_ids` phải đúng tập bài học hiện có, nếu không 409 `LESSON_ORDER_CONFLICT`)                        |
| GET    | `/api/v1/courses/{course_id}/lessons/{lesson_id}`         | A, I* | `get-lesson`                                                                                                                 |
| PATCH  | `/api/v1/courses/{course_id}/lessons/{lesson_id}`         | A, I* | `update-lesson`                                                                                                              |
| DELETE | `/api/v1/courses/{course_id}/lessons/{lesson_id}`         | A, I* | `delete-lesson` (204)                                                                                                        |
| GET    | `/api/v1/courses/{course_id}/lessons/{lesson_id}/quizzes` | A, I* | `list-lesson-quizzes` (cả `DRAFT`)                                                                                           |
| POST   | `/api/v1/courses/{course_id}/lessons/{lesson_id}/quizzes` | A, I* | `create-quiz` (luôn `DRAFT`, xếp cuối bài học)                                                                               |
| GET    | `…/quizzes/{quiz_id}`                                     | A, I* | `get-quiz` (kèm `is_correct`)                                                                                                |
| PATCH  | `…/quizzes/{quiz_id}`                                     | A, I* | `update-quiz` (có `questions` = thay cả cây, 409 `QUIZ_HAS_ATTEMPTS` nếu đã có attempt; `status: PUBLISHED` cần ≥ 1 câu hỏi) |
| DELETE | `…/quizzes/{quiz_id}`                                     | A, I* | `delete-quiz` (204; 409 `QUIZ_HAS_ATTEMPTS` nếu đã có attempt)                                                               |
| GET    | `/api/v1/student/enrollments`                             |   S   | `list-my-enrollments`                                                                                                        |
| POST   | `/api/v1/student/courses/{course_id}/enrollments`         |   S   | `enroll-course` (201; 403 `COURSE_NOT_ENROLLABLE`, 409 `ENROLLMENT_ALREADY_EXISTS`)                                          |
| GET    | `/api/v1/student/courses/{course_id}`                     |   S   | `get-enrolled-course` (kèm nội dung bài học; 403 `STUDENT_NOT_ENROLLED`)                                                     |
| GET    | `/api/v1/student/courses/{course_id}/progress`            |   S   | `get-my-course-progress`                                                                                                     |
| PUT    | `/api/v1/student/lessons/{lesson_id}/progress`            |   S   | `update-lesson-progress` (`progress_percent` 0–100, chỉ tăng; 100 = hoàn thành)                                              |
| GET    | `/api/v1/student/lessons/{lesson_id}/quizzes`             |   S   | `list-student-lesson-quizzes` (chỉ `PUBLISHED`)                                                                              |
| GET    | `/api/v1/student/quizzes/{quiz_id}`                       |   S   | `get-student-quiz` (không có `is_correct`)                                                                                   |
| POST   | `/api/v1/student/quizzes/{quiz_id}/attempts`              |   S   | `start-quiz-attempt` (201 mở lượt mới, 200 tiếp tục lượt `IN_PROGRESS`)                                                      |
| GET    | `/api/v1/student/quizzes/{quiz_id}/attempts`              |   S   | `list-my-attempts` (phân trang)                                                                                              |
| PUT    | `/api/v1/student/attempts/{attempt_id}/answers`           |   S   | `save-attempt-answers` (thay toàn bộ câu trả lời; 409 `QUIZ_ATTEMPT_ALREADY_SUBMITTED`)                                      |
| POST   | `/api/v1/student/attempts/{attempt_id}/submit`            |   S   | `submit-quiz-attempt` (200; `QuizGrader`; 409 `QUIZ_ATTEMPT_ALREADY_SUBMITTED`)                                              |
| GET    | `/api/v1/student/attempts/{attempt_id}`                   |   S   | `get-my-attempt` (đáp án đúng chỉ lộ sau khi đã nộp)                                                                         |
| GET    | `…/lessons/{lesson_id}/ai-documents`                      | A, I* | `get-lesson-ai-documents` (facade: tệp đính kèm lấy từ `media`, trạng thái từ `ai`; `NOT_QUEUED` nếu `ai` chưa có bản ghi, `UNSUPPORTED` nếu định dạng không hỗ trợ, `EXTRACTING` khi `ai` đang xử lý; không trả văn bản) |
| POST   | `…/lessons/{lesson_id}/ai-documents/sync`                 | A, I* | `sync-lesson-ai-documents` (200; chuyển tệp đính kèm sang `ai` để xếp hàng chờ, idempotent; `?retry_failed=true` đưa `FAILED` về `PENDING`) |
| GET    | `…/lessons/{lesson_id}/ai-jobs`                           | A, I* | `get-lesson-ai-jobs` (tối đa 10 job mới nhất, không kèm nội dung cũ của bài học)                                              |
| POST   | `…/lessons/{lesson_id}/ai-jobs`                           | A, I* | `create-lesson-ai-job` (202, job `PENDING`; 409 `AI_JOB_ALREADY_ACTIVE`, 409 `LESSON_CONTENT_EXISTS`, 422 `AI_DOCUMENTS_NOT_EXTRACTED`) |
| GET    | `…/lessons/{lesson_id}/ai-jobs/{job_id}`                  | A, I* | `get-lesson-ai-job` (kèm `previous_content_markdown` nếu job đã ghi đè nội dung; 404 nếu job không thuộc bài học)              |

Quy tắc:

- Course `DRAFT|PUBLISHED|ARCHIVED` (tên 3–200 ký tự); quiz `DRAFT|PUBLISHED`; khóa học thuộc `instructor_id` tạo ra nó (trường mới so với repo mẫu), admin quản lý mọi khóa.
- Quiz: tiêu đề 2–200 ký tự, markdown ≤ 20000, lựa chọn ≤ 2000, ≤ 100 câu hỏi, mỗi câu 2–10 lựa chọn, điểm > 0, ≤ 100 và ≤ 2 chữ số thập phân; `SINGLE_CHOICE` có đúng 1 đáp án đúng, `MULTIPLE_CHOICE` có ≥ 1. Vi phạm trả 400 `VALIDATION_ERROR` kèm danh sách `path`/`message`.
- Student chỉ thấy quiz `PUBLISHED`; mỗi (quiz, student) có tối đa một attempt `IN_PROGRESS` (partial unique index `quiz_attempts_one_in_progress`).
- Chấm điểm: câu đúng khi tập lựa chọn bằng tập đáp án đúng (không chấm từng phần); `score` là tổng điểm các câu đúng, `max_score` là tổng điểm quiz tại thời điểm nộp (snapshot).
- Đồng bộ usage media đã có từ R-06: create/update course, lesson, quiz ghi command `media.markdown-usage.synchronize` vào `outbox_messages` cùng transaction; xóa course/lesson/quiz hỏi `media` (`ids:query`) rồi ghi `media.usages.delete-by-ids` cùng transaction (media không trả lời thì 503 và không xóa). Ghi nội dung bài học hoặc quiz bằng job AI đi cùng đường này (job gọi lại `update-lesson`/`create-quiz`).
- Soạn bài học bằng AI (R-08): **`course` chỉ là facade mỏng**. Dữ liệu tài liệu và job nằm ở `ai_db` (`ai_documents`, `ai_jobs`, §4.7) và việc nền chạy ở `ai-worker`; `course` không có bảng, worker hay client provider cho tính năng này. Năm route trên giữ nguyên hợp đồng public. `course` chỉ làm bốn việc:
  - Kiểm tra bài học thuộc khóa học và quyền sở hữu (A, I* như mọi route quản lý bài học) trước khi gọi `ai`; 404/403 do `course` trả, `ai` không biết khóa học hay quyền.
  - Lấy tệp đính kèm từ `media` (`GET /internal/v1/media/usages/by-owner?owner_kind=COURSE&owner_id={lesson_id}&usage_type=LESSON_ATTACHMENT`, §5) và gửi metadata tệp sang `ai` (`documents/sync|query`); `ai` giữ `PROCESSING` còn facade hiển thị `EXTRACTING` để hợp đồng public không đổi. Bài học không có tệp đính kèm thì trả danh sách rỗng, không gọi `ai`.
  - Tạo job: với `SYNTHESIZE_LESSON` mà bài học đã có nội dung và `overwrite_content=false` thì 409 `LESSON_CONTENT_EXISTS` (không gọi `ai`); `media_ids` phải là tập con tệp đính kèm của bài học (khác thì 422 `AI_DOCUMENTS_NOT_EXTRACTED` kèm `details.media_ids`); rồi `POST /internal/v1/ai/jobs` với `requested_by` = người gọi (id, role) được truyền tường minh. Lỗi nghiệp vụ của `ai` (409 `AI_JOB_ALREADY_ACTIVE`, 422 `AI_DOCUMENTS_NOT_EXTRACTED`, 404, …) được chuyển nguyên mã, mã HTTP và `details`.
  - Phục vụ `ai-worker` ba route nội bộ (§5): `ai-context` (tiêu đề + nội dung hiện có), `ai-content` (ghi nội dung bài học, trả bản cũ; tái dùng `update-lesson`, đi cùng đường đồng bộ usage media) và `ai-quizzes` (tái dùng `create-quiz`, luôn `DRAFT`; dữ liệu quiz sai trả 400 `VALIDATION_ERROR` kèm `path`/`message` để model sửa). Cả hai route ghi chạy dưới danh nghĩa `requested_by` nên quyền sở hữu khóa học vẫn được kiểm tra; `LESSON_CONTENT_EXISTS` (409) khi bài học có nội dung mà không `overwrite_content`.
  - Hệ quả: các route AI của `course` phụ thuộc `ai` đang chạy (`ai` chết → 503/504 `DEPENDENCY_*`, tính năng khác của `course` không ảnh hưởng). Xóa bài học/khóa học/media **không** xóa `ai_documents`/`ai_jobs` của chúng (không có FK chéo DB, chưa có chính sách retention): bản ghi mồ côi vô hại, ghi nhận ở ma trận dữ liệu.
  - Cạnh `course → ai → course` tạo vòng phụ thuộc: chấp nhận vì chiều `ai → course` chỉ do `ai-worker` gọi bất đồng bộ sau khi `course` đã nhận `202` (course không bao giờ chờ `ai-worker`); đường gọi ghi telemetry `dependency_identity=ai-worker-course` (service-catalogue-and-topology-v2 §cạnh phụ thuộc).

---

## 4.4. media

| Method | Path                                       | Role | Use case                                                                                             |
| ------ | ------------------------------------------ | :--: | ---------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/media`                            |  *   | `upload-media` (multipart)                                                                           |
| POST   | `/api/v1/media/upload-intents`             |  *   | `create-upload-intent` (presigned POST MinIO, hết hạn 900 giây, ghim key/content-type/size/checksum) |
| POST   | `/api/v1/media/{media_id}/upload-complete` |  *   | `complete-direct-upload` (kiểm tra metadata + checksum, promote object, `READY`)                     |
| GET    | `/api/v1/media/library`                    |  *   | `get-media-library`                                                                                  |
| GET    | `/api/v1/media/{media_id}/content`         |  –   | `get-media-content` (stream, Range)                                                                  |
| GET    | `/api/v1/media/avatars/{user_id}`          |  –   | `get-user-avatar-content` (stream, Range; 404 khi chưa đặt avatar)                          |
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

Bucket MinIO: `images`, `videos`, `documents`, `audios`, `other` (chọn theo loại media suy ra từ MIME). Client không bao giờ thấy bucket hay object key cuối cùng; response chỉ có `content_url` và `thumbnail_url` qua Gateway.

**Object key** (múi giờ UTC):

| Loại object      | Bucket           | Key                                                                                                |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| Upload tạm       | cùng bucket đích | `tmp/{uuid}.{ext}` (presigned POST ghim bucket, key, content-type và đúng kích thước khai báo)     |
| Media gốc        | theo loại        | `yyyy/MM/dd/{uuid}.{ext}`; `upload-complete` kiểm tra kích thước và SHA-256 rồi copy sang key này, xóa `tmp/` |
| Thumbnail        | `images`         | `yyyy/MM/dd/{uuid}.webp`; là một dòng `media_objects` có `source_media_id` trỏ về media gốc          |

Presigned POST bắt buộc lộ key `tmp/…` cho trình duyệt; key cuối cùng chỉ `media` biết. Phần mở rộng lấy từ tên file, chỉ giữ ký tự an toàn `[a-z0-9]`, mặc định `bin`.

**MIME do server quyết định (từ 30/10/2026)**: `media` suy MIME từ nội dung (chữ ký byte của 64 KiB đầu), không tin `Content-Type` hay đuôi tệp do client gửi. Multipart: phần `Content-Type` bị bỏ qua, loại, bucket và giới hạn kích thước theo MIME suy ra. `upload-intents`: `mime_type` chỉ là gợi ý để chọn bucket và mức dung lượng tối đa (server chưa thấy byte); `upload-complete` đọc đoạn đầu object tạm, nếu **loại** (ảnh/video/tài liệu/audio/khác) khác loại đã khai báo thì xóa object tạm, đặt `FAILED` (`failure_reason=MIME_MISMATCH`) và trả `415 MEDIA_MIME_MISMATCH`; cùng loại nhưng khác định dạng (khai `image/png`, thực là JPEG) thì chấp nhận và lưu MIME thật. Đuôi tệp chỉ phân biệt các định dạng cùng chữ ký (ZIP/OLE → docx, xlsx, pptx, odt, ods, odp, doc, xls, ppt; văn bản → `text/markdown`, `text/csv`). Văn bản UTF-8 hợp lệ luôn là `text/plain` (kể cả HTML/SVG, không bao giờ `text/html` hay `image/svg+xml`); nội dung không nhận ra là `application/octet-stream` (loại `other`). Chưa kiểm hết tệp: chỉ đọc đoạn đầu, nên tệp ZIP/OLE giả đuôi Office vẫn lọt.

**Giới hạn kích thước** theo loại (cấu hình trong code): ảnh 10 MB, video 500 MB, tài liệu 50 MB, audio 100 MB, khác 25 MB; vượt giới hạn trả `MEDIA_TOO_LARGE` (413). Upload multipart qua `media` bị chặn thêm bởi `MEDIA_MULTIPART_MAX_BYTES` (mặc định 25 MB); file lớn hơn phải dùng `upload-intents`.

**Cờ `extract_text` (R-08)**: `upload-intents` (JSON `extract_text: boolean`, mặc định `false`) và `POST /api/v1/media` (multipart field `extract_text` = `true|false`) nhận cờ yêu cầu trích văn bản bằng AI. Cờ chỉ hợp lệ cho loại tệp `ai` đọc được (TXT/MD, DOCX, PDF, ảnh) và kích thước ≤ 15 MB; vi phạm trả 400 `VALIDATION_ERROR`, giá trị không phải boolean cũng 400. Cờ lưu ở cột `media_objects.extract_text` và hiện trong DTO media. Khi media chuyển `READY` (upload multipart hoặc `upload-complete`), `media` ghi command `ai.document.extract` (§6.3) vào `outbox_messages` **trong cùng transaction**; media `FAILED` thì không có command. `ai` tạo bản ghi tài liệu theo `media_id` (idempotent), nên cùng tệp được dùng lại khi gắn vào bài học. `media` sao chép bảng phân loại định dạng của `ai` (`isExtractableDocument`) để từ chối sớm; `ai` vẫn là nơi quyết định `UNSUPPORTED`.

**Thumbnail**: ảnh dùng `sharp` (WebP, cạnh dài tối đa 480 px), video lấy một khung hình bằng `ffmpeg` (có trong image `media`). `GET /thumbnail` stream WebP khi `thumbnail_status=READY`; ngược lại trả `MEDIA_NOT_READY` kèm `thumbnail_status` trong `details`. `thumbnail/retry` đặt lại job và gửi lại command `media.thumbnail.generate`.

**Quy tắc usage**:

- Ma trận loại: `owner_kind` quyết định `usage_type` hợp lệ (COURSE: thumbnail, gallery, description, lesson content, lesson attachment, quiz content; NOTIFICATION: body; USER: avatar; MEDIA: thumbnail). `COURSE_THUMBNAIL`, `COURSE_GALLERY`, `USER_AVATAR` chỉ nhận ảnh gốc `READY`.
- Singleton (`COURSE_THUMBNAIL`, `USER_AVATAR`): gắn media mới thay usage cũ trong cùng transaction; có partial unique index chống đua.
- Avatar (`owner_kind=USER`, đổi từ `STUDENT` ngày 30/10/2026): mọi role (student, instructor, admin) chỉ tự đặt avatar của chính mình (`owner_id` = id trong token), kể cả admin không đặt hộ người khác; admin vẫn gỡ được avatar của người khác. Riêng student còn phải có hồ sơ `ACTIVE` qua `GET /internal/v1/students/{id}` (cạnh `media → identity`); instructor và admin không gọi `identity`, vì token đã chứng minh tài khoản tồn tại. Avatar của student cũ giữ nguyên (migration đổi tên giá trị enum, không mất dữ liệu).
- Đọc avatar: `GET /api/v1/media/avatars/{user_id}` (công khai như `content`, stream ảnh gốc có `Range`; `404` khi chưa đặt). `identity` ghép `avatar_url` = URL này vào DTO tài khoản (`/auth/me`, danh sách tài khoản) và DTO student, dựng thuần từ id (`userAvatarUrl` trong `contracts`) nên không gọi `media`; trường luôn có giá trị và phải xử lý `404`. Ảnh có thể cũ tới 5 phút do `Cache-Control: public, max-age=300`.
- Xóa và sắp xếp lại usage: chỉ người tạo usage hoặc admin; sai quyền trả 403.
- `GET /usages/urls?usage_ids=a,b` tối đa 100 id (phân tách bằng dấu phẩy).

**Command và queue** (xem §6): `media-worker--generate-media-thumbnail-v1`, `…--synchronize-markdown-media-usage-v1`, `…--delete-media-usages-by-ids-v1`, `…--register-notification-media-usage-v1`, `…--register-notification-media-usages-v1`, `…--start-notification-media-usage-job-v1`, `…--complete-notification-media-usage-job-v1`. Worker xử lý idempotent qua `inbox_states` và retry rồi chuyển `<queue>.error`.

**Cleanup (R-09)**: `POST /internal/v1/media/cleanup` (scope `media:cleanup`, chỉ `scheduler-worker` gọi; không qua Gateway). Body tùy chọn, mọi trường có mặc định và biên do `media` quyết định qua env `MEDIA_CLEANUP_*`:

| Trường                  | Ý nghĩa                                                                                       | Mặc định (env)                               | Biên                |
| ----------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------- |
| `retention_hours`       | Media gốc `READY` không còn usage và có `created_at`, `updated_at` cũ hơn ngần này giờ mới bị dọn | 168 (`MEDIA_CLEANUP_DEFAULT_RETENTION_HOURS`) | `MEDIA_CLEANUP_MIN/MAX_RETENTION_HOURS` (mặc định 1–8760) |
| `pending_grace_minutes` | Upload `PENDING` stale = quá `upload_expires_at` (hoặc `created_at` nếu không có hạn) cộng ngần này phút | 15 (`MEDIA_CLEANUP_PENDING_GRACE_MINUTES`) | 0–10080             |
| `limit`                 | Số media tối đa mỗi pha trong một lần gọi                                                       | 200 (`MEDIA_CLEANUP_DEFAULT_LIMIT`)          | 1–`MEDIA_CLEANUP_MAX_LIMIT` (mặc định 1000) |

Giá trị ngoài biên trả `400 VALIDATION_ERROR`. Idempotent, ba pha mỗi lần gọi: (1) upload `PENDING` stale → xóa object tạm/object cuối mồ côi (kiểm bằng `stat` MinIO) rồi chuyển `FAILED` với `failure_reason=UPLOAD_ABANDONED`; (2) media gốc `READY` không còn usage nào → xóa mềm (`deleted_at`) cùng thumbnail của nó (dòng `source_media_id` và usage `MEDIA_THUMBNAIL`) rồi xóa object; (3) thumbnail mồ côi (media gốc đã xóa mềm). Mỗi media một transaction: khóa dòng `FOR UPDATE SKIP LOCKED`, kiểm lại điều kiện và đếm usage sau khi giữ khóa; MinIO lỗi thì rollback, media đó được tính vào `failed` và thử lại ở lần sau. Media còn usage (kể cả singleton `COURSE_THUMBNAIL`, `USER_AVATAR`) không bao giờ bị chọn; object đã mất sẵn không phải lỗi. Thời gian lưu giữ tính từ `created_at`/`updated_at` của media, không phải từ lúc usage cuối bị gỡ. Phản hồi 200 là bản tóm tắt an toàn, không lộ bucket, object key hay credential:

```json
{
  "retention_hours": 168, "pending_grace_minutes": 15, "limit": 200,
  "unused_deleted": 2, "thumbnails_deleted": 1, "objects_removed": 3,
  "pending_recovered": 1, "pending_orphan_objects_removed": 1,
  "skipped": 0, "failed": 0, "has_more": false
}
```

Producer command usage của notification đã có từ R-07 (§4.5).

## 4.5. notification

| Method | Path                                           | Role | Use case                                                                   |
| ------ | ---------------------------------------------- | :--: | -------------------------------------------------------------------------- |
| POST   | `/api/v1/notifications`                        |  A   | `create-notification` (đơn; gửi email + ghi inbox)                         |
| GET    | `/api/v1/notifications/{notification_id}`      |  A   | `get-notification`                                                         |
| GET    | `/api/v1/notifications/me`                     |  S   | `list-my-notifications` (inbox, phân trang, lọc `status=UNREAD\|READ`)     |
| PATCH  | `/api/v1/notifications/{notification_id}/read` |  S   | `mark-notification-read`                                                   |
| POST   | `/api/v1/notifications/read-all`               |  S   | `mark-all-notifications-read` (200, `{updated_count}`)                     |
| POST   | `/api/v1/notification-batches`                 |  A   | `create-notification-batch` (`target_scope=ALL_STUDENTS`)                  |
| GET    | `/api/v1/notification-batches`                 |  A   | `list-notification-batches`                                                |
| GET    | `/api/v1/notification-batches/{batch_id}`      |  A   | `get-notification-batch`                                                   |
| GET    | `…/{batch_id}/snapshot-status`                 |  A   | `get-batch-snapshot-status`                                                |
| GET    | `…/{batch_id}/delivery-status`                 |  A   | `get-batch-delivery-status`                                                |
| GET    | `…/{batch_id}/failed-items`                    |  A   | `get-batch-failed-items`                                                   |
| POST   | `…/{batch_id}/retry-failed`                    |  A   | `retry-failed-notification-batch` (một batch nguồn chỉ có một batch retry) |

Phần inbox là mới so với repo mẫu. Email đi qua SMTP; lỗi gửi ghi vào item `RETRY`/`FAILED`, không làm hỏng response tạo batch (xử lý bất đồng bộ).

**Đã triển khai ở R-07** (contract DTO ở `lms/contracts/src/http/public/notification.ts`):

- `POST /api/v1/notifications` nhận `{student_id, title, content_markdown, send_email=true}`, trả 201. Thông báo luôn vào inbox; `email_status` là `PENDING` (chờ `notification-worker` gửi), `SENT`, `FAILED` hoặc `NOT_REQUESTED` (`send_email=false`). Student không còn `ACTIVE` khi gửi thì `email_status=FAILED`, không retry; lỗi SMTP/student tạm thời được consumer retry rồi mới `FAILED`.
- `POST /api/v1/notification-batches` nhận `{title, content_markdown, batch_size?}` (mặc định 500, tối đa 1000), trả 201 với `status=PENDING`; recipient được chụp bất đồng bộ. `snapshot-status` trả `{batch_id, status, snapshotted_count, snapshot_finished}`, `delivery-status` trả `{batch_id, status, total, pending, processing, retry, success, failed}`, `failed-items` phân trang `{id, student_id, email, attempts, last_error, updated_at}`.
- `retry-failed` trả 201 batch mới `target_scope=FAILED_RECIPIENTS`, `source_batch_id` trỏ batch nguồn; lỗi `NOTIFICATION_BATCH_NOT_RETRYABLE` / `NOTIFICATION_BATCH_RETRY_EXISTS` (409, §3).
- Mỗi item gửi tối đa `NOTIFICATION_ITEM_MAX_ATTEMPTS` lần (mặc định 3, backoff nhân đôi từ `NOTIFICATION_ITEM_RETRY_DELAY_MS`); trạng thái cuối batch: mọi item `SUCCESS` → `COMPLETED`, lẫn → `PARTIAL_FAILED`, toàn `FAILED` → `FAILED`. Inbox của batch chỉ ghi cho recipient gửi thành công (unique `(batch_id, student_id)` nên redelivery không trùng).
- Markdown tham chiếu `/api/v1/media/{uuid}/(content|thumbnail)` đăng ký usage `NOTIFICATION_BODY`: thông báo đơn gửi `media.notification-usage.register`; batch gửi `start-job` khi tạo, `register-batch` (≤ 500 item mỗi lô) từ worker sau mỗi lượt gửi và `complete-job` kèm `expected_usage_count` khi batch kết thúc hoặc `FAILED`.
- Hai tiến trình dùng cùng image: `notification` (API, cổng 3006, relay outbox) và `notification-worker` (cổng 3007, `node dist/worker.js`, chỉ `/health` `/ready`).

## 4.6. scheduler

| Method | Path                                   | Role | Use case                                               |
| ------ | -------------------------------------- | :--: | ------------------------------------------------------ |
| GET    | `/api/v1/scheduler/jobs`               |  A   | `list-jobs` (lọc `status`, `type`; phân trang)         |
| POST   | `/api/v1/scheduler/jobs`               |  A   | `create-job` (`MANUAL` hoặc `CRON`)                    |
| GET    | `/api/v1/scheduler/jobs/{job_id}`      |  A   | `get-job`                                              |
| PATCH  | `/api/v1/scheduler/jobs/{job_id}`      |  A   | `update-job-status` (`ACTIVE`, `PAUSED`, `DISABLED`)   |
| POST   | `/api/v1/scheduler/jobs/{job_id}/runs` |  A   | `trigger-job-run` (có `idempotency_key`)               |
| GET    | `/api/v1/scheduler/jobs/{job_id}/runs` |  A   | `list-job-runs` (lọc `status`; phân trang)             |

**Đã triển khai ở R-09** (DTO ở `lms/contracts/src/http/public/scheduler.ts`). Hai tiến trình dùng chung một image: `scheduler` (API, cổng 3008) và `scheduler-worker` (cổng 3010, `node dist/worker.js`, chỉ `/health` `/ready`). Scheduler **không dùng command RabbitMQ** nên §6.3 không đổi: bảng `background_job_runs` vừa là lịch sử vừa là hàng đợi, worker nhận việc bằng lease `FOR UPDATE SKIP LOCKED` (cùng kiểu `notification-worker`), để tạo run chỉ là một câu `INSERT` (không có ghi kép DB và broker) và worker chết chỉ làm lease hết hạn.

- `POST /jobs` nhận `{name, type, schedule_type, cron_expression?, payload?, allow_concurrent=false}`, trả 201 job `ACTIVE`. `type` hiện chỉ có `MEDIA_UNUSED_CLEANUP` (job tích hợp sẵn). `cron_expression` bắt buộc với `CRON`, cấm với `MANUAL`; là CRON 5 trường theo UTC (`*`, danh sách, khoảng, bước, tên tháng/thứ, macro `@hourly` `@daily` `@weekly` `@monthly` `@yearly`; ngày-trong-tháng và ngày-trong-tuần cùng bị giới hạn thì khớp một trong hai); sai cú pháp hoặc không bao giờ khớp → `400 VALIDATION_ERROR` (`details[].path = cron_expression`). `payload` (≤ 4 KB) của `MEDIA_UNUSED_CLEANUP` là đúng body cleanup của §4.4 (`retention_hours`, `pending_grace_minutes`, `limit`), sai → 400. `name` duy nhất, trùng → `409 CONFLICT`. Job `CRON` có `next_run_at` tính ngay.
- `PATCH /jobs/{job_id}` nhận `{status}`. `PAUSED`/`DISABLED` xóa `next_run_at`; `ACTIVE` lại tính `next_run_at` từ bây giờ (không chạy bù lúc tạm dừng); cùng trạng thái là no-op. `DISABLED` đóng các run `PENDING` của job bằng `FAILED`/`JOB_DISABLED`; run `PENDING` của job `PAUSED` giữ nguyên chờ chạy tiếp khi `ACTIVE`.
- `POST /jobs/{job_id}/runs` nhận `{idempotency_key}` (1–128 ký tự) và tạo run `MANUAL` `PENDING` (snapshot payload của job). **Ngữ nghĩa lũy đẳng**: unique `(background_job_id, idempotency_key)` với `INSERT … ON CONFLICT DO NOTHING`; trả **201** khi tạo run mới, **200** kèm đúng run đã có khi khóa đã dùng cho job đó (kể cả đang chạy, đã xong hay job đã bị tạm dừng sau đó), không bao giờ tạo run thứ hai. Job không `ACTIVE` mà khóa chưa dùng → `409 SCHEDULER_JOB_NOT_ACTIVE` (`details.status`). Job không tồn tại → 404.
- Lịch CRON: mỗi chu kỳ `scheduler-worker` khóa (`SKIP LOCKED`) các job `CRON` `ACTIVE` đến hạn, tạo run `CRON` với khóa lũy đẳng `cron:<job_id>:<scheduled_at ISO UTC>` rồi dời `next_run_at` sang mốc kế tiếp **sau bây giờ**; nhiều instance hoặc `next_run_at` bị đặt lại không tạo run trùng, và worker ngừng lâu chỉ chạy bù một lần (không dồn các mốc đã lỡ).
- Thực thi: worker nhận run `PENDING` của job `ACTIVE` bằng lease (`SCHEDULER_RUN_LEASE_MS`), đặt `RUNNING`, gọi handler theo `type`, ghi `SUCCEEDED`/`FAILED`. Job không `allow_concurrent` chỉ có một run `RUNNING` tại một thời điểm (tuần tự hóa bằng khóa dòng job). Lease hết hạn (worker chết) thì run được nhận lại tới `SCHEDULER_RUN_MAX_ATTEMPTS`, sau đó `FAILED`/`RUN_LEASE_EXPIRED`; handler vì vậy phải idempotent. Không tự động retry run `FAILED`: tạo run mới bằng `trigger-job-run` với khóa khác.
- Run (`BackgroundJobRunDto`): `trigger_type` `MANUAL|CRON`, `status` `PENDING|RUNNING|SUCCEEDED|FAILED`, `attempts`, `scheduled_at`, `started_at`, `finished_at`, `worker_instance`, `error_code`, `error_message`, `output` (tóm tắt an toàn, `output_json` trong DB). Không trả `lease_token`.
- Mã lỗi của **run** (cột `error_code`, không phải mã HTTP; thông báo luôn an toàn, không token, không object key): `MEDIA_CLEANUP_INCOMPLETE` (media trả `failed > 0`, giữ `output`), `MEDIA_CLEANUP_REJECTED` (media trả 4xx), `MEDIA_CLEANUP_INVALID_RESPONSE`, `DEPENDENCY_UNAVAILABLE`/`DEPENDENCY_TIMEOUT` (media chết hoặc quá hạn, theo §2), `RUN_LEASE_EXPIRED`, `JOB_DISABLED`, `INTERNAL_ERROR`.
- Mã lỗi HTTP: `SCHEDULER_JOB_NOT_ACTIVE` (409, §2); còn lại dùng mã chung (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`).

**Job `MEDIA_UNUSED_CLEANUP`** (thiết kế gốc: repo mẫu `docs/business-flows/scheduler/media-cleanup.md`): handler của `scheduler-worker` gọi `POST /internal/v1/media/cleanup` (§4.4, §5) bằng `HttpQueryClient` với service token của client `scheduler-worker` (audience `media`, scope `media:cleanup`) và body là payload của run. Scheduler không biết MinIO, không đọc `media_db`; `output` của run là bản tóm tắt mà media trả về. Cạnh phụ thuộc: timeout `SCHEDULER_MEDIA_TIMEOUT_MS` (mặc định 60 giây, nhỏ hơn lease), circuit breaker, không retry HTTP (§1).

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

Quy tắc (R-08, đối chiếu `lms/services/ai`):

- **Provider**: `provider_type` ∈ `OPENAI`, `GEMINI`, `ANTHROPIC`, `MISTRAL`, `CUSTOM` (mọi loại nói chuẩn OpenAI chat-completions); bỏ `base_url` thì dùng endpoint mặc định của loại, `CUSTOM` bắt buộc có (URL http(s) tuyệt đối, không chứa user/password). `name` 2–100 ký tự, duy nhất không phân biệt hoa thường (409 `AI_PROVIDER_NAME_CONFLICT`). `api_key` 8–500 ký tự không có khoảng trắng, chỉ ghi; `PUT` không gửi `api_key` thì giữ key cũ. Response chỉ có `api_key_hint` (`****` + 4 ký tự cuối). Xóa provider còn model → 409 `AI_PROVIDER_IN_USE`.
- **Model**: `(provider_id, model_name)` duy nhất (409 `AI_MODEL_CONFLICT`); không đổi được provider; xóa model còn binding → 409 `AI_MODEL_IN_USE`.
- **Binding**: `PUT /service-bindings/{task_key}` body `{model_id}` (201 lần đầu, 200 khi đổi model); model hoặc provider `INACTIVE` → 409 `AI_REFERENCE_INACTIVE`; `task_key` ngoài danh sách → 400; `GET`/`DELETE` task chưa gán → 404.
- **Health check**: `POST …/health-check` gọi `GET {base_url}/models` với timeout `AI_HEALTH_CHECK_TIMEOUT_MS` (6 giây), trả `health_status` ∈ `ONLINE`, `AUTH_FAILED` (401/403), `UNREACHABLE` (không kết nối được hoặc quá hạn), `ERROR` (mã khác), `DISABLED` (provider `INACTIVE`, không gọi ra ngoài); không ghi DB. `health-checks` kiểm tra mọi provider.
- **Completion** (`POST /internal/v1/ai/completions`, scope `ai:completion`): body `{task, messages, tools}`; `messages[]` có `role` (`system|user|assistant|tool`), `text` hoặc `parts[]` (`text`, `image`, `file` với `data_base64`; PDF/ảnh tối đa ~24 triệu ký tự tổng), `tool_calls[]` (`arguments_json`), `tool_call_id`. Trả `{task, provider_type, model_name, text, tool_calls, finish_reason, prompt_tokens, completion_tokens, latency_ms}` (`finish_reason=length` nghĩa là bị cắt). Timeout `AI_COMPLETION_TIMEOUT_MS` (240 giây), không retry, không theo redirect của provider. Lỗi: task chưa gán → 409 `AI_TASK_NOT_CONFIGURED`; key không giải mã được → 409 `AI_PROVIDER_KEY_UNREADABLE`; provider 400/422 → 422 `AI_PROVIDER_REJECTED_REQUEST`; provider 401/403/429/5xx hoặc phản hồi sai định dạng → 502 `AI_PROVIDER_ERROR` (`details.reason` ∈ `AUTH_FAILED`, `RATE_LIMITED`, `INVALID_RESPONSE`, `UPSTREAM_ERROR`); quá hạn → 504 `DEPENDENCY_TIMEOUT`; không kết nối được → 503 `DEPENDENCY_UNAVAILABLE` (dependency `ai-llm-provider`). Thông điệp lỗi không bao giờ chứa API key hay host của provider.
- **Nhật ký gọi**: mỗi lần completion (thành công hay lỗi) ghi `ai_invocations` (task, provider, model, trạng thái, mã lỗi, token, độ trễ, số tool call); không lưu nội dung message hay API key.

**Tài liệu và job AI của bài học (R-08, thiết kế lại)**: `ai` sở hữu việc trích văn bản và chạy job; `course`/`media` chỉ gọi `ai`. Bề mặt nội bộ (không qua Gateway, scope ở §1.1; `ai` không biết khóa học hay quyền, `course` đã kiểm tra và truyền `requested_by`):

| Method | Path                                | Scope               | Mô tả                                                                                                                   |
| ------ | ----------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| POST   | `/internal/v1/ai/documents/sync`    | `ai:document:write` | Body `{documents[1..100]: {media_id, file_name, content_type, media_type}, retry_failed}`; chèn bản ghi còn thiếu `PENDING` (hoặc `UNSUPPORTED`) kèm command `ai.document.extract`; `retry_failed` đặt `FAILED` về `PENDING`; trạng thái `PROCESSING` quá hạn lease được xử lý như bên dưới. Trả trạng thái từng tệp (200). |
| POST   | `/internal/v1/ai/documents/query`   | `ai:document:read`  | Cùng body nhưng không ghi; tệp chưa có bản ghi trả `NOT_QUEUED` hoặc `UNSUPPORTED`; không bao giờ trả văn bản.         |
| POST   | `/internal/v1/ai/jobs`              | `ai:job:write`      | Body `{job_type, course_id, lesson_id, media_ids[1..20], question_count?, overwrite_content, requested_by: {id, role}}`; 202, job `PENDING`; 409 `AI_JOB_ALREADY_ACTIVE`, 422 `AI_DOCUMENTS_NOT_EXTRACTED` (kèm `details.media_ids`). |
| GET    | `/internal/v1/ai/jobs?lesson_id=…`  | `ai:job:read`       | Tối đa 10 job mới nhất của bài học (`limit` ≤ 10).                                                                      |
| GET    | `/internal/v1/ai/jobs/{job_id}?lesson_id=…` | `ai:job:read` | Chi tiết kèm `previous_content_markdown`; 404 nếu job không thuộc bài học.                                       |

- **Dữ liệu** (`ai_db`): `ai_documents` (duy nhất theo `media_id`; `status` `PENDING|PROCESSING|EXTRACTED|FAILED|UNSUPPORTED`, văn bản, số lần thử, lease, `error_code`) và `ai_jobs` (`job_type` `SYNTHESIZE_LESSON|GENERATE_QUIZ`, `course_id`, `lesson_id`, `requested_by_id`/`requested_by_role`, `status`, lease, `result_quiz_id`, `previous_content_markdown`; partial unique index `ai_jobs_one_active` trên `(lesson_id, job_type)` khi `status` ∈ `PENDING|RUNNING`).
- **Hai tiến trình, cùng image**: `ai` (API, cổng 3009, relay outbox) và `ai-worker` (cổng 3011, `node dist/worker.js`, chỉ `/health` `/ready`). `ai-worker` gọi provider **trong process** (không qua HTTP), nên `POST /internal/v1/ai/completions` giữ nguyên chỉ cho client ngoài.
- **Trích xuất** (command `ai.document.extract`, §6.3): worker nhận tài liệu bằng lease (`AI_WORKER_LEASE_MS`, mặc định 10 phút), tải byte qua `GET /internal/v1/media/{id}/content` (tối đa 15 MB, scope `media:content:read`): TXT/MD đọc UTF-8, DOCX qua parser trong `ai`, PDF/ảnh gửi task `document-extraction`. Văn bản quá 300.000 ký tự bị cắt kèm ghi chú; lỗi ghi `FAILED` + `error_code` (`UNSUPPORTED_FORMAT`, `DOCUMENT_TOO_LARGE`, `EXTRACTION_EMPTY`, `EXTRACTION_FAILED`, `EXTRACTION_INTERRUPTED`, hoặc mã lỗi của `media`/`ai`). Tối đa 3 lần nhận; tài liệu `PROCESSING` quá lease chỉ được phục hồi khi `documents/sync` được gọi lại: hết 3 lần thì `FAILED`/`EXTRACTION_INTERRUPTED`, còn lượt thì về `PENDING` kèm command mới.
- **Job** (command `ai.job.run`, §6.3): `SYNTHESIZE_LESSON` (task `lesson-synthesis`, tool `save_lesson_content`) hoặc `GENERATE_QUIZ` (task `quiz-authoring`, tool `create_quiz`, `question_count` 1–30, mặc định 10, đúng số câu yêu cầu). Mọi tài liệu phải `EXTRACTED`; tổng văn bản ≤ 150.000 ký tự. Worker đọc `ai-context` từ `course`, chạy vòng agent tối đa 6 lượt (gia hạn lease trước mỗi lượt), tool gọi `ai-content`/`ai-quizzes` của `course` với `requested_by` của job; dữ liệu quiz sai (400) được trả lại cho model sửa. Ghi thành công thì `COMPLETED` (quiz luôn `DRAFT`). `error_code`: `AI_NO_RESULT`, `AI_TOO_MANY_STEPS`, `DOCUMENT_NOT_READY`, `DOCUMENTS_TOO_LARGE`, `LESSON_CONTENT_EXISTS`, `WORKER_INTERRUPTED`, hoặc mã lỗi của `ai`/`course`.
- **Lease và giao lại command**: mỗi job/tài liệu có đúng **một** command, ghi vào outbox cùng transaction với bản ghi (không tự enqueue lại). Tính đúng đắn đến từ máy trạng thái + lease (`UPDATE … WHERE status=… `/`FOR UPDATE SKIP LOCKED`), không từ inbox: command giao lại khi bản ghi đang `PROCESSING|RUNNING` còn lease là no-op; job `RUNNING` quá lease thành `FAILED`/`WORKER_INTERRUPTED` và **không chạy lại** (tránh tạo trùng quiz hay ghi đè lần hai). Chuyển trạng thái cuối được ghi cùng dòng `inbox_states` trong một transaction nên command đã xử lý xong bị khử trùng. Command vào `<queue>.error` thì `onFault` đặt bản ghi `FAILED`.
- Văn bản tài liệu là dữ liệu không tin cậy: nằm trong khối `<document>`, system prompt yêu cầu không làm theo chỉ dẫn trong tài liệu.
- **Lỗi nghiệp vụ**: 409 `AI_JOB_ALREADY_ACTIVE`, 422 `AI_DOCUMENTS_NOT_EXTRACTED`, 404 job; `LESSON_CONTENT_EXISTS` do `course` trả (facade và `ai-content`).
- **Cấu hình**: `AI_RABBITMQ_URL`, `AI_OUTBOX_*` (API và worker); worker thêm `SERVICE_CLIENT_ID/SECRET`, `AI_COURSE_BASE_URL`, `AI_MEDIA_BASE_URL`, `AI_WORKER_PREFETCH|MAX_ATTEMPTS|RETRY_DELAY_MS|LEASE_MS`. `AI_WORKER_LEASE_MS` phải lớn hơn `AI_COMPLETION_TIMEOUT_MS` (240 giây).

---

# 5. Contract nội bộ `/internal/v1` (không qua Gateway, cần service token)

| Owner   | Method | Path                                    | Caller               | Scope                   | Mục đích                                                                                                                 |
| ------- | ------ | --------------------------------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| identity | POST   | `/internal/v1/auth/service-token`       | mọi bên cần token    | — (client-credentials)  | Cấp service token: body `{client_id, client_secret, audience, scope?}` → `{access_token, token_type, expires_in, scope}` |
| identity | GET    | `/.well-known/jwks.json`                | mọi service, gateway | — (không xác thực)      | JWKS (RFC 7517) công bố khóa công khai; không bọc envelope                                                               |
| identity | GET    | `/internal/v1/students`                 | notification-worker  | `student:profile:read`  | Danh sách `ACTIVE` theo trang (`page_size` ≤ 100, sắp theo `id`) để snapshot recipient (đã có từ R-07)                    |
| identity | GET    | `/internal/v1/students/{student_id}`    | media, notification-worker | `student:profile:read`  | Hồ sơ theo id; media kiểm tra actor (avatar); 404 khi chưa có hồ sơ. Hồ sơ chỉ được tạo qua đăng ký (cùng transaction với tài khoản), không có route ghi nội bộ |
| media   | POST   | `/internal/v1/media/usages/ids:query`   | course               | `media:usage:read`      | Lấy usage ID theo owner (xóa khóa học)                                                                                   |
| media   | GET    | `/internal/v1/media/usages/urls`        | course               | `media:usage:read`      | URL các usage                                                                                                            |
| media   | GET    | `/internal/v1/media/{media_id}/content` | ai-worker            | `media:content:read`    | Byte tệp cho trích văn bản AI (R-06 cấp cho course; R-08 chuyển sang `ai-worker`)                                        |
| media   | GET    | `/internal/v1/media/usages/by-owner`    | course               | `media:usage:read`      | Usage của một owner kèm metadata tệp (query `owner_kind`, `owner_id`, `usage_type`; theo `position`); course dùng cho tệp `LESSON_ATTACHMENT` của bài học (R-08) |
| media   | POST   | `/internal/v1/media/cleanup`            | scheduler-worker     | `media:cleanup`         | Dọn media không dùng quá hạn và phục hồi upload `PENDING` stale; body tùy chọn `{retention_hours, pending_grace_minutes, limit}`, trả tóm tắt số lượng (job `MEDIA_UNUSED_CLEANUP`, §4.4, §4.6; đã có từ R-09) |
| ai      | POST   | `/internal/v1/ai/completions`           | client ngoài (ai-worker gọi trong process) | `ai:completion` | Hoàn thành hội thoại; body `{task, messages, tools}`, hỗ trợ phần ảnh/PDF; timeout 240 giây (§4.7; R-08, `course` không còn gọi) |
| ai      | POST   | `/internal/v1/ai/documents/sync`        | course               | `ai:document:write`     | Xếp tệp đính kèm vào hàng trích xuất, idempotent theo `media_id` (§4.7; R-08)                                            |
| ai      | POST   | `/internal/v1/ai/documents/query`       | course               | `ai:document:read`      | Trạng thái trích xuất theo tệp, không ghi, không trả văn bản (§4.7; R-08)                                                |
| ai      | POST   | `/internal/v1/ai/jobs`                  | course               | `ai:job:write`          | Tạo job AI `PENDING` cho bài học, kèm `requested_by` (202; §4.7; R-08)                                                   |
| ai      | GET    | `/internal/v1/ai/jobs`                  | course               | `ai:job:read`           | Tối đa 10 job gần nhất của bài học (`?lesson_id=`; R-08)                                                                  |
| ai      | GET    | `/internal/v1/ai/jobs/{job_id}`         | course               | `ai:job:read`           | Chi tiết job kèm `previous_content_markdown` (`?lesson_id=`; R-08)                                                       |
| course  | GET    | `/internal/v1/courses/{course_id}/lessons/{lesson_id}/ai-context` | ai-worker | `course:lesson-ai:read` | Tiêu đề và nội dung hiện có của bài học (404 nếu bài học không thuộc khóa học; R-08)                    |
| course  | PUT    | `/internal/v1/courses/{course_id}/lessons/{lesson_id}/ai-content` | ai-worker | `course:lesson-ai:write` | Ghi nội dung bài học dưới danh nghĩa `requested_by`; trả `previous_content_markdown`; 409 `LESSON_CONTENT_EXISTS` nếu đã có nội dung mà `overwrite_content=false` (R-08) |
| course  | POST   | `/internal/v1/courses/{course_id}/lessons/{lesson_id}/ai-quizzes` | ai-worker | `course:lesson-ai:write` | Tạo quiz `DRAFT` dưới danh nghĩa `requested_by` (201 `{quiz_id}`); dữ liệu sai 400 `VALIDATION_ERROR` để model sửa (R-08) |

Endpoint `/internal/v1/*` trả lỗi cùng envelope; header `x-principal-*` **không có hiệu lực** ở route internal (danh tính là service token); nếu một route internal cần biết actor (ví dụ course → ai), actor là tham số tường minh của request do hợp đồng của route đó quy định, không lấy từ header.

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
| `media.notification-usage.register-batch` | notification-worker               | media-worker        | Đăng ký usage theo batch (≤ 500 item mỗi lô, kèm `job_id`)              |
| `media.notification-usage.start-job`      | notification                      | media-worker        | Mở job usage cho batch                                                  |
| `media.notification-usage.complete-job`   | notification-worker               | media-worker        | Hoàn tất job usage (kèm số usage kỳ vọng)                               |
| `ai.document.extract`                     | ai, media                         | ai-worker           | Trích văn bản một tệp (`media_id`, `file_name`, `content_type`, `media_type`); `ai` phát khi `documents/sync`, `media` phát khi tệp có cờ `extract_text` thành `READY`; queue `ai-worker--extract-ai-document-v1` |
| `ai.job.run`                              | ai                                | ai-worker           | Chạy một job AI đã ghi (`job_id`); đúng một command mỗi job, ghi cùng transaction với `ai_jobs`; queue `ai-worker--run-ai-job-v1` |
| `notification.batch.snapshot`             | notification                      | notification-worker | Chụp danh sách recipient theo trang, chèn item idempotent               |
| `notification.batch.dispatch`             | notification-worker               | notification-worker | Nhận một lô item bằng lease, gửi email, tự enqueue lại tới khi hết      |
| `notification.single.dispatch`            | notification                      | notification-worker | Gửi email cho thông báo đơn đã nằm trong inbox                          |

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

- Mỗi route trong mục 4 có test: đúng role (200/201/204), sai role (403), thiếu service token (401 `SERVICE_TOKEN_MISSING`), thiếu danh tính user (401), body sai (400).
- Mỗi route trong mục 5 có test: đủ scope (2xx), thiếu scope (403 `SERVICE_SCOPE_FORBIDDEN`), thiếu token (401), token của gateway không dùng được ở route internal.
- Ma trận loại token: user token ở service → `TOKEN_TYPE_MISMATCH`; service token ở Gateway → `TOKEN_TYPE_MISMATCH`; giả `x-principal-*` không kèm token gateway bị từ chối.
- Mỗi command có fixture hợp lệ/không hợp lệ và test idempotent theo `message_id`.
- Test eslint boundary xác nhận cấm import chéo service.
- Gateway test: route table mục 3, không proxy `/internal/*` và `/.well-known/*`, xóa `Authorization` và `x-principal-*` giả của client, gắn service token của gateway, cache token.
- `lms/test/http-surface.test.mjs`: controller nằm đúng `public/`/`internal/`, đúng prefix và khai báo xác thực.

---

# 10. Điểm mở được cố ý chưa chốt

- Giá trị timeout/số lần retry consumer: freeze trước campaign thí nghiệm.
- Giới hạn kích thước/ràng buộc nội dung upload thực tế khi chạy tải.
- Cách instructor xem kết quả quiz của student (repo mẫu chưa có): ngoài phạm vi refactor này.
- Giới hạn tốc độ và khóa tạm client cho `POST /internal/v1/auth/service-token` (chống dò secret): chưa làm, xem lại ở R-12.
- Tính công khai của `GET /media/*/content`: xem lại nếu cần bảo mật cao hơn (ví dụ presigned GET).

---

# 11. Xác nhận cần có

| Trường          | Giá trị                                           |
| --------------- | ------------------------------------------------- |
| Người xác nhận  | Đức (không cần Bách review)                       |
| Trạng thái      | `PENDING`                                         |
| Phạm vi xem xét | Mục 3 (route), mục 6 (command), mục 8 (telemetry) |
