# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-grade-completed-contract-and-notification-skeleton` |
| Tên task | Đặc tả `grade.completed` và dựng skeleton Notification |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 27/09/2026 |
| Thời gian dự kiến | 20/09/2026–21/09/2026 |
| Nhánh thực hiện | `feat/week-08/task-01-define-grade-completed-contract-and-notification-skeleton` |
| Pull request dự kiến | PR từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tạo contract version 1 cho `grade.completed`, gồm envelope và correlation fields canonical; dựng Notification skeleton consume fixture với health/config RabbitMQ rõ ràng. Đức rà soát khả năng tương thích để publisher Grading ở task-05 dùng cùng contract.

### Phạm vi không thực hiện

- Không code Grading/publisher thật, consumer processing đầy đủ hoặc full E2E.
- Không gửi email thật, không thêm persistence Notification không cần thiết.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Contract/fixture `grade.completed` v1 | Docs / Code | `lms/contracts/events/grade-completed/` |
| Notification skeleton | Code | `lms/services/notification/` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: Submission Week 7 đã merge; backend blueprint §§8–9; implementation backlog B06.
- Người cần phối hợp: Đức rà soát field publisher/consumer.
- Rủi ro hoặc giả định: không chứa JWT, PII, ground-truth label; chỉ dùng event name `grade.completed`.

## Definition of Done

- [ ] Contract version 1 có event ID, name, schema version, occurred time UTC, producer, payload và trace context; có validation/fixture.
- [ ] Notification skeleton chạy health/config rõ ràng, consume fixture theo contract và không cross-service database/source import.
- [ ] Đức đã rà soát field publisher/consumer; điểm chưa chốt được ghi trong PR/card task.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
