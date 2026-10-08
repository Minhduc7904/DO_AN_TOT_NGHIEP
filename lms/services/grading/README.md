# Grading service

Grading tạo và đọc grade hoàn tất cho một Submission. Service sở hữu `grading_db`, không đọc `submission_db` hay import source của Submission; việc xác nhận Submission luôn đi qua HTTP `GET /api/v1/submissions/{submission_id}`.

## API

- `POST /api/v1/grades` — chỉ `instructor`; body `{ "submission_id", "score" }` với `score` trong `[0, 100]` và tối đa 4 chữ số thập phân (khớp `numeric(7,4)`, vượt thì `400`). Trả `201` với `{ id, submission_id, score, completed_at }`; `404` nếu Submission không tồn tại, `409` nếu Submission đã có grade (grade là create-only), `503`/`504` khi Submission hoặc PostgreSQL lỗi/quá hạn.
- `GET /api/v1/grades/{grade_id}` — `instructor` đọc mọi grade; `student` chỉ đọc grade của chính mình (người khác nhận `403`).
- `GET /health`.

Mỗi grade mới còn phát event `grade.completed` v1 (xem mục "Publish `grade.completed`"). Khi event chưa publish được, `POST` trả `503 DEPENDENCY_UNAVAILABLE` ("Grade đã được lưu nhưng event chưa publish; hệ thống sẽ tự thử lại") dù grade đã được lưu.

Request cần `x-principal-id` và `x-principal-role` do Gateway tạo từ JWT. Lời gọi nội bộ sang Submission không mang Bearer JWT hay principal header, chỉ propagate W3C trace context.

## Publish `grade.completed`

Thiết kế MVP, delivery **at-least-once**:

- Publication state nằm ngay trong bảng `grades` (không có outbox riêng): `event_id` (UUID duy nhất, sinh một lần cùng lúc insert), `publish_status` (`pending` | `published`), `publish_attempts`, `last_publish_error_code`, `published_at`. Grade mới được insert với `pending`; grade có sẵn trước migration được coi là lịch sử (`published`) và không bao giờ bị phát lại.
- `POST /api/v1/grades` insert grade rồi publish ngay một lần. Broker xác nhận (publisher confirm) thì đánh dấu `published` và trả `201`. Nếu publish lỗi hoặc quá `GRADING_PUBLISH_CONFIRM_TIMEOUT_MS` thì grade vẫn tồn tại ở `pending`, request trả `503`, `GET` vẫn đọc được grade và `POST` lại cùng Submission vẫn là `409`; client không phải kích hoạt retry.
- Worker nền (sau khi Nest bootstrap) cứ `GRADING_EVENT_RETRY_INTERVAL_MS` lấy tối đa `GRADING_EVENT_RETRY_BATCH_SIZE` grade `pending` theo `completed_at`, `id` rồi publish tuần tự, mỗi row một lần mỗi vòng, retry không giới hạn và luôn dùng lại cùng `event_id`/payload/`occurred_at`. Vòng dừng sớm khi broker lỗi và thử lại ở vòng sau. Không có trạng thái `failed`, dead-letter hay giới hạn số lần.
- Duplicate được chấp nhận: nếu broker đã nhận message nhưng Grading chưa kịp ghi `published` (confirm timeout, process dừng, nhiều instance Grading), cùng `event_id` có thể được phát nhiều lần. **Notification chịu trách nhiệm deduplicate theo `event_id`.** Không có exactly-once.
- Topology: exchange `lms.events` (topic, durable) do Grading assert; routing key `grade.completed`; message persistent, `application/json`, `message-id` = `event_id`. Grading không tạo hay bind queue của Notification, nên event publish khi chưa có queue nào bind sẽ bị broker bỏ.
- Trace context: mỗi lần publish có span `PRODUCER` `lms.events publish`; `traceparent`/`tracestate` của span đó được inject vào RabbitMQ headers và dùng lại cho `correlation` của envelope. Khi telemetry tắt, `traceparent` mới (không sampled) được sinh vì contract bắt buộc trường này.
- Grading không fail khi khởi động mà broker chưa sẵn sàng; connection/channel lỗi được bỏ và tạo lại ở lần publish sau. Không log RabbitMQ URL hay credential.

## Cấu hình

Xem `.env.example`. Cổng mặc định `3007`. RabbitMQ: `GRADING_RABBITMQ_URL` (`amqp://` hoặc `amqps://`), `GRADING_GRADE_COMPLETED_EXCHANGE` (mặc định `lms.events`), `GRADING_PUBLISH_CONFIRM_TIMEOUT_MS` (500–30000, mặc định 3000), `GRADING_EVENT_RETRY_INTERVAL_MS` (1000–60000, mặc định 5000), `GRADING_EVENT_RETRY_BATCH_SIZE` (1–100, mặc định 20). Timeout dependency HTTP dùng `GRADING_DEPENDENCY_TIMEOUT_MS`; PostgreSQL dùng connection timeout 1000 ms và query timeout 2000 ms. Không log database URL.

## Dữ liệu và kiểm thử

`pnpm --filter @aiops-lms/grading build` rồi `node services/grading/dist/scripts/migrate.js` tạo bảng `grades` và seed một grade cho `submission-001` (idempotent). Kiểm thử PostgreSQL thật: `pnpm run test:grading:postgres` với `W1_AUTH_DATABASE_URL` và `GRADING_DATABASE_URL`.

Kiểm thử RabbitMQ thật (PostgreSQL + RabbitMQ): `pnpm run test:grading:rabbitmq` với `GRADING_DATABASE_URL` và `GRADING_RABBITMQ_URL`; test dùng queue tạm bind `grade.completed` rồi xóa, không phụ thuộc Notification.

Dependency telemetry dùng identity `grading-submission` và `grading-postgres` (span client, `grading.dependency.request.count`, `grading.dependency.error.count`, `grading.dependency.duration`) và `grading-rabbitmq` (span `PRODUCER` với `messaging.system=rabbitmq`, `messaging.operation.type=publish`, `messaging.destination.name`, `messaging.rabbitmq.destination.routing_key`; metric `grading.messaging.publish.count`, `grading.messaging.publish.error.count`, `grading.messaging.publish.duration`, gauge `grading.messaging.pending.count`). Label chỉ gồm giá trị hữu hạn; `event_id` chỉ có trên span, không dùng làm label.
