# Tổng quan tuần 8 — Grading, Notification và async dependency

## Thông tin tuần

| Trường | Nội dung |
| --- | --- |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Nguồn plan canonical | [Plan v0.2 — Tuần 8](../../plan-v0.2-24-weeks.md#tuần-8--grading-notification-và-async-dependency) |
| Mục tiêu tuần | Hoàn thiện workflow W5 `nộp bài → chấm điểm → thông báo` với Grading gọi Submission, event `grade.completed` version hóa, RabbitMQ và telemetry async có correlation. |
| Trạng thái tuần | Đang thực hiện |

## Danh sách task

| Mã task | Task | Người phụ trách | Collaborator | Ưu tiên | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [task-01_define-grade-completed-contract-and-notification-skeleton](task-01_define-grade-completed-contract-and-notification-skeleton.md) | Đặc tả `grade.completed` và dựng skeleton Notification | Bách | Đức rà soát khả năng publisher | Cao | Hoàn thành |
| [task-02_implement-notification-consumer-and-async-telemetry](task-02_implement-notification-consumer-and-async-telemetry.md) | Triển khai consumer Notification, duplicate handling và async telemetry | Bách | Đức rà soát tương thích RabbitMQ/publisher | Cao | Đã giao |
| [task-03_verify-grade-to-notification-workflow](task-03_verify-grade-to-notification-workflow.md) | Kiểm chứng W5 E2E, topology HTTP + queue và fault hook backlog | Bách | Đức hỗ trợ môi trường Grading/RabbitMQ | Cao | Đã giao |
| [task-04_implement-grading-service](task-04_implement-grading-service.md) | Triển khai Grading, persistence riêng và call tới Submission | Đức | Bách rà soát contract/correlation field | Cao | Chờ review |
| [task-05_publish-grade-completed-event](task-05_publish-grade-completed-event.md) | Publish `grade.completed` qua RabbitMQ với reliability/idempotency MVP | Đức | Bách kiểm tra consumer và async trace propagation | Cao | Đã giao |

> Khi đọc tiến độ project-wide, chỉ coi hàng có trạng thái `Hoàn thành` trên nhánh canonical là hoàn thành; trạng thái đã finalization trên task branch chưa thay thế nguồn này.

## Phụ thuộc, rủi ro và quyết định

- Phụ thuộc: Week 7 đã merge đầy đủ vào `main`; Grading phụ thuộc Submission. Task-01 chốt event envelope trước task-05; task-02 phụ thuộc task-01 và publisher task-05; task-03 phụ thuộc task-02, task-04 và task-05.
- Rủi ro: event contract hoặc RabbitMQ header không thống nhất có thể làm mất correlation; delivery at-least-once tạo duplicate; consumer slowdown/backlog phải có fault hook mặc định tắt, không biến Notification thành hệ thống gửi email thật.
- Quyết định cần chốt: Bách nhận các card 01–03 trước để sở hữu contract observability, Notification và W5 E2E; Đức vẫn là primary cho Grading/publisher theo Plan v0.2. Event chỉ dùng tên canonical `grade.completed`, folder contract dùng `grade-completed`.

## Tiêu chí kết thúc tuần

- [ ] W5 `nộp bài → chấm điểm → thông báo` chạy qua Gateway, Grading, Submission, RabbitMQ và Notification.
- [ ] Contract `grade.completed` version hóa, envelope có event ID, producer, occurred time và trace context; publisher/consumer có duplicate handling MVP.
- [ ] HTTP và RabbitMQ publish/consume cùng xuất hiện trong topology, với correlation async kiểm chứng được.
- [ ] Có integration/E2E test W5 và fault hook Notification consumer slowdown/RabbitMQ backlog mặc định tắt.
- [ ] Mỗi task có PR riêng, bằng chứng DoD và trạng thái được cập nhật theo vòng đời task canonical.
