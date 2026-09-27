# Event contract `grade.completed` v1

## Mục đích

Grading publish event này sau khi chấm điểm thành công. Notification consume event để tạo notification mô phỏng; event không mang JWT, thông tin liên hệ hay nhãn ground truth.

## Routing RabbitMQ

| Trường               | Giá trị                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Exchange             | `lms.events`                                                           |
| Routing key          | `grade.completed`                                                      |
| Queue Notification   | `notification.grade-completed.v1`                                      |
| Delivery expectation | At-least-once; consumer phải xử lý duplicate bằng `event_id` ở task 02 |

## Envelope

Schema thực thi và fixture canonical được export bởi package `@aiops-lms/contracts`:

- `event_id`: UUID ổn định cho mỗi event;
- `event_name`: cố định là `grade.completed`;
- `schema_version`: cố định là `1`;
- `occurred_at`: UTC ISO-8601;
- `producer`: định danh phiên bản Grading;
- `payload`: `grade_id`, `submission_id`, `score`, `graded_at`;
- `trace_context`: W3C `traceparent` và `tracestate` nếu có.

Không dùng `grade-completed` làm tên event. Dấu gạch nối chỉ được dùng ở tên thư mục contract.

## Compatibility

Version 1 là strict schema. Mọi thay đổi bắt buộc, đổi ý nghĩa field hoặc đổi routing key phải có version schema/event contract mới và tương thích consumer được xác nhận trước khi publish.
