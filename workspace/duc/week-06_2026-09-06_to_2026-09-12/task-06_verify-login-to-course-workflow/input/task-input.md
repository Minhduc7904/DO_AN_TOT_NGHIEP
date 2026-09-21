# Input task: E2E W1–W2 qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-login-to-course-workflow` |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-06_2026-09-06_to_2026-09-12` (triển khai bù từ 21/09/2026) |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 21/09/2026 |
| Thời gian dự kiến | 2–3 ngày làm việc chủ động |
| Nhánh thực hiện | `test/week-06/task-06-verify-login-to-course-workflow` |
| Pull request dự kiến | Vào `main`, phụ thuộc PR task-04 và task-05 |

## Mục tiêu và phạm vi

Kiểm chứng W1 login rồi W2 browse seeded course qua Gateway từ PostgreSQL/Redis sạch; kiểm tra JWT/role, timeout/error envelope và trace/metrics dependency. Hoàn thiện Compose/CI/Quick Start. Không triển khai W3–W5, fault injector F1 hoặc backend observability đầy đủ.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí |
| --- | --- | --- |
| W1–W2 E2E và telemetry assertions | Code | `lms/test/`, `lms/services/auth/` |
| Fresh Compose và CI smoke | Code/Docs | `docker-compose/`, `.github/workflows/ci.yml`, `lms/README.md` |

## Đầu vào và phụ thuộc

- Nhánh task-06 lấy base từ commit task-05, vốn lấy base từ task-04 theo chỉ thị Đức; PR được review theo chuỗi xếp chồng.
- Bách chạy W1–W2 độc lập, review trace/metrics và contract assertions.
- CI có PostgreSQL, Redis và Docker Compose; local Docker Engine hiện không phản hồi.

## Definition of Done

- [ ] Fresh Compose khởi động Auth/Gateway/Course/PostgreSQL/Redis với migration/seed không cần bước ngầm.
- [ ] E2E login qua Gateway nhận JWT và dùng JWT browse course seed; role hợp lệ/không hợp lệ được kiểm tra.
- [ ] E2E bao phủ Auth timeout và Course Redis/PostgreSQL failure behavior với error envelope canonical.
- [ ] Trace W1/W2 giữ W3C context; HTTP server/client, `auth-postgres`, `course-postgres`, `course-redis` signals có assertions.
- [ ] CI pass; Bách chạy độc lập và ghi kết quả/giới hạn trong PR/output; PR head có URL/trạng thái `Chờ review` trước review.
