# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_define-http-and-event-contracts` |
| Tên task | Thiết kế HTTP contract và event `grade.completed` v1 |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Chờ review |
| Ngày tạo | 27/08/2026 — hồ sơ ghi nhận hồi tố từ artifact Đức cung cấp |
| Thời gian dự kiến | Theo kế hoạch tuần 4; hạn dự kiến 27/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-02-define-http-and-event-contracts` |
| Pull request dự kiến | [PR #7](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/7) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Thiết kế HTTP contract v1 cho các workflow W1–W5 và event bất đồng bộ `grade.completed`. Contract phải xác định ownership, request/response/error tối thiểu, versioning, correlation/identity, failure/retry expectation và cross-service boundary để tuần 5 có thể scaffold contract có kiểm thử.

### Phạm vi không thực hiện

- Không triển khai controller, DTO, RabbitMQ producer/consumer hoặc runtime configuration.
- Không thiết kế event khác nếu chưa có consumer, failure mode và giá trị thực nghiệm.
- Không cho service import controller, entity, repository hoặc truy cập database của service khác.
- Không biến contract thành full LMS API hoặc chốt chi tiết production-grade ngoài MVP.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| HTTP contract và event schema v1 | Docs | [http-and-event-contracts-v1.md](../../../../../docs/processed/architecture/http-and-event-contracts-v1.md) |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: topology v1 của task-01, backend blueprint, Analysis/AI/RCA blueprint và RQ/metrics v1.
- Người cần phối hợp: Bách review ít nhất một HTTP flow và event `grade.completed`.
- Rủi ro hoặc giả định: topology v1 đang ở nhánh/PR riêng; telemetry/ground-truth schema task-04 chưa được approve nên field experiment không được đưa vào business payload.

## Definition of Done

- [x] Có contract cho workflow MVP, gồm request/response/error tối thiểu và service ownership.
- [x] Event `grade.completed` có producer, consumer, payload/schema version, correlation identity và failure/retry expectation.
- [x] Contract không vi phạm cross-service source import hoặc data ownership của backend blueprint.
- [ ] Bách review một HTTP flow và event async; yêu cầu telemetry/evaluation được phản ánh hoặc ghi tồn đọng.
- [x] Sản phẩm đã được lưu tại vị trí dự kiến và có thể truy cập trên nhánh task.
- [x] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request có `APPROVED` hợp lệ từ Bách và completion metadata được commit/push trước khi Đức merge.
