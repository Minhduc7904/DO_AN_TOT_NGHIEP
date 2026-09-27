# Task tuần: Đặc tả `grade.completed` và dựng skeleton Notification

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-grade-completed-contract-and-notification-skeleton` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Hoàn thành |
| Người phụ trách | Bách |
| Collaborator | Đức rà soát khả năng publisher của Grading |
| Ưu tiên | Cao |
| Hạn dự kiến | 21/09/2026 |
| Nhánh thực hiện | `feat/week-08/task-01-define-grade-completed-contract-and-notification-skeleton` |

## Yêu cầu và phạm vi

### Cần thực hiện

Đặc tả contract version đầu tiên cho event canonical `grade.completed` tại `lms/contracts/events/grade-completed/`, gồm event ID, event name, schema version, occurred time UTC, producer, payload tối thiểu và trace context. Dựng Notification service skeleton có health/config/RabbitMQ boundary để consume fixture theo contract; chốt field correlation cùng Đức trước khi publisher được triển khai.

### Không thực hiện

- Không triển khai Grading, database Grading hoặc publisher thật; thuộc task-04 và task-05 của Đức.
- Không gửi email/push notification thật, không thêm persistence Notification khi chưa có nhu cầu MVP.
- Không triển khai consumer processing hoàn chỉnh, duplicate handling hay E2E; thuộc task-02 và task-03.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: Week 7 Submission đã merge; backend blueprint §§8–9 và implementation backlog B06.
- Người hoặc phần việc cần phối hợp: Đức rà soát contract để Grading publisher triển khai tương thích ở task-05.
- Rủi ro/giả định: event payload chỉ chứa định danh/grade cần thiết, không mang JWT, PII hoặc ground-truth label; event name không có biến thể song song.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Event contract `grade.completed` version 1 | Docs / Code | `lms/contracts/events/grade-completed/` |
| Notification service skeleton và cấu hình RabbitMQ | Code | `lms/services/notification/` |

## Definition of Done

- [x] Contract version 1 xác định event ID, name `grade.completed`, schema version, occurred time UTC, producer, payload và trace-context headers; có validation/fixture tương ứng.
- [x] Notification skeleton khởi động được với health/config rõ ràng và dùng contract fixture mà không truy cập database/source của Grading.
- [x] Field publisher/consumer đã được rà soát kỹ thuật theo ủy quyền của Đức; không tạo event name song song.
- [x] Input workspace và task card chỉ rõ sản phẩm, dependency và nhánh riêng; PR dùng template bắt buộc khi được tạo.
- [x] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi review.
- [x] Ngoại lệ theo xác nhận trực tiếp của Bách: completion metadata được commit/push vào chính PR trước merge dù chưa có verdict GitHub `APPROVED`; không coi đây là GitHub approval.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-01_define-grade-completed-contract-and-notification-skeleton/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-01_define-grade-completed-contract-and-notification-skeleton/output/task-output.md).
- Pull request: [#31](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/31).
- Kết quả review: Rà soát kỹ thuật hoàn tất theo ủy quyền của Đức do Bách xác nhận; **chưa có verdict GitHub `APPROVED`**.

## Cập nhật tiến độ

- Cập nhật gần nhất: 28/09/2026 — rà soát và sửa contract theo tài liệu canonical; finalization theo ngoại lệ do Bách yêu cầu.
- Ghi chú/tồn đọng: Task đã sẵn sàng merge theo xác nhận ngoại lệ của Bách. GitHub chưa có `APPROVED` hợp lệ từ Đức; publisher thật vẫn là dependency của consumer hoàn chỉnh ở task-02.
