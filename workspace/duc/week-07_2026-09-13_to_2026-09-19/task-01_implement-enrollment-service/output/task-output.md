# Output task

## Thông tin hoàn thành

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-enrollment-service` |
| Người phụ trách | Đức |
| Trạng thái | Chờ review |
| Bắt đầu thực tế | 22/09/2026 |
| Hoàn thành thực tế | Chưa hoàn thành — đang chờ `APPROVED` từ Bách, xem [vòng đời task canonical](../../../../../docs/processed/rules/git-and-pull-request-rules.md#vòng-đời-task-canonical). |
| Tổng thời lượng | ~1 phiên làm việc (22/09/2026) |
| Pull request | [#25](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/25) |
| Người review | Bách (chưa review) |
| Kết quả review | Chưa review |

## Báo cáo công việc đã làm

- Scaffold `lms/services/enrollment/` theo đúng kiến trúc hexagonal của Course: `domain/enrollment.ts`, `application/` (service, port `EnrollmentRepository`, port `CourseClient`, các domain error `CourseNotFoundError`/`EnrollmentConflictError`/`EnrollmentDependencyError`), `adapters/` (HTTP controller + module, Postgres repository, Course HTTP client, dependency telemetry, health, exception filter), `config/`, `scripts/migrate.ts`.
- Cài đặt `POST /api/v1/enrollments` (role `student`, gọi Course trước khi ghi `enrollment_db`), `GET /api/v1/enrollments` (student chỉ xem của chính mình; instructor cần `principal_id` hoặc `course_id`), `GET /api/v1/enrollments/check` (internal contract §7.3 cho Submission).
- Migration/seed idempotent: bảng `enrollments` với unique `(principal_id, course_id)`, seed `enrollment-001` = `student-001`/`course-001` khớp ví dụ trong `http-and-event-contracts-v1.md` §7.1.
- Dependency telemetry `enrollment-postgres` (span/metric `enrollment.dependency.*`), theo đúng mẫu `dependency-telemetry.ts` của Course; phân biệt lỗi conflict (unique violation) khỏi lỗi dependency thật để không làm sai lệch `enrollment.dependency.error.count`.
- **Chưa** thêm W3C trace propagation, retry/circuit-breaker hay dependency span cho lời gọi Course — đúng phạm vi "Không thực hiện" của task-01 (dành cho task-02).
- **Chưa** đụng Gateway routing, `docker-compose/`, `.github/workflows/ci.yml`, root `package.json` script `build`/`test`/`lint` dùng chung — theo tiền lệ Week 6 (task-03 verify E2E sẽ thêm).
- Mở PR [#25](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/25) từ `feat/week-07/task-01-implement-enrollment-service` vào `main`, cập nhật card task và `weekly-overview.md` sang `Chờ review`.

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
| Unit và PostgreSQL integration tests pass; build/lint sạch | Đạt | `pnpm --filter @aiops-lms/enrollment build`, `pnpm exec eslint "services/enrollment/**/*.ts" --max-warnings=0`, jest config `services/enrollment/jest.config.ts` (12/12 pass), `pnpm run format:check` toàn repo pass, `pnpm run build` toàn workspace pass (không ảnh hưởng service khác). |
| URL/số PR và `Chờ review` đã commit/push vào PR head trước review | Đạt | Commit cập nhật card/weekly-overview/output nằm trên chính nhánh `feat/week-07/task-01-implement-enrollment-service`, đã push lên PR #25 trước khi yêu cầu Bách review. |
| PR có mô tả đúng template, `APPROVED` từ Bách, completion metadata trước merge | Chưa đạt | Đang chờ Bách review PR #25; finalization sẽ thực hiện sau khi có `APPROVED` hợp lệ, không nằm trong phạm vi output này. |

## Thay đổi, tồn đọng và bước tiếp theo

- Thay đổi so với input: Không có thay đổi phạm vi; toàn bộ DoD input giữ nguyên.
- Việc chưa hoàn thành hoặc trở ngại: Chờ Bách review contract Enrollment↔Course và data ownership; `tools/sync-plan-json-and-timeline.ps1` không chạy được trong môi trường hiện tại (thiếu `pwsh`), timeline JSON/HTML đang chờ đồng bộ — không sửa tay các file sinh tự động.
- Bước tiếp theo: Sau khi PR #25 có `APPROVED`, tạo nhánh task-02 (`feat/week-07/task-02-add-enrollment-resilience-and-propagation`) lấy base từ chính nhánh task-01 (chưa merge, theo chỉ thị Đức); finalization task-01 thực hiện riêng bằng `task-completion-recording` trước merge, không nằm trong phạm vi output này.

> `Hoàn thành thực tế` là thời điểm người phụ trách đã hoàn tất work, DoD, nhận `APPROVED` hợp lệ từ thành viên còn lại và finalization; không ghi merge time. URL/số PR cùng trạng thái **Chờ review** phải được commit/push vào PR head trước review. Sau approval, người phụ trách dùng `task-completion-recording` để cập nhật hồ sơ và chuyển **Hoàn thành** trên chính branch/PR trước khi tự merge. Task chỉ canonically hoàn thành khi commit đó vào nhánh canonical. `Chờ xử lý` chỉ dùng cho blocker/dependency thực sự, không dùng chỉ vì PR đang chờ merge.
