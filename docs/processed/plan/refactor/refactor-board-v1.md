# Bảng task refactor LMS — v1

| Trường          | Nội dung                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cửa sổ          | W13–W14 (27/10/2026 → 09/11/2026), chạy song song với công việc đề tài                                                                                         |
| Người phụ trách | Đức, làm một mình toàn bộ (code refactor và docs, gồm docs AI/scope); không cần Bách tham gia hay review                                                       |
| Quyết định nền  | [ADR-001](../../adr/adr-001-restructure-lms-testbed-v1.md), [ADR-002](../../adr/adr-002-ai-primary-root-cause-analysis-v1.md)                                  |
| Quy ước         | Mỗi task một nhánh `refactor/week-NN/task-NN-<short-title>` (hoặc `docs/…`) và một PR vào `main` theo [quy tắc Git](../../rules/git-and-pull-request-rules.md) |
| Trạng thái bảng | Đang thực hiện                                                                                                                                                 |

## Danh sách task

| Mã    | Task                                                                                                                                                                                                                | Ngày | Phụ thuộc   | Trạng thái                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R-01  | ADR, `service-catalogue-v2`, `http-and-event-contracts-v2`, `data-ownership-v2`; chốt `service.name`                                                                                                                | 1–2  | —           | Hoàn thành (27/10/2026; Đức xác nhận qua chỉ thị merge trực tiếp, không có review của Bách theo quyết định refactor một người)    |
| R-02  | Tách `aiops-platform/observability/`, compose riêng, network external `aiops-net`                                                                                                                                   | 1–2  | —           | Hoàn thành (27/10/2026; PR #52)                                                                                                   |
| R-03  | Nền tảng: `packages/common`, skeleton service, eslint boundaries, compose LMS (Postgres, RabbitMQ, MinIO, Mailpit), Prisma                                                                                          | 2–3  | R-01        | Hoàn thành (27/10/2026; PR #53, bỏ qua CI theo chỉ thị của Đức, bằng chứng chạy cục bộ bên dưới)                                  |
| R-04  | `auth` (3 role, 3 cửa đăng nhập), `student`, `gateway` (bỏ `admin`, ADR-003)                                                                                                                                        | 3–5  | R-03        | Hoàn thành (28/10/2026; `student` ở PR #53, `auth` ở PR #54 và #57, `gateway` ở PR #58, bỏ qua CI theo chỉ thị của Đức)           |
| R-04b | DTO dùng chung trong `contracts`, envelope phản hồi thống nhất (success và lỗi), phân trang nhất quán                                                                                                               | 3–5  | R-04 (auth) | Hoàn thành (27/10/2026; PR #55)                                                                                                   |
| R-05  | `course`: course/lesson/quiz, enrollment, progress, quiz attempt, export CSV                                                                                                                                        | 4–8  | R-04        | Hoàn thành (28/10/2026; chạy cục bộ, chưa có PR, bỏ qua CI theo chỉ thị của Đức; phần media/AI hoãn sang R-06/R-08, xem bên dưới) |
| R-05b | Tách API `public` (`/api/v1`) / `internal` (`/internal/v1`); auth cấp user token và service token (EdDSA + JWKS); tách thư mục theo hai bề mặt (ADR-004)                                                            | 5–6  | R-04, R-05  | Hoàn thành cục bộ (28/10/2026; chưa commit/PR, bỏ qua CI theo chỉ thị của Đức; xem bằng chứng bên dưới)                           |
| R-06  | `media` + worker: upload trực tiếp MinIO, thumbnail, usage, job                                                                                                                                                     | 5–8  | R-03        | Hoàn thành (28/10/2026; PR #62, bỏ qua CI theo chỉ thị của Đức; xem bên dưới) |
| R-07  | `notification` + worker: single, batch, email thật, inbox REST                                                                                                                                                      | 6–9  | R-03, R-04  | Hoàn thành (28/10/2026; PR #63, bỏ qua CI theo chỉ thị của Đức; xem bên dưới) |
| R-08  | `ai` gateway + luồng AI trong `course`                                                                                                                                                                              | 7–10 | R-05, R-06  | Hoàn thành (28/10/2026; PR #65, bỏ qua CI theo chỉ thị của Đức; xem bên dưới) |
| R-09  | `scheduler`: job `MEDIA_UNUSED_CLEANUP`                                                                                                                                                                             | 8–9  | R-06        | Hoàn thành (28/10/2026; PR #64, bỏ qua CI theo chỉ thị của Đức; xem bên dưới) |
| R-10  | Data seeder quy mô lớn cho PostgreSQL                                                                                                                                                                               | 9–10 | R-04, R-05  | Hoàn thành (29/10/2026; PR #66, bỏ qua CI theo chỉ thị của Đức; xem bên dưới) |
| R-11  | Test, CI, Postman v2; viết lại regression và job CI `mvp-regression`/`w7-compose` (gỡ ở R-05); đổi tên test `w1/w2/w3/w5` theo nghiệp vụ                                                                            | 8–10 | R-04…R-09   | Hoàn thành (29/10/2026; PR #67, CI GitHub xanh trừ GitGuardian báo nhầm; xem bên dưới) |
| R-12  | Viết lại docs, viết lại smoke tracing/metrics/logs/acceptance (đang gắn luồng v1), kiểm chứng telemetry xuyên service, danh mục case phức tạp v0; ghi nhận schema kết quả RCA và nơi lưu (cho MCP thứ yếu, ADR-002) | 9–10 | tất cả      | Hoàn thành (29/10/2026; PR #68, CI GitHub xanh; xem "R-12" bên dưới) |
| R-13  | Gộp `auth` + `student` thành service `identity` (code, DB `identity_db`, env, telemetry, compose, CI, docs; [ADR-005](../../adr/adr-005-merge-auth-student-into-identity-v1.md)) | 11–12 | R-04, R-12 | Đang thực hiện (nhánh `refactor/week-13/task-15-merge-identity-service`, chưa có PR; xem "R-13" bên dưới) |

## Mốc kiểm tra

- **Cuối ngày 2**: ADR + `service-catalogue-v2` được Đức xác nhận; stack observability chạy từ `aiops-platform/` với 8 service cũ.
- **Cuối ngày 5**: auth, student, gateway, course (nửa đầu) xanh test.
- **Cuối ngày 8**: course, media, notification chạy e2e; nếu trượt, báo lại để quyết định cắt gì, không tự cắt.

## Bằng chứng DoD

Mỗi task chỉ chuyển `Hoàn thành` khi output ghi lệnh đã chạy và kết quả tương ứng từng DoD dưới đây. Card chi tiết theo template tuần tạo khi bắt đầu từng task.

| Mã   | DoD                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------- |
| R-01 | Ba tài liệu v2 và hai ADR hoàn chỉnh, link hợp lệ; Đức xác nhận `service.name` và topology            |
| R-02 | `docker compose config` hợp lệ cho hai file compose; smoke trace/metric/log còn xanh với 8 service cũ |
| R-03 | `pnpm build/lint/test` xanh; một service mẫu chạy migrate và health                                   |
| R-04 | `auth` (3 role, 3 cửa đăng nhập), `student`, `gateway` (bỏ `admin`, ADR-003)                          | 3–5 | R-03 | Hoàn thành (28/10/2026; `student` ở PR #53, `auth` ở PR #54 và #57, `gateway` ở PR #58, bỏ qua CI theo chỉ thị của Đức) |
| R-05 | e2e luồng học (enroll, học, quiz); unit test từng use case                                            |
| R-05b | Ma trận token e2e (không token / user token / token sai scope / giả `x-principal-*` đều bị từ chối); JWKS và `service-token` hoạt động; `compose-reset-smoke` đạt |
| R-06 | e2e upload trực tiếp lên MinIO, thumbnail `READY`, usage đồng bộ markdown                             |
| R-07 | Email xuất hiện trong Mailpit; batch partial-failed retry đúng; inbox đọc/đánh dấu được               |
| R-08 | e2e với provider giả (HTTP stub); test mã hóa API key                                                 |
| R-09 | Job chạy và ghi run; chạy lặp không trùng                                                             |
| R-10 | Seed lặp cho cùng fingerprint; ghi thời gian và số dòng                                               |
| R-11 | CI xanh; regression pass; Postman v2 chạy được                                                        |
| R-12 | Trace đủ span xuyên service; docs đối chiếu code; danh mục case phức tạp v0 có ground truth           |
| R-13 | Đăng ký student là một transaction trong `identity_db`; e2e `identity` đạt trên PostgreSQL thật; không còn tham chiếu service `auth`/`student` ngoài các ngoại lệ đã ghi; stack compose 21 thành phần healthy; regression và smoke observability đạt với topology mới; số đo (runtime, cặp dependency, cạnh HTTP) đo lại thật |

## Bằng chứng đã chạy

### R-02 (PR #52)

Stack 16 container dựng từ `docker-compose/compose.full.yaml`: 51 span từ 8 runtime, metric kể cả RabbitMQ qua hai network, log có `trace_id`; `reset-and-seed` chạy hai lần cho cùng fingerprint; teardown sạch. Job CI `Testbed MVP regression` từng fail một lần ở acceptance smoke (kịch bản `unavailable`) và pass khi chạy lại; GitGuardian báo false positive trên mật khẩu Grafana mẫu, giống ca W10 PR #41.

### R-03 (chạy cục bộ ngày 27/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục              | Lệnh / kết quả                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build, lint, format   | `pnpm run build`, `pnpm run lint`, `pnpm run format:check` đều xanh                                                                                                                                                                                                        |
| Unit `common`         | `pnpm --filter @aiops-lms/common test`: 16 test (envelope lỗi, guard role, correlation, circuit breaker, HTTP client, outbox/inbox)                                                                                                                                        |
| Integration `common`  | `test/integration/rabbitmq-outbox.integration.mjs` với RabbitMQ 4.1 + PostgreSQL 17 thật: outbox → relay → consumer, inbox chặn xử lý trùng, retry đủ 3 lần, `onFault`, queue `.error`. Chạy lần đầu lộ lỗi consumer thứ hai không khai báo queue; đã sửa trước khi commit |
| Boundary              | `pnpm run test:architecture`: 27 test (domain/application cấm `@nestjs/*`, `@prisma/*`, `common/{http,clients,telemetry,messaging,prisma,config}`, adapters; cho phép `common/{errors,ports}`)                                                                             |
| Service mẫu `student` | Image build bằng `services/student/Dockerfile`; container chạy `prisma migrate deploy`, `GET /ready` báo `postgres: ok`, tạo/đọc student, 401/403/409/400 đúng envelope                                                                                                    |
| Hạ tầng               | `postgres` tạo DB và role riêng cho student/media/notification/scheduler/ai; `minio-init` tạo 5 bucket; Mailpit trả `/api/v1/info`                                                                                                                                         |
| Generator             | `pnpm new-service <name> --port <port>` sinh service build, lint và test được (kiểm bằng service thử, đã xóa)                                                                                                                                                              |

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này. Image MinIO chính thức không còn trên Docker Hub/Quay, nên compose dùng `bitnamilegacy/minio` ghim phiên bản (xem ghi chú trong `compose.yaml`).

### R-04b (chạy cục bộ ngày 27/10/2026)

| Hạng mục   | Kết quả                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract   | `lms/contracts/src/http/`: `common` (id, role, phân trang, envelope), `auth`, `student`; kiểu suy ra từ zod                                                                                                   |
| Envelope   | Success và lỗi cùng bốn khóa `success/data/error/meta`; `ResponseEnvelopeInterceptor` + `AppExceptionFilter` dựng ở một chỗ; `@RawResponse()` cho stream                                                      |
| Phân trang | Đầu vào `page`/`page_size` (mặc định 1/20, tối đa 100), đầu ra `meta.pagination { page, page_size, total, total_pages }`; tham số sai trả 400                                                                 |
| Test       | common 21 test (gồm envelope và Page); e2e auth 6 test và e2e student 4 test với PostgreSQL thật, mọi response parse qua schema của contract; `compose-reset-smoke` đạt với đăng nhập đọc `data.access_token` |
| Hệ quả     | Gateway v1 và course/enrollment/... v1 vẫn trả body cũ cho tới khi thay ở R-04…R-08; smoke, CI, Postman, regression đã đổi đọc `data.*` cho phần đăng nhập                                                    |

### R-04 gateway (chạy cục bộ ngày 28/10/2026)

| Hạng mục    | Kết quả                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gateway mới | `domain/route-table`, `ProxyRequestUseCase`, `FetchUpstreamClient`; xác thực JWT, role theo bảng route, chuyển tiếp stream (multipart, `Range`), không parse body                          |
| Quy tắc lỗi | Giữ nguyên mọi phản hồi của upstream kể cả 4xx/5xx và mã nghiệp vụ; Gateway chỉ tự sinh `404/401/403/503/504` bằng envelope                                                                |
| An toàn     | Chuẩn hóa path chặn `..`/`%2e%2e` thoát khỏi `/api`; xóa `x-principal-*` và `Authorization` của client                                                                                     |
| Test        | Unit 16; e2e 9 với upstream HTTP giả (JWT, role, danh tính, mã nghiệp vụ 502/500 nguyên vẹn, 503/504, body nhị phân 300 KB, Range, dot-segment); telemetry test; `compose-reset-smoke` đạt |
| Hệ quả      | Route v1 `enrollments/submissions/grades` còn tồn tại qua biến `GATEWAY_*_BASE_URL` cho tới R-05 (đã gỡ ở R-05); metric gateway đổi từ `gateway.dependency.*` sang `lms.dependency.*`      |

### R-05 (chạy cục bộ ngày 28/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục         | Kết quả                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service `course` | Dựng lại bằng generator trên Prisma (8 bảng + `outbox_messages`, partial unique index `quiz_attempts_one_in_progress`); 30 use case, mỗi use case một class; 4 controller mỏng; DTO là zod schema trong `contracts/src/http/course.ts`; contract §4.3 cập nhật đúng route đã triển khai                                                                                    |
| Unit             | 35 test chạy bằng repository in-memory: mỗi use case có ít nhất một test, thêm `QuizGrader`, validation quiz (giới hạn, điểm lẻ không sai số), escape CSV, export nhiều khối keyset                                                                                                                                                                                        |
| e2e              | `pnpm run test:course:e2e` với PostgreSQL 17 thật: luồng tạo khóa → bài học (trùng thứ tự, reorder) → quiz → xuất bản → ghi danh → học, tiến độ → làm bài (start 201, resume 200, chấm 1.5/3.5 điểm, nộp lại 409) → khóa quiz khi có attempt; 6 request `start` đồng thời chỉ tạo một attempt; phân trang, summary, export CSV; mọi response parse qua schema của contract |
| Toàn repo        | `pnpm run lint`, `pnpm run format:check`, `pnpm run test` xanh (gồm gateway 25 test, auth, student, common, boundary)                                                                                                                                                                                                                                                      |
| Gỡ khỏi repo     | `enrollment`, `submission`, `submission-storage-mock`, `grading` và Redis (compose, env, postgres-init, script gốc, CI); `notification` v1 còn tới R-07 nhưng không còn producer `grade.completed`; gateway bỏ route `enrollments/submissions/grades`                                                                                                                      |
| Compose          | 15 thành phần healthy; `course` cổng `3003` với `course_db` và role `course_user`; `POSTGRES_DB` mặc định đổi thành `postgres` để `course_db` do script init tạo (volume cũ phải tạo lại)                                                                                                                                                                                  |
| Reset/seed       | `reset-and-seed` đổi fingerprint sang `auth_db`, `student_db`, `course_db` và RabbitMQ; `compose-reset-smoke` làm bẩn `course_db` rồi reset hai lần, fingerprint không đổi (`44127912be37…8850`, exit 0, 15 thành phần healthy, trace cũ trả 404 sau reset)                                                                                                                |

**Hoãn có chủ đích (không cắt scope, đã chuyển chủ):**

- Đồng bộ usage media bằng command (`media.*`) → R-06 (đã làm); luồng AI (`ai-documents`, `ai-jobs`) → R-08. `outbox_messages` đã có trong `course_db` cho các producer này.
- Smoke `tracing/metrics/logs/acceptance`, `test/regression/*`, Postman v1 và hai job CI `mvp-regression`, `w7-compose` gắn với luồng v1 (enrollment/submission/grading) nên không chạy được với topology v2: job CI đã gỡ, các script còn nguyên trong repo để làm nền cho R-11 (regression, Postman) và R-12 (smoke telemetry).
- Seed dữ liệu: stack không còn khóa học `course-001`; seeder quy mô lớn ở R-10.

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này (job `quality` mới chạy migrate + e2e `auth`, `student`, `course`, chưa chạy trên GitHub).

### R-05b (chạy cục bộ ngày 28/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục           | Kết quả                                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hai bề mặt API     | `auth`, `student`, `course` tách controller thành `adapters/http/{public,internal,open,shared}`; prefix là hằng số `PUBLIC_PREFIX`/`INTERNAL_PREFIX` trong `@aiops-lms/contracts`; `lms/test/http-surface.test.mjs` kiểm thư mục, prefix và decorator; ESLint cấm `public/` ↔ `internal/` import nhau |
| Hai loại token     | User token (`typ=user`) và service token (`typ=service`, TTL 600 s, không refresh) ký EdDSA bằng `node:crypto`; verify cục bộ qua `GET /.well-known/jwks.json`; `POST /internal/v1/auth/service-token` cấp token theo registry `auth_service_clients` (secret băm scrypt) |
| Guard              | `ServiceAuthGuard` toàn cục: mọi request cần service token đúng `aud`; route public chỉ nhận `sub=gateway` + scope `gateway:proxy` rồi mới tin `x-principal-*`; route internal kiểm scope bằng `@InternalApi`                                                             |
| Unit               | auth 24, common 36, gateway 26, course 35, notification 16; test kiến trúc 27 + 3 + 5; telemetry gateway đạt                                                                                                                                                            |
| e2e (PostgreSQL 17) | auth 11, student 6, course 4: gồm ma trận không token / user token ở nơi cần service token / service token sai scope / giả `x-principal-*` / sai secret client đều bị từ chối                                                                                           |
| Toàn repo          | `pnpm run lint`, `pnpm run format:check` xanh                                                                                                                                                                                                                            |
| Compose            | `compose-reset-smoke` exit 0, 15 thành phần healthy, fingerprint không đổi (`44127912be37…8850`). Lần chạy đầu fail do vòng khởi động: auth seed tài khoản trước khi listen nhưng student cần JWKS của auth để verify token. Sửa: seed tài khoản chạy nền sau `listen` (thử lại tối đa 60 lần) và `/ready` của auth chỉ ok khi seed xong |

**Hoãn có chủ đích (không cắt scope, đã chuyển chủ):**

- `test/regression/*`, Postman v1 và biến JWT trong `test/regression/testbed.ts` còn theo HS256 → R-11.
- Giới hạn tốc độ cho `POST /internal/v1/auth/service-token` (chống dò secret) → R-12.
- Chưa kiểm luồng đăng nhập → gateway → course/student trên stack compose thật (smoke không đăng nhập); các luồng này đã có e2e từng service và test gateway.

### R-06 (chạy cục bộ ngày 28/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục              | Kết quả                                                                                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service `media`       | Dựng trên Prisma (`media_objects`, `media_usages`, `media_background_jobs`, outbox/inbox; partial unique index một thumbnail/course, một avatar/student); một image, hai entrypoint `media` (3004) và `media-worker` (3005); public/internal tách bề mặt, 7 queue `media-worker--*-v1`                          |
| Object key (đã chốt)  | Upload trực tiếp ghi `tmp/{uuid}.{ext}` cùng bucket; `upload-complete` kiểm tra kích thước + SHA-256 rồi copy sang `yyyy/MM/dd/{uuid}.{ext}` (UTC) và xóa `tmp/`; thumbnail là một dòng `media_objects` (`source_media_id`) ở bucket `images`, key `.webp`                                                    |
| Producer phía course  | Create/update course, lesson, quiz ghi `media.markdown-usage.synchronize` vào outbox cùng transaction; xóa course/lesson/quiz hỏi `media` (`ids:query`) rồi ghi `media.usages.delete-by-ids` cùng transaction; media chết thì 503 và không xóa. `OutboxRelayLoop` dùng chung ở `packages/common`                  |
| Unit                  | media 64, course 42 (thêm 7 test tác động media), toàn `pnpm run test` exit 0                                                                                                                                                                                                                                 |
| e2e (thật)            | `test:media:e2e` 11 test với PostgreSQL 17, MinIO và RabbitMQ thật: upload trực tiếp → `READY` → Range/416 → thumbnail WebP; checksum sai; chưa upload; quá dung lượng; multipart; quy tắc usage (singleton, thay thế, reorder, quyền xóa); avatar qua student giả; retry thumbnail; sync/xóa markdown qua RabbitMQ; thứ tự đảo của job notification; ma trận scope. `test:course:e2e` 5 test gồm outbox và media chết |
| Luồng thật trên stack | Compose `up` 6 service: đăng nhập instructor qua Gateway → `upload-intents` → POST thẳng MinIO (204) → `upload-complete` `READY` → thumbnail WebP `READY` cho cả PNG (96 B) và MP4 (1512 B, ffmpeg trong image) → content `200` đúng content-type; tạo course có ảnh trong markdown → usage `COURSE_DESCRIPTION` xuất hiện; xóa course → usage về 0 |
| Compose/CI            | Thêm `media`, `media-worker` (17 thành phần); client `media` (→ student) và `course` (→ media) trong registry, gateway được gọi audience `media`; CI thêm MinIO, `media_db`, migrate và `test:media:e2e`. `compose-reset-smoke` exit 0, fingerprint `4816e6c73dc1…ee69`, 17 thành phần healthy, trace cũ 404 sau reset   |
| Toàn repo             | `pnpm run lint` (thêm `media` vào glob), `format:check`, `test`, `test:architecture` xanh                                                                                                                                                                                                                     |

**Hoãn có chủ đích (không cắt scope, đã chuyển chủ):**

- `POST /internal/v1/media/cleanup` và job `MEDIA_UNUSED_CLEANUP` → R-09; thuộc scope `media:cleanup`.
- ~~Producer các command usage của notification~~: đã làm ở R-07.
- Luồng AI đọc byte tài liệu (`GET /internal/v1/media/{id}/content`, scope `media:content:read`): endpoint đã có, client phía course thêm ở R-08.

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này; job `quality` đã thêm MinIO và `test:media:e2e` nhưng chưa chạy trên GitHub.

### R-07 (chạy cục bộ ngày 28/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục               | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service `notification` | Dựng lại trên Prisma (`notifications`, `notification_batches`, `notification_batch_items`, outbox/inbox; unique `(batch_id, student_id)` và `source_batch_id`); gỡ toàn bộ v1 (consumer `grade.completed`, dedup, slowdown). Một image, hai entrypoint: `notification` (API, cổng 3006) và `notification-worker` (cổng 3007); 16 use case, hai controller public (`notifications`, `notification-batches`)                |
| Batch                  | `snapshot` duyệt `GET /internal/v1/students` theo trang (endpoint mới ở `student`, sắp theo `id`, `page_size` ≤ 100) và chèn item idempotent; `dispatch` nhận item bằng lease `FOR UPDATE SKIP LOCKED`, gửi email song song, ghi inbox, ghi kết quả và tự enqueue lượt kế trong cùng transaction; backoff nhân đôi, trạng thái cuối `COMPLETED`/`PARTIAL_FAILED`/`FAILED`; `retry-failed` chỉ một lần mỗi batch nguồn |
| Producer media         | Thông báo đơn gửi `media.notification-usage.register`; batch gửi `start-job` khi tạo, `register-batch` theo lô từ worker và `complete-job` (kèm `expected_usage_count`) khi kết thúc hoặc `FAILED`; đều qua outbox cùng transaction                                                                                                                                                                                       |
| Contract               | DTO notification ở `contracts/src/http/public/notification.ts`, command ở `contracts/src/commands/` (`notification.batch.snapshot`, `notification.batch.dispatch`, `notification.single.dispatch`); contract §4.5, §5, §6.3 và data-ownership §2.5 đã đối chiếu với code                                                                                                                                                  |
| Unit                   | notification 32 test (domain, use case thông báo/batch/retry, snapshot, dispatch với RETRY/FAILED/lease hết hạn/media, fail batch, dispatch đơn) bằng repository in-memory; student thêm test danh sách `ACTIVE`; toàn `pnpm run test` exit 0                                                                                                                                                                              |
| e2e (thật)             | `test:notification:e2e` 8 test với PostgreSQL 17, RabbitMQ và Mailpit thật (chỉ `auth`/`student` là stub): ma trận 401/403/400; thông báo đơn → email trong Mailpit, inbox, đánh dấu đã đọc, command trong outbox; batch 3 student có một địa chỉ bị từ chối → `PARTIAL_FAILED` (2 thành công, 1 `FAILED` sau 2 lần), snapshot/delivery/failed-items, command media đúng nội dung → `retry-failed` → `COMPLETED`, người đã nhận không nhận lại, retry lần hai trả 409; chạy ba lần liên tiếp đều xanh. `test:student:e2e` 7 test |
| Luồng thật trên stack  | Compose `up` 13 service (không observability): đăng ký 2 student, đăng nhập admin qua Gateway → tạo thông báo đơn và batch → `COMPLETED 3/3` (gồm student seed), 4 email trong Mailpit, inbox student đọc qua Gateway (`BULK` và `SINGLE`, `email_status=SENT`); upload PNG rồi batch có ảnh → job `NOTIFICATION_USAGE` của media `COMPLETED` (expected 3, processed 3) và 3 usage `NOTIFICATION_BODY`                          |
| Compose/CI             | Thêm `notification` (migrate khi khởi động) và `notification-worker` (18 thành phần); `notification-worker` → `student` (scope `student:profile:read`) và gateway audience `notification` trong registry; gateway mặc định `notification` 3006 (scheduler/ai dời 3008/3009); CI thêm Mailpit, `notification_db`, migrate và `test:notification:e2e`. `compose-reset-smoke` exit 0, fingerprint `ac55ffb353ef…8c59`, 18 thành phần healthy, trace cũ 404 sau reset |
| Toàn repo              | `pnpm run build`, `lint`, `format:check`, `test`, `test:architecture` exit 0                                                                                                                                                                                                                                                                                                                                             |

**Hoãn có chủ đích (không cắt scope, đã chuyển chủ):**

- Contract sự kiện v1 `grade.completed` (`contracts/src/events/`, `contracts/events/`) và các tham chiếu trong `test/regression/*`, `test/observability/*` vẫn còn vì gắn với test cũ cần viết lại → R-11 (smoke observability → R-12). Gỡ cùng lúc.
- Phân trang `GET /internal/v1/students` đang dùng offset theo `id` (đủ cho trần 100.000 recipient); cân nhắc keyset ở R-10 cùng seeder quy mô lớn.

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này; job `quality` đã thêm Mailpit và `test:notification:e2e` nhưng chưa chạy trên GitHub.

### R-08 (chạy cục bộ ngày 28/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục               | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thiết kế (Đức chốt)    | `ai` sở hữu cả trích xuất tài liệu và job AI soạn bài, có `ai-worker`; `course` chỉ là facade (kiểm quyền I*, ghép tệp đính kèm của media với trạng thái của `ai`, truyền `requested_by` tường minh); `media` nhận cờ `extract_text` lúc upload. Bản đầu (worker trong `course`) đã bỏ trước khi merge theo chỉ thị của Đức                                                                                                                              |
| Service `ai`           | Prisma (`ai_providers`, `ai_models`, `ai_service_bindings`, `ai_invocations`, `ai_documents`, `ai_jobs`, outbox/inbox; partial unique `ai_jobs_one_active`). Một image, hai entrypoint: `ai` (API, cổng 3009) và `ai-worker` (cổng 3011). API key mã hóa AES-256-GCM (`AI_ENCRYPTION_KEY`), API chỉ trả `api_key_hint`; `POST /internal/v1/ai/completions` phân biệt timeout/kết nối và không lộ API key hay host provider                              |
| Command                | `ai.document.extract` (producer `ai` và `media`) và `ai.job.run` (producer `ai`), consumer `ai-worker`, queue `ai-worker--extract-ai-document-v1` và `ai-worker--run-ai-job-v1`; mỗi job/tài liệu một command, không self-enqueue; job `RUNNING` quá lease thành `FAILED/WORKER_INTERRUPTED` và không chạy lại (tránh tạo trùng quiz hoặc ghi đè lần hai)                                                                                              |
| `course`, `media`      | `course`: 5 route `ai-documents`/`ai-jobs` giữ nguyên, thêm 3 route internal cho `ai-worker` (`ai-context`, `ai-content`, `ai-quizzes`); không còn bảng hay worker AI. `media`: cột `extract_text` (migration), phát `ai.document.extract` trong transaction `READY`. Vòng `course → ai → course` ghi ở topology (`dependency_identity=ai-worker-course`)                                                                                             |
| Unit                   | ai 83, course 57, media 84, `@aiops-lms/common` 38, observability 44; toàn `pnpm run test` exit 0                                                                                                                                                                                                                                                                                                                                                              |
| e2e (thật)             | `test:ai:e2e` 30 test (PostgreSQL 17, RabbitMQ, MinIO thật; auth/course/media/provider là HTTP stub): mã hóa API key (DB không chứa plaintext, response chỉ có hint), mọi lỗi provider (401/429/400/500/JSON hỏng/redirect/timeout/cổng đóng) không lộ key hay host, health-check, sync → extract → job tổng hợp/quiz/lỗi, command từ media qua RabbitMQ khử trùng theo `message_id`, ma trận 401/403. `test:course:e2e` 15, `test:media:e2e` 19 (có `extract_text`)    |
| Luồng thật trên stack  | Compose `up --build --wait` (17 service, không observability): admin tạo provider (`CUSTOM`) trỏ tới provider giả chạy trong container (không publish cổng) → model → binding; instructor tạo course/lesson, upload TXT với `extract_text=true` qua MinIO, gắn `LESSON_ATTACHMENT` → `ai-worker` trích `EXTRACTED` → job `SYNTHESIZE_LESSON` `COMPLETED`, nội dung bài học được ghi qua `course`; provider giả nhận 6 lượt, API key giải mã đúng ở mọi lượt; `ai_invocations` có dòng; health-check provider `200` |
| Compose/CI             | Thêm `ai` và `ai-worker` (22 thành phần); registry: `course` → audience `ai` (`ai:document:*`, `ai:job:*`), `ai-worker` → `course` (`course:lesson-ai:read|write`) và `media` (`media:content:read`), gateway thêm audience `ai`; `ai-worker` thêm vào catalogue tên service của `@aiops-lms/observability` (thiếu thì container thoát lúc khởi động, chỉ lộ khi chạy stack thật vì e2e tắt telemetry); CI thêm `ai_db`, RabbitMQ cho `ai`, `test:ai:e2e` |

**Hoãn có chủ đích (không cắt scope, đã chuyển chủ):**

- Chính sách retention cho `ai_documents`/`ai_jobs` mồ côi khi xóa media/bài học/khóa học (không có FK chéo DB) → R-12.
- Chạy thử với provider LLM thật (OpenAI/Gemini/Anthropic/Mistral): chỉ kiểm bằng HTTP stub; cách gửi PDF/ảnh theo từng loại provider dựa trên tài liệu API, chưa kiểm với dịch vụ thật → người vận hành khi cấu hình provider thật; ghi nhận ở R-12.
- Ràng buộc `AI_WORKER_LEASE_MS > AI_COMPLETION_TIMEOUT_MS` mới là quy ước (có test cấu hình mặc định), chưa ép bằng schema → R-12.
- Header `Location` cho `POST …/ai-jobs` (202) chưa làm; response trả job đầy đủ nên client đọc được `id` → R-12.

### R-09 (chạy cục bộ ngày 28/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục                          | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Service `scheduler`               | Prisma (`background_jobs`, `background_job_runs`, unique `(background_job_id, idempotency_key)`); một image, hai entrypoint `scheduler` (API, cổng 3008) và `scheduler-worker` (cổng 3010). Hàng đợi bằng lease `FOR UPDATE SKIP LOCKED`, bộ phân tích CRON 5 trường theo UTC tự viết, run `CRON` có khóa `cron:<job_id>:<scheduled_at>`; không dùng RabbitMQ. Mã lỗi mới `SCHEDULER_JOB_NOT_ACTIVE`                                                                  |
| `POST /internal/v1/media/cleanup` | Use case idempotent (scope `media:cleanup`): xóa mềm media gốc `READY` không còn usage và quá `retention_hours` cùng thumbnail, dọn thumbnail mồ côi, phục hồi upload `PENDING` stale (xóa object mồ côi, chuyển `FAILED`/`UPLOAD_ABANDONED`); khóa dòng `FOR UPDATE SKIP LOCKED` và kiểm usage sau khi giữ khóa; media còn usage (kể cả singleton) không bao giờ bị chọn; tóm tắt không lộ object key hay credential |
| Unit                              | scheduler 64, media 75 (11 test cleanup); toàn `pnpm run test` exit 0                                                                                                                                                                                                                                                                                                                                                   |
| e2e (thật)                        | `test:scheduler:e2e` 10 test (PostgreSQL, media là HTTP stub dùng chung schema zod với contract): ma trận auth, `next_run_at` CRON, luồng cleanup kèm kiểm audience/scope của token, trigger đồng thời cùng khóa, các kiểu lỗi của media, `PAUSED`/`DISABLED`, CRON lũy đẳng, nhiều instance không chạy chồng, lease hết hạn. `test:media:e2e` 15 (11 cũ và 4 cleanup với MinIO thật), `test:course:e2e` 5 |
| Luồng thật trên stack             | Chạy trên cây hợp nhất R-08 + R-09 (compose 22 thành phần): tạo job `MEDIA_UNUSED_CLEANUP` qua Gateway → trigger run → `SUCCEEDED` với `output_json` an toàn; media không dùng (backdate 3 giờ trong DB, sau khi thumbnail xong) bị dọn, media đang có usage được giữ; trigger lặp cùng `idempotency_key` trả cùng run (HTTP 200), lịch sử và DB đều chỉ 1 run; khóa mới → run mới `SUCCEEDED` không dọn thêm        |
| Compose/CI                        | Thêm `scheduler` (publish ra host 3018 vì cổng host 3008 thuộc Grafana của `aiops-platform`; trong network vẫn là `scheduler:3008`) và `scheduler-worker` (20 thành phần); client `scheduler-worker` → `media` (`media:cleanup`), gateway thêm audience `scheduler`; CI thêm `scheduler_db` và `test:scheduler:e2e`. `compose-reset-smoke` chạy trên cây hợp nhất R-08 + R-09 (22 thành phần, fingerprint ổn định `611d90c41b55…2b9c`), không chạy riêng ở nhánh này |
| Toàn repo                         | `pnpm run build`, `lint`, `format:check`, `test`, `test:architecture` exit 0                                                                                                                                                                                                                                                                                                                                             |

**Hoãn có chủ đích (không cắt scope, đã chuyển chủ):**

- Chưa có kiểm thử xuyên service scheduler → media → MinIO trong CI ngoài luồng thật đã chạy tay trên stack → R-11 (đưa vào regression).
- Loại job mới ngoài `MEDIA_UNUSED_CLEANUP`: cổng `JobHandler` đã sẵn, thêm handler khi có yêu cầu.
- Run `FAILED` không tự retry (đúng thiết kế; tạo run mới bằng khóa khác).
- `test:media:e2e` hiếm khi (1 trong 7 lần chạy) thoát mã 1 dù 15 test pass: unhandled rejection `IllegalOperationError: Channel closed` từ `RabbitMqCommandConsumer.fail` khi app đóng giữa lúc consumer đang xử lý lệnh → R-11 (làm teardown e2e và consumer chịu được channel đóng).
- `test:auth:e2e` 9/11 (có sẵn từ trước, kiểm chứng trên HEAD sạch `2dcf68f`): hai test đăng nhập admin bị 401 vì e2e không gọi `startAccountSeeding` nên admin không được seed → R-11.

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này; job `quality` đã thêm `scheduler_db` và `test:scheduler:e2e` nhưng chưa chạy trên GitHub.

### Kiểm chứng chung R-08 và R-09 (28/10/2026)

| Hạng mục              | Kết quả                                                                                                                                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toàn repo             | `pnpm run build`, `lint`, `format:check`, `test`, `test:architecture` exit 0                                                                                                                                                                                                                                      |
| `compose-reset-smoke` | exit 0, 22 thành phần healthy, fingerprint ổn định qua hai lần reset `611d90c41b55…2b9c`. Hai lần chạy đầu fail: cổng host 3008 trùng Grafana (đã đổi cổng host của scheduler) và `ai-worker` chưa có trong catalogue tên service của observability (đã thêm kèm test)                                          |
| e2e auth (có sẵn)     | `test:auth:e2e` 9/11: hai test đăng nhập admin bị 401 vì e2e không gọi `startAccountSeeding` nên admin không được seed. Đã kiểm chứng trên HEAD sạch (worktree `2dcf68f`) cho cùng kết quả, không do R-08/R-09 → R-11                                                                                              |

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này; job `quality` đã thêm `ai_db`, `scheduler_db`, RabbitMQ cho `ai`, `test:ai:e2e` và `test:scheduler:e2e` nhưng chưa chạy trên GitHub.

### R-10 (chạy cục bộ ngày 29/10/2026, Node 22.13.1, pnpm 11.19.0)

Seeder `lms/scripts/seed-data.mjs` (mô-đun ở `lms/scripts/seed-data/`, README tiếng Việt): TUI chọn database, nhập số dòng từng bảng, progress từng bảng kèm `✔ ... thành công`; chế độ không tương tác `--non-interactive --yes --profile small|medium|large --count <db.bảng>=<số> --seed`. Ghi bằng SQL trực tiếp qua `pg` (`INSERT ... SELECT generate_series`), id xác định bắt đầu bằng `5eed`, mỗi database một transaction, chạy lại dọn dữ liệu seed cũ rồi nạp lại.

| Hạng mục                    | Kết quả                                                                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phạm vi                     | 7 database, 24 mục: `auth_users` (học viên, giảng viên), `students`, 9 bảng `course_db`, `media_objects` (gốc và thumbnail) và `media_usages`, `notifications` (đơn lẻ và từ đợt gửi), `notification_batches`, `notification_batch_items`, `ai_invocations`, `ai_documents`, `ai_jobs`, `background_jobs`, `background_job_runs` |
| Không seed                  | `outbox_messages`, `inbox_states`, `auth_service_clients`, `auth_refresh_tokens`, `ai_providers`/`ai_models`/`ai_service_bindings` (khóa mã hóa), mọi dòng đang xử lý dở                                                                                                                       |
| Unit                        | `test:seed-data` 24 test (catalogue đối chiếu `schema.prisma`, trần số dòng, planner, runner commit/rollback, progress TTY/không TTY, CLI, prompts); đã nối vào `pnpm run test`                                                                                                                |
| Trên PostgreSQL thật        | `test:seed-data:db` đạt: cùng fingerprint hai lần chạy, đổi `--seed` đổi fingerprint, dòng ngoài seed còn nguyên, số dòng khớp báo cáo, điểm quiz khớp đáp án trên 2.000 lượt (chấm lại độc lập bằng SQL), quiz hợp lệ, mọi media gốc có usage, chạy lại với số lượng nhỏ hơn thì dọn đúng, vượt trần bị từ chối |
| Fingerprint                 | profile `small` `a822b8cc…83a1`; `medium` `d6bce409…012d`, cùng giá trị trên Postgres tạm và trên Postgres của stack compose, hai lần liên tiếp                                                                                                                                                  |
| Thời gian và số dòng        | `small` 1,1s (~34 nghìn dòng); `medium` 17,3s (673.498 dòng; 18,2s và 24,4s trên stack compose); `large` 156,1s (5.057.612 dòng: 100.000 học viên, 400.000 enrollment, 1.000.000 tiến độ, 150.000 lượt làm bài, 1.332.072 đáp án, 900.000 notification), RSS tối đa 78 MB                    |
| Dọn dữ liệu lớn             | Dọn ~4,9 triệu dòng rồi nạp `small` trong 12,3s sau khi thêm chỉ mục tạm cho khóa ngoại thiếu chỉ mục (trước đó xóa `quiz_options` quét lại 1,3 triệu đáp án cho từng dòng, treo hơn 15 phút và phải hủy)                                                                                     |
| Trên stack compose thật     | Seed `medium` vào Postgres của stack 22 thành phần: học viên seed đăng nhập Gateway thành công (200), `GET /api/v1/student/enrollments` và `GET /api/v1/courses` của giảng viên seed trả dữ liệu seed; tài khoản bootstrap vẫn đăng nhập được; Mailpit không nhận email, không có run `PENDING`/`RUNNING` |
| TUI                         | Chạy trong pseudo-terminal: chọn 7 database, nhận 19 gợi ý số lượng, xác nhận, progress từng bảng và báo cáo; 0 dòng `✖`                                                                                                                                                                       |
| Cổng chất lượng             | `format:check`, `test:architecture`, `test:testbed:reset` (11 test, fingerprint reset không đổi vì seeder tách khỏi reset) đạt                                                                                                                                                                  |

**Khác với kế hoạch:** màn hình tóm tắt không hiển thị ước tính thời gian (không có căn cứ đáng tin trước khi chạy); báo cáo cuối có thời gian thật từng bảng.

**Hoãn có chủ đích (đã chuyển chủ):**

- Đưa `test:seed-data:db` vào CI cần Postgres đã migrate đủ 7 service (dùng stack compose sau reset) → R-11.
- Media seed không có tệp trong MinIO: `GET /media/{id}/content` và thumbnail của dòng seed sẽ lỗi → ghi nhận ở README seeder; tạo tệp thật nếu cần tải nội dung thì làm ở R-12.
- Chưa kiểm chứng `compose-reset-smoke` sau khi thêm seeder (seeder không đổi reset, fingerprint reset đã ghi ở R-09) → chạy lại ở R-11 cùng regression.

### R-11 (chạy cục bộ ngày 29/10/2026, Node 22.13.1, pnpm 11.19.0)

Phạm vi đã làm: sửa hai lỗi e2e tồn đọng, viết lại `lms/test/regression/` theo 7 luồng nghiệp vụ (chạy qua Gateway bằng `node:test`), Postman v2, gỡ contract `grade.completed` của v1, và viết lại CI (`.github/workflows/ci.yml`, `.github/workflows/regression.yml`, action `.github/actions/setup-lms`). CI chạy thật trên GitHub ở PR #67 (kết quả trong dòng "CI" bên dưới).

| Hạng mục | Kết quả |
| --- | --- |
| `test:auth:e2e` | 11/11 (trước đó 9/11): e2e gọi `BootstrapRunner.startAccountSeeding` và `ensureAccountsSeeded` sau `app.init()` nên admin được seed |
| Lỗi `Channel closed` của consumer | `RabbitMqCommandConsumer.stop()` chờ lệnh đang xử lý (tối đa 5s), ack/nack/phát lại qua `settle` (ghi cảnh báo thay vì ném), `fail()` bỏ qua khi đang tắt; ba worker `media`, `notification`, `ai` chờ `stop()` trước khi đóng session. 3 unit test mới trong `messaging.spec.ts` |
| Lỗi chạy relay sau khi Jest teardown | Gốc thứ hai của `test:media:e2e` thoát mã 1 (`require` sau khi môi trường Jest đã hủy, từ `OutboxRelayLoop.tick`): `OutboxRelayLoop.stop()` thành bất đồng bộ, chờ lượt relay đang chạy (tối đa 5s); 4 service `ai`, `course`, `media`, `notification` `await` khi tắt. 1 unit test mới |
| Độ ổn định `test:media:e2e` | Trước sửa: 2/10 lần thoát mã 1 dù 19 test pass. Sau sửa: 20/20 lần thoát mã 0 (19 test pass mỗi lần), cùng điều kiện chạy tuần tự trên Postgres/RabbitMQ/MinIO tạm |
| e2e toàn bộ | auth 11, student 7, course 15, media 19, notification 8, ai 30, scheduler 10, đều đạt mã 0 |
| Cổng chất lượng | `build`, `lint --max-warnings=0`, `format:check`, `test` (`common` 42 test, các package còn lại đạt), `test:architecture` đạt |
| Regression LMS | `pnpm run test:regression` (stack compose 22 thành phần, tên project `aiops-lms-test-regression`, provider AI giả trong container riêng): 46/46 test đạt trên stack mới, đạt lại trên stack dùng lại. 7 luồng: đăng ký/đăng nhập, soạn khóa học, ghi danh và học, upload media, soạn bài bằng AI, batch email (Mailpit), dọn media qua scheduler → media (kiểm tra xuyên service scheduler → media → MinIO) |
| Postman v2 | `pnpm run test:postman` (newman 6.2.2 ghim chính xác, stack `aiops-lms-test-postman`): 90 request, 223 assertion, 0 lỗi; collection `postman/lms-v2.postman_collection.json` và environment `postman/lms-v2.postman_environment.json`, README tiếng Việt |
| `compose-reset-smoke` | Đạt hai lần reset liên tiếp, fingerprint `611d90c41b551efc2ad0c507525d13e3675a619ed6282fd3e4c5d16574152b9c`; smoke observability trong script reset đạt. Chạy với `LOKI_PORT=13100` vì cổng 3100 đang do container của dự án khác trên máy giữ |
| `test:seed-data:db` | Đạt trên Postgres thật (đã chạy cục bộ; chưa đưa vào CI, xem bên dưới) |
| CI (viết lại; run trên PR #67) | `ci.yml` gồm 6 job: `static` (format, lint, build), `unit` (`pnpm run test`), `e2e` matrix 7 service (mỗi job: database riêng, build, migrate, e2e; `fail-fast: false`), `integration-db` (`common` `test:integration` và `test:seed-data:db`), `compose-config`, `compose-reset` (thêm `setup-node` đã ghim và giải phóng ổ đĩa). `regression.yml` gồm `regression` và `postman`, chạy khi PR gắn label `run-regression`, push vào `main`, nightly 18:00 UTC và `workflow_dispatch`. Hủy lượt cũ của cùng PR (`concurrency`). `actionlint` 1.7.7 không báo lỗi. Mô phỏng cục bộ từng bước trên Postgres/RabbitMQ/MinIO/Mailpit mới: build, migrate và e2e 7 service đạt (auth 11, student 7, course 15, media 19, notification 8, ai 30, scheduler 10), `common` `test:integration` đạt, `test:seed-data:db` đạt, `pnpm run test` đạt khi không có hạ tầng và không có biến môi trường CI. `regression`, `postman`, `compose-reset` chạy cùng lệnh đã đạt ở các dòng trên. **Trên GitHub (PR #67, run `40848961820` và `40848972612`)**: `static`, `unit`, 7 job `e2e`, `integration-db`, `compose-config` đạt; `compose-reset` 11 phút 29 giây, `regression` 9 phút 18 giây, `postman` 10 phút 12 giây đều đạt. Lượt đầu `unit` đỏ vì `common` cần `dist` của `observability` mà job chưa build; đã thêm bước build rồi chạy lại đạt. Check ngoài `GitGuardian Security Checks` báo `Generic Password` ở một chuỗi mật khẩu sai cố ý trong regression (báo nhầm, đã đổi sang giá trị suy ra từ biến nhưng cảnh báo còn gắn với commit cũ; check này cũng đỏ ở PR #65, #66) |
| Đổi tên test `w1/w2/w3/w5` | Không còn tệp test hay script nào trong `lms/`, `docker-compose/`, `postman/` mang tên `w*` hoặc `mvp-regression`; `w1_test` và `W1_AUTH_DATABASE_URL` trong `ci.yml` đã đổi thành `lms_test` và biến URL theo từng service |

**Khác với kế hoạch / phát hiện:**

- Runner regression bật `MEDIA_CLEANUP_MIN_RETENTION_HOURS=0` (biến mới có mặc định 1, thêm vào `docker-compose/compose.yaml` và `.env.example`) để kiểm tra dọn media trong thời gian test; stack thường không đổi hành vi.
- `test:student:e2e` giả định DB không chứa dữ liệu ngoài test (liệt kê `page_size` 100): chạy trên Postgres vừa nạp seeder sẽ fail. Dọn dữ liệu seed trước khi chạy e2e. Không phải lỗi mã, ghi nhận để không nhầm khi chạy e2e trên DB dùng chung.
- Lần dựng stack Postman đầu tiên gặp lỗi tạm thời `No such image: bitnamilegacy/minio-client`, chạy lại đạt; chưa rõ nguyên nhân (nghi tranh chấp khi nhiều project compose dựng cùng lúc).
- Ổ đĩa đầy khi build lặp nhiều stack (cache build ~200GB); chỉ xóa image và volume của hai project test do R-11 tạo, không prune cache chung.

**Hoãn có chủ đích (đã chuyển chủ):**

- Theo dõi vài tuần chạy thật của `regression.yml` (nightly, push `main`) trước khi nâng `compose-reset`, `regression`, `postman` thành required check; `main` hiện chưa bật branch protection → Đức quyết định.
- Cảnh báo GitGuardian báo nhầm trên commit cũ của PR #67: đánh dấu false positive trên dashboard GitGuardian → Đức.
- Script smoke observability (`test/observability/*`) vẫn dùng fixture `grade.completed` của v1; compose observability và cấu hình OTel còn queue `notification.grade-completed.v1`; tài liệu v1 và sơ đồ `w1/w4/w5` còn tham chiếu → R-12.

### R-12 (chạy cục bộ ngày 29/10/2026, Node 22.13.1, pnpm 11.19.0)

**CI trên GitHub (PR #68):** `static`, `unit`, 7 job `e2e`, `integration-db`, `compose-config`, `compose-reset` (11 phút 49 giây) và GitGuardian đều đạt. `regression.yml` không chạy (PR không gắn label `run-regression`); regression đã chạy cục bộ 46/46.

Phạm vi đã làm: khôi phục metric RabbitMQ, viết lại 5 smoke observability theo topology v2 (có runner `pnpm run test:observability`), đo telemetry xuyên service, viết lại docs còn gắn v1 theo hướng "thêm bản v+1, giữ bản cũ làm lịch sử", xóa toàn bộ sơ đồ v1 (không vẽ mới), lập danh mục case phức tạp v0 và ghi nhận schema kết quả RCA. Lệnh: `LOKI_PORT=13100 node test/observability/run-observability.mjs --environment test --project aiops-lms-test-obs --confirm aiops-lms-test-obs` (cổng 3100 do container dự án khác trên máy giữ).

| DoD | Bằng chứng |
| --- | --- |
| Trace đủ span xuyên service | Runner dựng stack `compose.full.yaml` sạch, chạy 7 workflow regression (46/46 đạt) rồi 5 smoke theo thứ tự stack, tracing, logs, acceptance, metrics: **đạt (exit 0)**. `tracing-smoke` kiểm 9 luồng, mỗi luồng cần đúng 1 span gốc đúng chủ, không đứt parent, không span lỗi, đủ span bắt buộc, `service.version`/`service.instance.id` khớp compose. Luồng: đăng nhập (gateway, auth), đăng ký (gateway, auth, student), soạn khóa học (gateway, course), upload media (gateway, media, media-worker), đồng bộ usage markdown (gateway, course, media-worker), batch thông báo (gateway, notification, notification-worker, student; 50 span), job AI (gateway, course, ai, ai-worker; 37 span), trích văn bản (gateway, media, ai-worker), dọn media theo lịch (scheduler-worker, media). `logs-smoke`: 12/12 runtime có log, `trace_id`/`span_id` khớp span thật. `metrics-smoke`: RED, CPU, RSS của 12 runtime; 42 cạnh dependency; 24 queue đủ nhãn `service_name`/`dependency_identity`/`queue`; dừng worker thì consumer về 0 và backlog tăng, mở lại thì drain và lệnh lỗi vào `.error`. `acceptance-smoke`: mọi query panel dashboard có dữ liệu, data link metric → TraceQL → Loki dùng được. |
| Docs đối chiếu code | Viết bản mới, giữ bản cũ kèm banner "Đã được thay thế": `backend-microservice-testbed-blueprint-v2`, `dependency-resilience-policy-v2`, `evaluation-protocol-v1`, `analysis-anomaly-rca-blueprint-v1`, `telemetry-and-ground-truth-schema-v1`, `project-scope-v2`, `research-questions-and-metrics-v2`, `khung-dinh-huong-tong-the-lms-microservice-ai-rca-v1`. Sửa tại chỗ: `data-ownership-and-fault-matrix-v2` (mục 5–8), `docker-compose/README.md`, `lms/packages/observability/README.md`, `lms/infrastructure/README.md`, README gốc. Mới: `aiops-platform/observability/README.md`. Chính sách resilience viết lại theo hành vi code (không retry HTTP, breaker 3 lỗi/5 giây, retry trong consumer rồi `.error`, backoff outbox). Mọi link tương đối trong các file mới/sửa đã kiểm: 0 link hỏng. 41 file sơ đồ v1 và `system-diagrams-v1.md` đã xóa. Phần tài liệu mới do agent soạn song song: đã kiểm link, cấu trúc và đối chiếu các điểm lệch agent báo (component FB, mã 504 của FG); **chưa** đọc lại từng mục từng file dài, nên Đức cần xem lại trước khi coi là chốt. |
| Danh mục case phức tạp v0 có ground truth | `docs/processed/architecture/complex-case-catalogue-and-rca-result-v0.md`: C1–C7, mỗi case có kịch bản, triệu chứng, ground truth, tín hiệu xác nhận, trạng thái. Chỉ **C6** chạy thật (`tracing-smoke`: `docker pause auth`, login 504 ngay, token người dùng còn hạn vẫn 200, lỗi tại cạnh `gateway-auth-token` sau 70–74 giây với TTL 60 giây, request không tới course, phục hồi sau `unpause`). C1–C5, C7 mới **đo tín hiệu**, cơ chế gây lỗi chưa chạy. Schema `RcaIncidentResult` và nơi lưu ở mục 5 (chỉ tài liệu, thuộc mảng AI theo ADR-002). |

**Số đo thật (stack một node):** 12/12 runtime có telemetry; 42 cạnh dependency; 24 queue (media-worker 7, notification-worker 3, ai-worker 2, mỗi queue thêm `.error`), 1 consumer mỗi queue canonical. Độ trễ từ request đến thấy được: log khoảng 2 giây, trace 2,5–5,6 giây, metric 1–10 giây; backlog hiện sau 5–10 giây khi dừng worker, drain thấy sau 8–14 giây.

**Cổng chất lượng:** `build`, `lint`, `format:check` (Prettier chỉ trong `lms/`), `test` (mọi package đạt, `common` 44 test), `test:architecture` đạt; `docker compose config` đạt cho `compose.yaml` và `compose.full.yaml`.

**Lỗi tìm thấy và đã sửa:**

- Trace bất đồng bộ đứt: relay outbox publish trong context rỗng nên chuỗi command là trace riêng. Sửa ở `RabbitMqCommandPublisher` (dùng `traceparent` trong envelope làm parent), 2 unit test mới.
- Identity RabbitMQ ghi chung `rabbitmq`: đổi thành `<service.name>-rabbitmq` (`publisher.dependencyIdentity` bắt buộc; 7 call site, test và e2e cập nhật).
- Metric broker mất: collector chỉ scrape queue v1 đã xóa; viết lại pipeline `metrics/rabbitmq` (giữ queue canonical, gán `service.name` theo tiền tố), thêm test `queue-scrape.test.mjs` so khớp regex collector với `contracts`.
- `packages/observability` còn danh sách service/cạnh v1 (kể cả `admin`): dọn theo v2.
- `compose.yaml` observability còn `NOTIFICATION_GRADE_COMPLETED_QUEUE`, dashboard còn metric v1: gỡ và viết lại.
- Healthcheck Postgres gây race khi khởi tạo (`student` chạy migrate lúc server tạm chỉ nghe unix socket, lỗi `P1001`): đổi thành `pg_isready -h 127.0.0.1`.
- Tempo bị OOM-kill (giới hạn 512 MiB) khi truy vấn hàng nghìn trace song song: smoke truy vấn tuần tự, hạn chế số trace; RCA engine không nên kéo trace hàng loạt từ Tempo của testbed.
- Một lần chạy `acceptance-smoke` đỏ do trace lỗi mới nhất chưa có log trong Loki: kiểm tra thử các trace ứng viên và thử lại tới 30 giây; chạy lại cả runner đạt.
- Giả thuyết ban đầu về C6 (lỗi ở `course-auth-token`) sai: triệu chứng nằm ở `gateway-auth-token`; smoke và catalogue đã sửa.

**Khác với kế hoạch / phát hiện:**

- Khi chạy từ stack sạch, `MEDIA_CLEANUP_MIN_RETENTION_HOURS=0` và `AUTH_SERVICE_TOKEN_TTL_SECONDS=60` do runner đặt (`extraEnv`), stack thường không đổi.
- `HttpQueryClient` đặt `operation_name` là `<METHOD> <path>` thô nên có ID trong nhãn metric ở nhiều cạnh (do agent tài liệu phát hiện, chưa sửa).
- Lỗi publish RabbitMQ ném `details.dependency=rabbitmq`, chưa theo identity `<service>-rabbitmq` (chưa sửa).
- Cạnh `media→student` có trong mapping code nhưng không có trong danh sách cạnh đo ở catalogue.
- Không thêm smoke vào CI trong task này (xem dưới).

**Hoãn có chủ đích (đã chuyển chủ):**

- Fault injector (FA–FH), workload k6, dataset, RCA engine, MCP server, chạy cơ chế C1–C5 và C7 → mảng AI (`aiops-platform/`), task sau.
- Metric còn thiếu cho RCA (pool DB, tuổi message cũ nhất, publish/consume RabbitMQ, outbox, log worker ngoài `/ready`, trace nối scheduler với worker) → Đức quyết định có bổ sung trước khi thu dataset.
- Quyết định mở trong tài liệu đánh giá: candidate set 11 (không có `gateway`) hay 12; `R = 3` thừa kế từ v0, chưa có bằng chứng v2; số người, time cap và brief thử nghiệm người; luật `base-manual-auto`; cách nạp lại telemetry khi quá retention 24 giờ → Đức.
- Sửa `operation_name` có ID và identity lỗi publish RabbitMQ (hai mục trên) → task sau.
- Đưa smoke observability vào CI (`regression.yml` hoặc workflow riêng, chạy `actionlint` trước): lần chạy cần ~10 phút và cổng Loki/Grafana riêng → Đức quyết định.
- Các mục R-05b/R-08/R-09 từng ghi "→ R-12" mà R-12 không làm: giới hạn tốc độ `POST /internal/v1/auth/service-token`; retention cho `ai_documents`/`ai_jobs` mồ côi; ràng buộc `AI_WORKER_LEASE_MS > AI_COMPLETION_TIMEOUT_MS` bằng schema; header `Location` cho `POST …/ai-jobs`; tệp thật cho media seed; chạy thử với provider LLM thật → Đức phân công lại (không thuộc DoD của R-12).
- Cảnh báo GitGuardian báo nhầm ở PR #67 vẫn chờ Đức đánh dấu false positive (từ R-11).
- Thư mục `docs/processed/description/` (mô tả đề tài) chưa rà soát → Đức.


### R-13 (đang thực hiện, Node 22.13.1, pnpm 11.19.0)

**Trạng thái:** chưa hoàn thành. Mục dưới ghi những gì đã chạy; mục nào chưa có kết quả thì nằm ở "Chưa chạy" và task không được chuyển `Hoàn thành` khi chưa có đủ bằng chứng cho từng DoD ở bảng trên.

Quyết định: [ADR-005](../../adr/adr-005-merge-auth-student-into-identity-v1.md). Bỏ hướng saga `PENDING`/`activate` của nhánh task-14 (còn trong `git stash@{0}`, không nhập vào).

**Đã chạy:**

- `identity.e2e-spec.ts` (PostgreSQL 17 tạm, cổng 55432): 17 test đạt (đăng ký/đăng nhập/refresh, đua refresh, seed, ba cửa đăng nhập, phân trang, hồ sơ chặn/`INACTIVE`/thiếu → 403, route student public và internal, không có `POST /internal/v1/students`, health/ready, service-token/JWKS, tách bề mặt).
- Test seed-data (`test:seed-data`) đạt với một DB `identity` và dataset dẫn xuất `identity.student_profiles`.
- `pnpm format:check`, `pnpm lint`, `pnpm build` đạt; `pnpm test` (architecture, testbed-reset, seed-data, queue-scrape, observability, common, unit mọi service, telemetry) exit 0.
- `test:observability` lần 1 (project `aiops-lms-test-observability`, stack sạch, 21 container lên được): **thất bại** ở bước regression làm traffic, 44/46 đạt; test `media-upload` bước usage hết 60 giây chờ `usage COURSE_DESCRIPTION xuất hiện` (đường `course` → outbox → RabbitMQ → `media-worker`, không đi qua `identity`; log container không có lỗi). Chưa rõ flaky hay lỗi thật; lần chạy lại bị dừng theo yêu cầu, các smoke tracing/logs/acceptance/metrics chưa chạy.

**Chưa chạy** (cập nhật mục này khi có kết quả): e2e của gateway/media/notification/course/ai/scheduler, `test:seed-data:db`, `test:testbed:reset:compose`, `test:regression`, `test:postman`, `test:observability` (đỏ ở lần 1, chưa chạy lại), CI GitHub (xem PR).

**Số đo** (runtime, cặp dependency, cạnh HTTP, identity, độ trễ C6): chưa đo lại; sẽ ghi từ lần chạy `test:observability` thật, không dùng số suy luận.

**Hệ quả cần Đức quyết định:** C5, C6, C7 cùng có `root_cause_service=identity`; ranking hằng tốt nhất Top-3 ≈ 71% (5/7) và Top-1 ≈ 43% (3/7). Đã ghi ở ADR-005 và evaluation-protocol; chưa quyết thêm case hay báo cáo theo component.
