powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\sync-plan-json-and-timeline.ps1
# Input task

## Thông tin chung

| Trường | Nội dung |
| --- | --- |
| Mã task | `task-01_define-service-topology` |
| Tên task | Chốt service catalogue, dependency graph và architecture diagram v1 |
| Người phụ trách | Đức |
| Tuần thực hiện | `week-04_2026-08-23_to_2026-08-29` |
| Trạng thái | Hoàn thành trên branch task — sẵn sàng merge vào `main` |
| Ngày tạo | 27/08/2026 — hồ sơ ghi nhận hồi tố từ artifact Đức cung cấp |
| Thời gian dự kiến | Theo kế hoạch tuần 4; hạn dự kiến 25/08/2026 |
| Nhánh thực hiện | `docs/week-04/task-01-define-service-topology` |
| Pull request | [PR #6](https://github.com/Minhduc7904/DO_AN_TOT_NGHIEP/pull/6) |

## Mục tiêu và phạm vi

### Task cần làm gì?

Chuẩn hóa service catalogue, dependency graph và architecture diagram v1 cho LMS microservice testbed MVP. Tài liệu phải mô tả rõ Gateway, 6 business service, dependency PostgreSQL/Redis/RabbitMQ/Storage Mock, các flow đồng bộ/bất đồng bộ và boundary cần quan sát cho telemetry, graph và RCA.

### Phạm vi không thực hiện

- Không thêm Assignment, MinIO, Kubernetes, service mesh hoặc Chaos Mesh vào MVP.
- Không scaffold NestJS, Docker Compose hoặc triển khai fault injector.
- Không thay thế dynamic dependency graph quan sát từ telemetry bằng topology thiết kế tĩnh.

## Sản phẩm dự kiến

| Sản phẩm | Loại | Vị trí hoặc link dự kiến |
| --- | --- | --- |
| Service catalogue và architecture diagram v1 | Docs | [service-catalogue-and-topology-v1.md](../../../../../docs/processed/architecture/service-catalogue-and-topology-v1.md) |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: backend blueprint, Analysis/AI/RCA blueprint, plan v0.2, scope và RQ/metrics tuần 3.
- Người cần phối hợp: Bách review boundary phục vụ telemetry, graph và RCA.
- Rủi ro hoặc giả định: scope v1 và implementation backlog v1 đang ở PR riêng; topology không được mở rộng ngoài baseline canonical nếu chưa có ADR.

## Definition of Done

- [x] Catalogue nêu trách nhiệm, data ownership và inbound/outbound dependency cho 6 business service cùng Gateway.
- [x] Diagram thể hiện HTTP flow tối thiểu, `Grading -> grade.completed -> Notification` và dependency PostgreSQL/Redis/RabbitMQ/Storage Mock.
- [x] Scope MVP/Target/Stretch của topology nhất quán với backend blueprint.
- [x] Bách review các node/edge cần quan sát và phản hồi đã được ghi trong artifact; verdict `APPROVED` trên GitHub.
- [x] Sản phẩm đã được lưu tại vị trí dự kiến và có thể truy cập trên nhánh task.
- [x] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [x] Pull request có `APPROVED` hợp lệ từ Bách và completion metadata được commit/push trước khi merge.
