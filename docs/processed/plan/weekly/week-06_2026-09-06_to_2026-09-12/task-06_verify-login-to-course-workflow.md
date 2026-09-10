# Task tuần: Kiểm chứng E2E W1–W2 và telemetry qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-login-to-course-workflow` |
| Tuần | `week-06_2026-09-06_to_2026-09-12` |
| Trạng thái | Đã giao |
| Người phụ trách | Đức |
| Collaborator | Bách chạy độc lập, review trace/metric và contract assertions |
| Ưu tiên | Cao |
| Hạn dự kiến | 12/09/2026 |
| Nhánh thực hiện | `test/week-06/task-06-verify-login-to-course-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Ghép stack Auth/Gateway/Course vào Compose và CI phù hợp, tạo E2E cho W1 login rồi W2 browse course qua Gateway. Kiểm chứng JWT/role, timeout/error path, trace xuyên service và RED/dependency telemetry cơ bản.

### Không thực hiện

- Không triển khai workflow W3–W5, fault injection F1 hoặc observability backend đầy đủ.
- Không sửa business contract để né lỗi tích hợp; sai lệch phải được xử lý ở đúng owner/boundary.
- Không coi test riêng lẻ từng service là bằng chứng thay thế cho E2E qua Gateway.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đến task-05 đã merge; Compose/CI/OTel baseline Week 5.
- Người hoặc phần việc cần phối hợp: Bách chạy W1–W2 độc lập và kiểm tra telemetry đủ field cho analysis.
- Rủi ro/giả định: compose startup/readiness và seed ordering phải deterministic; telemetry backend vắng mặt không được làm service crash ngoài behavior đã tài liệu hóa.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E W1–W2 và telemetry assertions | Code | `lms/test/` hoặc test suite integration canonical |
| Compose/CI/Quick Start cập nhật | Code / Docs | `docker-compose/`, `.github/workflows/` và tài liệu chạy liên quan |

## Definition of Done

- [ ] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, PostgreSQL và Redis theo hướng dẫn không cần bước ngầm.
- [ ] E2E login qua Gateway nhận JWT rồi dùng token browse seeded course qua Gateway; role hợp lệ/không hợp lệ được kiểm tra.
- [ ] E2E bao phủ ít nhất một Auth dependency timeout/error và một Course Redis/PostgreSQL failure behavior với error envelope canonical.
- [ ] Trace W1/W2 giữ W3C context qua Gateway và downstream; HTTP server/client cùng `auth-postgres`, `course-postgres`, `course-redis` signals có assertions phù hợp.
- [ ] CI chạy test cần thiết thành công; Bách chạy độc lập W1–W2 và kết quả/giới hạn được ghi trong PR hoặc output task.

## Liên kết hồ sơ thực hiện

- Input workspace: Chưa tạo — Đức tạo khi nhận task.
- Output workspace: Chưa tạo — Đức tạo khi nhận task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 10/09/2026 — task được giao cho Đức, thực hiện cuối chuỗi Week 6.
- Ghi chú/tồn đọng: Đức cần tự tạo hồ sơ trong `workspace/duc/`; chỉ bắt đầu khi task-01 đến task-05 đã merge vào `main`.
