# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-03_verify-grade-to-notification-workflow` |
| Tên task | Kiểm chứng workflow chấm điểm đến thông báo |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 12/10/2026 |
| Thời gian dự kiến | 12/10/2026–14/10/2026 (thực hiện bù Week 8) |
| Nhánh thực hiện | `test/week-08/task-03-verify-grade-to-notification-workflow` |
| Pull request dự kiến | PR từ nhánh task vào `main` sau khi hoàn tất work và bằng chứng DoD |

## Mục tiêu và phạm vi

### Task cần làm gì?

Kiểm chứng workflow W5 từ submission đã tồn tại đến tạo grade và Notification nhận event `grade.completed`: Grading gọi Submission qua HTTP, lưu grade, publish qua RabbitMQ và Notification consume/process event. Xác minh topology có đồng thời HTTP và queue, trace async được correlation, duplicate event không tạo notification thứ hai, và fault slowdown/backlog tạo symptom quan sát được ở mức MVP.

### Phạm vi không thực hiện

- Không phát triển thêm business feature LMS, Assignment, email hoặc push notification thật.
- Không thay thế unit/integration test riêng của Grading publisher hoặc Notification consumer đã hoàn thành ở task-02, task-04 và task-05.
- Không mở rộng sang retry/dead-letter production-grade, experiment runner hoặc ground-truth campaign.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| W5 integration/E2E test và assertions topology/correlation | Code | `lms/test/` và các test integration liên quan trong `lms/services/notification/test/` |
| Báo cáo kết quả, giới hạn môi trường và fault F4 | Docs | `workspace/bach/week-08_2026-09-20_to_2026-09-26/task-03_verify-grade-to-notification-workflow/output/task-output.md` và PR của task |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Week 7 workflow W4; Week 8 task-02, task-04 và task-05 đã hoàn thành trên `main`; contract `grade.completed` version 1.
- Người cần phối hợp: Đức hỗ trợ môi trường Grading/RabbitMQ và điều tra lỗi cross-service khi cần.
- Rủi ro hoặc giả định: luồng bất đồng bộ không được chờ bằng thời gian cố định dễ flaky; test phải có timeout rõ ràng và phân biệt trace-context correlation với event-ID/time fallback.

## Definition of Done

- [ ] Từ dữ liệu sạch, W5 tạo grade cho submission hợp lệ, Notification nhận đúng một notification mô phỏng và các lỗi contract chính trả envelope phù hợp.
- [ ] Test xác nhận HTTP Grading→Submission và RabbitMQ publish/consume cùng xuất hiện; async correlation dùng trace context, hoặc event ID/time fallback được đánh dấu confidence thấp hơn.
- [ ] Test duplicate event chứng minh Notification không phát notification thứ hai; scenario slowdown/backlog mặc định tắt và khi bật tạo được symptom quan sát được.
- [ ] Chuỗi test liên quan chạy ổn định, kết quả và giới hạn môi trường được ghi trong PR hoặc output task.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
