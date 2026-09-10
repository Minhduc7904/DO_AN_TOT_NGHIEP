# Task tuần: Triển khai Course API, migration và seed

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-04_implement-course-service` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách review HTTP contract, data ownership và extension point telemetry |
| Ưu tiên | Cao |
| Hạn dự kiến | 11/09/2026 |
| Nhánh thực hiện | `feat/week-06/task-04-implement-course-service` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai Course service ở mức MVP gồm create/get/list, persistence riêng trong `course_db`, migration/seed tái lập, validation/error envelope và health/configuration. Giữ lightweight hexagonal boundary và published HTTP contract v1.

### Không thực hiện

- Không triển khai Enrollment, Assignment hoặc CRUD LMS đầy đủ.
- Không truy cập `auth_db` hay source/entity/repository của service khác.
- Không bổ sung Redis cache hoặc E2E qua Gateway; các phần này thuộc task-05 và task-06.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-03 đã merge theo thứ tự Week 6; service template Week 5; HTTP contract và data ownership matrix.
- Người hoặc phần việc cần phối hợp: Bách review JSON contract và principal context do Gateway cung cấp.
- Rủi ro/giả định: schema Course chỉ chứa field tối thiểu phục vụ W2; ID giữ opaque string tại boundary.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Course API và test | Code | `lms/services/course/` |
| Migration/seed Course | Code | `lms/infrastructure/postgres/` hoặc migration thuộc `lms/services/course/` theo convention đã chốt |

## Definition of Done

- [ ] `POST /api/v1/courses`, `GET /api/v1/courses` và `GET /api/v1/courses/{course_id}` đúng contract v1, validation và error envelope canonical.
- [ ] Migration/seed tạo được `course_db` từ trạng thái sạch và chạy lại theo tài liệu.
- [ ] Course là owner duy nhất của schema/data; không cross-service database hoặc source import.
- [ ] Unit/integration tests bao phủ create/get/list, not-found và validation path; build/health check pass.
- [ ] Service nhận principal context theo trust boundary nhưng không tự remote-introspect Auth.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo — Đức tạo khi nhận task.
- Output workspace: Chưa tạo — Đức tạo khi nhận task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — task được giao cho Đức theo nhóm task sau của Week 6.
- Ghi chú/tồn đọng: Đức cần tự tạo hồ sơ trong `workspace/duc/`; task bắt đầu sau task-03 theo thứ tự nhóm đã yêu cầu.
