# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-enrollment-service` |
| Người phụ trách | Đức |
| Trạng thái | Hoàn thành theo ngoại lệ review |
| Bắt đầu thực tế | 22/09/2026 |
| Hoàn thành thực tế | 22/09/2026 11:49 ICT |
| Tổng thời lượng | ~1 phiên làm việc (22/09/2026) |
| Pull request | [#25](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/25) |
| Người review | Đức tự review thay Bách (Bách không thể review) |
| Kết quả review | Đạt theo ngoại lệ workflow, xác nhận trực tiếp ngày 22/09/2026 bởi người phụ trách: Bách không thể review nên Đức tự thực hiện review thay Bách (xem các phát hiện/sửa lỗi ở mục "Báo cáo công việc đã làm"); không có submission `APPROVED` trên GitHub và không có review độc lập từ Bách — đây là xác nhận của chính người phụ trách, không phải verdict GitHub. |

## Báo cáo công việc đã làm

- Scaffold `lms/services/enrollment/` theo đúng kiến trúc hexagonal của Course: `domain/enrollment.ts`, `application/` (service, port `EnrollmentRepository`, port `CourseClient`, các domain error `CourseNotFoundError`/`EnrollmentConflictError`/`EnrollmentDependencyError`), `adapters/` (HTTP controller + module, Postgres repository, Course HTTP client, dependency telemetry, health, exception filter), `config/`, `scripts/migrate.ts`.
- Cài đặt `POST /api/v1/enrollments` (role `student`, gọi Course trước khi ghi `enrollment_db`), `GET /api/v1/enrollments` (student chỉ xem của chính mình; instructor cần `principal_id` hoặc `course_id`), `GET /api/v1/enrollments/check` (internal contract §7.3 cho Submission).
- Migration/seed idempotent: bảng `enrollments` với unique `(principal_id, course_id)`, seed `enrollment-001` = `student-001`/`course-001` khớp ví dụ trong `http-and-event-contracts-v1.md` §7.1.
- Dependency telemetry `enrollment-postgres` (span/metric `enrollment.dependency.*`), theo đúng mẫu `dependency-telemetry.ts` của Course; phân biệt lỗi conflict (unique violation) khỏi lỗi dependency thật để không làm sai lệch `enrollment.dependency.error.count`.
- **Chưa** thêm W3C trace propagation, retry/circuit-breaker hay dependency span cho lời gọi Course — đúng phạm vi "Không thực hiện" của task-01 (dành cho task-02).
- **Chưa** đụng Gateway routing, `docker-compose/`, `.github/workflows/ci.yml`, root `package.json` script `build`/`test`/`lint` dùng chung — theo tiền lệ Week 6 (task-03 verify E2E sẽ thêm).
- Mở PR [#25](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/25) từ `feat/week-07/task-01-implement-enrollment-service` vào `main`, cập nhật card task và `weekly-overview.md` sang `Chờ review`.
- Tự review lại (self-review) sau khi chuyển `Chờ review`, phát hiện và sửa qua commit `76c7c90`: `GET /api/v1/enrollments/check` sai yêu cầu header `x-principal-*` (contract §2.3 mục 3 quy định call service-to-service này không bắt buộc header); endpoint `GET /api/v1/enrollments` (list) chưa có trong contract catalogue (đã bổ sung mục 7.4); Enrollment chưa được wire vào `build`/`lint`/`test` gốc và CI (`.github/workflows/ci.yml`) dù là sản phẩm kỳ vọng của task — đã wire `test:enrollment:postgres` và cập nhật CI.

## Sản phẩm thực tế

| Sản phẩm | Loại | Link hoặc đường dẫn |
| --- | --- | --- |
| Enrollment service (API, migration/seed, test) | Code | [lms/services/enrollment/](../../../../../lms/services/enrollment/) |
| Pull request | Code | [PR #25](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/25) |

## Đối chiếu Definition of Done

| Điều kiện từ input | Kết quả | Bằng chứng |
| --- | --- | --- |
| Endpoint tạo/liệt kê enrollment đúng response/error contract canonical, validation và quyền được kiểm tra | Đạt | `test/unit/enrollment.controller.spec.ts` (401/403/400/201/404/409, error envelope `code`/`details`); 12/12 test pass cục bộ. |
| Enrollment gọi Course qua HTTP để xác nhận course tồn tại; course không tồn tại trả lỗi rõ ràng | Đạt | `CourseHttpClient.exists()` + `EnrollmentService.create()`; test `returns 404 when the referenced course does not exist`. |
| Migration/seed tạo `enrollment_db` từ trạng thái sạch, chạy lại không nhân bản dữ liệu | Đạt | `services/enrollment/test/postgres-integration.mjs` chạy 2 lần migration liên tiếp (idempotency check) trên container `postgres:17.6-alpine` cục bộ, log "Enrollment PostgreSQL migration, seed và repository integration đạt." |
| Enrollment là owner duy nhất của schema/data; không cross-service database hoặc source import | Đạt | `node test/eslint-boundaries.test.mjs` (rule `architecture/no-cross-service-imports`) pass cho toàn workspace bao gồm `services/enrollment`; Enrollment chỉ kết nối `ENROLLMENT_DATABASE_URL`, không import từ `services/course` hay `services/auth`. |
| Unit và PostgreSQL integration tests pass; build/lint sạch; CI kiểm tra PostgreSQL Enrollment | Đạt | Sau commit `76c7c90`: `pnpm run build`/`pnpm run lint`/`pnpm run format:check` toàn workspace pass (đã bao gồm Enrollment); `services/enrollment/jest.config.ts` 13/13 pass; `pnpm run test:enrollment:postgres` pass trên container `postgres:17.6-alpine` cục bộ; `.github/workflows/ci.yml` job `quality` đã chạy `test:enrollment:postgres`. |
| URL/số PR và `Chờ review` đã commit/push vào PR head trước review | Đạt | Commit cập nhật card/weekly-overview/output nằm trên chính nhánh `feat/week-07/task-01-implement-enrollment-service`, đã push lên PR #25 trước khi yêu cầu Bách review. |
| PR có mô tả đúng template, `APPROVED` từ Bách, completion metadata trước merge | Đạt theo ngoại lệ đã xác nhận | PR #25 dùng template; GitHub không có submission `APPROVED` vì Bách không thể review. Đức tự thực hiện review thay Bách (commit fix `76c7c90`) và xác nhận trực tiếp ngày 22/09/2026 chấp nhận bỏ qua cổng GitHub `APPROVED`; completion metadata được commit/push trên PR head trước merge. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có thay đổi phạm vi; toàn bộ DoD input giữ nguyên.
- Việc chưa hoàn thành hoặc trở ngại: Bách không thể review (theo xác nhận của người phụ trách ngày 22/09/2026) nên không có `APPROVED` GitHub — Đức tự thực hiện review thay Bách theo ngoại lệ đã xác nhận; `tools/sync-plan-json-and-timeline.ps1` không chạy được trong môi trường hiện tại (thiếu `pwsh`), timeline JSON/HTML đang chờ đồng bộ — không sửa tay các file sinh tự động.
- Bước tiếp theo: Finalization theo ngoại lệ đã hoàn tất trong output này; người phụ trách (Đức) merge PR #25 vào `main`.

> Ngoại lệ workflow: GitHub không ghi nhận `APPROVED` vì Bách không thể review. Người phụ trách (Đức) xác nhận trực tiếp ngày 22/09/2026 rằng Đức đã tự thực hiện review thay Bách và chấp nhận bỏ qua cổng GitHub `APPROVED` để finalization. Không diễn giải ngoại lệ này thành GitHub approval hay review độc lập từ Bách. `Hoàn thành thực tế` là thời điểm work, DoD và finalization đã hoàn tất; không ghi merge time.
