# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_implement-enrollment-service` |
| Tên task | Triển khai Enrollment service, migration/seed và call tới Course |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 22/09/2026 |
| Thời gian dự kiến | 1 ngày làm việc |
| Nhánh thực hiện | `feat/week-07/task-01-implement-enrollment-service` |
| Pull request dự kiến | Sẽ tạo sau khi hoàn tất code + test |

## Mục tiêu và phạm vi

### Task cần làm gì?

Triển khai Enrollment service ở mức MVP tại `lms/services/enrollment/`: tạo enrollment (student ghi danh vào course), liệt kê enrollment theo student hoặc course, endpoint `GET /api/v1/enrollments/check` phục vụ Submission sau này, persistence riêng trong `enrollment_db`, migration/seed tái lập. Enrollment gọi Course qua HTTP (`GET /api/v1/courses/{course_id}`) để xác nhận course tồn tại trước khi tạo enrollment, không đọc `course_db` trực tiếp.

### Phạm vi không thực hiện

- Không triển khai Submission hoặc gọi Submission (thuộc task-04 của Bách).
- Không đọc `course_db`, `auth_db` hay source/entity/repository của service khác.
- Không thêm resilience nâng cao (retry/circuit-breaker), W3C trace-context propagation chi tiết hay dependency span cho lời gọi Course (thuộc task-02).
- Không sửa Gateway, `docker-compose/`, `.github/workflows/ci.yml` hay root `package.json` script `build`/`test`/`lint` dùng chung (theo tiền lệ Week 6, các phần này thuộc task-03 verify E2E).

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Enrollment API, call tới Course, migration/seed và test | Code | `lms/services/enrollment/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Course service (task-04/05 Week 6) đã merge vào `main`; HTTP contract v1 (`docs/processed/architecture/http-and-event-contracts-v1.md` §7); data ownership matrix (`docs/processed/architecture/data-ownership-and-fault-matrix-v1.md`); Gateway/Auth (task-01/02 Week 6) đã merge.
- Người cần phối hợp: Bách review HTTP contract Enrollment↔Course và data ownership `enrollment_db` (khi Bách rảnh trở lại).
- Rủi ro hoặc giả định: schema Enrollment chỉ chứa field tối thiểu (`principal_id`, `course_id`, `created_at`); ID giữ opaque string tại boundary, khớp quy ước Course Week 6; môi trường thực thi không có `pwsh` nên `tools/sync-plan-json-and-timeline.ps1` không chạy được — timeline sẽ ghi nhận đang chờ đồng bộ, giống ngoại lệ đã dùng ở Week 6 (`task-03_verify-login-workflow.md`).

## Definition of Done

- [ ] Endpoint tạo enrollment và liệt kê enrollment đúng response/error contract canonical, validation và quyền được kiểm tra.
- [ ] Enrollment gọi Course qua HTTP để xác nhận course tồn tại trước khi tạo enrollment; course không tồn tại trả lỗi rõ ràng theo error envelope canonical.
- [ ] Migration/seed tạo `enrollment_db` từ trạng thái sạch và chạy lại không nhân bản dữ liệu.
- [ ] Enrollment là owner duy nhất của schema/data; không cross-service database hoặc source import (xác minh bằng `architecture/no-cross-service-imports`).
- [ ] Unit và PostgreSQL integration tests pass; build và lint sạch cho `@aiops-lms/enrollment`.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc; verdict `APPROVED` hợp lệ từ Bách và completion metadata sẽ được xử lý ở bước finalization riêng, không thuộc phạm vi input này.
