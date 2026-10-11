# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_implement-notification-consumer-and-async-telemetry` |
| Tên task | Triển khai consumer Notification và async telemetry |
| Người phụ trách | Bách |
| Tuần thực hiện | `week-08_2026-09-20_to_2026-09-26` |
| Trạng thái | Đang thực hiện |
| Ngày tạo | 28/09/2026 |
| Thời gian dự kiến | 28/09/2026–03/10/2026 |
| Nhánh thực hiện | `feat/week-08/task-02-implement-notification-consumer-and-async-telemetry` |
| Pull request dự kiến | PR từ nhánh task vào `main` |

## Mục tiêu và phạm vi

### Task cần làm gì?

Triển khai Notification consumer cho event `grade.completed` theo contract v1 đã có trên `main`, xử lý duplicate theo event ID ổn định và tạo mô phỏng notification có thể kiểm tra. Consumer phải extract/propagate trace context qua RabbitMQ headers, tạo telemetry cho consume/process, log correlation và metrics dependency; đồng thời có fault hook slowdown hoặc backlog phục vụ scenario F4.

### Phạm vi không thực hiện

- Không thay đổi semantics Grading, reliability/outbox hoặc publisher thật của task-04/task-05.
- Không gửi thông báo ra nhà cung cấp bên ngoài và không xây retry/dead-letter production-grade.
- Không triển khai full workflow E2E qua Gateway; thuộc task-03.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Notification consumer và duplicate handling MVP | Code | `lms/services/notification/` |
| Async trace/log/metric assertions và fault hook F4 | Code | `lms/services/notification/test/`, `faults/` hoặc vị trí canonical đã có |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 contract/skeleton đã merge; backend blueprint §§9–10, §12; task-05 publisher `grade.completed` sẽ cung cấp publisher tương thích.
- Người cần phối hợp: Đức rà soát tương thích RabbitMQ/publisher và header trace context.
- Rủi ro hoặc giả định: delivery có thể at-least-once; duplicate nhận biết bằng event ID; fault hook mặc định tắt; không ghi secret/PII vào telemetry. Consumer có thể chuẩn bị boundary/fixture test trước khi task-05 hoàn tất.

## Definition of Done

- [ ] Consumer xử lý fixture/publisher thật theo contract `grade.completed`, mô phỏng notification kiểm tra được và không xử lý lại event ID đã thành công.
- [ ] RabbitMQ publish→consume/process giữ trace context qua headers; spans, log correlation và metrics có dependency identity/operation/error semantics phù hợp.
- [ ] Fault hook Notification slowdown hoặc RabbitMQ backlog mặc định tắt, bật được có chủ đích và có test/assertion về symptom tối thiểu.
- [ ] Test unit/integration phù hợp pass; không có database/source import xuyên service và không ghi secret/PII vào telemetry.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request có mô tả đúng template, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
