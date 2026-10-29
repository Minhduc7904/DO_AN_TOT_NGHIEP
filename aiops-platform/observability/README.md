# Observability của LMS testbed

Stack thu thập telemetry (Collector, Prometheus, Tempo, Loki, Grafana) tách khỏi LMS. 12 runtime của LMS (8 service và 4 worker, xem [topology v2](../../docs/processed/architecture/service-catalogue-and-topology-v2.md)) chỉ gửi OTLP/HTTP tới `otel-collector:4318` qua network `aiops-net`; LMS không import mã từ thư mục này.

Cách dựng chung với LMS nằm ở [aiops-platform/README.md](../README.md). Test đo telemetry xuyên service nằm ở [mục Kiểm chứng](#kiểm-chứng-bằng-smoke).

## Thành phần

| Backend           | Image gốc đã pin                               | Endpoint host mặc định                            | Readiness trong container |
| ----------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------- |
| Collector Contrib | `otel/opentelemetry-collector-contrib:0.163.1` | OTLP HTTP `127.0.0.1:4318`, gRPC `127.0.0.1:4317` | `http://127.0.0.1:13133/` |
| Prometheus        | `prom/prometheus:v3.15.0`                      | [Prometheus](http://127.0.0.1:9090)               | `/-/ready`                |
| Tempo             | `grafana/tempo:3.1.0`                          | [Tempo API](http://127.0.0.1:3200/ready)          | `/ready`                  |
| Loki              | `grafana/loki:3.7.9`                           | [Loki API](http://127.0.0.1:3100/ready)           | `/ready`                  |
| Grafana           | `grafana/grafana:13.2.4`                       | [Grafana](http://127.0.0.1:3008)                  | `/api/health`             |

Năm image dẫn xuất chỉ thêm executable `/health-probe` (Go static, builder `golang:1.25.8-alpine`) và thư mục dữ liệu được gán quyền cho user gốc. Probe yêu cầu HTTP 200, timeout 2 giây và exit khác 0 khi endpoint lỗi; không cần shell, curl hay wget. Entrypoint và user runtime gốc được giữ.

| Thành phần | Giới hạn RAM | CPU | Lưu trữ                                                              |
| ---------- | ------------ | --- | -------------------------------------------------------------------- |
| Collector  | 256 MiB      | 0.5 | Hàng đợi trong RAM                                                   |
| Prometheus | 512 MiB      | 0.5 | `prometheus-data`, retention 24 giờ hoặc 512 MB tùy ngưỡng đến trước |
| Tempo      | 512 MiB      | 0.5 | `tempo-data`, WAL/blocks local, retention 24 giờ                     |
| Loki       | 512 MiB      | 0.5 | `loki-data`, filesystem/TSDB v13, retention 24 giờ                   |
| Grafana    | 512 MiB      | 0.5 | `grafana-data`, cấu hình/UI state local                              |

Retention là chính sách xóa bất đồng bộ, không phải hard disk quota; khi đầy disk hoặc vượt RAM, telemetry có thể mất dù request nghiệp vụ vẫn chạy. Đây là MVP một node, chưa có HA, TLS, SSO hay lưu trữ dài hạn. Tempo 3 dùng `backend_worker.compaction`, không dùng cấu hình `compactor` của Tempo 2. Cấu hình Loki native OTLP theo [tài liệu chính thức](https://grafana.com/docs/loki/latest/send-data/otel/); cấu hình Tempo theo [ví dụ v3.1.0](https://github.com/grafana/tempo/blob/v3.1.0/example/docker-compose/single-binary/tempo.yaml).

## Cấu hình

Các cổng chỉ bind loopback, đổi bằng biến môi trường shell hoặc `.env` cạnh `compose.yaml` (mẫu: [.env.example](.env.example)): `OTEL_HTTP_PORT`, `OTEL_GRPC_PORT`, `PROMETHEUS_PORT`, `TEMPO_PORT`, `LOKI_PORT`, `GRAFANA_PORT`; hostname và port nội bộ giữ nguyên. Gateway dùng cổng 3000 nên Grafana dùng 3008 (scheduler publish 3018).

Đăng nhập Grafana bằng `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`. Mẫu trong `.env.example` là `admin`/`grafana-local-only`, chỉ dành cho local; compose bắt buộc có `GRAFANA_ADMIN_PASSWORD` và không có giá trị mặc định. `admin`/`admin` bị từ chối.

## Collector

Collector nhận OTLP HTTP/gRPC, batch tối đa 1024 record (gửi sau 1 giây hoặc 512 record), memory limiter 192 MiB và spike 48 MiB. Exporter trace và log retry tối đa 30 giây, hàng đợi 256 batch với 2 worker, không bền qua restart.

| Pipeline           | Nguồn                         | Đích                                                                |
| ------------------ | ----------------------------- | ------------------------------------------------------------------- |
| `traces`           | OTLP                          | Tempo (OTLP HTTP 4318)                                              |
| `metrics`          | OTLP                          | Prometheus exporter `:8889`; Prometheus scrape mỗi 5 giây           |
| `metrics/rabbitmq` | Scrape `rabbitmq:15692`       | Prometheus exporter `:8889`                                         |
| `logs`             | OTLP                          | Loki native OTLP `/otlp/v1/logs`                                    |

Chỉ ba resource identity (`service.name`, `service.version`, `service.instance.id`) được promote thành label metric. Loki chỉ index `service.name`; `trace_id`, `span_id`, severity và các field chẩn đoán là structured metadata.

### Metric hàng đợi của broker

RabbitMQ là hạ tầng dùng chung nên không có OTel SDK để tự báo. Pipeline `metrics/rabbitmq` scrape `/metrics/detailed` (họ `queue_coarse_metrics` và `queue_consumer_count`, vhost `/`) và chỉ giữ:

- `rabbitmq_detailed_queue_messages`, `rabbitmq_detailed_queue_messages_ready`, `rabbitmq_detailed_queue_messages_unacked`
- `rabbitmq_detailed_queue_consumers`

Chỉ queue canonical `<worker>--<command>-v<n>` của `media-worker`, `notification-worker`, `ai-worker` (và `<queue>.error` chứa command đã hết retry) được giữ; nguồn tên queue là [lms/contracts/src/commands/](../../lms/contracts/src/commands/). `scheduler-worker` không có queue. Không có queue `.retry`: consumer chờ trong tiến trình rồi đẩy thẳng sang `.error` khi hết lượt.

Mỗi series mang `service_name` là worker tiêu thụ queue (tiền tố trước `--`), `dependency_identity` = `<service_name>-rabbitmq` và nhãn `queue` (tối đa 24 giá trị). `service_version`/`service_instance_id` bị xóa vì broker không có phiên bản hay instance của runtime LMS; các series `up`/`scrape_*` do receiver tự sinh cũng bị lọc để không bị đọc nhầm là sức khỏe của runtime. Thiếu gauge không có nghĩa là 0 message.

Collector không gom theo tên queue cố định: thêm command mới vào `contracts` không cần sửa cấu hình, nhưng test `lms/test/observability/queue-scrape.test.mjs` so khớp regex queue của collector với danh sách trong `contracts` để phát hiện lệch.

## Dashboard và datasource

Grafana provision từ file trong repo, không lưu thay đổi trên UI (`allowUiUpdates: false`):

- [grafana-datasources.yaml](grafana-datasources.yaml): ba datasource uid `prometheus`, `tempo`, `loki`. Tempo có `tracesToLogsV2` mở log Loki của span theo `{service_name="<service.name>"} | trace_id="<trace>"`, khoảng thời gian span ±5 phút. Loki có derived field `trace_id` (structured metadata) mở trace trong Tempo.
- [grafana-dashboards.yaml](grafana-dashboards.yaml): provider đọc mọi JSON trong [dashboards/](dashboards/) vào folder "AIOps LMS". Thêm dashboard mới chỉ cần thêm file JSON có `uid` cố định.
- [dashboards/service-overview.json](dashboards/service-overview.json): dashboard "AIOps LMS — Service overview" (uid `aiops-lms-service-overview`), timezone UTC, biến `service` lấy từ `http_server_request_count_total`.

| Nhóm                 | Panel                                                                                    | Nguồn                                                         |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| RED theo service     | Request rate, error ratio (5xx và `client_aborted`), latency p95                         | `http_server_request_*`, bỏ `/health`                         |
| RED theo route       | Request rate theo route và status class, latency p95 theo route                          | `http_route_template` bounded                                 |
| Dependency và broker | Dependency lỗi theo `dependency_identity`/`status`, dependency latency p95, queue backlog | `lms_dependency_*`, `rabbitmq_detailed_queue_messages_*`      |
| Trace và log         | Trace lỗi gần đây (TraceQL), log `ERROR`/`FATAL`, log volume theo severity               | Tempo, Loki                                                   |

Điều tra một lỗi: click series trên panel RED hoặc dependency để mở TraceQL cùng service, mở trace, chọn "Logs for this span" để chạy query Loki theo `trace_id`, rồi từ log quay lại Tempo bằng link `trace_id`. Metric chưa có exemplar nên bước metric → trace lọc theo service, route và thời gian, không nhảy thẳng tới một trace.

## Tín hiệu LMS phát ra

Registry, nhãn, bucket và giới hạn của metric/log nằm ở [lms/packages/observability/README.md](../../lms/packages/observability/README.md). Tóm tắt các họ metric Prometheus nhận được từ 12 runtime:

| Họ metric                                                          | Nhãn chính                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `http_server_request_count_total`, `..._error_count_total`, `http_server_request_duration_seconds_*` | `service_name`, `http_method`, `http_route_template`, `http_status_class` |
| `lms_dependency_request_count_total`, `lms_dependency_error_count_total`, `lms_dependency_duration_seconds_*` | `service_name`, `dependency_identity`, `operation_name`, `status` |
| `rabbitmq_detailed_queue_*` (từ broker, không phải runtime)        | `service_name`, `dependency_identity`, `queue`                              |

## Kiểm chứng bằng smoke

Smoke chạy từ thư mục `lms/` và dùng stack `compose.full.yaml` với telemetry bật (xem [docker-compose/README.md](../../docker-compose/README.md#smoke-observability)). Chỉ project có tên `aiops-lms-test-*` mới được dùng.

## Vận hành

Tắt riêng backend và giữ dữ liệu bằng `docker compose --env-file docker-compose/.env.example -f docker-compose/compose.full.yaml stop otel-collector prometheus tempo loki grafana`; runtime LMS tiếp tục chạy nhưng mất export. `up -d --wait` để bật lại. `down` xóa container/network nhưng giữ named volume; **`down --volumes` và reset/seed xóa cả dữ liệu nghiệp vụ lẫn telemetry của project đã xác nhận**.

Runtime không tắt telemetry khi Collector không truy cập được; SDK export ngoài request path nên có thể mất dữ liệu khi buffer và retry hết. Telemetry không chứa secret, PII hay ground truth của fault.
