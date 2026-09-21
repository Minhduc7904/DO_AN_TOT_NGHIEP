# Input task: Course service

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-course-service` |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-06_2026-09-06_to_2026-09-12` (triển khai bù từ 21/09/2026) |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 21/09/2026 |
| Thời gian dự kiến | 2–3 ngày làm việc chủ động |
| Nhánh thực hiện | `feat/week-06/task-04-implement-course-service` |
| Pull request dự kiến | Vào `main`, tạo sau khi có code và bằng chứng kiểm thử |

## Mục tiêu và phạm vi

Triển khai Course API create/get/list theo contract v1, persistence độc lập trong `course_db`, migration/seed tái lập, validation, error envelope và health/config. Không triển khai Enrollment, Assignment, Redis cache hoặc E2E qua Gateway trong task này.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí |
| --- | --- | --- |
| Course API, persistence, migration/seed và test | Code | `lms/services/course/` |
| CI kiểm tra PostgreSQL Course | Code | `.github/workflows/ci.yml` |

## Đầu vào và phụ thuộc

- PR task-01 đến task-03 đã merge vào `main`; tham chiếu HTTP contract v1, data ownership matrix và Course scaffold Week 5.
- Bách review HTTP contract, trust boundary và dữ liệu sở hữu.
- PostgreSQL thực cần sẵn sàng để xác minh migration/seed và repository integration.

## Definition of Done

- [ ] Ba endpoint đúng response/error contract v1; validation và quyền instructor cho create được kiểm tra.
- [ ] Migration/seed tạo `course_db` từ trạng thái sạch và chạy lại không nhân bản dữ liệu.
- [ ] Course không đọc DB/source service khác; chỉ nhận principal context qua boundary nội bộ.
- [ ] Unit và PostgreSQL integration tests pass; build, lint, health và CI pass.
- [ ] PR riêng có bằng chứng DoD và URL/trạng thái `Chờ review` được push vào PR head trước review.
