# Task tuần: Đặc tả `grade.completed` và dựng skeleton Notification

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-grade-completed-contract-and-notification-skeleton` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Chờ review |
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

- [ ] Contract version 1 xác định event ID, name `grade.completed`, schema version, occurred time UTC, producer, payload và trace-context headers; có validation/fixture tương ứng.
- [ ] Notification skeleton khởi động được với health/config rõ ràng và dùng contract fixture mà không truy cập database/source của Grading.
- [ ] Đức đã rà soát field publisher/consumer; mọi điểm chưa chốt được ghi rõ trong PR hoặc card task, không tự tạo event name khác.
- [ ] Input workspace và task card chỉ rõ sản phẩm, dependency và nhánh riêng; PR dùng template bắt buộc khi được tạo.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-01_define-grade-completed-contract-and-notification-skeleton/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-01_define-grade-completed-contract-and-notification-skeleton/output/task-output.md) (mẫu, chưa có báo cáo thực tế).
- Pull request: [#31](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/31).
- Kết quả review: Chưa review; đang chờ Đức rà soát compatibility publisher của Grading.

## Cập nhật tiến độ

- Cập nhật gần nhất: 28/09/2026 — PR [#31](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/31) đã được tạo từ nhánh task và sẵn sàng để Đức review.
- Ghi chú/tồn đọng: Chờ Đức xác nhận field publisher/consumer; publisher thật vẫn là dependency của consumer hoàn chỉnh ở task-02.
