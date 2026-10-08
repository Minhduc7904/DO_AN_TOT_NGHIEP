# Task tuần: Publish `grade.completed` qua RabbitMQ

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-05_publish-grade-completed-event` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Đức |
| Collaborator | Bách kiểm tra consumer và async trace propagation |
| Ưu tiên | Cao |
| Hạn dự kiến | 24/09/2026 |
| Nhánh thực hiện | `feat/week-08/task-05-publish-grade-completed-event` |

## Yêu cầu và phạm vi

### Cần thực hiện

Tích hợp RabbitMQ publisher vào Grading sau khi grade thay đổi thành công, dùng contract `grade.completed` của task-01. Thực hiện reliability/idempotency phù hợp MVP: event ID ổn định, publish không làm tạo grade trùng, retry/error semantics được kiểm tra; publish span và trace-context headers phải tương thích Notification consumer.

### Không thực hiện

- Không triển khai Notification consumer hay E2E assertions; thuộc task-02 và task-03 của Bách.
- Không triển khai distributed transaction, outbox production-grade, dead-letter topology phức tạp hoặc exactly-once guarantee.
- Không thay đổi payload contract không có review từ Bách.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 event contract; task-04 Grading persistence/API; RabbitMQ baseline Week 5.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra compatibility với consumer, correlation headers và duplicate behavior.
- Rủi ro/giả định: delivery RabbitMQ có thể at-least-once; MVP ghi rõ failure/retry boundary thay vì hứa exactly-once.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Grading RabbitMQ publisher và reliability/idempotency tests | Code | `lms/services/grading/` |
| RabbitMQ config/telemetry assertions | Code / Config | `lms/infrastructure/`, `lms/packages/observability/` hoặc vị trí canonical đã có |

## Definition of Done

- [ ] Grade thay đổi hợp lệ publish đúng `grade.completed` version 1 với event ID, occurred time, producer, payload và trace context theo contract.
- [ ] Publish failure/retry behavior không tạo grade hoặc event ID trùng ngoài semantics MVP đã tài liệu hóa; test bao phủ ít nhất một duplicate/failure path.
- [ ] RabbitMQ publish span/metrics/logs có dependency identity, operation, error semantics và headers tương thích consumer của Bách.
- [ ] Integration test với RabbitMQ thật hoặc adapter tương đương có kiểm soát pass; config/health/CI liên quan được cập nhật khi cần.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-08_2026-09-20_to_2026-09-26/task-05_publish-grade-completed-event/input/task-input.md)
- Output workspace: [task-output.md](../../../../../workspace/duc/week-08_2026-09-20_to_2026-09-26/task-05_publish-grade-completed-event/output/task-output.md)
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 08/10/2026 — bắt đầu thực hiện; tạo input/output.
- Ghi chú/tồn đọng: Việc Bách review tương thích consumer không thay thế review PR chính thức. Timeline/JSON chờ đồng bộ bằng Windows PowerShell (script không chạy được trên Linux); Đức chỉ thị tiếp tục, không sửa tay đầu ra.
