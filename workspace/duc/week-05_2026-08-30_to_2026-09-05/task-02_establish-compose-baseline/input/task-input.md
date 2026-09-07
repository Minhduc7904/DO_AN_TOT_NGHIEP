# Input task

## Thông tin chung

| Trường               | Nội dung                                                                          |
| -------------------- | --------------------------------------------------------------------------------- |
| Mã task              | `task-02_establish-compose-baseline`                                              |
| Tên task             | Dựng Docker Compose baseline và Quick Start                                       |
| Người phụ trách      | Đức                                                                               |
| Tuần thực hiện       | `week-05_2026-08-30_to_2026-09-05`                                                |
| Trạng thái           | Đang thực hiện                                                                    |
| Ngày tạo             | 07/09/2026                                                                        |
| Thời gian dự kiến    | 01 ngày làm việc                                                                  |
| Nhánh thực hiện      | `feat/week-05/task-02-establish-compose-baseline`                                 |
| Pull request dự kiến | Tạo vào `main` sau khi PR #15 của task-01 merge và nhánh task-02 được đồng bộ lại |

## Mục tiêu và phạm vi

### Task cần làm gì?

Dựng Docker Compose baseline tại `docker-compose/` cùng cấp với `lms/` để build và khởi động Course service cùng PostgreSQL, Redis và RabbitMQ. Chuẩn hóa cấu hình local qua file environment mẫu, network và volume do Compose quản lý, readiness health check riêng cho từng dependency và Quick Start có thể thực hiện từ clean clone đến verify rồi stop/reset.

### Phạm vi không thực hiện

- Không tạo database migration, schema, seed hoặc business flow sử dụng PostgreSQL, Redis hay RabbitMQ.
- Không triển khai OpenTelemetry bootstrap, Collector, Prometheus, Tempo, Loki, Grafana hoặc CI.
- Không thêm Kubernetes, service mesh, MinIO, secret thật hoặc cấu hình production.
- Không sửa business API của Course service; chỉ tái sử dụng `GET /health` từ task-01.

## Sản phẩm dự kiến

| Sản phẩm                                  | Loại        | Vị trí hoặc link dự kiến                                                    |
| ----------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| Docker Compose baseline                   | Code/config | `docker-compose/compose.yaml`                                               |
| Cấu hình local mẫu không chứa secret thật | Config      | `docker-compose/.env.example`                                               |
| Quick Start và quy trình verify/reset     | Docs        | `docker-compose/README.md`, được liên kết từ `README.md` và `lms/README.md` |

## Đầu vào và phụ thuộc

- Tài liệu, dữ liệu hoặc task cần có trước: task-01 trên PR #15; backend blueprint; data ownership/dependency strategy tuần 4; Dockerfile và `/health` của Course service.
- Người cần phối hợp: Bách chạy fresh setup từ checkout sạch, xác nhận Quick Start và ghi lại mọi bước thiếu hoặc lỗi tái lập.
- Rủi ro hoặc giả định: nhánh task-02 đang xếp chồng trên task-01; PR task-02 chỉ được mở vào `main` sau khi PR #15 merge. Image phải dùng tag phiên bản cố định; health check phải kiểm tra readiness thực tế thay vì chỉ kiểm tra process/container còn chạy; port host phải có thể cấu hình để tránh xung đột local.

## Kế hoạch triển khai

1. Tạo `docker-compose/compose.yaml` gồm Course, PostgreSQL, Redis và RabbitMQ; build Course từ Dockerfile canonical của task-01.
2. Khai báo dependency ordering bằng `condition: service_healthy`; dùng `pg_isready`, `redis-cli ping`, `rabbitmq-diagnostics ping` và HTTP health probe của Course.
3. Chuẩn hóa biến môi trường, port host, named volume và network; cung cấp `.env.example` với giá trị local-only, không chứa secret thật.
4. Viết Quick Start cho các bước copy environment mẫu, validate config, build/start, xem trạng thái, gọi `/health`, đọc log và stop/reset cả volume.
5. Kiểm chứng `docker compose config`, startup sạch, toàn bộ health status, restart sau reset và khả năng truy cập `/health` từ host.
6. Nhờ Bách chạy lại quy trình trên checkout sạch; sửa mọi bước không tái lập trước khi chuyển task sang `Chờ review`.

## Definition of Done

- [ ] `docker compose config` hợp lệ với file environment mẫu và không cần file local ngoài Quick Start.
- [ ] `docker compose up --build -d` khởi động Course, PostgreSQL, Redis và RabbitMQ; toàn bộ container đạt trạng thái healthy.
- [ ] Course chỉ bắt đầu sau khi dependency readiness đạt và `GET /health` truy cập được từ host với `status=ok`.
- [ ] PostgreSQL, Redis và RabbitMQ dùng image tag cố định; port host, network và named volume được cấu hình rõ, không chứa secret thật.
- [ ] Quick Start mô tả đầy đủ clean clone, chuẩn bị environment, validate, start, verify, logs, stop và reset volume.
- [ ] Stack dừng/reset sạch và có thể khởi động lại bằng cùng cấu hình đã commit.
- [ ] Bách chạy fresh setup độc lập thành công; bằng chứng command/output được ghi trong PR hoặc output task.
- [ ] Sản phẩm đã được lưu/đẩy lên vị trí dự kiến và có thể truy cập.
- [ ] URL/số PR và trạng thái `Chờ review` đã được commit/push vào PR head trước khi reviewer bắt đầu review.
- [ ] Pull request từ nhánh task có mô tả đúng quy tắc, có verdict `APPROVED` hợp lệ từ thành viên còn lại trên GitHub và completion metadata được commit/push vào chính PR trước khi người phụ trách merge.
