# Kiến trúc testbed LMS v2: từ bức tranh tổng thể tới từng service

> **File này giải thích gì:** testbed LMS hiện hành (v2, sau refactor) gồm những gì, mỗi service làm gì, chúng nói chuyện với nhau ra sao (gọi HTTP, gửi command qua RabbitMQ, xác thực bằng token), và những cơ chế nào khiến nguyên nhân sự cố bị che đi hoặc lộ ra muộn. Đọc xong, bạn đủ nền để tự thiết kế case lỗi và đọc trace.
>
> **Nguồn gốc (canonical):**
>
> - [`../architecture/service-catalogue-and-topology-v2.md`](../architecture/service-catalogue-and-topology-v2.md), [`../architecture/backend-microservice-testbed-blueprint-v2.md`](../architecture/backend-microservice-testbed-blueprint-v2.md)
> - [`../architecture/http-and-event-contracts-v2.md`](../architecture/http-and-event-contracts-v2.md), [`../architecture/dependency-resilience-policy-v2.md`](../architecture/dependency-resilience-policy-v2.md)
> - [`../architecture/data-ownership-and-fault-matrix-v2.md`](../architecture/data-ownership-and-fault-matrix-v2.md), [`../architecture/complex-case-catalogue-and-rca-result-v0.md`](../architecture/complex-case-catalogue-and-rca-result-v0.md)
> - [`../adr/adr-004-service-access-token-and-api-surfaces-v1.md`](../adr/adr-004-service-access-token-and-api-surfaces-v1.md), [`../adr/adr-005-merge-auth-student-into-identity-v1.md`](../adr/adr-005-merge-auth-student-into-identity-v1.md), [`../adr/adr-006-trim-project-scope-v1.md`](../adr/adr-006-trim-project-scope-v1.md) (ADR-001→003 chỉ còn giá trị lịch sử)
> - [`../../../docker-compose/compose.yaml`](../../../docker-compose/compose.yaml), [`../../../docker-compose/.env.example`](../../../docker-compose/.env.example), README của từng service trong [`../../../lms/services/`](../../../lms/services/), code trong [`../../../lms/packages/common/src/`](../../../lms/packages/common/src/)
>
> Khi ghi chú này khác tài liệu gốc thì tài liệu gốc đúng; khi tài liệu gốc mâu thuẫn nhau thì ADR-007, ADR-006 và plan-v0.4 được ưu tiên.
>
> Trạng thái tại: 17/11/2026 (tuần 16 theo lịch), sau ADR-007, plan v0.4 và 5 PR của tuần 13 (#75–#79, chưa merge). LMS đóng băng nên kiến trúc trong file này không đổi; tuần 13 chỉ thêm lớp gây lỗi **bên ngoài** LMS (mục 3)

Đọc kèm: [khái niệm nền](02-basic-concepts.md) (microservice, gateway, queue, outbox/inbox, token/JWKS, circuit breaker, trace…), [refactor v1 → v2](03-refactor-v1-to-v2.md) (so sánh với testbed trước refactor), [bảng tra tên](10-naming-cheatsheet.md).

---

## 1. Bức tranh tổng thể

**Ý chính:** testbed là một hệ thống học trực tuyến (LMS) thu nhỏ gồm **7 service + 4 worker = 11 runtime**, chạy bằng Docker Compose, dùng chung một PostgreSQL (6 database riêng), một RabbitMQ, một MinIO, một Mailpit và một nhà cung cấp LLM. Nó không phải sản phẩm thật; nó là "sân tập có camera": nhóm cố ý gây sự cố ở một chỗ, camera (telemetry) ghi lại, rồi RCA engine phải chỉ ra chỗ đó.

### 1.1. Sơ đồ theo tầng

```text
TẦNG 1 - CỬA VÀO (HTTP /api/v1, chỉ Gateway gọi)
  Client ──▶ gateway ──▶ identity | course | media | notification | scheduler | ai

TẦNG 2 - SERVICE GỌI NHAU (HTTP /internal/v1, "gọi điện thoại", bên gọi phải chờ)
  course ──────────────▶ media        (usage, tệp đính kèm bài học)
  course ──────────────▶ ai           (tài liệu và job AI)
  media ───────────────▶ identity     (kiểm hồ sơ student khi đặt avatar)
  notification-worker ─▶ identity     (lấy danh sách người nhận)
  scheduler-worker ────▶ media        (dọn media không dùng)
  ai-worker ───────────▶ course       (đọc bài học, ghi nội dung/quiz)
  ai-worker ───────────▶ media        (tải byte tệp để trích văn bản)

TẦNG 3 - GIAO VIỆC CHO WORKER (command qua RabbitMQ, "gửi thư", bên gửi không chờ)
  course, media, notification, notification-worker ══▶ media-worker
  notification, notification-worker               ══▶ notification-worker
  ai, media                                       ══▶ ai-worker
  scheduler ┄┄▶ scheduler-worker   (ngoại lệ: không qua RabbitMQ, chung bảng trong scheduler_db)

TẦNG 4 - HẠ TẦNG
  mỗi service và worker ──▶ PostgreSQL (database của chủ)
  media, media-worker ────▶ MinIO          notification-worker ──▶ Mailpit (SMTP)
  ai, ai-worker ──────────▶ LLM provider   publisher/consumer ───▶ RabbitMQ

NỀN - XÁC THỰC (tần suất thấp, gần như vô hình)
  bên gọi HTTP ──▶ identity: xin service token     bên nhận request ──▶ identity: tải JWKS
```

Chuỗi dài nhất là W5 (thông báo hàng loạt): `notification` ⇒ `notification-worker` → `identity`, rồi `notification-worker` ⇒ `media-worker` → MinIO. Ngoài ra có một **vòng** được chấp nhận: `course → ai ⇒ ai-worker → course` (mục 2.7).

### 1.2. Service khác worker thế nào

**Ý chính:** service là **quầy giao dịch**, worker là **bếp phía sau**. Cùng một nhà hàng (cùng code, cùng database), nhưng hai người khác nhau làm hai việc khác nhau.

| | Service (API) | Worker |
| --- | --- | --- |
| Nhận việc từ đâu | Request HTTP từ Gateway hoặc service khác | Command trong queue RabbitMQ (riêng `scheduler-worker`: thăm dò bảng trong DB) |
| HTTP mở ra | `/api/v1/**`, `/internal/v1/**`, `/health`, `/ready` | Chỉ `/health`, `/ready` |
| Image và code | Image riêng của service, chạy `dist/main.js` | **Cùng image** với service chủ, chạy `node dist/worker.js` |
| Database | Database của mình | **Dùng chung** database với service chủ |
| `service.name` | `media` | `media-worker` (riêng) |
| Migration DB | Chạy `prisma migrate deploy` khi khởi động | Không; chờ service chủ `healthy` rồi mới chạy |

Vì sao tách `service.name` dù chung code? Để RCA phân biệt được triệu chứng nằm ở **quầy** (API chậm) hay ở **bếp** (worker xử lý chậm). Nếu gộp tên, hai loại sự cố rất khác nhau sẽ trông như một.

---

## 2. Mười một runtime và từng service

### 2.1. Bảng tổng hợp

| `service.name` | Loại | Cổng trong network (host) | Database | Việc chính |
| --- | --- | --- | --- | --- |
| `gateway` | service | 3000 (3000) | không có | Cửa vào duy nhất, kiểm user token, gắn service token, chuyển request |
| `identity` | service | 3001 (3001) | `identity_db` | Tài khoản 3 role, đăng ký/đăng nhập, phát user token và service token, JWKS |
| `course` | service | 3003 (3003) | `course_db` | Khóa học, bài học, quiz, ghi danh, tiến độ, chấm quiz, facade AI |
| `media` | service | 3004 (3004) | `media_db` + MinIO | Upload, đọc nội dung, usage, thumbnail, dọn media |
| `media-worker` | worker | 3005 (3005) | `media_db` | Tạo thumbnail, đồng bộ usage |
| `notification` | service | 3006 (3006) | `notification_db` | Thông báo đơn, batch, hộp thư student |
| `notification-worker` | worker | 3007 (3007) | `notification_db` | Chụp danh sách người nhận, gửi email |
| `scheduler` | service | 3008 (**3018**) | `scheduler_db` | Quản lý job nền và lịch sử chạy |
| `scheduler-worker` | worker | 3010 (3010) | `scheduler_db` | Chạy job theo lịch CRON hoặc bấm tay |
| `ai` | service | 3009 (3009) | `ai_db` | Danh bạ provider/model LLM, completion, tài liệu và job AI |
| `ai-worker` | worker | 3011 (3011) | `ai_db` | Trích văn bản tài liệu, chạy job AI soạn bài/sinh quiz |

Cổng host của `scheduler` là 3018 vì host 3008 thuộc Grafana. Candidate set RCA mặc định là 10 runtime (bỏ `gateway`, vì nó chỉ là nơi triệu chứng hiện ra).

### 2.2. `gateway`: người gác cổng tòa nhà

- **Đời thường:** bảo vệ ở cổng. Kiểm thẻ của khách (user token), **xé bỏ** mọi giấy tờ khách tự viết (`Authorization`, `x-principal-*`), rồi đeo cho khách thẻ của tòa nhà (service token của Gateway) kèm hai dòng "người này là ai, vai trò gì" (`x-principal-id`, `x-principal-role`).
- **Endpoint:** chỉ chuyển tiếp `/api/v1/**` theo tiền tố dài nhất, cộng `/health`. `/internal/**`, `/.well-known/**` và đường dẫn lạ trả `404`.

| Tiền tố | Đi tới |
| --- | --- |
| `/api/v1/auth`, `/api/v1/students` | `identity` |
| `/api/v1/courses`, `/api/v1/student` | `course` |
| `/api/v1/media` | `media` |
| `/api/v1/notifications`, `/api/v1/notification-batches` | `notification` |
| `/api/v1/scheduler` | `scheduler` |
| `/api/v1/ai` | `ai` |

- **Phân quyền ở cổng:** `/api/v1/scheduler`, `/api/v1/ai`, `/api/v1/notification-batches` chỉ cho `admin`; còn lại mọi người đã đăng nhập, service tự kiểm chi tiết. Không cần đăng nhập: đăng ký, ba cửa đăng nhập, refresh và các route đọc media nhúng vào trình duyệt.
- **Dữ liệu:** không có.
- **Gọi ai:** 6 upstream (`gateway-<service>`), `identity` để xin token và tải JWKS. **Ai gọi:** client.
- **Điểm RCA:** Gateway **trả nguyên vẹn** mọi phản hồi của upstream (kể cả 4xx/5xx); chỉ tự sinh lỗi khi không có route (`404`), sai token (`401`), sai role (`403`), không kết nối được upstream (`503`), upstream không trả header trong hạn (`504`), hoặc không xin được service token (`503/504`, `details.dependency=gateway-identity-token`). Không retry, không circuit breaker. Upstream trả 5xx vẫn được ghi là lỗi ở metric `gateway-<service>`.

### 2.3. `identity`: phòng cấp thẻ và giữ con dấu

- **Đời thường:** phòng nhân sự kiêm phòng cấp thẻ. Giữ **con dấu duy nhất** (khóa ký Ed25519); ai cũng kiểm được dấu thật hay giả nhờ mẫu dấu công khai (JWKS), nhưng chỉ `identity` đóng được dấu.
- **Endpoint public:** `POST /api/v1/auth/register`, ba cửa đăng nhập `POST /api/v1/auth/{student,instructor,admin}/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`, `GET|POST /api/v1/auth/accounts` (admin), `GET /api/v1/students/me`, `GET /api/v1/students[/{id}]`, `GET /api/v1/students/summary`.
- **Endpoint nội bộ/mở:** `POST /internal/v1/auth/service-token` (cấp service token), `GET /internal/v1/students` và `GET /internal/v1/students/{id}` (scope `student:profile:read`), `GET /.well-known/jwks.json`.
- **Dữ liệu (`identity_db`):** `identity_users` (tài khoản 3 role), `identity_student_profiles` (hồ sơ student, khóa ngoại thật tới tài khoản), `identity_refresh_tokens`, `identity_service_clients` (sổ đăng ký client dịch vụ).
- **Gọi ai:** chỉ `identity-postgres`. Không gọi HTTP sang service nào, tự verify token bằng khóa cục bộ. **Ai gọi:** Gateway, `media`, `notification-worker`, và mọi bên xin token/tải JWKS.
- **Command:** không có.
- **Điểm RCA:** `identity` là **điểm lỗi chung của lớp xác thực**. Ba case C5, C6, C7 đều có nguyên nhân gốc ở đây (khác nhau ở component: `identity-postgres`, tiến trình `identity`, khóa ký/JWKS). Làm chậm `identity-postgres` ảnh hưởng cùng lúc đăng nhập, cấp service token và lấy người nhận thông báo. Compose mặc định để trống `IDENTITY_SIGNING_KEY_PEM` và bật `IDENTITY_ALLOW_EPHEMERAL_SIGNING_KEY=true`: mỗi lần khởi động `identity` sinh khóa tạm mới, token cũ mất hiệu lực (README của identity). Vì vậy một thí nghiệm "dừng rồi khởi động lại `identity`" vô tình trộn thêm hiệu ứng đổi khóa kiểu C7.

### 2.4. `course`: phòng đào tạo

- **Đời thường:** phòng đào tạo quản lý khóa học, bài học, quiz, ghi danh, tiến độ và chấm bài trắc nghiệm.
- **Endpoint public:** `/api/v1/courses/**` (CRUD khóa học, bài học, quiz, export CSV, 5 route AI dưới `…/lessons/{lesson_id}/ai-documents|ai-jobs`) và `/api/v1/student/**` (ghi danh, tiến độ, làm quiz, nộp bài).
- **Endpoint nội bộ** (chỉ `ai-worker` gọi): `GET …/ai-context`, `PUT …/ai-content`, `POST …/ai-quizzes` dưới `/internal/v1/courses/{course_id}/lessons/{lesson_id}/`.
- **Dữ liệu (`course_db`):** `courses`, `lessons`, `enrollments`, `lesson_progresses`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_attempt_answers`, `outbox_messages`. Không có bảng AI nào.
- **Gọi ai:** `course-postgres`; `course-media` (lấy usage khi xóa, tệp đính kèm bài học); `course-ai` (tài liệu và job AI). **Ai gọi:** Gateway, `ai-worker`.
- **Command gửi:** `media.markdown-usage.synchronize` (khi markdown thay đổi), `media.usages.delete-by-ids` (khi xóa).
- **Điểm RCA:** case MVP **C2** chèn trễ trên kết nối `course → course-postgres` (case đối chứng dễ). Xóa khóa học khi `media` chết thì trả `503` và không xóa gì. `ai` chết thì 5 route AI lỗi `DEPENDENCY_*`, các route khác vẫn chạy.

### 2.5. `media` và `media-worker`: kho lưu đồ và tổ đóng gói

- **Đời thường:** `media` là thủ kho: nhận đồ gửi, cấp "phiếu gửi đồ" (presigned URL) để khách tự mang đồ vào kho MinIO, trả đồ khi có người hỏi, giữ sổ "món đồ nào đang được dùng ở đâu" (usage). `media-worker` là tổ đóng gói phía sau: làm ảnh thu nhỏ (thumbnail) và cập nhật sổ usage theo yêu cầu gửi tới.
- **Endpoint public (`media`):** upload multipart `POST /api/v1/media`, upload trực tiếp `upload-intents` → client tải lên MinIO → `upload-complete`, `library`, `{id}/content`, `avatars/{user_id}`, `{id}/thumbnail`, `thumbnail/retry`, `usages/**`, `usage-jobs/{id}/status`, `summary`, `jobs`.
- **Endpoint nội bộ:** `usages/ids:query`, `usages/urls`, `usages/by-owner` (cho `course`); `{media_id}/content` (cho `ai-worker`); `cleanup` (cho `scheduler-worker`).
- **Dữ liệu (`media_db` + MinIO):** `media_objects` (trạng thái `PENDING`/`READY`/`FAILED`), `media_usages`, `media_background_jobs`, `outbox_messages` (của `media`), `inbox_states` (của `media-worker`). Năm bucket MinIO: `images`, `videos`, `documents`, `audios`, `other`.
- **Gọi ai:** `media`: `media-postgres`, `media-minio`, `media-identity` (chỉ khi student đặt avatar). `media-worker`: `media-postgres`, `media-minio`. **Ai gọi `media`:** Gateway, `course`, `scheduler-worker`, `ai-worker`.
- **Command:** `media` gửi `media.thumbnail.generate` (tới `media-worker`) và `ai.document.extract` (tới `ai-worker`, khi tệp có cờ `extract_text` chuyển `READY`). `media-worker` nhận 7 loại command (xem [bảng tra](10-naming-cheatsheet.md)); worker không publish, relay outbox chỉ chạy trong process `media`.
- **Điểm RCA:** fault FA (MinIO chậm) và case MVP **C4** (MinIO chậm hoặc ngắt lúc xác nhận upload → media kẹt `PENDING` → usage không gắn → job dọn của scheduler coi là **upload bỏ dở**: `FAILED UPLOAD_ABANDONED`, xóa object; xem mục 8.8). MinIO không có timeout ứng dụng riêng. Tuần 13 đặt proxy `media-to-minio` và `media-worker-to-minio` để chèn lỗi (PR #75); bước client tải tệp thẳng lên MinIO **không** đi qua proxy.

### 2.6. `notification` và `notification-worker`: phòng văn thư và người phát thư

- **Đời thường:** `notification` là phòng văn thư nhận yêu cầu "gửi thông báo cho cả trường"; `notification-worker` là người phát thư: chép danh sách người nhận, gửi email từng lô, ghi vào hộp thư của student.
- **Endpoint public:** `/api/v1/notifications/**` (thông báo đơn của admin, hộp thư của student), `/api/v1/notification-batches/**` (batch, chỉ admin: tạo, xem trạng thái chụp danh sách, trạng thái gửi, danh sách lỗi, gửi lại phần lỗi).
- **Dữ liệu (`notification_db`):** `notifications`, `notification_batches`, `notification_batch_items` (từng người nhận, có lease), `outbox_messages`, `inbox_states`.
- **Gọi ai:** `notification`: `notification-postgres`. `notification-worker`: `notification-postgres`, `notification-worker-identity` (lấy người nhận theo trang, lấy email hiện tại cho thông báo đơn), `notification-smtp`. **Ai gọi:** Gateway (chỉ `notification`).
- **Command:** `notification` gửi `notification.batch.snapshot`, `notification.single.dispatch`, `media.notification-usage.register`, `…start-job`. `notification-worker` gửi `notification.batch.dispatch` (tự gửi cho chính mình đến khi hết người nhận), `…register-batch`, `…complete-job`. **Cả hai process đều chạy relay outbox** trên cùng bảng.
- **Điểm RCA:** W5 là chuỗi dài nhất. Case Target C5 (`identity` chậm khi chụp danh sách → batch `PARTIAL_FAILED`, log không có lỗi), C1 (backlog). Vì hai process cùng relay một bảng outbox, span PRODUCER có thể thuộc process nào cũng được.

### 2.7. `scheduler` và `scheduler-worker`: cuốn lịch và người trực ca

- **Đời thường:** `scheduler` là cuốn lịch công việc (admin ghi "mỗi ngày dọn kho lúc 2 giờ"); `scheduler-worker` là người trực ca cứ mỗi giây nhìn lịch, thấy việc đến hạn thì làm.
- **Endpoint public:** `GET|POST /api/v1/scheduler/jobs`, `GET|PATCH /api/v1/scheduler/jobs/{job_id}`, `GET|POST …/{job_id}/runs` (chỉ admin).
- **Dữ liệu (`scheduler_db`):** `background_jobs`, `background_job_runs` (vừa là lịch sử vừa là **hàng đợi**).
- **Gọi ai:** cả hai: `scheduler-postgres`. `scheduler-worker` thêm `scheduler-worker-media` (`POST /internal/v1/media/cleanup`). Loại job duy nhất hiện có: `MEDIA_UNUSED_CLEANUP`. Không có job nào được tạo sẵn khi dựng stack: admin phải tạo qua API (thủ công hoặc CRON).
- **Command:** không dùng RabbitMQ. Worker nhận run bằng lease `FOR UPDATE SKIP LOCKED` (khóa dòng, bỏ qua dòng đang bị người khác giữ); Compose đặt thăm dò mỗi 1.000 ms, tick CRON mỗi 5.000 ms.
- **Điểm RCA:** triệu chứng của C4 lộ ra ở đây. Trace `scheduler → scheduler-worker` **không nối** (worker đọc DB, không nhận `traceparent`), và mỗi lần thăm dò tạo một trace gốc nên gây nhiễu.

### 2.8. `ai` và `ai-worker`: phòng trợ lý AI

- **Đời thường:** `ai` giữ "danh bạ" các nhà cung cấp AI (provider, model, gán model cho từng việc) và chìa khóa API đã mã hóa; `ai-worker` là trợ lý ngồi đọc tài liệu và soạn bài, sinh quiz.
- **Endpoint public (chỉ admin):** `/api/v1/ai/providers[/{id}]`, `…/health-check(s)`, `/api/v1/ai/models[/{id}]`, `/api/v1/ai/service-bindings[/{task_key}]`, `/api/v1/ai/options`.
- **Endpoint nội bộ:** `POST /internal/v1/ai/completions` (client ngoài), `POST …/documents/sync|query`, `POST …/jobs`, `GET …/jobs[/{job_id}]` (cho `course`).
- **Dữ liệu (`ai_db`):** `ai_providers` (API key mã hóa AES-256-GCM), `ai_models`, `ai_service_bindings`, `ai_invocations` (nhật ký gọi, không lưu nội dung), `ai_documents`, `ai_jobs`, `outbox_messages`, `inbox_states`.
- **Gọi ai:** `ai`: `ai-postgres`, `ai-llm-provider` (health check, route completion). `ai-worker`: `ai-postgres`, `ai-llm-provider` (gọi **trong process**, không qua HTTP), `ai-worker-course`, `ai-worker-media`. **Ai gọi `ai`:** Gateway, `course`.
- **Command:** `ai` gửi `ai.document.extract` và `ai.job.run`; `media` cũng gửi `ai.document.extract`. `ai-worker` nhận cả hai.
- **Vòng `course → ai → course`:** `course` tạo job ở `ai`, nhận `202` rồi kết thúc, không bao giờ chờ `ai-worker`. Sau đó `ai-worker` gọi ngược `course` (`ai-worker-course`). Vòng được chấp nhận vì hai chiều là bất đồng bộ và `ai-worker` có tên riêng.
- **Điểm RCA:** case MVP **C3** (provider chậm hoặc lỗi). Kết cục thật phụ thuộc tham số (mục 8.5): đo ngày 17/11/2026 với LLM stub (PR #75), trễ 2000±500 ms thì job vẫn `COMPLETED`; lỗi 100% thì job `FAILED` với `AI_PROVIDER_ERROR`; `WORKER_INTERRUPTED` chỉ xuất hiện khi command được giao lại lúc job đã quá lease. Cấu hình provider (base URL, key) nằm trong `ai_db` qua API admin, không qua biến môi trường; regression dùng provider giả (HTTP stub), thí nghiệm dùng `llm-stub` của `aiops-platform/faults/`.

---

## 3. Hạ tầng

| Thành phần | Cổng | Vai trò | Hình ảnh |
| --- | --- | --- | --- |
| PostgreSQL 17.6 | 5432 | 1 instance, 6 logical DB, 6 role | Chung cư 6 căn, mỗi căn một chìa |
| RabbitMQ 4.1.4 | 5672; quản trị 15672 | Chở command | Bưu điện |
| MinIO | 9000 (cổng 9001 vẫn map nhưng image đang dùng không còn giao diện console) | Lưu byte tệp | Kho gửi đồ |
| Mailpit 1.31.6 | SMTP 1025; giao diện 8025 | SMTP giả, giữ email để xem | Hộp thư giả |
| LLM provider | ngoài Compose (thí nghiệm: `llm-stub` trong lớp fault) | Mô hình ngôn ngữ chuẩn OpenAI | Chuyên gia thuê ngoài |

- **PostgreSQL:** mỗi database `<service>_db` có role riêng `<service>_user` (script `docker-compose/postgres-init/`, có `REVOKE ALL … FROM PUBLIC`). Không role nào đọc được DB khác, không có khóa ngoại xuyên DB; tham chiếu chéo là ID logic. Code không đặt timeout hay kích thước pool riêng (mặc định của driver: **chưa kiểm chứng**), chưa có metric pool.
- **RabbitMQ:** một exchange `lms.commands` (direct), 12 queue canonical + 12 queue `.error` = 24 queue. Không có dead-letter exchange hay queue `.retry`. Kết nối dùng vhost mặc định `/` (URL trong Compose không ghi vhost). Metric hàng đợi do Collector của `aiops-platform` đọc từ broker (cổng 15692), không do runtime LMS gửi.
- **MinIO:** chỉ `media`/`media-worker` chạm; 5 bucket do container `minio-init` tạo. Service khác chỉ cầm `media_id`.
- **Mailpit:** chỉ `notification-worker` dùng; giữ tối đa 5.000 email (`MP_MAX_MESSAGES`).
- **LLM provider:** chỉ `ai`/`ai-worker` chạm; không retry, không circuit breaker; không theo redirect để API key không bị gửi sang host khác.
- **Observability** nằm riêng ở `aiops-platform/observability/` (Collector, Prometheus, Tempo, Loki, Grafana). LMS chỉ gửi OTLP/HTTP tới `otel-collector:4318`. `compose.full.yaml` ghép hai bên thành 21 thành phần (11 runtime + PostgreSQL, MinIO, `minio-init`, Mailpit, RabbitMQ + 5 thành phần quan sát).
- **Lớp gây lỗi (tuần 13, PR #75, chưa merge):** `aiops-platform/faults/compose.faults.yaml` ghép **sau** `compose.full.yaml`, thêm `toxiproxy` và `llm-stub` (23 container). Nó **không sửa code LMS**, chỉ đổi địa chỉ kết nối: `course` nối PostgreSQL qua proxy `course-to-postgres`; `media`, `media-worker` nối MinIO qua `media-to-minio`, `media-worker-to-minio`. Proxy luôn nằm trên đường đi, kể cả run khỏe, để run khỏe và run có lỗi cùng một kiểu mạng; đo bằng `pgbench`, proxy chỉ thêm khoảng 0,02 ms mỗi truy vấn. Chi tiết: [`09-cases-and-workload.md`](09-cases-and-workload.md) mục 2, tên ở [`10-naming-cheatsheet.md`](10-naming-cheatsheet.md) mục 11.

---

## 4. Hai mặt API và xác thực

### 4.1. Ba bề mặt HTTP

| Bề mặt | Tiền tố | Ai được gọi | Cần gì |
| --- | --- | --- | --- |
| Public | `/api/v1` | Chỉ Gateway | Service token của `gateway` (scope `gateway:proxy`) + danh tính user do Gateway đặt |
| Internal | `/internal/v1` | Service khác | Service token có đúng `aud` và scope của route |
| Mở | `/health`, `/ready`, `/.well-known/jwks.json`, `POST /internal/v1/auth/service-token` | Hạ tầng, mọi service | Không cần bearer (route xin token xác thực bằng `client_id`/`client_secret` trong body) |

Mỗi service tách controller thành hai thư mục `adapters/http/public/` và `adapters/http/internal/`, không import lẫn nhau. Hình ảnh: **cửa trước** cho khách (qua bảo vệ), **cửa sau** cho nhân viên (cần thẻ nhân viên đúng phòng).

### 4.2. Hai loại token

| | User access token | Service access token |
| --- | --- | --- |
| Cấp bởi | Đăng nhập, refresh | `POST /internal/v1/auth/service-token` |
| Claim | `typ=user`, `sub`=user id, `role`, `aud=aiops-lms` | `typ=service`, `sub`=tên service, `aud`=service đích, `scope` |
| Hạn | 1 giờ (refresh token 24 giờ) | 10 phút, không refresh (`IDENTITY_SERVICE_TOKEN_TTL_SECONDS=600`) |

Cả hai ký EdDSA (Ed25519), `iss=aiops-lms-identity`, header có `kid`. Bên nhận verify **cục bộ** bằng JWKS, không gọi `identity` cho mỗi request. Dùng nhầm loại token → `401 TOKEN_TYPE_MISMATCH`.

### 4.3. Sổ đăng ký client dịch vụ

`identity` nạp sổ này lúc khởi động từ biến `SERVICE_CLIENTS_BOOTSTRAP` (Compose). Client chỉ xin được token cho `audience` và `scope` có trong sổ; xin ngoài → `403 SERVICE_SCOPE_FORBIDDEN`.

| Client | Audience | Scope |
| --- | --- | --- |
| `gateway` | identity, course, media, notification, scheduler, ai | `gateway:proxy` |
| `media` | identity | `student:profile:read` |
| `notification-worker` | identity | `student:profile:read` |
| `course` | media, ai | `media:usage:read`, `ai:document:read`, `ai:document:write`, `ai:job:read`, `ai:job:write` |
| `ai-worker` | course, media | `course:lesson-ai:read`, `course:lesson-ai:write`, `media:content:read` |
| `scheduler-worker` | media | `media:cleanup` |

### 4.4. Một request người dùng đi qua những bước nào

```text
1. Client ── POST /api/v1/auth/student/login ──▶ gateway ──▶ identity ──▶ identity-postgres
                                               ◀── user token (1 giờ) ──┘
2. Client ── GET /api/v1/courses + user token ─▶ gateway
     gateway: verify user token bằng JWKS đã cache (không gọi identity)
     gateway: kiểm role, xóa Authorization và x-principal-* của client
     gateway: lấy service token aud=course từ cache (làm mới nền, không chờ)
3. gateway ── Bearer <service token> + x-principal-id/role ──▶ course
     course: verify service token (typ=service, aud=course, sub=gateway, scope gateway:proxy)
     course: chỉ khi đó mới tin x-principal-*
```

### 4.5. Ba cửa đăng nhập

Student, instructor và admin đăng nhập ở ba đường khác nhau nhưng dùng chung bảng `identity_users` và cùng body `{email, password}`. Sai email, sai mật khẩu, tài khoản khóa hay **đúng mật khẩu nhưng sai cửa** đều trả cùng một `401 UNAUTHORIZED`, và luôn băm mật khẩu một lần để thời gian phản hồi không lộ email có tồn tại hay không. Riêng student cần hồ sơ `ACTIVE` (không có hoặc `INACTIVE`/`BLOCKED` → `403`). Phần này giữ lại theo ADR-006 nhưng ít giá trị cho RCA (mục 9).

---

## 5. Gọi đồng bộ: `HttpQueryClient`

**Ý chính:** mọi lời gọi HTTP giữa service (và cả lời xin service token) đi qua một lớp dùng chung là `HttpQueryClient` trong `lms/packages/common/src/clients/`. Lớp này có bốn luật: **timeout bắt buộc**, **circuit breaker**, **không retry**, **`operation_name` là route template**.

### 5.1. Timeout bắt buộc

| Cạnh | Biến | Giá trị |
| --- | --- | ---: |
| `gateway-<service>` | `GATEWAY_UPSTREAM_TIMEOUT_MS` | code 30.000 ms, Compose **5.000 ms** |
| `course-media` | `COURSE_MEDIA_TIMEOUT_MS` | 3.000 ms |
| `course-ai` | `COURSE_AI_TIMEOUT_MS` | 5.000 ms |
| `media-identity`, `notification-worker-identity` | `MEDIA_IDENTITY_TIMEOUT_MS`, `NOTIFICATION_IDENTITY_TIMEOUT_MS` | 3.000 ms |
| `scheduler-worker-media` | `SCHEDULER_MEDIA_TIMEOUT_MS` | 60.000 ms |
| `ai-worker-course` | `AI_COURSE_TIMEOUT_MS` | 5.000 ms |
| `ai-worker-media` | `AI_MEDIA_CONTENT_TIMEOUT_MS` | 30.000 ms |
| `<caller>-identity-token` | `IDENTITY_TOKEN_TIMEOUT_MS` | 3.000 ms |

Gateway không dùng `HttpQueryClient` (nó có client proxy riêng); timeout của Gateway chỉ tính **tới lúc nhận header phản hồi**, phần thân (tải video, CSV) stream tiếp không giới hạn thời gian.

### 5.2. Circuit breaker: cầu dao tự ngắt

Cầu dao tự ngắt (xem [khái niệm nền](02-basic-concepts.md)) ở testbed này có thông số: **3 lỗi liên tiếp** (không có cửa sổ thời gian) thì mở **5 giây**; hết 5 giây cho đúng **một** request thử. Lỗi tính vào bộ đếm: timeout, lỗi mạng, 5xx, body không phải JSON; mọi phản hồi 2xx/3xx/4xx đặt lại bộ đếm. Khi mở, request bị từ chối ngay bằng `DEPENDENCY_UNAVAILABLE`, không gọi mạng, span có `circuit_breaker_open=true`. Mỗi client có **một cầu dao riêng trong bộ nhớ process**, không chia sẻ giữa service và worker. Biến chỉnh: `<TIỀN_TỐ>_BREAKER_THRESHOLD`, `<TIỀN_TỐ>_BREAKER_COOLDOWN_MS` (Compose không đặt). **Không có** cầu dao ở: Gateway → upstream, tải JWKS, publish RabbitMQ, SMTP, MinIO, PostgreSQL, LLM provider.

### 5.3. Không retry

Không có retry HTTP ở bất kỳ đâu (kể cả `GET`, kể cả gọi LLM): mỗi lời gọi logic chỉ gọi mạng **đúng một lần**. Lý do: retry làm số lượt gọi phình lên gấp đôi, gấp ba, **méo hình dạng sự cố** mà RCA cần đo, và có thể ghi trùng dữ liệu.

### 5.4. Route template trong `operation_name`

Bên gọi truyền đường dẫn dạng mẫu và tham số riêng, ví dụ `{ path: '/internal/v1/students/:studentId', params: { studentId } }`. Client tự ghép URL, còn metric ghi `operation_name = "GET /internal/v1/students/:studentId"`. Nhờ vậy số giá trị nhãn **hữu hạn** (không mỗi student một nhãn). Đây là sửa đổi ngày 17/11/2026 cho Gate R; trước đó `operation_name` còn chứa ID.

### 5.5. Quy đổi lỗi

| Bên dưới trả gì | Bên gọi nhận |
| --- | --- |
| Hết hạn chờ ở client, hoặc upstream trả 504 | `504 DEPENDENCY_TIMEOUT` |
| Lỗi mạng/DNS/kết nối; upstream 500–503 hoặc 505–599; body không phải JSON; 2xx sai schema; cầu dao đang mở | `503 DEPENDENCY_UNAVAILABLE` |
| 2xx/3xx/4xx khác | Trả cho bên gọi tự quyết theo nghiệp vụ; không tính vào cầu dao |

Mã `DEPENDENCY_*` luôn mang `details.dependency` là tên cạnh (ví dụ `course-media`). Mỗi cạnh tự quyết với 4xx: `media-identity`/`notification-worker-identity` đổi `404` thành "không có hồ sơ"; `course-media` coi mọi mã khác `200` là lỗi dependency; `course-ai`, `ai-worker-course`, `ai-worker-media` giữ nguyên mã nghiệp vụ của bên dưới; `scheduler-worker-media` biến 4xx thành run `FAILED` với `MEDIA_CLEANUP_REJECTED`.

---

## 6. Gọi bất đồng bộ: outbox → relay → RabbitMQ → consumer → inbox

**Ý chính:** service không gửi thẳng lên RabbitMQ. Nó **ghi lá thư vào sổ outbox trong chính database của mình, cùng transaction** với dữ liệu nghiệp vụ. Một vòng lặp nền (relay) đọc sổ và gửi ra bưu điện. Bên nhận ghi "đã xử lý thư số X" vào sổ inbox để không xử lý trùng.

```text
[course]  (ví dụ: sửa nội dung bài học có ảnh)
  1. BEGIN
       UPDATE lessons ...
       INSERT outbox_messages (envelope có traceparent của request)
     COMMIT                              ← dữ liệu và lá thư cùng sống hoặc cùng chết
  2. relay: lấy tối đa 20 thư, khóa FOR UPDATE SKIP LOCKED, lease 30 s
     (vừa phát được thư thì lặp ngay, không có thư thì nghỉ 500 ms)
  3. publish → exchange lms.commands (direct, persistent, chờ broker xác nhận ≤ 3 s)
                 │ routing key = tên queue
                 ▼
     media-worker--synchronize-markdown-media-usage-v1
                 │
[media-worker]   ▼
  4. consume (prefetch 4) → runOnce: INSERT inbox_states(message_id, consumer)
                                      + xử lý nghiệp vụ, cùng một transaction
  5. lỗi → chờ 1 s → publish lại vào cùng queue (header x-attempt + 1) → ack bản cũ
     sau 5 lần → chép nguyên message vào <queue>.error, gọi onFault nếu route có khai báo
                 (đặt job/batch → FAILED), rồi ack
```

- **Outbox** (`<SVC>_OUTBOX_POLL_MS` 500, `_BATCH_SIZE` 20, `_LEASE_MS` 30.000; `<SVC>` là `COURSE`, `MEDIA`, `NOTIFICATION`, `AI`): publish lỗi thì lùi lịch `min(30.000, 500 × 2^attempts)` ms, **không giới hạn số lần**. Broker chết không làm service chết, nhưng thư dồn trong bảng DB.
- **Consumer** (`<WORKER>_PREFETCH` 4/4/2 cho media/notification/ai, `_MAX_ATTEMPTS` 5, `_RETRY_DELAY_MS` 1.000): chờ **cố định**, không tăng dần. Message sai khuôn (JSON hỏng, sai schema) vào thẳng `.error`, không retry. Không ghi được `.error` thì `nack` để broker giao lại, không mất thư.
- **Inbox:** giao nhận "ít nhất một lần" (at-least-once) nên một thư có thể đến hai lần; `runOnce` ghi `(message_id, consumer)` cùng transaction với kết quả, thư trùng thì bỏ qua và ack. Một số handler (dispatch batch, job AI) dựa vào lease và máy trạng thái thay cho inbox.
- **Nối trace:** envelope (`message_id`, `command_name`, `schema_version`, `occurred_at`, `producer`, `correlation`, `payload`) mang `correlation.traceparent` của request lúc ghi outbox. Relay chạy ngoài request nên dùng chính `traceparent` đó làm cha cho span PRODUCER (`lms.commands publish <command>`), rồi tiêm context vào **header AMQP**; consumer lấy cha **từ header** (không từ envelope) cho span CONSUMER (`<queue> process`). Kết quả: request của người dùng và việc nền của worker nằm **trong cùng một trace**.
- **Ngoại lệ scheduler:** không dùng RabbitMQ; bảng `background_job_runs` là hàng đợi, worker nhận việc bằng lease (`SCHEDULER_RUN_LEASE_MS` 120.000, tối đa `SCHEDULER_RUN_MAX_ATTEMPTS` 3 lần).

---

## 7. Đồ thị phụ thuộc: các cạnh `e01–e29`

Mã cạnh chỉ là số thứ tự trên bản đồ thiết kế. `e03` và `e09` đã bỏ ở R-13 (gộp `auth` và `student`) nhưng giữ số để tài liệu khác không phải đánh lại, nên còn **27 cạnh**.

**Nhóm A: HTTP qua cửa vào**

| Mã | Cạnh | Tên trong telemetry |
| --- | --- | --- |
| `e01` | Client → gateway (W1–W7) | (route của Gateway) |
| `e02`, `e04`, `e05`, `e06`, `e07`, `e08` | gateway → identity, course, media, notification, scheduler, ai | `gateway-<service>` |

**Nhóm B: HTTP giữa service (`/internal/v1`)**

| Mã | Cạnh | Workflow | Tên trong telemetry |
| --- | --- | --- | --- |
| `e10` | course → media | W2, W6 | `course-media` |
| `e11` | course → ai | W6 | `course-ai` |
| `e12` | media → identity | W4 | `media-identity` |
| `e13` | notification-worker → identity | W5 | `notification-worker-identity` |
| `e14` | scheduler-worker → media | W7 | `scheduler-worker-media` |
| `e27` | ai-worker → course | W6 | `ai-worker-course` (đóng vòng `course → ai → course`) |
| `e28` | ai-worker → media | W6 | `ai-worker-media` |

**Nhóm C: command qua RabbitMQ (cạnh logic; đường thật đi qua broker)**

| Mã | Cạnh | Workflow | Command |
| --- | --- | --- | --- |
| `e15` | course ⇒ media-worker | W2 | đồng bộ/xóa usage markdown |
| `e16` | media ⇒ media-worker | W4 | tạo thumbnail |
| `e17` | notification, notification-worker ⇒ media-worker | W5 | usage của thông báo |
| `e18` | notification ⇒ notification-worker | W5 | snapshot, dispatch đơn |
| `e19` | notification-worker ⇒ notification-worker | W5 | dispatch tự gửi lại |
| `e29` | ai, media ⇒ ai-worker | W6 | `ai.document.extract`, `ai.job.run` |

**Nhóm D: xác thực (nền, tần suất thấp)**

| Mã | Cạnh | Tên trong telemetry |
| --- | --- | --- |
| `e25` | gateway và các service nhận request → identity (tải JWKS) | `<service>-identity-jwks` |
| `e26` | các bên gọi HTTP → identity (xin service token) | `<caller>-identity-token` |

**Nhóm E: xuống hạ tầng**

| Mã | Cạnh | Tên trong telemetry |
| --- | --- | --- |
| `e20` | notification-worker → SMTP | `notification-smtp` |
| `e21` | media, media-worker → MinIO | `media-minio` |
| `e22` | ai, ai-worker → LLM provider | `ai-llm-provider` |
| `e23` | mọi service/worker → PostgreSQL | `<service chủ>-postgres` (6 tên) |
| `e24` | publisher/consumer → RabbitMQ | `<process>-rabbitmq` (chỉ span + metric broker) |

Không có mã cạnh cho `scheduler ┄ scheduler-worker` (chung bảng DB, không phải lời gọi). Bản đồ này dùng để **đối chiếu** với đồ thị dựng từ trace thật, không thay thế: cạnh nào trace không thấy thì ghi là thiếu dữ liệu, không tự vẽ bù.

---

## 8. Các cơ chế khiến nguyên nhân bị che hoặc đến muộn

**Ý chính:** testbed có nhiều "bộ giảm xóc" hợp lý về kỹ thuật (cache, cầu dao, lease, retry trong worker, thời gian lưu giữ). Chúng giúp hệ thống bền hơn, nhưng cũng làm **triệu chứng xuất hiện ở chỗ khác, vào lúc khác** so với nguyên nhân. Đây chính là chất liệu để thiết kế case RCA, và là lý do truy vết thủ công khó. Với mỗi cơ chế: nó là gì, vì sao có, và nó gây khó gì.

### 8.1. Cache service token (stale-while-error)

- **Là gì:** `ServiceTokenProvider` giữ token theo từng (bên gọi, audience). Hạn token 600 giây; ở **50% hạn (~300 giây)** nó làm mới **ở nền**, nhiều request cùng lúc dùng chung một lần làm mới (single-flight), request vẫn dùng token cũ ngay. Làm mới lỗi thì **tạm dùng token cũ còn hạn** (stale-while-error) và giãn lần thử kế tiếp 5 giây. Chỉ khi chưa có token hoặc token đã hết hạn thì request mới phải chờ `identity`.
- **Vì sao có:** để `identity` không nằm trên đường đi của mọi request; nhiễu nền thấp và đều (mỗi cặp ~5 phút một lần).
- **Gây khó:** `identity` chết thì **chưa ai thấy gì** trong tối đa ~1 hạn token (tối đa 10 phút). Sau đó lỗi bùng ở **mọi service cùng lúc**, ghi ở cạnh `<caller>-identity-token` của bên gọi, không phải ở `identity`. Đo thật (C6, đặt hạn 60 giây): lỗi `gateway-identity-token` xuất hiện **70–74 giây** sau khi dừng `identity`. Người trực nhìn đồng hồ sẽ tìm nguyên nhân trong 1–2 phút gần nhất và bỏ qua thời điểm thật.

### 8.2. Cache JWKS

- **Là gì:** `HttpJwksKeyProvider` giữ bộ khóa công khai; tải lại khi cache quá **5 phút** (`IDENTITY_JWKS_CACHE_TTL_MS` 300.000) ở lần dùng kế tiếp hoặc khi gặp `kid` lạ, nhưng **tối đa một lần mỗi 10 giây** (`IDENTITY_JWKS_MIN_REFETCH_MS`). Tải lỗi mà đã có khóa thì **dùng khóa cũ không thời hạn**.
- **Vì sao có:** verify token cục bộ, không gọi mạng mỗi request.
- **Gây khó:** đổi khóa ký ở `identity` (C7) chỉ lộ ra khi cache của từng service hết hạn, lệch nhau tới 5 phút, dưới dạng `401 SERVICE_TOKEN_INVALID` rải rác ở nhiều service trong khi mọi hạ tầng đều khỏe. Ngược lại, `identity` chết **không** làm JWKS lỗi chừng nào cache còn khóa.

### 8.3. Circuit breaker làm service đích "biến mất" khỏi trace

- **Là gì:** sau 3 lỗi liên tiếp, request tới cạnh đó bị từ chối ngay trong 5 giây mà **không gọi mạng**.
- **Vì sao có:** tránh dồn thêm tải lên service đang hỏng, trả lỗi nhanh.
- **Gây khó:** trong lúc cầu dao mở, trace vẫn có span CLIENT `DEPENDENCY_UNAVAILABLE` (có `circuit_breaker_open=true`) nhưng **không có span SERVER nào ở service đích**. Ai chỉ đếm "service nào có span lỗi" sẽ thấy bên gọi lỗi còn bên đích sạch sẽ. Nhãn `status=unavailable` lẫn lộn giữa "bên dưới thật sự chết" và "cầu dao tự chặn", phải đọc thuộc tính span mới phân biệt được. Cầu dao nằm trong bộ nhớ từng process nên service và worker có thể ở trạng thái khác nhau cùng lúc. Một chi tiết nhỏ: client lấy service token **trước** khi kiểm cầu dao, nên token hết hạn vẫn có thể sinh một lời gọi tới `identity` ngay cả khi cầu dao của cạnh đích đang mở.

### 8.4. Timeout của tầng ngoài không còn lớn hơn tầng trong

- **Là gì:** Gateway chờ 5 giây (Compose), `course-ai` cũng chờ 5 giây. Health check provider của `ai` chờ 6 giây (`AI_HEALTH_CHECK_TIMEOUT_MS`), lâu hơn Gateway.
- **Vì sao đáng để ý:** ở testbed trước refactor, Gateway được đặt chờ lâu hơn tầng trong để lỗi được báo ở tầng gần nguyên nhân nhất.
- **Gây khó (suy luận từ cấu hình, chưa kiểm chứng bằng chạy thật):** nếu `ai` chậm, đồng hồ của Gateway bắt đầu sớm hơn đồng hồ của `course-ai`, nên Gateway có thể báo `504` với `details.dependency=gateway-course` **trước** khi `course` kịp ghi lỗi `course-ai`. Người đọc phản hồi của client sẽ nghi `course`, trong khi span `course-ai` lỗi chỉ xuất hiện sau đó trong trace.

### 8.5. Lease của `ai-worker` và timeout gọi LLM

- **Là gì:** mỗi lượt gọi provider được chờ tới `AI_COMPLETION_TIMEOUT_MS` = **240.000 ms (4 phút)**. Job/tài liệu được giữ bằng lease `AI_WORKER_LEASE_MS` = **600.000 ms (10 phút)**, gia hạn trước mỗi lượt; một job có tối đa **6 lượt** gọi provider. Job **không bao giờ chạy lại**: khi command của job được giao lại mà job đang `RUNNING` và lease đã hết, job mới bị đánh `FAILED`/`WORKER_INTERRUPTED`. Code **không có tiến trình quét định kỳ**, nên nếu không có lần giao lại nào thì job có thể nằm `RUNNING` mãi. Tài liệu `PROCESSING` quá lease chỉ được nhận lại khi có command trích xuất mới (gọi lại `documents/sync`), tối đa 3 lần rồi `EXTRACTION_INTERRUPTED`. Quy ước "lease > timeout" mới là chú thích, schema chưa ép (khác `scheduler`, nơi schema có ép).
- **Vì sao có:** gọi LLM chậm và tốn tiền; không chạy lại job để tránh tạo trùng quiz hay ghi đè nội dung lần hai.
- **Gây khó (C3):** provider chậm không gây lỗi ngay. Người dùng chỉ thấy job "mãi `RUNNING`" hoặc tài liệu "mãi `EXTRACTING`" trong nhiều phút, có khi không bao giờ chuyển sang lỗi (nếu mỗi lượt vẫn dưới 240 giây thì job còn có thể `COMPLETED`, chỉ là rất chậm). Lỗi bên trong vòng agent (provider hay `course` lỗi) được ghi thẳng vào job `FAILED` kèm mã lỗi chứ không qua retry của consumer. Triệu chứng có thể hiện ở `course` (route AI) hoặc cạnh `ai-worker-course`, cách nguyên nhân (`ai-llm-provider`) nhiều phút và hai service.

### 8.6. Outbox giữ thư trong database, broker không thấy

- **Là gì:** relay publish lỗi thì thư nằm lại trong `outbox_messages` và thử lại mãi (lùi tối đa 30 giây).
- **Vì sao có:** không mất command khi RabbitMQ chập chờn, service vẫn chạy.
- **Gây khó:** backlog nằm **trong DB của producer**, metric độ sâu queue ở broker vẫn bằng 0. Chưa có metric đếm thư chờ trong outbox. Người nhìn dashboard RabbitMQ sẽ kết luận "hàng đợi bình thường" trong khi việc nền đang đứng.

### 8.7. Retry trong consumer và queue `.error`

- **Là gì:** handler lỗi được thử lại 5 lần, mỗi lần cách 1 giây, trong lúc đó vẫn **giữ chỗ prefetch**; hết lượt mới vào `.error` và job/batch chuyển `FAILED`.
- **Vì sao có:** lỗi thoáng qua tự khỏi mà không cần người can thiệp.
- **Gây khó:** lỗi cuối cùng đến muộn vài giây; trong lúc retry, các message khác cùng queue phải chờ (prefetch bị chiếm), nên một loại command hỏng có thể làm chậm loại khác trong cùng worker. Worker chưa có log riêng khi xử lý command; lỗi chỉ thấy ở span CONSUMER và log `dependency.failure`. Queue `.error` không tự xử lý lại; kích thước của nó là tín hiệu.

### 8.8. Thời gian lưu giữ và thời gian ân hạn của job dọn media

- **Là gì:** job `MEDIA_UNUSED_CLEANUP` gọi `POST /internal/v1/media/cleanup` với ba pha: (1) upload `PENDING` quá hạn presigned (900 giây) cộng **thời gian ân hạn 15 phút** (`MEDIA_CLEANUP_PENDING_GRACE_MINUTES`) thì bị đánh `FAILED`/`UPLOAD_ABANDONED`; (2) media gốc `READY` **không còn usage nào** và cũ hơn **`retention_hours` (mặc định 168 giờ)** thì bị xóa; (3) thumbnail mồ côi. Thời gian lưu giữ tính từ `created_at`/`updated_at` của media, không phải từ lúc usage cuối bị gỡ. Mỗi pha tối đa 200 media/lần (`MEDIA_CLEANUP_DEFAULT_LIMIT`).
- **Vì sao có:** dọn rác tệp không ai dùng mà không xóa nhầm tệp vừa upload.
- **Gây khó:** hậu quả xuất hiện **rất muộn** (giờ, ngày) và ở **service khác** (`scheduler-worker`, `media`), khi dấu vết của nguyên nhân đã trôi khỏi cửa sổ quan sát. Chuỗi C4: MinIO chậm → media kẹt `PENDING` → usage không được gắn (mục 8.9) → lần dọn sau (khi đã quá hạn upload 900 giây cộng ân hạn 15 phút) coi media là **upload bỏ dở** (pha 1): `FAILED UPLOAD_ABANDONED`, xóa object. Pha 2 ("`READY` không có usage") không áp dụng vì media chưa bao giờ `READY`.

### 8.9. Đồng bộ usage markdown chỉ gắn media `READY`

- **Là gì:** khi `course` lưu markdown có ảnh, `media-worker` so danh sách media trong markdown với usage hiện có rồi thêm/xóa phần chênh. Chỉ media đã `READY` mới được gắn usage. Media chưa `READY` (hoặc không tồn tại) bị đếm là thất bại: job đồng bộ trong `media_background_jobs` thành `PARTIAL_FAILED` với `last_error` "N media không tồn tại hoặc chưa sẵn sàng", nhưng command vẫn **thành công**, không retry, không log. Khi media đó `READY` sau này, **không có lần đồng bộ lại** nào tự chạy.
- **Vì sao có:** không gắn usage cho tệp chưa tải xong hoặc đã lỗi.
- **Gây khó:** nếu media còn `PENDING` lúc command được xử lý (do MinIO chậm), dấu vết duy nhất là một dòng `PARTIAL_FAILED` trong database của `media`; trace có span CONSUMER bình thường, không có span lỗi, không có log lỗi. Khóa học trông bình thường; chỉ đến khi job dọn chạy, tệp mới "biến mất".

### 8.10. Các cơ chế nhỏ khác cần nhớ khi đọc telemetry

| Cơ chế | Hệ quả khi truy vết |
| --- | --- |
| Item thông báo retry tối đa 3 lần, chờ nhân đôi từ 1 giây | Batch kết thúc `PARTIAL_FAILED` muộn, log không có lỗi rõ (C5) |
| Lease run scheduler 120 giây, tối đa 3 lần | Worker chết chỉ lộ ra sau vài phút dưới dạng `RUN_LEASE_EXPIRED` |
| Trace `scheduler → scheduler-worker` không nối; worker tạo trace gốc mỗi lần thăm dò | Không đi được từ thao tác admin tới run; nhiều trace rác |
| Span PRODUCER thuộc process relay, không nhất thiết thuộc service ghi command | `service_name` của span publish có thể là `notification-worker` dù `notification` ghi thư |
| Độ trễ thu thập: log ~2 giây, trace ~2,5 giây, metric ~4–10 giây | Cửa sổ ghép tín hiệu nên ≥ 15 giây |
| Container bị `docker pause` mất lô span ~2 giây cuối của chính nó (đo 17/11/2026) | Service gốc "im lặng" thay vì phát span lỗi; không suy thời điểm fault từ span cuối |
| Runtime ngừng mà Prometheus vẫn có mẫu của nó thêm ~5 phút, giá trị đứng yên (Collector giữ giá trị cuối; đo 17/11/2026, PR #79) | "Có mẫu" không có nghĩa là còn sống; xem bộ đếm CPU có tăng không ([`05-observability.md`](05-observability.md) mục 10.1) |
| Client ngắt kết nối giữa chừng: Gateway hủy lời gọi upstream và ghi `DEPENDENCY_UNAVAILABLE` cho `gateway-<service>` | Lỗi giả ở cạnh Gateway dù upstream không làm gì sai (đọc từ code, chưa đo) |
| Tạo thumbnail khi media gốc chưa `READY`: worker lặng lẽ không làm gì | Thumbnail thiếu mà không có span lỗi |
| Dispatch batch tự gửi lại cho chính mình, không giới hạn số lần | Một batch lỗi kéo dài sinh rất nhiều span CONSUMER cùng loại |
| `/ready` của worker dựa vào cờ đặt một lần lúc khởi động | Có thể vẫn báo sẵn sàng sau khi kênh RabbitMQ đóng (**chưa kiểm chứng** đầy đủ) |
| Dữ liệu seed ghi thẳng bằng SQL (id bắt đầu `5eed`) | Không có trace/log/outbox cho các dòng đó |

---

## 9. Phần giữ lại nhưng ít liên quan RCA

ADR-006 (mục 1.3) đóng băng LMS: không thêm nghiệp vụ, chỉ nhận thay đổi phục vụ telemetry, fault, workload. Các phần dưới đây đã xong, có test, nên **giữ lại** vì gỡ ra tốn công và rủi ro hơn, nhưng báo cáo đồ án **không cần mô tả**:

- Ba cửa đăng nhập riêng cho student/instructor/admin.
- CRUD provider/model/binding của `ai`.
- Avatar người dùng và việc server tự nhận MIME từ nội dung tệp (PR #71).
- Tách API chi tiết khóa học và danh sách bài học (PR #70).
- Giao diện terminal của seeder.
- Export CSV khóa học.

Ngược lại, R-18 (URL ký có hạn cho media) đã **hủy và revert**: route đọc nội dung media lại công khai, chỉ được bảo vệ bằng UUID khó đoán. Code đặt `Cache-Control: public, max-age=300` cho nội dung và thumbnail (`lms/services/media/src/adapters/http/shared/stream-media.ts`), nên nội dung media có thể được trình duyệt giữ tới 5 phút. Bản đầu ADR-006 và contract v2 ghi nhầm `no-store`; đã đính chính ở PR #74.

---

## 10. Đọc tiếp

- So sánh với testbed trước refactor (auth, enrollment, submission, grading, Storage Mock, Redis): [03-refactor-v1-to-v2.md](03-refactor-v1-to-v2.md).
- Bảy workflow W1–W7 chạy thế nào trên stack và cách vận hành: [06-stack-and-workflows-guide.md](06-stack-and-workflows-guide.md).
- Tra nhanh tên service, dependency, queue, mã lỗi: [10-naming-cheatsheet.md](10-naming-cheatsheet.md).

---

## Tóm tắt

- Testbed v2 có 7 service + 4 worker = 11 `service.name`; worker cùng image, cùng database với service chủ nhưng có tên riêng để RCA phân biệt API với việc nền.
- Hạ tầng: PostgreSQL 17 (6 database, 6 role), RabbitMQ (exchange `lms.commands`, 24 queue), MinIO (5 bucket), Mailpit, LLM provider; observability tách riêng ở `aiops-platform`.
- Hai bề mặt API: `/api/v1` chỉ Gateway gọi, `/internal/v1` giữa service; mọi request vào service đều cần service token EdDSA do `identity` cấp, verify cục bộ bằng JWKS.
- Gọi đồng bộ qua `HttpQueryClient`: timeout bắt buộc, cầu dao 3 lỗi/5 giây, không retry, `operation_name` là route template; lỗi quy về `DEPENDENCY_TIMEOUT`/`DEPENDENCY_UNAVAILABLE`.
- Gọi bất đồng bộ qua outbox → relay → RabbitMQ → consumer → inbox; retry 5 lần trong consumer rồi vào `.error`; trace nối nhờ `traceparent` trong envelope và header.
- Bản đồ thiết kế có 27 cạnh (`e01–e29`, bỏ `e03`, `e09`), chia 5 nhóm: HTTP cửa vào, HTTP giữa service, command, xác thực, hạ tầng.
- Cache token/JWKS, cầu dao, lease AI, outbox, retry consumer, thời gian lưu giữ của job dọn media và quy tắc "chỉ gắn usage cho media `READY`" làm triệu chứng xuất hiện muộn hoặc ở service khác: đây là chất liệu của case RCA.
- `identity` là điểm lỗi chung của lớp xác thực; C5, C6, C7 cùng dồn về nó.

## Câu hỏi tự kiểm tra

1. Worker khác service ở những điểm nào, và vì sao phải tách `service.name`?
<details><summary>Đáp án</summary>

Worker không nhận request nghiệp vụ (chỉ `/health`, `/ready`), nhận việc từ queue (hoặc bảng DB với `scheduler-worker`), chạy cùng image và cùng database với service chủ. Tách tên để RCA biết triệu chứng nằm ở API hay ở việc nền.

</details>

2. Vì sao `identity` chết mà 5 phút đầu hệ thống vẫn chạy bình thường?
<details><summary>Đáp án</summary>

Service token đã cache còn hạn (600 giây) và được dùng tiếp khi làm mới lỗi; JWKS đã cache được dùng không thời hạn. Lỗi chỉ lộ khi token hết hạn, ở cạnh `<caller>-identity-token` của bên gọi.

</details>

3. Trong lúc circuit breaker của `course-media` mở, trace trông thế nào?
<details><summary>Đáp án</summary>

Có span CLIENT `course-media` lỗi `DEPENDENCY_UNAVAILABLE` với `circuit_breaker_open=true`, nhưng không có span SERVER nào của `media`, vì không có lời gọi mạng.

</details>

4. RabbitMQ chết thì command của `course` đi đâu, và dashboard broker cho thấy gì?
<details><summary>Đáp án</summary>

Command nằm lại trong bảng `outbox_messages` của `course_db` và được thử lại mãi. Dashboard broker không thấy backlog vì thư chưa tới broker.

</details>

5. Một command lỗi liên tục trong `media-worker` thì sau bao lâu và đi đâu?
<details><summary>Đáp án</summary>

Sau 5 lần xử lý, mỗi lần cách 1 giây, message được chép vào `<queue>.error`, `onFault` đặt job sang `FAILED`, rồi ack.

</details>

6. Kể chuỗi nhân quả của C4 và giải thích vì sao khó truy vết thủ công.
<details><summary>Đáp án</summary>

MinIO chậm hoặc ngắt lúc xác nhận upload → media kẹt `PENDING` → đồng bộ usage bỏ qua media chưa `READY` (chỉ ghi job `PARTIAL_FAILED` trong DB, không span lỗi, không log) → khi quá hạn upload cộng ân hạn, job dọn của `scheduler-worker` coi media là upload bỏ dở: `FAILED UPLOAD_ABANDONED` và xóa object. Hậu quả lộ ở service khác, muộn nhiều phút hoặc giờ.

</details>

7. Vì sao `scheduler` không dùng RabbitMQ, và hệ quả cho trace là gì?
<details><summary>Đáp án</summary>

Bảng `background_job_runs` vừa là lịch sử vừa là hàng đợi; tạo run chỉ là một câu `INSERT`, worker nhận bằng lease. Hệ quả: không có `traceparent` đi từ `scheduler` sang `scheduler-worker`, nên hai bên không cùng trace.

</details>

8. Cạnh nào tạo vòng phụ thuộc, và vì sao vòng đó được chấp nhận?
<details><summary>Đáp án</summary>

`course → ai` (`e11`) và `ai-worker → course` (`e27`). Chấp nhận vì `course` chỉ nhận `202` rồi kết thúc, không chờ `ai-worker`; chiều ngược do worker gọi bất đồng bộ và có `service.name` riêng.

</details>
