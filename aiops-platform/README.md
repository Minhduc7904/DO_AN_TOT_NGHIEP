# aiops-platform

Các thành phần thu thập dữ liệu và phân tích của đề tài, tách khỏi LMS. Service LMS chỉ kết nối tới đây qua HTTP (OTLP/HTTP tới Collector); LMS không import mã từ thư mục này.

Quyết định tách: [ADR-001](../docs/processed/adr/adr-001-restructure-lms-testbed-v1.md), [ADR-002](../docs/processed/adr/adr-002-ai-primary-root-cause-analysis-v1.md).

## Cấu trúc

| Thư mục | Trạng thái | Nội dung |
| --- | --- | --- |
| `observability/` | Có | Collector, Prometheus, Tempo, Loki, Grafana: cấu hình, Dockerfile, dashboard, `compose.yaml` riêng |
| `training/` | Chưa tạo | Module huấn luyện AI (phát hiện bất thường, RCA) |
| `mcp/` | Chưa tạo | MCP server chỉ đọc cho agent báo cáo (ADR-002) |
| `agent/` | Chưa tạo | Agent LLM đọc dữ liệu qua MCP và viết báo cáo |
| `load/`, `faults/`, `evaluation/` | Chưa tạo | Workload, fault injection, đánh giá |

Chỉ tạo thư mục khi bắt đầu triển khai module tương ứng.

## Cách LMS kết nối

- Network Docker tên cố định `aiops-net` (biến `AIOPS_NETWORK_NAME`); cả hai file compose khai báo cùng định nghĩa.
- Service LMS xuất telemetry tới `http://otel-collector:4318/v1/{traces,metrics,logs}` (biến `OTEL_EXPORTER_OTLP_*`).
- Collector scrape metrics broker `rabbitmq:15692`, nên RabbitMQ của LMS cũng nối vào `aiops-net`.

## Chạy

Các lệnh chạy từ thư mục gốc repository.

```bash
# Chỉ stack observability
docker compose --env-file aiops-platform/observability/.env.example \
  -f aiops-platform/observability/compose.yaml up --build -d --wait

# Chỉ LMS (không có Collector nên không có telemetry; chưa kiểm chứng hành vi exporter khi thiếu Collector)
docker compose --env-file docker-compose/.env.example -f docker-compose/compose.yaml up --build -d --wait

# Toàn bộ (LMS + aiops-platform trong một project, dùng cho test và CI)
docker compose --env-file docker-compose/.env.example -f docker-compose/compose.full.yaml up --build -d --wait
```

Khi chạy hai project riêng (hai lệnh đầu), Compose cảnh báo network `aiops-net` đã tồn tại do project khác tạo; đây là hành vi mong muốn vì hai bên dùng chung network.

Biến cấu hình stack nằm trong `observability/.env.example` (cổng loopback, mật khẩu Grafana, tên network). File `.env` local không được commit.

Chi tiết vận hành Collector, metrics, logs, dashboard: [docker-compose/README.md](../docker-compose/README.md) (các mục observability) — sẽ chuyển về đây khi viết lại tài liệu ở R-12.
