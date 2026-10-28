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
| R-06  | `media` + worker: upload trực tiếp MinIO, thumbnail, usage, job                                                                                                                                                     | 5–8  | R-03        | Chưa bắt đầu                                                                                                                      |
| R-07  | `notification` + worker: single, batch, email thật, inbox REST                                                                                                                                                      | 6–9  | R-03, R-04  | Chưa bắt đầu                                                                                                                      |
| R-08  | `ai` gateway + luồng AI trong `course`                                                                                                                                                                              | 7–10 | R-05, R-06  | Chưa bắt đầu                                                                                                                      |
| R-09  | `scheduler`: job `MEDIA_UNUSED_CLEANUP`                                                                                                                                                                             | 8–9  | R-06        | Chưa bắt đầu                                                                                                                      |
| R-10  | Data seeder quy mô lớn cho PostgreSQL                                                                                                                                                                               | 9–10 | R-04, R-05  | Chưa bắt đầu                                                                                                                      |
| R-11  | Test, CI, Postman v2; viết lại regression và job CI `mvp-regression`/`w7-compose` (gỡ ở R-05); đổi tên test `w1/w2/w3/w5` theo nghiệp vụ                                                                            | 8–10 | R-04…R-09   | Chưa bắt đầu                                                                                                                      |
| R-12  | Viết lại docs, viết lại smoke tracing/metrics/logs/acceptance (đang gắn luồng v1), kiểm chứng telemetry xuyên service, danh mục case phức tạp v0; ghi nhận schema kết quả RCA và nơi lưu (cho MCP thứ yếu, ADR-002) | 9–10 | tất cả      | Chưa bắt đầu                                                                                                                      |

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

- Đồng bộ usage media bằng command (`media.*`) → R-06; luồng AI (`ai-documents`, `ai-jobs`) → R-08. `outbox_messages` đã có trong `course_db` cho các producer này.
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
