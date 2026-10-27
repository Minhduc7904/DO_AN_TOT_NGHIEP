# Bảng task refactor LMS — v1

| Trường | Nội dung |
| --- | --- |
| Cửa sổ | W13–W14 (27/10/2026 → 09/11/2026), chạy song song với công việc đề tài |
| Người phụ trách | Đức, làm một mình toàn bộ (code refactor và docs, gồm docs AI/scope); không cần Bách tham gia hay review |
| Quyết định nền | [ADR-001](../../adr/adr-001-restructure-lms-testbed-v1.md), [ADR-002](../../adr/adr-002-ai-primary-root-cause-analysis-v1.md) |
| Quy ước | Mỗi task một nhánh `refactor/week-NN/task-NN-<short-title>` (hoặc `docs/…`) và một PR vào `main` theo [quy tắc Git](../../rules/git-and-pull-request-rules.md) |
| Trạng thái bảng | Đang thực hiện |

## Danh sách task

| Mã | Task | Ngày | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- |
| R-01 | ADR, `service-catalogue-v2`, `http-and-event-contracts-v2`, `data-ownership-v2`; chốt `service.name` | 1–2 | — | Hoàn thành (27/10/2026; Đức xác nhận qua chỉ thị merge trực tiếp, không có review của Bách theo quyết định refactor một người) |
| R-02 | Tách `aiops-platform/observability/`, compose riêng, network external `aiops-net` | 1–2 | — | Hoàn thành (27/10/2026; PR #52) |
| R-03 | Nền tảng: `packages/common`, skeleton service, eslint boundaries, compose LMS (Postgres, RabbitMQ, MinIO, Mailpit), Prisma | 2–3 | R-01 | Hoàn thành (27/10/2026; PR #53, bỏ qua CI theo chỉ thị của Đức, bằng chứng chạy cục bộ bên dưới) |
| R-04 | `auth` (3 role), `student`, `gateway` (bỏ `admin`, ADR-003) | 3–5 | R-03 | Đang thực hiện (`student` xong ở R-03, `auth` xong ở PR #54; còn `gateway`, phải sinh lỗi đúng envelope mới) |
| R-04b | DTO dùng chung trong `contracts`, envelope phản hồi thống nhất (success và lỗi), phân trang nhất quán | 3–5 | R-04 (auth) | Hoàn thành (27/10/2026; PR #55) |
| R-05 | `course`: course/lesson/quiz, enrollment, progress, quiz attempt, export CSV | 4–8 | R-04 | Chưa bắt đầu |
| R-06 | `media` + worker: upload trực tiếp MinIO, thumbnail, usage, job | 5–8 | R-03 | Chưa bắt đầu |
| R-07 | `notification` + worker: single, batch, email thật, inbox REST | 6–9 | R-03, R-04 | Chưa bắt đầu |
| R-08 | `ai` gateway + luồng AI trong `course` | 7–10 | R-05, R-06 | Chưa bắt đầu |
| R-09 | `scheduler`: job `MEDIA_UNUSED_CLEANUP` | 8–9 | R-06 | Chưa bắt đầu |
| R-10 | Data seeder quy mô lớn cho PostgreSQL | 9–10 | R-04, R-05 | Chưa bắt đầu |
| R-11 | Test, CI, Postman v2; đổi tên test `w1/w2/w3/w5` theo nghiệp vụ | 8–10 | R-04…R-09 | Chưa bắt đầu |
| R-12 | Viết lại docs, kiểm chứng telemetry xuyên service, danh mục case phức tạp v0 | 9–10 | tất cả | Chưa bắt đầu |

## Mốc kiểm tra

- **Cuối ngày 2**: ADR + `service-catalogue-v2` được Đức xác nhận; stack observability chạy từ `aiops-platform/` với 8 service cũ.
- **Cuối ngày 5**: auth, student, gateway, course (nửa đầu) xanh test.
- **Cuối ngày 8**: course, media, notification chạy e2e; nếu trượt, báo lại để quyết định cắt gì, không tự cắt.

## Bằng chứng DoD

Mỗi task chỉ chuyển `Hoàn thành` khi output ghi lệnh đã chạy và kết quả tương ứng từng DoD dưới đây. Card chi tiết theo template tuần tạo khi bắt đầu từng task.

| Mã | DoD |
| --- | --- |
| R-01 | Ba tài liệu v2 và hai ADR hoàn chỉnh, link hợp lệ; Đức xác nhận `service.name` và topology |
| R-02 | `docker compose config` hợp lệ cho hai file compose; smoke trace/metric/log còn xanh với 8 service cũ |
| R-03 | `pnpm build/lint/test` xanh; một service mẫu chạy migrate và health |
| R-04 | e2e đăng ký, đăng nhập, refresh; trả 403 khi sai role |
| R-05 | e2e luồng học (enroll, học, quiz); unit test từng use case |
| R-06 | e2e upload trực tiếp lên MinIO, thumbnail `READY`, usage đồng bộ markdown |
| R-07 | Email xuất hiện trong Mailpit; batch partial-failed retry đúng; inbox đọc/đánh dấu được |
| R-08 | e2e với provider giả (HTTP stub); test mã hóa API key |
| R-09 | Job chạy và ghi run; chạy lặp không trùng |
| R-10 | Seed lặp cho cùng fingerprint; ghi thời gian và số dòng |
| R-11 | CI xanh; regression pass; Postman v2 chạy được |
| R-12 | Trace đủ span xuyên service; docs đối chiếu code; danh mục case phức tạp v0 có ground truth |

## Bằng chứng đã chạy

### R-02 (PR #52)

Stack 16 container dựng từ `docker-compose/compose.full.yaml`: 51 span từ 8 runtime, metric kể cả RabbitMQ qua hai network, log có `trace_id`; `reset-and-seed` chạy hai lần cho cùng fingerprint; teardown sạch. Job CI `Testbed MVP regression` từng fail một lần ở acceptance smoke (kịch bản `unavailable`) và pass khi chạy lại; GitGuardian báo false positive trên mật khẩu Grafana mẫu, giống ca W10 PR #41.

### R-03 (chạy cục bộ ngày 27/10/2026, Node 22.13.1, pnpm 11.19.0)

| Hạng mục | Lệnh / kết quả |
| --- | --- |
| Build, lint, format | `pnpm run build`, `pnpm run lint`, `pnpm run format:check` đều xanh |
| Unit `common` | `pnpm --filter @aiops-lms/common test`: 16 test (envelope lỗi, guard role, correlation, circuit breaker, HTTP client, outbox/inbox) |
| Integration `common` | `test/integration/rabbitmq-outbox.integration.mjs` với RabbitMQ 4.1 + PostgreSQL 17 thật: outbox → relay → consumer, inbox chặn xử lý trùng, retry đủ 3 lần, `onFault`, queue `.error`. Chạy lần đầu lộ lỗi consumer thứ hai không khai báo queue; đã sửa trước khi commit |
| Boundary | `pnpm run test:architecture`: 27 test (domain/application cấm `@nestjs/*`, `@prisma/*`, `common/{http,clients,telemetry,messaging,prisma,config}`, adapters; cho phép `common/{errors,ports}`) |
| Service mẫu `student` | Image build bằng `services/student/Dockerfile`; container chạy `prisma migrate deploy`, `GET /ready` báo `postgres: ok`, tạo/đọc student, 401/403/409/400 đúng envelope |
| Hạ tầng | `postgres` tạo DB và role riêng cho student/media/notification/scheduler/ai; `minio-init` tạo 5 bucket; Mailpit trả `/api/v1/info` |
| Generator | `pnpm new-service <name> --port <port>` sinh service build, lint và test được (kiểm bằng service thử, đã xóa) |

Bỏ qua theo chỉ thị: CI GitHub Actions chưa đối chiếu cho nhánh này. Image MinIO chính thức không còn trên Docker Hub/Quay, nên compose dùng `bitnamilegacy/minio` ghim phiên bản (xem ghi chú trong `compose.yaml`).

### R-04b (chạy cục bộ ngày 27/10/2026)

| Hạng mục | Kết quả |
| --- | --- |
| Contract | `lms/contracts/src/http/`: `common` (id, role, phân trang, envelope), `auth`, `student`; kiểu suy ra từ zod |
| Envelope | Success và lỗi cùng bốn khóa `success/data/error/meta`; `ResponseEnvelopeInterceptor` + `AppExceptionFilter` dựng ở một chỗ; `@RawResponse()` cho stream |
| Phân trang | Đầu vào `page`/`page_size` (mặc định 1/20, tối đa 100), đầu ra `meta.pagination { page, page_size, total, total_pages }`; tham số sai trả 400 |
| Test | common 21 test (gồm envelope và Page); e2e auth 6 test và e2e student 4 test với PostgreSQL thật, mọi response parse qua schema của contract; `compose-reset-smoke` đạt với đăng nhập đọc `data.access_token` |
| Hệ quả | Gateway v1 và course/enrollment/... v1 vẫn trả body cũ cho tới khi thay ở R-04…R-08; smoke, CI, Postman, regression đã đổi đọc `data.*` cho phần đăng nhập |
