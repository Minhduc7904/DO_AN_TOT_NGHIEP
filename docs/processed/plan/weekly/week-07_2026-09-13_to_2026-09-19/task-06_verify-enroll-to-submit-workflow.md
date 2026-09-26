# Task tuần: Kiểm chứng E2E login → enroll → nộp bài qua Gateway

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-enroll-to-submit-workflow` |
| Tuần | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Bách |
| Collaborator | Đức chạy độc lập, review trace/metric và contract assertions |
| Ưu tiên | Trung bình |
| Hạn dự kiến | 19/09/2026 |
| Nhánh thực hiện | `test/week-07/task-06-verify-enroll-to-submit-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Ghép Auth/Gateway/Course/Enrollment/Submission/storage mock vào Compose và CI phù hợp, tạo E2E cho luồng đầy đủ `login → enroll → nộp bài` qua Gateway. Kiểm chứng JWT/role, timeout/error path (ít nhất một Enrollment→Course và một Submission→storage failure), trace xuyên toàn bộ service và RED/dependency telemetry cơ bản.

### Không thực hiện

- Không triển khai Grading, Notification hoặc fault injection F1 đầy đủ; các phần này thuộc Week 8.
- Không sửa business contract để né lỗi tích hợp; sai lệch phải được xử lý ở đúng owner/boundary.
- Không coi test riêng lẻ từng service (task-01 đến task-05) là bằng chứng thay thế cho E2E qua Gateway.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 đến task-05 đã merge vào `main`; Compose/CI/OTel baseline Week 5–6.
- Người hoặc phần việc cần phối hợp: Đức chạy độc lập luồng đầy đủ và kiểm tra telemetry đủ field cho phân tích sau này.
- Rủi ro/giả định: compose startup/readiness và seed ordering (Auth, Course, Enrollment, Submission, storage mock) phải deterministic; storage mock vắng mặt hoặc lỗi không được làm service crash ngoài behavior đã tài liệu hóa.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E login → enroll → nộp bài và telemetry assertions | Code | `lms/test/` hoặc test suite integration canonical |
| Compose/CI/Quick Start cập nhật | Code / Docs | `docker-compose/`, `.github/workflows/` và tài liệu chạy liên quan |

## Definition of Done

- [ ] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, Enrollment, Submission, storage mock và PostgreSQL theo hướng dẫn không cần bước ngầm.
- [ ] E2E login qua Gateway nhận JWT, dùng token enroll vào seeded course rồi nộp bài qua Gateway; role hợp lệ/không hợp lệ được kiểm tra.
- [ ] E2E bao phủ ít nhất một Enrollment→Course failure và một Submission→storage failure behavior với error envelope canonical.
- [ ] Trace giữ W3C context qua Gateway và toàn bộ downstream; HTTP server/client cùng `enrollment-postgres`, `enrollment→course`, `submission→enrollment`, `submission→storage` signals có assertions phù hợp.
- [ ] CI chạy test cần thiết thành công; Đức chạy độc lập và kết quả/giới hạn được ghi trong PR hoặc output task.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-07_2026-09-13_to_2026-09-19/task-06_verify-enroll-to-submit-workflow/input/task-input.md).
- Output workspace: Chưa tạo — Bách tạo khi nhận task.
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

> URL/số PR và `Chờ review` phải được commit/push vào PR head trước review. Thành viên còn lại phải gửi `APPROVED` hợp lệ trên GitHub; sau đó người phụ trách finalization metadata, ghi `Hoàn thành` trên chính branch/PR và tự merge task của mình. Card chỉ canonically hoàn thành khi commit đó vào nhánh canonical; xem [vòng đời task canonical](../../../rules/git-and-pull-request-rules.md#vòng-đời-task-canonical).

## Cập nhật tiến độ

- Cập nhật gần nhất: 21/09/2026 — task được giao cho Bách theo yêu cầu chia task tuần 7; thực hiện cuối chuỗi tuần 7, sau khi cả Enrollment và Submission đã merge.
- Cập nhật gần nhất: 26/09/2026 — Bách yêu cầu bắt đầu lại task-06 sau khi trì hoãn Week 8; đã tạo nhánh riêng và hồ sơ input. Chưa thực hiện thay đổi substantive, test E2E hoặc tạo PR.
- Ghi chú/tồn đọng: task-01 đến task-05 đã merge vào `main`; task-06 có thể bắt đầu khi Bách sẵn sàng thực hiện phần E2E.
