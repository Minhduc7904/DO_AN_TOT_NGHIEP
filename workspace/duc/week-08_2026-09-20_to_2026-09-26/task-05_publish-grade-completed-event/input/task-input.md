# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_publish-grade-completed-event` |
| Tên task | Publish `grade.completed` qua RabbitMQ với reliability/idempotency MVP |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Hoàn thành |
| Ngày tạo | 08/10/2026 |
| Thời gian dự kiến | 1–2 ngày làm việc |
| Nhánh thực hiện | `feat/week-08/task-05-publish-grade-completed-event` |
| Pull request dự kiến | Sẽ tạo sau khi hoàn tất code + test |

## Mục tiêu và phạm vi

### Task cần làm gì?

Tích hợp RabbitMQ publisher vào Grading (`lms/services/grading/`) để mỗi grade mới tạo thành công phát event `grade.completed` version 1 theo contract của task-01 (`@aiops-lms/contracts`). Quyết định đã chốt:

- Publication state bền vững nằm ngay trong bảng `grades` của `grading_db` (cột `event_id`, `publish_status`, `publish_attempts`, `last_publish_error_code`, `published_at`); không dùng transactional outbox riêng.
- `event_id` là UUID sinh một lần cùng lúc insert grade và không đổi giữa các lần retry.
- Publish một lần ngay trong request; nếu lỗi thì grade vẫn tồn tại, request trả `503 DEPENDENCY_UNAVAILABLE`, background worker tự publish lại với cùng `event_id`. POST lại cùng Submission vẫn là `409`.
- Delivery at-least-once; duplicate cùng `event_id` được chấp nhận và Notification chịu trách nhiệm deduplicate.
- Publisher dùng confirm channel, exchange `lms.events` (topic, durable), routing key `grade.completed`, message persistent, inject W3C trace context vào RabbitMQ headers và dùng cùng context cho `correlation` của envelope.
- Telemetry: dependency identity `grading-rabbitmq`, producer span, metrics publish count/error/duration/pending.

### Phạm vi không thực hiện

- Không triển khai Notification consumer, E2E assertions (thuộc task-02, task-03 của Bách), dead-letter topology, exactly-once hoặc distributed transaction.
- Không sửa contract `grade.completed` v1.
- Không sửa `workspace/bach/`, `docs/raw/`.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Grading RabbitMQ publisher, worker retry, publication state và test | Code | `lms/services/grading/` |
| Compose/CI wiring RabbitMQ cho Grading, test RabbitMQ integration | Code / Config | `docker-compose/`, `.github/workflows/ci.yml`, `lms/package.json` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 (contract `grade.completed` v1, `docs/processed/architecture/http-and-event-contracts-v1.md` §11–§13); task-04 (Grading service đã merge); RabbitMQ baseline Week 5 trong Compose.
- Người cần phối hợp: Bách kiểm tra tương thích consumer, correlation header và duplicate behavior.
- Rủi ro hoặc giả định: delivery at-least-once; nhiều instance Grading có thể tạo duplicate hợp lệ; exchange/queue/retry không thuộc business schema.

## Definition of Done

- [ ] Grade thay đổi hợp lệ publish đúng `grade.completed` version 1 với event ID, occurred time, producer, payload và trace context theo contract.
- [ ] Publish failure/retry behavior không tạo grade hoặc event ID trùng ngoài semantics MVP đã tài liệu hóa; test bao phủ ít nhất một duplicate/failure path.
- [ ] RabbitMQ publish span/metrics/logs có dependency identity, operation, error semantics và headers tương thích consumer của Bách.
- [ ] Integration test với RabbitMQ thật hoặc adapter tương đương có kiểm soát pass; config/health/CI liên quan được cập nhật khi cần.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
