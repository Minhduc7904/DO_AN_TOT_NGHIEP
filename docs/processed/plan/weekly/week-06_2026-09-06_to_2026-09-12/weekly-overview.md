# Tổng quan tuần 6 — Gateway, Auth và Course

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Nguồn plan canonical | [Plan v0.2 — Tuần 6](../../plan-v0.2-24-weeks.md#tuần-6--gateway-auth-course) |
| Mục tiêu tuần | Hoàn thiện hai workflow W1 `login` và W2 `browse course` qua Gateway, có persistence/cache, kiểm thử tích hợp và telemetry cơ bản. |
| Trạng thái tuần | Đang thực hiện |

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_implement-auth-service](task-01_implement-auth-service.md) | Triển khai Auth service, migration, seed và phát JWT | Bách | Đức | Cao | Đã giao |
| [task-02_implement-api-gateway](task-02_implement-api-gateway.md) | Triển khai Gateway, xác thực JWT cục bộ và error handling | Bách | Đức | Cao | Đã giao |
| [task-03_verify-login-workflow](task-03_verify-login-workflow.md) | Kiểm chứng contract và workflow W1 qua Gateway | Bách | Đức | Cao | Đã giao |
| [task-04_implement-course-service](task-04_implement-course-service.md) | Triển khai Course API, migration và seed | Đức | Bách | Cao | Đã giao |
| [task-05_add-course-cache-and-telemetry](task-05_add-course-cache-and-telemetry.md) | Bổ sung Redis cache và telemetry dependency cho Course | Đức | Bách | Cao | Đã giao |
| [task-06_verify-login-to-course-workflow](task-06_verify-login-to-course-workflow.md) | Kiểm chứng E2E W1–W2 và telemetry qua Gateway | Đức | Bách | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: Week 5 phải cung cấp service template, Compose, OpenTelemetry bootstrap và CI baseline. Thứ tự thực hiện là task-01 → task-02 → task-03, sau đó task-04 → task-05 → task-06; task sau chỉ bắt đầu khi PR của task phụ thuộc đã merge vào `main`.
- Rủi ro: Week 5 còn task chưa canonically hoàn thành trên `main`; thời gian Week 6 còn ngắn; contract JWT, database isolation hoặc cache semantics không thống nhất có thể làm chậm tích hợp.
- Quyết định cần chốt: Week 6 hoán đổi vai trò theo xác nhận của Bách ngày 10/09/2026 — Bách nhận ba task đầu thuộc Auth/Gateway/W1, Đức nhận ba task sau thuộc Course/cache/E2E. Việc hoán đổi không thay đổi deliverable hoặc milestone M2 trong plan canonical.

## Tiêu chí kết thúc tuần

- [ ] W1 `Client → Gateway → Auth → auth_db → JWT` chạy qua contract canonical; Gateway xác minh JWT cục bộ và role cơ bản.
- [ ] W2 `Client → Gateway → Course → Redis/PostgreSQL` chạy qua contract canonical; Course là owner duy nhất của `course_db` và cache key.
- [ ] Migration/seed của Auth và Course chạy lại được từ môi trường sạch, không dùng chung database schema giữa service.
- [ ] Integration/E2E tests cho W1 và W2 pass; timeout và error envelope có kiểm tra.
- [ ] HTTP server/client cùng Redis/PostgreSQL telemetry cần thiết xuất hiện, giữ trace context và không chứa secret, JWT hoặc PII.
- [ ] Mỗi task có PR riêng, bằng chứng DoD và trạng thái đúng vòng đời review canonical.
