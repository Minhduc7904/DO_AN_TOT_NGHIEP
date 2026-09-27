# Task tuần: Triển khai consumer Notification và async telemetry

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_implement-notification-consumer-and-async-telemetry` |
| Tuần | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Đã giao |
| Người phụ trách | Bách |
| Collaborator | Đức rà soát tương thích RabbitMQ/publisher |
| Ưu tiên | Cao |
| Hạn dự kiến | 25/09/2026 |
| Nhánh thực hiện | `feat/week-08/task-02-implement-notification-consumer-and-async-telemetry` |

## Yêu cầu và phạm vi

### Cần thực hiện

Triển khai Notification consumer cho `grade.completed`, xử lý duplicate theo scope MVP bằng event ID ổn định và mô phỏng notification có thể kiểm tra. Propagate/extract trace context qua RabbitMQ headers, tạo RabbitMQ consume/process telemetry, logs correlation và metrics dependency cần thiết. Thêm fault hook consumer slowdown hoặc backlog mặc định tắt để phục vụ scenario F4.

### Không thực hiện

- Không thay đổi semantics Grading, publish reliability hay outbox; thuộc task-04/05 của Đức.
- Không gửi thông báo ra nhà cung cấp bên ngoài hoặc xây hệ thống retry/dead-letter production-grade.
- Không viết full workflow E2E qua Gateway; thuộc task-03.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01 event contract/skeleton; task-05 publisher `grade.completed`; backend blueprint §§9–10, §12.
- Người hoặc phần việc cần phối hợp: Đức cung cấp publisher tương thích và cùng kiểm tra header RabbitMQ.
- Rủi ro/giả định: delivery có thể at-least-once; duplicate được nhận biết bằng event ID, không dùng payload ID làm khóa mơ hồ; fault hook luôn tắt nếu không cấu hình.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Notification consumer và duplicate handling MVP | Code | `lms/services/notification/` |
| Async trace/log/metric assertions và fault hook F4 | Code | `lms/services/notification/test/`, `faults/` hoặc vị trí canonical đã có |

## Definition of Done

- [ ] Consumer xử lý fixture/publisher thật theo contract `grade.completed`, mô phỏng notification kiểm tra được và không xử lý lại event ID đã thành công.
- [ ] RabbitMQ publish→consume/process giữ trace context qua headers; spans, log correlation và metrics có dependency identity/operation/error semantics phù hợp.
- [ ] Fault hook Notification slowdown hoặc RabbitMQ backlog mặc định tắt, bật được có chủ đích và có test/assertion về symptom tối thiểu.
- [ ] Test unit/integration phù hợp pass; không có database/source import xuyên service và không ghi secret/PII vào telemetry.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-02_implement-notification-consumer-and-async-telemetry/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/bach/week-08_2026-09-20_to_2026-09-26/task-02_implement-notification-consumer-and-async-telemetry/output/task-output.md) (mẫu, chưa có báo cáo thực tế).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 27/09/2026 — tạo card và giao cho Bách.
- Ghi chú/tồn đọng: Chỉ bắt đầu consumer tích hợp sau khi task-05 công bố publisher; có thể chuẩn bị test fixture từ task-01.
