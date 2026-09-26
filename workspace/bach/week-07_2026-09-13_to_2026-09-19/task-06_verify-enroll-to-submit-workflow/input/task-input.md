# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-06_verify-enroll-to-submit-workflow` |
| Tên task | Kiểm chứng E2E login → enroll → nộp bài qua Gateway |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-07_2026-09-13_to_2026-09-19` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 26/09/2026 |
| Thời gian dự kiến | Bắt đầu thiết lập 26/09/2026; hạn canonical 19/09/2026 đã qua và chưa tự thay đổi kế hoạch |
| Nhánh thực hiện | `test/week-07/task-06-verify-enroll-to-submit-workflow` |
| Pull request dự kiến | Tạo từ nhánh task vào `main` khi đã có bằng chứng DoD |

## Mục tiêu và phạm vi

### Task cần làm gì?

Ghép Auth, Gateway, Course, Enrollment, Submission và Storage Mock vào Compose/CI để kiểm chứng E2E luồng `login → enroll → nộp bài` qua Gateway. Kiểm tra JWT/role, một nhánh lỗi `Enrollment→Course`, một nhánh lỗi `Submission→storage`, W3C trace-context xuyên toàn bộ luồng và RED/dependency telemetry cơ bản.

### Phạm vi không thực hiện

Không triển khai Grading, Notification hoặc fault injector F1 đầy đủ của Week 8; không sửa business contract để né lỗi tích hợp; không dùng các test service đơn lẻ thay cho bằng chứng E2E qua Gateway. Thiết lập hiện tại chỉ tạo hồ sơ và nhánh, chưa triển khai hay chạy task chính.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| E2E login → enroll → nộp bài và telemetry assertions | Code | `lms/test/` hoặc test suite integration canonical |
| Compose, CI và Quick Start cập nhật nếu cần | Code / Docs | `docker-compose/`, `.github/workflows/` và tài liệu chạy liên quan |
| Pull request task | GitHub | Tạo từ nhánh task vào `main` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 đến task-05 Week 7 đã merge vào `main`; Compose/CI/OTel baseline Week 5–6; [card task tuần](../../../../../docs/processed/plan/weekly/week-07_2026-09-13_to_2026-09-19/task-06_verify-enroll-to-submit-workflow.md).
- Người cần phối hợp: Đức chạy độc lập luồng đầy đủ và review trace, metric cùng contract assertions khi PR sẵn sàng review.
- Rủi ro hoặc giả định: Compose startup/readiness và seed ordering phải deterministic; Storage Mock vắng mặt hoặc lỗi không làm service crash ngoài behavior đã tài liệu hóa; Week 8 đang được Bách trì hoãn theo yêu cầu trực tiếp ngày 26/09/2026.
- Thiết lập môi trường hiện tại: `lms/node_modules` và `docker-compose/.env` đã tồn tại; Node.js đã chuyển sang `22.13.1`, Docker Engine `29.3.1` và Docker Compose `v5.1.1` đã xác minh truy cập được. Chưa chạy task chính. `lms/node_modules/.modules.yaml` ghi nhận dependency đã cài bằng pnpm `11.19.0`, nhưng lệnh Corepack trong hướng dẫn hiện trả pnpm `10.9.2`; cần xử lý sai lệch launcher này trước khi cài lại dependency từ trạng thái sạch.

## Definition of Done

- [ ] Từ trạng thái sạch, migration/seed và Compose khởi động Auth, Gateway, Course, Enrollment, Submission, Storage Mock và PostgreSQL theo hướng dẫn không cần bước ngầm.
- [ ] E2E login qua Gateway nhận JWT, dùng token enroll vào seeded course rồi nộp bài qua Gateway; role hợp lệ và không hợp lệ được kiểm tra.
- [ ] E2E bao phủ ít nhất một `Enrollment→Course` failure và một `Submission→storage` failure với error envelope canonical.
- [ ] Trace giữ W3C context qua Gateway và toàn bộ downstream; HTTP server/client cùng `enrollment-postgres`, `enrollment→course`, `submission→enrollment`, `submission→storage` có assertions phù hợp.
- [ ] CI chạy các test cần thiết thành công; Đức chạy độc lập và kết quả hoặc giới hạn được ghi trong PR hoặc output task.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi Đức bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ Đức trên GitHub và completion metadata được commit/push vào chính PR trước khi Bách merge.
