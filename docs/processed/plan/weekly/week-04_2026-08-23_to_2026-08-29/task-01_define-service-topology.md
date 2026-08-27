# Task tuần: Chốt service catalogue, dependency graph và architecture diagram v1

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-service-topology` |
| Tuần | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Đang thực hiện |
| Người phụ trách | Đức |
| Collaborator | Bách review boundary phục vụ telemetry, graph và RCA |
| Ưu tiên | Cao |
| Hạn dự kiến | 25/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-01-define-service-topology` |

## Yêu cầu và phạm vi

### Cần thực hiện

Chuẩn hóa service catalogue và dependency graph MVP, đồng thời tạo architecture diagram v1. Mô tả Gateway, Auth, Course, Enrollment, Submission, Grading, Notification; các dependency PostgreSQL/Redis/RabbitMQ/storage mock và synchronous/asynchronous flow.

### Không thực hiện

- Không thêm Assignment, MinIO, Kubernetes hoặc service mesh vào MVP.
- Không scaffold service NestJS hay Docker Compose.
- Không thay đổi topology canonical khi chưa có ADR.

## Đầu vào và phụ thuộc

- Tài liệu/task cần có trước: scope v1, backend blueprint và RQ/metrics v1.
- Người hoặc phần việc cần phối hợp: Bách kiểm tra dependency graph có đủ identity/edge cho telemetry và RCA service-level.
- Rủi ro/giả định: dịch vụ chỉ tồn tại khi tạo dependency hoặc failure mode có giá trị thực nghiệm.

## Sản phẩm kỳ vọng

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Service catalogue và architecture diagram v1 | Docs | `docs/processed/architecture/service-catalogue-and-topology-v1.md` |

## Definition of Done

- [ ] Catalogue nêu trách nhiệm, owner dữ liệu và inbound/outbound dependency cho 6 business service cùng Gateway.
- [ ] Diagram thể hiện HTTP flow tối thiểu, `Grading -> grade.completed -> Notification` và dependency PostgreSQL/Redis/RabbitMQ/storage mock.
- [ ] Scope MVP/Target/Stretch của topology nhất quán backend blueprint.
- [ ] Bách review được các node/edge cần quan sát và phản hồi được ghi trong artifact.

## Liên kết hồ sơ thực hiện

- Input workspace: [task-input.md](../../../../../workspace/duc/week-04_2026-08-23_to_2026-08-29/task-01_define-service-topology/input/task-input.md).
- Output workspace: [task-output.md](../../../../../workspace/duc/week-04_2026-08-23_to_2026-08-29/task-01_define-service-topology/output/task-output.md).
- Pull request: Chưa tạo.
- Kết quả review: Chưa review.

## Cập nhật tiến độ

- Cập nhật gần nhất: 27/08/2026 — artifact đã được review nội bộ, đặt đúng thư mục và tạo hồ sơ hồi tố; đang chuẩn bị PR.
- Ghi chú/tồn đọng: là đầu vào cho task-02, task-03 và task-04; còn chờ Bách review node/edge và gửi verdict trên GitHub.
