# Task tuần: Kiểm chứng workflow chấm điểm đến thông báo

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-grade-to-notification-workflow` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức hỗ trợ môi trường Grading/RabbitMQ |
| Ưu tiên | Cao |
| Hạn dự kiến | 26/09/2026 |
| Nhánh thực hiện | `test/week-08/task-03-verify-grade-to-notification-workflow` |

## Yêu cầu và phạm vi

### Cần thực hiện

Kiểm chứng workflow W5 từ nộp bài đã tồn tại đến chấm điểm và Notification: call HTTP Grading→Submission, persistence Grading, publish/consume `grade.completed` qua RabbitMQ. Xác minh topology có cả HTTP và queue, trace async correlation bằng trace context hoặc event ID fallback được ghi rõ. Chạy E2E/integration test có duplicate event và notification slowdown/backlog ở mức MVP.

### Không thực hiện

- Không phát triển thêm business feature LMS, Assignment, email thật hoặc scenario fault ngoài F4.
- Không thay thế việc unit/integration test riêng của Grading/publisher/Notification ở các task 02, 04, 05.
- Không xây experiment runner hoặc ground-truth campaign; thuộc các tuần sau.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-02 consumer/telemetry; task-04 Grading; task-05 publisher; workflow W4 Week 7.
- Người hoặc phần việc cần phối hợp: Đức hỗ trợ Grading, RabbitMQ và điều tra lỗi cross-service.
- Rủi ro/giả định: E2E phải chờ consumer hoàn thành không theo thời gian cố định dễ flaky; timeout phải ghi rõ khi không nhận notification.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| W5 integration/E2E test và assertions topology/correlation | Code | `lms/test/` hoặc vị trí test canonical |
| Báo cáo kết quả và giới hạn fault F4 | Docs / Code | PR và `workspace/bach/.../task-03.../output/task-output.md` |

## Definition of Done

- [ ] Từ dữ liệu sạch, W5 tạo grade cho submission hợp lệ, Notification nhận đúng một notification mô phỏng và các lỗi contract chính trả envelope phù hợp.
- [ ] Test xác nhận HTTP Grading→Submission và RabbitMQ publish/consume cùng xuất hiện; async correlation dùng trace context, hoặc event ID/time fallback được đánh dấu confidence thấp hơn.
- [ ] Test duplicate event chứng minh Notification không phát notification thứ hai; scenario slowdown/backlog mặc định tắt và khi bật tạo được symptom quan sát được.
- [ ] Chuỗi test liên quan chạy ổn định, kết quả/giới hạn môi trường được ghi trong PR hoặc output task.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/output/task-output.md) (mẫu, chưa có báo cáo thực tế).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 27/09/2026 — tạo card và giao cho Bách.
- Ghi chú/tồn đọng: Chỉ chạy sau khi Grading publisher và Notification consumer đã tích hợp; đây là test E2E đầu tiên yêu cầu HTTP + queue topology.
