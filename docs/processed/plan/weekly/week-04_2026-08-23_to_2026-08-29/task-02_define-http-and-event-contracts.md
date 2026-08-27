# Task tuần: Thiết kế HTTP contract và event `grade.completed` v1

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-02_define-http-and-event-contracts` |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Đức |
| Collaborator | Bách review một HTTP flow và event field phục vụ telemetry/evaluation |
| Ưu tiên | Cao |
| Hạn dự kiến | 27/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-02-define-http-and-event-contracts` |

## Yêu cầu và phạm vi

### Cần thực hiện

Thiết kế contract v1 cho HTTP flow MVP và event bất đồng bộ `grade.completed`. Xác định request/response, ownership, versioning/error tối thiểu, correlation/identity field và quy tắc tương thích để tuần 5 có thể scaffold contracts.

### Không thực hiện

- Không triển khai endpoint/controller hoặc RabbitMQ producer/consumer.
- Không tạo event khác nếu chưa có consumer và failure mode có giá trị.
- Không để service import controller, entity hoặc repository của service khác.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: task-01, backend blueprint và telemetry schema draft từ task-04 khi có.
- Người hoặc phần việc cần phối hợp: Bách tham gia review ít nhất một HTTP flow và event `grade.completed`.
- Rủi ro/giả định: correlation ID/trace context và resource identity phải có đường đi rõ qua contract.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| HTTP contract và event schema v1 | Docs | `docs/processed/architecture/http-and-event-contracts-v1.md` |

## Definition of Done

- [ ] Có contract cho các workflow MVP cần thiết, gồm request/response/error tối thiểu và service ownership.
- [ ] Event `grade.completed` có producer, consumer, payload/schema version, correlation identity và failure/retry expectation.
- [ ] Contract không vi phạm rule cross-service source import hoặc data ownership của blueprint.
- [ ] Bách review một HTTP flow và event async; các yêu cầu telemetry/evaluation được phản ánh hoặc ghi tồn đọng.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-04_2026-08-23_to_2026-08-29/task-02_define-http-and-event-contracts/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-04_2026-08-23_to_2026-08-29/task-02_define-http-and-event-contracts/output/task-output.md).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 27/08/2026 — artifact đã được review nội bộ, đặt đúng thư mục và tạo hồ sơ hồi tố; đang chuẩn bị PR.
- Ghi chú/tồn đọng: phụ thuộc topology v1 của task-01; còn chờ Bách review W4 Submit và event `grade.completed` rồi gửi verdict trên GitHub.
